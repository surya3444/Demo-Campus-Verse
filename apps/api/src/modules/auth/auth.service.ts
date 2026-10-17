import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { ObjectId, WithId, Document } from 'mongodb';
import { collections } from '../../config/database';
import { getRedis } from '../../config/redis';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { parseDurationSeconds } from '../../utils/dates';
import {
  TokenPayload,
  AuthUser,
  LoginResponse,
  UserSession,
  OrganizationSignupInput,
  OrganizationSignup,
  OrganizationSignupResponse,
} from '@campus-verse/shared';
import { ApiError } from '../../middleware/errorHandler';
import { institutionService } from '../organization/institution.service';
import {
  ADMIN_TOGGLED_PERMISSIONS,
  PERMISSIONS as ALL_PERMISSIONS,
  SYSTEM_ROLES as SYSTEM_ROLE_CODES,
  ORG_ADMIN_PERMISSIONS,
  BRANCH_ADMIN_PERMISSIONS,
  TEACHER_PERMISSIONS,
  ADMISSION_COUNSELOR_PERMISSIONS,
  ACCOUNTANT_PERMISSIONS,
  HR_MANAGER_PERMISSIONS,
  RECEPTIONIST_PERMISSIONS,
  STUDENT_PERMISSIONS,
  PLACEMENT_OFFICER_PERMISSIONS,
  CAREER_COUNSELOR_PERMISSIONS,
  HOSTEL_WARDEN_PERMISSIONS,
  INVENTORY_MANAGER_PERMISSIONS,
  defaultModulesFor,
} from '@campus-verse/shared/constants';
import { emailService } from '../../services/email.service';
import { razorpayService } from '../../services/razorpay.service';

// Organization pricing in paise (₹999)
const NEW_ORG_PRICE = 99900;

const SALT_ROUNDS = 12;
const SESSION_PREFIX = 'session:';
const REFRESH_BLACKLIST_PREFIX = 'blacklist:refresh:';
const REVOKED_ALL_PREFIX = 'revoked_all:';
const RESET_TOKEN_PREFIX = 'reset:';
const VERIFICATION_TOKEN_PREFIX = 'verify:';
const RESET_TOKEN_EXPIRY = 60 * 60; // 1 hour in seconds
const VERIFICATION_TOKEN_EXPIRY = 24 * 60 * 60; // 24 hours in seconds

/**
 * Resolve permissions for system roles dynamically from the shared constants,
 * so that newly added module permissions are always included without needing
 * a DB migration on existing tenants.
 */
/**
 * Map of operational role codes to their canonical permission sets.
 * Used to dynamically resolve permissions so new modules are always
 * included without needing a DB migration on existing tenants.
 */
const OPERATIONAL_ROLE_PERMISSIONS: Record<string, Record<string, string[]>> = {
  TEACHER: TEACHER_PERMISSIONS,
  ADMISSION_COUNSELOR: ADMISSION_COUNSELOR_PERMISSIONS,
  ACCOUNTANT: ACCOUNTANT_PERMISSIONS,
  HR_MANAGER: HR_MANAGER_PERMISSIONS,
  RECEPTIONIST: RECEPTIONIST_PERMISSIONS,
  STUDENT: STUDENT_PERMISSIONS,
  PLACEMENT_OFFICER: PLACEMENT_OFFICER_PERMISSIONS,
  CAREER_COUNSELOR: CAREER_COUNSELOR_PERMISSIONS,
  HOSTEL_WARDEN: HOSTEL_WARDEN_PERMISSIONS,
  INVENTORY_MANAGER: INVENTORY_MANAGER_PERMISSIONS,
};

function resolvePermissions(
  roleCode: string,
  storedPermissions: Record<string, string[]>
): Record<string, string[]> {
  let permissions: Record<string, string[]>;
  switch (roleCode) {
    case SYSTEM_ROLE_CODES.GROUP_OWNER:
    case SYSTEM_ROLE_CODES.ORG_MODERATOR:
      permissions = { ...ALL_PERMISSIONS } as unknown as Record<string, string[]>;
      break;
    case SYSTEM_ROLE_CODES.ORG_ADMIN:
      permissions = { ...ORG_ADMIN_PERMISSIONS } as unknown as Record<string, string[]>;
      break;
    case SYSTEM_ROLE_CODES.BRANCH_ADMIN:
      permissions = { ...BRANCH_ADMIN_PERMISSIONS } as unknown as Record<string, string[]>;
      break;
    default: {
      // For known operational roles, merge canonical permissions with stored
      // so newly added module permissions are always included
      const canonical = OPERATIONAL_ROLE_PERMISSIONS[roleCode];
      if (canonical) {
        const merged = { ...storedPermissions, ...canonical };
        // Admin-toggled keys follow the saved role only, so switching one off sticks.
        for (const key of ADMIN_TOGGLED_PERMISSIONS) {
          if (storedPermissions[key]) merged[key] = storedPermissions[key];
          else delete merged[key];
        }
        return merged;
      }
      return storedPermissions;
    }
  }
  // Strip teacher-specific permissions from admin/system roles.
  // Keep teaching.timetable (admins manage timetables) and teaching.grades
  // (admins view the gradebook with the View-As-Teacher selector — see
  // apps/web/src/app/(dashboard)/teaching/gradebook/page.tsx).
  const teacherOnlyKeys = [
    'teaching.myClasses',
    'teaching.myStudents',
    'teaching.lessonPlans',
    'teaching.assignments',
  ];
  const filtered: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(permissions)) {
    if (!teacherOnlyKeys.includes(key)) {
      filtered[key] = value as string[];
    }
  }
  return filtered;
}

interface UserDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  email: string;
  passwordHash: string;
  phone?: string;
  profile: {
    firstName: string;
    lastName: string;
    displayName: string;
    avatar?: string;
    gender?: string;
  };
  roleId: ObjectId;
  accessScope: {
    type: 'global' | 'institution' | 'branch' | 'department' | 'program';
    institutionIds?: ObjectId[];
    programIds?: ObjectId[];
    branchIds: ObjectId[];
    departmentIds?: ObjectId[];
  };
  staffId?: ObjectId;
  preferences?: {
    language?: string;
    notifications?: {
      email?: boolean;
      sms?: boolean;
      push?: boolean;
    };
  };
  lastLogin?: Date;
  status: 'active' | 'inactive' | 'locked' | 'pending';
  failedLoginAttempts?: number;
  lockUntil?: Date;
  security?: {
    mfaEnabled?: boolean;
    passwordChangedAt?: Date;
    loginAttempts?: number;
    lockUntil?: Date;
    mustChangePassword?: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

interface RoleDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  name: string;
  code: string;
  description?: string;
  isSystemRole: boolean;
  level: number;
  permissions: Record<string, string[]>;
}

interface TenantDocument extends Document {
  _id: ObjectId;
  name: string;
  code: string;
  institutionTypes: string[];
  branding?: {
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
  };
  status: 'active' | 'inactive' | 'suspended' | 'trial' | 'pending';
}

interface BranchDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  name: string;
  code: string;
  institutionType: string;
  status: 'active' | 'inactive';
}

/**
 * Campuses hosting the given institutions. Institutions sit BELOW campuses
 * (Institution.branchId); the pre-inversion lookup on Branch.institutionId
 * matched nothing, so institution-scoped users logged in with no campus.
 */
type ScopeGrant = {
  type: string;
  institutionIds?: ObjectId[];
  departmentIds?: ObjectId[];
  programIds?: ObjectId[];
};

async function campusIdsForInstitutions(
  tenantId: ObjectId,
  institutionIds: ObjectId[]
): Promise<ObjectId[]> {
  const institutions = await collections.institutions
    .find({
      tenantId,
      _id: { $in: institutionIds.map((id) => new ObjectId(id)) },
      status: 'active',
    })
    .project({ branchId: 1 })
    .toArray();
  return institutions.map((i) => i.branchId as ObjectId).filter(Boolean);
}

class AuthService {
  // Password handling
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  // Token generation
  generateAccessToken(payload: Omit<TokenPayload, 'type'>): string {
    return jwt.sign({ ...payload, type: 'access' }, env.JWT_ACCESS_SECRET, {
      expiresIn: env.JWT_ACCESS_EXPIRY as jwt.SignOptions['expiresIn'],
    });
  }

  generateRefreshToken(payload: Omit<TokenPayload, 'type'>): string {
    // jti makes every refresh token unique. Without it, two tokens minted in
    // the same whole second (iat granularity) with the same claims are
    // byte-identical — so blacklisting one session would revoke the other,
    // and Redis session/blacklist keys (keyed by token string) would collide.
    const jti = crypto.randomBytes(8).toString('hex');

    // IDENTITY ONLY — deliberately no `permissions`/`accessScope`.
    //
    // This token lives in a cookie that rides along with every request. With a
    // full permission map embedded (~8KB for a GROUP_OWNER) the cookie plus the
    // Authorization header exceeded Node's 16KB header limit, and the server
    // answered 431 — which surfaced as sporadic request failures and logouts,
    // most reliably right after switching organisation (the one request that
    // carries a large token AND a large cookie).
    //
    // refreshAccessToken re-reads the role from the database, so the new access
    // token gets current permissions instead of whatever was frozen at login.
    return jwt.sign(
      {
        userId: payload.userId,
        tenantId: payload.tenantId,
        email: payload.email,
        type: 'refresh',
        jti,
      },
      env.JWT_REFRESH_SECRET,
      { expiresIn: env.JWT_REFRESH_EXPIRY as jwt.SignOptions['expiresIn'] }
    );
  }

  verifyAccessToken(token: string): TokenPayload {
    try {
      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload;
      if (payload.type !== 'access') {
        throw new ApiError('INVALID_TOKEN', 'Invalid token type', 401);
      }
      return payload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new ApiError('TOKEN_EXPIRED', 'Token expired', 401);
      }
      throw new ApiError('INVALID_TOKEN', 'Invalid token', 401);
    }
  }

  verifyRefreshToken(token: string): TokenPayload {
    try {
      const payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload;
      if (payload.type !== 'refresh') {
        throw new ApiError('INVALID_TOKEN', 'Invalid token type', 401);
      }
      return payload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new ApiError('REFRESH_TOKEN_EXPIRED', 'Refresh token expired', 401);
      }
      throw new ApiError('INVALID_TOKEN', 'Invalid refresh token', 401);
    }
  }

  // Session management
  async createSession(
    userId: string,
    tenantId: string,
    refreshToken: string,
    deviceInfo?: { userAgent?: string; ip?: string }
  ): Promise<void> {
    try {
      const redis = getRedis();
      if (redis.status !== 'ready') {
        logger.warn('Redis not available - skipping session storage');
        return;
      }
      const session: UserSession = {
        userId,
        tenantId,
        refreshToken,
        deviceInfo,
        createdAt: new Date(),
        lastAccessedAt: new Date(),
      };

      const expirySeconds = parseDurationSeconds(env.JWT_REFRESH_EXPIRY, 7 * 24 * 60 * 60);

      await redis.setex(
        `${SESSION_PREFIX}${userId}:${refreshToken}`,
        expirySeconds,
        JSON.stringify(session)
      );
    } catch (error) {
      logger.warn({ error }, 'Redis unavailable - session not stored');
    }
  }

  async getSession(userId: string, refreshToken: string): Promise<UserSession | null> {
    try {
      const redis = getRedis();
      if (redis.status !== 'ready') return null;
      const data = await redis.get(`${SESSION_PREFIX}${userId}:${refreshToken}`);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  // Has Redis answered our latest connection? Used by refreshAccessToken to
  // tell apart "Redis says this session was revoked" (fail closed) from "Redis
  // is unreachable right now" (fail open — trust the signed refresh JWT).
  private isRedisReady(): boolean {
    try {
      return getRedis().status === 'ready';
    } catch {
      return false;
    }
  }

  async deleteSession(userId: string, refreshToken: string): Promise<void> {
    try {
      const redis = getRedis();
      if (redis.status !== 'ready') return;
      await redis.del(`${SESSION_PREFIX}${userId}:${refreshToken}`);
    } catch {
      // Ignore Redis errors
    }
  }

  async deleteAllUserSessions(userId: string): Promise<void> {
    try {
      const redis = getRedis();
      if (redis.status !== 'ready') return;
      const keys = await redis.keys(`${SESSION_PREFIX}${userId}:*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch {
      // Ignore Redis errors
    }
  }

  /**
   * Revoke every refresh token the user holds (logout-all, password reset).
   * Stores a per-user revocation timestamp — refresh tokens issued before it
   * are rejected — so revocation works even if session keys were evicted.
   */
  async revokeAllUserSessions(userId: string): Promise<void> {
    try {
      const redis = getRedis();
      if (redis.status === 'ready') {
        const refreshExpiry = this.parseExpiryToSeconds(env.JWT_REFRESH_EXPIRY);
        await redis.set(
          `${REVOKED_ALL_PREFIX}${userId}`,
          Date.now().toString(),
          'EX',
          refreshExpiry
        );
      }
    } catch {
      logger.warn({ userId }, 'Failed to store session revocation timestamp');
    }
    await this.deleteAllUserSessions(userId);
  }

  // Password reset tokens
  async createPasswordResetToken(email: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    try {
      const redis = getRedis();
      if (redis.status === 'ready') {
        await redis.setex(`${RESET_TOKEN_PREFIX}${token}`, RESET_TOKEN_EXPIRY, email);
      }
    } catch {
      logger.warn('Redis unavailable - password reset token not stored');
    }
    return token;
  }

  async verifyPasswordResetToken(token: string): Promise<string | null> {
    try {
      const redis = getRedis();
      if (redis.status !== 'ready') return null;
      return redis.get(`${RESET_TOKEN_PREFIX}${token}`);
    } catch {
      return null;
    }
  }

  async deletePasswordResetToken(token: string): Promise<void> {
    try {
      const redis = getRedis();
      if (redis.status !== 'ready') return;
      await redis.del(`${RESET_TOKEN_PREFIX}${token}`);
    } catch {
      // Ignore Redis errors
    }
  }

  // Login
  async login(
    email: string,
    password: string,
    deviceInfo?: { userAgent?: string; ip?: string }
  ): Promise<LoginResponse> {
    // One email can exist in SEVERAL tenants (that's what powers the
    // organisation switcher), and those records can carry different passwords.
    // findOne() would pick an arbitrary one and reject valid credentials that
    // belong to a different org, so try every candidate and take the one whose
    // password actually verifies. Active records are preferred so a
    // deactivated membership in one org can't shadow a live one elsewhere.
    const candidates = (await collections.users
      .find({ email: email.toLowerCase() })
      .toArray()) as WithId<UserDocument>[];
    candidates.sort((a, b) => (a.status === 'active' ? -1 : 1) - (b.status === 'active' ? -1 : 1));

    let user: WithId<UserDocument> | null = null;
    for (const candidate of candidates) {
      if (await this.verifyPassword(password, candidate.passwordHash)) {
        user = candidate;
        break;
      }
    }

    // Distinguish "no such email" from "wrong password" for the pending-signup
    // fallback below, which should only run when the email is unknown to us.
    if (!user && candidates.length > 0) {
      logger.warn({ email }, 'Login failed: password did not match any organisation record');
      throw new ApiError('INVALID_CREDENTIALS', 'Invalid credentials', 401);
    }

    if (!user) {
      // Check if user is in pending organization signups
      const pendingSignup = await collections.organizationSignups.findOne({
        'admin.email': email.toLowerCase(),
      });

      if (pendingSignup) {
        // Verify password for pending signup
        const isValidPassword = await this.verifyPassword(
          password,
          pendingSignup.admin.passwordHash
        );

        if (!isValidPassword) {
          throw new ApiError('INVALID_CREDENTIALS', 'Invalid credentials', 401);
        }

        // Return pending user response
        return this.createPendingLoginResponse(pendingSignup, deviceInfo);
      }

      logger.warn({ email }, 'Login attempt for non-existent user');
      throw new ApiError('INVALID_CREDENTIALS', 'Invalid credentials', 401);
    }

    // Check if account is locked (disabled for development)
    // if (user.status === 'locked' || (user.lockUntil && user.lockUntil > new Date())) {
    //   throw new ApiError('ACCOUNT_LOCKED', 'Account is locked. Please try again later or contact support.', 401);
    // }

    // Check if account is inactive or has been deleted (defense in depth —
    // student soft-delete now flips the linked user to `inactive`, but a
    // legacy row with `status: 'deleted'` should also be blocked).
    // Guest/temporary access: an expired validUntil blocks login outright.
    if (user.validUntil && new Date(user.validUntil as Date) < new Date()) {
      throw new ApiError(
        'ACCOUNT_EXPIRED',
        'This temporary account has expired. Please contact your administrator.',
        403
      );
    }

    if (user.status === 'inactive' || (user.status as string) === 'deleted') {
      throw new ApiError(
        'ACCOUNT_INACTIVE',
        'Account is inactive. Please contact administrator.',
        401
      );
    }

    // Password was already verified above when selecting the matching
    // organisation record — re-hashing here would double login latency.

    // Get tenant
    const tenant = (await collections.tenants.findOne({
      _id: user.tenantId,
    })) as WithId<TenantDocument> | null;

    if (!tenant || tenant.status === 'suspended') {
      throw new ApiError(
        'TENANT_SUSPENDED',
        'Organization is suspended. Please contact support.',
        401
      );
    }

    // Get role
    const role = (await collections.roles.findOne({
      _id: user.roleId,
    })) as WithId<RoleDocument> | null;

    if (!role) {
      throw new ApiError('ROLE_NOT_FOUND', 'User role not found', 500);
    }

    // Get accessible branches
    let branches: WithId<BranchDocument>[] = [];
    if (user.accessScope.type === 'global') {
      branches = (await collections.branches
        .find({
          tenantId: user.tenantId,
          status: 'active',
        })
        .toArray()) as WithId<BranchDocument>[];
    } else if (user.accessScope.type === 'institution' && user.accessScope.institutionIds?.length) {
      // Institution scope resolves to the campuses hosting the institutions
      // (Institution.branchId), so the grant follows an institution's campus.
      branches = (await collections.branches
        .find({
          tenantId: user.tenantId,
          _id: {
            $in: await campusIdsForInstitutions(user.tenantId, user.accessScope.institutionIds),
          },
          status: 'active',
        })
        .toArray()) as WithId<BranchDocument>[];
    } else {
      branches = (await collections.branches
        .find({
          _id: { $in: user.accessScope.branchIds },
          status: 'active',
        })
        .toArray()) as WithId<BranchDocument>[];
    }

    // Generate tokens
    const tokenPayload: Omit<TokenPayload, 'type'> = {
      userId: user._id.toString(),
      tenantId: user.tenantId.toString(),
      email: user.email,
      roleCode: role.code,
      roleLevel: role.level,
      permissions: resolvePermissions(role.code, role.permissions),
      accessScope: {
        type: user.accessScope.type,
        institutionIds: user.accessScope.institutionIds?.map((id) => id.toString()),
        branchIds: user.accessScope.branchIds.map((id) => id.toString()),
        departmentIds: user.accessScope.departmentIds?.map((id) => id.toString()),
        programIds: user.accessScope.programIds?.map((id) => id.toString()),
      },
    };

    const accessToken = this.generateAccessToken(tokenPayload);
    const refreshToken = this.generateRefreshToken(tokenPayload);

    // Store session
    await this.createSession(
      user._id.toString(),
      user.tenantId.toString(),
      refreshToken,
      deviceInfo
    );

    // Update last login and reset failed attempts
    await collections.users.updateOne(
      { _id: user._id },
      {
        $set: {
          lastLogin: new Date(),
          failedLoginAttempts: 0,
          lockUntil: null,
          updatedAt: new Date(),
        },
      }
    );

    // Get all organizations this user belongs to
    const organizations = await this.getUserOrganizations(user.email);

    // Build auth user response
    const authUser: AuthUser = {
      id: user._id.toString(),
      email: user.email,
      phone: user.phone,
      profile: user.profile,
      roleCode: role.code,
      roleLevel: role.level,
      permissions: resolvePermissions(role.code, role.permissions),
      accessScope: {
        type: user.accessScope.type,
        institutionIds: user.accessScope.institutionIds?.map((id) => id.toString()),
        branchIds: user.accessScope.branchIds.map((id) => id.toString()),
        departmentIds: user.accessScope.departmentIds?.map((id) => id.toString()),
        programIds: user.accessScope.programIds?.map((id) => id.toString()),
      },
      branches: await this.enrichBranchesWithLogos(branches),
      institutions: await this.getInstitutionsForUser(user.tenantId, branches, user.accessScope),
      tenant: {
        _id: tenant._id.toString(),
        name: tenant.name,
        code: tenant.code,
        institutionTypes: tenant.institutionTypes as ('school' | 'college' | 'university')[],
        branding: tenant.branding,
        status: tenant.status as 'active' | 'inactive' | 'suspended' | 'trial' | 'pending',
        subscription: tenant.subscription,
        onboardingCompleted: tenant.onboardingCompleted,
      },
      organizations,
      mustChangePassword: user.security?.mustChangePassword || false,
    };

    logger.info({ userId: user._id.toString() }, 'User logged in successfully');

    return {
      user: authUser,
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: this.parseExpiryToSeconds(env.JWT_ACCESS_EXPIRY),
      },
    };
  }

  // Refresh token — rotates the refresh token on every call. The refresh JWT's
  // exp is baked in at issuance, so without rotation every session dies a hard
  // death N days after login no matter how active the user is (sliding the
  // cookie's maxAge alone does nothing — jwt.verify still rejects the old exp).
  // Rotation means active users stay logged in indefinitely; only
  // JWT_REFRESH_EXPIRY of *inactivity* ends a session.
  async refreshAccessToken(
    refreshToken: string
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const payload = this.verifyRefreshToken(refreshToken) as TokenPayload & { iat?: number };

    // Revocation is a DENY-list, not an allow-list: a refresh token is valid
    // unless it was explicitly revoked (single logout → blacklist entry;
    // logout-all/password-reset → per-user revocation timestamp). The session
    // store is informational only — a session key lost to Redis eviction,
    // restart, or flush must NEVER log a working user out. Redis being
    // unreachable fails open: we trust the signed JWT.
    try {
      const redis = getRedis();
      if (redis.status === 'ready') {
        const [blacklisted, revokedAllAt] = await Promise.all([
          redis.get(`${REFRESH_BLACKLIST_PREFIX}${refreshToken}`),
          redis.get(`${REVOKED_ALL_PREFIX}${payload.userId}`),
        ]);

        if (blacklisted) {
          throw new ApiError('SESSION_INVALID', 'Session expired or invalid', 401);
        }
        // Tokens issued before a logout-all/password-reset are revoked.
        // iat truncates to whole seconds, so only revoke when the token's
        // issuing second ended at/before the revocation instant — otherwise a
        // user logging back in within the same second as the reset would be
        // wrongly revoked and booted on their first refresh.
        if (revokedAllAt && payload.iat && (payload.iat + 1) * 1000 <= parseInt(revokedAllAt, 10)) {
          throw new ApiError('SESSION_INVALID', 'Session expired or invalid', 401);
        }
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.warn(
        { userId: payload.userId },
        'Redis unavailable during refresh — trusting signed refresh JWT'
      );
    }

    // Check if user still exists and is active or pending
    const user = await collections.users.findOne({
      _id: new ObjectId(payload.userId),
      status: { $in: ['active', 'pending'] },
    });

    if (!user) {
      await this.deleteSession(payload.userId, refreshToken);
      throw new ApiError('USER_INVALID', 'User not found or inactive', 401);
    }

    // Guest/temporary access: an expired validUntil ends the session at the
    // next refresh (access tokens are short-lived, so expiry bites quickly).
    if (user.validUntil && new Date(user.validUntil as Date) < new Date()) {
      await this.deleteSession(payload.userId, refreshToken);
      throw new ApiError('ACCOUNT_EXPIRED', 'This temporary account has expired', 401);
    }

    // The refresh token carries identity only, so re-read the role to rebuild
    // the access token's claims. Side benefit: a role or scope change now takes
    // effect on the next refresh instead of persisting for the whole session.
    const role = (await collections.roles.findOne({
      _id: user.roleId,
    })) as WithId<RoleDocument> | null;

    if (!role) {
      throw new ApiError('ROLE_NOT_FOUND', 'User role not found', 401);
    }

    // Rotate: mint a fresh access + refresh pair. jwt.sign rejects payloads that
    // already carry iat/exp, so build the claims explicitly.
    const tokenPayload: Omit<TokenPayload, 'type'> = {
      userId: payload.userId,
      tenantId: user.tenantId.toString(),
      email: payload.email,
      roleCode: role.code,
      roleLevel: role.level,
      permissions: resolvePermissions(role.code, role.permissions),
      accessScope: {
        type: user.accessScope.type,
        institutionIds: user.accessScope.institutionIds?.map((id: ObjectId) => id.toString()),
        branchIds: user.accessScope.branchIds.map((id: ObjectId) => id.toString()),
        departmentIds: user.accessScope.departmentIds?.map((id: ObjectId) => id.toString()),
        programIds: user.accessScope.programIds?.map((id: ObjectId) => id.toString()),
      },
    };
    const newAccessToken = this.generateAccessToken(tokenPayload);
    const newRefreshToken = this.generateRefreshToken(tokenPayload);

    // The OLD refresh token is deliberately NOT blacklisted. Tabs share the
    // cookie but refresh independently — a second tab's in-flight refresh
    // still carries the pre-rotation token, and revoking it immediately would
    // boot that tab (the exact abrupt-logout bug rotation is meant to fix).
    // Letting it age out at its original exp matches the pre-rotation
    // security posture; explicit logout still blacklists whatever the cookie
    // holds at that moment.
    //
    // Move the session record to the new token (best-effort bookkeeping —
    // carry over device info so the sessions list keeps its provenance).
    if (this.isRedisReady()) {
      const session = await this.getSession(payload.userId, refreshToken);
      void this.deleteSession(payload.userId, refreshToken);
      void this.createSession(
        payload.userId,
        payload.tenantId,
        newRefreshToken,
        session?.deviceInfo
      );
    }

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: this.parseExpiryToSeconds(env.JWT_ACCESS_EXPIRY),
    };
  }

  // Logout
  async logout(userId: string, refreshToken: string, accessToken?: string): Promise<void> {
    await this.deleteSession(userId, refreshToken);

    try {
      const redis = getRedis();
      const refreshExpiry = this.parseExpiryToSeconds(env.JWT_REFRESH_EXPIRY);

      // Blacklist the refresh token — this is what actually revokes the
      // session (refresh validation is a deny-list, see refreshAccessToken)
      await redis.set(`${REFRESH_BLACKLIST_PREFIX}${refreshToken}`, '1', 'EX', refreshExpiry);

      // Blacklist the access token so it cannot be reused until expiry
      if (accessToken) {
        const accessExpiry = this.parseExpiryToSeconds(env.JWT_ACCESS_EXPIRY);
        await redis.set(`blacklist:${accessToken}`, '1', 'EX', accessExpiry);
      }
    } catch {
      logger.warn({ userId }, 'Failed to blacklist tokens on logout');
    }

    logger.info({ userId }, 'User logged out');
  }

  // Switch organization - returns new tokens and user data for different tenant
  async switchOrganization(
    email: string,
    targetTenantId: string,
    currentRefreshToken: string,
    deviceInfo?: { userAgent?: string; ip?: string }
  ): Promise<LoginResponse> {
    // Find the user in the target tenant
    const user = (await collections.users.findOne({
      email: email.toLowerCase(),
      tenantId: new ObjectId(targetTenantId),
      status: 'active',
    })) as WithId<UserDocument> | null;

    if (!user) {
      throw new ApiError('USER_NOT_FOUND', 'User not found in target organization', 404);
    }

    // Get tenant
    const tenant = (await collections.tenants.findOne({
      _id: new ObjectId(targetTenantId),
    })) as WithId<TenantDocument> | null;

    if (!tenant || tenant.status === 'suspended') {
      throw new ApiError('TENANT_SUSPENDED', 'Organization is suspended', 401);
    }

    // Get role
    const role = (await collections.roles.findOne({
      _id: user.roleId,
    })) as WithId<RoleDocument> | null;

    if (!role) {
      throw new ApiError('ROLE_NOT_FOUND', 'User role not found', 500);
    }

    // Get accessible branches
    let branches: WithId<BranchDocument>[] = [];
    if (user.accessScope.type === 'global') {
      branches = (await collections.branches
        .find({ tenantId: user.tenantId, status: 'active' })
        .toArray()) as WithId<BranchDocument>[];
    } else if (user.accessScope.type === 'institution' && user.accessScope.institutionIds?.length) {
      branches = (await collections.branches
        .find({
          tenantId: user.tenantId,
          _id: {
            $in: await campusIdsForInstitutions(user.tenantId, user.accessScope.institutionIds),
          },
          status: 'active',
        })
        .toArray()) as WithId<BranchDocument>[];
    } else {
      branches = (await collections.branches
        .find({ _id: { $in: user.accessScope.branchIds }, status: 'active' })
        .toArray()) as WithId<BranchDocument>[];
    }

    // Generate new tokens for the target tenant
    const tokenPayload: Omit<TokenPayload, 'type'> = {
      userId: user._id.toString(),
      tenantId: user.tenantId.toString(),
      email: user.email,
      roleCode: role.code,
      roleLevel: role.level,
      permissions: resolvePermissions(role.code, role.permissions),
      accessScope: {
        type: user.accessScope.type,
        institutionIds: user.accessScope.institutionIds?.map((id) => id.toString()),
        branchIds: user.accessScope.branchIds.map((id) => id.toString()),
        departmentIds: user.accessScope.departmentIds?.map((id) => id.toString()),
        programIds: user.accessScope.programIds?.map((id) => id.toString()),
      },
    };

    const accessToken = this.generateAccessToken(tokenPayload);
    const refreshToken = this.generateRefreshToken(tokenPayload);

    // Delete old session and create new one
    const oldPayload = this.verifyRefreshToken(currentRefreshToken);
    await this.deleteSession(oldPayload.userId, currentRefreshToken);
    await this.createSession(
      user._id.toString(),
      user.tenantId.toString(),
      refreshToken,
      deviceInfo
    );

    // Get all organizations this user belongs to
    const organizations = await this.getUserOrganizations(user.email);

    // Build auth user response
    const authUser: AuthUser = {
      id: user._id.toString(),
      email: user.email,
      phone: user.phone,
      profile: user.profile,
      roleCode: role.code,
      roleLevel: role.level,
      permissions: resolvePermissions(role.code, role.permissions),
      accessScope: {
        type: user.accessScope.type,
        institutionIds: user.accessScope.institutionIds?.map((id) => id.toString()),
        branchIds: user.accessScope.branchIds.map((id) => id.toString()),
        departmentIds: user.accessScope.departmentIds?.map((id) => id.toString()),
        programIds: user.accessScope.programIds?.map((id) => id.toString()),
      },
      branches: await this.enrichBranchesWithLogos(branches),
      institutions: await this.getInstitutionsForUser(user.tenantId, branches, user.accessScope),
      tenant: {
        _id: tenant._id.toString(),
        name: tenant.name,
        code: tenant.code,
        institutionTypes: tenant.institutionTypes as ('school' | 'college' | 'university')[],
        branding: tenant.branding,
        status: tenant.status as 'active' | 'inactive' | 'suspended' | 'trial' | 'pending',
        subscription: tenant.subscription,
        onboardingCompleted: tenant.onboardingCompleted,
      },
      organizations,
    };

    logger.info(
      { userId: user._id.toString(), tenantId: targetTenantId },
      'User switched organization'
    );

    return {
      user: authUser,
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: this.parseExpiryToSeconds(env.JWT_ACCESS_EXPIRY),
      },
    };
  }

  // Logout all devices
  async logoutAllDevices(userId: string): Promise<void> {
    await this.revokeAllUserSessions(userId);
    logger.info({ userId }, 'User logged out from all devices');
  }

  // Forgot password
  async forgotPassword(email: string): Promise<void> {
    const user = await collections.users.findOne({ email: email.toLowerCase() });

    // Always respond with success to prevent email enumeration
    if (!user) {
      logger.warn({ email }, 'Password reset requested for non-existent email');
      return;
    }

    const token = await this.createPasswordResetToken(email.toLowerCase());

    // emailService no-ops with a logged warning when RESEND_API_KEY is
    // missing, so this is safe in dev environments without email configured.
    const sent = await emailService.sendForgotPasswordLink(email.toLowerCase(), token);
    if (!sent) {
      logger.warn(
        { email },
        'Password reset email could not be sent — token logged for manual recovery'
      );
      logger.info({ email, token }, 'Password reset token generated');
    }
  }

  // Reset password
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const email = await this.verifyPasswordResetToken(token);

    if (!email) {
      throw new ApiError('INVALID_RESET_TOKEN', 'Invalid or expired reset token', 400);
    }

    const user = await collections.users.findOne({ email });
    if (!user) {
      throw new ApiError('USER_NOT_FOUND', 'User not found', 404);
    }

    const passwordHash = await this.hashPassword(newPassword);

    await collections.users.updateOne(
      { email },
      {
        $set: {
          passwordHash,
          failedLoginAttempts: 0,
          lockUntil: null,
          updatedAt: new Date(),
        },
      }
    );

    // Delete reset token
    await this.deletePasswordResetToken(token);

    // Invalidate all sessions (revocation timestamp + session cleanup)
    await this.revokeAllUserSessions(user._id.toString());

    logger.info({ email }, 'Password reset successfully');
  }

  // Change password
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = (await collections.users.findOne({
      _id: new ObjectId(userId),
    })) as WithId<UserDocument> | null;

    if (!user) {
      throw new ApiError('USER_NOT_FOUND', 'User not found', 404);
    }

    const isValidPassword = await this.verifyPassword(currentPassword, user.passwordHash);
    if (!isValidPassword) {
      throw new ApiError('INVALID_PASSWORD', 'Current password is incorrect', 400);
    }

    const passwordHash = await this.hashPassword(newPassword);

    await collections.users.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          passwordHash,
          status: 'active', // Activate user after first password change
          'security.mustChangePassword': false,
          'security.passwordChangedAt': new Date(),
          updatedAt: new Date(),
        },
      }
    );

    logger.info({ userId }, 'Password changed successfully, user activated');
  }

  // Get all organizations a user belongs to (by email)
  async getUserOrganizations(email: string): Promise<AuthUser['organizations']> {
    // Find all users with this email across all tenants
    const userRecords = await collections.users
      .find({
        email: email.toLowerCase(),
        status: 'active',
      })
      .toArray();

    const organizations: AuthUser['organizations'] = [];

    for (const userRecord of userRecords) {
      const tenant = await collections.tenants.findOne({
        _id: userRecord.tenantId,
        status: { $in: ['active', 'trial'] },
      });

      if (!tenant) continue;

      const role = (await collections.roles.findOne({
        _id: userRecord.roleId,
      })) as WithId<RoleDocument> | null;

      if (!role) continue;

      organizations.push({
        id: tenant._id.toString(),
        name: tenant.name,
        code: tenant.code,
        institutionType: tenant.institutionTypes?.[0] || 'school',
        roleCode: role.code,
        roleLevel: role.level,
        logo: tenant.branding?.logo || undefined,
      });
    }

    return organizations;
  }

  // Get user profile
  async getProfile(userId: string): Promise<AuthUser> {
    const user = (await collections.users.findOne({
      _id: new ObjectId(userId),
    })) as WithId<UserDocument> | null;

    if (!user) {
      throw new ApiError('USER_NOT_FOUND', 'User not found', 404);
    }

    const tenant = (await collections.tenants.findOne({
      _id: user.tenantId,
    })) as WithId<TenantDocument> | null;
    const role = (await collections.roles.findOne({
      _id: user.roleId,
    })) as WithId<RoleDocument> | null;

    if (!tenant || !role) {
      throw new ApiError('DATA_INCOMPLETE', 'User data incomplete', 500);
    }

    let branches: WithId<BranchDocument>[] = [];
    if (user.accessScope.type === 'global') {
      branches = (await collections.branches
        .find({
          tenantId: user.tenantId,
          status: 'active',
        })
        .toArray()) as WithId<BranchDocument>[];
    } else if (user.accessScope.type === 'institution' && user.accessScope.institutionIds?.length) {
      // Same resolution as login/refresh. Without this, refreshProfile
      // returned the stale branchIds snapshot for institution-scoped users.
      branches = (await collections.branches
        .find({
          tenantId: user.tenantId,
          _id: {
            $in: await campusIdsForInstitutions(user.tenantId, user.accessScope.institutionIds),
          },
          status: 'active',
        })
        .toArray()) as WithId<BranchDocument>[];
    } else {
      branches = (await collections.branches
        .find({
          _id: { $in: user.accessScope.branchIds },
          status: 'active',
        })
        .toArray()) as WithId<BranchDocument>[];
    }

    // Get all organizations this user belongs to
    const organizations = await this.getUserOrganizations(user.email);

    const userDoc = user as WithId<UserDocument> & {
      studentId?: ObjectId;
      staffId?: ObjectId;
    };

    return {
      id: user._id.toString(),
      email: user.email,
      phone: user.phone,
      profile: user.profile,
      roleCode: role.code,
      roleLevel: role.level,
      permissions: resolvePermissions(role.code, role.permissions),
      accessScope: {
        type: user.accessScope.type,
        institutionIds: user.accessScope.institutionIds?.map((id) => id.toString()),
        branchIds: user.accessScope.branchIds.map((id) => id.toString()),
        departmentIds: user.accessScope.departmentIds?.map((id) => id.toString()),
        programIds: user.accessScope.programIds?.map((id) => id.toString()),
      },
      branches: await this.enrichBranchesWithLogos(branches),
      institutions: await this.getInstitutionsForUser(user.tenantId, branches, user.accessScope),
      tenant: {
        _id: tenant._id.toString(),
        name: tenant.name,
        code: tenant.code,
        institutionTypes: tenant.institutionTypes as ('school' | 'college' | 'university')[],
        branding: tenant.branding,
        status: tenant.status as 'active' | 'inactive' | 'suspended' | 'trial' | 'pending',
        subscription: tenant.subscription,
        onboardingCompleted: tenant.onboardingCompleted,
      },
      organizations,
      studentId: userDoc.studentId?.toString(),
      staffId: userDoc.staffId?.toString(),
    };
  }

  // Update user profile
  async updateProfile(
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      avatar?: string;
      preferences?: Record<string, unknown>;
    }
  ): Promise<void> {
    const updateFields: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.firstName !== undefined) {
      updateFields['profile.firstName'] = data.firstName;
    }
    if (data.lastName !== undefined) {
      updateFields['profile.lastName'] = data.lastName;
    }
    if (data.firstName || data.lastName) {
      const user = (await collections.users.findOne({
        _id: new ObjectId(userId),
      })) as WithId<UserDocument> | null;
      if (user) {
        const firstName = data.firstName || user.profile.firstName;
        const lastName = data.lastName || user.profile.lastName;
        updateFields['profile.displayName'] = `${firstName} ${lastName}`;
      }
    }
    if (data.phone !== undefined) {
      updateFields.phone = data.phone;
    }
    if (data.avatar !== undefined) {
      updateFields['profile.avatar'] = data.avatar;
    }
    if (data.preferences !== undefined) {
      updateFields.preferences = data.preferences;
    }

    await collections.users.updateOne({ _id: new ObjectId(userId) }, { $set: updateFields });

    logger.info({ userId }, 'Profile updated successfully');
  }

  // Helper to create login response for pending organization signups
  private async createPendingLoginResponse(
    signup: WithId<Document>,
    deviceInfo?: { userAgent?: string; ip?: string }
  ): Promise<LoginResponse> {
    // Check signup status
    if (signup.status === 'pending_verification') {
      throw new ApiError(
        'EMAIL_NOT_VERIFIED',
        'Please verify your email first. Check your inbox for the verification link.',
        401
      );
    }

    if (signup.status === 'pending_approval') {
      // Allow login but return pending status so frontend can redirect to pending page
      return this.createPendingApprovalLoginResponse(signup, deviceInfo);
    }

    if (signup.status === 'rejected') {
      throw new ApiError(
        'SIGNUP_REJECTED',
        signup.rejectionReason || 'Your organization signup was rejected.',
        401
      );
    }

    // Generate tokens for pending user
    const tokenPayload: Omit<TokenPayload, 'type'> = {
      userId: signup._id.toString(),
      tenantId: 'pending',
      email: signup.admin.email,
      roleCode: 'pending_admin',
      roleLevel: 0,
      permissions: {},
      accessScope: {
        type: 'global',
        branchIds: [],
      },
    };

    const accessToken = this.generateAccessToken(tokenPayload);
    const refreshToken = this.generateRefreshToken(tokenPayload);

    // Store session
    await this.createSession(signup._id.toString(), 'pending', refreshToken, deviceInfo);

    // Build pending auth user response
    const authUser: AuthUser = {
      id: signup._id.toString(),
      email: signup.admin.email,
      profile: {
        firstName: signup.admin.firstName,
        lastName: signup.admin.lastName,
        displayName: `${signup.admin.firstName} ${signup.admin.lastName}`,
      },
      roleCode: 'pending_admin',
      roleLevel: 0,
      permissions: {},
      accessScope: {
        type: 'global',
        branchIds: [],
      },
      branches: [],
      institutions: [],
      tenant: {
        _id: 'pending',
        name: signup.organizationName,
        code: 'pending',
        institutionTypes: [signup.institutionType as 'school' | 'college' | 'university'],
        status: 'pending',
        subscription: {
          plan: 'starter' as const,
          maxBranches: 0,
          maxStudents: 0,
          maxStaff: 0,
          features: signup.requestedModules || ['core'],
          validUntil: new Date(),
        },
      },
      organizations: [],
    };

    logger.info({ signupId: signup._id.toString() }, 'Pending organization user logged in');

    return {
      user: authUser,
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: this.parseExpiryToSeconds(env.JWT_ACCESS_EXPIRY),
      },
    };
  }

  // Helper to create login response for pending approval organizations
  private async createPendingApprovalLoginResponse(
    signup: WithId<Document>,
    deviceInfo?: { userAgent?: string; ip?: string }
  ): Promise<LoginResponse> {
    // Generate tokens for pending approval user
    const tokenPayload: Omit<TokenPayload, 'type'> = {
      userId: signup._id.toString(),
      tenantId: 'pending',
      email: signup.admin.email,
      roleCode: 'pending_approval',
      roleLevel: 0,
      permissions: {},
      accessScope: {
        type: 'global',
        branchIds: [],
      },
    };

    const accessToken = this.generateAccessToken(tokenPayload);
    const refreshToken = this.generateRefreshToken(tokenPayload);

    // Store session
    await this.createSession(signup._id.toString(), 'pending', refreshToken, deviceInfo);

    // Build pending approval auth user response
    const authUser: AuthUser = {
      id: signup._id.toString(),
      email: signup.admin.email,
      profile: {
        firstName: signup.admin.firstName,
        lastName: signup.admin.lastName,
        displayName: `${signup.admin.firstName} ${signup.admin.lastName}`,
      },
      roleCode: 'pending_approval',
      roleLevel: 0,
      permissions: {},
      accessScope: {
        type: 'global',
        branchIds: [],
      },
      branches: [],
      institutions: [],
      tenant: {
        _id: 'pending',
        name: signup.organizationName,
        code: 'pending',
        institutionTypes: [signup.institutionType as 'school' | 'college' | 'university'],
        status: 'pending',
        subscription: {
          plan: 'starter' as const,
          maxBranches: 0,
          maxStudents: 0,
          maxStaff: 0,
          features: signup.requestedModules || ['core'],
          validUntil: new Date(),
        },
      },
      organizations: [],
    };

    logger.info(
      { signupId: signup._id.toString() },
      'Pending approval organization user logged in'
    );

    return {
      user: authUser,
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: this.parseExpiryToSeconds(env.JWT_ACCESS_EXPIRY),
      },
    };
  }

  // Helper to parse expiry string to seconds
  private parseExpiryToSeconds(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 900; // default 15 minutes

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 60 * 60;
      case 'd':
        return value * 24 * 60 * 60;
      default:
        return 900;
    }
  }

  // ============ Organization Signup ============

  // Create email verification token
  async createEmailVerificationToken(signupId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    try {
      const redis = getRedis();
      if (redis.status === 'ready') {
        await redis.setex(
          `${VERIFICATION_TOKEN_PREFIX}${token}`,
          VERIFICATION_TOKEN_EXPIRY,
          signupId
        );
      }
    } catch {
      logger.warn('Redis unavailable - verification token not stored');
    }
    return token;
  }

  // Verify email token
  async verifyEmailVerificationToken(token: string): Promise<string | null> {
    try {
      const redis = getRedis();
      if (redis.status !== 'ready') return null;
      return redis.get(`${VERIFICATION_TOKEN_PREFIX}${token}`);
    } catch {
      return null;
    }
  }

  // Delete email verification token
  async deleteEmailVerificationToken(token: string): Promise<void> {
    try {
      const redis = getRedis();
      if (redis.status !== 'ready') return;
      await redis.del(`${VERIFICATION_TOKEN_PREFIX}${token}`);
    } catch {
      // Ignore Redis errors
    }
  }

  // Organization signup
  async createOrganizationSignup(
    data: Omit<OrganizationSignupInput, 'confirmPassword'>
  ): Promise<OrganizationSignupResponse> {
    // Check if email already exists in signups
    const existingSignup = await collections.organizationSignups.findOne({
      'admin.email': data.email.toLowerCase(),
    });

    if (existingSignup) {
      throw new ApiError(
        'EMAIL_ALREADY_REGISTERED',
        'An organization with this email is already registered',
        400
      );
    }

    // Check if email exists in users
    const existingUser = await collections.users.findOne({
      email: data.email.toLowerCase(),
    });

    if (existingUser) {
      throw new ApiError(
        'EMAIL_ALREADY_REGISTERED',
        'This email is already associated with an account',
        400
      );
    }

    // Hash password
    const passwordHash = await this.hashPassword(data.password);

    const signupId = new ObjectId();
    const now = new Date();

    const signup: Omit<OrganizationSignup, '_id'> & { _id: ObjectId } = {
      _id: signupId,
      organizationName: data.organizationName.trim(),
      institutionType: data.institutionType,
      admin: {
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        email: data.email.toLowerCase(),
        phone: data.phone,
        passwordHash,
      },
      emailVerified: false,
      status: 'pending_verification',
      requestedModules: data.requestedModules || defaultModulesFor(data.institutionType),
      createdAt: now,
      updatedAt: now,
    };

    await collections.organizationSignups.insertOne(signup);

    // Create verification token and send email
    const verificationToken = await this.createEmailVerificationToken(signupId.toString());
    await emailService.sendVerificationEmail(
      data.email.toLowerCase(),
      verificationToken,
      data.organizationName
    );

    logger.info(
      { signupId: signupId.toString(), email: data.email },
      'Organization signup created, verification email sent'
    );

    return {
      id: signupId.toString(),
      organizationName: signup.organizationName,
      institutionType: signup.institutionType,
      admin: {
        firstName: signup.admin.firstName,
        lastName: signup.admin.lastName,
        email: signup.admin.email,
        phone: signup.admin.phone,
      },
      emailVerified: signup.emailVerified,
      status: signup.status,
      requestedModules: signup.requestedModules,
      createdAt: signup.createdAt,
    };
  }

  // Verify email
  async verifyEmail(token: string): Promise<OrganizationSignupResponse> {
    const signupId = await this.verifyEmailVerificationToken(token);

    if (!signupId) {
      throw new ApiError(
        'INVALID_VERIFICATION_TOKEN',
        'Invalid or expired verification token',
        400
      );
    }

    const signup = await collections.organizationSignups.findOne({
      _id: new ObjectId(signupId),
    });

    if (!signup) {
      throw new ApiError('SIGNUP_NOT_FOUND', 'Signup record not found', 404);
    }

    if (signup.emailVerified) {
      throw new ApiError('ALREADY_VERIFIED', 'Email is already verified', 400);
    }

    const now = new Date();

    await collections.organizationSignups.updateOne(
      { _id: new ObjectId(signupId) },
      {
        $set: {
          emailVerified: true,
          status: 'pending_approval',
          verifiedAt: now,
          updatedAt: now,
        },
      }
    );

    // Delete verification token
    await this.deleteEmailVerificationToken(token);

    // Notify super admin
    await emailService.notifySuperAdminNewSignup(signup.organizationName, signup.admin.email);

    logger.info({ signupId }, 'Email verified, awaiting admin approval');

    return {
      id: signupId,
      organizationName: signup.organizationName,
      institutionType: signup.institutionType,
      admin: {
        firstName: signup.admin.firstName,
        lastName: signup.admin.lastName,
        email: signup.admin.email,
        phone: signup.admin.phone,
      },
      emailVerified: true,
      status: 'pending_approval',
      requestedModules: signup.requestedModules || ['core'],
      createdAt: signup.createdAt,
    };
  }

  // Resend verification email
  async resendVerificationEmail(email: string): Promise<void> {
    const signup = await collections.organizationSignups.findOne({
      'admin.email': email.toLowerCase(),
    });

    if (!signup) {
      // Don't reveal if email exists
      logger.warn({ email }, 'Resend verification requested for non-existent signup');
      return;
    }

    if (signup.emailVerified) {
      throw new ApiError('ALREADY_VERIFIED', 'Email is already verified', 400);
    }

    if (signup.status === 'approved' || signup.status === 'rejected') {
      throw new ApiError('SIGNUP_PROCESSED', 'This signup has already been processed', 400);
    }

    // Create new verification token and send email
    const verificationToken = await this.createEmailVerificationToken(signup._id.toString());
    await emailService.sendVerificationEmail(
      email.toLowerCase(),
      verificationToken,
      signup.organizationName
    );

    logger.info({ signupId: signup._id.toString() }, 'Verification email resent');
  }

  // Get signup by email (for checking status)
  async getSignupByEmail(email: string): Promise<OrganizationSignupResponse | null> {
    const signup = await collections.organizationSignups.findOne({
      'admin.email': email.toLowerCase(),
    });

    if (!signup) return null;

    return {
      id: signup._id.toString(),
      organizationName: signup.organizationName,
      institutionType: signup.institutionType,
      admin: {
        firstName: signup.admin.firstName,
        lastName: signup.admin.lastName,
        email: signup.admin.email,
        phone: signup.admin.phone,
      },
      emailVerified: signup.emailVerified,
      status: signup.status,
      requestedModules: (signup as unknown as { requestedModules?: string[] }).requestedModules || [
        'core',
      ],
      rejectionReason: signup.rejectionReason,
      createdAt: signup.createdAt,
      approvedAt: signup.approvedAt,
      rejectedAt: signup.rejectedAt,
    };
  }

  // Create new organization for existing authenticated user (no approval needed)
  async createOrganizationForUser(
    userId: string,
    _currentTenantId: string,
    organizationName: string,
    institutionType: 'school' | 'college' | 'university'
  ): Promise<{ tenantId: string; name: string; institutionType: string }> {
    // Get the current user
    const user = (await collections.users.findOne({
      _id: new ObjectId(userId),
    })) as WithId<UserDocument> | null;

    if (!user) {
      throw new ApiError('USER_NOT_FOUND', 'User not found', 404);
    }

    const now = new Date();
    const tenantId = new ObjectId();
    const tenantIdStr = tenantId.toString();

    // Generate organization code from name (with uniqueness check)
    const baseCode = organizationName
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .substring(0, 8); // Leave room for suffix

    let orgCode = baseCode;
    let suffix = 1;

    // Check for existing code and append suffix if needed
    while (await collections.tenants.findOne({ code: orgCode })) {
      orgCode = `${baseCode}${suffix}`;
      suffix++;
      if (suffix > 99) {
        // Fallback: use random suffix
        orgCode = `${baseCode.substring(0, 6)}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        break;
      }
    }

    // 1. Create Tenant
    const tenant = {
      _id: tenantId,
      tenantId: tenantIdStr,
      name: organizationName.trim(),
      code: orgCode,
      institutionTypes: [institutionType],
      contact: {
        email: user.email,
        phone: user.phone || '',
        address: {
          line1: '',
          city: '',
          state: '',
          country: 'India',
          pincode: '',
        },
      },
      subscription: {
        plan: 'starter' as const,
        maxBranches: 3,
        maxStudents: 500,
        maxStaff: 50,
        features: ['basic'],
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days trial
      },
      settings: {
        timezone: 'Asia/Kolkata',
        dateFormat: 'DD/MM/YYYY',
        currency: 'INR',
        fiscalYearStart: '04-01',
      },
      onboardingCompleted: false,
      status: 'active' as const,
      createdAt: now,
      updatedAt: now,
    };

    await collections.tenants.insertOne(tenant);

    // 2. Create system roles for new tenant
    const {
      SYSTEM_ROLES,
      ROLE_HIERARCHY,
      PERMISSIONS,
      ORG_ADMIN_PERMISSIONS,
      BRANCH_ADMIN_PERMISSIONS,
      DEFAULT_ROLES,
    } = await import('@campus-verse/shared/constants');

    const groupOwnerRoleId = new ObjectId();
    const orgModeratorRoleId = new ObjectId();
    const orgAdminRoleId = new ObjectId();
    const branchAdminRoleId = new ObjectId();

    const systemRoles = [
      {
        _id: groupOwnerRoleId,
        tenantId,
        name: 'Group Owner',
        code: SYSTEM_ROLES.GROUP_OWNER,
        description: 'Group owner with full control',
        isSystemRole: true,
        level: ROLE_HIERARCHY[SYSTEM_ROLES.GROUP_OWNER],
        permissions: PERMISSIONS,
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: orgModeratorRoleId,
        tenantId,
        name: 'Org Moderator',
        code: SYSTEM_ROLES.ORG_MODERATOR,
        description: 'Same access as owner, but cannot create/edit other moderators',
        isSystemRole: true,
        level: ROLE_HIERARCHY[SYSTEM_ROLES.ORG_MODERATOR],
        permissions: PERMISSIONS,
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: orgAdminRoleId,
        tenantId,
        name: 'Org Admin',
        code: SYSTEM_ROLES.ORG_ADMIN,
        description: 'Admin access to a single organization',
        isSystemRole: true,
        level: ROLE_HIERARCHY[SYSTEM_ROLES.ORG_ADMIN],
        permissions: ORG_ADMIN_PERMISSIONS,
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: branchAdminRoleId,
        tenantId,
        name: 'Branch Admin',
        code: SYSTEM_ROLES.BRANCH_ADMIN,
        description: 'Admin access to a single branch',
        isSystemRole: true,
        level: ROLE_HIERARCHY[SYSTEM_ROLES.BRANCH_ADMIN],
        permissions: BRANCH_ADMIN_PERMISSIONS,
        createdAt: now,
        updatedAt: now,
      },
    ];

    await collections.roles.insertMany(systemRoles);

    // Insert default operational roles (customizable by tenant)
    const defaultRoles = DEFAULT_ROLES.map((role) => ({
      _id: new ObjectId(),
      tenantId,
      name: role.name,
      code: role.code,
      description: role.description,
      isSystemRole: false,
      level: role.level,
      permissions: { ...role.permissions },
      createdAt: now,
      updatedAt: now,
    }));
    await collections.roles.insertMany(defaultRoles);

    const roleId = groupOwnerRoleId; // For the admin user

    // 3. Create User in the new tenant (copy from existing user)
    const newUserId = new ObjectId();
    const newUser = {
      _id: newUserId,
      tenantId,
      email: user.email,
      passwordHash: user.passwordHash,
      phone: user.phone,
      profile: user.profile,
      roleId,
      accessScope: {
        type: 'global' as const,
        branchIds: [] as ObjectId[],
      },
      status: 'active' as const,
      createdAt: now,
      updatedAt: now,
    };

    await collections.users.insertOne(newUser);

    // 4. Create initial counters
    const counters = [
      {
        _id: new ObjectId(),
        tenantId,
        name: 'student_id',
        value: 0,
        prefix: 'STU',
        createdAt: now,
      },
      { _id: new ObjectId(), tenantId, name: 'staff_id', value: 0, prefix: 'STF', createdAt: now },
      {
        _id: new ObjectId(),
        tenantId,
        name: 'receipt_number',
        value: 0,
        prefix: 'RCP',
        createdAt: now,
      },
      {
        _id: new ObjectId(),
        tenantId,
        name: 'application_id',
        value: 0,
        prefix: 'APP',
        createdAt: now,
      },
    ];

    await collections.counters.insertMany(counters);

    logger.info(
      { userId, tenantId: tenantIdStr, organizationName },
      'New organization created for existing user'
    );

    return {
      tenantId: tenantIdStr,
      name: organizationName.trim(),
      institutionType,
    };
  }

  // Re-apply after rejection
  async reapplyOrganizationSignup(
    email: string,
    data: {
      organizationName?: string;
      institutionType?: 'school' | 'college' | 'university';
      firstName?: string;
      lastName?: string;
      phone?: string;
      password?: string;
      requestedModules?: string[];
    }
  ): Promise<OrganizationSignupResponse> {
    const signup = await collections.organizationSignups.findOne({
      'admin.email': email.toLowerCase(),
    });

    if (!signup) {
      throw new ApiError('SIGNUP_NOT_FOUND', 'No previous signup found for this email', 404);
    }

    if (signup.status !== 'rejected') {
      throw new ApiError(
        'INVALID_STATUS',
        'Only rejected signups can be reapplied. Current status: ' + signup.status,
        400
      );
    }

    if (signup.canReapply === false) {
      throw new ApiError(
        'REAPPLY_NOT_ALLOWED',
        'Re-application is not allowed for this signup',
        403
      );
    }

    if (signup.reapplyAfter && new Date() < signup.reapplyAfter) {
      const waitDays = Math.ceil(
        (signup.reapplyAfter.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      throw new ApiError('REAPPLY_TOO_EARLY', `You can reapply after ${waitDays} more day(s)`, 400);
    }

    const now = new Date();

    // Build update object with new values or keep existing
    const updateData: Record<string, unknown> = {
      status: 'pending_verification',
      emailVerified: false,
      rejectionReason: null,
      rejectedAt: null,
      rejectedBy: null,
      updatedAt: now,
    };

    if (data.organizationName) {
      updateData.organizationName = data.organizationName.trim();
    }
    if (data.institutionType) {
      updateData.institutionType = data.institutionType;
    }
    if (data.firstName) {
      updateData['admin.firstName'] = data.firstName.trim();
    }
    if (data.lastName) {
      updateData['admin.lastName'] = data.lastName.trim();
    }
    if (data.phone) {
      updateData['admin.phone'] = data.phone;
    }
    if (data.password) {
      updateData['admin.passwordHash'] = await this.hashPassword(data.password);
    }
    if (data.requestedModules) {
      updateData.requestedModules = data.requestedModules;
    }

    await collections.organizationSignups.updateOne({ _id: signup._id }, { $set: updateData });

    // Create new verification token and send email
    const verificationToken = await this.createEmailVerificationToken(signup._id.toString());
    await emailService.sendVerificationEmail(
      email.toLowerCase(),
      verificationToken,
      data.organizationName || signup.organizationName
    );

    logger.info(
      { signupId: signup._id.toString(), email },
      'Organization reapplied, verification email sent'
    );

    // Fetch updated signup
    const updatedSignup = await collections.organizationSignups.findOne({
      _id: signup._id,
    });

    return {
      id: signup._id.toString(),
      organizationName: updatedSignup?.organizationName || signup.organizationName,
      institutionType: updatedSignup?.institutionType || signup.institutionType,
      admin: {
        firstName: updatedSignup?.admin.firstName || signup.admin.firstName,
        lastName: updatedSignup?.admin.lastName || signup.admin.lastName,
        email: email.toLowerCase(),
        phone: updatedSignup?.admin.phone || signup.admin.phone,
      },
      emailVerified: false,
      status: 'pending_verification',
      requestedModules: (updatedSignup as unknown as { requestedModules?: string[] })
        .requestedModules || ['core'],
      createdAt: signup.createdAt,
    };
  }

  // Check if reapply is allowed for an email
  async canReapply(email: string): Promise<{
    canReapply: boolean;
    reason?: string;
    reapplyAfter?: Date;
    rejectionHistory?: Array<{ reason: string; rejectedAt: Date }>;
  }> {
    const signup = await collections.organizationSignups.findOne({
      'admin.email': email.toLowerCase(),
    });

    if (!signup) {
      return { canReapply: false, reason: 'No signup found for this email' };
    }

    if (signup.status !== 'rejected') {
      return { canReapply: false, reason: 'Only rejected signups can be reapplied' };
    }

    if (signup.canReapply === false) {
      return { canReapply: false, reason: 'Re-application has been disabled by admin' };
    }

    if (signup.reapplyAfter && new Date() < signup.reapplyAfter) {
      return {
        canReapply: false,
        reason: 'Waiting period not yet complete',
        reapplyAfter: signup.reapplyAfter,
      };
    }

    return {
      canReapply: true,
      reapplyAfter: signup.reapplyAfter,
      rejectionHistory: signup.rejectionHistory?.map((r: { reason: string; rejectedAt: Date }) => ({
        reason: r.reason,
        rejectedAt: r.rejectedAt,
      })),
    };
  }

  // Create Razorpay order for new organization
  async createOrganizationOrder(
    userId: string,
    organizationName: string,
    institutionType: 'school' | 'college' | 'university'
  ): Promise<{
    orderId: string;
    amount: number;
    currency: string;
    pendingOrgId: string;
    organizationName: string;
    keyId: string;
  }> {
    // Get the current user
    const user = (await collections.users.findOne({
      _id: new ObjectId(userId),
    })) as WithId<UserDocument> | null;

    if (!user) {
      throw new ApiError('USER_NOT_FOUND', 'User not found', 404);
    }

    // Create a pending organization record
    const pendingOrgId = new ObjectId();
    const now = new Date();

    await collections.pendingOrganizations.insertOne({
      _id: pendingOrgId,
      userId: new ObjectId(userId),
      organizationName: organizationName.trim(),
      institutionType,
      status: 'pending_payment',
      amount: NEW_ORG_PRICE,
      createdAt: now,
      expiresAt: new Date(now.getTime() + 30 * 60 * 1000), // 30 minutes expiry
    });

    // Create Razorpay order
    const receipt = `org_${pendingOrgId.toString()}`;
    const order = await razorpayService.createOrder({
      amount: NEW_ORG_PRICE,
      currency: 'INR',
      receipt,
      notes: {
        pendingOrgId: pendingOrgId.toString(),
        userId,
        organizationName,
        institutionType,
      },
    });

    // Update pending org with order ID
    await collections.pendingOrganizations.updateOne(
      { _id: pendingOrgId },
      { $set: { razorpayOrderId: order.id } }
    );

    logger.info(
      { userId, pendingOrgId: pendingOrgId.toString(), orderId: order.id },
      'Organization payment order created'
    );

    return {
      orderId: order.id,
      amount: NEW_ORG_PRICE,
      currency: 'INR',
      pendingOrgId: pendingOrgId.toString(),
      organizationName: organizationName.trim(),
      keyId: env.RAZORPAY_KEY_ID || '',
    };
  }

  // Verify payment and create organization
  async verifyOrganizationPayment(
    userId: string,
    pendingOrgId: string,
    orderId: string,
    paymentId: string,
    signature: string
  ): Promise<{ tenantId: string; name: string; institutionType: string }> {
    // Verify the payment signature
    const isValid = razorpayService.verifyPayment({
      orderId,
      paymentId,
      signature,
    });

    if (!isValid) {
      throw new ApiError('PAYMENT_VERIFICATION_FAILED', 'Payment verification failed', 400);
    }

    // Get the pending organization
    const pendingOrg = await collections.pendingOrganizations.findOne({
      _id: new ObjectId(pendingOrgId),
      userId: new ObjectId(userId),
      status: 'pending_payment',
    });

    if (!pendingOrg) {
      throw new ApiError(
        'PENDING_ORG_NOT_FOUND',
        'Pending organization not found or already processed',
        404
      );
    }

    // Mark the pending org as paid
    await collections.pendingOrganizations.updateOne(
      { _id: new ObjectId(pendingOrgId) },
      {
        $set: {
          status: 'paid',
          razorpayPaymentId: paymentId,
          paidAt: new Date(),
        },
      }
    );

    // Get the current user
    const user = (await collections.users.findOne({
      _id: new ObjectId(userId),
    })) as WithId<UserDocument> | null;

    if (!user) {
      throw new ApiError('USER_NOT_FOUND', 'User not found', 404);
    }

    // Create the organization (reusing existing method logic)
    const now = new Date();
    const tenantId = new ObjectId();
    const tenantIdStr = tenantId.toString();

    // Generate organization code from name (with uniqueness check)
    const baseCode = pendingOrg.organizationName
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .substring(0, 8);

    let orgCode = baseCode;
    let suffix = 1;

    while (await collections.tenants.findOne({ code: orgCode })) {
      orgCode = `${baseCode}${suffix}`;
      suffix++;
      if (suffix > 99) {
        orgCode = `${baseCode.substring(0, 6)}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        break;
      }
    }

    // Create Tenant
    const tenant = {
      _id: tenantId,
      tenantId: tenantIdStr,
      name: pendingOrg.organizationName,
      code: orgCode,
      institutionTypes: [pendingOrg.institutionType],
      contact: {
        email: user.email,
        phone: user.phone || '',
        address: {
          line1: '',
          city: '',
          state: '',
          country: 'India',
          pincode: '',
        },
      },
      subscription: {
        plan: 'starter' as const,
        maxBranches: 3,
        maxStudents: 500,
        maxStaff: 50,
        features: defaultModulesFor(pendingOrg.institutionType),
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      },
      settings: {
        timezone: 'Asia/Kolkata',
        dateFormat: 'DD/MM/YYYY',
        currency: 'INR',
        fiscalYearStart: '04-01',
      },
      onboardingCompleted: false,
      status: 'active' as const,
      createdAt: now,
      updatedAt: now,
    };

    await collections.tenants.insertOne(tenant);

    // Create system roles for new tenant
    const {
      SYSTEM_ROLES,
      ROLE_HIERARCHY,
      PERMISSIONS,
      ORG_ADMIN_PERMISSIONS,
      BRANCH_ADMIN_PERMISSIONS,
      DEFAULT_ROLES,
    } = await import('@campus-verse/shared/constants');

    const groupOwnerRoleId = new ObjectId();
    const orgModeratorRoleId = new ObjectId();
    const orgAdminRoleId = new ObjectId();
    const branchAdminRoleId = new ObjectId();

    const systemRoles = [
      {
        _id: groupOwnerRoleId,
        tenantId,
        name: 'Group Owner',
        code: SYSTEM_ROLES.GROUP_OWNER,
        description: 'Group owner with full control',
        isSystemRole: true,
        level: ROLE_HIERARCHY[SYSTEM_ROLES.GROUP_OWNER],
        permissions: PERMISSIONS,
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: orgModeratorRoleId,
        tenantId,
        name: 'Org Moderator',
        code: SYSTEM_ROLES.ORG_MODERATOR,
        description: 'Same access as owner, but cannot create/edit other moderators',
        isSystemRole: true,
        level: ROLE_HIERARCHY[SYSTEM_ROLES.ORG_MODERATOR],
        permissions: PERMISSIONS,
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: orgAdminRoleId,
        tenantId,
        name: 'Org Admin',
        code: SYSTEM_ROLES.ORG_ADMIN,
        description: 'Admin access to a single organization',
        isSystemRole: true,
        level: ROLE_HIERARCHY[SYSTEM_ROLES.ORG_ADMIN],
        permissions: ORG_ADMIN_PERMISSIONS,
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: branchAdminRoleId,
        tenantId,
        name: 'Branch Admin',
        code: SYSTEM_ROLES.BRANCH_ADMIN,
        description: 'Admin access to a single branch',
        isSystemRole: true,
        level: ROLE_HIERARCHY[SYSTEM_ROLES.BRANCH_ADMIN],
        permissions: BRANCH_ADMIN_PERMISSIONS,
        createdAt: now,
        updatedAt: now,
      },
    ];

    await collections.roles.insertMany(systemRoles);

    // Insert default operational roles (customizable by tenant)
    const defaultRoles = DEFAULT_ROLES.map((role) => ({
      _id: new ObjectId(),
      tenantId,
      name: role.name,
      code: role.code,
      description: role.description,
      isSystemRole: false,
      level: role.level,
      permissions: { ...role.permissions },
      createdAt: now,
      updatedAt: now,
    }));
    await collections.roles.insertMany(defaultRoles);

    const roleId = groupOwnerRoleId; // For the admin user

    // Create User in the new tenant
    const newUserId = new ObjectId();
    const newUser = {
      _id: newUserId,
      tenantId,
      email: user.email,
      passwordHash: user.passwordHash,
      phone: user.phone,
      profile: user.profile,
      roleId,
      accessScope: {
        type: 'global' as const,
        branchIds: [] as ObjectId[],
      },
      status: 'active' as const,
      createdAt: now,
      updatedAt: now,
    };

    await collections.users.insertOne(newUser);

    // Create initial counters
    const counters = [
      {
        _id: new ObjectId(),
        tenantId,
        name: 'student_id',
        value: 0,
        prefix: 'STU',
        createdAt: now,
      },
      { _id: new ObjectId(), tenantId, name: 'staff_id', value: 0, prefix: 'STF', createdAt: now },
      {
        _id: new ObjectId(),
        tenantId,
        name: 'receipt_number',
        value: 0,
        prefix: 'RCP',
        createdAt: now,
      },
      {
        _id: new ObjectId(),
        tenantId,
        name: 'application_id',
        value: 0,
        prefix: 'APP',
        createdAt: now,
      },
    ];

    await collections.counters.insertMany(counters);

    // Update pending org status to completed
    await collections.pendingOrganizations.updateOne(
      { _id: new ObjectId(pendingOrgId) },
      {
        $set: {
          status: 'completed',
          tenantId,
          completedAt: new Date(),
        },
      }
    );

    logger.info(
      { userId, pendingOrgId, tenantId: tenantIdStr, paymentId },
      'Organization created after payment verification'
    );

    return {
      tenantId: tenantIdStr,
      name: pendingOrg.organizationName,
      institutionType: pendingOrg.institutionType,
    };
  }

  /**
   * Enrich an array of branch documents with their `branding.logo` from
   * branch_settings. This runs once per login/profile-refresh (not per-page),
   * so the extra DB call is negligible. The branch store persists the result,
   * keeping the sidebar/switcher logo available for the entire session.
   */
  private async enrichBranchesWithLogos(
    branches: WithId<Document>[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any[]> {
    const branchIds = branches.map((b) => b._id);
    const settingsDocs =
      branchIds.length > 0
        ? await collections.branchSettings
            .find(
              { branchId: { $in: branchIds } },
              { projection: { branchId: 1, 'branding.logo': 1 } }
            )
            .toArray()
        : [];

    const logoByBranch = new Map<string, string>();
    for (const s of settingsDocs) {
      const logo = (s as Document).branding?.logo;
      if (logo) {
        logoByBranch.set(s.branchId.toString(), logo as string);
      }
    }

    return branches.map((b) => ({
      _id: b._id.toString(),
      name: b.name as string,
      code: b.code as string,
      institutionType: b.institutionType as 'school' | 'college' | 'university',
      institutionId: (b.institutionId as ObjectId | undefined)?.toString(),
      logo: logoByBranch.get(b._id.toString()),
    }));
  }

  /** Institution ids a scoped grant covers; null = every institution on its campuses. */
  private async institutionIdsForScope(
    tenantId: ObjectId | string,
    scope?: ScopeGrant
  ): Promise<ObjectId[] | null> {
    if (!scope) return null;
    const tid = new ObjectId(tenantId.toString());
    if (scope.type === 'institution') {
      return (scope.institutionIds ?? []).map((id) => new ObjectId(id));
    }
    let departmentIds: ObjectId[];
    if (scope.type === 'department' && scope.departmentIds?.length) {
      departmentIds = scope.departmentIds.map((id) => new ObjectId(id));
    } else if (scope.type === 'program' && scope.programIds?.length) {
      const programs = await collections.programs
        .find({ tenantId: tid, _id: { $in: scope.programIds.map((id) => new ObjectId(id)) } })
        .project({ departmentId: 1 })
        .toArray();
      departmentIds = programs.map((p) => p.departmentId as ObjectId).filter(Boolean);
    } else {
      return null;
    }
    const departments = await collections.departments
      .find({ tenantId: tid, _id: { $in: departmentIds } })
      .project({ institutionId: 1 })
      .toArray();
    const ids = departments.map((d) => d.institutionId as ObjectId).filter(Boolean);
    return ids.length ? ids : null;
  }

  /**
   * Constituent institutions covering the user's accessible branches, for the
   * institution switcher. Ensures the tenant's default institution exists and
   * every branch is stamped first (lazy, idempotent), then re-reads the
   * stamps so first login after deploy is already correct.
   */
  private async getInstitutionsForUser(
    tenantId: ObjectId | string,
    branches: WithId<Document>[],
    accessScope?: ScopeGrant
  ): Promise<
    Array<{
      _id: string;
      name: string;
      code: string;
      kind?: string;
      isDefault: boolean;
      logo?: string;
    }>
  > {
    if (branches.length === 0) return [];

    // Each accessible campus hosts its own institutions; seed any that are
    // missing a default so a fresh campus is never empty in the switcher.
    for (const branch of branches) {
      try {
        await institutionService.ensureDefaultUnlessUniversity(
          tenantId.toString(),
          branch._id.toString()
        );
      } catch {
        // Non-fatal: login must never fail on institution bookkeeping.
      }
    }

    // A narrower-than-campus grant lists only the institutions it covers, so
    // a Dean of Engineering is never offered Design in the switcher.
    const allowedIds = await this.institutionIdsForScope(tenantId, accessScope);
    const institutions = (
      await collections.institutions
        .find({
          tenantId: new ObjectId(tenantId.toString()),
          branchId: { $in: branches.map((b) => b._id) },
          status: 'active',
          ...(allowedIds && { _id: { $in: allowedIds } }),
        })
        .toArray()
    ).sort((a, b) =>
      a.isDefault === b.isDefault
        ? String(a.name).localeCompare(String(b.name))
        : a.isDefault
          ? -1
          : 1
    );

    return institutions.map((i) => ({
      _id: i._id.toString(),
      branchId: (i.branchId as ObjectId | undefined)?.toString(),
      name: i.name as string,
      code: i.code as string,
      kind: i.kind as string | undefined,
      isDefault: !!i.isDefault,
      logo: (i.settings as { logo?: string } | undefined)?.logo,
    }));
  }
}

export const authService = new AuthService();

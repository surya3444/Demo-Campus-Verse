import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { ObjectId, WithId, Document } from 'mongodb';
import { collections, getDb } from '../../config/database';
import { getRedis } from '../../config/redis';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import {
  SuperAdminTokenPayload,
  SuperAdminLoginResponse,
  OrganizationSignupResponse,
  AdminDashboardStats,
  InstitutionType,
} from '@campus-verse/shared';
import {
  SYSTEM_ROLES,
  ROLE_HIERARCHY,
  PERMISSIONS,
  ensureCoreModules,
} from '@campus-verse/shared/constants';
import { clearFeatureCache } from '../../middleware/moduleGating';
import { ApiError } from '../../middleware/errorHandler';
import { parseDurationSeconds } from '../../utils/dates';
import { emailService } from '../../services/email.service';

const SALT_ROUNDS = 12;
const ADMIN_SESSION_PREFIX = 'admin_session:';

export interface PlatformStatistics {
  organizations: { total: number; active: number; pendingApprovals: number; newThisMonth: number };
  students: { total: number; active: number; newThisMonth: number };
  staff: { total: number; teachers: number; nonTeaching: number };
  branches: number;
  users: number;
  byInstitutionType: Array<{ type: string; count: number }>;
  topOrganizations: Array<{
    id: string;
    name: string;
    institutionType: string;
    students: number;
  }>;
  monthlyGrowth: Array<{ month: string; organizations: number; students: number }>;
}

interface SuperAdminDocument extends Document {
  _id: ObjectId;
  email: string;
  passwordHash: string;
  profile: {
    firstName: string;
    lastName: string;
    displayName: string;
  };
  status: 'active' | 'inactive';
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface OrganizationSignupDocument extends Document {
  _id: ObjectId;
  organizationName: string;
  institutionType: InstitutionType;
  admin: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    passwordHash: string;
  };
  emailVerified: boolean;
  status: 'pending_verification' | 'pending_approval' | 'approved' | 'rejected' | 'archived';
  requestedModules?: string[];
  approvedModules?: string[];
  rejectionReason?: string;
  rejectionHistory?: Array<{
    reason: string;
    rejectedBy: ObjectId;
    rejectedAt: Date;
    comments?: string;
  }>;
  tenantId?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
  verifiedAt?: Date;
  approvedAt?: Date;
  approvedBy?: ObjectId;
  rejectedAt?: Date;
  rejectedBy?: ObjectId;
  archivedAt?: Date;
  canReapply?: boolean;
  reapplyAfter?: Date;
}

class AdminService {
  // Password handling
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  // Token generation for super admins
  generateAccessToken(payload: Omit<SuperAdminTokenPayload, 'type'>): string {
    return jwt.sign({ ...payload, type: 'access' }, env.JWT_ACCESS_SECRET, {
      expiresIn: env.JWT_ACCESS_EXPIRY as jwt.SignOptions['expiresIn'],
    });
  }

  generateRefreshToken(payload: Omit<SuperAdminTokenPayload, 'type'>): string {
    return jwt.sign({ ...payload, type: 'refresh' }, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRY as jwt.SignOptions['expiresIn'],
    });
  }

  verifyAccessToken(token: string): SuperAdminTokenPayload {
    try {
      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as SuperAdminTokenPayload;
      if (payload.type !== 'access' || !payload.isSuperAdmin) {
        throw new ApiError('INVALID_TOKEN', 'Invalid admin token', 401);
      }
      return payload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new ApiError('TOKEN_EXPIRED', 'Token expired', 401);
      }
      throw new ApiError('INVALID_TOKEN', 'Invalid token', 401);
    }
  }

  verifyRefreshToken(token: string): SuperAdminTokenPayload {
    try {
      const payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as SuperAdminTokenPayload;
      if (payload.type !== 'refresh' || !payload.isSuperAdmin) {
        throw new ApiError('INVALID_TOKEN', 'Invalid admin refresh token', 401);
      }
      return payload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new ApiError('REFRESH_TOKEN_EXPIRED', 'Refresh token expired', 401);
      }
      throw new ApiError('INVALID_TOKEN', 'Invalid refresh token', 401);
    }
  }

  // Session management - Redis is optional, login works without it
  async createAdminSession(adminId: string, refreshToken: string): Promise<void> {
    try {
      const redis = getRedis();
      if (redis.status !== 'ready') {
        logger.warn('Redis not available - skipping session storage');
        return;
      }
      const expirySeconds = parseDurationSeconds(env.JWT_REFRESH_EXPIRY, 7 * 24 * 60 * 60);

      await redis.setex(
        `${ADMIN_SESSION_PREFIX}${adminId}:${refreshToken}`,
        expirySeconds,
        JSON.stringify({ adminId, createdAt: new Date() })
      );
    } catch (error) {
      logger.warn({ error }, 'Redis unavailable - session not stored');
    }
  }

  async getAdminSession(adminId: string, refreshToken: string): Promise<boolean> {
    try {
      const redis = getRedis();
      if (redis.status !== 'ready') return true; // Allow if Redis unavailable
      const data = await redis.get(`${ADMIN_SESSION_PREFIX}${adminId}:${refreshToken}`);
      return !!data;
    } catch {
      return true; // Allow if Redis unavailable
    }
  }

  async deleteAdminSession(adminId: string, refreshToken: string): Promise<void> {
    try {
      const redis = getRedis();
      if (redis.status !== 'ready') return;
      await redis.del(`${ADMIN_SESSION_PREFIX}${adminId}:${refreshToken}`);
    } catch {
      // Ignore Redis errors
    }
  }

  // Login
  async login(email: string, password: string): Promise<SuperAdminLoginResponse> {
    const admin = (await collections.superAdmins.findOne({
      email: email.toLowerCase(),
    })) as WithId<SuperAdminDocument> | null;

    if (!admin) {
      logger.warn({ email }, 'Super admin login attempt for non-existent user');
      throw new ApiError('INVALID_CREDENTIALS', 'Invalid credentials', 401);
    }

    if (admin.status !== 'active') {
      throw new ApiError('ACCOUNT_INACTIVE', 'Admin account is inactive', 401);
    }

    const isValidPassword = await this.verifyPassword(password, admin.passwordHash);

    if (!isValidPassword) {
      throw new ApiError('INVALID_CREDENTIALS', 'Invalid credentials', 401);
    }

    const tokenPayload: Omit<SuperAdminTokenPayload, 'type'> = {
      adminId: admin._id.toString(),
      email: admin.email,
      isSuperAdmin: true,
    };

    const accessToken = this.generateAccessToken(tokenPayload);
    const refreshToken = this.generateRefreshToken(tokenPayload);

    await this.createAdminSession(admin._id.toString(), refreshToken);

    await collections.superAdmins.updateOne(
      { _id: admin._id },
      { $set: { lastLogin: new Date(), updatedAt: new Date() } }
    );

    logger.info({ adminId: admin._id.toString() }, 'Super admin logged in');

    return {
      admin: {
        _id: admin._id.toString(),
        email: admin.email,
        profile: admin.profile,
        status: admin.status,
        lastLogin: new Date(),
        createdAt: admin.createdAt,
        updatedAt: admin.updatedAt,
      },
      accessToken,
      expiresIn: this.parseExpiryToSeconds(env.JWT_ACCESS_EXPIRY),
    };
  }

  // Refresh token
  async refreshAccessToken(
    refreshToken: string
  ): Promise<{ accessToken: string; expiresIn: number }> {
    const payload = this.verifyRefreshToken(refreshToken);

    const sessionExists = await this.getAdminSession(payload.adminId, refreshToken);
    if (!sessionExists) {
      throw new ApiError('SESSION_INVALID', 'Session expired or invalid', 401);
    }

    const admin = await collections.superAdmins.findOne({
      _id: new ObjectId(payload.adminId),
      status: 'active',
    });

    if (!admin) {
      await this.deleteAdminSession(payload.adminId, refreshToken);
      throw new ApiError('ADMIN_INVALID', 'Admin not found or inactive', 401);
    }

    const newAccessToken = this.generateAccessToken({
      adminId: payload.adminId,
      email: payload.email,
      isSuperAdmin: true,
    });

    return {
      accessToken: newAccessToken,
      expiresIn: this.parseExpiryToSeconds(env.JWT_ACCESS_EXPIRY),
    };
  }

  // Logout
  async logout(adminId: string, refreshToken: string): Promise<void> {
    await this.deleteAdminSession(adminId, refreshToken);
    logger.info({ adminId }, 'Super admin logged out');
  }

  // Get organizations with filtering
  async getOrganizations(params: { status?: string; page?: number; limit?: number }): Promise<{
    data: OrganizationSignupResponse[];
    meta: { total: number; page: number; limit: number };
  }> {
    const { status, page = 1, limit = 20 } = params;

    const query: Record<string, unknown> = {};
    if (status) {
      query.status = status;
    }

    const total = await collections.organizationSignups.countDocuments(query);
    const signups = (await collections.organizationSignups
      .find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray()) as WithId<OrganizationSignupDocument>[];

    return {
      data: signups.map((s) => ({
        id: s._id.toString(),
        organizationName: s.organizationName,
        institutionType: s.institutionType,
        admin: {
          firstName: s.admin.firstName,
          lastName: s.admin.lastName,
          email: s.admin.email,
          phone: s.admin.phone,
        },
        emailVerified: s.emailVerified,
        status: s.status,
        requestedModules: s.requestedModules || ['core'],
        approvedModules: s.approvedModules,
        rejectionReason: s.rejectionReason,
        rejectionHistory: s.rejectionHistory,
        createdAt: s.createdAt,
        approvedAt: s.approvedAt,
        rejectedAt: s.rejectedAt,
        archivedAt: s.archivedAt,
        canReapply: s.canReapply,
      })),
      meta: { total, page, limit },
    };
  }

  // Get single organization
  async getOrganizationById(id: string): Promise<OrganizationSignupResponse> {
    const signup = (await collections.organizationSignups.findOne({
      _id: new ObjectId(id),
    })) as WithId<OrganizationSignupDocument> | null;

    if (!signup) {
      throw new ApiError('NOT_FOUND', 'Organization signup not found', 404);
    }

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
      requestedModules: signup.requestedModules || ['core'],
      approvedModules: signup.approvedModules,
      rejectionReason: signup.rejectionReason,
      rejectionHistory: signup.rejectionHistory,
      createdAt: signup.createdAt,
      approvedAt: signup.approvedAt,
      rejectedAt: signup.rejectedAt,
      archivedAt: signup.archivedAt,
      canReapply: signup.canReapply,
    };
  }

  // Approve organization
  async approveOrganization(
    signupId: string,
    adminId: string,
    approvedModules?: string[],
    subscriptionPlan: 'starter' | 'professional' | 'enterprise' = 'starter'
  ): Promise<void> {
    const signup = (await collections.organizationSignups.findOne({
      _id: new ObjectId(signupId),
    })) as WithId<OrganizationSignupDocument> | null;

    if (!signup) {
      throw new ApiError('NOT_FOUND', 'Organization signup not found', 404);
    }

    if (signup.status === 'approved') {
      throw new ApiError('ALREADY_APPROVED', 'Organization is already approved', 400);
    }

    if (signup.status !== 'pending_approval') {
      throw new ApiError('INVALID_STATUS', 'Only pending approval signups can be approved', 400);
    }

    const now = new Date();
    const tenantId = new ObjectId();
    const tenantIdStr = tenantId.toString();

    // Generate organization code from name (with uniqueness check)
    const baseCode = signup.organizationName
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
      name: signup.organizationName,
      code: orgCode,
      institutionTypes: [signup.institutionType],
      contact: {
        email: signup.admin.email,
        phone: signup.admin.phone,
        address: {
          line1: '',
          city: '',
          state: '',
          country: 'India',
          pincode: '',
        },
      },
      subscription: {
        plan: subscriptionPlan,
        maxBranches:
          subscriptionPlan === 'enterprise' ? 50 : subscriptionPlan === 'professional' ? 10 : 3,
        maxStudents:
          subscriptionPlan === 'enterprise'
            ? 10000
            : subscriptionPlan === 'professional'
              ? 2000
              : 500,
        maxStaff:
          subscriptionPlan === 'enterprise' ? 500 : subscriptionPlan === 'professional' ? 100 : 50,
        features: ensureCoreModules(
          approvedModules ||
            (signup as unknown as { requestedModules?: string[] }).requestedModules || [
              'core',
              'students',
              'attendance',
            ]
        ),
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

    // 2. Create system roles
    const { ORG_ADMIN_PERMISSIONS, BRANCH_ADMIN_PERMISSIONS, DEFAULT_ROLES } =
      await import('@campus-verse/shared/constants');

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

    // 3. Create Admin User
    const userId = new ObjectId();
    const user = {
      _id: userId,
      tenantId,
      email: signup.admin.email,
      passwordHash: signup.admin.passwordHash,
      phone: signup.admin.phone,
      profile: {
        firstName: signup.admin.firstName,
        lastName: signup.admin.lastName,
        displayName: `${signup.admin.firstName} ${signup.admin.lastName}`,
      },
      roleId,
      accessScope: {
        type: 'global' as const,
        branchIds: [] as ObjectId[],
      },
      status: 'active' as const,
      createdAt: now,
      updatedAt: now,
    };

    await collections.users.insertOne(user);

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

    // 5. Update signup record
    const finalApprovedModules = approvedModules ||
      (signup as unknown as { requestedModules?: string[] }).requestedModules || [
        'core',
        'students',
        'attendance',
      ];
    await collections.organizationSignups.updateOne(
      { _id: new ObjectId(signupId) },
      {
        $set: {
          status: 'approved',
          tenantId,
          approvedModules: finalApprovedModules,
          approvedAt: now,
          approvedBy: new ObjectId(adminId),
          updatedAt: now,
        },
      }
    );

    // 6. Send approval email (fire-and-forget, don't block response)
    emailService
      .sendApprovalEmail(
        signup.admin.email,
        signup.organizationName,
        `${signup.admin.firstName} ${signup.admin.lastName}`
      )
      .catch((err) =>
        logger.error({ err, email: signup.admin.email }, 'Failed to send approval email')
      );

    logger.info(
      { signupId, tenantId: tenantIdStr, adminId },
      'Organization approved and tenant created'
    );
  }

  // Reject organization
  async rejectOrganization(
    signupId: string,
    adminId: string,
    reason: string,
    options?: { canReapply?: boolean; reapplyAfterDays?: number; comments?: string }
  ): Promise<void> {
    const signup = (await collections.organizationSignups.findOne({
      _id: new ObjectId(signupId),
    })) as WithId<OrganizationSignupDocument> | null;

    if (!signup) {
      throw new ApiError('NOT_FOUND', 'Organization signup not found', 404);
    }

    if (signup.status === 'rejected') {
      throw new ApiError('ALREADY_REJECTED', 'Organization is already rejected', 400);
    }

    if (signup.status === 'approved') {
      throw new ApiError('ALREADY_APPROVED', 'Cannot reject an approved organization', 400);
    }

    const now = new Date();
    const canReapply = options?.canReapply ?? true;
    const reapplyAfterDays = options?.reapplyAfterDays ?? 7;
    const reapplyAfter = new Date(now.getTime() + reapplyAfterDays * 24 * 60 * 60 * 1000);

    // Build rejection history entry
    const rejectionEntry = {
      reason,
      rejectedBy: new ObjectId(adminId),
      rejectedAt: now,
      comments: options?.comments,
    };

    await collections.organizationSignups.updateOne(
      { _id: new ObjectId(signupId) },
      {
        $set: {
          status: 'rejected',
          rejectionReason: reason,
          rejectedAt: now,
          rejectedBy: new ObjectId(adminId),
          canReapply,
          reapplyAfter: canReapply ? reapplyAfter : undefined,
          updatedAt: now,
        },
        $push: {
          rejectionHistory: rejectionEntry as never,
        },
      }
    );

    // Send rejection email (fire-and-forget, don't block response)
    emailService
      .sendRejectionEmail(
        signup.admin.email,
        signup.organizationName,
        `${signup.admin.firstName} ${signup.admin.lastName}`,
        reason
      )
      .catch((err) =>
        logger.error({ err, email: signup.admin.email }, 'Failed to send rejection email')
      );

    logger.info({ signupId, adminId, reason, canReapply }, 'Organization rejected');
  }

  // Archive rejected organization
  async archiveOrganization(signupId: string, adminId: string): Promise<void> {
    const signup = (await collections.organizationSignups.findOne({
      _id: new ObjectId(signupId),
    })) as WithId<OrganizationSignupDocument> | null;

    if (!signup) {
      throw new ApiError('NOT_FOUND', 'Organization signup not found', 404);
    }

    if (signup.status === 'archived') {
      throw new ApiError('ALREADY_ARCHIVED', 'Organization is already archived', 400);
    }

    if (signup.status !== 'rejected') {
      throw new ApiError('INVALID_STATUS', 'Only rejected organizations can be archived', 400);
    }

    const now = new Date();

    await collections.organizationSignups.updateOne(
      { _id: new ObjectId(signupId) },
      {
        $set: {
          status: 'archived',
          archivedAt: now,
          updatedAt: now,
        },
      }
    );

    logger.info({ signupId, adminId }, 'Organization archived');
  }

  // Unarchive organization (restore to rejected status)
  async unarchiveOrganization(signupId: string, adminId: string): Promise<void> {
    const signup = (await collections.organizationSignups.findOne({
      _id: new ObjectId(signupId),
    })) as WithId<OrganizationSignupDocument> | null;

    if (!signup) {
      throw new ApiError('NOT_FOUND', 'Organization signup not found', 404);
    }

    if (signup.status !== 'archived') {
      throw new ApiError('INVALID_STATUS', 'Only archived organizations can be unarchived', 400);
    }

    const now = new Date();

    await collections.organizationSignups.updateOne(
      { _id: new ObjectId(signupId) },
      {
        $set: {
          status: 'rejected',
          updatedAt: now,
        },
        $unset: {
          archivedAt: '',
        },
      }
    );

    logger.info({ signupId, adminId }, 'Organization unarchived');
  }

  /**
   * Permanently delete an organization: the signup record and — when the org
   * was approved and a tenant exists — the tenant document plus every
   * tenant-scoped document across ALL collections.
   *
   * Safety rails:
   *  - `confirmName` must exactly match the organization name (type-to-confirm).
   *  - Tenant data is matched by BOTH ObjectId and string forms of tenantId,
   *    since some documents store it as a string.
   *
   * This is irreversible. Returns a summary of what was removed.
   */
  async deleteOrganization(
    signupId: string,
    adminId: string,
    confirmName: string
  ): Promise<{ deletedTenant: boolean; collectionsPurged: number; documentsDeleted: number }> {
    const signup = (await collections.organizationSignups.findOne({
      _id: new ObjectId(signupId),
    })) as WithId<OrganizationSignupDocument> | null;

    if (!signup) {
      throw new ApiError('NOT_FOUND', 'Organization signup not found', 404);
    }

    if ((confirmName || '').trim() !== signup.organizationName.trim()) {
      throw new ApiError(
        'CONFIRMATION_MISMATCH',
        'Type the exact organization name to confirm deletion',
        400
      );
    }

    let collectionsPurged = 0;
    let documentsDeleted = 0;
    let deletedTenant = false;

    if (signup.tenantId) {
      if (!ObjectId.isValid(signup.tenantId)) {
        throw new ApiError(
          'TENANT_REFERENCE_INVALID',
          'Organization has a malformed tenant reference; cannot purge safely',
          500
        );
      }
      const tenantOid = new ObjectId(signup.tenantId);
      const tenantStr = tenantOid.toString();
      const db = getDb();

      // Suspend the tenant before sweeping so a partial failure never leaves a
      // half-purged org that still accepts logins. Retrying the delete resumes
      // from here.
      await collections.tenants.updateOne(
        { _id: tenantOid },
        { $set: { status: 'suspended', updatedAt: new Date() } }
      );

      // Sweep every collection for tenant-scoped documents. Collections that
      // don't carry a tenantId field simply match zero documents. This keeps
      // the purge complete even as new tenant-scoped collections are added.
      // Physical names are snake_case (see config/database.ts).
      const PLATFORM_COLLECTIONS = new Set([
        'super_admins',
        'organization_signups',
        'pending_organizations',
        'tenants',
      ]);
      const allCollections = await db.listCollections({}, { nameOnly: true }).toArray();
      const names = allCollections
        .map((c) => c.name)
        .filter((name) => !PLATFORM_COLLECTIONS.has(name) && !name.startsWith('system.'));

      const failedCollections: string[] = [];
      const CHUNK_SIZE = 10;
      for (let i = 0; i < names.length; i += CHUNK_SIZE) {
        const chunk = names.slice(i, i + CHUNK_SIZE);
        const results = await Promise.allSettled(
          chunk.map((name) =>
            db
              .collection(name)
              .deleteMany({ $or: [{ tenantId: tenantOid }, { tenantId: tenantStr }] })
          )
        );
        results.forEach((result, idx) => {
          if (result.status === 'fulfilled') {
            if (result.value.deletedCount > 0) {
              collectionsPurged++;
              documentsDeleted += result.value.deletedCount;
            }
          } else {
            failedCollections.push(chunk[idx]);
          }
        });
      }

      if (failedCollections.length > 0) {
        logger.error(
          { signupId, tenantId: tenantStr, failedCollections },
          'Organization purge incomplete'
        );
        throw new ApiError(
          'PURGE_INCOMPLETE',
          `Failed to purge ${failedCollections.length} collection(s): ${failedCollections.join(', ')}. The organization has been suspended; retry the delete.`,
          500,
          failedCollections
        );
      }

      const tenantResult = await collections.tenants.deleteOne({ _id: tenantOid });
      deletedTenant = tenantResult.deletedCount > 0;

      // Clear any cached module/feature flags for the deleted tenant.
      try {
        clearFeatureCache(tenantStr);
      } catch {
        /* cache clear is best-effort */
      }
    }

    await collections.organizationSignups.deleteOne({ _id: new ObjectId(signupId) });

    logger.warn(
      {
        signupId,
        adminId,
        organizationName: signup.organizationName,
        tenantId: signup.tenantId?.toString(),
        deletedTenant,
        collectionsPurged,
        documentsDeleted,
      },
      'Organization permanently deleted'
    );

    return { deletedTenant, collectionsPurged, documentsDeleted };
  }

  // Get archived organizations
  async getArchivedOrganizations(params: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<{
    data: OrganizationSignupResponse[];
    meta: { total: number; page: number; limit: number };
  }> {
    const { page = 1, limit = 20, search } = params;

    const query: Record<string, unknown> = { status: 'archived' };
    if (search) {
      query.$or = [
        { organizationName: { $regex: search, $options: 'i' } },
        { 'admin.email': { $regex: search, $options: 'i' } },
        { 'admin.firstName': { $regex: search, $options: 'i' } },
        { 'admin.lastName': { $regex: search, $options: 'i' } },
      ];
    }

    const total = await collections.organizationSignups.countDocuments(query);
    const signups = (await collections.organizationSignups
      .find(query)
      .sort({ archivedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray()) as WithId<OrganizationSignupDocument>[];

    return {
      data: signups.map((s) => ({
        id: s._id.toString(),
        organizationName: s.organizationName,
        institutionType: s.institutionType,
        admin: {
          firstName: s.admin.firstName,
          lastName: s.admin.lastName,
          email: s.admin.email,
          phone: s.admin.phone,
        },
        emailVerified: s.emailVerified,
        status: s.status,
        requestedModules: s.requestedModules || ['core'],
        approvedModules: s.approvedModules,
        rejectionReason: s.rejectionReason,
        rejectionHistory: s.rejectionHistory,
        createdAt: s.createdAt,
        approvedAt: s.approvedAt,
        rejectedAt: s.rejectedAt,
        archivedAt: s.archivedAt,
        canReapply: s.canReapply,
      })),
      meta: { total, page, limit },
    };
  }

  // Update reapply settings for a rejected organization
  async updateReapplySettings(
    signupId: string,
    adminId: string,
    canReapply: boolean,
    reapplyAfterDays?: number
  ): Promise<void> {
    const signup = (await collections.organizationSignups.findOne({
      _id: new ObjectId(signupId),
    })) as WithId<OrganizationSignupDocument> | null;

    if (!signup) {
      throw new ApiError('NOT_FOUND', 'Organization signup not found', 404);
    }

    if (signup.status !== 'rejected') {
      throw new ApiError(
        'INVALID_STATUS',
        'Can only update reapply settings for rejected organizations',
        400
      );
    }

    const now = new Date();
    const updateData: Record<string, unknown> = {
      canReapply,
      updatedAt: now,
    };

    if (canReapply && reapplyAfterDays) {
      updateData.reapplyAfter = new Date(now.getTime() + reapplyAfterDays * 24 * 60 * 60 * 1000);
    } else if (!canReapply) {
      updateData.reapplyAfter = null;
    }

    await collections.organizationSignups.updateOne(
      { _id: new ObjectId(signupId) },
      { $set: updateData }
    );

    logger.info({ signupId, adminId, canReapply, reapplyAfterDays }, 'Reapply settings updated');
  }

  // Update organization modules (for approved organizations)
  async updateOrganizationModules(
    signupId: string,
    adminId: string,
    modules: string[]
  ): Promise<void> {
    const signup = (await collections.organizationSignups.findOne({
      _id: new ObjectId(signupId),
    })) as WithId<OrganizationSignupDocument> | null;

    if (!signup) {
      throw new ApiError('NOT_FOUND', 'Organization signup not found', 404);
    }

    if (signup.status !== 'approved') {
      throw new ApiError(
        'INVALID_STATUS',
        'Can only update modules for approved organizations',
        400
      );
    }

    if (!signup.tenantId) {
      throw new ApiError('INVALID_STATE', 'Organization has no associated tenant', 400);
    }

    // Drop invalid codes and ensure core modules are always included
    const finalModules = ensureCoreModules(modules);

    const now = new Date();

    // Update the organization signup record
    await collections.organizationSignups.updateOne(
      { _id: new ObjectId(signupId) },
      {
        $set: {
          approvedModules: finalModules,
          updatedAt: now,
        },
      }
    );

    // Update the tenant's subscription features
    await collections.tenants.updateOne(
      { _id: signup.tenantId },
      {
        $set: {
          'subscription.features': finalModules,
          updatedAt: now,
        },
      }
    );

    // Clear cached features so the change takes effect immediately
    clearFeatureCache(signup.tenantId.toString());

    logger.info(
      { signupId, tenantId: signup.tenantId.toString(), adminId, modules: finalModules },
      'Organization modules updated'
    );
  }

  // Dashboard stats
  async getDashboardStats(): Promise<AdminDashboardStats> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      pendingApprovals,
      totalOrganizations,
      approvedThisMonth,
      rejectedThisMonth,
      recentSignups,
    ] = await Promise.all([
      collections.organizationSignups.countDocuments({ status: 'pending_approval' }),
      collections.tenants.countDocuments({}),
      collections.organizationSignups.countDocuments({
        status: 'approved',
        approvedAt: { $gte: startOfMonth },
      }),
      collections.organizationSignups.countDocuments({
        status: 'rejected',
        rejectedAt: { $gte: startOfMonth },
      }),
      collections.organizationSignups
        .find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .toArray() as Promise<WithId<OrganizationSignupDocument>[]>,
    ]);

    return {
      pendingApprovals,
      totalOrganizations,
      approvedThisMonth,
      rejectedThisMonth,
      recentSignups: recentSignups.map((s) => ({
        id: s._id.toString(),
        organizationName: s.organizationName,
        institutionType: s.institutionType,
        admin: {
          firstName: s.admin.firstName,
          lastName: s.admin.lastName,
          email: s.admin.email,
          phone: s.admin.phone,
        },
        emailVerified: s.emailVerified,
        status: s.status,
        requestedModules: s.requestedModules || ['core'],
        createdAt: s.createdAt,
      })),
    };
  }

  // Platform-wide statistics (aggregated across every tenant)
  async getPlatformStatistics(): Promise<PlatformStatistics> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    // First day of the month, 5 months back → a rolling 6-month window.
    const growthSince = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    // Group documents by calendar month within the rolling window.
    const monthlyPipeline = [
      { $match: { createdAt: { $gte: growthSince } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
    ];

    const [
      totalOrganizations,
      activeOrganizations,
      pendingApprovals,
      orgsNewThisMonth,
      totalStudents,
      activeStudents,
      studentsNewThisMonth,
      totalStaff,
      totalTeachers,
      totalBranches,
      totalUsers,
      institutionTypeAgg,
      topOrgsAgg,
      orgMonthlyAgg,
      studentMonthlyAgg,
    ] = await Promise.all([
      collections.tenants.countDocuments({}),
      collections.tenants.countDocuments({ status: 'active' }),
      collections.organizationSignups.countDocuments({ status: 'pending_approval' }),
      collections.tenants.countDocuments({ createdAt: { $gte: startOfMonth } }),
      collections.students.countDocuments({}),
      collections.students.countDocuments({ status: 'active' }),
      collections.students.countDocuments({ createdAt: { $gte: startOfMonth } }),
      collections.staff.countDocuments({}),
      collections.staff.countDocuments({ 'teaching.isTeaching': true }),
      collections.branches.countDocuments({}),
      collections.users.countDocuments({}),
      collections.tenants
        .aggregate<{
          _id: string;
          count: number;
        }>([
          { $unwind: '$institutionTypes' },
          { $group: { _id: '$institutionTypes', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ])
        .toArray(),
      collections.students
        .aggregate<{
          _id: ObjectId;
          students: number;
          name?: string;
          institutionTypes?: string[];
        }>([
          { $group: { _id: '$tenantId', students: { $sum: 1 } } },
          { $sort: { students: -1 } },
          { $limit: 6 },
          {
            $lookup: {
              from: 'tenants',
              localField: '_id',
              foreignField: '_id',
              as: 'tenant',
            },
          },
          { $unwind: { path: '$tenant', preserveNullAndEmptyArrays: true } },
          {
            $project: {
              students: 1,
              name: '$tenant.name',
              institutionTypes: '$tenant.institutionTypes',
            },
          },
        ])
        .toArray(),
      collections.tenants
        .aggregate<{ _id: { year: number; month: number }; count: number }>(monthlyPipeline)
        .toArray(),
      collections.students
        .aggregate<{ _id: { year: number; month: number }; count: number }>(monthlyPipeline)
        .toArray(),
    ]);

    // Build a dense, zero-filled 6-month series in chronological order.
    const monthKey = (y: number, m: number) => `${y}-${m}`; // m is 1-12
    const orgByMonth = new Map(
      orgMonthlyAgg.map((d) => [monthKey(d._id.year, d._id.month), d.count])
    );
    const studentByMonth = new Map(
      studentMonthlyAgg.map((d) => [monthKey(d._id.year, d._id.month), d.count])
    );
    const monthLabels = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const monthlyGrowth: PlatformStatistics['monthlyGrowth'] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = monthKey(d.getFullYear(), d.getMonth() + 1);
      monthlyGrowth.push({
        month: monthLabels[d.getMonth()],
        organizations: orgByMonth.get(key) ?? 0,
        students: studentByMonth.get(key) ?? 0,
      });
    }

    return {
      organizations: {
        total: totalOrganizations,
        active: activeOrganizations,
        pendingApprovals,
        newThisMonth: orgsNewThisMonth,
      },
      students: {
        total: totalStudents,
        active: activeStudents,
        newThisMonth: studentsNewThisMonth,
      },
      staff: {
        total: totalStaff,
        teachers: totalTeachers,
        nonTeaching: Math.max(totalStaff - totalTeachers, 0),
      },
      branches: totalBranches,
      users: totalUsers,
      byInstitutionType: institutionTypeAgg.map((t) => ({
        type: t._id,
        count: t.count,
      })),
      topOrganizations: topOrgsAgg
        .filter((o) => o.name)
        .map((o) => ({
          id: o._id.toString(),
          name: o.name as string,
          institutionType: o.institutionTypes?.[0] ?? 'unknown',
          students: o.students,
        })),
      monthlyGrowth,
    };
  }

  // Helper
  private parseExpiryToSeconds(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 900;

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

  /**
   * Migration: Fix role levels to match the current ROLE_HIERARCHY constants
   * This updates all system roles across all tenants to have correct levels
   */
  async migrateRoleLevels(): Promise<{
    updated: number;
    roles: Array<{ code: string; oldLevel: number; newLevel: number }>;
  }> {
    const updates: Array<{ code: string; oldLevel: number; newLevel: number }> = [];

    // Get all system roles
    const systemRoles = await collections.roles.find({ isSystemRole: true }).toArray();

    for (const role of systemRoles) {
      const expectedLevel = ROLE_HIERARCHY[role.code];
      if (expectedLevel !== undefined && role.level !== expectedLevel) {
        updates.push({
          code: role.code,
          oldLevel: role.level,
          newLevel: expectedLevel,
        });

        await collections.roles.updateOne(
          { _id: role._id },
          { $set: { level: expectedLevel, updatedAt: new Date() } }
        );
      }
    }

    // Also update user roleLevel fields
    for (const update of updates) {
      await collections.users.updateMany(
        { roleCode: update.code, roleLevel: update.oldLevel },
        { $set: { roleLevel: update.newLevel } }
      );
    }

    logger.info({ updates }, 'Role levels migration completed');

    return { updated: updates.length, roles: updates };
  }
}

export const adminService = new AdminService();

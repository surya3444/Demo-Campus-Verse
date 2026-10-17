import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';

// ---- Fixed test IDs ----
const TEST_TENANT_ID = new ObjectId();
const TEST_USER_ID = new ObjectId();
const TEST_ROLE_ID = new ObjectId();
const TEST_BRANCH_ID = new ObjectId();

// ---- Mock bcryptjs ----
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2b$12$hashedpassword'),
    compare: vi.fn().mockResolvedValue(true),
  },
}));

// ---- Mock jsonwebtoken ----
vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn().mockReturnValue('mock.jwt.token'),
    verify: vi.fn().mockReturnValue({
      userId: 'mock-user-id',
      tenantId: 'mock-tenant-id',
      email: 'admin@test.edu',
      roleCode: 'GROUP_OWNER',
      roleLevel: 100,
      permissions: {},
      accessScope: { type: 'global', branchIds: [] },
      type: 'refresh',
    }),
    TokenExpiredError: class TokenExpiredError extends Error {
      name = 'TokenExpiredError';
      constructor() {
        super('jwt expired');
      }
    },
  },
}));

// ---- Mock env ----
vi.mock('@/config/env', () => ({
  env: {
    JWT_ACCESS_SECRET: 'a]3Fk9!mP7qR2sT5uV8wX0yB4dG6hJ1n',
    JWT_REFRESH_SECRET: 'z]9Yb7xW5vU3tS1rQ8pO6nM4lK2jH0gF',
    JWT_ACCESS_EXPIRY: '15m',
    JWT_REFRESH_EXPIRY: '7d',
    RAZORPAY_KEY_ID: 'rzp_test_key',
  },
}));

// ---- Mock logger ----
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ---- Mock email service ----
vi.mock('@/services/email.service', () => ({
  emailService: {
    sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
    sendForgotPasswordLink: vi.fn().mockResolvedValue(true),
    notifySuperAdminNewSignup: vi.fn().mockResolvedValue(undefined),
  },
}));

// ---- Mock razorpay service ----
vi.mock('@/services/razorpay.service', () => ({
  razorpayService: {
    createOrder: vi.fn().mockResolvedValue({ id: 'order_test123' }),
    verifyPayment: vi.fn().mockReturnValue(true),
  },
}));

// ---- Mock Redis ----
const mockRedis = {
  status: 'ready' as string,
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue('OK'),
  del: vi.fn().mockResolvedValue(1),
  setex: vi.fn().mockResolvedValue('OK'),
  expire: vi.fn().mockResolvedValue(1),
  keys: vi.fn().mockResolvedValue([]),
};

vi.mock('@/config/redis', () => ({
  getRedis: vi.fn(() => mockRedis),
}));

// ---- Mock database collections ----
function createMockCollection() {
  return {
    findOne: vi.fn(),
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([]),
    }),
    insertOne: vi.fn().mockResolvedValue({ insertedId: new ObjectId() }),
    insertMany: vi.fn().mockResolvedValue({ insertedCount: 0 }),
    updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
    updateMany: vi.fn().mockResolvedValue({ modifiedCount: 0 }),
    deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
    countDocuments: vi.fn().mockResolvedValue(0),
    aggregate: vi.fn().mockReturnValue({
      toArray: vi.fn().mockResolvedValue([]),
    }),
  };
}

const mockUsers = createMockCollection();
const mockTenants = createMockCollection();
const mockRoles = createMockCollection();
const mockBranches = createMockCollection();
const mockInstitutions = createMockCollection();
const mockDepartments = createMockCollection();
const mockBranchSettings = createMockCollection();
const mockOrganizationSignups = createMockCollection();
const mockCounters = createMockCollection();
const mockPendingOrganizations = createMockCollection();

// NOTE: vi.mock factories are hoisted above the const declarations, so they run
// while the mock objects are still in the temporal dead zone. Getters defer the
// dereference to call time (inside tests), when the consts are initialized.
vi.mock('@/config/database', () => ({
  collections: {
    get users() {
      return mockUsers;
    },
    get tenants() {
      return mockTenants;
    },
    get roles() {
      return mockRoles;
    },
    get branches() {
      return mockBranches;
    },
    get institutions() {
      return mockInstitutions;
    },
    get departments() {
      return mockDepartments;
    },
    get branchSettings() {
      return mockBranchSettings;
    },
    get organizationSignups() {
      return mockOrganizationSignups;
    },
    get counters() {
      return mockCounters;
    },
    get pendingOrganizations() {
      return mockPendingOrganizations;
    },
  },
  getDb: vi.fn(),
}));

// ---- Import after all mocks are set up ----
import { authService } from '../../modules/auth/auth.service';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// ---- Helpers to build mock documents ----
function buildMockUserDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: TEST_USER_ID,
    tenantId: TEST_TENANT_ID,
    email: 'admin@test.edu',
    passwordHash: '$2b$12$existinghash',
    phone: '+919876543210',
    profile: {
      firstName: 'Test',
      lastName: 'Admin',
      displayName: 'Test Admin',
    },
    roleId: TEST_ROLE_ID,
    accessScope: {
      type: 'global' as const,
      branchIds: [TEST_BRANCH_ID],
    },
    status: 'active',
    security: {
      mustChangePassword: false,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildMockTenantDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: TEST_TENANT_ID,
    name: 'Test School',
    code: 'TESTSCH',
    institutionTypes: ['school'],
    branding: { logo: null, primaryColor: '#333' },
    status: 'active',
    subscription: {
      plan: 'starter',
      maxBranches: 3,
      maxStudents: 500,
      maxStaff: 50,
      features: ['core'],
      validUntil: new Date(),
    },
    onboardingCompleted: true,
    ...overrides,
  };
}

function buildMockRoleDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: TEST_ROLE_ID,
    tenantId: TEST_TENANT_ID,
    name: 'Group Owner',
    code: 'GROUP_OWNER',
    isSystemRole: true,
    level: 100,
    permissions: { dashboard: ['view'] },
    ...overrides,
  };
}

function buildMockBranchDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: TEST_BRANCH_ID,
    tenantId: TEST_TENANT_ID,
    name: 'Main Branch',
    code: 'MAIN',
    institutionType: 'school',
    status: 'active',
    ...overrides,
  };
}

// ============================================================
// TESTS
// ============================================================

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.status = 'ready';
  });

  // ----------------------------------------------------------
  // 1. Login
  // ----------------------------------------------------------
  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      const userDoc = buildMockUserDoc();
      const tenantDoc = buildMockTenantDoc();
      const roleDoc = buildMockRoleDoc();
      const branchDoc = buildMockBranchDoc();

      mockUsers.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([userDoc]),
      });
      mockTenants.findOne.mockResolvedValue(tenantDoc);
      mockRoles.findOne.mockResolvedValue(roleDoc);
      mockBranches.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([branchDoc]),
      });
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      const result = await authService.login('admin@test.edu', 'password123');

      expect(result).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.tokens).toBeDefined();
      expect(result.user.email).toBe('admin@test.edu');
      expect(result.tokens.accessToken).toBe('mock.jwt.token');
      expect(result.tokens.refreshToken).toBe('mock.jwt.token');
      expect(result.user.roleCode).toBe('GROUP_OWNER');
      expect(result.user.tenant.name).toBe('Test School');
      // Should update last login
      expect(mockUsers.updateOne).toHaveBeenCalledWith(
        { _id: TEST_USER_ID },
        expect.objectContaining({
          $set: expect.objectContaining({
            failedLoginAttempts: 0,
            lockUntil: null,
          }),
        })
      );
    });

    it('should throw INVALID_CREDENTIALS when user is not found', async () => {
      mockUsers.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([]),
      });
      mockOrganizationSignups.findOne.mockResolvedValue(null);

      await expect(authService.login('unknown@test.edu', 'password123')).rejects.toThrow(
        expect.objectContaining({
          code: 'INVALID_CREDENTIALS',
          statusCode: 401,
        })
      );
    });

    it('should throw INVALID_CREDENTIALS when password is wrong', async () => {
      const userDoc = buildMockUserDoc();
      mockUsers.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([userDoc]),
      });
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(false);

      await expect(authService.login('admin@test.edu', 'wrongpassword')).rejects.toThrow(
        expect.objectContaining({
          code: 'INVALID_CREDENTIALS',
          statusCode: 401,
        })
      );
    });

    it('picks the organisation record whose password matches (multi-org email)', async () => {
      // The same email exists in several tenants — that is what powers the
      // organisation switcher — and the records can carry different passwords.
      // Selecting an arbitrary one rejected valid credentials.
      const otherOrgUser = buildMockUserDoc({
        _id: new ObjectId(),
        tenantId: new ObjectId(),
        passwordHash: '$2b$12$someotherorgshash',
      });
      const matchingUser = buildMockUserDoc();
      mockUsers.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([otherOrgUser, matchingUser]),
      });
      // Only the second record's hash verifies.
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockImplementation(
        async (_pw: string, hash: string) => hash === matchingUser.passwordHash
      );
      mockTenants.findOne.mockResolvedValue(buildMockTenantDoc());
      mockRoles.findOne.mockResolvedValue(buildMockRoleDoc());
      mockBranches.find.mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) });

      const result = await authService.login('admin@test.edu', 'password123');

      expect(result.user.id).toBe(matchingUser._id.toString());
      // Reset for the tests that follow — mockImplementation outlives the test.
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    });

    it('should throw ACCOUNT_INACTIVE for inactive user', async () => {
      const inactiveUser = buildMockUserDoc({ status: 'inactive' });
      mockUsers.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([inactiveUser]),
      });
      // Explicit: the preceding test leaves compare() returning false, and the
      // password is now verified BEFORE the status check (it has to be — that
      // is how the right organisation record gets picked). A correct password
      // is what makes this an "inactive account", not a bad credential.
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      await expect(authService.login('admin@test.edu', 'password123')).rejects.toThrow(
        expect.objectContaining({
          code: 'ACCOUNT_INACTIVE',
          statusCode: 401,
        })
      );
    });

    it('should throw TENANT_SUSPENDED when tenant is suspended', async () => {
      const userDoc = buildMockUserDoc();
      const suspendedTenant = buildMockTenantDoc({ status: 'suspended' });

      mockUsers.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([userDoc]),
      });
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);
      mockTenants.findOne.mockResolvedValue(suspendedTenant);

      await expect(authService.login('admin@test.edu', 'password123')).rejects.toThrow(
        expect.objectContaining({
          code: 'TENANT_SUSPENDED',
          statusCode: 401,
        })
      );
    });

    it('should throw ROLE_NOT_FOUND when role does not exist', async () => {
      const userDoc = buildMockUserDoc();
      const tenantDoc = buildMockTenantDoc();

      mockUsers.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([userDoc]),
      });
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);
      mockTenants.findOne.mockResolvedValue(tenantDoc);
      mockRoles.findOne.mockResolvedValue(null);

      await expect(authService.login('admin@test.edu', 'password123')).rejects.toThrow(
        expect.objectContaining({
          code: 'ROLE_NOT_FOUND',
          statusCode: 500,
        })
      );
    });

    it('should throw TENANT_SUSPENDED when tenant is null', async () => {
      const userDoc = buildMockUserDoc();

      mockUsers.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([userDoc]),
      });
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);
      mockTenants.findOne.mockResolvedValue(null);

      await expect(authService.login('admin@test.edu', 'password123')).rejects.toThrow(
        expect.objectContaining({
          code: 'TENANT_SUSPENDED',
        })
      );
    });

    it('should fetch branch-scoped branches when accessScope is not global', async () => {
      const branchScopedUser = buildMockUserDoc({
        accessScope: { type: 'branch', branchIds: [TEST_BRANCH_ID] },
      });
      const tenantDoc = buildMockTenantDoc();
      const roleDoc = buildMockRoleDoc();
      const branchDoc = buildMockBranchDoc();

      mockUsers.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([branchScopedUser]),
      });
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);
      mockTenants.findOne.mockResolvedValue(tenantDoc);
      mockRoles.findOne.mockResolvedValue(roleDoc);
      mockBranches.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([branchDoc]),
      });

      const result = await authService.login('admin@test.edu', 'password123');

      expect(result.user.branches).toHaveLength(1);
      expect(result.user.branches[0].code).toBe('MAIN');
    });
  });

  // ----------------------------------------------------------
  // 2. Token Refresh
  // ----------------------------------------------------------
  describe('refreshAccessToken', () => {
    it('should return a new access token for a valid refresh token', async () => {
      const payload = {
        userId: TEST_USER_ID.toString(),
        tenantId: TEST_TENANT_ID.toString(),
        email: 'admin@test.edu',
        roleCode: 'GROUP_OWNER',
        roleLevel: 100,
        permissions: {},
        accessScope: { type: 'global', branchIds: [] },
        type: 'refresh',
      };

      (jwt.verify as ReturnType<typeof vi.fn>).mockReturnValue(payload);

      // Revocation is a DENY-list: not blacklisted, not revoked-all
      mockRedis.get.mockResolvedValue(null);

      // User exists and is active
      mockUsers.findOne.mockResolvedValue(buildMockUserDoc());

      const result = await authService.refreshAccessToken('valid-refresh-token');

      expect(result).toBeDefined();
      expect(result.accessToken).toBe('mock.jwt.token');
      expect(result.expiresIn).toBe(900); // 15m = 900s
    });

    it('should throw SESSION_INVALID when the refresh token is blacklisted', async () => {
      const payload = {
        userId: TEST_USER_ID.toString(),
        tenantId: TEST_TENANT_ID.toString(),
        email: 'admin@test.edu',
        roleCode: 'GROUP_OWNER',
        roleLevel: 100,
        permissions: {},
        accessScope: { type: 'global', branchIds: [] },
        type: 'refresh',
      };

      (jwt.verify as ReturnType<typeof vi.fn>).mockReturnValue(payload);
      // Blacklist lookup returns a hit (explicit logout revoked this token)
      mockRedis.get.mockResolvedValue('1');

      await expect(authService.refreshAccessToken('blacklisted-token')).rejects.toThrow(
        expect.objectContaining({
          code: 'SESSION_INVALID',
          statusCode: 401,
        })
      );
    });

    it('should still refresh when the session record is missing from Redis (fail open)', async () => {
      // A session key lost to Redis eviction/restart must NEVER log a working
      // user out — revocation is a deny-list, the session store is
      // informational only (this is the random-logout fix).
      const payload = {
        userId: TEST_USER_ID.toString(),
        tenantId: TEST_TENANT_ID.toString(),
        email: 'admin@test.edu',
        roleCode: 'GROUP_OWNER',
        roleLevel: 100,
        permissions: {},
        accessScope: { type: 'global', branchIds: [] },
        type: 'refresh',
      };

      (jwt.verify as ReturnType<typeof vi.fn>).mockReturnValue(payload);
      mockRedis.get.mockResolvedValue(null); // no blacklist, no session — fine
      mockUsers.findOne.mockResolvedValue(buildMockUserDoc());

      const result = await authService.refreshAccessToken('token-without-session');

      expect(result.accessToken).toBe('mock.jwt.token');
    });

    it('should throw USER_INVALID and delete session when user is inactive', async () => {
      const payload = {
        userId: TEST_USER_ID.toString(),
        tenantId: TEST_TENANT_ID.toString(),
        email: 'admin@test.edu',
        roleCode: 'GROUP_OWNER',
        roleLevel: 100,
        permissions: {},
        accessScope: { type: 'global', branchIds: [] },
        type: 'refresh',
      };

      (jwt.verify as ReturnType<typeof vi.fn>).mockReturnValue(payload);

      // Not blacklisted, not revoked-all
      mockRedis.get.mockResolvedValue(null);

      // User not found or inactive
      mockUsers.findOne.mockResolvedValue(null);

      await expect(authService.refreshAccessToken('valid-token')).rejects.toThrow(
        expect.objectContaining({
          code: 'USER_INVALID',
          statusCode: 401,
        })
      );

      // Should delete the session
      expect(mockRedis.del).toHaveBeenCalled();
    });

    it('should throw REFRESH_TOKEN_EXPIRED for expired refresh tokens', async () => {
      const ExpiredError = jwt.TokenExpiredError as unknown as new () => Error;
      (jwt.verify as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new ExpiredError();
      });

      await expect(authService.refreshAccessToken('expired-jwt')).rejects.toThrow(
        expect.objectContaining({
          code: 'REFRESH_TOKEN_EXPIRED',
          statusCode: 401,
        })
      );
    });
  });

  // ----------------------------------------------------------
  // 3. Logout
  // ----------------------------------------------------------
  describe('logout', () => {
    it('should delete the user session from Redis', async () => {
      await authService.logout(TEST_USER_ID.toString(), 'some-refresh-token');

      expect(mockRedis.del).toHaveBeenCalledWith(
        `session:${TEST_USER_ID.toString()}:some-refresh-token`
      );
    });

    it('should gracefully handle Redis being unavailable', async () => {
      mockRedis.status = 'connecting';

      await expect(
        authService.logout(TEST_USER_ID.toString(), 'some-refresh-token')
      ).resolves.toBeUndefined();
    });
  });

  // ----------------------------------------------------------
  // 4. Logout All Devices
  // ----------------------------------------------------------
  describe('logoutAllDevices', () => {
    it('should delete all sessions for the user', async () => {
      mockRedis.keys.mockResolvedValue([
        `session:${TEST_USER_ID.toString()}:token1`,
        `session:${TEST_USER_ID.toString()}:token2`,
      ]);

      await authService.logoutAllDevices(TEST_USER_ID.toString());

      expect(mockRedis.keys).toHaveBeenCalledWith(`session:${TEST_USER_ID.toString()}:*`);
      expect(mockRedis.del).toHaveBeenCalledWith(
        `session:${TEST_USER_ID.toString()}:token1`,
        `session:${TEST_USER_ID.toString()}:token2`
      );
    });

    it('should not call del when there are no sessions', async () => {
      mockRedis.keys.mockResolvedValue([]);

      await authService.logoutAllDevices(TEST_USER_ID.toString());

      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  // 5. Change Password
  // ----------------------------------------------------------
  describe('changePassword', () => {
    it('should change password when current password is correct', async () => {
      const userDoc = buildMockUserDoc();
      mockUsers.findOne.mockResolvedValue(userDoc);
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);
      (bcrypt.hash as ReturnType<typeof vi.fn>).mockResolvedValue('$2b$12$newhash');

      await authService.changePassword(
        TEST_USER_ID.toString(),
        'currentPassword',
        'newPassword123'
      );

      expect(bcrypt.compare).toHaveBeenCalledWith('currentPassword', userDoc.passwordHash);
      expect(bcrypt.hash).toHaveBeenCalledWith('newPassword123', 12);
      expect(mockUsers.updateOne).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        {
          $set: expect.objectContaining({
            passwordHash: '$2b$12$newhash',
            status: 'active',
            'security.mustChangePassword': false,
          }),
        }
      );
    });

    it('should throw INVALID_PASSWORD when current password is wrong', async () => {
      const userDoc = buildMockUserDoc();
      mockUsers.findOne.mockResolvedValue(userDoc);
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(false);

      await expect(
        authService.changePassword(TEST_USER_ID.toString(), 'wrongPassword', 'newPassword')
      ).rejects.toThrow(
        expect.objectContaining({
          code: 'INVALID_PASSWORD',
          statusCode: 400,
        })
      );
    });

    it('should throw USER_NOT_FOUND when user does not exist', async () => {
      mockUsers.findOne.mockResolvedValue(null);

      await expect(
        authService.changePassword(new ObjectId().toString(), 'current', 'new')
      ).rejects.toThrow(
        expect.objectContaining({
          code: 'USER_NOT_FOUND',
          statusCode: 404,
        })
      );
    });
  });

  // ----------------------------------------------------------
  // 6. Forgot Password
  // ----------------------------------------------------------
  describe('forgotPassword', () => {
    it('should create a reset token when user exists', async () => {
      mockUsers.findOne.mockResolvedValue(buildMockUserDoc());

      await authService.forgotPassword('admin@test.edu');

      // Should store token in Redis
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('reset:'),
        3600, // 1 hour
        'admin@test.edu'
      );
    });

    it('should silently succeed when user does not exist (prevent email enumeration)', async () => {
      mockUsers.findOne.mockResolvedValue(null);

      await expect(authService.forgotPassword('unknown@test.edu')).resolves.toBeUndefined();
      // Should not store any token
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  // 7. Reset Password
  // ----------------------------------------------------------
  describe('resetPassword', () => {
    it('should reset password with a valid reset token', async () => {
      mockRedis.get.mockResolvedValue('admin@test.edu');
      mockUsers.findOne.mockResolvedValue(buildMockUserDoc());
      (bcrypt.hash as ReturnType<typeof vi.fn>).mockResolvedValue('$2b$12$newhash');

      await authService.resetPassword('valid-reset-token', 'newSecurePassword');

      expect(mockUsers.updateOne).toHaveBeenCalledWith(
        { email: 'admin@test.edu' },
        {
          $set: expect.objectContaining({
            passwordHash: '$2b$12$newhash',
            failedLoginAttempts: 0,
            lockUntil: null,
          }),
        }
      );
      // Should delete the reset token
      expect(mockRedis.del).toHaveBeenCalledWith('reset:valid-reset-token');
      // Should invalidate all sessions
      expect(mockRedis.keys).toHaveBeenCalled();
    });

    it('should throw INVALID_RESET_TOKEN when token is invalid or expired', async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(authService.resetPassword('bad-token', 'newPassword')).rejects.toThrow(
        expect.objectContaining({
          code: 'INVALID_RESET_TOKEN',
          statusCode: 400,
        })
      );
    });

    it('should throw USER_NOT_FOUND when email from token does not match a user', async () => {
      mockRedis.get.mockResolvedValue('deleted@test.edu');
      mockUsers.findOne.mockResolvedValue(null);

      await expect(authService.resetPassword('valid-token', 'newPassword')).rejects.toThrow(
        expect.objectContaining({
          code: 'USER_NOT_FOUND',
          statusCode: 404,
        })
      );
    });
  });

  // ----------------------------------------------------------
  // 8. Token Generation & Verification
  // ----------------------------------------------------------
  describe('token generation and verification', () => {
    it('should generate an access token with type access', () => {
      const token = authService.generateAccessToken({
        userId: TEST_USER_ID.toString(),
        tenantId: TEST_TENANT_ID.toString(),
        email: 'admin@test.edu',
        roleCode: 'GROUP_OWNER',
        roleLevel: 100,
        permissions: {},
        accessScope: { type: 'global', branchIds: [] },
      });

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'access' }),
        expect.any(String),
        expect.objectContaining({ expiresIn: '15m' })
      );
      expect(token).toBe('mock.jwt.token');
    });

    it('should generate a refresh token with type refresh', () => {
      const token = authService.generateRefreshToken({
        userId: TEST_USER_ID.toString(),
        tenantId: TEST_TENANT_ID.toString(),
        email: 'admin@test.edu',
        roleCode: 'GROUP_OWNER',
        roleLevel: 100,
        permissions: {},
        accessScope: { type: 'global', branchIds: [] },
      });

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'refresh' }),
        expect.any(String),
        expect.objectContaining({ expiresIn: '7d' })
      );
      expect(token).toBe('mock.jwt.token');
    });

    it('should verify a valid access token', () => {
      (jwt.verify as ReturnType<typeof vi.fn>).mockReturnValue({
        userId: TEST_USER_ID.toString(),
        type: 'access',
      });

      const payload = authService.verifyAccessToken('valid-access-token');
      expect(payload.type).toBe('access');
    });

    it('should throw INVALID_TOKEN when access token has wrong type', () => {
      (jwt.verify as ReturnType<typeof vi.fn>).mockReturnValue({
        userId: TEST_USER_ID.toString(),
        type: 'refresh', // wrong type for access verification
      });

      expect(() => authService.verifyAccessToken('refresh-token-as-access')).toThrow(
        expect.objectContaining({
          code: 'INVALID_TOKEN',
        })
      );
    });

    it('should throw TOKEN_EXPIRED for expired access tokens', () => {
      const ExpiredError = jwt.TokenExpiredError as unknown as new () => Error;
      (jwt.verify as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new ExpiredError();
      });

      expect(() => authService.verifyAccessToken('expired-token')).toThrow(
        expect.objectContaining({
          code: 'TOKEN_EXPIRED',
        })
      );
    });
  });

  // ----------------------------------------------------------
  // 9. Session Management
  // ----------------------------------------------------------
  describe('session management', () => {
    it('should store a session in Redis with correct key and expiry', async () => {
      await authService.createSession(
        TEST_USER_ID.toString(),
        TEST_TENANT_ID.toString(),
        'refresh-token-abc',
        { userAgent: 'TestAgent', ip: '127.0.0.1' }
      );

      expect(mockRedis.setex).toHaveBeenCalledWith(
        `session:${TEST_USER_ID.toString()}:refresh-token-abc`,
        7 * 24 * 60 * 60, // 7d in seconds
        expect.any(String)
      );

      // Verify session data structure
      const storedJson = (mockRedis.setex as ReturnType<typeof vi.fn>).mock.calls[0][2];
      const storedSession = JSON.parse(storedJson);
      expect(storedSession.userId).toBe(TEST_USER_ID.toString());
      expect(storedSession.tenantId).toBe(TEST_TENANT_ID.toString());
      expect(storedSession.deviceInfo).toEqual({ userAgent: 'TestAgent', ip: '127.0.0.1' });
    });

    it('should skip session storage when Redis is not ready', async () => {
      mockRedis.status = 'connecting';

      await authService.createSession(
        TEST_USER_ID.toString(),
        TEST_TENANT_ID.toString(),
        'token',
        undefined
      );

      expect(mockRedis.setex).not.toHaveBeenCalled();
    });

    it('should retrieve an existing session', async () => {
      const sessionData = JSON.stringify({
        userId: TEST_USER_ID.toString(),
        tenantId: TEST_TENANT_ID.toString(),
        refreshToken: 'token-xyz',
        createdAt: new Date(),
      });
      mockRedis.get.mockResolvedValue(sessionData);

      const session = await authService.getSession(TEST_USER_ID.toString(), 'token-xyz');

      expect(session).toBeDefined();
      expect(session!.userId).toBe(TEST_USER_ID.toString());
    });

    it('should return null for non-existent session', async () => {
      mockRedis.get.mockResolvedValue(null);

      const session = await authService.getSession(TEST_USER_ID.toString(), 'nonexistent');

      expect(session).toBeNull();
    });
  });

  // ----------------------------------------------------------
  // 10. Get Profile
  // ----------------------------------------------------------
  describe('getProfile', () => {
    it('should return full user profile', async () => {
      const userDoc = buildMockUserDoc();
      const tenantDoc = buildMockTenantDoc();
      const roleDoc = buildMockRoleDoc();
      const branchDoc = buildMockBranchDoc();

      mockUsers.findOne
        .mockResolvedValueOnce(userDoc) // getProfile call
        .mockResolvedValue(userDoc); // getUserOrganizations call
      mockUsers.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([userDoc]),
      });
      mockTenants.findOne
        .mockResolvedValueOnce(tenantDoc) // getProfile
        .mockResolvedValue(tenantDoc); // getUserOrganizations
      mockRoles.findOne
        .mockResolvedValueOnce(roleDoc) // getProfile
        .mockResolvedValue(roleDoc); // getUserOrganizations
      mockBranches.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([branchDoc]),
      });

      const profile = await authService.getProfile(TEST_USER_ID.toString());

      expect(profile.id).toBe(TEST_USER_ID.toString());
      expect(profile.email).toBe('admin@test.edu');
      expect(profile.profile.firstName).toBe('Test');
      expect(profile.tenant.name).toBe('Test School');
      expect(profile.branches).toHaveLength(1);
    });

    it('should throw USER_NOT_FOUND for non-existent user', async () => {
      mockUsers.findOne.mockResolvedValue(null);

      await expect(authService.getProfile(new ObjectId().toString())).rejects.toThrow(
        expect.objectContaining({
          code: 'USER_NOT_FOUND',
          statusCode: 404,
        })
      );
    });

    it('should throw DATA_INCOMPLETE when tenant or role is missing', async () => {
      const userDoc = buildMockUserDoc();
      mockUsers.findOne.mockResolvedValue(userDoc);
      mockTenants.findOne.mockResolvedValue(null);
      mockRoles.findOne.mockResolvedValue(null);

      await expect(authService.getProfile(TEST_USER_ID.toString())).rejects.toThrow(
        expect.objectContaining({
          code: 'DATA_INCOMPLETE',
          statusCode: 500,
        })
      );
    });
  });

  // ----------------------------------------------------------
  // 11. Organization Signup
  // ----------------------------------------------------------
  describe('createOrganizationSignup', () => {
    it('should throw EMAIL_ALREADY_REGISTERED when email exists in signups', async () => {
      mockOrganizationSignups.findOne.mockResolvedValue({ _id: new ObjectId() });

      await expect(
        authService.createOrganizationSignup({
          email: 'existing@test.edu',
          password: 'password123',
          firstName: 'Test',
          lastName: 'User',
          organizationName: 'New Org',
          institutionType: 'school',
          phone: '+919876543210',
          requestedModules: ['students'],
        })
      ).rejects.toThrow(
        expect.objectContaining({
          code: 'EMAIL_ALREADY_REGISTERED',
          statusCode: 400,
        })
      );
    });

    it('should throw EMAIL_ALREADY_REGISTERED when email exists in users', async () => {
      mockOrganizationSignups.findOne.mockResolvedValue(null);
      mockUsers.findOne.mockResolvedValue(buildMockUserDoc());

      await expect(
        authService.createOrganizationSignup({
          email: 'admin@test.edu',
          password: 'password123',
          firstName: 'Test',
          lastName: 'User',
          organizationName: 'New Org',
          institutionType: 'school',
          requestedModules: ['students'],
          phone: '+919876543210',
        })
      ).rejects.toThrow(
        expect.objectContaining({
          code: 'EMAIL_ALREADY_REGISTERED',
        })
      );
    });
  });

  // ----------------------------------------------------------
  // 12. Password Hashing Utilities
  // ----------------------------------------------------------
  describe('password utilities', () => {
    it('should hash a password with bcrypt', async () => {
      (bcrypt.hash as ReturnType<typeof vi.fn>).mockResolvedValue('$2b$12$hashed');

      const hash = await authService.hashPassword('myPassword');
      expect(hash).toBe('$2b$12$hashed');
      expect(bcrypt.hash).toHaveBeenCalledWith('myPassword', 12);
    });

    it('should verify a password against a hash', async () => {
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      const result = await authService.verifyPassword('myPassword', '$2b$12$hashed');
      expect(result).toBe(true);
      expect(bcrypt.compare).toHaveBeenCalledWith('myPassword', '$2b$12$hashed');
    });
  });
});

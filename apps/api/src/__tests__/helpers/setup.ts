import { vi } from 'vitest';
import { ObjectId } from 'mongodb';

// Mock environment variables to prevent env validation errors
export function mockEnv() {
  vi.doMock('@/config/env', () => ({
    env: {
      MONGODB_URI: 'mongodb://localhost:27017/test',
      JWT_ACCESS_SECRET: 'test-access-secret-that-is-32chars!',
      JWT_REFRESH_SECRET: 'test-refresh-secret-that-is-32chars',
      NODE_ENV: 'test',
      PORT: 3001,
    },
  }));
}

// Common test IDs
export const TEST_TENANT_ID = new ObjectId().toString();
export const TEST_BRANCH_ID = new ObjectId().toString();
export const TEST_USER_ID = new ObjectId().toString();
export const TEST_STUDENT_ID = new ObjectId().toString();
export const TEST_CLASS_ID = new ObjectId().toString();
export const TEST_SECTION_ID = new ObjectId().toString();
export const TEST_BATCH_ID = new ObjectId().toString();

// Mock user for req.user
export const mockUser = {
  userId: TEST_USER_ID,
  tenantId: TEST_TENANT_ID,
  email: 'admin@test.edu',
  role: 'BRANCH_ADMIN',
  accessScope: {
    type: 'branch' as const,
    branchIds: [TEST_BRANCH_ID],
  },
};

// Mock collection methods
export function createMockCollection() {
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
    deleteMany: vi.fn().mockResolvedValue({ deletedCount: 0 }),
    countDocuments: vi.fn().mockResolvedValue(0),
    findOneAndUpdate: vi.fn(),
    findOneAndDelete: vi.fn(),
    aggregate: vi.fn().mockReturnValue({
      toArray: vi.fn().mockResolvedValue([]),
    }),
    createIndex: vi.fn(),
    bulkWrite: vi.fn(),
  };
}

// Mock the database collections module
export function mockCollections(
  collectionOverrides: Record<string, ReturnType<typeof createMockCollection>> = {}
) {
  const defaultCollections: Record<string, ReturnType<typeof createMockCollection>> = {
    tenants: createMockCollection(),
    branches: createMockCollection(),
    users: createMockCollection(),
    roles: createMockCollection(),
    students: createMockCollection(),
    studentEnrollments: createMockCollection(),
    leads: createMockCollection(),
    applications: createMockCollection(),
    feeStructures: createMockCollection(),
    feeAssignments: createMockCollection(),
    feeTransactions: createMockCollection(),
    concessions: createMockCollection(),
    counters: createMockCollection(),
    staff: createMockCollection(),
    departments: createMockCollection(),
    settings: createMockCollection(),
    classes: createMockCollection(),
    sections: createMockCollection(),
    academicBatches: createMockCollection(),
    wallets: createMockCollection(),
    walletTransactions: createMockCollection(),
    approvalRequests: createMockCollection(),
  };

  const merged = { ...defaultCollections, ...collectionOverrides };

  vi.doMock('@/config/database', () => ({
    collections: merged,
    getDb: vi.fn(),
  }));

  return merged;
}

// Mock Redis
export function mockRedis() {
  const redis = {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    setex: vi.fn().mockResolvedValue('OK'),
    expire: vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockResolvedValue(0),
    incr: vi.fn().mockResolvedValue(1),
    keys: vi.fn().mockResolvedValue([]),
    multi: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
  };

  vi.doMock('@/lib/redis', () => ({
    redis,
    getRedis: vi.fn().mockReturnValue(redis),
  }));

  return redis;
}

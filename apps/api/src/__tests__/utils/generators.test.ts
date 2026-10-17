import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';

const { mockCounters } = vi.hoisted(() => ({
  mockCounters: {
    findOneAndUpdate: vi.fn(),
  },
}));

// Mock env first to prevent validation errors
vi.mock('@/config/env', () => ({
  env: {
    MONGODB_URI: 'mongodb://localhost:27017/test',
    JWT_ACCESS_SECRET: 'test-access-secret-that-is-32chars!',
    JWT_REFRESH_SECRET: 'test-refresh-secret-that-is-32chars',
    NODE_ENV: 'test',
    PORT: 3001,
  },
}));

vi.mock('@/config/database', () => ({
  collections: {
    counters: mockCounters,
  },
  getDb: vi.fn(),
}));

// Import after mocking
import {
  generateId,
  generatePassword,
  generateShortId,
  padSequence,
  generateSequence,
  generateReceiptNumber,
  generateLeadNumber,
  generateApplicationNumber,
  generateAdmissionNumber,
  generateEmployeeId,
} from '../../utils/generators';

describe('generateId', () => {
  it('returns a string of default length 21', () => {
    const id = generateId();
    expect(typeof id).toBe('string');
    expect(id.length).toBe(21);
  });

  it('respects custom size', () => {
    const id = generateId(10);
    expect(id.length).toBe(10);
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});

describe('generatePassword', () => {
  it('returns a string of default length 12', () => {
    const pwd = generatePassword();
    expect(typeof pwd).toBe('string');
    expect(pwd.length).toBe(12);
  });

  it('respects custom length', () => {
    const pwd = generatePassword(16);
    expect(pwd.length).toBe(16);
  });
});

describe('generateShortId', () => {
  it('returns a string of length 12', () => {
    const id = generateShortId();
    expect(id.length).toBe(12);
  });
});

describe('padSequence', () => {
  it('pads single digit to 4 chars by default', () => {
    expect(padSequence(1)).toBe('0001');
  });

  it('pads to custom length', () => {
    expect(padSequence(42, 6)).toBe('000042');
  });

  it('does not truncate numbers longer than pad length', () => {
    expect(padSequence(12345, 3)).toBe('12345');
  });

  it('handles zero', () => {
    expect(padSequence(0)).toBe('0000');
  });
});

describe('generateSequence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls findOneAndUpdate with correct filter and returns sequence', async () => {
    mockCounters.findOneAndUpdate.mockResolvedValue({ sequence: 5 });

    const result = await generateSequence('leadNumber', new ObjectId().toString());
    expect(result).toBe(5);
    expect(mockCounters.findOneAndUpdate).toHaveBeenCalledOnce();

    const [filter, update, options] = mockCounters.findOneAndUpdate.mock.calls[0];
    expect(filter.type).toBe('leadNumber');
    expect(update.$inc).toEqual({ sequence: 1 });
    expect(options.upsert).toBe(true);
    expect(options.returnDocument).toBe('after');
  });

  it('includes branchId in filter when provided', async () => {
    const branchId = new ObjectId().toString();
    mockCounters.findOneAndUpdate.mockResolvedValue({ sequence: 1 });

    await generateSequence('receiptNumber', new ObjectId().toString(), branchId);

    const [filter] = mockCounters.findOneAndUpdate.mock.calls[0];
    expect(filter.branchId).toBeDefined();
  });

  it('includes academicBatchId when provided', async () => {
    const batchId = new ObjectId().toString();
    mockCounters.findOneAndUpdate.mockResolvedValue({ sequence: 1 });

    await generateSequence('admissionNumber', new ObjectId().toString(), undefined, batchId);

    const [filter] = mockCounters.findOneAndUpdate.mock.calls[0];
    expect(filter.academicBatchId).toBeDefined();
  });
});

describe('generateReceiptNumber', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates receipt number with format PREFIX+YY+6-digit sequence', async () => {
    mockCounters.findOneAndUpdate.mockResolvedValue({ sequence: 42 });
    const year = new Date().getFullYear().toString().slice(-2);

    const result = await generateReceiptNumber(
      new ObjectId().toString(),
      new ObjectId().toString()
    );
    expect(result).toBe(`RCP${year}000042`);
  });

  it('uses custom prefix', async () => {
    mockCounters.findOneAndUpdate.mockResolvedValue({ sequence: 1 });

    const result = await generateReceiptNumber(
      new ObjectId().toString(),
      new ObjectId().toString(),
      'FEE'
    );
    expect(result).toMatch(/^FEE/);
  });
});

describe('generateLeadNumber', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates lead number with LD prefix + YY + 5-digit sequence', async () => {
    mockCounters.findOneAndUpdate.mockResolvedValue({ sequence: 7 });
    const year = new Date().getFullYear().toString().slice(-2);

    const result = await generateLeadNumber(new ObjectId().toString(), new ObjectId().toString());
    expect(result).toBe(`LD${year}00007`);
  });
});

describe('generateApplicationNumber', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates application number with APP prefix', async () => {
    mockCounters.findOneAndUpdate.mockResolvedValue({ sequence: 123 });
    const year = new Date().getFullYear().toString().slice(-2);

    const result = await generateApplicationNumber(
      new ObjectId().toString(),
      new ObjectId().toString()
    );
    expect(result).toBe(`APP${year}00123`);
  });
});

describe('generateAdmissionNumber', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates admission number with BRANCH-BATCH-SEQUENCE format', async () => {
    mockCounters.findOneAndUpdate.mockResolvedValue({ sequence: 15 });

    const result = await generateAdmissionNumber(
      new ObjectId().toString(),
      new ObjectId().toString(),
      'MAIN',
      '2025'
    );
    expect(result).toBe('MAIN-2025-0015');
  });
});

describe('generateEmployeeId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates employee ID with EMP prefix by default', async () => {
    mockCounters.findOneAndUpdate.mockResolvedValue({ sequence: 3 });

    const result = await generateEmployeeId(new ObjectId().toString());
    expect(result).toBe('EMP00003');
  });

  it('uses custom prefix', async () => {
    mockCounters.findOneAndUpdate.mockResolvedValue({ sequence: 1 });

    const result = await generateEmployeeId(new ObjectId().toString(), 'TCH');
    expect(result).toBe('TCH00001');
  });
});

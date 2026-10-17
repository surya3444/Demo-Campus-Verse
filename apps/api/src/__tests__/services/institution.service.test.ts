import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
import { createMockCollection } from '../helpers/setup';

const TENANT_ID = new ObjectId().toString();
const BRANCH_ID = new ObjectId().toString();

const mockInstitutions = createMockCollection();
const mockTenants = createMockCollection();
const mockBranches = createMockCollection();
const mockStudents = createMockCollection();
const mockStaff = createMockCollection();
const mockClasses = createMockCollection();
const mockDepartments = createMockCollection();

vi.mock('@/config/database', () => ({
  collections: {
    get institutions() {
      return mockInstitutions;
    },
    get tenants() {
      return mockTenants;
    },
    get branches() {
      return mockBranches;
    },
    get students() {
      return mockStudents;
    },
    get staff() {
      return mockStaff;
    },
    get classes() {
      return mockClasses;
    },
    get departments() {
      return mockDepartments;
    },
  },
  getDb: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { institutionService } from '@/modules/organization/institution.service';
import { ApiError } from '@/middleware/errorHandler';

function findChain(docs: unknown[]) {
  return {
    project: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    toArray: vi.fn().mockResolvedValue(docs),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // clearAllMocks resets calls but NOT implementations, so without an explicit
  // default here a mockResolvedValue from an earlier test leaks forward and
  // tests start depending on execution order.
  mockTenants.findOne.mockResolvedValue({
    _id: new ObjectId(TENANT_ID),
    name: 'Nexus University',
    code: 'NEXUNI',
    institutionTypes: ['university'],
    subscription: { maxBranches: 5 },
  });
  mockBranches.findOne.mockResolvedValue({
    _id: new ObjectId(BRANCH_ID),
    tenantId: new ObjectId(TENANT_ID),
    name: 'Main Campus',
    code: 'MAIN01',
  });
  mockDepartments.updateMany.mockResolvedValue({ modifiedCount: 0 });
  mockDepartments.find.mockReturnValue(findChain([]));
  // Empty institutions by default; individual tests opt into holding data.
  mockStudents.countDocuments.mockResolvedValue(0);
  mockStaff.countDocuments.mockResolvedValue(0);
  mockClasses.countDocuments.mockResolvedValue(0);
  mockDepartments.countDocuments.mockResolvedValue(0);
});

describe('ensureDefaultInstitution', () => {
  it('creates the campus default from the BRANCH identity, and adopts unassigned departments', async () => {
    mockInstitutions.findOne.mockResolvedValue(null);
    mockBranches.findOne.mockResolvedValue({
      _id: new ObjectId(BRANCH_ID),
      tenantId: new ObjectId(TENANT_ID),
      name: 'Vizag Campus',
      code: 'VZG',
    });
    mockInstitutions.insertOne.mockResolvedValue({ insertedId: new ObjectId() });

    const inst = await institutionService.ensureDefaultInstitution(TENANT_ID, BRANCH_ID);

    // Branch identity, NOT the tenant's — tenant-named defaults made every
    // campus look like the same institution and shared one unique code.
    expect(inst.name).toBe('Vizag Campus');
    expect(inst.code).toBe('VZG');
    expect(inst.isDefault).toBe(true);
    expect(mockInstitutions.insertOne).toHaveBeenCalledTimes(1);
    // Departments predating the institution tier are adopted, scoped to this
    // campus so a sibling campus's departments are never claimed.
    expect(mockDepartments.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        branchId: new ObjectId(BRANCH_ID),
        institutionId: { $exists: false },
      }),
      { $set: { institutionId: inst._id } }
    );
  });

  it('is idempotent — an existing default is reused, not duplicated', async () => {
    const existing = {
      _id: new ObjectId(),
      tenantId: new ObjectId(TENANT_ID),
      name: 'Krishna School',
      code: 'KS',
      isDefault: true,
      status: 'active',
    };
    mockInstitutions.findOne.mockResolvedValue(existing);

    const inst = await institutionService.ensureDefaultInstitution(TENANT_ID, BRANCH_ID);

    expect(inst._id).toBe(existing._id);
    expect(inst.name).toBe('Krishna School');
    expect(mockInstitutions.insertOne).not.toHaveBeenCalled();
    // Name differs from the tenant's, so the identity heal must not touch it.
    expect(mockInstitutions.updateOne).not.toHaveBeenCalled();
  });

  it('heals a default still carrying the tenant identity to its campus identity', async () => {
    // Old convention: default stamped with the tenant name/code (this is what
    // made every campus show "the same institution").
    const legacy = {
      _id: new ObjectId(),
      tenantId: new ObjectId(TENANT_ID),
      branchId: new ObjectId(BRANCH_ID),
      name: 'Nexus University',
      code: 'NEXUNI',
      isDefault: true,
      status: 'active',
    };
    mockInstitutions.findOne.mockResolvedValue(legacy);
    mockInstitutions.updateOne.mockResolvedValue({ modifiedCount: 1 });

    const inst = await institutionService.ensureDefaultInstitution(TENANT_ID, BRANCH_ID);

    expect(mockInstitutions.updateOne).toHaveBeenCalledWith(
      { _id: legacy._id },
      { $set: expect.objectContaining({ name: 'Main Campus', code: 'MAIN01' }) }
    );
    expect(inst.name).toBe('Main Campus');
    expect(inst.code).toBe('MAIN01');
    expect(mockInstitutions.insertOne).not.toHaveBeenCalled();
  });

  it('heals a hybrid clone (tenant name + branch code) — the real-world legacy shape', async () => {
    // Some legacy defaults carry the tenant's NAME but the branch's code; the
    // heal matches on name alone so these do not slip through.
    const hybrid = {
      _id: new ObjectId(),
      tenantId: new ObjectId(TENANT_ID),
      branchId: new ObjectId(BRANCH_ID),
      name: 'Nexus University',
      code: 'TSTBRNCH009',
      isDefault: true,
      status: 'active',
    };
    mockInstitutions.findOne.mockResolvedValue(hybrid);
    mockInstitutions.updateOne.mockResolvedValue({ modifiedCount: 1 });

    const inst = await institutionService.ensureDefaultInstitution(TENANT_ID, BRANCH_ID);

    expect(inst.name).toBe('Main Campus');
    expect(inst.code).toBe('MAIN01');
  });

  it('keeps the old identity when re-stamping collides with an explicit institution code', async () => {
    const legacy = {
      _id: new ObjectId(),
      tenantId: new ObjectId(TENANT_ID),
      branchId: new ObjectId(BRANCH_ID),
      name: 'Nexus University',
      code: 'NEXUNI',
      isDefault: true,
      status: 'active',
    };
    mockInstitutions.findOne.mockResolvedValue(legacy);
    mockInstitutions.updateOne.mockRejectedValueOnce(
      Object.assign(new Error('duplicate'), { code: 11000 })
    );

    const inst = await institutionService.ensureDefaultInstitution(TENANT_ID, BRANCH_ID);

    // The read path that triggered the heal must not fail.
    expect(inst.name).toBe('Nexus University');
    expect(inst.code).toBe('NEXUNI');
  });

  it('adopts the concurrent winner when the unique index rejects the insert', async () => {
    const winner = {
      _id: new ObjectId(),
      tenantId: new ObjectId(TENANT_ID),
      name: 'X',
      code: 'X',
      isDefault: true,
    };
    mockInstitutions.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(winner);
    mockInstitutions.insertOne.mockRejectedValueOnce(
      Object.assign(new Error('duplicate'), { code: 11000 })
    );

    const inst = await institutionService.ensureDefaultInstitution(TENANT_ID, BRANCH_ID);

    expect(inst._id).toBe(winner._id);
  });
});

describe('create', () => {
  it('rejects a duplicate code within the tenant', async () => {
    // ensureDefaultInstitution finds an existing default…
    mockInstitutions.findOne
      .mockResolvedValueOnce({ _id: new ObjectId(), isDefault: true })
      // …then the duplicate-code lookup hits.
      .mockResolvedValueOnce({ _id: new ObjectId(), code: 'AEC' });

    await expect(
      institutionService.create(TENANT_ID, BRANCH_ID, {
        name: 'Anurag Engineering College',
        code: 'AEC',
      })
    ).rejects.toMatchObject({ code: 'DUPLICATE_INSTITUTION_CODE' });
  });

  it('uppercases the code and persists identity fields', async () => {
    mockInstitutions.findOne
      .mockResolvedValueOnce({ _id: new ObjectId(), isDefault: true })
      .mockResolvedValueOnce(null);

    const inst = await institutionService.create(TENANT_ID, BRANCH_ID, {
      name: 'Anurag Engineering College',
      code: 'aec',
      kind: 'engineering',
      settings: { admissionPrefix: 'AEC' },
    });

    expect(inst.code).toBe('AEC');
    expect(inst.kind).toBe('engineering');
    expect(inst.isDefault).toBe(false);
    expect(inst.settings).toEqual({ admissionPrefix: 'AEC' });
  });

  it('hangs the new institution off the active campus', async () => {
    mockInstitutions.findOne
      .mockResolvedValueOnce({ _id: new ObjectId(), isDefault: true })
      .mockResolvedValueOnce(null);

    const inst = await institutionService.create(TENANT_ID, BRANCH_ID, {
      name: 'Design School',
      code: 'DES',
    });

    expect(inst.branchId).toBe(BRANCH_ID);
    // A campus hosts institutions now — creating one must not create a branch.
    expect(mockBranches.insertOne).not.toHaveBeenCalled();
  });
});

describe('delete', () => {
  it('refuses to delete the default institution', async () => {
    mockInstitutions.findOne.mockResolvedValue({
      _id: new ObjectId(),
      tenantId: new ObjectId(TENANT_ID),
      isDefault: true,
    });

    await expect(institutionService.delete(TENANT_ID, new ObjectId().toString())).rejects.toThrow(
      ApiError
    );
    await expect(
      institutionService.delete(TENANT_ID, new ObjectId().toString())
    ).rejects.toMatchObject({ code: 'CANNOT_DELETE_DEFAULT' });
  });

  it('refuses to delete an institution that still holds departments', async () => {
    const instId = new ObjectId();
    mockInstitutions.findOne.mockResolvedValue({
      _id: instId,
      tenantId: new ObjectId(TENANT_ID),
      isDefault: false,
    });
    mockDepartments.find.mockReturnValue(findChain([{ _id: new ObjectId() }]));

    await expect(institutionService.delete(TENANT_ID, instId.toString())).rejects.toMatchObject({
      code: 'INSTITUTION_HAS_DATA',
    });
    expect(mockInstitutions.deleteOne).not.toHaveBeenCalled();
  });

  it('deletes an empty non-default institution, leaving the campus alone', async () => {
    const instId = new ObjectId();
    mockInstitutions.findOne.mockResolvedValue({
      _id: instId,
      tenantId: new ObjectId(TENANT_ID),
      isDefault: false,
    });

    const result = await institutionService.delete(TENANT_ID, instId.toString());

    expect(result).toEqual({ success: true });
    expect(mockInstitutions.deleteOne).toHaveBeenCalledWith({ _id: instId });
    // The campus outlives the institution — other institutions may share it.
    expect(mockBranches.deleteMany).not.toHaveBeenCalled();
  });
});

describe('findAll', () => {
  it('ensures the default first, then lists with department counts', async () => {
    const defaultInst = {
      _id: new ObjectId(),
      tenantId: new ObjectId(TENANT_ID),
      name: 'AU',
      code: 'AU',
      isDefault: true,
      status: 'active',
    };
    const aec = {
      _id: new ObjectId(),
      tenantId: new ObjectId(TENANT_ID),
      name: 'AEC',
      code: 'AEC',
      isDefault: false,
      status: 'active',
    };
    mockInstitutions.findOne.mockResolvedValue(defaultInst);
    mockInstitutions.find.mockReturnValue(findChain([defaultInst, aec]));
    mockDepartments.countDocuments.mockResolvedValueOnce(1).mockResolvedValueOnce(3);

    const list = await institutionService.findAll(TENANT_ID, BRANCH_ID);

    expect(list).toHaveLength(2);
    expect(list[0].departmentCount).toBe(1);
    expect(list[1].departmentCount).toBe(3);
    expect(list[0].isDefault).toBe(true);
  });
});

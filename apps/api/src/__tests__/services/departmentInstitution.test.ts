import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
import { createMockCollection } from '../helpers/setup';

const TENANT_ID = new ObjectId().toString();
const BRANCH_ID = new ObjectId().toString();
const USER_ID = new ObjectId().toString();

const DEFAULT_INSTITUTION_ID = new ObjectId();
const DESIGN_INSTITUTION_ID = new ObjectId();

const mockDepartments = createMockCollection();
const mockInstitutions = createMockCollection();
const mockStaff = createMockCollection();

vi.mock('@/config/database', () => ({
  collections: {
    get departments() {
      return mockDepartments;
    },
    get institutions() {
      return mockInstitutions;
    },
    get staff() {
      return mockStaff;
    },
  },
  getDb: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// The institution tier's own behaviour is covered by institution.service.test;
// here it only has to hand back the campus default.
const ensureDefaultInstitution = vi.fn();
vi.mock('@/modules/organization/institution.service', () => ({
  institutionService: {
    ensureDefaultInstitution: (...args: unknown[]) => ensureDefaultInstitution(...args),
    ensureDefaultUnlessUniversity: (...args: unknown[]) => ensureDefaultInstitution(...args),
  },
}));

import { departmentService } from '@/modules/hr/department.service';

const DESIGN_INSTITUTION = {
  _id: DESIGN_INSTITUTION_ID,
  tenantId: new ObjectId(TENANT_ID),
  branchId: new ObjectId(BRANCH_ID),
  name: 'Institute of Design',
  code: 'DESIGN',
  status: 'active',
};

beforeEach(() => {
  vi.clearAllMocks();
  ensureDefaultInstitution.mockResolvedValue({ _id: DEFAULT_INSTITUTION_ID });
  mockDepartments.findOne.mockResolvedValue(null); // no duplicate code
});

describe('createDepartment institution assignment', () => {
  const input = { name: 'Architecture', code: 'ARCH', type: 'academic' as const };

  it('files a department under the institution the caller picked', async () => {
    mockInstitutions.findOne.mockResolvedValue(DESIGN_INSTITUTION);

    const created = await departmentService.createDepartment(
      TENANT_ID,
      BRANCH_ID,
      { ...input, institutionId: DESIGN_INSTITUTION_ID.toString() },
      USER_ID
    );

    expect(created.institutionId).toBe(DESIGN_INSTITUTION_ID.toString());
    expect(mockDepartments.insertOne.mock.calls[0][0].institutionId).toEqual(DESIGN_INSTITUTION_ID);
    expect(ensureDefaultInstitution).not.toHaveBeenCalled();
  });

  it('falls back to the campus default when no institution is picked — a department is never left unassigned', async () => {
    const created = await departmentService.createDepartment(TENANT_ID, BRANCH_ID, input, USER_ID);

    expect(created.institutionId).toBe(DEFAULT_INSTITUTION_ID.toString());
    expect(ensureDefaultInstitution).toHaveBeenCalledWith(TENANT_ID, BRANCH_ID);
  });

  it('rejects an institution that is not on this campus', async () => {
    mockInstitutions.findOne.mockResolvedValue(null); // scoped find misses

    await expect(
      departmentService.createDepartment(
        TENANT_ID,
        BRANCH_ID,
        { ...input, institutionId: new ObjectId().toString() },
        USER_ID
      )
    ).rejects.toMatchObject({ code: 'INSTITUTION_NOT_FOUND' });

    const filter = mockInstitutions.findOne.mock.calls[0][0];
    expect(filter.branchId).toEqual(new ObjectId(BRANCH_ID));
    expect(mockDepartments.insertOne).not.toHaveBeenCalled();
  });

  it('rejects an archived institution', async () => {
    mockInstitutions.findOne.mockResolvedValue({ ...DESIGN_INSTITUTION, status: 'archived' });

    await expect(
      departmentService.createDepartment(
        TENANT_ID,
        BRANCH_ID,
        { ...input, institutionId: DESIGN_INSTITUTION_ID.toString() },
        USER_ID
      )
    ).rejects.toMatchObject({ code: 'INSTITUTION_ARCHIVED' });
  });

  it('rejects a malformed institution id without hitting the database', async () => {
    await expect(
      departmentService.createDepartment(
        TENANT_ID,
        BRANCH_ID,
        { ...input, institutionId: 'not-an-object-id' },
        USER_ID
      )
    ).rejects.toMatchObject({ code: 'INSTITUTION_NOT_FOUND' });
    expect(mockInstitutions.findOne).not.toHaveBeenCalled();
  });
});

describe('updateDepartment institution reassignment', () => {
  const DEPT_ID = new ObjectId();
  const existing = {
    _id: DEPT_ID,
    tenantId: new ObjectId(TENANT_ID),
    branchId: new ObjectId(BRANCH_ID),
    institutionId: DEFAULT_INSTITUTION_ID,
    name: 'Architecture',
    code: 'ARCH',
    type: 'academic',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('moves a department to another institution on the same campus', async () => {
    mockDepartments.findOne.mockResolvedValue(existing);
    mockInstitutions.findOne.mockResolvedValue(DESIGN_INSTITUTION);

    await departmentService.updateDepartment(TENANT_ID, DEPT_ID.toString(), {
      institutionId: DESIGN_INSTITUTION_ID.toString(),
    });

    const set = mockDepartments.updateOne.mock.calls[0][1].$set;
    expect(set.institutionId).toEqual(DESIGN_INSTITUTION_ID);
  });

  it("leaves the institution alone when the patch doesn't mention it", async () => {
    mockDepartments.findOne.mockResolvedValue(existing);

    await departmentService.updateDepartment(TENANT_ID, DEPT_ID.toString(), {
      name: 'Architecture & Planning',
    });

    const set = mockDepartments.updateOne.mock.calls[0][1].$set;
    expect(set).not.toHaveProperty('institutionId');
  });
});

describe('deleteDepartment staff guard', () => {
  it('blocks the delete on the field staff records actually carry', async () => {
    const deptId = new ObjectId();
    mockDepartments.findOne.mockResolvedValue({ _id: deptId, tenantId: new ObjectId(TENANT_ID) });
    mockStaff.countDocuments.mockResolvedValue(3);

    await expect(
      departmentService.deleteDepartment(TENANT_ID, deptId.toString())
    ).rejects.toMatchObject({ code: 'CANNOT_DELETE' });

    expect(mockStaff.countDocuments.mock.calls[0][0]).toHaveProperty('employment.departmentId');
    expect(mockDepartments.updateOne).not.toHaveBeenCalled();
  });
});

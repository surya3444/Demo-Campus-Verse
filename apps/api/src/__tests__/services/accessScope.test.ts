import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
import type { Request } from 'express';
import { createMockCollection } from '../helpers/setup';

/**
 * Scope resolution: department scope (flag-gated) and program scope
 * (unconditional), plus the intersection rule that keeps an out-of-scope
 * explicit filter from widening a query back to the whole branch.
 */

const TENANT_ID = new ObjectId().toString();
const BRANCH_ID = new ObjectId().toString();
const CSE_DEPT_ID = new ObjectId();
const AIML_PROGRAM_ID = new ObjectId();
const CLASS_A = new ObjectId();
const CLASS_B = new ObjectId();

const mockClasses = createMockCollection();
const mockSections = createMockCollection();
const mockTenants = createMockCollection();
const mockBranches = createMockCollection();
const mockPrograms = createMockCollection();
const mockDepartments = createMockCollection();
const mockInstitutions = createMockCollection();

vi.mock('@/config/database', () => ({
  collections: {
    get classes() {
      return mockClasses;
    },
    get sections() {
      return mockSections;
    },
    get tenants() {
      return mockTenants;
    },
    get branches() {
      return mockBranches;
    },
    get programs() {
      return mockPrograms;
    },
    get departments() {
      return mockDepartments;
    },
    get institutions() {
      return mockInstitutions;
    },
  },
  getDb: vi.fn(),
}));

import {
  getScopedClassIds,
  getScopedDepartmentIds,
  getScopedSectionIds,
  intersectScope,
  assertSectionInScope,
  clearDepartmentScopeFlagCache,
} from '@/middleware/scope';

function findChain(docs: unknown[]) {
  return {
    project: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    toArray: vi.fn().mockResolvedValue(docs),
  };
}

// Institution lookups (shared departments, institution-owned programs) find
// nothing unless a test says otherwise.
beforeEach(() => {
  mockInstitutions.find.mockReturnValue(findChain([]));
  mockPrograms.find.mockReturnValue(findChain([]));
});

function reqWith(scope: Record<string, unknown>): Request {
  return {
    tenantId: TENANT_ID,
    branchId: BRANCH_ID,
    user: { accessScope: scope },
  } as unknown as Request;
}

function setDepartmentScopeFlag(enabled: boolean) {
  clearDepartmentScopeFlagCache();
  mockTenants.findOne.mockResolvedValue({ settings: { enforceDepartmentScope: enabled } });
}

beforeEach(() => {
  vi.clearAllMocks();
  setDepartmentScopeFlag(true);
  mockClasses.find.mockReturnValue(findChain([{ _id: CLASS_A }, { _id: CLASS_B }]));
});

describe('department scope', () => {
  it('narrows to the departments classes when the tenant opted in', async () => {
    const ids = await getScopedClassIds(
      reqWith({
        type: 'department',
        branchIds: [BRANCH_ID],
        departmentIds: [CSE_DEPT_ID.toString()],
      })
    );

    expect(ids?.map((id) => id.toString())).toEqual([CLASS_A.toString(), CLASS_B.toString()]);
    const filter = mockClasses.find.mock.calls[0][0];
    expect(filter.departmentId).toEqual({ $in: [CSE_DEPT_ID] });
  });

  it('binds a named department grant whatever the tenant flag says', async () => {
    setDepartmentScopeFlag(false);

    const ids = await getScopedClassIds(
      reqWith({
        type: 'department',
        branchIds: [BRANCH_ID],
        departmentIds: [CSE_DEPT_ID.toString()],
      })
    );

    // An HOD must see their department even on tenants that never set the flag.
    expect(ids).not.toBeNull();
    expect(mockClasses.find).toHaveBeenCalled();
  });

  it('is unrestricted for scope types that carry no narrowing', async () => {
    expect(await getScopedClassIds(reqWith({ type: 'branch', branchIds: [BRANCH_ID] }))).toBeNull();
    expect(await getScopedClassIds(reqWith({ type: 'global', branchIds: [] }))).toBeNull();
  });
});

describe('program scope', () => {
  it('narrows by Class.programId without needing the tenant flag', async () => {
    setDepartmentScopeFlag(false);

    const ids = await getScopedClassIds(
      reqWith({ type: 'program', branchIds: [BRANCH_ID], programIds: [AIML_PROGRAM_ID.toString()] })
    );

    expect(ids).toHaveLength(2);
    const filter = mockClasses.find.mock.calls[0][0];
    expect(filter.programId).toEqual({ $in: [AIML_PROGRAM_ID] });
  });

  it("resolves the programs' departments for department-keyed collections", async () => {
    mockPrograms.find.mockReturnValue(findChain([{ departmentId: CSE_DEPT_ID }]));

    const ids = await getScopedDepartmentIds(
      reqWith({ type: 'program', branchIds: [BRANCH_ID], programIds: [AIML_PROGRAM_ID.toString()] })
    );

    expect(ids?.map((id) => id.toString())).toEqual([CSE_DEPT_ID.toString()]);
  });

  it('grants nothing — not everything — when the grant lists no programs', async () => {
    // Fails closed. Returning null here would mean "unrestricted", handing a
    // misconfigured program account the whole branch.
    expect(
      await getScopedClassIds(reqWith({ type: 'program', branchIds: [BRANCH_ID], programIds: [] }))
    ).toEqual([]);
    expect(
      await getScopedDepartmentIds(
        reqWith({ type: 'program', branchIds: [BRANCH_ID], programIds: [] })
      )
    ).toEqual([]);
  });

  it('denies a section when the program grant is empty', async () => {
    await expect(
      assertSectionInScope(
        reqWith({ type: 'program', branchIds: [BRANCH_ID], programIds: [] }),
        new ObjectId().toString()
      )
    ).rejects.toMatchObject({ code: 'SECTION_ACCESS_DENIED' });
  });
});

describe('getScopedSectionIds', () => {
  it('maps scoped classes to their sections', async () => {
    const sectionId = new ObjectId();
    mockSections.find.mockReturnValue(findChain([{ _id: sectionId }]));

    const ids = await getScopedSectionIds(
      reqWith({ type: 'program', branchIds: [BRANCH_ID], programIds: [AIML_PROGRAM_ID.toString()] })
    );

    expect(ids?.map((id) => id.toString())).toEqual([sectionId.toString()]);
  });

  it('short-circuits to an empty grant when no class is in scope', async () => {
    mockClasses.find.mockReturnValue(findChain([]));

    const ids = await getScopedSectionIds(
      reqWith({ type: 'program', branchIds: [BRANCH_ID], programIds: [AIML_PROGRAM_ID.toString()] })
    );

    expect(ids).toEqual([]);
    expect(mockSections.find).not.toHaveBeenCalled();
  });
});

describe('intersectScope', () => {
  it('passes the explicit id through when unrestricted', () => {
    expect(intersectScope(null, CLASS_A.toString())).toEqual(CLASS_A);
    expect(intersectScope(null, undefined)).toBeUndefined();
  });

  it('restricts to the grant when no explicit id was given', () => {
    expect(intersectScope([CLASS_A], undefined)).toEqual({ $in: [CLASS_A] });
  });

  it('keeps an in-scope explicit id', () => {
    expect(intersectScope([CLASS_A, CLASS_B], CLASS_B.toString())).toEqual(CLASS_B);
  });

  it('yields an impossible match for an out-of-scope explicit id', () => {
    // The bug this prevents: falling back to the unfiltered branch query and
    // handing a department-scoped user another department's rows.
    expect(intersectScope([CLASS_A], CLASS_B.toString())).toEqual({ $in: [] });
  });
});

describe('assertSectionInScope', () => {
  const SECTION_ID = new ObjectId();

  it('allows a section whose class is in the department grant', async () => {
    mockSections.findOne.mockResolvedValue({ _id: SECTION_ID, classId: CLASS_A });
    mockClasses.findOne.mockResolvedValue({ _id: CLASS_A, departmentId: CSE_DEPT_ID });

    await expect(
      assertSectionInScope(
        reqWith({
          type: 'department',
          branchIds: [BRANCH_ID],
          departmentIds: [CSE_DEPT_ID.toString()],
        }),
        SECTION_ID.toString()
      )
    ).resolves.toBeUndefined();
  });

  it("rejects another department's section even for an admin-level caller", async () => {
    mockSections.findOne.mockResolvedValue({ _id: SECTION_ID, classId: CLASS_B });
    mockClasses.findOne.mockResolvedValue({ _id: CLASS_B, departmentId: new ObjectId() });

    await expect(
      assertSectionInScope(
        reqWith({
          type: 'department',
          branchIds: [BRANCH_ID],
          departmentIds: [CSE_DEPT_ID.toString()],
        }),
        SECTION_ID.toString()
      )
    ).rejects.toMatchObject({ code: 'SECTION_ACCESS_DENIED' });
  });

  it('rejects a section whose class has no department FK', async () => {
    // Unresolved FK can't be proven to be theirs — same rule the list filters use.
    mockSections.findOne.mockResolvedValue({ _id: SECTION_ID, classId: CLASS_A });
    mockClasses.findOne.mockResolvedValue({ _id: CLASS_A });

    await expect(
      assertSectionInScope(
        reqWith({
          type: 'department',
          branchIds: [BRANCH_ID],
          departmentIds: [CSE_DEPT_ID.toString()],
        }),
        SECTION_ID.toString()
      )
    ).rejects.toMatchObject({ code: 'SECTION_ACCESS_DENIED' });
  });

  it('does nothing for branch-scoped callers', async () => {
    await expect(
      assertSectionInScope(
        reqWith({ type: 'branch', branchIds: [BRANCH_ID] }),
        SECTION_ID.toString()
      )
    ).resolves.toBeUndefined();
    expect(mockSections.findOne).not.toHaveBeenCalled();
  });
});

describe('institution scope', () => {
  const ENGG = new ObjectId();
  const ARCH_DEPT = new ObjectId();

  it("narrows to the institution's departments, without the tenant flag", async () => {
    setDepartmentScopeFlag(false);
    mockDepartments.find.mockReturnValue(findChain([{ _id: CSE_DEPT_ID }]));
    const ids = await getScopedClassIds(
      reqWith({ type: 'institution', branchIds: [BRANCH_ID], institutionIds: [ENGG.toString()] })
    );
    expect(ids).toHaveLength(2);
    // The institution's own departments, or campus-wide shared ones…
    expect(mockDepartments.find.mock.calls[0][0].$or[0].institutionId).toEqual({ $in: [ENGG] });
    // …and classes of those departments, or of programs the institution runs directly.
    expect(mockClasses.find.mock.calls[0][0].$or[0].departmentId).toEqual({ $in: [CSE_DEPT_ID] });

    const depts = await getScopedDepartmentIds(
      reqWith({ type: 'institution', branchIds: [BRANCH_ID], institutionIds: [ENGG.toString()] })
    );
    expect(depts?.map(String)).toEqual([CSE_DEPT_ID.toString()]);
  });

  it('grants nothing when the grant lists no institutions', async () => {
    const ids = await getScopedClassIds(
      reqWith({ type: 'institution', branchIds: [BRANCH_ID], institutionIds: [] })
    );
    expect(ids).toEqual([]);
    expect(mockClasses.find).not.toHaveBeenCalled();
  });

  it("denies a section that belongs to another institution's department", async () => {
    mockDepartments.find.mockReturnValue(findChain([{ _id: CSE_DEPT_ID }]));
    mockSections.findOne.mockResolvedValue({ classId: CLASS_A });
    mockClasses.findOne.mockResolvedValue({ departmentId: ARCH_DEPT });
    await expect(
      assertSectionInScope(
        reqWith({ type: 'institution', branchIds: [BRANCH_ID], institutionIds: [ENGG.toString()] }),
        new ObjectId().toString()
      )
    ).rejects.toMatchObject({ code: 'SECTION_ACCESS_DENIED' });

    mockClasses.findOne.mockResolvedValue({ departmentId: CSE_DEPT_ID });
    await expect(
      assertSectionInScope(
        reqWith({ type: 'institution', branchIds: [BRANCH_ID], institutionIds: [ENGG.toString()] }),
        new ObjectId().toString()
      )
    ).resolves.toBeUndefined();
  });
});

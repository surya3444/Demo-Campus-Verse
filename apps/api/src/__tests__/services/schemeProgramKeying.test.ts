import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
import { createMockCollection } from '../helpers/setup';

/**
 * Program-keyed curricula: a department that runs CSE, CSE (AI & ML) and
 * CSE (Data Science) authors one scheme per program, and a student registers
 * under their own program's scheme — never a sibling program's, and never a
 * department-wide scheme when their program has one.
 *
 * Also covers the Phase-5 deferral this closed: Global/Core/Shared enforcement
 * when authoring a scheme (a department can't put another department's core
 * subject in its curriculum).
 */

const TENANT_ID = new ObjectId().toString();
const BRANCH_ID = new ObjectId().toString();
const CSE_DEPT_ID = new ObjectId();
const EEE_DEPT_ID = new ObjectId();
const AIML_PROGRAM_ID = new ObjectId();

const mockProgramSchemes = createMockCollection();
const mockPrograms = createMockCollection();
const mockSubjects = createMockCollection();
const mockDepartments = createMockCollection();
const mockCourseRegistrations = createMockCollection();
const mockClasses = createMockCollection();
const mockSections = createMockCollection();

vi.mock('@/config/database', () => ({
  collections: {
    get programSchemes() {
      return mockProgramSchemes;
    },
    get programs() {
      return mockPrograms;
    },
    get subjects() {
      return mockSubjects;
    },
    get departments() {
      return mockDepartments;
    },
    get courseRegistrations() {
      return mockCourseRegistrations;
    },
    get classes() {
      return mockClasses;
    },
    get sections() {
      return mockSections;
    },
  },
  getDb: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/modules/hr/department.service', () => ({
  resolveDepartmentIdByCode: vi.fn(async (_t: string, _b: string, code: string) =>
    code.toUpperCase() === 'CSE' ? CSE_DEPT_ID : null
  ),
}));

import { schemeService } from '@/modules/registration/scheme.service';

const OS_SUBJECT = {
  _id: new ObjectId(),
  code: 'CS301',
  name: 'Operating Systems',
  sharing: 'core',
  ownerDepartmentId: CSE_DEPT_ID,
};

/** EEE's core — never usable by CSE. */
const EEE_MACHINES = {
  _id: new ObjectId(),
  code: 'EE301',
  name: 'Electrical Machines',
  sharing: 'core',
  ownerDepartmentId: EEE_DEPT_ID,
};

function coreSlot(subjectId: ObjectId) {
  return { kind: 'core' as const, subjectId: subjectId.toString(), credits: 4 };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockProgramSchemes.findOne.mockResolvedValue(null);
  mockSubjects.countDocuments.mockResolvedValue(1);
  mockPrograms.findOne.mockResolvedValue({
    _id: AIML_PROGRAM_ID,
    name: 'B.Tech CSE (AI & ML)',
    departmentId: CSE_DEPT_ID,
  });
  mockSubjects.find.mockReturnValue({
    project: vi.fn().mockReturnThis(),
    toArray: vi.fn().mockResolvedValue([OS_SUBJECT]),
  });
});

describe('scheme authoring — program link', () => {
  it('stamps programId + programName from the curriculum program', async () => {
    await schemeService.create(TENANT_ID, BRANCH_ID, {
      departmentCode: 'CSE',
      departmentName: 'Computer Science',
      programId: AIML_PROGRAM_ID.toString(),
      semesterNumber: 3,
      slots: [coreSlot(OS_SUBJECT._id)],
      minCredits: 16,
      maxCredits: 28,
    });

    const doc = mockProgramSchemes.insertOne.mock.calls[0][0];
    expect(doc.programId.toString()).toBe(AIML_PROGRAM_ID.toString());
    expect(doc.programName).toBe('B.Tech CSE (AI & ML)');
    expect(doc.departmentId.toString()).toBe(CSE_DEPT_ID.toString());
  });

  it('rejects a program that belongs to another department', async () => {
    mockPrograms.findOne.mockResolvedValue({
      _id: AIML_PROGRAM_ID,
      name: 'B.Tech EEE',
      departmentId: EEE_DEPT_ID,
    });

    await expect(
      schemeService.create(TENANT_ID, BRANCH_ID, {
        departmentCode: 'CSE',
        departmentName: 'Computer Science',
        programId: AIML_PROGRAM_ID.toString(),
        semesterNumber: 3,
        slots: [coreSlot(OS_SUBJECT._id)],
        minCredits: 16,
        maxCredits: 28,
      })
    ).rejects.toMatchObject({ code: 'PROGRAM_DEPARTMENT_MISMATCH' });
  });

  it('scopes the duplicate check to the program, so two programs can both have Sem 3', async () => {
    await schemeService.create(TENANT_ID, BRANCH_ID, {
      departmentCode: 'CSE',
      departmentName: 'Computer Science',
      programId: AIML_PROGRAM_ID.toString(),
      semesterNumber: 3,
      slots: [coreSlot(OS_SUBJECT._id)],
      minCredits: 16,
      maxCredits: 28,
    });

    const filter = mockProgramSchemes.findOne.mock.calls[0][0];
    expect(filter.programId.toString()).toBe(AIML_PROGRAM_ID.toString());
  });

  it('matches only program-less schemes when no program is named', async () => {
    await schemeService.create(TENANT_ID, BRANCH_ID, {
      departmentCode: 'CSE',
      departmentName: 'Computer Science',
      semesterNumber: 3,
      slots: [coreSlot(OS_SUBJECT._id)],
      minCredits: 16,
      maxCredits: 28,
    });

    const filter = mockProgramSchemes.findOne.mock.calls[0][0];
    expect(filter.programId).toEqual({ $in: [null, undefined] });
  });
});

describe('scheme authoring — subject sharing enforcement', () => {
  it("rejects another department's core subject", async () => {
    mockSubjects.find.mockReturnValue({
      project: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([EEE_MACHINES]),
    });

    await expect(
      schemeService.create(TENANT_ID, BRANCH_ID, {
        departmentCode: 'CSE',
        departmentName: 'Computer Science',
        semesterNumber: 3,
        slots: [coreSlot(EEE_MACHINES._id)],
        minCredits: 16,
        maxCredits: 28,
      })
    ).rejects.toMatchObject({ code: 'SUBJECT_NOT_OFFERED' });
  });

  it('accepts a subject the owning department shared to this one', async () => {
    mockSubjects.find.mockReturnValue({
      project: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([
        {
          ...EEE_MACHINES,
          sharing: 'shared',
          offeredToDepartmentIds: [CSE_DEPT_ID],
        },
      ]),
    });

    await expect(
      schemeService.create(TENANT_ID, BRANCH_ID, {
        departmentCode: 'CSE',
        departmentName: 'Computer Science',
        semesterNumber: 3,
        slots: [coreSlot(EEE_MACHINES._id)],
        minCredits: 16,
        maxCredits: 28,
      })
    ).resolves.toBeTruthy();
  });

  it('skips enforcement when the department FK is unresolved (legacy schemes)', async () => {
    mockSubjects.find.mockReturnValue({
      project: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([EEE_MACHINES]),
    });

    // "MECH" resolves to no department in the mock above.
    await expect(
      schemeService.create(TENANT_ID, BRANCH_ID, {
        departmentCode: 'MECH',
        departmentName: 'Mechanical',
        semesterNumber: 3,
        slots: [coreSlot(EEE_MACHINES._id)],
        minCredits: 16,
        maxCredits: 28,
      })
    ).resolves.toBeTruthy();
  });
});

describe('findPublished — most specific match wins', () => {
  it("returns the student's program scheme ahead of the department one", async () => {
    const programScheme = { _id: new ObjectId(), programId: AIML_PROGRAM_ID };
    mockProgramSchemes.findOne.mockResolvedValueOnce(programScheme);

    const found = await schemeService.findPublished(
      TENANT_ID,
      BRANCH_ID,
      'CSE',
      3,
      [],
      AIML_PROGRAM_ID.toString()
    );

    expect(found).toBe(programScheme);
    expect(mockProgramSchemes.findOne).toHaveBeenCalledTimes(1);
  });

  it('falls back to the department-wide scheme when the program has none', async () => {
    const deptScheme = { _id: new ObjectId(), departmentCode: 'CSE' };
    mockProgramSchemes.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(deptScheme);

    const found = await schemeService.findPublished(
      TENANT_ID,
      BRANCH_ID,
      'CSE',
      3,
      [],
      AIML_PROGRAM_ID.toString()
    );

    expect(found).toBe(deptScheme);
    const fallbackFilter = mockProgramSchemes.findOne.mock.calls[1][0];
    // Never fall back onto another program's curriculum.
    expect(fallbackFilter.programId).toEqual({ $in: [null, undefined] });
  });

  it('never returns a program-keyed scheme to a student with no program', async () => {
    mockProgramSchemes.findOne.mockResolvedValueOnce(null);

    await schemeService.findPublished(TENANT_ID, BRANCH_ID, 'CSE', 3, ['CS']);

    expect(mockProgramSchemes.findOne).toHaveBeenCalledTimes(1);
    const filter = mockProgramSchemes.findOne.mock.calls[0][0];
    expect(filter.programId).toEqual({ $in: [null, undefined] });
    expect(filter.departmentCode).toEqual({ $in: ['CSE', 'CS'] });
  });
});

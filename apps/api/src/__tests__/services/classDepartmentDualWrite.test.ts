import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
import { createMockCollection } from '../helpers/setup';
import { matchDepartmentForPathTop } from '@campus-verse/shared/utils';

const TENANT_ID = new ObjectId().toString();
const BRANCH_ID = new ObjectId().toString();
const CSE_DEPT_ID = new ObjectId();

const mockClasses = createMockCollection();
const mockDepartments = createMockCollection();
const mockBranches = createMockCollection();
const mockTenants = createMockCollection();
const mockAcademicBatches = createMockCollection();
const mockPrograms = createMockCollection();
const mockSections = createMockCollection();
const mockStudents = createMockCollection();

vi.mock('@/config/database', () => ({
  collections: {
    get classes() {
      return mockClasses;
    },
    get departments() {
      return mockDepartments;
    },
    get branches() {
      return mockBranches;
    },
    get tenants() {
      return mockTenants;
    },
    get academicBatches() {
      return mockAcademicBatches;
    },
    get programs() {
      return mockPrograms;
    },
    get sections() {
      return mockSections;
    },
    get students() {
      return mockStudents;
    },
  },
  getDb: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  classService,
  resolveDepartmentIdForPath,
  yearNumberFromPath,
} from '@/modules/organization/class.service';

function findChain(docs: unknown[]) {
  return {
    project: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    toArray: vi.fn().mockResolvedValue(docs),
  };
}

const CSE_DEPT = { _id: CSE_DEPT_ID, code: 'CSE', name: 'Computer Science & Engineering' };

// University branch hierarchy: department → year, section leaf.
const UNI_HIERARCHY = {
  levels: [
    { key: 'department', label: 'Department', labelPlural: 'Departments', isLeaf: false, order: 1 },
    { key: 'year', label: 'Year', labelPlural: 'Years', isLeaf: false, order: 2 },
    { key: 'section', label: 'Section', labelPlural: 'Sections', isLeaf: true, order: 3 },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('matchDepartmentForPathTop (shared convention)', () => {
  const departments = [CSE_DEPT, { _id: new ObjectId(), code: 'ME', name: 'Mechanical' }];

  it('matches by code, case-insensitively', () => {
    expect(matchDepartmentForPathTop({ code: 'cse', name: 'anything' }, departments)).toBe(
      CSE_DEPT
    );
  });

  it('matches by name when the code differs', () => {
    expect(
      matchDepartmentForPathTop({ code: 'CS', name: 'computer science & engineering' }, departments)
    ).toBe(CSE_DEPT);
  });

  it('returns null with no match, an empty top, or no departments', () => {
    expect(matchDepartmentForPathTop({ code: 'EEE', name: 'Electrical' }, departments)).toBeNull();
    expect(matchDepartmentForPathTop(undefined, departments)).toBeNull();
    expect(matchDepartmentForPathTop({ code: '', name: '  ' }, departments)).toBeNull();
    expect(matchDepartmentForPathTop({ code: 'CSE' }, [])).toBeNull();
  });
});

describe('resolveDepartmentIdForPath', () => {
  it('resolves the FK from path[0] against the branch registry', async () => {
    mockDepartments.find.mockReturnValue(findChain([CSE_DEPT]));

    const id = await resolveDepartmentIdForPath(TENANT_ID, BRANCH_ID, [
      { levelKey: 'department', name: 'Computer Science & Engineering', code: 'CSE' },
      { levelKey: 'year', name: 'Year 1', code: 'Y1' },
    ]);

    expect(id).toEqual(CSE_DEPT_ID);
  });

  it('returns null when the branch has no matching department (schools)', async () => {
    mockDepartments.find.mockReturnValue(findChain([]));

    const id = await resolveDepartmentIdForPath(TENANT_ID, BRANCH_ID, [
      { levelKey: 'grade', name: 'Grade 5', code: 'G5' },
    ]);

    expect(id).toBeNull();
  });
});

describe('classService.create dual-write', () => {
  function arrangeCreate() {
    mockAcademicBatches.findOne.mockResolvedValue({ _id: new ObjectId() });
    mockBranches.findOne.mockResolvedValue({
      institutionType: 'university',
      academicHierarchy: UNI_HIERARCHY,
    });
    mockClasses.findOne.mockResolvedValue(null); // no duplicate
  }

  it('stamps departmentId when path[0] matches a department', async () => {
    arrangeCreate();
    mockDepartments.find.mockReturnValue(findChain([CSE_DEPT]));

    const created = await classService.create(TENANT_ID, BRANCH_ID, {
      academicBatchId: new ObjectId().toString(),
      path: [
        { levelKey: 'department', name: 'Computer Science & Engineering', code: 'CSE' },
        { levelKey: 'year', name: 'Year 1', code: 'Y1' },
      ],
    });

    expect(created.departmentId).toBe(CSE_DEPT_ID.toString());
    const inserted = mockClasses.insertOne.mock.calls[0][0];
    expect(inserted.departmentId).toEqual(CSE_DEPT_ID);
    // path stays authoritative for display
    expect(inserted.displayName).toBe('Computer Science & Engineering · Year 1');
  });

  it('stores null (not a guess) when nothing matches', async () => {
    arrangeCreate();
    mockDepartments.find.mockReturnValue(findChain([CSE_DEPT]));

    const created = await classService.create(TENANT_ID, BRANCH_ID, {
      academicBatchId: new ObjectId().toString(),
      path: [
        { levelKey: 'department', name: 'Electrical Engineering', code: 'EEE' },
        { levelKey: 'year', name: 'Year 1', code: 'Y1' },
      ],
    });

    expect(created.departmentId).toBeUndefined(); // null serialises to undefined via ?.toString()
    expect(mockClasses.insertOne.mock.calls[0][0].departmentId).toBeNull();
  });

  it('validates programId when provided and stores the FK', async () => {
    arrangeCreate();
    mockDepartments.find.mockReturnValue(findChain([CSE_DEPT]));
    const programId = new ObjectId();
    mockPrograms.findOne.mockResolvedValue({ _id: programId });

    const created = await classService.create(TENANT_ID, BRANCH_ID, {
      academicBatchId: new ObjectId().toString(),
      path: [
        { levelKey: 'department', name: 'Computer Science & Engineering', code: 'CSE' },
        { levelKey: 'year', name: 'Year 1', code: 'Y1' },
      ],
      programId: programId.toString(),
    });

    expect(created.programId).toBe(programId.toString());
  });

  it('rejects an unknown programId', async () => {
    arrangeCreate();
    mockDepartments.find.mockReturnValue(findChain([CSE_DEPT]));
    mockPrograms.findOne.mockResolvedValue(null);

    await expect(
      classService.create(TENANT_ID, BRANCH_ID, {
        academicBatchId: new ObjectId().toString(),
        path: [
          { levelKey: 'department', name: 'Computer Science & Engineering', code: 'CSE' },
          { levelKey: 'year', name: 'Year 1', code: 'Y1' },
        ],
        programId: new ObjectId().toString(),
      })
    ).rejects.toMatchObject({ code: 'PROGRAM_NOT_FOUND' });
  });
});

describe('classService.update dual-write', () => {
  it('recomputes departmentId when the path changes', async () => {
    const classId = new ObjectId();
    const existing = {
      _id: classId,
      tenantId: new ObjectId(TENANT_ID),
      branchId: new ObjectId(BRANCH_ID),
      academicBatchId: new ObjectId(),
      path: [{ levelKey: 'department', name: 'Mechanical', code: 'ME' }],
      displayName: 'Mechanical',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    // update() reads the class twice: the existence check, then findById after write.
    mockClasses.findOne.mockResolvedValue(existing);
    mockBranches.findOne.mockResolvedValue({
      institutionType: 'university',
      academicHierarchy: UNI_HIERARCHY,
    });
    mockDepartments.find.mockReturnValue(findChain([CSE_DEPT]));

    await classService.update(TENANT_ID, classId.toString(), {
      path: [
        { levelKey: 'department', name: 'Computer Science & Engineering', code: 'CSE' },
        { levelKey: 'year', name: 'Year 2', code: 'Y2' },
      ],
    });

    const setArg = mockClasses.updateOne.mock.calls[0][1].$set;
    expect(setArg.departmentId).toEqual(CSE_DEPT_ID);
  });
});

describe('yearNumberFromPath', () => {
  it('reads the year off whichever entry is the year level', () => {
    expect(
      yearNumberFromPath([
        { levelKey: 'department', name: 'CSE', code: 'CSE' },
        { levelKey: 'year', name: 'Year 3', code: 'Y3' },
      ])
    ).toBe(3);
    expect(yearNumberFromPath([{ levelKey: 'year', name: '2nd Year', code: 'Y2' }])).toBe(2);
  });

  it('is null when there is no year level or no digits to read', () => {
    expect(yearNumberFromPath([{ levelKey: 'grade', name: 'Grade 5', code: 'G5' }])).toBeNull();
    expect(yearNumberFromPath([{ levelKey: 'year', name: 'Final Year', code: 'FY' }])).toBeNull();
  });
});

describe('classService program consistency', () => {
  const PROGRAM_ID = new ObjectId();

  function arrangeCreate() {
    mockAcademicBatches.findOne.mockResolvedValue({ _id: new ObjectId() });
    mockBranches.findOne.mockResolvedValue({
      institutionType: 'university',
      academicHierarchy: UNI_HIERARCHY,
    });
    mockClasses.findOne.mockResolvedValue(null);
    mockDepartments.find.mockReturnValue(findChain([CSE_DEPT]));
  }

  const csePath = (year: string) => [
    { levelKey: 'department', name: 'Computer Science & Engineering', code: 'CSE' },
    { levelKey: 'year', name: year, code: 'Y' },
  ];

  it('accepts a year inside the program duration', async () => {
    arrangeCreate();
    mockPrograms.findOne.mockResolvedValue({
      _id: PROGRAM_ID,
      name: 'B.Tech CSE',
      departmentId: CSE_DEPT_ID,
      durationYears: 4,
      status: 'active',
    });

    const created = await classService.create(TENANT_ID, BRANCH_ID, {
      academicBatchId: new ObjectId().toString(),
      path: csePath('Year 4'),
      programId: PROGRAM_ID.toString(),
    });

    expect(created.programId).toBe(PROGRAM_ID.toString());
  });

  it('rejects a year the program does not run to', async () => {
    arrangeCreate();
    mockPrograms.findOne.mockResolvedValue({
      _id: PROGRAM_ID,
      name: 'B.Tech CSE',
      departmentId: CSE_DEPT_ID,
      durationYears: 4,
      status: 'active',
    });

    await expect(
      classService.create(TENANT_ID, BRANCH_ID, {
        academicBatchId: new ObjectId().toString(),
        path: csePath('Year 5'),
        programId: PROGRAM_ID.toString(),
      })
    ).rejects.toMatchObject({ code: 'PROGRAM_YEAR_OUT_OF_RANGE' });
  });

  it("rejects a program from another department than the class's", async () => {
    arrangeCreate();
    mockPrograms.findOne.mockResolvedValue({
      _id: PROGRAM_ID,
      name: 'B.Arch',
      departmentId: new ObjectId(), // Architecture, not CSE
      durationYears: 5,
      status: 'active',
    });

    await expect(
      classService.create(TENANT_ID, BRANCH_ID, {
        academicBatchId: new ObjectId().toString(),
        path: csePath('Year 1'),
        programId: PROGRAM_ID.toString(),
      })
    ).rejects.toMatchObject({ code: 'PROGRAM_DEPARTMENT_MISMATCH' });
  });

  it('rejects an archived program', async () => {
    arrangeCreate();
    mockPrograms.findOne.mockResolvedValue({
      _id: PROGRAM_ID,
      name: 'B.Tech CSE (retired)',
      departmentId: CSE_DEPT_ID,
      durationYears: 4,
      status: 'archived',
    });

    await expect(
      classService.create(TENANT_ID, BRANCH_ID, {
        academicBatchId: new ObjectId().toString(),
        path: csePath('Year 1'),
        programId: PROGRAM_ID.toString(),
      })
    ).rejects.toMatchObject({ code: 'PROGRAM_ARCHIVED' });
  });

  it('scopes the program lookup to the class branch', async () => {
    arrangeCreate();
    mockPrograms.findOne.mockResolvedValue(null); // exists on another campus

    await expect(
      classService.create(TENANT_ID, BRANCH_ID, {
        academicBatchId: new ObjectId().toString(),
        path: csePath('Year 1'),
        programId: PROGRAM_ID.toString(),
      })
    ).rejects.toMatchObject({ code: 'PROGRAM_NOT_FOUND' });
    expect(mockPrograms.findOne.mock.calls[0][0].branchId).toEqual(new ObjectId(BRANCH_ID));
  });

  it('re-checks the kept program when only the path moves', async () => {
    const classId = new ObjectId();
    mockClasses.findOne.mockResolvedValue({
      _id: classId,
      tenantId: new ObjectId(TENANT_ID),
      branchId: new ObjectId(BRANCH_ID),
      academicBatchId: new ObjectId(),
      path: csePath('Year 2'),
      displayName: 'CSE · Year 2',
      departmentId: CSE_DEPT_ID,
      programId: PROGRAM_ID,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockBranches.findOne.mockResolvedValue({
      institutionType: 'university',
      academicHierarchy: UNI_HIERARCHY,
    });
    mockDepartments.find.mockReturnValue(findChain([CSE_DEPT]));
    mockPrograms.findOne.mockResolvedValue({
      _id: PROGRAM_ID,
      name: 'B.Tech CSE',
      departmentId: CSE_DEPT_ID,
      durationYears: 4,
      status: 'active',
    });

    await expect(
      classService.update(TENANT_ID, classId.toString(), { path: csePath('Year 6') })
    ).rejects.toMatchObject({ code: 'PROGRAM_YEAR_OUT_OF_RANGE' });
  });
});

describe('classService.copyStructure — start a new academic year', () => {
  const FROM = new ObjectId().toString();
  const TO = new ObjectId().toString();
  const teacherId = new ObjectId();

  it('copies classes and their sections (subjects + teachers), skipping years already there', async () => {
    const y1 = {
      _id: new ObjectId(),
      path: [
        { levelKey: 'department', name: 'CSE', code: 'CSE' },
        { levelKey: 'year', name: 'Year 1', code: 'Y1' },
      ],
      displayName: 'CSE · Year 1',
      programId: null,
      departmentId: CSE_DEPT_ID,
    };
    const y2 = {
      _id: new ObjectId(),
      path: [
        { levelKey: 'department', name: 'CSE', code: 'CSE' },
        { levelKey: 'year', name: 'Year 2', code: 'Y2' },
      ],
      displayName: 'CSE · Year 2',
      programId: null,
      departmentId: CSE_DEPT_ID,
    };
    mockAcademicBatches.find.mockReturnValueOnce(
      findChain([{ _id: new ObjectId(FROM) }, { _id: new ObjectId(TO) }])
    );
    mockClasses.find
      .mockReturnValueOnce(findChain([y1, y2])) // source year
      .mockReturnValueOnce(findChain([{ displayName: 'CSE · Year 2' }])); // already in target
    mockSections.find.mockReturnValueOnce(
      findChain([
        {
          name: 'A',
          code: 'A',
          subjects: [{ subjectId: new ObjectId(), periodsPerWeek: 4, teacherId }],
        },
      ])
    );

    const result = await classService.copyStructure(TENANT_ID, BRANCH_ID, FROM, TO);

    expect(result).toEqual({ classesCreated: 1, classesSkipped: 1, sectionsCreated: 1 });
    const inserted = mockClasses.insertOne.mock.calls[0][0];
    expect(inserted.academicBatchId.toString()).toBe(TO);
    expect(inserted.displayName).toBe('CSE · Year 1');
    const [section] = mockSections.insertMany.mock.calls[0][0];
    expect(section.classId).toEqual(inserted._id);
    expect(section.subjects[0].teacherId).toEqual(teacherId);
  });

  it('refuses to copy a year onto itself', async () => {
    await expect(
      classService.copyStructure(TENANT_ID, BRANCH_ID, FROM, FROM)
    ).rejects.toMatchObject({
      code: 'SAME_BATCH',
    });
  });
});

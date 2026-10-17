import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
import { createMockCollection } from '../helpers/setup';
import { isSubjectUsableByDepartment } from '@campus-verse/shared/utils';

const TENANT_ID = new ObjectId().toString();
const EEE = new ObjectId(); // owner department
const MECH = new ObjectId(); // offered-to department
const CSE = new ObjectId(); // unrelated department

const mockSections = createMockCollection();
const mockClasses = createMockCollection();
const mockStaff = createMockCollection();
const mockSubjects = createMockCollection();
const mockTeachingAssignments = createMockCollection();

vi.mock('@/config/database', () => ({
  collections: {
    get sections() {
      return mockSections;
    },
    get classes() {
      return mockClasses;
    },
    get staff() {
      return mockStaff;
    },
    get subjects() {
      return mockSubjects;
    },
    get teachingAssignments() {
      return mockTeachingAssignments;
    },
  },
  getDb: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { teachingAssignmentService } from '@/modules/teaching/teachingAssignment.service';
import { departmentsWithAccess } from '@/modules/organization/subject.service';

describe('isSubjectUsableByDepartment — the Global/Core/Shared rule', () => {
  const bee = {
    sharing: 'shared',
    ownerDepartmentId: EEE,
    offeredToDepartmentIds: [MECH],
  };
  const os = { sharing: 'core', ownerDepartmentId: CSE.toString() };
  const maths = { sharing: 'global', ownerDepartmentId: EEE };
  const legacy = {}; // pre-migration subject: no sharing, no owner

  it('global subjects are usable everywhere', () => {
    expect(isSubjectUsableByDepartment(maths, CSE.toString())).toBe(true);
    expect(isSubjectUsableByDepartment(maths, MECH.toString())).toBe(true);
  });

  it('core subjects are usable by the owner only', () => {
    expect(isSubjectUsableByDepartment(os, CSE.toString())).toBe(true);
    expect(isSubjectUsableByDepartment(os, MECH.toString())).toBe(false);
  });

  it('shared subjects: owner + offeredTo, nobody else (the EEE→Mech BEE case)', () => {
    expect(isSubjectUsableByDepartment(bee, EEE.toString())).toBe(true);
    expect(isSubjectUsableByDepartment(bee, MECH.toString())).toBe(true);
    expect(isSubjectUsableByDepartment(bee, CSE.toString())).toBe(false);
  });

  it('no department context (schools) or legacy unowned subjects are unrestricted', () => {
    expect(isSubjectUsableByDepartment(bee, null)).toBe(true);
    expect(isSubjectUsableByDepartment(bee, undefined)).toBe(true);
    expect(isSubjectUsableByDepartment(legacy, CSE.toString())).toBe(true);
  });
});

describe('teachingAssignmentService.create — cross-department validation', () => {
  const sectionId = new ObjectId();
  const classId = new ObjectId();
  const branchId = new ObjectId();
  const staffId = new ObjectId();
  const subjectId = new ObjectId();

  function arrange(subject: Record<string, unknown>, classDepartmentId: ObjectId | undefined) {
    mockSections.findOne.mockResolvedValue({
      _id: sectionId,
      branchId,
      classId,
    });
    mockClasses.findOne.mockResolvedValue({
      _id: classId,
      academicBatchId: new ObjectId(),
      departmentId: classDepartmentId,
    });
    mockStaff.findOne.mockResolvedValue({ _id: staffId });
    mockSubjects.findOne.mockResolvedValue({ _id: subjectId, ...subject });
    mockTeachingAssignments.findOne.mockResolvedValue(null); // no duplicate
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows an EEE teacher on a Mechanical section when the subject is shared with Mechanical', async () => {
    arrange({ sharing: 'shared', ownerDepartmentId: EEE, offeredToDepartmentIds: [MECH] }, MECH);

    const assignment = await teachingAssignmentService.create(TENANT_ID, {
      staffId: staffId.toString(),
      subjectId: subjectId.toString(),
      sectionId: sectionId.toString(),
      role: 'primary',
    });

    expect(assignment.status).toBe('active');
    expect(assignment.branchId).toBe(branchId.toString());
    expect(mockTeachingAssignments.insertOne).toHaveBeenCalledTimes(1);
  });

  it("rejects a subject not offered to the section's department", async () => {
    arrange({ sharing: 'shared', ownerDepartmentId: EEE, offeredToDepartmentIds: [MECH] }, CSE);

    await expect(
      teachingAssignmentService.create(TENANT_ID, {
        staffId: staffId.toString(),
        subjectId: subjectId.toString(),
        sectionId: sectionId.toString(),
        role: 'primary',
      })
    ).rejects.toMatchObject({ code: 'SUBJECT_NOT_OFFERED' });
    expect(mockTeachingAssignments.insertOne).not.toHaveBeenCalled();
  });

  it('skips sharing validation when the class has no department (schools)', async () => {
    arrange({ sharing: 'core', ownerDepartmentId: CSE }, undefined);

    const assignment = await teachingAssignmentService.create(TENANT_ID, {
      staffId: staffId.toString(),
      subjectId: subjectId.toString(),
      sectionId: sectionId.toString(),
      role: 'primary',
    });

    expect(assignment.status).toBe('active');
  });

  it('rejects a duplicate active assignment for the same teacher/section/subject', async () => {
    arrange({ sharing: 'global' }, MECH);
    mockTeachingAssignments.findOne.mockResolvedValue({ _id: new ObjectId() });

    await expect(
      teachingAssignmentService.create(TENANT_ID, {
        staffId: staffId.toString(),
        subjectId: subjectId.toString(),
        sectionId: sectionId.toString(),
        role: 'primary',
      })
    ).rejects.toMatchObject({ code: 'DUPLICATE_ASSIGNMENT' });
  });
});

describe('departmentsWithAccess — who may use a subject', () => {
  const OWNER = new ObjectId();
  const OTHER = new ObjectId();
  it('global or ownerless → every department (null)', () => {
    expect(departmentsWithAccess({ sharing: 'global', ownerDepartmentId: OWNER })).toBeNull();
    expect(departmentsWithAccess({})).toBeNull();
  });
  it('department-only → just the owner', () => {
    expect([...departmentsWithAccess({ sharing: 'core', ownerDepartmentId: OWNER })!]).toEqual([
      String(OWNER),
    ]);
    expect([...departmentsWithAccess({ ownerDepartmentId: OWNER })!]).toEqual([String(OWNER)]);
  });
  it('shared → owner plus the departments it is offered to', () => {
    const ids = departmentsWithAccess({
      sharing: 'shared',
      ownerDepartmentId: OWNER,
      offeredToDepartmentIds: [OTHER],
    })!;
    expect(ids.has(String(OWNER)) && ids.has(String(OTHER))).toBe(true);
  });
});

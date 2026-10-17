import { ObjectId, Document, Filter } from 'mongodb';
import { collections } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler';
import { getElectiveRosterFilter } from '../registration/roster';
import { getStaffIdForUser } from '../teaching/teaching.utils';

export interface CohortStudent {
  studentId: ObjectId;
  name: string;
  admissionNumber?: string;
  rollNumber?: string;
  sectionId?: ObjectId;
}

/**
 * The cohort of an offering: every active student currently enrolled in one of
 * its sections — narrowed to registered students when the subject is an
 * elective (same rule the exams module applies for paper rosters).
 */
export async function resolveCohort(
  tenantId: string,
  branchId: string,
  offering: { subjectId: ObjectId; sectionIds: ObjectId[] }
): Promise<CohortStudent[]> {
  const rosterFilter: Filter<Document> = {
    tenantId: new ObjectId(tenantId),
    branchId: new ObjectId(branchId),
    'currentEnrollment.sectionId': { $in: offering.sectionIds },
    status: { $ne: 'inactive' },
  };
  const electiveRoster = await getElectiveRosterFilter(
    tenantId,
    branchId,
    offering.subjectId.toString()
  );
  if (electiveRoster !== null) {
    rosterFilter._id = { $in: electiveRoster };
  }

  const students = await collections.students
    .find(rosterFilter)
    .project({
      _id: 1,
      firstName: 1,
      lastName: 1,
      displayName: 1,
      admissionNumber: 1,
      rollNumber: 1,
      'currentEnrollment.sectionId': 1,
    })
    .sort({ rollNumber: 1, admissionNumber: 1 })
    .toArray();

  return students.map((s) => ({
    studentId: s._id as ObjectId,
    name:
      (s.displayName as string) || [s.firstName, s.lastName].filter(Boolean).join(' ') || 'Unknown',
    admissionNumber: s.admissionNumber as string | undefined,
    rollNumber: s.rollNumber as string | undefined,
    sectionId: (s.currentEnrollment as { sectionId?: ObjectId } | undefined)?.sectionId,
  }));
}

/**
 * Ownership gate for teacher-level users (roleLevel > 3): the offering must be
 * coordinated by them, or they must teach its subject in one of its sections.
 * Admin-level users (roleLevel <= 3) bypass — same idiom as the teaching module.
 */
export async function assertOfferingAccess(
  tenantId: string,
  branchId: string,
  user: { userId: string; roleLevel?: number },
  offering: { subjectId: ObjectId; sectionIds: ObjectId[]; coordinatorStaffId?: ObjectId }
): Promise<void> {
  if ((user.roleLevel ?? 99) <= 3) return;

  const staffId = await getStaffIdForUser(tenantId, user.userId);
  if (offering.coordinatorStaffId?.toString() === staffId) return;

  const staffOid = new ObjectId(staffId);
  const teaches = await collections.sections.findOne(
    {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      _id: { $in: offering.sectionIds },
      subjects: { $elemMatch: { subjectId: offering.subjectId, teacherId: staffOid } },
    },
    { projection: { _id: 1 } }
  );
  if (!teaches) {
    throw new ApiError('FORBIDDEN', 'You can only work on offerings you coordinate or teach', 403);
  }
}

/** Default course coordinator: first teacher assigned to this subject in the sections. */
export async function deriveCoordinator(
  tenantId: string,
  branchId: string,
  subjectId: ObjectId,
  sectionIds: ObjectId[]
): Promise<ObjectId | undefined> {
  const section = await collections.sections.findOne(
    {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      _id: { $in: sectionIds },
      subjects: { $elemMatch: { subjectId, teacherId: { $exists: true, $ne: null } } },
    },
    { projection: { subjects: 1 } }
  );
  if (!section) return undefined;
  const entry = (
    section.subjects as { subjectId: ObjectId; teacherId?: ObjectId }[] | undefined
  )?.find((s) => s.subjectId.equals(subjectId) && s.teacherId);
  return entry?.teacherId;
}

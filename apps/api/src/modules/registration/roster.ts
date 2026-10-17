import { ObjectId } from 'mongodb';
import { collections } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler';

/**
 * Elective roster resolution — the bridge between course registration and the
 * teaching/exams modules.
 *
 * For a CORE subject (or any subject outside a published scheme's elective
 * baskets) the roster is the whole section — unchanged behaviour. For an
 * ELECTIVE (a basket option in a published scheme), the roster is only the
 * students who actually registered for it.
 *
 * Returns:
 *   null          → subject is not an elective; use the full section roster
 *   ObjectId[]    → studentIds registered for this elective in the current
 *                   batch (possibly empty — an elective nobody picked has an
 *                   empty roster, not a full-section one)
 */
export async function getElectiveRosterFilter(
  tenantId: string,
  branchId: string,
  subjectId: string
): Promise<ObjectId[] | null> {
  const tenantOid = new ObjectId(tenantId);
  const branchOid = new ObjectId(branchId);
  const subjectOid = new ObjectId(subjectId);

  // Is this subject an elective anywhere? (basket option in a published scheme)
  const electiveScheme = await collections.programSchemes.findOne(
    {
      tenantId: tenantOid,
      branchId: branchOid,
      status: 'published',
      slots: { $elemMatch: { kind: 'basket', 'options.subjectId': subjectOid } },
    },
    { projection: { _id: 1 } }
  );
  if (!electiveScheme) return null;

  // Registered takers in the current academic batch.
  const batch = await collections.academicBatches.findOne(
    {
      tenantId: tenantOid,
      isCurrent: true,
      $or: [{ branchId: branchOid }, { branchId: { $exists: false } }],
    },
    { projection: { _id: 1 } }
  );
  if (!batch) return null; // no current batch — fail open to full section

  const registrations = await collections.courseRegistrations
    .find({
      tenantId: tenantOid,
      branchId: branchOid,
      academicBatchId: batch._id,
      status: 'submitted',
      entries: { $elemMatch: { subjectId: subjectOid, kind: 'basket' } },
    })
    .project({ studentId: 1 })
    .toArray();

  return registrations.map((r) => r.studentId as ObjectId);
}

/**
 * Rejects records for students who are not on the roster: active students of
 * the section and, for an elective, its registered takers. Rosters were only
 * filtered when read, so attendance and marks accepted anyone.
 */
export async function assertOnRoster(
  tenantId: string,
  branchId: string,
  sectionId: string,
  subjectId: string | undefined,
  studentIds: string[]
): Promise<void> {
  if (studentIds.length === 0) return;
  const ids = [...new Set(studentIds)].map((id) => new ObjectId(id));
  const filter: Record<string, unknown> = {
    tenantId: new ObjectId(tenantId),
    branchId: new ObjectId(branchId),
    'currentEnrollment.sectionId': new ObjectId(sectionId),
    _id: { $in: ids },
  };
  if (subjectId) {
    const takers = await getElectiveRosterFilter(tenantId, branchId, subjectId);
    if (takers !== null) {
      const allowed = new Set(takers.map(String));
      filter._id = { $in: ids.filter((id) => allowed.has(String(id))) };
    }
  }
  const onRoster = await collections.students.countDocuments(filter);
  if (onRoster !== ids.length) {
    throw new ApiError(
      'STUDENT_NOT_ON_ROSTER',
      `${ids.length - onRoster} of these students are not on this ${subjectId ? 'subject' : 'section'}'s roster`,
      400
    );
  }
}

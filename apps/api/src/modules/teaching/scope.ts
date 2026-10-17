import { Request, Response, NextFunction } from 'express';
import { ObjectId, Document, Filter } from 'mongodb';
import { STUDENT_ROLE_LEVEL } from '@campus-verse/shared/constants';
import { collections } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler';
import { getStaffIdForUser } from './teaching.utils';
import { assertSectionInScope, getScopedClassIds } from '../../middleware/scope';

// Teaching-scope guard (docs/UNIVERSITY_TIER_TASKS.md). The canonical source
// is the teaching_assignments collection (section-granular, checked first);
// the three legacy sources — section teacher / section subject teachers,
// staff.teaching.subjects (class-level), and timetable entries — remain as
// fallbacks until Phase 5 retires them.

const ADMIN_ROLE_LEVEL = 3;

function roleLevel(req: Request): number {
  return req.user?.roleLevel ?? 99;
}

export async function staffTeachesSection(
  tenantId: string,
  staffId: string,
  sectionId: string
): Promise<boolean> {
  const tenantOid = new ObjectId(tenantId);
  const staffOid = new ObjectId(staffId);
  const sectionOid = new ObjectId(sectionId);

  const assignment = await collections.teachingAssignments.findOne(
    { tenantId: tenantOid, sectionId: sectionOid, staffId: staffOid, status: 'active' },
    { projection: { _id: 1 } }
  );
  if (assignment) {
    return true;
  }

  const section = await collections.sections.findOne(
    { _id: sectionOid, tenantId: tenantOid },
    { projection: { classId: 1, sectionTeacherId: 1, 'subjects.teacherId': 1 } }
  );
  if (!section) {
    throw new ApiError('SECTION_NOT_FOUND', 'Section not found', 404);
  }

  if ((section.sectionTeacherId as ObjectId | undefined)?.equals(staffOid)) {
    return true;
  }

  const sectionSubjects = (section.subjects as Array<{ teacherId?: ObjectId }> | undefined) ?? [];
  if (sectionSubjects.some((s) => s.teacherId?.equals(staffOid))) {
    return true;
  }

  const timetableEntry = await collections.timetableEntries.findOne(
    { tenantId: tenantOid, sectionId: sectionOid, teacherId: staffOid },
    { projection: { _id: 1 } }
  );
  if (timetableEntry) {
    return true;
  }

  const staffDoc = await collections.staff.findOne(
    { _id: staffOid, tenantId: tenantOid },
    { projection: { 'teaching.subjects.classIds': 1 } }
  );
  const classOid = section.classId as ObjectId;
  const teachingSubjects =
    (staffDoc?.teaching as { subjects?: Array<{ classIds?: ObjectId[] }> } | undefined)?.subjects ??
    [];
  return teachingSubjects.some((s) => (s.classIds ?? []).some((cid) => cid.equals(classOid)));
}

/**
 * Sections a teaching staff member may see students of, or null when the
 * caller is not confined to their own sections (admins, office staff with no
 * teaching links). Same four sources as staffTeachesSection, listed instead of
 * probed. Faculty see only the students they teach (client brief), so list
 * endpoints that otherwise return the whole campus narrow by this.
 */
export async function getTaughtSectionIds(req: Request): Promise<ObjectId[] | null> {
  if (!req.tenantId || !req.user) return null;
  if (roleLevel(req) <= ADMIN_ROLE_LEVEL || roleLevel(req) >= STUDENT_ROLE_LEVEL) return null;

  let staffId: string;
  try {
    staffId = await getStaffIdForUser(req.tenantId, req.user.userId);
  } catch {
    return null; // no staff profile: not faculty
  }
  if (!(await isTeachingStaff(req.tenantId, staffId))) return null;

  const tenantOid = new ObjectId(req.tenantId);
  const staffOid = new ObjectId(staffId);
  const ids = new Set<string>();

  const assignments = await collections.teachingAssignments
    .find({ tenantId: tenantOid, staffId: staffOid, status: 'active' })
    .project({ sectionId: 1 })
    .toArray();
  assignments.forEach((a) => ids.add(String(a.sectionId)));

  const sections = await collections.sections
    .find({
      tenantId: tenantOid,
      $or: [{ sectionTeacherId: staffOid }, { 'subjects.teacherId': staffOid }],
    })
    .project({ _id: 1 })
    .toArray();
  sections.forEach((sec) => ids.add(String(sec._id)));

  const entries = await collections.timetableEntries
    .find({ tenantId: tenantOid, teacherId: staffOid })
    .project({ sectionId: 1 })
    .toArray();
  entries.forEach((e) => e.sectionId && ids.add(String(e.sectionId)));

  const staffDoc = await collections.staff.findOne(
    { _id: staffOid, tenantId: tenantOid },
    { projection: { 'teaching.subjects.classIds': 1 } }
  );
  const classIds = (
    (staffDoc?.teaching as { subjects?: Array<{ classIds?: ObjectId[] }> } | undefined)?.subjects ??
    []
  ).flatMap((sub) => sub.classIds ?? []);
  if (classIds.length) {
    const classSections = await collections.sections
      .find({ tenantId: tenantOid, classId: { $in: classIds } })
      .project({ _id: 1 })
      .toArray();
    classSections.forEach((sec) => ids.add(String(sec._id)));
  }

  return [...ids].map((id) => new ObjectId(id));
}

/**
 * True when the staff member is linked to any section/class/timetable as a
 * teacher — used to tell teachers apart from non-teaching staff (clerks,
 * office roles), since both sit at the same role level.
 */
async function isTeachingStaff(tenantId: string, staffId: string): Promise<boolean> {
  const tenantOid = new ObjectId(tenantId);
  const staffOid = new ObjectId(staffId);

  const assignment = await collections.teachingAssignments.findOne(
    { tenantId: tenantOid, staffId: staffOid, status: 'active' },
    { projection: { _id: 1 } }
  );
  if (assignment) {
    return true;
  }

  const staffDoc = await collections.staff.findOne(
    { _id: staffOid, tenantId: tenantOid },
    { projection: { 'teaching.subjects': 1 } }
  );
  const teachingSubjects =
    (staffDoc?.teaching as { subjects?: unknown[] } | undefined)?.subjects ?? [];
  if (teachingSubjects.length > 0) {
    return true;
  }

  const section = await collections.sections.findOne(
    {
      tenantId: tenantOid,
      $or: [{ sectionTeacherId: staffOid }, { 'subjects.teacherId': staffOid }],
    },
    { projection: { _id: 1 } }
  );
  if (section) {
    return true;
  }

  const timetableEntry = await collections.timetableEntries.findOne(
    { tenantId: tenantOid, teacherId: staffOid },
    { projection: { _id: 1 } }
  );
  return !!timetableEntry;
}

/**
 * Rejects the request unless the caller may operate on the section.
 *
 * - Admins (roleLevel <= 3) always pass, unless a department/program grant
 *   on their own account excludes the section.
 * - Students never pass — section registers/rosters are staff-facing; student
 *   self-service goes through the dedicated /self endpoints.
 * - Teachers pass only for sections they teach.
 * - `allowNonTeachingStaff` keeps office accounts working on endpoints they
 *   legitimately operate branch-wide (attendance marking): users with no staff
 *   record, or staff with no teaching links at all, pass; teachers stay
 *   confined to their sections.
 */
export async function assertTeachingScope(
  req: Request,
  sectionId: string,
  opts: { allowNonTeachingStaff?: boolean } = {}
): Promise<void> {
  // A teaching link to the section passes first: an HOD of Civil who teaches
  // an elective in CSE takes its register although CSE is outside their
  // department. Otherwise a department/program grant binds even an admin.
  if (roleLevel(req) < STUDENT_ROLE_LEVEL && ObjectId.isValid(sectionId)) {
    const staffId = await getStaffIdForUser(req.tenantId!, req.user!.userId).catch(() => null);
    if (staffId && (await staffTeachesSection(req.tenantId!, staffId, sectionId))) return;
  }
  await assertSectionInScope(req, sectionId);

  if (roleLevel(req) <= ADMIN_ROLE_LEVEL) {
    return;
  }
  if (roleLevel(req) >= STUDENT_ROLE_LEVEL) {
    throw new ApiError('SECTION_ACCESS_DENIED', 'You are not assigned to this section', 403);
  }
  if (!ObjectId.isValid(sectionId)) {
    throw new ApiError('INVALID_SECTION_ID', 'Invalid section id', 400);
  }

  let staffId: string;
  try {
    staffId = await getStaffIdForUser(req.tenantId!, req.user!.userId);
  } catch (error) {
    if (
      opts.allowNonTeachingStaff &&
      error instanceof ApiError &&
      error.code === 'STAFF_NOT_FOUND'
    ) {
      return;
    }
    throw error;
  }

  if (await staffTeachesSection(req.tenantId!, staffId, sectionId)) {
    return;
  }
  if (opts.allowNonTeachingStaff && !(await isTeachingStaff(req.tenantId!, staffId))) {
    return;
  }

  throw new ApiError('SECTION_ACCESS_DENIED', 'You are not assigned to this section', 403);
}

/**
 * Student self-scope: a student-role caller may only request their own
 * studentId (linked via users.studentId). Non-students pass through —
 * teacher/admin scoping is handled by the other guards.
 */
export async function assertStudentSelfScope(req: Request, studentId: string): Promise<void> {
  if (roleLevel(req) < STUDENT_ROLE_LEVEL) {
    return;
  }
  const user = await collections.users.findOne(
    { _id: new ObjectId(req.user!.userId), tenantId: new ObjectId(req.tenantId!) },
    { projection: { studentId: 1 } }
  );
  const ownStudentId = user?.studentId ? String(user.studentId) : null;
  if (!ownStudentId || ownStudentId !== studentId) {
    throw new ApiError('STUDENT_SELF_ONLY', 'You can only view your own records', 403);
  }
}

/**
 * Rejects the request unless the caller owns the assignment (or is an admin).
 * Mirrors the ownership rule already enforced on assignment update/delete
 * (assignment.service.ts), extending it to grading.
 */
export async function assertAssignmentOwnership(req: Request, assignmentId: string): Promise<void> {
  if (roleLevel(req) <= ADMIN_ROLE_LEVEL) {
    return;
  }
  if (roleLevel(req) >= STUDENT_ROLE_LEVEL) {
    throw new ApiError('ASSIGNMENT_ACCESS_DENIED', 'You cannot grade assignments', 403);
  }
  if (!ObjectId.isValid(assignmentId)) {
    throw new ApiError('INVALID_ASSIGNMENT_ID', 'Invalid assignment id', 400);
  }

  const staffId = await getStaffIdForUser(req.tenantId!, req.user!.userId);
  const assignment = await collections.assignments.findOne(
    { _id: new ObjectId(assignmentId), tenantId: new ObjectId(req.tenantId!) },
    { projection: { teacherId: 1 } }
  );
  if (!assignment) {
    throw new ApiError('ASSIGNMENT_NOT_FOUND', 'Assignment not found', 404);
  }
  if (!(assignment.teacherId as ObjectId | undefined)?.equals(new ObjectId(staffId))) {
    throw new ApiError('ASSIGNMENT_ACCESS_DENIED', 'You can only grade your own assignments', 403);
  }
}

// ─── Student visibility ─────────────────────────────────────────────────────

/** Subjects offered as electives (basket options) in a published scheme on the campus. */
export async function getElectiveSubjectIds(
  tenantId: string,
  branchId: string
): Promise<Set<string>> {
  const schemes = await collections.programSchemes
    .find(
      { tenantId: new ObjectId(tenantId), branchId: new ObjectId(branchId), status: 'published' },
      { projection: { slots: 1 } }
    )
    .toArray();
  const ids = new Set<string>();
  for (const scheme of schemes) {
    for (const slot of (scheme.slots ?? []) as Array<{
      kind: string;
      options?: Array<{ subjectId: ObjectId }>;
    }>) {
      if (slot.kind === 'basket') slot.options?.forEach((o) => ids.add(String(o.subjectId)));
    }
  }
  return ids;
}

/**
 * What a teacher's teaching links open up: whole sections where they teach a
 * core subject, and only the registered takers where they teach an elective.
 * null when the caller has no teaching staff profile.
 */
async function getTeachingReach(
  req: Request
): Promise<{ coreSectionIds: ObjectId[]; electiveStudentIds: ObjectId[] } | null> {
  if (!req.tenantId || !req.user || !req.branchId) return null;
  let staffId: string;
  try {
    staffId = await getStaffIdForUser(req.tenantId, req.user.userId);
  } catch {
    return null;
  }
  const tenantOid = new ObjectId(req.tenantId);
  const staffOid = new ObjectId(staffId);

  // Every (section, subject) the staff member teaches, from all four sources.
  const pairs: Array<{ sectionId: string; subjectId?: string }> = [];
  const assignments = await collections.teachingAssignments
    .find({ tenantId: tenantOid, staffId: staffOid, status: 'active' })
    .project({ sectionId: 1, subjectId: 1 })
    .toArray();
  assignments.forEach((a) =>
    pairs.push({ sectionId: String(a.sectionId), subjectId: String(a.subjectId) })
  );
  const sections = await collections.sections
    .find({
      tenantId: tenantOid,
      $or: [{ sectionTeacherId: staffOid }, { 'subjects.teacherId': staffOid }],
    })
    .project({ sectionTeacherId: 1, subjects: 1 })
    .toArray();
  for (const sec of sections) {
    if ((sec.sectionTeacherId as ObjectId | undefined)?.equals(staffOid))
      pairs.push({ sectionId: String(sec._id) });
    for (const sub of (sec.subjects ?? []) as Array<{
      teacherId?: ObjectId;
      subjectId?: ObjectId;
    }>) {
      if (sub.teacherId?.equals(staffOid))
        pairs.push({ sectionId: String(sec._id), subjectId: String(sub.subjectId) });
    }
  }
  const entries = await collections.timetableEntries
    .find({ tenantId: tenantOid, teacherId: staffOid })
    .project({ sectionId: 1, subjectId: 1, linkedSectionIds: 1 })
    .toArray();
  for (const e of entries) {
    for (const sid of [e.sectionId, ...((e.linkedSectionIds as ObjectId[] | undefined) ?? [])]) {
      if (sid)
        pairs.push({
          sectionId: String(sid),
          subjectId: e.subjectId ? String(e.subjectId) : undefined,
        });
    }
  }
  if (pairs.length === 0) return null;

  const electives = await getElectiveSubjectIds(req.tenantId, req.branchId);
  const core = new Set<string>();
  const electiveSections = new Map<string, Set<string>>(); // subject -> sections
  for (const p of pairs) {
    if (p.subjectId && electives.has(p.subjectId)) {
      if (!electiveSections.has(p.subjectId)) electiveSections.set(p.subjectId, new Set());
      electiveSections.get(p.subjectId)!.add(p.sectionId);
    } else {
      core.add(p.sectionId);
    }
  }

  // Registered takers of each elective, limited to the sections it is taught in.
  const electiveStudentIds: ObjectId[] = [];
  if (electiveSections.size) {
    const regs = await collections.courseRegistrations
      .find({
        tenantId: tenantOid,
        branchId: new ObjectId(req.branchId),
        status: 'submitted',
        'entries.subjectId': { $in: [...electiveSections.keys()].map((id) => new ObjectId(id)) },
      })
      .project({ studentId: 1, entries: 1 })
      .toArray();
    const candidates = new Map<string, Set<string>>(); // student -> subjects
    for (const r of regs) {
      for (const e of (r.entries ?? []) as Array<{ subjectId: ObjectId }>) {
        if (electiveSections.has(String(e.subjectId))) {
          if (!candidates.has(String(r.studentId))) candidates.set(String(r.studentId), new Set());
          candidates.get(String(r.studentId))!.add(String(e.subjectId));
        }
      }
    }
    if (candidates.size) {
      const students = await collections.students
        .find({
          tenantId: tenantOid,
          _id: { $in: [...candidates.keys()].map((id) => new ObjectId(id)) },
        })
        .project({ 'currentEnrollment.sectionId': 1 })
        .toArray();
      for (const st of students) {
        const sec = String(st.currentEnrollment?.sectionId);
        if (
          [...candidates.get(String(st._id))!].some((sub) => electiveSections.get(sub)!.has(sec))
        ) {
          electiveStudentIds.push(st._id as ObjectId);
        }
      }
    }
  }
  return { coreSectionIds: [...core].map((id) => new ObjectId(id)), electiveStudentIds };
}

/**
 * Mongo filter for the students the caller may see on the selected campus,
 * or null when unrestricted.
 *
 * The role's scope grant (institution / department / program classes) and
 * the caller's teaching reach are a UNION: an HOD sees their department and
 * also the takers of an elective they teach elsewhere. Teaching staff without
 * a narrower grant see only what they teach. Students see only themselves.
 */
export async function getStudentVisibilityFilter(req: Request): Promise<Filter<Document> | null> {
  if (roleLevel(req) >= STUDENT_ROLE_LEVEL) {
    const user = await collections.users.findOne(
      { _id: new ObjectId(req.user!.userId), tenantId: new ObjectId(req.tenantId!) },
      { projection: { studentId: 1 } }
    );
    return { _id: user?.studentId ?? null };
  }

  const scopedClassIds = await getScopedClassIds(req);
  const isAdmin = roleLevel(req) <= ADMIN_ROLE_LEVEL;
  if (scopedClassIds === null && isAdmin) return null;

  const reach = await getTeachingReach(req);
  if (scopedClassIds === null && !reach) return null; // office staff: campus-wide

  const clauses: Filter<Document>[] = [];
  if (scopedClassIds) clauses.push({ 'currentEnrollment.classId': { $in: scopedClassIds } });
  if (reach) {
    if (reach.coreSectionIds.length)
      clauses.push({ 'currentEnrollment.sectionId': { $in: reach.coreSectionIds } });
    if (reach.electiveStudentIds.length) clauses.push({ _id: { $in: reach.electiveStudentIds } });
  }
  return clauses.length ? { $or: clauses } : { _id: { $in: [] } };
}

/** Rejects unless the caller may see this student (same rule as the lists). */
export async function assertStudentInScope(req: Request, studentId: string): Promise<void> {
  if (!ObjectId.isValid(studentId)) {
    throw new ApiError('INVALID_STUDENT_ID', 'Invalid student id', 400);
  }
  const filter = await getStudentVisibilityFilter(req);
  const visible = await collections.students.countDocuments({
    _id: new ObjectId(studentId),
    tenantId: new ObjectId(req.tenantId!),
    ...(req.branchId && { branchId: new ObjectId(req.branchId) }),
    ...(filter && { $and: [filter] }),
  });
  if (!visible) {
    throw new ApiError('STUDENT_OUT_OF_SCOPE', "You don't have access to this student", 403);
  }
}

/**
 * router.param guard for routes keyed by a student id. Ids that are not a
 * student of this tenant pass through so the route answers them itself
 * (e.g. /bulk-uploads/:id shares the parameter name).
 */
export async function studentParamGuard(
  req: Request,
  _res: Response,
  next: NextFunction,
  id: string
) {
  try {
    if (!req.user || !req.tenantId || !ObjectId.isValid(id)) return next();
    const isStudent = await collections.students.countDocuments(
      { _id: new ObjectId(id), tenantId: new ObjectId(req.tenantId) },
      { limit: 1 }
    );
    if (isStudent) await assertStudentInScope(req, id);
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Rejects unless the caller teaches this subject in this section (assignment,
 * section subject teacher or timetable row). Admins pass. Used where a
 * teacher writes records for one subject, such as exam marks.
 */
export async function assertTeachesSubject(
  req: Request,
  sectionId: string,
  subjectId: string
): Promise<void> {
  if (roleLevel(req) <= ADMIN_ROLE_LEVEL) return;
  if (roleLevel(req) >= STUDENT_ROLE_LEVEL) {
    throw new ApiError('SUBJECT_ACCESS_DENIED', 'Students cannot enter records', 403);
  }
  const staffOid = new ObjectId(await getStaffIdForUser(req.tenantId!, req.user!.userId));
  const tenantOid = new ObjectId(req.tenantId!);
  const sectionOid = new ObjectId(sectionId);
  const subjectOid = new ObjectId(subjectId);
  const [assignment, sectionRow, entry] = await Promise.all([
    collections.teachingAssignments.countDocuments(
      {
        tenantId: tenantOid,
        staffId: staffOid,
        sectionId: sectionOid,
        subjectId: subjectOid,
        status: 'active',
      },
      { limit: 1 }
    ),
    collections.sections.countDocuments(
      {
        _id: sectionOid,
        tenantId: tenantOid,
        subjects: { $elemMatch: { subjectId: subjectOid, teacherId: staffOid } },
      },
      { limit: 1 }
    ),
    collections.timetableEntries.countDocuments(
      {
        tenantId: tenantOid,
        teacherId: staffOid,
        subjectId: subjectOid,
        $or: [{ sectionId: sectionOid }, { linkedSectionIds: sectionOid }],
      },
      { limit: 1 }
    ),
  ]);
  if (!assignment && !sectionRow && !entry) {
    throw new ApiError(
      'SUBJECT_ACCESS_DENIED',
      "You don't teach this subject in this section",
      403
    );
  }
}

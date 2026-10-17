import { ObjectId, Document, Filter } from 'mongodb';
import { collections } from '../../config/database';
import { institutionService } from './institution.service';
import { ApiError } from '../../middleware/errorHandler';

/**
 * Read model for the Organization → Departments page: every department (from
 * the shared HR/academic department registry) enriched with live academic
 * stats. Classes are linked to a department by their top path entry matching
 * the department's code or name (case-insensitive) — the academic structure
 * stores the department on each class's path, not as a foreign key.
 */

export interface DepartmentOverview {
  _id: string;
  name: string;
  code: string;
  type: 'academic' | 'administrative' | 'support';
  description?: string;
  /** Constituent institution this department sits under (null for legacy rows). */
  institution: { _id: string; name: string; code: string; isDefault: boolean } | null;
  headOfDepartment: { _id: string; displayName: string } | null;
  students: number;
  faculty: number;
  sections: number;
  /** Average attendance % over the last 30 days, null when no data. */
  attendancePct: number | null;
  status: 'active' | 'inactive';
}

class DepartmentOverviewService {
  async getOverview(tenantId: string, branchId: string): Promise<DepartmentOverview[]> {
    const tenantOid = new ObjectId(tenantId);
    const branchOid = new ObjectId(branchId);

    // Adopts pre-institution-tier departments so every row resolves an
    // institution — the page groups by it.
    await institutionService.ensureDefaultUnlessUniversity(tenantId, branchId);

    const departments = await collections.departments
      .find({ tenantId: tenantOid, branchId: branchOid, status: 'active' })
      .sort({ name: 1 })
      .toArray();
    if (departments.length === 0) return [];

    const institutions = await collections.institutions
      .find({ tenantId: tenantOid, branchId: branchOid })
      .project({ name: 1, code: 1, isDefault: 1 })
      .toArray();
    const institutionMap = new Map(institutions.map((i) => [i._id.toString(), i]));

    // Current academic batch scopes the class/section/student stats.
    const batch =
      (await collections.academicBatches.findOne(
        { tenantId: tenantOid, branchId: branchOid, isCurrent: true },
        { projection: { _id: 1 } }
      )) ??
      (await collections.academicBatches.findOne(
        { tenantId: tenantOid, isCurrent: true },
        { projection: { _id: 1 } }
      ));

    const classFilter: Filter<Document> = { tenantId: tenantOid, branchId: branchOid };
    if (batch) classFilter.academicBatchId = batch._id;
    const classes = await collections.classes
      .find(classFilter)
      .project({ path: 1, departmentId: 1 })
      .toArray();

    // Bucket class ids per department: the Class.departmentId FK is
    // authoritative (Phase-5 re-key); classes without it fall back to the
    // legacy top-path name match.
    const norm = (v: unknown) =>
      String(v ?? '')
        .trim()
        .toLowerCase();
    const classIdsByDept = new Map<string, ObjectId[]>();
    for (const dept of departments) {
      const deptId = dept._id.toString();
      const keys = new Set([norm(dept.code), norm(dept.name)]);
      const ids = classes
        .filter((c) => {
          if (c.departmentId) {
            return String(c.departmentId) === deptId;
          }
          const top = (c.path as Array<{ name?: string; code?: string }> | undefined)?.[0];
          return !!top && (keys.has(norm(top.code)) || keys.has(norm(top.name)));
        })
        .map((c) => c._id);
      classIdsByDept.set(deptId, ids);
    }

    const allDeptClassIds = [...classIdsByDept.values()].flat();

    // Faculty counts come from the staff registry's department link.
    const staffCounts = await collections.staff
      .aggregate([
        {
          $match: {
            tenantId: tenantOid,
            branchId: branchOid,
            status: 'active',
            'employment.departmentId': { $in: departments.map((d) => d._id) },
          },
        },
        { $group: { _id: '$employment.departmentId', count: { $sum: 1 } } },
      ])
      .toArray();
    const facultyByDept = new Map(staffCounts.map((s) => [String(s._id), s.count as number]));

    // Sections + students per class, then rolled up per department.
    const [sectionRows, studentRows] = await Promise.all([
      allDeptClassIds.length
        ? collections.sections
            .aggregate([
              {
                $match: {
                  tenantId: tenantOid,
                  classId: { $in: allDeptClassIds },
                  status: { $ne: 'inactive' },
                },
              },
              { $group: { _id: '$classId', count: { $sum: 1 }, sectionIds: { $push: '$_id' } } },
            ])
            .toArray()
        : Promise.resolve([]),
      allDeptClassIds.length
        ? collections.students
            .aggregate([
              {
                $match: {
                  tenantId: tenantOid,
                  status: 'active',
                  'currentEnrollment.classId': { $in: allDeptClassIds },
                },
              },
              { $group: { _id: '$currentEnrollment.classId', count: { $sum: 1 } } },
            ])
            .toArray()
        : Promise.resolve([]),
    ]);
    const sectionsByClass = new Map(sectionRows.map((r) => [String(r._id), r]));
    const studentsByClass = new Map(studentRows.map((r) => [String(r._id), r.count as number]));

    // Attendance: last 30 days of marked registers for each department's
    // sections, using the per-register summary counts.
    const since = new Date();
    since.setDate(since.getDate() - 30);
    since.setHours(0, 0, 0, 0);
    const allSectionIds = sectionRows.flatMap((r) => r.sectionIds as ObjectId[]);
    const attendanceRows = allSectionIds.length
      ? await collections.studentAttendance
          .aggregate([
            {
              $match: {
                tenantId: tenantOid,
                sectionId: { $in: allSectionIds },
                date: { $gte: since },
              },
            },
            {
              $group: {
                _id: '$sectionId',
                present: { $sum: '$summary.present' },
                total: { $sum: '$summary.total' },
              },
            },
          ])
          .toArray()
      : [];
    const attendanceBySection = new Map(attendanceRows.map((r) => [String(r._id), r]));

    // Resolve heads of department in one lookup.
    const hodIds = departments
      .map((d) => d.headOfDepartment as ObjectId | undefined)
      .filter(Boolean) as ObjectId[];
    const hods = hodIds.length
      ? await collections.staff
          .find({ _id: { $in: hodIds } })
          .project({ displayName: 1, firstName: 1, lastName: 1 })
          .toArray()
      : [];
    const hodMap = new Map(hods.map((h) => [h._id.toString(), h]));

    return departments.map((dept) => {
      const deptId = dept._id.toString();
      const classIds = classIdsByDept.get(deptId) ?? [];
      let sections = 0;
      let students = 0;
      let present = 0;
      let total = 0;
      for (const classId of classIds) {
        const key = classId.toString();
        const sectionRow = sectionsByClass.get(key);
        sections += (sectionRow?.count as number) ?? 0;
        students += studentsByClass.get(key) ?? 0;
        for (const sectionId of (sectionRow?.sectionIds as ObjectId[] | undefined) ?? []) {
          const att = attendanceBySection.get(sectionId.toString());
          present += (att?.present as number) ?? 0;
          total += (att?.total as number) ?? 0;
        }
      }
      const hod = dept.headOfDepartment
        ? hodMap.get((dept.headOfDepartment as ObjectId).toString())
        : undefined;
      const institution = dept.institutionId
        ? institutionMap.get((dept.institutionId as ObjectId).toString())
        : undefined;
      return {
        _id: deptId,
        name: dept.name as string,
        code: dept.code as string,
        type: dept.type as DepartmentOverview['type'],
        description: dept.description as string | undefined,
        institution: institution
          ? {
              _id: institution._id.toString(),
              name: institution.name as string,
              code: institution.code as string,
              isDefault: !!institution.isDefault,
            }
          : null,
        headOfDepartment: hod
          ? {
              _id: hod._id.toString(),
              displayName:
                (hod.displayName as string) ||
                `${hod.firstName ?? ''} ${hod.lastName ?? ''}`.trim(),
            }
          : null,
        students,
        faculty: facultyByDept.get(deptId) ?? 0,
        sections,
        attendancePct: total > 0 ? Math.round((present / total) * 100) : null,
        status: dept.status as DepartmentOverview['status'],
      };
    });
  }

  /**
   * Everyone in one department: its staff (by their department link) and the
   * students of its current-year classes, each with their email and whether
   * they can sign in.
   */
  async getPeople(tenantId: string, branchId: string, departmentId: string) {
    const tenantOid = new ObjectId(tenantId);
    const branchOid = new ObjectId(branchId);
    const deptOid = new ObjectId(departmentId);
    const dept = await collections.departments.findOne({ _id: deptOid, tenantId: tenantOid });
    if (!dept) throw new ApiError('DEPARTMENT_NOT_FOUND', 'Department not found', 404);

    const batch = await collections.academicBatches.findOne(
      { tenantId: tenantOid, branchId: branchOid, isCurrent: true },
      { projection: { _id: 1, name: 1 } }
    );
    const norm = (v: unknown) =>
      String(v ?? '')
        .trim()
        .toLowerCase();
    const keys = new Set([norm(dept.code), norm(dept.name)]);
    const classes = (
      await collections.classes
        .find({
          tenantId: tenantOid,
          branchId: branchOid,
          ...(batch && { academicBatchId: batch._id }),
        })
        .project({ path: 1, departmentId: 1, displayName: 1, programId: 1 })
        .toArray()
    ).filter((c) => {
      if (c.departmentId) return String(c.departmentId) === departmentId;
      const top = (c.path as Array<{ name?: string; code?: string }> | undefined)?.[0];
      return !!top && (keys.has(norm(top.code)) || keys.has(norm(top.name)));
    });

    const [staff, students, programs] = await Promise.all([
      collections.staff
        .find({ tenantId: tenantOid, branchId: branchOid, 'employment.departmentId': deptOid })
        .project({
          displayName: 1,
          firstName: 1,
          lastName: 1,
          employeeId: 1,
          contact: 1,
          status: 1,
          userId: 1,
          'employment.designationId': 1,
        })
        .sort({ displayName: 1 })
        .toArray(),
      classes.length
        ? collections.students
            .find({
              tenantId: tenantOid,
              status: 'active',
              'currentEnrollment.classId': { $in: classes.map((c) => c._id) },
            })
            .project({
              displayName: 1,
              firstName: 1,
              lastName: 1,
              admissionNumber: 1,
              rollNumber: 1,
              contact: 1,
              userId: 1,
              currentEnrollment: 1,
            })
            .sort({ 'currentEnrollment.className': 1, rollNumber: 1 })
            .limit(5000)
            .toArray()
        : [],
      collections.programs
        .find({ tenantId: tenantOid, departmentId: deptOid, status: { $ne: 'archived' } })
        .project({ name: 1, code: 1, durationYears: 1, totalSemesters: 1 })
        .toArray(),
    ]);

    const userIds = [...staff, ...students].map((p) => p.userId).filter(Boolean) as ObjectId[];
    const designationIds = staff
      .map((s) => s.employment?.designationId)
      .filter(Boolean) as ObjectId[];
    const [users, designations, teaching, hod] = await Promise.all([
      userIds.length
        ? collections.users
            .find({ _id: { $in: userIds } })
            .project({ status: 1, lastLogin: 1, validUntil: 1, 'security.mustChangePassword': 1 })
            .toArray()
        : [],
      designationIds.length
        ? collections.designations
            .find({ _id: { $in: designationIds } })
            .project({ name: 1 })
            .toArray()
        : [],
      // Subjects each staff member teaches, across the campus's sections.
      staff.length
        ? collections.sections
            .aggregate([
              { $match: { tenantId: tenantOid, branchId: branchOid, status: 'active' } },
              { $unwind: '$subjects' },
              { $match: { 'subjects.teacherId': { $in: staff.map((s) => s._id) } } },
              { $group: { _id: '$subjects.teacherId', count: { $sum: 1 } } },
            ])
            .toArray()
        : [],
      dept.headOfDepartment
        ? collections.staff.findOne(
            { _id: dept.headOfDepartment as ObjectId },
            { projection: { displayName: 1, firstName: 1, lastName: 1 } }
          )
        : null,
    ]);
    const userById = new Map(users.map((u) => [String(u._id), u]));
    const designationById = new Map(designations.map((d) => [String(d._id), d.name as string]));
    const teachingBy = new Map(teaching.map((t) => [String(t._id), t.count as number]));
    const nameOf = (p: Document) =>
      (p.displayName as string) || [p.firstName, p.lastName].filter(Boolean).join(' ');
    const login = (userId?: ObjectId) =>
      loginStatus(userId ? userById.get(String(userId)) : undefined);

    return {
      department: {
        _id: departmentId,
        name: dept.name as string,
        code: dept.code as string,
        type: dept.type as string,
        headOfDepartment: hod ? nameOf(hod) : null,
      },
      academicYear: (batch?.name as string) ?? null,
      programs: programs.map((p) => ({
        _id: String(p._id),
        name: p.name as string,
        code: p.code as string,
        durationYears: p.durationYears as number,
        totalSemesters: p.totalSemesters as number | undefined,
      })),
      staff: staff.map((s) => ({
        _id: String(s._id),
        name: nameOf(s),
        employeeId: s.employeeId as string | undefined,
        designation: designationById.get(String(s.employment?.designationId)) ?? null,
        email: (s.contact?.email as string) ?? null,
        phone: (s.contact?.phone as string) ?? null,
        status: s.status as string,
        subjectsTaught: teachingBy.get(String(s._id)) ?? 0,
        login: login(s.userId as ObjectId | undefined),
      })),
      students: students.map((s) => ({
        _id: String(s._id),
        name: nameOf(s),
        admissionNumber: s.admissionNumber as string | undefined,
        rollNumber: s.rollNumber as string | undefined,
        className: (s.currentEnrollment?.className as string) ?? null,
        sectionName: (s.currentEnrollment?.sectionName as string) ?? null,
        email: (s.contact?.email as string) ?? null,
        login: login(s.userId as ObjectId | undefined),
      })),
    };
  }
}

/**
 * Can this person sign in? Mirrors the checks in auth.service login:
 * `no_account` — never given a login; `disabled` — account inactive/deleted;
 * `expired` — a temporary account past its end date; `first_login` — signs in
 * with the temporary password and must set their own; `active` — normal.
 */
export function loginStatus(user?: Document): {
  state: 'no_account' | 'disabled' | 'expired' | 'first_login' | 'active';
  lastLogin: string | null;
} {
  if (!user) return { state: 'no_account', lastLogin: null };
  const lastLogin = user.lastLogin ? new Date(user.lastLogin).toISOString() : null;
  if (user.status === 'inactive' || user.status === 'deleted') {
    return { state: 'disabled', lastLogin };
  }
  if (user.validUntil && new Date(user.validUntil) < new Date()) {
    return { state: 'expired', lastLogin };
  }
  if (user.status === 'pending' || user.security?.mustChangePassword) {
    return { state: 'first_login', lastLogin };
  }
  return { state: 'active', lastLogin };
}

export const departmentOverviewService = new DepartmentOverviewService();

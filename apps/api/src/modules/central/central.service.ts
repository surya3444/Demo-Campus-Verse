import { ObjectId, Document, Filter } from 'mongodb';
import { collections } from '../../config/database';

/**
 * Cross-institution ("All institutions") aggregates for central university
 * staff — doc §9.2.
 *
 * Nothing about storage changes: admissions, fees and HR stay branch-scoped.
 * "Centralized" is a *view* problem — the registrar, the finance office and
 * the HR head need one number across Engineering, MBA, Design and Pharmacy
 * without switching institutions four times.
 *
 * Every aggregate here is driven by an explicit branch list resolved from the
 * caller's access scope (see central.controller), never by X-Branch-Id.
 *
 * Grouping is per INSTITUTION. Documents are branch-scoped and a campus hosts
 * several institutions, so each document is attributed through what it is
 * about: a class (students, leads, applications), a department (staff,
 * programs), a student (fees, scholarships, registrations), a staff member
 * (promotions, payroll) or an OBE program. Each of those resolves to
 * Department.institutionId. Anything that cannot be attributed — a class with
 * no department, an enquiry with no class yet — lands on the campus's default
 * institution, shown as the campus-level row, so totals still reconcile.
 */

export interface InstitutionRef {
  /** Institution id — grouping key for every aggregate below. */
  _id: string;
  name: string;
  code: string;
  /** The campus-level row (the campus's default institution). */
  isDefault?: boolean;
  /** Campus hosting the institution; the UI drills in by selecting it. */
  branchIds: string[];
}

type AttributeKind = 'class' | 'department' | 'student' | 'staff' | 'obeProgram' | 'none';

export interface Attribution {
  groups: InstitutionRef[];
  /** Bucket key (institution id) for a branch-keyed row, or undefined to drop it. */
  key: (branchId: unknown, kind: AttributeKind, ref?: unknown) => string | undefined;
}

/**
 * Institutions on the accessible campuses plus the lookups that attribute a
 * document to one of them. `allowedInstitutionIds` narrows the rows for an
 * institution-scoped caller; their documents outside it are dropped.
 */
export async function resolveAttribution(
  tenantId: string,
  branchIds: ObjectId[],
  opts: { allowedInstitutionIds?: string[]; load?: AttributeKind[] } = {}
): Promise<Attribution> {
  const tid = new ObjectId(tenantId);
  const load = new Set(opts.load ?? []);

  const [branches, institutions] = await Promise.all([
    collections.branches
      .find({ tenantId: tid, _id: { $in: branchIds } })
      .project({ name: 1, code: 1 })
      .toArray(),
    collections.institutions
      .find({ tenantId: tid, branchId: { $in: branchIds }, status: 'active' })
      .project({ name: 1, code: 1, isDefault: 1, branchId: 1 })
      .toArray(),
  ]);

  const allowed = opts.allowedInstitutionIds ? new Set(opts.allowedInstitutionIds) : null;
  const groups = new Map<string, InstitutionRef>();
  const campusBucket = new Map<string, string>();
  const instBranch = new Map<string, string>();

  for (const inst of institutions) {
    const id = inst._id.toString();
    const branchId = String(inst.branchId);
    instBranch.set(id, branchId);
    if (inst.isDefault) campusBucket.set(branchId, id);
    if (allowed && !allowed.has(id)) continue;
    groups.set(id, {
      _id: id,
      name: String(inst.name),
      code: String(inst.code),
      isDefault: inst.isDefault === true,
      branchIds: [branchId],
    });
  }

  // A campus whose default institution was never created still gets a row
  // (unless the caller is institution-scoped), keyed by the campus itself.
  for (const branch of branches) {
    const key = branch._id.toString();
    if (campusBucket.has(key)) continue;
    campusBucket.set(key, key);
    if (!allowed) {
      groups.set(key, {
        _id: key,
        name: String(branch.name),
        code: String(branch.code),
        isDefault: true,
        branchIds: [key],
      });
    }
  }

  const departments = await collections.departments
    .find({ tenantId: tid })
    .project({ institutionId: 1 })
    .toArray();
  const deptInst = new Map(
    departments
      .filter((d) => d.institutionId)
      .map((d) => [d._id.toString(), String(d.institutionId)])
  );

  const classes = await collections.classes
    .find({ tenantId: tid, branchId: { $in: branchIds } })
    .project({ departmentId: 1 })
    .toArray();
  const classDept = new Map(
    classes.filter((c) => c.departmentId).map((c) => [c._id.toString(), String(c.departmentId)])
  );

  const studentClass = new Map<string, string>();
  if (load.has('student')) {
    const students = await collections.students
      .find({ tenantId: tid, branchId: { $in: branchIds } })
      .project({ 'currentEnrollment.classId': 1 })
      .toArray();
    for (const s of students) {
      const classId = (s.currentEnrollment as { classId?: ObjectId } | undefined)?.classId;
      if (classId) studentClass.set(s._id.toString(), String(classId));
    }
  }

  const staffDept = new Map<string, string>();
  if (load.has('staff')) {
    const staff = await collections.staff
      .find({ tenantId: tid, branchId: { $in: branchIds } })
      .project({ 'employment.departmentId': 1 })
      .toArray();
    for (const s of staff) {
      const deptId = (s.employment as { departmentId?: ObjectId } | undefined)?.departmentId;
      if (deptId) staffDept.set(s._id.toString(), String(deptId));
    }
  }

  const obeProgramDept = new Map<string, string>();
  if (load.has('obeProgram')) {
    const programs = await collections.obePrograms
      .find({ tenantId: tid, branchId: { $in: branchIds } })
      .project({ departmentId: 1 })
      .toArray();
    for (const p of programs) {
      if (p.departmentId) obeProgramDept.set(p._id.toString(), String(p.departmentId));
    }
  }

  const deptToKey = (branchId: string, deptId?: string): string | undefined => {
    const inst = deptId ? deptInst.get(deptId) : undefined;
    // Only an institution hosted on this same campus can own the row;
    // anything else falls back to the campus-level bucket.
    if (inst && instBranch.get(inst) === branchId) return inst;
    return campusBucket.get(branchId);
  };

  const key: Attribution['key'] = (branchIdRaw, kind, refRaw) => {
    const branchId = String(branchIdRaw);
    const ref = refRaw ? String(refRaw) : undefined;
    let bucket: string | undefined;
    switch (kind) {
      case 'department':
        bucket = deptToKey(branchId, ref);
        break;
      case 'class':
        bucket = deptToKey(branchId, ref ? classDept.get(ref) : undefined);
        break;
      case 'student': {
        const classId = ref ? studentClass.get(ref) : undefined;
        bucket = deptToKey(branchId, classId ? classDept.get(classId) : undefined);
        break;
      }
      case 'staff':
        bucket = deptToKey(branchId, ref ? staffDept.get(ref) : undefined);
        break;
      case 'obeProgram':
        bucket = deptToKey(branchId, ref ? obeProgramDept.get(ref) : undefined);
        break;
      default:
        bucket = campusBucket.get(branchId);
    }
    return bucket && groups.has(bucket) ? bucket : undefined;
  };

  const sorted = [...groups.values()].sort((a, b) => {
    if (a.branchIds[0] !== b.branchIds[0]) return a.branchIds[0].localeCompare(b.branchIds[0]);
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return { groups: sorted, key };
}

/** Back-compat for callers that only need the row list. */
export async function resolveInstitutionGroups(
  tenantId: string,
  branchIds: ObjectId[],
  allowedInstitutionIds?: string[]
): Promise<{ groups: InstitutionRef[] }> {
  const { groups } = await resolveAttribution(tenantId, branchIds, { allowedInstitutionIds });
  return { groups };
}

/** Sum rows grouped by {b: branchId, k: ref} into per-institution buckets. */
function fold<T extends Record<string, number>>(
  rows: Document[],
  attr: Attribution,
  kind: AttributeKind,
  fields: (keyof T)[]
): Map<string, T> {
  const out = new Map<string, T>();
  for (const row of rows) {
    const id = row._id as { b: unknown; k?: unknown };
    const bucket = attr.key(id.b, kind, id.k);
    if (!bucket) continue;
    const current = out.get(bucket) ?? (Object.fromEntries(fields.map((f) => [f, 0])) as T);
    for (const field of fields) {
      (current as Record<string, number>)[field as string] +=
        Number(row[field as string] ?? 0) || 0;
    }
    out.set(bucket, current);
  }
  return out;
}

/** Count rows grouped by {b, k, v} into bucket → { [v]: count }. */
function tally(
  rows: Document[],
  attr: Attribution,
  kind: AttributeKind,
  countField = 'count'
): Map<string, Record<string, number>> {
  const out = new Map<string, Record<string, number>>();
  for (const row of rows) {
    const id = row._id as { b: unknown; k?: unknown; v?: unknown };
    const bucket = attr.key(id.b, kind, id.k);
    if (!bucket) continue;
    const label = String(id.v ?? 'unknown');
    const current = out.get(bucket) ?? {};
    current[label] = (current[label] ?? 0) + Number(row[countField] ?? 0);
    out.set(bucket, current);
  }
  return out;
}

function branchMatch(tenantId: string, branchIds: ObjectId[]): Filter<Document> {
  return { tenantId: new ObjectId(tenantId), branchId: { $in: branchIds } };
}

const ref = (b: string, k?: string, v?: string) => ({
  b: b,
  ...(k && { k }),
  ...(v && { v }),
});

class CentralService {
  /**
   * Headline numbers per institution: students, staff, money billed vs
   * collected, and the live admissions pipeline.
   */
  async overview(tenantId: string, branchIds: ObjectId[], allowedInstitutionIds?: string[]) {
    const attr = await resolveAttribution(tenantId, branchIds, {
      allowedInstitutionIds,
      load: ['student'],
    });
    const match = branchMatch(tenantId, branchIds);

    const [students, staff, fees, leads, applications] = await Promise.all([
      collections.students
        .aggregate([
          { $match: { ...match, status: 'active' } },
          {
            $group: {
              _id: ref('$branchId', '$currentEnrollment.classId'),
              students: { $sum: 1 },
            },
          },
        ])
        .toArray(),
      collections.staff
        .aggregate([
          { $match: { ...match, status: 'active' } },
          {
            $group: {
              _id: ref('$branchId', '$employment.departmentId'),
              staff: { $sum: 1 },
              teaching: { $sum: { $cond: ['$teaching.isTeaching', 1, 0] } },
            },
          },
        ])
        .toArray(),
      collections.feeAssignments
        .aggregate([
          { $match: { ...match, status: { $ne: 'cancelled' } } },
          {
            $group: {
              _id: ref('$branchId', '$studentId'),
              billed: { $sum: '$summary.netPayable' },
              paid: { $sum: '$summary.totalPaid' },
              sponsored: { $sum: { $ifNull: ['$summary.sponsoredAmount', 0] } },
              balance: { $sum: '$summary.balance' },
            },
          },
        ])
        .toArray(),
      collections.leads
        .aggregate([
          { $match: { ...match, stage: { $nin: ['converted', 'lost'] } } },
          { $group: { _id: ref('$branchId', '$interestedIn.classId'), openLeads: { $sum: 1 } } },
        ])
        .toArray(),
      collections.applications
        .aggregate([
          { $match: match },
          {
            $group: {
              _id: ref('$branchId', '$classId'),
              applications: { $sum: 1 },
              enrolled: { $sum: { $cond: [{ $eq: ['$status', 'enrolled'] }, 1, 0] } },
            },
          },
        ])
        .toArray(),
    ]);

    const studentsBy = fold(students, attr, 'class', ['students']);
    const staffBy = fold(staff, attr, 'department', ['staff', 'teaching']);
    const feesBy = fold(fees, attr, 'student', ['billed', 'paid', 'sponsored', 'balance']);
    const leadsBy = fold(leads, attr, 'class', ['openLeads']);
    const applicationsBy = fold(applications, attr, 'class', ['applications', 'enrolled']);

    const institutions = attr.groups.map((group) => {
      const fee = feesBy.get(group._id) ?? { billed: 0, paid: 0, sponsored: 0, balance: 0 };
      return {
        institution: { _id: group._id, name: group.name, code: group.code },
        isCampusLevel: group.isDefault === true,
        branchCount: group.branchIds.length,
        students: studentsBy.get(group._id)?.students ?? 0,
        staff: staffBy.get(group._id)?.staff ?? 0,
        teachingStaff: staffBy.get(group._id)?.teaching ?? 0,
        billed: fee.billed,
        // Collected reads the fee ledger (summary.totalPaid), the same source
        // the finance rollup uses.
        collected: fee.paid,
        outstanding: fee.balance,
        openLeads: leadsBy.get(group._id)?.openLeads ?? 0,
        applications: applicationsBy.get(group._id)?.applications ?? 0,
        enrolled: applicationsBy.get(group._id)?.enrolled ?? 0,
      };
    });

    const totals = institutions.reduce(
      (acc, row) => ({
        students: acc.students + row.students,
        staff: acc.staff + row.staff,
        teachingStaff: acc.teachingStaff + row.teachingStaff,
        billed: acc.billed + row.billed,
        collected: acc.collected + row.collected,
        outstanding: acc.outstanding + row.outstanding,
        openLeads: acc.openLeads + row.openLeads,
        applications: acc.applications + row.applications,
        enrolled: acc.enrolled + row.enrolled,
      }),
      {
        students: 0,
        staff: 0,
        teachingStaff: 0,
        billed: 0,
        collected: 0,
        outstanding: 0,
        openLeads: 0,
        applications: 0,
        enrolled: 0,
      }
    );

    return { institutions, totals };
  }

  /**
   * Fee position and sponsor receivables per institution — the view the
   * central finance office works from during a reimbursement cycle.
   */
  async finance(tenantId: string, branchIds: ObjectId[], allowedInstitutionIds?: string[]) {
    const attr = await resolveAttribution(tenantId, branchIds, {
      allowedInstitutionIds,
      load: ['student'],
    });
    const match = branchMatch(tenantId, branchIds);

    const [fees, scholarships, categories] = await Promise.all([
      collections.feeAssignments
        .aggregate([
          { $match: { ...match, status: { $ne: 'cancelled' } } },
          {
            $group: {
              _id: ref('$branchId', '$studentId'),
              billed: { $sum: '$summary.netPayable' },
              paid: { $sum: '$summary.totalPaid' },
              sponsored: { $sum: { $ifNull: ['$summary.sponsoredAmount', 0] } },
              balance: { $sum: '$summary.balance' },
              fines: { $sum: { $ifNull: ['$summary.totalFine', 0] } },
            },
          },
        ])
        .toArray(),
      collections.scholarships
        .aggregate([
          { $match: match },
          {
            $group: {
              _id: ref('$branchId', '$studentId', '$status'),
              sanctioned: { $sum: '$sanctionedAmount' },
              received: {
                $sum: {
                  $reduce: {
                    input: { $ifNull: ['$disbursements', []] },
                    initialValue: 0,
                    in: { $add: ['$$value', '$$this.amount'] },
                  },
                },
              },
              count: { $sum: 1 },
            },
          },
        ])
        .toArray(),
      // Management vs convener/government split — the number a university
      // reconciles state reimbursement against.
      collections.students
        .aggregate([
          { $match: { ...match, status: 'active' } },
          {
            $group: {
              _id: ref('$branchId', '$currentEnrollment.classId', '$admissionCategory'),
              students: { $sum: 1 },
            },
          },
        ])
        .toArray(),
    ]);

    const feesBy = fold(fees, attr, 'student', ['billed', 'paid', 'sponsored', 'balance', 'fines']);

    const scholarshipBy = new Map<
      string,
      { sanctioned: number; received: number; pending: number; count: number }
    >();
    for (const row of scholarships) {
      const id = row._id as { b: unknown; k?: unknown; v?: string };
      const bucket = attr.key(id.b, 'student', id.k);
      if (!bucket) continue;
      const current = scholarshipBy.get(bucket) ?? {
        sanctioned: 0,
        received: 0,
        pending: 0,
        count: 0,
      };
      current.count += Number(row.count ?? 0);
      // Only sanctioned money is receivable — applications still in review
      // and rejections are not counted as owed by the sponsor.
      if (['approved', 'partially_disbursed', 'disbursed'].includes(String(id.v ?? ''))) {
        current.sanctioned += Number(row.sanctioned ?? 0);
        current.received += Number(row.received ?? 0);
      }
      scholarshipBy.set(bucket, current);
    }
    for (const value of scholarshipBy.values()) {
      value.pending = Math.max(0, value.sanctioned - value.received);
    }

    const categoryBy = tally(categories, attr, 'class', 'students');

    const institutions = attr.groups.map((group) => {
      const fee = feesBy.get(group._id) ?? {
        billed: 0,
        paid: 0,
        sponsored: 0,
        balance: 0,
        fines: 0,
      };
      const scholarship = scholarshipBy.get(group._id) ?? {
        sanctioned: 0,
        received: 0,
        pending: 0,
        count: 0,
      };
      return {
        institution: { _id: group._id, name: group.name, code: group.code },
        isCampusLevel: group.isDefault === true,
        billed: fee.billed,
        collected: fee.paid,
        sponsored: fee.sponsored,
        outstanding: fee.balance,
        fines: fee.fines,
        collectionRate: fee.billed > 0 ? Math.round((fee.paid / fee.billed) * 100) : 0,
        scholarships: scholarship,
        admissionCategories: categoryBy.get(group._id) ?? {},
      };
    });

    return { institutions };
  }

  /** Admissions funnel per institution: enquiry stages → application states. */
  async admissions(tenantId: string, branchIds: ObjectId[], allowedInstitutionIds?: string[]) {
    const attr = await resolveAttribution(tenantId, branchIds, { allowedInstitutionIds });
    const match = branchMatch(tenantId, branchIds);

    const [leads, applications] = await Promise.all([
      collections.leads
        .aggregate([
          { $match: match },
          {
            $group: {
              _id: ref('$branchId', '$interestedIn.classId', '$stage'),
              count: { $sum: 1 },
            },
          },
        ])
        .toArray(),
      collections.applications
        .aggregate([
          { $match: match },
          { $group: { _id: ref('$branchId', '$classId', '$status'), count: { $sum: 1 } } },
        ])
        .toArray(),
    ]);

    const leadsBy = tally(leads, attr, 'class');
    const applicationsBy = tally(applications, attr, 'class');

    const institutions = attr.groups.map((group) => {
      const stages = leadsBy.get(group._id) ?? {};
      const statuses = applicationsBy.get(group._id) ?? {};
      const sum = (obj: Record<string, number>) => Object.values(obj).reduce((a, b) => a + b, 0);
      return {
        institution: { _id: group._id, name: group.name, code: group.code },
        isCampusLevel: group.isDefault === true,
        leadStages: stages,
        applicationStatuses: statuses,
        totalLeads: sum(stages),
        totalApplications: sum(statuses),
        enrolled: statuses.enrolled ?? 0,
        // Enquiry → enrolment, the number admissions heads compare across
        // institutions when the university runs one campaign for all of them.
        conversionRate:
          sum(stages) > 0 ? Math.round(((statuses.enrolled ?? 0) / sum(stages)) * 100) : 0,
      };
    });

    return { institutions };
  }

  /** Staff registry + promotion pipeline per institution. */
  async hr(tenantId: string, branchIds: ObjectId[], allowedInstitutionIds?: string[]) {
    const attr = await resolveAttribution(tenantId, branchIds, {
      allowedInstitutionIds,
      load: ['staff'],
    });
    const match = branchMatch(tenantId, branchIds);

    const [staff, designations, promotions, payroll] = await Promise.all([
      collections.staff
        .aggregate([
          { $match: { ...match, status: 'active' } },
          {
            $group: {
              _id: ref('$branchId', '$employment.departmentId'),
              headcount: { $sum: 1 },
              teaching: { $sum: { $cond: ['$teaching.isTeaching', 1, 0] } },
            },
          },
        ])
        .toArray(),
      collections.staff
        .aggregate([
          { $match: { ...match, status: 'active' } },
          {
            $group: {
              _id: ref('$branchId', '$employment.departmentId', '$employment.designationId'),
              count: { $sum: 1 },
            },
          },
        ])
        .toArray(),
      collections.staffPromotions
        .aggregate([
          { $match: match },
          { $group: { _id: ref('$branchId', '$staffId', '$status'), count: { $sum: 1 } } },
        ])
        .toArray(),
      collections.staffSalaryAssignments
        .aggregate([
          { $match: { ...match, status: 'active' } },
          {
            $group: {
              _id: ref('$branchId', '$staffId'),
              monthlyNet: { $sum: { $ifNull: ['$netSalary', 0] } },
              assignments: { $sum: 1 },
            },
          },
        ])
        .toArray(),
    ]);

    const designationIds = [
      ...new Set(
        designations
          .map((d) => (d._id as { v?: ObjectId }).v)
          .filter(Boolean)
          .map((id) => String(id))
      ),
    ];
    const designationDocs = designationIds.length
      ? await collections.designations
          .find({ _id: { $in: designationIds.map((id) => new ObjectId(id)) } })
          .project({ name: 1, level: 1 })
          .toArray()
      : [];
    const designationNames = new Map(
      designationDocs.map((d) => [d._id.toString(), String(d.name)])
    );

    const staffBy = fold(staff, attr, 'department', ['headcount', 'teaching']);
    const payrollBy = fold(payroll, attr, 'staff', ['monthlyNet', 'assignments']);
    const promotionBy = tally(promotions, attr, 'staff');

    const designationBy = new Map<string, Record<string, number>>();
    for (const row of designations) {
      const id = row._id as { b: unknown; k?: unknown; v?: unknown };
      const bucket = attr.key(id.b, 'department', id.k);
      if (!bucket) continue;
      const label = id.v ? (designationNames.get(String(id.v)) ?? 'Unassigned') : 'Unassigned';
      const current = designationBy.get(bucket) ?? {};
      current[label] = (current[label] ?? 0) + Number(row.count ?? 0);
      designationBy.set(bucket, current);
    }

    const institutions = attr.groups.map((group) => ({
      institution: { _id: group._id, name: group.name, code: group.code },
      isCampusLevel: group.isDefault === true,
      headcount: staffBy.get(group._id)?.headcount ?? 0,
      teachingStaff: staffBy.get(group._id)?.teaching ?? 0,
      nonTeachingStaff:
        (staffBy.get(group._id)?.headcount ?? 0) - (staffBy.get(group._id)?.teaching ?? 0),
      byDesignation: designationBy.get(group._id) ?? {},
      promotions: promotionBy.get(group._id) ?? {},
      monthlyPayroll: payrollBy.get(group._id)?.monthlyNet ?? 0,
      salaryAssignments: payrollBy.get(group._id)?.assignments ?? 0,
    }));

    return { institutions };
  }

  /**
   * Academic health per institution — programs, course offerings and mean
   * PO attainment. Academics are decentralized, so this is a read-only
   * accreditation-readiness view, not an operating surface.
   */
  async academics(tenantId: string, branchIds: ObjectId[], allowedInstitutionIds?: string[]) {
    const attr = await resolveAttribution(tenantId, branchIds, {
      allowedInstitutionIds,
      load: ['student', 'obeProgram'],
    });
    const match = branchMatch(tenantId, branchIds);

    const [programs, obePrograms, offerings, attainments, registrations] = await Promise.all([
      collections.programs
        .aggregate([
          { $match: { ...match, status: 'active' } },
          { $group: { _id: ref('$branchId', '$departmentId'), programs: { $sum: 1 } } },
        ])
        .toArray(),
      collections.obePrograms
        .aggregate([
          { $match: match },
          { $group: { _id: ref('$branchId', '$departmentId'), obePrograms: { $sum: 1 } } },
        ])
        .toArray(),
      collections.obeOfferings
        .aggregate([
          { $match: match },
          {
            $group: {
              _id: ref('$branchId', '$programId'),
              offerings: { $sum: 1 },
              finalized: { $sum: { $cond: [{ $eq: ['$status', 'finalized'] }, 1, 0] } },
            },
          },
        ])
        .toArray(),
      collections.obeAttainments
        .aggregate([
          { $match: match },
          { $unwind: '$poAttainment' },
          { $match: { 'poAttainment.attainment': { $ne: null } } },
          {
            $group: {
              _id: ref('$branchId', '$programId'),
              meanPo: { $avg: '$poAttainment.attainment' },
              samples: { $sum: 1 },
            },
          },
        ])
        .toArray(),
      collections.courseRegistrations
        .aggregate([
          { $match: { ...match, status: 'submitted' } },
          { $group: { _id: ref('$branchId', '$studentId'), registrations: { $sum: 1 } } },
        ])
        .toArray(),
    ]);

    const programsBy = fold(programs, attr, 'department', ['programs']);
    const obeBy = fold(obePrograms, attr, 'department', ['obePrograms']);
    const offeringsBy = fold(offerings, attr, 'obeProgram', ['offerings', 'finalized']);
    const registrationsBy = fold(registrations, attr, 'student', ['registrations']);

    // Mean-of-means would double-weight a small program, so the sample counts
    // ride along and the average is re-weighted here.
    const attainmentBy = new Map<string, { sum: number; samples: number }>();
    for (const row of attainments) {
      const id = row._id as { b: unknown; k?: unknown };
      const bucket = attr.key(id.b, 'obeProgram', id.k);
      if (!bucket) continue;
      const samples = Number(row.samples ?? 0);
      const current = attainmentBy.get(bucket) ?? { sum: 0, samples: 0 };
      current.sum += Number(row.meanPo ?? 0) * samples;
      current.samples += samples;
      attainmentBy.set(bucket, current);
    }

    const institutions = attr.groups.map((group) => {
      const attainment = attainmentBy.get(group._id);
      return {
        institution: { _id: group._id, name: group.name, code: group.code },
        isCampusLevel: group.isDefault === true,
        programs: programsBy.get(group._id)?.programs ?? 0,
        obePrograms: obeBy.get(group._id)?.obePrograms ?? 0,
        offerings: offeringsBy.get(group._id)?.offerings ?? 0,
        finalizedOfferings: offeringsBy.get(group._id)?.finalized ?? 0,
        courseRegistrations: registrationsBy.get(group._id)?.registrations ?? 0,
        meanPoAttainment:
          attainment && attainment.samples > 0
            ? Math.round((attainment.sum / attainment.samples) * 100) / 100
            : null,
      };
    });

    return { institutions };
  }
}

export const centralService = new CentralService();

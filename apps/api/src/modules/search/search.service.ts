import { ObjectId, Document, Filter, Collection } from 'mongodb';
import type { Request } from 'express';
import { STUDENT_ROLE_LEVEL } from '@campus-verse/shared/constants';
import { collections } from '../../config/database';
import { hasPermission } from '../../middleware/rbac';
import { getScopedClassIds, getScopedDepartmentIds } from '../../middleware/scope';
import { getStudentVisibilityFilter } from '../teaching/scope';
import { structureScopeFilter } from '../finance/feeStructure.service';

const PER_GROUP = 6;

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const idStr = (v: unknown) => (v ? String(v) : undefined);

/** Every group a result can belong to; the web palette renders each its own way. */
export type SearchGroup =
  | 'students'
  | 'staff'
  | 'receipts'
  | 'admissions'
  | 'academics'
  | 'exams'
  | 'courses'
  | 'transport'
  | 'hostel'
  | 'feeStructures'
  | 'communications'
  | 'campuses';

export interface SearchHit {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  /** Group-specific fields for the palette's custom rows. */
  meta?: Record<string, unknown>;
}

type Can = (module: string, action?: string) => boolean;

/**
 * Global search: one query fanned out to every module the caller can open.
 * Each group is gated by the same permission as its list page and narrowed
 * by the same scope (branch, department/program, a teacher's own sections),
 * so search never shows a row the module itself would hide.
 */
class SearchService {
  async search(req: Request, rawQuery: string): Promise<Partial<Record<SearchGroup, SearchHit[]>>> {
    const q = rawQuery.trim().slice(0, 64);
    const user = req.user;
    // Students find pages, not people: the palette searches their menu locally.
    if (q.length < 2 || !user || (user.roleLevel ?? 99) >= STUDENT_ROLE_LEVEL) return {};

    const can: Can = (module, action = 'view') => hasPermission(user, module, action);
    const contains = new RegExp(escapeRegex(q), 'i');
    const prefix = new RegExp(`^${escapeRegex(q)}`, 'i');
    const tenantId = new ObjectId(req.tenantId!);
    const branchId = req.branchId ? new ObjectId(req.branchId) : null;
    const scoped = branchId ? { tenantId, branchId } : null;

    const tasks: Array<[SearchGroup, Promise<SearchHit[]>]> = [];
    const add = (group: SearchGroup, allowed: boolean, run: () => Promise<SearchHit[]>) => {
      if (allowed) tasks.push([group, run()]);
    };

    if (scoped) {
      add('students', can('students.list') || can('teaching.myStudents'), () =>
        this.students(req, scoped, contains, prefix, q)
      );
      add('staff', can('hr.staff'), () => this.staff(req, scoped, contains, prefix));
      add('receipts', can('finance.feeCounter') || can('finance.reports'), () =>
        this.receipts(scoped, prefix)
      );
      add('admissions', can('admissions.leads') || can('admissions.applications'), () =>
        this.admissions(scoped, contains, prefix, can)
      );
      add(
        'academics',
        can('organization.settings') || can('students.list') || can('registration.registrations'),
        () => this.academics(req, scoped, contains)
      );
      add('exams', can('exams.exams'), () => this.exams(scoped, contains));
      add('courses', can('courses.courses'), () => this.courses(scoped, contains));
      add('transport', can('transport.buses'), () => this.transport(scoped, contains));
      add('hostel', can('hostel.hostels'), () => this.hostels(scoped, contains));
      add('feeStructures', can('finance.feeStructures'), async () =>
        this.feeStructures(
          scoped,
          contains,
          await structureScopeFilter(req.tenantId!, await getScopedClassIds(req))
        )
      );
      add(
        'communications',
        can('communications.announcements') || can('communications.calendar'),
        () => this.communications(tenantId, branchId!, contains, can)
      );
    }
    add('campuses', can('organization.branches'), () => this.campuses(req, tenantId, contains));

    const settled = await Promise.all(tasks.map(([, p]) => p.catch(() => [] as SearchHit[])));
    const out: Partial<Record<SearchGroup, SearchHit[]>> = {};
    tasks.forEach(([group], i) => {
      if (settled[i].length) out[group] = settled[i];
    });
    return out;
  }

  private async students(
    req: Request,
    scoped: { tenantId: ObjectId; branchId: ObjectId },
    contains: RegExp,
    prefix: RegExp,
    q: string
  ): Promise<SearchHit[]> {
    const filter: Filter<Document> = {
      ...scoped,
      $or: [
        { displayName: contains },
        { firstName: contains },
        { lastName: contains },
        { admissionNumber: prefix },
        { rollNumber: prefix },
        { enrollmentCode: prefix },
        { 'contact.phone': contains },
        { 'contact.email': contains },
      ],
    };
    // Same visibility as the student list: scope grant + teaching reach.
    const visibility = await getStudentVisibilityFilter(req);
    if (visibility) filter.$and = [visibility];

    const rows = await collections.students
      .find(filter)
      .project({
        displayName: 1,
        firstName: 1,
        lastName: 1,
        admissionNumber: 1,
        rollNumber: 1,
        photo: 1,
        status: 1,
        'currentEnrollment.className': 1,
        'currentEnrollment.sectionName': 1,
      })
      .limit(40)
      .toArray();

    // An exact roll/admission number is what the user meant: put it first.
    const exact = (r: Document) =>
      [r.rollNumber, r.admissionNumber].some(
        (v) => String(v ?? '').toLowerCase() === q.toLowerCase()
      );
    rows.sort((a, b) => Number(exact(b)) - Number(exact(a)));

    return rows.slice(0, PER_GROUP).map((s) => {
      const name = (s.displayName as string) || `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim();
      return {
        id: String(s._id),
        title: name,
        href: `/students/${s._id}`,
        meta: {
          admissionNumber: s.admissionNumber,
          rollNumber: s.rollNumber,
          className: s.currentEnrollment?.className,
          sectionName: s.currentEnrollment?.sectionName,
          status: s.status,
          photo: s.photo,
          exact: exact(s),
        },
      };
    });
  }

  private async staff(
    req: Request,
    scoped: { tenantId: ObjectId; branchId: ObjectId },
    contains: RegExp,
    prefix: RegExp
  ): Promise<SearchHit[]> {
    const filter: Filter<Document> = {
      ...scoped,
      $or: [
        { displayName: contains },
        { firstName: contains },
        { lastName: contains },
        { employeeId: prefix },
        { 'contact.email': contains },
        { 'contact.phone': contains },
      ],
    };
    const departmentIds = await getScopedDepartmentIds(req);
    if (departmentIds) filter['employment.departmentId'] = { $in: departmentIds };

    const rows = await collections.staff
      .find(filter)
      .project({
        displayName: 1,
        firstName: 1,
        lastName: 1,
        employeeId: 1,
        photo: 1,
        status: 1,
        'contact.email': 1,
        'employment.departmentId': 1,
        'employment.designationId': 1,
      })
      .limit(PER_GROUP)
      .toArray();

    const [departments, designations] = await Promise.all([
      this.namesById(
        collections.departments,
        rows.map((r) => r.employment?.departmentId)
      ),
      this.namesById(
        collections.designations,
        rows.map((r) => r.employment?.designationId)
      ),
    ]);

    return rows.map((s) => ({
      id: String(s._id),
      title: (s.displayName as string) || `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim(),
      href: `/hr/staff/${s._id}`,
      meta: {
        employeeId: s.employeeId,
        email: s.contact?.email,
        department: departments.get(idStr(s.employment?.departmentId) ?? ''),
        designation: designations.get(idStr(s.employment?.designationId) ?? ''),
        status: s.status,
        photo: s.photo,
      },
    }));
  }

  private async receipts(
    scoped: { tenantId: ObjectId; branchId: ObjectId },
    prefix: RegExp
  ): Promise<SearchHit[]> {
    const rows = await collections.feeTransactions
      .find({ ...scoped, receiptNumber: prefix })
      .project({
        receiptNumber: 1,
        totalAmount: 1,
        receiptDate: 1,
        paymentMode: 1,
        status: 1,
        studentId: 1,
      })
      .sort({ receiptDate: -1 })
      .limit(PER_GROUP)
      .toArray();
    const students = await this.namesById(
      collections.students,
      rows.map((r) => r.studentId),
      'displayName'
    );
    return rows.map((t) => ({
      id: String(t._id),
      title: t.receiptNumber as string,
      subtitle: students.get(idStr(t.studentId) ?? ''),
      href: `/students/${t.studentId}?tab=fees`,
      meta: {
        amount: t.totalAmount,
        date: t.receiptDate,
        mode: t.paymentMode,
        status: t.status,
      },
    }));
  }

  private async admissions(
    scoped: { tenantId: ObjectId; branchId: ObjectId },
    contains: RegExp,
    prefix: RegExp,
    can: Can
  ): Promise<SearchHit[]> {
    const [leads, applications] = await Promise.all([
      can('admissions.leads')
        ? collections.leads
            .find({
              ...scoped,
              $or: [
                { firstName: contains },
                { lastName: contains },
                { leadNumber: prefix },
                { 'contact.phone': contains },
                { 'contact.email': contains },
              ],
            })
            .project({ firstName: 1, lastName: 1, leadNumber: 1, stage: 1, 'contact.phone': 1 })
            .limit(PER_GROUP)
            .toArray()
        : [],
      can('admissions.applications')
        ? collections.applications
            .find({
              ...scoped,
              $or: [
                { applicationNumber: prefix },
                { 'student.firstName': contains },
                { 'student.lastName': contains },
                { 'contact.phone': contains },
              ],
            })
            .project({
              applicationNumber: 1,
              'student.firstName': 1,
              'student.lastName': 1,
              status: 1,
            })
            .limit(PER_GROUP)
            .toArray()
        : [],
    ]);

    return [
      ...applications.map((a) => ({
        id: String(a._id),
        title: `${a.student?.firstName ?? ''} ${a.student?.lastName ?? ''}`.trim(),
        href: `/admissions/applications/${a._id}`,
        meta: { kind: 'application', number: a.applicationNumber, stage: a.status },
      })),
      ...leads.map((l) => ({
        id: String(l._id),
        title: `${l.firstName ?? ''} ${l.lastName ?? ''}`.trim(),
        href: `/admissions/leads?q=${encodeURIComponent((l.leadNumber as string) ?? '')}`,
        meta: { kind: 'lead', number: l.leadNumber, stage: l.stage, phone: l.contact?.phone },
      })),
    ].slice(0, PER_GROUP);
  }

  /** Programs (course names), subjects, departments and classes. */
  private async academics(
    req: Request,
    scoped: { tenantId: ObjectId; branchId: ObjectId },
    contains: RegExp
  ): Promise<SearchHit[]> {
    const byNameOrCode = { $or: [{ name: contains }, { code: contains }] };
    const active = { status: { $ne: 'inactive' } };
    const classIds = await getScopedClassIds(req);

    const [programs, subjects, departments, classes] = await Promise.all([
      collections.programs
        .find({ ...scoped, ...active, ...byNameOrCode })
        .project({ name: 1, code: 1, degreeType: 1, durationYears: 1, totalSemesters: 1 })
        .limit(4)
        .toArray(),
      collections.subjects
        .find({
          ...scoped,
          ...active,
          $or: [{ name: contains }, { code: contains }, { shortName: contains }],
        })
        .project({ name: 1, code: 1, type: 1, credits: 1 })
        .limit(4)
        .toArray(),
      collections.departments
        .find({ ...scoped, ...active, ...byNameOrCode })
        .project({ name: 1, code: 1 })
        .limit(3)
        .toArray(),
      collections.classes
        .find({
          ...scoped,
          ...active,
          displayName: contains,
          ...(classIds && { _id: { $in: classIds } }),
        })
        .project({ displayName: 1, capacity: 1 })
        .limit(4)
        .toArray(),
    ]);

    return [
      ...programs.map((p) => ({
        id: String(p._id),
        title: p.name as string,
        href: '/organization/programs',
        meta: {
          kind: 'program',
          code: p.code,
          degreeType: p.degreeType,
          years: p.durationYears,
          terms: p.totalSemesters,
        },
      })),
      ...subjects.map((s) => ({
        id: String(s._id),
        title: s.name as string,
        href: '/organization/academic-structure',
        meta: { kind: 'subject', code: s.code, type: s.type, credits: s.credits },
      })),
      ...departments.map((d) => ({
        id: String(d._id),
        title: d.name as string,
        href: '/organization/departments',
        meta: { kind: 'department', code: d.code },
      })),
      ...classes.map((c) => ({
        id: String(c._id),
        title: c.displayName as string,
        href: `/students?classId=${c._id}`,
        meta: { kind: 'class' },
      })),
    ].slice(0, PER_GROUP + 2);
  }

  private async exams(scoped: { tenantId: ObjectId; branchId: ObjectId }, contains: RegExp) {
    const rows = await collections.exams
      .find({ ...scoped, name: contains })
      .project({ name: 1, status: 1, startDate: 1, examType: 1 })
      .sort({ createdAt: -1 })
      .limit(PER_GROUP)
      .toArray();
    return rows.map((e) => ({
      id: String(e._id),
      title: e.name as string,
      href: `/exams/${e._id}`,
      meta: { status: e.status, date: e.startDate, type: e.examType },
    }));
  }

  private async courses(scoped: { tenantId: ObjectId; branchId: ObjectId }, contains: RegExp) {
    const rows = await collections.courses
      .find({ ...scoped, title: contains })
      .project({ title: 1, status: 1, enrolledCount: 1 })
      .limit(PER_GROUP)
      .toArray();
    return rows.map((c) => ({
      id: String(c._id),
      title: c.title as string,
      href: `/courses/${c._id}`,
      meta: { status: c.status, enrolled: c.enrolledCount },
    }));
  }

  private async transport(scoped: { tenantId: ObjectId; branchId: ObjectId }, contains: RegExp) {
    const rows = await collections.transportBuses
      .find({
        ...scoped,
        $or: [
          { busNumber: contains },
          { name: contains },
          { vehicleRegistration: contains },
          { driverName: contains },
          { 'stops.name': contains },
        ],
      })
      .project({
        busNumber: 1,
        name: 1,
        capacity: 1,
        enrolledCount: 1,
        driverName: 1,
        status: 1,
        'stops.name': 1,
      })
      .limit(PER_GROUP)
      .toArray();
    return rows.map((b) => ({
      id: String(b._id),
      title: b.busNumber as string,
      subtitle: b.name as string,
      href: `/transport/buses/${b._id}`,
      meta: {
        capacity: b.capacity,
        enrolled: b.enrolledCount ?? 0,
        driver: b.driverName,
        stops: (b.stops ?? []).length,
        matchedStop: (b.stops ?? []).find((s: { name?: string }) => contains.test(s.name ?? ''))
          ?.name,
        status: b.status,
      },
    }));
  }

  private async hostels(scoped: { tenantId: ObjectId; branchId: ObjectId }, contains: RegExp) {
    const rows = await collections.hostels
      .find({ ...scoped, $or: [{ name: contains }, { code: contains }] })
      .project({ name: 1, code: 1, type: 1, totalBeds: 1, occupiedBeds: 1 })
      .limit(PER_GROUP)
      .toArray();
    return rows.map((h) => ({
      id: String(h._id),
      title: h.name as string,
      href: `/hostel/hostels/${h._id}`,
      meta: { code: h.code, type: h.type, beds: h.totalBeds, occupied: h.occupiedBeds },
    }));
  }

  private async feeStructures(
    scoped: { tenantId: ObjectId; branchId: ObjectId },
    contains: RegExp,
    scopeFilter: Filter<Document> | null
  ) {
    const rows = await collections.feeStructures
      .find({
        ...scoped,
        isActive: true,
        // Per-student hostel/transport fares are noise here.
        category: { $nin: ['hostel', 'transport'] },
        $and: [
          { $or: [{ name: contains }, { code: contains }] },
          ...(scopeFilter ? [scopeFilter] : []),
        ],
      })
      .project({ name: 1, code: 1, totalAmount: 1, category: 1 })
      .limit(PER_GROUP)
      .toArray();
    return rows.map((f) => ({
      id: String(f._id),
      title: f.name as string,
      href: '/finance/fee-structures',
      meta: { code: f.code, amount: f.totalAmount, category: f.category },
    }));
  }

  private async communications(tenantId: ObjectId, branchId: ObjectId, contains: RegExp, can: Can) {
    const audience = { $or: [{ branchId }, { 'audience.branchIds': branchId }] };
    const [announcements, events] = await Promise.all([
      can('communications.announcements')
        ? collections.announcements
            .find({ tenantId, ...audience, title: contains })
            .project({ title: 1, status: 1, publishedAt: 1, priority: 1 })
            .sort({ createdAt: -1 })
            .limit(4)
            .toArray()
        : [],
      can('communications.calendar')
        ? collections.events
            .find({ tenantId, ...audience, title: contains })
            .project({ title: 1, startDate: 1, type: 1 })
            .sort({ startDate: -1 })
            .limit(4)
            .toArray()
        : [],
    ]);
    return [
      ...announcements.map((a) => ({
        id: String(a._id),
        title: a.title as string,
        href: '/communications/announcements',
        meta: { kind: 'announcement', status: a.status, date: a.publishedAt, priority: a.priority },
      })),
      ...events.map((e) => ({
        id: String(e._id),
        title: e.title as string,
        href: '/communications/calendar',
        meta: { kind: 'event', date: e.startDate, type: e.type },
      })),
    ];
  }

  /** Campuses the caller can switch to (the palette switches branch on select). */
  private async campuses(req: Request, tenantId: ObjectId, contains: RegExp) {
    const scope = req.user?.accessScope;
    const filter: Filter<Document> = {
      tenantId,
      $or: [{ name: contains }, { code: contains }, { 'location.city': contains }],
    };
    if (scope && scope.type !== 'global' && scope.branchIds?.length) {
      filter._id = { $in: scope.branchIds.map((id: string) => new ObjectId(id)) };
    }
    const rows = await collections.branches
      .find(filter)
      .project({ name: 1, code: 1, institutionType: 1, 'location.city': 1 })
      .limit(4)
      .toArray();
    return rows.map((b) => ({
      id: String(b._id),
      title: b.name as string,
      href: '/organization/branches',
      meta: { code: b.code, type: b.institutionType, city: b.location?.city },
    }));
  }

  private async namesById(
    collection: Collection<Document>,
    ids: unknown[],
    field = 'name'
  ): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter(Boolean).map(String))];
    if (!unique.length) return new Map();
    const rows = await collection
      .find({ _id: { $in: unique.map((id) => new ObjectId(id)) } })
      .project({ [field]: 1 })
      .toArray();
    return new Map(rows.map((r) => [String(r._id), r[field] as string]));
  }
}

export const searchService = new SearchService();

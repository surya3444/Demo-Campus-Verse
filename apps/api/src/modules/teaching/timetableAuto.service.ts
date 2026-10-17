import { ObjectId, Document } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { academicBatchService } from '../organization/academicBatch.service';
import { termNumbersForClasses } from '../organization/termNumbering';
import { getElectiveSubjectIds } from './scope';
import {
  solveTimetable,
  type SolverFixed,
  type SolverSection,
  type SolverUnit,
  type UnplacedReason,
} from './timetableSolver';

export interface GenerateTimetableInput {
  programId?: string;
  departmentId?: string;
  classIds?: string[];
  days: number[];
  maxPerDay: number;
  /** fill: keep what's already scheduled and fill the gaps; fresh: rebuild the week. */
  mode: 'fill' | 'fresh';
  seed: number;
  apply: boolean;
}

const LAB_BLOCK = 2;
const REASON: Record<UnplacedReason | 'NO_TEACHER', string> = {
  NO_TEACHER: 'No teacher assigned',
  NO_PERIODS: 'The year has no periods set up',
  SECTION_FULL: "The section's week is full",
  TEACHER_BUSY: "The teacher's free time never matches the section's",
};

const nameOf = (t?: Document | null) =>
  (t?.displayName as string) || `${t?.firstName ?? ''} ${t?.lastName ?? ''}`.trim() || 'Teacher';
const oids = (ids: Iterable<string>) => [...new Set(ids)].map((id) => new ObjectId(id));

/**
 * Weekly load of a subject in a section: L-T-P from the curriculum when set,
 * else the section's periods-per-week. Practical hours become lab blocks.
 */
function weeklyLoad(
  subject: Document | undefined,
  periodsPerWeek?: number
): { theory: number; lab: number } {
  const ltp = subject?.ltp as
    | { lecture?: number; tutorial?: number; practical?: number }
    | undefined;
  const type = subject?.type as string | undefined;
  if (ltp && (ltp.lecture || ltp.tutorial || ltp.practical)) {
    return { theory: (ltp.lecture ?? 0) + (ltp.tutorial ?? 0), lab: ltp.practical ?? 0 };
  }
  const n = periodsPerWeek || Math.round((subject?.credits as number) || 0) || 3;
  return type === 'practical' ? { theory: 0, lab: n } : { theory: n, lab: 0 };
}

class TimetableAutoService {
  async generate(
    tenantId: string,
    branchId: string,
    userId: string,
    input: GenerateTimetableInput
  ) {
    const started = Date.now();
    const tenantOid = new ObjectId(tenantId);
    const branchOid = new ObjectId(branchId);

    const year = await academicBatchService.getCurrent(tenantId, branchId);
    if (!year) throw new ApiError('NO_CURRENT_YEAR', 'Set a current academic year first', 400);

    const classes = await collections.classes
      .find({
        tenantId: tenantOid,
        branchId: branchOid,
        academicBatchId: new ObjectId(year._id),
        status: { $ne: 'inactive' },
        ...(input.programId && { programId: new ObjectId(input.programId) }),
        ...(input.departmentId && { departmentId: new ObjectId(input.departmentId) }),
        ...(input.classIds?.length && { _id: { $in: oids(input.classIds) } }),
      })
      .project({ displayName: 1 })
      .toArray();
    if (!classes.length) {
      throw new ApiError('NOTHING_TO_GENERATE', 'No years found for that program/department', 404);
    }
    const classIds = classes.map((c) => c._id as ObjectId);
    const className = new Map(
      classes.map((c) => [
        String(c._id),
        String(c.displayName ?? '')
          .split(' · ')
          .slice(-2)
          .join(' · '),
      ])
    );

    const [sections, slots, electives, termNo] = await Promise.all([
      collections.sections
        .find({ tenantId: tenantOid, classId: { $in: classIds }, status: { $ne: 'inactive' } })
        .project({ name: 1, classId: 1, batches: 1, subjects: 1 })
        .toArray(),
      collections.timetableSlots
        .find({ tenantId: tenantOid, classId: { $in: classIds }, status: { $ne: 'inactive' } })
        .toArray(),
      getElectiveSubjectIds(tenantId, branchId),
      this.termNumbers(classIds, year as unknown as Document),
    ]);
    const sectionIds = sections.map((s) => s._id as ObjectId);
    const sectionKeys = new Set(sectionIds.map(String));

    // Each section's day: the year's periods plus any of its own.
    const solverSections: SolverSection[] = sections.map((s) => ({
      id: String(s._id),
      slots: slots
        .filter(
          (x) =>
            String(x.classId) === String(s.classId) &&
            (!x.sectionId || String(x.sectionId) === String(s._id))
        )
        .sort(
          (a, b) =>
            (a.order as number) - (b.order as number) ||
            String(a.startTime).localeCompare(String(b.startTime))
        )
        .map((x) => ({
          id: String(x._id),
          start: x.startTime as string,
          end: x.endTime as string,
          type: x.type as string,
          name: x.name as string,
        })),
    }));
    const slotById = new Map(slots.map((x) => [String(x._id), x]));

    // This semester's subjects only (a Year-N section lists both of its semesters).
    const sectionSubjects = sections.flatMap((s) =>
      (
        (s.subjects ?? []) as Array<{
          subjectId: ObjectId;
          teacherId?: ObjectId;
          periodsPerWeek?: number;
          semesterNumber?: number;
        }>
      )
        .filter((x) => {
          const want = termNo.get(String(s.classId));
          return x.semesterNumber === undefined || want === undefined || x.semesterNumber === want;
        })
        .filter((x) => !electives.has(String(x.subjectId)))
        .map((x) => ({ section: s, ...x }))
    );

    const [subjects, assignments] = await Promise.all([
      collections.subjects
        .find({ _id: { $in: sectionSubjects.map((x) => x.subjectId) } })
        .project({ name: 1, code: 1, shortName: 1, type: 1, ltp: 1, credits: 1 })
        .toArray(),
      collections.teachingAssignments
        .find({ tenantId: tenantOid, sectionId: { $in: sectionIds }, status: 'active' })
        .project({ staffId: 1, subjectId: 1, sectionId: 1, batchIds: 1, role: 1 })
        .toArray(),
    ]);
    const subjectById = new Map(subjects.map((x) => [String(x._id), x]));
    const teacherFor = (sectionId: string, subjectId: string, lab: boolean, batchId?: string) => {
      const mine = assignments.filter(
        (a) => String(a.sectionId) === sectionId && String(a.subjectId) === subjectId
      );
      const forBatch = (a: Document) =>
        !batchId ||
        !(a.batchIds as ObjectId[] | undefined)?.length ||
        (a.batchIds as ObjectId[]).some((b) => String(b) === batchId);
      const pick =
        (lab && mine.find((a) => a.role === 'lab' && forBatch(a))) ||
        mine.find((a) => a.role === 'primary') ||
        mine.find((a) => a.role !== 'assistant');
      return pick ? String(pick.staffId) : undefined;
    };

    // ---- What's already in the week ----
    const teacherIds = new Set<string>(assignments.map((a) => String(a.staffId)));
    for (const x of sectionSubjects) if (x.teacherId) teacherIds.add(String(x.teacherId));
    const existing = await collections.timetableEntries
      .find({
        tenantId: tenantOid,
        dayOfWeek: { $in: input.days },
        $or: [{ sectionId: { $in: sectionIds } }, { teacherId: { $in: oids(teacherIds) } }],
      })
      .toArray();
    const missingSlots = existing.map((e) => String(e.slotId)).filter((id) => !slotById.has(id));
    if (missingSlots.length) {
      for (const x of await collections.timetableSlots
        .find({ _id: { $in: oids(missingSlots) } })
        .toArray()) {
        slotById.set(String(x._id), x);
      }
    }
    // In a fresh build the plain classes of these sections are replaced;
    // electives and combined classes are always kept.
    const replaceable = (e: Document) =>
      input.mode === 'fresh' &&
      sectionKeys.has(String(e.sectionId)) &&
      e.isMandatory !== false &&
      !(e.linkedSectionIds as ObjectId[] | undefined)?.length &&
      !electives.has(String(e.subjectId));
    // Who teaches it in today's timetable — the last place to find a teacher.
    const timetableTeacher = new Map<string, string>();
    for (const e of existing) {
      if (sectionKeys.has(String(e.sectionId))) {
        timetableTeacher.set(
          `${e.sectionId}|${e.subjectId}|${e.batchId ?? ''}`,
          String(e.teacherId)
        );
      }
    }
    const kept = existing.filter((e) => !replaceable(e));
    const replaced = existing.filter(replaceable);

    const fixed: SolverFixed[] = kept.flatMap((e) => {
      const slot = slotById.get(String(e.slotId));
      if (!slot) return [];
      const inScope = sectionKeys.has(String(e.sectionId));
      return [
        {
          teacherId: String(e.teacherId),
          day: e.dayOfWeek as number,
          start: slot.startTime as string,
          end: slot.endTime as string,
          ...(inScope && {
            sectionId: String(e.sectionId),
            slotId: String(e.slotId),
            batchId: e.batchId ? String(e.batchId) : null,
            subjectId: String(e.subjectId),
          }),
        },
      ];
    });
    // Periods already scheduled count towards the weekly load (fill mode).
    const done = new Map<string, number>();
    for (const e of kept) {
      if (!sectionKeys.has(String(e.sectionId))) continue;
      const k = `${e.sectionId}|${e.subjectId}|${e.batchId ?? ''}`;
      done.set(k, (done.get(k) ?? 0) + 1);
    }

    // ---- Demand ----
    const units: SolverUnit[] = [];
    const noTeacher: Array<{
      sectionId: string;
      subjectId: string;
      periods: number;
      batch?: string;
    }> = [];
    for (const x of sectionSubjects) {
      const sectionId = String(x.section._id);
      const subjectId = String(x.subjectId);
      const load = weeklyLoad(subjectById.get(subjectId), x.periodsPerWeek);
      const batches = (x.section.batches ?? []) as Array<{ _id: ObjectId; name: string }>;
      let already = done.get(`${sectionId}|${subjectId}|`) ?? 0;

      const theoryLeft = Math.max(0, load.theory - already);
      already = Math.max(0, already - load.theory);
      const theoryTeacher =
        teacherFor(sectionId, subjectId, false) ??
        (x.teacherId ? String(x.teacherId) : undefined) ??
        timetableTeacher.get(`${sectionId}|${subjectId}|`);
      if (theoryLeft && !theoryTeacher)
        noTeacher.push({ sectionId, subjectId, periods: theoryLeft });
      else {
        for (let i = 0; i < theoryLeft; i++) {
          units.push({
            key: `${sectionId}:${subjectId}:t${i}`,
            sectionId,
            subjectId,
            teacherId: theoryTeacher!,
            length: 1,
            kind: 'theory',
          });
        }
      }

      if (!load.lab) continue;
      const groups = batches.length
        ? batches.map((b) => ({ id: String(b._id), name: b.name }))
        : [{ id: undefined as string | undefined, name: undefined as string | undefined }];
      for (const g of groups) {
        const left = g.id
          ? Math.max(0, load.lab - (done.get(`${sectionId}|${subjectId}|${g.id}`) ?? 0))
          : Math.max(0, load.lab - already);
        if (!left) continue;
        const teacher =
          teacherFor(sectionId, subjectId, true, g.id) ??
          timetableTeacher.get(`${sectionId}|${subjectId}|${g.id ?? ''}`) ??
          (x.teacherId ? String(x.teacherId) : undefined);
        if (!teacher) {
          noTeacher.push({ sectionId, subjectId, periods: left, batch: g.name });
          continue;
        }
        // Practical hours run in double-period blocks; an odd hour is a single.
        for (let i = 0, n = 0; n < left; i++) {
          const length = Math.min(LAB_BLOCK, left - n);
          n += length;
          units.push({
            key: `${sectionId}:${subjectId}:l${g.id ?? ''}:${i}`,
            sectionId,
            subjectId,
            teacherId: teacher,
            batchId: g.id,
            length,
            kind: 'lab',
          });
        }
      }
    }

    const result = solveTimetable(solverSections, units, fixed, {
      days: input.days,
      maxPerDay: input.maxPerDay,
      seed: input.seed,
    });
    const unitByKey = new Map(units.map((u) => [u.key, u]));

    // ---- Write ----
    let written = 0;
    if (input.apply) {
      if (replaced.length) {
        await collections.timetableEntries.deleteMany({
          _id: { $in: replaced.map((e) => e._id as ObjectId) },
        });
      }
      const now = new Date();
      const groupOf = new Map<string, string>();
      const docs = result.placements.flatMap((p) => {
        const u = unitByKey.get(p.unitKey)!;
        return p.slotIds.map((slotId) => {
          const cell = `${u.sectionId}|${slotId}|${p.day}`;
          if (!groupOf.has(cell)) groupOf.set(cell, new ObjectId().toString());
          return {
            _id: new ObjectId(),
            tenantId: tenantOid,
            branchId: branchOid,
            sectionId: new ObjectId(u.sectionId),
            subjectId: new ObjectId(u.subjectId),
            teacherId: new ObjectId(u.teacherId),
            ...(u.batchId && { batchId: new ObjectId(u.batchId) }),
            slotId: new ObjectId(slotId),
            dayOfWeek: p.day,
            groupId: groupOf.get(cell)!,
            isMandatory: true,
            generated: true,
            createdBy: new ObjectId(userId),
            createdAt: now,
            updatedAt: now,
          };
        });
      });
      if (docs.length) await collections.timetableEntries.insertMany(docs);
      written = docs.length;
      logger.info(
        { tenantId, branchId, written, replaced: replaced.length, seed: input.seed },
        'Timetable auto-generated'
      );
    }

    // ---- Preview ----
    const staffIds = new Set<string>([
      ...units.map((u) => u.teacherId),
      ...kept.filter((e) => sectionKeys.has(String(e.sectionId))).map((e) => String(e.teacherId)),
    ]);
    const extraSubjects = kept
      .filter((e) => sectionKeys.has(String(e.sectionId)))
      .map((e) => String(e.subjectId))
      .filter((id) => !subjectById.has(id));
    const [staff, more] = await Promise.all([
      collections.staff
        .find({ _id: { $in: oids(staffIds) } })
        .project({ displayName: 1, firstName: 1, lastName: 1 })
        .toArray(),
      extraSubjects.length
        ? collections.subjects
            .find({ _id: { $in: oids(extraSubjects) } })
            .project({ name: 1, code: 1, shortName: 1 })
            .toArray()
        : Promise.resolve([] as Document[]),
    ]);
    for (const s of more) subjectById.set(String(s._id), s);
    const staffName = new Map(staff.map((t) => [String(t._id), nameOf(t)]));
    const batchName = new Map(
      sections.flatMap((s) =>
        ((s.batches ?? []) as Array<{ _id: ObjectId; name: string }>).map((b) => [
          String(b._id),
          b.name,
        ])
      )
    );
    const subjectInfo = (id: string) => {
      const s = subjectById.get(id);
      return {
        subjectId: id,
        subjectName: (s?.name as string) ?? 'Subject',
        subjectCode: (s?.code as string) || (s?.shortName as string) || '',
      };
    };

    type Cell = ReturnType<typeof subjectInfo> & {
      slotId: string;
      day: number;
      teacherName: string;
      batchName: string | null;
      kind: 'theory' | 'lab';
      isNew: boolean;
    };
    const cells = new Map<string, Cell[]>(sectionIds.map((id) => [String(id), []]));
    for (const e of kept) {
      if (!sectionKeys.has(String(e.sectionId))) continue;
      cells.get(String(e.sectionId))!.push({
        ...subjectInfo(String(e.subjectId)),
        slotId: String(e.slotId),
        day: e.dayOfWeek as number,
        teacherName: staffName.get(String(e.teacherId)) ?? '',
        batchName: e.batchId ? (batchName.get(String(e.batchId)) ?? null) : null,
        kind: e.batchId ? 'lab' : 'theory',
        isNew: false,
      });
    }
    const teacherLoad = new Map<string, { periods: number; days: Map<number, number> }>();
    const addLoad = (t: string, day: number, n: number) => {
      let l = teacherLoad.get(t);
      if (!l) teacherLoad.set(t, (l = { periods: 0, days: new Map() }));
      l.periods += n;
      l.days.set(day, (l.days.get(day) ?? 0) + n);
    };
    for (const e of kept)
      if (staffIds.has(String(e.teacherId))) addLoad(String(e.teacherId), e.dayOfWeek as number, 1);
    for (const p of result.placements) {
      const u = unitByKey.get(p.unitKey)!;
      addLoad(u.teacherId, p.day, p.slotIds.length);
      for (const slotId of p.slotIds) {
        cells.get(u.sectionId)!.push({
          ...subjectInfo(u.subjectId),
          slotId,
          day: p.day,
          teacherName: staffName.get(u.teacherId) ?? '',
          batchName: u.batchId ? (batchName.get(u.batchId) ?? null) : null,
          kind: u.kind,
          isNew: true,
        });
      }
    }

    const sectionLabel = (id: string) => {
      const s = sections.find((x) => String(x._id) === id)!;
      return `${className.get(String(s.classId)) ?? ''} · ${s.name}`;
    };
    const demand = units.reduce((n, u) => n + u.length, 0);
    const placed = result.placements.reduce((n, p) => n + p.slotIds.length, 0);

    return {
      applied: input.apply,
      written,
      replaced: input.apply ? replaced.length : 0,
      seed: input.seed,
      stats: {
        sections: sections.length,
        years: classes.length,
        teachers: teacherLoad.size,
        demand,
        placed,
        kept: kept.filter((e) => sectionKeys.has(String(e.sectionId))).length,
        labBlocks: result.placements.filter((p) => unitByKey.get(p.unitKey)!.kind === 'lab').length,
        attempts: result.attempts,
        ms: Date.now() - started,
      },
      sections: solverSections
        .map((s) => ({
          sectionId: s.id,
          label: sectionLabel(s.id),
          slots: (s.slots as Array<(typeof s.slots)[number] & { name?: string }>).map((x) => ({
            _id: x.id,
            name: x.name ?? '',
            startTime: x.start,
            endTime: x.end,
            type: x.type,
          })),
          cells: cells.get(s.id) ?? [],
        }))
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })),
      teachers: [...teacherLoad]
        .map(([id, l]) => ({
          teacherId: id,
          name: staffName.get(id) ?? 'Teacher',
          periods: l.periods,
          busiestDay: Math.max(0, ...l.days.values()),
        }))
        .sort((a, b) => b.periods - a.periods),
      unplaced: [
        ...noTeacher.map((x) => ({
          section: sectionLabel(x.sectionId),
          ...subjectInfo(x.subjectId),
          batchName: x.batch ?? null,
          periods: x.periods,
          reason: REASON.NO_TEACHER,
        })),
        ...result.unplaced.map((x) => {
          const u = unitByKey.get(x.unitKey)!;
          return {
            section: sectionLabel(u.sectionId),
            ...subjectInfo(u.subjectId),
            batchName: u.batchId ? (batchName.get(u.batchId) ?? null) : null,
            periods: u.length,
            reason: REASON[x.reason],
          };
        }),
      ],
    };
  }

  /** Semester each year is in now: the current term's half, else the calendar. */
  private async termNumbers(classIds: ObjectId[], year: Document) {
    const now = new Date();
    const terms = (year.terms ?? []) as Array<{
      half?: 'odd' | 'even';
      startDate: string;
      endDate: string;
    }>;
    const term = terms.find((t) => new Date(t.startDate) <= now && now <= new Date(t.endDate));
    const half = term?.half ?? (now.getMonth() >= 6 ? 'odd' : 'even');
    return termNumbersForClasses(classIds, { half, pattern: 'semester' });
  }
}

export const timetableAutoService = new TimetableAutoService();

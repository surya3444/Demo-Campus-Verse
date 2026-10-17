import { ObjectId, WithId, Document, Filter, UpdateFilter } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { resolveDepartmentIdByCode } from '../hr/department.service';
import { isSubjectUsableByDepartment, yearTermRanges } from '@campus-verse/shared/utils';
import {
  CreateSchemeInput,
  UpdateSchemeInput,
  CloneSchemeInput,
  SchemeSlotInput,
} from '@campus-verse/shared';

/**
 * Program schemes — the published curriculum for one department × semester.
 * Cores are fixed subjects; baskets are "choose N of M" elective groups whose
 * options carry seat caps. `seatsTaken` counters on basket options are
 * maintained atomically by registration.service — this service only ever
 * writes them as 0 (a scheme's slots can't change once registrations exist).
 */

interface SchemeBasketOptionDoc {
  subjectId: ObjectId;
  credits: number;
  seatCap?: number;
  seatsTaken: number;
}

interface SchemeSlotDoc {
  slotId: string;
  kind: 'core' | 'basket';
  category?: string;
  // core
  subjectId?: ObjectId;
  credits?: number;
  // basket
  label?: string;
  chooseCount?: number;
  options?: SchemeBasketOptionDoc[];
}

export interface SchemeDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  departmentCode: string;
  /** Phase-5 re-key: FK → departments, resolved from departmentCode; the string stays canonical. */
  departmentId?: ObjectId;
  departmentName: string;
  /**
   * FK → programs. Set when the curriculum belongs to one degree program
   * ("B.Tech CSE (AI & ML)") rather than the whole department. Absent on
   * every scheme authored before programs existed, which stays valid: those
   * match any student of the department.
   */
  programId?: ObjectId;
  programName?: string;
  semesterNumber: number;
  slots: SchemeSlotDoc[];
  minCredits: number;
  maxCredits: number;
  status: 'draft' | 'published' | 'archived';
  publishedAt?: Date;
  createdBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/** Build slot subdocuments from validated input, assigning stable slotIds. */
function buildSlots(slots: SchemeSlotInput[], existing?: SchemeSlotDoc[]): SchemeSlotDoc[] {
  return slots.map((slot, i) => {
    // Preserve the slotId of the slot at the same position when editing so
    // draft iterations don't churn ids; new positions get fresh ids.
    const slotId = existing?.[i]?.slotId ?? new ObjectId().toHexString();
    if (slot.kind === 'core') {
      return {
        slotId,
        kind: 'core' as const,
        ...(slot.category && { category: slot.category }),
        subjectId: new ObjectId(slot.subjectId),
        credits: slot.credits,
      };
    }
    return {
      slotId,
      kind: 'basket' as const,
      label: slot.label,
      ...(slot.category && { category: slot.category }),
      chooseCount: slot.chooseCount,
      options: slot.options.map((o) => ({
        subjectId: new ObjectId(o.subjectId),
        credits: o.credits,
        ...(o.seatCap !== undefined && o.seatCap > 0 && { seatCap: o.seatCap }),
        seatsTaken: 0,
      })),
    };
  });
}

/** Every subjectId referenced by the slots, for existence validation. */
function collectSubjectIds(slots: SchemeSlotInput[]): ObjectId[] {
  return slots.flatMap((slot) =>
    slot.kind === 'core'
      ? [new ObjectId(slot.subjectId)]
      : slot.options.map((o) => new ObjectId(o.subjectId))
  );
}

/** Minimum total credits a student can register under this scheme. */
export function schemeMinPossibleCredits(slots: SchemeSlotDoc[]): number {
  return slots.reduce((sum, slot) => {
    if (slot.kind === 'core') return sum + (slot.credits ?? 0);
    const sorted = [...(slot.options ?? [])].sort((a, b) => a.credits - b.credits);
    return sum + sorted.slice(0, slot.chooseCount ?? 1).reduce((s, o) => s + o.credits, 0);
  }, 0);
}

class SchemeService {
  /**
   * Resolve a program FK, checking it lives in this branch and — when the
   * scheme also resolved a department — that the two agree. A scheme keyed
   * to "B.Tech CSE (AI & ML)" under the Mechanical department is a typo, not
   * a curriculum.
   */
  private async assertProgram(
    tenantId: string,
    branchId: string,
    programId: string,
    departmentId?: ObjectId | null,
    semesterNumber?: number
  ): Promise<{ _id: ObjectId; name: string; departmentId: ObjectId }> {
    const program = await collections.programs.findOne({
      _id: new ObjectId(programId),
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    });
    if (!program) {
      throw new ApiError('PROGRAM_NOT_FOUND', 'Program not found in this branch', 404);
    }
    if (departmentId && String(program.departmentId) !== departmentId.toString()) {
      throw new ApiError(
        'PROGRAM_DEPARTMENT_MISMATCH',
        'The selected program belongs to a different department than this scheme',
        400
      );
    }
    // Terms are numbered across the program's year plan (an annual year is
    // one term), so a curriculum must land on a term the program has.
    const totalTerms = Number(program.totalSemesters);
    if (semesterNumber !== undefined && totalTerms > 0 && semesterNumber > totalTerms) {
      throw new ApiError(
        'TERM_OUT_OF_RANGE',
        `${program.name} has ${totalTerms} terms; term ${semesterNumber} does not exist`,
        400
      );
    }
    return {
      _id: program._id as ObjectId,
      name: String(program.name),
      departmentId: program.departmentId as ObjectId,
    };
  }

  /**
   * Global/Core/Shared enforcement for curriculum authoring — the Phase-5
   * deferral. A department may only put a subject in its scheme if it owns
   * it, it is global, or it is shared to that department. Skipped when the
   * scheme has no department FK (legacy code-only schemes), so nothing that
   * authors today starts failing.
   */
  private async assertSubjectsUsable(
    tenantId: string,
    slots: SchemeSlotInput[],
    departmentId?: ObjectId | null
  ) {
    if (!departmentId) return;
    const ids = collectSubjectIds(slots);
    if (ids.length === 0) return;

    const subjects = await collections.subjects
      .find({ tenantId: new ObjectId(tenantId), _id: { $in: ids } })
      .project({ name: 1, code: 1, sharing: 1, ownerDepartmentId: 1, offeredToDepartmentIds: 1 })
      .toArray();

    const blocked = subjects.filter(
      (subject) =>
        !isSubjectUsableByDepartment(
          {
            sharing: subject.sharing as string | undefined,
            ownerDepartmentId: subject.ownerDepartmentId,
            offeredToDepartmentIds: subject.offeredToDepartmentIds as unknown[] | undefined,
          },
          departmentId.toString()
        )
    );

    if (blocked.length > 0) {
      const names = blocked.map((s) => s.code ?? s.name).join(', ');
      throw new ApiError(
        'SUBJECT_NOT_OFFERED',
        `Not offered to this department: ${names}. Ask the owning department to share the subject, or mark it global.`,
        400,
        blocked.map((s) => ({ subjectId: s._id.toString(), code: s.code, name: s.name }))
      );
    }
  }

  private async assertSubjectsExist(tenantId: string, slots: SchemeSlotInput[]) {
    const ids = collectSubjectIds(slots);
    if (ids.length === 0) return;
    const count = await collections.subjects.countDocuments({
      tenantId: new ObjectId(tenantId),
      _id: { $in: ids },
    });
    if (count !== new Set(ids.map((id) => id.toString())).size) {
      throw new ApiError('UNKNOWN_SUBJECT', 'One or more subjects in the scheme do not exist', 400);
    }
  }

  private async registrationCount(tenantId: string, schemeId: ObjectId): Promise<number> {
    return collections.courseRegistrations.countDocuments({
      tenantId: new ObjectId(tenantId),
      schemeId,
      status: { $ne: 'withdrawn' },
    });
  }

  async create(tenantId: string, branchId: string, data: CreateSchemeInput, createdBy?: string) {
    // Uniqueness is per program when one is named: a department running four
    // B.Tech programs authors four Semester-3 schemes, one each. Schemes with
    // no program stay one-per-department-semester, as before.
    const existing = await collections.programSchemes.findOne({
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      departmentCode: data.departmentCode,
      semesterNumber: data.semesterNumber,
      programId: data.programId ? new ObjectId(data.programId) : { $in: [null, undefined] },
      status: { $ne: 'archived' },
    });
    if (existing) {
      throw new ApiError(
        'DUPLICATE_SCHEME',
        `A scheme for ${data.departmentCode} semester ${data.semesterNumber} already exists`,
        409
      );
    }

    await this.assertSubjectsExist(tenantId, data.slots);

    const departmentId = await resolveDepartmentIdByCode(tenantId, branchId, data.departmentCode);
    await this.assertSubjectsUsable(tenantId, data.slots, departmentId);

    const program = data.programId
      ? await this.assertProgram(
          tenantId,
          branchId,
          data.programId,
          departmentId,
          data.semesterNumber
        )
      : null;

    const now = new Date();
    const doc: SchemeDocument = {
      _id: new ObjectId(),
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      departmentCode: data.departmentCode,
      ...(departmentId && { departmentId }),
      departmentName: data.departmentName,
      ...(program && { programId: program._id, programName: program.name }),
      semesterNumber: data.semesterNumber,
      slots: buildSlots(data.slots),
      minCredits: data.minCredits,
      maxCredits: data.maxCredits,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      ...(createdBy && { createdBy: new ObjectId(createdBy) }),
    };

    await collections.programSchemes.insertOne(doc);
    logger.info(
      { schemeId: doc._id.toString(), tenantId, departmentCode: data.departmentCode },
      'Program scheme created'
    );
    return this.formatScheme(doc as WithId<SchemeDocument>);
  }

  async findAll(
    tenantId: string,
    branchId: string,
    params: {
      departmentCode?: string;
      programId?: string;
      semesterNumber?: number;
      status?: string;
    } = {}
  ) {
    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };
    if (params.departmentCode) filter.departmentCode = params.departmentCode;
    if (params.programId) filter.programId = new ObjectId(params.programId);
    if (params.semesterNumber !== undefined) filter.semesterNumber = params.semesterNumber;
    if (params.status) filter.status = params.status;
    else filter.status = { $ne: 'archived' };

    const schemes = (await collections.programSchemes
      .find(filter)
      .sort({ departmentCode: 1, semesterNumber: 1 })
      .toArray()) as WithId<SchemeDocument>[];

    return schemes.map((s) => this.formatScheme(s));
  }

  async findById(tenantId: string, schemeId: string, { expandSubjects = false } = {}) {
    const scheme = (await collections.programSchemes.findOne({
      _id: new ObjectId(schemeId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<SchemeDocument> | null;

    if (!scheme) {
      throw new ApiError('SCHEME_NOT_FOUND', 'Program scheme not found', 404);
    }

    const formatted = this.formatScheme(scheme);
    if (!expandSubjects) return formatted;
    return { ...formatted, subjects: await this.subjectMap(scheme) };
  }

  /**
   * Resolve the published scheme a student registers under, most specific
   * match first:
   *
   *   1. the student's program (Class.programId) — a CSE (AI & ML) student
   *      gets the AI & ML curriculum, not plain CSE's;
   *   2. a department-wide scheme with no program — the shape every scheme
   *      authored before programs existed has.
   *
   * `alternateCodes` covers the Phase-5 re-key transition: the FK-resolved
   * department code may differ from the legacy path[0] code (e.g. "CSE" vs
   * "CS"), and schemes keyed either way must keep matching.
   */
  async findPublished(
    tenantId: string,
    branchId: string,
    departmentCode: string,
    semesterNumber: number,
    alternateCodes: string[] = [],
    programId?: string | null
  ): Promise<WithId<SchemeDocument> | null> {
    if (programId) {
      const byProgram = (await collections.programSchemes.findOne({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        programId: new ObjectId(programId),
        semesterNumber,
        status: 'published',
      })) as WithId<SchemeDocument> | null;
      if (byProgram) return byProgram;
    }

    const codes = [...new Set([departmentCode, ...alternateCodes].filter(Boolean))];
    return (await collections.programSchemes.findOne({
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      departmentCode: codes.length > 1 ? { $in: codes } : codes[0],
      semesterNumber,
      // A program-keyed scheme belongs to that program's students only —
      // never fall back onto it for a student we couldn't place.
      programId: { $in: [null, undefined] },
      status: 'published',
    })) as WithId<SchemeDocument> | null;
  }

  async update(tenantId: string, schemeId: string, data: UpdateSchemeInput) {
    const scheme = (await collections.programSchemes.findOne({
      _id: new ObjectId(schemeId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<SchemeDocument> | null;

    if (!scheme) {
      throw new ApiError('SCHEME_NOT_FOUND', 'Program scheme not found', 404);
    }

    // Once students have registered, the slot structure is frozen — editing
    // it would invalidate their entries and corrupt seat counters.
    if (data.slots !== undefined) {
      const regCount = await this.registrationCount(tenantId, scheme._id);
      if (regCount > 0) {
        throw new ApiError(
          'SCHEME_IN_USE',
          `Cannot edit slots: ${regCount} student(s) have already registered under this scheme`,
          409
        );
      }
      await this.assertSubjectsExist(tenantId, data.slots);
    }

    const minCredits = data.minCredits ?? scheme.minCredits;
    const maxCredits = data.maxCredits ?? scheme.maxCredits;
    if (maxCredits < minCredits) {
      throw new ApiError('INVALID_CREDIT_BOUNDS', 'maxCredits must be >= minCredits', 400);
    }

    if (data.slots !== undefined) {
      await this.assertSubjectsUsable(tenantId, data.slots, scheme.departmentId);
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.programId !== undefined) {
      if (data.programId) {
        const program = await this.assertProgram(
          tenantId,
          scheme.branchId.toString(),
          data.programId,
          scheme.departmentId,
          scheme.semesterNumber
        );
        updateData.programId = program._id;
        updateData.programName = program.name;
      } else {
        updateData.programId = null;
        updateData.programName = null;
      }
    }
    if (data.departmentName !== undefined) updateData.departmentName = data.departmentName;
    if (data.minCredits !== undefined) updateData.minCredits = data.minCredits;
    if (data.maxCredits !== undefined) updateData.maxCredits = data.maxCredits;
    if (data.slots !== undefined) updateData.slots = buildSlots(data.slots, scheme.slots);

    await collections.programSchemes.updateOne({ _id: scheme._id }, { $set: updateData });
    // A published scheme's new subjects reach its sections now, as on publish.
    if (scheme.status === 'published' && data.slots !== undefined) {
      try {
        await this.attachSubjectsToSections(tenantId, {
          ...scheme,
          slots: updateData.slots as SchemeDocument['slots'],
        });
      } catch (err) {
        logger.warn({ schemeId, tenantId, err }, 'Section subject sync failed after update');
      }
    }
    logger.info({ schemeId, tenantId }, 'Program scheme updated');
    return this.findById(tenantId, schemeId);
  }

  async publish(tenantId: string, schemeId: string) {
    const scheme = (await collections.programSchemes.findOne({
      _id: new ObjectId(schemeId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<SchemeDocument> | null;

    if (!scheme) {
      throw new ApiError('SCHEME_NOT_FOUND', 'Program scheme not found', 404);
    }
    if (scheme.status === 'published') {
      return this.formatScheme(scheme);
    }

    // Sanity: the cheapest possible elective picks must reach minCredits.
    const minPossible = schemeMinPossibleCredits(scheme.slots);
    if (minPossible > scheme.maxCredits) {
      throw new ApiError(
        'CREDITS_UNSATISFIABLE',
        `The scheme's mandatory credits (${minPossible}) exceed maxCredits (${scheme.maxCredits})`,
        400
      );
    }

    await collections.programSchemes.updateOne(
      { _id: scheme._id },
      { $set: { status: 'published', publishedAt: new Date(), updatedAt: new Date() } }
    );

    // Teaching integration: attach the scheme's subjects to the matching
    // department-year sections so timetables, gradebook, and marks entry see
    // them. Non-fatal — a publish must not fail because of section sync.
    try {
      await this.attachSubjectsToSections(tenantId, scheme as WithId<SchemeDocument>);
    } catch (err) {
      logger.warn({ schemeId, tenantId, err }, 'Section subject sync failed after publish');
    }

    logger.info({ schemeId, tenantId }, 'Program scheme published');
    return this.findById(tenantId, schemeId);
  }

  /**
   * Attach every subject of the scheme (cores AND basket options) to the
   * sections of the department-year the scheme targets — Year N covers
   * semesters 2N−1 and 2N. Idempotent: only missing subjects are pushed, and
   * existing teacher assignments are never touched. Elective rosters are
   * filtered at read time (see roster.ts), so attaching options is safe.
   */
  private async attachSubjectsToSections(tenantId: string, scheme: WithId<SchemeDocument>) {
    // Which year teaches this semester: a program's own term plan (annual,
    // semester or trimester years) when it has one, else two per year.
    const program = scheme.programId
      ? await collections.programs.findOne(
          { _id: scheme.programId },
          { projection: { durationYears: 1, termPattern: 1, yearPatterns: 1 } }
        )
      : null;
    const targetYear =
      (program?.durationYears &&
        yearTermRanges(program as unknown as Parameters<typeof yearTermRanges>[0]).find(
          (r) => scheme.semesterNumber >= r.first && scheme.semesterNumber <= r.last
        )?.year) ||
      Math.ceil(scheme.semesterNumber / 2);

    const classes = await collections.classes
      .find({ tenantId: new ObjectId(tenantId), branchId: scheme.branchId })
      .project({ path: 1, departmentId: 1, programId: 1 })
      .toArray();

    const classIds = classes
      .filter((c) => {
        const path = (c.path ?? []) as Array<{
          levelKey: string;
          name?: string;
          code?: string;
          order?: number;
        }>;
        const top = path[0];
        // Program-keyed schemes attach only to their program's classes; the
        // department-code path match stays for department-wide schemes.
        if (scheme.programId) {
          if (!c.programId || String(c.programId) !== scheme.programId.toString()) return false;
        } else if (scheme.departmentId && c.departmentId) {
          if (String(c.departmentId) !== scheme.departmentId.toString()) return false;
        } else if (!top || (top.code || top.name || '').trim() !== scheme.departmentCode) {
          return false;
        }
        const yearEntry = path.find((p) => p.levelKey === 'year') ?? path[1];
        if (!yearEntry) return false;
        const year =
          yearEntry.order !== undefined && yearEntry.order >= 1 && yearEntry.order <= 6
            ? yearEntry.order
            : parseInt((yearEntry.code ?? yearEntry.name ?? '').match(/(\d+)/)?.[1] ?? '', 10);
        return year === targetYear;
      })
      .map((c) => c._id);

    if (classIds.length === 0) {
      logger.warn(
        {
          tenantId,
          departmentCode: scheme.departmentCode,
          programId: scheme.programId?.toString(),
          targetYear,
        },
        'Scheme published but no matching department-year classes found for section sync'
      );
      return;
    }

    const subjectIds = scheme.slots.flatMap((slot) =>
      slot.kind === 'core'
        ? [slot.subjectId as ObjectId]
        : (slot.options ?? []).map((o) => o.subjectId)
    );

    let attached = 0;
    for (const subjectId of subjectIds) {
      const result = await collections.sections.updateMany(
        {
          tenantId: new ObjectId(tenantId),
          classId: { $in: classIds },
          'subjects.subjectId': { $ne: subjectId },
        },
        {
          // Same entry shape section.service.addSubject writes — teacher is
          // assigned later by the admin, periods default to 0. The semester
          // tag lets the section view group its two semesters apart.
          $push: {
            subjects: { subjectId, periodsPerWeek: 0, semesterNumber: scheme.semesterNumber },
          },
          $set: { updatedAt: new Date() },
        } as unknown as UpdateFilter<Document>
      );
      attached += result.modifiedCount;
    }

    logger.info(
      {
        tenantId,
        schemeId: scheme._id.toString(),
        classCount: classIds.length,
        subjectCount: subjectIds.length,
        sectionSubjectLinks: attached,
      },
      'Scheme subjects attached to sections'
    );
  }

  async archive(tenantId: string, schemeId: string) {
    const scheme = (await collections.programSchemes.findOne({
      _id: new ObjectId(schemeId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<SchemeDocument> | null;

    if (!scheme) {
      throw new ApiError('SCHEME_NOT_FOUND', 'Program scheme not found', 404);
    }

    await collections.programSchemes.updateOne(
      { _id: scheme._id },
      { $set: { status: 'archived', updatedAt: new Date() } }
    );
    logger.info({ schemeId, tenantId }, 'Program scheme archived');
    return this.findById(tenantId, schemeId);
  }

  async delete(tenantId: string, schemeId: string) {
    const scheme = (await collections.programSchemes.findOne({
      _id: new ObjectId(schemeId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<SchemeDocument> | null;

    if (!scheme) {
      throw new ApiError('SCHEME_NOT_FOUND', 'Program scheme not found', 404);
    }

    const regCount = await this.registrationCount(tenantId, scheme._id);
    if (regCount > 0) {
      throw new ApiError(
        'SCHEME_IN_USE',
        `Cannot delete: ${regCount} student(s) have registered under this scheme`,
        409
      );
    }

    await collections.programSchemes.deleteOne({ _id: scheme._id });
    logger.info({ schemeId, tenantId }, 'Program scheme deleted');
    return { success: true };
  }

  /** Clone a scheme to another semester and/or department (as a draft). */
  async clone(
    tenantId: string,
    branchId: string,
    schemeId: string,
    data: CloneSchemeInput,
    createdBy?: string
  ) {
    const source = (await collections.programSchemes.findOne({
      _id: new ObjectId(schemeId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<SchemeDocument> | null;

    if (!source) {
      throw new ApiError('SCHEME_NOT_FOUND', 'Program scheme not found', 404);
    }

    const departmentCode = data.targetDepartmentCode ?? source.departmentCode;
    const semesterNumber = data.targetSemesterNumber ?? source.semesterNumber;
    // `targetProgramId: null` explicitly clones down to a department-wide
    // scheme; omitting the field keeps the source's program.
    const targetProgramId =
      data.targetProgramId === undefined ? source.programId?.toString() : data.targetProgramId;
    const sameProgram = (targetProgramId ?? null) === (source.programId?.toString() ?? null);
    if (
      departmentCode === source.departmentCode &&
      semesterNumber === source.semesterNumber &&
      sameProgram
    ) {
      throw new ApiError(
        'CLONE_TARGET_SAME',
        'Clone target must differ in department, program, or semester',
        400
      );
    }

    const targetDepartmentId = await resolveDepartmentIdByCode(tenantId, branchId, departmentCode);
    const targetProgram = targetProgramId
      ? await this.assertProgram(
          tenantId,
          branchId,
          targetProgramId,
          targetDepartmentId,
          semesterNumber
        )
      : null;

    const existing = await collections.programSchemes.findOne({
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      departmentCode,
      semesterNumber,
      programId: targetProgram ? targetProgram._id : { $in: [null, undefined] },
      status: { $ne: 'archived' },
    });
    if (existing) {
      throw new ApiError(
        'DUPLICATE_SCHEME',
        `A scheme for ${departmentCode} semester ${semesterNumber} already exists`,
        409
      );
    }

    const now = new Date();
    const doc: SchemeDocument = {
      _id: new ObjectId(),
      tenantId: source.tenantId,
      branchId: source.branchId,
      departmentCode,
      ...(targetDepartmentId && { departmentId: targetDepartmentId }),
      departmentName: data.targetDepartmentName ?? source.departmentName,
      ...(targetProgram && { programId: targetProgram._id, programName: targetProgram.name }),
      semesterNumber,
      // Fresh slotIds + zeroed seat counters — a clone is a new curriculum.
      slots: source.slots.map((slot) => ({
        ...slot,
        slotId: new ObjectId().toHexString(),
        ...(slot.options && {
          options: slot.options.map((o) => ({ ...o, seatsTaken: 0 })),
        }),
      })),
      minCredits: source.minCredits,
      maxCredits: source.maxCredits,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      ...(createdBy && { createdBy: new ObjectId(createdBy) }),
    };

    await collections.programSchemes.insertOne(doc);
    logger.info(
      { schemeId: doc._id.toString(), sourceId: schemeId, tenantId },
      'Program scheme cloned'
    );
    return this.formatScheme(doc as WithId<SchemeDocument>);
  }

  /** subjectId → {name, code, shortName, category} map for a scheme's subjects. */
  async subjectMap(scheme: SchemeDocument) {
    const ids = scheme.slots.flatMap((slot) =>
      slot.kind === 'core'
        ? [slot.subjectId as ObjectId]
        : (slot.options ?? []).map((o) => o.subjectId)
    );
    if (ids.length === 0) return {};
    const subjects = await collections.subjects
      .find({ _id: { $in: ids } })
      .project({ name: 1, code: 1, shortName: 1, category: 1, credits: 1 })
      .toArray();
    return Object.fromEntries(
      subjects.map((s) => [
        s._id.toString(),
        { name: s.name, code: s.code, shortName: s.shortName, category: s.category },
      ])
    );
  }

  formatScheme(scheme: WithId<SchemeDocument>) {
    return {
      _id: scheme._id.toString(),
      tenantId: scheme.tenantId.toString(),
      branchId: scheme.branchId.toString(),
      departmentCode: scheme.departmentCode,
      departmentId: scheme.departmentId?.toString(),
      departmentName: scheme.departmentName,
      programId: scheme.programId?.toString(),
      programName: scheme.programName,
      semesterNumber: scheme.semesterNumber,
      slots: scheme.slots.map((slot) => ({
        slotId: slot.slotId,
        kind: slot.kind,
        category: slot.category,
        ...(slot.kind === 'core'
          ? { subjectId: slot.subjectId?.toString(), credits: slot.credits }
          : {
              label: slot.label,
              chooseCount: slot.chooseCount,
              options: (slot.options ?? []).map((o) => ({
                subjectId: o.subjectId.toString(),
                credits: o.credits,
                seatCap: o.seatCap,
                seatsTaken: o.seatsTaken,
              })),
            }),
      })),
      minCredits: scheme.minCredits,
      maxCredits: scheme.maxCredits,
      status: scheme.status,
      publishedAt: scheme.publishedAt,
      createdAt: scheme.createdAt,
      updatedAt: scheme.updatedAt,
    };
  }
}

export const schemeService = new SchemeService();

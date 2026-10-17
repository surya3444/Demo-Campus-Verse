import { termNumbersForClasses } from '../organization/termNumbering';
import { ObjectId, WithId, Document, Filter } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { getPagination, buildPaginationMeta } from '../../utils/pagination';
import type {
  CreateObeOfferingInput,
  UpdateObeOfferingInput,
  ObeInstrumentInput,
  ObeOfferingQueryInput,
} from '@campus-verse/shared/schemas';
import type { ObeOfferingStatus, ObeSurveyStatus } from '@campus-verse/shared/constants';
import { getStaffIdForUser } from '../teaching/teaching.utils';
import { assertOfferingAccess, deriveCoordinator, resolveCohort } from './obe.utils';
import { obeProgramService } from './program.service';

export interface ObeInstrumentDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  offeringId: ObjectId;
  name: string;
  kind: 'internal' | 'external';
  order: number;
  sets?: {
    _id: ObjectId;
    label: string;
    items: { _id: ObjectId; label: string; coIds: ObjectId[]; maxMarks: number }[];
  }[];
  bestOfCount?: number | null;
  thresholdPercentOverride?: number;
  examId?: ObjectId;
  paperId?: ObjectId;
  totalMarks?: number;
  passMarks?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ObeOfferingDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  programId: ObjectId;
  subjectId: ObjectId;
  subjectCode: string;
  subjectName: string;
  academicBatchId: ObjectId;
  termId: ObjectId;
  termName: string;
  semesterNumber?: number;
  sectionIds: ObjectId[];
  coordinatorStaffId?: ObjectId;
  status: ObeOfferingStatus;
  targetLevel?: number;
  survey: { status: ObeSurveyStatus; openedAt?: Date; closedAt?: Date };
  coCorrectiveActions: { coId: ObjectId; text: string; updatedAt: Date }[];
  studentCount?: number;
  computedAt?: Date;
  finalizedAt?: Date;
  finalizedBy?: ObjectId;
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export function formatInstrument(doc: WithId<ObeInstrumentDocument>) {
  return {
    _id: doc._id.toString(),
    offeringId: doc.offeringId.toString(),
    name: doc.name,
    kind: doc.kind,
    order: doc.order,
    sets: doc.sets?.map((set) => ({
      _id: set._id.toString(),
      label: set.label,
      items: set.items.map((item) => ({
        _id: item._id.toString(),
        label: item.label,
        coIds: item.coIds.map((id) => id.toString()),
        maxMarks: item.maxMarks,
      })),
    })),
    bestOfCount: doc.bestOfCount ?? null,
    thresholdPercentOverride: doc.thresholdPercentOverride,
    examId: doc.examId?.toString(),
    paperId: doc.paperId?.toString(),
    totalMarks: doc.totalMarks,
    passMarks: doc.passMarks,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function formatOffering(doc: WithId<ObeOfferingDocument>, extra?: Record<string, unknown>) {
  return {
    _id: doc._id.toString(),
    tenantId: doc.tenantId.toString(),
    branchId: doc.branchId.toString(),
    programId: doc.programId.toString(),
    subjectId: doc.subjectId.toString(),
    subjectCode: doc.subjectCode,
    subjectName: doc.subjectName,
    academicBatchId: doc.academicBatchId.toString(),
    termId: doc.termId.toString(),
    termName: doc.termName,
    semesterNumber: doc.semesterNumber,
    sectionIds: doc.sectionIds.map((id) => id.toString()),
    coordinatorStaffId: doc.coordinatorStaffId?.toString(),
    status: doc.status,
    targetLevel: doc.targetLevel,
    survey: doc.survey,
    coCorrectiveActions: (doc.coCorrectiveActions ?? []).map((a) => ({
      coId: a.coId.toString(),
      text: a.text,
      updatedAt: a.updatedAt,
    })),
    studentCount: doc.studentCount,
    computedAt: doc.computedAt,
    finalizedAt: doc.finalizedAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    ...extra,
  };
}

/**
 * An OBE program tied to a curriculum program (B.Tech CSE) attains only its own
 * students: every section must belong to a class of that program.
 */
async function assertSectionsInCurriculumProgram(
  tenantObjId: ObjectId,
  sectionIds: ObjectId[],
  curriculumProgramId?: ObjectId
): Promise<void> {
  if (!curriculumProgramId) return;
  const sections = await collections.sections
    .find({ tenantId: tenantObjId, _id: { $in: sectionIds } })
    .project({ classId: 1 })
    .toArray();
  const classes = await collections.classes
    .find({ _id: { $in: sections.map((x) => x.classId as ObjectId) } })
    .project({ programId: 1 })
    .toArray();
  if (classes.some((c) => String(c.programId) !== String(curriculumProgramId))) {
    throw new ApiError(
      'SECTION_OUTSIDE_PROGRAM',
      "Every section must belong to this OBE program's curriculum program; offer the subject separately under each other program",
      400
    );
  }
}

class ObeOfferingService {
  async getDoc(
    tenantId: string,
    branchId: string,
    id: string
  ): Promise<WithId<ObeOfferingDocument>> {
    if (!ObjectId.isValid(id)) throw new ApiError('INVALID_ID', 'Invalid offering id', 400);
    const doc = (await collections.obeOfferings.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    })) as WithId<ObeOfferingDocument> | null;
    if (!doc) throw new ApiError('OFFERING_NOT_FOUND', 'Offering not found', 404);
    return doc;
  }

  async create(
    tenantId: string,
    branchId: string,
    data: CreateObeOfferingInput,
    createdBy: string
  ) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);
    const subjectObjId = new ObjectId(data.subjectId);

    const obeProgram = await obeProgramService.getDoc(tenantId, branchId, data.programId);

    const subject = await collections.subjects.findOne(
      { _id: subjectObjId, tenantId: tenantObjId },
      { projection: { code: 1, name: 1 } }
    );
    if (!subject) throw new ApiError('SUBJECT_NOT_FOUND', 'Subject not found', 404);

    const batch = await collections.academicBatches.findOne(
      { _id: new ObjectId(data.academicBatchId), tenantId: tenantObjId },
      { projection: { terms: 1 } }
    );
    if (!batch) throw new ApiError('BATCH_NOT_FOUND', 'Academic session not found', 404);
    const term = (
      (batch.terms ?? []) as { _id: ObjectId; name: string; semesterNumber?: number }[]
    ).find((t) => t._id.toString() === data.termId);
    if (!term) throw new ApiError('TERM_NOT_FOUND', 'Term not found in this academic session', 404);

    const sectionIds = data.sectionIds.map((id) => new ObjectId(id));
    const sectionCount = await collections.sections.countDocuments({
      _id: { $in: sectionIds },
      tenantId: tenantObjId,
      branchId: branchObjId,
    });
    if (sectionCount !== sectionIds.length) {
      throw new ApiError('SECTION_NOT_FOUND', 'One or more sections were not found', 404);
    }
    await assertSectionsInCurriculumProgram(
      tenantObjId,
      sectionIds,
      (obeProgram as { curriculumProgramId?: ObjectId }).curriculumProgramId
    );

    // One offering per subject, term and OBE program: an open elective taken
    // by CSE and Civil students is offered once under each program, so each
    // student's attainment counts towards their own program's outcomes.
    const existing = await collections.obeOfferings.findOne({
      tenantId: tenantObjId,
      branchId: branchObjId,
      subjectId: subjectObjId,
      academicBatchId: new ObjectId(data.academicBatchId),
      termId: term._id,
      programId: new ObjectId(data.programId),
    });
    if (existing) {
      throw new ApiError(
        'OFFERING_EXISTS',
        'This program already offers this subject in this term',
        409
      );
    }

    const coordinatorStaffId = data.coordinatorStaffId
      ? new ObjectId(data.coordinatorStaffId)
      : await deriveCoordinator(tenantId, branchId, subjectObjId, sectionIds);

    // The term number follows the sections' program year plan; a session
    // term only carries a number of its own when it overrides it.
    // ponytail: sections from different program years take the first one.
    const sectionClasses = await collections.sections
      .find({ _id: { $in: sectionIds }, tenantId: tenantObjId })
      .project({ classId: 1 })
      .toArray();
    const termNumbers = await termNumbersForClasses(
      sectionClasses.map((sec) => sec.classId as ObjectId).filter(Boolean),
      term
    );
    const semesterNumber = term.semesterNumber ?? [...termNumbers.values()][0];

    const now = new Date();
    const doc: ObeOfferingDocument = {
      _id: new ObjectId(),
      tenantId: tenantObjId,
      branchId: branchObjId,
      programId: new ObjectId(data.programId),
      subjectId: subjectObjId,
      subjectCode: subject.code as string,
      subjectName: subject.name as string,
      academicBatchId: new ObjectId(data.academicBatchId),
      termId: term._id,
      termName: term.name,
      ...(semesterNumber !== undefined ? { semesterNumber } : {}),
      sectionIds,
      ...(coordinatorStaffId ? { coordinatorStaffId } : {}),
      status: 'draft',
      ...(data.targetLevel !== undefined ? { targetLevel: data.targetLevel } : {}),
      survey: { status: 'not_started' },
      coCorrectiveActions: [],
      createdBy: new ObjectId(createdBy),
      createdAt: now,
      updatedAt: now,
    };

    const cohort = await resolveCohort(tenantId, branchId, doc);
    doc.studentCount = cohort.length;

    await collections.obeOfferings.insertOne(doc);
    logger.info({ tenantId, branchId, subjectCode: doc.subjectCode }, 'OBE offering created');
    return formatOffering(doc as WithId<ObeOfferingDocument>);
  }

  async findAll(
    tenantId: string,
    branchId: string,
    query: ObeOfferingQueryInput,
    user: { userId: string; roleLevel?: number },
    /** Scope guard: section ids the caller is confined to (null = unrestricted). */
    restrictToSectionIds: ObjectId[] | null = null
  ) {
    const { page, limit } = getPagination(query as Record<string, unknown>);
    const skip = (page - 1) * limit;

    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };
    if (query.programId) filter.programId = new ObjectId(query.programId);
    // A department- or program-scoped caller sees only offerings taught to
    // their own sections; an empty grant matches nothing.
    if (restrictToSectionIds !== null) {
      filter.sectionIds = { $in: restrictToSectionIds };
    }
    if (query.academicBatchId) filter.academicBatchId = new ObjectId(query.academicBatchId);
    if (query.termId) filter.termId = new ObjectId(query.termId);
    if (query.subjectId) filter.subjectId = new ObjectId(query.subjectId);
    if (query.status) filter.status = query.status;
    if (query.search) {
      const re = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ subjectCode: re }, { subjectName: re }];
    }
    if (query.mine) {
      const staffId = await getStaffIdForUser(tenantId, user.userId);
      const staffOid = new ObjectId(staffId);
      // Coordinated by them, or they teach the subject in one of the sections.
      const taughtSections = await collections.sections
        .find({
          tenantId: new ObjectId(tenantId),
          branchId: new ObjectId(branchId),
          'subjects.teacherId': staffOid,
        })
        .project({ _id: 1, subjects: 1 })
        .toArray();
      const taughtPairs: Filter<Document>[] = [];
      for (const section of taughtSections) {
        for (const entry of (section.subjects ?? []) as {
          subjectId: ObjectId;
          teacherId?: ObjectId;
        }[]) {
          if (entry.teacherId?.equals(staffOid)) {
            taughtPairs.push({ subjectId: entry.subjectId, sectionIds: section._id });
          }
        }
      }
      filter.$and = [
        { $or: [{ coordinatorStaffId: staffOid }, ...(taughtPairs.length ? taughtPairs : [])] },
      ];
    }

    const [docs, total] = await Promise.all([
      collections.obeOfferings
        .find(filter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray() as Promise<WithId<ObeOfferingDocument>[]>,
      collections.obeOfferings.countDocuments(filter),
    ]);

    return {
      offerings: docs.map((d) => formatOffering(d)),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async findById(tenantId: string, branchId: string, id: string) {
    const doc = await this.getDoc(tenantId, branchId, id);
    const instruments = (await collections.obeInstruments
      .find({ tenantId: doc.tenantId, offeringId: doc._id })
      .sort({ order: 1, createdAt: 1 })
      .toArray()) as WithId<ObeInstrumentDocument>[];
    const cohort = await resolveCohort(tenantId, branchId, doc);
    return formatOffering(doc, {
      instruments: instruments.map(formatInstrument),
      cohortSize: cohort.length,
    });
  }

  async getCohort(tenantId: string, branchId: string, id: string) {
    const doc = await this.getDoc(tenantId, branchId, id);
    const cohort = await resolveCohort(tenantId, branchId, doc);
    return cohort.map((s) => ({
      studentId: s.studentId.toString(),
      name: s.name,
      admissionNumber: s.admissionNumber,
      rollNumber: s.rollNumber,
      sectionId: s.sectionId?.toString(),
    }));
  }

  async update(
    tenantId: string,
    branchId: string,
    id: string,
    data: UpdateObeOfferingInput,
    user: { userId: string; roleLevel?: number }
  ) {
    const doc = await this.getDoc(tenantId, branchId, id);
    await assertOfferingAccess(tenantId, branchId, user, doc);
    if (doc.status === 'finalized') {
      throw new ApiError('OFFERING_FINALIZED', 'Reopen the offering before editing it', 409);
    }

    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (data.sectionIds !== undefined) {
      const sectionIds = data.sectionIds.map((sid) => new ObjectId(sid));
      const count = await collections.sections.countDocuments({
        _id: { $in: sectionIds },
        tenantId: doc.tenantId,
        branchId: doc.branchId,
      });
      if (count !== sectionIds.length) {
        throw new ApiError('SECTION_NOT_FOUND', 'One or more sections were not found', 404);
      }
      const obeProgram = await collections.obePrograms.findOne(
        { _id: doc.programId as ObjectId },
        { projection: { curriculumProgramId: 1 } }
      );
      await assertSectionsInCurriculumProgram(
        doc.tenantId as ObjectId,
        sectionIds,
        obeProgram?.curriculumProgramId as ObjectId | undefined
      );
      update.sectionIds = sectionIds;
      const cohort = await resolveCohort(tenantId, branchId, {
        subjectId: doc.subjectId,
        sectionIds,
      });
      update.studentCount = cohort.length;
    }
    if (data.coordinatorStaffId !== undefined) {
      update.coordinatorStaffId = data.coordinatorStaffId
        ? new ObjectId(data.coordinatorStaffId)
        : null;
    }
    if (data.targetLevel !== undefined) update.targetLevel = data.targetLevel;

    const result = await collections.obeOfferings.findOneAndUpdate(
      { _id: doc._id, tenantId: doc.tenantId },
      { $set: update },
      { returnDocument: 'after' }
    );
    if (!result) throw new ApiError('OFFERING_NOT_FOUND', 'Offering not found', 404);
    return formatOffering(result as WithId<ObeOfferingDocument>);
  }

  async setStatus(
    tenantId: string,
    branchId: string,
    id: string,
    status: 'draft' | 'data_entry',
    user: { userId: string; roleLevel?: number }
  ) {
    const doc = await this.getDoc(tenantId, branchId, id);
    await assertOfferingAccess(tenantId, branchId, user, doc);
    const allowed: Record<string, string[]> = {
      draft: ['data_entry'],
      data_entry: ['draft'],
      computed: ['data_entry'],
    };
    if (!allowed[doc.status]?.includes(status)) {
      throw new ApiError(
        'INVALID_STATUS_TRANSITION',
        `Cannot move an offering from ${doc.status} to ${status}`,
        400
      );
    }
    const result = await collections.obeOfferings.findOneAndUpdate(
      { _id: doc._id, tenantId: doc.tenantId },
      { $set: { status, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
    return formatOffering(result as WithId<ObeOfferingDocument>);
  }

  async delete(tenantId: string, branchId: string, id: string) {
    const doc = await this.getDoc(tenantId, branchId, id);
    if (doc.status !== 'draft') {
      throw new ApiError('OFFERING_NOT_DRAFT', 'Only draft offerings can be deleted', 409);
    }
    await Promise.all([
      collections.obeOfferings.deleteOne({ _id: doc._id, tenantId: doc.tenantId }),
      collections.obeInstruments.deleteMany({ offeringId: doc._id, tenantId: doc.tenantId }),
      collections.obeMarks.deleteMany({ offeringId: doc._id, tenantId: doc.tenantId }),
    ]);
    logger.info({ tenantId, branchId, id }, 'OBE offering deleted');
  }

  // ── Instruments ──────────────────────────────────────────────────────────

  private async validateInstrumentInput(
    offering: WithId<ObeOfferingDocument>,
    data: ObeInstrumentInput
  ) {
    if (data.kind === 'internal') {
      // Every referenced CO must exist on the offering's outcome doc.
      const outcomeDoc = await collections.obeCourseOutcomes.findOne(
        {
          tenantId: offering.tenantId,
          subjectId: offering.subjectId,
          programId: offering.programId,
        },
        { projection: { cos: 1 } }
      );
      const validCoIds = new Set(
        ((outcomeDoc?.cos ?? []) as { _id: ObjectId }[]).map((co) => co._id.toString())
      );
      for (const set of data.sets ?? []) {
        for (const item of set.items) {
          for (const coId of item.coIds) {
            if (!validCoIds.has(coId)) {
              throw new ApiError(
                'INVALID_CO_ID',
                `Item ${item.label} references a CO that is not defined for this course — author the COs first`,
                400
              );
            }
          }
        }
      }
      return {};
    }

    // External: the linked exam paper must belong to this subject.
    const exam = await collections.exams.findOne({
      _id: new ObjectId(data.examId!),
      tenantId: offering.tenantId,
      branchId: offering.branchId,
    });
    if (!exam) throw new ApiError('EXAM_NOT_FOUND', 'Linked exam not found', 404);
    const paper = (
      (exam.papers ?? []) as {
        _id: ObjectId;
        subjectId: ObjectId;
        totalMarks: number;
        passMarks: number;
      }[]
    ).find((p) => p._id.toString() === data.paperId);
    if (!paper) throw new ApiError('PAPER_NOT_FOUND', 'Linked paper not found on the exam', 404);
    if (!paper.subjectId.equals(offering.subjectId)) {
      throw new ApiError(
        'PAPER_SUBJECT_MISMATCH',
        "The linked paper belongs to a different subject than this offering's course",
        400
      );
    }
    return { totalMarks: paper.totalMarks, passMarks: paper.passMarks };
  }

  private buildInstrumentSets(data: ObeInstrumentInput, existing?: WithId<ObeInstrumentDocument>) {
    if (data.kind !== 'internal') return undefined;
    const existingSetIds = new Set((existing?.sets ?? []).map((s) => s._id.toString()));
    const existingItemIds = new Set(
      (existing?.sets ?? []).flatMap((s) => s.items.map((i) => i._id.toString()))
    );
    return (data.sets ?? []).map((set) => {
      if (set._id && !existingSetIds.has(set._id)) {
        throw new ApiError('INVALID_SET_ID', `Unknown set id ${set._id}`, 400);
      }
      return {
        _id: set._id ? new ObjectId(set._id) : new ObjectId(),
        label: set.label,
        items: set.items.map((item) => {
          if (item._id && !existingItemIds.has(item._id)) {
            throw new ApiError('INVALID_ITEM_ID', `Unknown item id ${item._id}`, 400);
          }
          return {
            _id: item._id ? new ObjectId(item._id) : new ObjectId(),
            label: item.label,
            coIds: item.coIds.map((id) => new ObjectId(id)),
            maxMarks: item.maxMarks,
          };
        }),
      };
    });
  }

  async addInstrument(
    tenantId: string,
    branchId: string,
    offeringId: string,
    data: ObeInstrumentInput,
    user: { userId: string; roleLevel?: number }
  ) {
    const offering = await this.getDoc(tenantId, branchId, offeringId);
    await assertOfferingAccess(tenantId, branchId, user, offering);
    if (offering.status === 'finalized') {
      throw new ApiError('OFFERING_FINALIZED', 'Reopen the offering before editing it', 409);
    }

    const external = await this.validateInstrumentInput(offering, data);
    const now = new Date();
    const doc: ObeInstrumentDocument = {
      _id: new ObjectId(),
      tenantId: offering.tenantId,
      branchId: offering.branchId,
      offeringId: offering._id,
      name: data.name,
      kind: data.kind,
      order: data.order,
      ...(data.kind === 'internal'
        ? {
            sets: this.buildInstrumentSets(data),
            bestOfCount: data.bestOfCount ?? null,
            ...(data.thresholdPercentOverride !== undefined
              ? { thresholdPercentOverride: data.thresholdPercentOverride }
              : {}),
          }
        : {
            examId: new ObjectId(data.examId!),
            paperId: new ObjectId(data.paperId!),
            ...external,
          }),
      createdAt: now,
      updatedAt: now,
    };
    await collections.obeInstruments.insertOne(doc);
    return formatInstrument(doc as WithId<ObeInstrumentDocument>);
  }

  async updateInstrument(
    tenantId: string,
    branchId: string,
    offeringId: string,
    instrumentId: string,
    data: ObeInstrumentInput,
    user: { userId: string; roleLevel?: number }
  ) {
    const offering = await this.getDoc(tenantId, branchId, offeringId);
    await assertOfferingAccess(tenantId, branchId, user, offering);
    if (offering.status === 'finalized') {
      throw new ApiError('OFFERING_FINALIZED', 'Reopen the offering before editing it', 409);
    }
    if (!ObjectId.isValid(instrumentId)) {
      throw new ApiError('INVALID_ID', 'Invalid instrument id', 400);
    }
    const existing = (await collections.obeInstruments.findOne({
      _id: new ObjectId(instrumentId),
      tenantId: offering.tenantId,
      offeringId: offering._id,
    })) as WithId<ObeInstrumentDocument> | null;
    if (!existing) throw new ApiError('INSTRUMENT_NOT_FOUND', 'Instrument not found', 404);
    if (existing.kind !== data.kind) {
      throw new ApiError(
        'KIND_IMMUTABLE',
        'An instrument cannot change kind — delete and recreate it',
        400
      );
    }

    const marksCount = await collections.obeMarks.countDocuments({
      tenantId: offering.tenantId,
      instrumentId: existing._id,
    });
    const update: Record<string, unknown> = {
      name: data.name,
      order: data.order,
      updatedAt: new Date(),
    };

    if (data.kind === 'internal') {
      await this.validateInstrumentInput(offering, data);
      const sets = this.buildInstrumentSets(data, existing);
      if (marksCount > 0) {
        // Structure is locked once marks exist — allow relabeling only.
        const shapeOf = (s?: { _id: ObjectId; items: { _id: ObjectId; maxMarks: number }[] }[]) =>
          JSON.stringify(
            (s ?? []).map((set) => ({
              id: set._id.toString(),
              items: set.items.map((i) => ({ id: i._id.toString(), max: i.maxMarks })),
            }))
          );
        // Labels and CO tags stay editable — recompute picks retags up.
        if (shapeOf(sets) !== shapeOf(existing.sets)) {
          throw new ApiError(
            'INSTRUMENT_HAS_MARKS',
            `${marksCount} marks row(s) exist — set/question structure and max marks are locked (labels and CO tags stay editable)`,
            409
          );
        }
      }
      update.sets = sets;
      update.bestOfCount = data.bestOfCount ?? null;
      if (data.thresholdPercentOverride !== undefined) {
        update.thresholdPercentOverride = data.thresholdPercentOverride;
      }
    } else {
      const external = await this.validateInstrumentInput(offering, data);
      update.examId = new ObjectId(data.examId!);
      update.paperId = new ObjectId(data.paperId!);
      update.totalMarks = external.totalMarks;
      update.passMarks = external.passMarks;
    }

    const result = await collections.obeInstruments.findOneAndUpdate(
      { _id: existing._id, tenantId: offering.tenantId },
      { $set: update },
      { returnDocument: 'after' }
    );
    return formatInstrument(result as WithId<ObeInstrumentDocument>);
  }

  async deleteInstrument(
    tenantId: string,
    branchId: string,
    offeringId: string,
    instrumentId: string,
    user: { userId: string; roleLevel?: number }
  ) {
    const offering = await this.getDoc(tenantId, branchId, offeringId);
    await assertOfferingAccess(tenantId, branchId, user, offering);
    if (offering.status === 'finalized') {
      throw new ApiError('OFFERING_FINALIZED', 'Reopen the offering before editing it', 409);
    }
    if (!ObjectId.isValid(instrumentId)) {
      throw new ApiError('INVALID_ID', 'Invalid instrument id', 400);
    }
    const instrumentOid = new ObjectId(instrumentId);
    const marksCount = await collections.obeMarks.countDocuments({
      tenantId: offering.tenantId,
      instrumentId: instrumentOid,
    });
    if (marksCount > 0) {
      throw new ApiError(
        'INSTRUMENT_HAS_MARKS',
        `${marksCount} marks row(s) exist for this instrument — clear them first`,
        409
      );
    }
    const result = await collections.obeInstruments.deleteOne({
      _id: instrumentOid,
      tenantId: offering.tenantId,
      offeringId: offering._id,
    });
    if (result.deletedCount === 0) {
      throw new ApiError('INSTRUMENT_NOT_FOUND', 'Instrument not found', 404);
    }
  }

  /** Candidate exams/papers for linking an external instrument. */
  async examLinkCandidates(
    tenantId: string,
    branchId: string,
    query: { subjectId: string; academicBatchId?: string; termId?: string }
  ) {
    if (!ObjectId.isValid(query.subjectId)) {
      throw new ApiError('INVALID_ID', 'Invalid subject id', 400);
    }
    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      'papers.subjectId': new ObjectId(query.subjectId),
      status: { $ne: 'cancelled' },
    };
    if (query.academicBatchId) filter.academicBatchId = new ObjectId(query.academicBatchId);
    if (query.termId) filter.termId = new ObjectId(query.termId);

    const exams = await collections.exams
      .find(filter)
      .project({ name: 1, type: 1, status: 1, termName: 1, papers: 1 })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    const subjectOid = new ObjectId(query.subjectId);
    return exams.flatMap((exam) => {
      const papers = (
        (exam.papers ?? []) as {
          _id: ObjectId;
          subjectId: ObjectId;
          subjectName: string;
          totalMarks: number;
          passMarks: number;
        }[]
      ).filter((p) => p.subjectId.equals(subjectOid));
      return papers.map((p) => ({
        examId: exam._id.toString(),
        examName: exam.name as string,
        examType: exam.type as string,
        examStatus: exam.status as string,
        termName: exam.termName as string,
        paperId: p._id.toString(),
        totalMarks: p.totalMarks,
        passMarks: p.passMarks,
      }));
    });
  }
}

export const obeOfferingService = new ObeOfferingService();

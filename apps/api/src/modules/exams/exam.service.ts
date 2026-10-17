import { ObjectId, WithId, Document, Filter } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { intersectScope } from '../../middleware/scope';
import { getPagination, buildPaginationMeta } from '../../utils/pagination';
import type { ExamStatus, ExamType } from '@campus-verse/shared/constants';
import { EXAM_STATUSES } from '@campus-verse/shared/constants';

interface ExamPaperDoc {
  _id: ObjectId;
  subjectId: ObjectId;
  subjectName: string;
  totalMarks: number;
  passMarks: number;
  weight?: number;
}

export interface ExamDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  academicBatchId: ObjectId;
  /** Links to AcademicBatch.terms._id. Absent on legacy exams created before
   *  semesters existed — `termName` remains the display label either way. */
  termId?: ObjectId;
  termName: string;
  name: string;
  type: ExamType;
  classIds: ObjectId[];
  papers: ExamPaperDoc[];
  status: ExamStatus;
  startDate?: Date;
  endDate?: Date;
  instructions?: string;
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

interface CreateExamInput {
  academicBatchId: string;
  /** Preferred: the semester this exam belongs to. */
  termId?: string;
  /** Legacy free-text label; derived from the term when termId is supplied. */
  termName?: string;
  name: string;
  type: ExamType;
  classIds: string[];
  papers: Array<{
    subjectId: string;
    totalMarks: number;
    passMarks: number;
    weight?: number;
  }>;
  startDate?: Date;
  endDate?: Date;
  instructions?: string;
}

/**
 * Status flow:
 *   draft → scheduled → ongoing → completed → results_published
 *   any state → cancelled (irreversible)
 *
 * Adjacency is intentional — admin shouldn't skip from draft to published.
 */
const STATUS_ADJACENCY: Record<ExamStatus, ExamStatus[]> = {
  draft: ['scheduled', 'cancelled'],
  scheduled: ['draft', 'ongoing', 'cancelled'],
  ongoing: ['completed', 'cancelled'],
  completed: ['ongoing', 'results_published', 'cancelled'],
  results_published: ['completed'],
  cancelled: [],
};

/**
 * Resolve an exam's term. Preferred path is `termId` referencing a semester on
 * the academic batch, from which the display label is derived — so renaming a
 * semester can't leave exams showing a stale label. Falls back to the legacy
 * free-text `termName` for callers that predate semesters.
 */
export async function resolveTerm(
  tenantId: string,
  academicBatchId: string,
  termId?: string,
  termName?: string
): Promise<{ termId?: ObjectId; termName: string }> {
  if (termId) {
    const batch = await collections.academicBatches.findOne(
      { _id: new ObjectId(academicBatchId), tenantId: new ObjectId(tenantId) },
      { projection: { terms: 1 } }
    );
    const term = ((batch?.terms ?? []) as Array<{ _id: ObjectId; name: string }>).find(
      (t) => t._id.toString() === termId
    );
    if (!term) {
      throw new ApiError('TERM_NOT_FOUND', 'Term not found in this academic session', 404);
    }
    return { termId: term._id, termName: term.name };
  }
  const label = termName?.trim();
  if (!label) {
    throw new ApiError('INVALID_INPUT', 'Either termId or termName is required', 400);
  }
  return { termName: label };
}

function formatExam(doc: WithId<ExamDocument>) {
  return {
    _id: doc._id.toString(),
    tenantId: doc.tenantId.toString(),
    branchId: doc.branchId.toString(),
    academicBatchId: doc.academicBatchId.toString(),
    termId: doc.termId?.toString(),
    termName: doc.termName,
    name: doc.name,
    type: doc.type,
    classIds: doc.classIds.map((id) => id.toString()),
    papers: doc.papers.map((p) => ({
      _id: p._id.toString(),
      subjectId: p.subjectId.toString(),
      subjectName: p.subjectName,
      totalMarks: p.totalMarks,
      passMarks: p.passMarks,
      weight: p.weight,
    })),
    status: doc.status,
    startDate: doc.startDate,
    endDate: doc.endDate,
    instructions: doc.instructions,
    createdBy: doc.createdBy.toString(),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

class ExamService {
  async create(tenantId: string, branchId: string, data: CreateExamInput, createdBy: string) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);

    // Resolve subject names (denormalised onto paper for fast reads).
    const subjectIds = data.papers.map((p) => new ObjectId(p.subjectId));
    const subjects = await collections.subjects
      .find({ _id: { $in: subjectIds }, tenantId: tenantObjId })
      .project({ _id: 1, name: 1 })
      .toArray();

    if (subjects.length !== subjectIds.length) {
      throw new ApiError('SUBJECT_NOT_FOUND', 'One or more subjects not found', 404);
    }
    const subjectNameById = new Map(
      subjects.map((s) => [(s._id as ObjectId).toString(), s.name as string])
    );

    // Validate classIds exist for this tenant+branch.
    const classObjIds = data.classIds.map((id) => new ObjectId(id));
    const classCount = await collections.classes.countDocuments({
      _id: { $in: classObjIds },
      tenantId: tenantObjId,
      branchId: branchObjId,
    });
    if (classCount !== classObjIds.length) {
      throw new ApiError('CLASS_NOT_FOUND', 'One or more classes not found', 404);
    }

    const { termId, termName } = await resolveTerm(
      tenantId,
      data.academicBatchId,
      data.termId,
      data.termName
    );

    const now = new Date();
    const doc: ExamDocument = {
      _id: new ObjectId(),
      tenantId: tenantObjId,
      branchId: branchObjId,
      academicBatchId: new ObjectId(data.academicBatchId),
      ...(termId && { termId }),
      termName,
      name: data.name.trim(),
      type: data.type,
      classIds: classObjIds,
      papers: data.papers.map((p) => ({
        _id: new ObjectId(),
        subjectId: new ObjectId(p.subjectId),
        subjectName: subjectNameById.get(p.subjectId) || 'Unknown',
        totalMarks: p.totalMarks,
        passMarks: p.passMarks,
        weight: p.weight,
      })),
      status: 'draft',
      startDate: data.startDate,
      endDate: data.endDate,
      instructions: data.instructions,
      createdBy: new ObjectId(createdBy),
      createdAt: now,
      updatedAt: now,
    };

    await collections.exams.insertOne(doc);
    logger.info({ examId: doc._id.toString(), tenantId, branchId, name: doc.name }, 'Exam created');
    return formatExam(doc as WithId<ExamDocument>);
  }

  async list(
    tenantId: string,
    branchId: string,
    query: {
      academicBatchId?: string;
      termId?: string;
      termName?: string;
      status?: ExamStatus;
      type?: ExamType;
      classId?: string;
      /** Scope guard: class ids the caller is confined to (null = unrestricted). */
      restrictToClassIds?: ObjectId[] | null;
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    }
  ) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);

    const filter: Filter<Document> = {
      tenantId: tenantObjId,
      branchId: branchObjId,
    };
    if (query.academicBatchId) filter.academicBatchId = new ObjectId(query.academicBatchId);
    if (query.termId) filter.termId = new ObjectId(query.termId);
    if (query.termName) filter.termName = query.termName;
    if (query.status) filter.status = query.status;
    if (query.type) filter.type = query.type;
    // An exam lists the classes it covers, so the scope guard matches on the
    // array: a department-scoped user sees exams touching their classes.
    const classFilter = intersectScope(query.restrictToClassIds ?? null, query.classId);
    if (classFilter !== undefined) filter.classIds = classFilter;

    const { page, limit, sortBy, sortOrder } = getPagination({
      page: query.page,
      limit: query.limit,
      sortBy: query.sortBy ?? 'startDate',
      sortOrder: query.sortOrder,
    });
    const skip = (page - 1) * limit;

    const total = await collections.exams.countDocuments(filter);
    const docs = (await collections.exams
      .find(filter)
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .toArray()) as WithId<ExamDocument>[];

    return {
      data: docs.map(formatExam),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async findById(tenantId: string, branchId: string, id: string) {
    const doc = (await collections.exams.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    })) as WithId<ExamDocument> | null;
    if (!doc) throw new ApiError('NOT_FOUND', 'Exam not found', 404);
    return formatExam(doc);
  }

  async update(tenantId: string, branchId: string, id: string, data: Partial<CreateExamInput>) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);
    const examObjId = new ObjectId(id);

    const existing = (await collections.exams.findOne({
      _id: examObjId,
      tenantId: tenantObjId,
      branchId: branchObjId,
    })) as WithId<ExamDocument> | null;
    if (!existing) throw new ApiError('NOT_FOUND', 'Exam not found', 404);

    if (existing.status === 'results_published') {
      throw new ApiError(
        'STATUS_LOCKED',
        'Published exams cannot be edited. Roll back status first.',
        400
      );
    }

    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) set.name = data.name.trim();
    if (data.type !== undefined) set.type = data.type;
    if (data.termId !== undefined || data.termName !== undefined) {
      const resolved = await resolveTerm(
        tenantId,
        existing.academicBatchId.toString(),
        data.termId,
        data.termName
      );
      set.termName = resolved.termName;
      if (resolved.termId) set.termId = resolved.termId;
    }
    if (data.startDate !== undefined) set.startDate = data.startDate;
    if (data.endDate !== undefined) set.endDate = data.endDate;
    if (data.instructions !== undefined) set.instructions = data.instructions;

    if (data.classIds) {
      const classObjIds = data.classIds.map((cid) => new ObjectId(cid));
      const classCount = await collections.classes.countDocuments({
        _id: { $in: classObjIds },
        tenantId: tenantObjId,
        branchId: branchObjId,
      });
      if (classCount !== classObjIds.length) {
        throw new ApiError('CLASS_NOT_FOUND', 'One or more classes not found', 404);
      }
      set.classIds = classObjIds;
    }

    if (data.papers) {
      const subjectIds = data.papers.map((p) => new ObjectId(p.subjectId));
      const subjects = await collections.subjects
        .find({ _id: { $in: subjectIds }, tenantId: tenantObjId })
        .project({ _id: 1, name: 1 })
        .toArray();
      const nameById = new Map(
        subjects.map((s) => [(s._id as ObjectId).toString(), s.name as string])
      );
      // Preserve existing paper _ids when subjectId matches, so schedules/results
      // referencing them don't get orphaned.
      const existingBySubject = new Map(existing.papers.map((p) => [p.subjectId.toString(), p]));
      set.papers = data.papers.map((p) => {
        const prior = existingBySubject.get(p.subjectId);
        return {
          _id: prior?._id ?? new ObjectId(),
          subjectId: new ObjectId(p.subjectId),
          subjectName: nameById.get(p.subjectId) || prior?.subjectName || 'Unknown',
          totalMarks: p.totalMarks,
          passMarks: p.passMarks,
          weight: p.weight,
        };
      });
    }

    const result = await collections.exams.findOneAndUpdate(
      { _id: examObjId, tenantId: tenantObjId, branchId: branchObjId },
      { $set: set },
      { returnDocument: 'after' }
    );
    if (!result) throw new ApiError('NOT_FOUND', 'Exam not found', 404);
    return formatExam(result as WithId<ExamDocument>);
  }

  async delete(tenantId: string, branchId: string, id: string) {
    const examObjId = new ObjectId(id);
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);

    const existing = await collections.exams.findOne({
      _id: examObjId,
      tenantId: tenantObjId,
      branchId: branchObjId,
    });
    if (!existing) throw new ApiError('NOT_FOUND', 'Exam not found', 404);

    // Refuse to delete if any results exist — admin should explicitly clear them
    // first. Prevents accidental data loss.
    const resultCount = await collections.examResults.countDocuments({
      tenantId: tenantObjId,
      examId: examObjId,
    });
    if (resultCount > 0) {
      throw new ApiError(
        'HAS_RESULTS',
        `Cannot delete — ${resultCount} result row(s) exist for this exam. Delete results first.`,
        400
      );
    }

    await collections.examResults.deleteMany({ tenantId: tenantObjId, examId: examObjId });
    await collections.examSchedules.deleteMany({ tenantId: tenantObjId, examId: examObjId });
    await collections.coScholasticResults.deleteMany({ tenantId: tenantObjId, examId: examObjId });
    await collections.exams.deleteOne({
      _id: examObjId,
      tenantId: tenantObjId,
      branchId: branchObjId,
    });
    logger.info({ examId: id, tenantId }, 'Exam deleted');
  }

  async setStatus(tenantId: string, branchId: string, id: string, status: ExamStatus) {
    if (!EXAM_STATUSES.includes(status)) {
      throw new ApiError('INVALID_STATUS', `Unknown status "${status}"`, 400);
    }
    const examObjId = new ObjectId(id);
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);

    const existing = (await collections.exams.findOne({
      _id: examObjId,
      tenantId: tenantObjId,
      branchId: branchObjId,
    })) as WithId<ExamDocument> | null;
    if (!existing) throw new ApiError('NOT_FOUND', 'Exam not found', 404);

    if (existing.status === status) return formatExam(existing);

    const allowed = STATUS_ADJACENCY[existing.status] || [];
    if (!allowed.includes(status)) {
      throw new ApiError(
        'INVALID_TRANSITION',
        `Cannot transition from "${existing.status}" to "${status}"`,
        400
      );
    }

    const result = await collections.exams.findOneAndUpdate(
      { _id: examObjId, tenantId: tenantObjId, branchId: branchObjId },
      { $set: { status, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
    if (!result) throw new ApiError('NOT_FOUND', 'Exam not found', 404);
    logger.info({ examId: id, from: existing.status, to: status }, 'Exam status changed');
    return formatExam(result as WithId<ExamDocument>);
  }
}

export const examService = new ExamService();

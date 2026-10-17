import { ObjectId, WithId, Document, Filter } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import type { ExamDocument } from './exam.service';

interface ExamScheduleDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  examId: ObjectId;
  paperId: ObjectId;
  subjectId: ObjectId;
  subjectName: string;
  sectionId: ObjectId;
  sectionName: string;
  classId: ObjectId;
  className: string;
  date: Date;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  totalMarks: number;
  passMarks: number;
  room?: string;
  invigilatorIds?: ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

interface CreateScheduleInput {
  examId: string;
  paperId: string;
  sectionId: string;
  date: Date;
  startTime: string;
  endTime: string;
  durationMinutes?: number;
  room?: string;
  invigilatorIds?: string[];
}

interface BulkScheduleInput {
  examId: string;
  paperId: string;
  sectionIds: string[];
  date: Date;
  startTime: string;
  endTime: string;
  durationMinutes?: number;
  room?: string;
  invigilatorIds?: string[];
}

function deriveDuration(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  return Math.max(0, end - start);
}

function formatSchedule(doc: WithId<ExamScheduleDocument>) {
  return {
    _id: doc._id.toString(),
    examId: doc.examId.toString(),
    paperId: doc.paperId.toString(),
    subjectId: doc.subjectId.toString(),
    subjectName: doc.subjectName,
    sectionId: doc.sectionId.toString(),
    sectionName: doc.sectionName,
    classId: doc.classId.toString(),
    className: doc.className,
    date: doc.date,
    startTime: doc.startTime,
    endTime: doc.endTime,
    durationMinutes: doc.durationMinutes,
    totalMarks: doc.totalMarks,
    passMarks: doc.passMarks,
    room: doc.room,
    invigilatorIds: doc.invigilatorIds?.map((id) => id.toString()),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

class ScheduleService {
  /**
   * Resolves the exam, validates that the paper belongs to it, and resolves
   * section/class context. Returns the denormalised fields shared by every
   * schedule row.
   */
  private async resolveContext(
    tenantId: string,
    branchId: string,
    examId: string,
    paperId: string,
    sectionId: string
  ) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);
    const examObjId = new ObjectId(examId);
    const paperObjId = new ObjectId(paperId);
    const sectionObjId = new ObjectId(sectionId);

    const exam = (await collections.exams.findOne({
      _id: examObjId,
      tenantId: tenantObjId,
      branchId: branchObjId,
    })) as WithId<ExamDocument> | null;
    if (!exam) throw new ApiError('NOT_FOUND', 'Exam not found', 404);

    const paper = exam.papers.find((p) => p._id.toString() === paperId);
    if (!paper) throw new ApiError('PAPER_NOT_FOUND', `Paper "${paperId}" not in exam`, 404);

    const section = await collections.sections.findOne({
      _id: sectionObjId,
      tenantId: tenantObjId,
      branchId: branchObjId,
    });
    if (!section) throw new ApiError('SECTION_NOT_FOUND', 'Section not found', 404);

    const classObjId = section.classId as ObjectId;
    if (!exam.classIds.some((c) => c.toString() === classObjId.toString())) {
      throw new ApiError('CLASS_NOT_IN_EXAM', "Section's class is not part of this exam", 400);
    }
    const klass = await collections.classes.findOne({
      _id: classObjId,
      tenantId: tenantObjId,
      branchId: branchObjId,
    });
    if (!klass) throw new ApiError('CLASS_NOT_FOUND', 'Class not found', 404);

    return {
      tenantObjId,
      branchObjId,
      examObjId,
      paperObjId,
      paper,
      sectionObjId,
      sectionName: (section.name as string) || '',
      classObjId,
      className: (klass.displayName as string) || (klass.name as string) || '',
    };
  }

  async create(tenantId: string, branchId: string, data: CreateScheduleInput) {
    const ctx = await this.resolveContext(
      tenantId,
      branchId,
      data.examId,
      data.paperId,
      data.sectionId
    );

    const now = new Date();
    const durationMinutes = data.durationMinutes ?? deriveDuration(data.startTime, data.endTime);

    const doc: ExamScheduleDocument = {
      _id: new ObjectId(),
      tenantId: ctx.tenantObjId,
      branchId: ctx.branchObjId,
      examId: ctx.examObjId,
      paperId: ctx.paperObjId,
      subjectId: ctx.paper.subjectId,
      subjectName: ctx.paper.subjectName,
      sectionId: ctx.sectionObjId,
      sectionName: ctx.sectionName,
      classId: ctx.classObjId,
      className: ctx.className,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      durationMinutes,
      totalMarks: ctx.paper.totalMarks,
      passMarks: ctx.paper.passMarks,
      room: data.room,
      invigilatorIds: data.invigilatorIds?.map((id) => new ObjectId(id)),
      createdAt: now,
      updatedAt: now,
    };

    await collections.examSchedules.insertOne(doc);
    logger.info(
      { scheduleId: doc._id.toString(), examId: data.examId, paperId: data.paperId },
      'Exam schedule created'
    );
    return formatSchedule(doc as WithId<ExamScheduleDocument>);
  }

  /**
   * Bulk-schedule one paper across many sections on the same date/time. If a
   * schedule already exists for `{exam, paper, section}` it's updated in place
   * (idempotent re-schedule) rather than creating a duplicate.
   */
  async bulkCreate(tenantId: string, branchId: string, data: BulkScheduleInput) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);
    const examObjId = new ObjectId(data.examId);
    const paperObjId = new ObjectId(data.paperId);

    // Resolve exam + paper once.
    const exam = (await collections.exams.findOne({
      _id: examObjId,
      tenantId: tenantObjId,
      branchId: branchObjId,
    })) as WithId<ExamDocument> | null;
    if (!exam) throw new ApiError('NOT_FOUND', 'Exam not found', 404);
    const paper = exam.papers.find((p) => p._id.toString() === data.paperId);
    if (!paper) throw new ApiError('PAPER_NOT_FOUND', 'Paper not found', 404);

    // Resolve sections in bulk.
    const sectionObjIds = data.sectionIds.map((id) => new ObjectId(id));
    const sections = await collections.sections
      .find({ _id: { $in: sectionObjIds }, tenantId: tenantObjId, branchId: branchObjId })
      .project({ _id: 1, name: 1, classId: 1 })
      .toArray();
    if (sections.length !== sectionObjIds.length) {
      throw new ApiError('SECTION_NOT_FOUND', 'One or more sections not found', 404);
    }

    const classIds = [...new Set(sections.map((s) => (s.classId as ObjectId).toString()))];
    const classes = await collections.classes
      .find({
        _id: { $in: classIds.map((id) => new ObjectId(id)) },
        tenantId: tenantObjId,
        branchId: branchObjId,
      })
      .project({ _id: 1, name: 1, displayName: 1 })
      .toArray();
    const classMap = new Map(
      classes.map((c) => [
        (c._id as ObjectId).toString(),
        (c.displayName as string) || (c.name as string) || '',
      ])
    );

    const now = new Date();
    const durationMinutes = data.durationMinutes ?? deriveDuration(data.startTime, data.endTime);

    const operations = sections.map((s) => {
      const sectionObjId = s._id as ObjectId;
      const classObjId = s.classId as ObjectId;
      if (!exam.classIds.some((cid) => cid.toString() === classObjId.toString())) {
        throw new ApiError(
          'CLASS_NOT_IN_EXAM',
          `Section "${s.name}" belongs to a class not in this exam`,
          400
        );
      }
      return {
        updateOne: {
          filter: {
            tenantId: tenantObjId,
            examId: examObjId,
            paperId: paperObjId,
            sectionId: sectionObjId,
          },
          update: {
            $set: {
              branchId: branchObjId,
              subjectId: paper.subjectId,
              subjectName: paper.subjectName,
              sectionName: (s.name as string) || '',
              classId: classObjId,
              className: classMap.get(classObjId.toString()) || '',
              date: data.date,
              startTime: data.startTime,
              endTime: data.endTime,
              durationMinutes,
              totalMarks: paper.totalMarks,
              passMarks: paper.passMarks,
              room: data.room,
              invigilatorIds: data.invigilatorIds?.map((id) => new ObjectId(id)),
              updatedAt: now,
            },
            $setOnInsert: { createdAt: now },
          },
          upsert: true,
        },
      };
    });

    const result = await collections.examSchedules.bulkWrite(operations);
    logger.info(
      {
        examId: data.examId,
        paperId: data.paperId,
        sections: sections.length,
        upserted: result.upsertedCount,
        modified: result.modifiedCount,
      },
      'Exam schedules bulk-created'
    );
    return {
      sectionsScheduled: sections.length,
      upserted: result.upsertedCount,
      modified: result.modifiedCount,
    };
  }

  async list(
    tenantId: string,
    branchId: string,
    query: {
      examId?: string;
      paperId?: string;
      sectionId?: string;
      fromDate?: Date;
      toDate?: Date;
    }
  ) {
    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };
    if (query.examId) filter.examId = new ObjectId(query.examId);
    if (query.paperId) filter.paperId = new ObjectId(query.paperId);
    if (query.sectionId) filter.sectionId = new ObjectId(query.sectionId);
    if (query.fromDate || query.toDate) {
      filter.date = {};
      if (query.fromDate) (filter.date as Record<string, Date>).$gte = query.fromDate;
      if (query.toDate) (filter.date as Record<string, Date>).$lte = query.toDate;
    }

    const docs = (await collections.examSchedules
      .find(filter)
      .sort({ date: 1, startTime: 1 })
      .toArray()) as WithId<ExamScheduleDocument>[];

    return docs.map(formatSchedule);
  }

  async update(
    tenantId: string,
    branchId: string,
    id: string,
    data: Partial<Omit<CreateScheduleInput, 'examId' | 'paperId' | 'sectionId'>>
  ) {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (data.date !== undefined) set.date = data.date;
    if (data.startTime !== undefined) set.startTime = data.startTime;
    if (data.endTime !== undefined) set.endTime = data.endTime;
    if (data.durationMinutes !== undefined) set.durationMinutes = data.durationMinutes;
    if (data.room !== undefined) set.room = data.room;
    if (data.invigilatorIds !== undefined)
      set.invigilatorIds = data.invigilatorIds.map((v) => new ObjectId(v));

    // Recompute duration if both times are provided.
    if (
      data.startTime !== undefined &&
      data.endTime !== undefined &&
      data.durationMinutes === undefined
    ) {
      set.durationMinutes = deriveDuration(data.startTime, data.endTime);
    }

    const result = await collections.examSchedules.findOneAndUpdate(
      {
        _id: new ObjectId(id),
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
      },
      { $set: set },
      { returnDocument: 'after' }
    );
    if (!result) throw new ApiError('NOT_FOUND', 'Schedule not found', 404);
    return formatSchedule(result as WithId<ExamScheduleDocument>);
  }

  async delete(tenantId: string, branchId: string, id: string) {
    const examScheduleId = new ObjectId(id);
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);

    const existing = await collections.examSchedules.findOne({
      _id: examScheduleId,
      tenantId: tenantObjId,
      branchId: branchObjId,
    });
    if (!existing) throw new ApiError('NOT_FOUND', 'Schedule not found', 404);

    // Refuse deletion if marks have been entered for this schedule.
    const resultCount = await collections.examResults.countDocuments({
      tenantId: tenantObjId,
      examId: existing.examId,
      paperId: existing.paperId,
      sectionId: existing.sectionId,
    });
    if (resultCount > 0) {
      throw new ApiError(
        'HAS_RESULTS',
        `${resultCount} mark row(s) exist for this schedule. Delete results first.`,
        400
      );
    }

    await collections.examSchedules.deleteOne({
      _id: examScheduleId,
      tenantId: tenantObjId,
      branchId: branchObjId,
    });
  }
}

export const scheduleService = new ScheduleService();

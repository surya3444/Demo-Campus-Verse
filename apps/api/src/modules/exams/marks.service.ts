import { ObjectId, WithId, Document } from 'mongodb';
import type { Filter } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { gradeForPercent, type GradingScaleBand } from '@campus-verse/shared/constants';
import { examSettingsService } from './settings.service';
import type { ExamDocument } from './exam.service';
import { getElectiveRosterFilter } from '../registration/roster';

export interface ExamResultDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  examId: ObjectId;
  paperId: ObjectId;
  scheduleId?: ObjectId;
  studentId: ObjectId;
  admissionNumber?: string;
  studentName: string;
  sectionId: ObjectId;
  classId: ObjectId;
  subjectId: ObjectId;
  subjectName: string;
  marksObtained: number;
  totalMarks: number;
  passMarks: number;
  percentage: number;
  grade?: string;
  gradePoints?: number;
  passed: boolean;
  absent: boolean;
  remarks?: string;
  enteredBy: ObjectId;
  enteredAt: Date;
  publishedAt?: Date;
  publishedBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

interface UpsertMarkInput {
  examId: string;
  paperId: string;
  scheduleId?: string;
  studentId: string;
  marksObtained: number;
  absent?: boolean;
  remarks?: string;
}

interface BulkMarksInput {
  examId: string;
  paperId: string;
  scheduleId?: string;
  marks: Array<{
    studentId: string;
    marksObtained: number;
    absent?: boolean;
    remarks?: string;
  }>;
}

function formatResult(doc: WithId<ExamResultDocument>) {
  return {
    _id: doc._id.toString(),
    examId: doc.examId.toString(),
    paperId: doc.paperId.toString(),
    scheduleId: doc.scheduleId?.toString(),
    studentId: doc.studentId.toString(),
    admissionNumber: doc.admissionNumber,
    studentName: doc.studentName,
    sectionId: doc.sectionId.toString(),
    classId: doc.classId.toString(),
    subjectId: doc.subjectId.toString(),
    subjectName: doc.subjectName,
    marksObtained: doc.marksObtained,
    totalMarks: doc.totalMarks,
    passMarks: doc.passMarks,
    percentage: doc.percentage,
    grade: doc.grade,
    gradePoints: doc.gradePoints,
    passed: doc.passed,
    absent: doc.absent,
    remarks: doc.remarks,
    enteredBy: doc.enteredBy.toString(),
    enteredAt: doc.enteredAt,
    publishedAt: doc.publishedAt,
    publishedBy: doc.publishedBy?.toString(),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function computeGrade(percentage: number, scale: GradingScaleBand[]) {
  const band = gradeForPercent(percentage, scale);
  return {
    grade: band?.grade,
    gradePoints: band?.points,
  };
}

class MarksService {
  private async loadExamAndPaper(
    tenantId: string,
    branchId: string,
    examId: string,
    paperId: string
  ) {
    const exam = (await collections.exams.findOne({
      _id: new ObjectId(examId),
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    })) as WithId<ExamDocument> | null;
    if (!exam) throw new ApiError('NOT_FOUND', 'Exam not found', 404);
    const paper = exam.papers.find((p) => p._id.toString() === paperId);
    if (!paper) throw new ApiError('PAPER_NOT_FOUND', 'Paper not found', 404);
    return { exam, paper };
  }

  /** Single-student mark upsert. Used for inline edits or per-row API calls. */
  async upsert(tenantId: string, branchId: string, data: UpsertMarkInput, enteredBy: string) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);
    const { exam, paper } = await this.loadExamAndPaper(
      tenantId,
      branchId,
      data.examId,
      data.paperId
    );

    if (exam.status === 'results_published') {
      throw new ApiError(
        'STATUS_LOCKED',
        'Results are already published. Roll back exam status to edit marks.',
        400
      );
    }

    // Validate marks against paper.totalMarks.
    if (!data.absent) {
      if (data.marksObtained < 0) {
        throw new ApiError('INVALID_MARKS', 'Marks cannot be negative', 400);
      }
      if (data.marksObtained > paper.totalMarks) {
        throw new ApiError('INVALID_MARKS', `Marks cannot exceed total (${paper.totalMarks})`, 400);
      }
    }

    const student = await collections.students.findOne({
      _id: new ObjectId(data.studentId),
      tenantId: tenantObjId,
    });
    if (!student) throw new ApiError('STUDENT_NOT_FOUND', 'Student not found', 404);

    const enrollment = student.currentEnrollment as
      | { classId?: ObjectId; sectionId?: ObjectId }
      | undefined;
    if (!enrollment?.sectionId || !enrollment.classId) {
      throw new ApiError(
        'STUDENT_NOT_ENROLLED',
        'Student has no current class/section enrollment',
        400
      );
    }

    const scale = await examSettingsService.getGradingScale(tenantId, branchId);
    const absent = data.absent ?? false;
    const marksObtained = absent ? 0 : data.marksObtained;
    const percentage =
      paper.totalMarks > 0 ? Math.round((marksObtained / paper.totalMarks) * 10000) / 100 : 0;
    const { grade, gradePoints } = absent
      ? { grade: undefined, gradePoints: undefined }
      : computeGrade(percentage, scale);
    const passed = !absent && marksObtained >= paper.passMarks;

    const studentName =
      (student.displayName as string) ||
      `${(student.firstName as string) ?? ''} ${(student.lastName as string) ?? ''}`.trim();

    const now = new Date();
    const result = await collections.examResults.findOneAndUpdate(
      {
        tenantId: tenantObjId,
        examId: new ObjectId(data.examId),
        paperId: new ObjectId(data.paperId),
        studentId: new ObjectId(data.studentId),
      },
      {
        $set: {
          tenantId: tenantObjId,
          branchId: branchObjId,
          examId: new ObjectId(data.examId),
          paperId: new ObjectId(data.paperId),
          scheduleId: data.scheduleId ? new ObjectId(data.scheduleId) : undefined,
          studentId: new ObjectId(data.studentId),
          admissionNumber: (student.admissionNumber as string) || undefined,
          studentName,
          sectionId: enrollment.sectionId,
          classId: enrollment.classId,
          subjectId: paper.subjectId,
          subjectName: paper.subjectName,
          marksObtained,
          totalMarks: paper.totalMarks,
          passMarks: paper.passMarks,
          percentage,
          grade,
          gradePoints,
          passed,
          absent,
          remarks: data.remarks,
          enteredBy: new ObjectId(enteredBy),
          enteredAt: now,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true, returnDocument: 'after' }
    );

    if (!result) throw new ApiError('UPSERT_FAILED', 'Failed to save mark', 500);
    return formatResult(result as WithId<ExamResultDocument>);
  }

  /**
   * Bulk-upsert marks for many students on the same paper. Each row independently
   * validated; an invalid row aborts the whole batch (callers expect all-or-nothing).
   */
  async bulkUpsert(tenantId: string, branchId: string, data: BulkMarksInput, enteredBy: string) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);
    const { exam, paper } = await this.loadExamAndPaper(
      tenantId,
      branchId,
      data.examId,
      data.paperId
    );

    if (exam.status === 'results_published') {
      throw new ApiError('STATUS_LOCKED', 'Results are already published.', 400);
    }

    // Pre-validate marks (collect all errors before any DB write).
    const errors: Array<{ index: number; studentId: string; message: string }> = [];
    for (let i = 0; i < data.marks.length; i++) {
      const m = data.marks[i];
      const absent = m.absent ?? false;
      if (!absent) {
        if (m.marksObtained < 0) {
          errors.push({ index: i, studentId: m.studentId, message: 'Marks cannot be negative' });
        }
        if (m.marksObtained > paper.totalMarks) {
          errors.push({
            index: i,
            studentId: m.studentId,
            message: `Marks exceed paper total (${paper.totalMarks})`,
          });
        }
      }
    }
    if (errors.length > 0) {
      throw new ApiError('INVALID_MARKS', 'Some rows have invalid marks', 400, errors);
    }

    // Resolve students in one query.
    const studentObjIds = data.marks.map((m) => new ObjectId(m.studentId));
    const students = await collections.students
      .find({ _id: { $in: studentObjIds }, tenantId: tenantObjId })
      .project({
        _id: 1,
        firstName: 1,
        lastName: 1,
        displayName: 1,
        admissionNumber: 1,
        currentEnrollment: 1,
      })
      .toArray();
    const studentById = new Map(students.map((s) => [(s._id as ObjectId).toString(), s]));
    const missing = data.marks.filter((m) => !studentById.has(m.studentId));
    if (missing.length > 0) {
      throw new ApiError(
        'STUDENT_NOT_FOUND',
        `Students not found: ${missing.map((m) => m.studentId).join(', ')}`,
        404
      );
    }

    const scale = await examSettingsService.getGradingScale(tenantId, branchId);
    const now = new Date();

    const operations = data.marks.map((m) => {
      const student = studentById.get(m.studentId)!;
      const enrollment = student.currentEnrollment as
        | { classId?: ObjectId; sectionId?: ObjectId }
        | undefined;
      if (!enrollment?.sectionId || !enrollment.classId) {
        throw new ApiError(
          'STUDENT_NOT_ENROLLED',
          `Student ${m.studentId} has no current enrollment`,
          400
        );
      }

      const absent = m.absent ?? false;
      const marksObtained = absent ? 0 : m.marksObtained;
      const percentage =
        paper.totalMarks > 0 ? Math.round((marksObtained / paper.totalMarks) * 10000) / 100 : 0;
      const { grade, gradePoints } = absent
        ? { grade: undefined, gradePoints: undefined }
        : computeGrade(percentage, scale);
      const passed = !absent && marksObtained >= paper.passMarks;

      const studentName =
        (student.displayName as string) ||
        `${(student.firstName as string) ?? ''} ${(student.lastName as string) ?? ''}`.trim();

      return {
        updateOne: {
          filter: {
            tenantId: tenantObjId,
            examId: new ObjectId(data.examId),
            paperId: new ObjectId(data.paperId),
            studentId: new ObjectId(m.studentId),
          },
          update: {
            $set: {
              tenantId: tenantObjId,
              branchId: branchObjId,
              examId: new ObjectId(data.examId),
              paperId: new ObjectId(data.paperId),
              scheduleId: data.scheduleId ? new ObjectId(data.scheduleId) : undefined,
              studentId: new ObjectId(m.studentId),
              admissionNumber: (student.admissionNumber as string) || undefined,
              studentName,
              sectionId: enrollment.sectionId,
              classId: enrollment.classId,
              subjectId: paper.subjectId,
              subjectName: paper.subjectName,
              marksObtained,
              totalMarks: paper.totalMarks,
              passMarks: paper.passMarks,
              percentage,
              grade,
              gradePoints,
              passed,
              absent,
              remarks: m.remarks,
              enteredBy: new ObjectId(enteredBy),
              enteredAt: now,
              updatedAt: now,
            },
            $setOnInsert: { createdAt: now },
          },
          upsert: true,
        },
      };
    });

    const result = await collections.examResults.bulkWrite(operations);
    logger.info(
      {
        examId: data.examId,
        paperId: data.paperId,
        rows: data.marks.length,
        upserted: result.upsertedCount,
        modified: result.modifiedCount,
      },
      'Marks bulk-upsert completed'
    );
    return {
      total: data.marks.length,
      upserted: result.upsertedCount,
      modified: result.modifiedCount,
    };
  }

  /**
   * Section-level marks listing for a paper. Joins on students so unmarked
   * students appear with `marksObtained: null` — gives the UI a complete
   * roster to fill in.
   */
  async listForPaperSection(
    tenantId: string,
    branchId: string,
    query: { examId: string; paperId: string; sectionId: string }
  ) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);
    const examObjId = new ObjectId(query.examId);
    const paperObjId = new ObjectId(query.paperId);
    const sectionObjId = new ObjectId(query.sectionId);

    // Roster: every student currently enrolled in this section — narrowed to
    // registered students when the paper's subject is an elective (course-
    // registration integration; cores keep the full section).
    const { paper } = await this.loadExamAndPaper(tenantId, branchId, query.examId, query.paperId);
    const rosterFilter: Filter<Document> = {
      tenantId: tenantObjId,
      branchId: branchObjId,
      'currentEnrollment.sectionId': sectionObjId,
      status: { $ne: 'inactive' },
    };
    const electiveRoster = await getElectiveRosterFilter(
      tenantId,
      branchId,
      paper.subjectId.toString()
    );
    if (electiveRoster !== null) {
      rosterFilter._id = { $in: electiveRoster };
    }

    const students = await collections.students
      .find(rosterFilter)
      .project({
        _id: 1,
        firstName: 1,
        lastName: 1,
        displayName: 1,
        admissionNumber: 1,
        rollNumber: 1,
      })
      .sort({ rollNumber: 1, admissionNumber: 1 })
      .toArray();

    const results = (await collections.examResults
      .find({
        tenantId: tenantObjId,
        examId: examObjId,
        paperId: paperObjId,
        sectionId: sectionObjId,
      })
      .toArray()) as WithId<ExamResultDocument>[];
    const byStudent = new Map(results.map((r) => [r.studentId.toString(), r]));

    return students.map((s) => {
      const sid = (s._id as ObjectId).toString();
      const found = byStudent.get(sid);
      const studentName =
        (s.displayName as string) ||
        `${(s.firstName as string) ?? ''} ${(s.lastName as string) ?? ''}`.trim();
      if (found) return formatResult(found);
      return {
        _id: null,
        examId: query.examId,
        paperId: query.paperId,
        studentId: sid,
        admissionNumber: (s.admissionNumber as string) || undefined,
        rollNumber: (s.rollNumber as string) || undefined,
        studentName,
        marksObtained: null,
        absent: false,
        percentage: null,
        grade: null,
        passed: null,
      };
    });
  }

  async listForExam(tenantId: string, branchId: string, examId: string) {
    return (await collections.examResults
      .find({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        examId: new ObjectId(examId),
      })
      .toArray()) as WithId<ExamResultDocument>[];
  }

  async listForStudent(
    tenantId: string,
    studentId: string,
    opts: { onlyPublished?: boolean } = {}
  ) {
    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      studentId: new ObjectId(studentId),
    };
    if (opts.onlyPublished) filter.publishedAt = { $exists: true };
    const docs = (await collections.examResults
      .find(filter)
      .sort({ enteredAt: -1 })
      .toArray()) as WithId<ExamResultDocument>[];
    return docs.map(formatResult);
  }

  async publishResults(
    tenantId: string,
    branchId: string,
    examId: string,
    publishedBy: string,
    filters: { paperId?: string; studentIds?: string[] } = {}
  ) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);
    const examObjId = new ObjectId(examId);

    const filter: Filter<Document> = {
      tenantId: tenantObjId,
      branchId: branchObjId,
      examId: examObjId,
    };
    if (filters.paperId) filter.paperId = new ObjectId(filters.paperId);
    if (filters.studentIds && filters.studentIds.length > 0)
      filter.studentId = { $in: filters.studentIds.map((id) => new ObjectId(id)) };

    const now = new Date();
    const result = await collections.examResults.updateMany(filter, {
      $set: { publishedAt: now, publishedBy: new ObjectId(publishedBy), updatedAt: now },
    });

    logger.info({ examId, modified: result.modifiedCount, filters }, 'Exam results published');

    // If the whole exam is published (no narrow filter), flip the exam status.
    if (!filters.paperId && (!filters.studentIds || filters.studentIds.length === 0)) {
      await collections.exams.updateOne(
        { _id: examObjId, tenantId: tenantObjId, branchId: branchObjId },
        { $set: { status: 'results_published', updatedAt: now } }
      );
    }

    return { published: result.modifiedCount };
  }

  /**
   * Section summary for the exam dashboard. Per paper, returns avg/high/low
   * marks plus count of pass/fail students. Used by the results-tab UI.
   */
  async sectionReport(tenantId: string, branchId: string, examId: string, sectionId: string) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);
    const examObjId = new ObjectId(examId);
    const sectionObjId = new ObjectId(sectionId);

    const rows = await collections.examResults
      .aggregate([
        {
          $match: {
            tenantId: tenantObjId,
            branchId: branchObjId,
            examId: examObjId,
            sectionId: sectionObjId,
          },
        },
        {
          $group: {
            _id: { paperId: '$paperId', subjectName: '$subjectName' },
            entered: { $sum: 1 },
            absent: { $sum: { $cond: ['$absent', 1, 0] } },
            passed: { $sum: { $cond: ['$passed', 1, 0] } },
            failed: {
              $sum: { $cond: [{ $and: [{ $not: '$absent' }, { $not: '$passed' }] }, 1, 0] },
            },
            highest: { $max: '$marksObtained' },
            lowest: { $min: '$marksObtained' },
            avgMarks: { $avg: '$marksObtained' },
            avgPercentage: { $avg: '$percentage' },
            totalMarks: { $first: '$totalMarks' },
          },
        },
        { $sort: { '_id.subjectName': 1 } },
      ])
      .toArray();

    return rows.map((r) => ({
      paperId: (r._id.paperId as ObjectId).toString(),
      subjectName: r._id.subjectName as string,
      entered: r.entered as number,
      absent: r.absent as number,
      passed: r.passed as number,
      failed: r.failed as number,
      highest: r.highest as number | null,
      lowest: r.lowest as number | null,
      avgMarks: r.avgMarks != null ? Math.round((r.avgMarks as number) * 100) / 100 : null,
      avgPercentage:
        r.avgPercentage != null ? Math.round((r.avgPercentage as number) * 100) / 100 : null,
      totalMarks: r.totalMarks as number,
    }));
  }
}

export const marksService = new MarksService();

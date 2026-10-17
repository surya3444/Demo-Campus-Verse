import { termNumbersForClasses } from '../organization/termNumbering';
import { ObjectId, WithId, Document } from 'mongodb';
import type { Filter } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { gradeForPercent } from '@campus-verse/shared/constants';
import { examSettingsService } from './settings.service';
import type { ExamDocument } from './exam.service';
import { renderReportCardPdf, uploadReportCardPdf } from './reportCard.pdf';
import { dispatchResultPublishedNotifications } from './notifications';
import { recomputeAcademicSummaries } from './academicSummary.service';

interface ReportCardSubjectRow {
  paperId: ObjectId;
  subjectId: ObjectId;
  subjectName: string;
  marksObtained: number;
  totalMarks: number;
  percentage: number;
  grade?: string;
  /** Credit weight of the subject; drives SGPA. Absent for schools. */
  credits?: number;
  /** Grade points from the grading scale band; drives SGPA. */
  gradePoints?: number;
  passed: boolean;
  absent: boolean;
  remarks?: string;
}

interface CoScholasticRow {
  areaName: string;
  grade: string;
  remarks?: string;
}

interface OverallSummary {
  totalMarksObtained: number;
  totalMarks: number;
  percentage: number;
  grade?: string;
  rank?: number;
  passed: boolean;
  /** Credit-weighted grade point average for this exam's subjects. */
  sgpa?: number;
  totalCredits?: number;
  earnedCredits?: number;
}

interface AttendanceSummary {
  present: number;
  total: number;
  percent: number;
}

export interface ReportCardDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  examId: ObjectId;
  studentId: ObjectId;
  admissionNumber?: string;
  studentName: string;
  rollNumber?: string;
  sectionId: ObjectId;
  sectionName: string;
  classId: ObjectId;
  className: string;
  academicBatchId: ObjectId;
  termId?: ObjectId;
  termName: string;
  semesterNumber?: number;
  examName: string;
  scholastic: ReportCardSubjectRow[];
  coScholastic?: CoScholasticRow[];
  overall: OverallSummary;
  attendance?: AttendanceSummary;
  remarks?: string;
  pdfKey?: string;
  pdfUrl?: string;
  status: 'draft' | 'published';
  generatedBy: ObjectId;
  generatedAt: Date;
  publishedBy?: ObjectId;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface ResolvedStudent {
  _id: ObjectId;
  studentName: string;
  admissionNumber?: string;
  rollNumber?: string;
  sectionId: ObjectId;
  sectionName: string;
  classId: ObjectId;
  className: string;
}

function formatReportCard(doc: WithId<ReportCardDocument>) {
  return {
    _id: doc._id.toString(),
    examId: doc.examId.toString(),
    studentId: doc.studentId.toString(),
    admissionNumber: doc.admissionNumber,
    studentName: doc.studentName,
    rollNumber: doc.rollNumber,
    sectionId: doc.sectionId.toString(),
    sectionName: doc.sectionName,
    classId: doc.classId.toString(),
    className: doc.className,
    academicBatchId: doc.academicBatchId.toString(),
    termId: doc.termId?.toString(),
    termName: doc.termName,
    semesterNumber: doc.semesterNumber,
    examName: doc.examName,
    scholastic: doc.scholastic.map((s) => ({
      paperId: s.paperId.toString(),
      subjectId: s.subjectId.toString(),
      subjectName: s.subjectName,
      marksObtained: s.marksObtained,
      totalMarks: s.totalMarks,
      percentage: s.percentage,
      grade: s.grade,
      credits: s.credits,
      gradePoints: s.gradePoints,
      passed: s.passed,
      absent: s.absent,
      remarks: s.remarks,
    })),
    coScholastic: doc.coScholastic,
    overall: doc.overall,
    attendance: doc.attendance,
    remarks: doc.remarks,
    pdfKey: doc.pdfKey,
    pdfUrl: doc.pdfUrl,
    status: doc.status,
    generatedBy: doc.generatedBy.toString(),
    generatedAt: doc.generatedAt,
    publishedBy: doc.publishedBy?.toString(),
    publishedAt: doc.publishedAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

class ReportCardService {
  /**
   * Generate or refresh report cards for every student in the given scope.
   * Scope rules:
   *   - examId required.
   *   - If sectionId is provided, only students in that section.
   *   - Otherwise, every section that has at least one exam_result for this exam.
   * Always regenerates the PDF; existing draft rows are upserted in place.
   *
   * Refuses to overwrite a `published` card — admin has to explicitly unpublish first.
   */
  async generate(
    tenantId: string,
    branchId: string,
    input: { examId: string; sectionId?: string; studentIds?: string[] },
    generatedBy: string
  ) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);
    const examObjId = new ObjectId(input.examId);

    const exam = (await collections.exams.findOne({
      _id: examObjId,
      tenantId: tenantObjId,
      branchId: branchObjId,
    })) as WithId<ExamDocument> | null;
    if (!exam) throw new ApiError('NOT_FOUND', 'Exam not found', 404);

    // Find every student that should get a card.
    const resultFilter: Filter<Document> = {
      tenantId: tenantObjId,
      branchId: branchObjId,
      examId: examObjId,
    };
    if (input.sectionId) resultFilter.sectionId = new ObjectId(input.sectionId);
    if (input.studentIds && input.studentIds.length > 0) {
      resultFilter.studentId = { $in: input.studentIds.map((id) => new ObjectId(id)) };
    }

    const results = await collections.examResults.find(resultFilter).toArray();
    if (results.length === 0) {
      throw new ApiError(
        'NO_RESULTS',
        'No marks have been entered for the selected scope. Enter marks first, then generate.',
        400
      );
    }

    // Group results by student.
    const byStudent = new Map<string, typeof results>();
    for (const r of results) {
      const sid = (r.studentId as ObjectId).toString();
      if (!byStudent.has(sid)) byStudent.set(sid, []);
      byStudent.get(sid)!.push(r);
    }

    // Resolve student metadata (roll number, section, class — pull fresh from students collection).
    const studentObjIds = Array.from(byStudent.keys()).map((id) => new ObjectId(id));
    const students = await collections.students
      .find({ _id: { $in: studentObjIds }, tenantId: tenantObjId })
      .project({
        _id: 1,
        firstName: 1,
        lastName: 1,
        displayName: 1,
        admissionNumber: 1,
        rollNumber: 1,
        currentEnrollment: 1,
      })
      .toArray();

    const sectionIds = [
      ...new Set(
        students
          .map((s) => (s.currentEnrollment as { sectionId?: ObjectId } | undefined)?.sectionId)
          .filter(Boolean)
          .map((id) => id!.toString())
      ),
    ];
    const sections = await collections.sections
      .find({ _id: { $in: sectionIds.map((id) => new ObjectId(id)) } })
      .project({ _id: 1, name: 1, classId: 1 })
      .toArray();
    const sectionMap = new Map(sections.map((s) => [(s._id as ObjectId).toString(), s]));

    const classIds = [...new Set(sections.map((s) => (s.classId as ObjectId).toString()))];
    const classes = await collections.classes
      .find({ _id: { $in: classIds.map((id) => new ObjectId(id)) } })
      .project({ _id: 1, name: 1, displayName: 1 })
      .toArray();
    const classMap = new Map(
      classes.map((c) => [
        (c._id as ObjectId).toString(),
        ((c.displayName as string) || (c.name as string) || '') as string,
      ])
    );

    const studentInfoById = new Map<string, ResolvedStudent>();
    for (const s of students) {
      const enrollment = s.currentEnrollment as
        | { sectionId?: ObjectId; classId?: ObjectId }
        | undefined;
      if (!enrollment?.sectionId || !enrollment.classId) continue;
      const section = sectionMap.get(enrollment.sectionId.toString());
      const studentName =
        (s.displayName as string) ||
        `${(s.firstName as string) ?? ''} ${(s.lastName as string) ?? ''}`.trim();
      studentInfoById.set((s._id as ObjectId).toString(), {
        _id: s._id as ObjectId,
        studentName,
        admissionNumber: (s.admissionNumber as string) || undefined,
        rollNumber: (s.rollNumber as string) || undefined,
        sectionId: enrollment.sectionId,
        sectionName: (section?.name as string) || '',
        classId: enrollment.classId,
        className: classMap.get(enrollment.classId.toString()) || '',
      });
    }

    // Settings for grading scale + report-card options + co-scholastic.
    const settings = await examSettingsService.getSettings(tenantId, branchId);
    const scale = await examSettingsService.getGradingScale(tenantId, branchId);

    // Credit weights for SGPA. Subjects without credits (typical for schools)
    // simply drop out of the weighted average rather than counting as zero.
    const examSubjectIds = exam.papers.map((p) => p.subjectId);
    const creditDocs = examSubjectIds.length
      ? await collections.subjects
          .find({ _id: { $in: examSubjectIds } })
          .project({ _id: 1, credits: 1 })
          .toArray()
      : [];
    const creditsBySubject = new Map<string, number>();
    for (const s of creditDocs) {
      if (typeof s.credits === 'number' && s.credits > 0) {
        creditsBySubject.set((s._id as ObjectId).toString(), s.credits);
      }
    }

    // The semester this exam belongs to — denormalized onto each card so the
    // academic summary can group by semester without re-reading the batch.
    // Per class, because the number follows each class's program year plan
    // (an annual Year 1 shifts every later semester's number).
    let examSemesterNumber: number | undefined;
    let termNumberByClass = new Map<string, number>();
    if (exam.termId) {
      const batch = await collections.academicBatches.findOne(
        { _id: exam.academicBatchId },
        { projection: { terms: 1 } }
      );
      const term = (
        (batch?.terms ?? []) as Array<{
          _id: ObjectId;
          half?: 'odd' | 'even';
          part?: number;
          semesterNumber?: number;
        }>
      ).find((t) => t._id.toString() === exam.termId!.toString());
      examSemesterNumber = term?.semesterNumber;
      if (term) {
        termNumberByClass = await termNumbersForClasses(
          classIds.map((id) => new ObjectId(id)),
          term
        );
      }
    }

    // Pull co-scholastic results for the exam (if enabled).
    const coScholasticByStudent = new Map<string, CoScholasticRow[]>();
    if (settings.coScholasticEnabled) {
      const rows = await collections.coScholasticResults
        .find({ tenantId: tenantObjId, examId: examObjId })
        .toArray();
      for (const r of rows) {
        const sid = (r.studentId as ObjectId).toString();
        if (!coScholasticByStudent.has(sid)) coScholasticByStudent.set(sid, []);
        coScholasticByStudent.get(sid)!.push({
          areaName: r.areaName as string,
          grade: r.grade as string,
          remarks: (r.remarks as string) || undefined,
        });
      }
    }

    // Attendance — if the report card wants it, look up per student for the term window.
    const attendanceMap = new Map<string, AttendanceSummary>();
    if (settings.reportCard.showAttendance && exam.startDate && exam.endDate) {
      const attendanceRows = await collections.studentAttendance
        .aggregate([
          {
            $match: {
              tenantId: tenantObjId,
              studentId: { $in: studentObjIds },
              date: { $gte: exam.startDate, $lte: exam.endDate },
            },
          },
          {
            $group: {
              _id: '$studentId',
              total: { $sum: 1 },
              present: {
                $sum: { $cond: [{ $in: ['$status', ['present', 'late']] }, 1, 0] },
              },
            },
          },
        ])
        .toArray();
      for (const row of attendanceRows) {
        const sid = (row._id as ObjectId).toString();
        const total = row.total as number;
        const present = row.present as number;
        attendanceMap.set(sid, {
          present,
          total,
          percent: total > 0 ? Math.round((present / total) * 10000) / 100 : 0,
        });
      }
    }

    // Compute rank per section: students within the same section ordered by overall percentage.
    const studentsBySection = new Map<string, string[]>();
    for (const [studentId, info] of studentInfoById.entries()) {
      const sid = info.sectionId.toString();
      if (!studentsBySection.has(sid)) studentsBySection.set(sid, []);
      studentsBySection.get(sid)!.push(studentId);
    }

    const overallByStudent = new Map<string, OverallSummary>();
    for (const [studentId, rows] of byStudent.entries()) {
      const info = studentInfoById.get(studentId);
      if (!info) continue;
      let obtained = 0;
      let total = 0;
      let allPassed = true;
      for (const r of rows) {
        const m = r.marksObtained as number;
        const t = r.totalMarks as number;
        obtained += m;
        total += t;
        if (!(r.passed as boolean) || (r.absent as boolean)) allPassed = false;
      }
      const percentage = total > 0 ? Math.round((obtained / total) * 10000) / 100 : 0;
      const band = gradeForPercent(percentage, scale);
      overallByStudent.set(studentId, {
        totalMarksObtained: obtained,
        totalMarks: total,
        percentage,
        grade: band?.grade,
        passed: allPassed,
      });
    }

    // Compute ranks per section.
    const rankByStudent = new Map<string, number>();
    if (settings.reportCard.showRank) {
      for (const [, sectionStudentIds] of studentsBySection.entries()) {
        const ranked = sectionStudentIds
          .map((sid) => ({
            sid,
            pct: overallByStudent.get(sid)?.percentage ?? 0,
            passed: overallByStudent.get(sid)?.passed ?? false,
          }))
          .filter((x) => x.passed)
          .sort((a, b) => b.pct - a.pct);
        let lastPct = -1;
        let lastRank = 0;
        ranked.forEach((row, idx) => {
          if (row.pct !== lastPct) {
            lastRank = idx + 1;
            lastPct = row.pct;
          }
          rankByStudent.set(row.sid, lastRank);
        });
      }
    }

    // Build and persist each report card row.
    const now = new Date();
    const generatedByObjId = new ObjectId(generatedBy);
    const created: WithId<ReportCardDocument>[] = [];
    const skipped: Array<{ studentId: string; reason: string }> = [];

    for (const [studentId, rows] of byStudent.entries()) {
      const info = studentInfoById.get(studentId);
      if (!info) {
        skipped.push({ studentId, reason: 'Student not found or not enrolled' });
        continue;
      }

      // Refuse to overwrite a published card.
      const existing = (await collections.reportCards.findOne({
        tenantId: tenantObjId,
        examId: examObjId,
        studentId: info._id,
      })) as WithId<ReportCardDocument> | null;
      if (existing?.status === 'published') {
        skipped.push({ studentId, reason: 'Already published; unpublish to regenerate' });
        continue;
      }

      const overall = overallByStudent.get(studentId)!;
      if (settings.reportCard.showRank) {
        overall.rank = rankByStudent.get(studentId);
      }

      const scholastic: ReportCardSubjectRow[] = rows.map((r) => {
        const sid = (r.subjectId as ObjectId).toString();
        const credits = creditsBySubject.get(sid);
        const band = gradeForPercent(r.percentage as number, scale);
        return {
          paperId: r.paperId as ObjectId,
          subjectId: r.subjectId as ObjectId,
          subjectName: r.subjectName as string,
          marksObtained: r.marksObtained as number,
          totalMarks: r.totalMarks as number,
          percentage: r.percentage as number,
          grade: (r.grade as string) || undefined,
          ...(credits !== undefined && { credits }),
          // Absentees earn no grade points regardless of the band lookup.
          ...(band?.points !== undefined && !(r.absent as boolean) && { gradePoints: band.points }),
          passed: r.passed as boolean,
          absent: r.absent as boolean,
          remarks: (r.remarks as string) || undefined,
        };
      });

      // Credit-weighted SGPA for this exam's subjects. Left undefined when no
      // subject carries credits (schools) rather than reported as 0.
      let sgpaWeighted = 0;
      let sgpaCredits = 0;
      let sgpaEarned = 0;
      for (const row of scholastic) {
        if (!row.credits) continue;
        sgpaCredits += row.credits;
        if (row.gradePoints !== undefined) sgpaWeighted += row.credits * row.gradePoints;
        if (row.passed && !row.absent) sgpaEarned += row.credits;
      }
      if (sgpaCredits > 0) {
        overall.sgpa = Math.round((sgpaWeighted / sgpaCredits) * 100) / 100;
        overall.totalCredits = sgpaCredits;
        overall.earnedCredits = sgpaEarned;
      }

      const doc: ReportCardDocument = {
        _id: existing?._id || new ObjectId(),
        tenantId: tenantObjId,
        branchId: branchObjId,
        examId: examObjId,
        studentId: info._id,
        admissionNumber: info.admissionNumber,
        studentName: info.studentName,
        rollNumber: info.rollNumber,
        sectionId: info.sectionId,
        sectionName: info.sectionName,
        classId: info.classId,
        className: info.className,
        academicBatchId: exam.academicBatchId,
        ...(exam.termId && { termId: exam.termId }),
        termName: exam.termName,
        ...((termNumberByClass.get(info.classId.toString()) ?? examSemesterNumber) !==
          undefined && {
          semesterNumber: termNumberByClass.get(info.classId.toString()) ?? examSemesterNumber,
        }),
        examName: exam.name,
        scholastic,
        coScholastic: settings.coScholasticEnabled
          ? coScholasticByStudent.get(studentId) || []
          : undefined,
        overall,
        attendance: attendanceMap.get(studentId),
        pdfKey: existing?.pdfKey,
        pdfUrl: existing?.pdfUrl,
        status: 'draft',
        generatedBy: generatedByObjId,
        generatedAt: now,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };

      // Render PDF and stash on S3. If S3 isn't configured this throws inside
      // uploadReportCardPdf — let it bubble; we'd rather fail loud than save
      // a card without a PDF.
      try {
        const tenant = await collections.tenants.findOne({ _id: tenantObjId });
        const pdfBuffer = await renderReportCardPdf({
          schoolName: (tenant?.name as string) || 'School',
          schoolLogoUrl: (tenant?.logoUrl as string) || undefined,
          principalName: settings.reportCard.principalName,
          schoolMotto: settings.reportCard.schoolMotto,
          showAttendance: settings.reportCard.showAttendance,
          showRank: settings.reportCard.showRank,
          showRemarks: settings.reportCard.showRemarks,
          coScholasticEnabled: settings.coScholasticEnabled,
          report: doc,
        });
        const uploaded = await uploadReportCardPdf({
          tenantId,
          branchId,
          examId: input.examId,
          studentId,
          buffer: pdfBuffer,
        });
        doc.pdfKey = uploaded.key;
        doc.pdfUrl = uploaded.url;
      } catch (err) {
        logger.error(
          { err, studentId, examId: input.examId },
          'Failed to render/upload report card PDF — record saved without PDF'
        );
        // Continue saving without pdf so caller can re-run after fixing S3.
      }

      await collections.reportCards.updateOne({ _id: doc._id }, { $set: doc }, { upsert: true });
      created.push(doc as WithId<ReportCardDocument>);
    }

    logger.info(
      { examId: input.examId, generated: created.length, skipped: skipped.length },
      'Report cards generated'
    );

    return {
      generated: created.length,
      skipped: skipped.length,
      skippedDetails: skipped,
      reportCards: created.map(formatReportCard),
    };
  }

  async list(
    tenantId: string,
    branchId: string,
    query: { examId?: string; sectionId?: string; studentId?: string; status?: string }
  ) {
    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };
    if (query.examId) filter.examId = new ObjectId(query.examId);
    if (query.sectionId) filter.sectionId = new ObjectId(query.sectionId);
    if (query.studentId) filter.studentId = new ObjectId(query.studentId);
    if (query.status) filter.status = query.status;

    const docs = (await collections.reportCards
      .find(filter)
      .sort({ sectionName: 1, rollNumber: 1, studentName: 1 })
      .toArray()) as WithId<ReportCardDocument>[];

    return docs.map(formatReportCard);
  }

  async getById(tenantId: string, branchId: string, id: string) {
    const doc = (await collections.reportCards.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    })) as WithId<ReportCardDocument> | null;
    if (!doc) throw new ApiError('NOT_FOUND', 'Report card not found', 404);
    return formatReportCard(doc);
  }

  /**
   * Student-facing: lookup own published report cards (admins should use list()).
   */
  async listForStudent(tenantId: string, studentId: string) {
    const docs = (await collections.reportCards
      .find({
        tenantId: new ObjectId(tenantId),
        studentId: new ObjectId(studentId),
        status: 'published',
      })
      .sort({ publishedAt: -1, generatedAt: -1 })
      .toArray()) as WithId<ReportCardDocument>[];
    return docs.map(formatReportCard);
  }

  async publish(tenantId: string, branchId: string, id: string, publishedBy: string) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);
    const rcId = new ObjectId(id);

    const result = await collections.reportCards.findOneAndUpdate(
      { _id: rcId, tenantId: tenantObjId, branchId: branchObjId },
      {
        $set: {
          status: 'published',
          publishedAt: new Date(),
          publishedBy: new ObjectId(publishedBy),
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );
    if (!result) throw new ApiError('NOT_FOUND', 'Report card not found', 404);
    logger.info({ reportCardId: id, publishedBy }, 'Report card published');

    // Fire-and-forget parent notifications. Failures are logged but don't
    // affect the publish status.
    dispatchResultPublishedNotifications(
      tenantId,
      branchId,
      [result as WithId<ReportCardDocument>],
      publishedBy
    ).catch((err) => logger.warn({ err }, 'Result-published notifications failed'));

    // Refresh SGPA/CGPA/backlogs from the now-published cards.
    await recomputeAcademicSummaries(tenantId, [(result as WithId<ReportCardDocument>).studentId]);

    return formatReportCard(result as WithId<ReportCardDocument>);
  }

  async bulkPublish(
    tenantId: string,
    branchId: string,
    examId: string,
    publishedBy: string,
    sectionId?: string
  ) {
    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      examId: new ObjectId(examId),
      status: 'draft',
    };
    if (sectionId) filter.sectionId = new ObjectId(sectionId);

    const now = new Date();
    const result = await collections.reportCards.updateMany(filter, {
      $set: {
        status: 'published',
        publishedAt: now,
        publishedBy: new ObjectId(publishedBy),
        updatedAt: now,
      },
    });

    logger.info(
      { examId, sectionId, published: result.modifiedCount },
      'Report cards bulk-published'
    );

    // Pull freshly-published rows and fan out notifications. Filtering by
    // `publishedAt: now` is safe because we just set every modified row to
    // exactly this timestamp.
    if (result.modifiedCount > 0) {
      const published = (await collections.reportCards
        .find({
          tenantId: new ObjectId(tenantId),
          branchId: new ObjectId(branchId),
          examId: new ObjectId(examId),
          status: 'published',
          publishedAt: now,
        })
        .toArray()) as WithId<ReportCardDocument>[];
      dispatchResultPublishedNotifications(tenantId, branchId, published, publishedBy).catch(
        (err) => logger.warn({ err }, 'Bulk result-published notifications failed')
      );
      await recomputeAcademicSummaries(
        tenantId,
        published.map((p) => p.studentId)
      );
    }

    return { published: result.modifiedCount };
  }

  async unpublish(tenantId: string, branchId: string, id: string) {
    const result = await collections.reportCards.findOneAndUpdate(
      {
        _id: new ObjectId(id),
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
      },
      {
        $set: { status: 'draft', updatedAt: new Date() },
        $unset: { publishedAt: '', publishedBy: '' },
      },
      { returnDocument: 'after' }
    );
    if (!result) throw new ApiError('NOT_FOUND', 'Report card not found', 404);

    // Unpublishing withdraws the result — recompute so SGPA/CGPA/backlogs
    // stop counting it.
    await recomputeAcademicSummaries(tenantId, [(result as WithId<ReportCardDocument>).studentId]);

    return formatReportCard(result as WithId<ReportCardDocument>);
  }
}

export const reportCardService = new ReportCardService();
export type { ReportCardSubjectRow, CoScholasticRow, OverallSummary, AttendanceSummary };

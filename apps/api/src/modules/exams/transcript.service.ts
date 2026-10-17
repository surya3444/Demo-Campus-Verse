import { ObjectId, WithId, Document } from 'mongodb';
import { collections } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler';
import { recomputeAcademicSummary, type AcademicSummary } from './academicSummary.service';

/**
 * Consolidated academic transcript — every published semester with its
 * subjects, credits, grades and SGPA, plus cumulative CGPA and open backlogs.
 *
 * Reads the cached `academicSummary` on the student (kept fresh on publish),
 * and recomputes on the fly if it's missing so a transcript is never blank
 * just because results were published before the cache existed.
 */

export interface TranscriptSubject {
  subjectId: string;
  subjectName: string;
  credits?: number;
  marksObtained: number;
  totalMarks: number;
  percentage: number;
  grade?: string;
  gradePoints?: number;
  passed: boolean;
  absent: boolean;
  examName: string;
}

export interface TranscriptSemester {
  termId?: string;
  termName: string;
  semesterNumber?: number;
  sgpa: number | null;
  totalCredits: number;
  earnedCredits: number;
  subjects: TranscriptSubject[];
}

export interface Transcript {
  student: {
    _id: string;
    displayName: string;
    admissionNumber?: string;
    rollNumber?: string;
    abcId?: string;
    className?: string;
    departmentName?: string;
  };
  cgpa: number | null;
  totalCredits: number;
  earnedCredits: number;
  semesters: TranscriptSemester[];
  backlogs: AcademicSummary['backlogs'];
  generatedAt: Date;
}

class TranscriptService {
  async getForStudent(tenantId: string, studentId: string): Promise<Transcript> {
    const studentOid = new ObjectId(studentId);
    const student = await collections.students.findOne(
      { _id: studentOid, tenantId: new ObjectId(tenantId) },
      {
        projection: {
          displayName: 1,
          firstName: 1,
          lastName: 1,
          admissionNumber: 1,
          rollNumber: 1,
          abcId: 1,
          academicSummary: 1,
          currentEnrollment: 1,
        },
      }
    );
    if (!student) {
      throw new ApiError('STUDENT_NOT_FOUND', 'Student not found', 404);
    }

    // Fall back to a live recompute when the cache hasn't been built yet.
    const summary =
      (student.academicSummary as AcademicSummary | undefined) ??
      (await recomputeAcademicSummary(tenantId, studentOid)) ??
      null;

    const cards = (await collections.reportCards
      .find({ tenantId: new ObjectId(tenantId), studentId: studentOid, status: 'published' })
      .sort({ createdAt: 1 })
      .toArray()) as Array<WithId<Document>>;

    // Group the subject rows by term, mirroring how the summary aggregates.
    const subjectsByTerm = new Map<string, TranscriptSubject[]>();
    for (const card of cards) {
      const key = card.termId ? String(card.termId) : ((card.termName as string) ?? 'Term');
      const list = subjectsByTerm.get(key) ?? [];
      for (const row of (card.scholastic ?? []) as Array<Record<string, unknown>>) {
        list.push({
          subjectId: String(row.subjectId),
          subjectName: (row.subjectName as string) ?? 'Subject',
          credits: row.credits as number | undefined,
          marksObtained: (row.marksObtained as number) ?? 0,
          totalMarks: (row.totalMarks as number) ?? 0,
          percentage: (row.percentage as number) ?? 0,
          grade: row.grade as string | undefined,
          gradePoints: row.gradePoints as number | undefined,
          passed: !!row.passed,
          absent: !!row.absent,
          examName: (card.examName as string) ?? '',
        });
      }
      subjectsByTerm.set(key, list);
    }

    const semesters: TranscriptSemester[] = (summary?.semesters ?? []).map((s) => ({
      termId: s.termId,
      termName: s.termName,
      semesterNumber: s.semesterNumber,
      sgpa: s.sgpa,
      totalCredits: s.totalCredits,
      earnedCredits: s.earnedCredits,
      subjects: subjectsByTerm.get(s.termId ?? s.termName) ?? [],
    }));

    const enrollment = student.currentEnrollment as { className?: string } | undefined;

    return {
      student: {
        _id: studentId,
        displayName:
          (student.displayName as string) ||
          `${student.firstName ?? ''} ${student.lastName ?? ''}`.trim(),
        admissionNumber: student.admissionNumber as string | undefined,
        rollNumber: student.rollNumber as string | undefined,
        abcId: student.abcId as string | undefined,
        className: enrollment?.className,
      },
      cgpa: summary?.cgpa ?? null,
      totalCredits: summary?.totalCredits ?? 0,
      earnedCredits: summary?.earnedCredits ?? 0,
      semesters,
      backlogs: summary?.backlogs ?? [],
      generatedAt: new Date(),
    };
  }
}

export const transcriptService = new TranscriptService();

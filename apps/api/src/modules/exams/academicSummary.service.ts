import { ObjectId, WithId, Document } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';

/**
 * Credit-weighted academic standing — SGPA per semester, cumulative CGPA, and
 * open backlogs — recomputed from a student's PUBLISHED report cards.
 *
 * Recomputing (rather than incrementally patching) keeps the summary correct
 * after re-publishes, mark corrections, unpublishes and supplementary exams:
 * the report cards are the source of truth, this is a derived cache stored on
 * the student so placements/transcripts can read it in one hit.
 *
 * SGPA = Σ(credits × gradePoints) ÷ Σ(credits), over the subjects of a term.
 * CGPA = the same across every completed term.
 *
 * Subjects without credits contribute nothing to the weighted average — a
 * school (no credits configured anywhere) simply ends up with no SGPA/CGPA,
 * which is the correct outcome rather than a fake 0.
 */

export interface SemesterSummary {
  termId?: string;
  termName: string;
  semesterNumber?: number;
  sgpa: number | null;
  totalCredits: number;
  earnedCredits: number;
  subjectCount: number;
}

export interface BacklogEntry {
  subjectId: string;
  subjectName: string;
  termName: string;
  termId?: string;
  examId: string;
  attempts: number;
}

export interface AcademicSummary {
  cgpa: number | null;
  totalCredits: number;
  earnedCredits: number;
  semesters: SemesterSummary[];
  backlogs: BacklogEntry[];
  updatedAt: Date;
}

interface ReportCardRow {
  subjectId?: ObjectId;
  subjectName?: string;
  credits?: number;
  gradePoints?: number;
  passed?: boolean;
  absent?: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Recompute one student's summary from their published report cards.
 * Returns the summary that was persisted, or null when the student has no
 * published results yet (the field is then cleared).
 */
export async function recomputeAcademicSummary(
  tenantId: string,
  studentId: ObjectId
): Promise<AcademicSummary | null> {
  const cards = (await collections.reportCards
    .find({
      tenantId: new ObjectId(tenantId),
      studentId,
      status: 'published',
    })
    .sort({ createdAt: 1 })
    .toArray()) as Array<WithId<Document>>;

  if (cards.length === 0) {
    await collections.students.updateOne(
      { _id: studentId },
      { $unset: { academicSummary: '' }, $set: { updatedAt: new Date() } }
    );
    return null;
  }

  // Group by term. Several exams (mid-term, end-term) can land in the same
  // semester — a subject appearing twice takes its BEST attempt, which is also
  // how a supplementary clears a backlog.
  interface TermBucket {
    termId?: string;
    termName: string;
    semesterNumber?: number;
    bySubject: Map<
      string,
      {
        subjectName: string;
        credits: number;
        gradePoints: number | null;
        passed: boolean;
        examId: string;
        attempts: number;
      }
    >;
  }
  const terms = new Map<string, TermBucket>();

  for (const card of cards) {
    const termName = (card.termName as string) ?? 'Term';
    const termId = card.termId ? String(card.termId) : undefined;
    const key = termId ?? termName;
    if (!terms.has(key)) {
      terms.set(key, {
        termId,
        termName,
        semesterNumber: card.semesterNumber as number | undefined,
        bySubject: new Map(),
      });
    }
    const bucket = terms.get(key)!;

    for (const row of (card.scholastic ?? []) as ReportCardRow[]) {
      if (!row.subjectId) continue;
      const sid = row.subjectId.toString();
      const credits = typeof row.credits === 'number' ? row.credits : 0;
      const points = typeof row.gradePoints === 'number' ? row.gradePoints : null;
      const passed = !!row.passed && !row.absent;
      const prev = bucket.bySubject.get(sid);
      if (!prev) {
        bucket.bySubject.set(sid, {
          subjectName: row.subjectName ?? 'Subject',
          credits,
          gradePoints: points,
          passed,
          examId: String(card.examId),
          attempts: 1,
        });
        continue;
      }
      // Keep the better attempt; count attempts for backlog reporting.
      const better =
        (passed && !prev.passed) ||
        (passed === prev.passed && (points ?? -1) > (prev.gradePoints ?? -1));
      bucket.bySubject.set(sid, {
        subjectName: prev.subjectName,
        credits: credits || prev.credits,
        gradePoints: better ? points : prev.gradePoints,
        passed: prev.passed || passed,
        examId: better ? String(card.examId) : prev.examId,
        attempts: prev.attempts + 1,
      });
    }
  }

  const semesters: SemesterSummary[] = [];
  const backlogs: BacklogEntry[] = [];
  let cumWeighted = 0;
  let cumCredits = 0;
  let cumEarned = 0;

  for (const bucket of terms.values()) {
    let weighted = 0;
    let credits = 0;
    let earned = 0;

    for (const [subjectId, s] of bucket.bySubject) {
      if (s.credits > 0) {
        credits += s.credits;
        if (s.gradePoints !== null) weighted += s.credits * s.gradePoints;
        if (s.passed) earned += s.credits;
      }
      if (!s.passed) {
        backlogs.push({
          subjectId,
          subjectName: s.subjectName,
          termName: bucket.termName,
          termId: bucket.termId,
          examId: s.examId,
          attempts: s.attempts,
        });
      }
    }

    semesters.push({
      termId: bucket.termId,
      termName: bucket.termName,
      semesterNumber: bucket.semesterNumber,
      sgpa: credits > 0 ? round2(weighted / credits) : null,
      totalCredits: credits,
      earnedCredits: earned,
      subjectCount: bucket.bySubject.size,
    });

    cumWeighted += weighted;
    cumCredits += credits;
    cumEarned += earned;
  }

  semesters.sort((a, b) => (a.semesterNumber ?? 0) - (b.semesterNumber ?? 0));

  const summary: AcademicSummary = {
    cgpa: cumCredits > 0 ? round2(cumWeighted / cumCredits) : null,
    totalCredits: cumCredits,
    earnedCredits: cumEarned,
    semesters,
    backlogs,
    updatedAt: new Date(),
  };

  await collections.students.updateOne(
    { _id: studentId },
    { $set: { academicSummary: summary, updatedAt: new Date() } }
  );

  return summary;
}

/** Recompute for many students; failures are logged, never thrown. */
export async function recomputeAcademicSummaries(
  tenantId: string,
  studentIds: ObjectId[]
): Promise<void> {
  const unique = [...new Map(studentIds.map((id) => [id.toString(), id])).values()];
  for (const id of unique) {
    try {
      await recomputeAcademicSummary(tenantId, id);
    } catch (err) {
      logger.warn({ tenantId, studentId: id.toString(), err }, 'Academic summary recompute failed');
    }
  }
  logger.info({ tenantId, count: unique.length }, 'Academic summaries recomputed');
}

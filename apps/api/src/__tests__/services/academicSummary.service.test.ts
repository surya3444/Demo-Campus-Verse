import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
import { createMockCollection } from '../helpers/setup';

const TENANT_ID = new ObjectId().toString();
const STUDENT_OID = new ObjectId();
const SUB_A = new ObjectId();
const SUB_B = new ObjectId();
const SUB_C = new ObjectId();
const TERM1 = new ObjectId();
const TERM2 = new ObjectId();

const mockReportCards = createMockCollection();
const mockStudents = createMockCollection();

vi.mock('@/config/database', () => ({
  collections: {
    get reportCards() {
      return mockReportCards;
    },
    get students() {
      return mockStudents;
    },
  },
  getDb: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { recomputeAcademicSummary } from '@/modules/exams/academicSummary.service';

/** find() chain used by the service. */
function chain(docs: unknown[]) {
  return {
    project: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    toArray: vi.fn().mockResolvedValue(docs),
  };
}

function card(overrides: Record<string, unknown>) {
  return {
    _id: new ObjectId(),
    examId: new ObjectId(),
    termName: 'Odd Semester 2026',
    termId: TERM1,
    semesterNumber: 3,
    createdAt: new Date(),
    scholastic: [],
    ...overrides,
  };
}

/** 4-credit subject scoring 9 points, etc. */
function row(
  subjectId: ObjectId,
  credits: number | undefined,
  gradePoints: number | undefined,
  passed = true,
  absent = false
) {
  return {
    subjectId,
    subjectName: `Subject ${subjectId.toString().slice(-2)}`,
    credits,
    gradePoints,
    passed,
    absent,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockStudents.updateOne.mockResolvedValue({ modifiedCount: 1 });
});

describe('recomputeAcademicSummary', () => {
  it('computes credit-weighted SGPA and CGPA', async () => {
    mockReportCards.find.mockReturnValue(
      chain([
        card({
          scholastic: [row(SUB_A, 4, 10), row(SUB_B, 2, 7)],
        }),
      ])
    );

    const summary = await recomputeAcademicSummary(TENANT_ID, STUDENT_OID);

    // (4×10 + 2×7) / 6 = 54/6 = 9
    expect(summary!.semesters[0].sgpa).toBe(9);
    expect(summary!.semesters[0].totalCredits).toBe(6);
    expect(summary!.cgpa).toBe(9);
    expect(mockStudents.updateOne).toHaveBeenCalledTimes(1);
  });

  it('weights CGPA across semesters by credits, not by semester count', async () => {
    mockReportCards.find.mockReturnValue(
      chain([
        card({ termId: TERM1, semesterNumber: 1, scholastic: [row(SUB_A, 10, 6)] }),
        card({
          termId: TERM2,
          termName: 'Even Semester 2027',
          semesterNumber: 2,
          scholastic: [row(SUB_B, 2, 10)],
        }),
      ])
    );

    const summary = await recomputeAcademicSummary(TENANT_ID, STUDENT_OID);

    // Naive average of SGPAs would be 8; credit-weighted is (60+20)/12 = 6.67
    expect(summary!.semesters.map((s) => s.sgpa)).toEqual([6, 10]);
    expect(summary!.cgpa).toBe(6.67);
    expect(summary!.totalCredits).toBe(12);
  });

  it('records failures as backlogs and excludes them from earned credits', async () => {
    mockReportCards.find.mockReturnValue(
      chain([
        card({
          scholastic: [row(SUB_A, 4, 10, true), row(SUB_B, 3, 0, false)],
        }),
      ])
    );

    const summary = await recomputeAcademicSummary(TENANT_ID, STUDENT_OID);

    expect(summary!.backlogs).toHaveLength(1);
    expect(summary!.backlogs[0].subjectId).toBe(SUB_B.toString());
    // Failed subject still counts toward attempted credits, not earned ones.
    expect(summary!.totalCredits).toBe(7);
    expect(summary!.earnedCredits).toBe(4);
  });

  it('clears a backlog when a supplementary attempt passes the same subject', async () => {
    mockReportCards.find.mockReturnValue(
      chain([
        card({ scholastic: [row(SUB_B, 3, 0, false)] }),
        // Supplementary exam in the same term, now passed.
        card({ examName: 'Supplementary', scholastic: [row(SUB_B, 3, 6, true)] }),
      ])
    );

    const summary = await recomputeAcademicSummary(TENANT_ID, STUDENT_OID);

    expect(summary!.backlogs).toHaveLength(0);
    expect(summary!.earnedCredits).toBe(3);
    // Best attempt's points are used.
    expect(summary!.semesters[0].sgpa).toBe(6);
  });

  it('ignores subjects with no credits (schools) instead of scoring them 0', async () => {
    mockReportCards.find.mockReturnValue(
      chain([
        card({ scholastic: [row(SUB_A, undefined, undefined), row(SUB_C, undefined, undefined)] }),
      ])
    );

    const summary = await recomputeAcademicSummary(TENANT_ID, STUDENT_OID);

    expect(summary!.cgpa).toBeNull();
    expect(summary!.semesters[0].sgpa).toBeNull();
    expect(summary!.totalCredits).toBe(0);
  });

  it('absentees contribute credits but no grade points', async () => {
    mockReportCards.find.mockReturnValue(
      chain([card({ scholastic: [row(SUB_A, 4, 8, true), row(SUB_B, 4, undefined, false, true)] })])
    );

    const summary = await recomputeAcademicSummary(TENANT_ID, STUDENT_OID);

    // (4×8 + 4×0) / 8 = 4
    expect(summary!.semesters[0].sgpa).toBe(4);
    expect(summary!.earnedCredits).toBe(4);
    expect(summary!.backlogs).toHaveLength(1);
  });

  it('clears the cached summary when no published cards remain', async () => {
    mockReportCards.find.mockReturnValue(chain([]));

    const summary = await recomputeAcademicSummary(TENANT_ID, STUDENT_OID);

    expect(summary).toBeNull();
    const update = mockStudents.updateOne.mock.calls[0][1] as { $unset?: Record<string, string> };
    expect(update.$unset).toHaveProperty('academicSummary');
  });

  it('orders semesters by semester number', async () => {
    mockReportCards.find.mockReturnValue(
      chain([
        card({ termId: TERM2, semesterNumber: 4, scholastic: [row(SUB_B, 4, 8)] }),
        card({ termId: TERM1, semesterNumber: 3, scholastic: [row(SUB_A, 4, 9)] }),
      ])
    );

    const summary = await recomputeAcademicSummary(TENANT_ID, STUDENT_OID);

    expect(summary!.semesters.map((s) => s.semesterNumber)).toEqual([3, 4]);
  });
});

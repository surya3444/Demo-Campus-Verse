import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
import { createMockCollection } from '../helpers/setup';

/**
 * Accreditation document builders. The rules that matter to an assessor:
 * the program articulation matrix must average only *mapped* CO strengths,
 * PO aggregates must average only the courses that map the outcome, gaps must
 * list what was actually missed, and a missing source must be reported as
 * missing rather than as a zero.
 */

const TENANT_ID = new ObjectId().toString();
const BRANCH_ID = new ObjectId().toString();
const PROGRAM_ID = new ObjectId();
const BRANCH_OID = new ObjectId(BRANCH_ID);

const PO1 = new ObjectId();
const PO2 = new ObjectId();
const PSO1 = new ObjectId();
const CO1 = new ObjectId();
const CO2 = new ObjectId();
const SUBJECT_ID = new ObjectId();
const OFFERING_ID = new ObjectId();

const mockObeAttainments = createMockCollection();
const mockObeCourseOutcomes = createMockCollection();
const mockObeOfferings = createMockCollection();
const mockObePrograms = createMockCollection();
const mockObeSettings = createMockCollection();
const mockBranches = createMockCollection();
const mockInstitutions = createMockCollection();
const mockAcademicBatches = createMockCollection();
const mockStudents = createMockCollection();
const mockStaff = createMockCollection();
const mockPrograms = createMockCollection();

vi.mock('@/config/database', () => ({
  collections: {
    get obeAttainments() {
      return mockObeAttainments;
    },
    get obeCourseOutcomes() {
      return mockObeCourseOutcomes;
    },
    get obeOfferings() {
      return mockObeOfferings;
    },
    get obePrograms() {
      return mockObePrograms;
    },
    get obeSettings() {
      return mockObeSettings;
    },
    get branches() {
      return mockBranches;
    },
    get institutions() {
      return mockInstitutions;
    },
    get academicBatches() {
      return mockAcademicBatches;
    },
    get students() {
      return mockStudents;
    },
    get staff() {
      return mockStaff;
    },
    get programs() {
      return mockPrograms;
    },
  },
  getDb: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { accreditationService } from '@/modules/obe/accreditation.service';

function findChain(docs: unknown[]) {
  return {
    project: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    toArray: vi.fn().mockResolvedValue(docs),
  };
}

const PROGRAM_DOC = {
  _id: PROGRAM_ID,
  tenantId: new ObjectId(TENANT_ID),
  branchId: BRANCH_OID,
  departmentCode: 'CSE',
  name: 'B.Tech CSE',
  curriculumProgramName: 'B.Tech CSE (AI & ML)',
  preset: 'nba_ug_engineering',
  pos: [
    { _id: PO1, code: 'PO1', title: 'Engineering knowledge', statement: '...', isCustom: false },
    { _id: PO2, code: 'PO2', title: 'Problem analysis', statement: '...', isCustom: false },
  ],
  psos: [{ _id: PSO1, code: 'PSO1', statement: 'Apply AI techniques' }],
  poCorrectiveActions: [],
};

/** CO1 maps PO1(3) and PO2(2); CO2 maps PO1(1) only — PO2 has one mapped CO. */
const OUTCOME_DOC = {
  _id: new ObjectId(),
  tenantId: new ObjectId(TENANT_ID),
  branchId: BRANCH_OID,
  subjectId: SUBJECT_ID,
  programId: PROGRAM_ID,
  cos: [
    { _id: CO1, code: 'CO1', statement: 'Explain OS concepts', bloomLevel: 2, order: 0 },
    { _id: CO2, code: 'CO2', statement: 'Analyse scheduling', bloomLevel: 4, order: 1 },
  ],
  poMapping: [
    { coId: CO1, poId: PO1, strength: 3 },
    { coId: CO1, poId: PO2, strength: 2 },
    { coId: CO2, poId: PO1, strength: 1 },
  ],
  psoMapping: [{ coId: CO1, psoId: PSO1, strength: 3 }],
};

const ATTAINMENT_DOC = {
  _id: new ObjectId(),
  tenantId: new ObjectId(TENANT_ID),
  branchId: BRANCH_OID,
  programId: PROGRAM_ID,
  offeringId: OFFERING_ID,
  subjectId: SUBJECT_ID,
  subjectCode: 'CS404',
  subjectName: 'Operating Systems',
  academicBatchId: new ObjectId(),
  termId: new ObjectId(),
  semesterNumber: 4,
  computedAt: new Date('2026-06-01'),
  cohortSize: 60,
  surveyRespondents: 41,
  isFinal: true,
  perInstrument: [
    { kind: 'external', external: { present: 58, passed: 52, percentPassed: 89.66 } },
  ],
  perCo: [
    {
      coId: CO1.toString(),
      code: 'CO1',
      internalAttainment: 2.5,
      externalAttainment: 3,
      directAttainment: 2.9,
      indirectAttainment: 2.7,
      overallAttainment: 2.88,
      targetMet: true,
    },
    {
      coId: CO2.toString(),
      code: 'CO2',
      internalAttainment: 1.2,
      externalAttainment: 3,
      directAttainment: 1.5,
      indirectAttainment: 2.1,
      overallAttainment: 1.56,
      targetMet: false,
    },
  ],
  courseAverageCoAttainment: 2.22,
  poAttainment: [
    { outcomeId: PO1.toString(), code: 'PO1', weightedAverage: 2, attainment: 1.48 },
    { outcomeId: PO2.toString(), code: 'PO2', weightedAverage: 2, attainment: 1.48 },
  ],
  psoAttainment: [
    { outcomeId: PSO1.toString(), code: 'PSO1', weightedAverage: 3, attainment: 2.22 },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockObePrograms.findOne.mockResolvedValue(PROGRAM_DOC);
  mockObeSettings.findOne.mockResolvedValue({
    _id: new ObjectId(),
    tenantId: new ObjectId(TENANT_ID),
    branchId: BRANCH_OID,
    internalThresholdPercent: 60,
    internalLevelBands: [
      { level: 1, minPercent: 60 },
      { level: 2, minPercent: 80 },
      { level: 3, minPercent: 90 },
    ],
    externalLevelBands: [
      { level: 1, minPercent: 50 },
      { level: 2, minPercent: 60 },
      { level: 3, minPercent: 70 },
    ],
    directWeights: { internal: 0.2, external: 0.8 },
    overallWeights: { direct: 0.9, indirect: 0.1 },
    targetAttainmentLevel: 2,
    maxAttainmentLevel: 3,
  });
  mockObeAttainments.find.mockReturnValue(findChain([ATTAINMENT_DOC]));
  mockObeCourseOutcomes.find.mockReturnValue(findChain([OUTCOME_DOC]));
  mockObeOfferings.find.mockReturnValue(
    findChain([{ _id: OFFERING_ID, termName: 'Even 2025-26', coCorrectiveActions: [] }])
  );
  mockBranches.findOne.mockResolvedValue({ _id: BRANCH_OID, name: 'Main campus' });
  mockAcademicBatches.findOne.mockResolvedValue({ name: '2023-27' });
  mockObeAttainments.countDocuments.mockResolvedValue(1);
});

describe('NBA Criterion 3', () => {
  it('averages only mapped CO strengths in the program articulation matrix', async () => {
    const report = await accreditationService.nbaCriterion3(
      TENANT_ID,
      BRANCH_ID,
      PROGRAM_ID.toString()
    );
    const course = report.section3_1_3.courses[0];

    // PO1: CO1=3, CO2=1 → 2.00.  PO2: only CO1=2 → 2.00 (not 1.00, which is
    // what treating the unmapped cell as a zero would give).
    expect(course.cells).toEqual([2, 2]);
    expect(course.psoCells).toEqual([3]);
  });

  it('carries CO statements and Bloom levels into section 3.1.1', async () => {
    const report = await accreditationService.nbaCriterion3(
      TENANT_ID,
      BRANCH_ID,
      PROGRAM_ID.toString()
    );
    expect(report.section3_1_1[0].cos).toEqual([
      { code: 'CO1', statement: 'Explain OS concepts', bloomLevel: 2 },
      { code: 'CO2', statement: 'Analyse scheduling', bloomLevel: 4 },
    ]);
  });

  it('flags outcomes below target as gaps with the shortfall', async () => {
    const report = await accreditationService.nbaCriterion3(
      TENANT_ID,
      BRANCH_ID,
      PROGRAM_ID.toString()
    );

    const po1Gap = report.section3_4.outcomeGaps.find((g) => g.code === 'PO1');
    expect(po1Gap).toMatchObject({ kind: 'PO', attainment: 1.48, target: 2, gap: 0.52 });

    // CO2 missed its target, CO1 met it.
    expect(report.section3_4.courseGaps.map((g) => g.coCode)).toEqual(['CO2']);
  });

  it('marks PSO1 as met and reports its contributing course count', async () => {
    const report = await accreditationService.nbaCriterion3(
      TENANT_ID,
      BRANCH_ID,
      PROGRAM_ID.toString()
    );
    expect(report.section3_3_2.psoAggregate[0]).toMatchObject({
      code: 'PSO1',
      attainment: 2.22,
      contributingCourses: 1,
      targetMet: true,
    });
  });

  it('names provisional courses instead of passing them off as final', async () => {
    mockObeAttainments.find.mockReturnValue(findChain([{ ...ATTAINMENT_DOC, isFinal: false }]));

    const report = await accreditationService.nbaCriterion3(
      TENANT_ID,
      BRANCH_ID,
      PROGRAM_ID.toString()
    );
    expect(report.meta.provisionalCourses).toEqual(['CS404']);
  });

  it('refuses to build a report with no computed attainment', async () => {
    mockObeAttainments.countDocuments.mockResolvedValue(0);

    await expect(
      accreditationService.assertHasComputedData(TENANT_ID, BRANCH_ID, PROGRAM_ID.toString())
    ).rejects.toMatchObject({ code: 'NO_ATTAINMENT_DATA' });
  });
});

describe('NAAC Key Indicator 2.6', () => {
  beforeEach(() => {
    mockObeAttainments.find.mockImplementation(() => findChain([ATTAINMENT_DOC]));
  });

  it('counts attained COs and derives the pass percentage from the external exam', async () => {
    const report = await accreditationService.naacKeyIndicator26(
      TENANT_ID,
      BRANCH_ID,
      PROGRAM_ID.toString()
    );

    expect(report.metric2_6_1).toMatchObject({ posDefined: 2, psosDefined: 1, cosDefined: 2 });
    expect(report.metric2_6_2).toMatchObject({
      cosEvaluated: 2,
      cosAttained: 1,
      attainmentRate: 50,
    });
    expect(report.metric2_6_3.passPercentage).toBeCloseTo(89.66, 1);
  });

  it('says so when no external results exist, rather than reporting 0%', async () => {
    mockObeAttainments.find.mockImplementation(() =>
      findChain([{ ...ATTAINMENT_DOC, perInstrument: [{ kind: 'internal' }] }])
    );

    const report = await accreditationService.naacKeyIndicator26(
      TENANT_ID,
      BRANCH_ID,
      PROGRAM_ID.toString()
    );

    expect(report.metric2_6_3.passPercentage).toBeNull();
    expect(report.metric2_6_3.note).toMatch(/cannot be derived/i);
  });
});

describe('NIRF data points', () => {
  it('emits only sourced figures and names what it cannot evidence', async () => {
    mockStudents.aggregate.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([
        { _id: 'male', count: 600 },
        { _id: 'female', count: 400 },
      ]),
    });
    mockStaff.aggregate.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([{ _id: null, total: 80, teaching: 50, permanent: 45 }]),
    });
    mockPrograms.countDocuments.mockResolvedValue(4);
    mockObeAttainments.aggregate.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([{ _id: null, meanPo: 1.876, n: 12 }]),
    });

    const report = await accreditationService.nirfDataPoints(TENANT_ID, BRANCH_ID);

    expect(report.sourced).toMatchObject({
      totalStudents: 1000,
      femaleShare: 40,
      facultyStudentRatio: '1:20',
      programsOffered: 4,
      meanPoAttainment: 1.88,
    });
    // Research, placement and perception data have no source here — the report
    // must say that rather than emit zeros an assessor would read as real.
    expect(report.notTracked.length).toBeGreaterThan(0);
  });
});

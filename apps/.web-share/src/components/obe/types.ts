/**
 * Response shapes for the OBE offering workspace. The API returns plain JSON
 * (ObjectIds already stringified), so these mirror the service formatters
 * rather than reusing the Mongo-facing types from the shared package.
 */

export type ObeOfferingStatus = 'draft' | 'data_entry' | 'computed' | 'finalized';
export type ObeSurveyStatus = 'not_started' | 'open' | 'closed';

export interface OfferingSummary {
  _id: string;
  programId: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  academicBatchId: string;
  termId: string;
  termName: string;
  semesterNumber?: number;
  sectionIds: string[];
  coordinatorStaffId?: string;
  coordinatorName?: string;
  status: ObeOfferingStatus;
  targetLevel?: number;
  survey: { status: ObeSurveyStatus; openedAt?: string; closedAt?: string };
  coCorrectiveActions: Array<{ coId: string; text: string }>;
  studentCount?: number;
  computedAt?: string;
  finalizedAt?: string;
}

export interface InstrumentItem {
  _id: string;
  label: string;
  coIds: string[];
  maxMarks: number;
}

export interface InstrumentSet {
  _id: string;
  label: string;
  items: InstrumentItem[];
}

export interface Instrument {
  _id: string;
  name: string;
  kind: 'internal' | 'external';
  order: number;
  sets?: InstrumentSet[];
  bestOfCount?: number | null;
  thresholdPercentOverride?: number;
  examId?: string;
  paperId?: string;
  examName?: string;
  totalMarks?: number;
  passMarks?: number;
}

/** GET /offerings/:id */
export interface OfferingDetail extends OfferingSummary {
  instruments: Instrument[];
  cohortSize: number;
}

export interface ExamLinkCandidate {
  examId: string;
  examName: string;
  examType: string;
  examStatus: string;
  termName: string;
  paperId: string;
  totalMarks: number;
  passMarks: number;
}

/** GET /offerings/:id/instruments/:instrumentId/marks */
export interface MarksGridRow {
  studentId: string;
  name: string;
  admissionNumber?: string;
  rollNumber?: string;
  setId: string | null;
  absent: boolean;
  /** itemId → marks. A missing key means the item was not attempted. */
  marks: Record<string, number>;
  total?: number;
}

export interface MarksGrid {
  instrument: Instrument;
  rows: MarksGridRow[];
}

export interface MarksImportReport {
  totalDataRows: number;
  valid: number;
  errors: Array<{ line: number; message: string }>;
  preview: Array<Record<string, unknown>>;
}

/** GET /offerings/:id/attainment */
export interface AttainmentPerInstrumentItem {
  setLabel: string;
  label: string;
  coIds: string[];
  maxMarks: number;
  attempted: number;
  cleared: number;
  percentCleared: number;
  level: number;
}

export interface AttainmentPerInstrument {
  instrumentId: string;
  name: string;
  kind: 'internal' | 'external';
  items?: AttainmentPerInstrumentItem[];
  external?: {
    present: number;
    passed: number;
    percentPassed: number;
    level: number;
  };
}

export interface AttainmentPerCo {
  coId: string;
  code: string;
  internalLevels: number[];
  internalAttainment: number | null;
  externalAttainment: number | null;
  directAttainment: number | null;
  indirectAttainment: number | null;
  overallAttainment: number | null;
  targetMet: boolean;
}

export interface OutcomeAttainment {
  outcomeId: string;
  code: string;
  weightedAverage: number | null;
  attainment: number | null;
}

export interface AttainmentReport {
  computedAt: string;
  cohortSize: number;
  surveyRespondents: number;
  settingsUsed: {
    internalThresholdPercent: number;
    directWeights: { internal: number; external: number };
    overallWeights: { direct: number; indirect: number };
    targetAttainmentLevel: number;
    maxAttainmentLevel: number;
  };
  perInstrument: AttainmentPerInstrument[];
  perCo: AttainmentPerCo[];
  courseAverageCoAttainment: number | null;
  poAttainment: OutcomeAttainment[];
  psoAttainment: OutcomeAttainment[];
  isFinal: boolean;
  coCorrectiveActions: Array<{ coId: string; text: string }>;
  offeringStatus: ObeOfferingStatus;
}

/** GET /offerings/:id/survey/results */
export interface SurveyResults {
  survey: { status: ObeSurveyStatus; openedAt?: string; closedAt?: string };
  respondents: number;
  cohortSize: number;
  perCo: Array<{
    coId: string;
    code: string;
    statement: string;
    distribution: [number, number, number, number];
    respondents: number;
    indirectAttainment: number | null;
  }>;
}

/** GET /programs/:id/attainment */
export interface ProgramAttainmentCourse {
  offeringId: string;
  subjectCode: string;
  subjectName?: string;
  semesterNumber?: number;
  isFinal: boolean;
  courseAverageCoAttainment: number | null;
  poAttainment: OutcomeAttainment[];
  psoAttainment: OutcomeAttainment[];
}

export interface ProgramAttainmentAggregate {
  outcomeId: string;
  code: string;
  attainment: number | null;
  contributingCourses: number;
}

export interface ProgramAttainmentReport {
  program: {
    name: string;
    departmentCode: string;
    pos: Array<{ _id: string; code: string; title: string }>;
    psos: Array<{ _id: string; code: string; statement?: string }>;
  };
  courses: ProgramAttainmentCourse[];
  poAggregate: ProgramAttainmentAggregate[];
  psoAggregate: ProgramAttainmentAggregate[];
  poCorrectiveActions: Array<{ poId: string; text: string; academicBatchId?: string }>;
}

/** The CO list an offering's mapping is authored against. */
export interface OutcomeDocCo {
  _id: string;
  code: string;
  statement: string;
  bloomLevel: number;
  order: number;
}

/** Triggers a browser download for a CSV blob returned by the export endpoints. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Attainment figures are nullable everywhere — render gaps as an em-dash. */
export function formatAttainment(value: number | null | undefined, digits = 2) {
  return value == null ? '—' : value.toFixed(digits);
}

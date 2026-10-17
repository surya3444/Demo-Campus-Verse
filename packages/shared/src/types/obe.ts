import { BaseEntity } from './common';
import type {
  BloomLevel,
  MappingStrength,
  ObeInstrumentKind,
  ObeLevelBand,
  ObeOfferingStatus,
  ObeProgramPreset,
  ObeSurveyStatus,
} from '../constants/obe';

// ── Settings ──────────────────────────────────────────────────────────────────

export interface ObeSettings extends BaseEntity {
  branchId: string;
  internalThresholdPercent: number;
  internalLevelBands: ObeLevelBand[];
  externalLevelBands: ObeLevelBand[];
  directWeights: { internal: number; external: number };
  overallWeights: { direct: number; indirect: number };
  targetAttainmentLevel: number;
  maxAttainmentLevel: number;
}

// ── Programs (PO/PSO definitions) ─────────────────────────────────────────────

export interface ObeProgramOutcome {
  _id: string;
  code: string;
  title: string;
  statement: string;
  isCustom: boolean;
  order: number;
}

export interface ObeProgramSpecificOutcome {
  _id: string;
  code: string;
  statement: string;
  order: number;
}

export interface ObePoCorrectiveAction {
  academicBatchId: string;
  poId: string;
  text: string;
  updatedAt: Date;
}

export interface ObeProgram extends BaseEntity {
  branchId: string;
  departmentCode: string;
  /**
   * FK → programs (the curriculum Program). PSOs are *program*-specific, not
   * department-specific: CSE, CSE (AI & ML) and CSE (Data Science) each need
   * their own PO/PSO set and their own attainment rollup. Absent on programs
   * created before this link existed — those stay department-wide, one per
   * department, exactly as they were.
   */
  curriculumProgramId?: string;
  /** Display snapshot of the curriculum program name. */
  curriculumProgramName?: string;
  name: string;
  preset: ObeProgramPreset;
  pos: ObeProgramOutcome[];
  psos: ObeProgramSpecificOutcome[];
  poCorrectiveActions: ObePoCorrectiveAction[];
}

// ── Course outcomes + mapping matrices ────────────────────────────────────────

export interface ObeCourseOutcome {
  _id: string;
  code: string;
  statement: string;
  bloomLevel: BloomLevel;
  order: number;
}

export interface ObeCoPoMappingCell {
  coId: string;
  poId: string;
  strength: MappingStrength;
  justification?: string;
}

export interface ObeCoPsoMappingCell {
  coId: string;
  psoId: string;
  strength: MappingStrength;
  justification?: string;
}

export interface ObeCourseOutcomeDoc extends BaseEntity {
  branchId: string;
  subjectId: string;
  programId: string;
  cos: ObeCourseOutcome[];
  poMapping: ObeCoPoMappingCell[];
  psoMapping: ObeCoPsoMappingCell[];
}

// ── Offerings ─────────────────────────────────────────────────────────────────

export interface ObeCoCorrectiveAction {
  coId: string;
  text: string;
  updatedAt: Date;
}

export interface ObeOffering extends BaseEntity {
  branchId: string;
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
  survey: { status: ObeSurveyStatus; openedAt?: Date; closedAt?: Date };
  coCorrectiveActions: ObeCoCorrectiveAction[];
  studentCount?: number;
  computedAt?: Date;
  finalizedAt?: Date;
  finalizedBy?: string;
}

// ── Instruments ───────────────────────────────────────────────────────────────

export interface ObeInstrumentItem {
  _id: string;
  label: string;
  coIds: string[];
  maxMarks: number;
}

export interface ObeInstrumentSet {
  _id: string;
  label: string;
  items: ObeInstrumentItem[];
}

export interface ObeInstrument extends BaseEntity {
  branchId: string;
  offeringId: string;
  name: string;
  kind: ObeInstrumentKind;
  order: number;
  sets?: ObeInstrumentSet[];
  bestOfCount?: number | null;
  thresholdPercentOverride?: number;
  examId?: string;
  paperId?: string;
  totalMarks?: number;
  passMarks?: number;
}

// ── Marks ─────────────────────────────────────────────────────────────────────

export interface ObeMarkEntry {
  itemId: string;
  marksObtained: number;
}

export interface ObeMark extends BaseEntity {
  branchId: string;
  offeringId: string;
  instrumentId: string;
  studentId: string;
  admissionNumber?: string;
  setId?: string;
  marks: ObeMarkEntry[];
  absent: boolean;
  total?: number;
}

// ── Survey ────────────────────────────────────────────────────────────────────

export interface ObeSurveyResponse {
  _id: string;
  tenantId: string;
  branchId: string;
  offeringId: string;
  studentId: string;
  ratings: { coId: string; rating: number }[];
  submittedAt: Date;
}

// ── Attainment (derived) ──────────────────────────────────────────────────────

export interface ObeItemStat {
  setId: string;
  setLabel: string;
  itemId: string;
  label: string;
  coIds: string[];
  maxMarks: number;
  attempted: number;
  cleared: number;
  percentCleared: number | null;
  level: number | null;
}

export interface ObeInstrumentAttainment {
  instrumentId: string;
  name: string;
  kind: ObeInstrumentKind;
  items?: ObeItemStat[];
  external?: {
    present: number;
    passed: number;
    percentPassed: number | null;
    level: number | null;
  };
}

export interface ObeCoAttainment {
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

export interface ObeOutcomeAttainment {
  /** poId or psoId */
  outcomeId: string;
  code: string;
  weightedAverage: number | null;
  attainment: number | null;
}

export interface ObeAttainment {
  _id: string;
  tenantId: string;
  branchId: string;
  offeringId: string;
  programId: string;
  subjectId: string;
  subjectCode: string;
  academicBatchId: string;
  termId: string;
  semesterNumber?: number;
  computedAt: Date;
  cohortSize: number;
  surveyRespondents: number;
  perInstrument: ObeInstrumentAttainment[];
  perCo: ObeCoAttainment[];
  courseAverageCoAttainment: number | null;
  poAttainment: ObeOutcomeAttainment[];
  psoAttainment: ObeOutcomeAttainment[];
  isFinal: boolean;
}

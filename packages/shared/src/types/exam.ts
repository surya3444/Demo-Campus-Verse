import type { BoardPreset, ExamStatus, ExamType, GradingScaleBand } from '../constants/exam';

/**
 * Per-branch policy: how exams behave, what scale they use, whether
 * co-scholastic assessment is on, default pass marks, notification toggles.
 *
 * Persisted as a singleton document keyed by `{tenantId, branchId}`.
 */
export interface ExamSettings {
  _id?: string;
  tenantId: string;
  branchId: string;

  /** Board preset that seeds defaults — 'custom' means user-defined values. */
  boardPreset: BoardPreset;

  /** Active scholastic grading scale (subject-level percentages). */
  gradingScale: GradingScaleBand[];

  /** Whether the report card includes a co-scholastic table. */
  coScholasticEnabled: boolean;
  /** Names of the co-scholastic areas, displayed in order on the report card. */
  coScholasticAreas: string[];
  /** Allowed letter grades for co-scholastic entries. */
  coScholasticGrades: string[];

  /** Subject is considered passed if percentage is >= this value. */
  passMarkPercent: number;
  /**
   * For overall promotion eligibility — either 'all' (every subject must pass)
   * or an integer minimum count of subjects passed.
   */
  passSubjectsRequired: 'all' | number;

  reportCard: {
    showAttendance: boolean;
    showRank: boolean;
    showRemarks: boolean;
    principalName?: string;
    schoolMotto?: string;
  };

  hallTicket: {
    seatingMode: 'roll_number' | 'manual';
    showQrCode: boolean;
    venueDefault?: string;
  };

  resultNotification: {
    sendSms: boolean;
    sendEmail: boolean;
    smsTemplate?: string;
    emailSubject?: string;
    emailBody?: string;
  };

  promotion: {
    passMarkPercent: number;
    passSubjectsRequired: 'all' | number;
  };

  createdAt?: Date;
  updatedAt?: Date;
}

/** A subject paper within an exam (e.g. "Mathematics paper of Term-1 Mid-term"). */
export interface ExamPaper {
  _id: string;
  subjectId: string;
  subjectName: string;
  totalMarks: number;
  passMarks: number;
  /** Optional weight when an exam aggregates multiple papers per subject. */
  weight?: number;
}

/**
 * A parent exam record — typically a named assessment event covering
 * multiple subjects/papers across one or more classes.
 */
export interface Exam {
  _id: string;
  tenantId: string;
  branchId: string;
  academicBatchId: string;
  /** Term name within the academic batch (e.g. 'Term 1'). */
  termName: string;
  name: string;
  type: ExamType;
  /** Classes this exam applies to. Schedules link papers to specific sections. */
  classIds: string[];
  papers: ExamPaper[];
  status: ExamStatus;
  startDate?: Date;
  endDate?: Date;
  instructions?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/** When a single paper happens for a single section. */
export interface ExamSchedule {
  _id: string;
  tenantId: string;
  branchId: string;
  examId: string;
  paperId: string;
  subjectId: string;
  subjectName: string;
  sectionId: string;
  sectionName: string;
  classId: string;
  className: string;
  date: Date;
  startTime: string; // 'HH:MM' 24h
  endTime: string; // 'HH:MM'
  durationMinutes: number;
  totalMarks: number;
  passMarks: number;
  room?: string;
  invigilatorIds?: string[];
  createdAt: Date;
  updatedAt: Date;
}

/** Individual student's marks on a single paper. */
export interface ExamResult {
  _id: string;
  tenantId: string;
  branchId: string;
  examId: string;
  paperId: string;
  scheduleId?: string;
  studentId: string;
  admissionNumber?: string;
  studentName: string;
  sectionId: string;
  classId: string;
  subjectId: string;
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
  enteredBy: string;
  enteredAt: Date;
  publishedAt?: Date;
  publishedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Co-scholastic grade for one area of one exam. */
export interface CoScholasticResult {
  _id: string;
  tenantId: string;
  branchId: string;
  examId: string;
  studentId: string;
  areaName: string;
  grade: string;
  remarks?: string;
  enteredBy: string;
  enteredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

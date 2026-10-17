import { BaseEntity } from './common';
import { SubjectCategory } from './organization';

/**
 * Course-registration domain (universities/colleges).
 *
 * A ProgramScheme is the published curriculum for one department × semester:
 * fixed core courses plus elective baskets ("choose 1 of N", each option with
 * a seat cap). A CourseRegistration is one student's instantiation of a
 * scheme for a term — cores auto-filled, electives chosen, credits bounded.
 */

// ─── Program Scheme ─────────────────────────────────────────────────────────

/** A fixed course every student in the program takes. */
export interface SchemeCoreSlot {
  kind: 'core';
  /** Stable id within the scheme; registrations reference it. */
  slotId: string;
  category?: SubjectCategory;
  subjectId: string;
  /** Snapshot of the subject's credits at authoring time. */
  credits: number;
}

export interface SchemeBasketOption {
  subjectId: string;
  credits: number;
  /** Maximum students who can take this option. 0/undefined = unlimited. */
  seatCap?: number;
  /** Live counter maintained atomically by the registration service. */
  seatsTaken: number;
}

/** An elective basket: choose `chooseCount` of the options. */
export interface SchemeBasketSlot {
  kind: 'basket';
  slotId: string;
  /** Display label, e.g. "Professional Elective I". */
  label: string;
  category?: SubjectCategory;
  chooseCount: number;
  options: SchemeBasketOption[];
}

export type SchemeSlot = SchemeCoreSlot | SchemeBasketSlot;

export type SchemeStatus = 'draft' | 'published' | 'archived';

export interface ProgramScheme extends BaseEntity {
  branchId: string;
  /** Matches the department class-path code (path[0].code), e.g. "CS". */
  departmentCode: string;
  /**
   * FK → programs (curriculum Program, not the OBE one). When present the
   * scheme belongs to one degree program — "B.Tech CSE (AI & ML) Sem 3" —
   * and matches students by `Class.programId`, which is how a department
   * running several programs keeps their curricula apart. Absent schemes
   * stay department-wide, which is what every pre-existing scheme is.
   */
  programId?: string;
  /** Display snapshot of the program name, for listings. */
  programName?: string;
  /** Display name snapshot, e.g. "Computer Science". */
  departmentName: string;
  /** Absolute semester in the program (1-12); pairs with AcademicTerm.semesterNumber. */
  semesterNumber: number;
  slots: SchemeSlot[];
  minCredits: number;
  maxCredits: number;
  status: SchemeStatus;
  publishedAt?: Date;
}

// ─── Course Registration ────────────────────────────────────────────────────

export interface CourseRegistrationEntry {
  slotId: string;
  kind: 'core' | 'basket';
  category?: SubjectCategory;
  subjectId: string;
  credits: number;
}

export type CourseRegistrationStatus = 'submitted' | 'withdrawn';

export interface CourseRegistration extends BaseEntity {
  branchId: string;
  studentId: string;
  academicBatchId: string;
  /** AcademicTerm._id within the batch. */
  termId: string;
  schemeId: string;
  entries: CourseRegistrationEntry[];
  totalCredits: number;
  status: CourseRegistrationStatus;
  submittedAt: Date;
  /** Set when the registration was last modified during add/drop. */
  modifiedAt?: Date;
  withdrawnAt?: Date;
}

// ─── Registrar overview ─────────────────────────────────────────────────────

export interface SchemeFillStats {
  schemeId: string;
  departmentCode: string;
  departmentName: string;
  semesterNumber: number;
  registeredCount: number;
  baskets: Array<{
    slotId: string;
    label: string;
    options: Array<{
      subjectId: string;
      subjectName?: string;
      seatCap?: number;
      seatsTaken: number;
    }>;
  }>;
}

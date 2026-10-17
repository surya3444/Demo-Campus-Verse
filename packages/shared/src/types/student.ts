import { BaseEntity, Address, Gender, Status } from './common';

export interface Student extends BaseEntity {
  branchId: string;
  admissionNumber: string;
  enrollmentCode: string;
  rollNumber?: string;
  firstName: string;
  lastName: string;
  displayName: string;
  dateOfBirth: Date;
  gender: Gender;
  bloodGroup?: string;
  nationality?: string;
  religion?: string;
  caste?: string;
  category?: 'general' | 'obc' | 'sc' | 'st' | 'ews';
  /**
   * Admission route/quota — distinct from the social-reservation `category`.
   * Seeded values in DEFAULT_ADMISSION_CATEGORIES (management, convener, spot,
   * nri, lateral_entry); tenants may use their own strings. Drives fee
   * structure targeting and scholarship eligibility.
   */
  admissionCategory?: string;
  aadharNumber?: string;
  /** NEP Academic Bank of Credits ID. */
  abcId?: string;
  photo?: string;
  contact?: {
    email?: string;
    phone?: string;
    alternatePhone?: string;
    address?: {
      current?: Address;
      permanent?: Address;
    };
  };
  parents?: {
    father?: ParentInfo;
    mother?: ParentInfo;
    guardian?: GuardianInfo;
  };
  primaryContactType?: 'father' | 'mother' | 'guardian';
  admissionDate: Date;
  admissionType?: 'new' | 'transfer' | 'lateral';
  previousSchool?: {
    name?: string;
    board?: string;
    lastClass?: string;
    percentage?: number;
    tcNumber?: string;
  };
  currentEnrollment?: {
    academicBatchId: string;
    classId: string;
    sectionId: string;
    /** Lab batch within the section (id from Section.batches). */
    labBatchId?: string;
    className: string;
    sectionName: string;
    electiveSubjectIds?: string[];
    electives?: Array<{ subjectId: string; name: string; code: string }>;
  };
  /**
   * Credit-weighted academic standing, derived from published report cards by
   * the exams module. Read-only cache — never edit directly; it is recomputed
   * whenever results are published or unpublished.
   */
  academicSummary?: {
    cgpa: number | null;
    totalCredits: number;
    earnedCredits: number;
    semesters: Array<{
      termId?: string;
      termName: string;
      semesterNumber?: number;
      sgpa: number | null;
      totalCredits: number;
      earnedCredits: number;
      subjectCount: number;
    }>;
    backlogs: Array<{
      subjectId: string;
      subjectName: string;
      termName: string;
      termId?: string;
      examId: string;
      attempts: number;
    }>;
    updatedAt: Date;
  };
  services?: {
    transport?: {
      isAvailing: boolean;
      enrollmentId?: string;
      busId?: string;
      busNumber?: string;
      busName?: string;
      /** @deprecated legacy alias for busId */
      routeId?: string;
      stopId?: string;
      stopName?: string;
      pickupTime?: string;
      dropTime?: string;
    };
    hostel?: {
      isAvailing: boolean;
      hostelId?: string;
      roomId?: string;
      bedNumber?: string;
    };
  };
  medical?: {
    allergies?: string[];
    conditions?: string[];
    medications?: string[];
    emergencyContact?: {
      name: string;
      relation: string;
      phone: string;
    };
  };
  documents?: Array<{
    type: string;
    url: string;
    uploadedAt: Date;
    verified?: boolean;
  }>;
  familyId?: string;
  siblingIds?: string[];
  status: Status | 'alumni' | 'archived' | 'transferred' | 'withdrawn';
  statusHistory?: Array<{
    status: string;
    date: Date;
    reason?: string;
    changedBy: string;
  }>;
  customFields?: Record<string, unknown>;
  tags?: string[];
  notes?: string;
}

export interface ParentInfo {
  name: string;
  occupation?: string;
  qualification?: string;
  phone?: string;
  email?: string;
  annualIncome?: number;
}

export interface GuardianInfo {
  name: string;
  relation?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface StudentEnrollment extends BaseEntity {
  branchId: string;
  studentId: string;
  academicBatchId: string;
  classId: string;
  sectionId: string;
  rollNumber?: string;
  enrollmentDate: Date;
  enrollmentType: 'new' | 'promoted' | 'transferred' | 'lateral';
  previousEnrollmentId?: string;
  status: 'active' | 'completed' | 'withdrawn';
  completedDate?: Date;
  result?: {
    status: 'passed' | 'failed' | 'detained';
    percentage?: number;
    grade?: string;
  };
}

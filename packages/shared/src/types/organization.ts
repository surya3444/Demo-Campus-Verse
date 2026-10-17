import { BaseEntity, Address, Status } from './common';

export type InstitutionType = 'school' | 'college' | 'university';

// Academic Hierarchy Configuration
export interface HierarchyLevel {
  key: string; // Internal identifier (e.g., "grade", "year", "section")
  label: string; // Display name (e.g., "Grade", "Standard", "Class")
  labelPlural: string; // Plural form (e.g., "Grades", "Standards", "Classes")
  isLeaf: boolean; // If true, students are assigned at this level
  order: number; // Position in hierarchy (1, 2, 3...)
}

export interface AcademicHierarchyConfig {
  levels: HierarchyLevel[];
}

// Default hierarchy configurations per institution type
export const DEFAULT_HIERARCHY_CONFIG: Record<InstitutionType, AcademicHierarchyConfig> = {
  school: {
    levels: [
      { key: 'grade', label: 'Grade', labelPlural: 'Grades', isLeaf: false, order: 1 },
      { key: 'section', label: 'Section', labelPlural: 'Sections', isLeaf: true, order: 2 },
    ],
  },
  college: {
    levels: [
      { key: 'stream', label: 'Stream', labelPlural: 'Streams', isLeaf: false, order: 1 },
      { key: 'year', label: 'Year', labelPlural: 'Years', isLeaf: false, order: 2 },
      { key: 'section', label: 'Section', labelPlural: 'Sections', isLeaf: true, order: 3 },
    ],
  },
  university: {
    levels: [
      {
        key: 'department',
        label: 'Department',
        labelPlural: 'Departments',
        isLeaf: false,
        order: 1,
      },
      { key: 'year', label: 'Year', labelPlural: 'Years', isLeaf: false, order: 2 },
      { key: 'section', label: 'Section', labelPlural: 'Sections', isLeaf: true, order: 3 },
    ],
  },
};

export interface Tenant extends BaseEntity {
  name: string;
  code: string;
  institutionTypes: InstitutionType[];
  contact: {
    email: string;
    phone: string;
    website?: string;
    address: Address;
  };
  legalInfo?: {
    entityName?: string;
    gstNumber?: string;
    panNumber?: string;
    registrationNumber?: string;
    board?: string;
  };
  branding?: {
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
  };
  subscription: {
    plan: 'starter' | 'professional' | 'enterprise';
    maxBranches: number;
    maxStudents: number;
    maxStaff: number;
    features: string[];
    validUntil: Date;
  };
  settings: {
    timezone: string;
    dateFormat: string;
    currency: string;
    fiscalYearStart: string;
  };
  academicHierarchy?: AcademicHierarchyConfig;
  onboardingCompleted?: boolean;
  status: Status | 'suspended' | 'trial' | 'pending' | 'pending_payment';
}

/**
 * A constituent institution inside a tenant — e.g. "Anurag Engineering
 * College" under Anurag University. Every CAMPUS has exactly one default
 * institution (hidden in the UI for schools/colleges); a university is a
 * campus running more than one. Institutions carry identity and settings only:
 * data scoping stays tenantId + branchId — an institution reaches its data
 * through its departments (Department.institutionId).
 */
export interface Institution extends BaseEntity {
  /**
   * Campus this institution operates on. A campus hosts one or more
   * constituent institutions (Engineering, Design, Management); documents stay
   * branch-scoped, and institution-level separation resolves through
   * Department.institutionId.
   */
  branchId: string;
  name: string;
  code: string;
  /** Tenant-configurable label: 'engineering' | 'management' | 'design' | ... */
  kind?: string;
  /** The auto-created institution every tenant gets; cannot be archived or deleted. */
  isDefault?: boolean;
  settings?: {
    /** Feeds admission-number prefixes (wired in Phase 3). */
    admissionPrefix?: string;
    logo?: string;
    letterhead?: string;
  };
  status: 'active' | 'archived';
}

export interface Branch extends BaseEntity {
  branchId: string;
  name: string;
  code: string;
  institutionType: InstitutionType;
  location: {
    state: string;
    city: string;
    address: Address;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  contact: {
    email?: string;
    phone?: string;
    alternatePhone?: string;
    website?: string;
  };
  infrastructure?: {
    hasHostel?: boolean;
    hasTransport?: boolean;
    hasCanteen?: boolean;
    hasLibrary?: boolean;
    hasLab?: boolean;
  };
  affiliations?: Array<{
    board: string;
    affiliationNumber: string;
    validUntil?: Date;
  }>;
  settings?: {
    weeklyOff: string[];
    workingHours: { start: string; end: string };
    attendanceTime: { start: string; lateAfter: string; end: string };
  };
  // Per-branch override of the academic hierarchy. When absent, falls back to
  // tenant.academicHierarchy, then to DEFAULT_HIERARCHY_CONFIG[institutionType].
  academicHierarchy?: AcademicHierarchyConfig;
  status: Status;
}

export interface User extends BaseEntity {
  email: string;
  phone?: string;
  profile: {
    firstName: string;
    lastName: string;
    displayName: string;
    avatar?: string;
    gender?: string;
  };
  roleId: string;
  accessScope: {
    type: 'global' | 'institution' | 'branch' | 'department' | 'program';
    /** For type 'institution': allowed branches resolve via branch.institutionId. */
    institutionIds?: string[];
    branchIds: string[];
    departmentIds?: string[];
    /**
     * For type 'program': the degree programs this user may see — a program
     * coordinator over B.Tech CSE (AI & ML) only. Narrower than department
     * scope and, unlike it, enforced unconditionally: the type is new, so no
     * existing user can be silently narrowed by turning it on.
     */
    programIds?: string[];
  };
  staffId?: string;
  /**
   * Guest/temporary access: login is rejected and sessions end after this
   * date. Absent = permanent account. (Precedent: affiliations[].validUntil.)
   */
  validUntil?: Date;
  preferences?: {
    language?: string;
    notifications?: {
      email?: boolean;
      sms?: boolean;
      push?: boolean;
    };
  };
  lastLogin?: Date;
  status: Status | 'locked';
}

export interface Role extends BaseEntity {
  name: string;
  code: string;
  description?: string;
  isSystemRole: boolean;
  level: number;
  permissions: Record<string, string[]>;
}

/**
 * A term/semester within an academic batch. `semesterNumber` is the absolute
 * semester in the program (Sem 1-12) — program schemes key on it, so "CSE
 * Semester 3" means the same thing across batches. Registration windows and
 * the add/drop deadline drive the course-registration workflow.
 */
export interface AcademicTerm {
  _id: string;
  name: string;
  /**
   * Which half of the session this term is. All year-cohorts run
   * concurrently: in an 'odd' term a Year-N student is in semester 2N-1, in
   * an 'even' term semester 2N. Course registration derives each student's
   * semester from this; `semesterNumber` is an explicit override for
   * single-cohort programs.
   */
  half?: 'odd' | 'even';
  /**
   * Position in a trimester calendar (1-3). Two-term calendars use `half`;
   * a third position needs `part: 3`. See sessionTermPosition.
   */
  part?: 1 | 2 | 3;
  semesterNumber?: number;
  startDate: Date;
  endDate: Date;
  registrationWindow?: {
    opensAt: Date;
    closesAt: Date;
  };
  addDropDeadline?: Date;
}

export interface AcademicBatch extends BaseEntity {
  branchId?: string;
  name: string;
  code: string;
  startDate: Date;
  endDate: Date;
  isCurrent: boolean;
  terms?: AcademicTerm[];
  status: 'upcoming' | 'active' | 'completed';
}

// One entry per non-leaf hierarchy level. The leaf level is implicit — it
// becomes the Sections that hang off this Class.
export interface ClassPathEntry {
  levelKey: string; // matches a HierarchyLevel.key from the resolved hierarchy
  name: string; // human-readable display, e.g. "Grade 5", "Computer Science"
  code: string; // stable identifier, e.g. "G5", "CS"
  order?: number; // optional ordering hint within the level
}

export interface Class extends BaseEntity {
  branchId: string;
  academicBatchId: string;
  // Ordered path through the non-leaf levels of the resolved hierarchy.
  // path[i].levelKey === resolvedHierarchy.levels[i].key for each non-leaf level.
  path: ClassPathEntry[];
  displayName: string; // derived from path entries
  /**
   * FK → departments, derived on write by matching path[0] against the
   * department registry (code/name, case-insensitive). The queryable truth
   * for universities; absent for schools and unmatched classes — `path`
   * remains authoritative for display.
   */
  departmentId?: string;
  /** FK → programs; set explicitly, never derived. */
  programId?: string;
  capacity?: number;
  classTeacherId?: string;
  status: Status;
}

/**
 * A degree program offered by a department, e.g. "B.Tech Computer Science
 * (AI & ML)". Each year has its own term pattern (`yearPatterns`, e.g. an
 * annual first year then semesters); terms are numbered across the program
 * (utils/academic.ts → termNumberFor). `termPattern` summarises them:
 * the shared pattern, or 'mixed'.
 */
export interface Program extends BaseEntity {
  branchId: string;
  departmentId: string;
  name: string;
  code: string;
  degreeType: 'ug' | 'pg' | 'diploma' | 'phd' | 'certificate';
  durationYears: number;
  /** Total terms across all years, derived from the year patterns. */
  totalSemesters: number;
  termPattern: 'semester' | 'annual' | 'trimester' | 'mixed';
  /** One pattern per year (index 0 = Year 1). Absent = termPattern for every year. */
  yearPatterns?: Array<'annual' | 'semester' | 'trimester'>;
  specialization?: string;
  status: 'active' | 'archived';
}

export interface Section extends BaseEntity {
  branchId: string;
  classId: string;
  name: string;
  code: string;
  capacity?: number;
  sectionTeacherId?: string;
  roomNumber?: string;
  /**
   * Lab batches — subdivisions of the section for practical scheduling
   * ("Batch 1", "Batch 2"). Membership lives on the student
   * (currentEnrollment.labBatchId), matching the sectionId pattern.
   * Sections without batches behave exactly as before.
   */
  batches?: Array<{ _id: string; name: string }>;
  status: Status;
}

// ============ Infrastructure ============

export type InfraRoomType =
  | 'classroom'
  | 'office'
  | 'lab'
  | 'library'
  | 'auditorium'
  | 'conference_room'
  | 'staff_room'
  | 'store_room'
  | 'other';

export type InfraRoomStatus = 'available' | 'occupied' | 'maintenance' | 'reserved';

export interface BuildingFloor {
  _id: string;
  name: string;
  number: number;
  status: Status;
}

export interface Building extends BaseEntity {
  branchId: string;
  name: string;
  code: string;
  floors: BuildingFloor[];
  totalRooms: number;
  description?: string;
  status: Status;
}

export interface InfraRoom extends BaseEntity {
  branchId: string;
  buildingId: string;
  buildingName?: string;
  floorId: string;
  floorName?: string;
  roomNumber: string;
  name?: string;
  type: InfraRoomType;
  capacity?: number;
  area?: number;
  amenities: string[];
  status: InfraRoomStatus;
}

export interface InfraStats {
  totalBuildings: number;
  totalFloors: number;
  totalRooms: number;
  byType: { type: InfraRoomType; count: number }[];
  byStatus: { status: InfraRoomStatus; count: number }[];
}

/**
 * UGC CBCS / NEP course categories:
 *   DSC  – Discipline Specific Core
 *   DSE  – Discipline Specific Elective
 *   GE   – Generic Elective (offered to other departments)
 *   AECC – Ability Enhancement Compulsory Course
 *   SEC  – Skill Enhancement Course
 *   VAC  – Value Added Course
 */
export const SUBJECT_CATEGORIES = ['DSC', 'DSE', 'GE', 'AECC', 'SEC', 'VAC'] as const;
export type SubjectCategory = (typeof SUBJECT_CATEGORIES)[number];

export interface Subject extends BaseEntity {
  branchId?: string;
  name: string;
  code: string;
  shortName?: string;
  description?: string;
  type: 'theory' | 'practical' | 'both';
  /** CBCS/NEP category — used by program schemes for universities/colleges. */
  category?: SubjectCategory;
  /** Lecture-Tutorial-Practical hours per week (e.g. 3-1-0 = 4 credits). */
  ltp?: {
    lecture: number;
    tutorial: number;
    practical: number;
  };
  applicableTo?: {
    institutionTypes?: InstitutionType[];
    grades?: string[];
    streams?: string[];
    departments?: string[];
  };
  ownerDepartmentId?: string;
  /**
   * Who may consume this subject in a curriculum:
   * - 'global': every department (service subjects — Mathematics, English)
   * - 'core':   the owner department only (Operating Systems → CSE)
   * - 'shared': owner + offeredToDepartmentIds (Basic Electrical Engg:
   *   EEE → Mechanical, Civil, ECE)
   * Absent (legacy) with no owner ⇒ unrestricted; enforcement only applies
   * when the consuming class has a departmentId, so schools are unaffected.
   */
  sharing?: 'global' | 'core' | 'shared';
  /** Consumer departments for sharing === 'shared'; replaces inert applicableTo.departments. */
  offeredToDepartmentIds?: string[];
  credits?: number;
  maxMarks?: number;
  passingMarks?: number;
  status: Status;
}

import { BaseEntity } from './common';

// ============ Enums / Literal Types ============

export type CompanyStatus = 'active' | 'inactive' | 'blacklisted';
export type CompanyPartnershipType = 'regular' | 'premium' | 'exclusive';
export type CompanySize = 'startup' | 'small' | 'medium' | 'large' | 'enterprise';

export type DriveStatus =
  | 'draft'
  | 'registration_open'
  | 'registration_closed'
  | 'in_progress'
  | 'completed'
  | 'cancelled';
export type DriveType = 'on_campus' | 'off_campus' | 'pool_campus';
export type RoundType = 'aptitude' | 'technical' | 'coding' | 'gd' | 'hr' | 'final';
export type RoundStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export type OfferStatus = 'offered' | 'accepted' | 'declined' | 'expired' | 'revoked';

export type JobPostingStatus = 'draft' | 'active' | 'closed' | 'expired';
export type JobType = 'job' | 'internship';
export type WorkMode = 'onsite' | 'remote' | 'hybrid';
export type JobApplicationStatus =
  | 'applied'
  | 'shortlisted'
  | 'interview'
  | 'selected'
  | 'rejected'
  | 'withdrawn';

export type PlacementStatus = 'unplaced' | 'placed' | 'opted_out' | 'higher_studies';

export type CounselingSessionType = 'individual' | 'group' | 'workshop';
export type CounselingAudienceType = 'individual' | 'group' | 'section' | 'class' | 'workshop';
export type CounselingSessionStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show';
export type AssessmentType = 'aptitude' | 'interest' | 'personality' | 'skill';
export type ResourceType = 'article' | 'video' | 'document' | 'link' | 'presentation';
export type ResourceCategory =
  | 'career_exploration'
  | 'skill_development'
  | 'higher_education'
  | 'entrance_exams'
  | 'general';

export type MentorshipProgramType = 'one_on_one' | 'group' | 'project_based';
export type MentorshipStatus = 'requested' | 'active' | 'completed' | 'cancelled';
export type ReferralStatus = 'open' | 'in_progress' | 'closed';
export type StudentReferralStatus = 'referred' | 'interviewing' | 'selected' | 'rejected';
export type AlumniEventType =
  | 'reunion'
  | 'workshop'
  | 'guest_lecture'
  | 'networking'
  | 'career_fair';
export type AlumniEventStatus = 'draft' | 'published' | 'completed' | 'cancelled';

// ============ Sub-entity Interfaces ============

export interface HRContact {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  designation: string;
  isPrimary: boolean;
}

export interface CompanyPartnership {
  type: CompanyPartnershipType;
  startDate?: Date;
  endDate?: Date;
  mou?: string;
}

export interface CompanyVisit {
  _id: string;
  date: Date;
  purpose: string;
  contactPerson: string;
  notes?: string;
  createdBy: string;
}

export interface DriveEligibility {
  minCGPA?: number;
  maxBacklogs?: number;
  allowedDepartments?: string[];
  allowedBatches?: string[];
}

export interface DriveRound {
  _id: string;
  roundNumber: number;
  type: RoundType;
  name?: string;
  date?: Date;
  venue?: string;
  status: RoundStatus;
  qualifiedStudentIds?: string[];
}

export interface DriveRegistration {
  studentId: string;
  studentName?: string;
  registeredAt: Date;
  isEligible: boolean;
  eligibilityRemarks?: string;
}

export interface JobProfile {
  role: string;
  description?: string;
  ctc?: number;
  ctcBreakdown?: CTCBreakdown;
  location?: string;
  jobType?: JobType;
}

export interface CTCBreakdown {
  baseSalary?: number;
  hra?: number;
  specialAllowance?: number;
  bonus?: number;
  other?: number;
}

export interface DriveStats {
  totalRegistered: number;
  totalEligible: number;
  totalPlaced: number;
  highestCTC?: number;
  averageCTC?: number;
}

export interface CareerSkill {
  _id: string;
  name: string;
  category?: string;
  proficiency?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
}

export interface CareerCertification {
  _id: string;
  name: string;
  issuingOrg: string;
  issueDate?: Date;
  expiryDate?: Date;
  credentialUrl?: string;
}

export interface CareerProject {
  _id: string;
  title: string;
  description?: string;
  technologies: string[];
  url?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface CareerExperience {
  _id: string;
  company: string;
  role: string;
  type: 'internship' | 'part_time' | 'full_time' | 'freelance';
  startDate: Date;
  endDate?: Date;
  description?: string;
  isCurrent: boolean;
}

export interface CareerResume {
  _id: string;
  name: string;
  url: string;
  isDefault: boolean;
  uploadedAt: Date;
}

export interface PlacementPreferences {
  isOptedIn: boolean;
  preferredRoles?: string[];
  preferredLocations?: string[];
  expectedCTC?: number;
  willingToRelocate?: boolean;
}

export interface AlumniCareerEntry {
  company: string;
  role: string;
  startDate: Date;
  endDate?: Date;
  isCurrent: boolean;
}

export interface AlumniEducation {
  institution: string;
  degree: string;
  field: string;
  startYear: number;
  endYear?: number;
}

export interface MentorshipSession {
  _id: string;
  date: Date;
  duration?: number;
  notes?: string;
  conductedBy: string;
}

// ============ Main Entities ============

/**
 * PlacementCompany - Company registered for campus placements
 */
export interface PlacementCompany extends BaseEntity {
  name: string;
  industry: string;
  sector: string;
  website?: string;
  size: CompanySize;
  locations: string[];
  description?: string;
  hrContacts: HRContact[];
  partnership: CompanyPartnership;
  visitHistory: CompanyVisit[];
  rating: { average: number; count: number };
  status: CompanyStatus;
  branchId: string;
  notes?: string;
}

/**
 * PlacementDrive - A campus placement drive conducted by a company
 */
export interface PlacementDrive extends BaseEntity {
  driveNumber: string;
  title: string;
  companyId: string;
  companyName?: string;
  type: DriveType;
  academicBatchId?: string;
  eligibility: DriveEligibility;
  registrationDeadline: Date;
  rounds: DriveRound[];
  registrations: DriveRegistration[];
  jobProfile: JobProfile;
  stats: DriveStats;
  status: DriveStatus;
  branchId: string;
  createdBy: string;
}

/**
 * PlacementOffer - Offer extended to a student from a placement drive
 */
export interface PlacementOffer extends BaseEntity {
  driveId: string;
  companyId: string;
  companyName?: string;
  studentId: string;
  studentName?: string;
  role: string;
  ctc: number;
  ctcBreakdown?: CTCBreakdown;
  location?: string;
  offerDate: Date;
  joiningDate?: Date;
  offerLetterUrl?: string;
  status: OfferStatus;
  respondedAt?: Date;
  branchId: string;
}

/**
 * JobPosting - Job or internship listing for students
 */
export interface JobPosting extends BaseEntity {
  postingNumber: string;
  title: string;
  companyId?: string;
  companyName?: string;
  type: JobType;
  description: string;
  requirements?: string[];
  salary?: { min?: number; max?: number };
  stipend?: { amount?: number; duration?: string };
  location?: string;
  workMode?: WorkMode;
  eligibility?: { minCGPA?: number; allowedDepartments?: string[] };
  applicationDeadline: Date;
  maxApplications?: number;
  applicationCount: number;
  status: JobPostingStatus;
  branchId: string;
  createdBy: string;
}

/**
 * JobApplication - Student's application to a job posting
 */
export interface JobApplication extends BaseEntity {
  jobPostingId: string;
  jobTitle?: string;
  studentId: string;
  studentName?: string;
  coverLetter?: string;
  resumeUrl?: string;
  status: JobApplicationStatus;
  statusRemarks?: string;
  appliedAt: Date;
  branchId: string;
}

/**
 * StudentCareerProfile - Student's career portfolio and placement status
 */
export interface StudentCareerProfile extends BaseEntity {
  studentId: string;
  studentName?: string;
  branchId: string;
  skills: CareerSkill[];
  certifications: CareerCertification[];
  projects: CareerProject[];
  experience: CareerExperience[];
  resumes: CareerResume[];
  placementPreferences: PlacementPreferences;
  placementStatus: PlacementStatus;
  completeness: { percentage: number; missingFields: string[] };
}

/**
 * CounselingSession - Career counseling session record
 */
export interface CounselingSession extends BaseEntity {
  sessionNumber: string;
  sessionType: CounselingSessionType;
  audienceType?: CounselingAudienceType;
  scheduledDate: Date;
  endDate?: Date;
  counselorId: string;
  counselorName?: string;
  studentId?: string;
  studentName?: string;
  studentIds?: string[];
  classId?: string;
  className?: string;
  sectionId?: string;
  sectionName?: string;
  topic: string;
  notes?: string;
  actionItems?: string[];
  recommendations?: string[];
  status: CounselingSessionStatus;
  branchId: string;
  createdBy: string;
}

/**
 * CareerAssessment - Career aptitude/interest assessment for a student
 */
export interface CareerAssessment extends BaseEntity {
  studentId: string;
  studentName?: string;
  assessmentType: AssessmentType;
  assessmentDate: Date;
  results: {
    scores: Record<string, number>;
    strengths: string[];
    areasOfImprovement: string[];
  };
  recommendedCareerPaths: {
    field: string;
    matchPercentage: number;
    description?: string;
  }[];
  notes?: string;
  conductedBy: string;
  branchId: string;
}

/**
 * CareerResource - Career guidance material for students
 */
export interface CareerResource extends BaseEntity {
  title: string;
  type: ResourceType;
  category: ResourceCategory;
  description?: string;
  content?: string;
  url?: string;
  fileUrl?: string;
  tags?: string[];
  targetAudience?: string[];
  isPublished: boolean;
  publishedAt?: Date;
  branchId: string;
  createdBy: string;
}

/**
 * AlumniProfile - Alumni record with career history and mentorship info
 */
export interface AlumniProfile extends BaseEntity {
  studentId: string;
  studentName?: string;
  branchId: string;
  graduationYear?: number;
  currentCompany?: string;
  currentRole?: string;
  location?: string;
  linkedInUrl?: string;
  email?: string;
  phone?: string;
  careerHistory: AlumniCareerEntry[];
  higherEducation: AlumniEducation[];
  mentorshipInfo: {
    willingToMentor: boolean;
    expertise: string[];
    maxMentees?: number;
  };
  willingToReferStudents: boolean;
  isVerified: boolean;
  verifiedBy?: string;
  verifiedAt?: Date;
  privacySettings: {
    showEmail: boolean;
    showPhone: boolean;
    showCompany: boolean;
  };
}

/**
 * MentorshipProgram - Alumni-student mentorship pairing
 */
export interface MentorshipProgram extends BaseEntity {
  mentorAlumniId: string;
  mentorName?: string;
  menteeStudentId: string;
  menteeName?: string;
  areaOfGuidance: string;
  programType: MentorshipProgramType;
  status: MentorshipStatus;
  startDate?: Date;
  endDate?: Date;
  sessions: MentorshipSession[];
  goals: string[];
  feedback?: {
    mentorRating?: number;
    menteeRating?: number;
    comments?: string;
  };
  branchId: string;
}

/**
 * AlumniReferral - Job referral from alumni for students
 */
export interface AlumniReferral extends BaseEntity {
  alumniId: string;
  alumniName?: string;
  companyName: string;
  roleTitle: string;
  jobType?: JobType;
  description?: string;
  applicationDeadline?: Date;
  studentsReferred: {
    studentId: string;
    studentName?: string;
    status: StudentReferralStatus;
    referredAt: Date;
  }[];
  status: ReferralStatus;
  branchId: string;
}

/**
 * AlumniEvent - Event organized for or by alumni
 */
export interface AlumniEvent extends BaseEntity {
  eventNumber: string;
  title: string;
  type: AlumniEventType;
  description?: string;
  eventDate: Date;
  endDate?: Date;
  venue?: string;
  isVirtual: boolean;
  virtualLink?: string;
  speakers: {
    name: string;
    designation?: string;
    company?: string;
  }[];
  registrations: {
    userId: string;
    userName?: string;
    registeredAt: Date;
  }[];
  maxCapacity?: number;
  status: AlumniEventStatus;
  branchId: string;
  createdBy: string;
}

/**
 * CareerConnectSettings - Branch-level configuration for Career Connect module
 */
export interface CareerConnectSettings extends BaseEntity {
  branchId: string;
  placementSeason?: { startMonth: number; endMonth: number };
  defaultEligibility?: { minCGPA?: number; maxBacklogs?: number };
  allowStudentSelfRegistration: boolean;
  requireApprovalForJobApplications: boolean;
  alumniAutoVerify: boolean;
  emailNotifications: {
    onDriveRegistration: boolean;
    onOfferReceived: boolean;
    onNewJob: boolean;
  };
}

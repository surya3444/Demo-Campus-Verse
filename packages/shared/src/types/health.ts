import { BaseEntity, Status } from './common';

// ============ Enums / Literal Types ============

export type PersonType = 'student' | 'staff';
export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'unknown';

export type AllergySeverity = 'mild' | 'moderate' | 'severe' | 'life-threatening';
export type AllergyCategory = 'food' | 'medication' | 'environmental' | 'insect' | 'other';

export type ConditionStatus = 'active' | 'managed' | 'resolved';

export type VaccinationStatus = 'scheduled' | 'completed' | 'missed' | 'overdue' | 'exempt';

export type VisitType = 'routine' | 'illness' | 'injury' | 'emergency' | 'follow-up' | 'other';
export type VisitOutcome = 'returned_to_class' | 'sent_home' | 'referred' | 'hospitalized' | 'under_observation';
export type VisitStatus = 'in_progress' | 'completed' | 'follow_up_required';

export type CheckupStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type CampaignStatus = 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export type VisionResult = 'normal' | 'corrected' | 'needs_correction' | 'referred';
export type HearingResult = 'normal' | 'mild_loss' | 'moderate_loss' | 'severe_loss' | 'referred';
export type DentalResult = 'good' | 'needs_attention' | 'urgent_care' | 'referred';
export type GeneralResult = 'normal' | 'abnormal' | 'needs_follow_up' | 'referred';

// ============ Sub-types ============

export interface Allergy {
  name: string;
  category: AllergyCategory;
  severity: AllergySeverity;
  symptoms?: string[];
  treatment?: string;
  diagnosedDate?: Date;
}

export interface MedicalCondition {
  name: string;
  status: ConditionStatus;
  diagnosedDate?: Date;
  medications?: string[];
  notes?: string;
}

export interface CurrentMedication {
  name: string;
  dosage: string;
  frequency: string;
  startDate?: Date;
  endDate?: Date;
  prescribedBy?: string;
  reason?: string;
}

export interface Surgery {
  name: string;
  date?: Date;
  hospital?: string;
  notes?: string;
}

export interface Disability {
  type: string;
  severity?: string;
  description?: string;
  accommodations?: string[];
}

export interface EmergencyContact {
  name: string;
  relation: string;
  phone: string;
  alternatePhone?: string;
  email?: string;
  isPrimary?: boolean;
}

export interface HealthInsurance {
  provider?: string;
  policyNumber?: string;
  groupNumber?: string;
  coverageType?: string;
  validFrom?: Date;
  validTo?: Date;
  holderName?: string;
  holderRelation?: string;
}

export interface Vitals {
  heightCm?: number;
  weightKg?: number;
  bmi?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  pulseRate?: number;
  temperatureCelsius?: number;
  oxygenSaturation?: number;
  respiratoryRate?: number;
}

export interface VisionExam {
  result: VisionResult;
  leftEye?: string;
  rightEye?: string;
  colorBlindness?: boolean;
  notes?: string;
}

export interface HearingExam {
  result: HearingResult;
  leftEar?: string;
  rightEar?: string;
  notes?: string;
}

export interface DentalExam {
  result: DentalResult;
  cavities?: number;
  notes?: string;
}

export interface GeneralExam {
  result: GeneralResult;
  skinCondition?: string;
  posture?: string;
  notes?: string;
}

export interface GrowthPercentile {
  heightPercentile?: number;
  weightPercentile?: number;
  bmiPercentile?: number;
  ageInMonths?: number;
}

export interface HealthAlert {
  type: 'vaccination_due' | 'vaccination_overdue' | 'checkup_due' | 'medication_reminder' | 'follow_up_required' | 'condition_alert';
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  relatedId?: string;
  relatedType?: string;
  dueDate?: Date;
  dismissedAt?: Date;
  dismissedBy?: string;
}

// ============ Main Entities ============

/**
 * Health Record - Main health profile for a student or staff member
 */
export interface HealthRecord extends BaseEntity {
  branchId: string;
  personType: PersonType;
  personId: string;
  personName?: string;
  personCode?: string; // admission number or employee ID

  // Profile
  dateOfBirth?: Date;
  gender?: string;
  bloodGroup?: BloodGroup;

  // Physical measurements (latest)
  heightCm?: number;
  weightKg?: number;
  bmi?: number;

  // Medical history
  allergies: Allergy[];
  conditions: MedicalCondition[];
  currentMedications: CurrentMedication[];
  pastSurgeries: Surgery[];
  disabilities: Disability[];

  // Family medical history
  familyHistory?: string;

  // Emergency contacts
  emergencyContacts: EmergencyContact[];

  // Insurance
  insurance?: HealthInsurance;

  // Health alerts
  alerts: HealthAlert[];

  // Metadata
  lastCheckupDate?: Date;
  nextCheckupDate?: Date;
  lastVaccinationDate?: Date;
  hasOverdueVaccinations?: boolean;

  notes?: string;
  status: Status;
}

/**
 * Health Checkup - Periodic health examination record
 */
export interface HealthCheckup extends BaseEntity {
  branchId: string;
  healthRecordId: string;
  personType: PersonType;
  personId: string;
  personName?: string;

  // Campaign info (if part of a batch checkup)
  campaignId?: string;

  // Checkup details
  checkupDate: Date;
  checkupType: 'routine' | 'annual' | 'sports' | 'pre-admission' | 'follow-up' | 'other';
  status: CheckupStatus;

  // Vitals
  vitals: Vitals;

  // Examinations
  visionExam?: VisionExam;
  hearingExam?: HearingExam;
  dentalExam?: DentalExam;
  generalExam?: GeneralExam;

  // Growth tracking (for students)
  growthPercentile?: GrowthPercentile;

  // Results
  findings?: string[];
  recommendations?: string[];
  referrals?: Array<{
    specialist: string;
    reason: string;
    urgency: 'routine' | 'soon' | 'urgent';
    referredTo?: string;
  }>;

  // Follow-up
  followUpRequired?: boolean;
  followUpDate?: Date;
  followUpNotes?: string;

  // Examiner
  examinedBy?: string;
  examinerName?: string;
  examinerQualification?: string;

  notes?: string;
  completedAt?: Date;
}

/**
 * Health Checkup Campaign - Organize batch checkups
 */
export interface HealthCheckupCampaign extends BaseEntity {
  branchId: string;
  name: string;
  description?: string;

  // Target
  targetType: 'class' | 'section' | 'department' | 'all_students' | 'all_staff' | 'custom';
  targetIds?: string[]; // class IDs, section IDs, or department IDs
  personType: PersonType;

  // Schedule
  scheduledDate: Date;
  scheduledEndDate?: Date;
  venue?: string;

  // Checkup configuration
  checkupType: 'routine' | 'annual' | 'sports' | 'pre-admission' | 'other';
  includeVision?: boolean;
  includeHearing?: boolean;
  includeDental?: boolean;
  includeGrowth?: boolean;

  // Progress
  status: CampaignStatus;
  totalTarget: number;
  completedCount: number;
  pendingCount: number;

  // Staff
  assignedStaff?: string[];
  externalExaminers?: Array<{
    name: string;
    qualification: string;
    specialization?: string;
  }>;

  notes?: string;
  startedAt?: Date;
  completedAt?: Date;
}

/**
 * Vaccination Record
 */
export interface Vaccination extends BaseEntity {
  branchId: string;
  healthRecordId: string;
  personType: PersonType;
  personId: string;
  personName?: string;

  // Vaccine details
  vaccineName: string;
  vaccineCode?: string;
  manufacturer?: string;
  batchNumber?: string;
  doseNumber: number;
  totalDoses?: number;

  // Administration
  scheduledDate?: Date;
  administeredDate?: Date;
  administeredBy?: string;
  administeredAt?: string; // location/facility

  // Status
  status: VaccinationStatus;
  exemptionReason?: string;

  // Side effects
  sideEffects?: string[];
  sideEffectSeverity?: 'none' | 'mild' | 'moderate' | 'severe';

  // Next dose
  nextDoseDate?: Date;

  notes?: string;
  verifiedBy?: string;
  verifiedAt?: Date;
}

/**
 * Medical Visit - Infirmary visit or medical incident
 */
export interface MedicalVisit extends BaseEntity {
  branchId: string;
  healthRecordId: string;
  personType: PersonType;
  personId: string;
  personName?: string;

  // Visit details
  visitType: VisitType;
  visitDate: Date;
  arrivalTime: Date;
  departureTime?: Date;

  // Complaint
  chiefComplaint: string;
  symptoms?: string[];
  symptomOnset?: Date;
  painLevel?: number; // 1-10

  // Vitals at arrival
  vitals?: Vitals;

  // Assessment
  diagnosis?: string;
  icdCode?: string;

  // Treatment
  treatment?: string;
  medicationsGiven?: Array<{
    name: string;
    dosage: string;
    route: 'oral' | 'topical' | 'injection' | 'inhalation' | 'other';
    time: Date;
  }>;
  proceduresPerformed?: string[];

  // Incident details (for injuries)
  isIncident?: boolean;
  incidentLocation?: string;
  incidentDescription?: string;
  incidentWitnesses?: string[];
  incidentReportFiled?: boolean;

  // Outcome
  outcome: VisitOutcome;
  outcomeNotes?: string;

  // Follow-up
  followUpRequired?: boolean;
  followUpDate?: Date;
  followUpInstructions?: string;

  // Notifications
  parentNotified?: boolean;
  parentNotifiedAt?: Date;
  parentNotifiedBy?: string;

  // Staff
  attendedBy: string;
  attendedByName?: string;

  status: VisitStatus;
  notes?: string;
  closedAt?: Date;
  closedBy?: string;
}

/**
 * Health Settings - Branch-level health module configuration
 */
export interface HealthSettings extends BaseEntity {
  branchId: string;

  // General settings
  enableHealthModule: boolean;
  enableStudentHealth: boolean;
  enableStaffHealth: boolean;

  // Infirmary settings
  infirmary: {
    enabled: boolean;
    name?: string;
    location?: string;
    operatingHours?: {
      start: string;
      end: string;
    };
    contactNumber?: string;
    emergencyNumber?: string;
  };

  // Checkup settings
  checkups: {
    enableAnnualCheckups: boolean;
    defaultCheckupMonth?: number; // 1-12
    reminderDaysBefore?: number;
    includeVisionByDefault: boolean;
    includeHearingByDefault: boolean;
    includeDentalByDefault: boolean;
    includeGrowthByDefault: boolean;
  };

  // Vaccination settings
  vaccinations: {
    enableVaccinationTracking: boolean;
    sendReminders: boolean;
    reminderDaysBefore?: number;
    requiredVaccines?: string[];
  };

  // Alert settings
  alerts: {
    enableHealthAlerts: boolean;
    alertOverdueVaccinations: boolean;
    alertOverdueCheckups: boolean;
    alertMedicationReminders: boolean;
  };

  // Privacy settings
  privacy: {
    restrictHealthDataAccess: boolean;
    allowedRoles?: string[];
    requireConsentForDataSharing: boolean;
  };

  // Emergency protocols
  emergencyProtocol?: {
    steps?: string[];
    emergencyContacts?: Array<{
      name: string;
      role: string;
      phone: string;
    }>;
    nearestHospital?: {
      name: string;
      address: string;
      phone: string;
      distance?: string;
    };
  };
}

// ============ API Input/Output Types ============

export interface HealthRecordStats {
  totalRecords: number;
  studentRecords: number;
  staffRecords: number;
  recordsWithAllergies: number;
  recordsWithConditions: number;
  recordsWithInsurance: number;
  alertCounts: {
    vaccinationDue: number;
    vaccinationOverdue: number;
    checkupDue: number;
    highPriority: number;
  };
}

export interface HealthCheckupStats {
  totalCheckups: number;
  completedCheckups: number;
  pendingCheckups: number;
  referralsMade: number;
  averageBmi: number;
  visionIssues: number;
  hearingIssues: number;
  dentalIssues: number;
}

export interface VaccinationStats {
  totalVaccinations: number;
  completedVaccinations: number;
  scheduledVaccinations: number;
  overdueVaccinations: number;
  exemptVaccinations: number;
  complianceRate: number;
  vaccineCoverage: Record<string, { total: number; completed: number }>;
}

export interface MedicalVisitStats {
  totalVisits: number;
  todayVisits: number;
  weekVisits: number;
  monthVisits: number;
  byType: Record<VisitType, number>;
  byOutcome: Record<VisitOutcome, number>;
  averageVisitDuration: number;
  incidentCount: number;
}

export interface HealthDashboard {
  recordStats: HealthRecordStats;
  checkupStats: HealthCheckupStats;
  vaccinationStats: VaccinationStats;
  visitStats: MedicalVisitStats;
  recentAlerts: HealthAlert[];
  todayVisits: MedicalVisit[];
  upcomingCheckups: HealthCheckup[];
  overdueVaccinations: Vaccination[];
}

export interface GrowthChartData {
  personId: string;
  personName: string;
  dateOfBirth?: Date;
  gender?: string;
  measurements: Array<{
    date: Date;
    ageInMonths: number;
    heightCm: number;
    weightKg: number;
    bmi: number;
    heightPercentile?: number;
    weightPercentile?: number;
    bmiPercentile?: number;
  }>;
}

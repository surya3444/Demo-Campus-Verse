import { z } from 'zod';
import { objectIdSchema, paginationSchema } from './common.schema';

// ============ Common Enums ============

export const personTypeSchema = z.enum(['student', 'staff']);
export const bloodGroupSchema = z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown']);
export const allergySeveritySchema = z.enum(['mild', 'moderate', 'severe', 'life-threatening']);
export const allergyCategorySchema = z.enum(['food', 'medication', 'environmental', 'insect', 'other']);
export const conditionStatusSchema = z.enum(['active', 'managed', 'resolved']);
export const vaccinationStatusSchema = z.enum(['scheduled', 'completed', 'missed', 'overdue', 'exempt']);
export const visitTypeSchema = z.enum(['routine', 'illness', 'injury', 'emergency', 'follow-up', 'other']);
export const visitOutcomeSchema = z.enum(['returned_to_class', 'sent_home', 'referred', 'hospitalized', 'under_observation']);
export const visitStatusSchema = z.enum(['in_progress', 'completed', 'follow_up_required']);
export const checkupStatusSchema = z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']);
export const campaignStatusSchema = z.enum(['draft', 'scheduled', 'in_progress', 'completed', 'cancelled']);
export const checkupTypeSchema = z.enum(['routine', 'annual', 'sports', 'pre-admission', 'follow-up', 'other']);
export const visionResultSchema = z.enum(['normal', 'corrected', 'needs_correction', 'referred']);
export const hearingResultSchema = z.enum(['normal', 'mild_loss', 'moderate_loss', 'severe_loss', 'referred']);
export const dentalResultSchema = z.enum(['good', 'needs_attention', 'urgent_care', 'referred']);
export const generalResultSchema = z.enum(['normal', 'abnormal', 'needs_follow_up', 'referred']);

// ============ Sub-schemas ============

export const allergySchema = z.object({
  name: z.string().min(1, 'Allergy name is required'),
  category: allergyCategorySchema,
  severity: allergySeveritySchema,
  symptoms: z.array(z.string()).optional(),
  treatment: z.string().optional(),
  diagnosedDate: z.coerce.date().optional(),
});

export const medicalConditionSchema = z.object({
  name: z.string().min(1, 'Condition name is required'),
  status: conditionStatusSchema,
  diagnosedDate: z.coerce.date().optional(),
  medications: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export const currentMedicationSchema = z.object({
  name: z.string().min(1, 'Medication name is required'),
  dosage: z.string().min(1, 'Dosage is required'),
  frequency: z.string().min(1, 'Frequency is required'),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  prescribedBy: z.string().optional(),
  reason: z.string().optional(),
});

export const surgerySchema = z.object({
  name: z.string().min(1, 'Surgery name is required'),
  date: z.coerce.date().optional(),
  hospital: z.string().optional(),
  notes: z.string().optional(),
});

export const disabilitySchema = z.object({
  type: z.string().min(1, 'Disability type is required'),
  severity: z.string().optional(),
  description: z.string().optional(),
  accommodations: z.array(z.string()).optional(),
});

export const emergencyContactSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  relation: z.string().min(2, 'Relation is required'),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid phone number'),
  alternatePhone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid phone number').optional(),
  email: z.string().email().optional(),
  isPrimary: z.boolean().optional(),
});

export const healthInsuranceSchema = z.object({
  provider: z.string().optional(),
  policyNumber: z.string().optional(),
  groupNumber: z.string().optional(),
  coverageType: z.string().optional(),
  validFrom: z.coerce.date().optional(),
  validTo: z.coerce.date().optional(),
  holderName: z.string().optional(),
  holderRelation: z.string().optional(),
});

export const vitalsSchema = z.object({
  heightCm: z.number().min(30).max(250).optional(),
  weightKg: z.number().min(1).max(300).optional(),
  bmi: z.number().min(5).max(100).optional(),
  bloodPressureSystolic: z.number().min(50).max(250).optional(),
  bloodPressureDiastolic: z.number().min(30).max(150).optional(),
  pulseRate: z.number().min(30).max(220).optional(),
  temperatureCelsius: z.number().min(30).max(45).optional(),
  oxygenSaturation: z.number().min(50).max(100).optional(),
  respiratoryRate: z.number().min(5).max(60).optional(),
});

export const visionExamSchema = z.object({
  result: visionResultSchema,
  leftEye: z.string().optional(),
  rightEye: z.string().optional(),
  colorBlindness: z.boolean().optional(),
  notes: z.string().optional(),
});

export const hearingExamSchema = z.object({
  result: hearingResultSchema,
  leftEar: z.string().optional(),
  rightEar: z.string().optional(),
  notes: z.string().optional(),
});

export const dentalExamSchema = z.object({
  result: dentalResultSchema,
  cavities: z.number().int().min(0).optional(),
  notes: z.string().optional(),
});

export const generalExamSchema = z.object({
  result: generalResultSchema,
  skinCondition: z.string().optional(),
  posture: z.string().optional(),
  notes: z.string().optional(),
});

export const growthPercentileSchema = z.object({
  heightPercentile: z.number().min(0).max(100).optional(),
  weightPercentile: z.number().min(0).max(100).optional(),
  bmiPercentile: z.number().min(0).max(100).optional(),
  ageInMonths: z.number().int().min(0).optional(),
});

export const referralSchema = z.object({
  specialist: z.string().min(1),
  reason: z.string().min(1),
  urgency: z.enum(['routine', 'soon', 'urgent']),
  referredTo: z.string().optional(),
});

export const medicationGivenSchema = z.object({
  name: z.string().min(1),
  dosage: z.string().min(1),
  route: z.enum(['oral', 'topical', 'injection', 'inhalation', 'other']),
  time: z.coerce.date(),
});

// ============ Health Record Schemas ============

export const createHealthRecordSchema = z.object({
  personType: personTypeSchema,
  personId: objectIdSchema,
  bloodGroup: bloodGroupSchema.optional(),
  heightCm: z.number().min(30).max(250).optional(),
  weightKg: z.number().min(1).max(300).optional(),
  allergies: z.array(allergySchema).default([]),
  conditions: z.array(medicalConditionSchema).default([]),
  currentMedications: z.array(currentMedicationSchema).default([]),
  pastSurgeries: z.array(surgerySchema).default([]),
  disabilities: z.array(disabilitySchema).default([]),
  familyHistory: z.string().optional(),
  emergencyContacts: z.array(emergencyContactSchema).default([]),
  insurance: healthInsuranceSchema.optional(),
  notes: z.string().optional(),
});

export const updateHealthRecordSchema = createHealthRecordSchema.partial().omit({ personType: true, personId: true });

export const healthRecordQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  personType: personTypeSchema.optional(),
  hasAllergies: z.coerce.boolean().optional(),
  hasConditions: z.coerce.boolean().optional(),
  hasInsurance: z.coerce.boolean().optional(),
  bloodGroup: bloodGroupSchema.optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

// ============ Health Checkup Schemas ============

export const createHealthCheckupSchema = z.object({
  healthRecordId: objectIdSchema,
  personType: personTypeSchema,
  personId: objectIdSchema,
  campaignId: objectIdSchema.optional(),
  checkupDate: z.coerce.date(),
  checkupType: checkupTypeSchema,
  vitals: vitalsSchema.optional(),
  visionExam: visionExamSchema.optional(),
  hearingExam: hearingExamSchema.optional(),
  dentalExam: dentalExamSchema.optional(),
  generalExam: generalExamSchema.optional(),
  growthPercentile: growthPercentileSchema.optional(),
  findings: z.array(z.string()).optional(),
  recommendations: z.array(z.string()).optional(),
  referrals: z.array(referralSchema).optional(),
  followUpRequired: z.boolean().optional(),
  followUpDate: z.coerce.date().optional(),
  followUpNotes: z.string().optional(),
  examinedBy: objectIdSchema.optional(),
  examinerName: z.string().optional(),
  examinerQualification: z.string().optional(),
  notes: z.string().optional(),
});

export const updateHealthCheckupSchema = createHealthCheckupSchema.partial().omit({
  healthRecordId: true,
  personType: true,
  personId: true,
});

export const completeHealthCheckupSchema = z.object({
  vitals: vitalsSchema,
  visionExam: visionExamSchema.optional(),
  hearingExam: hearingExamSchema.optional(),
  dentalExam: dentalExamSchema.optional(),
  generalExam: generalExamSchema.optional(),
  growthPercentile: growthPercentileSchema.optional(),
  findings: z.array(z.string()).optional(),
  recommendations: z.array(z.string()).optional(),
  referrals: z.array(referralSchema).optional(),
  followUpRequired: z.boolean().optional(),
  followUpDate: z.coerce.date().optional(),
  followUpNotes: z.string().optional(),
  notes: z.string().optional(),
});

export const healthCheckupQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  personType: personTypeSchema.optional(),
  personId: objectIdSchema.optional(),
  healthRecordId: objectIdSchema.optional(),
  campaignId: objectIdSchema.optional(),
  checkupType: checkupTypeSchema.optional(),
  status: checkupStatusSchema.optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});

// ============ Health Checkup Campaign Schemas ============

export const createCheckupCampaignSchema = z.object({
  name: z.string().min(2, 'Campaign name is required'),
  description: z.string().optional(),
  targetType: z.enum(['class', 'section', 'department', 'all_students', 'all_staff', 'custom']),
  targetIds: z.array(objectIdSchema).optional(),
  personType: personTypeSchema,
  scheduledDate: z.coerce.date(),
  scheduledEndDate: z.coerce.date().optional(),
  venue: z.string().optional(),
  checkupType: checkupTypeSchema,
  includeVision: z.boolean().default(true),
  includeHearing: z.boolean().default(true),
  includeDental: z.boolean().default(true),
  includeGrowth: z.boolean().default(true),
  assignedStaff: z.array(objectIdSchema).optional(),
  externalExaminers: z.array(z.object({
    name: z.string().min(1),
    qualification: z.string().min(1),
    specialization: z.string().optional(),
  })).optional(),
  notes: z.string().optional(),
});

export const updateCheckupCampaignSchema = createCheckupCampaignSchema.partial();

export const checkupCampaignQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  personType: personTypeSchema.optional(),
  status: campaignStatusSchema.optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});

// ============ Vaccination Schemas ============

export const createVaccinationSchema = z.object({
  healthRecordId: objectIdSchema,
  personType: personTypeSchema,
  personId: objectIdSchema,
  vaccineName: z.string().min(1, 'Vaccine name is required'),
  vaccineCode: z.string().optional(),
  manufacturer: z.string().optional(),
  batchNumber: z.string().optional(),
  doseNumber: z.number().int().min(1),
  totalDoses: z.number().int().min(1).optional(),
  scheduledDate: z.coerce.date().optional(),
  administeredDate: z.coerce.date().optional(),
  administeredBy: z.string().optional(),
  administeredAt: z.string().optional(),
  status: vaccinationStatusSchema.default('scheduled'),
  exemptionReason: z.string().optional(),
  nextDoseDate: z.coerce.date().optional(),
  notes: z.string().optional(),
});

export const updateVaccinationSchema = createVaccinationSchema.partial().omit({
  healthRecordId: true,
  personType: true,
  personId: true,
});

export const administerVaccinationSchema = z.object({
  administeredDate: z.coerce.date(),
  administeredBy: z.string().optional(),
  administeredAt: z.string().optional(),
  batchNumber: z.string().optional(),
  sideEffects: z.array(z.string()).optional(),
  sideEffectSeverity: z.enum(['none', 'mild', 'moderate', 'severe']).optional(),
  nextDoseDate: z.coerce.date().optional(),
  notes: z.string().optional(),
});

export const vaccinationQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  personType: personTypeSchema.optional(),
  personId: objectIdSchema.optional(),
  healthRecordId: objectIdSchema.optional(),
  vaccineName: z.string().optional(),
  status: vaccinationStatusSchema.optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});

// ============ Medical Visit Schemas ============

export const createMedicalVisitSchema = z.object({
  // Optional: the API finds the person's record, or opens one, when absent
  healthRecordId: objectIdSchema.optional(),
  personType: personTypeSchema,
  personId: objectIdSchema,
  visitType: visitTypeSchema,
  visitDate: z.coerce.date().optional(),
  arrivalTime: z.coerce.date().optional(),
  chiefComplaint: z.string().min(1, 'Chief complaint is required'),
  symptoms: z.array(z.string()).optional(),
  symptomOnset: z.coerce.date().optional(),
  painLevel: z.number().int().min(1).max(10).optional(),
  vitals: vitalsSchema.optional(),
  isIncident: z.boolean().optional(),
  incidentLocation: z.string().optional(),
  incidentDescription: z.string().optional(),
  incidentWitnesses: z.array(z.string()).optional(),
  // Defaults to the signed-in staff member
  attendedBy: objectIdSchema.optional(),
  notes: z.string().optional(),
});

export const updateMedicalVisitSchema = z.object({
  diagnosis: z.string().optional(),
  icdCode: z.string().optional(),
  treatment: z.string().optional(),
  medicationsGiven: z.array(medicationGivenSchema).optional(),
  proceduresPerformed: z.array(z.string()).optional(),
  incidentReportFiled: z.boolean().optional(),
  followUpRequired: z.boolean().optional(),
  followUpDate: z.coerce.date().optional(),
  followUpInstructions: z.string().optional(),
  parentNotified: z.boolean().optional(),
  notes: z.string().optional(),
});

export const closeMedicalVisitSchema = z.object({
  outcome: visitOutcomeSchema,
  outcomeNotes: z.string().optional(),
  // Defaults to the moment the visit is closed
  departureTime: z.coerce.date().optional(),
  medicationsGiven: z
    .array(
      z.object({
        name: z.string().min(1),
        dosage: z.string().min(1),
        quantity: z.number().int().min(1).optional(),
        route: z.enum(['oral', 'topical', 'injection', 'inhalation', 'other']).default('oral'),
        time: z.coerce.date().optional(),
      })
    )
    .optional(),
  parentNotified: z.boolean().optional(),
  diagnosis: z.string().optional(),
  treatment: z.string().optional(),
  followUpRequired: z.boolean().optional(),
  followUpDate: z.coerce.date().optional(),
  followUpInstructions: z.string().optional(),
  notes: z.string().optional(),
});

export const medicalVisitQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  personType: personTypeSchema.optional(),
  personId: objectIdSchema.optional(),
  healthRecordId: objectIdSchema.optional(),
  visitType: visitTypeSchema.optional(),
  status: visitStatusSchema.optional(),
  outcome: visitOutcomeSchema.optional(),
  isIncident: z.coerce.boolean().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  today: z.coerce.boolean().optional(),
});

// ============ Health Settings Schemas ============

export const updateHealthSettingsSchema = z.object({
  enableHealthModule: z.boolean().optional(),
  enableStudentHealth: z.boolean().optional(),
  enableStaffHealth: z.boolean().optional(),
  infirmary: z.object({
    enabled: z.boolean().optional(),
    name: z.string().optional(),
    location: z.string().optional(),
    operatingHours: z.object({
      start: z.string().optional(),
      end: z.string().optional(),
    }).optional(),
    contactNumber: z.string().optional(),
    emergencyNumber: z.string().optional(),
  }).optional(),
  checkups: z.object({
    enableAnnualCheckups: z.boolean().optional(),
    defaultCheckupMonth: z.number().int().min(1).max(12).optional(),
    reminderDaysBefore: z.number().int().min(1).max(90).optional(),
    includeVisionByDefault: z.boolean().optional(),
    includeHearingByDefault: z.boolean().optional(),
    includeDentalByDefault: z.boolean().optional(),
    includeGrowthByDefault: z.boolean().optional(),
  }).optional(),
  vaccinations: z.object({
    enableVaccinationTracking: z.boolean().optional(),
    sendReminders: z.boolean().optional(),
    reminderDaysBefore: z.number().int().min(1).max(90).optional(),
    requiredVaccines: z.array(z.string()).optional(),
  }).optional(),
  alerts: z.object({
    enableHealthAlerts: z.boolean().optional(),
    alertOverdueVaccinations: z.boolean().optional(),
    alertOverdueCheckups: z.boolean().optional(),
    alertMedicationReminders: z.boolean().optional(),
  }).optional(),
  privacy: z.object({
    restrictHealthDataAccess: z.boolean().optional(),
    allowedRoles: z.array(z.string()).optional(),
    requireConsentForDataSharing: z.boolean().optional(),
  }).optional(),
  emergencyProtocol: z.object({
    steps: z.array(z.string()).optional(),
    emergencyContacts: z.array(z.object({
      name: z.string(),
      role: z.string(),
      phone: z.string(),
    })).optional(),
    nearestHospital: z.object({
      name: z.string(),
      address: z.string(),
      phone: z.string(),
      distance: z.string().optional(),
    }).optional(),
  }).optional(),
});

// ============ Type Exports ============

export type CreateHealthRecordInput = z.infer<typeof createHealthRecordSchema>;
export type UpdateHealthRecordInput = z.infer<typeof updateHealthRecordSchema>;
export type HealthRecordQueryInput = z.infer<typeof healthRecordQuerySchema>;

export type CreateHealthCheckupInput = z.infer<typeof createHealthCheckupSchema>;
export type UpdateHealthCheckupInput = z.infer<typeof updateHealthCheckupSchema>;
export type CompleteHealthCheckupInput = z.infer<typeof completeHealthCheckupSchema>;
export type HealthCheckupQueryInput = z.infer<typeof healthCheckupQuerySchema>;

export type CreateCheckupCampaignInput = z.infer<typeof createCheckupCampaignSchema>;
export type UpdateCheckupCampaignInput = z.infer<typeof updateCheckupCampaignSchema>;
export type CheckupCampaignQueryInput = z.infer<typeof checkupCampaignQuerySchema>;

export type CreateVaccinationInput = z.infer<typeof createVaccinationSchema>;
export type UpdateVaccinationInput = z.infer<typeof updateVaccinationSchema>;
export type AdministerVaccinationInput = z.infer<typeof administerVaccinationSchema>;
export type VaccinationQueryInput = z.infer<typeof vaccinationQuerySchema>;

export type CreateMedicalVisitInput = z.infer<typeof createMedicalVisitSchema>;
export type UpdateMedicalVisitInput = z.infer<typeof updateMedicalVisitSchema>;
export type CloseMedicalVisitInput = z.infer<typeof closeMedicalVisitSchema>;
export type MedicalVisitQueryInput = z.infer<typeof medicalVisitQuerySchema>;

export type UpdateHealthSettingsInput = z.infer<typeof updateHealthSettingsSchema>;

import { z } from 'zod';
import { addressSchema, objectIdSchema } from './common.schema';

// Indian phone number regex - accepts:
// - 10 digits starting with 6-9 (e.g., 9937574748)
// - With +91 prefix (e.g., +919937574748)
// - With 91 prefix (e.g., 919937574748)
// - With 0 prefix (e.g., 09937574748)
const indianPhoneRegex = /^(?:\+91|91|0)?[6-9]\d{9}$/;

const parentInfoSchema = z.object({
  name: z.string().min(2).max(100),
  occupation: z.string().optional(),
  qualification: z.string().optional(),
  phone: z
    .string()
    .regex(indianPhoneRegex, 'Invalid phone number. Use 10-digit number or with +91 prefix')
    .optional(),
  email: z.string().email().optional(),
  annualIncome: z.number().positive().optional(),
});

export const createStudentSchema = z.object({
  firstName: z
    .string()
    .min(2, 'First name must be at least 2 characters')
    .max(50)
    .regex(/^[a-zA-Z\s]+$/, 'First name can only contain letters'),
  lastName: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-zA-Z\s]+$/),
  // Upper bound is deliberately generous: PG, PhD, executive and continuing-
  // education students are routinely well past 30. The check is a typo guard,
  // not an admissions policy.
  dateOfBirth: z.coerce.date().refine((date) => {
    const age = Math.floor((Date.now() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    return age >= 3 && age <= 100;
  }, 'Student age must be between 3 and 100 years'),
  gender: z.enum(['male', 'female', 'other']),
  bloodGroup: z.string().optional(),
  nationality: z.string().default('Indian'),
  religion: z.string().optional(),
  caste: z.string().optional(),
  category: z.enum(['general', 'obc', 'sc', 'st', 'ews']).optional(),
  /** Admission route/quota (management/convener/…): free string, tenant-extensible. */
  admissionCategory: z.string().max(50).optional(),
  aadharNumber: z
    .string()
    .regex(/^\d{12}$/, 'Aadhar must be 12 digits')
    .optional(),
  /** NEP 2020 Academic Bank of Credits ID — 12 digits, issued per student. */
  abcId: z
    .string()
    .regex(/^\d{12}$/, 'ABC ID must be 12 digits')
    .optional(),
  contact: z.object({
    email: z.string().email('Valid email is required'),
    phone: z
      .string()
      .regex(indianPhoneRegex, 'Invalid phone number. Use 10-digit number or with +91 prefix')
      .optional(),
    address: z
      .object({
        current: addressSchema.optional(),
        permanent: addressSchema.optional(),
      })
      .optional(),
  }),
  parents: z
    .object({
      father: parentInfoSchema.optional(),
      mother: parentInfoSchema.optional(),
      guardian: z
        .object({
          name: z.string(),
          relation: z.string().optional(),
          phone: z
            .string()
            .regex(indianPhoneRegex, 'Invalid phone number. Use 10-digit number or with +91 prefix')
            .optional(),
          email: z.string().email().optional(),
        })
        .optional(),
    })
    .optional(),
  primaryContactType: z.enum(['father', 'mother', 'guardian']).optional(),
  admissionDate: z.coerce.date().default(() => new Date()),
  admissionType: z.enum(['new', 'transfer', 'lateral']).default('new'),
  /** Roll number in the student's section (also used for search and attendance order). */
  rollNumber: z.string().trim().max(40).optional(),
  academicBatchId: objectIdSchema,
  classId: objectIdSchema,
  sectionId: objectIdSchema,
  previousSchool: z
    .object({
      name: z.string().optional(),
      board: z.string().optional(),
      lastClass: z.string().optional(),
      percentage: z.number().min(0).max(100).optional(),
      tcNumber: z.string().optional(),
    })
    .optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

export const updateStudentSchema = createStudentSchema.partial().omit({
  academicBatchId: true,
  classId: true,
  sectionId: true,
});

export const bulkUploadStudentSchema = z.object({
  students: z.array(createStudentSchema),
  academicBatchId: objectIdSchema,
  classId: objectIdSchema,
  sectionId: objectIdSchema,
});

/**
 * A student's place in their journey: studying (active), on leave (inactive),
 * graduated (alumni), left with a transfer certificate (transferred), or
 * dropped out (withdrawn). A reason is always recorded.
 */
export const updateStudentStatusSchema = z.object({
  status: z.enum(['active', 'inactive', 'alumni', 'transferred', 'withdrawn']),
  reason: z.string().trim().min(2, 'Give a reason').max(500),
});

export const promoteStudentSchema = z.object({
  studentIds: z.array(objectIdSchema).min(1),
  fromAcademicBatchId: objectIdSchema,
  toAcademicBatchId: objectIdSchema,
  toClassId: objectIdSchema,
  toSectionId: objectIdSchema.optional(),
  distributeToSections: z.boolean().default(false),
});

export const transferStudentSchema = z.object({
  toBranchId: objectIdSchema,
  toClassId: objectIdSchema,
  toSectionId: objectIdSchema,
  toAcademicBatchId: objectIdSchema,
  transferDate: z.string().optional(),
  reason: z.string().max(500).optional(),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
export type BulkUploadStudentInput = z.infer<typeof bulkUploadStudentSchema>;
export type PromoteStudentInput = z.infer<typeof promoteStudentSchema>;
export type TransferStudentInput = z.infer<typeof transferStudentSchema>;

// ============ ID card designs ============

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour like #0B2A5B');
const imageRef = z.string().max(500000).optional(); // URL or small data: URI

export const ID_CARD_FIELDS = [
  'rollNumber',
  'admissionNumber',
  'program',
  'section',
  'dateOfBirth',
  'bloodGroup',
  'phone',
  'guardianPhone',
  'validTill',
] as const;

export const idCardDesignConfigSchema = z.object({
  template: z.enum(['classic', 'modern', 'minimal', 'campus']),
  orientation: z.enum(['portrait', 'landscape']),
  colors: z.object({ primary: hexColor, accent: hexColor }),
  title: z.string().trim().max(80).optional(),
  subtitle: z.string().trim().max(120).optional(),
  logoUrl: imageRef,
  photoShape: z.enum(['rounded', 'circle']),
  fields: z.array(z.enum(ID_CARD_FIELDS)).max(ID_CARD_FIELDS.length),
  showQr: z.boolean(),
  signatureLabel: z.string().trim().max(40),
  signatureUrl: imageRef,
  validTill: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  back: z.object({
    enabled: z.boolean(),
    instructions: z.string().trim().max(600),
    showAddress: z.boolean(),
    showEmergency: z.boolean(),
  }),
});

export const saveIdCardDesignSchema = z.object({
  name: z.string().trim().min(2).max(60),
  /** null = every campus of the institution. */
  branchId: objectIdSchema.nullable(),
  config: idCardDesignConfigSchema,
});

export type IdCardDesignConfig = z.infer<typeof idCardDesignConfigSchema>;
export type IdCardField = (typeof ID_CARD_FIELDS)[number];

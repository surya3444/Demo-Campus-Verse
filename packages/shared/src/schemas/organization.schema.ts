import { z } from 'zod';
import { objectIdSchema } from './common.schema';
import { CORE_MODULES, isValidModuleCode } from '../constants/modules';

// Enabled modules update (tenant settings + super admin)
export const updateModulesSchema = z.object({
  modules: z
    .array(z.string())
    .min(1, 'At least one module is required')
    .refine((modules) => modules.every((m) => isValidModuleCode(m)), 'Invalid module code provided')
    .refine(
      (modules) => CORE_MODULES.every((core) => modules.includes(core)),
      'Core modules cannot be removed'
    ),
});

export const createInstitutionSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(150),
  code: z
    .string()
    .min(2)
    .max(20)
    .regex(/^[A-Z0-9-]+$/, 'Code must be uppercase alphanumeric with hyphens'),
  kind: z.string().max(50).optional(),
  settings: z
    .object({
      admissionPrefix: z.string().max(20).optional(),
      logo: z.string().optional(),
      letterhead: z.string().optional(),
    })
    .optional(),
});

export const updateInstitutionSchema = createInstitutionSchema.partial().extend({
  status: z.enum(['active', 'archived']).optional(),
});

export const createProgramSchema = z.object({
  /** Owning department; optional when the program belongs to a whole institution (MBBS). */
  departmentId: objectIdSchema.optional(),
  /** Owning institution; derived from the department when one is given. */
  institutionId: objectIdSchema.optional(),
  name: z.string().min(2).max(150),
  code: z
    .string()
    .min(2)
    .max(30)
    .regex(/^[A-Z0-9-]+$/, 'Code must be uppercase alphanumeric with hyphens'),
  degreeType: z.enum(['ug', 'pg', 'diploma', 'phd', 'certificate']),
  durationYears: z.number().int().min(1).max(10),
  /** Derived from the year patterns on save; accepted for older clients. */
  totalSemesters: z.number().int().min(1).max(30).optional(),
  /** Pattern for every year when `yearPatterns` is absent. */
  termPattern: z.enum(['semester', 'annual', 'trimester']).default('semester'),
  /** One pattern per year (index 0 = Year 1); must match durationYears. */
  yearPatterns: z
    .array(z.enum(['annual', 'semester', 'trimester']))
    .min(1)
    .max(10)
    .optional(),
  specialization: z.string().max(100).optional(),
});

export const updateProgramSchema = createProgramSchema.partial().extend({
  status: z.enum(['active', 'archived']).optional(),
});

export const createBranchSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  code: z
    .string()
    .min(2)
    .max(20)
    .regex(/^[A-Z0-9-]+$/, 'Code must be uppercase alphanumeric with hyphens'),
  institutionType: z.enum(['school', 'college', 'university']),
  location: z.object({
    address: z.string().optional(),
    city: z.string().min(1, 'City is required'),
    state: z.string().min(1, 'State is required'),
    country: z.string().default('India'),
    pincode: z.string().regex(/^\d{6}$/, 'Invalid pincode'),
  }),
  contact: z
    .object({
      email: z.string().email().optional(),
      phone: z
        .string()
        .regex(/^(\+91)?[6-9]\d{9}$/, 'Phone must be exactly 10 digits')
        .optional(),
      website: z.string().url().optional(),
    })
    .optional(),
});

export const updateBranchSchema = createBranchSchema.partial();

export const createUserSchema = z.object({
  email: z.string().email('Invalid email'),
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Invalid phone number')
    .optional(),
  profile: z.object({
    firstName: z.string().min(2).max(50),
    lastName: z.string().min(2).max(50),
    displayName: z.string().optional(),
    gender: z.enum(['male', 'female', 'other']).optional(),
  }),
  roleId: objectIdSchema,
  accessScope: z.object({
    type: z.enum(['global', 'institution', 'branch', 'department', 'program']),
    institutionIds: z.array(objectIdSchema).optional(),
    branchIds: z.array(objectIdSchema).default([]),
    departmentIds: z.array(objectIdSchema).optional(),
    programIds: z.array(objectIdSchema).optional(),
  }),
  /** Guest/temporary access: account expires (login blocked) after this date. */
  validUntil: z.coerce.date().nullable().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
});

export const updateUserSchema = createUserSchema.partial().omit({ password: true });

export const createRoleSchema = z.object({
  name: z.string().min(2).max(50),
  code: z
    .string()
    .min(2)
    .max(30)
    .regex(/^[A-Z_]+$/, 'Code must be uppercase with underscores'),
  description: z.string().max(500).optional(),
  level: z.number().int().min(1).max(100),
  permissions: z.record(z.array(z.string())),
});

/**
 * A term/semester inside an academic batch. `semesterNumber` is the absolute
 * program semester (1-12) that program schemes key on. The registration
 * window and add/drop deadline drive course registration.
 */
export const academicTermSchema = z
  .object({
    /** Present when editing an existing term — preserves registration links. */
    _id: objectIdSchema.optional(),
    name: z.string().min(1).max(50),
    /**
     * Which half of the session this term is. All year-cohorts run
     * concurrently; each student's term number is derived from this and
     * their program's year patterns (utils/academic.ts → termNumberFor).
     */
    half: z.enum(['odd', 'even']).optional(),
    /** Position in a trimester calendar (1-3); a third term sets 3. */
    part: z.number().int().min(1).max(3).optional(),
    /**
     * Which calendar this term belongs to when one academic year runs several
     * (B.Tech semesters beside MBA trimesters). Absent = applies to every
     * program year, as before.
     */
    pattern: z.enum(['semester', 'trimester', 'annual']).optional(),
    /** Explicit override for single-cohort programs; usually derived instead. */
    semesterNumber: z.number().int().min(1).max(30).optional(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    registrationWindow: z
      .object({
        opensAt: z.coerce.date(),
        closesAt: z.coerce.date(),
      })
      .refine((w) => w.closesAt > w.opensAt, 'Registration window must close after it opens')
      .optional(),
    addDropDeadline: z.coerce.date().optional(),
  })
  .refine((t) => t.endDate > t.startDate, 'Term end date must be after start date');

/** Start a new academic year from an earlier one's classes and sections. */
export const copyAcademicStructureSchema = z.object({
  fromBatchId: objectIdSchema,
});

export const createAcademicBatchSchema = z.object({
  name: z.string().min(2).max(50),
  code: z.string().min(2).max(20),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  terms: z.array(academicTermSchema).optional(),
});

// One entry per non-leaf hierarchy level. The leaf level (Section) is implicit.
export const classPathEntrySchema = z.object({
  levelKey: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z_]+$/, 'levelKey must be lowercase with underscores'),
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(50),
  order: z.number().int().min(0).optional(),
});

export const createClassSchema = z.object({
  academicBatchId: objectIdSchema,
  path: z.array(classPathEntrySchema).min(1, 'Path must have at least one level').max(5),
  programId: objectIdSchema.optional(),
  capacity: z.number().int().positive().optional(),
  classTeacherId: objectIdSchema.optional(),
});

// `programId: null` detaches a class from its program; the service reads
// `undefined` as "leave alone", so the nullable override matters.
export const updateClassSchema = createClassSchema.partial().extend({
  programId: objectIdSchema.nullable().optional(),
});

export const createSectionSchema = z.object({
  classId: objectIdSchema,
  name: z.string().min(1).max(20),
  code: z.string().optional(),
  capacity: z.number().int().positive().optional(),
  roomNumber: z.string().optional(),
});

/** Replace a section's lab-batch list; existing _ids are preserved. */
export const updateSectionBatchesSchema = z.object({
  batches: z
    .array(
      z.object({
        _id: objectIdSchema.optional(),
        name: z.string().min(1).max(50),
      })
    )
    .max(10),
});

export const assignLabBatchSchema = z.object({
  assignments: z
    .array(
      z.object({
        studentId: objectIdSchema,
        /** null clears the student's lab batch. */
        batchId: objectIdSchema.nullable(),
      })
    )
    .min(1),
});

// Academic Hierarchy Configuration Schema
export const hierarchyLevelSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z_]+$/, 'Key must be lowercase with underscores'),
  label: z.string().min(1).max(50),
  labelPlural: z.string().min(1).max(50),
  isLeaf: z.boolean(),
  order: z.number().int().min(1).max(10),
});

// ─── Subjects ───────────────────────────────────────────────────────────────

export const subjectCategorySchema = z.enum(['DSC', 'DSE', 'GE', 'AECC', 'SEC', 'VAC']);

export const createSubjectSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(20),
  shortName: z.string().max(20).optional(),
  description: z.string().max(2000).optional(),
  type: z.enum(['theory', 'practical', 'both']).default('both'),
  category: subjectCategorySchema.optional(),
  ltp: z
    .object({
      lecture: z.number().int().min(0).max(20),
      tutorial: z.number().int().min(0).max(20),
      practical: z.number().int().min(0).max(20),
    })
    .optional(),
  applicableTo: z
    .object({
      institutionTypes: z.array(z.enum(['school', 'college', 'university'])).optional(),
      grades: z.array(z.string()).optional(),
      streams: z.array(z.string()).optional(),
      departments: z.array(z.string()).optional(),
    })
    .optional(),
  ownerDepartmentId: objectIdSchema.nullable().optional(),
  sharing: z.enum(['global', 'core', 'shared']).optional(),
  offeredToDepartmentIds: z.array(objectIdSchema).optional(),
  credits: z.number().min(0).max(30).optional(),
  maxMarks: z.number().min(0).max(1000).optional(),
  passingMarks: z.number().min(0).max(1000).optional(),
});

export const updateSubjectSchema = createSubjectSchema.partial();

export const academicHierarchyConfigSchema = z.object({
  levels: z
    .array(hierarchyLevelSchema)
    .min(1, 'At least one level is required')
    .max(5, 'Maximum 5 levels allowed')
    .refine(
      (levels) => levels.filter((l) => l.isLeaf).length === 1,
      'Exactly one level must be marked as leaf (where students are assigned)'
    )
    .refine((levels) => {
      const orders = levels.map((l) => l.order);
      return new Set(orders).size === orders.length;
    }, 'Each level must have a unique order')
    .refine((levels) => {
      const keys = levels.map((l) => l.key);
      return new Set(keys).size === keys.length;
    }, 'Each level must have a unique key'),
});

export type UpdateModulesInput = z.infer<typeof updateModulesSchema>;
export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
export type CreateInstitutionInput = z.infer<typeof createInstitutionSchema>;
export type UpdateInstitutionInput = z.infer<typeof updateInstitutionSchema>;
export type CreateProgramInput = z.infer<typeof createProgramSchema>;
export type UpdateProgramInput = z.infer<typeof updateProgramSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type CreateAcademicBatchInput = z.infer<typeof createAcademicBatchSchema>;
export type CreateClassInput = z.infer<typeof createClassSchema>;
export type UpdateClassInput = z.infer<typeof updateClassSchema>;
export type ClassPathEntryInput = z.infer<typeof classPathEntrySchema>;
export type CreateSectionInput = z.infer<typeof createSectionSchema>;
export type AcademicTermInput = z.infer<typeof academicTermSchema>;
export type CreateSubjectSchemaInput = z.infer<typeof createSubjectSchema>;
export type UpdateSubjectSchemaInput = z.infer<typeof updateSubjectSchema>;
export type AcademicHierarchyConfigInput = z.infer<typeof academicHierarchyConfigSchema>;
export type HierarchyLevelInput = z.infer<typeof hierarchyLevelSchema>;

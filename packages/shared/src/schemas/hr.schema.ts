import { z } from 'zod';
import { objectIdSchema } from './common.schema';

// ============ Salary Structure Schemas ============

const earningComponentSchema = z.object({
  code: z.string().min(1, 'Component code is required').max(30),
  name: z.string().min(1, 'Component name is required').max(100),
  type: z.enum(['fixed', 'percentage']),
  percentageOf: z.string().optional(),
  defaultAmount: z.number().min(0, 'Amount must be non-negative'),
  isTaxable: z.boolean().default(true),
  isFixed: z.boolean().default(false),
});

const deductionComponentSchema = z.object({
  code: z.string().min(1, 'Component code is required').max(30),
  name: z.string().min(1, 'Component name is required').max(100),
  type: z.enum(['fixed', 'percentage']),
  percentageOf: z.string().optional(),
  defaultAmount: z.number().min(0, 'Amount must be non-negative'),
  isStatutory: z.boolean().default(false),
  isAutoCalculated: z.boolean().default(false),
});

export const createSalaryStructureSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  code: z
    .string()
    .min(1, 'Code is required')
    .max(20)
    .regex(/^[A-Z0-9_-]+$/, 'Code must be uppercase alphanumeric with hyphens/underscores'),
  description: z.string().max(500).optional(),
  earnings: z
    .array(earningComponentSchema)
    .min(1, 'At least one earning component is required')
    .refine((earnings) => earnings.some((e) => e.code === 'BASIC'), {
      message: 'BASIC component is required in earnings',
    }),
  deductions: z.array(deductionComponentSchema).default([]),
  applicableTo: z
    .object({
      employmentTypes: z.array(z.string()).optional(),
      departmentIds: z.array(objectIdSchema).optional(),
      designationIds: z.array(objectIdSchema).optional(),
      roleCodes: z.array(z.string()).optional(),
    })
    .optional(),
  status: z.enum(['active', 'inactive']).default('active'),
});

export const updateSalaryStructureSchema = createSalaryStructureSchema
  .omit({ code: true })
  .partial();

// ============ Salary Assignment Schemas ============

const salaryComponentAmountSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  amount: z.number().min(0),
});

const customDeductionSchema = z.object({
  code: z.string().min(1, 'Deduction code is required').max(30),
  name: z.string().min(1, 'Deduction name is required').max(100),
  amount: z.number().min(0, 'Amount must be non-negative'),
  frequency: z.enum(['monthly', 'one-time']),
  startMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Format must be YYYY-MM')
    .optional(),
  endMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Format must be YYYY-MM')
    .optional(),
  totalAmount: z.number().min(0).optional(),
  recoveredAmount: z.number().min(0).optional(),
  remainingAmount: z.number().min(0).optional(),
  isActive: z.boolean().default(true),
});

export const assignSalarySchema = z.object({
  staffId: objectIdSchema,
  salaryStructureId: objectIdSchema,
  effectiveFrom: z.coerce.date(),
  earnings: z.array(salaryComponentAmountSchema).min(1),
  deductions: z.array(salaryComponentAmountSchema).default([]),
  // Individual top-ups on top of the structure's components (e.g. special allowance)
  personalAllowances: z.array(salaryComponentAmountSchema).default([]),
  ctc: z.number().min(0).optional(),
  customDeductions: z.array(customDeductionSchema).optional(),
});

export const reviseSalarySchema = z.object({
  salaryStructureId: objectIdSchema.optional(),
  effectiveFrom: z.coerce.date(),
  earnings: z.array(salaryComponentAmountSchema).min(1),
  deductions: z.array(salaryComponentAmountSchema).default([]),
  personalAllowances: z.array(salaryComponentAmountSchema).default([]),
  ctc: z.number().min(0).optional(),
  customDeductions: z.array(customDeductionSchema).optional(),
});

export const addCustomDeductionSchema = customDeductionSchema;

// ============ Payroll Run Schemas ============

export const processPayrollSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
  staffIds: z.array(objectIdSchema).optional(), // if absent, process all active staff
  remarks: z.string().max(500).optional(),
});

// ============ Disbursement Schemas ============

export const updateDisbursementSchema = z.object({
  status: z.enum(['pending', 'processing', 'paid', 'reversed', 'hold', 'failed']),
  paymentMode: z.enum(['bank_transfer', 'cheque', 'cash', 'razorpay_x']).optional(),
  paymentReference: z.string().max(200).optional(),
  remarks: z.string().max(500).optional(),
});

/** Record a whole finalized run as paid by bank transfer (no gateway). */
export const markRunPaidSchema = z.object({
  paymentReference: z.string().trim().min(3, 'Enter the bank reference (UTR)').max(100),
});

export const bulkDisbursementSchema = z.object({
  payslipIds: z.array(objectIdSchema).min(1, 'At least one payslip is required'),
  status: z.enum(['pending', 'processing', 'paid', 'reversed', 'hold', 'failed']),
  paymentMode: z.enum(['bank_transfer', 'cheque', 'cash', 'razorpay_x']).optional(),
  paymentReference: z.string().max(200).optional(),
  remarks: z.string().max(500).optional(),
});

// ============ Payroll Settings Schema ============

export const payrollSettingsSchema = z.object({
  pfRate: z.number().min(0).max(100).default(12),
  employeePfRate: z.number().min(0).max(100).default(12),
  esiEmployerRate: z.number().min(0).max(100).default(3.25),
  esiEmployeeRate: z.number().min(0).max(100).default(0.75),
  esiThreshold: z.number().min(0).default(21000),
  ptSlabs: z
    .array(
      z.object({
        fromAmount: z.number().min(0),
        toAmount: z.number().min(0),
        tax: z.number().min(0),
      })
    )
    .default([]),
  tdsRegime: z.enum(['old', 'new']).default('new'),
  payslipNumberPrefix: z.string().max(10).default('PS'),
  workingDaysPerMonth: z.number().int().min(1).max(31).default(26),
  autoCalculateLOP: z.boolean().default(true),
});

// ============ Staff Self Check-in/out Schema ============

export const selfCheckSchema = z.object({
  // Location is mandatory for self check-in/out — punches must be verifiable
  location: z.object(
    {
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      accuracy: z.number().min(0).optional(),
    },
    { required_error: 'Current location is required to check in/out' }
  ),
});

// ============ Type Exports ============

export type CreateSalaryStructureInput = z.infer<typeof createSalaryStructureSchema>;
export type UpdateSalaryStructureInput = z.infer<typeof updateSalaryStructureSchema>;
export type AssignSalaryInput = z.infer<typeof assignSalarySchema>;
export type ReviseSalaryInput = z.infer<typeof reviseSalarySchema>;
export type AddCustomDeductionInput = z.infer<typeof addCustomDeductionSchema>;
export type ProcessPayrollInput = z.infer<typeof processPayrollSchema>;
export type UpdateDisbursementInput = z.infer<typeof updateDisbursementSchema>;
export type BulkDisbursementInput = z.infer<typeof bulkDisbursementSchema>;
export type PayrollSettingsInput = z.infer<typeof payrollSettingsSchema>;
export type SelfCheckInput = z.infer<typeof selfCheckSchema>;

// ============ Promotion Schemas ============

export const promotionIncrementSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('percentage'),
    value: z.number().positive().max(500),
    base: z.enum(['basic', 'gross']).default('basic'),
  }),
  z.object({ type: z.literal('fixed'), value: z.number().positive() }),
  z.object({ type: z.literal('structure'), structureId: objectIdSchema }),
]);

export const createPromotionPolicySchema = z.object({
  fromDesignationId: objectIdSchema,
  toDesignationId: objectIdSchema,
  increment: promotionIncrementSchema,
  requiresApproval: z.boolean().default(false),
});

export const updatePromotionPolicySchema = z.object({
  increment: promotionIncrementSchema.optional(),
  requiresApproval: z.boolean().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export const promoteStaffSchema = z.object({
  toDesignationId: objectIdSchema,
  effectiveFrom: z.coerce.date().optional(),
  /** Bypass the upward-ladder check for sideways moves. */
  lateral: z.boolean().optional(),
  remarks: z.string().max(500).optional(),
});

export const rejectPromotionSchema = z.object({
  reason: z.string().min(3).max(500),
});

export type PromotionIncrementInput = z.infer<typeof promotionIncrementSchema>;
export type CreatePromotionPolicyInput = z.infer<typeof createPromotionPolicySchema>;
export type UpdatePromotionPolicyInput = z.infer<typeof updatePromotionPolicySchema>;
export type PromoteStaffInput = z.infer<typeof promoteStaffSchema>;
export type RejectPromotionInput = z.infer<typeof rejectPromotionSchema>;

/** Required fields for creating a staff member; other form fields pass through. */
export const createStaffRouteSchema = z
  .object({
    firstName: z.string().trim().min(1, 'First name is required').max(50),
    lastName: z.string().trim().min(1, 'Last name is required').max(50),
    contact: z
      .object({
        email: z.string().email('A valid email is required'),
        phone: z.string().min(10, 'A phone number is required').max(15),
      })
      .passthrough(),
    employment: z
      .object({
        joiningDate: z.string().min(1, 'Joining date is required'),
        // The web form also offers probation and intern.
        employmentType: z.enum([
          'permanent',
          'contract',
          'part-time',
          'visiting',
          'probation',
          'intern',
        ]),
        departmentId: z
          .string()
          .regex(/^[a-f0-9]{24}$/i)
          .optional(),
      })
      .passthrough(),
    roleCode: z.string().max(40).optional(),
    accessScope: z
      .object({
        type: z.enum(['branch', 'institution', 'department', 'program']),
        institutionIds: z.array(z.string().regex(/^[a-f0-9]{24}$/i)).optional(),
        departmentIds: z.array(z.string().regex(/^[a-f0-9]{24}$/i)).optional(),
        programIds: z.array(z.string().regex(/^[a-f0-9]{24}$/i)).optional(),
      })
      .optional(),
    password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  })
  .passthrough();

export const createDepartmentRouteSchema = z
  .object({
    name: z.string().trim().min(2, 'Department name is required').max(100),
    code: z.string().trim().min(2, 'Department code is required').max(20),
    type: z.enum(['academic', 'administrative', 'support']),
    institutionId: z
      .string()
      .regex(/^[a-f0-9]{24}$/i)
      .optional(),
    shared: z.boolean().optional(),
  })
  .passthrough();

import { z } from 'zod';
import { objectIdSchema } from './common.schema';

// ============ Fee Component Schema ============
export const feeComponentSchema = z.object({
  code: z.string().min(1, 'Component code is required').max(20),
  name: z.string().min(1, 'Component name is required').max(100),
  amount: z.number().min(0, 'Amount must be non-negative'),
  taxRate: z.number().min(0).max(100).default(0),
  taxAmount: z.number().min(0).default(0),
  totalAmount: z.number().min(0),
  isOptional: z.boolean().default(false),
  isMandatory: z.boolean().default(true),
});

// ============ Installment Schema ============
export const installmentSchema = z.object({
  installmentNumber: z.number().int().min(1),
  name: z.string().min(1).max(100),
  dueDate: z.coerce.date(),
  amount: z.number().min(0),
  percentage: z.number().min(0).max(100).optional(),
});

// ============ Concession Rules Schema ============
export const concessionRulesSchema = z.object({
  requireApproval: z.boolean().default(true),
  maxPercentage: z.number().min(0).max(100).default(100),
  allowedTypes: z.array(z.string()).default([]),
});

// ============ Fine Rules Schema ============
export const fineRulesSchema = z.object({
  enabled: z.boolean().default(false),
  type: z.enum(['fixed', 'percentage', 'daily', 'compound']).default('fixed'),
  value: z.number().min(0).default(0),
  gracePeriodDays: z.number().int().min(0).default(0),
  maxFineAmount: z.number().min(0).optional(),
  compoundingPeriod: z.enum(['daily', 'weekly', 'monthly']).optional(),
});

// ============ Fee Structure Schemas ============
/**
 * Matches what the fee-structure form sends and the API stores: components
 * carry the period total; installments split it per component code. Unknown
 * keys pass through so older clients keep working.
 */
const feeStructureComponentSchema = z
  .object({
    name: z.string().min(1).max(100),
    code: z.string().min(1).max(20),
    amount: z.number().min(0),
    type: z.enum(['mandatory', 'optional', 'service-based']).default('mandatory'),
    frequency: z.enum(['yearly', 'term-wise', 'monthly']).optional(),
    taxable: z.boolean().optional(),
    taxRate: z.number().min(0).max(100).optional(),
    refundable: z.boolean().optional(),
  })
  .passthrough();

const feeStructureInstallmentSchema = z
  .object({
    name: z.string().min(1).max(100),
    dueDate: z.coerce.date(),
    components: z
      .array(z.object({ componentCode: z.string().min(1), amount: z.number().min(0) }))
      .min(1, 'Each installment needs at least one component amount'),
  })
  .passthrough();

export const createFeeStructureSchema = z
  .object({
    name: z.string().min(1, 'Fee structure name is required').max(200),
    code: z.string().min(1, 'Fee structure code is required').max(60),
    /** Optional: grade-scoped structures are not tied to a batch. */
    academicBatchId: objectIdSchema.optional(),
    parentStructureId: objectIdSchema.nullable().optional(),
    applicableTo: z
      .object({
        classIds: z.array(objectIdSchema).optional(),
        sectionIds: z.array(objectIdSchema).optional(),
        gradeCodes: z.array(z.string()).optional(),
        categories: z.array(z.string()).optional(),
        admissionCategories: z.array(z.string()).optional(),
      })
      .passthrough()
      .optional(),
    components: z
      .array(feeStructureComponentSchema)
      .min(1, 'At least one fee component is required'),
    installments: z.array(feeStructureInstallmentSchema).optional(),
    category: z.enum(['tuition', 'hostel', 'transport', 'other']).optional(),
    isActive: z.boolean().optional(),
    description: z.string().max(500).optional(),
  })
  .passthrough();

export const updateFeeStructureSchema = createFeeStructureSchema.partial().omit({
  code: true,
  academicBatchId: true,
});

// ============ Fee Assignment Schemas ============
export const createFeeAssignmentSchema = z.object({
  studentId: objectIdSchema,
  feeStructureId: objectIdSchema,
  academicBatchId: objectIdSchema,
  discountType: z.enum(['percentage', 'fixed']).optional(),
  discountValue: z.number().min(0).optional(),
  discountReason: z.string().max(500).optional(),
  remarks: z.string().max(500).optional(),
});

export const bulkFeeAssignmentSchema = z.object({
  feeStructureId: objectIdSchema,
  academicBatchId: objectIdSchema,
  studentIds: z.array(objectIdSchema).min(1, 'At least one student is required'),
  discountType: z.enum(['percentage', 'fixed']).optional(),
  discountValue: z.number().min(0).optional(),
  discountReason: z.string().max(500).optional(),
});

// ============ Fee Transaction Schemas ============
export const paymentModeSchema = z.enum([
  'cash',
  'card',
  'upi',
  'netbanking',
  'cheque',
  'dd',
  'wallet',
]);

export const paymentDetailsSchema = z.object({
  referenceNumber: z.string().optional(),
  bankName: z.string().optional(),
  chequeNumber: z.string().optional(),
  chequeDate: z.coerce.date().optional(),
  cardLast4: z
    .string()
    .length(4)
    .regex(/^\d{4}$/)
    .optional(),
  upiId: z.string().optional(),
});

export const transactionComponentSchema = z.object({
  componentCode: z.string(),
  name: z.string(),
  amount: z.number().min(0),
});

export const collectFeeSchema = z.object({
  studentId: objectIdSchema,
  feeAssignmentId: objectIdSchema,
  paymentMode: paymentModeSchema,
  paymentDetails: paymentDetailsSchema.optional(),
  components: z.array(transactionComponentSchema).min(1, 'At least one component is required'),
  installmentNumbers: z
    .array(z.number().int().min(1))
    .min(1, 'At least one installment is required'),
  feeAmount: z.number().min(0, 'Fee amount must be non-negative'),
  fineAmount: z.number().min(0).default(0),
  adjustments: z.number().default(0),
  remarks: z.string().max(500).optional(),
});

export const cancelTransactionSchema = z.object({
  reason: z.string().min(10, 'Cancellation reason must be at least 10 characters').max(500),
});

export const refundTransactionSchema = z.object({
  amount: z.number().positive('Refund amount must be positive'),
  reason: z.string().min(10, 'Refund reason must be at least 10 characters').max(500),
});

// ============ Online Payment Schemas ============
export const initiateOnlinePaymentSchema = z.object({
  studentId: objectIdSchema,
  feeAssignmentId: objectIdSchema,
  components: z.array(transactionComponentSchema).min(1),
  installmentNumbers: z.array(z.number().int().min(1)).min(1),
  feeAmount: z.number().min(0),
  fineAmount: z.number().min(0).default(0),
  adjustments: z.number().default(0),
  remarks: z.string().max(500).optional(),
});

export const verifyOnlinePaymentSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  paymentId: z.string().min(1, 'Payment ID is required'),
  signature: z.string().min(1, 'Signature is required'),
});

// ============ Concession Schemas ============
export const concessionTypeSchema = z.enum([
  'scholarship',
  'staff-ward',
  'sibling',
  'merit',
  'need-based',
  'custom',
]);

export const createConcessionSchema = z.object({
  studentId: objectIdSchema,
  academicBatchId: objectIdSchema,
  feeAssignmentId: objectIdSchema.optional(),
  type: concessionTypeSchema,
  name: z.string().min(1, 'Concession name is required').max(100),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.number().positive('Discount value must be positive'),
  appliedTo: z.enum(['total', 'tuition', 'specific']).default('total'),
  specificComponents: z.array(z.string()).optional(),
  reason: z.string().max(500).optional(),
  validFrom: z.coerce.date().optional(),
  validTo: z.coerce.date().optional(),
  documents: z.array(z.string()).optional(),
});

export const approveConcessionSchema = z.object({
  approvalRemarks: z.string().max(500).optional(),
});

export const rejectConcessionSchema = z.object({
  rejectionReason: z.string().min(10, 'Rejection reason must be at least 10 characters').max(500),
});

// ============ Enrollment Fee Options Schema ============
export const enrollWithFeeOptionsSchema = z.object({
  sectionId: objectIdSchema,
  admissionNumber: z.string().optional(),
  rollNumber: z.string().optional(),
  admissionDate: z.string().optional(),
  feeStructureIds: z.array(objectIdSchema).optional(),
  transportOptIn: z.boolean().optional(),
  concession: z
    .object({
      type: concessionTypeSchema,
      name: z.string().min(1).max(100),
      discountType: z.enum(['percentage', 'fixed']),
      discountValue: z.number().positive(),
      appliedTo: z.enum(['total', 'tuition', 'specific']).default('total'),
      specificComponents: z.array(z.string()).optional(),
      reason: z.string().max(500).optional(),
    })
    .optional(),
});

// ============ Wallet Schemas ============
export const createWalletSchema = z.object({
  studentId: objectIdSchema,
  category: z.string().default('general'),
  initialBalance: z.number().min(0).default(0),
});

export const walletTopUpSchema = z.object({
  amount: z.number().positive('Top-up amount must be positive'),
  paymentMode: paymentModeSchema,
  paymentDetails: paymentDetailsSchema.optional(),
  remarks: z.string().max(500).optional(),
});

export const walletDebitSchema = z.object({
  amount: z.number().positive('Debit amount must be positive'),
  reason: z.string().min(1, 'Reason is required').max(500),
  referenceType: z.enum(['fee_payment', 'refund', 'adjustment', 'other']).default('other'),
  referenceId: objectIdSchema.optional(),
});

// ============ Due Reminder Schema ============
export const sendDueReminderSchema = z.object({
  studentIds: z.array(objectIdSchema).min(1, 'At least one student is required'),
  message: z.string().max(500).optional(),
  channel: z.enum(['sms', 'email', 'whatsapp', 'all']).default('sms'),
});

// ============ Finance Settings Schemas ============
export const bankAccountSchema = z.object({
  accountName: z.string().min(1).max(100),
  accountNumber: z.string().min(1).max(20),
  bankName: z.string().min(1).max(100),
  branchName: z.string().optional(),
  ifscCode: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code'),
  accountType: z.enum(['savings', 'current']),
  isDefault: z.boolean().default(false),
});

export const paymentMethodSettingsSchema = z.object({
  code: z.string(),
  isEnabled: z.boolean(),
  displayName: z.string().optional(),
  processingFee: z.number().min(0).optional(),
  processingFeeType: z.enum(['fixed', 'percentage']).optional(),
});

export const updateFinanceSettingsSchema = z.object({
  receiptPrefix: z.string().max(10).optional(),
  receiptStartNumber: z.number().int().min(1).optional(),
  fiscalYearStart: z
    .object({
      month: z.number().int().min(1).max(12),
      day: z.number().int().min(1).max(31),
    })
    .optional(),
  cancellationSettings: z
    .object({
      allowedWithinDays: z.number().int().min(0).optional(),
      requiresApproval: z.boolean().optional(),
      approvalRoles: z.array(z.string()).optional(),
    })
    .optional(),
  onlinePaymentSettings: z
    .object({
      isEnabled: z.boolean(),
      gatewayProvider: z.enum(['razorpay', 'paytm', 'stripe']).optional(),
    })
    .optional(),
});

// ============ Report Filter Schemas ============
export const dueReportFilterSchema = z.object({
  academicBatchId: objectIdSchema,
  branchId: objectIdSchema.optional(),
  classId: objectIdSchema.optional(),
  sectionId: objectIdSchema.optional(),
  installmentNumber: z.coerce.number().int().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const collectionReportFilterSchema = z.object({
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  branchId: objectIdSchema.optional(),
  feeType: z.string().optional(),
  classId: objectIdSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// ============ Type Exports ============
// Note: PaymentMode is already exported from types/finance.ts, so we don't re-export it here
export type ConcessionRulesInput = z.infer<typeof concessionRulesSchema>;
export type FeeComponentInput = z.infer<typeof feeComponentSchema>;
export type InstallmentInput = z.infer<typeof installmentSchema>;
export type FineRulesInput = z.infer<typeof fineRulesSchema>;
export type CreateFeeStructureInput = z.infer<typeof createFeeStructureSchema>;
export type UpdateFeeStructureInput = z.infer<typeof updateFeeStructureSchema>;
export type CreateFeeAssignmentInput = z.infer<typeof createFeeAssignmentSchema>;
export type BulkFeeAssignmentInput = z.infer<typeof bulkFeeAssignmentSchema>;
export type PaymentDetailsInput = z.infer<typeof paymentDetailsSchema>;
export type CollectFeeInput = z.infer<typeof collectFeeSchema>;
export type CancelTransactionInput = z.infer<typeof cancelTransactionSchema>;
export type RefundTransactionInput = z.infer<typeof refundTransactionSchema>;
export type InitiateOnlinePaymentInput = z.infer<typeof initiateOnlinePaymentSchema>;
export type VerifyOnlinePaymentInput = z.infer<typeof verifyOnlinePaymentSchema>;
export type ConcessionType = z.infer<typeof concessionTypeSchema>;
export type CreateConcessionInput = z.infer<typeof createConcessionSchema>;
export type CreateWalletInput = z.infer<typeof createWalletSchema>;
export type WalletTopUpInput = z.infer<typeof walletTopUpSchema>;
export type WalletDebitInput = z.infer<typeof walletDebitSchema>;
export type SendDueReminderInput = z.infer<typeof sendDueReminderSchema>;
export type BankAccountInput = z.infer<typeof bankAccountSchema>;
export type PaymentMethodSettingsInput = z.infer<typeof paymentMethodSettingsSchema>;
export type UpdateFinanceSettingsInput = z.infer<typeof updateFinanceSettingsSchema>;
export type DueReportFilterInput = z.infer<typeof dueReportFilterSchema>;
export type CollectionReportFilterInput = z.infer<typeof collectionReportFilterSchema>;
export type EnrollWithFeeOptionsInput = z.infer<typeof enrollWithFeeOptionsSchema>;

// ============ Scholarships (receivables, not discounts) ============

export const createScholarshipSchema = z.object({
  studentId: objectIdSchema,
  /** Defaults to the student's active fee assignment with a balance. */
  feeAssignmentId: objectIdSchema.optional(),
  scheme: z.string().min(2).max(100),
  sponsor: z.enum(['government', 'private', 'institution']).default('government'),
  sanctionedAmount: z.number().positive(),
  applicationRef: z.string().max(100).optional(),
  remarks: z.string().max(1000).optional(),
});

export const scholarshipDisbursementSchema = z.object({
  amount: z.number().positive(),
  receivedAt: z.coerce.date().optional(),
  utrRef: z.string().max(100).optional(),
});

export const rejectScholarshipSchema = z.object({
  reason: z.string().min(3).max(500),
});

export type CreateScholarshipInput = z.infer<typeof createScholarshipSchema>;
export type ScholarshipDisbursementInput = z.infer<typeof scholarshipDisbursementSchema>;
export type RejectScholarshipInput = z.infer<typeof rejectScholarshipSchema>;

import { BaseEntity } from './common';

export interface FeeStructure extends BaseEntity {
  branchId: string;
  academicBatchId: string;
  name: string;
  code: string;
  applicableTo?: {
    institutionType?: string;
    classIds?: string[];
    sectionIds?: string[];
    /** Stable grade identifiers — the preferred targeting key. */
    gradeCodes?: string[];
    streams?: string[];
    categories?: string[];
    /** Admission routes (management/convener/…); empty ⇒ everyone. */
    admissionCategories?: string[];
  };
  components: FeeComponent[];
  installments: FeeInstallment[];
  fineRules?: FineRules;
  totalAmount: number;
  mandatoryTotal: number;
  isActive: boolean;
}

export interface FeeComponent {
  name: string;
  code: string;
  type: 'mandatory' | 'optional' | 'service-based';
  amount: number;
  frequency: 'yearly' | 'term-wise' | 'monthly';
  taxable?: boolean;
  taxRate?: number;
  refundable?: boolean;
}

export interface FeeInstallment {
  name: string;
  dueDate: Date;
  components: Array<{
    componentCode: string;
    amount: number;
  }>;
  totalAmount: number;
}

export interface FineRules {
  type: 'fixed' | 'percentage' | 'daily';
  amount: number;
  gracePeriodDays: number;
  maxFine: number;
}

export interface FeeAssignment extends BaseEntity {
  branchId: string;
  studentId: string;
  academicBatchId: string;
  feeStructureId: string;
  components: Array<{
    componentCode: string;
    name: string;
    originalAmount: number;
    discountAmount: number;
    finalAmount: number;
    taxAmount: number;
    totalAmount: number;
  }>;
  installments: Array<{
    installmentNumber: number;
    name: string;
    dueDate: Date;
    amount: number;
    fineAmount: number;
    totalDue: number;
    paidAmount: number;
    balance: number;
    status: 'pending' | 'partial' | 'paid' | 'overdue';
  }>;
  summary: {
    totalFee: number;
    totalDiscount: number;
    totalTax: number;
    netPayable: number;
    totalPaid: number;
    totalFine: number;
    balance: number;
  };
  concessions?: Array<{
    concessionId: string;
    type: string;
    amount: number;
    appliedTo: string[];
  }>;
  status: 'active' | 'cleared' | 'cancelled';
}

export interface FeeTransaction extends BaseEntity {
  branchId: string;
  studentId: string;
  feeAssignmentId: string;
  receiptNumber: string;
  receiptDate: Date;
  paymentMode: PaymentMode;
  paymentDetails?: {
    referenceNumber?: string;
    bankName?: string;
    chequeNumber?: string;
    chequeDate?: Date;
    cardLast4?: string;
    upiId?: string;
  };
  components: Array<{
    componentCode: string;
    name: string;
    amount: number;
  }>;
  installmentNumbers: number[];
  feeAmount: number;
  fineAmount: number;
  adjustments: number;
  totalAmount: number;
  status: 'success' | 'pending' | 'failed' | 'cancelled' | 'refunded';
  remarks?: string;
  refund?: {
    refundId: string;
    amount: number;
    reason: string;
    refundedAt: Date;
    refundedBy: string;
  };
  cancellation?: {
    reason: string;
    cancelledAt: Date;
    cancelledBy: string;
    approvedBy?: string;
  };
  collectedBy: string;
}

export type PaymentMode = 'cash' | 'card' | 'upi' | 'netbanking' | 'cheque' | 'dd' | 'wallet';

export interface Concession extends BaseEntity {
  branchId: string;
  studentId: string;
  feeAssignmentId: string;
  academicBatchId: string;
  type: 'scholarship' | 'staff-ward' | 'sibling' | 'merit' | 'need-based' | 'custom';
  name: string;
  reason?: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  calculatedAmount: number;
  appliedTo: string[];
  status: 'pending' | 'approved' | 'rejected';
  requestedBy: string;
  requestedAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
  rejectionReason?: string;
  documents?: Array<{ type: string; url: string }>;
  remarks?: string;
}

/**
 * Scholarship / government fee reimbursement — a RECEIVABLE, not a discount.
 * Unlike a Concession (which shrinks the payable), the fee stays whole: the
 * payer changes, and the institution carries a receivable against the sponsor
 * until disbursements arrive. An approved scholarship marks a sponsored
 * portion on the linked fee assignment so the student's own dues (and
 * registration fee-gating) count only the self-pay part.
 */
export type ScholarshipStatus =
  | 'applied'
  | 'approved'
  | 'rejected'
  | 'partially_disbursed'
  | 'disbursed'
  | 'lapsed';

export interface ScholarshipDisbursement {
  _id: string;
  amount: number;
  receivedAt: Date;
  /** Bank UTR / transaction reference of the sponsor's transfer. */
  utrRef?: string;
  recordedBy: string;
  recordedAt: Date;
}

export interface Scholarship extends BaseEntity {
  branchId: string;
  studentId: string;
  academicBatchId?: string;
  /** Fee assignment carrying the sponsored portion (set on approval). */
  feeAssignmentId?: string;
  /** Tenant-configurable: 'govt_fee_reimbursement', 'post_matric', 'merit', … */
  scheme: string;
  sponsor: 'government' | 'private' | 'institution';
  sanctionedAmount: number;
  /** Portion actually marked sponsored on the fee assignment (≤ sanctioned). */
  appliedAmount?: number;
  /** ePASS / portal application number. */
  applicationRef?: string;
  status: ScholarshipStatus;
  disbursements: ScholarshipDisbursement[];
  requestedBy?: string;
  requestedAt?: Date;
  approvedBy?: string;
  approvedAt?: Date;
  rejectionReason?: string;
  remarks?: string;
}

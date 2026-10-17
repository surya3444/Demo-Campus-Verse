import { BaseEntity, Address, Gender, Status } from './common';

export interface Staff extends BaseEntity {
  branchId: string;
  additionalBranches?: string[];
  employeeId: string;
  userId?: string;
  firstName: string;
  lastName: string;
  displayName: string;
  dateOfBirth: Date;
  gender: Gender;
  bloodGroup?: string;
  nationality?: string;
  photo?: string;
  contact?: {
    email?: string;
    phone?: string;
    alternatePhone?: string;
    emergencyContact?: {
      name: string;
      relation: string;
      phone: string;
    };
    address?: {
      current?: Address;
      permanent?: Address;
    };
  };
  employment: {
    joiningDate: Date;
    confirmationDate?: Date;
    employmentType: 'permanent' | 'contract' | 'part-time' | 'visiting';
    departmentId?: string;
    designationId?: string;
    reportingTo?: string;
    noticePeriod?: number;
  };
  teaching?: {
    isTeaching: boolean;
    subjects?: Array<{
      subjectId: string;
      classIds: string[];
    }>;
    classTeacherOf?: string;
    periodsPerWeek?: number;
  };
  qualifications?: Array<{
    degree: string;
    specialization?: string;
    institution: string;
    year: number;
    percentage?: number;
  }>;
  experience?: Array<{
    organization: string;
    designation: string;
    fromDate: Date;
    toDate?: Date;
    responsibilities?: string;
  }>;
  bankDetails?: {
    accountNumber: string;
    bankName: string;
    ifscCode: string;
    accountType?: string;
  };
  documents?: Array<{
    type: string;
    number?: string;
    url: string;
    verifiedAt?: Date;
  }>;
  status: Status | 'on-leave' | 'resigned' | 'terminated';
  statusHistory?: Array<{
    status: string;
    date: Date;
    reason?: string;
    changedBy: string;
  }>;
  /** Promotion trail — every designation change with its effective date. */
  designationHistory?: DesignationChange[];
  exitDate?: Date;
  exitReason?: string;
}

export interface StaffAttendance extends BaseEntity {
  branchId: string;
  date: Date;
  records: Array<{
    staffId: string;
    status: 'present' | 'absent' | 'late' | 'half-day' | 'leave' | 'wfh';
    shift?: string;
    inTime?: string;
    outTime?: string;
    workingHours?: number;
    leaveId?: string;
    remarks?: string;
  }>;
  summary: {
    total: number;
    present: number;
    absent: number;
    late: number;
    onLeave: number;
  };
  markedBy: string;
  markedAt: Date;
  isLocked: boolean;
}

export interface Leave extends BaseEntity {
  branchId: string;
  staffId: string;
  leaveType: 'casual' | 'sick' | 'earned' | 'maternity' | 'lop';
  fromDate: Date;
  toDate: Date;
  days: number;
  isHalfDay: boolean;
  halfDayType?: 'first-half' | 'second-half';
  reason: string;
  documents?: Array<{ type: string; url: string }>;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approverId?: string;
  approverRemarks?: string;
  approvedAt?: Date;
  cancellationReason?: string;
  cancelledAt?: Date;
  appliedAt: Date;
}

export interface LeaveBalance extends BaseEntity {
  branchId: string;
  staffId: string;
  academicBatchId: string;
  balances: Array<{
    leaveType: string;
    entitled: number;
    taken: number;
    pending: number;
    balance: number;
    carryForward: number;
    lapsed: number;
  }>;
}

export interface Department extends BaseEntity {
  branchId?: string;
  /**
   * Constituent institution this department belongs to (universities). The
   * branch stays the scope key; this is what separates Engineering from Design
   * when both run on the same campus.
   */
  institutionId?: string;
  name: string;
  code: string;
  description?: string;
  headId?: string;
  status: Status;
}

export interface Designation extends BaseEntity {
  name: string;
  code: string;
  level: number;
  departmentId?: string;
  status: Status;
}

// ============ Payroll Types ============

export interface SalaryComponent {
  code: string;
  name: string;
  amount: number;
}

export interface SalaryStructureComponent {
  code: string;
  name: string;
  type: 'fixed' | 'percentage';
  percentageOf?: string;
  defaultAmount: number;
  isTaxable: boolean;
  isFixed: boolean;
}

export interface SalaryDeductionComponent {
  code: string;
  name: string;
  type: 'fixed' | 'percentage';
  percentageOf?: string;
  defaultAmount: number;
  isStatutory: boolean;
  isAutoCalculated: boolean;
}

export interface SalaryStructure extends BaseEntity {
  branchId: string;
  name: string;
  code: string;
  description?: string;
  earnings: SalaryStructureComponent[];
  deductions: SalaryDeductionComponent[];
  applicableTo?: {
    employmentTypes?: string[];
    departmentIds?: string[];
    designationIds?: string[];
    roleCodes?: string[];
  };
  status: Status;
}

export interface CustomDeduction {
  code: string;
  name: string;
  amount: number;
  frequency: 'monthly' | 'one-time';
  startMonth?: string;
  endMonth?: string;
  totalAmount?: number;
  recoveredAmount?: number;
  remainingAmount?: number;
  isActive: boolean;
}

export interface StaffSalaryAssignment extends BaseEntity {
  branchId: string;
  staffId: string;
  salaryStructureId: string;
  effectiveFrom: Date;
  effectiveTo?: Date;
  earnings: SalaryComponent[];
  deductions: SalaryComponent[];
  /** Individual top-ups on top of the structure's components (kept separate for audit) */
  personalAllowances?: SalaryComponent[];
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
  ctc?: number;
  customDeductions?: CustomDeduction[];
  status: 'active' | 'revised' | 'inactive';
}

export type PayrollRunStatus = 'draft' | 'processing' | 'processed' | 'finalized' | 'cancelled';

export interface PayrollRun extends BaseEntity {
  branchId: string;
  month: number;
  year: number;
  period: string;
  staffCount: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  status: PayrollRunStatus;
  processedBy: string;
  processedAt: Date;
  finalizedBy?: string;
  finalizedAt?: Date;
  remarks?: string;
}

export type DisbursementStatus = 'pending' | 'processing' | 'paid' | 'reversed' | 'hold' | 'failed';

export type PayoutStatus =
  | 'queued'
  | 'pending'
  | 'initiated'
  | 'processing'
  | 'processed'
  | 'reversed'
  | 'failed'
  | 'cancelled';

// Optional Razorpay-X payout tracker on the disbursement. Populated when the
// payslip is paid via the RazorpayX integration; free-text `paymentReference`
// is still used for manual/cash/cheque flows.
export interface PayslipPayout {
  payoutId?: string; // pout_xxxxxxxxxxxxxxx
  idempotencyKey?: string; // stored for retry-safety
  mode?: 'IMPS' | 'NEFT' | 'RTGS' | 'UPI';
  utr?: string;
  status?: PayoutStatus;
  failureReason?: string;
  initiatedAt?: Date; // when we hit POST /payouts
  initiatedBy?: string; // userId of the admin who clicked Pay
  lastWebhookAt?: Date; // most recent status webhook
  attempts?: number; // number of times POST /payouts was fired (retries)
}

export interface PayslipDisbursement {
  status: DisbursementStatus;
  paymentMode?: 'bank_transfer' | 'cheque' | 'cash' | 'razorpay_x';
  paymentReference?: string;
  paidAt?: Date;
  paidBy?: string;
  remarks?: string;
  payout?: PayslipPayout;
}

export interface PayslipTds {
  annualProjectedIncome: number;
  taxableIncome: number;
  annualTax: number;
  monthlyTds: number;
  regime: 'old' | 'new';
}

export interface Payslip extends BaseEntity {
  branchId: string;
  payrollRunId: string;
  staffId: string;
  payslipNumber: string;
  month: number;
  year: number;
  period: string;
  staffSnapshot: {
    employeeId: string;
    displayName: string;
    departmentName?: string;
    designationName?: string;
    bankDetails?: {
      accountNumber: string;
      bankName: string;
      ifscCode: string;
    };
    panNumber?: string;
  };
  earnings: SalaryComponent[];
  deductions: SalaryComponent[];
  workingDays: number;
  daysPresent: number;
  daysAbsent: number;
  lopDays: number;
  lopDeduction: number;
  grossEarnings: number;
  totalDeductions: number;
  netPayable: number;
  tds: PayslipTds;
  disbursement: PayslipDisbursement;
  status: 'draft' | 'generated' | 'finalized';
}

export interface PayrollSettings {
  pfRate: number;
  employeePfRate: number;
  esiEmployerRate: number;
  esiEmployeeRate: number;
  esiThreshold: number;
  ptSlabs: Array<{ fromAmount: number; toAmount: number; tax: number }>;
  tdsRegime: 'old' | 'new';
  payslipNumberPrefix: string;
  workingDaysPerMonth: number;
  autoCalculateLOP: boolean;
}

// ============ Promotions ============

/**
 * Configurable promotion rule: what happens to salary when a staff member
 * moves from one designation to another. No hardcoded percentages — the
 * client's "10% vs 20%" lives entirely here.
 */
export interface PromotionPolicy extends BaseEntity {
  /** Branch-level override; absent = tenant-wide. */
  branchId?: string;
  fromDesignationId: string;
  toDesignationId: string;
  increment:
    | { type: 'percentage'; value: number; base: 'basic' | 'gross' }
    | { type: 'fixed'; value: number }
    | { type: 'structure'; structureId: string };
  requiresApproval: boolean;
  status: Status;
}

/** One entry in Staff.designationHistory — the statusHistory pattern. */
export interface DesignationChange {
  fromDesignationId?: string;
  toDesignationId: string;
  effectiveFrom: Date;
  promotionId?: string;
  appliedBy: string;
  appliedAt: Date;
}

/** A promotion request/record; approval trail mirrors Concession. */
export interface StaffPromotion extends BaseEntity {
  branchId: string;
  staffId: string;
  fromDesignationId?: string;
  toDesignationId: string;
  policyId?: string;
  effectiveFrom: Date;
  /** Ladder check bypassed (sideways move between equal levels). */
  lateral?: boolean;
  status: 'pending' | 'applied' | 'rejected';
  salaryChange?: { previousNet: number; newNet: number };
  requestedBy: string;
  requestedAt: Date;
  decidedBy?: string;
  decidedAt?: Date;
  rejectionReason?: string;
  remarks?: string;
}

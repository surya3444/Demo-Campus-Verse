import { BaseEntity } from './common';

export interface Expense extends BaseEntity {
  branchId: string;
  expenseNumber: string;
  title: string;
  description?: string;
  category: 'travel' | 'supplies' | 'equipment' | 'maintenance' | 'events' | 'utilities' | 'other';
  amount: number;
  currency: string;
  requestedBy: {
    userId: string;
    userName: string;
    department?: string;
  };
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'paid' | 'cancelled';
  approvalChain: ExpenseApproval[];
  budgetId?: string;
  attachments?: ExpenseAttachment[];
  paymentMode?: string;
  paymentRef?: string;
  paidAt?: Date;
}

export interface ExpenseApproval {
  userId: string;
  userName: string;
  action: 'submitted' | 'approved' | 'rejected' | 'paid';
  remarks?: string;
  timestamp: Date;
}

export interface ExpenseAttachment {
  name: string;
  url: string;
  type: string;
}

export interface Budget extends BaseEntity {
  branchId: string;
  name: string;
  description?: string;
  category?: string;
  department?: string;
  academicBatchId?: string;
  allocated: number;
  spent: number;
  remaining: number;
  period: {
    startDate: Date;
    endDate: Date;
  };
  status: 'active' | 'exhausted' | 'closed';
}

export interface Reimbursement extends BaseEntity {
  branchId: string;
  reimbursementNumber: string;
  expenseId: string;
  requestedBy: {
    userId: string;
    userName: string;
  };
  amount: number;
  description?: string;
  bankDetails?: {
    accountNumber: string;
    ifscCode: string;
    bankName: string;
  };
  status: 'pending' | 'approved' | 'processed' | 'rejected';
  processedBy?: string;
  processedAt?: Date;
  remarks?: string;
}

export interface ExpenseSettings extends BaseEntity {
  branchId: string;
  requireApproval: boolean;
  autoApproveBelow?: number;
  expenseCategories: string[];
  defaultCurrency: string;
}

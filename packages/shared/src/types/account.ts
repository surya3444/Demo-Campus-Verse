import { InstitutionType } from './organization';

/**
 * Account - Top level container for organization owner
 * This represents the "account owner" who registered first and can manage multiple organizations
 */
export interface Account {
  _id: string;
  name: string;
  code: string;
  ownerUserId: string;
  moderatorUserIds: string[];
  subscription: AccountSubscription;
  billing?: AccountBilling;
  status: AccountStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type AccountStatus = 'active' | 'inactive' | 'suspended' | 'pending_payment' | 'trial';

export interface AccountSubscription {
  planId: string;
  planCode: SubscriptionPlanCode;
  status: SubscriptionStatus;
  startDate: Date;
  validUntil: Date;
  trialEndsAt?: Date;
  limits: AccountLimits;
  features: string[];
}

export interface AccountLimits {
  maxOrganizations: number;
  maxBranchesPerOrg: number;
  maxStudentsTotal: number;
  maxStaffTotal: number;
}

export interface AccountBilling {
  razorpayCustomerId?: string;
  razorpaySubscriptionId?: string;
  billingEmail?: string;
  billingAddress?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    country: string;
    pincode: string;
  };
  gstNumber?: string;
}

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired' | 'paused';
export type SubscriptionPlanCode = 'starter' | 'professional' | 'enterprise' | 'custom';

/**
 * Subscription Plan - Defines available plans
 */
export interface SubscriptionPlan {
  _id: string;
  name: string;
  code: SubscriptionPlanCode;
  description: string;
  pricing: PlanPricing;
  limits: AccountLimits;
  includedModules: string[];
  features: string[];
  trialDays: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlanPricing {
  monthly: number;
  yearly: number;
  currency: string;
  yearlyDiscount?: number;
}

/**
 * Payment - Records of payment transactions
 */
export interface Payment {
  _id: string;
  accountId: string;
  orderId: string;
  paymentId?: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  method?: string;
  description?: string;
  razorpaySignature?: string;
  metadata?: Record<string, unknown>;
  failureReason?: string;
  refundedAmount?: number;
  refundedAt?: Date;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'partial_refund';

/**
 * Invoice - Generated invoices for payments
 */
export interface Invoice {
  _id: string;
  accountId: string;
  paymentId?: string;
  invoiceNumber: string;
  amount: number;
  tax: number;
  total: number;
  currency: string;
  status: InvoiceStatus;
  dueDate: Date;
  paidAt?: Date;
  items: InvoiceItem[];
  billingDetails: {
    name: string;
    email: string;
    address?: string;
    gstNumber?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export type InvoiceStatus = 'draft' | 'pending' | 'paid' | 'overdue' | 'cancelled';

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

/**
 * Organization (New) - Sits between Account and Branch
 * Each organization under an account has its own super admin
 */
export interface AccountOrganization {
  _id: string;
  accountId: string;
  name: string;
  code: string;
  institutionType: InstitutionType;
  superAdminUserId?: string;
  enabledModules: string[];
  contact: {
    email: string;
    phone: string;
    website?: string;
    address: {
      line1: string;
      line2?: string;
      city: string;
      state: string;
      country: string;
      pincode: string;
    };
  };
  legalInfo?: {
    entityName?: string;
    gstNumber?: string;
    panNumber?: string;
    registrationNumber?: string;
    board?: string;
  };
  branding?: {
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
  };
  settings?: {
    timezone?: string;
    dateFormat?: string;
    currency?: string;
    fiscalYearStart?: string;
  };
  status: 'active' | 'inactive' | 'suspended';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * API Response types for Account operations
 */
export interface AccountResponse {
  account: Account;
  organizations: AccountOrganization[];
  subscription: SubscriptionPlan | null;
}

export interface CreateOrganizationInput {
  name: string;
  institutionType: InstitutionType;
  contact?: {
    email?: string;
    phone?: string;
    website?: string;
  };
}

export interface UpdateAccountInput {
  name?: string;
  billing?: Partial<AccountBilling>;
}

export interface AddModeratorInput {
  email: string;
  firstName: string;
  lastName: string;
}

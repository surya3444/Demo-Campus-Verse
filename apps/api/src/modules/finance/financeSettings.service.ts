import { ObjectId, WithId, Document } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';

// ============ Bank Account Types ============
interface BankAccount {
  _id?: string;
  accountName: string;
  accountNumber: string;
  bankName: string;
  branchName: string;
  ifscCode: string;
  accountType: 'current' | 'savings';
  isDefault: boolean;
  isActive: boolean;
}

// ============ Payment Method Types ============
interface PaymentMethod {
  code: string;
  name: string;
  type: 'cash' | 'cheque' | 'online' | 'card' | 'upi' | 'bank_transfer' | 'dd' | 'wallet';
  isEnabled: boolean;
  requiresReference: boolean;
  requiresBankDetails: boolean;
  processingFee?: number;
  processingFeeType?: 'percentage' | 'fixed';
  order: number;
}

// ============ Application Fee Settings ============
interface ApplicationFeeSettings {
  isEnabled: boolean;
  amount: number;
  feeType: 'fixed' | 'variable';
  variableAmounts?: Array<{
    classId?: string;
    className?: string;
    amount: number;
  }>;
  isRefundable: boolean;
  refundPercentage: number;
  paymentModes: string[];
  adjustInFee: boolean;
  adjustmentComponent?: string;
}

// ============ Wallet Sequence Settings ============
interface WalletSequenceSettings {
  isEnabled: boolean;
  deductionOrder: Array<{
    categoryCode: string;
    priority: number;
  }>;
  autoDeductOnPayment: boolean;
  minBalanceRequired: number;
  maxDeductionPercentage: number;
}

// ============ Razorpay Route (Linked Account) ============
// One linked account per branch. Once activated, fee orders for this branch
// carry a transfers[] block routing 100% of the captured amount to the
// school's bank account. Bank fields are stored on the doc so we can re-submit
// if Razorpay flags "needs_clarification", and masked on the way out.
export type RazorpayRouteStatus =
  | 'not_configured'
  | 'created'
  | 'under_review'
  | 'needs_clarification'
  | 'activated'
  | 'suspended'
  | 'rejected';

export interface RazorpayRouteSettings {
  status: RazorpayRouteStatus;
  linkedAccountId?: string;
  legal: {
    entityName: string;
    businessType:
      | 'individual'
      | 'partnership'
      | 'private_limited'
      | 'public_limited'
      | 'proprietorship'
      | 'trust'
      | 'ngo'
      | 'society'
      | 'educational_institutes';
    panNumber: string;
    gstNumber?: string;
  };
  contact: { email: string; phone: string };
  address: { line1: string; city: string; state: string; pincode: string; country: 'IN' };
  bank: { accountNumber: string; ifsc: string; beneficiaryName: string };
  needsClarification?: { message: string; fields: string[] };
  lastSyncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ============ Finance Settings Document ============
interface FinanceSettingsDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;

  // Bank accounts configuration
  bankAccounts: BankAccount[];

  // Payment methods per branch
  paymentMethods: PaymentMethod[];

  // Receipt settings
  receiptSettings: {
    prefix: string;
    padding: number;
    includeYear: boolean;
    yearFormat: '2' | '4';
    showQRCode: boolean;
    footerText: string;
    duplicateCopies: number;
  };

  // Concession settings
  concessionSettings: {
    maxPercentage: number;
    maxAmount: number;
    requiresApproval: boolean;
    approvalThreshold: number;
    eligibleCategories: string[];
    allowMultipleConcessions: boolean;
    allowedReasons: string[];
  };

  // Cancellation settings
  cancellationSettings: {
    allowedWithinDays: number;
    requiresApproval: boolean;
    approvalRoles: string[];
    allowPartialCancellation: boolean;
    refundDeductionPercentage: number;
    refundDeductionFixed: number;
  };

  // Org fee settings
  orgFeeSettings: {
    defaultDueDay: number;
    penaltyStartAfterDays: number;
    penaltyType: 'percentage' | 'fixed' | 'compound';
    penaltyValue: number;
    maxPenaltyCap: number;
    reminderBeforeDays: number[];
    autoLockAfterDueDays: number;
  };

  // Wallet categories
  walletCategories: Array<{
    code: string;
    name: string;
    description?: string;
    isActive: boolean;
  }>;

  // Payment mandatory fields per payment method
  mandatoryFields: Record<
    string,
    Array<{
      fieldName: string;
      label: string;
      required: boolean;
      type: 'text' | 'date' | 'select' | 'number';
      options?: string[];
    }>
  >;

  // Application fee settings
  applicationFeeSettings: ApplicationFeeSettings;

  // Wallet sequence settings
  walletSequenceSettings: WalletSequenceSettings;

  // Razorpay Route — optional, only present once an admin starts onboarding.
  razorpayRoute?: RazorpayRouteSettings;

  createdAt: Date;
  updatedAt: Date;
}

const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [
  {
    code: 'CASH',
    name: 'Cash',
    type: 'cash',
    isEnabled: true,
    requiresReference: false,
    requiresBankDetails: false,
    order: 1,
  },
  {
    code: 'CHEQUE',
    name: 'Cheque',
    type: 'cheque',
    isEnabled: true,
    requiresReference: true,
    requiresBankDetails: true,
    order: 2,
  },
  {
    code: 'UPI',
    name: 'UPI',
    type: 'upi',
    isEnabled: true,
    requiresReference: true,
    requiresBankDetails: false,
    order: 3,
  },
  {
    code: 'CARD',
    name: 'Credit/Debit Card',
    type: 'card',
    isEnabled: true,
    requiresReference: true,
    requiresBankDetails: false,
    processingFee: 2,
    processingFeeType: 'percentage',
    order: 4,
  },
  {
    code: 'BANK_TRANSFER',
    name: 'Bank Transfer / NEFT / RTGS',
    type: 'bank_transfer',
    isEnabled: true,
    requiresReference: true,
    requiresBankDetails: true,
    order: 5,
  },
  {
    code: 'DD',
    name: 'Demand Draft',
    type: 'dd',
    isEnabled: true,
    requiresReference: true,
    requiresBankDetails: true,
    order: 6,
  },
  {
    code: 'ONLINE',
    name: 'Online Payment Gateway',
    type: 'online',
    isEnabled: false,
    requiresReference: true,
    requiresBankDetails: false,
    processingFee: 2,
    processingFeeType: 'percentage',
    order: 7,
  },
];

const DEFAULT_RECEIPT_SETTINGS = {
  prefix: 'RCP',
  padding: 6,
  includeYear: true,
  yearFormat: '2' as const,
  showQRCode: true,
  footerText: 'Thank you for your payment. This is a computer-generated receipt.',
  duplicateCopies: 2,
};

const DEFAULT_CONCESSION_SETTINGS = {
  maxPercentage: 100,
  maxAmount: 0,
  requiresApproval: true,
  approvalThreshold: 10000,
  eligibleCategories: ['SC', 'ST', 'OBC', 'EWS', 'Minority', 'Staff Ward', 'Sibling', 'Merit'],
  allowMultipleConcessions: true,
  allowedReasons: [
    'Economic hardship',
    'Merit-based scholarship',
    'Staff ward discount',
    'Sibling discount',
    'Early bird discount',
    'Loyalty discount',
  ],
};

const DEFAULT_CANCELLATION_SETTINGS = {
  allowedWithinDays: 30,
  requiresApproval: true,
  approvalRoles: ['BRANCH_ADMIN', 'FINANCE_HEAD'],
  allowPartialCancellation: true,
  refundDeductionPercentage: 0,
  refundDeductionFixed: 0,
};

const DEFAULT_ORG_FEE_SETTINGS = {
  defaultDueDay: 10,
  penaltyStartAfterDays: 15,
  penaltyType: 'percentage' as const,
  penaltyValue: 2,
  maxPenaltyCap: 5000,
  reminderBeforeDays: [7, 3, 1],
  autoLockAfterDueDays: 90,
};

const DEFAULT_APPLICATION_FEE_SETTINGS: ApplicationFeeSettings = {
  isEnabled: false,
  amount: 0,
  feeType: 'fixed',
  variableAmounts: [],
  isRefundable: false,
  refundPercentage: 0,
  paymentModes: ['CASH', 'UPI', 'CARD'],
  adjustInFee: false,
  adjustmentComponent: undefined,
};

const DEFAULT_WALLET_SEQUENCE_SETTINGS: WalletSequenceSettings = {
  isEnabled: false,
  deductionOrder: [],
  autoDeductOnPayment: false,
  minBalanceRequired: 0,
  maxDeductionPercentage: 100,
};

const DEFAULT_MANDATORY_FIELDS: Record<
  string,
  Array<{
    fieldName: string;
    label: string;
    required: boolean;
    type: 'text' | 'date' | 'select' | 'number';
    options?: string[];
  }>
> = {
  CHEQUE: [
    { fieldName: 'chequeNumber', label: 'Cheque Number', required: true, type: 'text' },
    { fieldName: 'chequeDate', label: 'Cheque Date', required: true, type: 'date' },
    { fieldName: 'bankName', label: 'Bank Name', required: true, type: 'text' },
    { fieldName: 'branchName', label: 'Branch Name', required: false, type: 'text' },
  ],
  DD: [
    { fieldName: 'ddNumber', label: 'DD Number', required: true, type: 'text' },
    { fieldName: 'ddDate', label: 'DD Date', required: true, type: 'date' },
    { fieldName: 'bankName', label: 'Issuing Bank', required: true, type: 'text' },
  ],
  BANK_TRANSFER: [
    { fieldName: 'transactionId', label: 'Transaction ID', required: true, type: 'text' },
    { fieldName: 'transferDate', label: 'Transfer Date', required: true, type: 'date' },
    { fieldName: 'fromBank', label: 'From Bank', required: false, type: 'text' },
  ],
  UPI: [
    { fieldName: 'upiTransactionId', label: 'UPI Transaction ID', required: true, type: 'text' },
    {
      fieldName: 'upiApp',
      label: 'UPI App',
      required: false,
      type: 'select',
      options: ['PhonePe', 'GPay', 'Paytm', 'BHIM', 'Other'],
    },
  ],
  CARD: [
    { fieldName: 'transactionId', label: 'Transaction ID', required: true, type: 'text' },
    { fieldName: 'last4Digits', label: 'Last 4 Digits', required: false, type: 'text' },
    {
      fieldName: 'cardType',
      label: 'Card Type',
      required: false,
      type: 'select',
      options: ['Visa', 'Mastercard', 'Rupay', 'Amex'],
    },
  ],
};

class FinanceSettingsService {
  async getSettings(tenantId: string, branchId: string) {
    // Verify branch exists and belongs to tenant
    const branch = await collections.branches.findOne({
      _id: new ObjectId(branchId),
      tenantId: new ObjectId(tenantId),
    });

    if (!branch) {
      throw new ApiError('BRANCH_NOT_FOUND', 'Branch not found', 404);
    }

    let settings = (await collections.financeSettings.findOne({
      branchId: new ObjectId(branchId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<FinanceSettingsDocument> | null;

    // If no settings exist, create default settings
    if (!settings) {
      const now = new Date();
      const newSettings = {
        _id: new ObjectId(),
        branchId: new ObjectId(branchId),
        tenantId: new ObjectId(tenantId),
        bankAccounts: [],
        paymentMethods: DEFAULT_PAYMENT_METHODS,
        receiptSettings: DEFAULT_RECEIPT_SETTINGS,
        concessionSettings: DEFAULT_CONCESSION_SETTINGS,
        cancellationSettings: DEFAULT_CANCELLATION_SETTINGS,
        orgFeeSettings: DEFAULT_ORG_FEE_SETTINGS,
        walletCategories: [],
        mandatoryFields: DEFAULT_MANDATORY_FIELDS,
        applicationFeeSettings: DEFAULT_APPLICATION_FEE_SETTINGS,
        walletSequenceSettings: DEFAULT_WALLET_SEQUENCE_SETTINGS,
        createdAt: now,
        updatedAt: now,
      } as FinanceSettingsDocument;

      await collections.financeSettings.insertOne(newSettings);
      settings = newSettings as WithId<FinanceSettingsDocument>;
    }

    return this.formatSettings(settings);
  }

  async updateSettings(
    tenantId: string,
    branchId: string,
    data: Partial<{
      receiptSettings: Partial<FinanceSettingsDocument['receiptSettings']>;
      concessionSettings: Partial<FinanceSettingsDocument['concessionSettings']>;
      cancellationSettings: Partial<FinanceSettingsDocument['cancellationSettings']>;
      orgFeeSettings: Partial<FinanceSettingsDocument['orgFeeSettings']>;
    }>,
    updatedBy: string
  ) {
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    // Build update object with dot notation for nested fields
    if (data.receiptSettings) {
      Object.entries(data.receiptSettings).forEach(([key, value]) => {
        if (value !== undefined) {
          updateData[`receiptSettings.${key}`] = value;
        }
      });
    }

    if (data.concessionSettings) {
      Object.entries(data.concessionSettings).forEach(([key, value]) => {
        if (value !== undefined) {
          updateData[`concessionSettings.${key}`] = value;
        }
      });
    }

    if (data.cancellationSettings) {
      Object.entries(data.cancellationSettings).forEach(([key, value]) => {
        if (value !== undefined) {
          updateData[`cancellationSettings.${key}`] = value;
        }
      });
    }

    if (data.orgFeeSettings) {
      Object.entries(data.orgFeeSettings).forEach(([key, value]) => {
        if (value !== undefined) {
          updateData[`orgFeeSettings.${key}`] = value;
        }
      });
    }

    const result = await collections.financeSettings.findOneAndUpdate(
      {
        branchId: new ObjectId(branchId),
        tenantId: new ObjectId(tenantId),
      },
      {
        $set: updateData,
        $setOnInsert: {
          branchId: new ObjectId(branchId),
          tenantId: new ObjectId(tenantId),
          bankAccounts: [],
          paymentMethods: DEFAULT_PAYMENT_METHODS,
          receiptSettings: DEFAULT_RECEIPT_SETTINGS,
          concessionSettings: DEFAULT_CONCESSION_SETTINGS,
          cancellationSettings: DEFAULT_CANCELLATION_SETTINGS,
          orgFeeSettings: DEFAULT_ORG_FEE_SETTINGS,
          walletCategories: [],
          mandatoryFields: DEFAULT_MANDATORY_FIELDS,
          applicationFeeSettings: DEFAULT_APPLICATION_FEE_SETTINGS,
          walletSequenceSettings: DEFAULT_WALLET_SEQUENCE_SETTINGS,
          createdAt: new Date(),
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    logger.info({ branchId, tenantId, updatedBy }, 'Finance settings updated');

    return this.formatSettings(result as unknown as WithId<FinanceSettingsDocument>);
  }

  // ============ Bank Account Methods ============
  async addBankAccount(
    tenantId: string,
    branchId: string,
    account: Omit<BankAccount, '_id'>,
    addedBy: string
  ) {
    const accountWithId = {
      ...account,
      _id: new ObjectId().toString(),
    };

    // If this is the default account, unset other defaults
    if (account.isDefault) {
      await collections.financeSettings.updateOne(
        { branchId: new ObjectId(branchId), tenantId: new ObjectId(tenantId) },
        { $set: { 'bankAccounts.$[].isDefault': false } }
      );
    }

    const result = await collections.financeSettings.findOneAndUpdate(
      { branchId: new ObjectId(branchId), tenantId: new ObjectId(tenantId) },
      {
        $push: { bankAccounts: accountWithId } as unknown,
        $set: { updatedAt: new Date() },
        $setOnInsert: {
          branchId: new ObjectId(branchId),
          tenantId: new ObjectId(tenantId),
          paymentMethods: DEFAULT_PAYMENT_METHODS,
          receiptSettings: DEFAULT_RECEIPT_SETTINGS,
          concessionSettings: DEFAULT_CONCESSION_SETTINGS,
          cancellationSettings: DEFAULT_CANCELLATION_SETTINGS,
          orgFeeSettings: DEFAULT_ORG_FEE_SETTINGS,
          walletCategories: [],
          mandatoryFields: DEFAULT_MANDATORY_FIELDS,
          applicationFeeSettings: DEFAULT_APPLICATION_FEE_SETTINGS,
          walletSequenceSettings: DEFAULT_WALLET_SEQUENCE_SETTINGS,
          createdAt: new Date(),
        },
      } as Document,
      { upsert: true, returnDocument: 'after' }
    );

    logger.info(
      { branchId, tenantId, accountName: account.accountName, addedBy },
      'Bank account added'
    );

    return this.formatSettings(result as unknown as WithId<FinanceSettingsDocument>);
  }

  async updateBankAccount(
    tenantId: string,
    branchId: string,
    accountId: string,
    data: Partial<BankAccount>,
    updatedBy: string
  ) {
    const updateFields: Record<string, unknown> = { updatedAt: new Date() };

    if (data.accountName !== undefined)
      updateFields['bankAccounts.$.accountName'] = data.accountName;
    if (data.accountNumber !== undefined)
      updateFields['bankAccounts.$.accountNumber'] = data.accountNumber;
    if (data.bankName !== undefined) updateFields['bankAccounts.$.bankName'] = data.bankName;
    if (data.branchName !== undefined) updateFields['bankAccounts.$.branchName'] = data.branchName;
    if (data.ifscCode !== undefined) updateFields['bankAccounts.$.ifscCode'] = data.ifscCode;
    if (data.accountType !== undefined)
      updateFields['bankAccounts.$.accountType'] = data.accountType;
    if (data.isActive !== undefined) updateFields['bankAccounts.$.isActive'] = data.isActive;

    // Handle isDefault specially
    if (data.isDefault === true) {
      // Unset other defaults first
      await collections.financeSettings.updateOne(
        { branchId: new ObjectId(branchId), tenantId: new ObjectId(tenantId) },
        { $set: { 'bankAccounts.$[].isDefault': false } }
      );
      updateFields['bankAccounts.$.isDefault'] = true;
    }

    const result = await collections.financeSettings.findOneAndUpdate(
      {
        branchId: new ObjectId(branchId),
        tenantId: new ObjectId(tenantId),
        'bankAccounts._id': accountId,
      },
      { $set: updateFields },
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new ApiError('BANK_ACCOUNT_NOT_FOUND', 'Bank account not found', 404);
    }

    logger.info({ branchId, tenantId, accountId, updatedBy }, 'Bank account updated');

    return this.formatSettings(result as unknown as WithId<FinanceSettingsDocument>);
  }

  async deleteBankAccount(
    tenantId: string,
    branchId: string,
    accountId: string,
    deletedBy: string
  ) {
    const result = await collections.financeSettings.findOneAndUpdate(
      { branchId: new ObjectId(branchId), tenantId: new ObjectId(tenantId) },
      {
        $pull: { bankAccounts: { _id: accountId } } as unknown,
        $set: { updatedAt: new Date() },
      } as Document,
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new ApiError('SETTINGS_NOT_FOUND', 'Finance settings not found', 404);
    }

    logger.info({ branchId, tenantId, accountId, deletedBy }, 'Bank account deleted');

    return this.formatSettings(result as unknown as WithId<FinanceSettingsDocument>);
  }

  // ============ Payment Method Methods ============
  async updatePaymentMethod(
    tenantId: string,
    branchId: string,
    methodCode: string,
    data: Partial<PaymentMethod>,
    updatedBy: string
  ) {
    const updateFields: Record<string, unknown> = { updatedAt: new Date() };

    if (data.name !== undefined) updateFields['paymentMethods.$.name'] = data.name;
    if (data.isEnabled !== undefined) updateFields['paymentMethods.$.isEnabled'] = data.isEnabled;
    if (data.requiresReference !== undefined)
      updateFields['paymentMethods.$.requiresReference'] = data.requiresReference;
    if (data.requiresBankDetails !== undefined)
      updateFields['paymentMethods.$.requiresBankDetails'] = data.requiresBankDetails;
    if (data.processingFee !== undefined)
      updateFields['paymentMethods.$.processingFee'] = data.processingFee;
    if (data.processingFeeType !== undefined)
      updateFields['paymentMethods.$.processingFeeType'] = data.processingFeeType;
    if (data.order !== undefined) updateFields['paymentMethods.$.order'] = data.order;

    const result = await collections.financeSettings.findOneAndUpdate(
      {
        branchId: new ObjectId(branchId),
        tenantId: new ObjectId(tenantId),
        'paymentMethods.code': methodCode,
      },
      { $set: updateFields },
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new ApiError('PAYMENT_METHOD_NOT_FOUND', 'Payment method not found', 404);
    }

    logger.info({ branchId, tenantId, methodCode, updatedBy }, 'Payment method updated');

    return this.formatSettings(result as unknown as WithId<FinanceSettingsDocument>);
  }

  // ============ Wallet Category Methods ============
  async addWalletCategory(
    tenantId: string,
    branchId: string,
    category: { code: string; name: string; description?: string },
    addedBy: string
  ) {
    const result = await collections.financeSettings.findOneAndUpdate(
      { branchId: new ObjectId(branchId), tenantId: new ObjectId(tenantId) },
      {
        $push: {
          walletCategories: {
            ...category,
            isActive: true,
          },
        } as unknown,
        $set: { updatedAt: new Date() },
      } as Document,
      { returnDocument: 'after' }
    );

    logger.info({ branchId, tenantId, category: category.code, addedBy }, 'Wallet category added');

    return this.formatSettings(result as unknown as WithId<FinanceSettingsDocument>);
  }

  async updateMandatoryFields(
    tenantId: string,
    branchId: string,
    methodCode: string,
    fields: FinanceSettingsDocument['mandatoryFields'][string],
    updatedBy: string
  ) {
    const result = await collections.financeSettings.findOneAndUpdate(
      { branchId: new ObjectId(branchId), tenantId: new ObjectId(tenantId) },
      {
        $set: {
          [`mandatoryFields.${methodCode}`]: fields,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          branchId: new ObjectId(branchId),
          tenantId: new ObjectId(tenantId),
          bankAccounts: [],
          paymentMethods: DEFAULT_PAYMENT_METHODS,
          receiptSettings: DEFAULT_RECEIPT_SETTINGS,
          concessionSettings: DEFAULT_CONCESSION_SETTINGS,
          cancellationSettings: DEFAULT_CANCELLATION_SETTINGS,
          orgFeeSettings: DEFAULT_ORG_FEE_SETTINGS,
          walletCategories: [],
          mandatoryFields: DEFAULT_MANDATORY_FIELDS,
          applicationFeeSettings: DEFAULT_APPLICATION_FEE_SETTINGS,
          walletSequenceSettings: DEFAULT_WALLET_SEQUENCE_SETTINGS,
          createdAt: new Date(),
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    logger.info({ branchId, tenantId, methodCode, updatedBy }, 'Mandatory fields updated');

    return this.formatSettings(result as unknown as WithId<FinanceSettingsDocument>);
  }

  // ============ Application Fee Settings Methods ============
  async updateApplicationFeeSettings(
    tenantId: string,
    branchId: string,
    data: Partial<ApplicationFeeSettings>,
    updatedBy: string
  ) {
    const updateFields: Record<string, unknown> = { updatedAt: new Date() };

    if (data.isEnabled !== undefined)
      updateFields['applicationFeeSettings.isEnabled'] = data.isEnabled;
    if (data.amount !== undefined) updateFields['applicationFeeSettings.amount'] = data.amount;
    if (data.feeType !== undefined) updateFields['applicationFeeSettings.feeType'] = data.feeType;
    if (data.variableAmounts !== undefined)
      updateFields['applicationFeeSettings.variableAmounts'] = data.variableAmounts;
    if (data.isRefundable !== undefined)
      updateFields['applicationFeeSettings.isRefundable'] = data.isRefundable;
    if (data.refundPercentage !== undefined)
      updateFields['applicationFeeSettings.refundPercentage'] = data.refundPercentage;
    if (data.paymentModes !== undefined)
      updateFields['applicationFeeSettings.paymentModes'] = data.paymentModes;
    if (data.adjustInFee !== undefined)
      updateFields['applicationFeeSettings.adjustInFee'] = data.adjustInFee;
    if (data.adjustmentComponent !== undefined)
      updateFields['applicationFeeSettings.adjustmentComponent'] = data.adjustmentComponent;

    const result = await collections.financeSettings.findOneAndUpdate(
      { branchId: new ObjectId(branchId), tenantId: new ObjectId(tenantId) },
      {
        $set: updateFields,
        $setOnInsert: {
          branchId: new ObjectId(branchId),
          tenantId: new ObjectId(tenantId),
          bankAccounts: [],
          paymentMethods: DEFAULT_PAYMENT_METHODS,
          receiptSettings: DEFAULT_RECEIPT_SETTINGS,
          concessionSettings: DEFAULT_CONCESSION_SETTINGS,
          cancellationSettings: DEFAULT_CANCELLATION_SETTINGS,
          orgFeeSettings: DEFAULT_ORG_FEE_SETTINGS,
          walletCategories: [],
          mandatoryFields: DEFAULT_MANDATORY_FIELDS,
          applicationFeeSettings: DEFAULT_APPLICATION_FEE_SETTINGS,
          walletSequenceSettings: DEFAULT_WALLET_SEQUENCE_SETTINGS,
          createdAt: new Date(),
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    logger.info({ branchId, tenantId, updatedBy }, 'Application fee settings updated');

    return this.formatSettings(result as unknown as WithId<FinanceSettingsDocument>);
  }

  // ============ Wallet Sequence Settings Methods ============
  async updateWalletSequenceSettings(
    tenantId: string,
    branchId: string,
    data: Partial<WalletSequenceSettings>,
    updatedBy: string
  ) {
    const updateFields: Record<string, unknown> = { updatedAt: new Date() };

    if (data.isEnabled !== undefined)
      updateFields['walletSequenceSettings.isEnabled'] = data.isEnabled;
    if (data.deductionOrder !== undefined)
      updateFields['walletSequenceSettings.deductionOrder'] = data.deductionOrder;
    if (data.autoDeductOnPayment !== undefined)
      updateFields['walletSequenceSettings.autoDeductOnPayment'] = data.autoDeductOnPayment;
    if (data.minBalanceRequired !== undefined)
      updateFields['walletSequenceSettings.minBalanceRequired'] = data.minBalanceRequired;
    if (data.maxDeductionPercentage !== undefined)
      updateFields['walletSequenceSettings.maxDeductionPercentage'] = data.maxDeductionPercentage;

    const result = await collections.financeSettings.findOneAndUpdate(
      { branchId: new ObjectId(branchId), tenantId: new ObjectId(tenantId) },
      {
        $set: updateFields,
        $setOnInsert: {
          branchId: new ObjectId(branchId),
          tenantId: new ObjectId(tenantId),
          bankAccounts: [],
          paymentMethods: DEFAULT_PAYMENT_METHODS,
          receiptSettings: DEFAULT_RECEIPT_SETTINGS,
          concessionSettings: DEFAULT_CONCESSION_SETTINGS,
          cancellationSettings: DEFAULT_CANCELLATION_SETTINGS,
          orgFeeSettings: DEFAULT_ORG_FEE_SETTINGS,
          walletCategories: [],
          mandatoryFields: DEFAULT_MANDATORY_FIELDS,
          applicationFeeSettings: DEFAULT_APPLICATION_FEE_SETTINGS,
          walletSequenceSettings: DEFAULT_WALLET_SEQUENCE_SETTINGS,
          createdAt: new Date(),
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    logger.info({ branchId, tenantId, updatedBy }, 'Wallet sequence settings updated');

    return this.formatSettings(result as unknown as WithId<FinanceSettingsDocument>);
  }

  private formatSettings(settings: WithId<FinanceSettingsDocument>) {
    return {
      _id: settings._id.toString(),
      branchId: settings.branchId.toString(),
      tenantId: settings.tenantId.toString(),
      bankAccounts: settings.bankAccounts || [],
      paymentMethods: settings.paymentMethods || DEFAULT_PAYMENT_METHODS,
      receiptSettings: settings.receiptSettings || DEFAULT_RECEIPT_SETTINGS,
      concessionSettings: settings.concessionSettings || DEFAULT_CONCESSION_SETTINGS,
      cancellationSettings: settings.cancellationSettings || DEFAULT_CANCELLATION_SETTINGS,
      orgFeeSettings: settings.orgFeeSettings || DEFAULT_ORG_FEE_SETTINGS,
      walletCategories: settings.walletCategories || [],
      mandatoryFields: settings.mandatoryFields || DEFAULT_MANDATORY_FIELDS,
      applicationFeeSettings: settings.applicationFeeSettings || DEFAULT_APPLICATION_FEE_SETTINGS,
      walletSequenceSettings: settings.walletSequenceSettings || DEFAULT_WALLET_SEQUENCE_SETTINGS,
      razorpayRoute: settings.razorpayRoute ? maskRazorpayRoute(settings.razorpayRoute) : null,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };
  }
}

/**
 * Mask sensitive bank/PAN bits on the way out so we never leak the full
 * account number or PAN in API responses. Last 4 of account, full IFSC (it's
 * public anyway), first 2 + last 1 of PAN — enough for the admin UI to
 * recognise the record without exposing it.
 */
function maskRazorpayRoute(rr: RazorpayRouteSettings) {
  const maskAccount = (s: string) =>
    s && s.length > 4 ? `${'*'.repeat(s.length - 4)}${s.slice(-4)}` : s;
  const maskPan = (s: string) =>
    s && s.length >= 5 ? `${s.slice(0, 2)}${'*'.repeat(s.length - 3)}${s.slice(-1)}` : s;
  return {
    status: rr.status,
    linkedAccountId: rr.linkedAccountId ?? null,
    legal: {
      entityName: rr.legal.entityName,
      businessType: rr.legal.businessType,
      panNumber: maskPan(rr.legal.panNumber),
      gstNumber: rr.legal.gstNumber ?? null,
    },
    contact: rr.contact,
    address: rr.address,
    bank: {
      accountNumber: maskAccount(rr.bank.accountNumber),
      ifsc: rr.bank.ifsc,
      beneficiaryName: rr.bank.beneficiaryName,
    },
    needsClarification: rr.needsClarification ?? null,
    lastSyncedAt: rr.lastSyncedAt ?? null,
    createdAt: rr.createdAt,
    updatedAt: rr.updatedAt,
  };
}

export type { FinanceSettingsDocument };

export const financeSettingsService = new FinanceSettingsService();

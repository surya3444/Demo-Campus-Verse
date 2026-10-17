import { ObjectId, WithId, Document, Filter } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';

export type WalletTransactionType = 'credit' | 'debit';
export type WalletTransactionCategory =
  | 'top_up'
  | 'fee_payment'
  | 'refund'
  | 'adjustment'
  | 'transfer_in'
  | 'transfer_out'
  | 'reversal';

interface WalletDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  studentId: ObjectId;
  walletNumber: string;
  balance: number;
  totalCredits: number;
  totalDebits: number;
  isActive: boolean;
  lastTransactionDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface WalletTransactionDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  walletId: ObjectId;
  studentId: ObjectId;
  transactionNumber: string;
  type: WalletTransactionType;
  category: WalletTransactionCategory;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceId?: ObjectId; // For fee payment, refund, etc.
  referenceType?: string; // 'fee_transaction', 'concession', etc.
  description: string;
  paymentMode?: string;
  paymentDetails?: Record<string, unknown>;
  performedBy: ObjectId;
  createdAt: Date;
}

export interface CreateWalletInput {
  studentId: string;
}

export interface TopUpWalletInput {
  amount: number;
  paymentMode: string;
  paymentDetails?: Record<string, unknown>;
  description?: string;
}

export interface DebitWalletInput {
  amount: number;
  category: WalletTransactionCategory;
  referenceId?: string;
  referenceType?: string;
  description: string;
}

export interface WalletListParams {
  page?: number;
  limit?: number;
  studentId?: string;
  hasBalance?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface WalletTransactionListParams {
  page?: number;
  limit?: number;
  type?: WalletTransactionType;
  category?: WalletTransactionCategory;
  fromDate?: string;
  toDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

class WalletService {
  async create(tenantId: string, branchId: string, data: CreateWalletInput, _createdBy: string) {
    // Check if wallet already exists for student
    const existing = await collections.wallets.findOne({
      tenantId: new ObjectId(tenantId),
      studentId: new ObjectId(data.studentId),
    });

    if (existing) {
      throw new ApiError('WALLET_EXISTS', 'Wallet already exists for this student', 409);
    }

    // Verify student exists
    const student = await collections.students.findOne({
      _id: new ObjectId(data.studentId),
      tenantId: new ObjectId(tenantId),
    });

    if (!student) {
      throw new ApiError('STUDENT_NOT_FOUND', 'Student not found', 404);
    }

    const walletId = new ObjectId();
    const now = new Date();
    const walletNumber = await this.generateWalletNumber(tenantId, branchId);

    const wallet: Omit<WalletDocument, '_id'> & { _id: ObjectId } = {
      _id: walletId,
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      studentId: new ObjectId(data.studentId),
      walletNumber,
      balance: 0,
      totalCredits: 0,
      totalDebits: 0,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    await collections.wallets.insertOne(wallet);

    logger.info(
      { walletId: walletId.toString(), studentId: data.studentId, walletNumber },
      'Wallet created'
    );

    return this.formatWallet(wallet as WithId<WalletDocument>);
  }

  async findByStudentId(tenantId: string, studentId: string) {
    const wallet = (await collections.wallets.findOne({
      tenantId: new ObjectId(tenantId),
      studentId: new ObjectId(studentId),
    })) as WithId<WalletDocument> | null;

    if (!wallet) {
      return null;
    }

    return this.formatWallet(wallet);
  }

  async getOrCreate(tenantId: string, branchId: string, studentId: string, createdBy: string) {
    let wallet = await this.findByStudentId(tenantId, studentId);

    if (!wallet) {
      wallet = await this.create(tenantId, branchId, { studentId }, createdBy);
    }

    return wallet;
  }

  async findById(tenantId: string, walletId: string) {
    const wallet = (await collections.wallets.findOne({
      _id: new ObjectId(walletId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<WalletDocument> | null;

    if (!wallet) {
      throw new ApiError('WALLET_NOT_FOUND', 'Wallet not found', 404);
    }

    return this.formatWallet(wallet);
  }

  async findAll(tenantId: string, branchId: string, params: WalletListParams = {}) {
    const {
      page = 1,
      limit = 20,
      studentId,
      hasBalance,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    if (studentId) {
      filter.studentId = new ObjectId(studentId);
    }

    if (hasBalance === true) {
      filter.balance = { $gt: 0 };
    } else if (hasBalance === false) {
      filter.balance = 0;
    }

    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const pipeline = [
      { $match: filter },
      {
        $lookup: {
          from: 'students',
          localField: 'studentId',
          foreignField: '_id',
          as: 'student',
        },
      },
      { $unwind: { path: '$student', preserveNullAndEmptyArrays: true } },
      { $sort: { [sortBy]: sortDirection, _id: sortDirection } },
      { $skip: skip },
      { $limit: limit },
    ];

    const [wallets, totalResult] = await Promise.all([
      collections.wallets.aggregate(pipeline).toArray(),
      collections.wallets.countDocuments(filter),
    ]);

    return {
      data: wallets.map((w) => this.formatWalletWithStudent(w)),
      meta: {
        page,
        limit,
        total: totalResult,
        totalPages: Math.ceil(totalResult / limit),
        hasMore: skip + wallets.length < totalResult,
      },
    };
  }

  async topUp(
    tenantId: string,
    branchId: string,
    walletId: string,
    data: TopUpWalletInput,
    performedBy: string
  ) {
    const wallet = (await collections.wallets.findOne({
      _id: new ObjectId(walletId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<WalletDocument> | null;

    if (!wallet) {
      throw new ApiError('WALLET_NOT_FOUND', 'Wallet not found', 404);
    }

    if (!wallet.isActive) {
      throw new ApiError('WALLET_INACTIVE', 'Wallet is not active', 400);
    }

    if (data.amount <= 0) {
      throw new ApiError('INVALID_AMOUNT', 'Amount must be greater than zero', 400);
    }

    const now = new Date();
    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore + data.amount;

    // Create transaction record
    const transactionId = new ObjectId();
    const transactionNumber = await this.generateTransactionNumber(tenantId, branchId);

    const transaction: Omit<WalletTransactionDocument, '_id'> & { _id: ObjectId } = {
      _id: transactionId,
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      walletId: wallet._id,
      studentId: wallet.studentId,
      transactionNumber,
      type: 'credit',
      category: 'top_up',
      amount: data.amount,
      balanceBefore,
      balanceAfter,
      description: data.description || 'Wallet top-up',
      paymentMode: data.paymentMode,
      paymentDetails: data.paymentDetails,
      performedBy: new ObjectId(performedBy),
      createdAt: now,
    };

    await collections.walletTransactions.insertOne(transaction);

    // Update wallet balance
    await collections.wallets.updateOne(
      { _id: wallet._id },
      {
        $set: {
          balance: balanceAfter,
          lastTransactionDate: now,
          updatedAt: now,
        },
        $inc: {
          totalCredits: data.amount,
        },
      }
    );

    logger.info(
      { walletId, amount: data.amount, transactionNumber, performedBy },
      'Wallet topped up'
    );

    return {
      wallet: await this.findById(tenantId, walletId),
      transaction: this.formatTransaction(transaction as WithId<WalletTransactionDocument>),
    };
  }

  async debit(
    tenantId: string,
    branchId: string,
    walletId: string,
    data: DebitWalletInput,
    performedBy: string
  ) {
    const wallet = (await collections.wallets.findOne({
      _id: new ObjectId(walletId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<WalletDocument> | null;

    if (!wallet) {
      throw new ApiError('WALLET_NOT_FOUND', 'Wallet not found', 404);
    }

    if (!wallet.isActive) {
      throw new ApiError('WALLET_INACTIVE', 'Wallet is not active', 400);
    }

    if (data.amount <= 0) {
      throw new ApiError('INVALID_AMOUNT', 'Amount must be greater than zero', 400);
    }

    if (data.amount > wallet.balance) {
      throw new ApiError('INSUFFICIENT_BALANCE', 'Insufficient wallet balance', 400);
    }

    const now = new Date();
    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore - data.amount;

    // Create transaction record
    const transactionId = new ObjectId();
    const transactionNumber = await this.generateTransactionNumber(tenantId, branchId);

    const transaction: Omit<WalletTransactionDocument, '_id'> & { _id: ObjectId } = {
      _id: transactionId,
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      walletId: wallet._id,
      studentId: wallet.studentId,
      transactionNumber,
      type: 'debit',
      category: data.category,
      amount: data.amount,
      balanceBefore,
      balanceAfter,
      referenceId: data.referenceId ? new ObjectId(data.referenceId) : undefined,
      referenceType: data.referenceType,
      description: data.description,
      performedBy: new ObjectId(performedBy),
      createdAt: now,
    };

    await collections.walletTransactions.insertOne(transaction);

    // Update wallet balance
    await collections.wallets.updateOne(
      { _id: wallet._id },
      {
        $set: {
          balance: balanceAfter,
          lastTransactionDate: now,
          updatedAt: now,
        },
        $inc: {
          totalDebits: data.amount,
        },
      }
    );

    logger.info(
      { walletId, amount: data.amount, category: data.category, transactionNumber, performedBy },
      'Wallet debited'
    );

    return {
      wallet: await this.findById(tenantId, walletId),
      transaction: this.formatTransaction(transaction as WithId<WalletTransactionDocument>),
    };
  }

  async credit(
    tenantId: string,
    branchId: string,
    walletId: string,
    amount: number,
    category: WalletTransactionCategory,
    description: string,
    performedBy: string,
    referenceId?: string,
    referenceType?: string
  ) {
    const wallet = (await collections.wallets.findOne({
      _id: new ObjectId(walletId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<WalletDocument> | null;

    if (!wallet) {
      throw new ApiError('WALLET_NOT_FOUND', 'Wallet not found', 404);
    }

    const now = new Date();
    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore + amount;

    const transactionId = new ObjectId();
    const transactionNumber = await this.generateTransactionNumber(tenantId, branchId);

    const transaction: Omit<WalletTransactionDocument, '_id'> & { _id: ObjectId } = {
      _id: transactionId,
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      walletId: wallet._id,
      studentId: wallet.studentId,
      transactionNumber,
      type: 'credit',
      category,
      amount,
      balanceBefore,
      balanceAfter,
      referenceId: referenceId ? new ObjectId(referenceId) : undefined,
      referenceType,
      description,
      performedBy: new ObjectId(performedBy),
      createdAt: now,
    };

    await collections.walletTransactions.insertOne(transaction);

    await collections.wallets.updateOne(
      { _id: wallet._id },
      {
        $set: {
          balance: balanceAfter,
          lastTransactionDate: now,
          updatedAt: now,
        },
        $inc: {
          totalCredits: amount,
        },
      }
    );

    logger.info({ walletId, amount, category, transactionNumber, performedBy }, 'Wallet credited');

    return {
      wallet: await this.findById(tenantId, walletId),
      transaction: this.formatTransaction(transaction as WithId<WalletTransactionDocument>),
    };
  }

  async getTransactions(
    tenantId: string,
    walletId: string,
    params: WalletTransactionListParams = {}
  ) {
    const {
      page = 1,
      limit = 20,
      type,
      category,
      fromDate,
      toDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      walletId: new ObjectId(walletId),
    };

    if (type) {
      filter.type = type;
    }

    if (category) {
      filter.category = category;
    }

    if (fromDate || toDate) {
      filter.createdAt = {};
      if (fromDate) {
        (filter.createdAt as Record<string, Date>).$gte = new Date(fromDate);
      }
      if (toDate) {
        (filter.createdAt as Record<string, Date>).$lte = new Date(toDate);
      }
    }

    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const [transactions, totalResult] = await Promise.all([
      collections.walletTransactions
        .find(filter)
        .sort({ [sortBy]: sortDirection, _id: sortDirection })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collections.walletTransactions.countDocuments(filter),
    ]);

    return {
      data: transactions.map((t) => this.formatTransaction(t as WithId<WalletTransactionDocument>)),
      meta: {
        page,
        limit,
        total: totalResult,
        totalPages: Math.ceil(totalResult / limit),
        hasMore: skip + transactions.length < totalResult,
      },
    };
  }

  async getStats(tenantId: string, branchId: string) {
    const pipeline = [
      {
        $match: {
          tenantId: new ObjectId(tenantId),
          branchId: new ObjectId(branchId),
        },
      },
      {
        $group: {
          _id: null,
          totalWallets: { $sum: 1 },
          activeWallets: { $sum: { $cond: ['$isActive', 1, 0] } },
          totalBalance: { $sum: '$balance' },
          walletsWithBalance: { $sum: { $cond: [{ $gt: ['$balance', 0] }, 1, 0] } },
          totalCredits: { $sum: '$totalCredits' },
          totalDebits: { $sum: '$totalDebits' },
        },
      },
    ];

    const results = await collections.wallets.aggregate(pipeline).toArray();

    return (
      results[0] || {
        totalWallets: 0,
        activeWallets: 0,
        totalBalance: 0,
        walletsWithBalance: 0,
        totalCredits: 0,
        totalDebits: 0,
      }
    );
  }

  async toggleStatus(tenantId: string, walletId: string, isActive: boolean, updatedBy: string) {
    const wallet = (await collections.wallets.findOne({
      _id: new ObjectId(walletId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<WalletDocument> | null;

    if (!wallet) {
      throw new ApiError('WALLET_NOT_FOUND', 'Wallet not found', 404);
    }

    await collections.wallets.updateOne(
      { _id: new ObjectId(walletId) },
      {
        $set: {
          isActive,
          updatedAt: new Date(),
        },
      }
    );

    logger.info({ walletId, isActive, updatedBy }, 'Wallet status updated');

    return this.findById(tenantId, walletId);
  }

  private async generateWalletNumber(tenantId: string, branchId: string): Promise<string> {
    const counter = await collections.counters.findOneAndUpdate(
      { tenantId: new ObjectId(tenantId), branchId: new ObjectId(branchId), type: 'wallet' },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: 'after' }
    );

    const number = counter?.value || 1;
    return `WLT${String(number).padStart(8, '0')}`;
  }

  private async generateTransactionNumber(tenantId: string, branchId: string): Promise<string> {
    const counter = await collections.counters.findOneAndUpdate(
      {
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        type: 'wallet_transaction',
      },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: 'after' }
    );

    const number = counter?.value || 1;
    return `WTX${String(number).padStart(10, '0')}`;
  }

  private formatWallet(wallet: WithId<WalletDocument>) {
    return {
      _id: wallet._id.toString(),
      tenantId: wallet.tenantId.toString(),
      branchId: wallet.branchId.toString(),
      studentId: wallet.studentId.toString(),
      walletNumber: wallet.walletNumber,
      balance: wallet.balance,
      totalCredits: wallet.totalCredits,
      totalDebits: wallet.totalDebits,
      isActive: wallet.isActive,
      lastTransactionDate: wallet.lastTransactionDate,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    };
  }

  private formatWalletWithStudent(wallet: Document) {
    return {
      _id: wallet._id.toString(),
      tenantId: wallet.tenantId.toString(),
      branchId: wallet.branchId.toString(),
      studentId: wallet.studentId.toString(),
      walletNumber: wallet.walletNumber,
      balance: wallet.balance,
      totalCredits: wallet.totalCredits,
      totalDebits: wallet.totalDebits,
      isActive: wallet.isActive,
      lastTransactionDate: wallet.lastTransactionDate,
      student: wallet.student
        ? {
            _id: wallet.student._id.toString(),
            admissionNumber: wallet.student.admissionNumber,
            displayName: wallet.student.displayName,
            className: wallet.student.currentEnrollment?.className,
            sectionName: wallet.student.currentEnrollment?.sectionName,
          }
        : null,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    };
  }

  private formatTransaction(transaction: WithId<WalletTransactionDocument>) {
    return {
      _id: transaction._id.toString(),
      tenantId: transaction.tenantId.toString(),
      branchId: transaction.branchId.toString(),
      walletId: transaction.walletId.toString(),
      studentId: transaction.studentId.toString(),
      transactionNumber: transaction.transactionNumber,
      type: transaction.type,
      category: transaction.category,
      amount: transaction.amount,
      balanceBefore: transaction.balanceBefore,
      balanceAfter: transaction.balanceAfter,
      referenceId: transaction.referenceId?.toString(),
      referenceType: transaction.referenceType,
      description: transaction.description,
      paymentMode: transaction.paymentMode,
      paymentDetails: transaction.paymentDetails,
      performedBy: transaction.performedBy.toString(),
      createdAt: transaction.createdAt,
    };
  }
}

export const walletService = new WalletService();

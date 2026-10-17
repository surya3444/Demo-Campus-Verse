import { resolveReceiptIssuer } from './receiptIssuer';
import { ObjectId, WithId, Document, Filter, UpdateFilter } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { generateReceiptNumber } from '../../utils/generators';
import { feeAssignmentService } from './feeAssignment.service';
import { razorpayService } from '../../services/razorpay.service';
import { razorpayRouteService } from './razorpayRoute.service';
import { approvalRequestService } from './approvalRequest.service';

interface PaymentDetails {
  referenceNumber?: string;
  bankName?: string;
  chequeNumber?: string;
  chequeDate?: Date;
  cardLast4?: string;
  upiId?: string;
}

interface TransactionComponent {
  componentCode: string;
  name: string;
  amount: number;
}

interface FeeTransactionDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  studentId: ObjectId;
  feeAssignmentId: ObjectId;
  receiptNumber: string;
  receiptDate: Date;
  paymentMode: 'cash' | 'card' | 'upi' | 'netbanking' | 'cheque' | 'dd' | 'wallet';
  paymentDetails?: PaymentDetails;
  components: TransactionComponent[];
  installmentNumbers: number[];
  feeAmount: number;
  fineAmount: number;
  adjustments: number;
  totalAmount: number;
  onlinePayment?: {
    gatewayOrderId?: string;
    gatewayPaymentId?: string;
    gatewaySignature?: string;
    status?: string;
    // Razorpay Route: when the branch has an activated linked account, the
    // order is created with a transfers[] block routing the captured amount
    // to that account. We mirror it here for reconciliation against the
    // transfer.processed / transfer.failed webhooks later.
    routedToLinkedAccountId?: string;
    routedAmount?: number; // in paise
    transferStatus?: 'pending' | 'processed' | 'failed';
    transferId?: string;
  };
  status: 'success' | 'pending' | 'failed' | 'cancelled' | 'refunded';
  remarks?: string;
  refund?: {
    refundId?: string;
    amount: number;
    reason: string;
    refundedAt: Date;
    refundedBy: ObjectId;
  };
  cancellation?: {
    reason: string;
    cancelledAt: Date;
    cancelledBy: ObjectId;
    approvedBy?: ObjectId;
  };
  collectedBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface CollectFeeInput {
  studentId: string;
  feeAssignmentId: string;
  paymentMode: 'cash' | 'card' | 'upi' | 'netbanking' | 'cheque' | 'dd' | 'wallet';
  paymentDetails?: PaymentDetails;
  components: TransactionComponent[];
  installmentNumbers: number[];
  feeAmount: number;
  fineAmount?: number;
  adjustments?: number;
  remarks?: string;
}

export interface TransactionListParams {
  page?: number;
  limit?: number;
  studentId?: string;
  classId?: string;
  sectionId?: string;
  paymentMode?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
  collectedBy?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface InitiateOnlinePaymentInput {
  studentId: string;
  feeAssignmentId: string;
  components: TransactionComponent[];
  installmentNumbers: number[];
  feeAmount: number;
  fineAmount?: number;
  adjustments?: number;
  remarks?: string;
}

export interface VerifyOnlinePaymentInput {
  orderId: string;
  paymentId: string;
  signature: string;
}

class FeeTransactionService {
  async collectFee(tenantId: string, branchId: string, data: CollectFeeInput, collectedBy: string) {
    // Verify fee assignment exists
    const assignment = await collections.feeAssignments.findOne({
      _id: new ObjectId(data.feeAssignmentId),
      tenantId: new ObjectId(tenantId),
    });

    if (!assignment) {
      throw new ApiError('FEE_ASSIGNMENT_NOT_FOUND', 'Fee assignment not found', 404);
    }

    // Verify student
    const student = await collections.students.findOne({
      _id: new ObjectId(data.studentId),
      tenantId: new ObjectId(tenantId),
    });

    if (!student) {
      throw new ApiError('STUDENT_NOT_FOUND', 'Student not found', 404);
    }

    const transactionId = new ObjectId();
    const now = new Date();

    const receiptNumber = await generateReceiptNumber(tenantId, branchId);

    const totalAmount = data.feeAmount + (data.fineAmount || 0) + (data.adjustments || 0);

    const transaction: Omit<FeeTransactionDocument, '_id'> & { _id: ObjectId } = {
      _id: transactionId,
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      studentId: new ObjectId(data.studentId),
      feeAssignmentId: new ObjectId(data.feeAssignmentId),
      receiptNumber,
      receiptDate: now,
      paymentMode: data.paymentMode,
      paymentDetails: data.paymentDetails,
      components: data.components,
      installmentNumbers: data.installmentNumbers,
      feeAmount: data.feeAmount,
      fineAmount: data.fineAmount || 0,
      adjustments: data.adjustments || 0,
      totalAmount,
      status: 'success',
      remarks: data.remarks,
      collectedBy: new ObjectId(collectedBy),
      createdAt: now,
      updatedAt: now,
    };

    await collections.feeTransactions.insertOne(transaction);

    // Update fee assignment
    await feeAssignmentService.updatePayment(
      tenantId,
      data.feeAssignmentId,
      totalAmount,
      data.installmentNumbers
    );

    logger.info(
      {
        transactionId: transactionId.toString(),
        receiptNumber,
        studentId: data.studentId,
        amount: totalAmount,
      },
      'Fee collected'
    );

    return {
      ...this.formatTransaction(transaction as WithId<FeeTransactionDocument>),
      // Who the receipt is from — the success screen shows this college's name and logo.
      issuer: await resolveReceiptIssuer(
        new ObjectId(tenantId),
        new ObjectId(branchId),
        new ObjectId(data.studentId)
      ),
    };
  }

  async findById(tenantId: string, transactionId: string) {
    const transaction = (await collections.feeTransactions.findOne({
      _id: new ObjectId(transactionId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<FeeTransactionDocument> | null;

    if (!transaction) {
      throw new ApiError('TRANSACTION_NOT_FOUND', 'Transaction not found', 404);
    }

    return this.formatTransaction(transaction);
  }

  async findByReceiptNumber(tenantId: string, branchId: string, receiptNumber: string) {
    const transaction = (await collections.feeTransactions.findOne({
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      receiptNumber,
    })) as WithId<FeeTransactionDocument> | null;

    if (!transaction) {
      throw new ApiError('TRANSACTION_NOT_FOUND', 'Transaction not found', 404);
    }

    return this.formatTransaction(transaction);
  }

  async findAll(tenantId: string, branchId: string, params: TransactionListParams = {}) {
    const {
      page = 1,
      limit = 20,
      studentId,
      classId,
      sectionId,
      paymentMode,
      status,
      fromDate,
      toDate,
      collectedBy,
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

    if (paymentMode) {
      filter.paymentMode = paymentMode;
    }

    if (status) {
      filter.status = status;
    }

    if (fromDate || toDate) {
      filter.receiptDate = {};
      if (fromDate) {
        (filter.receiptDate as Record<string, Date>).$gte = new Date(fromDate);
      }
      if (toDate) {
        const endOfDay = new Date(toDate);
        endOfDay.setHours(23, 59, 59, 999);
        (filter.receiptDate as Record<string, Date>).$lte = endOfDay;
      }
    }

    if (collectedBy) {
      filter.collectedBy = new ObjectId(collectedBy);
    }

    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    // Post-lookup filter for class/section (requires the student lookup)
    const studentMatch: Record<string, unknown> = {};
    if (classId) {
      studentMatch['student.currentEnrollment.classId'] = new ObjectId(classId);
    }
    if (sectionId) {
      studentMatch['student.currentEnrollment.sectionId'] = new ObjectId(sectionId);
    }
    const hasStudentMatch = Object.keys(studentMatch).length > 0;

    // Aggregate with student lookup
    const basePipeline: Document[] = [
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
    ];
    if (hasStudentMatch) {
      basePipeline.push({ $match: studentMatch });
    }

    const pipeline: Document[] = [
      ...basePipeline,
      { $sort: { [sortBy]: sortDirection, _id: sortDirection } },
      { $skip: skip },
      { $limit: limit },
    ];

    const countPipeline: Document[] = [...basePipeline, { $count: 'total' }];

    const [transactions, countResult] = await Promise.all([
      collections.feeTransactions.aggregate(pipeline).toArray(),
      hasStudentMatch
        ? collections.feeTransactions
            .aggregate<{ total: number }>(countPipeline)
            .toArray()
            .then((r) => r[0]?.total || 0)
        : collections.feeTransactions.countDocuments(filter),
    ]);

    const totalResult = typeof countResult === 'number' ? countResult : 0;

    return {
      data: transactions.map((t) => this.formatTransactionWithStudent(t)),
      meta: {
        page,
        limit,
        total: totalResult,
        totalPages: Math.ceil(totalResult / limit),
        hasMore: skip + transactions.length < totalResult,
      },
    };
  }

  async cancel(
    tenantId: string,
    branchId: string,
    transactionId: string,
    reason: string,
    cancelledBy: string,
    forceApproval = false
  ) {
    const transaction = (await collections.feeTransactions.findOne({
      _id: new ObjectId(transactionId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<FeeTransactionDocument> | null;

    if (!transaction) {
      throw new ApiError('TRANSACTION_NOT_FOUND', 'Transaction not found', 404);
    }

    if (transaction.status !== 'success') {
      throw new ApiError('CANNOT_CANCEL', 'Only successful transactions can be cancelled', 400);
    }

    // Check cancellation settings
    const settings = await collections.financeSettings.findOne({
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    });

    const cancellationSettings = settings?.cancellationSettings;

    // Check if within allowed days
    if (cancellationSettings?.allowedWithinDays) {
      const daysSinceTransaction = Math.floor(
        (Date.now() - new Date(transaction.receiptDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceTransaction > cancellationSettings.allowedWithinDays) {
        throw new ApiError(
          'CANCELLATION_WINDOW_EXPIRED',
          `Cancellation is only allowed within ${cancellationSettings.allowedWithinDays} days of transaction`,
          400
        );
      }
    }

    // Check if approval is required
    if (cancellationSettings?.requiresApproval && !forceApproval) {
      // Create approval request instead of processing directly
      const request = await approvalRequestService.create(
        tenantId,
        branchId,
        {
          type: 'cancellation',
          transactionId,
          reason,
        },
        cancelledBy
      );
      return {
        requiresApproval: true,
        approvalRequest: request,
        message: 'Cancellation request submitted for approval',
      };
    }

    // Process cancellation directly
    const now = new Date();

    await collections.feeTransactions.updateOne(
      { _id: new ObjectId(transactionId) },
      {
        $set: {
          status: 'cancelled',
          cancellation: {
            reason,
            cancelledAt: now,
            cancelledBy: new ObjectId(cancelledBy),
          },
          updatedAt: now,
        },
      }
    );

    // Reverse the payment in fee assignment
    const assignment = (await collections.feeAssignments.findOne({
      _id: transaction.feeAssignmentId,
    })) as WithId<Document> | null;

    if (assignment) {
      const newTotalPaid = (assignment.summary?.totalPaid || 0) - transaction.totalAmount;
      const newBalance = (assignment.summary?.netPayable || 0) - newTotalPaid;

      // Reverse installment payments
      const installments = (assignment.installments || []).map(
        (inst: { installmentNumber: number; paidAmount: number; totalDue: number }) => {
          if (transaction.installmentNumbers.includes(inst.installmentNumber)) {
            const reversedPaid = Math.max(
              0,
              inst.paidAmount - transaction.totalAmount / transaction.installmentNumbers.length
            );
            return {
              ...inst,
              paidAmount: reversedPaid,
              balance: inst.totalDue - reversedPaid,
              status:
                reversedPaid === 0 ? 'pending' : reversedPaid < inst.totalDue ? 'partial' : 'paid',
            };
          }
          return inst;
        }
      );

      await collections.feeAssignments.updateOne({ _id: transaction.feeAssignmentId }, {
        $set: {
          installments,
          'summary.totalPaid': newTotalPaid,
          'summary.balance': newBalance,
          status: newBalance > 0 ? 'active' : 'cleared',
          updatedAt: now,
        },
      } as unknown as UpdateFilter<Document>);
    }

    logger.info({ transactionId, reason, cancelledBy }, 'Transaction cancelled');

    return this.findById(tenantId, transactionId);
  }

  async refund(
    tenantId: string,
    branchId: string,
    transactionId: string,
    amount: number,
    reason: string,
    refundedBy: string,
    forceApproval = false
  ) {
    const transaction = (await collections.feeTransactions.findOne({
      _id: new ObjectId(transactionId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<FeeTransactionDocument> | null;

    if (!transaction) {
      throw new ApiError('TRANSACTION_NOT_FOUND', 'Transaction not found', 404);
    }

    if (transaction.status !== 'success') {
      throw new ApiError('CANNOT_REFUND', 'Only successful transactions can be refunded', 400);
    }

    if (amount > transaction.totalAmount) {
      throw new ApiError('INVALID_AMOUNT', 'Refund amount cannot exceed transaction amount', 400);
    }

    // Check cancellation settings (refund uses same approval settings)
    const settings = await collections.financeSettings.findOne({
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    });

    const cancellationSettings = settings?.cancellationSettings;

    // Check if approval is required for refunds
    if (cancellationSettings?.requiresApproval && !forceApproval) {
      // Create approval request instead of processing directly
      const request = await approvalRequestService.create(
        tenantId,
        branchId,
        {
          type: 'refund',
          transactionId,
          reason,
          refundAmount: amount,
        },
        refundedBy
      );
      return {
        requiresApproval: true,
        approvalRequest: request,
        message: 'Refund request submitted for approval',
      };
    }

    const now = new Date();

    await collections.feeTransactions.updateOne(
      { _id: new ObjectId(transactionId) },
      {
        $set: {
          status: 'refunded',
          refund: {
            amount,
            reason,
            refundedAt: now,
            refundedBy: new ObjectId(refundedBy),
          },
          updatedAt: now,
        },
      }
    );

    // Update fee assignment balance
    const assignment = (await collections.feeAssignments.findOne({
      _id: transaction.feeAssignmentId,
    })) as WithId<Document> | null;

    if (assignment) {
      const newTotalPaid = (assignment.summary?.totalPaid || 0) - amount;
      const newBalance = (assignment.summary?.netPayable || 0) - newTotalPaid;

      await collections.feeAssignments.updateOne({ _id: transaction.feeAssignmentId }, {
        $set: {
          'summary.totalPaid': newTotalPaid,
          'summary.balance': newBalance,
          status: newBalance > 0 ? 'active' : 'cleared',
          updatedAt: now,
        },
      } as unknown as UpdateFilter<Document>);
    }

    logger.info({ transactionId, amount, reason, refundedBy }, 'Transaction refunded');

    return this.findById(tenantId, transactionId);
  }

  async getDaySheet(tenantId: string, branchId: string, date: string) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const pipeline = [
      {
        $match: {
          tenantId: new ObjectId(tenantId),
          branchId: new ObjectId(branchId),
          receiptDate: { $gte: startOfDay, $lte: endOfDay },
          status: 'success',
        },
      },
      {
        $group: {
          _id: '$paymentMode',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
        },
      },
    ];

    const byPaymentMode = await collections.feeTransactions.aggregate(pipeline).toArray();

    const totalPipeline = [
      {
        $match: {
          tenantId: new ObjectId(tenantId),
          branchId: new ObjectId(branchId),
          receiptDate: { $gte: startOfDay, $lte: endOfDay },
          status: 'success',
        },
      },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          totalFeeCollected: { $sum: '$feeAmount' },
          totalFineCollected: { $sum: '$fineAmount' },
          totalAmount: { $sum: '$totalAmount' },
        },
      },
    ];

    const totals = await collections.feeTransactions.aggregate(totalPipeline).toArray();

    return {
      date,
      byPaymentMode: byPaymentMode.map((p) => ({
        paymentMode: p._id,
        count: p.count,
        totalAmount: p.totalAmount,
      })),
      summary: totals[0] || {
        totalTransactions: 0,
        totalFeeCollected: 0,
        totalFineCollected: 0,
        totalAmount: 0,
      },
    };
  }

  async getCollectionSummary(tenantId: string, branchId: string, fromDate: string, toDate: string) {
    const pipeline = [
      {
        $match: {
          tenantId: new ObjectId(tenantId),
          branchId: new ObjectId(branchId),
          receiptDate: { $gte: new Date(fromDate), $lte: new Date(toDate) },
          status: 'success',
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$receiptDate' },
            month: { $month: '$receiptDate' },
          },
          count: { $sum: 1 },
          totalFee: { $sum: '$feeAmount' },
          totalFine: { $sum: '$fineAmount' },
          totalAmount: { $sum: '$totalAmount' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ];

    const monthlyData = await collections.feeTransactions.aggregate(pipeline).toArray();

    const totalPipeline = [
      {
        $match: {
          tenantId: new ObjectId(tenantId),
          branchId: new ObjectId(branchId),
          receiptDate: { $gte: new Date(fromDate), $lte: new Date(toDate) },
          status: 'success',
        },
      },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          totalFeeCollected: { $sum: '$feeAmount' },
          totalFineCollected: { $sum: '$fineAmount' },
          totalAmount: { $sum: '$totalAmount' },
        },
      },
    ];

    const totals = await collections.feeTransactions.aggregate(totalPipeline).toArray();

    return {
      period: { from: fromDate, to: toDate },
      monthly: monthlyData.map((m) => ({
        year: m._id.year,
        month: m._id.month,
        count: m.count,
        totalFee: m.totalFee,
        totalFine: m.totalFine,
        totalAmount: m.totalAmount,
      })),
      summary: totals[0] || {
        totalTransactions: 0,
        totalFeeCollected: 0,
        totalFineCollected: 0,
        totalAmount: 0,
      },
    };
  }

  /**
   * Initiate an online payment by creating a Razorpay order
   */
  async initiateOnlinePayment(
    tenantId: string,
    branchId: string,
    data: InitiateOnlinePaymentInput,
    initiatedBy: string
  ) {
    // Verify fee assignment exists
    const assignment = await collections.feeAssignments.findOne({
      _id: new ObjectId(data.feeAssignmentId),
      tenantId: new ObjectId(tenantId),
    });

    if (!assignment) {
      throw new ApiError('FEE_ASSIGNMENT_NOT_FOUND', 'Fee assignment not found', 404);
    }

    // Verify student
    const student = await collections.students.findOne({
      _id: new ObjectId(data.studentId),
      tenantId: new ObjectId(tenantId),
    });

    if (!student) {
      throw new ApiError('STUDENT_NOT_FOUND', 'Student not found', 404);
    }

    const totalAmount = data.feeAmount + (data.fineAmount || 0) + (data.adjustments || 0);
    const amountInPaise = Math.round(totalAmount * 100); // Convert to smallest currency unit

    // Create a pending transaction record
    const transactionId = new ObjectId();
    const now = new Date();
    const receiptNumber = await generateReceiptNumber(tenantId, branchId);

    // Razorpay Route: if this branch has an activated linked account, attach
    // a transfers[] block routing the full captured amount to the school.
    // When unconfigured/under-review, fall back to the existing behaviour
    // (no transfer — payment lands in the platform master account).
    const linkedAccountId = await razorpayRouteService.getActiveLinkedAccountId(tenantId, branchId);
    const transfers = linkedAccountId
      ? [
          {
            account: linkedAccountId,
            amount: amountInPaise,
            currency: 'INR',
            notes: {
              tenantId,
              branchId,
              studentId: data.studentId,
              feeAssignmentId: data.feeAssignmentId,
              transactionId: transactionId.toString(),
            },
            on_hold: 0 as const,
          },
        ]
      : undefined;

    // Create Razorpay order
    const order = await razorpayService.createOrder({
      amount: amountInPaise,
      currency: 'INR',
      receipt: receiptNumber,
      notes: {
        tenantId,
        branchId,
        studentId: data.studentId,
        feeAssignmentId: data.feeAssignmentId,
        transactionId: transactionId.toString(),
      },
      transfers,
    });

    const transaction: Omit<FeeTransactionDocument, '_id'> & { _id: ObjectId } = {
      _id: transactionId,
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      studentId: new ObjectId(data.studentId),
      feeAssignmentId: new ObjectId(data.feeAssignmentId),
      receiptNumber,
      receiptDate: now,
      paymentMode: 'netbanking', // Will be updated based on actual payment method
      components: data.components,
      installmentNumbers: data.installmentNumbers,
      feeAmount: data.feeAmount,
      fineAmount: data.fineAmount || 0,
      adjustments: data.adjustments || 0,
      totalAmount,
      onlinePayment: {
        gatewayOrderId: order.id,
        status: 'created',
        ...(linkedAccountId
          ? {
              routedToLinkedAccountId: linkedAccountId,
              routedAmount: amountInPaise,
              transferStatus: 'pending' as const,
            }
          : {}),
      },
      status: 'pending',
      remarks: data.remarks,
      collectedBy: new ObjectId(initiatedBy),
      createdAt: now,
      updatedAt: now,
    };

    await collections.feeTransactions.insertOne(transaction);

    logger.info(
      {
        transactionId: transactionId.toString(),
        orderId: order.id,
        amount: totalAmount,
        studentId: data.studentId,
      },
      'Online payment initiated'
    );

    return {
      transactionId: transactionId.toString(),
      orderId: order.id,
      amount: totalAmount,
      amountInPaise,
      currency: 'INR',
      receiptNumber,
      student: {
        _id: student._id.toString(),
        displayName: student.displayName,
        admissionNumber: student.admissionNumber,
      },
    };
  }

  /**
   * Verify online payment after Razorpay callback
   */
  async verifyOnlinePayment(
    tenantId: string,
    branchId: string,
    data: VerifyOnlinePaymentInput,
    verifiedBy: string
  ) {
    // Find the pending transaction by order ID
    const transaction = (await collections.feeTransactions.findOne({
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      'onlinePayment.gatewayOrderId': data.orderId,
      status: 'pending',
    })) as WithId<FeeTransactionDocument> | null;

    if (!transaction) {
      throw new ApiError(
        'TRANSACTION_NOT_FOUND',
        'Pending transaction not found for this order',
        404
      );
    }

    // Verify the payment signature
    const isValid = razorpayService.verifyPayment({
      orderId: data.orderId,
      paymentId: data.paymentId,
      signature: data.signature,
    });

    if (!isValid) {
      // Mark transaction as failed
      await collections.feeTransactions.updateOne(
        { _id: transaction._id },
        {
          $set: {
            status: 'failed',
            'onlinePayment.gatewayPaymentId': data.paymentId,
            'onlinePayment.gatewaySignature': data.signature,
            'onlinePayment.status': 'failed',
            updatedAt: new Date(),
          },
        }
      );

      logger.warn(
        { transactionId: transaction._id.toString(), orderId: data.orderId },
        'Payment verification failed'
      );

      throw new ApiError(
        'PAYMENT_VERIFICATION_FAILED',
        'Payment signature verification failed',
        400
      );
    }

    // Fetch payment details from Razorpay to get actual payment method
    const paymentDetails = await razorpayService.getPayment(data.paymentId);
    const paymentMethod = this.mapRazorpayMethod(paymentDetails.method as string);

    const now = new Date();

    // Update transaction as successful
    await collections.feeTransactions.updateOne(
      { _id: transaction._id },
      {
        $set: {
          status: 'success',
          paymentMode: paymentMethod,
          paymentDetails: {
            referenceNumber: data.paymentId,
          },
          'onlinePayment.gatewayPaymentId': data.paymentId,
          'onlinePayment.gatewaySignature': data.signature,
          'onlinePayment.status': 'captured',
          updatedAt: now,
        },
      }
    );

    // Update fee assignment
    await feeAssignmentService.updatePayment(
      tenantId,
      transaction.feeAssignmentId.toString(),
      transaction.totalAmount,
      transaction.installmentNumbers
    );

    logger.info(
      {
        transactionId: transaction._id.toString(),
        paymentId: data.paymentId,
        amount: transaction.totalAmount,
        verifiedBy,
      },
      'Online payment verified and captured'
    );

    return {
      ...(await this.findById(tenantId, transaction._id.toString())),
      // Who the receipt is from — the success screen shows this college's name and logo.
      issuer: await resolveReceiptIssuer(
        transaction.tenantId as ObjectId,
        transaction.branchId as ObjectId,
        transaction.studentId as ObjectId
      ),
    };
  }

  /**
   * Map Razorpay payment method to our payment mode
   */
  private mapRazorpayMethod(
    method: string
  ): 'cash' | 'card' | 'upi' | 'netbanking' | 'cheque' | 'dd' | 'wallet' {
    const methodMap: Record<
      string,
      'cash' | 'card' | 'upi' | 'netbanking' | 'cheque' | 'dd' | 'wallet'
    > = {
      card: 'card',
      upi: 'upi',
      netbanking: 'netbanking',
      wallet: 'wallet',
      emi: 'card',
      cardless_emi: 'netbanking',
      paylater: 'netbanking',
    };
    return methodMap[method] || 'netbanking';
  }

  private formatTransaction(transaction: WithId<FeeTransactionDocument>) {
    return {
      _id: transaction._id.toString(),
      tenantId: transaction.tenantId.toString(),
      branchId: transaction.branchId.toString(),
      studentId: transaction.studentId.toString(),
      feeAssignmentId: transaction.feeAssignmentId.toString(),
      receiptNumber: transaction.receiptNumber,
      receiptDate: transaction.receiptDate,
      paymentMode: transaction.paymentMode,
      paymentDetails: transaction.paymentDetails,
      components: transaction.components,
      installmentNumbers: transaction.installmentNumbers,
      feeAmount: transaction.feeAmount,
      fineAmount: transaction.fineAmount,
      adjustments: transaction.adjustments,
      totalAmount: transaction.totalAmount,
      onlinePayment: transaction.onlinePayment,
      status: transaction.status,
      remarks: transaction.remarks,
      refund: transaction.refund
        ? {
            ...transaction.refund,
            refundedBy: transaction.refund.refundedBy?.toString(),
          }
        : undefined,
      cancellation: transaction.cancellation
        ? {
            ...transaction.cancellation,
            cancelledBy: transaction.cancellation.cancelledBy?.toString(),
            approvedBy: transaction.cancellation.approvedBy?.toString(),
          }
        : undefined,
      collectedBy: transaction.collectedBy.toString(),
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
    };
  }

  private formatTransactionWithStudent(transaction: Document) {
    return {
      _id: transaction._id.toString(),
      tenantId: transaction.tenantId.toString(),
      branchId: transaction.branchId.toString(),
      studentId: transaction.student?.admissionNumber || transaction.studentId.toString(),
      feeAssignmentId: transaction.feeAssignmentId?.toString(),
      student: transaction.student
        ? {
            _id: transaction.student._id.toString(),
            admissionNumber: transaction.student.admissionNumber,
            displayName: transaction.student.displayName,
          }
        : null,
      // Flat fields for fee counter UI
      receiptNo: transaction.receiptNumber,
      studentName: transaction.student?.displayName || '',
      class: transaction.student?.currentEnrollment?.className || '',
      section: transaction.student?.currentEnrollment?.sectionName || '',
      amount: transaction.totalAmount,
      date: transaction.receiptDate,
      feeType:
        transaction.components?.length > 0
          ? transaction.components.map((c: { name: string }) => c.name).join(', ')
          : 'Fee Payment',
      // Standard fields
      receiptNumber: transaction.receiptNumber,
      receiptDate: transaction.receiptDate,
      paymentMode: transaction.paymentMode,
      paymentDetails: transaction.paymentDetails,
      components: transaction.components,
      installmentNumbers: transaction.installmentNumbers,
      feeAmount: transaction.feeAmount,
      fineAmount: transaction.fineAmount,
      adjustments: transaction.adjustments,
      totalAmount: transaction.totalAmount,
      status: transaction.status === 'success' ? 'completed' : transaction.status,
      remarks: transaction.remarks,
      collectedBy: transaction.collectedBy.toString(),
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
    };
  }
}

export const feeTransactionService = new FeeTransactionService();

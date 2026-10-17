import { ObjectId, WithId, Document, Filter } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';

export type ApprovalRequestType = 'cancellation' | 'refund';
export type ApprovalRequestStatus = 'pending' | 'approved' | 'rejected';

interface ApprovalRequestDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  type: ApprovalRequestType;
  transactionId: ObjectId;
  studentId: ObjectId;
  receiptNumber: string;
  amount: number;
  refundAmount?: number; // For refund requests
  reason: string;
  status: ApprovalRequestStatus;
  requestedBy: ObjectId;
  requestedAt: Date;
  reviewedBy?: ObjectId;
  reviewedAt?: Date;
  reviewRemarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateApprovalRequestInput {
  type: ApprovalRequestType;
  transactionId: string;
  reason: string;
  refundAmount?: number;
}

export interface ApprovalRequestListParams {
  page?: number;
  limit?: number;
  type?: ApprovalRequestType;
  status?: ApprovalRequestStatus;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

class ApprovalRequestService {
  async create(
    tenantId: string,
    branchId: string,
    data: CreateApprovalRequestInput,
    requestedBy: string
  ) {
    // Get the transaction
    const transaction = await collections.feeTransactions.findOne({
      _id: new ObjectId(data.transactionId),
      tenantId: new ObjectId(tenantId),
    });

    if (!transaction) {
      throw new ApiError('TRANSACTION_NOT_FOUND', 'Transaction not found', 404);
    }

    if (transaction.status !== 'success') {
      throw new ApiError(
        'INVALID_TRANSACTION_STATUS',
        'Only successful transactions can be cancelled or refunded',
        400
      );
    }

    // Check for existing pending request
    const existingRequest = await collections.approvalRequests.findOne({
      transactionId: new ObjectId(data.transactionId),
      status: 'pending',
    });

    if (existingRequest) {
      throw new ApiError(
        'REQUEST_EXISTS',
        'An approval request is already pending for this transaction',
        409
      );
    }

    // Validate refund amount if it's a refund request
    if (data.type === 'refund' && data.refundAmount) {
      if (data.refundAmount > transaction.totalAmount) {
        throw new ApiError('INVALID_AMOUNT', 'Refund amount cannot exceed transaction amount', 400);
      }
    }

    const requestId = new ObjectId();
    const now = new Date();

    const request: Omit<ApprovalRequestDocument, '_id'> & { _id: ObjectId } = {
      _id: requestId,
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      type: data.type,
      transactionId: new ObjectId(data.transactionId),
      studentId: transaction.studentId,
      receiptNumber: transaction.receiptNumber,
      amount: transaction.totalAmount,
      refundAmount:
        data.type === 'refund' ? data.refundAmount || transaction.totalAmount : undefined,
      reason: data.reason,
      status: 'pending',
      requestedBy: new ObjectId(requestedBy),
      requestedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    await collections.approvalRequests.insertOne(request);

    logger.info(
      {
        requestId: requestId.toString(),
        type: data.type,
        transactionId: data.transactionId,
        requestedBy,
      },
      'Approval request created'
    );

    return this.formatRequest(request as WithId<ApprovalRequestDocument>);
  }

  async findAll(tenantId: string, branchId: string, params: ApprovalRequestListParams = {}) {
    const { page = 1, limit = 20, type, status, sortBy = 'createdAt', sortOrder = 'desc' } = params;

    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    if (type) {
      filter.type = type;
    }

    if (status) {
      filter.status = status;
    }

    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    // Aggregate with lookups
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
      {
        $lookup: {
          from: 'users',
          localField: 'requestedBy',
          foreignField: '_id',
          as: 'requestedByUser',
        },
      },
      { $unwind: { path: '$requestedByUser', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'reviewedBy',
          foreignField: '_id',
          as: 'reviewedByUser',
        },
      },
      { $unwind: { path: '$reviewedByUser', preserveNullAndEmptyArrays: true } },
      { $sort: { [sortBy]: sortDirection, _id: sortDirection } },
      { $skip: skip },
      { $limit: limit },
    ];

    const [requests, totalResult] = await Promise.all([
      collections.approvalRequests.aggregate(pipeline).toArray(),
      collections.approvalRequests.countDocuments(filter),
    ]);

    return {
      data: requests.map((r) => this.formatRequestWithDetails(r)),
      meta: {
        page,
        limit,
        total: totalResult,
        totalPages: Math.ceil(totalResult / limit),
        hasMore: skip + requests.length < totalResult,
      },
    };
  }

  async findById(tenantId: string, requestId: string) {
    const request = (await collections.approvalRequests.findOne({
      _id: new ObjectId(requestId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<ApprovalRequestDocument> | null;

    if (!request) {
      throw new ApiError('REQUEST_NOT_FOUND', 'Approval request not found', 404);
    }

    return this.formatRequest(request);
  }

  async approve(
    tenantId: string,
    _branchId: string,
    requestId: string,
    remarks: string,
    approvedBy: string
  ) {
    const request = (await collections.approvalRequests.findOne({
      _id: new ObjectId(requestId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<ApprovalRequestDocument> | null;

    if (!request) {
      throw new ApiError('REQUEST_NOT_FOUND', 'Approval request not found', 404);
    }

    if (request.status !== 'pending') {
      throw new ApiError('ALREADY_PROCESSED', 'This request has already been processed', 400);
    }

    const now = new Date();

    // Update request status
    await collections.approvalRequests.updateOne(
      { _id: new ObjectId(requestId) },
      {
        $set: {
          status: 'approved',
          reviewedBy: new ObjectId(approvedBy),
          reviewedAt: now,
          reviewRemarks: remarks,
          updatedAt: now,
        },
      }
    );

    // Process the actual cancellation or refund
    if (request.type === 'cancellation') {
      await this.processCancellation(tenantId, request, approvedBy);
    } else if (request.type === 'refund') {
      await this.processRefund(tenantId, request, approvedBy);
    }

    logger.info(
      { requestId, type: request.type, approvedBy },
      'Approval request approved and processed'
    );

    return this.findById(tenantId, requestId);
  }

  async reject(
    tenantId: string,
    _branchId: string,
    requestId: string,
    remarks: string,
    rejectedBy: string
  ) {
    const request = (await collections.approvalRequests.findOne({
      _id: new ObjectId(requestId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<ApprovalRequestDocument> | null;

    if (!request) {
      throw new ApiError('REQUEST_NOT_FOUND', 'Approval request not found', 404);
    }

    if (request.status !== 'pending') {
      throw new ApiError('ALREADY_PROCESSED', 'This request has already been processed', 400);
    }

    const now = new Date();

    await collections.approvalRequests.updateOne(
      { _id: new ObjectId(requestId) },
      {
        $set: {
          status: 'rejected',
          reviewedBy: new ObjectId(rejectedBy),
          reviewedAt: now,
          reviewRemarks: remarks,
          updatedAt: now,
        },
      }
    );

    logger.info({ requestId, rejectedBy }, 'Approval request rejected');

    return this.findById(tenantId, requestId);
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
          _id: { type: '$type', status: '$status' },
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        },
      },
    ];

    const results = await collections.approvalRequests.aggregate(pipeline).toArray();

    const stats = {
      cancellation: { pending: 0, approved: 0, rejected: 0 },
      refund: { pending: 0, approved: 0, rejected: 0 },
      totalPending: 0,
      totalPendingAmount: 0,
    };

    results.forEach((r) => {
      const type = r._id.type as ApprovalRequestType;
      const status = r._id.status as ApprovalRequestStatus;
      stats[type][status] = r.count;
      if (status === 'pending') {
        stats.totalPending += r.count;
        stats.totalPendingAmount += r.totalAmount;
      }
    });

    return stats;
  }

  private async processCancellation(
    _tenantId: string,
    request: WithId<ApprovalRequestDocument>,
    _approvedBy: string
  ) {
    const now = new Date();
    const transaction = await collections.feeTransactions.findOne({
      _id: request.transactionId,
    });

    if (!transaction) return;

    // Update transaction status
    await collections.feeTransactions.updateOne(
      { _id: request.transactionId },
      {
        $set: {
          status: 'cancelled',
          cancellation: {
            reason: request.reason,
            cancelledAt: now,
            cancelledBy: request.requestedBy,
          },
          updatedAt: now,
        },
      }
    );

    // Reverse the payment in fee assignment
    const assignment = await collections.feeAssignments.findOne({
      _id: transaction.feeAssignmentId,
    });

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

      await collections.feeAssignments.updateOne(
        { _id: transaction.feeAssignmentId },
        {
          $set: {
            installments,
            'summary.totalPaid': newTotalPaid,
            'summary.balance': newBalance,
            status: newBalance > 0 ? 'active' : 'cleared',
            updatedAt: now,
          },
        }
      );
    }
  }

  private async processRefund(
    _tenantId: string,
    request: WithId<ApprovalRequestDocument>,
    _approvedBy: string
  ) {
    const now = new Date();
    const refundAmount = request.refundAmount || request.amount;

    // Update transaction status
    await collections.feeTransactions.updateOne(
      { _id: request.transactionId },
      {
        $set: {
          status: 'refunded',
          refund: {
            amount: refundAmount,
            reason: request.reason,
            refundedAt: now,
            refundedBy: request.requestedBy,
          },
          updatedAt: now,
        },
      }
    );

    // Update fee assignment balance
    const transaction = await collections.feeTransactions.findOne({
      _id: request.transactionId,
    });

    if (transaction) {
      const assignment = await collections.feeAssignments.findOne({
        _id: transaction.feeAssignmentId,
      });

      if (assignment) {
        const newTotalPaid = (assignment.summary?.totalPaid || 0) - refundAmount;
        const newBalance = (assignment.summary?.netPayable || 0) - newTotalPaid;

        await collections.feeAssignments.updateOne(
          { _id: transaction.feeAssignmentId },
          {
            $set: {
              'summary.totalPaid': newTotalPaid,
              'summary.balance': newBalance,
              status: newBalance > 0 ? 'active' : 'cleared',
              updatedAt: now,
            },
          }
        );
      }
    }
  }

  private formatRequest(request: WithId<ApprovalRequestDocument>) {
    return {
      _id: request._id.toString(),
      tenantId: request.tenantId.toString(),
      branchId: request.branchId.toString(),
      type: request.type,
      transactionId: request.transactionId.toString(),
      studentId: request.studentId.toString(),
      receiptNumber: request.receiptNumber,
      amount: request.amount,
      refundAmount: request.refundAmount,
      reason: request.reason,
      status: request.status,
      requestedBy: request.requestedBy.toString(),
      requestedAt: request.requestedAt,
      reviewedBy: request.reviewedBy?.toString(),
      reviewedAt: request.reviewedAt,
      reviewRemarks: request.reviewRemarks,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    };
  }

  private formatRequestWithDetails(request: Document) {
    return {
      _id: request._id.toString(),
      tenantId: request.tenantId.toString(),
      branchId: request.branchId.toString(),
      type: request.type,
      transactionId: request.transactionId.toString(),
      studentId: request.studentId.toString(),
      receiptNumber: request.receiptNumber,
      amount: request.amount,
      refundAmount: request.refundAmount,
      reason: request.reason,
      status: request.status,
      student: request.student
        ? {
            _id: request.student._id.toString(),
            admissionNumber: request.student.admissionNumber,
            displayName: request.student.displayName,
          }
        : null,
      requestedBy: request.requestedBy.toString(),
      requestedByUser: request.requestedByUser
        ? {
            _id: request.requestedByUser._id.toString(),
            displayName: request.requestedByUser.displayName,
          }
        : null,
      requestedAt: request.requestedAt,
      reviewedBy: request.reviewedBy?.toString(),
      reviewedByUser: request.reviewedByUser
        ? {
            _id: request.reviewedByUser._id.toString(),
            displayName: request.reviewedByUser.displayName,
          }
        : null,
      reviewedAt: request.reviewedAt,
      reviewRemarks: request.reviewRemarks,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    };
  }
}

export const approvalRequestService = new ApprovalRequestService();

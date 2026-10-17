import { ObjectId, WithId, Document, Filter } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';

export type ApprovalEntityType = 'concession' | 'fee_cancellation' | 'leave' | 'certificate';
export type ApprovalAction = 'approved' | 'rejected' | 'undone';

export interface ApprovalAuditDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  entityType: ApprovalEntityType;
  entityId: ObjectId;
  action: ApprovalAction;
  performedBy: ObjectId;
  performedAt: Date;
  previousState: Record<string, unknown>;
  newState: Record<string, unknown>;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface ApprovalListParams {
  entityType?: ApprovalEntityType;
  action?: ApprovalAction;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

class ApprovalService {
  // ============ Audit Trail ============
  async createAuditEntry(
    tenantId: string,
    branchId: string,
    data: {
      entityType: ApprovalEntityType;
      entityId: string;
      action: ApprovalAction;
      performedBy: string;
      previousState: Record<string, unknown>;
      newState: Record<string, unknown>;
      reason?: string;
      metadata?: Record<string, unknown>;
    }
  ) {
    const auditId = new ObjectId();
    const now = new Date();

    const audit: ApprovalAuditDocument = {
      _id: auditId,
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      entityType: data.entityType,
      entityId: new ObjectId(data.entityId),
      action: data.action,
      performedBy: new ObjectId(data.performedBy),
      performedAt: now,
      previousState: data.previousState,
      newState: data.newState,
      reason: data.reason,
      metadata: data.metadata,
    };

    await collections.approvalAudits.insertOne(audit);

    logger.info(
      {
        auditId: auditId.toString(),
        entityType: data.entityType,
        entityId: data.entityId,
        action: data.action,
      },
      'Approval audit entry created'
    );

    return this.formatAudit(audit as WithId<ApprovalAuditDocument>);
  }

  async getApprovalHistory(tenantId: string, branchId: string, params: ApprovalListParams = {}) {
    const { entityType, action, fromDate, toDate, page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;

    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    if (entityType) {
      filter.entityType = entityType;
    }

    if (action) {
      filter.action = action;
    }

    if (fromDate || toDate) {
      filter.performedAt = {};
      if (fromDate) {
        filter.performedAt.$gte = new Date(fromDate);
      }
      if (toDate) {
        filter.performedAt.$lte = new Date(toDate + 'T23:59:59.999Z');
      }
    }

    const pipeline = [
      { $match: filter },
      { $sort: { performedAt: -1 } },
      {
        $lookup: {
          from: 'users',
          localField: 'performedBy',
          foreignField: '_id',
          as: 'performer',
        },
      },
      { $unwind: { path: '$performer', preserveNullAndEmptyArrays: true } },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: 1,
                entityType: 1,
                entityId: 1,
                action: 1,
                performedBy: 1,
                performerName: '$performer.profile.displayName',
                performerEmail: '$performer.email',
                performedAt: 1,
                previousState: 1,
                newState: 1,
                reason: 1,
                metadata: 1,
              },
            },
          ],
          total: [{ $count: 'count' }],
        },
      },
    ];

    const result = await collections.approvalAudits.aggregate(pipeline).toArray();
    const data = result[0]?.data || [];
    const total = result[0]?.total[0]?.count || 0;

    return {
      data: data.map((a: Document) => ({
        _id: a._id.toString(),
        entityType: a.entityType,
        entityId: a.entityId.toString(),
        action: a.action,
        performedBy: a.performedBy.toString(),
        performerName: a.performerName,
        performerEmail: a.performerEmail,
        performedAt: a.performedAt,
        previousState: a.previousState,
        newState: a.newState,
        reason: a.reason,
        metadata: a.metadata,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + data.length < total,
      },
    };
  }

  // ============ Undo Approvals ============
  async undoConcessionApproval(
    tenantId: string,
    branchId: string,
    concessionId: string,
    reason: string,
    undoneBy: string
  ) {
    // Get the concession
    const concession = await collections.concessions.findOne({
      _id: new ObjectId(concessionId),
      tenantId: new ObjectId(tenantId),
    });

    if (!concession) {
      throw new ApiError('CONCESSION_NOT_FOUND', 'Concession not found', 404);
    }

    if (concession.status !== 'approved') {
      throw new ApiError('INVALID_STATUS', 'Can only undo approved concessions', 400);
    }

    // Store previous state
    const previousState = {
      status: concession.status,
      approvedBy: concession.approvedBy?.toString(),
      approvedAt: concession.approvedAt,
    };

    // Update concession to pending
    await collections.concessions.updateOne(
      { _id: new ObjectId(concessionId) },
      {
        $set: {
          status: 'pending',
          undoneBy: new ObjectId(undoneBy),
          undoneAt: new Date(),
          undoReason: reason,
          updatedAt: new Date(),
        },
        $unset: {
          approvedBy: '',
          approvedAt: '',
        },
      }
    );

    // If concession was applied to fee assignment, remove the discount
    if (concession.feeAssignmentId) {
      await collections.feeAssignments.updateOne({ _id: concession.feeAssignmentId }, {
        $pull: {
          concessions: { concessionId: new ObjectId(concessionId) },
        } as unknown,
        $inc: {
          'summary.totalDiscount': -concession.calculatedAmount,
          'summary.netPayable': concession.calculatedAmount,
          'summary.balance': concession.calculatedAmount,
        },
        $set: {
          updatedAt: new Date(),
        },
      } as Document);
    }

    // Create audit entry
    await this.createAuditEntry(tenantId, branchId, {
      entityType: 'concession',
      entityId: concessionId,
      action: 'undone',
      performedBy: undoneBy,
      previousState,
      newState: { status: 'pending' },
      reason,
    });

    logger.info({ concessionId, tenantId, undoneBy }, 'Concession approval undone');

    return {
      concessionId,
      previousStatus: 'approved',
      newStatus: 'pending',
      undoneAt: new Date(),
    };
  }

  async undoFeeCancellation(
    tenantId: string,
    branchId: string,
    transactionId: string,
    reason: string,
    undoneBy: string
  ) {
    // Get the transaction
    const transaction = await collections.feeTransactions.findOne({
      _id: new ObjectId(transactionId),
      tenantId: new ObjectId(tenantId),
    });

    if (!transaction) {
      throw new ApiError('TRANSACTION_NOT_FOUND', 'Transaction not found', 404);
    }

    if (transaction.status !== 'cancelled') {
      throw new ApiError('INVALID_STATUS', 'Can only undo cancelled transactions', 400);
    }

    // Store previous state
    const previousState = {
      status: transaction.status,
      cancellation: transaction.cancellation,
    };

    // Update transaction back to success
    await collections.feeTransactions.updateOne(
      { _id: new ObjectId(transactionId) },
      {
        $set: {
          status: 'success',
          undoneBy: new ObjectId(undoneBy),
          undoneAt: new Date(),
          undoReason: reason,
          updatedAt: new Date(),
        },
        $unset: {
          cancellation: '',
        },
      }
    );

    // Update fee assignment to reflect the payment again
    if (transaction.feeAssignmentId) {
      await collections.feeAssignments.updateOne(
        { _id: transaction.feeAssignmentId },
        {
          $inc: {
            'summary.totalPaid': transaction.totalAmount,
            'summary.balance': -transaction.totalAmount,
          },
          $set: {
            updatedAt: new Date(),
          },
        }
      );
    }

    // Create audit entry
    await this.createAuditEntry(tenantId, branchId, {
      entityType: 'fee_cancellation',
      entityId: transactionId,
      action: 'undone',
      performedBy: undoneBy,
      previousState,
      newState: { status: 'success' },
      reason,
    });

    logger.info({ transactionId, tenantId, undoneBy }, 'Fee cancellation undone');

    return {
      transactionId,
      previousStatus: 'cancelled',
      newStatus: 'success',
      undoneAt: new Date(),
    };
  }

  async getPendingApprovals(
    tenantId: string,
    branchId: string,
    params: { page?: number; limit?: number }
  ) {
    const { page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;

    // Get pending concessions
    const concessions = await collections.concessions
      .find({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        status: 'pending',
      })
      .sort({ requestedAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const concessionCount = await collections.concessions.countDocuments({
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      status: 'pending',
    });

    // Get pending certificate requests
    const certificates = await collections.certificateRequests
      .find({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        status: 'pending',
      })
      .sort({ requestedAt: -1 })
      .limit(10)
      .toArray();

    const certificateCount = await collections.certificateRequests.countDocuments({
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      status: 'pending',
    });

    return {
      concessions: {
        data: concessions.map((c) => ({
          _id: c._id.toString(),
          studentId: c.studentId.toString(),
          type: c.type,
          name: c.name,
          calculatedAmount: c.calculatedAmount,
          requestedAt: c.requestedAt,
          requestedBy: c.requestedBy?.toString(),
        })),
        total: concessionCount,
      },
      certificates: {
        data: certificates.map((c) => ({
          _id: c._id.toString(),
          studentId: c.studentId.toString(),
          certificateType: c.certificateType,
          requestedAt: c.requestedAt,
        })),
        total: certificateCount,
      },
      summary: {
        totalPending: concessionCount + certificateCount,
        concessionsPending: concessionCount,
        certificatesPending: certificateCount,
      },
    };
  }

  private formatAudit(audit: WithId<ApprovalAuditDocument>) {
    return {
      _id: audit._id.toString(),
      tenantId: audit.tenantId.toString(),
      branchId: audit.branchId.toString(),
      entityType: audit.entityType,
      entityId: audit.entityId.toString(),
      action: audit.action,
      performedBy: audit.performedBy.toString(),
      performedAt: audit.performedAt,
      previousState: audit.previousState,
      newState: audit.newState,
      reason: audit.reason,
      metadata: audit.metadata,
    };
  }
}

export const approvalService = new ApprovalService();

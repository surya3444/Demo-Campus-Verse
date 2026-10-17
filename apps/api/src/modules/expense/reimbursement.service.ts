import { ObjectId, Filter, Document } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { generateReimbursementNumber } from '../../utils/generators';

export interface ReimbursementListParams {
  page: number;
  limit: number;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

class ReimbursementService {
  async findAll(tenantId: string, branchId: string, params: ReimbursementListParams) {
    try {
      const skip = (params.page - 1) * params.limit;

      const filter: Filter<Document> = {
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
      };

      if (params.status) filter.status = params.status;

      const sortBy = params.sortBy || 'createdAt';
      const sortOrder = params.sortOrder === 'asc' ? 1 : -1;

      const [data, total] = await Promise.all([
        collections.reimbursements
          .find(filter)
          .sort({ [sortBy]: sortOrder, _id: sortOrder })
          .skip(skip)
          .limit(params.limit)
          .toArray(),
        collections.reimbursements.countDocuments(filter),
      ]);

      return {
        data: data.map((doc) => this.formatReimbursement(doc)),
        meta: {
          page: params.page,
          limit: params.limit,
          total,
          totalPages: Math.ceil(total / params.limit),
          hasMore: skip + params.limit < total,
        },
      };
    } catch (error) {
      logger.error({ err: error }, 'Failed to fetch reimbursements');
      throw error;
    }
  }

  async create(
    tenantId: string,
    branchId: string,
    data: Record<string, unknown>,
    userId: string,
    userName: string
  ) {
    try {
      const expenseId = data.expenseId as string;

      // Verify expense exists and is approved/paid
      const expense = await collections.expenses.findOne({
        _id: new ObjectId(expenseId),
        tenantId: new ObjectId(tenantId),
      });

      if (!expense) {
        throw new ApiError('NOT_FOUND', 'Linked expense not found', 404);
      }

      if (!['approved', 'paid'].includes(expense.status)) {
        throw new ApiError(
          'INVALID_STATUS',
          'Reimbursement can only be created for approved or paid expenses',
          400
        );
      }

      const reimbursementNumber = await generateReimbursementNumber(tenantId, branchId);
      const now = new Date();

      const bankDetails = data.bankDetails as Record<string, unknown> | undefined;

      const result = await collections.reimbursements.insertOne({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        reimbursementNumber,
        expenseId: new ObjectId(expenseId),
        requestedBy: {
          userId: new ObjectId(userId),
          userName,
        },
        amount: data.amount,
        description: data.description || null,
        bankDetails: bankDetails
          ? {
              accountNumber: bankDetails.accountNumber,
              ifscCode: bankDetails.ifscCode,
              bankName: bankDetails.bankName,
            }
          : null,
        status: 'pending',
        processedBy: null,
        processedAt: null,
        remarks: null,
        createdBy: new ObjectId(userId),
        createdAt: now,
        updatedAt: now,
      });

      const reimbursement = await collections.reimbursements.findOne({
        _id: result.insertedId,
      });
      return this.formatReimbursement(reimbursement!);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error }, 'Failed to create reimbursement');
      throw error;
    }
  }

  async approve(tenantId: string, id: string, _userId: string, remarks?: string) {
    try {
      const reimbursement = await collections.reimbursements.findOne({
        _id: new ObjectId(id),
        tenantId: new ObjectId(tenantId),
      });

      if (!reimbursement) {
        throw new ApiError('NOT_FOUND', 'Reimbursement not found', 404);
      }

      if (reimbursement.status !== 'pending') {
        throw new ApiError('INVALID_STATUS', 'Only pending reimbursements can be approved', 400);
      }

      const result = await collections.reimbursements.findOneAndUpdate(
        { _id: new ObjectId(id), tenantId: new ObjectId(tenantId) },
        {
          $set: {
            status: 'approved',
            remarks: remarks || null,
            updatedAt: new Date(),
          },
        },
        { returnDocument: 'after' }
      );

      return this.formatReimbursement(result!);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error }, 'Failed to approve reimbursement');
      throw error;
    }
  }

  async process(tenantId: string, id: string, userId: string, remarks?: string) {
    try {
      const reimbursement = await collections.reimbursements.findOne({
        _id: new ObjectId(id),
        tenantId: new ObjectId(tenantId),
      });

      if (!reimbursement) {
        throw new ApiError('NOT_FOUND', 'Reimbursement not found', 404);
      }

      if (reimbursement.status !== 'approved') {
        throw new ApiError('INVALID_STATUS', 'Only approved reimbursements can be processed', 400);
      }

      const now = new Date();

      const result = await collections.reimbursements.findOneAndUpdate(
        { _id: new ObjectId(id), tenantId: new ObjectId(tenantId) },
        {
          $set: {
            status: 'processed',
            processedBy: new ObjectId(userId),
            processedAt: now,
            remarks: remarks || reimbursement.remarks,
            updatedAt: now,
          },
        },
        { returnDocument: 'after' }
      );

      return this.formatReimbursement(result!);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error }, 'Failed to process reimbursement');
      throw error;
    }
  }

  private formatReimbursement(doc: Document) {
    return {
      ...doc,
      _id: doc._id.toString(),
      tenantId: doc.tenantId.toString(),
      branchId: doc.branchId.toString(),
      expenseId: doc.expenseId.toString(),
      requestedBy: {
        ...doc.requestedBy,
        userId: doc.requestedBy.userId.toString(),
      },
      processedBy: doc.processedBy?.toString() || null,
      createdBy: doc.createdBy?.toString(),
    };
  }
}

export const reimbursementService = new ReimbursementService();

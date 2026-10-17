import { ObjectId, Filter, Document, UpdateFilter } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { generateExpenseNumber } from '../../utils/generators';

export interface ExpenseListParams {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  category?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

class ExpenseService {
  async findAll(tenantId: string, branchId: string, params: ExpenseListParams) {
    try {
      const skip = (params.page - 1) * params.limit;

      const filter: Filter<Document> = {
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
      };

      if (params.search) {
        filter.$or = [
          { title: { $regex: params.search, $options: 'i' } },
          { expenseNumber: { $regex: params.search, $options: 'i' } },
          { 'requestedBy.userName': { $regex: params.search, $options: 'i' } },
        ];
      }

      if (params.status) filter.status = params.status;
      if (params.category) filter.category = params.category;

      const sortBy = params.sortBy || 'createdAt';
      const sortOrder = params.sortOrder === 'asc' ? 1 : -1;

      const [data, total] = await Promise.all([
        collections.expenses
          .find(filter)
          .sort({ [sortBy]: sortOrder, _id: sortOrder })
          .skip(skip)
          .limit(params.limit)
          .toArray(),
        collections.expenses.countDocuments(filter),
      ]);

      return {
        data: data.map((doc) => this.formatExpense(doc)),
        meta: {
          page: params.page,
          limit: params.limit,
          total,
          totalPages: Math.ceil(total / params.limit),
          hasMore: skip + params.limit < total,
        },
      };
    } catch (error) {
      logger.error({ err: error }, 'Failed to fetch expenses');
      throw error;
    }
  }

  async getMyExpenses(
    tenantId: string,
    branchId: string,
    userId: string,
    params: ExpenseListParams
  ) {
    try {
      const skip = (params.page - 1) * params.limit;

      const filter: Filter<Document> = {
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        'requestedBy.userId': new ObjectId(userId),
      };

      if (params.status) filter.status = params.status;

      const sortBy = params.sortBy || 'createdAt';
      const sortOrder = params.sortOrder === 'asc' ? 1 : -1;

      const [data, total] = await Promise.all([
        collections.expenses
          .find(filter)
          .sort({ [sortBy]: sortOrder, _id: sortOrder })
          .skip(skip)
          .limit(params.limit)
          .toArray(),
        collections.expenses.countDocuments(filter),
      ]);

      return {
        data: data.map((doc) => this.formatExpense(doc)),
        meta: {
          page: params.page,
          limit: params.limit,
          total,
          totalPages: Math.ceil(total / params.limit),
          hasMore: skip + params.limit < total,
        },
      };
    } catch (error) {
      logger.error({ err: error }, 'Failed to fetch my expenses');
      throw error;
    }
  }

  async getStats(tenantId: string, branchId: string) {
    try {
      const filter = {
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
      };

      const [total, pending, approved, totalAmount] = await Promise.all([
        collections.expenses.countDocuments(filter),
        collections.expenses.countDocuments({
          ...filter,
          status: { $in: ['submitted', 'under_review'] },
        }),
        collections.expenses.countDocuments({ ...filter, status: 'approved' }),
        collections.expenses
          .aggregate([
            { $match: { ...filter, status: { $in: ['approved', 'paid'] } } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
          ])
          .toArray(),
      ]);

      return {
        total,
        pending,
        approved,
        totalAmount: totalAmount[0]?.total || 0,
      };
    } catch (error) {
      logger.error({ err: error }, 'Failed to fetch expense stats');
      throw error;
    }
  }

  async findById(tenantId: string, id: string) {
    try {
      const expense = await collections.expenses.findOne({
        _id: new ObjectId(id),
        tenantId: new ObjectId(tenantId),
      });

      if (!expense) {
        throw new ApiError('NOT_FOUND', 'Expense not found', 404);
      }

      return this.formatExpense(expense);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error }, 'Failed to fetch expense');
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
      const expenseNumber = await generateExpenseNumber(tenantId, branchId);
      const now = new Date();

      const result = await collections.expenses.insertOne({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        expenseNumber,
        title: data.title,
        description: data.description || null,
        category: data.category,
        amount: data.amount,
        currency: 'INR',
        requestedBy: {
          userId: new ObjectId(userId),
          userName,
        },
        status: 'draft',
        approvalChain: [],
        budgetId: data.budgetId ? new ObjectId(data.budgetId as string) : null,
        attachments: data.attachments || [],
        paymentMode: null,
        paymentRef: null,
        paidAt: null,
        createdBy: new ObjectId(userId),
        createdAt: now,
        updatedAt: now,
      });

      return this.findById(tenantId, result.insertedId.toString());
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error }, 'Failed to create expense');
      throw error;
    }
  }

  async update(tenantId: string, id: string, data: Record<string, unknown>) {
    try {
      const expense = await collections.expenses.findOne({
        _id: new ObjectId(id),
        tenantId: new ObjectId(tenantId),
      });

      if (!expense) {
        throw new ApiError('NOT_FOUND', 'Expense not found', 404);
      }

      if (!['draft', 'rejected'].includes(expense.status)) {
        throw new ApiError('INVALID_STATUS', 'Only draft or rejected expenses can be edited', 400);
      }

      const updateData: Record<string, unknown> = { updatedAt: new Date() };

      const fields = ['title', 'description', 'category', 'amount', 'attachments'];
      for (const field of fields) {
        if (data[field] !== undefined) updateData[field] = data[field];
      }

      if (data.budgetId !== undefined) {
        updateData.budgetId = data.budgetId ? new ObjectId(data.budgetId as string) : null;
      }

      const result = await collections.expenses.findOneAndUpdate(
        { _id: new ObjectId(id), tenantId: new ObjectId(tenantId) },
        { $set: updateData },
        { returnDocument: 'after' }
      );

      return this.formatExpense(result!);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error }, 'Failed to update expense');
      throw error;
    }
  }

  async delete(tenantId: string, id: string) {
    try {
      const expense = await collections.expenses.findOne({
        _id: new ObjectId(id),
        tenantId: new ObjectId(tenantId),
      });

      if (!expense) {
        throw new ApiError('NOT_FOUND', 'Expense not found', 404);
      }

      if (expense.status !== 'draft') {
        throw new ApiError('INVALID_STATUS', 'Only draft expenses can be deleted', 400);
      }

      await collections.expenses.deleteOne({
        _id: new ObjectId(id),
        tenantId: new ObjectId(tenantId),
      });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error }, 'Failed to delete expense');
      throw error;
    }
  }

  async submit(tenantId: string, id: string, userId: string, userName: string) {
    try {
      const expense = await collections.expenses.findOne({
        _id: new ObjectId(id),
        tenantId: new ObjectId(tenantId),
      });

      if (!expense) {
        throw new ApiError('NOT_FOUND', 'Expense not found', 404);
      }

      if (!['draft', 'rejected'].includes(expense.status)) {
        throw new ApiError(
          'INVALID_STATUS',
          'Only draft or rejected expenses can be submitted',
          400
        );
      }

      const result = await collections.expenses.findOneAndUpdate(
        { _id: new ObjectId(id), tenantId: new ObjectId(tenantId) },
        {
          $set: { status: 'submitted', updatedAt: new Date() },
          $push: {
            approvalChain: {
              userId: new ObjectId(userId),
              userName,
              action: 'submitted',
              remarks: null,
              timestamp: new Date(),
            },
          },
        } as unknown as UpdateFilter<Document>,
        { returnDocument: 'after' }
      );

      return this.formatExpense(result!);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error }, 'Failed to submit expense');
      throw error;
    }
  }

  async approve(tenantId: string, id: string, userId: string, userName: string, remarks?: string) {
    try {
      const expense = await collections.expenses.findOne({
        _id: new ObjectId(id),
        tenantId: new ObjectId(tenantId),
      });

      if (!expense) {
        throw new ApiError('NOT_FOUND', 'Expense not found', 404);
      }

      if (!['submitted', 'under_review'].includes(expense.status)) {
        throw new ApiError('INVALID_STATUS', 'Only submitted expenses can be approved', 400);
      }

      const now = new Date();

      const result = await collections.expenses.findOneAndUpdate(
        { _id: new ObjectId(id), tenantId: new ObjectId(tenantId) },
        {
          $set: { status: 'approved', updatedAt: now },
          $push: {
            approvalChain: {
              userId: new ObjectId(userId),
              userName,
              action: 'approved',
              remarks: remarks || null,
              timestamp: now,
            },
          },
        } as unknown as UpdateFilter<Document>,
        { returnDocument: 'after' }
      );

      // Update budget spent if linked
      if (expense.budgetId) {
        await collections.budgets.updateOne(
          { _id: expense.budgetId },
          {
            $inc: { spent: expense.amount, remaining: -expense.amount },
            $set: { updatedAt: now },
          }
        );

        // Check if budget is exhausted
        const budget = await collections.budgets.findOne({ _id: expense.budgetId });
        if (budget && budget.remaining <= 0) {
          await collections.budgets.updateOne(
            { _id: expense.budgetId },
            { $set: { status: 'exhausted' } }
          );
        }
      }

      return this.formatExpense(result!);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error }, 'Failed to approve expense');
      throw error;
    }
  }

  async reject(tenantId: string, id: string, userId: string, userName: string, remarks: string) {
    try {
      const expense = await collections.expenses.findOne({
        _id: new ObjectId(id),
        tenantId: new ObjectId(tenantId),
      });

      if (!expense) {
        throw new ApiError('NOT_FOUND', 'Expense not found', 404);
      }

      if (!['submitted', 'under_review'].includes(expense.status)) {
        throw new ApiError('INVALID_STATUS', 'Only submitted expenses can be rejected', 400);
      }

      const result = await collections.expenses.findOneAndUpdate(
        { _id: new ObjectId(id), tenantId: new ObjectId(tenantId) },
        {
          $set: { status: 'rejected', updatedAt: new Date() },
          $push: {
            approvalChain: {
              userId: new ObjectId(userId),
              userName,
              action: 'rejected',
              remarks,
              timestamp: new Date(),
            },
          },
        } as unknown as UpdateFilter<Document>,
        { returnDocument: 'after' }
      );

      return this.formatExpense(result!);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error }, 'Failed to reject expense');
      throw error;
    }
  }

  async markPaid(
    tenantId: string,
    id: string,
    userId: string,
    userName: string,
    paymentData: Record<string, unknown>
  ) {
    try {
      const expense = await collections.expenses.findOne({
        _id: new ObjectId(id),
        tenantId: new ObjectId(tenantId),
      });

      if (!expense) {
        throw new ApiError('NOT_FOUND', 'Expense not found', 404);
      }

      if (expense.status !== 'approved') {
        throw new ApiError('INVALID_STATUS', 'Only approved expenses can be marked as paid', 400);
      }

      const now = new Date();

      const result = await collections.expenses.findOneAndUpdate(
        { _id: new ObjectId(id), tenantId: new ObjectId(tenantId) },
        {
          $set: {
            status: 'paid',
            paymentMode: paymentData.paymentMode || null,
            paymentRef: paymentData.paymentRef || null,
            paidAt: now,
            updatedAt: now,
          },
          $push: {
            approvalChain: {
              userId: new ObjectId(userId),
              userName,
              action: 'paid',
              remarks: paymentData.remarks || null,
              timestamp: now,
            },
          },
        } as unknown as UpdateFilter<Document>,
        { returnDocument: 'after' }
      );

      return this.formatExpense(result!);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error }, 'Failed to mark expense as paid');
      throw error;
    }
  }

  private formatExpense(doc: Document) {
    return {
      ...doc,
      _id: doc._id.toString(),
      tenantId: doc.tenantId.toString(),
      branchId: doc.branchId.toString(),
      budgetId: doc.budgetId?.toString() || null,
      requestedBy: {
        ...doc.requestedBy,
        userId: doc.requestedBy.userId.toString(),
      },
      approvalChain: (doc.approvalChain || []).map((entry: Record<string, unknown>) => ({
        ...entry,
        userId: entry.userId?.toString(),
      })),
      createdBy: doc.createdBy?.toString(),
    };
  }
}

export const expenseService = new ExpenseService();

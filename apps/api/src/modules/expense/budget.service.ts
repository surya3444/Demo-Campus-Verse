import { ObjectId, Filter, Document } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';

export interface BudgetListParams {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  category?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

class BudgetService {
  async findAll(tenantId: string, branchId: string, params: BudgetListParams) {
    try {
      const skip = (params.page - 1) * params.limit;

      const filter: Filter<Document> = {
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
      };

      if (params.search) {
        filter.$or = [
          { name: { $regex: params.search, $options: 'i' } },
          { department: { $regex: params.search, $options: 'i' } },
        ];
      }

      if (params.status) filter.status = params.status;
      if (params.category) filter.category = params.category;

      const sortBy = params.sortBy || 'createdAt';
      const sortOrder = params.sortOrder === 'asc' ? 1 : -1;

      const [data, total] = await Promise.all([
        collections.budgets
          .find(filter)
          .sort({ [sortBy]: sortOrder, _id: sortOrder })
          .skip(skip)
          .limit(params.limit)
          .toArray(),
        collections.budgets.countDocuments(filter),
      ]);

      return {
        data: data.map((doc) => this.formatBudget(doc)),
        meta: {
          page: params.page,
          limit: params.limit,
          total,
          totalPages: Math.ceil(total / params.limit),
          hasMore: skip + params.limit < total,
        },
      };
    } catch (error) {
      logger.error({ err: error }, 'Failed to fetch budgets');
      throw error;
    }
  }

  async findById(tenantId: string, id: string) {
    try {
      const budget = await collections.budgets.findOne({
        _id: new ObjectId(id),
        tenantId: new ObjectId(tenantId),
      });

      if (!budget) {
        throw new ApiError('NOT_FOUND', 'Budget not found', 404);
      }

      return this.formatBudget(budget);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error }, 'Failed to fetch budget');
      throw error;
    }
  }

  async create(tenantId: string, branchId: string, data: Record<string, unknown>, userId: string) {
    try {
      const now = new Date();
      const period = data.period as Record<string, unknown>;

      const allocated = data.allocated as number;

      const result = await collections.budgets.insertOne({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        name: data.name,
        description: data.description || null,
        category: data.category || null,
        department: data.department || null,
        academicBatchId: data.academicBatchId ? new ObjectId(data.academicBatchId as string) : null,
        allocated,
        spent: 0,
        remaining: allocated,
        period: {
          startDate: new Date(period.startDate as string),
          endDate: new Date(period.endDate as string),
        },
        status: 'active',
        createdBy: new ObjectId(userId),
        createdAt: now,
        updatedAt: now,
      });

      return this.findById(tenantId, result.insertedId.toString());
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error }, 'Failed to create budget');
      throw error;
    }
  }

  async update(tenantId: string, id: string, data: Record<string, unknown>) {
    try {
      const budget = await collections.budgets.findOne({
        _id: new ObjectId(id),
        tenantId: new ObjectId(tenantId),
      });

      if (!budget) {
        throw new ApiError('NOT_FOUND', 'Budget not found', 404);
      }

      const updateData: Record<string, unknown> = { updatedAt: new Date() };

      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.category !== undefined) updateData.category = data.category;
      if (data.department !== undefined) updateData.department = data.department;

      if (data.allocated !== undefined) {
        const newAllocated = data.allocated as number;
        const diff = newAllocated - (budget.allocated as number);
        updateData.allocated = newAllocated;
        updateData.remaining = (budget.remaining as number) + diff;

        if ((updateData.remaining as number) <= 0) {
          updateData.status = 'exhausted';
        } else if (budget.status === 'exhausted') {
          updateData.status = 'active';
        }
      }

      if (data.period) {
        const period = data.period as Record<string, unknown>;
        updateData.period = {
          startDate: new Date(period.startDate as string),
          endDate: new Date(period.endDate as string),
        };
      }

      const result = await collections.budgets.findOneAndUpdate(
        { _id: new ObjectId(id), tenantId: new ObjectId(tenantId) },
        { $set: updateData },
        { returnDocument: 'after' }
      );

      return this.formatBudget(result!);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error }, 'Failed to update budget');
      throw error;
    }
  }

  async delete(tenantId: string, id: string) {
    try {
      // Check if any expenses are linked to this budget
      const linkedExpenses = await collections.expenses.countDocuments({
        tenantId: new ObjectId(tenantId),
        budgetId: new ObjectId(id),
        status: { $nin: ['draft', 'cancelled'] },
      });

      if (linkedExpenses > 0) {
        throw new ApiError(
          'BUDGET_IN_USE',
          `Cannot delete budget — ${linkedExpenses} active expense(s) are linked to it`,
          400
        );
      }

      const result = await collections.budgets.deleteOne({
        _id: new ObjectId(id),
        tenantId: new ObjectId(tenantId),
      });

      if (result.deletedCount === 0) {
        throw new ApiError('NOT_FOUND', 'Budget not found', 404);
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error }, 'Failed to delete budget');
      throw error;
    }
  }

  private formatBudget(doc: Document) {
    return {
      ...doc,
      _id: doc._id.toString(),
      tenantId: doc.tenantId.toString(),
      branchId: doc.branchId.toString(),
      academicBatchId: doc.academicBatchId?.toString() || null,
      createdBy: doc.createdBy?.toString(),
    };
  }
}

export const budgetService = new BudgetService();

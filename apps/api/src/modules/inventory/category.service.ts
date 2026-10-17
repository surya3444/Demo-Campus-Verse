import { ObjectId, Filter, Document } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';

export interface CategoryListParams {
  page: number;
  limit: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

class CategoryService {
  async findAll(tenantId: string, branchId: string, params: CategoryListParams) {
    try {
      const skip = (params.page - 1) * params.limit;

      const filter: Filter<Document> = {
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
      };

      if (params.search) {
        filter.$or = [
          { name: { $regex: params.search, $options: 'i' } },
          { code: { $regex: params.search, $options: 'i' } },
        ];
      }

      const sortBy = params.sortBy || 'createdAt';
      const sortOrder = params.sortOrder === 'asc' ? 1 : -1;

      const [data, total] = await Promise.all([
        collections.assetCategories
          .find(filter)
          .sort({ [sortBy]: sortOrder, _id: sortOrder })
          .skip(skip)
          .limit(params.limit)
          .toArray(),
        collections.assetCategories.countDocuments(filter),
      ]);

      return {
        data: data.map((doc) => ({
          ...doc,
          _id: doc._id.toString(),
          tenantId: doc.tenantId.toString(),
          branchId: doc.branchId.toString(),
          parentId: doc.parentId?.toString(),
        })),
        meta: {
          page: params.page,
          limit: params.limit,
          total,
          totalPages: Math.ceil(total / params.limit),
          hasMore: skip + params.limit < total,
        },
      };
    } catch (error) {
      logger.error({ err: error }, 'Failed to fetch asset categories');
      throw error;
    }
  }

  async findById(tenantId: string, id: string) {
    try {
      const category = await collections.assetCategories.findOne({
        _id: new ObjectId(id),
        tenantId: new ObjectId(tenantId),
      });

      if (!category) {
        throw new ApiError('NOT_FOUND', 'Asset category not found', 404);
      }

      return {
        ...category,
        _id: category._id.toString(),
        tenantId: category.tenantId.toString(),
        branchId: category.branchId.toString(),
        parentId: category.parentId?.toString(),
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error }, 'Failed to fetch asset category');
      throw error;
    }
  }

  async create(tenantId: string, branchId: string, data: Record<string, unknown>, userId: string) {
    try {
      // Check for duplicate code within the branch
      const existing = await collections.assetCategories.findOne({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        code: data.code,
      });

      if (existing) {
        throw new ApiError('DUPLICATE_ENTRY', 'A category with this code already exists', 409);
      }

      const now = new Date();
      const result = await collections.assetCategories.insertOne({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        name: data.name,
        code: data.code,
        description: data.description || null,
        parentId: data.parentId ? new ObjectId(data.parentId as string) : null,
        createdBy: new ObjectId(userId),
        createdAt: now,
        updatedAt: now,
      });

      return this.findById(tenantId, result.insertedId.toString());
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error }, 'Failed to create asset category');
      throw error;
    }
  }

  async update(tenantId: string, id: string, data: Record<string, unknown>) {
    try {
      // Check duplicate code if code is being changed
      if (data.code) {
        const existing = await collections.assetCategories.findOne({
          tenantId: new ObjectId(tenantId),
          code: data.code,
          _id: { $ne: new ObjectId(id) },
        });

        if (existing) {
          throw new ApiError('DUPLICATE_ENTRY', 'A category with this code already exists', 409);
        }
      }

      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (data.name !== undefined) updateData.name = data.name;
      if (data.code !== undefined) updateData.code = data.code;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.parentId !== undefined) {
        updateData.parentId = data.parentId ? new ObjectId(data.parentId as string) : null;
      }

      const result = await collections.assetCategories.findOneAndUpdate(
        { _id: new ObjectId(id), tenantId: new ObjectId(tenantId) },
        { $set: updateData },
        { returnDocument: 'after' }
      );

      if (!result) {
        throw new ApiError('NOT_FOUND', 'Asset category not found', 404);
      }

      return {
        ...result,
        _id: result._id.toString(),
        tenantId: result.tenantId.toString(),
        branchId: result.branchId.toString(),
        parentId: result.parentId?.toString(),
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error }, 'Failed to update asset category');
      throw error;
    }
  }

  async delete(tenantId: string, id: string) {
    try {
      // Check if any assets use this category
      const assetsUsingCategory = await collections.assets.countDocuments({
        tenantId: new ObjectId(tenantId),
        categoryId: new ObjectId(id),
      });

      if (assetsUsingCategory > 0) {
        throw new ApiError(
          'CATEGORY_IN_USE',
          `Cannot delete category — ${assetsUsingCategory} asset(s) are using it`,
          400
        );
      }

      const result = await collections.assetCategories.deleteOne({
        _id: new ObjectId(id),
        tenantId: new ObjectId(tenantId),
      });

      if (result.deletedCount === 0) {
        throw new ApiError('NOT_FOUND', 'Asset category not found', 404);
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error }, 'Failed to delete asset category');
      throw error;
    }
  }
}

export const categoryService = new CategoryService();

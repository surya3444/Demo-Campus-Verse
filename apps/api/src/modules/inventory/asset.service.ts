import { ObjectId, Filter, Document } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { generateAssetCode } from '../../utils/generators';

export interface AssetListParams {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  condition?: string;
  categoryId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

class AssetService {
  async findAll(tenantId: string, branchId: string, params: AssetListParams) {
    try {
      const skip = (params.page - 1) * params.limit;

      const filter: Filter<Document> = {
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
      };

      if (params.search) {
        filter.$or = [
          { name: { $regex: params.search, $options: 'i' } },
          { assetCode: { $regex: params.search, $options: 'i' } },
          { serialNumber: { $regex: params.search, $options: 'i' } },
          { location: { $regex: params.search, $options: 'i' } },
        ];
      }

      if (params.status) filter.status = params.status;
      if (params.condition) filter.condition = params.condition;
      if (params.categoryId) filter.categoryId = new ObjectId(params.categoryId);

      const sortBy = params.sortBy || 'createdAt';
      const sortOrder = params.sortOrder === 'asc' ? 1 : -1;

      const [data, total] = await Promise.all([
        collections.assets
          .find(filter)
          .sort({ [sortBy]: sortOrder, _id: sortOrder })
          .skip(skip)
          .limit(params.limit)
          .toArray(),
        collections.assets.countDocuments(filter),
      ]);

      return {
        data: data.map((doc) => this.formatAsset(doc)),
        meta: {
          page: params.page,
          limit: params.limit,
          total,
          totalPages: Math.ceil(total / params.limit),
          hasMore: skip + params.limit < total,
        },
      };
    } catch (error) {
      logger.error({ err: error }, 'Failed to fetch assets');
      throw error;
    }
  }

  async getStats(tenantId: string, branchId: string) {
    try {
      const filter = {
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
      };

      const [total, available, issued, maintenance, totalValue] = await Promise.all([
        collections.assets.countDocuments(filter),
        collections.assets.countDocuments({ ...filter, status: 'available' }),
        collections.assets.countDocuments({ ...filter, status: 'issued' }),
        collections.assets.countDocuments({ ...filter, status: 'maintenance' }),
        collections.assets
          .aggregate([
            { $match: filter },
            { $group: { _id: null, totalValue: { $sum: '$currentValue' } } },
          ])
          .toArray(),
      ]);

      return {
        total,
        available,
        issued,
        maintenance,
        totalValue: totalValue[0]?.totalValue || 0,
      };
    } catch (error) {
      logger.error({ err: error }, 'Failed to fetch asset stats');
      throw error;
    }
  }

  async findById(tenantId: string, id: string) {
    try {
      const asset = await collections.assets.findOne({
        _id: new ObjectId(id),
        tenantId: new ObjectId(tenantId),
      });

      if (!asset) {
        throw new ApiError('NOT_FOUND', 'Asset not found', 404);
      }

      return this.formatAsset(asset);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error }, 'Failed to fetch asset');
      throw error;
    }
  }

  async create(tenantId: string, branchId: string, data: Record<string, unknown>, userId: string) {
    try {
      const assetCode = await generateAssetCode(tenantId, branchId);
      const now = new Date();

      // Resolve category name if categoryId is provided
      let categoryName: string | null = null;
      if (data.categoryId) {
        const category = await collections.assetCategories.findOne({
          _id: new ObjectId(data.categoryId as string),
          tenantId: new ObjectId(tenantId),
        });
        categoryName = category?.name || null;
      }

      const result = await collections.assets.insertOne({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        assetCode,
        name: data.name,
        description: data.description || null,
        categoryId: data.categoryId ? new ObjectId(data.categoryId as string) : null,
        categoryName,
        location: data.location || null,
        serialNumber: data.serialNumber || null,
        modelNumber: data.modelNumber || null,
        manufacturer: data.manufacturer || null,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate as string) : null,
        purchasePrice: data.purchasePrice || 0,
        currentValue: data.currentValue ?? data.purchasePrice ?? 0,
        warrantyExpiry: data.warrantyExpiry ? new Date(data.warrantyExpiry as string) : null,
        condition: data.condition || 'new',
        status: data.status || 'available',
        assignedTo: null,
        tags: data.tags || [],
        quantity: data.quantity || 1,
        unit: data.unit || 'piece',
        createdBy: new ObjectId(userId),
        createdAt: now,
        updatedAt: now,
      });

      return this.findById(tenantId, result.insertedId.toString());
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error }, 'Failed to create asset');
      throw error;
    }
  }

  async update(tenantId: string, id: string, data: Record<string, unknown>) {
    try {
      const updateData: Record<string, unknown> = { updatedAt: new Date() };

      const fields = [
        'name',
        'description',
        'location',
        'serialNumber',
        'modelNumber',
        'manufacturer',
        'purchasePrice',
        'currentValue',
        'condition',
        'status',
        'tags',
        'quantity',
        'unit',
      ];

      for (const field of fields) {
        if (data[field] !== undefined) updateData[field] = data[field];
      }

      if (data.categoryId !== undefined) {
        if (data.categoryId) {
          updateData.categoryId = new ObjectId(data.categoryId as string);
          const category = await collections.assetCategories.findOne({
            _id: new ObjectId(data.categoryId as string),
            tenantId: new ObjectId(tenantId),
          });
          updateData.categoryName = category?.name || null;
        } else {
          updateData.categoryId = null;
          updateData.categoryName = null;
        }
      }

      if (data.purchaseDate !== undefined) {
        updateData.purchaseDate = data.purchaseDate ? new Date(data.purchaseDate as string) : null;
      }
      if (data.warrantyExpiry !== undefined) {
        updateData.warrantyExpiry = data.warrantyExpiry
          ? new Date(data.warrantyExpiry as string)
          : null;
      }

      const result = await collections.assets.findOneAndUpdate(
        { _id: new ObjectId(id), tenantId: new ObjectId(tenantId) },
        { $set: updateData },
        { returnDocument: 'after' }
      );

      if (!result) {
        throw new ApiError('NOT_FOUND', 'Asset not found', 404);
      }

      return this.formatAsset(result);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error }, 'Failed to update asset');
      throw error;
    }
  }

  async delete(tenantId: string, id: string) {
    try {
      // Check if asset is currently issued
      const asset = await collections.assets.findOne({
        _id: new ObjectId(id),
        tenantId: new ObjectId(tenantId),
      });

      if (!asset) {
        throw new ApiError('NOT_FOUND', 'Asset not found', 404);
      }

      if (asset.status === 'issued') {
        throw new ApiError(
          'ASSET_ISSUED',
          'Cannot delete an asset that is currently issued. Return it first.',
          400
        );
      }

      await collections.assets.deleteOne({
        _id: new ObjectId(id),
        tenantId: new ObjectId(tenantId),
      });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error }, 'Failed to delete asset');
      throw error;
    }
  }

  private formatAsset(doc: Document) {
    return {
      ...doc,
      _id: doc._id.toString(),
      tenantId: doc.tenantId.toString(),
      branchId: doc.branchId.toString(),
      categoryId: doc.categoryId?.toString() || null,
      sourceId: doc.sourceId?.toString() || null,
      assignedTo: doc.assignedTo
        ? {
            ...doc.assignedTo,
            userId: doc.assignedTo.userId?.toString(),
          }
        : null,
      createdBy: doc.createdBy?.toString(),
    };
  }
}

export const assetService = new AssetService();

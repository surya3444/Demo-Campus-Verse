import { ObjectId, Filter, Document } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { generateProcurementNumber, generateAssetCode } from '../../utils/generators';

export interface ProcurementListParams {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

class ProcurementService {
  async findAll(tenantId: string, branchId: string, params: ProcurementListParams) {
    try {
      const skip = (params.page - 1) * params.limit;

      const filter: Filter<Document> = {
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
      };

      if (params.search) {
        filter.$or = [
          { title: { $regex: params.search, $options: 'i' } },
          { procurementNumber: { $regex: params.search, $options: 'i' } },
          { 'vendor.name': { $regex: params.search, $options: 'i' } },
        ];
      }

      if (params.status) filter.status = params.status;

      const sortBy = params.sortBy || 'createdAt';
      const sortOrder = params.sortOrder === 'asc' ? 1 : -1;

      const [data, total] = await Promise.all([
        collections.procurements
          .find(filter)
          .sort({ [sortBy]: sortOrder, _id: sortOrder })
          .skip(skip)
          .limit(params.limit)
          .toArray(),
        collections.procurements.countDocuments(filter),
      ]);

      return {
        data: data.map((doc) => this.formatProcurement(doc)),
        meta: {
          page: params.page,
          limit: params.limit,
          total,
          totalPages: Math.ceil(total / params.limit),
          hasMore: skip + params.limit < total,
        },
      };
    } catch (error) {
      logger.error({ err: error }, 'Failed to fetch procurements');
      throw error;
    }
  }

  async findById(tenantId: string, id: string) {
    try {
      const procurement = await collections.procurements.findOne({
        _id: new ObjectId(id),
        tenantId: new ObjectId(tenantId),
      });

      if (!procurement) {
        throw new ApiError('NOT_FOUND', 'Procurement not found', 404);
      }

      return this.formatProcurement(procurement);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error }, 'Failed to fetch procurement');
      throw error;
    }
  }

  async create(tenantId: string, branchId: string, data: Record<string, unknown>, userId: string) {
    try {
      const procurementNumber = await generateProcurementNumber(tenantId, branchId);
      const now = new Date();

      const items = (data.items as Array<Record<string, unknown>>).map((item) => ({
        name: item.name,
        categoryId: item.categoryId ? new ObjectId(item.categoryId as string) : null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: (item.quantity as number) * (item.unitPrice as number),
      }));

      const totalAmount = items.reduce((sum, item) => sum + item.totalPrice, 0);

      const vendor = data.vendor as Record<string, unknown>;

      const result = await collections.procurements.insertOne({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        procurementNumber,
        title: data.title,
        description: data.description || null,
        items,
        vendor: {
          name: vendor.name,
          contact: vendor.contact || null,
          email: vendor.email || null,
        },
        status: 'draft',
        totalAmount,
        approvedBy: null,
        approvedAt: null,
        expectedDate: data.expectedDate ? new Date(data.expectedDate as string) : null,
        receivedDate: null,
        remarks: data.remarks || null,
        createdBy: new ObjectId(userId),
        createdAt: now,
        updatedAt: now,
      });

      return this.findById(tenantId, result.insertedId.toString());
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error }, 'Failed to create procurement');
      throw error;
    }
  }

  async update(tenantId: string, id: string, data: Record<string, unknown>) {
    try {
      const procurement = await collections.procurements.findOne({
        _id: new ObjectId(id),
        tenantId: new ObjectId(tenantId),
      });

      if (!procurement) {
        throw new ApiError('NOT_FOUND', 'Procurement not found', 404);
      }

      if (!['draft', 'submitted'].includes(procurement.status)) {
        throw new ApiError(
          'INVALID_STATUS',
          'Only draft or submitted procurements can be edited',
          400
        );
      }

      const updateData: Record<string, unknown> = { updatedAt: new Date() };

      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.remarks !== undefined) updateData.remarks = data.remarks;
      if (data.expectedDate !== undefined) {
        updateData.expectedDate = data.expectedDate ? new Date(data.expectedDate as string) : null;
      }

      if (data.vendor) {
        const vendor = data.vendor as Record<string, unknown>;
        updateData.vendor = {
          name: vendor.name,
          contact: vendor.contact || null,
          email: vendor.email || null,
        };
      }

      if (data.items) {
        const items = (data.items as Array<Record<string, unknown>>).map((item) => ({
          name: item.name,
          categoryId: item.categoryId ? new ObjectId(item.categoryId as string) : null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: (item.quantity as number) * (item.unitPrice as number),
        }));
        updateData.items = items;
        updateData.totalAmount = items.reduce((sum, item) => sum + item.totalPrice, 0);
      }

      const result = await collections.procurements.findOneAndUpdate(
        { _id: new ObjectId(id), tenantId: new ObjectId(tenantId) },
        { $set: updateData },
        { returnDocument: 'after' }
      );

      if (!result) {
        throw new ApiError('NOT_FOUND', 'Procurement not found', 404);
      }

      return this.formatProcurement(result);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error }, 'Failed to update procurement');
      throw error;
    }
  }

  async approve(tenantId: string, id: string, userId: string, userName: string) {
    try {
      const procurement = await collections.procurements.findOne({
        _id: new ObjectId(id),
        tenantId: new ObjectId(tenantId),
      });

      if (!procurement) {
        throw new ApiError('NOT_FOUND', 'Procurement not found', 404);
      }

      if (procurement.status !== 'submitted') {
        throw new ApiError('INVALID_STATUS', 'Only submitted procurements can be approved', 400);
      }

      const result = await collections.procurements.findOneAndUpdate(
        { _id: new ObjectId(id), tenantId: new ObjectId(tenantId) },
        {
          $set: {
            status: 'approved',
            approvedBy: new ObjectId(userId),
            approvedByName: userName,
            approvedAt: new Date(),
            updatedAt: new Date(),
          },
        },
        { returnDocument: 'after' }
      );

      return this.formatProcurement(result!);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error }, 'Failed to approve procurement');
      throw error;
    }
  }

  async receive(tenantId: string, branchId: string, id: string, userId: string) {
    try {
      const procurement = await collections.procurements.findOne({
        _id: new ObjectId(id),
        tenantId: new ObjectId(tenantId),
      });

      if (!procurement) {
        throw new ApiError('NOT_FOUND', 'Procurement not found', 404);
      }

      if (!['approved', 'ordered'].includes(procurement.status)) {
        throw new ApiError(
          'INVALID_STATUS',
          'Only approved or ordered procurements can be marked as received',
          400
        );
      }

      const now = new Date();

      // Create assets from procurement items
      const assetDocs = [];
      for (const item of procurement.items) {
        for (let i = 0; i < item.quantity; i++) {
          const assetCode = await generateAssetCode(tenantId, branchId);
          assetDocs.push({
            tenantId: new ObjectId(tenantId),
            branchId: new ObjectId(branchId),
            assetCode,
            name: item.name,
            description: null,
            categoryId: item.categoryId || null,
            categoryName: null,
            location: null,
            serialNumber: null,
            modelNumber: null,
            manufacturer: null,
            purchaseDate: now,
            purchasePrice: item.unitPrice,
            currentValue: item.unitPrice,
            warrantyExpiry: null,
            condition: 'new',
            status: 'available',
            assignedTo: null,
            tags: [],
            quantity: 1,
            unit: 'piece',
            procurementId: procurement._id,
            createdBy: new ObjectId(userId),
            createdAt: now,
            updatedAt: now,
          });
        }
      }

      if (assetDocs.length > 0) {
        await collections.assets.insertMany(assetDocs);
      }

      // Update procurement status
      const result = await collections.procurements.findOneAndUpdate(
        { _id: new ObjectId(id), tenantId: new ObjectId(tenantId) },
        {
          $set: {
            status: 'received',
            receivedDate: now,
            updatedAt: now,
          },
        },
        { returnDocument: 'after' }
      );

      return {
        procurement: this.formatProcurement(result!),
        assetsCreated: assetDocs.length,
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error }, 'Failed to receive procurement');
      throw error;
    }
  }

  private formatProcurement(doc: Document) {
    return {
      ...doc,
      _id: doc._id.toString(),
      tenantId: doc.tenantId.toString(),
      branchId: doc.branchId.toString(),
      approvedBy: doc.approvedBy?.toString() || null,
      createdBy: doc.createdBy?.toString(),
      items: (doc.items || []).map((item: Record<string, unknown>) => ({
        ...item,
        categoryId: item.categoryId?.toString() || null,
      })),
    };
  }
}

export const procurementService = new ProcurementService();

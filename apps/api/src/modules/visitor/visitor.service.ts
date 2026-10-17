import { ObjectId, Filter, Document } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { generateVisitorCode } from '../../utils/generators';

export interface VisitorListParams {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  purpose?: string;
  type?: string;
  date?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

class VisitorService {
  async findAll(tenantId: string, branchId: string, params: VisitorListParams) {
    try {
      const skip = (params.page - 1) * params.limit;

      const filter: Filter<Document> = {
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
      };

      if (params.search) {
        filter.$or = [
          { name: { $regex: params.search, $options: 'i' } },
          { phone: { $regex: params.search, $options: 'i' } },
          { visitorCode: { $regex: params.search, $options: 'i' } },
          { hostName: { $regex: params.search, $options: 'i' } },
          { company: { $regex: params.search, $options: 'i' } },
        ];
      }

      if (params.status) filter.status = params.status;
      if (params.purpose) filter.purpose = params.purpose;
      if (params.type) filter.type = params.type;

      if (params.date) {
        const dateStart = new Date(params.date);
        dateStart.setHours(0, 0, 0, 0);
        const dateEnd = new Date(params.date);
        dateEnd.setHours(23, 59, 59, 999);
        filter.createdAt = { $gte: dateStart, $lte: dateEnd };
      }

      const sortBy = params.sortBy || 'createdAt';
      const sortOrder = params.sortOrder === 'asc' ? 1 : -1;

      const [data, total] = await Promise.all([
        collections.visitors
          .find(filter)
          .sort({ [sortBy]: sortOrder, _id: sortOrder })
          .skip(skip)
          .limit(params.limit)
          .toArray(),
        collections.visitors.countDocuments(filter),
      ]);

      return {
        data: data.map((doc) => this.formatVisitor(doc)),
        meta: {
          page: params.page,
          limit: params.limit,
          total,
          totalPages: Math.ceil(total / params.limit),
          hasMore: skip + params.limit < total,
        },
      };
    } catch (error) {
      logger.error({ err: error }, 'Failed to fetch visitors');
      throw error;
    }
  }

  async getStats(tenantId: string, branchId: string) {
    try {
      const baseFilter = {
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
      };

      // Today's date range
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const todayFilter = {
        ...baseFilter,
        createdAt: { $gte: todayStart, $lte: todayEnd },
      };

      const [todayTotal, checkedIn, preRegistered, checkedOut] = await Promise.all([
        collections.visitors.countDocuments(todayFilter),
        collections.visitors.countDocuments({ ...baseFilter, status: 'checked_in' }),
        collections.visitors.countDocuments({
          ...baseFilter,
          status: 'pre_registered',
          expectedDate: { $gte: todayStart, $lte: todayEnd },
        }),
        collections.visitors.countDocuments({
          ...todayFilter,
          status: 'checked_out',
        }),
      ]);

      return {
        todayTotal,
        checkedIn,
        preRegistered,
        checkedOut,
      };
    } catch (error) {
      logger.error({ err: error }, 'Failed to fetch visitor stats');
      throw error;
    }
  }

  async findById(tenantId: string, id: string) {
    try {
      const visitor = await collections.visitors.findOne({
        _id: new ObjectId(id),
        tenantId: new ObjectId(tenantId),
      });

      if (!visitor) {
        throw new ApiError('NOT_FOUND', 'Visitor not found', 404);
      }

      return this.formatVisitor(visitor);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error }, 'Failed to fetch visitor');
      throw error;
    }
  }

  async create(tenantId: string, branchId: string, data: Record<string, unknown>, userId: string) {
    try {
      const visitorCode = await generateVisitorCode(tenantId, branchId);
      const now = new Date();

      const isPreRegistered = data.type === 'pre_registered';

      const result = await collections.visitors.insertOne({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        visitorCode,
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        company: data.company || null,
        photoUrl: data.photoUrl || null,
        idType: data.idType || null,
        idNumber: data.idNumber || null,
        purpose: data.purpose,
        hostName: data.hostName,
        hostDepartment: data.hostDepartment || null,
        hostUserId: data.hostUserId ? new ObjectId(data.hostUserId as string) : null,
        numberOfVisitors: data.numberOfVisitors || 1,
        vehicleNumber: data.vehicleNumber || null,
        belongings: data.belongings || null,
        type: data.type || 'walk_in',
        expectedDate: data.expectedDate ? new Date(data.expectedDate as string) : null,
        expectedTime: data.expectedTime || null,
        status: isPreRegistered ? 'pre_registered' : 'checked_in',
        checkInTime: isPreRegistered ? null : now,
        checkOutTime: null,
        checkedInBy: isPreRegistered ? null : new ObjectId(userId),
        checkedOutBy: null,
        passCode: null,
        passIssuedAt: null,
        passExpiresAt: null,
        remarks: data.remarks || null,
        createdBy: new ObjectId(userId),
        createdAt: now,
        updatedAt: now,
      });

      return this.findById(tenantId, result.insertedId.toString());
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error }, 'Failed to create visitor');
      throw error;
    }
  }

  async update(tenantId: string, id: string, data: Record<string, unknown>) {
    try {
      const updateData: Record<string, unknown> = { updatedAt: new Date() };

      const fields = [
        'name',
        'phone',
        'email',
        'company',
        'photoUrl',
        'idType',
        'idNumber',
        'purpose',
        'hostName',
        'hostDepartment',
        'numberOfVisitors',
        'vehicleNumber',
        'belongings',
        'expectedTime',
        'remarks',
      ];

      for (const field of fields) {
        if (data[field] !== undefined) updateData[field] = data[field];
      }

      if (data.hostUserId !== undefined) {
        updateData.hostUserId = data.hostUserId ? new ObjectId(data.hostUserId as string) : null;
      }

      if (data.expectedDate !== undefined) {
        updateData.expectedDate = data.expectedDate ? new Date(data.expectedDate as string) : null;
      }

      const result = await collections.visitors.findOneAndUpdate(
        { _id: new ObjectId(id), tenantId: new ObjectId(tenantId) },
        { $set: updateData },
        { returnDocument: 'after' }
      );

      if (!result) {
        throw new ApiError('NOT_FOUND', 'Visitor not found', 404);
      }

      return this.formatVisitor(result);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error }, 'Failed to update visitor');
      throw error;
    }
  }

  async delete(tenantId: string, id: string) {
    try {
      const visitor = await collections.visitors.findOne({
        _id: new ObjectId(id),
        tenantId: new ObjectId(tenantId),
      });

      if (!visitor) {
        throw new ApiError('NOT_FOUND', 'Visitor not found', 404);
      }

      if (visitor.status === 'checked_in') {
        throw new ApiError(
          'VISITOR_CHECKED_IN',
          'Cannot delete a visitor who is currently checked in. Check them out first.',
          400
        );
      }

      await collections.visitors.deleteOne({
        _id: new ObjectId(id),
        tenantId: new ObjectId(tenantId),
      });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error }, 'Failed to delete visitor');
      throw error;
    }
  }

  async checkIn(tenantId: string, id: string, userId: string) {
    try {
      const visitor = await collections.visitors.findOne({
        _id: new ObjectId(id),
        tenantId: new ObjectId(tenantId),
      });

      if (!visitor) {
        throw new ApiError('NOT_FOUND', 'Visitor not found', 404);
      }

      if (visitor.status !== 'pre_registered') {
        throw new ApiError(
          'INVALID_STATUS',
          `Cannot check in a visitor with status "${visitor.status}". Only pre-registered visitors can be checked in.`,
          400
        );
      }

      const now = new Date();
      const result = await collections.visitors.findOneAndUpdate(
        { _id: new ObjectId(id), tenantId: new ObjectId(tenantId) },
        {
          $set: {
            status: 'checked_in',
            checkInTime: now,
            checkedInBy: new ObjectId(userId),
            updatedAt: now,
          },
        },
        { returnDocument: 'after' }
      );

      return this.formatVisitor(result!);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error }, 'Failed to check in visitor');
      throw error;
    }
  }

  async checkOut(tenantId: string, id: string, userId: string) {
    try {
      const visitor = await collections.visitors.findOne({
        _id: new ObjectId(id),
        tenantId: new ObjectId(tenantId),
      });

      if (!visitor) {
        throw new ApiError('NOT_FOUND', 'Visitor not found', 404);
      }

      if (visitor.status !== 'checked_in') {
        throw new ApiError(
          'INVALID_STATUS',
          `Cannot check out a visitor with status "${visitor.status}". Only checked-in visitors can be checked out.`,
          400
        );
      }

      const now = new Date();
      const result = await collections.visitors.findOneAndUpdate(
        { _id: new ObjectId(id), tenantId: new ObjectId(tenantId) },
        {
          $set: {
            status: 'checked_out',
            checkOutTime: now,
            checkedOutBy: new ObjectId(userId),
            updatedAt: now,
          },
        },
        { returnDocument: 'after' }
      );

      return this.formatVisitor(result!);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error }, 'Failed to check out visitor');
      throw error;
    }
  }

  private formatVisitor(doc: Document) {
    return {
      ...doc,
      _id: doc._id.toString(),
      tenantId: doc.tenantId.toString(),
      branchId: doc.branchId.toString(),
      hostUserId: doc.hostUserId?.toString() || null,
      checkedInBy: doc.checkedInBy?.toString() || null,
      checkedOutBy: doc.checkedOutBy?.toString() || null,
      createdBy: doc.createdBy?.toString(),
    };
  }
}

export const visitorService = new VisitorService();

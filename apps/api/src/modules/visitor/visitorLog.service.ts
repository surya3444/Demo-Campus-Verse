import { ObjectId, Filter, Document } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';

export interface LogQueryParams {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  purpose?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

class VisitorLogService {
  async getLogs(tenantId: string, branchId: string, params: LogQueryParams) {
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

      if (params.dateFrom || params.dateTo) {
        const dateFilter: Record<string, Date> = {};
        if (params.dateFrom) {
          const from = new Date(params.dateFrom);
          from.setHours(0, 0, 0, 0);
          dateFilter.$gte = from;
        }
        if (params.dateTo) {
          const to = new Date(params.dateTo);
          to.setHours(23, 59, 59, 999);
          dateFilter.$lte = to;
        }
        filter.createdAt = dateFilter;
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
        data: data.map((doc) => this.formatLog(doc)),
        meta: {
          page: params.page,
          limit: params.limit,
          total,
          totalPages: Math.ceil(total / params.limit),
          hasMore: skip + params.limit < total,
        },
      };
    } catch (error) {
      logger.error({ err: error }, 'Failed to fetch visitor logs');
      throw error;
    }
  }

  async exportLogs(
    tenantId: string,
    branchId: string,
    params: Omit<LogQueryParams, 'page' | 'limit'>
  ) {
    try {
      const filter: Filter<Document> = {
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
      };

      if (params.search) {
        filter.$or = [
          { name: { $regex: params.search, $options: 'i' } },
          { phone: { $regex: params.search, $options: 'i' } },
          { hostName: { $regex: params.search, $options: 'i' } },
        ];
      }

      if (params.status) filter.status = params.status;
      if (params.purpose) filter.purpose = params.purpose;

      if (params.dateFrom || params.dateTo) {
        const dateFilter: Record<string, Date> = {};
        if (params.dateFrom) {
          const from = new Date(params.dateFrom);
          from.setHours(0, 0, 0, 0);
          dateFilter.$gte = from;
        }
        if (params.dateTo) {
          const to = new Date(params.dateTo);
          to.setHours(23, 59, 59, 999);
          dateFilter.$lte = to;
        }
        filter.createdAt = dateFilter;
      }

      const data = await collections.visitors
        .find(filter)
        .sort({ createdAt: -1 })
        .limit(5000)
        .toArray();

      // Build CSV
      const headers = [
        'Visitor Code',
        'Name',
        'Phone',
        'Email',
        'Company',
        'Purpose',
        'Host',
        'Department',
        'Visitors',
        'Vehicle',
        'Type',
        'Status',
        'Check In',
        'Check Out',
        'Pass Code',
        'Remarks',
        'Created At',
      ];

      const rows = data.map((doc) => [
        doc.visitorCode || '',
        doc.name || '',
        doc.phone || '',
        doc.email || '',
        doc.company || '',
        doc.purpose || '',
        doc.hostName || '',
        doc.hostDepartment || '',
        doc.numberOfVisitors || 1,
        doc.vehicleNumber || '',
        doc.type || '',
        doc.status || '',
        doc.checkInTime ? new Date(doc.checkInTime).toISOString() : '',
        doc.checkOutTime ? new Date(doc.checkOutTime).toISOString() : '',
        doc.passCode || '',
        doc.remarks || '',
        doc.createdAt ? new Date(doc.createdAt).toISOString() : '',
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');

      return csvContent;
    } catch (error) {
      logger.error({ err: error }, 'Failed to export visitor logs');
      throw error;
    }
  }

  private formatLog(doc: Document) {
    return {
      _id: doc._id.toString(),
      visitorCode: doc.visitorCode,
      name: doc.name,
      phone: doc.phone,
      email: doc.email,
      company: doc.company,
      purpose: doc.purpose,
      hostName: doc.hostName,
      hostDepartment: doc.hostDepartment,
      numberOfVisitors: doc.numberOfVisitors,
      vehicleNumber: doc.vehicleNumber,
      type: doc.type,
      status: doc.status,
      checkInTime: doc.checkInTime,
      checkOutTime: doc.checkOutTime,
      passCode: doc.passCode,
      remarks: doc.remarks,
      createdAt: doc.createdAt,
    };
  }
}

export const visitorLogService = new VisitorLogService();

import { ObjectId, WithId, Document, Filter, UpdateFilter } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';

interface ConcessionDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  studentId: ObjectId;
  feeAssignmentId: ObjectId;
  academicBatchId: ObjectId;
  type: 'scholarship' | 'staff-ward' | 'sibling' | 'merit' | 'need-based' | 'custom';
  name: string;
  reason: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  calculatedAmount: number;
  appliedTo: string[];
  status: 'pending' | 'approved' | 'rejected';
  requestedBy: ObjectId;
  requestedAt: Date;
  approvedBy?: ObjectId;
  approvedAt?: Date;
  rejectionReason?: string;
  documents: Array<{ type: string; url: string }>;
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateConcessionInput {
  studentId: string;
  feeAssignmentId: string;
  academicBatchId: string;
  type: 'scholarship' | 'staff-ward' | 'sibling' | 'merit' | 'need-based' | 'custom';
  name: string;
  reason: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  appliedTo: string[];
  documents?: Array<{ type: string; url: string }>;
  remarks?: string;
}

export interface ConcessionListParams {
  page?: number;
  limit?: number;
  studentId?: string;
  academicBatchId?: string;
  type?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

class ConcessionService {
  async create(
    tenantId: string,
    branchId: string,
    data: CreateConcessionInput,
    requestedBy: string
  ) {
    // Get fee assignment
    const assignment = await collections.feeAssignments.findOne({
      _id: new ObjectId(data.feeAssignmentId),
      tenantId: new ObjectId(tenantId),
    });

    if (!assignment) {
      throw new ApiError('FEE_ASSIGNMENT_NOT_FOUND', 'Fee assignment not found', 404);
    }

    // Calculate concession amount
    let calculatedAmount = 0;
    const components = (assignment.components || []) as Array<{
      componentCode: string;
      originalAmount: number;
    }>;

    if (data.appliedTo.length === 0) {
      // Apply to all components
      const totalApplicable = components.reduce((sum, c) => sum + c.originalAmount, 0);
      if (data.discountType === 'percentage') {
        calculatedAmount = (totalApplicable * data.discountValue) / 100;
      } else {
        calculatedAmount = data.discountValue;
      }
    } else {
      // Apply to specific components
      const applicableComponents = components.filter((c) =>
        data.appliedTo.includes(c.componentCode)
      );
      const totalApplicable = applicableComponents.reduce((sum, c) => sum + c.originalAmount, 0);

      if (data.discountType === 'percentage') {
        calculatedAmount = (totalApplicable * data.discountValue) / 100;
      } else {
        calculatedAmount = Math.min(data.discountValue, totalApplicable);
      }
    }

    const concessionId = new ObjectId();
    const now = new Date();

    const concession: Omit<ConcessionDocument, '_id'> & { _id: ObjectId } = {
      _id: concessionId,
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      studentId: new ObjectId(data.studentId),
      feeAssignmentId: new ObjectId(data.feeAssignmentId),
      academicBatchId: new ObjectId(data.academicBatchId),
      type: data.type,
      name: data.name,
      reason: data.reason,
      discountType: data.discountType,
      discountValue: data.discountValue,
      calculatedAmount,
      appliedTo: data.appliedTo,
      status: 'pending',
      requestedBy: new ObjectId(requestedBy),
      requestedAt: now,
      documents: data.documents || [],
      remarks: data.remarks,
      createdAt: now,
      updatedAt: now,
    };

    await collections.concessions.insertOne(concession);

    logger.info(
      {
        concessionId: concessionId.toString(),
        studentId: data.studentId,
        amount: calculatedAmount,
      },
      'Concession requested'
    );

    return this.formatConcession(concession as WithId<ConcessionDocument>);
  }

  async findById(tenantId: string, concessionId: string) {
    const concession = (await collections.concessions.findOne({
      _id: new ObjectId(concessionId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<ConcessionDocument> | null;

    if (!concession) {
      throw new ApiError('CONCESSION_NOT_FOUND', 'Concession not found', 404);
    }

    return this.formatConcession(concession);
  }

  async findAll(tenantId: string, branchId: string, params: ConcessionListParams = {}) {
    const {
      page = 1,
      limit = 20,
      studentId,
      academicBatchId,
      type,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    if (studentId) {
      filter.studentId = new ObjectId(studentId);
    }

    if (academicBatchId) {
      filter.academicBatchId = new ObjectId(academicBatchId);
    }

    if (type) {
      filter.type = type;
    }

    if (status) {
      filter.status = status;
    }

    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    // Aggregate with student lookup
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
      { $sort: { [sortBy]: sortDirection, _id: sortDirection } },
      { $skip: skip },
      { $limit: limit },
    ];

    const [concessions, totalResult] = await Promise.all([
      collections.concessions.aggregate(pipeline).toArray(),
      collections.concessions.countDocuments(filter),
    ]);

    return {
      data: concessions.map((c) => this.formatConcessionWithStudent(c)),
      meta: {
        page,
        limit,
        total: totalResult,
        totalPages: Math.ceil(totalResult / limit),
        hasMore: skip + concessions.length < totalResult,
      },
    };
  }

  async approve(tenantId: string, concessionId: string, approvedBy: string) {
    const concession = (await collections.concessions.findOne({
      _id: new ObjectId(concessionId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<ConcessionDocument> | null;

    if (!concession) {
      throw new ApiError('CONCESSION_NOT_FOUND', 'Concession not found', 404);
    }

    if (concession.status !== 'pending') {
      throw new ApiError('ALREADY_PROCESSED', 'Concession has already been processed', 400);
    }

    const now = new Date();

    await collections.concessions.updateOne(
      { _id: new ObjectId(concessionId) },
      {
        $set: {
          status: 'approved',
          approvedBy: new ObjectId(approvedBy),
          approvedAt: now,
          updatedAt: now,
        },
      }
    );

    // Update fee assignment
    const assignment = (await collections.feeAssignments.findOne({
      _id: concession.feeAssignmentId,
    })) as WithId<Document> | null;

    if (assignment) {
      // Add concession to assignment
      const concessionEntry = {
        concessionId: concession._id,
        type: concession.type,
        amount: concession.calculatedAmount,
        appliedTo: concession.appliedTo,
      };

      // Update component discounts
      const components = (assignment.components || []).map(
        (c: {
          componentCode: string;
          name: string;
          originalAmount: number;
          discountAmount: number;
          finalAmount: number;
          taxAmount: number;
          totalAmount: number;
        }) => {
          if (concession.appliedTo.length === 0 || concession.appliedTo.includes(c.componentCode)) {
            let additionalDiscount = 0;
            if (concession.discountType === 'percentage') {
              additionalDiscount = (c.originalAmount * concession.discountValue) / 100;
            } else {
              // Proportionally distribute fixed discount
              const totalApplicable = (assignment.components || [])
                .filter(
                  (comp: { componentCode: string }) =>
                    concession.appliedTo.length === 0 ||
                    concession.appliedTo.includes(comp.componentCode)
                )
                .reduce(
                  (sum: number, comp: { originalAmount: number }) => sum + comp.originalAmount,
                  0
                );
              additionalDiscount =
                (c.originalAmount / totalApplicable) * concession.calculatedAmount;
            }

            const newDiscountAmount = c.discountAmount + additionalDiscount;
            const newFinalAmount = c.originalAmount - newDiscountAmount;
            const newTaxAmount =
              c.taxAmount > 0 ? newFinalAmount * (c.taxAmount / (c.finalAmount || 1)) : 0;
            const newTotalAmount = newFinalAmount + newTaxAmount;

            return {
              ...c,
              discountAmount: newDiscountAmount,
              finalAmount: newFinalAmount,
              taxAmount: newTaxAmount,
              totalAmount: newTotalAmount,
            };
          }
          return c;
        }
      );

      const newTotalDiscount =
        (assignment.summary?.totalDiscount || 0) + concession.calculatedAmount;
      const newNetPayable = components.reduce(
        (sum: number, c: { totalAmount: number }) => sum + c.totalAmount,
        0
      );
      const newBalance = newNetPayable - (assignment.summary?.totalPaid || 0);

      await collections.feeAssignments.updateOne({ _id: concession.feeAssignmentId }, {
        $set: {
          components,
          'summary.totalDiscount': newTotalDiscount,
          'summary.netPayable': newNetPayable,
          'summary.balance': newBalance,
          updatedAt: now,
        },
        $push: { concessions: concessionEntry },
      } as unknown as UpdateFilter<Document>);
    }

    logger.info({ concessionId, approvedBy }, 'Concession approved');

    return this.findById(tenantId, concessionId);
  }

  async reject(tenantId: string, concessionId: string, reason: string, rejectedBy: string) {
    const concession = (await collections.concessions.findOne({
      _id: new ObjectId(concessionId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<ConcessionDocument> | null;

    if (!concession) {
      throw new ApiError('CONCESSION_NOT_FOUND', 'Concession not found', 404);
    }

    if (concession.status !== 'pending') {
      throw new ApiError('ALREADY_PROCESSED', 'Concession has already been processed', 400);
    }

    const now = new Date();

    await collections.concessions.updateOne(
      { _id: new ObjectId(concessionId) },
      {
        $set: {
          status: 'rejected',
          rejectionReason: reason,
          approvedBy: new ObjectId(rejectedBy), // Store who rejected it
          approvedAt: now,
          updatedAt: now,
        },
      }
    );

    logger.info({ concessionId, reason, rejectedBy }, 'Concession rejected');

    return this.findById(tenantId, concessionId);
  }

  async getStats(tenantId: string, branchId: string, academicBatchId?: string) {
    const matchFilter: Record<string, unknown> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    if (academicBatchId) {
      matchFilter.academicBatchId = new ObjectId(academicBatchId);
    }

    const pipeline = [
      { $match: matchFilter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$calculatedAmount' },
        },
      },
    ];

    const statusStats = await collections.concessions.aggregate(pipeline).toArray();

    const typesPipeline = [
      { $match: { ...matchFilter, status: 'approved' } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalAmount: { $sum: '$calculatedAmount' },
        },
      },
    ];

    const typeStats = await collections.concessions.aggregate(typesPipeline).toArray();

    return {
      byStatus: Object.fromEntries(
        statusStats.map((s) => [s._id, { count: s.count, totalAmount: s.totalAmount }])
      ),
      byType: Object.fromEntries(
        typeStats.map((s) => [s._id, { count: s.count, totalAmount: s.totalAmount }])
      ),
    };
  }

  private formatConcession(concession: WithId<ConcessionDocument>) {
    return {
      _id: concession._id.toString(),
      tenantId: concession.tenantId.toString(),
      branchId: concession.branchId.toString(),
      studentId: concession.studentId.toString(),
      feeAssignmentId: concession.feeAssignmentId.toString(),
      academicBatchId: concession.academicBatchId.toString(),
      type: concession.type,
      name: concession.name,
      reason: concession.reason,
      discountType: concession.discountType,
      discountValue: concession.discountValue,
      calculatedAmount: concession.calculatedAmount,
      appliedTo: concession.appliedTo,
      status: concession.status,
      requestedBy: concession.requestedBy.toString(),
      requestedAt: concession.requestedAt,
      approvedBy: concession.approvedBy?.toString(),
      approvedAt: concession.approvedAt,
      rejectionReason: concession.rejectionReason,
      documents: concession.documents,
      remarks: concession.remarks,
      createdAt: concession.createdAt,
      updatedAt: concession.updatedAt,
    };
  }

  private formatConcessionWithStudent(concession: Document) {
    return {
      _id: concession._id.toString(),
      tenantId: concession.tenantId.toString(),
      branchId: concession.branchId.toString(),
      studentId: concession.studentId.toString(),
      feeAssignmentId: concession.feeAssignmentId.toString(),
      academicBatchId: concession.academicBatchId.toString(),
      student: concession.student
        ? {
            _id: concession.student._id.toString(),
            admissionNumber: concession.student.admissionNumber,
            displayName: concession.student.displayName,
          }
        : null,
      type: concession.type,
      name: concession.name,
      reason: concession.reason,
      discountType: concession.discountType,
      discountValue: concession.discountValue,
      calculatedAmount: concession.calculatedAmount,
      appliedTo: concession.appliedTo,
      status: concession.status,
      requestedBy: concession.requestedBy.toString(),
      requestedAt: concession.requestedAt,
      approvedBy: concession.approvedBy?.toString(),
      approvedAt: concession.approvedAt,
      rejectionReason: concession.rejectionReason,
      documents: concession.documents,
      remarks: concession.remarks,
      createdAt: concession.createdAt,
      updatedAt: concession.updatedAt,
    };
  }
}

export const concessionService = new ConcessionService();

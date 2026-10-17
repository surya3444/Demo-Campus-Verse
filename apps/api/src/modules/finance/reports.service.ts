import { ObjectId, Document } from 'mongodb';
import { collections } from '../../config/database';

export interface DueReportParams {
  academicBatchId: string;
  branchId?: string;
  classId?: string;
  sectionId?: string;
  installmentNumber?: number;
  page?: number;
  limit?: number;
}

export interface CollectionReportParams {
  fromDate: string;
  toDate: string;
  branchId?: string;
  feeType?: string;
  classId?: string;
  page?: number;
  limit?: number;
}

class FinanceReportsService {
  // ============ Unassigned Students Report ============
  async getUnassignedStudents(
    tenantId: string,
    branchId: string,
    params: {
      academicBatchId: string;
      classId?: string;
      sectionId?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const { academicBatchId, classId, sectionId, page = 1, limit = 50 } = params;
    const skip = (page - 1) * limit;

    // Build match for students
    const studentMatch: Document = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      status: 'active',
    };

    if (classId) {
      studentMatch['currentEnrollment.classId'] = new ObjectId(classId);
    }

    if (sectionId) {
      studentMatch['currentEnrollment.sectionId'] = new ObjectId(sectionId);
    }

    const pipeline = [
      { $match: studentMatch },
      {
        $lookup: {
          from: 'fee_assignments',
          let: { studentId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$studentId', '$$studentId'] },
                    { $eq: ['$academicBatchId', new ObjectId(academicBatchId)] },
                    { $eq: ['$status', 'active'] },
                  ],
                },
              },
            },
          ],
          as: 'feeAssignments',
        },
      },
      {
        $match: {
          feeAssignments: { $size: 0 },
        },
      },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: 1,
                admissionNumber: 1,
                displayName: 1,
                'currentEnrollment.className': 1,
                'currentEnrollment.sectionName': 1,
                'currentEnrollment.classId': 1,
                'currentEnrollment.sectionId': 1,
                parentInfo: { $arrayElemAt: ['$guardians', 0] },
                phone: 1,
              },
            },
          ],
          total: [{ $count: 'count' }],
        },
      },
    ];

    const result = await collections.students.aggregate(pipeline).toArray();
    const data = result[0]?.data || [];
    const total = result[0]?.total[0]?.count || 0;

    return {
      data: data.map((s: Document) => ({
        _id: s._id.toString(),
        admissionNumber: s.admissionNumber,
        displayName: s.displayName,
        className: s.currentEnrollment?.className,
        sectionName: s.currentEnrollment?.sectionName,
        classId: s.currentEnrollment?.classId?.toString(),
        sectionId: s.currentEnrollment?.sectionId?.toString(),
        parentName: s.parentInfo?.name,
        phone: s.phone || s.parentInfo?.phone,
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

  // ============ Due Reports ============
  async getDuesSummary(tenantId: string, params: DueReportParams) {
    const { academicBatchId, branchId } = params;

    const match: Document = {
      tenantId: new ObjectId(tenantId),
      academicBatchId: new ObjectId(academicBatchId),
      status: 'active',
    };

    if (branchId) {
      match.branchId = new ObjectId(branchId);
    }

    const pipeline = [
      { $match: match },
      {
        $lookup: {
          from: 'branches',
          localField: 'branchId',
          foreignField: '_id',
          as: 'branch',
        },
      },
      { $unwind: { path: '$branch', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$branchId',
          branchName: { $first: '$branch.name' },
          branchCode: { $first: '$branch.code' },
          totalStudents: { $sum: 1 },
          totalFee: { $sum: '$summary.netPayable' },
          totalPaid: { $sum: '$summary.totalPaid' },
          totalDue: { $sum: '$summary.balance' },
          totalConcession: { $sum: '$summary.totalDiscount' },
          totalFine: { $sum: '$summary.totalFine' },
        },
      },
      {
        $project: {
          _id: 0,
          branchId: '$_id',
          branchName: 1,
          branchCode: 1,
          totalStudents: 1,
          totalFee: 1,
          totalPaid: 1,
          totalDue: 1,
          totalConcession: 1,
          totalFine: 1,
          collectionPercentage: {
            $multiply: [
              { $cond: [{ $eq: ['$totalFee', 0] }, 0, { $divide: ['$totalPaid', '$totalFee'] }] },
              100,
            ],
          },
        },
      },
      { $sort: { branchName: 1 } },
    ];

    const data = await collections.feeAssignments.aggregate(pipeline).toArray();

    // Calculate grand totals
    const grandTotal = data.reduce(
      (acc, branch) => ({
        totalStudents: acc.totalStudents + branch.totalStudents,
        totalFee: acc.totalFee + branch.totalFee,
        totalPaid: acc.totalPaid + branch.totalPaid,
        totalDue: acc.totalDue + branch.totalDue,
        totalConcession: acc.totalConcession + branch.totalConcession,
        totalFine: acc.totalFine + branch.totalFine,
      }),
      { totalStudents: 0, totalFee: 0, totalPaid: 0, totalDue: 0, totalConcession: 0, totalFine: 0 }
    );

    return {
      branches: data.map((b) => ({
        ...b,
        branchId: b.branchId?.toString(),
        collectionPercentage: Math.round(b.collectionPercentage * 100) / 100,
      })),
      grandTotal: {
        ...grandTotal,
        collectionPercentage:
          grandTotal.totalFee > 0
            ? Math.round((grandTotal.totalPaid / grandTotal.totalFee) * 10000) / 100
            : 0,
      },
    };
  }

  async getClassWiseDues(tenantId: string, branchId: string, params: DueReportParams) {
    const { academicBatchId } = params;

    const pipeline = [
      {
        $match: {
          tenantId: new ObjectId(tenantId),
          branchId: new ObjectId(branchId),
          academicBatchId: new ObjectId(academicBatchId),
          status: 'active',
        },
      },
      {
        $lookup: {
          from: 'students',
          localField: 'studentId',
          foreignField: '_id',
          as: 'student',
        },
      },
      { $unwind: { path: '$student', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: {
            classId: '$student.currentEnrollment.classId',
            className: '$student.currentEnrollment.className',
          },
          totalStudents: { $sum: 1 },
          totalFee: { $sum: '$summary.netPayable' },
          totalPaid: { $sum: '$summary.totalPaid' },
          totalDue: { $sum: '$summary.balance' },
          totalConcession: { $sum: '$summary.totalDiscount' },
        },
      },
      {
        $project: {
          _id: 0,
          classId: '$_id.classId',
          className: '$_id.className',
          totalStudents: 1,
          totalFee: 1,
          totalPaid: 1,
          totalDue: 1,
          totalConcession: 1,
          collectionPercentage: {
            $multiply: [
              { $cond: [{ $eq: ['$totalFee', 0] }, 0, { $divide: ['$totalPaid', '$totalFee'] }] },
              100,
            ],
          },
        },
      },
      { $sort: { className: 1 } },
    ];

    const data = await collections.feeAssignments.aggregate(pipeline).toArray();

    return {
      data: data.map((c) => ({
        ...c,
        classId: c.classId?.toString(),
        collectionPercentage: Math.round(c.collectionPercentage * 100) / 100,
      })),
      total: data.reduce(
        (acc, c) => ({
          totalStudents: acc.totalStudents + c.totalStudents,
          totalFee: acc.totalFee + c.totalFee,
          totalPaid: acc.totalPaid + c.totalPaid,
          totalDue: acc.totalDue + c.totalDue,
          totalConcession: acc.totalConcession + c.totalConcession,
        }),
        { totalStudents: 0, totalFee: 0, totalPaid: 0, totalDue: 0, totalConcession: 0 }
      ),
    };
  }

  async getBranchWiseDues(tenantId: string, params: DueReportParams) {
    // This is similar to getDuesSummary but without the branchId filter
    return this.getDuesSummary(tenantId, { ...params, branchId: undefined });
  }

  async getStudentWiseDues(tenantId: string, branchId: string, params: DueReportParams) {
    const { academicBatchId, classId, sectionId, page = 1, limit = 50 } = params;
    const skip = (page - 1) * limit;

    const match: Document = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      academicBatchId: new ObjectId(academicBatchId),
      status: 'active',
      'summary.balance': { $gt: 0 },
    };

    const pipeline: Document[] = [
      { $match: match },
      {
        $lookup: {
          from: 'students',
          localField: 'studentId',
          foreignField: '_id',
          as: 'student',
        },
      },
      { $unwind: { path: '$student', preserveNullAndEmptyArrays: true } },
    ];

    // Filter by class/section through student lookup
    if (classId) {
      pipeline.push({
        $match: {
          'student.currentEnrollment.classId': new ObjectId(classId),
        },
      });
    }

    if (sectionId) {
      pipeline.push({
        $match: {
          'student.currentEnrollment.sectionId': new ObjectId(sectionId),
        },
      });
    }

    pipeline.push({
      $facet: {
        data: [
          { $sort: { 'summary.balance': -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              _id: 1,
              studentId: 1,
              admissionNumber: '$student.admissionNumber',
              displayName: '$student.displayName',
              className: '$student.currentEnrollment.className',
              sectionName: '$student.currentEnrollment.sectionName',
              totalFee: '$summary.netPayable',
              totalPaid: '$summary.totalPaid',
              totalDue: '$summary.balance',
              totalFine: '$summary.totalFine',
              phone: '$student.phone',
            },
          },
        ],
        total: [{ $count: 'count' }],
        aggregates: [
          {
            $group: {
              _id: null,
              totalFee: { $sum: '$summary.netPayable' },
              totalPaid: { $sum: '$summary.totalPaid' },
              totalDue: { $sum: '$summary.balance' },
              totalFine: { $sum: '$summary.totalFine' },
            },
          },
        ],
      },
    } as Document);

    const result = await collections.feeAssignments.aggregate(pipeline).toArray();
    const data = result[0]?.data || [];
    const total = result[0]?.total[0]?.count || 0;
    const aggregates = result[0]?.aggregates[0] || {};

    return {
      data: data.map((s: Document) => ({
        ...s,
        _id: s._id.toString(),
        studentId: s.studentId.toString(),
      })),
      summary: {
        totalFee: aggregates.totalFee || 0,
        totalPaid: aggregates.totalPaid || 0,
        totalDue: aggregates.totalDue || 0,
        totalFine: aggregates.totalFine || 0,
      },
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + data.length < total,
      },
    };
  }

  async getSiblingDues(tenantId: string, branchId: string, params: DueReportParams) {
    const { academicBatchId, page = 1, limit = 50 } = params;
    const skip = (page - 1) * limit;

    const pipeline = [
      {
        $match: {
          tenantId: new ObjectId(tenantId),
          branchId: new ObjectId(branchId),
          academicBatchId: new ObjectId(academicBatchId),
          status: 'active',
        },
      },
      {
        $lookup: {
          from: 'students',
          localField: 'studentId',
          foreignField: '_id',
          as: 'student',
        },
      },
      { $unwind: { path: '$student', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$student.familyId',
          students: {
            $push: {
              studentId: '$studentId',
              admissionNumber: '$student.admissionNumber',
              displayName: '$student.displayName',
              className: '$student.currentEnrollment.className',
              totalFee: '$summary.netPayable',
              totalPaid: '$summary.totalPaid',
              balance: '$summary.balance',
            },
          },
          parentName: { $first: { $arrayElemAt: ['$student.guardians.name', 0] } },
          parentPhone: { $first: { $arrayElemAt: ['$student.guardians.phone', 0] } },
          siblingCount: { $sum: 1 },
          totalFee: { $sum: '$summary.netPayable' },
          totalPaid: { $sum: '$summary.totalPaid' },
          totalDue: { $sum: '$summary.balance' },
        },
      },
      {
        $match: {
          siblingCount: { $gt: 1 },
          totalDue: { $gt: 0 },
        },
      },
      { $sort: { totalDue: -1 } },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: 'count' }],
        },
      },
    ];

    const result = await collections.feeAssignments.aggregate(pipeline).toArray();
    const data = result[0]?.data || [];
    const total = result[0]?.total[0]?.count || 0;

    return {
      data: data.map((family: Document) => ({
        familyId: family._id?.toString(),
        parentName: family.parentName,
        parentPhone: family.parentPhone,
        siblingCount: family.siblingCount,
        students: family.students.map((s: Document) => ({
          ...s,
          studentId: s.studentId.toString(),
        })),
        totalFee: family.totalFee,
        totalPaid: family.totalPaid,
        totalDue: family.totalDue,
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

  async getInstallmentWiseDues(tenantId: string, branchId: string, params: DueReportParams) {
    const { academicBatchId, installmentNumber, page = 1, limit = 50 } = params;
    const skip = (page - 1) * limit;

    const match: Document = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      academicBatchId: new ObjectId(academicBatchId),
      status: 'active',
    };

    const pipeline: Document[] = [{ $match: match }, { $unwind: '$installments' }];

    if (installmentNumber) {
      pipeline.push({
        $match: {
          'installments.installmentNumber': installmentNumber,
        },
      });
    }

    pipeline.push(
      {
        $match: {
          'installments.balance': { $gt: 0 },
        },
      },
      {
        $lookup: {
          from: 'students',
          localField: 'studentId',
          foreignField: '_id',
          as: 'student',
        },
      },
      { $unwind: { path: '$student', preserveNullAndEmptyArrays: true } },
      {
        $facet: {
          data: [
            { $sort: { 'installments.dueDate': 1, 'installments.balance': -1 } },
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: 1,
                studentId: 1,
                admissionNumber: '$student.admissionNumber',
                displayName: '$student.displayName',
                className: '$student.currentEnrollment.className',
                sectionName: '$student.currentEnrollment.sectionName',
                installmentNumber: '$installments.installmentNumber',
                installmentName: '$installments.name',
                dueDate: '$installments.dueDate',
                amount: '$installments.amount',
                paidAmount: '$installments.paidAmount',
                balance: '$installments.balance',
                fineAmount: '$installments.fineAmount',
                status: '$installments.status',
              },
            },
          ],
          total: [{ $count: 'count' }],
          summary: [
            {
              $group: {
                _id: '$installments.installmentNumber',
                installmentName: { $first: '$installments.name' },
                dueDate: { $first: '$installments.dueDate' },
                totalAmount: { $sum: '$installments.amount' },
                totalPaid: { $sum: '$installments.paidAmount' },
                totalDue: { $sum: '$installments.balance' },
                studentCount: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
          ],
        },
      } as Document
    );

    const result = await collections.feeAssignments.aggregate(pipeline).toArray();
    const data = result[0]?.data || [];
    const total = result[0]?.total[0]?.count || 0;
    const summary = result[0]?.summary || [];

    return {
      data: data.map((s: Document) => ({
        ...s,
        _id: s._id.toString(),
        studentId: s.studentId.toString(),
      })),
      installmentSummary: summary.map((i: Document) => ({
        installmentNumber: i._id,
        installmentName: i.installmentName,
        dueDate: i.dueDate,
        totalAmount: i.totalAmount,
        totalPaid: i.totalPaid,
        totalDue: i.totalDue,
        studentCount: i.studentCount,
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

  // ============ Collection Reports ============
  async getFeeTypeReport(tenantId: string, branchId: string, params: CollectionReportParams) {
    const { fromDate, toDate } = params;

    const pipeline = [
      {
        $match: {
          tenantId: new ObjectId(tenantId),
          branchId: new ObjectId(branchId),
          receiptDate: {
            $gte: new Date(fromDate),
            $lte: new Date(toDate + 'T23:59:59.999Z'),
          },
          status: 'success',
        },
      },
      { $unwind: '$components' },
      {
        $group: {
          _id: '$components.componentCode',
          componentName: { $first: '$components.name' },
          transactionCount: { $sum: 1 },
          totalAmount: { $sum: '$components.amount' },
        },
      },
      {
        $project: {
          _id: 0,
          componentCode: '$_id',
          componentName: 1,
          transactionCount: 1,
          totalAmount: 1,
        },
      },
      { $sort: { totalAmount: -1 } },
    ];

    const data = await collections.feeTransactions.aggregate(pipeline).toArray();

    const grandTotal = data.reduce(
      (acc, item) => ({
        transactionCount: acc.transactionCount + item.transactionCount,
        totalAmount: acc.totalAmount + item.totalAmount,
      }),
      { transactionCount: 0, totalAmount: 0 }
    );

    return {
      data,
      grandTotal,
    };
  }

  async getStudentStatement(tenantId: string, studentId: string, academicBatchId: string) {
    // Get student details
    const student = await collections.students.findOne({
      _id: new ObjectId(studentId),
      tenantId: new ObjectId(tenantId),
    });

    if (!student) {
      throw new Error('Student not found');
    }

    // Get fee assignment
    const assignment = await collections.feeAssignments.findOne({
      tenantId: new ObjectId(tenantId),
      studentId: new ObjectId(studentId),
      academicBatchId: new ObjectId(academicBatchId),
    });

    // Get all transactions
    const transactions = await collections.feeTransactions
      .find({
        tenantId: new ObjectId(tenantId),
        studentId: new ObjectId(studentId),
        feeAssignmentId: assignment?._id,
        status: { $in: ['success', 'refunded'] },
      })
      .sort({ receiptDate: 1 })
      .toArray();

    // Get concessions
    const concessions = await collections.concessions
      .find({
        tenantId: new ObjectId(tenantId),
        studentId: new ObjectId(studentId),
        academicBatchId: new ObjectId(academicBatchId),
        status: 'approved',
      })
      .toArray();

    return {
      student: {
        _id: student._id.toString(),
        admissionNumber: student.admissionNumber,
        displayName: student.displayName,
        className: student.currentEnrollment?.className,
        sectionName: student.currentEnrollment?.sectionName,
        parentName: student.guardians?.[0]?.name,
        phone: student.phone || student.guardians?.[0]?.phone,
      },
      feeDetails: assignment
        ? {
            components: assignment.components,
            installments: assignment.installments,
            summary: assignment.summary,
          }
        : null,
      transactions: transactions.map((t) => ({
        _id: t._id.toString(),
        receiptNumber: t.receiptNumber,
        receiptDate: t.receiptDate,
        paymentMode: t.paymentMode,
        feeAmount: t.feeAmount,
        fineAmount: t.fineAmount,
        totalAmount: t.totalAmount,
        status: t.status,
        components: t.components,
      })),
      concessions: concessions.map((c) => ({
        _id: c._id.toString(),
        type: c.type,
        name: c.name,
        discountType: c.discountType,
        discountValue: c.discountValue,
        calculatedAmount: c.calculatedAmount,
        appliedTo: c.appliedTo,
      })),
    };
  }

  async getFeeTypeWiseTransactions(
    tenantId: string,
    branchId: string,
    params: CollectionReportParams
  ) {
    const { fromDate, toDate, feeType, page = 1, limit = 50 } = params;
    const skip = (page - 1) * limit;

    const match: Document = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      receiptDate: {
        $gte: new Date(fromDate),
        $lte: new Date(toDate + 'T23:59:59.999Z'),
      },
      status: 'success',
    };

    if (feeType) {
      match['components.componentCode'] = feeType;
    }

    const pipeline = [
      { $match: match },
      {
        $lookup: {
          from: 'students',
          localField: 'studentId',
          foreignField: '_id',
          as: 'student',
        },
      },
      { $unwind: { path: '$student', preserveNullAndEmptyArrays: true } },
      { $sort: { receiptDate: -1 } },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: 1,
                receiptNumber: 1,
                receiptDate: 1,
                admissionNumber: '$student.admissionNumber',
                displayName: '$student.displayName',
                className: '$student.currentEnrollment.className',
                paymentMode: 1,
                components: 1,
                feeAmount: 1,
                fineAmount: 1,
                totalAmount: 1,
              },
            },
          ],
          total: [{ $count: 'count' }],
          summary: [
            {
              $group: {
                _id: null,
                totalFeeAmount: { $sum: '$feeAmount' },
                totalFineAmount: { $sum: '$fineAmount' },
                totalAmount: { $sum: '$totalAmount' },
              },
            },
          ],
        },
      },
    ];

    const result = await collections.feeTransactions.aggregate(pipeline).toArray();
    const data = result[0]?.data || [];
    const total = result[0]?.total[0]?.count || 0;
    const summary = result[0]?.summary[0] || {};

    return {
      data: data.map((t: Document) => ({
        ...t,
        _id: t._id.toString(),
      })),
      summary: {
        totalFeeAmount: summary.totalFeeAmount || 0,
        totalFineAmount: summary.totalFineAmount || 0,
        totalAmount: summary.totalAmount || 0,
      },
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + data.length < total,
      },
    };
  }

  async getClassWiseConcessionReport(
    tenantId: string,
    branchId: string,
    params: { academicBatchId: string }
  ) {
    const { academicBatchId } = params;

    const pipeline = [
      {
        $match: {
          tenantId: new ObjectId(tenantId),
          branchId: new ObjectId(branchId),
          academicBatchId: new ObjectId(academicBatchId),
          status: 'approved',
        },
      },
      {
        $lookup: {
          from: 'students',
          localField: 'studentId',
          foreignField: '_id',
          as: 'student',
        },
      },
      { $unwind: { path: '$student', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: {
            classId: '$student.currentEnrollment.classId',
            className: '$student.currentEnrollment.className',
          },
          studentCount: { $addToSet: '$studentId' },
          totalConcessions: { $sum: 1 },
          totalAmount: { $sum: '$calculatedAmount' },
          byType: {
            $push: {
              type: '$type',
              amount: '$calculatedAmount',
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          classId: '$_id.classId',
          className: '$_id.className',
          studentCount: { $size: '$studentCount' },
          totalConcessions: 1,
          totalAmount: 1,
          byType: 1,
        },
      },
      { $sort: { className: 1 } },
    ];

    const data = await collections.concessions.aggregate(pipeline).toArray();

    // Process type breakdown
    const processedData = data.map((c) => {
      const typeBreakdown: Record<string, { count: number; amount: number }> = {};
      (c.byType || []).forEach((t: { type: string; amount: number }) => {
        if (!typeBreakdown[t.type]) {
          typeBreakdown[t.type] = { count: 0, amount: 0 };
        }
        typeBreakdown[t.type].count++;
        typeBreakdown[t.type].amount += t.amount;
      });

      return {
        classId: c.classId?.toString(),
        className: c.className,
        studentCount: c.studentCount,
        totalConcessions: c.totalConcessions,
        totalAmount: c.totalAmount,
        byType: typeBreakdown,
      };
    });

    return {
      data: processedData,
      total: processedData.reduce(
        (acc, c) => ({
          studentCount: acc.studentCount + c.studentCount,
          totalConcessions: acc.totalConcessions + c.totalConcessions,
          totalAmount: acc.totalAmount + c.totalAmount,
        }),
        { studentCount: 0, totalConcessions: 0, totalAmount: 0 }
      ),
    };
  }

  // ============ Total Paid and Due Report ============
  async getTotalPaidAndDueReport(
    tenantId: string,
    branchId: string,
    params: {
      academicBatchId: string;
      fromDate?: string;
      toDate?: string;
      groupBy?: 'day' | 'week' | 'month';
    }
  ) {
    const { academicBatchId, fromDate, toDate, groupBy = 'month' } = params;

    const baseMatch: Document = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      academicBatchId: new ObjectId(academicBatchId),
      status: 'active',
    };

    // Get fee assignment summary
    const feeAssignmentPipeline = [
      { $match: baseMatch },
      {
        $group: {
          _id: null,
          totalStudents: { $sum: 1 },
          totalFeeAmount: { $sum: '$summary.netPayable' },
          totalPaid: { $sum: '$summary.totalPaid' },
          totalDue: { $sum: '$summary.balance' },
          totalDiscount: { $sum: '$summary.totalDiscount' },
          totalFine: { $sum: '$summary.totalFine' },
        },
      },
    ];

    const feeAssignmentResult = await collections.feeAssignments
      .aggregate(feeAssignmentPipeline)
      .toArray();
    const feeStats = feeAssignmentResult[0] || {
      totalStudents: 0,
      totalFeeAmount: 0,
      totalPaid: 0,
      totalDue: 0,
      totalDiscount: 0,
      totalFine: 0,
    };

    // Get collection trend data
    const collectionMatch: Document = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      status: 'success',
    };

    if (fromDate || toDate) {
      collectionMatch.receiptDate = {};
      if (fromDate) {
        collectionMatch.receiptDate.$gte = new Date(fromDate);
      }
      if (toDate) {
        collectionMatch.receiptDate.$lte = new Date(toDate + 'T23:59:59.999Z');
      }
    }

    // Group by time period
    let dateGrouping: Document;
    if (groupBy === 'day') {
      dateGrouping = {
        year: { $year: '$receiptDate' },
        month: { $month: '$receiptDate' },
        day: { $dayOfMonth: '$receiptDate' },
      };
    } else if (groupBy === 'week') {
      dateGrouping = {
        year: { $year: '$receiptDate' },
        week: { $week: '$receiptDate' },
      };
    } else {
      dateGrouping = {
        year: { $year: '$receiptDate' },
        month: { $month: '$receiptDate' },
      };
    }

    const trendPipeline = [
      { $match: collectionMatch },
      {
        $group: {
          _id: dateGrouping,
          totalAmount: { $sum: '$totalAmount' },
          feeAmount: { $sum: '$feeAmount' },
          fineAmount: { $sum: '$fineAmount' },
          transactionCount: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
    ];

    const trendData = await collections.feeTransactions.aggregate(trendPipeline).toArray();

    // Get payment mode wise collection
    const paymentModePipeline = [
      { $match: collectionMatch },
      {
        $group: {
          _id: '$paymentMode',
          totalAmount: { $sum: '$totalAmount' },
          transactionCount: { $sum: 1 },
        },
      },
      { $sort: { totalAmount: -1 } },
    ];

    const paymentModeData = await collections.feeTransactions
      .aggregate(paymentModePipeline)
      .toArray();

    // Calculate collection percentage
    const collectionPercentage =
      feeStats.totalFeeAmount > 0
        ? Math.round((feeStats.totalPaid / feeStats.totalFeeAmount) * 10000) / 100
        : 0;

    return {
      summary: {
        totalStudents: feeStats.totalStudents,
        totalFeeAmount: feeStats.totalFeeAmount,
        totalPaid: feeStats.totalPaid,
        totalDue: feeStats.totalDue,
        totalDiscount: feeStats.totalDiscount,
        totalFine: feeStats.totalFine,
        collectionPercentage,
      },
      trendData: trendData.map((t) => ({
        period: t._id,
        totalAmount: t.totalAmount,
        feeAmount: t.feeAmount,
        fineAmount: t.fineAmount,
        transactionCount: t.transactionCount,
      })),
      paymentModeWise: paymentModeData.map((p) => ({
        paymentMode: p._id,
        totalAmount: p.totalAmount,
        transactionCount: p.transactionCount,
      })),
    };
  }

  async getStudentWiseConcessionReport(
    tenantId: string,
    branchId: string,
    params: { academicBatchId: string; classId?: string; page?: number; limit?: number }
  ) {
    const { academicBatchId, classId, page = 1, limit = 50 } = params;
    const skip = (page - 1) * limit;

    const pipeline: Document[] = [
      {
        $match: {
          tenantId: new ObjectId(tenantId),
          branchId: new ObjectId(branchId),
          academicBatchId: new ObjectId(academicBatchId),
          status: 'approved',
        },
      },
      {
        $lookup: {
          from: 'students',
          localField: 'studentId',
          foreignField: '_id',
          as: 'student',
        },
      },
      { $unwind: { path: '$student', preserveNullAndEmptyArrays: true } },
    ];

    if (classId) {
      pipeline.push({
        $match: {
          'student.currentEnrollment.classId': new ObjectId(classId),
        },
      });
    }

    pipeline.push({
      $facet: {
        data: [
          { $sort: { 'student.displayName': 1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              _id: 1,
              studentId: 1,
              admissionNumber: '$student.admissionNumber',
              displayName: '$student.displayName',
              className: '$student.currentEnrollment.className',
              type: 1,
              name: 1,
              discountType: 1,
              discountValue: 1,
              calculatedAmount: 1,
              appliedTo: 1,
              approvedAt: 1,
            },
          },
        ],
        total: [{ $count: 'count' }],
        summary: [
          {
            $group: {
              _id: null,
              totalAmount: { $sum: '$calculatedAmount' },
              studentCount: { $addToSet: '$studentId' },
            },
          },
          {
            $project: {
              totalAmount: 1,
              studentCount: { $size: '$studentCount' },
            },
          },
        ],
      },
    } as Document);

    const result = await collections.concessions.aggregate(pipeline).toArray();
    const data = result[0]?.data || [];
    const total = result[0]?.total[0]?.count || 0;
    const summary = result[0]?.summary[0] || {};

    return {
      data: data.map((c: Document) => ({
        ...c,
        _id: c._id.toString(),
        studentId: c.studentId.toString(),
      })),
      summary: {
        totalAmount: summary.totalAmount || 0,
        studentCount: summary.studentCount || 0,
      },
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + data.length < total,
      },
    };
  }
}

export const financeReportsService = new FinanceReportsService();

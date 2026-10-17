import { ObjectId, WithId, Document, Filter, UpdateFilter } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';

interface FeeComponent {
  componentCode: string;
  name: string;
  type?: 'mandatory' | 'optional' | 'service-based';
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
  taxAmount: number;
  totalAmount: number;
}

interface FeeInstallment {
  installmentNumber: number;
  name: string;
  dueDate: Date;
  amount: number;
  fineAmount: number;
  totalDue: number;
  paidAmount: number;
  balance: number;
  status: 'pending' | 'partial' | 'paid' | 'overdue';
}

interface FeeAssignmentDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  studentId: ObjectId;
  academicBatchId: ObjectId;
  feeStructureId: ObjectId;
  type: 'tuition' | 'hostel' | 'transport' | 'other';
  sourceRef?: { collection: string; id: ObjectId };
  components: FeeComponent[];
  installments: FeeInstallment[];
  summary: {
    totalFee: number;
    totalDiscount: number;
    totalTax: number;
    netPayable: number;
    totalPaid: number;
    totalFine: number;
    balance: number;
  };
  concessions: Array<{
    concessionId: ObjectId;
    type: string;
    amount: number;
    appliedTo: string[];
  }>;
  status: 'active' | 'cleared' | 'cancelled';
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFeeAssignmentInput {
  studentId: string;
  feeStructureId: string;
  academicBatchId: string;
  type?: 'tuition' | 'hostel' | 'transport' | 'other';
  sourceRef?: { collection: string; id: string };
  discounts?: Array<{
    componentCode: string;
    discountAmount: number;
  }>;
}

export interface FeeAssignmentListParams {
  page?: number;
  limit?: number;
  studentId?: string;
  feeStructureId?: string;
  academicBatchId?: string;
  classId?: string;
  sectionId?: string;
  status?: string;
  hasBalance?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

class FeeAssignmentService {
  async create(
    tenantId: string,
    branchId: string,
    data: CreateFeeAssignmentInput,
    createdBy: string
  ) {
    // Check if assignment already exists for this student + batch + structure
    const existing = await collections.feeAssignments.findOne({
      tenantId: new ObjectId(tenantId),
      studentId: new ObjectId(data.studentId),
      academicBatchId: new ObjectId(data.academicBatchId),
      feeStructureId: new ObjectId(data.feeStructureId),
      status: { $ne: 'cancelled' },
    });

    if (existing) {
      throw new ApiError(
        'ASSIGNMENT_EXISTS',
        'Fee assignment already exists for this student with this fee structure',
        409
      );
    }

    // Get fee structure
    const feeStructure = await collections.feeStructures.findOne({
      _id: new ObjectId(data.feeStructureId),
      tenantId: new ObjectId(tenantId),
    });

    if (!feeStructure) {
      throw new ApiError('FEE_STRUCTURE_NOT_FOUND', 'Fee structure not found', 404);
    }

    // Get student
    const student = await collections.students.findOne({
      _id: new ObjectId(data.studentId),
      tenantId: new ObjectId(tenantId),
    });

    if (!student) {
      throw new ApiError('STUDENT_NOT_FOUND', 'Student not found', 404);
    }

    const assignmentId = new ObjectId();
    const now = new Date();

    // Build discount map
    const discountMap = new Map<string, number>();
    (data.discounts || []).forEach((d) => {
      discountMap.set(d.componentCode, d.discountAmount);
    });

    // Filter components by scope — section-specific and student-specific
    // components are only included if the student matches the criteria.
    // Components without a scope (or scope.type === 'all') always pass.
    const studentSectionId = student.currentEnrollment?.sectionId?.toString() || '';
    const studentIdStr = data.studentId;

    const scopedComponents = (feeStructure.components || []).filter(
      (c: Record<string, unknown>) => {
        const scope = c.scope as
          | { type?: string; sectionIds?: string[]; studentIds?: string[]; enabled?: boolean }
          | undefined;
        if (!scope || scope.type === 'all') return true;
        if (scope.enabled === false) return false;
        if (scope.type === 'sections') {
          return (scope.sectionIds || []).includes(studentSectionId);
        }
        if (scope.type === 'students') {
          return (scope.studentIds || []).includes(studentIdStr);
        }
        return true;
      }
    );

    // Build components with calculations
    const components: FeeComponent[] = scopedComponents.map(
      (c: {
        code: string;
        name: string;
        amount: number;
        type?: 'mandatory' | 'optional' | 'service-based';
        taxable?: boolean;
        taxRate?: number;
      }) => {
        const discountAmount = discountMap.get(c.code) || 0;
        const finalAmount = c.amount - discountAmount;
        const taxAmount = c.taxable ? finalAmount * ((c.taxRate || 0) / 100) : 0;
        const totalAmount = finalAmount + taxAmount;

        return {
          componentCode: c.code,
          name: c.name,
          // Bake the component type into the snapshot so the cashier UI
          // knows whether each line is mandatory or optional without
          // re-fetching the structure.
          type: c.type || 'mandatory',
          originalAmount: c.amount,
          discountAmount,
          finalAmount,
          taxAmount,
          totalAmount,
        };
      }
    );

    // Build installments
    const installments: FeeInstallment[] = (feeStructure.installments || []).map(
      (
        inst: {
          name: string;
          dueDate: Date;
          components: Array<{ componentCode: string; amount: number }>;
        },
        index: number
      ) => {
        // Calculate installment amount based on component proportions
        let amount = 0;
        inst.components.forEach((instComp) => {
          const component = components.find((c) => c.componentCode === instComp.componentCode);
          if (component) {
            // Apply discount proportionally
            const ratio = component.totalAmount / component.originalAmount || 1;
            amount += instComp.amount * ratio;
          }
        });

        return {
          installmentNumber: index + 1,
          name: inst.name,
          dueDate: new Date(inst.dueDate),
          amount: Math.round(amount * 100) / 100,
          fineAmount: 0,
          totalDue: Math.round(amount * 100) / 100,
          paidAmount: 0,
          balance: Math.round(amount * 100) / 100,
          status: 'pending' as const,
        };
      }
    );

    // Calculate summary
    const totalFee = components.reduce((sum, c) => sum + c.originalAmount, 0);
    const totalDiscount = components.reduce((sum, c) => sum + c.discountAmount, 0);
    const totalTax = components.reduce((sum, c) => sum + c.taxAmount, 0);
    const netPayable = components.reduce((sum, c) => sum + c.totalAmount, 0);

    const assignment: Omit<FeeAssignmentDocument, '_id'> & { _id: ObjectId } = {
      _id: assignmentId,
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      studentId: new ObjectId(data.studentId),
      academicBatchId: new ObjectId(data.academicBatchId),
      feeStructureId: new ObjectId(data.feeStructureId),
      type: data.type || 'tuition',
      ...(data.sourceRef && {
        sourceRef: {
          collection: data.sourceRef.collection,
          id: new ObjectId(data.sourceRef.id),
        },
      }),
      components,
      installments,
      summary: {
        totalFee,
        totalDiscount,
        totalTax,
        netPayable,
        totalPaid: 0,
        totalFine: 0,
        balance: netPayable,
      },
      concessions: [],
      status: 'active',
      createdBy: new ObjectId(createdBy),
      createdAt: now,
      updatedAt: now,
    };

    await collections.feeAssignments.insertOne(assignment);

    logger.info(
      { assignmentId: assignmentId.toString(), studentId: data.studentId, tenantId },
      'Fee assignment created'
    );

    return this.formatAssignment(assignment as WithId<FeeAssignmentDocument>);
  }

  async findById(tenantId: string, assignmentId: string) {
    const assignment = (await collections.feeAssignments.findOne({
      _id: new ObjectId(assignmentId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<FeeAssignmentDocument> | null;

    if (!assignment) {
      throw new ApiError('FEE_ASSIGNMENT_NOT_FOUND', 'Fee assignment not found', 404);
    }

    return this.formatAssignment(assignment);
  }

  async findByStudentId(tenantId: string, studentId: string, academicBatchId?: string) {
    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      studentId: new ObjectId(studentId),
    };

    if (academicBatchId) {
      filter.academicBatchId = new ObjectId(academicBatchId);
    }

    const assignments = (await collections.feeAssignments
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray()) as WithId<FeeAssignmentDocument>[];

    // The student app (and fee cards elsewhere) read flat display fields —
    // structure name, year, total/paid/pending and the next due date — which
    // live under summary/installments or in other collections.
    const [structures, batches] = await Promise.all([
      collections.feeStructures
        .find({ _id: { $in: assignments.map((a) => a.feeStructureId).filter(Boolean) } })
        .project({ name: 1 })
        .toArray(),
      collections.academicBatches
        .find({ _id: { $in: assignments.map((a) => a.academicBatchId).filter(Boolean) } })
        .project({ name: 1 })
        .toArray(),
    ]);
    const structureName = new Map(structures.map((x) => [x._id.toString(), String(x.name)]));
    const batchName = new Map(batches.map((x) => [x._id.toString(), String(x.name)]));

    return assignments.map((a) => {
      const nextDue = (a.installments ?? [])
        .filter((i) => (i.balance ?? 0) > 0)
        .sort((x, y) => new Date(x.dueDate).getTime() - new Date(y.dueDate).getTime())[0];
      return {
        ...this.formatAssignment(a),
        feeStructureName: structureName.get(String(a.feeStructureId)),
        academicYear: batchName.get(String(a.academicBatchId)),
        totalAmount: a.summary?.netPayable ?? 0,
        paidAmount: a.summary?.totalPaid ?? 0,
        pendingAmount: a.summary?.balance ?? 0,
        dueDate: nextDue?.dueDate,
      };
    });
  }

  async findAll(tenantId: string, branchId: string, params: FeeAssignmentListParams = {}) {
    const {
      page = 1,
      limit = 20,
      studentId,
      feeStructureId,
      academicBatchId,
      status,
      hasBalance,
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

    if (feeStructureId) {
      filter.feeStructureId = new ObjectId(feeStructureId);
    }

    if (academicBatchId) {
      filter.academicBatchId = new ObjectId(academicBatchId);
    }

    if (status) {
      filter.status = status;
    }

    if (hasBalance === true) {
      filter['summary.balance'] = { $gt: 0 };
    } else if (hasBalance === false) {
      filter['summary.balance'] = 0;
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
      {
        $lookup: {
          from: 'fee_structures',
          localField: 'feeStructureId',
          foreignField: '_id',
          as: 'feeStructure',
        },
      },
      { $unwind: { path: '$feeStructure', preserveNullAndEmptyArrays: true } },
      { $sort: { [sortBy]: sortDirection, _id: sortDirection } },
      { $skip: skip },
      { $limit: limit },
    ];

    const [assignments, totalResult] = await Promise.all([
      collections.feeAssignments.aggregate(pipeline).toArray(),
      collections.feeAssignments.countDocuments(filter),
    ]);

    return {
      data: assignments.map((a) => this.formatAssignmentWithDetails(a)),
      meta: {
        page,
        limit,
        total: totalResult,
        totalPages: Math.ceil(totalResult / limit),
        hasMore: skip + assignments.length < totalResult,
      },
    };
  }

  async update(tenantId: string, assignmentId: string, data: Partial<CreateFeeAssignmentInput>) {
    const existing = (await collections.feeAssignments.findOne({
      _id: new ObjectId(assignmentId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<FeeAssignmentDocument> | null;

    if (!existing) {
      throw new ApiError('FEE_ASSIGNMENT_NOT_FOUND', 'Fee assignment not found', 404);
    }

    if (existing.summary.totalPaid > 0) {
      throw new ApiError(
        'CANNOT_MODIFY',
        'Cannot modify fee assignment with existing payments',
        400
      );
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    // For now, only allow updating discounts
    if (data.discounts) {
      const discountMap = new Map<string, number>();
      data.discounts.forEach((d) => {
        discountMap.set(d.componentCode, d.discountAmount);
      });

      const components = existing.components.map((c) => {
        const discountAmount = discountMap.get(c.componentCode) || c.discountAmount;
        const finalAmount = c.originalAmount - discountAmount;
        const taxAmount = c.taxAmount > 0 ? finalAmount * (c.taxAmount / (c.finalAmount || 1)) : 0;
        const totalAmount = finalAmount + taxAmount;

        return {
          ...c,
          discountAmount,
          finalAmount,
          taxAmount,
          totalAmount,
        };
      });

      const totalDiscount = components.reduce((sum, c) => sum + c.discountAmount, 0);
      const netPayable = components.reduce((sum, c) => sum + c.totalAmount, 0);

      updateData.components = components;
      updateData['summary.totalDiscount'] = totalDiscount;
      updateData['summary.netPayable'] = netPayable;
      updateData['summary.balance'] = netPayable - existing.summary.totalPaid;
    }

    await collections.feeAssignments.updateOne(
      { _id: new ObjectId(assignmentId) },
      { $set: updateData }
    );

    logger.info({ assignmentId, tenantId }, 'Fee assignment updated');

    return this.findById(tenantId, assignmentId);
  }

  async bulkCreate(
    tenantId: string,
    branchId: string,
    data: {
      studentIds: string[];
      feeStructureId: string;
      academicBatchId: string;
    },
    createdBy: string
  ) {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ studentId: string; error: string }>,
    };

    for (const studentId of data.studentIds) {
      try {
        await this.create(
          tenantId,
          branchId,
          {
            studentId,
            feeStructureId: data.feeStructureId,
            academicBatchId: data.academicBatchId,
          },
          createdBy
        );
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          studentId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logger.info(
      { success: results.success, failed: results.failed, tenantId },
      'Bulk fee assignment completed'
    );

    return results;
  }

  async updatePayment(
    tenantId: string,
    assignmentId: string,
    paidAmount: number,
    installmentNumbers: number[]
  ) {
    const assignment = (await collections.feeAssignments.findOne({
      _id: new ObjectId(assignmentId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<FeeAssignmentDocument> | null;

    if (!assignment) {
      throw new ApiError('FEE_ASSIGNMENT_NOT_FOUND', 'Fee assignment not found', 404);
    }

    let remainingAmount = paidAmount;
    const updatedInstallments = assignment.installments.map((inst) => {
      if (installmentNumbers.includes(inst.installmentNumber) && remainingAmount > 0) {
        const paymentForInst = Math.min(remainingAmount, inst.balance);
        remainingAmount -= paymentForInst;

        const newPaidAmount = inst.paidAmount + paymentForInst;
        const newBalance = inst.totalDue - newPaidAmount;
        const newStatus =
          newBalance === 0 ? 'paid' : newBalance < inst.totalDue ? 'partial' : inst.status;

        return {
          ...inst,
          paidAmount: newPaidAmount,
          balance: newBalance,
          status: newStatus,
        };
      }
      return inst;
    });

    const newTotalPaid = assignment.summary.totalPaid + paidAmount;
    const newBalance = assignment.summary.netPayable - newTotalPaid;
    const newStatus = newBalance === 0 ? 'cleared' : 'active';

    await collections.feeAssignments.updateOne({ _id: new ObjectId(assignmentId) }, {
      $set: {
        installments: updatedInstallments,
        'summary.totalPaid': newTotalPaid,
        'summary.balance': newBalance,
        status: newStatus,
        updatedAt: new Date(),
      },
    } as unknown as UpdateFilter<Document>);

    logger.info({ assignmentId, paidAmount, tenantId }, 'Fee assignment payment updated');

    return this.findById(tenantId, assignmentId);
  }

  async calculateFines(tenantId: string, branchId: string) {
    const now = new Date();

    // Get org fee settings for fallback fine rules
    const financeSettings = await collections.financeSettings.findOne({
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    });

    const orgFeeSettings = financeSettings?.orgFeeSettings;

    // Find all active assignments with overdue installments
    const assignments = (await collections.feeAssignments
      .find({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        status: 'active',
        'installments.dueDate': { $lt: now },
        'installments.status': { $in: ['pending', 'partial'] },
      })
      .toArray()) as WithId<FeeAssignmentDocument>[];

    let updated = 0;

    for (const assignment of assignments) {
      // Get fee structure for fine rules
      const feeStructure = await collections.feeStructures.findOne({
        _id: assignment.feeStructureId,
      });

      // Use fee structure fine rules, or fallback to org fee settings
      let fineRules: {
        type: 'fixed' | 'percentage' | 'daily' | 'compound';
        amount: number;
        gracePeriodDays: number;
        maxFine: number;
      } | null = null;

      if (feeStructure?.fineRules) {
        fineRules = feeStructure.fineRules;
      } else if (orgFeeSettings) {
        // Convert org fee settings to fine rules format
        fineRules = {
          type: orgFeeSettings.penaltyType === 'compound' ? 'compound' : orgFeeSettings.penaltyType,
          amount: orgFeeSettings.penaltyValue,
          gracePeriodDays: orgFeeSettings.penaltyStartAfterDays,
          maxFine: orgFeeSettings.maxPenaltyCap,
        };
      }

      if (!fineRules) continue;

      let totalFine = 0;

      const updatedInstallments = assignment.installments.map((inst) => {
        if (
          (inst.status === 'pending' || inst.status === 'partial') &&
          new Date(inst.dueDate) < now
        ) {
          const daysOverdue = Math.floor(
            (now.getTime() - new Date(inst.dueDate).getTime()) / (1000 * 60 * 60 * 24)
          );

          if (daysOverdue > fineRules!.gracePeriodDays) {
            let fine = 0;
            const effectiveDays = daysOverdue - fineRules!.gracePeriodDays;

            if (fineRules!.type === 'fixed') {
              fine = fineRules!.amount;
            } else if (fineRules!.type === 'percentage') {
              fine = (inst.balance * fineRules!.amount) / 100;
            } else if (fineRules!.type === 'daily') {
              fine = fineRules!.amount * effectiveDays;
            } else if (fineRules!.type === 'compound') {
              // Compound: percentage applied monthly
              const months = Math.floor(effectiveDays / 30);
              fine = inst.balance * (Math.pow(1 + fineRules!.amount / 100, months) - 1);
            }

            if (fineRules!.maxFine && fine > fineRules!.maxFine) {
              fine = fineRules!.maxFine;
            }

            fine = Math.round(fine * 100) / 100;
            totalFine += fine;

            return {
              ...inst,
              fineAmount: fine,
              totalDue: inst.amount + fine,
              balance: inst.amount + fine - inst.paidAmount,
              status: 'overdue' as const,
            };
          }
        }
        return inst;
      });

      if (totalFine > 0) {
        await collections.feeAssignments.updateOne({ _id: assignment._id }, {
          $set: {
            installments: updatedInstallments,
            'summary.totalFine': totalFine,
            'summary.balance':
              assignment.summary.netPayable + totalFine - assignment.summary.totalPaid,
            updatedAt: now,
          },
        } as unknown as UpdateFilter<Document>);
        updated++;
      }
    }

    logger.info({ updated, tenantId, branchId }, 'Fines calculated');

    return { updated };
  }

  private formatAssignment(assignment: WithId<FeeAssignmentDocument>) {
    return {
      _id: assignment._id.toString(),
      tenantId: assignment.tenantId.toString(),
      branchId: assignment.branchId.toString(),
      studentId: assignment.studentId.toString(),
      academicBatchId: assignment.academicBatchId.toString(),
      feeStructureId: assignment.feeStructureId.toString(),
      type: assignment.type || 'tuition',
      sourceRef: assignment.sourceRef
        ? { collection: assignment.sourceRef.collection, id: assignment.sourceRef.id.toString() }
        : undefined,
      components: assignment.components,
      installments: assignment.installments,
      summary: assignment.summary,
      concessions: assignment.concessions.map((c) => ({
        ...c,
        concessionId: c.concessionId.toString(),
      })),
      status: assignment.status,
      createdAt: assignment.createdAt,
      updatedAt: assignment.updatedAt,
    };
  }

  private formatAssignmentWithDetails(assignment: Document) {
    return {
      _id: assignment._id.toString(),
      tenantId: assignment.tenantId.toString(),
      branchId: assignment.branchId.toString(),
      studentId: assignment.studentId.toString(),
      academicBatchId: assignment.academicBatchId.toString(),
      feeStructureId: assignment.feeStructureId.toString(),
      type: assignment.type || 'tuition',
      sourceRef: assignment.sourceRef
        ? { collection: assignment.sourceRef.collection, id: assignment.sourceRef.id.toString() }
        : undefined,
      student: assignment.student
        ? {
            _id: assignment.student._id.toString(),
            admissionNumber: assignment.student.admissionNumber,
            displayName: assignment.student.displayName,
            className: assignment.student.currentEnrollment?.className,
            sectionName: assignment.student.currentEnrollment?.sectionName,
          }
        : null,
      feeStructure: assignment.feeStructure
        ? {
            _id: assignment.feeStructure._id.toString(),
            name: assignment.feeStructure.name,
            code: assignment.feeStructure.code,
          }
        : null,
      components: assignment.components,
      installments: assignment.installments,
      summary: assignment.summary,
      concessions: (assignment.concessions || []).map(
        (c: { concessionId: ObjectId; type: string; amount: number; appliedTo: string[] }) => ({
          ...c,
          concessionId: c.concessionId.toString(),
        })
      ),
      status: assignment.status,
      createdAt: assignment.createdAt,
      updatedAt: assignment.updatedAt,
    };
  }
}

export const feeAssignmentService = new FeeAssignmentService();

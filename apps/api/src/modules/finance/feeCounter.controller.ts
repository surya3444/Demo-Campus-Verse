import { Request, Response, NextFunction } from 'express';
import { Document, ObjectId } from 'mongodb';
import { getDb } from '../../config/database';
import { success } from '../../utils/response';
import { feeTransactionService } from './feeTransaction.service';
import { feeStructureService } from './feeStructure.service';
import { assertStudentInScope, getStudentVisibilityFilter } from '../teaching/scope';

/** Prefix a student filter's field paths for use after a $lookup into `as`. */
function underField(filter: Document, as: string): Document {
  if (Array.isArray(filter)) return filter.map((f) => underField(f, as));
  return Object.fromEntries(
    Object.entries(filter).map(([k, v]) =>
      k.startsWith('$') ? [k, underField(v as Document, as)] : [`${as}.${k}`, v]
    )
  );
}

class FeeCounterController {
  /**
   * Search students with fee assignments for fee collection
   * GET /finance/fee-counter/students
   */
  async searchStudents(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const db = getDb();
      const { search, classId, sectionId } = req.query;
      const page = Math.max(1, req.query.page ? parseInt(req.query.page as string) : 1);
      const limit = Math.min(
        500,
        Math.max(1, req.query.limit ? parseInt(req.query.limit as string) : 100)
      );
      const skip = (page - 1) * limit;

      // Build student match criteria
      const studentMatch: Record<string, unknown> = {
        tenantId: new ObjectId(req.tenantId!),
        branchId: new ObjectId(req.branchId),
        status: 'active',
      };

      if (classId) {
        studentMatch['currentEnrollment.classId'] = new ObjectId(classId as string);
      }
      if (sectionId) {
        studentMatch['currentEnrollment.sectionId'] = new ObjectId(sectionId as string);
      }
      // Each cashier only sees the students in their scope (institution, …).
      const visibility = await getStudentVisibilityFilter(req);
      if (visibility) studentMatch.$and = [visibility];

      // Name / admission no. / roll no. / phone search runs on students first
      if (search) {
        const rx = { $regex: String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
        studentMatch.$or = [
          { displayName: rx },
          { admissionNumber: rx },
          { rollNumber: rx },
          { 'contact.phone': rx },
        ];
      }

      // One indexed aggregation that returns only this page. Index-backed
      // $lookup (students → fee_assignments by studentId) keeps it ~1s for
      // 3,000+ students; shipping every student to the API took 10–30s.
      const tenantObjId = new ObjectId(req.tenantId!);
      const [facet] = await db
        .collection('students')
        .aggregate([
          { $match: studentMatch },
          {
            $project: { displayName: 1, firstName: 1, lastName: 1, admissionNumber: 1, photo: 1, currentEnrollment: 1 },
          },
          {
            $lookup: {
              from: 'fee_assignments',
              localField: '_id',
              foreignField: 'studentId',
              as: 'as',
              pipeline: [
                { $match: { tenantId: tenantObjId, status: 'active' } },
                { $project: { type: 1, summary: 1, createdAt: 1 } },
                { $sort: { createdAt: -1 } },
              ],
            },
          },
          {
            $addFields: {
              totalFee: { $sum: '$as.summary.totalFee' },
              paidAmount: { $sum: '$as.summary.totalPaid' },
              dueAmount: { $sum: '$as.summary.balance' },
            },
          },
          // Highest due first: the cashier's priority
          { $sort: { dueAmount: -1, _id: 1 } },
          { $facet: { data: [{ $skip: skip }, { $limit: limit }], total: [{ $count: 'n' }] } },
        ])
        .toArray();
      const total = (facet?.total?.[0]?.n as number) ?? 0;
      const pageRows = ((facet?.data ?? []) as Document[]).map((r) => ({
        s: r,
        as: (r.as ?? []) as Document[],
        totalFee: r.totalFee as number,
        paidAmount: r.paidAmount as number,
        dueAmount: r.dueAmount as number,
        status: !r.as?.length
          ? 'unassigned'
          : r.dueAmount === 0
            ? 'paid'
            : r.paidAmount > 0
              ? 'partial'
              : 'pending',
      }));

      // Line items, class and section names only for the rows on this page
      const pageAssignmentIds = pageRows.flatMap((r) => r.as.map((a) => a._id));
      const classIds = [...new Set(pageRows.map((r) => String(r.s.currentEnrollment?.classId ?? '')).filter(Boolean))];
      const sectionIds = [...new Set(pageRows.map((r) => String(r.s.currentEnrollment?.sectionId ?? '')).filter(Boolean))];
      const [components, classes, sections] = await Promise.all([
        pageAssignmentIds.length
          ? db.collection('fee_assignments').find({ _id: { $in: pageAssignmentIds } }, { projection: { components: 1 } }).toArray()
          : [],
        classIds.length
          ? db.collection('classes').find({ _id: { $in: classIds.map((id) => new ObjectId(id)) } }, { projection: { name: 1 } }).toArray()
          : [],
        sectionIds.length
          ? db.collection('sections').find({ _id: { $in: sectionIds.map((id) => new ObjectId(id)) } }, { projection: { name: 1 } }).toArray()
          : [],
      ]);
      const comps = new Map(components.map((c) => [String(c._id), c.components]));
      const className = new Map(classes.map((c) => [String(c._id), c.name]));
      const sectionName = new Map(sections.map((c) => [String(c._id), c.name]));

      const students = pageRows.map(({ s, as, totalFee, paidAmount, dueAmount, status }) => ({
        _id: s._id,
        studentId: s.admissionNumber,
        name: s.displayName || [s.firstName, s.lastName].filter(Boolean).join(' '),
        photo: s.photo ?? null,
        class: className.get(String(s.currentEnrollment?.classId)) ?? s.currentEnrollment?.className,
        section: sectionName.get(String(s.currentEnrollment?.sectionId)) ?? s.currentEnrollment?.sectionName,
        totalFee,
        paidAmount,
        dueAmount,
        // Backward compat: first assignment ID
        assignmentId: as[0]?._id,
        // All assignments for the multi-assignment payment dialog
        assignments: as.map((a) => ({
          _id: a._id,
          type: a.type ?? 'tuition',
          totalFee: a.summary?.totalFee,
          paidAmount: a.summary?.totalPaid,
          dueAmount: a.summary?.balance,
          components: comps.get(String(a._id)),
        })),
        hasHostelFee: as.some((a) => a.type === 'hostel'),
        status,
      }));
      const totalPages = Math.max(1, Math.ceil(total / limit));

      success(res, students, {
        page,
        limit,
        total,
        totalPages,
        hasMore: skip + students.length < total,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get fee counter statistics
   * GET /finance/fee-counter/stats
   */
  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const db = getDb();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Get today's collection
      // NOTE: the feeTransactions collection uses `receiptDate` and `totalAmount`,
      // not `paymentDate`/`amount`. The stored status is 'success' (the FE
      // formatter renames it to 'completed' for display only).
      const todayCollectionResult = await db
        .collection('fee_transactions')
        .aggregate([
          {
            $match: {
              tenantId: new ObjectId(req.tenantId!),
              branchId: new ObjectId(req.branchId),
              status: 'success',
              receiptDate: { $gte: today, $lt: tomorrow },
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$totalAmount' },
            },
          },
        ])
        .toArray();

      // Get total collected this academic year
      const totalCollectionResult = await db
        .collection('fee_transactions')
        .aggregate([
          {
            $match: {
              tenantId: new ObjectId(req.tenantId!),
              branchId: new ObjectId(req.branchId),
              status: 'success',
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$totalAmount' },
            },
          },
        ])
        .toArray();

      // Get pending dues
      const pendingDuesResult = await db
        .collection('fee_assignments')
        .aggregate([
          {
            $match: {
              tenantId: new ObjectId(req.tenantId!),
              branchId: new ObjectId(req.branchId),
              status: 'active',
              'summary.balance': { $gt: 0 },
            },
          },
          {
            $group: {
              _id: null,
              totalDues: { $sum: '$summary.balance' },
              count: { $sum: 1 },
            },
          },
        ])
        .toArray();

      // Get cleared students count
      const clearedCount = await db.collection('fee_assignments').countDocuments({
        tenantId: new ObjectId(req.tenantId!),
        branchId: new ObjectId(req.branchId),
        status: 'cleared',
      });

      // Get total students with assignments
      const totalStudents = await db.collection('fee_assignments').countDocuments({
        tenantId: new ObjectId(req.tenantId!),
        branchId: new ObjectId(req.branchId),
        status: { $in: ['active', 'cleared'] },
      });

      const stats = {
        todayCollection: todayCollectionResult[0]?.total || 0,
        totalCollected: totalCollectionResult[0]?.total || 0,
        pendingDues: pendingDuesResult[0]?.totalDues || 0,
        studentsCleared: clearedCount,
        totalStudents: totalStudents,
      };

      success(res, stats);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get dues list for fee collection
   * GET /finance/fee-counter/dues
   */
  async getDues(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const db = getDb();
      const { classId, status } = req.query;
      const duesVisibility = await getStudentVisibilityFilter(req);

      const matchStage: Record<string, unknown> = {
        tenantId: new ObjectId(req.tenantId!),
        branchId: new ObjectId(req.branchId),
        status: 'active',
        'summary.balance': { $gt: 0 },
      };

      const pipeline = [
        { $match: matchStage },
        // Lookup student
        {
          $lookup: {
            from: 'students',
            localField: 'studentId',
            foreignField: '_id',
            as: 'student',
          },
        },
        { $unwind: '$student' },
        ...(duesVisibility ? [{ $match: underField(duesVisibility, 'student') }] : []),
        // Filter by classId through student enrollment
        ...(classId && classId !== 'all'
          ? [{ $match: { 'student.currentEnrollment.classId': new ObjectId(classId as string) } }]
          : []),
        // Lookup class from student's enrollment
        {
          $lookup: {
            from: 'classes',
            localField: 'student.currentEnrollment.classId',
            foreignField: '_id',
            as: 'classInfo',
          },
        },
        { $unwind: { path: '$classInfo', preserveNullAndEmptyArrays: true } },
        // Lookup section from student's enrollment
        {
          $lookup: {
            from: 'sections',
            localField: 'student.currentEnrollment.sectionId',
            foreignField: '_id',
            as: 'sectionInfo',
          },
        },
        { $unwind: { path: '$sectionInfo', preserveNullAndEmptyArrays: true } },
        // Calculate overdue
        {
          $addFields: {
            overdueAmount: {
              $cond: {
                if: { $gt: ['$summary.overdueFine', 0] },
                then: '$summary.overdueFine',
                else: 0,
              },
            },
            dueStatus: {
              $cond: {
                if: { $gt: ['$summary.overdueFine', 0] },
                then: 'overdue',
                else: {
                  $cond: {
                    if: { $gt: ['$summary.totalPaid', 0] },
                    then: 'partial',
                    else: 'pending',
                  },
                },
              },
            },
          },
        },
        // Filter by status if provided
        ...(status && status !== 'all' ? [{ $match: { dueStatus: status } }] : []),
        // Project
        {
          $project: {
            _id: 1,
            studentDocId: '$student._id',
            studentName: '$student.displayName',
            studentId: '$student.admissionNumber',
            class: '$classInfo.name',
            section: '$sectionInfo.name',
            parentName: { $ifNull: ['$student.fatherName', '$student.guardianName'] },
            phone: '$student.contactInfo.phone',
            totalFee: '$summary.totalFee',
            paidAmount: '$summary.totalPaid',
            dueAmount: '$summary.balance',
            overdueAmount: 1,
            lastPaymentDate: '$lastPaymentDate',
            dueInstallments: { $size: { $ifNull: ['$overdueInstallments', []] } },
            type: { $ifNull: ['$type', 'tuition'] },
            status: '$dueStatus',
          },
        },
        { $sort: { dueAmount: -1 } },
        { $limit: 100 },
      ];

      const dues = await db.collection('fee_assignments').aggregate(pipeline).toArray();

      success(res, dues);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Collect fee payment
   * POST /finance/fee-counter/collect
   */
  async collectFee(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const {
        studentId,
        assignmentId,
        amount,
        paymentMode,
        remarks,
        components,
        installmentNumbers,
      } = req.body;

      // A cashier collects only from students in their own scope.
      if (studentId) await assertStudentInScope(req, String(studentId));

      if (!studentId || !assignmentId || !amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid payment details' },
        });
      }

      // Components/installmentNumbers are passed through to the transaction
      // record so receipts can show exactly what was collected (e.g.
      // "Transport Fee" or "Lab + Library"). They're optional — when omitted,
      // the payment is recorded against the assignment as a whole.
      const safeComponents: Array<{ componentCode: string; name: string; amount: number }> =
        Array.isArray(components)
          ? components
              .filter(
                (c: unknown): c is { componentCode: string; name: string; amount: number } =>
                  !!c &&
                  typeof (c as { componentCode?: unknown }).componentCode === 'string' &&
                  typeof (c as { name?: unknown }).name === 'string' &&
                  typeof (c as { amount?: unknown }).amount === 'number'
              )
              .map((c) => ({
                componentCode: c.componentCode,
                name: c.name,
                amount: c.amount,
              }))
          : [];
      const safeInstallments: number[] = Array.isArray(installmentNumbers)
        ? installmentNumbers.filter((n: unknown): n is number => typeof n === 'number')
        : [];

      const result = await feeTransactionService.collectFee(
        req.tenantId!,
        req.branchId,
        {
          studentId,
          feeAssignmentId: assignmentId,
          paymentMode: paymentMode || 'cash',
          // UPI ref / cheque no. / card last-4 — printed on the receipt.
          paymentDetails: req.body.paymentDetails,
          components: safeComponents,
          installmentNumbers: safeInstallments,
          feeAmount: Number(amount),
          remarks,
        },
        req.user!.userId
      );

      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Sync fee assignments - assign fee structures to any unassigned students
   * POST /finance/fee-counter/sync
   */
  async syncAssignments(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      // academicBatchId is now optional. When provided, sync only students
      // currently enrolled in that batch (existing fee-counter UX). When
      // omitted, sync the entire branch — useful from the structures page.
      const { academicBatchId } = req.body || {};

      const result = await feeStructureService.syncAssignments(
        req.tenantId!,
        req.branchId,
        academicBatchId,
        req.user!.userId
      );

      success(res, result);
    } catch (error) {
      next(error);
    }
  }
}

export const feeCounterController = new FeeCounterController();

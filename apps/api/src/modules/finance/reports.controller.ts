import { Request, Response, NextFunction } from 'express';
import { ObjectId } from 'mongodb';
import { financeReportsService, DueReportParams, CollectionReportParams } from './reports.service';
import { smsService } from '../communication/sms.service';
import { collections } from '../../config/database';
import { success } from '../../utils/response';

class FinanceReportsController {
  // ============ Unassigned Students ============
  async getUnassignedStudents(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const { academicBatchId, classId, sectionId, page, limit } = req.query;

      if (!academicBatchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Academic batch ID is required' },
        });
      }

      const result = await financeReportsService.getUnassignedStudents(
        req.tenantId!,
        req.branchId,
        {
          academicBatchId: academicBatchId as string,
          classId: classId as string,
          sectionId: sectionId as string,
          page: page ? parseInt(page as string) : 1,
          limit: limit ? parseInt(limit as string) : 50,
        }
      );

      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  // ============ Due Reports ============
  async getDuesSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const { academicBatchId, branchId } = req.query;

      if (!academicBatchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Academic batch ID is required' },
        });
      }

      const params: DueReportParams = {
        academicBatchId: academicBatchId as string,
        branchId: branchId as string,
      };

      const result = await financeReportsService.getDuesSummary(req.tenantId!, params);
      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async getClassWiseDues(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const { academicBatchId } = req.query;

      if (!academicBatchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Academic batch ID is required' },
        });
      }

      const result = await financeReportsService.getClassWiseDues(req.tenantId!, req.branchId, {
        academicBatchId: academicBatchId as string,
      });

      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async getBranchWiseDues(req: Request, res: Response, next: NextFunction) {
    try {
      const { academicBatchId } = req.query;

      if (!academicBatchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Academic batch ID is required' },
        });
      }

      const result = await financeReportsService.getBranchWiseDues(req.tenantId!, {
        academicBatchId: academicBatchId as string,
      });

      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async getStudentWiseDues(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const { academicBatchId, classId, sectionId, page, limit } = req.query;

      if (!academicBatchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Academic batch ID is required' },
        });
      }

      const result = await financeReportsService.getStudentWiseDues(req.tenantId!, req.branchId, {
        academicBatchId: academicBatchId as string,
        classId: classId as string,
        sectionId: sectionId as string,
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 50,
      });

      success(res, result.data, result.meta, undefined, { summary: result.summary });
    } catch (error) {
      next(error);
    }
  }

  async getSiblingDues(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const { academicBatchId, page, limit } = req.query;

      if (!academicBatchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Academic batch ID is required' },
        });
      }

      const result = await financeReportsService.getSiblingDues(req.tenantId!, req.branchId, {
        academicBatchId: academicBatchId as string,
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 50,
      });

      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getInstallmentWiseDues(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const { academicBatchId, installmentNumber, page, limit } = req.query;

      if (!academicBatchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Academic batch ID is required' },
        });
      }

      const result = await financeReportsService.getInstallmentWiseDues(
        req.tenantId!,
        req.branchId,
        {
          academicBatchId: academicBatchId as string,
          installmentNumber: installmentNumber ? parseInt(installmentNumber as string) : undefined,
          page: page ? parseInt(page as string) : 1,
          limit: limit ? parseInt(limit as string) : 50,
        }
      );

      success(res, result.data, result.meta, undefined, {
        installmentSummary: result.installmentSummary,
      });
    } catch (error) {
      next(error);
    }
  }

  // ============ Collection Reports ============
  async getFeeTypeReport(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const { fromDate, toDate } = req.query;

      if (!fromDate || !toDate) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'fromDate and toDate are required' },
        });
      }

      const result = await financeReportsService.getFeeTypeReport(req.tenantId!, req.branchId, {
        fromDate: fromDate as string,
        toDate: toDate as string,
      });

      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async getStudentStatement(req: Request, res: Response, next: NextFunction) {
    try {
      const studentId = req.params.studentId as string;
      const { academicBatchId } = req.query;

      if (!academicBatchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Academic batch ID is required' },
        });
      }

      const result = await financeReportsService.getStudentStatement(
        req.tenantId!,
        studentId,
        academicBatchId as string
      );

      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async getFeeTypeWiseTransactions(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const { fromDate, toDate, feeType, page, limit } = req.query;

      if (!fromDate || !toDate) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'fromDate and toDate are required' },
        });
      }

      const params: CollectionReportParams = {
        fromDate: fromDate as string,
        toDate: toDate as string,
        feeType: feeType as string,
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 50,
      };

      const result = await financeReportsService.getFeeTypeWiseTransactions(
        req.tenantId!,
        req.branchId,
        params
      );

      success(res, result.data, result.meta, undefined, { summary: result.summary });
    } catch (error) {
      next(error);
    }
  }

  async getClassWiseConcessionReport(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const { academicBatchId } = req.query;

      if (!academicBatchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Academic batch ID is required' },
        });
      }

      const result = await financeReportsService.getClassWiseConcessionReport(
        req.tenantId!,
        req.branchId,
        { academicBatchId: academicBatchId as string }
      );

      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async getStudentWiseConcessionReport(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const { academicBatchId, classId, page, limit } = req.query;

      if (!academicBatchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Academic batch ID is required' },
        });
      }

      const result = await financeReportsService.getStudentWiseConcessionReport(
        req.tenantId!,
        req.branchId,
        {
          academicBatchId: academicBatchId as string,
          classId: classId as string,
          page: page ? parseInt(page as string) : 1,
          limit: limit ? parseInt(limit as string) : 50,
        }
      );

      success(res, result.data, result.meta, undefined, { summary: result.summary });
    } catch (error) {
      next(error);
    }
  }

  // ============ Total Paid and Due Report ============
  async getTotalPaidAndDueReport(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const { academicBatchId, fromDate, toDate, groupBy } = req.query;

      if (!academicBatchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Academic batch ID is required' },
        });
      }

      const result = await financeReportsService.getTotalPaidAndDueReport(
        req.tenantId!,
        req.branchId,
        {
          academicBatchId: academicBatchId as string,
          fromDate: fromDate as string,
          toDate: toDate as string,
          groupBy: groupBy as 'day' | 'week' | 'month',
        }
      );

      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  // ============ Send Due Reminder ============
  async sendDueReminder(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const { studentIds, message, channel = 'sms' } = req.body;

      if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Student IDs are required' },
        });
      }

      // Fetch students with their fee assignments to get due amounts
      const studentsWithDues = await collections.students
        .aggregate([
          {
            $match: {
              _id: { $in: studentIds.map((id: string) => new ObjectId(id)) },
              tenantId: new ObjectId(req.tenantId!),
            },
          },
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
                        { $eq: ['$status', 'active'] },
                        { $gt: ['$summary.balance', 0] },
                      ],
                    },
                  },
                },
                { $sort: { createdAt: -1 } },
                { $limit: 1 },
              ],
              as: 'feeAssignment',
            },
          },
          { $unwind: { path: '$feeAssignment', preserveNullAndEmptyArrays: false } },
          {
            $project: {
              _id: 1,
              displayName: 1,
              admissionNumber: 1,
              phone: { $ifNull: ['$contactInfo.phone', { $arrayElemAt: ['$guardians.phone', 0] }] },
              dueAmount: '$feeAssignment.summary.balance',
              className: '$currentEnrollment.className',
            },
          },
        ])
        .toArray();

      if (studentsWithDues.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'NO_RECIPIENTS',
            message: 'No students with valid phone numbers and pending dues found',
          },
        });
      }

      // Filter students with valid phone numbers
      const validRecipients = studentsWithDues.filter(
        (s) => s.phone && /^[6-9]\d{9}$/.test(s.phone.replace(/^\+91|^91|^0/, ''))
      );

      if (validRecipients.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_VALID_PHONES', message: 'No students with valid phone numbers found' },
        });
      }

      // Default message template if not provided
      const defaultMessage =
        'Dear Parent, this is a reminder that fee dues of Rs. {dueAmount} are pending for {studentName} ({admissionNumber}). Please clear the dues at the earliest. - {instituteName}';

      // Get institution name from tenant
      const tenant = await collections.tenants.findOne({ _id: new ObjectId(req.tenantId!) });
      const instituteName = tenant?.name || 'School';

      // Prepare recipients with personalized variables
      const recipients = validRecipients.map((student) => ({
        phone: student.phone.replace(/^\+91|^91|^0/, ''),
        name: student.displayName,
        studentId: student._id.toString(),
        variables: {
          studentName: student.displayName,
          admissionNumber: student.admissionNumber,
          dueAmount: student.dueAmount.toLocaleString('en-IN'),
          className: student.className || 'N/A',
          instituteName,
        },
      }));

      // Send SMS using the SMS service
      if (channel === 'sms' || channel === 'all') {
        const smsResult = await smsService.sendSMS(
          req.tenantId!,
          req.branchId,
          {
            message: message || defaultMessage,
            recipients,
            category: 'fee',
            messageType: 'transactional',
          },
          req.user!.userId
        );

        success(res, {
          sent: validRecipients.length,
          skipped: studentIds.length - validRecipients.length,
          smsLogId: smsResult._id,
          status: smsResult.status,
          message: smsResult.message,
        });
      } else {
        // For email/whatsapp channels (not yet implemented)
        success(res, {
          sent: 0,
          skipped: studentIds.length,
          message: `${channel} channel not yet implemented. Use 'sms' or 'all'.`,
        });
      }
    } catch (error) {
      next(error);
    }
  }
}

export const financeReportsController = new FinanceReportsController();

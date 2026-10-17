import { Request, Response, NextFunction } from 'express';
import { studentAttendanceService } from './studentAttendance.service';
import { assertTeachingScope, assertStudentSelfScope } from '../teaching/scope';
import { success, created } from '../../utils/response';

class StudentAttendanceController {
  async getAttendance(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const { classId, sectionId, date, subjectId, period, batchId } = req.query;

      if (!classId || !sectionId || !date) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'classId, sectionId, and date are required' },
        });
      }

      await assertTeachingScope(req, sectionId as string, { allowNonTeachingStaff: true });
      const attendance = await studentAttendanceService.findByDate(
        req.tenantId!,
        req.branchId,
        classId as string,
        sectionId as string,
        date as string,
        subjectId as string | undefined,
        period ? parseInt(period as string, 10) : undefined,
        batchId as string | undefined
      );
      success(res, attendance);
    } catch (error) {
      next(error);
    }
  }

  async markAttendance(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      await assertTeachingScope(req, req.body.sectionId, { allowNonTeachingStaff: true });
      const attendance = await studentAttendanceService.markAttendance(
        req.tenantId!,
        req.branchId,
        req.body,
        req.user!.userId
      );
      created(res, attendance, 'Attendance marked successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateRecord(req: Request, res: Response, next: NextFunction) {
    try {
      const { studentId } = req.body;

      if (!studentId) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'studentId is required' },
        });
      }

      const recordSectionId = await studentAttendanceService.getRecordSectionId(
        req.tenantId!,
        req.params.id as string
      );
      if (recordSectionId) {
        await assertTeachingScope(req, recordSectionId, { allowNonTeachingStaff: true });
      }

      const attendance = await studentAttendanceService.updateRecord(
        req.tenantId!,
        req.params.id as string,
        studentId,
        req.body,
        req.user!.userId
      );
      success(res, attendance, undefined, 'Attendance updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async getStudentHistory(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      await assertStudentSelfScope(req, req.params.studentId as string);
      const history = await studentAttendanceService.getStudentHistory(
        req.tenantId!,
        req.branchId,
        req.params.studentId as string,
        req.query.fromDate as string,
        req.query.toDate as string
      );
      success(res, history);
    } catch (error) {
      next(error);
    }
  }

  async getDailyReport(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
      const report = await studentAttendanceService.getDailyReport(
        req.tenantId!,
        req.branchId,
        date
      );
      success(res, report);
    } catch (error) {
      next(error);
    }
  }

  async getClassWiseReport(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const { classId, fromDate, toDate } = req.query;

      if (!classId || !fromDate || !toDate) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'classId, fromDate, and toDate are required',
          },
        });
      }

      const report = await studentAttendanceService.getClassWiseReport(
        req.tenantId!,
        req.branchId,
        classId as string,
        fromDate as string,
        toDate as string
      );
      success(res, report);
    } catch (error) {
      next(error);
    }
  }

  async getStudentWiseReport(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const { classId, sectionId, fromDate, toDate } = req.query;

      if (!classId || !sectionId || !fromDate || !toDate) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'classId, sectionId, fromDate, and toDate are required',
          },
        });
      }

      const report = await studentAttendanceService.getStudentWiseReport(
        req.tenantId!,
        req.branchId,
        classId as string,
        sectionId as string,
        fromDate as string,
        toDate as string
      );
      success(res, report);
    } catch (error) {
      next(error);
    }
  }

  async getMonthlyReport(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();
      const month = req.query.month
        ? parseInt(req.query.month as string)
        : new Date().getMonth() + 1;

      const report = await studentAttendanceService.getMonthlyReport(
        req.tenantId!,
        req.branchId,
        year,
        month
      );
      success(res, report);
    } catch (error) {
      next(error);
    }
  }

  async lockAttendance(req: Request, res: Response, next: NextFunction) {
    try {
      const recordSectionId = await studentAttendanceService.getRecordSectionId(
        req.tenantId!,
        req.params.id as string
      );
      if (recordSectionId) {
        await assertTeachingScope(req, recordSectionId, { allowNonTeachingStaff: true });
      }

      const attendance = await studentAttendanceService.lockAttendance(
        req.tenantId!,
        req.params.id as string
      );
      success(res, attendance, undefined, 'Attendance locked successfully');
    } catch (error) {
      next(error);
    }
  }

  /** Subject-wise % and exam eligibility (75% rule) for a section. */
  async subjectWiseReport(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }
      const { sectionId, fromDate, toDate, threshold } = req.query;
      if (!sectionId || !fromDate || !toDate) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'sectionId, fromDate, and toDate are required',
          },
        });
      }
      const report = await studentAttendanceService.getSubjectWiseReport(
        req.tenantId!,
        req.branchId,
        sectionId as string,
        fromDate as string,
        toDate as string,
        { eligibilityThreshold: threshold ? Number(threshold) : undefined }
      );
      success(res, report);
    } catch (error) {
      next(error);
    }
  }

  async exportDailyReport(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
      const format = (req.query.format as 'csv' | 'json') || 'csv';

      const result = await studentAttendanceService.exportDailyReport(
        req.tenantId!,
        req.branchId,
        date,
        format
      );

      if (format === 'csv' && 'content' in result) {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        return res.send(result.content);
      }

      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async exportStudentWiseReport(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const { classId, sectionId, fromDate, toDate } = req.query;

      if (!classId || !sectionId || !fromDate || !toDate) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'classId, sectionId, fromDate, and toDate are required',
          },
        });
      }

      const format = (req.query.format as 'csv' | 'json') || 'csv';

      const result = await studentAttendanceService.exportStudentWiseReport(
        req.tenantId!,
        req.branchId,
        classId as string,
        sectionId as string,
        fromDate as string,
        toDate as string,
        format
      );

      if (format === 'csv' && 'content' in result) {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        return res.send(result.content);
      }

      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  // ============ Self-Service Endpoints ============

  async getStudentSelfAttendance(req: Request, res: Response, next: NextFunction) {
    try {
      const studentId = req.params.studentId as string;
      await assertStudentSelfScope(req, studentId);
      const academicBatchId = req.query.academicBatchId as string | undefined;

      const attendance = await studentAttendanceService.getStudentSelfAttendance(
        req.tenantId!,
        studentId,
        academicBatchId
      );
      success(res, attendance);
    } catch (error) {
      next(error);
    }
  }

  async getParentChildAttendance(req: Request, res: Response, next: NextFunction) {
    try {
      const parentPhone = req.query.phone as string;
      const studentId = req.query.studentId as string | undefined;

      if (!parentPhone) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Parent phone number is required' },
        });
      }

      const attendance = await studentAttendanceService.getParentChildAttendance(
        req.tenantId!,
        parentPhone,
        studentId
      );
      success(res, attendance);
    } catch (error) {
      next(error);
    }
  }

  // ============ Bulk Upload ============

  async getBulkUploadTemplate(_req: Request, res: Response, next: NextFunction) {
    try {
      const template = studentAttendanceService.getBulkUploadTemplate();
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${template.filename}"`);
      res.send(template.content);
    } catch (error) {
      next(error);
    }
  }

  async validateBulkUpload(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const { records } = req.body;

      if (!records || !Array.isArray(records)) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'records array is required' },
        });
      }

      const result = await studentAttendanceService.validateBulkUpload(
        req.tenantId!,
        req.branchId,
        records
      );
      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async processBulkUpload(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const { csvContent } = req.body;

      if (!csvContent) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'CSV content is required' },
        });
      }

      const result = await studentAttendanceService.processBulkUploadCSV(
        req.tenantId!,
        req.branchId,
        csvContent,
        req.user!.userId
      );

      if (result.success) {
        success(res, result, undefined, 'Attendance uploaded successfully');
      } else {
        success(res, result);
      }
    } catch (error) {
      next(error);
    }
  }
}

export const studentAttendanceController = new StudentAttendanceController();

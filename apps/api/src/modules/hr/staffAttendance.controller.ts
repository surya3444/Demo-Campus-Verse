import { Request, Response, NextFunction } from 'express';
import { ObjectId } from 'mongodb';
import { staffAttendanceService } from './staffAttendance.service';
import { collections } from '../../config/database';
import { success } from '../../utils/response';
import { ApiError } from '../../middleware/errorHandler';

/** Resolve the staff profile linked to the logged-in user (self-service routes). */
async function getSelfStaff(req: Request) {
  const staff = await collections.staff.findOne({
    tenantId: new ObjectId(req.tenantId),
    userId: new ObjectId(req.user!.userId),
  });

  if (!staff) {
    throw new ApiError('STAFF_NOT_FOUND', 'Staff profile not found for user', 404);
  }

  return staff;
}

class StaffAttendanceController {
  async markAttendance(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const result = await staffAttendanceService.markAttendance(
        req.tenantId!,
        req.branchId,
        req.body,
        req.user!.userId
      );
      success(res, result, undefined, 'Attendance marked successfully');
    } catch (error) {
      next(error);
    }
  }

  async findByDate(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
      const departmentId = req.query.departmentId as string | undefined;
      const result = await staffAttendanceService.findByDate(
        req.tenantId!,
        req.branchId,
        date,
        departmentId
      );
      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async getMyAttendance(req: Request, res: Response, next: NextFunction) {
    try {
      // Get staff ID from the user's linked staff profile
      const staff = await collections.staff.findOne({
        tenantId: new ObjectId(req.tenantId),
        userId: new ObjectId(req.user!.userId),
      });

      if (!staff) {
        return res.status(404).json({
          success: false,
          error: { code: 'STAFF_NOT_FOUND', message: 'Staff profile not found for user' },
        });
      }

      const month = req.query.month ? parseInt(req.query.month as string) : undefined;
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;

      const result = await staffAttendanceService.getMyAttendance(
        req.tenantId!,
        staff._id.toString(),
        month,
        year
      );
      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  // ============ Self Check-in / Check-out (self-service) ============

  async getSelfToday(req: Request, res: Response, next: NextFunction) {
    try {
      const staff = await getSelfStaff(req);
      const result = await staffAttendanceService.getSelfToday(req.tenantId!, staff._id.toString());
      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async selfCheckIn(req: Request, res: Response, next: NextFunction) {
    try {
      const staff = await getSelfStaff(req);
      const branchId = req.branchId || staff.branchId?.toString();
      if (!branchId) {
        throw new ApiError('BRANCH_REQUIRED', 'Branch context is required', 400);
      }

      const result = await staffAttendanceService.selfCheckIn(
        req.tenantId!,
        branchId,
        staff._id.toString(),
        req.body?.location
      );
      success(res, result, undefined, 'Checked in successfully');
    } catch (error) {
      next(error);
    }
  }

  async selfCheckOut(req: Request, res: Response, next: NextFunction) {
    try {
      const staff = await getSelfStaff(req);
      const branchId = req.branchId || staff.branchId?.toString();
      if (!branchId) {
        throw new ApiError('BRANCH_REQUIRED', 'Branch context is required', 400);
      }

      const result = await staffAttendanceService.selfCheckOut(
        req.tenantId!,
        branchId,
        staff._id.toString(),
        req.body?.location
      );
      success(res, result, undefined, 'Checked out successfully');
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
      const result = await staffAttendanceService.getDailyReport(req.tenantId!, req.branchId, date);
      success(res, result);
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

      const now = new Date();
      const month = req.query.month ? parseInt(req.query.month as string) : now.getMonth() + 1;
      const year = req.query.year ? parseInt(req.query.year as string) : now.getFullYear();
      const departmentId = req.query.departmentId as string | undefined;

      const result = await staffAttendanceService.getMonthlyReport(
        req.tenantId!,
        req.branchId,
        month,
        year,
        departmentId
      );
      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async lockAttendance(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const { date } = req.body;
      await staffAttendanceService.lockAttendance(
        req.tenantId!,
        req.branchId,
        date,
        req.user!.userId
      );
      success(res, null, undefined, 'Attendance locked');
    } catch (error) {
      next(error);
    }
  }

  async unlockAttendance(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const { date } = req.body;
      await staffAttendanceService.unlockAttendance(req.tenantId!, req.branchId, date);
      success(res, null, undefined, 'Attendance unlocked');
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
      const departmentId = req.query.departmentId as string | undefined;
      const format = (req.query.format as 'csv' | 'json') || 'csv';

      const result = await staffAttendanceService.exportDailyReport(
        req.tenantId!,
        req.branchId,
        date,
        departmentId,
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

  async exportMonthlyReport(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const now = new Date();
      const month = req.query.month ? parseInt(req.query.month as string) : now.getMonth() + 1;
      const year = req.query.year ? parseInt(req.query.year as string) : now.getFullYear();
      const departmentId = req.query.departmentId as string | undefined;
      const format = (req.query.format as 'csv' | 'json') || 'csv';

      const result = await staffAttendanceService.exportMonthlyReport(
        req.tenantId!,
        req.branchId,
        month,
        year,
        departmentId,
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
}

export const staffAttendanceController = new StaffAttendanceController();

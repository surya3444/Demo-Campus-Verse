import { Request, Response, NextFunction } from 'express';
import { hasPermission } from '../../middleware/rbac';
import { studentDashboardService } from './studentDashboard.service';
import { success } from '../../utils/response';
import { ApiError } from '../../middleware/errorHandler';
import { collections } from '../../config/database';
import { ObjectId } from 'mongodb';

class StudentDashboardController {
  async getStudentDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      // Resolve studentId from user document
      const user = await collections.users.findOne({
        _id: new ObjectId(req.user!.userId),
        tenantId: new ObjectId(req.tenantId!),
      });

      const studentId = user?.studentId as ObjectId | undefined;
      if (!studentId) {
        throw new ApiError('STUDENT_NOT_FOUND', 'No student record linked to this user', 404);
      }

      const data = await studentDashboardService.getStudentDashboard(
        req.tenantId!,
        req.branchId!,
        studentId.toString()
      );
      // Admins choose per role whether fees appear on the dashboard.
      success(
        res,
        hasPermission(req.user, 'dashboard.fees', 'view') ? data : { ...data, fees: null }
      );
    } catch (error) {
      next(error);
    }
  }
}

export const studentDashboardController = new StudentDashboardController();

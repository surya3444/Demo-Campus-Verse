import { Request, Response, NextFunction } from 'express';
import { teacherDashboardService } from './teacherDashboard.service';
import { getStaffIdForUser } from '../teaching/teaching.utils';
import { success } from '../../utils/response';

class TeacherDashboardController {
  async getTeacherDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const staffId = await getStaffIdForUser(req.tenantId!, req.user!.userId);
      const data = await teacherDashboardService.getTeacherDashboard(
        req.tenantId!,
        req.branchId!,
        staffId
      );
      success(res, data);
    } catch (error) {
      next(error);
    }
  }
}

export const teacherDashboardController = new TeacherDashboardController();

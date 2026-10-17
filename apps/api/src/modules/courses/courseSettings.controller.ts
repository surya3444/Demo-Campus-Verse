import { Request, Response, NextFunction } from 'express';
import { courseSettingsService } from './courseSettings.service';
import { success } from '../../utils/response';

class CourseSettingsController {
  async getSettings(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }
      const settings = await courseSettingsService.getSettings(req.tenantId!, req.branchId);
      success(res, settings);
    } catch (error) {
      next(error);
    }
  }

  async updateSettings(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }
      const settings = await courseSettingsService.updateSettings(
        req.tenantId!,
        req.branchId,
        req.body,
        req.user!.userId
      );
      success(res, settings, undefined, 'Course settings updated');
    } catch (error) {
      next(error);
    }
  }
}

export const courseSettingsController = new CourseSettingsController();

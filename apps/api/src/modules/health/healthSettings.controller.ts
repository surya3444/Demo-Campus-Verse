import { Request, Response, NextFunction } from 'express';
import { healthSettingsService } from './healthSettings.service';
import { success } from '../../utils/response';

class HealthSettingsController {
  async getSettings(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const settings = await healthSettingsService.getSettings(req.tenantId!, req.branchId);
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

      const settings = await healthSettingsService.updateSettings(
        req.tenantId!,
        req.branchId,
        req.body,
        req.user!.userId
      );
      success(res, settings, undefined, 'Health settings updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async initializeSettings(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const settings = await healthSettingsService.initializeSettings(
        req.tenantId!,
        req.branchId,
        req.user!.userId
      );
      success(res, settings, undefined, 'Health settings initialized successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const healthSettingsController = new HealthSettingsController();

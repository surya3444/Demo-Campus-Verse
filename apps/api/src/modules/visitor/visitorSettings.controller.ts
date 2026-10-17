import { Request, Response, NextFunction } from 'express';
import { visitorSettingsService } from './visitorSettings.service';
import { success } from '../../utils/response';

class VisitorSettingsController {
  async get(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const settings = await visitorSettingsService.get(req.tenantId!, req.branchId);
      success(res, settings);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const settings = await visitorSettingsService.update(req.tenantId!, req.branchId, req.body);
      success(res, settings, undefined, 'Settings updated successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const visitorSettingsController = new VisitorSettingsController();

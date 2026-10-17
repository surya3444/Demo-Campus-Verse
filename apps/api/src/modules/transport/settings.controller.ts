import { Request, Response, NextFunction } from 'express';
import { transportSettingsService } from './settings.service';
import { success } from '../../utils/response';

class TransportSettingsController {
  async get(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const settings = await transportSettingsService.get(req.tenantId!, req.branchId);
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

      const settings = await transportSettingsService.update(
        req.tenantId!,
        req.branchId,
        req.body,
        req.user!.userId
      );
      success(res, settings, undefined, 'Transport settings updated');
    } catch (error) {
      next(error);
    }
  }
}

export const transportSettingsController = new TransportSettingsController();

import { Request, Response, NextFunction } from 'express';
import { hostelSettingsService } from './hostelSettings.service';
import { success } from '../../utils/response';

class HostelSettingsController {
  async getSettings(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const settings = await hostelSettingsService.getSettings(req.tenantId!, req.branchId);
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

      const settings = await hostelSettingsService.updateSettings(
        req.tenantId!,
        req.branchId,
        req.body,
        req.user!.userId
      );
      success(res, settings, undefined, 'Hostel settings updated successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const hostelSettingsController = new HostelSettingsController();

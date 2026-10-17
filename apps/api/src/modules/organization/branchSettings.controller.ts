import { Request, Response, NextFunction } from 'express';
import { branchSettingsService } from './branchSettings.service';
import { success } from '../../utils/response';

class BranchSettingsController {
  async getSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await branchSettingsService.getBranchSettings(
        req.tenantId!,
        req.params.branchId as string
      );
      success(res, settings);
    } catch (error) {
      next(error);
    }
  }

  async updateSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await branchSettingsService.updateBranchSettings(
        req.tenantId!,
        req.params.branchId as string,
        req.body,
        req.user!.userId
      );
      success(res, settings, undefined, 'Branch settings updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async getEffectiveSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await branchSettingsService.getEffectiveSettings(
        req.tenantId!,
        req.params.branchId as string
      );
      success(res, settings);
    } catch (error) {
      next(error);
    }
  }

  async addHoliday(req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await branchSettingsService.addHoliday(
        req.tenantId!,
        req.params.branchId as string,
        req.body,
        req.user!.userId
      );
      success(res, settings, undefined, 'Holiday added successfully');
    } catch (error) {
      next(error);
    }
  }

  async removeHoliday(req: Request, res: Response, next: NextFunction) {
    try {
      const { date } = req.body;

      if (!date) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Date is required' },
        });
      }

      const settings = await branchSettingsService.removeHoliday(
        req.tenantId!,
        req.params.branchId as string,
        date,
        req.user!.userId
      );
      success(res, settings, undefined, 'Holiday removed successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const branchSettingsController = new BranchSettingsController();

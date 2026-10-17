import { Request, Response, NextFunction } from 'express';
import { obeSettingsService } from './settings.service';
import { success } from '../../utils/response';

class ObeSettingsController {
  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await obeSettingsService.getSettings(req.tenantId!, req.branchId!);
      success(res, settings);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await obeSettingsService.updateSettings(
        req.tenantId!,
        req.branchId!,
        req.body,
        req.user!.userId
      );
      success(res, settings, undefined, 'OBE settings updated');
    } catch (error) {
      next(error);
    }
  }
}

export const obeSettingsController = new ObeSettingsController();

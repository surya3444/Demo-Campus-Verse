import { Request, Response, NextFunction } from 'express';
import { examSettingsService } from './settings.service';
import { success } from '../../utils/response';
import { ApiError } from '../../middleware/errorHandler';
import type { ExamSettingsInput } from '@campus-verse/shared/schemas';

class ExamSettingsController {
  async get(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.tenantId || !req.branchId) {
        throw new ApiError('CONTEXT_MISSING', 'Tenant or branch context missing', 400);
      }
      const settings = await examSettingsService.getSettings(req.tenantId, req.branchId);
      success(res, settings);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.tenantId || !req.branchId || !req.user) {
        throw new ApiError('CONTEXT_MISSING', 'Tenant or branch context missing', 400);
      }
      const settings = await examSettingsService.updateSettings(
        req.tenantId,
        req.branchId,
        req.body as Partial<ExamSettingsInput>,
        req.user.userId
      );
      success(res, settings);
    } catch (error) {
      next(error);
    }
  }
}

export const examSettingsController = new ExamSettingsController();

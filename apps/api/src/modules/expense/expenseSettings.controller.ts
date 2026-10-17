import { Request, Response, NextFunction } from 'express';
import { expenseSettingsService } from './expenseSettings.service';
import { success } from '../../utils/response';

class ExpenseSettingsController {
  async get(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const settings = await expenseSettingsService.get(req.tenantId!, req.branchId);
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

      const settings = await expenseSettingsService.update(req.tenantId!, req.branchId, req.body);
      success(res, settings, undefined, 'Expense settings updated successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const expenseSettingsController = new ExpenseSettingsController();

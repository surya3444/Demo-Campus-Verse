import { Request, Response, NextFunction } from 'express';
import { smsService } from './sms.service';
import { success, created } from '../../utils/response';

class SMSController {
  async sendSMS(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const result = await smsService.sendSMS(
        req.tenantId!,
        req.branchId,
        req.body,
        req.user!.userId
      );
      created(res, result, 'SMS queued for sending');
    } catch (error) {
      next(error);
    }
  }

  async getSMSLogs(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const params = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        status: req.query.status as string | undefined,
        category: req.query.category as string | undefined,
        fromDate: req.query.fromDate as string | undefined,
        toDate: req.query.toDate as string | undefined,
      };

      const result = await smsService.getSMSLogs(req.tenantId!, req.branchId, params);
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getSMSStats(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const params = {
        fromDate: req.query.fromDate as string | undefined,
        toDate: req.query.toDate as string | undefined,
      };

      const stats = await smsService.getSMSStats(req.tenantId!, req.branchId, params);
      success(res, stats);
    } catch (error) {
      next(error);
    }
  }

  async getSMSBalance(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const balance = await smsService.getSMSBalance(req.tenantId!, req.branchId);
      success(res, balance);
    } catch (error) {
      next(error);
    }
  }

  async getTemplates(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const templates = await smsService.getTemplatesForSending(req.tenantId!, req.branchId);
      success(res, templates);
    } catch (error) {
      next(error);
    }
  }
}

export const smsController = new SMSController();

import { Request, Response, NextFunction } from 'express';
import { visitorLogService, LogQueryParams } from './visitorLog.service';
import { success } from '../../utils/response';

class VisitorLogController {
  async getLogs(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const params: LogQueryParams = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        search: req.query.search as string,
        status: req.query.status as string,
        purpose: req.query.purpose as string,
        dateFrom: req.query.dateFrom as string,
        dateTo: req.query.dateTo as string,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc',
      };

      const result = await visitorLogService.getLogs(req.tenantId!, req.branchId, params);
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async exportLogs(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const params = {
        search: req.query.search as string,
        status: req.query.status as string,
        purpose: req.query.purpose as string,
        dateFrom: req.query.dateFrom as string,
        dateTo: req.query.dateTo as string,
      };

      const csv = await visitorLogService.exportLogs(req.tenantId!, req.branchId, params);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=visitor-logs.csv');
      res.send(csv);
    } catch (error) {
      next(error);
    }
  }
}

export const visitorLogController = new VisitorLogController();

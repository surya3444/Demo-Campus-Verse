import { Request, Response, NextFunction } from 'express';
import { hostelReportService } from './hostelReport.service';
import { success } from '../../utils/response';

class HostelReportController {
  async getOccupancyReport(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const report = await hostelReportService.getOccupancyReport(req.tenantId!, req.branchId);
      success(res, report);
    } catch (error) {
      next(error);
    }
  }

  async getVacancyReport(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const report = await hostelReportService.getVacancyReport(req.tenantId!, req.branchId);
      success(res, report);
    } catch (error) {
      next(error);
    }
  }

  async getClassWiseReport(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const report = await hostelReportService.getClassWiseReport(req.tenantId!, req.branchId);
      success(res, report);
    } catch (error) {
      next(error);
    }
  }
}

export const hostelReportController = new HostelReportController();

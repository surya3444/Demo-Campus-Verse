import { Request, Response, NextFunction } from 'express';
import { healthReportService } from './healthReport.service';
import { success } from '../../utils/response';

class HealthReportController {
  async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const dashboard = await healthReportService.getDashboard(req.tenantId!, req.branchId);
      success(res, dashboard);
    } catch (error) {
      next(error);
    }
  }

  async getGrowthChart(req: Request, res: Response, next: NextFunction) {
    try {
      const personId = req.params.personId as string;
      const growthData = await healthReportService.getGrowthChart(req.tenantId!, personId);
      success(res, growthData);
    } catch (error) {
      next(error);
    }
  }

  async getHealthSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const personId = req.params.personId as string;
      const summary = await healthReportService.getHealthSummary(req.tenantId!, personId);
      success(res, summary);
    } catch (error) {
      next(error);
    }
  }

  async exportHealthCard(req: Request, res: Response, next: NextFunction) {
    try {
      const personId = req.params.personId as string;
      const healthCard = await healthReportService.exportHealthCard(req.tenantId!, personId);

      // Return as JSON for now - in production, this could generate a PDF
      success(res, healthCard);
    } catch (error) {
      next(error);
    }
  }

  async getComplianceReport(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const report = await healthReportService.getComplianceReport(req.tenantId!, req.branchId);
      success(res, report);
    } catch (error) {
      next(error);
    }
  }
}

export const healthReportController = new HealthReportController();

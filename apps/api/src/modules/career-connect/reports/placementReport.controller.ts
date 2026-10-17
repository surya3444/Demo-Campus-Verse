import { Request, Response, NextFunction } from 'express';
import { placementReportService } from './placementReport.service';
import { success } from '../../../utils/response';

class PlacementReportController {
  async getSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await placementReportService.getPlacementSummary(req.tenantId!, req.branchId!);
      success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async getCompanyWise(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await placementReportService.getCompanyWiseReport(req.tenantId!, req.branchId!);
      success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async getDepartmentWise(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await placementReportService.getDepartmentWiseReport(
        req.tenantId!,
        req.branchId!
      );
      success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async getSalaryAnalysis(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await placementReportService.getSalaryAnalysis(req.tenantId!, req.branchId!);
      success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async getTrends(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await placementReportService.getPlacementTrends(req.tenantId!, req.branchId!);
      success(res, data);
    } catch (error) {
      next(error);
    }
  }
}

export const placementReportController = new PlacementReportController();

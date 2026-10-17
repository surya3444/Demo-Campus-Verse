import { Request, Response, NextFunction } from 'express';
import { counselingReportService } from './counselingReport.service';
import { success } from '../../../utils/response';

class CounselingReportController {
  async getSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await counselingReportService.getCounselingSummary(req.tenantId!, req.branchId!);
      success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async getAssessmentAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await counselingReportService.getAssessmentAnalytics(
        req.tenantId!,
        req.branchId!
      );
      success(res, data);
    } catch (error) {
      next(error);
    }
  }
}

export const counselingReportController = new CounselingReportController();

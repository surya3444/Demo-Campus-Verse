import { Request, Response, NextFunction } from 'express';
import { alumniReportService } from './alumniReport.service';
import { success } from '../../../utils/response';

class AlumniReportController {
  async getDemographics(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await alumniReportService.getAlumniDemographics(req.tenantId!, req.branchId!);
      success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async getMentorshipImpact(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await alumniReportService.getMentorshipImpact(req.tenantId!, req.branchId!);
      success(res, data);
    } catch (error) {
      next(error);
    }
  }
}

export const alumniReportController = new AlumniReportController();

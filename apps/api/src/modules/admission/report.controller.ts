import { Response, NextFunction, Request } from 'express';
import { admissionReportService } from './report.service';

class ReportController {
  async getLeadsReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId } = req;
      if (!branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const { fromDate, toDate, groupBy, source, stage, assignedTo } = req.query;

      const report = await admissionReportService.getLeadsReport(tenantId!, branchId, {
        fromDate: fromDate as string,
        toDate: toDate as string,
        groupBy: groupBy as 'source' | 'stage' | 'assignedTo' | 'day' | 'week' | 'month',
        source: source as string,
        stage: stage as string,
        assignedTo: assignedTo as string,
      });

      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }

  async getLeadsConversionReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId } = req;
      if (!branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const { fromDate, toDate } = req.query;

      const report = await admissionReportService.getLeadsConversionReport(tenantId!, branchId, {
        fromDate: fromDate as string,
        toDate: toDate as string,
      });

      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }

  async getApplicationsReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId } = req;
      if (!branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const { fromDate, toDate, groupBy, status, classId, academicBatchId } = req.query;

      const report = await admissionReportService.getApplicationsReport(tenantId!, branchId, {
        fromDate: fromDate as string,
        toDate: toDate as string,
        groupBy: groupBy as 'status' | 'class' | 'source' | 'day' | 'week' | 'month',
        status: status as string,
        classId: classId as string,
        academicBatchId: academicBatchId as string,
      });

      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }

  async getApplicationProcessingTime(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId } = req;
      if (!branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const { fromDate, toDate } = req.query;

      const report = await admissionReportService.getApplicationProcessingTime(
        tenantId!,
        branchId,
        {
          fromDate: fromDate as string,
          toDate: toDate as string,
        }
      );

      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }

  async getAdmissionAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId } = req;
      if (!branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const { fromDate, toDate } = req.query;

      const analytics = await admissionReportService.getAdmissionAnalytics(tenantId!, branchId, {
        fromDate: fromDate as string,
        toDate: toDate as string,
      });

      res.json({ success: true, data: analytics });
    } catch (error) {
      next(error);
    }
  }
}

export const reportController = new ReportController();

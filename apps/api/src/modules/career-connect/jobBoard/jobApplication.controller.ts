import { Request, Response, NextFunction } from 'express';
import { jobApplicationService } from './jobApplication.service';
import { success, created } from '../../../utils/response';

class JobApplicationController {
  async apply(req: Request, res: Response, next: NextFunction) {
    try {
      const jobPostingId = req.params.id as string;
      const studentId = req.user!.userId;
      const studentName = '';
      const data = await jobApplicationService.apply(
        req.tenantId!,
        req.branchId!,
        studentId,
        studentName,
        jobPostingId,
        req.body
      );
      created(res, data, 'Application submitted successfully');
    } catch (error) {
      next(error);
    }
  }

  async getByPosting(req: Request, res: Response, next: NextFunction) {
    try {
      const jobPostingId = req.params.id as string;
      const result = await jobApplicationService.getByPosting(req.tenantId!, jobPostingId, {
        status: req.query.status as string,
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as string,
      });
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getMyApplications(req: Request, res: Response, next: NextFunction) {
    try {
      const studentId = req.user!.userId;
      const result = await jobApplicationService.getMyApplications(req.tenantId!, studentId, {
        status: req.query.status as string,
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as string,
      });
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await jobApplicationService.updateStatus(req.tenantId!, id, req.body);
      success(res, data, undefined, 'Application status updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async withdraw(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const studentId = req.user!.userId;
      const data = await jobApplicationService.withdraw(req.tenantId!, id, studentId);
      success(res, data, undefined, 'Application withdrawn successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const jobApplicationController = new JobApplicationController();

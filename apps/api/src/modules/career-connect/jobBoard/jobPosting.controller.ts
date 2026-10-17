import { Request, Response, NextFunction } from 'express';
import { jobPostingService } from './jobPosting.service';
import { success, created, noContent } from '../../../utils/response';

class JobPostingController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await jobPostingService.list(req.tenantId!, req.branchId!, {
        search: req.query.search as string,
        status: req.query.status as string,
        type: req.query.type as string,
        workMode: req.query.workMode as string,
        companyId: req.query.companyId as string,
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

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await jobPostingService.getById(req.tenantId!, id);
      success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await jobPostingService.create(
        req.tenantId!,
        req.branchId!,
        req.user!.userId,
        req.body
      );
      created(res, data, 'Job posting created successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await jobPostingService.update(req.tenantId!, id, req.body);
      success(res, data, undefined, 'Job posting updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      await jobPostingService.delete(req.tenantId!, id);
      noContent(res);
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await jobPostingService.updateStatus(req.tenantId!, id, req.body.status);
      success(res, data, undefined, 'Job posting status updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await jobPostingService.getStats(req.tenantId!, req.branchId!);
      success(res, data);
    } catch (error) {
      next(error);
    }
  }
}

export const jobPostingController = new JobPostingController();

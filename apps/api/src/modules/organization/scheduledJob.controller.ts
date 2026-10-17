import { Response, NextFunction, Request } from 'express';
import { scheduledJobService } from './scheduledJob.service';

class ScheduledJobController {
  async getJobs(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId } = req;
      const { type, isActive } = req.query;

      const jobs = await scheduledJobService.getJobs(tenantId!, branchId, {
        type: type as string,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      });

      res.json({ success: true, data: jobs });
    } catch (error) {
      next(error);
    }
  }

  async getJob(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId } = req;
      const id = req.params.id as string;
      const job = await scheduledJobService.getJob(tenantId!, id);
      res.json({ success: true, data: job });
    } catch (error) {
      next(error);
    }
  }

  async createJob(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId } = req;
      const job = await scheduledJobService.createJob(
        tenantId!,
        { ...req.body, branchId: req.body.branchId || branchId },
        req.user!.userId
      );
      res.status(201).json({ success: true, data: job });
    } catch (error) {
      next(error);
    }
  }

  async updateJob(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId } = req;
      const id = req.params.id as string;
      const job = await scheduledJobService.updateJob(tenantId!, id, req.body, req.user!.userId);
      res.json({ success: true, data: job });
    } catch (error) {
      next(error);
    }
  }

  async toggleJobStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId } = req;
      const id = req.params.id as string;
      const { isActive } = req.body;

      if (typeof isActive !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'isActive must be a boolean' },
        });
      }

      const job = await scheduledJobService.toggleJobStatus(
        tenantId!,
        id,
        isActive,
        req.user!.userId
      );
      res.json({ success: true, data: job });
    } catch (error) {
      next(error);
    }
  }

  async deleteJob(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId } = req;
      const id = req.params.id as string;
      await scheduledJobService.deleteJob(tenantId!, id, req.user!.userId);
      res.json({ success: true, message: 'Job deleted' });
    } catch (error) {
      next(error);
    }
  }

  async runJobNow(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId } = req;
      const id = req.params.id as string;
      const result = await scheduledJobService.runJobNow(tenantId!, id, req.user!.userId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getJobExecutions(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId } = req;
      const id = req.params.id as string;
      const { limit } = req.query;

      const executions = await scheduledJobService.getJobExecutions(tenantId!, id, {
        limit: limit ? parseInt(limit as string) : undefined,
      });

      res.json({ success: true, data: executions });
    } catch (error) {
      next(error);
    }
  }

  async getJobTemplates(_req: Request, res: Response) {
    const templates = scheduledJobService.getJobTemplates();
    res.json({ success: true, data: templates });
  }
}

export const scheduledJobController = new ScheduledJobController();

import { Request, Response, NextFunction } from 'express';
import { schedulerService, JobListParams, JobType, JobStatus } from './scheduler.service';
import { success, created } from '../../utils/response';

class SchedulerController {
  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      const params: JobListParams = {
        type: req.query.type as JobType,
        status: req.query.status as JobStatus,
        branchId: req.query.branchId as string,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      };

      const result = await schedulerService.findAll(req.tenantId!, params);
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const job = await schedulerService.findById(req.tenantId!, req.params.id as string);
      success(res, job);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, type, schedule, config, branchId } = req.body;

      if (!name || !type || !schedule) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'name, type, and schedule are required' },
        });
      }

      const validTypes = ['attendance_summary', 'fee_reminder', 'report_generation', 'data_backup'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Invalid job type. Must be one of: ${validTypes.join(', ')}`,
          },
        });
      }

      const job = await schedulerService.create(
        req.tenantId!,
        { name, type, schedule, config, branchId },
        req.user!.userId
      );
      created(res, job, 'Scheduled job created successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const job = await schedulerService.update(
        req.tenantId!,
        req.params.id as string,
        req.body,
        req.user!.userId
      );
      success(res, job, undefined, 'Scheduled job updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await schedulerService.delete(req.tenantId!, req.params.id as string, req.user!.userId);
      success(res, { deleted: true }, undefined, 'Scheduled job deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  async getHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await schedulerService.getJobHistory(req.tenantId!, req.params.id as string, {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      });
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async runJob(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await schedulerService.runJob(
        req.tenantId!,
        req.params.id as string,
        req.user!.userId
      );
      success(res, result, undefined, 'Job execution started');
    } catch (error) {
      next(error);
    }
  }

  async pauseJob(req: Request, res: Response, next: NextFunction) {
    try {
      const job = await schedulerService.pauseJob(
        req.tenantId!,
        req.params.id as string,
        req.user!.userId
      );
      success(res, job, undefined, 'Job paused successfully');
    } catch (error) {
      next(error);
    }
  }

  async resumeJob(req: Request, res: Response, next: NextFunction) {
    try {
      const job = await schedulerService.resumeJob(
        req.tenantId!,
        req.params.id as string,
        req.user!.userId
      );
      success(res, job, undefined, 'Job resumed successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const schedulerController = new SchedulerController();

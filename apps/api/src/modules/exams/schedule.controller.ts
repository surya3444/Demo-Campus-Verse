import { Request, Response, NextFunction } from 'express';
import { scheduleService } from './schedule.service';
import { success, created } from '../../utils/response';
import { ApiError } from '../../middleware/errorHandler';

function requireContext(req: Request) {
  if (!req.tenantId || !req.branchId) {
    throw new ApiError('CONTEXT_MISSING', 'Tenant or branch context missing', 400);
  }
  return { tenantId: req.tenantId, branchId: req.branchId };
}

class ScheduleController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId } = requireContext(req);
      const schedule = await scheduleService.create(tenantId, branchId, req.body);
      created(res, schedule, 'Schedule created');
    } catch (error) {
      next(error);
    }
  }

  async bulkCreate(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId } = requireContext(req);
      const result = await scheduleService.bulkCreate(tenantId, branchId, req.body);
      success(res, result, undefined, 'Schedules created');
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId } = requireContext(req);
      const schedules = await scheduleService.list(tenantId, branchId, {
        examId: req.query.examId as string | undefined,
        paperId: req.query.paperId as string | undefined,
        sectionId: req.query.sectionId as string | undefined,
        fromDate: req.query.fromDate ? new Date(req.query.fromDate as string) : undefined,
        toDate: req.query.toDate ? new Date(req.query.toDate as string) : undefined,
      });
      success(res, schedules);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId } = requireContext(req);
      const schedule = await scheduleService.update(
        tenantId,
        branchId,
        req.params.id as string,
        req.body
      );
      success(res, schedule);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId } = requireContext(req);
      await scheduleService.delete(tenantId, branchId, req.params.id as string);
      success(res, { id: req.params.id }, undefined, 'Schedule deleted');
    } catch (error) {
      next(error);
    }
  }
}

export const scheduleController = new ScheduleController();

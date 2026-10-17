import { Request, Response, NextFunction } from 'express';
import { examService } from './exam.service';
import { success, created } from '../../utils/response';
import { getScopedClassIds } from '../../middleware/scope';
import { ApiError } from '../../middleware/errorHandler';
import type { ExamStatus, ExamType } from '@campus-verse/shared/constants';

function requireContext(req: Request): { tenantId: string; branchId: string; userId: string } {
  if (!req.tenantId || !req.branchId || !req.user) {
    throw new ApiError('CONTEXT_MISSING', 'Tenant or branch context missing', 400);
  }
  return { tenantId: req.tenantId, branchId: req.branchId, userId: req.user.userId };
}

class ExamController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId, userId } = requireContext(req);
      const exam = await examService.create(tenantId, branchId, req.body, userId);
      created(res, exam, 'Exam created');
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId } = requireContext(req);
      const result = await examService.list(tenantId, branchId, {
        academicBatchId: req.query.academicBatchId as string | undefined,
        termId: req.query.termId as string | undefined,
        termName: req.query.termName as string | undefined,
        status: req.query.status as ExamStatus | undefined,
        type: req.query.type as ExamType | undefined,
        classId: req.query.classId as string | undefined,
        restrictToClassIds: await getScopedClassIds(req),
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        sortBy: req.query.sortBy as string | undefined,
        sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined,
      });
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId } = requireContext(req);
      const exam = await examService.findById(tenantId, branchId, req.params.id as string);
      success(res, exam);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId } = requireContext(req);
      const exam = await examService.update(tenantId, branchId, req.params.id as string, req.body);
      success(res, exam, undefined, 'Exam updated');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId } = requireContext(req);
      await examService.delete(tenantId, branchId, req.params.id as string);
      success(res, { id: req.params.id }, undefined, 'Exam deleted');
    } catch (error) {
      next(error);
    }
  }

  async setStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId } = requireContext(req);
      const { status } = req.body as { status: ExamStatus };
      const exam = await examService.setStatus(tenantId, branchId, req.params.id as string, status);
      success(res, exam, undefined, 'Status updated');
    } catch (error) {
      next(error);
    }
  }
}

export const examController = new ExamController();

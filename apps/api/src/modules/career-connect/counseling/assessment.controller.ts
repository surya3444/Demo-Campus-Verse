import { Request, Response, NextFunction } from 'express';
import { assessmentService } from './assessment.service';
import { success, created, noContent } from '../../../utils/response';

class AssessmentController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await assessmentService.list(req.tenantId!, req.branchId!, {
        studentId: req.query.studentId as string,
        assessmentType: req.query.assessmentType as string,
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
      const data = await assessmentService.getById(req.tenantId!, id);
      success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await assessmentService.create(
        req.tenantId!,
        req.branchId!,
        req.user!.userId,
        req.body
      );
      created(res, data, 'Career assessment created successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await assessmentService.update(req.tenantId!, id, req.body);
      success(res, data, undefined, 'Career assessment updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      await assessmentService.delete(req.tenantId!, id);
      noContent(res);
    } catch (error) {
      next(error);
    }
  }
}

export const assessmentController = new AssessmentController();

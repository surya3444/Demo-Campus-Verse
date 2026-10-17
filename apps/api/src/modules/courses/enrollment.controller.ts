import { Request, Response, NextFunction } from 'express';
import { enrollmentService } from './enrollment.service';
import { success, created } from '../../utils/response';

class EnrollmentController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await enrollmentService.list(req.tenantId!, {
        courseId: req.query.courseId as string,
        studentId: req.query.studentId as string,
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

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await enrollmentService.getById(req.tenantId!, id);
      success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async enroll(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await enrollmentService.enrollStudents(
        req.tenantId!,
        req.branchId!,
        req.body.courseId,
        req.body.studentIds
      );
      created(res, data, 'Students enrolled successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await enrollmentService.updateStatus(req.tenantId!, id, req.body.status);
      success(res, data, undefined, 'Enrollment updated successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const enrollmentController = new EnrollmentController();

import { Request, Response, NextFunction } from 'express';
import { enrollmentService } from './enrollment.service';
import { success, created } from '../../utils/response';
import type { TransportEnrollmentQueryInput } from '@campus-verse/shared/schemas';

class EnrollmentController {
  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const result = await enrollmentService.findAll(
        req.tenantId!,
        req.branchId,
        req.query as unknown as TransportEnrollmentQueryInput
      );
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const enrollment = await enrollmentService.findById(req.tenantId!, req.params.id as string);
      success(res, enrollment);
    } catch (error) {
      next(error);
    }
  }

  async findByStudent(req: Request, res: Response, next: NextFunction) {
    try {
      const enrollment = await enrollmentService.findByStudent(
        req.tenantId!,
        req.params.studentId as string
      );
      success(res, enrollment);
    } catch (error) {
      next(error);
    }
  }

  async findMine(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await enrollmentService.findMineByUserId(req.tenantId!, req.user!.userId);
      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const enrollment = await enrollmentService.create(
        req.tenantId!,
        req.branchId,
        req.body,
        req.user!.userId
      );
      created(res, enrollment, 'Student enrolled successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const enrollment = await enrollmentService.update(
        req.tenantId!,
        req.params.id as string,
        req.body
      );
      success(res, enrollment, undefined, 'Enrollment updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async withdraw(req: Request, res: Response, next: NextFunction) {
    try {
      const enrollment = await enrollmentService.withdraw(
        req.tenantId!,
        req.params.id as string,
        req.body
      );
      success(res, enrollment, undefined, 'Enrollment withdrawn successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const enrollmentController = new EnrollmentController();

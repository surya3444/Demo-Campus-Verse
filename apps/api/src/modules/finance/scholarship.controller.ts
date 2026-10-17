import { Request, Response, NextFunction } from 'express';
import { scholarshipService } from './scholarship.service';
import { success, created } from '../../utils/response';

class ScholarshipController {
  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await scholarshipService.findAll(req.tenantId!, req.branchId!, {
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        studentId: req.query.studentId as string | undefined,
        status: req.query.status as string | undefined,
        scheme: req.query.scheme as string | undefined,
        sponsor: req.query.sponsor as string | undefined,
      });
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await scholarshipService.getStats(req.tenantId!, req.branchId!);
      success(res, stats);
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const scholarship = await scholarshipService.findById(req.tenantId!, req.params.id as string);
      success(res, scholarship);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const scholarship = await scholarshipService.create(
        req.tenantId!,
        req.branchId!,
        req.body,
        req.user!.userId
      );
      created(res, scholarship, 'Scholarship application recorded');
    } catch (error) {
      next(error);
    }
  }

  async approve(req: Request, res: Response, next: NextFunction) {
    try {
      const scholarship = await scholarshipService.approve(
        req.tenantId!,
        req.params.id as string,
        req.user!.userId
      );
      success(res, scholarship, undefined, 'Scholarship approved');
    } catch (error) {
      next(error);
    }
  }

  async reject(req: Request, res: Response, next: NextFunction) {
    try {
      const scholarship = await scholarshipService.reject(
        req.tenantId!,
        req.params.id as string,
        req.user!.userId,
        req.body.reason
      );
      success(res, scholarship, undefined, 'Scholarship rejected');
    } catch (error) {
      next(error);
    }
  }

  async recordDisbursement(req: Request, res: Response, next: NextFunction) {
    try {
      const scholarship = await scholarshipService.recordDisbursement(
        req.tenantId!,
        req.params.id as string,
        req.body,
        req.user!.userId
      );
      success(res, scholarship, undefined, 'Disbursement recorded');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await scholarshipService.delete(req.tenantId!, req.params.id as string);
      success(res, result, undefined, 'Scholarship deleted');
    } catch (error) {
      next(error);
    }
  }
}

export const scholarshipController = new ScholarshipController();

import { Request, Response, NextFunction } from 'express';
import { referralService } from './referral.service';
import { success, created, noContent } from '../../../utils/response';

class ReferralController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await referralService.list(req.tenantId!, req.branchId!, {
        search: req.query.search as string,
        status: req.query.status as string,
        alumniId: req.query.alumniId as string,
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
      const data = await referralService.getById(req.tenantId!, id);
      success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await referralService.create(
        req.tenantId!,
        req.branchId!,
        req.user!.userId,
        req.body
      );
      created(res, data, 'Referral created successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await referralService.update(req.tenantId!, id, req.body);
      success(res, data, undefined, 'Referral updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      await referralService.delete(req.tenantId!, id);
      noContent(res);
    } catch (error) {
      next(error);
    }
  }

  async referStudent(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await referralService.referStudent(
        req.tenantId!,
        id,
        req.body.studentId,
        req.body.studentName || ''
      );
      success(res, data, undefined, 'Student referred successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const referralController = new ReferralController();

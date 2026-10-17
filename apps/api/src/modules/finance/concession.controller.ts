import { Request, Response, NextFunction } from 'express';
import { concessionService, ConcessionListParams } from './concession.service';
import { success, created } from '../../utils/response';

class ConcessionController {
  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const params: ConcessionListParams = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        studentId: req.query.studentId as string,
        academicBatchId: req.query.academicBatchId as string,
        type: req.query.type as string,
        status: req.query.status as string,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc',
      };

      const result = await concessionService.findAll(req.tenantId!, req.branchId, params);
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const concession = await concessionService.findById(req.tenantId!, req.params.id as string);
      success(res, concession);
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

      const concession = await concessionService.create(
        req.tenantId!,
        req.branchId,
        req.body,
        req.user!.userId
      );
      created(res, concession, 'Concession requested successfully');
    } catch (error) {
      next(error);
    }
  }

  async approve(req: Request, res: Response, next: NextFunction) {
    try {
      const concession = await concessionService.approve(
        req.tenantId!,
        req.params.id as string,
        req.user!.userId
      );
      success(res, concession, undefined, 'Concession approved successfully');
    } catch (error) {
      next(error);
    }
  }

  async reject(req: Request, res: Response, next: NextFunction) {
    try {
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Rejection reason is required' },
        });
      }

      const concession = await concessionService.reject(
        req.tenantId!,
        req.params.id as string,
        reason,
        req.user!.userId
      );
      success(res, concession, undefined, 'Concession rejected');
    } catch (error) {
      next(error);
    }
  }

  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const stats = await concessionService.getStats(
        req.tenantId!,
        req.branchId,
        req.query.academicBatchId as string
      );
      success(res, stats);
    } catch (error) {
      next(error);
    }
  }
}

export const concessionController = new ConcessionController();

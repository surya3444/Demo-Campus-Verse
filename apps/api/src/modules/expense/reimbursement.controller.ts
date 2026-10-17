import { Request, Response, NextFunction } from 'express';
import { reimbursementService, ReimbursementListParams } from './reimbursement.service';
import { success, created } from '../../utils/response';

class ReimbursementController {
  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const params: ReimbursementListParams = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        status: req.query.status as string,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc',
      };

      const result = await reimbursementService.findAll(req.tenantId!, req.branchId, params);
      success(res, result.data, result.meta);
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

      const reimbursement = await reimbursementService.create(
        req.tenantId!,
        req.branchId,
        req.body,
        req.user!.userId,
        req.user!.email
      );
      created(res, reimbursement, 'Reimbursement request created successfully');
    } catch (error) {
      next(error);
    }
  }

  async approve(req: Request, res: Response, next: NextFunction) {
    try {
      const reimbursement = await reimbursementService.approve(
        req.tenantId!,
        req.params.id as string,
        req.user!.userId,
        req.body.remarks
      );
      success(res, reimbursement, undefined, 'Reimbursement approved');
    } catch (error) {
      next(error);
    }
  }

  async process(req: Request, res: Response, next: NextFunction) {
    try {
      const reimbursement = await reimbursementService.process(
        req.tenantId!,
        req.params.id as string,
        req.user!.userId,
        req.body.remarks
      );
      success(res, reimbursement, undefined, 'Reimbursement processed');
    } catch (error) {
      next(error);
    }
  }
}

export const reimbursementController = new ReimbursementController();

import { Request, Response, NextFunction } from 'express';
import { obeAttainmentService } from './attainment.service';
import { success } from '../../utils/response';

function userOf(req: Request) {
  return { userId: req.user!.userId, roleLevel: req.user!.roleLevel };
}

class ObeAttainmentController {
  async compute(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await obeAttainmentService.compute(
        req.tenantId!,
        req.branchId!,
        req.params.id as string,
        req.query.force === 'true',
        userOf(req)
      );
      success(res, result, undefined, 'Attainment computed');
    } catch (error) {
      next(error);
    }
  }

  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await obeAttainmentService.get(
        req.tenantId!,
        req.branchId!,
        req.params.id as string
      );
      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async updateCorrectiveActions(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await obeAttainmentService.updateCorrectiveActions(
        req.tenantId!,
        req.branchId!,
        req.params.id as string,
        req.body.actions,
        userOf(req)
      );
      success(res, result, undefined, 'Corrective actions saved');
    } catch (error) {
      next(error);
    }
  }

  async finalize(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await obeAttainmentService.finalize(
        req.tenantId!,
        req.branchId!,
        req.params.id as string,
        userOf(req)
      );
      success(res, result, undefined, 'Offering finalized');
    } catch (error) {
      next(error);
    }
  }

  async reopen(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await obeAttainmentService.reopen(
        req.tenantId!,
        req.branchId!,
        req.params.id as string
      );
      success(res, result, undefined, 'Offering reopened');
    } catch (error) {
      next(error);
    }
  }
}

export const obeAttainmentController = new ObeAttainmentController();

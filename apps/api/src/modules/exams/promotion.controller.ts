import { Request, Response, NextFunction } from 'express';
import { promotionService } from './promotion.service';
import { success, created } from '../../utils/response';
import { ApiError } from '../../middleware/errorHandler';

function requireContext(req: Request) {
  if (!req.tenantId || !req.branchId || !req.user) {
    throw new ApiError('CONTEXT_MISSING', 'Tenant or branch context missing', 400);
  }
  return { tenantId: req.tenantId, branchId: req.branchId, userId: req.user.userId };
}

class PromotionController {
  async createRun(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId, userId } = requireContext(req);
      const { fromBatchId, toBatchId, passMarkPercentOverride, passSubjectsRequiredOverride } =
        req.body as {
          fromBatchId: string;
          toBatchId: string;
          passMarkPercentOverride?: number;
          passSubjectsRequiredOverride?: 'all' | number;
        };
      if (!fromBatchId || !toBatchId) {
        throw new ApiError('INVALID_INPUT', 'fromBatchId and toBatchId are required', 400);
      }
      const run = await promotionService.createRun(
        tenantId,
        branchId,
        { fromBatchId, toBatchId, passMarkPercentOverride, passSubjectsRequiredOverride },
        userId
      );
      created(res, run, 'Promotion run created');
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId } = requireContext(req);
      const rows = await promotionService.list(tenantId, branchId, {
        status: req.query.status as string | undefined,
      });
      success(res, rows);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId } = requireContext(req);
      const run = await promotionService.getById(tenantId, branchId, req.params.id as string);
      success(res, run);
    } catch (error) {
      next(error);
    }
  }

  async overrideDecision(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId } = requireContext(req);
      const { outcome, toClassId, toSectionId, reason } = req.body as {
        outcome?: 'promote' | 'graduate' | 'hold' | 'transfer_out';
        toClassId?: string;
        toSectionId?: string;
        reason?: string;
      };
      const run = await promotionService.overrideDecision(
        tenantId,
        branchId,
        req.params.id as string,
        req.params.studentId as string,
        { outcome, toClassId, toSectionId, reason }
      );
      success(res, run);
    } catch (error) {
      next(error);
    }
  }

  async commit(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId, userId } = requireContext(req);
      const result = await promotionService.commitRun(
        tenantId,
        branchId,
        req.params.id as string,
        userId
      );
      success(res, result, undefined, 'Promotion run committed');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId } = requireContext(req);
      await promotionService.deleteRun(tenantId, branchId, req.params.id as string);
      success(res, { id: req.params.id }, undefined, 'Run deleted');
    } catch (error) {
      next(error);
    }
  }
}

export const promotionController = new PromotionController();

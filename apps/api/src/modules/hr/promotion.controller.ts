import { Request, Response, NextFunction } from 'express';
import { promotionService } from './promotion.service';
import { success, created } from '../../utils/response';

class PromotionController {
  async listPolicies(req: Request, res: Response, next: NextFunction) {
    try {
      const policies = await promotionService.listPolicies(req.tenantId!, req.branchId);
      success(res, policies);
    } catch (error) {
      next(error);
    }
  }

  async createPolicy(req: Request, res: Response, next: NextFunction) {
    try {
      // Tenant-wide by default; pass ?scope=branch to create a branch override.
      const branchId = req.query.scope === 'branch' ? req.branchId : undefined;
      const policy = await promotionService.createPolicy(
        req.tenantId!,
        branchId,
        req.body,
        req.user?.userId
      );
      created(res, policy, 'Promotion policy created');
    } catch (error) {
      next(error);
    }
  }

  async updatePolicy(req: Request, res: Response, next: NextFunction) {
    try {
      const policy = await promotionService.updatePolicy(
        req.tenantId!,
        req.params.id as string,
        req.body
      );
      success(res, policy, undefined, 'Promotion policy updated');
    } catch (error) {
      next(error);
    }
  }

  async deletePolicy(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await promotionService.deletePolicy(req.tenantId!, req.params.id as string);
      success(res, result, undefined, 'Promotion policy deleted');
    } catch (error) {
      next(error);
    }
  }

  async promote(req: Request, res: Response, next: NextFunction) {
    try {
      const promotion = await promotionService.promote(
        req.tenantId!,
        req.branchId!,
        req.params.id as string,
        req.body,
        req.user!.userId
      );
      created(res, promotion, 'Promotion recorded');
    } catch (error) {
      next(error);
    }
  }

  async listPromotions(req: Request, res: Response, next: NextFunction) {
    try {
      const promotions = await promotionService.listPromotions(req.tenantId!, req.branchId!, {
        staffId: req.query.staffId as string | undefined,
        status: req.query.status as string | undefined,
      });
      success(res, promotions);
    } catch (error) {
      next(error);
    }
  }

  async approve(req: Request, res: Response, next: NextFunction) {
    try {
      const promotion = await promotionService.approvePromotion(
        req.tenantId!,
        req.params.id as string,
        req.user!.userId
      );
      success(res, promotion, undefined, 'Promotion approved and applied');
    } catch (error) {
      next(error);
    }
  }

  async reject(req: Request, res: Response, next: NextFunction) {
    try {
      const promotion = await promotionService.rejectPromotion(
        req.tenantId!,
        req.params.id as string,
        req.user!.userId,
        req.body.reason
      );
      success(res, promotion, undefined, 'Promotion rejected');
    } catch (error) {
      next(error);
    }
  }
}

export const promotionController = new PromotionController();

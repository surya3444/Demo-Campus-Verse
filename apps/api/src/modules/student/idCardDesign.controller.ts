import { Request, Response, NextFunction } from 'express';
import { success, created } from '../../utils/response';
import { idCardDesignService } from './idCardDesign.service';

export const idCardDesignController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      success(res, await idCardDesignService.list(req.tenantId!, req.branchId!));
    } catch (error) {
      next(error);
    }
  },
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      created(res, await idCardDesignService.create(req.tenantId!, req.user!.userId, req.body));
    } catch (error) {
      next(error);
    }
  },
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      success(
        res,
        await idCardDesignService.update(req.tenantId!, req.params.designId as string, req.body)
      );
    } catch (error) {
      next(error);
    }
  },
  async setDefault(req: Request, res: Response, next: NextFunction) {
    try {
      success(
        res,
        await idCardDesignService.setDefault(req.tenantId!, req.params.designId as string)
      );
    } catch (error) {
      next(error);
    }
  },
  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      success(res, await idCardDesignService.remove(req.tenantId!, req.params.designId as string));
    } catch (error) {
      next(error);
    }
  },
};

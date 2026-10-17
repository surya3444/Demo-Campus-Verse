import { Request, Response, NextFunction } from 'express';
import { busService } from './bus.service';
import { success, created } from '../../utils/response';
import type { BusQueryInput } from '@campus-verse/shared/schemas';

class BusController {
  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const result = await busService.findAll(
        req.tenantId!,
        req.branchId,
        req.query as unknown as BusQueryInput
      );
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const bus = await busService.findById(req.tenantId!, req.params.id as string);
      success(res, bus);
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

      const bus = await busService.create(req.tenantId!, req.branchId, req.body, req.user!.userId);
      created(res, bus, 'Bus added successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const bus = await busService.update(
        req.tenantId!,
        req.params.id as string,
        req.body,
        req.user!.userId
      );
      success(res, bus, undefined, 'Bus updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await busService.delete(req.tenantId!, req.params.id as string);
      success(res, null, undefined, 'Bus deactivated successfully');
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

      const stats = await busService.getStats(req.tenantId!, req.branchId);
      success(res, stats);
    } catch (error) {
      next(error);
    }
  }
}

export const busController = new BusController();

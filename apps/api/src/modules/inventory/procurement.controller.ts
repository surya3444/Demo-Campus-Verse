import { Request, Response, NextFunction } from 'express';
import { procurementService, ProcurementListParams } from './procurement.service';
import { success, created } from '../../utils/response';

class ProcurementController {
  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const params: ProcurementListParams = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        search: req.query.search as string,
        status: req.query.status as string,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc',
      };

      const result = await procurementService.findAll(req.tenantId!, req.branchId, params);
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const procurement = await procurementService.findById(req.tenantId!, req.params.id as string);
      success(res, procurement);
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

      const procurement = await procurementService.create(
        req.tenantId!,
        req.branchId,
        req.body,
        req.user!.userId
      );
      created(res, procurement, 'Procurement created successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const procurement = await procurementService.update(
        req.tenantId!,
        req.params.id as string,
        req.body
      );
      success(res, procurement, undefined, 'Procurement updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async approve(req: Request, res: Response, next: NextFunction) {
    try {
      const procurement = await procurementService.approve(
        req.tenantId!,
        req.params.id as string,
        req.user!.userId,
        req.user!.email || 'Admin'
      );
      success(res, procurement, undefined, 'Procurement approved successfully');
    } catch (error) {
      next(error);
    }
  }

  async receive(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const result = await procurementService.receive(
        req.tenantId!,
        req.branchId,
        req.params.id as string,
        req.user!.userId
      );
      success(
        res,
        result.procurement,
        undefined,
        `Procurement received — ${result.assetsCreated} asset(s) created`
      );
    } catch (error) {
      next(error);
    }
  }
}

export const procurementController = new ProcurementController();

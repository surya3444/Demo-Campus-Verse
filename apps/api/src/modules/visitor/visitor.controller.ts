import { Request, Response, NextFunction } from 'express';
import { visitorService, VisitorListParams } from './visitor.service';
import { success, created } from '../../utils/response';

class VisitorController {
  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const params: VisitorListParams = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        search: req.query.search as string,
        status: req.query.status as string,
        purpose: req.query.purpose as string,
        type: req.query.type as string,
        date: req.query.date as string,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc',
      };

      const result = await visitorService.findAll(req.tenantId!, req.branchId, params);
      success(res, result.data, result.meta);
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

      const stats = await visitorService.getStats(req.tenantId!, req.branchId);
      success(res, stats);
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const visitor = await visitorService.findById(req.tenantId!, req.params.id as string);
      success(res, visitor);
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

      const visitor = await visitorService.create(
        req.tenantId!,
        req.branchId,
        req.body,
        req.user!.userId
      );
      created(res, visitor, 'Visitor registered successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const visitor = await visitorService.update(req.tenantId!, req.params.id as string, req.body);
      success(res, visitor, undefined, 'Visitor updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await visitorService.delete(req.tenantId!, req.params.id as string);
      success(res, null, undefined, 'Visitor deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  async checkIn(req: Request, res: Response, next: NextFunction) {
    try {
      const visitor = await visitorService.checkIn(
        req.tenantId!,
        req.params.id as string,
        req.user!.userId
      );
      success(res, visitor, undefined, 'Visitor checked in successfully');
    } catch (error) {
      next(error);
    }
  }

  async checkOut(req: Request, res: Response, next: NextFunction) {
    try {
      const visitor = await visitorService.checkOut(
        req.tenantId!,
        req.params.id as string,
        req.user!.userId
      );
      success(res, visitor, undefined, 'Visitor checked out successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const visitorController = new VisitorController();

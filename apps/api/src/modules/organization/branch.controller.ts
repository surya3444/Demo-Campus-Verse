import { Request, Response, NextFunction } from 'express';
import { branchService } from './branch.service';
import { success } from '../../utils/response';

class BranchController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.tenantId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Tenant ID required' },
        });
      }

      const branch = await branchService.create(req.tenantId, req.body, req.user?.userId);

      res.status(201).json({ success: true, data: branch });
    } catch (error) {
      next(error);
    }
  }

  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.tenantId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Tenant ID required' },
        });
      }

      const { page, limit, search, status, institutionType, state, city, sortBy, sortOrder } =
        req.query;

      const result = await branchService.findAll(req.tenantId, {
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        search: search as string,
        status: status as 'active' | 'inactive',
        institutionType: institutionType as 'school' | 'college' | 'university',
        state: state as string,
        city: city as string,
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'asc' | 'desc',
      });

      res.json({
        success: true,
        data: result.data,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.tenantId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Tenant ID required' },
        });
      }

      const branch = await branchService.findById(req.tenantId, req.params.id as string);

      success(res, branch);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.tenantId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Tenant ID required' },
        });
      }

      const branch = await branchService.update(req.tenantId, req.params.id as string, req.body);

      success(res, branch);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.tenantId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Tenant ID required' },
        });
      }

      await branchService.delete(req.tenantId, req.params.id as string);

      success(res, { message: 'Branch deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.tenantId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Tenant ID required' },
        });
      }

      const stats = await branchService.getStats(req.tenantId, req.params.id as string);

      success(res, stats);
    } catch (error) {
      next(error);
    }
  }

  async getLocations(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.tenantId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Tenant ID required' },
        });
      }

      const locations = await branchService.getStatesAndCities(req.tenantId);

      success(res, locations);
    } catch (error) {
      next(error);
    }
  }
}

export const branchController = new BranchController();

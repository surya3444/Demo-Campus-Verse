import { Request, Response, NextFunction } from 'express';
import { assetService, AssetListParams } from './asset.service';
import { success, created } from '../../utils/response';

class AssetController {
  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const params: AssetListParams = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        search: req.query.search as string,
        status: req.query.status as string,
        condition: req.query.condition as string,
        categoryId: req.query.categoryId as string,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc',
      };

      const result = await assetService.findAll(req.tenantId!, req.branchId, params);
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

      const stats = await assetService.getStats(req.tenantId!, req.branchId);
      success(res, stats);
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const asset = await assetService.findById(req.tenantId!, req.params.id as string);
      success(res, asset);
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

      const asset = await assetService.create(
        req.tenantId!,
        req.branchId,
        req.body,
        req.user!.userId
      );
      created(res, asset, 'Asset created successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const asset = await assetService.update(req.tenantId!, req.params.id as string, req.body);
      success(res, asset, undefined, 'Asset updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await assetService.delete(req.tenantId!, req.params.id as string);
      success(res, null, undefined, 'Asset deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const assetController = new AssetController();

import { Request, Response, NextFunction } from 'express';
import { resourceService } from './resource.service';
import { success, created, noContent } from '../../../utils/response';

class ResourceController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await resourceService.list(req.tenantId!, req.branchId!, {
        search: req.query.search as string,
        type: req.query.type as string,
        category: req.query.category as string,
        isPublished: req.query.isPublished as string,
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as string,
      });
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await resourceService.getById(req.tenantId!, id);
      success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await resourceService.create(
        req.tenantId!,
        req.branchId!,
        req.user!.userId,
        req.body
      );
      created(res, data, 'Career resource created successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await resourceService.update(req.tenantId!, id, req.body);
      success(res, data, undefined, 'Career resource updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      await resourceService.delete(req.tenantId!, id);
      noContent(res);
    } catch (error) {
      next(error);
    }
  }
}

export const resourceController = new ResourceController();

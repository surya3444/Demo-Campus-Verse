import { Request, Response, NextFunction } from 'express';
import { alumniEventService } from './event.service';
import { success, created, noContent } from '../../../utils/response';

class AlumniEventController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await alumniEventService.list(req.tenantId!, req.branchId!, {
        search: req.query.search as string,
        status: req.query.status as string,
        type: req.query.type as string,
        fromDate: req.query.fromDate as string,
        toDate: req.query.toDate as string,
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
      const data = await alumniEventService.getById(req.tenantId!, id);
      success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await alumniEventService.create(
        req.tenantId!,
        req.branchId!,
        req.user!.userId,
        req.body
      );
      created(res, data, 'Alumni event created successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await alumniEventService.update(req.tenantId!, id, req.body);
      success(res, data, undefined, 'Alumni event updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      await alumniEventService.delete(req.tenantId!, id);
      noContent(res);
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await alumniEventService.updateStatus(req.tenantId!, id, req.body.status);
      success(res, data, undefined, 'Event status updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await alumniEventService.register(req.tenantId!, id, req.user!.userId, '');
      success(res, data, undefined, 'Registered for event successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const eventController = new AlumniEventController();

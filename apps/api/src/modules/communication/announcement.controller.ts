import { Request, Response, NextFunction } from 'express';
import { announcementService, AnnouncementListParams } from './announcement.service';
import { success, created } from '../../utils/response';

class AnnouncementController {
  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const params: AnnouncementListParams = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        search: req.query.search as string,
        type: req.query.type as string,
        status: req.query.status as string,
        priority: req.query.priority as string,
        isPinned:
          req.query.isPinned === 'true' ? true : req.query.isPinned === 'false' ? false : undefined,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc',
      };

      const result = await announcementService.findAll(req.tenantId!, req.branchId, params);
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const announcement = await announcementService.findById(
        req.tenantId!,
        req.params.id as string
      );
      // Increment view count
      await announcementService.incrementViewCount(req.tenantId!, req.params.id as string);
      success(res, announcement);
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

      const announcement = await announcementService.create(
        req.tenantId!,
        req.branchId,
        req.body,
        req.user!.userId
      );
      created(res, announcement, 'Announcement created successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const announcement = await announcementService.update(
        req.tenantId!,
        req.params.id as string,
        req.body
      );
      success(res, announcement, undefined, 'Announcement updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await announcementService.delete(req.tenantId!, req.params.id as string);
      success(res, null, undefined, 'Announcement deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  async publish(req: Request, res: Response, next: NextFunction) {
    try {
      const announcement = await announcementService.publish(
        req.tenantId!,
        req.params.id as string,
        req.user!.userId
      );
      success(res, announcement, undefined, 'Announcement published successfully');
    } catch (error) {
      next(error);
    }
  }

  async archive(req: Request, res: Response, next: NextFunction) {
    try {
      const announcement = await announcementService.archive(
        req.tenantId!,
        req.params.id as string
      );
      success(res, announcement, undefined, 'Announcement archived successfully');
    } catch (error) {
      next(error);
    }
  }

  async acknowledge(req: Request, res: Response, next: NextFunction) {
    try {
      await announcementService.acknowledge(
        req.tenantId!,
        req.params.id as string,
        req.user!.userId
      );
      success(res, null, undefined, 'Announcement acknowledged');
    } catch (error) {
      next(error);
    }
  }
}

export const announcementController = new AnnouncementController();

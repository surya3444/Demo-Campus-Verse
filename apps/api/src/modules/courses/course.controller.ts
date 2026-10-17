import { Request, Response, NextFunction } from 'express';
import { courseService } from './course.service';
import { success, created, noContent } from '../../utils/response';

class CourseController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await courseService.list(req.tenantId!, req.branchId!, req.user!.roleLevel, {
        search: req.query.search as string,
        status: req.query.status as string,
        category: req.query.category as string,
        level: req.query.level as string,
        visibility: req.query.visibility as string,
        instructorId: req.query.instructorId as string,
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
      const data = await courseService.getById(req.tenantId!, id);
      success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await courseService.create(
        req.tenantId!,
        req.branchId!,
        req.user!.userId,
        req.body
      );
      created(res, data, 'Course created successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await courseService.update(
        req.tenantId!,
        id,
        req.user!.userId,
        req.user!.roleLevel,
        req.branchId!,
        req.body
      );
      success(res, data, undefined, 'Course updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      await courseService.delete(
        req.tenantId!,
        id,
        req.user!.userId,
        req.user!.roleLevel,
        req.branchId!
      );
      noContent(res);
    } catch (error) {
      next(error);
    }
  }

  async updateVisibility(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await courseService.updateVisibility(
        req.tenantId!,
        id,
        req.user!.userId,
        req.user!.roleLevel,
        req.body
      );
      success(res, data, undefined, 'Course visibility updated successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const courseController = new CourseController();

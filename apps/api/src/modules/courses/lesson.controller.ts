import { Request, Response, NextFunction } from 'express';
import { lessonService } from './lesson.service';
import { success, created, noContent } from '../../utils/response';

class LessonController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const courseId = req.params.courseId as string;
      const result = await lessonService.list(req.tenantId!, courseId, {
        moduleId: req.query.moduleId as string,
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
      const courseId = req.params.courseId as string;
      const lessonId = req.params.lessonId as string;
      const data = await lessonService.getById(req.tenantId!, courseId, lessonId);
      success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const courseId = req.params.courseId as string;
      const data = await lessonService.create(
        req.tenantId!,
        courseId,
        req.branchId!,
        req.user!.userId,
        req.body
      );
      created(res, data, 'Lesson created successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const courseId = req.params.courseId as string;
      const lessonId = req.params.lessonId as string;
      const data = await lessonService.update(req.tenantId!, courseId, lessonId, req.body);
      success(res, data, undefined, 'Lesson updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const courseId = req.params.courseId as string;
      const lessonId = req.params.lessonId as string;
      await lessonService.delete(req.tenantId!, courseId, lessonId);
      noContent(res);
    } catch (error) {
      next(error);
    }
  }

  async reorder(req: Request, res: Response, next: NextFunction) {
    try {
      const courseId = req.params.courseId as string;
      await lessonService.reorder(req.tenantId!, courseId, req.body.lessonOrders);
      success(res, null, undefined, 'Lessons reordered successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const lessonController = new LessonController();

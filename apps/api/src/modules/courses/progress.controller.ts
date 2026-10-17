import { Request, Response, NextFunction } from 'express';
import { progressService } from './progress.service';
import { success } from '../../utils/response';

class ProgressController {
  async getCourseProgress(req: Request, res: Response, next: NextFunction) {
    try {
      const enrollmentId = req.params.id as string;
      const data = await progressService.getCourseProgress(req.tenantId!, enrollmentId);
      success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async updateLessonProgress(req: Request, res: Response, next: NextFunction) {
    try {
      const enrollmentId = req.params.id as string;
      const lessonId = req.params.lessonId as string;
      const data = await progressService.updateLessonProgress(
        req.tenantId!,
        enrollmentId,
        lessonId,
        req.user!.userId,
        req.body
      );
      success(res, data, undefined, 'Progress updated successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const progressController = new ProgressController();

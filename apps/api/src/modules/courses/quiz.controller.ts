import { Request, Response, NextFunction } from 'express';
import { quizService } from './quiz.service';
import { success, created, noContent } from '../../utils/response';

class QuizController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const courseId = req.params.courseId as string;
      const result = await quizService.list(req.tenantId!, courseId, {
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
      const quizId = req.params.quizId as string;
      const data = await quizService.getById(req.tenantId!, courseId, quizId);
      success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const courseId = req.params.courseId as string;
      const data = await quizService.create(
        req.tenantId!,
        courseId,
        req.branchId!,
        req.user!.userId,
        req.body
      );
      created(res, data, 'Quiz created successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const courseId = req.params.courseId as string;
      const quizId = req.params.quizId as string;
      const data = await quizService.update(req.tenantId!, courseId, quizId, req.body);
      success(res, data, undefined, 'Quiz updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const courseId = req.params.courseId as string;
      const quizId = req.params.quizId as string;
      await quizService.delete(req.tenantId!, courseId, quizId);
      noContent(res);
    } catch (error) {
      next(error);
    }
  }

  async submitAttempt(req: Request, res: Response, next: NextFunction) {
    try {
      const courseId = req.params.courseId as string;
      const quizId = req.params.quizId as string;
      const data = await quizService.submitAttempt(
        req.tenantId!,
        courseId,
        quizId,
        req.user!.userId,
        req.body.enrollmentId,
        req.body.answers
      );
      created(res, data, 'Quiz submitted successfully');
    } catch (error) {
      next(error);
    }
  }

  async getAttempts(req: Request, res: Response, next: NextFunction) {
    try {
      const quizId = req.params.quizId as string;
      const result = await quizService.getAttempts(req.tenantId!, quizId, {
        studentId: req.query.studentId as string,
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      });
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }
}

export const quizController = new QuizController();

import { Request, Response, NextFunction } from 'express';
import { mentorshipService } from './mentorship.service';
import { success, created, noContent } from '../../../utils/response';

class MentorshipController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await mentorshipService.list(req.tenantId!, req.branchId!, {
        status: req.query.status as string,
        mentorAlumniId: req.query.mentorAlumniId as string,
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
      const data = await mentorshipService.getById(req.tenantId!, id);
      success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await mentorshipService.create(
        req.tenantId!,
        req.branchId!,
        req.user!.userId,
        req.body
      );
      created(res, data, 'Mentorship program created successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await mentorshipService.update(req.tenantId!, id, req.body);
      success(res, data, undefined, 'Mentorship program updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      await mentorshipService.delete(req.tenantId!, id);
      noContent(res);
    } catch (error) {
      next(error);
    }
  }

  async addSession(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await mentorshipService.addSession(
        req.tenantId!,
        id,
        req.user!.userId,
        req.body
      );
      success(res, data, undefined, 'Session added successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const mentorshipController = new MentorshipController();

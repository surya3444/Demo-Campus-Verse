import { Request, Response, NextFunction } from 'express';
import { counselingService } from './counseling.service';
import { success, created, noContent } from '../../../utils/response';

class CounselingController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await counselingService.list(req.tenantId!, req.branchId!, {
        search: req.query.search as string,
        status: req.query.status as string,
        sessionType: req.query.sessionType as string,
        audienceType: req.query.audienceType as string,
        studentId: req.query.studentId as string,
        classId: req.query.classId as string,
        sectionId: req.query.sectionId as string,
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
      const data = await counselingService.getById(req.tenantId!, id);
      success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await counselingService.create(
        req.tenantId!,
        req.branchId!,
        req.user!.userId,
        req.body
      );
      created(res, data, 'Counseling session created successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await counselingService.update(req.tenantId!, id, req.body);
      success(res, data, undefined, 'Counseling session updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      await counselingService.delete(req.tenantId!, id);
      noContent(res);
    } catch (error) {
      next(error);
    }
  }
}

export const counselingController = new CounselingController();

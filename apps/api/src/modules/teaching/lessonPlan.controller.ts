import { Request, Response, NextFunction } from 'express';
import { lessonPlanService } from './lessonPlan.service';
import { getStaffIdForUser } from './teaching.utils';
import { success, created } from '../../utils/response';
import { getScopedSectionIds } from '../../middleware/scope';

class LessonPlanController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const staffId = await getStaffIdForUser(req.tenantId!, req.user!.userId);
      const plan = await lessonPlanService.create(req.tenantId!, req.branchId!, req.body, staffId);
      created(res, plan, 'Lesson plan created successfully');
    } catch (error) {
      next(error);
    }
  }

  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      const isAdmin = (req.user!.roleLevel ?? 99) <= 3;

      let staffId: string | undefined;
      if (isAdmin && req.query.staffId) {
        staffId = req.query.staffId as string;
      } else if (!isAdmin) {
        staffId = await getStaffIdForUser(req.tenantId!, req.user!.userId);
      }

      const params = {
        sectionId: req.query.sectionId as string,
        restrictToSectionIds: await getScopedSectionIds(req),
        subjectId: req.query.subjectId as string,
        status: req.query.status as string,
        teachingStatus: req.query.teachingStatus as string,
        dateFrom: req.query.dateFrom as string,
        dateTo: req.query.dateTo as string,
        search: req.query.search as string,
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as string,
      };

      const result = await lessonPlanService.findAll(req.tenantId!, req.branchId!, params, staffId);
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const plan = await lessonPlanService.findById(req.tenantId!, id);
      success(res, plan);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const staffId = await getStaffIdForUser(req.tenantId!, req.user!.userId);
      const roleLevel = req.user!.roleLevel ?? 99;

      const plan = await lessonPlanService.update(req.tenantId!, id, req.body, staffId, roleLevel);
      success(res, plan, undefined, 'Lesson plan updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateTeachingStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const staffId = await getStaffIdForUser(req.tenantId!, req.user!.userId);
      const roleLevel = req.user!.roleLevel ?? 99;

      const plan = await lessonPlanService.updateTeachingStatus(
        req.tenantId!,
        id,
        req.body,
        staffId,
        roleLevel
      );
      success(res, plan, undefined, 'Teaching status updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const staffId = await getStaffIdForUser(req.tenantId!, req.user!.userId);
      const roleLevel = req.user!.roleLevel ?? 99;

      await lessonPlanService.delete(req.tenantId!, id, staffId, roleLevel);
      success(res, null, undefined, 'Lesson plan deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const lessonPlanController = new LessonPlanController();

import { getScopedSectionIds } from '../../middleware/scope';
import { Request, Response, NextFunction } from 'express';
import { myClassesService } from './myClasses.service';
import { getStaffIdForUser } from './teaching.utils';
import { assertTeachingScope } from './scope';
import { success } from '../../utils/response';

class MyClassesController {
  async getMyClasses(req: Request, res: Response, next: NextFunction) {
    try {
      const isAdmin = (req.user!.roleLevel ?? 99) <= 3;

      let staffId: string | undefined;

      if (isAdmin && req.query.staffId) {
        // Admin viewing a specific teacher's classes
        staffId = req.query.staffId as string;
      } else if (isAdmin) {
        // Admin without staffId — try to find their staff record,
        // but fall back to all branch sections if they don't have one
        try {
          staffId = await getStaffIdForUser(req.tenantId!, req.user!.userId);
        } catch {
          // Admin has no staff record — return all sections in the branch
          const data = await myClassesService.getAllBranchClasses(
            req.tenantId!,
            req.branchId!,
            await getScopedSectionIds(req)
          );
          success(res, data);
          return;
        }
      } else {
        // Non-admin: require staff record
        staffId = await getStaffIdForUser(req.tenantId!, req.user!.userId);
      }

      const data = await myClassesService.getMyClasses(req.tenantId!, req.branchId!, staffId);
      success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async getSectionStudents(req: Request, res: Response, next: NextFunction) {
    try {
      const sectionId = req.params.sectionId as string;
      await assertTeachingScope(req, sectionId);
      const params = {
        search: req.query.search as string,
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as string,
        subjectId: req.query.subjectId as string | undefined,
      };

      const result = await myClassesService.getSectionStudents(
        req.tenantId!,
        req.branchId!,
        sectionId,
        params
      );
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getSectionLessonPlans(req: Request, res: Response, next: NextFunction) {
    try {
      const sectionId = req.params.sectionId as string;
      const staffId = await getStaffIdForUser(req.tenantId!, req.user!.userId);
      const params = {
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as string,
      };

      const result = await myClassesService.getSectionLessonPlans(
        req.tenantId!,
        req.branchId!,
        sectionId,
        staffId,
        params
      );
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }
}

export const myClassesController = new MyClassesController();

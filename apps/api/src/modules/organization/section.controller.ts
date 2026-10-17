import { assertStructureWriteInScope } from '../../middleware/scope';
import { Request, Response, NextFunction } from 'express';
import { sectionService, SectionListParams } from './section.service';
import { getScopedDepartmentClassIds } from '../../middleware/scope';
import { success, created } from '../../utils/response';

class SectionController {
  async findByClassId(req: Request, res: Response, next: NextFunction) {
    try {
      const params: SectionListParams = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        status: req.query.status as 'active' | 'inactive',
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc',
      };

      const result = await sectionService.findByClassId(
        req.tenantId!,
        req.params.classId as string,
        params
      );
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const params: SectionListParams = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 100,
        classId: req.query.classId as string,
        status: req.query.status as 'active' | 'inactive',
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc',
        restrictToClassIds: (await getScopedDepartmentClassIds(req)) ?? undefined,
      };

      const result = await sectionService.findAll(req.tenantId!, req.branchId, params);
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const section = await sectionService.findById(req.tenantId!, req.params.id as string);
      success(res, section);
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

      const data = { ...req.body, classId: req.params.classId as string };
      await assertStructureWriteInScope(req, { classId: req.params.classId as string });
      const section = await sectionService.create(
        req.tenantId!,
        req.branchId,
        data,
        req.user!.userId
      );
      created(res, section, 'Section created successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const section = await sectionService.update(req.tenantId!, req.params.id as string, req.body);
      success(res, section, undefined, 'Section updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { status } = req.body;
      if (!status || !['active', 'inactive'].includes(status)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_STATUS', message: 'Status must be "active" or "inactive"' },
        });
      }
      const section = await sectionService.updateStatus(
        req.tenantId!,
        req.params.id as string,
        status
      );
      success(res, section, undefined, 'Section status updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await sectionService.delete(req.tenantId!, req.params.id as string);
      success(res, null, undefined, 'Section deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  async getStudentCount(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await sectionService.getStudentCount(req.tenantId!, req.params.id as string);
      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async assignTeacher(req: Request, res: Response, next: NextFunction) {
    try {
      const { staffId } = req.body;
      const section = await sectionService.assignTeacher(
        req.tenantId!,
        req.params.id as string,
        staffId || null
      );
      success(
        res,
        section,
        undefined,
        staffId ? 'Teacher assigned successfully' : 'Teacher removed successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  async getSubjects(req: Request, res: Response, next: NextFunction) {
    try {
      const subjects = await sectionService.getSubjects(req.tenantId!, req.params.id as string);
      success(res, subjects);
    } catch (error) {
      next(error);
    }
  }

  async updateBatches(req: Request, res: Response, next: NextFunction) {
    try {
      const section = await sectionService.updateBatches(
        req.tenantId!,
        req.params.id as string,
        req.body.batches
      );
      success(res, section, undefined, 'Lab batches updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async assignStudentsToBatches(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await sectionService.assignStudentsToBatches(
        req.tenantId!,
        req.params.id as string,
        req.body.assignments
      );
      success(res, result, undefined, 'Lab batch assignments updated');
    } catch (error) {
      next(error);
    }
  }

  async assignSubject(req: Request, res: Response, next: NextFunction) {
    try {
      const subjects = await sectionService.assignSubject(
        req.tenantId!,
        req.params.id as string,
        req.body
      );
      created(res, subjects, 'Subject assigned to section successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateSubject(req: Request, res: Response, next: NextFunction) {
    try {
      const subjects = await sectionService.updateSubject(
        req.tenantId!,
        req.params.id as string,
        req.params.subjectId as string,
        req.body
      );
      success(res, subjects, undefined, 'Section subject updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async removeSubject(req: Request, res: Response, next: NextFunction) {
    try {
      await sectionService.removeSubject(
        req.tenantId!,
        req.params.id as string,
        req.params.subjectId as string
      );
      success(res, null, undefined, 'Subject removed from section successfully');
    } catch (error) {
      next(error);
    }
  }

  async getTeachers(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const teachers = await sectionService.getTeachers(req.tenantId!, req.branchId);
      success(res, teachers);
    } catch (error) {
      next(error);
    }
  }
}

export const sectionController = new SectionController();

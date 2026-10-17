import { assertStructureWriteInScope } from '../../middleware/scope';
import { Request, Response, NextFunction } from 'express';
import { classService, ClassListParams } from './class.service';
import { sectionService } from './section.service';
import { getScopedDepartmentClassIds } from '../../middleware/scope';
import { success, created } from '../../utils/response';

class ClassController {
  /**
   * Full class tree for a batch: classes → sections → enriched subjects, in a
   * SINGLE request. The academic-structure page used to fan this out into
   * 1 + N + N×M parallel XHRs, which tripped the API gateway's rate limit
   * (nginx → 503, surfaced in the browser as "CORS error"). Composing the
   * existing services server-side keeps the exact same shapes with one call.
   */
  async getTree(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const branchId = req.branchId || (req.query.branchId as string);
      const academicBatchId = req.query.academicBatchId as string;

      const { data: classes } = await classService.findAll(tenantId, {
        page: 1,
        limit: 500,
        branchId,
        academicBatchId,
      });

      const tree = await Promise.all(
        (classes as Array<{ _id: string }>).map(async (cls) => {
          const { data: sections } = await sectionService.findByClassId(tenantId, cls._id, {
            limit: 200,
          });
          const sectionsWithSubjects = await Promise.all(
            (sections as Array<{ _id: string }>).map(async (section) => ({
              ...section,
              subjects: await sectionService.getSubjects(tenantId, section._id),
            }))
          );
          return { ...cls, sections: sectionsWithSubjects };
        })
      );

      success(res, { classes: tree });
    } catch (error) {
      next(error);
    }
  }

  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      const params: ClassListParams = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        branchId: req.branchId || (req.query.branchId as string),
        academicBatchId: req.query.academicBatchId as string,
        status: req.query.status as 'active' | 'inactive',
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc',
        restrictToClassIds: (await getScopedDepartmentClassIds(req)) ?? undefined,
      };

      const result = await classService.findAll(req.tenantId!, params);
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const classDoc = await classService.findById(req.tenantId!, req.params.id as string);
      success(res, classDoc);
    } catch (error) {
      next(error);
    }
  }

  async copyStructure(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await classService.copyStructure(
        req.tenantId!,
        req.branchId!,
        req.body.fromBatchId,
        req.params.id as string,
        req.user?.userId
      );
      success(res, result, undefined, 'Academic structure copied');
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

      await assertStructureWriteInScope(req, {
        programId: req.body.programId,
      });
      const classDoc = await classService.create(
        req.tenantId!,
        req.branchId,
        req.body,
        req.user!.userId
      );
      created(res, classDoc, 'Class created successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const classDoc = await classService.update(req.tenantId!, req.params.id as string, req.body);
      success(res, classDoc, undefined, 'Class updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { status } = req.body;
      const classDoc = await classService.updateStatus(
        req.tenantId!,
        req.params.id as string,
        status
      );
      success(res, classDoc, undefined, 'Class status updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await classService.delete(req.tenantId!, req.params.id as string);
      success(res, null, undefined, 'Class deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  async getSubjects(req: Request, res: Response, next: NextFunction) {
    try {
      const subjects = await classService.getSubjects(req.tenantId!, req.params.id as string);
      success(res, subjects);
    } catch (error) {
      next(error);
    }
  }
}

export const classController = new ClassController();

import { getScopedClassIds } from '../../middleware/scope';
import { Request, Response, NextFunction } from 'express';
import {
  structureScopeFilter,
  feeStructureService,
  FeeStructureListParams,
} from './feeStructure.service';
import { success, created } from '../../utils/response';

class FeeStructureController {
  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const params: FeeStructureListParams = {
        scopeFilter: await structureScopeFilter(req.tenantId!, await getScopedClassIds(req)),
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        search: req.query.search as string,
        academicBatchId: req.query.academicBatchId as string,
        isActive:
          req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
        classId: req.query.classId as string,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc',
      };

      const result = await feeStructureService.findAll(req.tenantId!, req.branchId, params);
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const structure = await feeStructureService.findById(req.tenantId!, req.params.id as string);
      success(res, structure);
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

      const result = await feeStructureService.create(
        req.tenantId!,
        req.branchId,
        req.body,
        req.user!.userId
      );
      const msg =
        result.assigned > 0
          ? `Fee structure created and assigned to ${result.assigned} student${
              result.assigned === 1 ? '' : 's'
            }`
          : 'Fee structure created successfully';
      created(res, result, msg);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const structure = await feeStructureService.update(
        req.tenantId!,
        req.branchId!,
        req.params.id as string,
        req.body,
        req.user!.userId
      );
      success(res, structure, undefined, 'Fee structure updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const force = req.query.force === 'true';
      await feeStructureService.delete(req.tenantId!, req.params.id as string, { force });
      success(res, null, undefined, 'Fee structure deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  async getAssignmentCount(req: Request, res: Response, next: NextFunction) {
    try {
      const counts = await feeStructureService.assignmentCountForStructure(
        req.tenantId!,
        req.params.id as string
      );
      success(res, counts);
    } catch (error) {
      next(error);
    }
  }

  async findForSection(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const sectionId = req.params.sectionId as string;
      const classId = req.query.classId as string;
      if (!classId) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'classId query param is required' },
        });
      }

      const result = await feeStructureService.findForSection(
        req.tenantId!,
        req.branchId,
        sectionId,
        classId
      );
      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async clone(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, code } = req.body;

      if (!name || !code) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Name and code are required' },
        });
      }

      const structure = await feeStructureService.clone(
        req.tenantId!,
        req.params.id as string,
        name,
        code,
        req.user!.userId
      );
      created(res, structure, 'Fee structure cloned successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const feeStructureController = new FeeStructureController();

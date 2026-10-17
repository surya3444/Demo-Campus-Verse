import { Request, Response, NextFunction } from 'express';
import { academicBatchService, AcademicBatchListParams } from './academicBatch.service';
import { success, created } from '../../utils/response';

class AcademicBatchController {
  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      const params: AcademicBatchListParams = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        branchId: req.branchId || (req.query.branchId as string),
        status: req.query.status as 'upcoming' | 'active' | 'completed',
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc',
      };

      const result = await academicBatchService.findAll(req.tenantId!, params);
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const batch = await academicBatchService.findById(req.tenantId!, req.params.id as string);
      success(res, batch);
    } catch (error) {
      next(error);
    }
  }

  async getCurrent(req: Request, res: Response, next: NextFunction) {
    try {
      const batch = await academicBatchService.getCurrent(req.tenantId!, req.branchId);
      success(res, batch);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const batch = await academicBatchService.create(
        req.tenantId!,
        req.branchId,
        req.body,
        req.user!.userId
      );
      created(res, batch, 'Academic batch created successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const batch = await academicBatchService.update(
        req.tenantId!,
        req.params.id as string,
        req.body
      );
      success(res, batch, undefined, 'Academic batch updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async setAsCurrent(req: Request, res: Response, next: NextFunction) {
    try {
      const batch = await academicBatchService.setAsCurrent(
        req.tenantId!,
        req.params.id as string,
        req.branchId
      );
      success(res, batch, undefined, 'Academic batch set as current');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await academicBatchService.delete(req.tenantId!, req.params.id as string);
      success(res, null, undefined, 'Academic batch deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  // ─── Terms (semesters) ────────────────────────────────────────────────────

  async addTerm(req: Request, res: Response, next: NextFunction) {
    try {
      const batch = await academicBatchService.addTerm(
        req.tenantId!,
        req.params.id as string,
        req.body
      );
      created(res, batch, 'Term added successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateTerm(req: Request, res: Response, next: NextFunction) {
    try {
      const batch = await academicBatchService.updateTerm(
        req.tenantId!,
        req.params.id as string,
        req.params.termId as string,
        req.body
      );
      success(res, batch, undefined, 'Term updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteTerm(req: Request, res: Response, next: NextFunction) {
    try {
      const batch = await academicBatchService.deleteTerm(
        req.tenantId!,
        req.params.id as string,
        req.params.termId as string
      );
      success(res, batch, undefined, 'Term deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const academicBatchController = new AcademicBatchController();

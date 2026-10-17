import { getScopedClassIds } from '../../middleware/scope';
import { Request, Response, NextFunction } from 'express';
import { applicationService, ApplicationListParams } from './application.service';
import { success, created } from '../../utils/response';

class ApplicationController {
  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const params: ApplicationListParams = {
        restrictToClassIds: await getScopedClassIds(req),
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        search: req.query.search as string,
        status: req.query.status as string,
        classId: req.query.classId as string,
        academicBatchId: req.query.academicBatchId as string,
        fromDate: req.query.fromDate as string,
        toDate: req.query.toDate as string,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc',
      };

      const result = await applicationService.findAll(req.tenantId!, req.branchId, params);
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const application = await applicationService.findById(req.tenantId!, req.params.id as string);
      success(res, application);
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

      const application = await applicationService.create(
        req.tenantId!,
        req.branchId,
        req.body,
        req.user!.userId
      );
      created(res, application, 'Application created successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const application = await applicationService.update(
        req.tenantId!,
        req.params.id as string,
        req.body
      );
      success(res, application, undefined, 'Application updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, remarks } = req.body;
      const application = await applicationService.updateStatus(
        req.tenantId!,
        req.params.id as string,
        status,
        req.user!.userId,
        remarks
      );
      success(res, application, undefined, 'Application status updated');
    } catch (error) {
      next(error);
    }
  }

  async convertFromLead(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const application = await applicationService.convertFromLead(
        req.tenantId!,
        req.branchId,
        req.params.id as string,
        req.body,
        req.user!.userId
      );
      created(res, application, 'Lead converted to application successfully');
    } catch (error) {
      next(error);
    }
  }

  async enroll(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await applicationService.enroll(
        req.tenantId!,
        req.params.id as string,
        req.body,
        req.user!.userId
      );
      success(res, result, undefined, 'Student enrolled successfully');
    } catch (error) {
      next(error);
    }
  }

  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const stats = await applicationService.getStats(req.tenantId!, req.branchId);
      success(res, stats);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await applicationService.delete(req.tenantId!, req.params.id as string);
      success(res, null, undefined, 'Application deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const applicationController = new ApplicationController();

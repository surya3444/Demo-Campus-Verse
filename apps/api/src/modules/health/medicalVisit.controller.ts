import { Request, Response, NextFunction } from 'express';
import { medicalVisitService } from './medicalVisit.service';
import { success, created } from '../../utils/response';
import { MedicalVisitQueryInput } from '@campus-verse/shared/schemas';

class MedicalVisitController {
  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const params: MedicalVisitQueryInput = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        search: req.query.search as string,
        personType: req.query.personType as 'student' | 'staff' | undefined,
        personId: req.query.personId as string | undefined,
        healthRecordId: req.query.healthRecordId as string | undefined,
        visitType: req.query.visitType as 'routine' | 'illness' | 'injury' | 'emergency' | 'follow-up' | 'other' | undefined,
        status: req.query.status as 'in_progress' | 'completed' | 'follow_up_required' | undefined,
        outcome: req.query.outcome as 'returned_to_class' | 'sent_home' | 'referred' | 'hospitalized' | 'under_observation' | undefined,
        isIncident: req.query.isIncident === 'true' ? true : req.query.isIncident === 'false' ? false : undefined,
        fromDate: req.query.fromDate ? new Date(req.query.fromDate as string) : undefined,
        toDate: req.query.toDate ? new Date(req.query.toDate as string) : undefined,
        today: req.query.today === 'true',
        sortBy: (req.query.sortBy as string) || 'arrivalTime',
        sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
      };

      const result = await medicalVisitService.findAll(req.tenantId!, req.branchId, params);
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const visit = await medicalVisitService.findById(req.tenantId!, req.params.id as string);
      success(res, visit);
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

      const visit = await medicalVisitService.create(
        req.tenantId!,
        req.branchId,
        req.body,
        req.user!.userId
      );
      created(res, visit, 'Medical visit created successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const visit = await medicalVisitService.update(
        req.tenantId!,
        req.params.id as string,
        req.body
      );
      success(res, visit, undefined, 'Medical visit updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async close(req: Request, res: Response, next: NextFunction) {
    try {
      const visit = await medicalVisitService.close(
        req.tenantId!,
        req.params.id as string,
        req.body,
        req.user!.userId
      );
      success(res, visit, undefined, 'Medical visit closed successfully');
    } catch (error) {
      next(error);
    }
  }

  async getTodayVisits(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const result = await medicalVisitService.getTodayVisits(req.tenantId!, req.branchId);
      success(res, result);
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

      const stats = await medicalVisitService.getStats(req.tenantId!, req.branchId);
      success(res, stats);
    } catch (error) {
      next(error);
    }
  }

  async notifyParent(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await medicalVisitService.notifyParent(
        req.tenantId!,
        req.params.id as string,
        req.user!.userId
      );
      success(res, result, undefined, 'Parent notification sent successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const medicalVisitController = new MedicalVisitController();

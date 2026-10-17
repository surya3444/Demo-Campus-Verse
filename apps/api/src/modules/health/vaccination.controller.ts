import { Request, Response, NextFunction } from 'express';
import { vaccinationService } from './vaccination.service';
import { success, created } from '../../utils/response';
import { VaccinationQueryInput } from '@campus-verse/shared/schemas';

class VaccinationController {
  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const params: VaccinationQueryInput = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        search: req.query.search as string,
        personType: req.query.personType as 'student' | 'staff' | undefined,
        personId: req.query.personId as string | undefined,
        healthRecordId: req.query.healthRecordId as string | undefined,
        vaccineName: req.query.vaccineName as string | undefined,
        status: req.query.status as 'scheduled' | 'completed' | 'missed' | 'overdue' | 'exempt' | undefined,
        fromDate: req.query.fromDate ? new Date(req.query.fromDate as string) : undefined,
        toDate: req.query.toDate ? new Date(req.query.toDate as string) : undefined,
        sortBy: (req.query.sortBy as string) || 'createdAt',
        sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
      };

      const result = await vaccinationService.findAll(req.tenantId!, req.branchId, params);
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const vaccination = await vaccinationService.findById(req.tenantId!, req.params.id as string);
      success(res, vaccination);
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

      const vaccination = await vaccinationService.create(
        req.tenantId!,
        req.branchId,
        req.body,
        req.user!.userId
      );
      created(res, vaccination, 'Vaccination record created successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const vaccination = await vaccinationService.update(
        req.tenantId!,
        req.params.id as string,
        req.body
      );
      success(res, vaccination, undefined, 'Vaccination record updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async administer(req: Request, res: Response, next: NextFunction) {
    try {
      const vaccination = await vaccinationService.administer(
        req.tenantId!,
        req.params.id as string,
        req.body,
        req.user!.userId
      );
      success(res, vaccination, undefined, 'Vaccination administered successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await vaccinationService.delete(req.tenantId!, req.params.id as string);
      success(res, null, undefined, 'Vaccination record deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  async getDue(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const daysAhead = req.query.daysAhead ? parseInt(req.query.daysAhead as string) : 30;
      const result = await vaccinationService.getDueVaccinations(req.tenantId!, req.branchId, daysAhead);
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

      const stats = await vaccinationService.getStats(req.tenantId!, req.branchId);
      success(res, stats);
    } catch (error) {
      next(error);
    }
  }

  async markOverdue(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const result = await vaccinationService.markOverdue(req.tenantId!, req.branchId);
      success(res, result, undefined, 'Overdue vaccinations marked successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const vaccinationController = new VaccinationController();

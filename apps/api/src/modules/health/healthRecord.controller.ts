import { Request, Response, NextFunction } from 'express';
import { healthRecordService } from './healthRecord.service';
import { success, created } from '../../utils/response';
import { HealthRecordQueryInput } from '@campus-verse/shared/schemas';
import { BloodGroup } from '@campus-verse/shared';

class HealthRecordController {
  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const params: HealthRecordQueryInput = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        search: req.query.search as string,
        personType: req.query.personType as 'student' | 'staff' | undefined,
        hasAllergies: req.query.hasAllergies === 'true' ? true : req.query.hasAllergies === 'false' ? false : undefined,
        hasConditions: req.query.hasConditions === 'true' ? true : req.query.hasConditions === 'false' ? false : undefined,
        hasInsurance: req.query.hasInsurance === 'true' ? true : req.query.hasInsurance === 'false' ? false : undefined,
        bloodGroup: req.query.bloodGroup as BloodGroup | undefined,
        status: req.query.status as 'active' | 'inactive' | undefined,
        sortBy: (req.query.sortBy as string) || 'createdAt',
        sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
      };

      const result = await healthRecordService.findAll(req.tenantId!, req.branchId, params);
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const record = await healthRecordService.findById(req.tenantId!, req.params.id as string);
      success(res, record);
    } catch (error) {
      next(error);
    }
  }

  async findByPerson(req: Request, res: Response, next: NextFunction) {
    try {
      const personType = req.params.personType as string;
      const personId = req.params.personId as string;
      const record = await healthRecordService.findByPerson(
        req.tenantId!,
        personType as 'student' | 'staff',
        personId
      );

      if (!record) {
        return res.status(404).json({
          success: false,
          error: { code: 'RECORD_NOT_FOUND', message: 'Health record not found for this person' },
        });
      }

      success(res, record);
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

      const record = await healthRecordService.create(
        req.tenantId!,
        req.branchId,
        req.body,
        req.user!.userId
      );
      created(res, record, 'Health record created successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const record = await healthRecordService.update(
        req.tenantId!,
        req.params.id as string,
        req.body,
        req.user!.userId
      );
      success(res, record, undefined, 'Health record updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await healthRecordService.delete(req.tenantId!, req.params.id as string);
      success(res, null, undefined, 'Health record deleted successfully');
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

      const stats = await healthRecordService.getStats(req.tenantId!, req.branchId);
      success(res, stats);
    } catch (error) {
      next(error);
    }
  }

  async syncFromPerson(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const personType = req.params.personType as string;
      const personId = req.params.personId as string;
      const record = await healthRecordService.syncFromPerson(
        req.tenantId!,
        req.branchId,
        personType as 'student' | 'staff',
        personId,
        req.user!.userId
      );
      success(res, record, undefined, 'Health record synced successfully');
    } catch (error) {
      next(error);
    }
  }

  async dismissAlert(req: Request, res: Response, next: NextFunction) {
    try {
      const { alertType } = req.body;
      if (!alertType) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Alert type is required' },
        });
      }

      await healthRecordService.dismissAlert(
        req.tenantId!,
        req.params.id as string,
        alertType,
        req.user!.userId
      );
      success(res, null, undefined, 'Alert dismissed successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const healthRecordController = new HealthRecordController();

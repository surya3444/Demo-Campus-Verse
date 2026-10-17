import { Request, Response, NextFunction } from 'express';
import { healthCheckupService } from './healthCheckup.service';
import { success, created } from '../../utils/response';
import { HealthCheckupQueryInput, CheckupCampaignQueryInput } from '@campus-verse/shared/schemas';

class HealthCheckupController {
  // ============ Checkups ============

  async findAllCheckups(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const params: HealthCheckupQueryInput = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        search: req.query.search as string,
        personType: req.query.personType as 'student' | 'staff' | undefined,
        personId: req.query.personId as string | undefined,
        healthRecordId: req.query.healthRecordId as string | undefined,
        campaignId: req.query.campaignId as string | undefined,
        checkupType: req.query.checkupType as 'routine' | 'annual' | 'sports' | 'pre-admission' | 'follow-up' | 'other' | undefined,
        status: req.query.status as 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | undefined,
        fromDate: req.query.fromDate ? new Date(req.query.fromDate as string) : undefined,
        toDate: req.query.toDate ? new Date(req.query.toDate as string) : undefined,
        sortBy: (req.query.sortBy as string) || 'checkupDate',
        sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
      };

      const result = await healthCheckupService.findAllCheckups(req.tenantId!, req.branchId, params);
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async findCheckupById(req: Request, res: Response, next: NextFunction) {
    try {
      const checkup = await healthCheckupService.findCheckupById(req.tenantId!, req.params.id as string);
      success(res, checkup);
    } catch (error) {
      next(error);
    }
  }

  async createCheckup(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const checkup = await healthCheckupService.createCheckup(
        req.tenantId!,
        req.branchId,
        req.body,
        req.user!.userId
      );
      created(res, checkup, 'Health checkup created successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateCheckup(req: Request, res: Response, next: NextFunction) {
    try {
      const checkup = await healthCheckupService.updateCheckup(
        req.tenantId!,
        req.params.id as string,
        req.body
      );
      success(res, checkup, undefined, 'Health checkup updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async completeCheckup(req: Request, res: Response, next: NextFunction) {
    try {
      const checkup = await healthCheckupService.completeCheckup(
        req.tenantId!,
        req.params.id as string,
        req.body,
        req.user!.userId
      );
      success(res, checkup, undefined, 'Health checkup completed successfully');
    } catch (error) {
      next(error);
    }
  }

  async getCheckupStats(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const stats = await healthCheckupService.getCheckupStats(req.tenantId!, req.branchId);
      success(res, stats);
    } catch (error) {
      next(error);
    }
  }

  // ============ Campaigns ============

  async findAllCampaigns(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const params: CheckupCampaignQueryInput = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        search: req.query.search as string,
        personType: req.query.personType as 'student' | 'staff' | undefined,
        status: req.query.status as 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | undefined,
        fromDate: req.query.fromDate ? new Date(req.query.fromDate as string) : undefined,
        toDate: req.query.toDate ? new Date(req.query.toDate as string) : undefined,
        sortBy: (req.query.sortBy as string) || 'scheduledDate',
        sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
      };

      const result = await healthCheckupService.findAllCampaigns(req.tenantId!, req.branchId, params);
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async findCampaignById(req: Request, res: Response, next: NextFunction) {
    try {
      const campaign = await healthCheckupService.findCampaignById(req.tenantId!, req.params.id as string);
      success(res, campaign);
    } catch (error) {
      next(error);
    }
  }

  async createCampaign(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const campaign = await healthCheckupService.createCampaign(
        req.tenantId!,
        req.branchId,
        req.body,
        req.user!.userId
      );
      created(res, campaign, 'Health checkup campaign created successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateCampaign(req: Request, res: Response, next: NextFunction) {
    try {
      const campaign = await healthCheckupService.updateCampaign(
        req.tenantId!,
        req.params.id as string,
        req.body
      );
      success(res, campaign, undefined, 'Health checkup campaign updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async startCampaign(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const result = await healthCheckupService.startCampaign(
        req.tenantId!,
        req.branchId,
        req.params.id as string,
        req.user!.userId
      );
      success(res, result, undefined, 'Health checkup campaign started successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const healthCheckupController = new HealthCheckupController();

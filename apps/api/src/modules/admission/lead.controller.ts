import { getScopedClassIds } from '../../middleware/scope';
import { Request, Response, NextFunction } from 'express';
import { leadService, LeadListParams } from './lead.service';
import { success, created } from '../../utils/response';

class LeadController {
  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const params: LeadListParams = {
        restrictToClassIds: await getScopedClassIds(req),
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        search: req.query.search as string,
        stage: req.query.stage as string | string[],
        source: req.query.source as string,
        assignedTo: req.query.assignedTo as string,
        status: req.query.status as string,
        hasFollowupDue: req.query.hasFollowupDue === 'true',
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc',
      };

      const result = await leadService.findAll(req.tenantId!, req.branchId, params);
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const lead = await leadService.findById(req.tenantId!, req.params.id as string);
      success(res, lead);
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

      const lead = await leadService.create(
        req.tenantId!,
        req.branchId,
        req.body,
        req.user!.userId
      );
      created(res, lead, 'Lead created successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const lead = await leadService.update(req.tenantId!, req.params.id as string, req.body);
      success(res, lead, undefined, 'Lead updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateStage(req: Request, res: Response, next: NextFunction) {
    try {
      const { stage, notes } = req.body;
      const lead = await leadService.updateStage(
        req.tenantId!,
        req.params.id as string,
        stage,
        notes,
        req.user!.userId
      );
      success(res, lead, undefined, 'Lead stage updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async addFollowup(req: Request, res: Response, next: NextFunction) {
    try {
      const lead = await leadService.addFollowup(
        req.tenantId!,
        req.params.id as string,
        req.body,
        req.user!.userId
      );
      success(res, lead, undefined, 'Followup added successfully');
    } catch (error) {
      next(error);
    }
  }

  async completeFollowup(req: Request, res: Response, next: NextFunction) {
    try {
      const followupIndex = parseInt(req.params.followupIndex as string, 10);
      if (isNaN(followupIndex) || followupIndex < 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INDEX', message: 'Invalid followup index' },
        });
      }

      const lead = await leadService.completeFollowup(
        req.tenantId!,
        req.params.id as string,
        followupIndex,
        req.body,
        req.user!.userId
      );
      success(res, lead, undefined, 'Followup completed successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await leadService.delete(req.tenantId!, req.params.id as string);
      success(res, null, undefined, 'Lead deleted successfully');
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

      const stats = await leadService.getStats(req.tenantId!, req.branchId);
      success(res, stats);
    } catch (error) {
      next(error);
    }
  }

  async getFollowupsDue(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const params = {
        date: req.query.date as string,
        assignedTo: req.query.assignedTo as string,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      };

      const result = await leadService.getFollowupsDue(req.tenantId!, req.branchId, params);
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getOverdueFollowups(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const params = {
        assignedTo: req.query.assignedTo as string,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      };

      const result = await leadService.getOverdueFollowups(req.tenantId!, req.branchId, params);
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getFollowupStats(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const stats = await leadService.getFollowupStats(
        req.tenantId!,
        req.branchId,
        req.query.assignedTo as string
      );
      success(res, stats);
    } catch (error) {
      next(error);
    }
  }
}

export const leadController = new LeadController();

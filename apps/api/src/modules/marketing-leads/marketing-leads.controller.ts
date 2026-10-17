import { Request, Response, NextFunction } from 'express';
import { marketingLeadsService } from './marketing-leads.service';
import { pipelineService, type StageColor } from './pipeline.service';
import { success, created } from '../../utils/response';
import { ApiError } from '../../middleware/errorHandler';

class MarketingLeadsController {
  async createDemoLead(req: Request, res: Response, next: NextFunction) {
    try {
      const { firstName, lastName, institution, institutionType, phone, email, message, page } =
        (req.body || {}) as Record<string, string | undefined>;

      if (!firstName?.trim()) {
        throw new ApiError('INVALID_INPUT', 'First name is required', 400);
      }
      if (!institution?.trim()) {
        throw new ApiError('INVALID_INPUT', 'Institution name is required', 400);
      }
      if (!email?.trim() || !email.includes('@')) {
        throw new ApiError('INVALID_INPUT', 'A valid email is required', 400);
      }

      const lead = await marketingLeadsService.createDemoLead({
        firstName,
        lastName,
        institution,
        institutionType,
        phone,
        email,
        message,
        metadata: {
          userAgent: req.get('user-agent') || undefined,
          ipAddress: req.ip,
          referrer: req.get('referer') || undefined,
          page,
        },
      });

      created(res, lead, 'Demo request received');
    } catch (error) {
      next(error);
    }
  }

  async listLeads(req: Request, res: Response, next: NextFunction) {
    try {
      const { stage, search, page, limit } = req.query;
      const result = await marketingLeadsService.listLeads({
        stage: stage as string | undefined,
        search: search as string | undefined,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getLead(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const lead = await marketingLeadsService.getLead(id);
      success(res, lead);
    } catch (error) {
      next(error);
    }
  }

  async updateStage(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { stage, lostReason } = (req.body || {}) as { stage: string; lostReason?: string };
      if (!stage) {
        throw new ApiError('INVALID_INPUT', 'stage is required', 400);
      }
      const lead = await marketingLeadsService.updateStage(id, stage, lostReason);
      success(res, lead);
    } catch (error) {
      next(error);
    }
  }

  async addNote(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { note } = (req.body || {}) as { note: string };
      if (!req.superAdmin) {
        throw new ApiError('UNAUTHORIZED', 'Not authenticated', 401);
      }
      const lead = await marketingLeadsService.addNote(
        id,
        note,
        req.superAdmin.adminId,
        req.superAdmin.email
      );
      success(res, lead);
    } catch (error) {
      next(error);
    }
  }

  async deleteLead(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const result = await marketingLeadsService.deleteLead(id);
      success(res, result, undefined, 'Lead deleted');
    } catch (error) {
      next(error);
    }
  }

  async getStats(_req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await marketingLeadsService.getStats();
      success(res, stats);
    } catch (error) {
      next(error);
    }
  }

  // ============ Pipeline (stage management) ============

  async getPipeline(_req: Request, res: Response, next: NextFunction) {
    try {
      const stages = await pipelineService.getPipeline();
      success(res, stages);
    } catch (error) {
      next(error);
    }
  }

  async addStage(req: Request, res: Response, next: NextFunction) {
    try {
      const { label, color, afterKey } = (req.body || {}) as {
        label: string;
        color?: StageColor;
        afterKey?: string;
      };
      const stages = await pipelineService.addStage({ label, color, afterKey });
      success(res, stages);
    } catch (error) {
      next(error);
    }
  }

  async updateStage_pipeline(req: Request, res: Response, next: NextFunction) {
    try {
      const key = req.params.key as string;
      const { label, color } = (req.body || {}) as {
        label?: string;
        color?: StageColor;
      };
      const stages = await pipelineService.updateStage(key, { label, color });
      success(res, stages);
    } catch (error) {
      next(error);
    }
  }

  async deleteStage(req: Request, res: Response, next: NextFunction) {
    try {
      const key = req.params.key as string;
      const reassignTo =
        ((req.body || {}) as { reassignTo?: string }).reassignTo ||
        (req.query.reassignTo as string | undefined) ||
        '';
      const stages = await pipelineService.deleteStage(key, reassignTo);
      success(res, stages);
    } catch (error) {
      next(error);
    }
  }

  async reorderStages(req: Request, res: Response, next: NextFunction) {
    try {
      const { orderedKeys } = (req.body || {}) as { orderedKeys: string[] };
      const stages = await pipelineService.reorderStages(orderedKeys);
      success(res, stages);
    } catch (error) {
      next(error);
    }
  }
}

export const marketingLeadsController = new MarketingLeadsController();

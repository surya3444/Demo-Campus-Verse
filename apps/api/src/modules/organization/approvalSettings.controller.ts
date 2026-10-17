import { Request, Response, NextFunction } from 'express';
import { approvalSettingsService } from './approvalSettings.service';

class ApprovalSettingsController {
  async getSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await approvalSettingsService.getSettings(req.tenantId!, req.branchId!);
      res.json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  }

  async updateEmailSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const entityType = req.params.entityType as
        | 'concession'
        | 'feeCancellation'
        | 'leave'
        | 'certificate';

      const validTypes = ['concession', 'feeCancellation', 'leave', 'certificate'];
      if (!validTypes.includes(entityType)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_ENTITY_TYPE', message: 'Invalid entity type' },
        });
      }

      const settings = await approvalSettingsService.updateEmailSettings(
        req.tenantId!,
        req.branchId!,
        entityType,
        req.body,
        req.user!.userId
      );
      res.json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  }

  async updateAutoApproveThreshold(req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await approvalSettingsService.updateAutoApproveThreshold(
        req.tenantId!,
        req.branchId!,
        req.body,
        req.user!.userId
      );
      res.json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  }

  async updateEscalationSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await approvalSettingsService.updateEscalationSettings(
        req.tenantId!,
        req.branchId!,
        req.body,
        req.user!.userId
      );
      res.json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  }
}

export const approvalSettingsController = new ApprovalSettingsController();

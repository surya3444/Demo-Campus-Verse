import { Request, Response, NextFunction } from 'express';
import {
  approvalService,
  ApprovalListParams,
  ApprovalEntityType,
  ApprovalAction,
} from './approval.service';
import { success } from '../../utils/response';

class ApprovalController {
  async getPendingApprovals(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const result = await approvalService.getPendingApprovals(req.tenantId!, req.branchId, {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      });

      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async getApprovalHistory(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const params: ApprovalListParams = {
        entityType: req.query.entityType as ApprovalEntityType,
        action: req.query.action as ApprovalAction,
        fromDate: req.query.fromDate as string,
        toDate: req.query.toDate as string,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      };

      const result = await approvalService.getApprovalHistory(req.tenantId!, req.branchId, params);
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async undoConcessionApproval(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const id = req.params.id as string;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Reason is required' },
        });
      }

      const result = await approvalService.undoConcessionApproval(
        req.tenantId!,
        req.branchId,
        id,
        reason,
        req.user!.userId
      );

      success(res, result, undefined, 'Concession approval undone successfully');
    } catch (error) {
      next(error);
    }
  }

  async undoFeeCancellation(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const id = req.params.id as string;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Reason is required' },
        });
      }

      const result = await approvalService.undoFeeCancellation(
        req.tenantId!,
        req.branchId,
        id,
        reason,
        req.user!.userId
      );

      success(res, result, undefined, 'Fee cancellation undone successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const approvalController = new ApprovalController();

import { Request, Response, NextFunction } from 'express';
import { approvalRequestService, ApprovalRequestListParams } from './approvalRequest.service';
import { success, created } from '../../utils/response';

class ApprovalRequestController {
  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const params: ApprovalRequestListParams = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        type: req.query.type as 'cancellation' | 'refund' | undefined,
        status: req.query.status as 'pending' | 'approved' | 'rejected' | undefined,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc',
      };

      const result = await approvalRequestService.findAll(req.tenantId!, req.branchId, params);
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const request = await approvalRequestService.findById(req.tenantId!, req.params.id as string);
      success(res, request);
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

      const request = await approvalRequestService.create(
        req.tenantId!,
        req.branchId,
        req.body,
        req.user!.userId
      );
      created(res, request, 'Approval request submitted successfully');
    } catch (error) {
      next(error);
    }
  }

  async approve(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const { remarks } = req.body;

      const request = await approvalRequestService.approve(
        req.tenantId!,
        req.branchId,
        req.params.id as string,
        remarks || '',
        req.user!.userId
      );
      success(res, request, undefined, 'Request approved and processed successfully');
    } catch (error) {
      next(error);
    }
  }

  async reject(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const { remarks } = req.body;

      if (!remarks) {
        return res.status(400).json({
          success: false,
          error: { code: 'REMARKS_REQUIRED', message: 'Rejection remarks are required' },
        });
      }

      const request = await approvalRequestService.reject(
        req.tenantId!,
        req.branchId,
        req.params.id as string,
        remarks,
        req.user!.userId
      );
      success(res, request, undefined, 'Request rejected');
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

      const stats = await approvalRequestService.getStats(req.tenantId!, req.branchId);
      success(res, stats);
    } catch (error) {
      next(error);
    }
  }
}

export const approvalRequestController = new ApprovalRequestController();

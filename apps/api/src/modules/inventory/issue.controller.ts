import { Request, Response, NextFunction } from 'express';
import { issueService, IssueListParams } from './issue.service';
import { success, created } from '../../utils/response';

class IssueController {
  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const params: IssueListParams = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        search: req.query.search as string,
        status: req.query.status as string,
        userId: req.query.userId as string,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc',
      };

      const result = await issueService.findAll(req.tenantId!, req.branchId, params);
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getMyAssets(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const assets = await issueService.getMyAssets(req.tenantId!, req.branchId, req.user!.userId);
      success(res, assets);
    } catch (error) {
      next(error);
    }
  }

  async issue(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const issue = await issueService.issueAsset(
        req.tenantId!,
        req.branchId,
        req.body,
        req.user!.userId,
        req.user!.email || 'Admin'
      );
      created(res, issue, 'Asset issued successfully');
    } catch (error) {
      next(error);
    }
  }

  async returnAsset(req: Request, res: Response, next: NextFunction) {
    try {
      const issue = await issueService.returnAsset(
        req.tenantId!,
        req.params.id as string,
        req.body
      );
      success(res, issue, undefined, 'Asset returned successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const issueController = new IssueController();

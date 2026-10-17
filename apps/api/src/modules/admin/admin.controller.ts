import { Request, Response, NextFunction } from 'express';
import { adminService } from './admin.service';
import { success } from '../../utils/response';
import {
  SuperAdminLoginInput,
  RejectOrganizationInput,
  ApproveOrganizationInput,
} from '@campus-verse/shared';

class AdminController {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body as SuperAdminLoginInput;

      const result = await adminService.login(email, password);

      // Set refresh token as httpOnly cookie
      res.cookie('adminRefreshToken', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/api/v1/admin',
      });

      success(res, {
        admin: result.admin,
        accessToken: result.accessToken,
        expiresIn: result.expiresIn,
      });
    } catch (error) {
      next(error);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const refreshToken = req.cookies.adminRefreshToken || req.body.refreshToken;

      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          error: { code: 'NO_REFRESH_TOKEN', message: 'Refresh token not provided' },
        });
      }

      const result = await adminService.refreshAccessToken(refreshToken);

      success(res, {
        accessToken: result.accessToken,
        expiresIn: result.expiresIn,
      });
    } catch (error) {
      res.clearCookie('adminRefreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/api/v1/admin',
      });
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const refreshToken = req.cookies.adminRefreshToken || req.body.refreshToken;

      if (refreshToken && req.superAdmin) {
        await adminService.logout(req.superAdmin.adminId, refreshToken);
      }

      res.clearCookie('adminRefreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/api/v1/admin',
      });

      success(res, { message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  }

  async getOrganizations(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, page, limit } = req.query;

      const result = await adminService.getOrganizations({
        status: status as string | undefined,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });

      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getOrganization(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;

      const result = await adminService.getOrganizationById(id);

      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async approveOrganization(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { approvedModules, subscriptionPlan } = (req.body ||
        {}) as Partial<ApproveOrganizationInput>;

      if (!req.superAdmin) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
        });
      }

      await adminService.approveOrganization(
        id,
        req.superAdmin.adminId,
        approvedModules,
        subscriptionPlan
      );

      success(res, { message: 'Organization approved successfully' });
    } catch (error) {
      next(error);
    }
  }

  async rejectOrganization(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { reason, canReapply, reapplyAfterDays, comments } =
        req.body as RejectOrganizationInput & {
          canReapply?: boolean;
          reapplyAfterDays?: number;
          comments?: string;
        };

      if (!req.superAdmin) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
        });
      }

      await adminService.rejectOrganization(id, req.superAdmin.adminId, reason, {
        canReapply,
        reapplyAfterDays,
        comments,
      });

      success(res, { message: 'Organization rejected' });
    } catch (error) {
      next(error);
    }
  }

  async archiveOrganization(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;

      if (!req.superAdmin) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
        });
      }

      await adminService.archiveOrganization(id, req.superAdmin.adminId);

      success(res, { message: 'Organization archived' });
    } catch (error) {
      next(error);
    }
  }

  async unarchiveOrganization(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;

      if (!req.superAdmin) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
        });
      }

      await adminService.unarchiveOrganization(id, req.superAdmin.adminId);

      success(res, { message: 'Organization unarchived' });
    } catch (error) {
      next(error);
    }
  }

  async deleteOrganization(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { confirmName } = req.body as { confirmName: string };

      if (!req.superAdmin) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
        });
      }

      const result = await adminService.deleteOrganization(id, req.superAdmin.adminId, confirmName);

      success(res, result, undefined, 'Organization permanently deleted');
    } catch (error) {
      next(error);
    }
  }

  async getArchivedOrganizations(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, search } = req.query;

      const result = await adminService.getArchivedOrganizations({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        search: search as string | undefined,
      });

      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async updateReapplySettings(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { canReapply, reapplyAfterDays } = req.body as {
        canReapply: boolean;
        reapplyAfterDays?: number;
      };

      if (!req.superAdmin) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
        });
      }

      await adminService.updateReapplySettings(
        id,
        req.superAdmin.adminId,
        canReapply,
        reapplyAfterDays
      );

      success(res, { message: 'Reapply settings updated' });
    } catch (error) {
      next(error);
    }
  }

  async getDashboardStats(_req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await adminService.getDashboardStats();

      success(res, stats);
    } catch (error) {
      next(error);
    }
  }

  async getPlatformStatistics(_req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await adminService.getPlatformStatistics();

      success(res, stats);
    } catch (error) {
      next(error);
    }
  }

  async updateOrganizationModules(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { modules } = req.body as { modules: string[] };

      if (!req.superAdmin) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
        });
      }

      if (!modules || !Array.isArray(modules)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Modules array is required' },
        });
      }

      await adminService.updateOrganizationModules(id, req.superAdmin.adminId, modules);

      success(res, { message: 'Organization modules updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  async migrateRoleLevels(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await adminService.migrateRoleLevels();

      success(res, {
        message: `Migration completed. Updated ${result.updated} roles.`,
        details: result.roles,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const adminController = new AdminController();

import { Request, Response, NextFunction } from 'express';
import { adminService } from '../modules/admin/admin.service';
import { SuperAdminTokenPayload } from '@campus-verse/shared';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      superAdmin?: SuperAdminTokenPayload;
    }
  }
}

export async function authenticateSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: {
          code: 'NO_TOKEN',
          message: 'No authentication token provided',
        },
      });
      return;
    }

    const token = authHeader.substring(7);

    const payload = adminService.verifyAccessToken(token);

    if (!payload.isSuperAdmin) {
      res.status(403).json({
        success: false,
        error: {
          code: 'NOT_SUPER_ADMIN',
          message: 'Access denied. Super admin privileges required.',
        },
      });
      return;
    }

    req.superAdmin = payload;
    next();
  } catch (error) {
    if (error instanceof Error && 'code' in error) {
      const apiError = error as unknown as { code: string; message: string; statusCode?: number };
      res.status(apiError.statusCode || 401).json({
        success: false,
        error: {
          code: apiError.code,
          message: apiError.message,
        },
      });
      return;
    }

    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token',
      },
    });
  }
}

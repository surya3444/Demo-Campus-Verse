import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getRedis } from '../config/redis';
import { ApiError } from './errorHandler';
import { env } from '../config/env';
import { getBranchInstitutionMap } from './scope';
import { TokenPayload } from '@campus-verse/shared';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: TokenPayload;
      tenantId?: string;
      branchId?: string;
      /** Set for department-scoped users; services narrow academic queries via middleware/scope.ts. */
      scopeDepartmentIds?: string[];
    }
  }
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new ApiError('AUTH_TOKEN_MISSING', 'No token provided', 401);
    }

    const token = authHeader.split(' ')[1];

    // Check if token is blacklisted (graceful degradation if Redis is down)
    try {
      const redis = getRedis();
      const isBlacklisted = await redis.get(`blacklist:${token}`);
      if (isBlacklisted) {
        throw new ApiError('AUTH_TOKEN_INVALID', 'Token is invalid', 401);
      }
    } catch (redisError) {
      if (redisError instanceof ApiError) throw redisError;
      // Redis unavailable - skip blacklist check, rely on JWT expiry
    }

    // Verify token
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload;

    // Check token type
    if (payload.type !== 'access') {
      throw new ApiError('AUTH_TOKEN_INVALID', 'Invalid token type', 401);
    }

    // Attach to request
    req.user = payload;
    req.tenantId = payload.tenantId;

    // Get branch from header if provided
    const branchId = req.headers['x-branch-id'] as string;
    if (branchId) {
      const scope = payload.accessScope;
      if (scope.type === 'institution') {
        // Institution-scoped users may enter any branch of their institutions
        // — resolved via a cached branch→institution map, so the grant
        // survives an institution adding a campus with zero user edits.
        const branchInstitutions = await getBranchInstitutionMap(payload.tenantId);
        const hosted = branchInstitutions.get(branchId) ?? [];
        const granted = scope.institutionIds ?? [];
        // Fail closed on an empty grant — an institution-scoped user with no
        // institutions must not fall through to every campus.
        if (granted.length === 0 || !hosted.some((id) => granted.includes(id))) {
          throw new ApiError('AUTH_UNAUTHORIZED', 'No access to this branch', 403);
        }
      } else if (scope.type !== 'global' && !scope.branchIds.includes(branchId)) {
        throw new ApiError('AUTH_UNAUTHORIZED', 'No access to this branch', 403);
      }
      req.branchId = branchId;

      if (scope.type === 'department' && scope.departmentIds?.length) {
        req.scopeDepartmentIds = scope.departmentIds;
      }
    }

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(new ApiError('AUTH_TOKEN_EXPIRED', 'Token expired', 401));
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(new ApiError('AUTH_TOKEN_INVALID', 'Invalid token', 401));
    } else {
      next(error);
    }
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return next();
  }

  authenticate(req, _res, next);
}

import rateLimit from 'express-rate-limit';
import type { Request } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import type { TokenPayload } from '@campus-verse/shared';

/**
 * Signed-in callers get their own budget; everyone else shares one per IP.
 * Per-IP alone throttles a whole campus behind one NAT as if it were one user.
 * The token is verified (cheap HMAC) so random bearer strings can't mint
 * fresh buckets to dodge the limit.
 */
export function rateLimitKey(req: Request): string {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const { userId } = jwt.verify(header.slice(7), env.JWT_ACCESS_SECRET) as TokenPayload;
      if (userId) return `user:${userId}`;
    } catch {
      // expired/invalid — fall through to the IP bucket
    }
  }
  return `ip:${req.ip ?? 'unknown'}`;
}

// General API rate limit
export const apiRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  keyGenerator: rateLimitKey,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limit for auth endpoints
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_LOGIN_ATTEMPTS',
      message: 'Too many login attempts, please try again after 15 minutes',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// AI Assistant chat limit. Each chat turn can fan out into several model calls
// + tool executions, so keep this tighter than the general API limit. Keyed per
// user so one tenant's heavy user can't exhaust another's budget.
export const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  keyGenerator: (req) => req.user?.userId ?? req.ip ?? 'anonymous',
  message: {
    success: false,
    error: {
      code: 'AI_RATE_LIMIT_EXCEEDED',
      message: 'You are sending messages too quickly. Please wait a moment and try again.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Bulk operation limit
export const bulkOperationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: {
    success: false,
    error: {
      code: 'BULK_OPERATION_LIMIT',
      message: 'Too many bulk operations, please try again later',
    },
  },
});

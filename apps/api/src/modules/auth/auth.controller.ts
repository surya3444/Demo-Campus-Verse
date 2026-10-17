import { Request, Response, NextFunction, CookieOptions } from 'express';
import { authService } from './auth.service';
import { success, created } from '../../utils/response';
import { ApiError } from '../../middleware/errorHandler';
import { logger } from '../../lib/logger';
import { env } from '../../config/env';
import { parseDurationSeconds } from '../../utils/dates';
import {
  LoginInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  ChangePasswordInput,
  UpdateProfileInput,
  OrganizationSignupInput,
  VerifyEmailInput,
} from '@campus-verse/shared';
import { defaultModulesFor } from '@campus-verse/shared/constants';

// Single source of truth for the refresh-token cookie. `set` and `clear` MUST
// use identical attributes or the browser silently refuses to clear it — so they
// derive from one base. In production the web app and API live on different
// subdomains and may be fully cross-site; the cookie must therefore be
// SameSite=None;Secure to be sent on the cross-origin XHR to /auth/refresh.
// SameSite=Lax silently drops the cookie on that request in any cross-site
// context — the classic "token expired and refresh never works" bug. Locally
// (http, same-site) we keep Lax + insecure, since None requires Secure.
const REFRESH_COOKIE_NAME = 'refreshToken';
// The cookie must live exactly as long as the refresh token it carries
// (JWT_REFRESH_EXPIRY) — if it were shorter, the browser would delete it first
// and every later refresh would fail with NO_REFRESH_TOKEN even though the
// token was still valid. It is re-set on every rotation, so this is a sliding
// window: only JWT_REFRESH_EXPIRY of *inactivity* ends a session.
const REFRESH_COOKIE_MAX_AGE =
  parseDurationSeconds(env.JWT_REFRESH_EXPIRY, 7 * 24 * 60 * 60) * 1000;
const refreshCookieBase: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
  path: '/',
};

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    ...refreshCookieBase,
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieBase);
}

class AuthController {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body as LoginInput;

      const deviceInfo = {
        userAgent: req.headers['user-agent'],
        ip: req.ip || req.socket.remoteAddress,
      };

      const result = await authService.login(email, password, deviceInfo);

      // Set refresh token as httpOnly cookie (for web clients)
      setRefreshCookie(res, result.tokens.refreshToken);

      // Include refreshToken in body for mobile clients that can't read httpOnly cookies
      success(res, {
        user: result.user,
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        expiresIn: result.tokens.expiresIn,
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

      if (refreshToken && req.user) {
        const authHeader = req.headers.authorization;
        const accessToken = authHeader?.startsWith('Bearer ')
          ? authHeader.split(' ')[1]
          : undefined;
        await authService.logout(req.user.userId, refreshToken, accessToken);
      }

      clearRefreshCookie(res);

      success(res, { message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  }

  async logoutAll(req: Request, res: Response, next: NextFunction) {
    try {
      if (req.user) {
        await authService.logoutAllDevices(req.user.userId);
      }

      clearRefreshCookie(res);

      success(res, { message: 'Logged out from all devices' });
    } catch (error) {
      next(error);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'NO_REFRESH_TOKEN',
            message: 'Refresh token not provided',
          },
        });
      }

      const result = await authService.refreshAccessToken(refreshToken);

      // The refresh token is rotated on every call (see authService).
      // Re-setting the cookie with the NEW token both delivers the rotated
      // token and restarts the cookie's maxAge clock — so active users are
      // never booted, and only JWT_REFRESH_EXPIRY of inactivity ends a session.
      if (req.cookies.refreshToken) {
        setRefreshCookie(res, result.refreshToken);
      }

      // refreshToken in the body is for mobile clients (no cookie jar) —
      // they must persist the rotated token and send it on the next refresh.
      success(res, {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn,
      });
    } catch (error) {
      // Diagnostic: record WHY every refresh was rejected so "random logout"
      // reports map to a concrete reason in the droplet logs. hadCookie tells
      // apart "browser never sent the cookie" from "token present but invalid".
      const code = error instanceof ApiError ? error.code : 'UNEXPECTED';
      logger.warn(
        {
          code,
          hadCookie: !!req.cookies?.refreshToken,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        },
        'Token refresh rejected'
      );
      // Clear the cookie ONLY on genuine auth failures (expired/revoked/invalid
      // token). A transient failure (DB hiccup, unexpected exception → 5xx)
      // must NOT destroy the refresh token — that would turn a one-off blip
      // into a forced logout on the next refresh attempt.
      if (error instanceof ApiError && error.statusCode === 401) {
        clearRefreshCookie(res);
      }
      next(error);
    }
  }

  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body as ForgotPasswordInput;

      await authService.forgotPassword(email);

      // Always return success to prevent email enumeration
      success(res, {
        message: 'If an account exists with this email, a password reset link has been sent',
      });
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { token, password } = req.body as ResetPasswordInput;

      await authService.resetPassword(token, password);

      success(res, { message: 'Password reset successfully' });
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { currentPassword, newPassword } = req.body as ChangePasswordInput;

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Not authenticated',
          },
        });
      }

      await authService.changePassword(req.user.userId, currentPassword, newPassword);

      success(res, { message: 'Password changed successfully' });
    } catch (error) {
      next(error);
    }
  }

  async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Not authenticated',
          },
        });
      }

      const profile = await authService.getProfile(req.user.userId);

      success(res, profile);
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Not authenticated',
          },
        });
      }

      const data = req.body as UpdateProfileInput;

      await authService.updateProfile(req.user.userId, {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        avatar: data.avatar,
        preferences: data.preferences,
      });

      const profile = await authService.getProfile(req.user.userId);

      success(res, profile);
    } catch (error) {
      next(error);
    }
  }

  async uploadAvatar(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
        });
      }

      // multer-s3 attaches `location` (full S3 URL) and `key` to req.file
      const file = (req as Request & { file?: { location?: string; key?: string } }).file;
      if (!file?.location) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_FILE', message: 'No file uploaded' },
        });
      }

      await authService.updateProfile(req.user.userId, { avatar: file.location });
      const profile = await authService.getProfile(req.user.userId);

      success(res, { avatarUrl: file.location, user: profile }, undefined, 'Avatar updated');
    } catch (error) {
      next(error);
    }
  }

  // ============ Organization Signup ============

  async signup(req: Request, res: Response, next: NextFunction) {
    try {
      const data = req.body as OrganizationSignupInput;

      const result = await authService.createOrganizationSignup({
        organizationName: data.organizationName,
        institutionType: data.institutionType,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        password: data.password,
        requestedModules: data.requestedModules || defaultModulesFor(data.institutionType),
      });

      created(res, result, 'Please check your email to verify your account');
    } catch (error) {
      next(error);
    }
  }

  async verifyEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = req.body as VerifyEmailInput;

      const result = await authService.verifyEmail(token);

      success(
        res,
        result,
        undefined,
        'Email verified successfully. Your organization is now pending approval.'
      );
    } catch (error) {
      next(error);
    }
  }

  async resendVerification(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body as { email: string };

      await authService.resendVerificationEmail(email);

      success(res, { message: 'If a pending signup exists, a verification email has been sent' });
    } catch (error) {
      next(error);
    }
  }

  async getSignupStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.query as { email: string };

      if (!email) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Email is required' },
        });
      }

      const result = await authService.getSignupByEmail(email);

      if (!result) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Signup not found' },
        });
      }

      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async canReapply(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.query as { email: string };

      if (!email) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Email is required' },
        });
      }

      const result = await authService.canReapply(email);
      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async reapply(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        email,
        organizationName,
        institutionType,
        firstName,
        lastName,
        phone,
        password,
        requestedModules,
      } = req.body as {
        email: string;
        organizationName?: string;
        institutionType?: 'school' | 'college' | 'university';
        firstName?: string;
        lastName?: string;
        phone?: string;
        password?: string;
        requestedModules?: string[];
      };

      if (!email) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Email is required' },
        });
      }

      const result = await authService.reapplyOrganizationSignup(email, {
        organizationName,
        institutionType,
        firstName,
        lastName,
        phone,
        password,
        requestedModules,
      });

      success(res, result, undefined, 'Please check your email to verify your account');
    } catch (error) {
      next(error);
    }
  }

  // Switch organization
  async switchOrganization(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
        });
      }

      const { tenantId } = req.body as { tenantId: string };

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Target organization ID is required' },
        });
      }

      const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          error: { code: 'NO_REFRESH_TOKEN', message: 'Refresh token not provided' },
        });
      }

      const deviceInfo = {
        userAgent: req.headers['user-agent'],
        ip: req.ip || req.socket.remoteAddress,
      };

      const result = await authService.switchOrganization(
        req.user.email,
        tenantId,
        refreshToken,
        deviceInfo
      );

      // Set new refresh token as httpOnly cookie
      setRefreshCookie(res, result.tokens.refreshToken);

      success(res, {
        user: result.user,
        accessToken: result.tokens.accessToken,
        expiresIn: result.tokens.expiresIn,
      });
    } catch (error) {
      next(error);
    }
  }

  // Create Razorpay order for new organization
  async createOrganizationOrder(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
        });
      }

      const { organizationName, institutionType } = req.body as {
        organizationName: string;
        institutionType: 'school' | 'college' | 'university';
      };

      if (!organizationName || !institutionType) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Organization name and institution type are required',
          },
        });
      }

      const result = await authService.createOrganizationOrder(
        req.user.userId,
        organizationName,
        institutionType
      );

      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  // Verify payment and create organization
  async verifyOrganizationPayment(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
        });
      }

      const { orderId, paymentId, signature, pendingOrgId } = req.body as {
        orderId: string;
        paymentId: string;
        signature: string;
        pendingOrgId: string;
      };

      if (!orderId || !paymentId || !signature || !pendingOrgId) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Missing required payment details' },
        });
      }

      const result = await authService.verifyOrganizationPayment(
        req.user.userId,
        pendingOrgId,
        orderId,
        paymentId,
        signature
      );

      created(res, result, 'Organization created successfully');
    } catch (error) {
      next(error);
    }
  }

  // Legacy: Create organization without payment (keeping for backward compatibility)
  async createOrganization(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
        });
      }

      const { organizationName, institutionType } = req.body as {
        organizationName: string;
        institutionType: 'school' | 'college' | 'university';
      };

      if (!organizationName || !institutionType) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Organization name and institution type are required',
          },
        });
      }

      const result = await authService.createOrganizationForUser(
        req.user.userId,
        req.user.tenantId,
        organizationName,
        institutionType
      );

      created(res, result, 'Organization created successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();

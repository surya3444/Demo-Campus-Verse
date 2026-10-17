import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import multerS3 from 'multer-s3';
import { nanoid } from 'nanoid';
import path from 'path';
// TEMP: auth rate limiter disabled for dev. Restore before going to prod.
// import { authRateLimiter } from '../../middleware/rateLimit';
const authRateLimiter = (_req: Request, _res: Response, next: NextFunction) => next();
import { authenticate } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { authController } from './auth.controller';
import { requireS3Configured } from '../upload/upload.middleware';
import { getS3Client, getBucketName } from '../../config/s3';
import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  updateProfileSchema,
  organizationSignupSchema,
  verifyEmailSchema,
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_SIZE,
} from '@campus-verse/shared';

const router: ReturnType<typeof Router> = Router();

// Avatar upload middleware — self-contained, separate from the entity-based
// upload pipeline. Uploads to S3 under `${tenantId}/users/${userId}/avatar/`.
let avatarUploadInstance: multer.Multer | null = null;
function getAvatarUpload() {
  if (!avatarUploadInstance) {
    avatarUploadInstance = multer({
      storage: multerS3({
        s3: getS3Client(),
        bucket: getBucketName(),
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: (req, file, cb) => {
          const expressReq = req as Request;
          const tenantId = expressReq.tenantId;
          const userId = expressReq.user?.userId;
          const ext = path.extname(file.originalname);
          const key = `${tenantId}/users/${userId}/avatar/${nanoid(12)}${ext}`;
          cb(null, key);
        },
      }),
      limits: { fileSize: MAX_IMAGE_SIZE },
      fileFilter: (_req, file, cb) => {
        if ((ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Only JPEG, PNG, WebP, or GIF images are allowed'));
        }
      },
    });
  }
  return avatarUploadInstance;
}
const avatarUploadSingle = (req: Request, res: Response, next: NextFunction) =>
  getAvatarUpload().single('file')(req, res, next);

// ============ Organization Signup (Public) ============
router.post(
  '/signup',
  authRateLimiter,
  validateBody(organizationSignupSchema),
  authController.signup
);
router.post('/verify-email', validateBody(verifyEmailSchema), authController.verifyEmail);
router.post(
  '/resend-verification',
  authRateLimiter,
  validateBody(forgotPasswordSchema), // Reuses email validation
  authController.resendVerification
);
router.get('/signup-status', authController.getSignupStatus);
router.get('/can-reapply', authController.canReapply);
router.post('/reapply', authRateLimiter, authController.reapply);

// ============ Public Auth Routes ============
router.post('/login', authRateLimiter, validateBody(loginSchema), authController.login);
router.post('/refresh', authController.refresh);
router.post(
  '/forgot-password',
  authRateLimiter,
  validateBody(forgotPasswordSchema),
  authController.forgotPassword
);
router.post('/reset-password', validateBody(resetPasswordSchema), authController.resetPassword);

// ============ Protected Routes ============
router.post('/logout', authenticate, authController.logout);
router.post('/logout-all', authenticate, authController.logoutAll);
router.post(
  '/change-password',
  authenticate,
  validateBody(changePasswordSchema),
  authController.changePassword
);
router.get('/me', authenticate, authController.getProfile);
router.put('/me', authenticate, validateBody(updateProfileSchema), authController.updateProfile);
router.post(
  '/me/avatar',
  authenticate,
  requireS3Configured,
  avatarUploadSingle,
  authController.uploadAvatar
);

// Switch organization
router.post('/switch-organization', authenticate, authController.switchOrganization);

// Add new organization with payment flow
router.post('/organizations/create-order', authenticate, authController.createOrganizationOrder);
router.post(
  '/organizations/verify-payment',
  authenticate,
  authController.verifyOrganizationPayment
);

// Legacy: Create organization without payment (for testing/admin use)
router.post('/organizations', authenticate, authController.createOrganization);

export default router;

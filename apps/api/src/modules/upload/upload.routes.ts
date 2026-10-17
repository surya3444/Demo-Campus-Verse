import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireBranch, requireAnyPermission } from '../../middleware/rbac';
import { validateBody, validateParams } from '../../middleware/validate';
import { ApiError } from '../../middleware/errorHandler';
import { uploadController } from './upload.controller';
import { requireS3Configured, imageUpload, documentUpload } from './upload.middleware';
import {
  presignedUrlRequestSchema,
  confirmUploadRequestSchema,
  entityParamsSchema,
} from '@campus-verse/shared/schemas';

const router: ReturnType<typeof Router> = Router();

// Entity type → permission mapping. Both singular and plural keys are
// supported because callers historically use both forms.
const ENTITY_PERMISSION_MAP: Record<
  string,
  { module: string; viewAction: string; editAction: string; deleteAction: string }
> = {
  student: {
    module: 'students.details',
    viewAction: 'view',
    editAction: 'edit',
    deleteAction: 'edit',
  },
  students: {
    module: 'students.details',
    viewAction: 'view',
    editAction: 'edit',
    deleteAction: 'edit',
  },
  staff: { module: 'hr.staff', viewAction: 'view', editAction: 'edit', deleteAction: 'delete' },
  'health-record': {
    module: 'health.records',
    viewAction: 'view',
    editAction: 'edit',
    deleteAction: 'delete',
  },
  admission: {
    module: 'admissions.applications',
    viewAction: 'view',
    editAction: 'edit',
    deleteAction: 'edit',
  },
  admissions: {
    module: 'admissions.applications',
    viewAction: 'view',
    editAction: 'edit',
    deleteAction: 'edit',
  },
  organization: {
    module: 'organization.settings',
    viewAction: 'view',
    editAction: 'edit',
    deleteAction: 'edit',
  },
  certificate: {
    module: 'certificates.requests',
    viewAction: 'view',
    editAction: 'edit',
    deleteAction: 'delete',
  },
  // Course lessons — used for video and attachment uploads from the
  // courses → modules → lessons feature.
  lesson: {
    module: 'courses.lessons',
    viewAction: 'view',
    editAction: 'edit',
    deleteAction: 'delete',
  },
  lessons: {
    module: 'courses.lessons',
    viewAction: 'view',
    editAction: 'edit',
    deleteAction: 'delete',
  },
  // Course-level uploads (intro/promo video, cover image).
  course: {
    module: 'courses.courses',
    viewAction: 'view',
    editAction: 'edit',
    deleteAction: 'delete',
  },
  courses: {
    module: 'courses.courses',
    viewAction: 'view',
    editAction: 'edit',
    deleteAction: 'delete',
  },
  // Campus Feed — image uploads for posts
  feed: {
    module: 'campusFeed.posts',
    viewAction: 'view',
    editAction: 'create',
    deleteAction: 'create',
  },
};

/**
 * Middleware to check permission based on entityType
 */
function requireEntityPermission(action: 'view' | 'edit' | 'delete') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const entityType = req.params.entityType || req.body?.entityType;

    if (!entityType) {
      throw new ApiError('VALIDATION_ERROR', 'Entity type is required', 400);
    }

    const permissionConfig = ENTITY_PERMISSION_MAP[entityType];

    if (!permissionConfig) {
      throw new ApiError('VALIDATION_ERROR', `Invalid entity type: ${entityType}`, 400);
    }

    const { module } = permissionConfig;
    const actionName = permissionConfig[`${action}Action`] || action;

    // Check if user has the required permission
    if (!req.user) {
      throw new ApiError('AUTH_UNAUTHORIZED', 'Authentication required', 401);
    }

    const { permissions } = req.user;
    if (!permissions) {
      throw new ApiError('AUTH_UNAUTHORIZED', 'No permissions found', 403);
    }

    const modulePermissions = permissions[module];
    if (!modulePermissions || !modulePermissions.includes(actionName)) {
      throw new ApiError(
        'AUTH_UNAUTHORIZED',
        `You don't have permission to ${action} files for ${entityType}`,
        403
      );
    }

    next();
  };
}

// All routes require authentication and S3 configuration
router.use(authenticate);
router.use(requireS3Configured);

// Server-side image upload (multer-s3)
router.post(
  '/image/:entityType/:entityId',
  requireBranch,
  validateParams(entityParamsSchema),
  requireEntityPermission('edit'),
  imageUpload.single('file'),
  uploadController.uploadImage
);

// Server-side document upload (multer-s3)
router.post(
  '/document/:entityType/:entityId',
  requireBranch,
  validateParams(entityParamsSchema),
  requireEntityPermission('edit'),
  documentUpload.single('file'),
  uploadController.uploadDocument
);

// Get presigned URL for client-side upload
router.post(
  '/presigned-url',
  requireBranch,
  validateBody(presignedUrlRequestSchema),
  requireEntityPermission('edit'),
  uploadController.getPresignedUrl
);

// Confirm client-side upload completed
router.post(
  '/confirm',
  validateBody(confirmUploadRequestSchema),
  requireEntityPermission('edit'),
  uploadController.confirmUpload
);

// Get uploads for an entity
router.get(
  '/entity/:entityType/:entityId',
  validateParams(entityParamsSchema),
  requireEntityPermission('view'),
  uploadController.getUploadsByEntity
);

// Get signed download URL for a file
router.get(
  '/:key(*)/signed-url',
  requireAnyPermission([
    { module: 'students.details', action: 'view' },
    { module: 'hr.staff', action: 'view' },
    { module: 'health.records', action: 'view' },
    { module: 'admissions.applications', action: 'view' },
    { module: 'certificates.requests', action: 'view' },
    { module: 'courses.lessons', action: 'view' },
    { module: 'courses.courses', action: 'view' },
  ]),
  uploadController.getSignedDownloadUrl
);

// Delete a file - requires entity context in query params
router.delete(
  '/:key(*)',
  requireAnyPermission([
    { module: 'students.details', action: 'edit' },
    { module: 'hr.staff', action: 'delete' },
    { module: 'health.records', action: 'delete' },
    { module: 'admissions.applications', action: 'edit' },
    { module: 'certificates.requests', action: 'delete' },
    { module: 'courses.lessons', action: 'delete' },
    { module: 'courses.courses', action: 'edit' },
  ]),
  uploadController.deleteFile
);

export default router;

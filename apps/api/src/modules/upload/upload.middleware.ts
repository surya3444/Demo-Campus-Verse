import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import multerS3 from 'multer-s3';
import { nanoid } from 'nanoid';
import path from 'path';
import { getS3Client, getBucketName, isS3Configured } from '../../config/s3';
import { ApiError } from '../../middleware/errorHandler';
import {
  ALLOWED_IMAGE_TYPES,
  ALLOWED_DOCUMENT_TYPES,
  MAX_IMAGE_SIZE,
  MAX_DOCUMENT_SIZE,
} from '@campus-verse/shared/schemas';
import { UploadCategory, EntityType } from '@campus-verse/shared';

function getS3Storage(category: UploadCategory) {
  return multerS3({
    s3: getS3Client(),
    bucket: getBucketName(),
    contentType: multerS3.AUTO_CONTENT_TYPE,
    metadata: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, metadata?: Record<string, string>) => void) => {
      cb(null, { originalName: file.originalname });
    },
    key: (req: Request, file: Express.Multer.File, cb: (error: Error | null, key?: string) => void) => {
      const tenantId = req.tenantId;
      const branchId = req.branchId;
      const entityType = req.params.entityType as EntityType;
      const entityId = req.params.entityId;
      const ext = path.extname(file.originalname);
      const uniqueId = nanoid(12);
      const key = `${tenantId}/${branchId}/${entityType}/${entityId}/${category}/${uniqueId}${ext}`;
      cb(null, key);
    },
  });
}

function createLazyUploadMiddleware(
  allowedTypes: readonly string[],
  maxSize: number,
  category: UploadCategory
) {
  // Lazy initialization - only create multer instance when first used
  let upload: multer.Multer | null = null;

  const getUpload = () => {
    if (!upload) {
      upload = multer({
        storage: getS3Storage(category),
        limits: {
          fileSize: maxSize,
        },
        fileFilter: (_req, file, cb) => {
          if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
          } else {
            cb(new ApiError('INVALID_FILE_TYPE', `Allowed types: ${allowedTypes.join(', ')}`, 400));
          }
        },
      });
    }
    return upload;
  };

  return {
    single: (fieldName: string) => (req: Request, res: Response, next: NextFunction) => {
      return getUpload().single(fieldName)(req, res, next);
    },
    array: (fieldName: string, maxCount?: number) => (req: Request, res: Response, next: NextFunction) => {
      return getUpload().array(fieldName, maxCount)(req, res, next);
    },
  };
}

export const imageUpload = createLazyUploadMiddleware(
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_SIZE,
  'photo'
);

export const documentUpload = createLazyUploadMiddleware(
  ALLOWED_DOCUMENT_TYPES,
  MAX_DOCUMENT_SIZE,
  'document'
);

export function requireS3Configured(_req: Request, res: Response, next: NextFunction) {
  if (!isS3Configured()) {
    return res.status(503).json({
      success: false,
      error: {
        code: 'S3_NOT_CONFIGURED',
        message: 'File storage is not configured',
      },
    });
  }
  next();
}

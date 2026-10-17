import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import multerS3 from 'multer-s3';
import { nanoid } from 'nanoid';
import path from 'path';
import { getS3Client, getBucketName } from '../../config/s3';
import { ApiError } from '../../middleware/errorHandler';
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE } from '@campus-verse/shared/schemas';

// Blog images are global (not tenant-scoped), so they live under a flat `blog/`
// prefix rather than the tenant/branch/entity path used by the upload module.
let upload: multer.Multer | null = null;

function getUpload(): multer.Multer {
  if (!upload) {
    upload = multer({
      storage: multerS3({
        s3: getS3Client(),
        bucket: getBucketName(),
        contentType: multerS3.AUTO_CONTENT_TYPE,
        metadata: (_req, file, cb) => cb(null, { originalName: file.originalname }),
        key: (_req, file, cb) => {
          const ext = path.extname(file.originalname);
          cb(null, `blog/${nanoid(12)}${ext}`);
        },
      }),
      limits: { fileSize: MAX_IMAGE_SIZE },
      fileFilter: (_req, file, cb) => {
        if ((ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new ApiError(
              'INVALID_FILE_TYPE',
              `Allowed types: ${ALLOWED_IMAGE_TYPES.join(', ')}`,
              400
            )
          );
        }
      },
    });
  }
  return upload;
}

/** multer-s3 single-file middleware for blog cover/inline images (field name "file"). */
export const blogImageUpload =
  (fieldName: string) => (req: Request, res: Response, next: NextFunction) =>
    getUpload().single(fieldName)(req, res, next);

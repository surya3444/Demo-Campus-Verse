import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import multerS3 from 'multer-s3';
import { nanoid } from 'nanoid';
import path from 'path';
import { getS3Client, getBucketName } from '../../config/s3';
import { ApiError } from '../../middleware/errorHandler';
import { ALLOWED_DOCUMENT_TYPES, MAX_DOCUMENT_SIZE } from '@campus-verse/shared/schemas';

/**
 * Resume uploads are public (anonymous applicants), so they live under a flat
 * `careers/resumes/` prefix rather than the tenant-scoped path.
 */
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
          cb(null, `careers/resumes/${nanoid(16)}${ext}`);
        },
      }),
      limits: { fileSize: MAX_DOCUMENT_SIZE },
      fileFilter: (_req, file, cb) => {
        if ((ALLOWED_DOCUMENT_TYPES as readonly string[]).includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new ApiError(
              'INVALID_FILE_TYPE',
              `Allowed resume types: ${ALLOWED_DOCUMENT_TYPES.join(', ')}`,
              400
            )
          );
        }
      },
    });
  }
  return upload;
}

export const resumeUpload =
  (fieldName: string) => (req: Request, res: Response, next: NextFunction) =>
    getUpload().single(fieldName)(req, res, next);

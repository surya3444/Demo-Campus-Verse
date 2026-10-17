import { Request, Response, NextFunction } from 'express';
import { uploadService } from './upload.service';
import { success, created } from '../../utils/response';
import { MulterS3File } from './upload.types';
import { EntityType, UploadCategory } from '@campus-verse/shared';

class UploadController {
  async uploadImage(req: Request, res: Response, next: NextFunction) {
    try {
      const file = req.file as MulterS3File | undefined;
      if (!file) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_FILE', message: 'No file uploaded' },
        });
      }

      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const entityType = req.params.entityType as EntityType;
      const entityId = req.params.entityId as string;
      const category: UploadCategory = (req.query.category as UploadCategory) || 'photo';

      const uploadedFile = uploadService.buildUploadedFile(
        file,
        entityType,
        entityId,
        category
      );

      // Save record to database
      await uploadService.saveUploadRecord(
        req.tenantId!,
        req.branchId,
        uploadedFile,
        req.user!.userId
      );

      created(res, uploadedFile, 'Image uploaded successfully');
    } catch (error) {
      next(error);
    }
  }

  async uploadDocument(req: Request, res: Response, next: NextFunction) {
    try {
      const file = req.file as MulterS3File | undefined;
      if (!file) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_FILE', message: 'No file uploaded' },
        });
      }

      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const entityType = req.params.entityType as EntityType;
      const entityId = req.params.entityId as string;
      const category: UploadCategory = (req.query.category as UploadCategory) || 'document';

      const uploadedFile = uploadService.buildUploadedFile(
        file,
        entityType,
        entityId,
        category
      );

      // Save record to database
      await uploadService.saveUploadRecord(
        req.tenantId!,
        req.branchId,
        uploadedFile,
        req.user!.userId
      );

      created(res, uploadedFile, 'Document uploaded successfully');
    } catch (error) {
      next(error);
    }
  }

  async getPresignedUrl(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const result = await uploadService.generatePresignedUploadUrl(
        req.tenantId!,
        req.branchId,
        req.body
      );

      success(res, result, undefined, 'Presigned URL generated');
    } catch (error) {
      next(error);
    }
  }

  async confirmUpload(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await uploadService.confirmUpload(
        req.tenantId!,
        req.body.key,
        req.body
      );

      success(res, result, undefined, 'Upload confirmed');
    } catch (error) {
      next(error);
    }
  }

  async getSignedDownloadUrl(req: Request, res: Response, next: NextFunction) {
    try {
      const key = decodeURIComponent(req.params.key as string);
      const result = await uploadService.generateSignedDownloadUrl(req.tenantId!, key);

      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async deleteFile(req: Request, res: Response, next: NextFunction) {
    try {
      const key = decodeURIComponent(req.params.key as string);
      await uploadService.deleteFile(req.tenantId!, key);

      success(res, null, undefined, 'File deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  async getUploadsByEntity(req: Request, res: Response, next: NextFunction) {
    try {
      const entityType = req.params.entityType as EntityType;
      const entityId = req.params.entityId as string;

      const uploads = await uploadService.getUploadsByEntity(
        req.tenantId!,
        entityType,
        entityId
      );

      success(res, uploads);
    } catch (error) {
      next(error);
    }
  }
}

export const uploadController = new UploadController();

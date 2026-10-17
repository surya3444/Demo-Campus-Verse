import { UploadCategory, EntityType } from '@campus-verse/shared';

export interface MulterS3File extends Express.Multer.File {
  key: string;
  location: string;
  bucket: string;
  contentType: string;
}

export interface UploadParams {
  entityType: EntityType;
  entityId: string;
}

export interface UploadMetadata {
  tenantId: string;
  branchId: string;
  entityType: EntityType;
  entityId: string;
  category: UploadCategory;
  uploadedBy: string;
  uploadedAt: Date;
}

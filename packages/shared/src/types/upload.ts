export type UploadCategory = 'photo' | 'document' | 'certificate' | 'id-proof' | 'signature';

export type EntityType = 'students' | 'staff' | 'admissions' | 'organization';

export interface UploadedFile {
  key: string;
  url: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  category: UploadCategory;
  entityType: EntityType;
  entityId: string;
  uploadedAt: Date;
}

export interface PresignedUrlRequest {
  filename: string;
  mimeType: string;
  size: number;
  entityType: EntityType;
  entityId: string;
  category: UploadCategory;
}

export interface PresignedUrlResponse {
  uploadUrl: string;
  key: string;
  expiresAt: Date;
}

export interface ConfirmUploadRequest {
  key: string;
  originalName: string;
  mimeType: string;
  size: number;
}

export interface SignedDownloadUrlResponse {
  url: string;
  expiresAt: Date;
}

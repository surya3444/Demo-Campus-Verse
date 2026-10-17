import { DeleteObjectCommand, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { nanoid } from 'nanoid';
import path from 'path';
import { ObjectId } from 'mongodb';
import { getS3Client, getBucketName } from '../../config/s3';
import { collections } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler';
import { logger } from '../../lib/logger';
import {
  UploadedFile,
  PresignedUrlRequest,
  PresignedUrlResponse,
  ConfirmUploadRequest,
  SignedDownloadUrlResponse,
  EntityType,
  UploadCategory,
} from '@campus-verse/shared';
import { MulterS3File } from './upload.types';

const PRESIGNED_UPLOAD_EXPIRY = 15 * 60; // 15 minutes (videos can be large)
const PRESIGNED_DOWNLOAD_EXPIRY = 60 * 60; // 1 hour

interface UploadDocument {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  key: string;
  url: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  category: UploadCategory;
  entityType: EntityType;
  entityId: ObjectId;
  uploadedBy: ObjectId;
  uploadedAt: Date;
  status: 'active' | 'deleted';
  deletedAt?: Date;
}

class UploadService {
  async saveUploadRecord(
    tenantId: string,
    branchId: string,
    uploadedFile: UploadedFile,
    uploadedBy: string
  ): Promise<UploadedFile> {
    const doc: UploadDocument = {
      _id: new ObjectId(),
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      key: uploadedFile.key,
      url: uploadedFile.url,
      filename: uploadedFile.filename,
      originalName: uploadedFile.originalName,
      mimeType: uploadedFile.mimeType,
      size: uploadedFile.size,
      category: uploadedFile.category,
      entityType: uploadedFile.entityType,
      entityId: new ObjectId(uploadedFile.entityId),
      uploadedBy: new ObjectId(uploadedBy),
      uploadedAt: uploadedFile.uploadedAt,
      status: 'active',
    };

    await collections.uploads.insertOne(doc);
    logger.info({ key: uploadedFile.key, tenantId }, 'Upload record saved');

    return uploadedFile;
  }

  buildUploadedFile(
    file: MulterS3File,
    entityType: EntityType,
    entityId: string,
    category: UploadCategory
  ): UploadedFile {
    return {
      key: file.key,
      url: file.location,
      filename: path.basename(file.key),
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      category,
      entityType,
      entityId,
      uploadedAt: new Date(),
    };
  }

  async generatePresignedUploadUrl(
    tenantId: string,
    branchId: string,
    request: PresignedUrlRequest
  ): Promise<PresignedUrlResponse> {
    const { filename, mimeType, entityType, entityId, category } = request;
    const ext = path.extname(filename);
    const uniqueId = nanoid(12);
    const key = `${tenantId}/${branchId}/${entityType}/${entityId}/${category}/${uniqueId}${ext}`;

    const command = new PutObjectCommand({
      Bucket: getBucketName(),
      Key: key,
      ContentType: mimeType,
      Metadata: {
        originalName: filename,
        tenantId,
        branchId,
        entityType,
        entityId,
        category,
      },
    });

    const uploadUrl = await getSignedUrl(getS3Client(), command, {
      expiresIn: PRESIGNED_UPLOAD_EXPIRY,
    });

    const expiresAt = new Date(Date.now() + PRESIGNED_UPLOAD_EXPIRY * 1000);

    return { uploadUrl, key, expiresAt };
  }

  async confirmUpload(
    tenantId: string,
    key: string,
    request: ConfirmUploadRequest
  ): Promise<UploadedFile> {
    // Validate key belongs to tenant
    if (!key.startsWith(`${tenantId}/`)) {
      throw new ApiError('FORBIDDEN', 'Access denied to this file', 403);
    }

    // Parse key to extract metadata
    const parts = key.split('/');
    if (parts.length < 6) {
      throw new ApiError('INVALID_KEY', 'Invalid file key format', 400);
    }

    const [, branchId, entityType, entityId, category] = parts;

    const uploadedFile: UploadedFile = {
      key,
      url: `https://${getBucketName()}.s3.amazonaws.com/${key}`,
      filename: path.basename(key),
      originalName: request.originalName,
      mimeType: request.mimeType,
      size: request.size,
      category: category as UploadCategory,
      entityType: entityType as EntityType,
      entityId,
      uploadedAt: new Date(),
    };

    // Save record to database (without uploadedBy since we don't have it here)
    const doc: Omit<UploadDocument, 'uploadedBy'> & { uploadedBy?: ObjectId } = {
      _id: new ObjectId(),
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      key: uploadedFile.key,
      url: uploadedFile.url,
      filename: uploadedFile.filename,
      originalName: uploadedFile.originalName,
      mimeType: uploadedFile.mimeType,
      size: uploadedFile.size,
      category: uploadedFile.category,
      entityType: uploadedFile.entityType,
      entityId: new ObjectId(uploadedFile.entityId),
      uploadedAt: uploadedFile.uploadedAt,
      status: 'active',
    };

    await collections.uploads.insertOne(doc);
    logger.info({ key, tenantId }, 'Upload confirmed and record saved');

    return uploadedFile;
  }

  async generateSignedDownloadUrl(
    tenantId: string,
    key: string
  ): Promise<SignedDownloadUrlResponse> {
    // Validate key belongs to tenant
    if (!key.startsWith(`${tenantId}/`)) {
      throw new ApiError('FORBIDDEN', 'Access denied to this file', 403);
    }

    const command = new GetObjectCommand({
      Bucket: getBucketName(),
      Key: key,
    });

    const url = await getSignedUrl(getS3Client(), command, {
      expiresIn: PRESIGNED_DOWNLOAD_EXPIRY,
    });

    const expiresAt = new Date(Date.now() + PRESIGNED_DOWNLOAD_EXPIRY * 1000);

    return { url, expiresAt };
  }

  async deleteFile(tenantId: string, key: string): Promise<void> {
    // Validate key belongs to tenant
    if (!key.startsWith(`${tenantId}/`)) {
      throw new ApiError('FORBIDDEN', 'Access denied to this file', 403);
    }

    const command = new DeleteObjectCommand({
      Bucket: getBucketName(),
      Key: key,
    });

    try {
      await getS3Client().send(command);

      // Mark as deleted in database
      await collections.uploads.updateOne(
        { key, tenantId: new ObjectId(tenantId) },
        { $set: { status: 'deleted', deletedAt: new Date() } }
      );

      logger.info({ key }, 'File deleted successfully');
    } catch (error) {
      logger.error({ error, key }, 'Failed to delete file');
      throw new ApiError('DELETE_FAILED', 'Failed to delete file', 500);
    }
  }

  async getUploadsByEntity(
    tenantId: string,
    entityType: EntityType,
    entityId: string
  ): Promise<UploadedFile[]> {
    const uploads = await collections.uploads
      .find({
        tenantId: new ObjectId(tenantId),
        entityType,
        entityId: new ObjectId(entityId),
        status: 'active',
      })
      .sort({ uploadedAt: -1 })
      .toArray();

    return uploads.map((doc) => ({
      key: doc.key,
      url: doc.url,
      filename: doc.filename,
      originalName: doc.originalName,
      mimeType: doc.mimeType,
      size: doc.size,
      category: doc.category as UploadCategory,
      entityType: doc.entityType as EntityType,
      entityId: doc.entityId.toString(),
      uploadedAt: doc.uploadedAt,
    }));
  }
}

export const uploadService = new UploadService();

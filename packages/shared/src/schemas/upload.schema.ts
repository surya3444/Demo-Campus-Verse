import { z } from 'zod';

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

export const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-matroska',
] as const;

export const ALL_ALLOWED_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_DOCUMENT_TYPES,
  ...ALLOWED_VIDEO_TYPES,
] as const;

export const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB
export const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB

export const uploadCategorySchema = z.enum([
  'photo',
  'document',
  'certificate',
  'id-proof',
  'signature',
  'video',
]);
export const entityTypeSchema = z.enum([
  'students',
  'staff',
  'admissions',
  'organization',
  'lessons',
  'courses',
]);

export const presignedUrlRequestSchema = z
  .object({
    filename: z.string().min(1, 'Filename is required'),
    mimeType: z.enum(ALL_ALLOWED_TYPES, {
      errorMap: () => ({ message: 'Invalid file type' }),
    }),
    size: z.number().int().positive('File size must be positive'),
    entityType: entityTypeSchema,
    entityId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid entity ID'),
    category: uploadCategorySchema,
  })
  .refine(
    (data) => {
      const isImage = ALLOWED_IMAGE_TYPES.includes(
        data.mimeType as (typeof ALLOWED_IMAGE_TYPES)[number]
      );
      const isVideo = ALLOWED_VIDEO_TYPES.includes(
        data.mimeType as (typeof ALLOWED_VIDEO_TYPES)[number]
      );
      const maxSize = isVideo ? MAX_VIDEO_SIZE : isImage ? MAX_IMAGE_SIZE : MAX_DOCUMENT_SIZE;
      return data.size <= maxSize;
    },
    {
      message: 'File size exceeds maximum allowed limit',
      path: ['size'],
    }
  );

export const confirmUploadRequestSchema = z.object({
  key: z.string().min(1, 'Key is required'),
  originalName: z.string().min(1, 'Original name is required'),
  mimeType: z.enum(ALL_ALLOWED_TYPES, {
    errorMap: () => ({ message: 'Invalid file type' }),
  }),
  size: z.number().int().positive('File size must be positive'),
});

export const entityParamsSchema = z.object({
  entityType: entityTypeSchema,
  entityId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid entity ID'),
});

export type PresignedUrlRequestInput = z.infer<typeof presignedUrlRequestSchema>;
export type ConfirmUploadRequestInput = z.infer<typeof confirmUploadRequestSchema>;
export type EntityParamsInput = z.infer<typeof entityParamsSchema>;

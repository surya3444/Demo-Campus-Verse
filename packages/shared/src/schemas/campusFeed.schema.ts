import { z } from 'zod';
import { objectIdSchema } from './common.schema';

export const createPostSchema = z.object({
  postType: z.enum(['post', 'notice']).default('post'),
  content: z.string().min(1, 'Post content is required').max(5000, 'Post content too long'),
  media: z
    .array(
      z.object({
        url: z.string().min(1),
        type: z.literal('image'),
        width: z.number().optional(),
        height: z.number().optional(),
      })
    )
    .max(4, 'Maximum 4 images allowed')
    .default([]),
  audience: z.enum(['everyone', 'staff_only', 'students_only']).default('everyone'),
});

export const updatePostSchema = z.object({
  content: z.string().min(1, 'Post content is required').max(5000, 'Post content too long'),
});

export const createCommentSchema = z.object({
  content: z.string().min(1, 'Comment is required').max(2000, 'Comment too long'),
  parentCommentId: objectIdSchema.optional(),
});

export const flagPostSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(500),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type FlagPostInput = z.infer<typeof flagPostSchema>;

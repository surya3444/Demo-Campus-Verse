import { z } from 'zod';

export const addressSchema = z.object({
  line1: z.string().min(1, 'Address line 1 is required'),
  line2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  country: z.string().default('India'),
  pincode: z.string().regex(/^\d{6}$/, 'Invalid pincode'),
});

export const contactSchema = z.object({
  email: z.string().email('Invalid email').optional(),
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Invalid phone number')
    .optional(),
  alternatePhone: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Invalid phone number')
    .optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ID format');

export type AddressInput = z.infer<typeof addressSchema>;
export type ContactInput = z.infer<typeof contactSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;

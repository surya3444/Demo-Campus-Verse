import { z } from 'zod';

// ── Visitor ──

export const createVisitorSchema = z.object({
  name: z.string().min(1, 'Visitor name is required').max(200),
  phone: z.string().min(1, 'Phone number is required').max(20),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  company: z.string().max(200).optional(),
  photoUrl: z.string().url().optional(),
  idType: z.enum(['aadhar', 'pan', 'driving_license', 'passport', 'other']).optional(),
  idNumber: z.string().max(50).optional(),

  purpose: z.string().min(1, 'Purpose is required').max(200),
  hostName: z.string().min(1, 'Host name is required').max(200),
  hostDepartment: z.string().max(200).optional(),
  hostUserId: z
    .string()
    .regex(/^[a-f\d]{24}$/i, 'Invalid ID format')
    .optional(),
  numberOfVisitors: z.number().int().min(1).default(1),
  vehicleNumber: z.string().max(20).optional(),
  belongings: z.string().max(500).optional(),

  type: z.enum(['walk_in', 'pre_registered']).default('walk_in'),
  expectedDate: z.coerce.date().optional(),
  expectedTime: z.string().max(10).optional(),

  remarks: z.string().max(1000).optional(),
});

export const updateVisitorSchema = createVisitorSchema.partial();

export const checkInVisitorSchema = z.object({
  remarks: z.string().max(1000).optional(),
});

export const checkOutVisitorSchema = z.object({
  remarks: z.string().max(1000).optional(),
});

export const generatePassSchema = z.object({
  validityHours: z.number().int().min(1).max(72).optional(),
});

export const visitorSettingsSchema = z.object({
  autoGeneratePassCode: z.boolean().optional(),
  passCodePrefix: z.string().max(10).optional(),
  passValidityHours: z.number().int().min(1).max(72).optional(),
  requirePhotoForCheckIn: z.boolean().optional(),
  requireIdForCheckIn: z.boolean().optional(),
  allowPreRegistration: z.boolean().optional(),
  customPurposes: z.array(z.string().max(100)).optional(),
});

// ── Type Exports ──

export type CreateVisitorInput = z.infer<typeof createVisitorSchema>;
export type UpdateVisitorInput = z.infer<typeof updateVisitorSchema>;
export type CheckInVisitorInput = z.infer<typeof checkInVisitorSchema>;
export type CheckOutVisitorInput = z.infer<typeof checkOutVisitorSchema>;
export type GeneratePassInput = z.infer<typeof generatePassSchema>;
export type VisitorSettingsInput = z.infer<typeof visitorSettingsSchema>;

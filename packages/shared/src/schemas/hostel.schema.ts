import { z } from 'zod';
import { objectIdSchema, paginationSchema } from './common.schema';

// ============ Hostel Schemas ============

export const createHostelSchema = z.object({
  name: z.string().min(1, 'Hostel name is required').max(100),
  code: z
    .string()
    .min(1, 'Hostel code is required')
    .max(20)
    .regex(/^[A-Z0-9-]+$/, 'Code must be uppercase alphanumeric with hyphens'),
  type: z.enum(['boys', 'girls', 'co-ed']),
  totalFloors: z.number().int().min(1).max(50),
  floors: z.array(z.string()).optional(),
  wardenId: objectIdSchema.optional(),
  wardenName: z.string().optional(),
  amenities: z.array(z.string()).default([]),
  contactNumber: z.string().optional(),
  email: z.string().email().optional(),
});

export const updateHostelSchema = createHostelSchema.partial();

export const hostelQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  type: z.enum(['boys', 'girls', 'co-ed']).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  wardenId: objectIdSchema.optional(),
});

// ============ Room Schemas ============

export const createRoomSchema = z.object({
  hostelId: objectIdSchema,
  roomNumber: z.string().min(1, 'Room number is required').max(20),
  floor: z.coerce.string().min(1, 'Floor is required'),
  type: z.enum(['single', 'double', 'triple', 'quad', 'dormitory']),
  capacity: z.number().int().min(1).max(50),
  amenities: z.array(z.string()).default([]),
  monthlyRent: z.number().min(0).optional(),
  securityDeposit: z.number().min(0).optional(),
});

export const updateRoomSchema = z.object({
  roomNumber: z.string().min(1).max(20).optional(),
  floor: z.coerce.string().min(1).optional(),
  type: z.enum(['single', 'double', 'triple', 'quad', 'dormitory']).optional(),
  capacity: z.number().int().min(1).max(50).optional(),
  amenities: z.array(z.string()).optional(),
  monthlyRent: z.number().min(0).optional(),
  securityDeposit: z.number().min(0).optional(),
  roomStatus: z.enum(['available', 'maintenance', 'reserved']).optional(),
});

export const roomQuerySchema = paginationSchema.extend({
  hostelId: objectIdSchema.optional(),
  floor: z.string().optional(),
  type: z.enum(['single', 'double', 'triple', 'quad', 'dormitory']).optional(),
  roomStatus: z
    .enum(['available', 'partially_occupied', 'occupied', 'maintenance', 'reserved'])
    .optional(),
  hasAvailableBeds: z.coerce.boolean().optional(),
});

// ============ Bed Allocation Schemas ============

export const createBedAllocationSchema = z.object({
  hostelId: objectIdSchema,
  roomId: objectIdSchema,
  bedNumber: z.string().min(1, 'Bed number is required'),
  studentId: objectIdSchema,
  allocationDate: z.coerce.date().optional(),
  expectedVacatingDate: z.coerce.date().optional(),
});

export const vacateBedSchema = z.object({
  vacatingReason: z.string().min(1, 'Vacating reason is required').max(500),
  actualVacatingDate: z.coerce.date().optional(),
});

export const transferBedSchema = z.object({
  newHostelId: objectIdSchema,
  newRoomId: objectIdSchema,
  newBedNumber: z.string().min(1, 'New bed number is required'),
  reason: z.string().max(500).optional(),
});

export const allocationQuerySchema = paginationSchema.extend({
  hostelId: objectIdSchema.optional(),
  roomId: objectIdSchema.optional(),
  studentId: objectIdSchema.optional(),
  status: z.enum(['active', 'vacated', 'transferred', 'cancelled']).optional(),
  classId: objectIdSchema.optional(),
  search: z.string().optional(),
});

// ============ Hostel Settings Schema ============

export const updateHostelSettingsSchema = z.object({
  visitingHours: z
    .object({
      start: z.string(),
      end: z.string(),
      days: z.array(z.number().int().min(0).max(6)),
    })
    .optional(),
  messTimings: z
    .object({
      breakfast: z.object({ start: z.string(), end: z.string() }).optional(),
      lunch: z.object({ start: z.string(), end: z.string() }).optional(),
      snacks: z.object({ start: z.string(), end: z.string() }).optional(),
      dinner: z.object({ start: z.string(), end: z.string() }).optional(),
    })
    .optional(),
  hostelRules: z.array(z.string()).optional(),
  notifications: z
    .object({
      allocationConfirmation: z.boolean(),
      vacatingReminder: z.boolean(),
      reminderDaysBefore: z.number().int().min(1).max(30),
    })
    .optional(),
});

// ============ Inferred Types ============

export type CreateHostelInput = z.infer<typeof createHostelSchema>;
export type UpdateHostelInput = z.infer<typeof updateHostelSchema>;
export type HostelQueryInput = z.infer<typeof hostelQuerySchema>;
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
export type RoomQueryInput = z.infer<typeof roomQuerySchema>;
export type CreateBedAllocationInput = z.infer<typeof createBedAllocationSchema>;
export type VacateBedInput = z.infer<typeof vacateBedSchema>;
export type TransferBedInput = z.infer<typeof transferBedSchema>;
export type AllocationQueryInput = z.infer<typeof allocationQuerySchema>;
export type UpdateHostelSettingsInput = z.infer<typeof updateHostelSettingsSchema>;

import { z } from 'zod';
import { objectIdSchema, paginationSchema } from './common.schema';

// ============ Room & Status Enums ============

export const INFRA_ROOM_TYPES = [
  'classroom',
  'office',
  'lab',
  'library',
  'auditorium',
  'conference_room',
  'staff_room',
  'store_room',
  'other',
] as const;

export const INFRA_ROOM_STATUSES = ['available', 'occupied', 'maintenance', 'reserved'] as const;

// ============ Building Schemas ============

export const buildingFloorSchema = z.object({
  name: z.string().min(1, 'Floor name is required').max(50),
  number: z.number().int().min(0).max(100),
  status: z.enum(['active', 'inactive']).default('active'),
});

export const createBuildingSchema = z.object({
  name: z.string().min(1, 'Building name is required').max(100),
  code: z
    .string()
    .min(1, 'Building code is required')
    .max(20)
    .regex(/^[A-Z0-9-]+$/, 'Code must be uppercase alphanumeric with hyphens'),
  floors: z.array(buildingFloorSchema).min(1, 'At least one floor is required').max(100),
  description: z.string().max(500).optional(),
});

export const updateBuildingSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  code: z
    .string()
    .min(1)
    .max(20)
    .regex(/^[A-Z0-9-]+$/)
    .optional(),
  floors: z.array(buildingFloorSchema).min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export const buildingQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

// ============ Floor Management Schemas ============

export const addFloorSchema = buildingFloorSchema;

export const updateFloorSchema = buildingFloorSchema.partial();

// ============ Room Schemas ============

export const createInfraRoomSchema = z.object({
  buildingId: objectIdSchema,
  floorId: objectIdSchema,
  roomNumber: z.string().min(1, 'Room number is required').max(20),
  name: z.string().max(100).optional(),
  type: z.enum(INFRA_ROOM_TYPES),
  capacity: z.number().int().positive().optional(),
  area: z.number().positive().optional(),
  amenities: z.array(z.string()).default([]),
});

export const updateInfraRoomSchema = z.object({
  floorId: objectIdSchema.optional(),
  roomNumber: z.string().min(1).max(20).optional(),
  name: z.string().max(100).optional(),
  type: z.enum(INFRA_ROOM_TYPES).optional(),
  capacity: z.number().int().positive().optional(),
  area: z.number().positive().optional(),
  amenities: z.array(z.string()).optional(),
  status: z.enum(INFRA_ROOM_STATUSES).optional(),
});

export const infraRoomQuerySchema = paginationSchema.extend({
  buildingId: objectIdSchema.optional(),
  floorId: objectIdSchema.optional(),
  type: z.enum(INFRA_ROOM_TYPES).optional(),
  status: z.enum(INFRA_ROOM_STATUSES).optional(),
  search: z.string().optional(),
});

// ============ Inferred Types ============

export type BuildingFloorInput = z.infer<typeof buildingFloorSchema>;
export type CreateBuildingInput = z.infer<typeof createBuildingSchema>;
export type UpdateBuildingInput = z.infer<typeof updateBuildingSchema>;
export type BuildingQueryInput = z.infer<typeof buildingQuerySchema>;
export type AddFloorInput = z.infer<typeof addFloorSchema>;
export type UpdateFloorInput = z.infer<typeof updateFloorSchema>;
export type CreateInfraRoomInput = z.infer<typeof createInfraRoomSchema>;
export type UpdateInfraRoomInput = z.infer<typeof updateInfraRoomSchema>;
export type InfraRoomQueryInput = z.infer<typeof infraRoomQuerySchema>;

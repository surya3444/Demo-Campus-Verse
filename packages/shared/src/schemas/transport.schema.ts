import { z } from 'zod';
import { objectIdSchema, paginationSchema } from './common.schema';

const geoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const routeLocationSchema = z.object({
  name: z.string().min(1, 'Location name is required').max(200),
  address: z.string().max(500).optional(),
  placeId: z.string().max(200).optional(),
  location: geoPointSchema,
});

const stopInputSchema = z.object({
  _id: z.string().optional(),
  name: z.string().min(1, 'Stop name is required').max(200),
  address: z.string().max(500).optional(),
  placeId: z.string().max(200).optional(),
  location: geoPointSchema,
  sequence: z.number().int().min(0),
  pickupTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time (HH:mm)')
    .optional(),
  dropTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time (HH:mm)')
    .optional(),
  fare: z.number().min(0).optional(),
});

const pricingSchema = z
  .object({
    mode: z.enum(['flat', 'per_stop']),
    flatPrice: z.number().min(0).optional(),
    currency: z.string().min(1).max(10).default('INR'),
    frequency: z.enum(['monthly', 'quarterly', 'yearly']).default('monthly'),
  })
  .refine((val) => val.mode !== 'flat' || typeof val.flatPrice === 'number', {
    message: 'Flat price is required when pricing mode is flat',
    path: ['flatPrice'],
  });

export const createBusSchema = z
  .object({
    busNumber: z.string().min(1, 'Bus number is required').max(40),
    name: z.string().min(1, 'Route name is required').max(200),
    type: z.enum(['mini', 'standard', 'luxury', 'van']).default('standard'),
    capacity: z.number().int().min(1).max(200),
    driverName: z.string().max(200).optional(),
    driverPhone: z.string().max(20).optional(),
    conductorName: z.string().max(200).optional(),
    conductorPhone: z.string().max(20).optional(),
    vehicleRegistration: z.string().max(40).optional(),
    startLocation: routeLocationSchema,
    stops: z.array(stopInputSchema).default([]),
    routePolyline: z.string().optional(),
    totalDistanceMeters: z.number().min(0).optional(),
    totalDurationSeconds: z.number().min(0).optional(),
    pricing: pricingSchema,
    notes: z.string().max(2000).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.pricing.mode === 'per_stop') {
      val.stops.forEach((stop, idx) => {
        if (typeof stop.fare !== 'number') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['stops', idx, 'fare'],
            message: 'Fare is required for each stop when using per-stop pricing',
          });
        }
      });
    }
  });

export const updateBusSchema = z
  .object({
    busNumber: z.string().min(1).max(40).optional(),
    name: z.string().min(1).max(200).optional(),
    type: z.enum(['mini', 'standard', 'luxury', 'van']).optional(),
    capacity: z.number().int().min(1).max(200).optional(),
    driverName: z.string().max(200).optional(),
    driverPhone: z.string().max(20).optional(),
    conductorName: z.string().max(200).optional(),
    conductorPhone: z.string().max(20).optional(),
    vehicleRegistration: z.string().max(40).optional(),
    startLocation: routeLocationSchema.optional(),
    stops: z.array(stopInputSchema).optional(),
    routePolyline: z.string().optional(),
    totalDistanceMeters: z.number().min(0).optional(),
    totalDurationSeconds: z.number().min(0).optional(),
    pricing: pricingSchema.optional(),
    status: z.enum(['active', 'inactive']).optional(),
    notes: z.string().max(2000).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.pricing?.mode === 'per_stop' && val.stops) {
      val.stops.forEach((stop, idx) => {
        if (typeof stop.fare !== 'number') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['stops', idx, 'fare'],
            message: 'Fare is required for each stop when using per-stop pricing',
          });
        }
      });
    }
  });

export const busQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  type: z.enum(['mini', 'standard', 'luxury', 'van']).optional(),
  pricingMode: z.enum(['flat', 'per_stop']).optional(),
});

export const createTransportEnrollmentSchema = z.object({
  busId: objectIdSchema,
  studentId: objectIdSchema,
  stopId: z.string().min(1, 'Stop is required'),
  pickupEnabled: z.boolean().default(true),
  dropEnabled: z.boolean().default(true),
  startDate: z.coerce.date().optional(),
  priceOverride: z.number().min(0).optional(),
});

export const updateTransportEnrollmentSchema = z.object({
  stopId: z.string().min(1).optional(),
  pickupEnabled: z.boolean().optional(),
  dropEnabled: z.boolean().optional(),
  endDate: z.coerce.date().optional(),
});

export const withdrawEnrollmentSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(500),
  effectiveDate: z.coerce.date().optional(),
});

export const transportEnrollmentQuerySchema = paginationSchema.extend({
  busId: objectIdSchema.optional(),
  stopId: z.string().optional(),
  studentId: objectIdSchema.optional(),
  classId: objectIdSchema.optional(),
  status: z.enum(['active', 'withdrawn', 'transferred']).optional(),
  search: z.string().optional(),
});

export const transportSettingsSchema = z.object({
  googleMapsApiKey: z.string().max(200).optional(),
  defaultCurrency: z.string().max(10).optional(),
  defaultFrequency: z.enum(['monthly', 'quarterly', 'yearly']).optional(),
  autoAssignEnrollmentCode: z.boolean().optional(),
  notifyOnEnrollment: z.boolean().optional(),
});

export type CreateBusInput = z.infer<typeof createBusSchema>;
export type UpdateBusInput = z.infer<typeof updateBusSchema>;
export type BusQueryInput = z.infer<typeof busQuerySchema>;
export type CreateTransportEnrollmentInput = z.infer<typeof createTransportEnrollmentSchema>;
export type UpdateTransportEnrollmentInput = z.infer<typeof updateTransportEnrollmentSchema>;
export type WithdrawEnrollmentInput = z.infer<typeof withdrawEnrollmentSchema>;
export type TransportEnrollmentQueryInput = z.infer<typeof transportEnrollmentQuerySchema>;
export type TransportSettingsInput = z.infer<typeof transportSettingsSchema>;
export type BusStopInput = z.infer<typeof stopInputSchema>;
export type BusPricingInput = z.infer<typeof pricingSchema>;

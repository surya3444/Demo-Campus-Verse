import { z } from 'zod';
import { objectIdSchema } from './common.schema';

export const enrollTransportSchema = z
  .object({
    optIn: z.boolean(),
    busId: objectIdSchema.optional(),
    stopId: z.string().optional(),
    pickupEnabled: z.boolean().default(true),
    dropEnabled: z.boolean().default(true),
    priceOverride: z.number().min(0).optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.optIn) return;
    if (!v.busId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['busId'],
        message: 'Bus is required when transport is opted in',
      });
    }
    if (!v.stopId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['stopId'],
        message: 'Stop is required when transport is opted in',
      });
    }
  });

export const enrollConcessionSchema = z.object({
  type: z.enum(['scholarship', 'staff-ward', 'sibling', 'merit', 'need-based', 'custom']),
  name: z.string().min(1).max(200),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.number().min(0),
  appliedTo: z.enum(['total', 'tuition', 'specific']),
  specificComponents: z.array(z.string()).optional(),
  reason: z.string().max(500).optional(),
});

export const enrollApplicationSchema = z.object({
  admissionNumber: z.string().max(40).optional(),
  rollNumber: z.string().max(40).optional(),
  /** Admission route/quota (management/convener/…) — drives fee targeting. */
  admissionCategory: z.string().max(50).optional(),
  sectionId: objectIdSchema.optional(),
  admissionDate: z.coerce.date().optional(),
  feeStructureIds: z.array(objectIdSchema).optional(),
  electiveSubjectIds: z.array(objectIdSchema).optional(),
  transport: enrollTransportSchema.optional(),
  /** @deprecated use `transport.optIn` — kept for backwards compatibility */
  transportOptIn: z.boolean().optional(),
  concession: enrollConcessionSchema.optional(),
});

export type EnrollTransportInput = z.infer<typeof enrollTransportSchema>;
export type EnrollConcessionInput = z.infer<typeof enrollConcessionSchema>;
export type EnrollApplicationInput = z.infer<typeof enrollApplicationSchema>;

/** Required fields for a lead; other form fields pass through. */
export const createLeadRouteSchema = z
  .object({
    firstName: z.string().trim().min(1, 'First name is required').max(50),
    contact: z.object({ phone: z.string().min(10, 'A phone number is required') }).passthrough(),
    interestedIn: z
      .object({
        academicBatchId: objectIdSchema.optional(),
        classId: objectIdSchema.optional(),
      })
      .passthrough(),
  })
  .passthrough();

/** Required fields for an application; other form fields pass through. */
export const createApplicationRouteSchema = z
  .object({
    academicBatchId: objectIdSchema,
    classId: objectIdSchema,
    sectionId: objectIdSchema.optional(),
    student: z
      .object({
        firstName: z.string().trim().min(1, 'First name is required'),
        lastName: z.string().trim().min(1, 'Last name is required'),
        dateOfBirth: z.string().min(1, 'Date of birth is required'),
        gender: z.enum(['male', 'female', 'other']),
      })
      .passthrough(),
    contact: z.object({ phone: z.string().min(10, 'A phone number is required') }).passthrough(),
  })
  .passthrough();

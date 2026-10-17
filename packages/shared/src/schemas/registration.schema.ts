import { z } from 'zod';
import { objectIdSchema } from './common.schema';
import { subjectCategorySchema } from './organization.schema';

// ─── Program Schemes ────────────────────────────────────────────────────────

const schemeCoreSlotSchema = z.object({
  kind: z.literal('core'),
  category: subjectCategorySchema.optional(),
  subjectId: objectIdSchema,
  credits: z.number().min(0).max(30),
});

const schemeBasketOptionSchema = z.object({
  subjectId: objectIdSchema,
  credits: z.number().min(0).max(30),
  /** 0 or absent = unlimited seats. */
  seatCap: z.number().int().min(0).max(10000).optional(),
});

// NOTE: no .refine() on union members — z.discriminatedUnion only accepts
// plain ZodObjects. Cross-field slot validation lives in the superRefine on
// the slots array below.
const schemeBasketSlotSchema = z.object({
  kind: z.literal('basket'),
  /** Display label, e.g. "Professional Elective I". */
  label: z.string().min(1).max(100),
  category: subjectCategorySchema.optional(),
  chooseCount: z.number().int().min(1).max(10),
  options: z.array(schemeBasketOptionSchema).min(1).max(30),
});

export const schemeSlotSchema = z.discriminatedUnion('kind', [
  schemeCoreSlotSchema,
  schemeBasketSlotSchema,
]);

const schemeSlotsSchema = z
  .array(schemeSlotSchema)
  .min(1)
  .max(30)
  .superRefine((slots, ctx) => {
    const allSubjectIds: string[] = [];
    slots.forEach((slot, i) => {
      if (slot.kind === 'basket') {
        if (slot.chooseCount > slot.options.length) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [i, 'chooseCount'],
            message: 'chooseCount cannot exceed the number of options',
          });
        }
        const optionIds = slot.options.map((o) => o.subjectId);
        if (new Set(optionIds).size !== optionIds.length) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [i, 'options'],
            message: 'Basket options must be distinct subjects',
          });
        }
        allSubjectIds.push(...optionIds);
      } else {
        allSubjectIds.push(slot.subjectId);
      }
    });
    // A subject may appear only once across the whole scheme (cores + all
    // basket options) — otherwise a student could register it twice.
    if (new Set(allSubjectIds).size !== allSubjectIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A subject may appear only once in a scheme',
      });
    }
  });

export const createSchemeSchema = z
  .object({
    departmentCode: z.string().min(1).max(20),
    /**
     * FK → programs. Optional: a department that runs a single program can
     * keep authoring by department code alone. When set, students whose class
     * carries this programId match the scheme ahead of any code-keyed one.
     */
    programId: objectIdSchema.optional(),
    departmentName: z.string().min(1).max(100),
    semesterNumber: z.number().int().min(1).max(30),
    slots: schemeSlotsSchema,
    minCredits: z.number().min(0).max(60).default(16),
    maxCredits: z.number().min(1).max(60).default(28),
  })
  .refine((s) => s.maxCredits >= s.minCredits, {
    message: 'maxCredits must be >= minCredits',
  });

export const updateSchemeSchema = z.object({
  departmentName: z.string().min(1).max(100).optional(),
  programId: objectIdSchema.nullable().optional(),
  slots: schemeSlotsSchema.optional(),
  minCredits: z.number().min(0).max(60).optional(),
  maxCredits: z.number().min(1).max(60).optional(),
});

export const cloneSchemeSchema = z.object({
  targetSemesterNumber: z.number().int().min(1).max(30).optional(),
  targetProgramId: objectIdSchema.nullable().optional(),
  targetDepartmentCode: z.string().min(1).max(20).optional(),
  targetDepartmentName: z.string().min(1).max(100).optional(),
});

// ─── Course Registration ────────────────────────────────────────────────────

/** Basket choices only — cores are auto-filled server-side from the scheme. */
export const basketSelectionSchema = z.object({
  slotId: z.string().min(1),
  subjectIds: z.array(objectIdSchema).min(1).max(10),
});

export const submitRegistrationSchema = z.object({
  academicBatchId: objectIdSchema,
  termId: z.string().min(1),
  selections: z.array(basketSelectionSchema).default([]),
});

/** Add/drop: full replacement of basket choices before the deadline. */
export const updateRegistrationSchema = z.object({
  selections: z.array(basketSelectionSchema).default([]),
});

export type CreateSchemeInput = z.infer<typeof createSchemeSchema>;
export type UpdateSchemeInput = z.infer<typeof updateSchemeSchema>;
export type CloneSchemeInput = z.infer<typeof cloneSchemeSchema>;
export type SchemeSlotInput = z.infer<typeof schemeSlotSchema>;
export type SubmitRegistrationInput = z.infer<typeof submitRegistrationSchema>;
export type UpdateRegistrationInput = z.infer<typeof updateRegistrationSchema>;

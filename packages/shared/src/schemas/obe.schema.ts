import { z } from 'zod';
import { objectIdSchema, paginationSchema } from './common.schema';

// ── Settings ──────────────────────────────────────────────────────────────────

const levelBandSchema = z.object({
  level: z.number().int().min(1).max(10),
  minPercent: z.number().min(0).max(100),
});

/**
 * Bands must be strictly increasing in both level and minPercent so
 * "highest band whose minPercent is cleared" is well-defined.
 */
const levelBandsSchema = z
  .array(levelBandSchema)
  .min(1)
  .max(10)
  .superRefine((bands, ctx) => {
    for (let i = 1; i < bands.length; i++) {
      if (bands[i].level <= bands[i - 1].level || bands[i].minPercent <= bands[i - 1].minPercent) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Bands must be strictly increasing in level and minPercent',
        });
        return;
      }
    }
  });

const weightPair = (a: string, b: string) =>
  z
    .object({ [a]: z.number().min(0).max(1), [b]: z.number().min(0).max(1) })
    .refine(
      (w) => Math.abs((w[a] as number) + (w[b] as number) - 1) < 1e-9,
      `${a} and ${b} weights must sum to 1`
    );

export const obeSettingsSchema = z.object({
  internalThresholdPercent: z.number().min(0).max(100).optional(),
  internalLevelBands: levelBandsSchema.optional(),
  externalLevelBands: levelBandsSchema.optional(),
  directWeights: weightPair('internal', 'external').optional(),
  overallWeights: weightPair('direct', 'indirect').optional(),
  targetAttainmentLevel: z.number().min(0).max(10).optional(),
  maxAttainmentLevel: z.number().min(1).max(10).optional(),
});

// ── Programs ──────────────────────────────────────────────────────────────────

const poInputSchema = z.object({
  _id: objectIdSchema.optional(),
  code: z.string().trim().min(1).max(20),
  title: z.string().trim().min(1).max(120),
  statement: z.string().trim().min(1).max(2000),
  isCustom: z.boolean().default(false),
  order: z.number().int().min(0),
});

const psoInputSchema = z.object({
  _id: objectIdSchema.optional(),
  code: z.string().trim().min(1).max(20),
  statement: z.string().trim().min(1).max(2000),
  order: z.number().int().min(0),
});

export const createObeProgramSchema = z.object({
  departmentCode: z.string().trim().min(1).max(30),
  /** Link to the curriculum program (B.Tech CSE AI & ML) this PO/PSO set belongs to. */
  curriculumProgramId: objectIdSchema.optional(),
  name: z.string().trim().min(1).max(120),
  preset: z.enum(['nba_ug_engineering', 'nba_pg', 'mba', 'custom']),
  /** Optional override — when absent the server seeds POs from the preset. */
  pos: z.array(poInputSchema).max(30).optional(),
  psos: z.array(psoInputSchema).max(10).default([]),
});

export const updateObeProgramSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  curriculumProgramId: objectIdSchema.nullable().optional(),
  pos: z.array(poInputSchema).max(30).optional(),
  psos: z.array(psoInputSchema).max(10).optional(),
});

export const obeProgramCorrectiveActionsSchema = z.object({
  academicBatchId: objectIdSchema,
  actions: z.array(z.object({ poId: objectIdSchema, text: z.string().trim().max(4000) })).max(50),
});

// ── Course outcomes + mapping matrices ───────────────────────────────────────

const coInputSchema = z.object({
  /** Present for existing COs so their ids (referenced by instruments, surveys,
   *  corrective actions) stay stable across edits. */
  _id: objectIdSchema.optional(),
  code: z.string().trim().min(1).max(20),
  statement: z.string().trim().min(1).max(2000),
  bloomLevel: z.number().int().min(1).max(6),
  order: z.number().int().min(0),
});

/** Mapping cells reference COs by index into `cos` (new COs have no id yet). */
const poMappingCellSchema = z.object({
  coIndex: z.number().int().min(0),
  poId: objectIdSchema,
  strength: z.number().int().min(1).max(3),
  justification: z.string().trim().max(2000).optional(),
});

const psoMappingCellSchema = z.object({
  coIndex: z.number().int().min(0),
  psoId: objectIdSchema,
  strength: z.number().int().min(1).max(3),
  justification: z.string().trim().max(2000).optional(),
});

export const upsertCourseOutcomesSchema = z
  .object({
    subjectId: objectIdSchema,
    programId: objectIdSchema,
    cos: z.array(coInputSchema).min(1).max(20),
    poMapping: z.array(poMappingCellSchema).max(600).default([]),
    psoMapping: z.array(psoMappingCellSchema).max(200).default([]),
  })
  .superRefine((doc, ctx) => {
    const codes = new Set<string>();
    for (const co of doc.cos) {
      if (codes.has(co.code)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate CO code: ${co.code}` });
      }
      codes.add(co.code);
    }
    for (const cell of [...doc.poMapping, ...doc.psoMapping]) {
      if (cell.coIndex >= doc.cos.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Mapping references CO index ${cell.coIndex} but only ${doc.cos.length} COs were provided`,
        });
        return;
      }
    }
    const poCells = new Set<string>();
    for (const cell of doc.poMapping) {
      const key = `${cell.coIndex}:${cell.poId}`;
      if (poCells.has(key)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Duplicate CO-PO mapping cell' });
        return;
      }
      poCells.add(key);
    }
    const psoCells = new Set<string>();
    for (const cell of doc.psoMapping) {
      const key = `${cell.coIndex}:${cell.psoId}`;
      if (psoCells.has(key)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Duplicate CO-PSO mapping cell' });
        return;
      }
      psoCells.add(key);
    }
  });

// ── Offerings ─────────────────────────────────────────────────────────────────

export const createObeOfferingSchema = z.object({
  programId: objectIdSchema,
  subjectId: objectIdSchema,
  academicBatchId: objectIdSchema,
  termId: objectIdSchema,
  sectionIds: z.array(objectIdSchema).min(1).max(50),
  coordinatorStaffId: objectIdSchema.optional(),
  targetLevel: z.number().min(0).max(10).optional(),
});

export const updateObeOfferingSchema = z.object({
  sectionIds: z.array(objectIdSchema).min(1).max(50).optional(),
  coordinatorStaffId: objectIdSchema.nullable().optional(),
  targetLevel: z.number().min(0).max(10).nullable().optional(),
});

export const obeOfferingStatusSchema = z.object({
  status: z.enum(['draft', 'data_entry']),
});

export const obeOfferingQuerySchema = paginationSchema.extend({
  programId: objectIdSchema.optional(),
  academicBatchId: objectIdSchema.optional(),
  termId: objectIdSchema.optional(),
  subjectId: objectIdSchema.optional(),
  status: z.enum(['draft', 'data_entry', 'computed', 'finalized']).optional(),
  mine: z.coerce.boolean().optional(),
  search: z.string().trim().max(120).optional(),
});

export const obeCoCorrectiveActionsSchema = z.object({
  actions: z.array(z.object({ coId: objectIdSchema, text: z.string().trim().max(4000) })).max(50),
});

// ── Instruments ───────────────────────────────────────────────────────────────

const instrumentItemSchema = z.object({
  _id: objectIdSchema.optional(),
  label: z.string().trim().min(1).max(40),
  coIds: z.array(objectIdSchema).min(1).max(20),
  maxMarks: z.number().positive().max(1000),
});

const instrumentSetSchema = z.object({
  _id: objectIdSchema.optional(),
  label: z.string().trim().min(1).max(40),
  items: z.array(instrumentItemSchema).min(1).max(50),
});

export const obeInstrumentSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    kind: z.enum(['internal', 'external']),
    order: z.number().int().min(0).default(0),
    sets: z.array(instrumentSetSchema).min(1).max(10).optional(),
    bestOfCount: z.number().int().min(1).max(50).nullable().optional(),
    thresholdPercentOverride: z.number().min(0).max(100).optional(),
    examId: objectIdSchema.optional(),
    paperId: objectIdSchema.optional(),
  })
  .superRefine((inst, ctx) => {
    if (inst.kind === 'internal' && (!inst.sets || inst.sets.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Internal instruments need at least one question set',
      });
    }
    if (inst.kind === 'external' && (!inst.examId || !inst.paperId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'External instruments must link an exam and paper',
      });
    }
  });

// ── Marks ─────────────────────────────────────────────────────────────────────

const markRowSchema = z.object({
  studentId: objectIdSchema,
  setId: objectIdSchema.optional(),
  absent: z.boolean().default(false),
  /** An item absent from this array = not attempted; 0 = attempted and scored 0. */
  marks: z
    .array(z.object({ itemId: objectIdSchema, marksObtained: z.number().min(0) }))
    .max(100)
    .default([]),
});

export const obeBulkMarksSchema = z.object({
  rows: z.array(markRowSchema).min(1).max(500),
});

export const obeMarksImportSchema = z.object({
  csv: z.string().min(1).max(2_000_000),
});

// ── Survey ────────────────────────────────────────────────────────────────────

export const obeSurveyResponseSchema = z.object({
  ratings: z
    .array(z.object({ coId: objectIdSchema, rating: z.number().int().min(0).max(3) }))
    .min(1)
    .max(20),
});

// ── Inferred types ────────────────────────────────────────────────────────────

export type ObeSettingsInput = z.infer<typeof obeSettingsSchema>;
export type CreateObeProgramInput = z.infer<typeof createObeProgramSchema>;
export type UpdateObeProgramInput = z.infer<typeof updateObeProgramSchema>;
export type UpsertCourseOutcomesInput = z.infer<typeof upsertCourseOutcomesSchema>;
export type CreateObeOfferingInput = z.infer<typeof createObeOfferingSchema>;
export type UpdateObeOfferingInput = z.infer<typeof updateObeOfferingSchema>;
export type ObeOfferingQueryInput = z.infer<typeof obeOfferingQuerySchema>;
export type ObeInstrumentInput = z.infer<typeof obeInstrumentSchema>;
export type ObeBulkMarksInput = z.infer<typeof obeBulkMarksSchema>;
export type ObeSurveyResponseInput = z.infer<typeof obeSurveyResponseSchema>;

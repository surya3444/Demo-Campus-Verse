import { z } from 'zod';
import { objectIdSchema, paginationSchema } from './common.schema';
import { BOARD_PRESETS, EXAM_TYPES, EXAM_STATUSES } from '../constants/exam';

/* ────────────────────────── Settings ────────────────────────── */

const gradingScaleBandSchema = z.object({
  minPercent: z.number().min(0).max(100),
  maxPercent: z.number().min(0).max(100),
  grade: z.string().min(1, 'Grade label is required').max(8),
  points: z.number().min(0).max(10).optional(),
  remark: z.string().max(60).optional(),
});

export const examSettingsSchema = z
  .object({
    boardPreset: z.enum(BOARD_PRESETS),
    gradingScale: z.array(gradingScaleBandSchema).min(1, 'Add at least one grade band'),
    coScholasticEnabled: z.boolean(),
    coScholasticAreas: z.array(z.string().min(1)).default([]),
    coScholasticGrades: z.array(z.string().min(1)).default([]),
    passMarkPercent: z.number().min(0).max(100),
    passSubjectsRequired: z.union([z.literal('all'), z.number().int().min(1)]),
    reportCard: z.object({
      showAttendance: z.boolean().default(true),
      showRank: z.boolean().default(true),
      showRemarks: z.boolean().default(true),
      principalName: z.string().max(80).optional(),
      schoolMotto: z.string().max(120).optional(),
    }),
    hallTicket: z.object({
      seatingMode: z.enum(['roll_number', 'manual']),
      showQrCode: z.boolean().default(false),
      venueDefault: z.string().max(120).optional(),
    }),
    resultNotification: z.object({
      sendSms: z.boolean().default(false),
      sendEmail: z.boolean().default(true),
      smsTemplate: z.string().max(400).optional(),
      emailSubject: z.string().max(140).optional(),
      emailBody: z.string().max(2000).optional(),
    }),
    promotion: z.object({
      passMarkPercent: z.number().min(0).max(100),
      passSubjectsRequired: z.union([z.literal('all'), z.number().int().min(1)]),
    }),
  })
  .partial()
  .extend({
    boardPreset: z.enum(BOARD_PRESETS),
  });

export type ExamSettingsInput = z.infer<typeof examSettingsSchema>;

/* ────────────────────────── Exam papers ────────────────────────── */

const examPaperInputSchema = z.object({
  subjectId: objectIdSchema,
  totalMarks: z.number().int().min(1, 'Total marks must be at least 1').max(1000),
  passMarks: z.number().int().min(0).max(1000),
  weight: z.number().min(0).max(100).optional(),
});

/* ────────────────────────── Exam CRUD ────────────────────────── */

export const createExamSchema = z
  .object({
    academicBatchId: objectIdSchema,
    /** Preferred: the semester (AcademicBatch.terms._id) this exam belongs to. */
    termId: z.string().min(1).optional(),
    /** Legacy free-text label — ignored when termId is supplied. */
    termName: z.string().min(1).max(40).optional(),
    name: z.string().min(1, 'Exam name is required').max(120),
    type: z.enum(EXAM_TYPES),
    classIds: z.array(objectIdSchema).min(1, 'Pick at least one class'),
    papers: z.array(examPaperInputSchema).min(1, 'Add at least one paper'),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    instructions: z.string().max(2000).optional(),
  })
  .refine((e) => !!e.termId || !!e.termName, {
    message: 'Pick a semester for this exam',
    path: ['termId'],
  });

// .partial() isn't available on a refined schema — restate the shape instead.
export const updateExamSchema = z.object({
  academicBatchId: objectIdSchema.optional(),
  termId: z.string().min(1).optional(),
  termName: z.string().min(1).max(40).optional(),
  name: z.string().min(1).max(120).optional(),
  type: z.enum(EXAM_TYPES).optional(),
  classIds: z.array(objectIdSchema).min(1).optional(),
  papers: z.array(examPaperInputSchema).min(1).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  instructions: z.string().max(2000).optional(),
});

export const examStatusSchema = z.object({
  status: z.enum(EXAM_STATUSES),
});

export const examQuerySchema = paginationSchema.extend({
  academicBatchId: objectIdSchema.optional(),
  termId: z.string().optional(),
  termName: z.string().optional(),
  status: z.enum(EXAM_STATUSES).optional(),
  type: z.enum(EXAM_TYPES).optional(),
  classId: objectIdSchema.optional(),
});

/* ────────────────────────── Schedules ────────────────────────── */

export const createScheduleSchema = z.object({
  examId: objectIdSchema,
  paperId: objectIdSchema,
  sectionId: objectIdSchema,
  date: z.coerce.date(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM 24h format'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM 24h format'),
  durationMinutes: z.number().int().min(5).max(600).optional(),
  room: z.string().max(60).optional(),
  invigilatorIds: z.array(objectIdSchema).optional(),
});

export const bulkScheduleSchema = z.object({
  examId: objectIdSchema,
  paperId: objectIdSchema,
  sectionIds: z.array(objectIdSchema).min(1),
  date: z.coerce.date(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  durationMinutes: z.number().int().min(5).max(600).optional(),
  room: z.string().max(60).optional(),
  invigilatorIds: z.array(objectIdSchema).optional(),
});

export const updateScheduleSchema = createScheduleSchema
  .partial()
  .omit({ examId: true, paperId: true, sectionId: true });

/* ────────────────────────── Marks ────────────────────────── */

const singleMarkInputSchema = z.object({
  studentId: objectIdSchema,
  marksObtained: z.number().min(0),
  absent: z.boolean().default(false),
  remarks: z.string().max(280).optional(),
});

export const createResultSchema = z.object({
  examId: objectIdSchema,
  paperId: objectIdSchema,
  scheduleId: objectIdSchema.optional(),
  studentId: objectIdSchema,
  marksObtained: z.number().min(0),
  absent: z.boolean().default(false),
  remarks: z.string().max(280).optional(),
});

export const bulkResultsSchema = z.object({
  examId: objectIdSchema,
  paperId: objectIdSchema,
  scheduleId: objectIdSchema.optional(),
  marks: z.array(singleMarkInputSchema).min(1),
});

export const publishResultsSchema = z.object({
  examId: objectIdSchema,
  paperId: objectIdSchema.optional(),
  /** If provided, only results for these students are published. */
  studentIds: z.array(objectIdSchema).optional(),
});

/* ────────────────────────── Co-scholastic ────────────────────────── */

export const upsertCoScholasticSchema = z.object({
  examId: objectIdSchema,
  studentId: objectIdSchema,
  areaName: z.string().min(1).max(60),
  grade: z.string().min(1).max(8),
  remarks: z.string().max(280).optional(),
});

export const bulkCoScholasticSchema = z.object({
  examId: objectIdSchema,
  entries: z
    .array(
      z.object({
        studentId: objectIdSchema,
        areaName: z.string().min(1),
        grade: z.string().min(1),
        remarks: z.string().max(280).optional(),
      })
    )
    .min(1),
});

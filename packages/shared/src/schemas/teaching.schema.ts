import { z } from 'zod';
import { objectIdSchema, paginationSchema } from './common.schema';

// ============ Timetable Slot Schemas ============

export const createTimetableSlotSchema = z.object({
  classId: objectIdSchema,
  sectionId: objectIdSchema.optional(),
  name: z.string().min(1, 'Slot name is required'),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time format (HH:mm)'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time format (HH:mm)'),
  order: z.number().int().min(0, 'Order must be non-negative'),
  type: z.enum(['period', 'break', 'assembly', 'lunch']),
});

export const updateTimetableSlotSchema = createTimetableSlotSchema
  .omit({ classId: true })
  .extend({ sectionId: objectIdSchema.nullable().optional() })
  .partial();

export const copyTimetableSlotsSchema = z.object({
  sourceClassId: objectIdSchema,
  targetClassId: objectIdSchema,
});

// ============ Teaching Assignment Schemas ============

export const createTeachingAssignmentSchema = z.object({
  staffId: objectIdSchema,
  subjectId: objectIdSchema,
  sectionId: objectIdSchema,
  termId: objectIdSchema.optional(),
  batchIds: z.array(objectIdSchema).optional(),
  role: z.enum(['primary', 'assistant', 'lab']).default('primary'),
});

export const updateTeachingAssignmentSchema = z.object({
  termId: objectIdSchema.nullable().optional(),
  batchIds: z.array(objectIdSchema).nullable().optional(),
  role: z.enum(['primary', 'assistant', 'lab']).optional(),
  status: z.enum(['active', 'ended']).optional(),
});

export type CreateTeachingAssignmentInput = z.infer<typeof createTeachingAssignmentSchema>;
export type UpdateTeachingAssignmentInput = z.infer<typeof updateTeachingAssignmentSchema>;

// ============ Timetable Entry Schemas ============

const timetableSubjectRowSchema = z.object({
  subjectId: objectIdSchema,
  teacherId: objectIdSchema,
  /** Lab slot for a subset of the section (id from Section.batches). */
  batchId: objectIdSchema.optional(),
  roomNumber: z.string().optional(),
  notes: z.string().optional(),
  isMandatory: z.boolean().default(true),
  studentIds: z.array(objectIdSchema).optional(),
  linkedSectionIds: z.array(objectIdSchema).optional().default([]),
});

/** Auto-generate a program's or department's week (preview unless apply). */
export const generateTimetableSchema = z
  .object({
    programId: objectIdSchema.optional(),
    departmentId: objectIdSchema.optional(),
    classIds: z.array(objectIdSchema).max(50).optional(),
    days: z.array(z.number().int().min(0).max(6)).min(1).max(7).default([1, 2, 3, 4, 5, 6]),
    maxPerDay: z.number().int().min(1).max(10).default(5),
    mode: z.enum(['fill', 'fresh']).default('fill'),
    seed: z.number().int().min(0).max(2147483647).default(1),
    apply: z.boolean().default(false),
  })
  .refine((v) => v.programId || v.departmentId || v.classIds?.length, {
    message: 'Pick a program, a department or some years',
  });

export const createTimetableEntrySchema = z.object({
  sectionId: objectIdSchema,
  slotId: objectIdSchema,
  dayOfWeek: z.number().int().min(0).max(6),
  subjects: z.array(timetableSubjectRowSchema).min(1, 'At least one subject is required'),
});

export const updateTimetableGroupSchema = z.object({
  subjects: z
    .array(
      timetableSubjectRowSchema.extend({
        entryId: objectIdSchema.optional(),
      })
    )
    .min(1, 'At least one subject is required'),
});

export const updateTimetableEntrySchema = z.object({
  subjectId: objectIdSchema.optional(),
  teacherId: objectIdSchema.optional(),
  slotId: objectIdSchema.optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  roomNumber: z.string().optional(),
  notes: z.string().optional(),
});

export const bulkCreateTimetableEntriesSchema = z.object({
  entries: z
    .array(
      z.object({
        sectionId: objectIdSchema,
        subjectId: objectIdSchema,
        teacherId: objectIdSchema,
        slotId: objectIdSchema,
        dayOfWeek: z.number().int().min(0).max(6),
        roomNumber: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .min(1, 'At least one entry is required'),
});

// ============ Lesson Plan Schemas ============

export const createLessonPlanSchema = z.object({
  sectionId: objectIdSchema,
  subjectId: objectIdSchema,
  slotId: objectIdSchema.optional(),
  title: z.string().min(1, 'Title is required'),
  date: z.coerce.date(),
  description: z.string().optional(),
  objectives: z.array(z.string()).default([]),
  topics: z.array(z.string()).default([]),
  resources: z.array(z.string()).default([]),
  methodology: z.string().optional(),
  assessment: z.string().optional(),
  duration: z.number().int().min(1).optional(),
  notes: z.string().optional(),
  attachments: z.array(z.string()).default([]),
  status: z.enum(['draft', 'published', 'completed']).default('draft'),
});

export const updateLessonPlanSchema = createLessonPlanSchema.partial();

export const updateLessonPlanTeachingStatusSchema = z.object({
  teachingStatus: z.enum([
    'not_started',
    'ongoing',
    'delivered',
    'questionnaire_sent',
    'all_submitted',
    'completed_with_assignment',
    'completed',
  ]),
  linkedAssignmentId: objectIdSchema.optional(),
});

export const lessonPlanQuerySchema = paginationSchema.extend({
  sectionId: objectIdSchema.optional(),
  subjectId: objectIdSchema.optional(),
  status: z.enum(['draft', 'published']).optional(),
  teachingStatus: z
    .enum(['not_started', 'ongoing', 'completed_with_assignment', 'completed'])
    .optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});

// ============ Question Schema (shared) ============

export const questionSchema = z.object({
  type: z.enum(['mcq', 'short_answer', 'true_false']),
  question: z.string().min(1, 'Question text is required'),
  options: z.array(z.string()).optional(),
  correctAnswer: z.string().min(1, 'Correct answer is required'),
  marks: z.number().int().min(1, 'Marks must be at least 1'),
});

// ============ Assignment Schemas ============

export const createAssignmentSchema = z.object({
  sectionId: objectIdSchema,
  subjectId: objectIdSchema,
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  instructions: z.string().optional(),
  type: z.enum(['homework', 'classwork', 'project', 'test', 'quiz', 'other']).default('homework'),
  totalMarks: z.number().int().min(1).optional(),
  questions: z.array(questionSchema).optional(),
  dueDate: z.coerce.date().optional(),
  assignedDate: z.coerce.date().optional(),
  attachments: z.array(z.string()).default([]),
  notes: z.string().optional(),
  status: z.enum(['draft', 'published']).default('draft'),
});

export const updateAssignmentSchema = createAssignmentSchema
  .partial()
  .omit({ sectionId: true, subjectId: true });

export const assignmentQuerySchema = paginationSchema.extend({
  sectionId: objectIdSchema.optional(),
  subjectId: objectIdSchema.optional(),
  status: z.enum(['draft', 'published', 'grading', 'completed']).optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});

// ============ Grade Schemas ============

export const createGradeSchema = z.object({
  assignmentId: objectIdSchema,
  studentId: objectIdSchema,
  marksObtained: z.number().min(0, 'Marks cannot be negative'),
  remarks: z.string().optional(),
});

export const bulkGradeSchema = z.object({
  assignmentId: objectIdSchema,
  grades: z
    .array(
      z.object({
        studentId: objectIdSchema,
        marksObtained: z.number().min(0, 'Marks cannot be negative'),
        remarks: z.string().optional(),
      })
    )
    .min(1, 'At least one grade is required'),
});

// ============ Questionnaire Schemas ============

export const createQuestionnaireSchema = z.object({
  lessonPlanId: objectIdSchema,
  title: z.string().min(1, 'Title is required'),
  questions: z.array(questionSchema).min(1, 'At least one question is required'),
  dueDate: z.coerce.date().optional(),
});

export const updateQuestionnaireSchema = z.object({
  title: z.string().min(1).optional(),
  questions: z.array(questionSchema).min(1).optional(),
  dueDate: z.coerce.date().optional(),
});

export const submitAssignmentSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: objectIdSchema,
        answer: z.string(),
      })
    )
    .min(1, 'At least one answer is required'),
});

export const submitQuestionnaireSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: objectIdSchema,
        answer: z.string(),
      })
    )
    .min(1, 'At least one answer is required'),
});

// ============ Type Exports ============

export type CreateTimetableSlotInput = z.infer<typeof createTimetableSlotSchema>;
export type UpdateTimetableSlotInput = z.infer<typeof updateTimetableSlotSchema>;
export type CopyTimetableSlotsInput = z.infer<typeof copyTimetableSlotsSchema>;
export type CreateTimetableEntryInput = z.infer<typeof createTimetableEntrySchema>;
export type UpdateTimetableEntryInput = z.infer<typeof updateTimetableEntrySchema>;
export type UpdateTimetableGroupInput = z.infer<typeof updateTimetableGroupSchema>;
export type BulkCreateTimetableEntriesInput = z.infer<typeof bulkCreateTimetableEntriesSchema>;
export type CreateLessonPlanInput = z.infer<typeof createLessonPlanSchema>;
export type UpdateLessonPlanInput = z.infer<typeof updateLessonPlanSchema>;
export type UpdateLessonPlanTeachingStatusInput = z.infer<
  typeof updateLessonPlanTeachingStatusSchema
>;
export type LessonPlanQueryInput = z.infer<typeof lessonPlanQuerySchema>;
export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;
export type AssignmentQueryInput = z.infer<typeof assignmentQuerySchema>;
export type CreateGradeInput = z.infer<typeof createGradeSchema>;
export type BulkGradeInput = z.infer<typeof bulkGradeSchema>;
export type CreateQuestionnaireInput = z.infer<typeof createQuestionnaireSchema>;
export type UpdateQuestionnaireInput = z.infer<typeof updateQuestionnaireSchema>;
export type SubmitAssignmentInput = z.infer<typeof submitAssignmentSchema>;
export type SubmitQuestionnaireInput = z.infer<typeof submitQuestionnaireSchema>;

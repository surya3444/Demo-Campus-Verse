import { z } from 'zod';
import { objectIdSchema, paginationSchema } from './common.schema';

// ============ Course Schemas ============

export const createCourseSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().min(1, 'Description is required'),
  category: z
    .enum([
      'technical',
      'soft_skills',
      'aptitude',
      'language',
      'domain_specific',
      'certification_prep',
      'career_readiness',
      'general',
    ])
    .default('general'),
  level: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
  duration: z.number().int().min(1).optional(),
  tags: z.array(z.string()).optional(),
  instructor: z.string().optional(),
  instructorId: z.string().optional(),
  instructorName: z.string().optional(),
  modules: z
    .array(
      z.object({
        _id: z.string().optional(),
        title: z.string().min(1, 'Module title is required'),
        description: z.string().optional(),
        duration: z.number().int().min(1).optional(),
        order: z.number().int().min(0),
        resources: z.array(z.string()).optional(),
      })
    )
    .default([]),
  thumbnailUrl: z.string().optional(),
  introVideoUrl: z.string().optional(),
  // Optional uploaded intro video (lives in S3). The lesson player picks
  // this over introVideoUrl when present.
  introVideoFile: z
    .object({
      key: z.string(),
      url: z.string().optional(),
      sizeBytes: z.number().int().optional(),
      mimeType: z.string().optional(),
      durationSeconds: z.number().int().optional(),
    })
    .optional(),
  status: z.enum(['draft', 'published']).default('draft'),
});

export const updateCourseSchema = createCourseSchema.partial();

export const courseQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  category: z
    .enum([
      'technical',
      'soft_skills',
      'aptitude',
      'language',
      'domain_specific',
      'certification_prep',
      'career_readiness',
      'general',
    ])
    .optional(),
  level: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  visibility: z.enum(['branch', 'selected_branches', 'all']).optional(),
});

export const updateCourseVisibilitySchema = z
  .object({
    visibility: z.enum(['branch', 'selected_branches', 'all']),
    branchIds: z.array(objectIdSchema).optional(),
  })
  .refine(
    (data) => {
      if (data.visibility === 'selected_branches') {
        return data.branchIds && data.branchIds.length > 0;
      }
      return true;
    },
    { message: 'branchIds is required when visibility is selected_branches', path: ['branchIds'] }
  );

// ============ Lesson Schemas ============

export const lessonAttachmentSchema = z.object({
  key: z.string(),
  name: z.string(),
  sizeBytes: z.number().int().optional(),
  mimeType: z.string().optional(),
});

export const lessonVideoFileSchema = z.object({
  key: z.string(),
  url: z.string().optional(),
  sizeBytes: z.number().int().optional(),
  mimeType: z.string().optional(),
  durationSeconds: z.number().int().optional(),
});

export const createLessonSchema = z.object({
  courseId: objectIdSchema,
  moduleId: objectIdSchema,
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().optional(),
  type: z.enum(['video', 'document', 'live']),
  // Soft validation: empty string is fine, otherwise must look like a URL or
  // s3 key. The strict z.string().url() rejected empty strings + non-http
  // protocols, which broke the create flow. Backend stores whatever is sent.
  contentUrl: z
    .string()
    .optional()
    .refine((v) => !v || /^https?:\/\//.test(v) || v.startsWith('s3://'), {
      message: 'contentUrl must be a URL or empty',
    }),
  // Coerce so an empty number input (which RHF turns into NaN/'') doesn't
  // explode the schema. Optional means undefined/blank is OK.
  duration: z.coerce.number().int().min(1).optional(),
  order: z.number().int().min(0),
  isPreview: z.boolean().default(false),

  // Expanded schema — content + metadata an LMS lesson actually needs.
  videoFile: lessonVideoFileSchema.optional(),
  thumbnailUrl: z.string().url().optional().or(z.literal('')),
  attachments: z.array(lessonAttachmentSchema).default([]),
  learningObjectives: z.array(z.string().min(1)).default([]),
  tags: z.array(z.string().min(1)).default([]),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  isFree: z.boolean().default(false),
  transcript: z.string().optional(),
  // Rich-text content for document-type lessons (stored as HTML string)
  contentHtml: z.string().optional(),
});

export const updateLessonSchema = createLessonSchema
  .omit({ courseId: true, moduleId: true })
  .partial();

export const lessonQuerySchema = paginationSchema.extend({
  moduleId: objectIdSchema.optional(),
});

// ============ Quiz Schemas ============

const quizQuestionSchema = z.object({
  questionText: z.string().min(1, 'Question text is required'),
  type: z.enum(['mcq', 'true_false', 'short_answer']),
  options: z.array(z.string()).optional(),
  correctAnswer: z.string().min(1, 'Correct answer is required'),
  points: z.number().int().min(1).default(1),
});

export const createQuizSchema = z.object({
  courseId: objectIdSchema,
  moduleId: objectIdSchema.optional(),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().optional(),
  questions: z.array(quizQuestionSchema).min(1, 'At least one question is required'),
  passingScore: z.number().int().min(0).max(100),
  timeLimitMinutes: z.number().int().min(1).optional(),
  maxAttempts: z.number().int().min(1).default(3),
});

export const updateQuizSchema = createQuizSchema.omit({ courseId: true }).partial();

export const quizQuerySchema = paginationSchema.extend({
  moduleId: objectIdSchema.optional(),
});

// ============ Enrollment Schemas ============

export const enrollStudentSchema = z.object({
  courseId: objectIdSchema,
  studentIds: z.array(objectIdSchema).min(1, 'At least one student is required'),
});

export const updateEnrollmentSchema = z.object({
  status: z.enum(['enrolled', 'in_progress', 'completed', 'dropped']),
});

export const enrollmentQuerySchema = paginationSchema.extend({
  courseId: objectIdSchema.optional(),
  studentId: objectIdSchema.optional(),
  status: z.enum(['enrolled', 'in_progress', 'completed', 'dropped']).optional(),
});

// ============ Progress Schemas ============

export const updateProgressSchema = z.object({
  status: z.enum(['not_started', 'in_progress', 'completed']),
  watchedDuration: z.number().int().min(0).optional(),
});

// ============ Quiz Attempt Schemas ============

export const submitQuizAttemptSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: objectIdSchema,
        answer: z.string().min(1),
      })
    )
    .min(1, 'At least one answer is required'),
});

// ============ Settings Schema ============

export const updateCourseSettingsSchema = z.object({
  allowSelfEnrollment: z.boolean().optional(),
  requireApprovalForPublish: z.boolean().optional(),
  maxEnrollmentsPerCourse: z.number().int().min(1).optional(),
  certificateAutoIssue: z.boolean().optional(),
});

import { z } from 'zod';
import { objectIdSchema } from './common.schema';

export const createLiveClassSchema = z
  .object({
    title: z.string().min(1, 'Title is required').max(200),
    description: z.string().max(2000).optional(),
    classId: objectIdSchema.optional(),
    sectionId: objectIdSchema,
    subjectId: objectIdSchema.optional(),
    /**
     * Optional host teacher. Only honoured by the API when the caller is an
     * admin scheduling on behalf of someone else; otherwise the caller becomes
     * the host regardless of what they send.
     */
    hostStaffId: objectIdSchema.optional(),
    coHostStaffIds: z.array(objectIdSchema).default([]),
    scheduledStart: z.coerce.date(),
    scheduledEnd: z.coerce.date(),
    recordingEnabled: z.boolean().default(false),
    autoMarkAttendance: z.boolean().default(false),
    attendanceThresholdPct: z.number().int().min(10).max(100).default(60),
    settings: z
      .object({
        chatEnabled: z.boolean().optional(),
        studentCanUnmute: z.boolean().optional(),
        studentCanDraw: z.boolean().optional(),
        recordingEnabled: z.boolean().optional(),
      })
      .optional(),
  })
  .refine((d) => d.scheduledEnd > d.scheduledStart, {
    message: 'scheduledEnd must be after scheduledStart',
    path: ['scheduledEnd'],
  });

export const updateLiveClassSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  scheduledStart: z.coerce.date().optional(),
  scheduledEnd: z.coerce.date().optional(),
  coHostStaffIds: z.array(objectIdSchema).optional(),
  recordingEnabled: z.boolean().optional(),
  autoMarkAttendance: z.boolean().optional(),
  attendanceThresholdPct: z.number().int().min(10).max(100).optional(),
  settings: z
    .object({
      chatEnabled: z.boolean().optional(),
      studentCanUnmute: z.boolean().optional(),
      studentCanDraw: z.boolean().optional(),
      recordingEnabled: z.boolean().optional(),
    })
    .optional(),
});

export const kickLiveClassParticipantSchema = z.object({
  userId: objectIdSchema,
});

export const liveClassSettingsPatchSchema = z
  .object({
    chatEnabled: z.boolean().optional(),
    studentCanUnmute: z.boolean().optional(),
    studentCanDraw: z.boolean().optional(),
    recordingEnabled: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'At least one setting must be provided',
  });

export const launchLiveClassPollSchema = z.object({
  question: z.string().min(1).max(500),
  options: z
    .array(
      z.object({
        text: z.string().min(1).max(200),
        isCorrect: z.boolean().optional(),
      })
    )
    .min(2)
    .max(8),
  type: z.enum(['single', 'multi']).default('single'),
  durationSec: z.number().int().min(5).max(600).default(30),
});

export type CreateLiveClassInput = z.infer<typeof createLiveClassSchema>;
export type UpdateLiveClassInput = z.infer<typeof updateLiveClassSchema>;
export type LaunchLiveClassPollInput = z.infer<typeof launchLiveClassPollSchema>;
export type KickLiveClassParticipantInput = z.infer<typeof kickLiveClassParticipantSchema>;
export type LiveClassSettingsPatchInput = z.infer<typeof liveClassSettingsPatchSchema>;

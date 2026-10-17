import { z } from 'zod';
import { objectIdSchema } from './common.schema';

// Attendance status enum
export const attendanceStatusSchema = z.enum(['present', 'absent', 'late', 'half-day', 'leave']);

// Single attendance record for a student
export const attendanceRecordSchema = z.object({
  studentId: objectIdSchema,
  status: attendanceStatusSchema,
  inTime: z.string().optional(),
  outTime: z.string().optional(),
  leaveType: z.string().optional(),
  remarks: z.string().max(500).optional(),
});

// Mark attendance for a class/section
export const markAttendanceSchema = z.object({
  classId: objectIdSchema,
  sectionId: objectIdSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  // Lecture registers: per-subject, optional period. Without these, zod's
  // strip-mode parse in validateBody silently dropped subjectId and every
  // lecture-wise mark landed on the daily register.
  subjectId: objectIdSchema.optional(),
  period: z.number().int().min(1).max(12).optional(),
  /** Lab-batch register (id from Section.batches); only with subjectId. */
  batchId: objectIdSchema.optional(),
  records: z.array(attendanceRecordSchema).min(1, 'At least one record is required'),
});

// Update individual student attendance record
export const updateAttendanceRecordSchema = z.object({
  studentId: objectIdSchema,
  status: attendanceStatusSchema,
  inTime: z.string().optional(),
  outTime: z.string().optional(),
  leaveType: z.string().optional(),
  remarks: z.string().max(500).optional(),
});

// Query params for getting attendance
export const getAttendanceQuerySchema = z.object({
  classId: objectIdSchema,
  sectionId: objectIdSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
});

// Query params for daily report
export const dailyReportQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
});

// Query params for class-wise report
export const classWiseReportQuerySchema = z.object({
  classId: objectIdSchema,
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
});

// Query params for student-wise report
export const studentWiseReportQuerySchema = z.object({
  classId: objectIdSchema,
  sectionId: objectIdSchema,
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
});

// Query params for monthly report
export const monthlyReportQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

// Query params for student history
export const studentHistoryQuerySchema = z.object({
  fromDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format')
    .optional(),
  toDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format')
    .optional(),
});

// ============ Holiday Schemas ============

export const holidayTypeSchema = z.enum(['national', 'religious', 'local', 'vacation']);

export const createHolidaySchema = z.object({
  name: z.string().min(1, 'Holiday name is required').max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format')
    .optional(),
  type: holidayTypeSchema,
  description: z.string().max(500).optional(),
  applicableFor: z.enum(['all', 'students', 'staff']).default('all'),
});

export const updateHolidaySchema = createHolidaySchema.partial();

// ============ Attendance Settings Schemas ============

export const attendanceSettingsSchema = z.object({
  workingDays: z.array(z.number().min(0).max(6)).default([1, 2, 3, 4, 5]), // 0=Sun, 6=Sat
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:MM)')
    .default('08:00'),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:MM)')
    .default('14:00'),
  lateThresholdMinutes: z.number().int().min(0).max(120).default(15),
  halfDayThresholdMinutes: z.number().int().min(0).max(240).default(180),
  autoLockAfterDays: z.number().int().min(0).max(30).default(7),
  requireRemarks: z.boolean().default(false),
  allowFutureAttendance: z.boolean().default(false),
  lowAttendanceThreshold: z.number().min(0).max(100).default(75),
});

// Export inferred types (renamed to avoid conflicts with types/attendance.ts)
export type AttendanceRecordInput = z.infer<typeof attendanceRecordSchema>;
export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>;
export type UpdateAttendanceRecordInput = z.infer<typeof updateAttendanceRecordSchema>;
export type GetAttendanceQuery = z.infer<typeof getAttendanceQuerySchema>;
export type DailyReportQuery = z.infer<typeof dailyReportQuerySchema>;
export type ClassWiseReportQuery = z.infer<typeof classWiseReportQuerySchema>;
export type StudentWiseReportQuery = z.infer<typeof studentWiseReportQuerySchema>;
export type MonthlyReportQuery = z.infer<typeof monthlyReportQuerySchema>;
export type StudentHistoryQuery = z.infer<typeof studentHistoryQuerySchema>;
export type CreateHolidayInput = z.infer<typeof createHolidaySchema>;
export type UpdateHolidayInput = z.infer<typeof updateHolidaySchema>;
export type AttendanceSettingsInput = z.infer<typeof attendanceSettingsSchema>;

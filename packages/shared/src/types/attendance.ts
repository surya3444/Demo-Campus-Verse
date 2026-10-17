import { BaseEntity } from './common';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'half-day' | 'leave';

export interface StudentAttendance extends BaseEntity {
  branchId: string;
  classId: string;
  sectionId: string;
  date: Date;
  records: AttendanceRecord[];
  summary: AttendanceSummaryStats;
  markedBy: string;
  markedAt: Date;
  lastModifiedBy?: string;
  lastModifiedAt?: Date;
  isLocked: boolean;
}

export interface AttendanceRecord {
  studentId: string;
  status: AttendanceStatus;
  inTime?: string;
  outTime?: string;
  leaveType?: string;
  remarks?: string;
}

export interface AttendanceSummaryStats {
  total: number;
  present: number;
  absent: number;
  late: number;
  halfDay: number;
  leave: number;
}

export interface StudentAttendanceSummary {
  studentId: string;
  studentName: string;
  admissionNumber?: string;
  rollNumber?: string;
  totalDays: number;
  present: number;
  absent: number;
  late: number;
  halfDay: number;
  leave: number;
  attendancePercent: number;
}

export type HolidayType = 'national' | 'religious' | 'local' | 'vacation';
export type HolidayApplicableFor = 'all' | 'students' | 'staff';

export interface Holiday extends BaseEntity {
  branchId: string;
  name: string;
  date: Date;
  endDate?: Date;
  type: HolidayType;
  description?: string;
  applicableFor: HolidayApplicableFor;
}

export interface AttendanceSettings {
  branchId: string;
  workingDays: number[]; // 0=Sun, 6=Sat
  startTime: string;
  endTime: string;
  lateThresholdMinutes: number;
  halfDayThresholdMinutes: number;
  autoLockAfterDays: number;
  requireRemarks: boolean;
  allowFutureAttendance: boolean;
  lowAttendanceThreshold: number;
}

// API Response types
export interface AttendanceResponse {
  _id?: string;
  date: string;
  classId: string;
  sectionId: string;
  isMarked: boolean;
  isLocked: boolean;
  records: AttendanceRecordWithStudent[];
  summary: AttendanceSummaryStats | null;
  markedBy?: string;
  markedAt?: Date;
}

export interface AttendanceRecordWithStudent {
  studentId: string;
  admissionNumber?: string;
  displayName?: string;
  rollNumber?: number;
  status: AttendanceStatus | null;
  inTime?: string;
  outTime?: string;
  leaveType?: string;
  remarks?: string;
}

export interface DailyReportResponse {
  date: string;
  byClass: ClassAttendanceSummary[];
  totals: AttendanceSummaryStats;
}

export interface ClassAttendanceSummary {
  classId: string;
  sectionId: string;
  className: string;
  sectionName: string;
  summary: AttendanceSummaryStats;
  isLocked: boolean;
}

export interface ClassWiseReportItem {
  sectionId: string;
  sectionName: string;
  totalDays: number;
  totalStudents: number;
  avgPresent: number;
  avgAbsent: number;
  avgAttendancePercent: number;
}

export interface MonthlyReportResponse {
  year: number;
  month: number;
  daily: DailyStats[];
}

export interface DailyStats {
  day: number;
  totalClasses: number;
  totalStudents: number;
  present: number;
  absent: number;
  attendancePercent: number;
}

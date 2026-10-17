import { ObjectId, WithId, Document } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';

// ============ Attendance Settings Document ============
interface AttendanceSettingsDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;

  // General settings
  generalSettings: {
    /**
     * 'daily' — one register per section per day (schools).
     * 'per-subject' — one register per lecture, keyed by subject; enables
     * subject-wise % and the exam-eligibility rule (universities).
     */
    attendanceMode?: 'daily' | 'per-subject';
    /** Minimum subject-wise % required to sit exams (per-subject mode). */
    eligibilityThreshold?: number;
    workingDays: number[]; // 0=Sunday, 1=Monday, etc.
    startTime: string;
    endTime: string;
    lateThresholdMinutes: number;
    halfDayThresholdMinutes: number;
    autoLockAfterDays: number;
    requireRemarks: boolean;
    allowFutureAttendance: boolean;
    lowAttendanceThreshold: number;
    excludeHolidays: boolean;
  };

  // Attendance statuses
  attendanceStatuses: Array<{
    code: string;
    name: string;
    color: string;
    countsAsPresent: boolean;
    countsAsAbsent: boolean;
    countsAsHalfDay: boolean;
    requiresRemarks: boolean;
    isActive: boolean;
  }>;

  // Alert settings
  alertSettings: {
    lowAttendanceAlert: boolean;
    lowAttendanceThreshold: number;
    parentNotification: boolean;
    notificationChannels: ('sms' | 'email' | 'push')[];
    alertFrequency: 'daily' | 'weekly' | 'monthly';
  };

  // Export settings
  exportSettings: {
    defaultFormat: 'csv' | 'xlsx' | 'pdf';
    includeHolidays: boolean;
    includeWeekends: boolean;
    showPercentage: boolean;
  };

  createdAt: Date;
  updatedAt: Date;
}

const DEFAULT_ATTENDANCE_STATUSES = [
  {
    code: 'PRESENT',
    name: 'Present',
    color: '#10B981',
    countsAsPresent: true,
    countsAsAbsent: false,
    countsAsHalfDay: false,
    requiresRemarks: false,
    isActive: true,
  },
  {
    code: 'ABSENT',
    name: 'Absent',
    color: '#EF4444',
    countsAsPresent: false,
    countsAsAbsent: true,
    countsAsHalfDay: false,
    requiresRemarks: false,
    isActive: true,
  },
  {
    code: 'LATE',
    name: 'Late',
    color: '#F59E0B',
    countsAsPresent: true,
    countsAsAbsent: false,
    countsAsHalfDay: false,
    requiresRemarks: true,
    isActive: true,
  },
  {
    code: 'HALF_DAY',
    name: 'Half Day',
    color: '#3B82F6',
    countsAsPresent: false,
    countsAsAbsent: false,
    countsAsHalfDay: true,
    requiresRemarks: false,
    isActive: true,
  },
  {
    code: 'EXCUSED',
    name: 'Excused Absence',
    color: '#8B5CF6',
    countsAsPresent: false,
    countsAsAbsent: false,
    countsAsHalfDay: false,
    requiresRemarks: true,
    isActive: true,
  },
  {
    code: 'HOLIDAY',
    name: 'Holiday',
    color: '#6B7280',
    countsAsPresent: false,
    countsAsAbsent: false,
    countsAsHalfDay: false,
    requiresRemarks: false,
    isActive: true,
  },
];

const DEFAULT_GENERAL_SETTINGS = {
  // Daily by default so existing tenants are untouched; universities switch
  // to per-subject to unlock subject-wise % and exam eligibility.
  attendanceMode: 'daily' as 'daily' | 'per-subject',
  eligibilityThreshold: 75,
  workingDays: [1, 2, 3, 4, 5], // Monday to Friday
  startTime: '08:00',
  endTime: '14:00',
  lateThresholdMinutes: 15,
  halfDayThresholdMinutes: 180,
  autoLockAfterDays: 7,
  requireRemarks: false,
  allowFutureAttendance: false,
  lowAttendanceThreshold: 75,
  excludeHolidays: true,
};

const DEFAULT_ALERT_SETTINGS = {
  lowAttendanceAlert: true,
  lowAttendanceThreshold: 75,
  parentNotification: true,
  notificationChannels: ['sms', 'email'] as ('sms' | 'email')[],
  alertFrequency: 'weekly' as const,
};

const DEFAULT_EXPORT_SETTINGS = {
  defaultFormat: 'xlsx' as const,
  includeHolidays: true,
  includeWeekends: false,
  showPercentage: true,
};

class AttendanceSettingsService {
  async getSettings(tenantId: string, branchId: string) {
    const branch = await collections.branches.findOne({
      _id: new ObjectId(branchId),
      tenantId: new ObjectId(tenantId),
    });

    if (!branch) {
      throw new ApiError('BRANCH_NOT_FOUND', 'Branch not found', 404);
    }

    let settings = (await collections.attendanceSettings.findOne({
      branchId: new ObjectId(branchId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<AttendanceSettingsDocument> | null;

    if (!settings) {
      const now = new Date();
      const newSettings = {
        _id: new ObjectId(),
        branchId: new ObjectId(branchId),
        tenantId: new ObjectId(tenantId),
        generalSettings: DEFAULT_GENERAL_SETTINGS,
        attendanceStatuses: DEFAULT_ATTENDANCE_STATUSES,
        alertSettings: DEFAULT_ALERT_SETTINGS,
        exportSettings: DEFAULT_EXPORT_SETTINGS,
        createdAt: now,
        updatedAt: now,
      } as AttendanceSettingsDocument;

      await collections.attendanceSettings.insertOne(newSettings);
      settings = newSettings as WithId<AttendanceSettingsDocument>;
    }

    return this.formatSettings(settings);
  }

  async updateSettings(
    tenantId: string,
    branchId: string,
    data: Partial<{
      generalSettings: Partial<AttendanceSettingsDocument['generalSettings']>;
      alertSettings: Partial<AttendanceSettingsDocument['alertSettings']>;
      exportSettings: Partial<AttendanceSettingsDocument['exportSettings']>;
    }>,
    updatedBy: string
  ) {
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.generalSettings) {
      Object.entries(data.generalSettings).forEach(([key, value]) => {
        if (value !== undefined) {
          updateData[`generalSettings.${key}`] = value;
        }
      });
    }

    if (data.alertSettings) {
      Object.entries(data.alertSettings).forEach(([key, value]) => {
        if (value !== undefined) {
          updateData[`alertSettings.${key}`] = value;
        }
      });
    }

    if (data.exportSettings) {
      Object.entries(data.exportSettings).forEach(([key, value]) => {
        if (value !== undefined) {
          updateData[`exportSettings.${key}`] = value;
        }
      });
    }

    const result = await collections.attendanceSettings.findOneAndUpdate(
      {
        branchId: new ObjectId(branchId),
        tenantId: new ObjectId(tenantId),
      },
      {
        $set: updateData,
        $setOnInsert: {
          branchId: new ObjectId(branchId),
          tenantId: new ObjectId(tenantId),
          attendanceStatuses: DEFAULT_ATTENDANCE_STATUSES,
          createdAt: new Date(),
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    logger.info({ branchId, tenantId, updatedBy }, 'Attendance settings updated');

    return this.formatSettings(result as unknown as WithId<AttendanceSettingsDocument>);
  }

  // ============ Attendance Status Methods ============
  async addAttendanceStatus(
    tenantId: string,
    branchId: string,
    status: AttendanceSettingsDocument['attendanceStatuses'][0],
    addedBy: string
  ) {
    const existingSettings = await collections.attendanceSettings.findOne({
      branchId: new ObjectId(branchId),
      tenantId: new ObjectId(tenantId),
      'attendanceStatuses.code': status.code,
    });

    if (existingSettings) {
      throw new ApiError(
        'DUPLICATE_STATUS',
        'Attendance status with this code already exists',
        409
      );
    }

    const result = await collections.attendanceSettings.findOneAndUpdate(
      { branchId: new ObjectId(branchId), tenantId: new ObjectId(tenantId) },
      {
        $push: { attendanceStatuses: status } as unknown,
        $set: { updatedAt: new Date() },
        $setOnInsert: {
          branchId: new ObjectId(branchId),
          tenantId: new ObjectId(tenantId),
          generalSettings: DEFAULT_GENERAL_SETTINGS,
          alertSettings: DEFAULT_ALERT_SETTINGS,
          exportSettings: DEFAULT_EXPORT_SETTINGS,
          createdAt: new Date(),
        },
      } as Document,
      { upsert: true, returnDocument: 'after' }
    );

    logger.info({ branchId, tenantId, status: status.code, addedBy }, 'Attendance status added');

    return this.formatSettings(result as unknown as WithId<AttendanceSettingsDocument>);
  }

  async updateAttendanceStatus(
    tenantId: string,
    branchId: string,
    statusCode: string,
    data: Partial<AttendanceSettingsDocument['attendanceStatuses'][0]>,
    updatedBy: string
  ) {
    const updateFields: Record<string, unknown> = { updatedAt: new Date() };

    if (data.name !== undefined) updateFields['attendanceStatuses.$.name'] = data.name;
    if (data.color !== undefined) updateFields['attendanceStatuses.$.color'] = data.color;
    if (data.countsAsPresent !== undefined)
      updateFields['attendanceStatuses.$.countsAsPresent'] = data.countsAsPresent;
    if (data.countsAsAbsent !== undefined)
      updateFields['attendanceStatuses.$.countsAsAbsent'] = data.countsAsAbsent;
    if (data.countsAsHalfDay !== undefined)
      updateFields['attendanceStatuses.$.countsAsHalfDay'] = data.countsAsHalfDay;
    if (data.requiresRemarks !== undefined)
      updateFields['attendanceStatuses.$.requiresRemarks'] = data.requiresRemarks;
    if (data.isActive !== undefined) updateFields['attendanceStatuses.$.isActive'] = data.isActive;

    const result = await collections.attendanceSettings.findOneAndUpdate(
      {
        branchId: new ObjectId(branchId),
        tenantId: new ObjectId(tenantId),
        'attendanceStatuses.code': statusCode,
      },
      { $set: updateFields },
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new ApiError('STATUS_NOT_FOUND', 'Attendance status not found', 404);
    }

    logger.info({ branchId, tenantId, statusCode, updatedBy }, 'Attendance status updated');

    return this.formatSettings(result as unknown as WithId<AttendanceSettingsDocument>);
  }

  async deleteAttendanceStatus(
    tenantId: string,
    branchId: string,
    statusCode: string,
    deletedBy: string
  ) {
    // Prevent deleting core statuses
    if (['PRESENT', 'ABSENT', 'HOLIDAY'].includes(statusCode)) {
      throw new ApiError('CANNOT_DELETE_CORE_STATUS', 'Cannot delete core attendance status', 400);
    }

    const result = await collections.attendanceSettings.findOneAndUpdate(
      { branchId: new ObjectId(branchId), tenantId: new ObjectId(tenantId) },
      {
        $pull: { attendanceStatuses: { code: statusCode } } as unknown,
        $set: { updatedAt: new Date() },
      } as Document,
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new ApiError('SETTINGS_NOT_FOUND', 'Attendance settings not found', 404);
    }

    logger.info({ branchId, tenantId, statusCode, deletedBy }, 'Attendance status deleted');

    return this.formatSettings(result as unknown as WithId<AttendanceSettingsDocument>);
  }

  // ============ Holiday Integration ============
  async getWorkingDaysInRange(tenantId: string, branchId: string, startDate: Date, endDate: Date) {
    const settings = await this.getSettings(tenantId, branchId);
    const workingDays = settings.generalSettings.workingDays;

    // Get holidays in date range
    const holidays = await collections.holidays
      .find({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        date: {
          $gte: startDate,
          $lte: endDate,
        },
      })
      .toArray();

    const holidayDates = new Set(holidays.map((h) => h.date.toISOString().split('T')[0]));

    let totalWorkingDays = 0;
    let totalHolidays = 0;
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      const dateStr = currentDate.toISOString().split('T')[0];

      if (workingDays.includes(dayOfWeek)) {
        if (holidayDates.has(dateStr)) {
          totalHolidays++;
        } else {
          totalWorkingDays++;
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return {
      totalWorkingDays,
      totalHolidays,
      effectiveWorkingDays: totalWorkingDays,
      excludeHolidays: settings.generalSettings.excludeHolidays,
    };
  }

  async calculateAttendancePercentage(
    tenantId: string,
    branchId: string,
    studentId: string,
    startDate: Date,
    endDate: Date
  ) {
    const workingDaysInfo = await this.getWorkingDaysInRange(
      tenantId,
      branchId,
      startDate,
      endDate
    );

    // Get student attendance in date range
    const attendanceRecords = await collections.studentAttendance
      .find({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        studentId: new ObjectId(studentId),
        date: {
          $gte: startDate,
          $lte: endDate,
        },
      })
      .toArray();

    let presentDays = 0;
    let absentDays = 0;
    let halfDays = 0;
    let lateDays = 0;

    attendanceRecords.forEach((record) => {
      switch (record.status) {
        case 'PRESENT':
          presentDays++;
          break;
        case 'ABSENT':
          absentDays++;
          break;
        case 'HALF_DAY':
          halfDays++;
          break;
        case 'LATE':
          lateDays++;
          presentDays++; // Late counts as present
          break;
        case 'EXCUSED':
          // Excused doesn't count as absent
          break;
      }
    });

    const effectivePresentDays = presentDays + halfDays * 0.5;
    const attendancePercentage =
      workingDaysInfo.effectiveWorkingDays > 0
        ? (effectivePresentDays / workingDaysInfo.effectiveWorkingDays) * 100
        : 0;

    return {
      ...workingDaysInfo,
      presentDays,
      absentDays,
      halfDays,
      lateDays,
      effectivePresentDays,
      attendancePercentage: Math.round(attendancePercentage * 100) / 100,
      totalRecords: attendanceRecords.length,
    };
  }

  async getLowAttendanceStudents(tenantId: string, branchId: string, threshold?: number) {
    const settings = await this.getSettings(tenantId, branchId);
    const alertThreshold = threshold ?? settings.alertSettings.lowAttendanceThreshold;

    // Get current academic batch
    const currentBatch = await collections.academicBatches.findOne({
      tenantId: new ObjectId(tenantId),
      status: 'active',
    });

    if (!currentBatch) {
      return { students: [], threshold: alertThreshold };
    }

    // Get all students in branch
    const students = await collections.students
      .find({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        status: 'active',
      })
      .project({ _id: 1, displayName: 1, enrollmentNumber: 1, classId: 1 })
      .toArray();

    const startDate = new Date(currentBatch.startDate);
    const endDate = new Date();

    const lowAttendanceStudents = [];

    for (const student of students) {
      const stats = await this.calculateAttendancePercentage(
        tenantId,
        branchId,
        student._id.toString(),
        startDate,
        endDate
      );

      if (stats.attendancePercentage < alertThreshold) {
        lowAttendanceStudents.push({
          _id: student._id.toString(),
          displayName: student.displayName,
          enrollmentNumber: student.enrollmentNumber,
          classId: student.classId?.toString(),
          attendancePercentage: stats.attendancePercentage,
          presentDays: stats.presentDays,
          absentDays: stats.absentDays,
          totalWorkingDays: stats.effectiveWorkingDays,
        });
      }
    }

    // Sort by attendance percentage ascending
    lowAttendanceStudents.sort((a, b) => a.attendancePercentage - b.attendancePercentage);

    return {
      students: lowAttendanceStudents,
      threshold: alertThreshold,
      total: lowAttendanceStudents.length,
    };
  }

  private formatSettings(settings: WithId<AttendanceSettingsDocument>) {
    return {
      _id: settings._id.toString(),
      branchId: settings.branchId.toString(),
      tenantId: settings.tenantId.toString(),
      generalSettings: settings.generalSettings || DEFAULT_GENERAL_SETTINGS,
      attendanceStatuses: settings.attendanceStatuses || DEFAULT_ATTENDANCE_STATUSES,
      alertSettings: settings.alertSettings || DEFAULT_ALERT_SETTINGS,
      exportSettings: settings.exportSettings || DEFAULT_EXPORT_SETTINGS,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };
  }
}

export const attendanceSettingsService = new AttendanceSettingsService();

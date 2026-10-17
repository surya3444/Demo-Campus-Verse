import { ObjectId, WithId, Document } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { generateSequence, padSequence } from '../../utils/generators';

// ============ Settings Types ============
interface NumberSequenceSettings {
  prefix: string;
  suffix?: string;
  startingNumber: number;
  currentNumber: number;
  padding: number; // number of digits to pad
  includeYear: boolean;
  yearFormat: '2' | '4'; // YY or YYYY
  separator?: string;
  resetYearly: boolean;
}

// Weekly Off configuration
interface WeeklyOffSettings {
  days: number[]; // 0-6, Sunday = 0
  alternateWeekday?: {
    enabled: boolean;
    day: number; // e.g., Saturday = 6
    pattern: 'first' | 'second' | 'third' | 'fourth' | 'alternate'; // which week(s)
  };
}

// Leave encashment settings
interface LeaveEncashmentSettings {
  enabled: boolean;
  eligibleLeaveTypes: string[];
  maxEncashableDays: number;
  minBalanceToRetain: number;
  encashmentRate: number; // percentage of basic salary per day
  processAtYearEnd: boolean;
}

// ============ RazorpayX Payout Settings ============
// Per-branch RazorpayX credentials — each school onboards their own X account
// so salary money never touches the platform's balance. Secret fields are
// encrypted at rest with the platform ENCRYPTION_KEY (see utils/crypto.ts).
export type RazorpayXStatus = 'not_configured' | 'connected' | 'invalid_credentials' | 'suspended';

export interface RazorpayXSettings {
  status: RazorpayXStatus;
  keyIdEncrypted?: string;
  keySecretEncrypted?: string;
  sourceAccountNumberEncrypted?: string;
  webhookSecretEncrypted?: string;
  keyIdMasked?: string; // e.g. "rzp_live_****ABCD" — safe to return in API
  sourceAccountNumberMasked?: string; // last 4 of source VA
  pennyDropEnabled: boolean; // defaults true; skips validation when false
  lastVerifiedAt?: Date;
  lastVerifiedBalancePaise?: number;
  createdAt: Date;
  updatedAt: Date;
}

interface HRSettingsDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;

  // Employee ID sequence settings
  employeeId: NumberSequenceSettings;

  // Leave settings
  leaveSettings: {
    maxConsecutiveDays: number;
    minAdvanceNotice: number; // days
    allowBackdatedLeave: boolean;
    backdatedDaysLimit: number;
    requireApproval: boolean;
    autoApproveTypes?: string[];
  };

  // Attendance settings
  attendanceSettings: {
    allowFlexibleTiming: boolean;
    graceMinutes: number;
    halfDayThresholdHours: number;
    minWorkHours: number;
    overtimeAfterHours: number;
    allowMultipleCheckIns: boolean;
  };

  // Leave types configuration
  leaveTypes: Array<{
    code: string;
    name: string;
    isPaid: boolean;
    defaultAllowance: number;
    carryForward: boolean;
    maxCarryForward?: number;
    requiresDocument: boolean;
    minDaysNotice: number;
    color: string;
    isActive: boolean;
  }>;

  // Shift configuration
  shifts: Array<{
    code: string;
    name: string;
    startTime: string; // HH:mm format
    endTime: string; // HH:mm format
    breakDuration: number; // minutes
    workingDays: number[]; // 0-6, Sunday = 0
    isDefault: boolean;
    isActive: boolean;
    color: string;
  }>;

  // Weekly offs configuration (branch-level)
  weeklyOffs: WeeklyOffSettings;

  // Leave encashment settings
  leaveEncashment: LeaveEncashmentSettings;

  // RazorpayX (salary payouts) — optional, populated once the school
  // onboards their X account through the HR Settings tab.
  razorpayX?: RazorpayXSettings;

  createdAt: Date;
  updatedAt: Date;
}

const DEFAULT_EMPLOYEE_ID_SETTINGS: NumberSequenceSettings = {
  prefix: 'EMP',
  startingNumber: 1,
  currentNumber: 0,
  padding: 5,
  includeYear: false,
  yearFormat: '2',
  separator: '',
  resetYearly: false,
};

const DEFAULT_LEAVE_SETTINGS = {
  maxConsecutiveDays: 30,
  minAdvanceNotice: 1,
  allowBackdatedLeave: false,
  backdatedDaysLimit: 7,
  requireApproval: true,
  autoApproveTypes: [],
};

const DEFAULT_ATTENDANCE_SETTINGS = {
  allowFlexibleTiming: true,
  graceMinutes: 15,
  halfDayThresholdHours: 4,
  minWorkHours: 8,
  overtimeAfterHours: 9,
  allowMultipleCheckIns: false,
};

const DEFAULT_LEAVE_TYPES = [
  {
    code: 'CL',
    name: 'Casual Leave',
    isPaid: true,
    defaultAllowance: 12,
    carryForward: false,
    requiresDocument: false,
    minDaysNotice: 1,
    color: '#3B82F6',
    isActive: true,
  },
  {
    code: 'SL',
    name: 'Sick Leave',
    isPaid: true,
    defaultAllowance: 12,
    carryForward: false,
    requiresDocument: true,
    minDaysNotice: 0,
    color: '#EF4444',
    isActive: true,
  },
  {
    code: 'EL',
    name: 'Earned Leave',
    isPaid: true,
    defaultAllowance: 15,
    carryForward: true,
    maxCarryForward: 30,
    requiresDocument: false,
    minDaysNotice: 7,
    color: '#10B981',
    isActive: true,
  },
  {
    code: 'LWP',
    name: 'Leave Without Pay',
    isPaid: false,
    defaultAllowance: 0,
    carryForward: false,
    requiresDocument: false,
    minDaysNotice: 3,
    color: '#6B7280',
    isActive: true,
  },
];

const DEFAULT_SHIFTS = [
  {
    code: 'GENERAL',
    name: 'General Shift',
    startTime: '09:00',
    endTime: '17:00',
    breakDuration: 60, // 1 hour lunch break
    workingDays: [1, 2, 3, 4, 5], // Monday to Friday
    isDefault: true,
    isActive: true,
    color: '#3B82F6',
  },
  {
    code: 'MORNING',
    name: 'Morning Shift',
    startTime: '07:00',
    endTime: '14:00',
    breakDuration: 30,
    workingDays: [1, 2, 3, 4, 5, 6], // Monday to Saturday
    isDefault: false,
    isActive: true,
    color: '#F59E0B',
  },
  {
    code: 'EVENING',
    name: 'Evening Shift',
    startTime: '14:00',
    endTime: '21:00',
    breakDuration: 30,
    workingDays: [1, 2, 3, 4, 5, 6],
    isDefault: false,
    isActive: true,
    color: '#8B5CF6',
  },
];

const DEFAULT_WEEKLY_OFFS: WeeklyOffSettings = {
  days: [0], // Sunday
  alternateWeekday: {
    enabled: false,
    day: 6, // Saturday
    pattern: 'alternate',
  },
};

const DEFAULT_LEAVE_ENCASHMENT: LeaveEncashmentSettings = {
  enabled: false,
  eligibleLeaveTypes: ['EL'], // Only earned leave by default
  maxEncashableDays: 30,
  minBalanceToRetain: 0,
  encashmentRate: 100, // 100% of basic salary per day
  processAtYearEnd: true,
};

class HRSettingsService {
  async getSettings(tenantId: string, branchId: string) {
    // Verify branch exists and belongs to tenant
    const branch = await collections.branches.findOne({
      _id: new ObjectId(branchId),
      tenantId: new ObjectId(tenantId),
    });

    if (!branch) {
      throw new ApiError('BRANCH_NOT_FOUND', 'Branch not found', 404);
    }

    let settings = (await collections.hrSettings.findOne({
      branchId: new ObjectId(branchId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<HRSettingsDocument> | null;

    // If no settings exist, create default settings
    if (!settings) {
      const now = new Date();
      const newSettings = {
        _id: new ObjectId(),
        branchId: new ObjectId(branchId),
        tenantId: new ObjectId(tenantId),
        employeeId: DEFAULT_EMPLOYEE_ID_SETTINGS,
        leaveSettings: DEFAULT_LEAVE_SETTINGS,
        attendanceSettings: DEFAULT_ATTENDANCE_SETTINGS,
        leaveTypes: DEFAULT_LEAVE_TYPES,
        shifts: DEFAULT_SHIFTS,
        weeklyOffs: DEFAULT_WEEKLY_OFFS,
        leaveEncashment: DEFAULT_LEAVE_ENCASHMENT,
        createdAt: now,
        updatedAt: now,
      } as HRSettingsDocument;

      await collections.hrSettings.insertOne(newSettings);
      settings = newSettings as WithId<HRSettingsDocument>;
    }

    return this.formatSettings(settings);
  }

  async updateSettings(
    tenantId: string,
    branchId: string,
    data: Partial<{
      employeeId: Partial<NumberSequenceSettings>;
      leaveSettings: Partial<HRSettingsDocument['leaveSettings']>;
      attendanceSettings: Partial<HRSettingsDocument['attendanceSettings']>;
      leaveTypes: HRSettingsDocument['leaveTypes'];
      shifts: HRSettingsDocument['shifts'];
    }>,
    updatedBy: string
  ) {
    // Verify branch exists
    const branch = await collections.branches.findOne({
      _id: new ObjectId(branchId),
      tenantId: new ObjectId(tenantId),
    });

    if (!branch) {
      throw new ApiError('BRANCH_NOT_FOUND', 'Branch not found', 404);
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    // Build update object with dot notation for nested fields
    if (data.employeeId) {
      if (data.employeeId.prefix !== undefined) {
        updateData['employeeId.prefix'] = data.employeeId.prefix;
      }
      if (data.employeeId.suffix !== undefined) {
        updateData['employeeId.suffix'] = data.employeeId.suffix;
      }
      if (data.employeeId.padding !== undefined) {
        updateData['employeeId.padding'] = data.employeeId.padding;
      }
      if (data.employeeId.includeYear !== undefined) {
        updateData['employeeId.includeYear'] = data.employeeId.includeYear;
      }
      if (data.employeeId.yearFormat !== undefined) {
        updateData['employeeId.yearFormat'] = data.employeeId.yearFormat;
      }
      if (data.employeeId.separator !== undefined) {
        updateData['employeeId.separator'] = data.employeeId.separator;
      }
      if (data.employeeId.resetYearly !== undefined) {
        updateData['employeeId.resetYearly'] = data.employeeId.resetYearly;
      }
    }

    if (data.leaveSettings) {
      if (data.leaveSettings.maxConsecutiveDays !== undefined) {
        updateData['leaveSettings.maxConsecutiveDays'] = data.leaveSettings.maxConsecutiveDays;
      }
      if (data.leaveSettings.minAdvanceNotice !== undefined) {
        updateData['leaveSettings.minAdvanceNotice'] = data.leaveSettings.minAdvanceNotice;
      }
      if (data.leaveSettings.allowBackdatedLeave !== undefined) {
        updateData['leaveSettings.allowBackdatedLeave'] = data.leaveSettings.allowBackdatedLeave;
      }
      if (data.leaveSettings.backdatedDaysLimit !== undefined) {
        updateData['leaveSettings.backdatedDaysLimit'] = data.leaveSettings.backdatedDaysLimit;
      }
      if (data.leaveSettings.requireApproval !== undefined) {
        updateData['leaveSettings.requireApproval'] = data.leaveSettings.requireApproval;
      }
      if (data.leaveSettings.autoApproveTypes !== undefined) {
        updateData['leaveSettings.autoApproveTypes'] = data.leaveSettings.autoApproveTypes;
      }
    }

    if (data.attendanceSettings) {
      if (data.attendanceSettings.allowFlexibleTiming !== undefined) {
        updateData['attendanceSettings.allowFlexibleTiming'] =
          data.attendanceSettings.allowFlexibleTiming;
      }
      if (data.attendanceSettings.graceMinutes !== undefined) {
        updateData['attendanceSettings.graceMinutes'] = data.attendanceSettings.graceMinutes;
      }
      if (data.attendanceSettings.halfDayThresholdHours !== undefined) {
        updateData['attendanceSettings.halfDayThresholdHours'] =
          data.attendanceSettings.halfDayThresholdHours;
      }
      if (data.attendanceSettings.minWorkHours !== undefined) {
        updateData['attendanceSettings.minWorkHours'] = data.attendanceSettings.minWorkHours;
      }
      if (data.attendanceSettings.overtimeAfterHours !== undefined) {
        updateData['attendanceSettings.overtimeAfterHours'] =
          data.attendanceSettings.overtimeAfterHours;
      }
      if (data.attendanceSettings.allowMultipleCheckIns !== undefined) {
        updateData['attendanceSettings.allowMultipleCheckIns'] =
          data.attendanceSettings.allowMultipleCheckIns;
      }
    }

    if (data.leaveTypes !== undefined) {
      updateData.leaveTypes = data.leaveTypes;
    }

    if (data.shifts !== undefined) {
      updateData.shifts = data.shifts;
    }

    // Upsert the settings
    const result = await collections.hrSettings.findOneAndUpdate(
      {
        branchId: new ObjectId(branchId),
        tenantId: new ObjectId(tenantId),
      },
      {
        $set: updateData,
        $setOnInsert: {
          branchId: new ObjectId(branchId),
          tenantId: new ObjectId(tenantId),
          employeeId: DEFAULT_EMPLOYEE_ID_SETTINGS,
          leaveSettings: DEFAULT_LEAVE_SETTINGS,
          attendanceSettings: DEFAULT_ATTENDANCE_SETTINGS,
          leaveTypes: DEFAULT_LEAVE_TYPES,
          shifts: DEFAULT_SHIFTS,
          weeklyOffs: DEFAULT_WEEKLY_OFFS,
          leaveEncashment: DEFAULT_LEAVE_ENCASHMENT,
          createdAt: new Date(),
        },
      },
      {
        upsert: true,
        returnDocument: 'after',
      }
    );

    logger.info({ branchId, tenantId, updatedBy }, 'HR settings updated');

    return this.formatSettings(result as WithId<HRSettingsDocument>);
  }

  async generateEmployeeId(tenantId: string, branchId: string): Promise<string> {
    // Get HR settings for employee ID format
    const settings = await this.getSettings(tenantId, branchId);
    const empIdSettings = settings.employeeId;

    // Generate sequence
    const sequenceType = empIdSettings.resetYearly
      ? `employeeId_${new Date().getFullYear()}`
      : 'employeeId';

    const sequence = await generateSequence(sequenceType, tenantId, branchId);

    // Build employee ID
    let employeeId = empIdSettings.prefix;

    if (empIdSettings.separator) {
      employeeId += empIdSettings.separator;
    }

    if (empIdSettings.includeYear) {
      const year =
        empIdSettings.yearFormat === '2'
          ? new Date().getFullYear().toString().slice(-2)
          : new Date().getFullYear().toString();
      employeeId += year;
      if (empIdSettings.separator) {
        employeeId += empIdSettings.separator;
      }
    }

    employeeId += padSequence(sequence, empIdSettings.padding);

    if (empIdSettings.suffix) {
      if (empIdSettings.separator) {
        employeeId += empIdSettings.separator;
      }
      employeeId += empIdSettings.suffix;
    }

    return employeeId;
  }

  async addLeaveType(
    tenantId: string,
    branchId: string,
    leaveType: HRSettingsDocument['leaveTypes'][0],
    addedBy: string
  ) {
    // Check for duplicate code
    const existingSettings = await collections.hrSettings.findOne({
      branchId: new ObjectId(branchId),
      tenantId: new ObjectId(tenantId),
      'leaveTypes.code': leaveType.code,
    });

    if (existingSettings) {
      throw new ApiError('DUPLICATE_LEAVE_TYPE', 'Leave type with this code already exists', 409);
    }

    const result = await collections.hrSettings.findOneAndUpdate(
      {
        branchId: new ObjectId(branchId),
        tenantId: new ObjectId(tenantId),
      },
      {
        $push: { leaveTypes: leaveType } as unknown,
        $set: { updatedAt: new Date() },
        $setOnInsert: {
          branchId: new ObjectId(branchId),
          tenantId: new ObjectId(tenantId),
          employeeId: DEFAULT_EMPLOYEE_ID_SETTINGS,
          leaveSettings: DEFAULT_LEAVE_SETTINGS,
          attendanceSettings: DEFAULT_ATTENDANCE_SETTINGS,
          createdAt: new Date(),
        },
      } as Document,
      {
        upsert: true,
        returnDocument: 'after',
      }
    );

    logger.info({ branchId, tenantId, leaveType: leaveType.code, addedBy }, 'Leave type added');

    return this.formatSettings(result as unknown as WithId<HRSettingsDocument>);
  }

  async updateLeaveType(
    tenantId: string,
    branchId: string,
    leaveTypeCode: string,
    data: Partial<HRSettingsDocument['leaveTypes'][0]>,
    updatedBy: string
  ) {
    const updateFields: Record<string, unknown> = {};

    if (data.name !== undefined) updateFields['leaveTypes.$.name'] = data.name;
    if (data.isPaid !== undefined) updateFields['leaveTypes.$.isPaid'] = data.isPaid;
    if (data.defaultAllowance !== undefined)
      updateFields['leaveTypes.$.defaultAllowance'] = data.defaultAllowance;
    if (data.carryForward !== undefined)
      updateFields['leaveTypes.$.carryForward'] = data.carryForward;
    if (data.maxCarryForward !== undefined)
      updateFields['leaveTypes.$.maxCarryForward'] = data.maxCarryForward;
    if (data.requiresDocument !== undefined)
      updateFields['leaveTypes.$.requiresDocument'] = data.requiresDocument;
    if (data.minDaysNotice !== undefined)
      updateFields['leaveTypes.$.minDaysNotice'] = data.minDaysNotice;
    if (data.color !== undefined) updateFields['leaveTypes.$.color'] = data.color;
    if (data.isActive !== undefined) updateFields['leaveTypes.$.isActive'] = data.isActive;

    updateFields.updatedAt = new Date();

    const result = await collections.hrSettings.findOneAndUpdate(
      {
        branchId: new ObjectId(branchId),
        tenantId: new ObjectId(tenantId),
        'leaveTypes.code': leaveTypeCode,
      },
      { $set: updateFields },
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new ApiError('LEAVE_TYPE_NOT_FOUND', 'Leave type not found', 404);
    }

    logger.info({ branchId, tenantId, leaveTypeCode, updatedBy }, 'Leave type updated');

    return this.formatSettings(result as unknown as WithId<HRSettingsDocument>);
  }

  async deleteLeaveType(
    tenantId: string,
    branchId: string,
    leaveTypeCode: string,
    deletedBy: string
  ) {
    const result = await collections.hrSettings.findOneAndUpdate(
      {
        branchId: new ObjectId(branchId),
        tenantId: new ObjectId(tenantId),
      },
      {
        $pull: { leaveTypes: { code: leaveTypeCode } } as unknown,
        $set: { updatedAt: new Date() },
      } as Document,
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new ApiError('SETTINGS_NOT_FOUND', 'HR settings not found', 404);
    }

    logger.info({ branchId, tenantId, leaveTypeCode, deletedBy }, 'Leave type deleted');

    return this.formatSettings(result as unknown as WithId<HRSettingsDocument>);
  }

  // ============ Shift Management Methods ============
  async addShift(
    tenantId: string,
    branchId: string,
    shift: HRSettingsDocument['shifts'][0],
    addedBy: string
  ) {
    // Check for duplicate code
    const existingSettings = await collections.hrSettings.findOne({
      branchId: new ObjectId(branchId),
      tenantId: new ObjectId(tenantId),
      'shifts.code': shift.code,
    });

    if (existingSettings) {
      throw new ApiError('DUPLICATE_SHIFT', 'Shift with this code already exists', 409);
    }

    // If this is the default shift, unset other defaults
    if (shift.isDefault) {
      await collections.hrSettings.updateOne(
        { branchId: new ObjectId(branchId), tenantId: new ObjectId(tenantId) },
        { $set: { 'shifts.$[].isDefault': false } }
      );
    }

    const result = await collections.hrSettings.findOneAndUpdate(
      {
        branchId: new ObjectId(branchId),
        tenantId: new ObjectId(tenantId),
      },
      {
        $push: { shifts: shift } as unknown,
        $set: { updatedAt: new Date() },
        $setOnInsert: {
          branchId: new ObjectId(branchId),
          tenantId: new ObjectId(tenantId),
          employeeId: DEFAULT_EMPLOYEE_ID_SETTINGS,
          leaveSettings: DEFAULT_LEAVE_SETTINGS,
          attendanceSettings: DEFAULT_ATTENDANCE_SETTINGS,
          leaveTypes: DEFAULT_LEAVE_TYPES,
          weeklyOffs: DEFAULT_WEEKLY_OFFS,
          leaveEncashment: DEFAULT_LEAVE_ENCASHMENT,
          createdAt: new Date(),
        },
      } as Document,
      {
        upsert: true,
        returnDocument: 'after',
      }
    );

    logger.info({ branchId, tenantId, shiftCode: shift.code, addedBy }, 'Shift added');

    return this.formatSettings(result as unknown as WithId<HRSettingsDocument>);
  }

  async updateShift(
    tenantId: string,
    branchId: string,
    shiftCode: string,
    data: Partial<HRSettingsDocument['shifts'][0]>,
    updatedBy: string
  ) {
    const updateFields: Record<string, unknown> = {};

    if (data.name !== undefined) updateFields['shifts.$.name'] = data.name;
    if (data.startTime !== undefined) updateFields['shifts.$.startTime'] = data.startTime;
    if (data.endTime !== undefined) updateFields['shifts.$.endTime'] = data.endTime;
    if (data.breakDuration !== undefined)
      updateFields['shifts.$.breakDuration'] = data.breakDuration;
    if (data.workingDays !== undefined) updateFields['shifts.$.workingDays'] = data.workingDays;
    if (data.isActive !== undefined) updateFields['shifts.$.isActive'] = data.isActive;
    if (data.color !== undefined) updateFields['shifts.$.color'] = data.color;

    // Handle isDefault specially
    if (data.isDefault === true) {
      await collections.hrSettings.updateOne(
        { branchId: new ObjectId(branchId), tenantId: new ObjectId(tenantId) },
        { $set: { 'shifts.$[].isDefault': false } }
      );
      updateFields['shifts.$.isDefault'] = true;
    }

    updateFields.updatedAt = new Date();

    const result = await collections.hrSettings.findOneAndUpdate(
      {
        branchId: new ObjectId(branchId),
        tenantId: new ObjectId(tenantId),
        'shifts.code': shiftCode,
      },
      { $set: updateFields },
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new ApiError('SHIFT_NOT_FOUND', 'Shift not found', 404);
    }

    logger.info({ branchId, tenantId, shiftCode, updatedBy }, 'Shift updated');

    return this.formatSettings(result as unknown as WithId<HRSettingsDocument>);
  }

  async deleteShift(tenantId: string, branchId: string, shiftCode: string, deletedBy: string) {
    // Check if it's the only shift or default shift
    const settings = await collections.hrSettings.findOne({
      branchId: new ObjectId(branchId),
      tenantId: new ObjectId(tenantId),
    });

    if (settings?.shifts?.length <= 1) {
      throw new ApiError('CANNOT_DELETE', 'Cannot delete the only shift', 400);
    }

    const shiftToDelete = settings?.shifts?.find((s: { code: string }) => s.code === shiftCode);
    if (shiftToDelete?.isDefault) {
      throw new ApiError(
        'CANNOT_DELETE_DEFAULT',
        'Cannot delete the default shift. Set another shift as default first.',
        400
      );
    }

    const result = await collections.hrSettings.findOneAndUpdate(
      {
        branchId: new ObjectId(branchId),
        tenantId: new ObjectId(tenantId),
      },
      {
        $pull: { shifts: { code: shiftCode } } as unknown,
        $set: { updatedAt: new Date() },
      } as Document,
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new ApiError('SETTINGS_NOT_FOUND', 'HR settings not found', 404);
    }

    logger.info({ branchId, tenantId, shiftCode, deletedBy }, 'Shift deleted');

    return this.formatSettings(result as unknown as WithId<HRSettingsDocument>);
  }

  // ============ Weekly Offs Methods ============
  async updateWeeklyOffs(
    tenantId: string,
    branchId: string,
    data: Partial<WeeklyOffSettings>,
    updatedBy: string
  ) {
    const updateFields: Record<string, unknown> = { updatedAt: new Date() };

    if (data.days !== undefined) updateFields['weeklyOffs.days'] = data.days;
    if (data.alternateWeekday !== undefined) {
      if (data.alternateWeekday.enabled !== undefined)
        updateFields['weeklyOffs.alternateWeekday.enabled'] = data.alternateWeekday.enabled;
      if (data.alternateWeekday.day !== undefined)
        updateFields['weeklyOffs.alternateWeekday.day'] = data.alternateWeekday.day;
      if (data.alternateWeekday.pattern !== undefined)
        updateFields['weeklyOffs.alternateWeekday.pattern'] = data.alternateWeekday.pattern;
    }

    const result = await collections.hrSettings.findOneAndUpdate(
      {
        branchId: new ObjectId(branchId),
        tenantId: new ObjectId(tenantId),
      },
      {
        $set: updateFields,
        $setOnInsert: {
          branchId: new ObjectId(branchId),
          tenantId: new ObjectId(tenantId),
          employeeId: DEFAULT_EMPLOYEE_ID_SETTINGS,
          leaveSettings: DEFAULT_LEAVE_SETTINGS,
          attendanceSettings: DEFAULT_ATTENDANCE_SETTINGS,
          leaveTypes: DEFAULT_LEAVE_TYPES,
          shifts: DEFAULT_SHIFTS,
          weeklyOffs: DEFAULT_WEEKLY_OFFS,
          leaveEncashment: DEFAULT_LEAVE_ENCASHMENT,
          createdAt: new Date(),
        },
      },
      {
        upsert: true,
        returnDocument: 'after',
      }
    );

    logger.info({ branchId, tenantId, updatedBy }, 'Weekly offs updated');

    return this.formatSettings(result as unknown as WithId<HRSettingsDocument>);
  }

  // ============ Leave Encashment Methods ============
  async updateLeaveEncashment(
    tenantId: string,
    branchId: string,
    data: Partial<LeaveEncashmentSettings>,
    updatedBy: string
  ) {
    const updateFields: Record<string, unknown> = { updatedAt: new Date() };

    if (data.enabled !== undefined) updateFields['leaveEncashment.enabled'] = data.enabled;
    if (data.eligibleLeaveTypes !== undefined)
      updateFields['leaveEncashment.eligibleLeaveTypes'] = data.eligibleLeaveTypes;
    if (data.maxEncashableDays !== undefined)
      updateFields['leaveEncashment.maxEncashableDays'] = data.maxEncashableDays;
    if (data.minBalanceToRetain !== undefined)
      updateFields['leaveEncashment.minBalanceToRetain'] = data.minBalanceToRetain;
    if (data.encashmentRate !== undefined)
      updateFields['leaveEncashment.encashmentRate'] = data.encashmentRate;
    if (data.processAtYearEnd !== undefined)
      updateFields['leaveEncashment.processAtYearEnd'] = data.processAtYearEnd;

    const result = await collections.hrSettings.findOneAndUpdate(
      {
        branchId: new ObjectId(branchId),
        tenantId: new ObjectId(tenantId),
      },
      {
        $set: updateFields,
        $setOnInsert: {
          branchId: new ObjectId(branchId),
          tenantId: new ObjectId(tenantId),
          employeeId: DEFAULT_EMPLOYEE_ID_SETTINGS,
          leaveSettings: DEFAULT_LEAVE_SETTINGS,
          attendanceSettings: DEFAULT_ATTENDANCE_SETTINGS,
          leaveTypes: DEFAULT_LEAVE_TYPES,
          shifts: DEFAULT_SHIFTS,
          weeklyOffs: DEFAULT_WEEKLY_OFFS,
          createdAt: new Date(),
        },
      },
      {
        upsert: true,
        returnDocument: 'after',
      }
    );

    logger.info({ branchId, tenantId, updatedBy }, 'Leave encashment settings updated');

    return this.formatSettings(result as unknown as WithId<HRSettingsDocument>);
  }

  private formatSettings(settings: WithId<HRSettingsDocument>) {
    return {
      _id: settings._id.toString(),
      branchId: settings.branchId.toString(),
      tenantId: settings.tenantId.toString(),
      employeeId: settings.employeeId,
      leaveSettings: settings.leaveSettings,
      attendanceSettings: settings.attendanceSettings,
      leaveTypes: settings.leaveTypes,
      shifts: settings.shifts,
      weeklyOffs: settings.weeklyOffs || DEFAULT_WEEKLY_OFFS,
      leaveEncashment: settings.leaveEncashment || DEFAULT_LEAVE_ENCASHMENT,
      razorpayX: settings.razorpayX ? maskRazorpayX(settings.razorpayX) : null,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };
  }
}

/**
 * Public view of the RazorpayX block: encrypted blobs are stripped, only the
 * masked hints + status + timestamps remain. Never leak the raw key/secret.
 */
function maskRazorpayX(rx: RazorpayXSettings) {
  return {
    status: rx.status,
    keyIdMasked: rx.keyIdMasked ?? null,
    sourceAccountNumberMasked: rx.sourceAccountNumberMasked ?? null,
    pennyDropEnabled: rx.pennyDropEnabled,
    lastVerifiedAt: rx.lastVerifiedAt ?? null,
    lastVerifiedBalancePaise: rx.lastVerifiedBalancePaise ?? null,
    createdAt: rx.createdAt,
    updatedAt: rx.updatedAt,
  };
}

export type { HRSettingsDocument };
export const hrSettingsService = new HRSettingsService();

import { ObjectId, WithId, Document, UpdateFilter } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';

interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

interface StaffAttendanceDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  date: Date;
  records: Array<{
    staffId: ObjectId;
    status: 'present' | 'absent' | 'late' | 'half_day' | 'on_leave' | 'holiday';
    checkIn?: Date;
    checkOut?: Date;
    workingHours?: number;
    remarks?: string;
    markedBy: ObjectId;
    markedAt: Date;
    selfMarked?: boolean;
    checkInLocation?: GeoLocation;
    checkOutLocation?: GeoLocation;
  }>;
  isLocked: boolean;
  lockedAt?: Date;
  lockedBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface MarkStaffAttendanceInput {
  date: string;
  records: Array<{
    staffId: string;
    status: 'present' | 'absent' | 'late' | 'half_day' | 'on_leave' | 'holiday';
    checkIn?: string;
    checkOut?: string;
    remarks?: string;
  }>;
}

class StaffAttendanceService {
  async markAttendance(
    tenantId: string,
    branchId: string,
    data: MarkStaffAttendanceInput,
    markedBy: string
  ) {
    const attendanceDate = new Date(data.date);
    attendanceDate.setHours(0, 0, 0, 0);
    const now = new Date();

    // Check if attendance exists for this date
    const existing = (await collections.staffAttendance.findOne({
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      date: attendanceDate,
    })) as WithId<StaffAttendanceDocument> | null;

    if (existing?.isLocked) {
      throw new ApiError('ATTENDANCE_LOCKED', 'Attendance for this date is locked', 400);
    }

    const records = data.records.map((r) => ({
      staffId: new ObjectId(r.staffId),
      status: r.status,
      checkIn: r.checkIn ? new Date(`${data.date}T${r.checkIn}`) : undefined,
      checkOut: r.checkOut ? new Date(`${data.date}T${r.checkOut}`) : undefined,
      workingHours:
        r.checkIn && r.checkOut ? this.calculateWorkingHours(r.checkIn, r.checkOut) : undefined,
      remarks: r.remarks,
      markedBy: new ObjectId(markedBy),
      markedAt: now,
    }));

    if (existing) {
      // Update existing records
      const newStaffIds = new Set(records.map((r) => r.staffId.toString()));

      // Merge records
      const mergedRecords = existing.records.filter((r) => !newStaffIds.has(r.staffId.toString()));
      mergedRecords.push(...records);

      await collections.staffAttendance.updateOne(
        { _id: existing._id },
        {
          $set: {
            records: mergedRecords,
            updatedAt: now,
          },
        }
      );

      logger.info(
        { branchId, date: data.date, recordCount: records.length, tenantId },
        'Staff attendance updated'
      );
    } else {
      // Create new attendance record
      const attendance: Omit<StaffAttendanceDocument, '_id'> & { _id: ObjectId } = {
        _id: new ObjectId(),
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        date: attendanceDate,
        records,
        isLocked: false,
        createdAt: now,
        updatedAt: now,
      };

      await collections.staffAttendance.insertOne(attendance);

      logger.info(
        { branchId, date: data.date, recordCount: records.length, tenantId },
        'Staff attendance created'
      );
    }

    return this.findByDate(tenantId, branchId, data.date);
  }

  async findByDate(tenantId: string, branchId: string, date: string, departmentId?: string) {
    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);

    // Build department filter
    const departmentMatch = departmentId
      ? { 'staffInfo.employment.departmentId': new ObjectId(departmentId) }
      : {};

    const attendance = (await collections.staffAttendance
      .aggregate([
        {
          $match: {
            tenantId: new ObjectId(tenantId),
            branchId: new ObjectId(branchId),
            date: attendanceDate,
          },
        },
        { $unwind: '$records' },
        {
          $lookup: {
            from: 'staff',
            localField: 'records.staffId',
            foreignField: '_id',
            as: 'staffInfo',
          },
        },
        { $unwind: '$staffInfo' },
        { $match: departmentMatch },
        {
          $lookup: {
            from: 'departments',
            localField: 'staffInfo.employment.departmentId',
            foreignField: '_id',
            as: 'departmentInfo',
          },
        },
        {
          $group: {
            _id: '$_id',
            tenantId: { $first: '$tenantId' },
            branchId: { $first: '$branchId' },
            date: { $first: '$date' },
            isLocked: { $first: '$isLocked' },
            records: {
              $push: {
                staffId: '$records.staffId',
                staffName: {
                  $concat: ['$staffInfo.firstName', ' ', '$staffInfo.lastName'],
                },
                employeeId: '$staffInfo.employeeId',
                departmentId: '$staffInfo.employment.departmentId',
                departmentName: { $arrayElemAt: ['$departmentInfo.name', 0] },
                status: '$records.status',
                checkIn: '$records.checkIn',
                checkOut: '$records.checkOut',
                workingHours: '$records.workingHours',
                remarks: '$records.remarks',
              },
            },
          },
        },
      ])
      .toArray()) as unknown[];

    if (attendance.length === 0) {
      // Return empty template with all active staff
      const staffFilter: Record<string, unknown> = {
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        status: 'active',
      };
      if (departmentId) {
        staffFilter['employment.departmentId'] = new ObjectId(departmentId);
      }

      const staff = await collections.staff
        .find(staffFilter)
        .project({ _id: 1, firstName: 1, lastName: 1, employeeId: 1, 'employment.departmentId': 1 })
        .toArray();

      return {
        date: attendanceDate,
        isLocked: false,
        departmentId: departmentId || null,
        records: staff.map((s) => ({
          staffId: s._id.toString(),
          staffName: `${s.firstName} ${s.lastName}`,
          employeeId: s.employeeId,
          departmentId: s.employment?.departmentId?.toString() || null,
          status: null,
        })),
        summary: {
          total: staff.length,
          present: 0,
          absent: 0,
          late: 0,
          halfDay: 0,
          onLeave: 0,
        },
      };
    }

    const result = attendance[0] as {
      _id: ObjectId;
      date: Date;
      isLocked: boolean;
      records: Array<{
        staffId: ObjectId;
        staffName: string;
        employeeId: string;
        status: string;
        checkIn?: Date;
        checkOut?: Date;
        workingHours?: number;
        remarks?: string;
      }>;
    };

    const summary = {
      total: result.records.length,
      present: result.records.filter((r) => r.status === 'present').length,
      absent: result.records.filter((r) => r.status === 'absent').length,
      late: result.records.filter((r) => r.status === 'late').length,
      halfDay: result.records.filter((r) => r.status === 'half_day').length,
      onLeave: result.records.filter((r) => r.status === 'on_leave').length,
    };

    return {
      _id: result._id.toString(),
      date: result.date,
      isLocked: result.isLocked,
      records: result.records.map((r) => ({
        ...r,
        staffId: r.staffId.toString(),
      })),
      summary,
    };
  }

  async getMyAttendance(tenantId: string, staffId: string, month?: number, year?: number) {
    const now = new Date();
    const targetYear = year || now.getFullYear();
    const targetMonth = month || now.getMonth() + 1;

    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0);

    const attendance = await collections.staffAttendance
      .aggregate([
        {
          $match: {
            tenantId: new ObjectId(tenantId),
            date: { $gte: startDate, $lte: endDate },
          },
        },
        { $unwind: '$records' },
        {
          $match: {
            'records.staffId': new ObjectId(staffId),
          },
        },
        {
          $project: {
            date: 1,
            status: '$records.status',
            checkIn: '$records.checkIn',
            checkOut: '$records.checkOut',
            workingHours: '$records.workingHours',
            remarks: '$records.remarks',
          },
        },
        { $sort: { date: 1 } },
      ])
      .toArray();

    const summary = {
      total: attendance.length,
      present: attendance.filter((a) => a.status === 'present').length,
      absent: attendance.filter((a) => a.status === 'absent').length,
      late: attendance.filter((a) => a.status === 'late').length,
      halfDay: attendance.filter((a) => a.status === 'half_day').length,
      onLeave: attendance.filter((a) => a.status === 'on_leave').length,
      totalWorkingHours: attendance.reduce((sum, a) => sum + (a.workingHours || 0), 0),
    };

    return {
      month: targetMonth,
      year: targetYear,
      records: attendance,
      summary,
    };
  }

  // ============ Self Check-in / Check-out ============

  async getSelfToday(tenantId: string, staffId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [doc, monthData] = await Promise.all([
      collections.staffAttendance.findOne({
        tenantId: new ObjectId(tenantId),
        date: today,
        'records.staffId': new ObjectId(staffId),
      }) as Promise<WithId<StaffAttendanceDocument> | null>,
      this.getMyAttendance(tenantId, staffId),
    ]);

    const record = doc?.records.find((r) => r.staffId.toString() === staffId);

    return {
      date: today,
      isLocked: doc?.isLocked ?? false,
      record:
        doc && record
          ? {
              status: record.status,
              checkIn: record.checkIn ?? null,
              checkOut: record.checkOut ?? null,
              workingHours: record.workingHours ?? null,
              selfMarked: record.selfMarked ?? false,
              checkInLocation: record.checkInLocation ?? null,
              checkOutLocation: record.checkOutLocation ?? null,
            }
          : null,
      monthSummary: monthData.summary,
    };
  }

  async selfCheckIn(tenantId: string, branchId: string, staffId: string, location?: GeoLocation) {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const tenantOid = new ObjectId(tenantId);
    const branchOid = new ObjectId(branchId);
    const staffOid = new ObjectId(staffId);

    const existing = (await collections.staffAttendance.findOne({
      tenantId: tenantOid,
      branchId: branchOid,
      date: today,
    })) as WithId<StaffAttendanceDocument> | null;

    if (existing?.isLocked) {
      throw new ApiError('ATTENDANCE_LOCKED', 'Attendance for today is locked', 400);
    }

    const myRecord = existing?.records.find((r) => r.staffId.toString() === staffId);
    if (myRecord?.checkIn) {
      throw new ApiError('ALREADY_CHECKED_IN', 'You have already checked in today', 400);
    }

    if (existing && myRecord) {
      // Record exists (e.g., pre-marked by admin) — attach check-in to it
      await collections.staffAttendance.updateOne(
        { _id: existing._id },
        {
          $set: {
            'records.$[r].status': 'present',
            'records.$[r].checkIn': now,
            'records.$[r].selfMarked': true,
            ...(location ? { 'records.$[r].checkInLocation': location } : {}),
            updatedAt: now,
          },
        },
        { arrayFilters: [{ 'r.staffId': staffOid }] }
      );
    } else if (existing) {
      await collections.staffAttendance.updateOne({ _id: existing._id }, {
        $push: {
          records: {
            staffId: staffOid,
            status: 'present',
            checkIn: now,
            selfMarked: true,
            ...(location ? { checkInLocation: location } : {}),
            markedBy: staffOid,
            markedAt: now,
          },
        },
        $set: { updatedAt: now },
      } as unknown as UpdateFilter<Document>);
    } else {
      await collections.staffAttendance.insertOne({
        _id: new ObjectId(),
        tenantId: tenantOid,
        branchId: branchOid,
        date: today,
        records: [
          {
            staffId: staffOid,
            status: 'present',
            checkIn: now,
            selfMarked: true,
            ...(location ? { checkInLocation: location } : {}),
            markedBy: staffOid,
            markedAt: now,
          },
        ],
        isLocked: false,
        createdAt: now,
        updatedAt: now,
      });
    }

    logger.info({ tenantId, branchId, staffId, hasLocation: !!location }, 'Staff self check-in');

    return this.getSelfToday(tenantId, staffId);
  }

  async selfCheckOut(tenantId: string, branchId: string, staffId: string, location?: GeoLocation) {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const staffOid = new ObjectId(staffId);

    const existing = (await collections.staffAttendance.findOne({
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      date: today,
    })) as WithId<StaffAttendanceDocument> | null;

    if (existing?.isLocked) {
      throw new ApiError('ATTENDANCE_LOCKED', 'Attendance for today is locked', 400);
    }

    const myRecord = existing?.records.find((r) => r.staffId.toString() === staffId);
    if (!existing || !myRecord?.checkIn) {
      throw new ApiError('NOT_CHECKED_IN', 'You have not checked in today', 400);
    }
    if (myRecord.checkOut) {
      throw new ApiError('ALREADY_CHECKED_OUT', 'You have already checked out today', 400);
    }

    const workingHours =
      Math.round(((now.getTime() - new Date(myRecord.checkIn).getTime()) / 3600000) * 100) / 100;

    await collections.staffAttendance.updateOne(
      { _id: existing._id },
      {
        $set: {
          'records.$[r].checkOut': now,
          'records.$[r].workingHours': workingHours,
          ...(location ? { 'records.$[r].checkOutLocation': location } : {}),
          updatedAt: now,
        },
      },
      { arrayFilters: [{ 'r.staffId': staffOid }] }
    );

    logger.info(
      { tenantId, branchId, staffId, workingHours, hasLocation: !!location },
      'Staff self check-out'
    );

    return this.getSelfToday(tenantId, staffId);
  }

  async getDailyReport(tenantId: string, branchId: string, date: string) {
    return this.findByDate(tenantId, branchId, date);
  }

  async getMonthlyReport(
    tenantId: string,
    branchId: string,
    month: number,
    year: number,
    departmentId?: string
  ) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    const daysInMonth = endDate.getDate();

    // Get all attendance records for the month
    const attendance = await collections.staffAttendance
      .find({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        date: { $gte: startDate, $lte: endDate },
      })
      .toArray();

    // Get all active staff with optional department filter
    const staffFilter: Record<string, unknown> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      status: 'active',
    };
    if (departmentId) {
      staffFilter['employment.departmentId'] = new ObjectId(departmentId);
    }

    const staff = await collections.staff
      .find(staffFilter)
      .project({ _id: 1, firstName: 1, lastName: 1, employeeId: 1, 'employment.departmentId': 1 })
      .toArray();

    // Build staff attendance map
    const staffAttendanceMap = new Map<
      string,
      {
        staffId: string;
        staffName: string;
        employeeId: string;
        present: number;
        absent: number;
        late: number;
        halfDay: number;
        onLeave: number;
        totalWorkingHours: number;
        dailyStatus: Record<number, string>;
      }
    >();

    // Initialize map for all staff
    staff.forEach((s) => {
      staffAttendanceMap.set(s._id.toString(), {
        staffId: s._id.toString(),
        staffName: `${s.firstName} ${s.lastName}`,
        employeeId: s.employeeId,
        present: 0,
        absent: 0,
        late: 0,
        halfDay: 0,
        onLeave: 0,
        totalWorkingHours: 0,
        dailyStatus: {},
      });
    });

    // Process attendance records
    attendance.forEach((a) => {
      const day = a.date.getDate();
      a.records.forEach((r: { staffId: ObjectId; status: string; workingHours?: number }) => {
        const staffData = staffAttendanceMap.get(r.staffId.toString());
        if (staffData) {
          staffData.dailyStatus[day] = r.status;
          staffData.totalWorkingHours += r.workingHours || 0;

          switch (r.status) {
            case 'present':
              staffData.present++;
              break;
            case 'absent':
              staffData.absent++;
              break;
            case 'late':
              staffData.late++;
              break;
            case 'half_day':
              staffData.halfDay++;
              break;
            case 'on_leave':
              staffData.onLeave++;
              break;
          }
        }
      });
    });

    return {
      month,
      year,
      daysInMonth,
      staff: Array.from(staffAttendanceMap.values()),
    };
  }

  async lockAttendance(tenantId: string, branchId: string, date: string, lockedBy: string) {
    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);

    const result = await collections.staffAttendance.updateOne(
      {
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        date: attendanceDate,
      },
      {
        $set: {
          isLocked: true,
          lockedAt: new Date(),
          lockedBy: new ObjectId(lockedBy),
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      throw new ApiError('ATTENDANCE_NOT_FOUND', 'No attendance record found for this date', 404);
    }

    logger.info({ branchId, date, tenantId }, 'Staff attendance locked');

    return { success: true };
  }

  async unlockAttendance(tenantId: string, branchId: string, date: string) {
    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);

    const result = await collections.staffAttendance.updateOne(
      {
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        date: attendanceDate,
      },
      {
        $set: {
          isLocked: false,
          updatedAt: new Date(),
        },
        $unset: {
          lockedAt: '',
          lockedBy: '',
        },
      }
    );

    if (result.matchedCount === 0) {
      throw new ApiError('ATTENDANCE_NOT_FOUND', 'No attendance record found for this date', 404);
    }

    logger.info({ branchId, date, tenantId }, 'Staff attendance unlocked');

    return { success: true };
  }

  async exportMonthlyReport(
    tenantId: string,
    branchId: string,
    month: number,
    year: number,
    departmentId?: string,
    format: 'csv' | 'json' = 'csv'
  ) {
    const report = await this.getMonthlyReport(tenantId, branchId, month, year, departmentId);

    if (format === 'json') {
      return report;
    }

    // Generate CSV with daily status for each staff member
    const daysHeader = Array.from({ length: report.daysInMonth }, (_, i) => (i + 1).toString());
    const headers = [
      'Employee ID',
      'Staff Name',
      ...daysHeader,
      'Present',
      'Absent',
      'Late',
      'Half Day',
      'On Leave',
      'Working Hours',
    ];

    const rows = report.staff.map((s) => {
      const dailyStatuses = Array.from({ length: report.daysInMonth }, (_, i) => {
        const status = s.dailyStatus[i + 1];
        if (!status) return '-';
        switch (status) {
          case 'present':
            return 'P';
          case 'absent':
            return 'A';
          case 'late':
            return 'L';
          case 'half_day':
            return 'H';
          case 'on_leave':
            return 'OL';
          case 'holiday':
            return 'HO';
          default:
            return '-';
        }
      });

      return [
        s.employeeId || '',
        s.staffName || '',
        ...dailyStatuses,
        s.present.toString(),
        s.absent.toString(),
        s.late.toString(),
        s.halfDay.toString(),
        s.onLeave.toString(),
        s.totalWorkingHours.toFixed(1),
      ];
    });

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    return {
      filename: `staff_attendance_${year}_${month.toString().padStart(2, '0')}.csv`,
      content: csv,
      contentType: 'text/csv',
    };
  }

  async exportDailyReport(
    tenantId: string,
    branchId: string,
    date: string,
    departmentId?: string,
    format: 'csv' | 'json' = 'csv'
  ) {
    const report = await this.findByDate(tenantId, branchId, date, departmentId);

    if (format === 'json') {
      return report;
    }

    // Generate CSV
    const headers = [
      'Employee ID',
      'Staff Name',
      'Department',
      'Status',
      'Check In',
      'Check Out',
      'Working Hours',
      'Remarks',
    ];

    const rows = (report.records || []).map((r: Record<string, unknown>) => [
      (r.employeeId as string) || '',
      (r.staffName as string) || '',
      (r.departmentName as string) || '',
      (r.status as string) || 'Not Marked',
      r.checkIn ? new Date(r.checkIn as string | Date).toLocaleTimeString() : '',
      r.checkOut ? new Date(r.checkOut as string | Date).toLocaleTimeString() : '',
      r.workingHours ? (r.workingHours as number).toFixed(1) : '',
      (r.remarks as string) || '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    return {
      filename: `staff_attendance_${date}.csv`,
      content: csv,
      contentType: 'text/csv',
    };
  }

  private calculateWorkingHours(checkIn: string, checkOut: string): number {
    const [inHours, inMinutes] = checkIn.split(':').map(Number);
    const [outHours, outMinutes] = checkOut.split(':').map(Number);

    const inTotalMinutes = inHours * 60 + inMinutes;
    const outTotalMinutes = outHours * 60 + outMinutes;

    return Math.max(0, (outTotalMinutes - inTotalMinutes) / 60);
  }
}

export const staffAttendanceService = new StaffAttendanceService();

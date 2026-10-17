import { ObjectId, WithId, Document, Filter } from 'mongodb';
import { getElectiveRosterFilter, assertOnRoster } from '../registration/roster';
import { attendanceSettingsService } from './attendanceSettings.service';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';

interface AttendanceRecord {
  studentId: ObjectId;
  status: 'present' | 'absent' | 'late' | 'half-day' | 'leave';
  inTime?: string;
  outTime?: string;
  leaveType?: string;
  remarks?: string;
}

interface AttendanceSummary {
  total: number;
  present: number;
  absent: number;
  late: number;
  halfDay: number;
  leave: number;
}

interface StudentAttendanceDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  classId: ObjectId;
  sectionId: ObjectId;
  /** Present only in per-subject (lecture-wise) mode. A register without it is
   *  the whole-day register that schools use — the two never collide because
   *  lookups match on `subjectId: {$exists:false}` when none is supplied. */
  subjectId?: ObjectId;
  /** Optional period/slot number, for multiple lectures of one subject a day. */
  period?: number;
  /** Lab-batch register (id from Section.batches) — a lab session where only a
   *  subset of the section attends. Only meaningful alongside subjectId. */
  batchId?: ObjectId;
  date: Date;
  records: AttendanceRecord[];
  summary: AttendanceSummary;
  markedBy: ObjectId;
  markedAt: Date;
  lastModifiedBy?: ObjectId;
  lastModifiedAt?: Date;
  isLocked: boolean;
}

export interface MarkAttendanceInput {
  classId: string;
  sectionId: string;
  /** Supply to mark a single subject's lecture instead of the whole day. */
  subjectId?: string;
  period?: number;
  /** Lab-batch register; only with subjectId. */
  batchId?: string;
  date: string;
  records: Array<{
    studentId: string;
    status: 'present' | 'absent' | 'late' | 'half-day' | 'leave';
    inTime?: string;
    outTime?: string;
    leaveType?: string;
    remarks?: string;
  }>;
}

export interface AttendanceListParams {
  classId?: string;
  sectionId?: string;
  subjectId?: string;
  date?: string;
  fromDate?: string;
  toDate?: string;
}

/**
 * Register identity. A daily register is keyed by (class, section, date); a
 * lecture register adds the subject (and optional period). Matching on
 * `$exists:false` keeps the two kinds strictly separate.
 */
function registerKey(
  tenantId: string,
  branchId: string,
  classId: string,
  sectionId: string,
  date: Date,
  subjectId?: string,
  period?: number,
  batchId?: string
): Filter<Document> {
  const key: Filter<Document> = {
    tenantId: new ObjectId(tenantId),
    branchId: new ObjectId(branchId),
    classId: new ObjectId(classId),
    sectionId: new ObjectId(sectionId),
    date,
  };
  key.subjectId = subjectId ? new ObjectId(subjectId) : { $exists: false };
  if (subjectId) {
    key.period = period ?? { $exists: false };
    // Lab registers are per-batch: Batch 1's session and Batch 2's session on
    // the same day are distinct registers.
    key.batchId = batchId ? new ObjectId(batchId) : { $exists: false };
  }
  return key;
}

class StudentAttendanceService {
  async markAttendance(
    tenantId: string,
    branchId: string,
    data: MarkAttendanceInput,
    markedBy: string
  ) {
    const attendanceDate = new Date(data.date);
    attendanceDate.setHours(0, 0, 0, 0);

    // Check if this register already exists (daily or per-subject).
    const existing = await collections.studentAttendance.findOne(
      registerKey(
        tenantId,
        branchId,
        data.classId,
        data.sectionId,
        attendanceDate,
        data.subjectId,
        data.period,
        data.batchId
      )
    );

    if (existing && (existing as StudentAttendanceDocument).isLocked) {
      throw new ApiError('ATTENDANCE_LOCKED', 'Attendance for this date is locked', 400);
    }

    await assertOnRoster(
      tenantId,
      branchId,
      data.sectionId,
      data.subjectId,
      data.records.map((r) => r.studentId)
    );

    const records: AttendanceRecord[] = data.records.map((r) => ({
      studentId: new ObjectId(r.studentId),
      status: r.status,
      inTime: r.inTime,
      outTime: r.outTime,
      leaveType: r.leaveType,
      remarks: r.remarks,
    }));

    // Re-saving a register merges: students not in this submission keep
    // their marks (a one-student correction used to wipe everyone else).
    if (existing) {
      const resubmitted = new Set(records.map((r) => r.studentId.toString()));
      records.unshift(
        ...((existing as StudentAttendanceDocument).records ?? []).filter(
          (r) => !resubmitted.has(r.studentId.toString())
        )
      );
    }

    // Calculate summary
    const summary: AttendanceSummary = {
      total: records.length,
      present: records.filter((r) => r.status === 'present').length,
      absent: records.filter((r) => r.status === 'absent').length,
      late: records.filter((r) => r.status === 'late').length,
      halfDay: records.filter((r) => r.status === 'half-day').length,
      leave: records.filter((r) => r.status === 'leave').length,
    };

    const now = new Date();

    if (existing) {
      // Update existing attendance
      await collections.studentAttendance.updateOne(
        { _id: existing._id },
        {
          $set: {
            records,
            summary,
            lastModifiedBy: new ObjectId(markedBy),
            lastModifiedAt: now,
          },
        }
      );

      logger.info(
        { date: data.date, classId: data.classId, sectionId: data.sectionId },
        'Attendance updated'
      );

      return this.findByDate(
        tenantId,
        branchId,
        data.classId,
        data.sectionId,
        data.date,
        data.subjectId,
        data.period,
        data.batchId
      );
    } else {
      // Create new attendance record
      const attendanceId = new ObjectId();

      const attendance: Omit<StudentAttendanceDocument, '_id'> & { _id: ObjectId } = {
        _id: attendanceId,
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        classId: new ObjectId(data.classId),
        sectionId: new ObjectId(data.sectionId),
        ...(data.subjectId && { subjectId: new ObjectId(data.subjectId) }),
        ...(data.subjectId && data.period !== undefined && { period: data.period }),
        ...(data.subjectId && data.batchId && { batchId: new ObjectId(data.batchId) }),
        date: attendanceDate,
        records,
        summary,
        markedBy: new ObjectId(markedBy),
        markedAt: now,
        isLocked: false,
      };

      await collections.studentAttendance.insertOne(attendance);

      logger.info(
        { attendanceId: attendanceId.toString(), date: data.date, classId: data.classId },
        'Attendance marked'
      );

      return this.formatAttendance(attendance as WithId<StudentAttendanceDocument>);
    }
  }

  async findByDate(
    tenantId: string,
    branchId: string,
    classId: string,
    sectionId: string,
    date: string,
    subjectId?: string,
    period?: number,
    batchId?: string
  ) {
    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);

    const attendance = (await collections.studentAttendance.findOne(
      registerKey(
        tenantId,
        branchId,
        classId,
        sectionId,
        attendanceDate,
        subjectId,
        period,
        batchId
      )
    )) as WithId<StudentAttendanceDocument> | null;

    if (!attendance) {
      // Return empty structure with the roster. For an elective the roster is
      // the students who registered for it, not the whole section; for a lab
      // batch it is the batch's members.
      const studentFilter: Filter<Document> = {
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        'currentEnrollment.classId': new ObjectId(classId),
        'currentEnrollment.sectionId': new ObjectId(sectionId),
        status: 'active',
      };
      if (subjectId && batchId) {
        studentFilter['currentEnrollment.labBatchId'] = new ObjectId(batchId);
      }
      if (subjectId) {
        const roster = await getElectiveRosterFilter(tenantId, branchId, subjectId);
        if (roster !== null) studentFilter._id = { $in: roster };
      }
      const students = await collections.students
        .find(studentFilter)
        .project({ _id: 1, admissionNumber: 1, displayName: 1, rollNumber: 1 })
        .sort({ rollNumber: 1, displayName: 1 })
        .toArray();

      return {
        date,
        classId,
        sectionId,
        subjectId,
        period,
        batchId,
        isMarked: false,
        isLocked: false,
        records: students.map((s) => ({
          studentId: s._id.toString(),
          admissionNumber: s.admissionNumber,
          displayName: s.displayName,
          rollNumber: s.rollNumber,
          status: null,
        })),
        summary: null,
      };
    }

    return this.formatAttendanceWithStudents(attendance);
  }

  /** Section of an existing register, for scope checks before edits. */
  async getRecordSectionId(tenantId: string, attendanceId: string): Promise<string | null> {
    if (!ObjectId.isValid(attendanceId)) {
      return null;
    }
    const attendance = await collections.studentAttendance.findOne(
      { _id: new ObjectId(attendanceId), tenantId: new ObjectId(tenantId) },
      { projection: { sectionId: 1 } }
    );
    return attendance ? (attendance.sectionId as ObjectId).toString() : null;
  }

  async updateRecord(
    tenantId: string,
    attendanceId: string,
    studentId: string,
    data: {
      status: 'present' | 'absent' | 'late' | 'half-day' | 'leave';
      inTime?: string;
      outTime?: string;
      leaveType?: string;
      remarks?: string;
    },
    modifiedBy: string
  ) {
    const attendance = (await collections.studentAttendance.findOne({
      _id: new ObjectId(attendanceId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<StudentAttendanceDocument> | null;

    if (!attendance) {
      throw new ApiError('ATTENDANCE_NOT_FOUND', 'Attendance record not found', 404);
    }

    if (attendance.isLocked) {
      throw new ApiError('ATTENDANCE_LOCKED', 'Attendance for this date is locked', 400);
    }

    // Update the specific student's record
    const records = attendance.records.map((r) => {
      if (r.studentId.toString() === studentId) {
        return {
          ...r,
          status: data.status,
          inTime: data.inTime,
          outTime: data.outTime,
          leaveType: data.leaveType,
          remarks: data.remarks,
        };
      }
      return r;
    });

    // Recalculate summary
    const summary: AttendanceSummary = {
      total: records.length,
      present: records.filter((r) => r.status === 'present').length,
      absent: records.filter((r) => r.status === 'absent').length,
      late: records.filter((r) => r.status === 'late').length,
      halfDay: records.filter((r) => r.status === 'half-day').length,
      leave: records.filter((r) => r.status === 'leave').length,
    };

    await collections.studentAttendance.updateOne(
      { _id: new ObjectId(attendanceId) },
      {
        $set: {
          records,
          summary,
          lastModifiedBy: new ObjectId(modifiedBy),
          lastModifiedAt: new Date(),
        },
      }
    );

    logger.info({ attendanceId, studentId, status: data.status }, 'Attendance record updated');

    return this.findById(tenantId, attendanceId);
  }

  async findById(tenantId: string, attendanceId: string) {
    const attendance = (await collections.studentAttendance.findOne({
      _id: new ObjectId(attendanceId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<StudentAttendanceDocument> | null;

    if (!attendance) {
      throw new ApiError('ATTENDANCE_NOT_FOUND', 'Attendance record not found', 404);
    }

    return this.formatAttendanceWithStudents(attendance);
  }

  async getStudentHistory(
    tenantId: string,
    branchId: string,
    studentId: string,
    fromDate?: string,
    toDate?: string
  ) {
    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      'records.studentId': new ObjectId(studentId),
    };

    if (fromDate || toDate) {
      filter.date = {};
      if (fromDate) {
        (filter.date as Record<string, Date>).$gte = new Date(fromDate);
      }
      if (toDate) {
        (filter.date as Record<string, Date>).$lte = new Date(toDate);
      }
    }

    const records = (await collections.studentAttendance
      .find(filter)
      .sort({ date: -1 })
      .toArray()) as WithId<StudentAttendanceDocument>[];

    // Extract just this student's records
    return records.map((a) => {
      const studentRecord = a.records.find((r) => r.studentId.toString() === studentId);
      return {
        date: a.date,
        status: studentRecord?.status,
        inTime: studentRecord?.inTime,
        outTime: studentRecord?.outTime,
        leaveType: studentRecord?.leaveType,
        remarks: studentRecord?.remarks,
      };
    });
  }

  async getDailyReport(tenantId: string, branchId: string, date: string) {
    const reportDate = new Date(date);
    reportDate.setHours(0, 0, 0, 0);

    const pipeline = [
      {
        $match: {
          tenantId: new ObjectId(tenantId),
          branchId: new ObjectId(branchId),
          date: reportDate,
        },
      },
      {
        $lookup: {
          from: 'classes',
          localField: 'classId',
          foreignField: '_id',
          as: 'class',
        },
      },
      { $unwind: { path: '$class', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'sections',
          localField: 'sectionId',
          foreignField: '_id',
          as: 'section',
        },
      },
      { $unwind: { path: '$section', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          classId: 1,
          sectionId: 1,
          className: '$class.displayName',
          sectionName: '$section.name',
          summary: 1,
          isLocked: 1,
        },
      },
    ];

    const reports = await collections.studentAttendance.aggregate(pipeline).toArray();

    // Calculate totals
    const totals = reports.reduce(
      (acc, r) => ({
        total: acc.total + (r.summary?.total || 0),
        present: acc.present + (r.summary?.present || 0),
        absent: acc.absent + (r.summary?.absent || 0),
        late: acc.late + (r.summary?.late || 0),
        halfDay: acc.halfDay + (r.summary?.halfDay || 0),
        leave: acc.leave + (r.summary?.leave || 0),
      }),
      { total: 0, present: 0, absent: 0, late: 0, halfDay: 0, leave: 0 }
    );

    return {
      date,
      byClass: reports.map((r) => ({
        classId: r.classId.toString(),
        sectionId: r.sectionId.toString(),
        className: r.className,
        sectionName: r.sectionName,
        summary: r.summary,
        isLocked: r.isLocked,
      })),
      totals,
    };
  }

  async getClassWiseReport(
    tenantId: string,
    branchId: string,
    classId: string,
    fromDate: string,
    toDate: string
  ) {
    const pipeline = [
      {
        $match: {
          tenantId: new ObjectId(tenantId),
          branchId: new ObjectId(branchId),
          classId: new ObjectId(classId),
          date: { $gte: new Date(fromDate), $lte: new Date(toDate) },
        },
      },
      {
        $group: {
          _id: '$sectionId',
          totalDays: { $sum: 1 },
          avgPresent: { $avg: '$summary.present' },
          avgAbsent: { $avg: '$summary.absent' },
          totalStudents: { $first: '$summary.total' },
        },
      },
      {
        $lookup: {
          from: 'sections',
          localField: '_id',
          foreignField: '_id',
          as: 'section',
        },
      },
      { $unwind: { path: '$section', preserveNullAndEmptyArrays: true } },
    ];

    const reports = await collections.studentAttendance.aggregate(pipeline).toArray();

    return reports.map((r) => ({
      sectionId: r._id.toString(),
      sectionName: r.section?.name,
      totalDays: r.totalDays,
      totalStudents: r.totalStudents,
      avgPresent: Math.round(r.avgPresent * 100) / 100,
      avgAbsent: Math.round(r.avgAbsent * 100) / 100,
      avgAttendancePercent: r.totalStudents
        ? Math.round((r.avgPresent / r.totalStudents) * 10000) / 100
        : 0,
    }));
  }

  async getStudentWiseReport(
    tenantId: string,
    branchId: string,
    classId: string,
    sectionId: string,
    fromDate: string,
    toDate: string
  ) {
    // Get all students in the section
    const students = await collections.students
      .find({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        'currentEnrollment.classId': new ObjectId(classId),
        'currentEnrollment.sectionId': new ObjectId(sectionId),
        status: 'active',
      })
      .project({ _id: 1, admissionNumber: 1, displayName: 1, rollNumber: 1 })
      .toArray();

    // Get attendance records for the date range
    const attendanceRecords = (await collections.studentAttendance
      .find({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        classId: new ObjectId(classId),
        sectionId: new ObjectId(sectionId),
        date: { $gte: new Date(fromDate), $lte: new Date(toDate) },
      })
      .toArray()) as WithId<StudentAttendanceDocument>[];

    const totalDays = attendanceRecords.length;

    // Calculate stats for each student
    return students.map((student) => {
      let present = 0;
      let absent = 0;
      let late = 0;
      let halfDay = 0;
      let leave = 0;

      attendanceRecords.forEach((att) => {
        const record = att.records.find((r) => r.studentId.toString() === student._id.toString());
        if (record) {
          switch (record.status) {
            case 'present':
              present++;
              break;
            case 'absent':
              absent++;
              break;
            case 'late':
              late++;
              break;
            case 'half-day':
              halfDay++;
              break;
            case 'leave':
              leave++;
              break;
          }
        }
      });

      return {
        studentId: student._id.toString(),
        admissionNumber: student.admissionNumber,
        displayName: student.displayName,
        rollNumber: student.rollNumber,
        totalDays,
        present,
        absent,
        late,
        halfDay,
        leave,
        attendancePercent: totalDays ? Math.round(((present + late) / totalDays) * 10000) / 100 : 0,
      };
    });
  }

  async getMonthlyReport(tenantId: string, branchId: string, year: number, month: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const pipeline = [
      {
        $match: {
          tenantId: new ObjectId(tenantId),
          branchId: new ObjectId(branchId),
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: { $dayOfMonth: '$date' },
          totalClasses: { $sum: 1 },
          totalPresent: { $sum: '$summary.present' },
          totalAbsent: { $sum: '$summary.absent' },
          totalStudents: { $sum: '$summary.total' },
        },
      },
      { $sort: { _id: 1 } },
    ];

    const dailyData = await collections.studentAttendance.aggregate(pipeline).toArray();

    return {
      year,
      month,
      daily: dailyData.map((d) => ({
        day: d._id,
        totalClasses: d.totalClasses,
        totalStudents: d.totalStudents,
        present: d.totalPresent,
        absent: d.totalAbsent,
        attendancePercent: d.totalStudents
          ? Math.round((d.totalPresent / d.totalStudents) * 10000) / 100
          : 0,
      })),
    };
  }

  async lockAttendance(tenantId: string, attendanceId: string) {
    const attendance = await collections.studentAttendance.findOne({
      _id: new ObjectId(attendanceId),
      tenantId: new ObjectId(tenantId),
    });

    if (!attendance) {
      throw new ApiError('ATTENDANCE_NOT_FOUND', 'Attendance record not found', 404);
    }

    await collections.studentAttendance.updateOne(
      { _id: new ObjectId(attendanceId) },
      { $set: { isLocked: true } }
    );

    return this.findById(tenantId, attendanceId);
  }

  /**
   * Subject-wise attendance percentage for a section over a date range —
   * the basis of the exam-eligibility rule (typically 75%). Only per-subject
   * registers are counted; the daily register is excluded.
   */
  async getSubjectWiseReport(
    tenantId: string,
    branchId: string,
    sectionId: string,
    fromDate: string,
    toDate: string,
    options: { eligibilityThreshold?: number } = {}
  ) {
    const from = new Date(fromDate);
    from.setHours(0, 0, 0, 0);
    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999);

    const registers = (await collections.studentAttendance
      .find({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        sectionId: new ObjectId(sectionId),
        subjectId: { $exists: true },
        date: { $gte: from, $lte: to },
      })
      .toArray()) as Array<WithId<StudentAttendanceDocument>>;

    // (subjectId → studentId → {held, attended})
    const bySubject = new Map<string, Map<string, { held: number; attended: number }>>();
    for (const reg of registers) {
      const subKey = reg.subjectId!.toString();
      if (!bySubject.has(subKey)) bySubject.set(subKey, new Map());
      const perStudent = bySubject.get(subKey)!;
      for (const rec of reg.records) {
        const sid = rec.studentId.toString();
        const cur = perStudent.get(sid) ?? { held: 0, attended: 0 };
        cur.held += 1;
        // Late and half-day still count as attendance for eligibility.
        if (rec.status === 'present' || rec.status === 'late' || rec.status === 'half-day') {
          cur.attended += 1;
        }
        perStudent.set(sid, cur);
      }
    }

    const subjectIds = [...bySubject.keys()].map((id) => new ObjectId(id));
    const studentIds = [...new Set([...bySubject.values()].flatMap((m) => [...m.keys()]))].map(
      (id) => new ObjectId(id)
    );

    const [subjects, students] = await Promise.all([
      subjectIds.length
        ? collections.subjects
            .find({ _id: { $in: subjectIds } })
            .project({ _id: 1, name: 1, code: 1 })
            .toArray()
        : Promise.resolve([]),
      studentIds.length
        ? collections.students
            .find({ _id: { $in: studentIds } })
            .project({ _id: 1, displayName: 1, admissionNumber: 1, rollNumber: 1 })
            .toArray()
        : Promise.resolve([]),
    ]);
    const subjectMap = new Map(subjects.map((s) => [s._id.toString(), s]));
    const studentMap = new Map(students.map((s) => [s._id.toString(), s]));

    const threshold = options.eligibilityThreshold ?? 75;

    return [...bySubject.entries()].map(([subjectId, perStudent]) => {
      const subject = subjectMap.get(subjectId);
      const rows = [...perStudent.entries()].map(([studentId, c]) => {
        const percent = c.held > 0 ? Math.round((c.attended / c.held) * 10000) / 100 : 0;
        const student = studentMap.get(studentId);
        return {
          studentId,
          displayName: (student?.displayName as string) ?? '',
          admissionNumber: student?.admissionNumber as string | undefined,
          rollNumber: student?.rollNumber as string | undefined,
          held: c.held,
          attended: c.attended,
          percent,
          eligible: percent >= threshold,
        };
      });
      rows.sort((a, b) => a.percent - b.percent);
      return {
        subjectId,
        subjectName: (subject?.name as string) ?? 'Subject',
        subjectCode: subject?.code as string | undefined,
        lecturesHeld: Math.max(0, ...rows.map((r) => r.held)),
        threshold,
        shortfallCount: rows.filter((r) => !r.eligible).length,
        students: rows,
      };
    });
  }

  private formatAttendance(attendance: WithId<StudentAttendanceDocument>) {
    return {
      _id: attendance._id.toString(),
      tenantId: attendance.tenantId.toString(),
      branchId: attendance.branchId.toString(),
      classId: attendance.classId.toString(),
      sectionId: attendance.sectionId.toString(),
      subjectId: attendance.subjectId?.toString(),
      period: attendance.period,
      batchId: attendance.batchId?.toString(),
      date: attendance.date,
      records: attendance.records.map((r) => ({
        studentId: r.studentId.toString(),
        status: r.status,
        inTime: r.inTime,
        outTime: r.outTime,
        leaveType: r.leaveType,
        remarks: r.remarks,
      })),
      summary: attendance.summary,
      markedBy: attendance.markedBy.toString(),
      markedAt: attendance.markedAt,
      lastModifiedBy: attendance.lastModifiedBy?.toString(),
      lastModifiedAt: attendance.lastModifiedAt,
      isLocked: attendance.isLocked,
    };
  }

  async exportStudentWiseReport(
    tenantId: string,
    branchId: string,
    classId: string,
    sectionId: string,
    fromDate: string,
    toDate: string,
    format: 'csv' | 'json' = 'csv'
  ) {
    const report = await this.getStudentWiseReport(
      tenantId,
      branchId,
      classId,
      sectionId,
      fromDate,
      toDate
    );

    if (format === 'json') {
      return report;
    }

    // Generate CSV
    const headers = [
      'Roll Number',
      'Admission Number',
      'Student Name',
      'Total Days',
      'Present',
      'Absent',
      'Late',
      'Half Day',
      'Leave',
      'Attendance %',
    ];

    const rows = report.map((r) => [
      r.rollNumber || '',
      r.admissionNumber || '',
      r.displayName || '',
      r.totalDays.toString(),
      r.present.toString(),
      r.absent.toString(),
      r.late.toString(),
      r.halfDay.toString(),
      r.leave.toString(),
      r.attendancePercent.toString(),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    return {
      filename: `student_attendance_${fromDate}_to_${toDate}.csv`,
      content: csv,
      contentType: 'text/csv',
    };
  }

  async exportDailyReport(
    tenantId: string,
    branchId: string,
    date: string,
    format: 'csv' | 'json' = 'csv'
  ) {
    const report = await this.getDailyReport(tenantId, branchId, date);

    if (format === 'json') {
      return report;
    }

    // Generate CSV
    const headers = [
      'Class',
      'Section',
      'Total',
      'Present',
      'Absent',
      'Late',
      'Half Day',
      'Leave',
      'Locked',
    ];

    const rows = report.byClass.map((r) => [
      r.className || '',
      r.sectionName || '',
      r.summary?.total?.toString() || '0',
      r.summary?.present?.toString() || '0',
      r.summary?.absent?.toString() || '0',
      r.summary?.late?.toString() || '0',
      r.summary?.halfDay?.toString() || '0',
      r.summary?.leave?.toString() || '0',
      r.isLocked ? 'Yes' : 'No',
    ]);

    // Add totals row
    rows.push([
      'TOTAL',
      '',
      report.totals.total.toString(),
      report.totals.present.toString(),
      report.totals.absent.toString(),
      report.totals.late.toString(),
      report.totals.halfDay.toString(),
      report.totals.leave.toString(),
      '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    return {
      filename: `daily_attendance_${date}.csv`,
      content: csv,
      contentType: 'text/csv',
    };
  }

  // ============ Self-Service Endpoints ============

  /**
   * One student's attendance: per-subject lecture counts (universities) and
   * an overall figure on lectures when any were marked, else on days. Used by
   * the student profile and the student portal so both show the same numbers.
   */
  async summariseForStudent(tenantId: string, studentId: string, from?: Date, to?: Date) {
    const tenantObjId = new ObjectId(tenantId);
    const studentObjId = new ObjectId(studentId);
    const student = await collections.students.findOne(
      { _id: studentObjId, tenantId: tenantObjId },
      { projection: { branchId: 1 } }
    );
    if (!student) throw new ApiError('STUDENT_NOT_FOUND', 'Student not found', 404);

    const settings = await attendanceSettingsService
      .getSettings(tenantId, String(student.branchId))
      .catch(() => null);
    const threshold =
      (settings?.generalSettings as { eligibilityThreshold?: number } | undefined)
        ?.eligibilityThreshold ?? 75;

    const rows = await collections.studentAttendance
      .aggregate([
        {
          $match: {
            tenantId: tenantObjId,
            'records.studentId': studentObjId,
            ...((from || to) && { date: { ...(from && { $gte: from }), ...(to && { $lte: to }) } }),
          },
        },
        { $unwind: '$records' },
        { $match: { 'records.studentId': studentObjId } },
        {
          $project: {
            date: 1,
            subjectId: { $ifNull: ['$subjectId', null] },
            status: '$records.status',
            remarks: '$records.remarks',
          },
        },
        { $sort: { date: -1 } },
      ])
      .toArray();

    const counts = () => ({ held: 0, present: 0, absent: 0, late: 0, leave: 0 });
    const add = (c: ReturnType<typeof counts>, status: string) => {
      c.held++;
      if (status === 'present') c.present++;
      else if (status === 'late') c.late++;
      else if (status === 'leave') c.leave++;
      else if (status === 'absent') c.absent++;
    };
    const pct = (c: ReturnType<typeof counts>) =>
      c.held ? Math.round(((c.present + c.late) / c.held) * 1000) / 10 : 0;

    const lectures = rows.filter((r) => r.subjectId);
    const basisRows = lectures.length ? lectures : rows;
    const overall = counts();
    const bySubject = new Map<string, ReturnType<typeof counts>>();
    const byMonth = new Map<string, ReturnType<typeof counts>>();
    for (const r of basisRows) {
      add(overall, r.status);
      const m = new Date(r.date).toISOString().slice(0, 7);
      if (!byMonth.has(m)) byMonth.set(m, counts());
      add(byMonth.get(m)!, r.status);
    }
    for (const r of lectures) {
      const k = String(r.subjectId);
      if (!bySubject.has(k)) bySubject.set(k, counts());
      add(bySubject.get(k)!, r.status);
    }
    const subjectDocs = bySubject.size
      ? await collections.subjects
          .find({ _id: { $in: [...bySubject.keys()].map((id) => new ObjectId(id)) } })
          .project({ name: 1, code: 1 })
          .toArray()
      : [];

    return {
      basis: lectures.length ? ('lectures' as const) : ('days' as const),
      threshold,
      overall: { ...overall, percentage: pct(overall) },
      subjects: [...bySubject.entries()].map(([id, c]) => {
        const doc = subjectDocs.find((d) => String(d._id) === id);
        return {
          subjectId: id,
          name: doc?.name as string | undefined,
          code: doc?.code as string | undefined,
          ...c,
          percentage: pct(c),
          belowThreshold: pct(c) < threshold,
        };
      }),
      monthly: [...byMonth.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([m, c]) => ({
          month: new Date(`${m}-01T00:00:00Z`).toLocaleString('en-IN', {
            month: 'short',
            year: 'numeric',
          }),
          present: c.present + c.late,
          absent: c.absent,
          leave: c.leave,
          percentage: pct(c),
        })),
      history: rows.slice(0, 30).map((r) => ({
        date: r.date as Date,
        subjectId: r.subjectId ? String(r.subjectId) : undefined,
        status: r.status as string,
        remarks: r.remarks as string | undefined,
      })),
    };
  }

  async getStudentSelfAttendance(tenantId: string, studentId: string, academicBatchId?: string) {
    const student = await collections.students.findOne({
      _id: new ObjectId(studentId),
      tenantId: new ObjectId(tenantId),
    });
    if (!student) {
      throw new ApiError('STUDENT_NOT_FOUND', 'Student not found', 404);
    }
    let from: Date | undefined;
    let to: Date | undefined;
    if (academicBatchId) {
      const batch = await collections.academicBatches.findOne({
        _id: new ObjectId(academicBatchId),
      });
      if (batch) {
        from = batch.startDate as Date;
        to = (batch.endDate as Date | undefined) ?? new Date();
      }
    }
    const s = await this.summariseForStudent(tenantId, studentId, from, to);
    return {
      student: {
        _id: studentId,
        displayName: student.displayName,
        admissionNumber: student.admissionNumber,
        rollNumber: student.rollNumber,
      },
      // totalDays keeps its name for existing screens; it counts lectures
      // when the campus marks lecture-wise (see `basis`).
      summary: {
        basis: s.basis,
        totalDays: s.overall.held,
        present: s.overall.present,
        absent: s.overall.absent,
        late: s.overall.late,
        halfDay: 0,
        leave: s.overall.leave,
        attendancePercent: s.overall.percentage,
        eligibilityThreshold: s.threshold,
      },
      subjects: s.subjects,
      monthly: s.monthly,
      history: s.history,
    };
  }

  async getParentChildAttendance(tenantId: string, parentPhone: string, studentId?: string) {
    const tenantObjId = new ObjectId(tenantId);

    // Find student(s) by parent phone
    const filter: Filter<Document> = {
      tenantId: tenantObjId,
      status: 'active',
      $or: [
        { 'parents.father.phone': parentPhone },
        { 'parents.mother.phone': parentPhone },
        { 'parents.guardian.phone': parentPhone },
      ],
    };

    if (studentId) {
      filter._id = new ObjectId(studentId);
    }

    const students = await collections.students
      .find(filter)
      .project({ _id: 1, displayName: 1, admissionNumber: 1, branchId: 1, rollNumber: 1 })
      .limit(10)
      .toArray();

    if (students.length === 0) {
      return { children: [], message: 'No students found for this parent' };
    }

    // Get attendance summary for each child
    const childrenAttendance = await Promise.all(
      students.map(async (student) => {
        const summary = await this.getStudentSelfAttendance(tenantId, student._id.toString());
        return {
          studentId: student._id.toString(),
          displayName: student.displayName,
          admissionNumber: student.admissionNumber,
          rollNumber: student.rollNumber,
          summary: summary.summary,
        };
      })
    );

    return { children: childrenAttendance };
  }

  // ============ Bulk Upload ============

  getBulkUploadTemplate() {
    const headers = [
      'date* (YYYY-MM-DD)',
      'classId*',
      'sectionId*',
      'studentId*',
      'status* (present/absent/late/half-day/leave)',
      'inTime (HH:MM)',
      'outTime (HH:MM)',
      'leaveType',
      'remarks',
    ];

    const sampleRow = [
      '2024-01-15',
      '60a1234567890abcdef12345',
      '60a1234567890abcdef12346',
      '60a1234567890abcdef12347',
      'present',
      '08:30',
      '14:30',
      '',
      'Regular attendance',
    ];

    const csv = [headers.join(','), sampleRow.map((cell) => `"${cell}"`).join(',')].join('\n');

    return {
      filename: 'attendance_bulk_upload_template.csv',
      content: csv,
      contentType: 'text/csv',
    };
  }

  async validateBulkUpload(
    _tenantId: string,
    _branchId: string,
    records: Array<{
      date: string;
      classId: string;
      sectionId: string;
      studentId: string;
      status: string;
      inTime?: string;
      outTime?: string;
      leaveType?: string;
      remarks?: string;
    }>
  ) {
    const errors: Array<{ row: number; errors: string[] }> = [];
    const validRecords: typeof records = [];
    const validStatuses = ['present', 'absent', 'late', 'half-day', 'leave'];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const rowErrors: string[] = [];

      // Validate date
      if (!record.date || isNaN(Date.parse(record.date))) {
        rowErrors.push('Invalid date format');
      }

      // Validate IDs
      if (!ObjectId.isValid(record.classId)) {
        rowErrors.push('Invalid class ID');
      }
      if (!ObjectId.isValid(record.sectionId)) {
        rowErrors.push('Invalid section ID');
      }
      if (!ObjectId.isValid(record.studentId)) {
        rowErrors.push('Invalid student ID');
      }

      // Validate status
      if (!validStatuses.includes(record.status)) {
        rowErrors.push(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }

      if (rowErrors.length > 0) {
        errors.push({ row: i + 2, errors: rowErrors }); // +2 for header and 0-index
      } else {
        validRecords.push(record);
      }
    }

    return {
      totalRows: records.length,
      validRows: validRecords.length,
      invalidRows: errors.length,
      errors,
      isValid: errors.length === 0,
    };
  }

  async processBulkUploadCSV(
    tenantId: string,
    branchId: string,
    csvContent: string,
    markedBy: string
  ): Promise<{
    success: boolean;
    totalRows: number;
    processedRows: number;
    failedRows: number;
    errors: Array<{ row: number; errors: string[] }>;
    processedDates: string[];
  }> {
    // Parse CSV
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) {
      return {
        success: false,
        totalRows: 0,
        processedRows: 0,
        failedRows: 0,
        errors: [{ row: 0, errors: ['CSV file must have header and at least one data row'] }],
        processedDates: [],
      };
    }

    const headers = lines[0].split(',').map((h) =>
      h
        .trim()
        .replace(/\*/g, '')
        .replace(/\(.*\)/g, '')
        .trim()
        .toLowerCase()
    );
    const records: Array<{
      date: string;
      classId: string;
      sectionId: string;
      studentId: string;
      status: string;
      inTime?: string;
      outTime?: string;
      leaveType?: string;
      remarks?: string;
    }> = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      const row: Record<string, string> = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx]?.trim() || '';
      });

      records.push({
        date: row.date || '',
        classId: row.classid || '',
        sectionId: row.sectionid || '',
        studentId: row.studentid || '',
        status: row.status || '',
        inTime: row.intime || undefined,
        outTime: row.outtime || undefined,
        leaveType: row.leavetype || undefined,
        remarks: row.remarks || undefined,
      });
    }

    // Validate records
    const validation = await this.validateBulkUpload(tenantId, branchId, records);
    if (!validation.isValid) {
      return {
        success: false,
        totalRows: validation.totalRows,
        processedRows: 0,
        failedRows: validation.invalidRows,
        errors: validation.errors,
        processedDates: [],
      };
    }

    // Group records by date + class + section
    const groupedRecords = new Map<string, typeof records>();
    for (const record of records) {
      const key = `${record.date}-${record.classId}-${record.sectionId}`;
      if (!groupedRecords.has(key)) {
        groupedRecords.set(key, []);
      }
      groupedRecords.get(key)!.push(record);
    }

    const processedDates: string[] = [];
    const errors: Array<{ row: number; errors: string[] }> = [];
    let processedRows = 0;

    // Process each group
    for (const [key, groupRecords] of groupedRecords) {
      const [date, classId, sectionId] = key.split('-');

      try {
        const attendanceData = {
          date,
          classId,
          sectionId,
          records: groupRecords.map((r) => ({
            studentId: r.studentId,
            status: r.status as 'present' | 'absent' | 'late' | 'half-day' | 'leave',
            inTime: r.inTime,
            outTime: r.outTime,
            leaveType: r.leaveType,
            remarks: r.remarks,
          })),
        };

        await this.markAttendance(tenantId, branchId, attendanceData, markedBy);
        processedRows += groupRecords.length;
        if (!processedDates.includes(date)) {
          processedDates.push(date);
        }
      } catch (error) {
        errors.push({
          row: 0, // Group error
          errors: [
            `Failed to process attendance for ${date} (class: ${classId}, section: ${sectionId}): ${error instanceof Error ? error.message : 'Unknown error'}`,
          ],
        });
      }
    }

    logger.info(
      { tenantId, branchId, totalRows: records.length, processedRows, processedDates },
      'Bulk attendance upload completed'
    );

    return {
      success: errors.length === 0,
      totalRows: records.length,
      processedRows,
      failedRows: records.length - processedRows,
      errors,
      processedDates,
    };
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);

    return result.map((s) => s.trim().replace(/^"|"$/g, ''));
  }

  private async formatAttendanceWithStudents(attendance: WithId<StudentAttendanceDocument>) {
    // Get student details
    const studentIds = attendance.records.map((r) => r.studentId);
    const students = await collections.students
      .find({ _id: { $in: studentIds } })
      .project({ _id: 1, admissionNumber: 1, displayName: 1, rollNumber: 1 })
      .toArray();

    const studentMap = new Map(students.map((s) => [s._id.toString(), s]));

    return {
      _id: attendance._id.toString(),
      tenantId: attendance.tenantId.toString(),
      branchId: attendance.branchId.toString(),
      classId: attendance.classId.toString(),
      sectionId: attendance.sectionId.toString(),
      date: attendance.date,
      isMarked: true,
      isLocked: attendance.isLocked,
      records: attendance.records.map((r) => {
        const student = studentMap.get(r.studentId.toString());
        return {
          studentId: r.studentId.toString(),
          admissionNumber: student?.admissionNumber,
          displayName: student?.displayName,
          rollNumber: student?.rollNumber,
          status: r.status,
          inTime: r.inTime,
          outTime: r.outTime,
          leaveType: r.leaveType,
          remarks: r.remarks,
        };
      }),
      summary: attendance.summary,
      markedBy: attendance.markedBy.toString(),
      markedAt: attendance.markedAt,
    };
  }
}

export const studentAttendanceService = new StudentAttendanceService();

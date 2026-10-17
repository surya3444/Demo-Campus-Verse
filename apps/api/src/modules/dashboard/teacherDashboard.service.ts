import { ObjectId, Document, WithId } from 'mongodb';
import { leaveService } from '../hr/leave.service';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';

interface TimetableSlotItem {
  slotName: string;
  startTime: string;
  endTime: string;
  slotType: 'period' | 'break' | 'lunch' | 'assembly';
  slotOrder: number;
  sectionId?: string;
  sectionName?: string;
  classId?: string;
  className?: string;
  subjectId?: string;
  subjectName?: string;
  roomNumber?: string;
  attendanceMarked: boolean;
}

interface UnmarkedAttendance {
  sectionId: string;
  sectionName: string;
  className: string;
  subjectName: string;
  slotName: string;
}

interface PendingGrading {
  assignmentId: string;
  title: string;
  sectionName: string;
  subjectName: string;
  totalStudents: number;
  gradedCount: number;
}

interface UpcomingPtm {
  eventId: string;
  title: string;
  date: Date;
  startTime?: string;
  endTime?: string;
  location?: string;
}

interface LeaveBalanceItem {
  leaveType: string;
  total: number;
  used: number;
  pending: number;
  available: number;
}

class TeacherDashboardService {
  async getTeacherDashboard(tenantId: string, branchId: string, staffId: string) {
    const [timetable, personalStats] = await Promise.all([
      this.getTodaysTimetable(tenantId, branchId, staffId),
      this.getPersonalStats(tenantId, branchId, staffId),
    ]);

    const pendingTasks = await this.getPendingTasks(tenantId, branchId, staffId, timetable);

    return { timetable, pendingTasks, personalStats };
  }

  private async getTodaysTimetable(
    tenantId: string,
    branchId: string,
    staffId: string
  ): Promise<TimetableSlotItem[]> {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);
    const staffObjId = new ObjectId(staffId);

    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sunday, 6=Saturday

    // Get all slots for this branch
    const slots = await collections.timetableSlots
      .find({ tenantId: tenantObjId, branchId: branchObjId })
      .sort({ order: 1 })
      .toArray();

    if (slots.length === 0) {
      return [];
    }

    // Get timetable entries for this teacher on today's day
    const entries = await collections.timetableEntries
      .find({
        tenantId: tenantObjId,
        branchId: branchObjId,
        teacherId: staffObjId,
        dayOfWeek,
      })
      .toArray();

    // Create a map of slotId → entry
    const entryBySlot = new Map<string, WithId<Document>>();
    for (const entry of entries) {
      entryBySlot.set((entry.slotId as ObjectId).toString(), entry);
    }

    // Collect section/class/subject IDs for lookup
    const sectionIds = new Set<string>();
    const classIds = new Set<string>();
    const subjectIds = new Set<string>();
    for (const entry of entries) {
      if (entry.sectionId) sectionIds.add((entry.sectionId as ObjectId).toString());
      if (entry.subjectId) subjectIds.add((entry.subjectId as ObjectId).toString());
    }

    // Look up sections (to get classId and names)
    const sectionMap = new Map<string, { name: string; classId: string }>();
    if (sectionIds.size > 0) {
      const sections = await collections.sections
        .find({
          _id: { $in: Array.from(sectionIds).map((id) => new ObjectId(id)) },
          tenantId: tenantObjId,
        })
        .toArray();
      for (const sec of sections) {
        const cid = (sec.classId as ObjectId).toString();
        classIds.add(cid);
        sectionMap.set((sec._id as ObjectId).toString(), {
          name: sec.name as string,
          classId: cid,
        });
      }
    }

    // Look up class names
    const classNameMap = new Map<string, string>();
    if (classIds.size > 0) {
      const classes = await collections.classes
        .find({
          _id: { $in: Array.from(classIds).map((id) => new ObjectId(id)) },
          tenantId: tenantObjId,
        })
        .project({ _id: 1, displayName: 1 })
        .toArray();
      for (const cls of classes) {
        classNameMap.set((cls._id as ObjectId).toString(), cls.displayName as string);
      }
    }

    // Look up subject names
    const subjectNameMap = new Map<string, string>();
    if (subjectIds.size > 0) {
      const subjects = await collections.subjects
        .find({
          _id: { $in: Array.from(subjectIds).map((id) => new ObjectId(id)) },
          tenantId: tenantObjId,
        })
        .project({ _id: 1, name: 1 })
        .toArray();
      for (const sub of subjects) {
        subjectNameMap.set((sub._id as ObjectId).toString(), sub.name as string);
      }
    }

    // Check attendance for today across all relevant sections
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);

    const attendanceSectionIds = Array.from(sectionIds).map((id) => new ObjectId(id));
    const attendanceRecords =
      attendanceSectionIds.length > 0
        ? await collections.studentAttendance
            .find({
              tenantId: tenantObjId,
              branchId: branchObjId,
              sectionId: { $in: attendanceSectionIds },
              date: { $gte: todayStart, $lt: todayEnd },
            })
            .project({ sectionId: 1 })
            .toArray()
        : [];

    const attendanceMarkedSections = new Set<string>();
    for (const rec of attendanceRecords) {
      attendanceMarkedSections.add((rec.sectionId as ObjectId).toString());
    }

    // Build the result
    const result: TimetableSlotItem[] = [];
    for (const slot of slots) {
      const slotId = (slot._id as ObjectId).toString();
      const slotType = slot.type as TimetableSlotItem['slotType'];
      const entry = entryBySlot.get(slotId);

      if (slotType !== 'period' || !entry) {
        // Non-period slot or free period
        result.push({
          slotName: slot.name as string,
          startTime: slot.startTime as string,
          endTime: slot.endTime as string,
          slotType: slotType === 'period' ? 'period' : slotType,
          slotOrder: slot.order as number,
          attendanceMarked: false,
        });
      } else {
        const secId = (entry.sectionId as ObjectId).toString();
        const subId = (entry.subjectId as ObjectId).toString();
        const secInfo = sectionMap.get(secId);

        result.push({
          slotName: slot.name as string,
          startTime: slot.startTime as string,
          endTime: slot.endTime as string,
          slotType: 'period',
          slotOrder: slot.order as number,
          sectionId: secId,
          sectionName: secInfo?.name || '',
          classId: secInfo?.classId || '',
          className: secInfo ? classNameMap.get(secInfo.classId) || '' : '',
          subjectId: subId,
          subjectName: subjectNameMap.get(subId) || '',
          roomNumber: entry.roomNumber as string | undefined,
          attendanceMarked: attendanceMarkedSections.has(secId),
        });
      }
    }

    // A branch can hold several slot sets (per class group), so the same time
    // appears once per set. Keep one row per time, preferring the one with a class.
    const byTime = new Map<string, TimetableSlotItem>();
    for (const item of result) {
      const key = `${item.startTime}-${item.endTime}`;
      const existing = byTime.get(key);
      if (!existing || (!existing.sectionId && item.sectionId)) byTime.set(key, item);
    }
    return [...byTime.values()].sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  private async getPendingTasks(
    tenantId: string,
    branchId: string,
    staffId: string,
    timetable: TimetableSlotItem[]
  ) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);
    const staffObjId = new ObjectId(staffId);

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const unmarkedAttendance: UnmarkedAttendance[] = timetable
      .filter(
        (slot) =>
          slot.slotType === 'period' &&
          slot.sectionId &&
          !slot.attendanceMarked &&
          slot.endTime <= currentTime
      )
      .map((slot) => ({
        sectionId: slot.sectionId!,
        sectionName: slot.sectionName || '',
        className: slot.className || '',
        subjectName: slot.subjectName || '',
        slotName: slot.slotName,
      }));

    // Pending grading: assignments that need grading
    const pendingAssignments = await collections.assignments
      .find({
        tenantId: tenantObjId,
        branchId: branchObjId,
        teacherId: staffObjId,
        status: { $in: ['published', 'grading'] },
      })
      .toArray();

    const pendingGrading: PendingGrading[] = [];
    if (pendingAssignments.length > 0) {
      // Get grade counts for each assignment
      const assignmentIds = pendingAssignments.map((a) => a._id as ObjectId);
      const gradeCounts = await collections.grades
        .aggregate([
          { $match: { assignmentId: { $in: assignmentIds }, tenantId: tenantObjId } },
          { $group: { _id: '$assignmentId', count: { $sum: 1 } } },
        ])
        .toArray();

      const gradeCountMap = new Map<string, number>();
      for (const gc of gradeCounts) {
        gradeCountMap.set((gc._id as ObjectId).toString(), gc.count as number);
      }

      // Get student counts per section
      const sectionIds = [
        ...new Set(pendingAssignments.map((a) => (a.sectionId as ObjectId).toString())),
      ];
      const studentCounts = await collections.students
        .aggregate([
          {
            $match: {
              tenantId: tenantObjId,
              'currentEnrollment.sectionId': {
                $in: sectionIds.map((id) => new ObjectId(id)),
              },
              status: 'active',
            },
          },
          { $group: { _id: '$currentEnrollment.sectionId', count: { $sum: 1 } } },
        ])
        .toArray();

      const studentCountMap = new Map<string, number>();
      for (const sc of studentCounts) {
        studentCountMap.set((sc._id as ObjectId).toString(), sc.count as number);
      }

      for (const assignment of pendingAssignments) {
        const aid = (assignment._id as ObjectId).toString();
        const secId = (assignment.sectionId as ObjectId).toString();
        pendingGrading.push({
          assignmentId: aid,
          title: assignment.title as string,
          sectionName: (assignment.sectionName as string) || '',
          subjectName: (assignment.subjectName as string) || '',
          totalStudents: studentCountMap.get(secId) || 0,
          gradedCount: gradeCountMap.get(aid) || 0,
        });
      }
    }

    // Upcoming PTMs: events with type 'ptm'
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingPtms: UpcomingPtm[] = [];
    try {
      const ptmEvents = await collections.events
        .find({
          tenantId: tenantObjId,
          type: 'ptm',
          status: 'scheduled',
          startDate: { $gte: today },
        })
        .sort({ startDate: 1 })
        .limit(5)
        .toArray();

      for (const event of ptmEvents) {
        upcomingPtms.push({
          eventId: (event._id as ObjectId).toString(),
          title: event.title as string,
          date: event.startDate as Date,
          startTime: event.startTime as string | undefined,
          endTime: event.endTime as string | undefined,
          location: event.location as string | undefined,
        });
      }
    } catch {
      // Events collection may not exist or have different schema
      logger.debug('Could not fetch PTM events');
    }

    return { unmarkedAttendance, pendingGrading, upcomingPtms };
  }

  private async getPersonalStats(tenantId: string, branchId: string, staffId: string) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);
    const staffObjId = new ObjectId(staffId);

    // Leave balance — same live calculation as the Leaves page
    let leaveBalance: LeaveBalanceItem[] = [];
    try {
      const { balances } = await leaveService.getLeaveBalance(tenantId, branchId, staffId);
      leaveBalance = balances
        .filter((b) => !b.unlimited)
        .map((b) => ({
          leaveType: b.leaveType,
          total: b.total,
          used: b.used,
          pending: b.pending,
          available: b.available,
        }));
    } catch {
      logger.debug('Could not fetch leave balances');
    }

    // Timetable entry stats
    const allEntries = await collections.timetableEntries
      .find({
        tenantId: tenantObjId,
        branchId: branchObjId,
        teacherId: staffObjId,
      })
      .toArray();

    const totalPeriodsPerWeek = allEntries.length;
    const uniqueSections = new Set<string>();
    for (const entry of allEntries) {
      if (entry.sectionId) {
        uniqueSections.add((entry.sectionId as ObjectId).toString());
      }
    }

    // Today's progress
    const today = new Date();
    const dayOfWeek = today.getDay();
    const todayEntries = allEntries.filter((e) => e.dayOfWeek === dayOfWeek);
    const currentTime = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;

    // Get slot end times to determine completion
    const slotIds = todayEntries.map((e) => e.slotId as ObjectId);
    const slots =
      slotIds.length > 0
        ? await collections.timetableSlots
            .find({
              _id: { $in: slotIds },
              tenantId: tenantObjId,
            })
            .toArray()
        : [];

    const slotEndTimeMap = new Map<string, string>();
    for (const slot of slots) {
      slotEndTimeMap.set((slot._id as ObjectId).toString(), slot.endTime as string);
    }

    let completed = 0;
    for (const entry of todayEntries) {
      const endTime = slotEndTimeMap.get((entry.slotId as ObjectId).toString());
      if (endTime && endTime <= currentTime) {
        completed++;
      }
    }

    return {
      leaveBalance,
      totalPeriodsPerWeek,
      totalSections: uniqueSections.size,
      todayPeriods: {
        total: todayEntries.length,
        completed,
        remaining: todayEntries.length - completed,
      },
    };
  }
}

export const teacherDashboardService = new TeacherDashboardService();

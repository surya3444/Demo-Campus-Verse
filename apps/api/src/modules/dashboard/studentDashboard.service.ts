import { ObjectId } from 'mongodb';
import { collections } from '../../config/database';
import { now } from '../../utils/dates';

class StudentDashboardService {
  async getStudentDashboard(tenantId: string, branchId: string, studentId: string) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);
    const studentObjId = new ObjectId(studentId);

    // Get student profile
    const student = await collections.students.findOne({
      _id: studentObjId,
      tenantId: tenantObjId,
    });

    if (!student) {
      return { student: null };
    }

    const enrollment = student.currentEnrollment as
      | {
          classId?: ObjectId;
          sectionId?: ObjectId;
          className?: string;
          sectionName?: string;
        }
      | undefined;
    const sectionId = enrollment?.sectionId;
    const classId = enrollment?.classId;

    // Fall back to the canonical class/section docs when the denormalised
    // copy on the student is missing (older students that pre-date the
    // denormalisation, or rows imported through a path that didn't populate
    // these fields).
    let className = enrollment?.className || '';
    let sectionName = enrollment?.sectionName || '';
    if ((!className || !sectionName) && (classId || sectionId)) {
      const [classDoc, sectionDoc] = await Promise.all([
        classId
          ? collections.classes.findOne(
              { _id: classId, tenantId: tenantObjId },
              { projection: { displayName: 1 } }
            )
          : null,
        sectionId
          ? collections.sections.findOne(
              { _id: sectionId, tenantId: tenantObjId },
              { projection: { name: 1 } }
            )
          : null,
      ]);
      if (!className && classDoc) className = (classDoc.displayName as string) || '';
      if (!sectionName && sectionDoc) sectionName = (sectionDoc.name as string) || '';
    }

    const [todaySchedule, assignments, attendance, fees, hostel, announcements, submittedIds] =
      await Promise.all([
        sectionId ? this.getTodaySchedule(tenantObjId, branchObjId, sectionId) : [],
        sectionId
          ? this.getPendingAssignments(tenantObjId, branchObjId, sectionId, studentObjId)
          : { pending: 0, upcoming: [] },
        this.getAttendanceSummary(tenantObjId, studentObjId),
        this.getFeeSummary(tenantObjId, studentObjId),
        this.getHostelInfo(tenantObjId, studentObjId),
        this.getRecentAnnouncements(tenantObjId, branchObjId),
        this.getSubmittedIds(tenantObjId, studentObjId),
      ]);

    return {
      student: {
        _id: studentObjId.toString(),
        name: `${student.firstName} ${student.lastName}`,
        admissionNumber: student.admissionNumber,
        className,
        sectionName,
        sectionId: sectionId?.toString() || '',
        rollNumber: student.rollNumber || '',
      },
      todaySchedule,
      assignments,
      attendance,
      fees,
      hostel,
      announcements,
      submittedIds,
    };
  }

  private async getTodaySchedule(tenantId: ObjectId, _branchId: ObjectId, sectionId: ObjectId) {
    // India time, not the server's clock (UTC on the server would show
    // yesterday's periods until 5:30 am).
    const dayOfWeek = now().day();

    // Get timetable entries for today (match direct sectionId or linkedSectionIds)
    const entries = await collections.timetableEntries
      .find({
        tenantId,
        $or: [{ sectionId }, { linkedSectionIds: sectionId }],
        dayOfWeek,
      })
      .toArray();

    if (entries.length === 0) return [];

    // Entries store ids only; resolve the period, subject and teacher behind each.
    const ids = (field: string) => [
      ...new Map(
        entries
          .map((e) => e[field] as ObjectId | undefined)
          .filter((v): v is ObjectId => !!v)
          .map((v) => [v.toString(), v])
      ).values(),
    ];
    const [slots, subjects, teachers] = await Promise.all([
      collections.timetableSlots
        .find(
          { _id: { $in: ids('slotId') } },
          { projection: { name: 1, startTime: 1, endTime: 1, type: 1, order: 1 } }
        )
        .toArray(),
      collections.subjects
        .find({ _id: { $in: ids('subjectId') } }, { projection: { name: 1, code: 1 } })
        .toArray(),
      collections.staff
        .find(
          { _id: { $in: ids('teacherId') } },
          { projection: { displayName: 1, firstName: 1, lastName: 1 } }
        )
        .toArray(),
    ]);
    const byId = <T extends { _id: ObjectId }>(rows: T[]) =>
      new Map(rows.map((r) => [r._id.toString(), r]));
    const slotMap = byId(slots as Array<{ _id: ObjectId } & Record<string, unknown>>);
    const subjectMap = byId(subjects as Array<{ _id: ObjectId } & Record<string, unknown>>);
    const teacherMap = byId(teachers as Array<{ _id: ObjectId } & Record<string, unknown>>);

    return entries
      .map((entry) => {
        const slot = slotMap.get(String(entry.slotId));
        const subject = subjectMap.get(String(entry.subjectId));
        const teacher = teacherMap.get(String(entry.teacherId));
        return {
          slotName: (slot?.name as string) || (entry.slotName as string) || '',
          startTime: (slot?.startTime as string) || (entry.startTime as string) || '',
          endTime: (slot?.endTime as string) || (entry.endTime as string) || '',
          slotType: (slot?.type as string) || 'period',
          slotOrder: (slot?.order as number) ?? (entry.order as number) ?? 0,
          subjectName: (subject?.name as string) || (entry.subjectName as string) || '',
          subjectCode: (subject?.code as string) || '',
          teacherName:
            (teacher?.displayName as string) ||
            `${(teacher?.firstName as string) ?? ''} ${(teacher?.lastName as string) ?? ''}`.trim() ||
            (entry.teacherName as string) ||
            '',
          roomNumber: (entry.roomNumber as string) || '',
        };
      })
      .sort((a, b) => a.slotOrder - b.slotOrder);
  }

  private async getPendingAssignments(
    tenantId: ObjectId,
    branchId: ObjectId,
    sectionId: ObjectId,
    studentId: ObjectId
  ) {
    // Get published assignments for this section
    const assignments = await collections.assignments
      .find({
        tenantId,
        branchId,
        sectionId,
        status: 'published',
      })
      .sort({ dueDate: 1 })
      .limit(20)
      .toArray();

    // Check which ones the student has already submitted
    const assignmentIds = assignments.filter((a) => a.hasQuestions).map((a) => a._id as ObjectId);

    const submissions =
      assignmentIds.length > 0
        ? await collections.assignmentSubmissions
            .find({
              assignmentId: { $in: assignmentIds },
              studentId,
              tenantId,
            })
            .toArray()
        : [];

    const submittedIds = new Set(submissions.map((s) => (s.assignmentId as ObjectId).toString()));

    // Also check questionnaire submissions
    const questionnaires = await collections.questionnaires
      .find({
        tenantId,
        branchId,
        sectionId,
        status: 'published',
      })
      .limit(20)
      .toArray();

    const qSubmissions =
      questionnaires.length > 0
        ? await collections.questionnaireSubmissions
            .find({
              questionnaireId: { $in: questionnaires.map((q) => q._id as ObjectId) },
              studentId,
              tenantId,
            })
            .toArray()
        : [];

    const qSubmittedIds = new Set(
      qSubmissions.map((s) => (s.questionnaireId as ObjectId).toString())
    );

    const pendingAssignments = assignments.filter(
      (a) => !a.hasQuestions || !submittedIds.has((a._id as ObjectId).toString())
    );
    const pendingQuestionnaires = questionnaires.filter(
      (q) => !qSubmittedIds.has((q._id as ObjectId).toString())
    );

    const upcoming = [
      ...pendingAssignments.slice(0, 5).map((a) => ({
        _id: (a._id as ObjectId).toString(),
        title: a.title as string,
        type: 'assignment' as const,
        dueDate: a.dueDate as Date | undefined,
        totalMarks: a.totalMarks as number,
        hasQuestions: (a.hasQuestions as boolean) || false,
      })),
      ...pendingQuestionnaires.slice(0, 5).map((q) => ({
        _id: (q._id as ObjectId).toString(),
        title: q.title as string,
        type: 'questionnaire' as const,
        dueDate: q.dueDate as Date | undefined,
        totalMarks: q.totalMarks as number,
        hasQuestions: true,
      })),
    ];

    return {
      pending: pendingAssignments.length + pendingQuestionnaires.length,
      upcoming,
    };
  }

  private async getAttendanceSummary(tenantId: ObjectId, studentId: ObjectId) {
    // Get current month attendance
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Registers are one document per section per day with a records[] list,
    // so pull this student's entries out of each register. Lecture-wise
    // registers (subjectId set) are excluded so a day isn't counted per period.
    const rows = await collections.studentAttendance
      .aggregate([
        {
          $match: {
            tenantId,
            date: { $gte: startOfMonth, $lte: now },
            subjectId: { $exists: false },
            'records.studentId': studentId,
          },
        },
        { $unwind: '$records' },
        { $match: { 'records.studentId': studentId } },
        { $group: { _id: '$records.status', n: { $sum: 1 } } },
      ])
      .toArray();
    const count = (s: string) => (rows.find((r) => r._id === s)?.n as number) ?? 0;

    const late = count('late');
    const present = count('present') + late; // late counts as present
    const absent = count('absent');

    const total = present + absent;
    const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

    return { present, absent, late, total, percentage };
  }

  private async getFeeSummary(tenantId: ObjectId, studentId: ObjectId) {
    const feeAssignments = await collections.feeAssignments
      .find({
        tenantId,
        studentId,
        status: { $in: ['active', 'overdue'] },
      })
      .toArray();

    let totalDue = 0;
    let totalPaid = 0;

    for (const fa of feeAssignments) {
      const summary = fa.summary as { netPayable?: number; totalPaid?: number } | undefined;
      totalDue += summary?.netPayable || 0;
      totalPaid += summary?.totalPaid || 0;
    }

    return {
      totalDue,
      totalPaid,
      balance: totalDue - totalPaid,
    };
  }

  private async getHostelInfo(tenantId: ObjectId, studentId: ObjectId) {
    const allocation = await collections.bedAllocations.findOne({
      tenantId,
      studentId,
      status: 'active',
    });

    if (!allocation) return null;

    return {
      hostelName: allocation.hostelName as string,
      roomNumber: allocation.roomNumber as string,
      bedNumber: allocation.bedNumber as string,
    };
  }

  private async getSubmittedIds(tenantId: ObjectId, studentId: ObjectId) {
    const [assignmentSubs, questionnaireSubs] = await Promise.all([
      collections.assignmentSubmissions
        .find({ tenantId, studentId }, { projection: { assignmentId: 1 } })
        .toArray(),
      collections.questionnaireSubmissions
        .find({ tenantId, studentId }, { projection: { questionnaireId: 1 } })
        .toArray(),
    ]);

    return {
      assignments: assignmentSubs.map((s) => (s.assignmentId as ObjectId).toString()),
      questionnaires: questionnaireSubs.map((s) => (s.questionnaireId as ObjectId).toString()),
    };
  }

  private async getRecentAnnouncements(tenantId: ObjectId, branchId: ObjectId) {
    const announcements = await collections.announcements
      .find({
        tenantId,
        $or: [{ branchId }, { branchId: { $exists: false } }],
        status: 'published',
      })
      .sort({ createdAt: -1 })
      .limit(3)
      .toArray();

    return announcements.map((a) => ({
      _id: (a._id as ObjectId).toString(),
      title: a.title as string,
      message: ((a.content || a.message) as string) || '',
      createdAt: a.createdAt as Date,
    }));
  }
}

export const studentDashboardService = new StudentDashboardService();

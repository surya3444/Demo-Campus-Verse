import { ObjectId, Filter, Document } from 'mongodb';
import { collections } from '../../config/database';
import { departmentOverviewService } from '../organization/departmentOverview.service';

interface DashboardFilters {
  tenantId: string;
  branchId?: string;
  branchIds?: string[];
  academicBatchId?: string;
  fromDate?: string;
  toDate?: string;
  state?: string;
  city?: string;
  institutionType?: 'school' | 'college' | 'university';
  /** Caller-visible students (institution/department/program grants); null = all. */
  studentIds?: ObjectId[] | null;
}

/** Who a scoped admin or HOD may count; null fields mean the whole campus. */
export interface DashboardScope {
  studentIds: ObjectId[] | null;
  staffIds: ObjectId[] | null;
}
const ALL: DashboardScope = { studentIds: null, staffIds: null };
const inIds = (field: string, ids: ObjectId[] | null) => (ids ? { [field]: { $in: ids } } : {});

// Drill-down links are inline objects with path and optional params

class DashboardService {
  // ============ Owner Dashboard (Cross-branch aggregation) ============

  async getOwnerKPIs(tenantId: string, filters: Partial<DashboardFilters> = {}) {
    const tenantObjId = new ObjectId(tenantId);
    const branchFilter = filters.branchIds?.length
      ? { branchId: { $in: filters.branchIds.map((id) => new ObjectId(id)) } }
      : {};

    const [totalStudents, totalStaff, totalBranches, feeStats, attendanceRate, admissionStats] =
      await Promise.all([
        // Total active students
        collections.students.countDocuments({
          tenantId: tenantObjId,
          status: 'active',
          ...branchFilter,
        }),

        // Total active staff
        collections.staff.countDocuments({
          tenantId: tenantObjId,
          status: 'active',
          ...branchFilter,
        }),

        // Total branches
        collections.branches.countDocuments({
          tenantId: tenantObjId,
          status: 'active',
        }),

        // Fee statistics
        this.getFeeStats(tenantId, filters),

        // Today's attendance rate
        this.getAttendanceRate(tenantId, filters),

        // Admission pipeline stats
        this.getAdmissionStats(tenantId, filters),
      ]);

    return {
      students: {
        total: totalStudents,
        label: 'Total Students',
      },
      staff: {
        total: totalStaff,
        label: 'Total Staff',
      },
      branches: {
        total: totalBranches,
        label: 'Active Branches',
      },
      finance: {
        totalBilled: feeStats.totalBilled,
        totalCollected: feeStats.totalCollected,
        totalDue: feeStats.totalDue,
        collectionRate: feeStats.collectionRate,
      },
      attendance: {
        rate: attendanceRate,
        label: "Today's Attendance",
      },
      admissions: {
        totalLeads: admissionStats.totalLeads,
        converted: admissionStats.converted,
        conversionRate: admissionStats.conversionRate,
      },
    };
  }

  async getOwnerStudentMetrics(tenantId: string, filters: Partial<DashboardFilters> = {}) {
    const tenantObjId = new ObjectId(tenantId);
    const branchFilter = filters.branchIds?.length
      ? { branchId: { $in: filters.branchIds.map((id) => new ObjectId(id)) } }
      : {};

    // Students by branch
    const studentsByBranch = await collections.students
      .aggregate([
        {
          $match: {
            tenantId: tenantObjId,
            status: 'active',
            ...branchFilter,
          },
        },
        {
          $group: {
            _id: '$branchId',
            count: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: 'branches',
            localField: '_id',
            foreignField: '_id',
            as: 'branch',
          },
        },
        {
          $unwind: '$branch',
        },
        {
          $project: {
            branchId: '$_id',
            branchName: '$branch.name',
            count: 1,
          },
        },
        { $sort: { count: -1 } },
      ])
      .toArray();

    // Students by class
    const studentsByClass = await collections.students
      .aggregate([
        {
          $match: {
            tenantId: tenantObjId,
            status: 'active',
            ...branchFilter,
          },
        },
        {
          $group: {
            _id: '$classId',
            count: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: 'classes',
            localField: '_id',
            foreignField: '_id',
            as: 'class',
          },
        },
        {
          $unwind: '$class',
        },
        {
          $project: {
            classId: '$_id',
            className: '$class.name',
            count: 1,
          },
        },
        { $sort: { 'class.displayOrder': 1 } },
      ])
      .toArray();

    // Gender distribution
    const genderDistribution = await collections.students
      .aggregate([
        {
          $match: {
            tenantId: tenantObjId,
            status: 'active',
            ...branchFilter,
          },
        },
        {
          $group: {
            _id: '$gender',
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    // New admissions this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const newAdmissionsThisMonth = await collections.students.countDocuments({
      tenantId: tenantObjId,
      status: 'active',
      admissionDate: { $gte: startOfMonth },
      ...branchFilter,
    });

    return {
      byBranch: studentsByBranch,
      byClass: studentsByClass,
      genderDistribution: genderDistribution.reduce(
        (acc, item) => {
          acc[item._id || 'unknown'] = item.count;
          return acc;
        },
        {} as Record<string, number>
      ),
      newAdmissionsThisMonth,
    };
  }

  async getOwnerFinanceMetrics(tenantId: string, filters: Partial<DashboardFilters> = {}) {
    const tenantObjId = new ObjectId(tenantId);
    const branchFilter = filters.branchIds?.length
      ? { branchId: { $in: filters.branchIds.map((id) => new ObjectId(id)) } }
      : {};

    // Collection by branch
    const collectionByBranch = await collections.feeTransactions
      .aggregate([
        {
          $match: {
            tenantId: tenantObjId,
            status: 'success',
            ...branchFilter,
          },
        },
        {
          $group: {
            _id: '$branchId',
            totalCollected: { $sum: '$totalAmount' },
            transactionCount: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: 'branches',
            localField: '_id',
            foreignField: '_id',
            as: 'branch',
          },
        },
        {
          $unwind: '$branch',
        },
        {
          $project: {
            branchId: '$_id',
            branchName: '$branch.name',
            totalCollected: 1,
            transactionCount: 1,
          },
        },
        { $sort: { totalCollected: -1 } },
      ])
      .toArray();

    // Collection by payment mode
    const collectionByMode = await collections.feeTransactions
      .aggregate([
        {
          $match: {
            tenantId: tenantObjId,
            status: 'success',
            ...branchFilter,
          },
        },
        {
          $group: {
            _id: '$paymentMode',
            total: { $sum: '$totalAmount' },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    // Monthly collection trend (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyTrend = await collections.feeTransactions
      .aggregate([
        {
          $match: {
            tenantId: tenantObjId,
            status: 'success',
            receiptDate: { $gte: sixMonthsAgo },
            ...branchFilter,
          },
        },
        {
          $group: {
            _id: {
              year: { $year: '$receiptDate' },
              month: { $month: '$receiptDate' },
            },
            total: { $sum: '$totalAmount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ])
      .toArray();

    // Due amounts by branch
    const duesByBranch = await collections.feeAssignments
      .aggregate([
        {
          $match: {
            tenantId: tenantObjId,
            ...branchFilter,
          },
        },
        {
          $project: {
            branchId: 1,
            dueAmount: '$summary.balance',
          },
        },
        {
          $match: {
            dueAmount: { $gt: 0 },
          },
        },
        {
          $group: {
            _id: '$branchId',
            totalDue: { $sum: '$dueAmount' },
            studentCount: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: 'branches',
            localField: '_id',
            foreignField: '_id',
            as: 'branch',
          },
        },
        {
          $unwind: '$branch',
        },
        {
          $project: {
            branchId: '$_id',
            branchName: '$branch.name',
            totalDue: 1,
            studentCount: 1,
          },
        },
        { $sort: { totalDue: -1 } },
      ])
      .toArray();

    // Today's collection
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todaysCollection = await collections.feeTransactions
      .aggregate([
        {
          $match: {
            tenantId: tenantObjId,
            status: 'success',
            receiptDate: { $gte: today, $lt: tomorrow },
            ...branchFilter,
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$totalAmount' },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    return {
      collectionByBranch,
      collectionByMode: collectionByMode.reduce(
        (acc, item) => {
          acc[item._id] = { total: item.total, count: item.count };
          return acc;
        },
        {} as Record<string, { total: number; count: number }>
      ),
      monthlyTrend: monthlyTrend.map((item) => ({
        month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
        total: item.total,
        count: item.count,
      })),
      duesByBranch,
      todaysCollection: todaysCollection[0] || { total: 0, count: 0 },
    };
  }

  async getOwnerAttendanceMetrics(tenantId: string, filters: Partial<DashboardFilters> = {}) {
    const tenantObjId = new ObjectId(tenantId);
    const branchFilter = filters.branchIds?.length
      ? { branchId: { $in: filters.branchIds.map((id) => new ObjectId(id)) } }
      : {};

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Today's attendance by branch
    const attendanceByBranch = await collections.studentAttendance
      .aggregate([
        {
          $match: {
            tenantId: tenantObjId,
            date: today,
            ...branchFilter,
          },
        },
        {
          $unwind: '$records',
        },
        {
          $group: {
            _id: '$branchId',
            total: { $sum: 1 },
            present: {
              $sum: { $cond: [{ $eq: ['$records.status', 'present'] }, 1, 0] },
            },
            absent: {
              $sum: { $cond: [{ $eq: ['$records.status', 'absent'] }, 1, 0] },
            },
            late: {
              $sum: { $cond: [{ $eq: ['$records.status', 'late'] }, 1, 0] },
            },
          },
        },
        {
          $lookup: {
            from: 'branches',
            localField: '_id',
            foreignField: '_id',
            as: 'branch',
          },
        },
        {
          $unwind: '$branch',
        },
        {
          $project: {
            branchId: '$_id',
            branchName: '$branch.name',
            total: 1,
            present: 1,
            absent: 1,
            late: 1,
            rate: {
              $multiply: [{ $divide: [{ $add: ['$present', '$late'] }, '$total'] }, 100],
            },
          },
        },
      ])
      .toArray();

    // Weekly attendance trend
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const weeklyTrend = await collections.studentAttendance
      .aggregate([
        {
          $match: {
            tenantId: tenantObjId,
            date: { $gte: weekAgo },
            ...branchFilter,
          },
        },
        {
          $unwind: '$records',
        },
        {
          $group: {
            _id: '$date',
            total: { $sum: 1 },
            present: {
              $sum: { $cond: [{ $eq: ['$records.status', 'present'] }, 1, 0] },
            },
          },
        },
        {
          $project: {
            date: '$_id',
            total: 1,
            present: 1,
            rate: {
              $multiply: [{ $divide: ['$present', '$total'] }, 100],
            },
          },
        },
        { $sort: { date: 1 } },
      ])
      .toArray();

    return {
      byBranch: attendanceByBranch,
      weeklyTrend,
    };
  }

  async getOwnerStaffMetrics(tenantId: string, filters: Partial<DashboardFilters> = {}) {
    const tenantObjId = new ObjectId(tenantId);
    const branchFilter = filters.branchIds?.length
      ? { branchId: { $in: filters.branchIds.map((id) => new ObjectId(id)) } }
      : {};

    // Staff by branch
    const staffByBranch = await collections.staff
      .aggregate([
        {
          $match: {
            tenantId: tenantObjId,
            status: 'active',
            ...branchFilter,
          },
        },
        {
          $group: {
            _id: '$branchId',
            total: { $sum: 1 },
            teaching: {
              $sum: { $cond: [{ $eq: ['$employmentDetails.employeeType', 'teaching'] }, 1, 0] },
            },
            nonTeaching: {
              $sum: {
                $cond: [{ $eq: ['$employmentDetails.employeeType', 'non-teaching'] }, 1, 0],
              },
            },
          },
        },
        {
          $lookup: {
            from: 'branches',
            localField: '_id',
            foreignField: '_id',
            as: 'branch',
          },
        },
        {
          $unwind: '$branch',
        },
        {
          $project: {
            branchId: '$_id',
            branchName: '$branch.name',
            total: 1,
            teaching: 1,
            nonTeaching: 1,
          },
        },
      ])
      .toArray();

    // Staff by designation
    const staffByDesignation = await collections.staff
      .aggregate([
        {
          $match: {
            tenantId: tenantObjId,
            status: 'active',
            ...branchFilter,
          },
        },
        {
          $group: {
            _id: '$employmentDetails.designation',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ])
      .toArray();

    // Pending leave requests
    const pendingLeaves = await collections.leaves.countDocuments({
      tenantId: tenantObjId,
      status: 'pending',
    });

    // Staff on leave today
    const staffOnLeaveToday = await collections.leaves.countDocuments({
      tenantId: tenantObjId,
      status: 'approved',
      fromDate: { $lte: new Date() },
      toDate: { $gte: new Date() },
    });

    return {
      byBranch: staffByBranch,
      byDesignation: staffByDesignation.map((item) => ({
        designation: item._id || 'Unassigned',
        count: item.count,
      })),
      pendingLeaves,
      staffOnLeaveToday,
    };
  }

  async getOwnerAdmissionMetrics(tenantId: string, filters: Partial<DashboardFilters> = {}) {
    const tenantObjId = new ObjectId(tenantId);
    const branchFilter = filters.branchIds?.length
      ? { branchId: { $in: filters.branchIds.map((id) => new ObjectId(id)) } }
      : {};

    // Leads by stage
    const leadsByStage = await collections.leads
      .aggregate([
        {
          $match: {
            tenantId: tenantObjId,
            ...branchFilter,
          },
        },
        {
          $group: {
            _id: '$stage',
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    // Leads by source
    const leadsBySource = await collections.leads
      .aggregate([
        {
          $match: {
            tenantId: tenantObjId,
            ...branchFilter,
          },
        },
        {
          $group: {
            _id: '$source',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ])
      .toArray();

    // Leads by branch
    const leadsByBranch = await collections.leads
      .aggregate([
        {
          $match: {
            tenantId: tenantObjId,
            ...branchFilter,
          },
        },
        {
          $group: {
            _id: '$branchId',
            total: { $sum: 1 },
            converted: {
              $sum: { $cond: [{ $eq: ['$stage', 'converted'] }, 1, 0] },
            },
          },
        },
        {
          $lookup: {
            from: 'branches',
            localField: '_id',
            foreignField: '_id',
            as: 'branch',
          },
        },
        {
          $unwind: '$branch',
        },
        {
          $project: {
            branchId: '$_id',
            branchName: '$branch.name',
            total: 1,
            converted: 1,
            conversionRate: {
              $multiply: [{ $divide: ['$converted', '$total'] }, 100],
            },
          },
        },
      ])
      .toArray();

    // Monthly lead trend
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyTrend = await collections.leads
      .aggregate([
        {
          $match: {
            tenantId: tenantObjId,
            createdAt: { $gte: sixMonthsAgo },
            ...branchFilter,
          },
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
            },
            total: { $sum: 1 },
            converted: {
              $sum: { $cond: [{ $eq: ['$stage', 'converted'] }, 1, 0] },
            },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ])
      .toArray();

    return {
      byStage: leadsByStage.reduce(
        (acc, item) => {
          acc[item._id] = item.count;
          return acc;
        },
        {} as Record<string, number>
      ),
      bySource: leadsBySource.map((item) => ({
        source: item._id,
        count: item.count,
      })),
      byBranch: leadsByBranch,
      monthlyTrend: monthlyTrend.map((item) => ({
        month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
        total: item.total,
        converted: item.converted,
      })),
    };
  }

  // ============ Branch Dashboard ============

  async getBranchKPIs(tenantId: string, branchId: string, sc: DashboardScope = ALL) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);

    const [totalStudents, totalStaff, feeStats, todayAttendance, pendingLeaves, upcomingEvents] =
      await Promise.all([
        collections.students.countDocuments({
          tenantId: tenantObjId,
          branchId: branchObjId,
          status: 'active',
          ...inIds('_id', sc.studentIds),
        }),

        collections.staff.countDocuments({
          tenantId: tenantObjId,
          branchId: branchObjId,
          status: 'active',
          ...inIds('_id', sc.staffIds),
        }),

        this.getFeeStats(tenantId, { branchId, studentIds: sc.studentIds }),

        this.getTodayAttendance(tenantId, branchId, sc.studentIds),

        collections.leaves.countDocuments({
          tenantId: tenantObjId,
          branchId: branchObjId,
          status: 'pending',
          ...inIds('staffId', sc.staffIds),
        }),

        collections.events.countDocuments({
          tenantId: tenantObjId,
          $or: [{ branchId: branchObjId }, { 'audience.branchIds': branchObjId }],
          startDate: { $gte: new Date() },
          status: 'scheduled',
        }),
      ]);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 86_400_000);
    const [newThisMonth, staffToday, staffOnLeave] = await Promise.all([
      collections.students.countDocuments({
        tenantId: tenantObjId,
        branchId: branchObjId,
        createdAt: { $gte: monthStart },
        ...inIds('_id', sc.studentIds),
      }),
      this.getTodayStaffAttendance(tenantObjId, branchObjId, sc.staffIds),
      collections.leaves.countDocuments({
        tenantId: tenantObjId,
        branchId: branchObjId,
        status: 'approved',
        fromDate: { $lt: tomorrow },
        toDate: { $gte: today },
        ...inIds('staffId', sc.staffIds),
      }),
    ]);

    return {
      // Nested shape read by the branch dashboard.
      students: { total: totalStudents, active: totalStudents, newThisMonth },
      staff: { total: totalStaff, presentToday: staffToday.present, onLeave: staffOnLeave },
      finance: feeStats,
      attendance: {
        rate: todayAttendance.rate,
        present: todayAttendance.present,
        absent: todayAttendance.total - todayAttendance.present,
        total: todayAttendance.total,
      },
      // Flat keys kept for older clients.
      studentCount: totalStudents,
      staffCount: totalStaff,
      feeCollected: feeStats.totalCollected,
      feeDue: feeStats.totalDue,
      collectionRate: feeStats.collectionRate,
      todayAttendance,
      pendingLeaves,
      upcomingEvents,
    };
  }

  async getBranchTodaySummary(tenantId: string, branchId: string, sc: DashboardScope = ALL) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      todayCollection,
      todayAttendance,
      staffOnLeave,
      todayEvents,
      recentAnnouncements,
      upcomingEvents,
      staffToday,
    ] = await Promise.all([
      // Today's fee collection
      collections.feeTransactions
        .aggregate([
          {
            $match: {
              tenantId: tenantObjId,
              branchId: branchObjId,
              status: 'success',
              receiptDate: { $gte: today, $lt: tomorrow },
              ...inIds('studentId', sc.studentIds),
            },
          },
          {
            $group: {
              _id: '$paymentMode',
              total: { $sum: '$totalAmount' },
              count: { $sum: 1 },
            },
          },
        ])
        .toArray(),

      // Today's attendance summary
      this.getTodayAttendanceDetails(tenantId, branchId, sc.studentIds),

      // Staff on leave today
      collections.leaves
        .aggregate([
          {
            $match: {
              tenantId: tenantObjId,
              branchId: branchObjId,
              status: 'approved',
              fromDate: { $lte: new Date() },
              // toDate is stored at midnight, so compare against the start of today
              toDate: { $gte: new Date(new Date().setUTCHours(0, 0, 0, 0)) },
              ...inIds('staffId', sc.staffIds),
            },
          },
          { $limit: 10 },
          {
            $lookup: { from: 'staff', localField: 'staffId', foreignField: '_id', as: 'staff' },
          },
          { $unwind: { path: '$staff', preserveNullAndEmptyArrays: true } },
        ])
        .toArray(),

      // Today's events
      collections.events
        .find({
          tenantId: tenantObjId,
          $or: [{ branchId: branchObjId }, { 'audience.branchIds': branchObjId }],
          startDate: { $gte: today, $lt: tomorrow },
        })
        .toArray(),

      // Recent announcements
      collections.announcements
        .find({
          tenantId: tenantObjId,
          $or: [{ branchId: branchObjId }, { 'audience.branchIds': branchObjId }],
          status: 'published',
        })
        .sort({ publishedAt: -1 })
        .limit(5)
        .toArray(),

      // Next events, today onwards
      collections.events
        .find({
          tenantId: tenantObjId,
          $or: [{ branchId: branchObjId }, { 'audience.branchIds': branchObjId }],
          startDate: { $gte: today },
          status: { $ne: 'cancelled' },
        })
        .sort({ startDate: 1 })
        .limit(5)
        .toArray(),

      this.getTodayStaffAttendance(tenantObjId, branchObjId, sc.staffIds),
    ]);

    const byMode: Record<string, { total: number; count: number }> = {};
    for (const m of todayCollection)
      byMode[String(m._id ?? 'other')] = { total: m.total, count: m.count };
    const feeTotal = todayCollection.reduce((sum, m) => sum + m.total, 0);
    const feeCount = todayCollection.reduce((sum, m) => sum + m.count, 0);

    return {
      feeCollection: { total: feeTotal, count: feeCount, byMode },
      attendance: {
        ...todayAttendance,
        studentRate: todayAttendance.rate,
        staffPresent: staffToday.present,
        staffTotal: staffToday.total,
      },
      staffOnLeave: staffOnLeave.map((l) => ({
        name: (l.staff?.displayName as string) ?? 'Unknown staff',
        leaveType: l.leaveType as string,
        // Day after the last leave day; ponytail: ignores weekends/holidays.
        returnDate: new Date((l.toDate as Date).getTime() + 86_400_000).toISOString(),
      })),
      events: todayEvents.map((e) => ({
        _id: (e._id as ObjectId).toString(),
        title: e.title as string,
        type: e.type as string,
        startTime: e.startTime as string | undefined,
      })),
      announcements: recentAnnouncements.map((a) => ({
        _id: (a._id as ObjectId).toString(),
        title: a.title as string,
        priority: a.priority as string,
        publishedAt: a.publishedAt as Date,
      })),
      // Shapes read by the branch dashboard panels.
      upcomingEvents: upcomingEvents.map((e) => ({
        title: e.title as string,
        date: e.startDate as Date,
        type: e.type as string,
      })),
      recentAnnouncements: recentAnnouncements.map((a) => ({
        title: a.title as string,
        createdAt: (a.publishedAt ?? a.createdAt) as Date,
      })),
    };
  }

  // ============ State/City/Academic Filters ============

  async getFilterOptions(tenantId: string) {
    const tenantObjId = new ObjectId(tenantId);

    // Get tenant to determine institution types
    const tenant = await collections.tenants.findOne({ _id: tenantObjId });

    // Get unique states and cities from branches
    const branches = await collections.branches
      .find({ tenantId: tenantObjId, status: 'active' })
      .project({ _id: 1, name: 1, 'location.state': 1, 'location.city': 1, institutionType: 1 })
      .toArray();

    const states = new Set<string>();
    const citiesByState: Record<string, Set<string>> = {};
    const institutionTypes = new Set<string>();

    branches.forEach((b) => {
      const state = (b.location as { state?: string })?.state;
      const city = (b.location as { city?: string })?.city;
      const instType = b.institutionType as string | undefined;

      if (state) {
        states.add(state);
        if (!citiesByState[state]) {
          citiesByState[state] = new Set();
        }
        if (city) {
          citiesByState[state].add(city);
        }
      }

      if (instType) {
        institutionTypes.add(instType);
      }
    });

    // If no institution types from branches, use tenant default
    const tenantPrimaryType = (tenant?.institutionTypes as string[] | undefined)?.[0];
    if (institutionTypes.size === 0 && tenantPrimaryType) {
      institutionTypes.add(tenantPrimaryType);
    }

    // Get academic batches
    const academicBatches = await collections.academicBatches
      .find({ tenantId: tenantObjId, status: 'active' })
      .project({ _id: 1, name: 1, startDate: 1, endDate: 1, isCurrent: 1 })
      .sort({ startDate: -1 })
      .toArray();

    return {
      states: Array.from(states).sort(),
      citiesByState: Object.fromEntries(
        Object.entries(citiesByState).map(([state, cities]) => [state, Array.from(cities).sort()])
      ),
      institutionTypes: Array.from(institutionTypes).sort(),
      branches: branches.map((b) => ({
        _id: (b._id as ObjectId).toString(),
        name: b.name,
        state: (b.location as { state?: string })?.state,
        city: (b.location as { city?: string })?.city,
        institutionType: b.institutionType as string | undefined,
      })),
      academicBatches: academicBatches.map((ab) => ({
        _id: (ab._id as ObjectId).toString(),
        name: ab.name,
        startDate: ab.startDate,
        endDate: ab.endDate,
        isCurrent: ab.isCurrent,
      })),
    };
  }

  async getBranchesByLocation(
    tenantId: string,
    state?: string,
    city?: string,
    institutionType?: string
  ) {
    const tenantObjId = new ObjectId(tenantId);
    const filter: Filter<Document> = { tenantId: tenantObjId, status: 'active' };

    if (state) {
      filter['location.state'] = state;
    }
    if (city) {
      filter['location.city'] = city;
    }
    if (institutionType) {
      filter.institutionType = institutionType;
    }

    const branches = await collections.branches.find(filter).project({ _id: 1 }).toArray();

    return branches.map((b) => (b._id as ObjectId).toString());
  }

  async getOwnerKPIsWithFilters(tenantId: string, filters: Partial<DashboardFilters> = {}) {
    // If state/city/institutionType filters provided, get matching branch IDs first
    let branchIds = filters.branchIds || [];

    if (filters.state || filters.city || filters.institutionType) {
      branchIds = await this.getBranchesByLocation(
        tenantId,
        filters.state,
        filters.city,
        filters.institutionType
      );
      if (branchIds.length === 0) {
        // No matching branches, return empty data with drill-down links
        return {
          students: {
            total: 0,
            label: 'Total Students',
            drillDown: { path: '/students', params: {} },
          },
          staff: { total: 0, label: 'Total Staff', drillDown: { path: '/hr/staff', params: {} } },
          branches: {
            total: 0,
            label: 'Active Branches',
            drillDown: { path: '/organization/branches', params: {} },
          },
          finance: {
            totalBilled: 0,
            totalCollected: 0,
            totalDue: 0,
            collectionRate: 0,
            drillDown: { path: '/finance/reports', params: {} },
          },
          attendance: {
            rate: 0,
            label: "Today's Attendance",
            drillDown: { path: '/attendance/reports', params: {} },
          },
          admissions: {
            totalLeads: 0,
            converted: 0,
            conversionRate: 0,
            drillDown: { path: '/admissions/leads', params: {} },
          },
        };
      }
    }

    const kpis = await this.getOwnerKPIs(tenantId, { ...filters, branchIds });

    // Add drill-down links for navigation
    return {
      students: {
        ...kpis.students,
        drillDown: {
          path: '/students',
          params: filters.state ? { state: filters.state } : {},
        },
      },
      staff: {
        ...kpis.staff,
        drillDown: {
          path: '/hr/staff',
          params: filters.state ? { state: filters.state } : {},
        },
      },
      branches: {
        ...kpis.branches,
        drillDown: {
          path: '/organization/branches',
          params: {},
        },
      },
      finance: {
        ...kpis.finance,
        drillDown: {
          path: '/finance/reports',
          params: {},
        },
      },
      attendance: {
        ...kpis.attendance,
        drillDown: {
          path: '/attendance/reports',
          params: { date: new Date().toISOString().split('T')[0] },
        },
      },
      admissions: {
        ...kpis.admissions,
        drillDown: {
          path: '/admissions/leads',
          params: {},
        },
      },
    };
  }

  // ============ Alerts Configuration ============

  async getAlerts(tenantId: string, branchId?: string, sc: DashboardScope = ALL) {
    const tenantObjId = new ObjectId(tenantId);

    // Calculate alert data
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const branchFilter = branchId ? { branchId: new ObjectId(branchId) } : {};

    const [feeDueCount, lowAttendanceCount, pendingApprovalsCount, upcomingEventsCount] =
      await Promise.all([
        // Students with overdue fees
        collections.feeAssignments.countDocuments({
          tenantId: tenantObjId,
          ...branchFilter,
          'summary.balance': { $gt: 0 },
          dueDate: { $lt: today },
          ...inIds('studentId', sc.studentIds),
        }),

        // Students with attendance below 75%
        this.getLowAttendanceCount(tenantId, branchId, sc.studentIds),

        // Pending approvals (leaves + concessions)
        Promise.all([
          collections.leaves.countDocuments({
            tenantId: tenantObjId,
            ...branchFilter,
            status: 'pending',
            ...inIds('staffId', sc.staffIds),
          }),
          collections.concessions.countDocuments({
            tenantId: tenantObjId,
            ...branchFilter,
            status: 'pending',
            ...inIds('studentId', sc.studentIds),
          }),
        ]).then(([leaves, concessions]) => leaves + concessions),

        // Upcoming events in next 7 days
        collections.events.countDocuments({
          tenantId: tenantObjId,
          startDate: { $gte: today, $lte: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000) },
          status: 'scheduled',
        }),
      ]);

    const alerts: Array<{
      id: string;
      type: string;
      severity: 'info' | 'warning' | 'critical';
      title: string;
      message: string;
      count: number;
      link: string;
    }> = [];

    if (feeDueCount > 0) {
      alerts.push({
        id: 'fee_due',
        type: 'fee_due',
        severity: feeDueCount > 50 ? 'critical' : 'warning',
        title: 'Overdue Fees',
        message: `${feeDueCount} students have overdue fee payments`,
        count: feeDueCount,
        link: '/finance/reports?filter=overdue',
      });
    }

    if (lowAttendanceCount > 0) {
      alerts.push({
        id: 'low_attendance',
        type: 'low_attendance',
        severity: lowAttendanceCount > 20 ? 'warning' : 'info',
        title: 'Low Attendance',
        message: `${lowAttendanceCount} students have attendance below 75%`,
        count: lowAttendanceCount,
        link: '/attendance/reports?filter=low',
      });
    }

    if (pendingApprovalsCount > 0) {
      alerts.push({
        id: 'pending_approvals',
        type: 'pending_approvals',
        severity: pendingApprovalsCount > 10 ? 'warning' : 'info',
        title: 'Pending Approvals',
        message: `${pendingApprovalsCount} items awaiting approval`,
        count: pendingApprovalsCount,
        link: '/organization/approvals',
      });
    }

    if (upcomingEventsCount > 0) {
      alerts.push({
        id: 'upcoming_events',
        type: 'upcoming_events',
        severity: 'info',
        title: 'Upcoming Events',
        message: `${upcomingEventsCount} events scheduled in the next 7 days`,
        count: upcomingEventsCount,
        link: '/communication/events',
      });
    }

    return { alerts, summary: { total: alerts.length } };
  }

  private async getLowAttendanceCount(
    tenantId: string,
    branchId?: string,
    studentIds: ObjectId[] | null = null
  ): Promise<number> {
    // This is a simplified version - in production you'd calculate actual attendance percentages
    const tenantObjId = new ObjectId(tenantId);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const branchFilter = branchId ? { branchId: new ObjectId(branchId) } : {};

    // Get students with low attendance
    const lowAttendance = await collections.studentAttendance
      .aggregate([
        {
          $match: {
            tenantId: tenantObjId,
            date: { $gte: thirtyDaysAgo },
            ...branchFilter,
          },
        },
        { $unwind: '$records' },
        ...(studentIds ? [{ $match: { 'records.studentId': { $in: studentIds } } }] : []),
        {
          $group: {
            _id: '$records.studentId',
            totalDays: { $sum: 1 },
            presentDays: {
              $sum: { $cond: [{ $in: ['$records.status', ['present', 'late']] }, 1, 0] },
            },
          },
        },
        {
          $project: {
            attendanceRate: {
              $multiply: [{ $divide: ['$presentDays', '$totalDays'] }, 100],
            },
          },
        },
        {
          $match: {
            attendanceRate: { $lt: 75 },
          },
        },
        {
          $count: 'count',
        },
      ])
      .toArray();

    return lowAttendance[0]?.count || 0;
  }

  // ============ Academic Batch Filtered Metrics ============

  async getMetricsByAcademicBatch(tenantId: string, academicBatchId: string, branchId?: string) {
    const tenantObjId = new ObjectId(tenantId);
    const batchObjId = new ObjectId(academicBatchId);

    const branchFilter = branchId ? { branchId: new ObjectId(branchId) } : {};

    // Get students enrolled in this academic batch
    const studentCount = await collections.students.countDocuments({
      tenantId: tenantObjId,
      'currentEnrollment.academicBatchId': batchObjId,
      status: 'active',
      ...branchFilter,
    });

    // Get fee stats for this batch
    const feeStats = await collections.feeAssignments
      .aggregate([
        {
          $match: {
            tenantId: tenantObjId,
            academicBatchId: batchObjId,
            ...branchFilter,
          },
        },
        {
          $group: {
            _id: null,
            totalBilled: { $sum: '$summary.netPayable' },
            totalPaid: { $sum: '$summary.totalPaid' },
          },
        },
      ])
      .toArray();

    const fee = feeStats[0] || { totalBilled: 0, totalPaid: 0 };

    // Get classes in this batch
    const classes = await collections.classes
      .find({
        tenantId: tenantObjId,
        academicBatchId: batchObjId,
        ...branchFilter,
      })
      .project({ _id: 1, name: 1, displayName: 1 })
      .toArray();

    return {
      academicBatchId,
      students: studentCount,
      classes: classes.map((c) => ({
        _id: (c._id as ObjectId).toString(),
        name: c.name,
        displayName: c.displayName,
      })),
      finance: {
        totalBilled: fee.totalBilled,
        totalCollected: fee.totalPaid,
        totalDue: fee.totalBilled - fee.totalPaid,
        collectionRate:
          fee.totalBilled > 0 ? Math.round((fee.totalPaid / fee.totalBilled) * 100) : 0,
      },
    };
  }

  // ============ Helper Methods ============

  private async getFeeStats(tenantId: string, filters: Partial<DashboardFilters> = {}) {
    const tenantObjId = new ObjectId(tenantId);
    const matchFilter: Filter<Document> = { tenantId: tenantObjId };

    if (filters.branchId) {
      matchFilter.branchId = new ObjectId(filters.branchId);
    } else if (filters.branchIds?.length) {
      matchFilter.branchId = { $in: filters.branchIds.map((id) => new ObjectId(id)) };
    }

    if (filters.studentIds) matchFilter.studentId = { $in: filters.studentIds };

    // Fee assignments keep their money under `summary.*`; the flat
    // totalAmount/paidAmount fields these used to read have never existed, so
    // every owner-dashboard fee figure came back as zero.
    const stats = await collections.feeAssignments
      .aggregate([
        { $match: { ...matchFilter, status: { $ne: 'cancelled' } } },
        {
          $group: {
            _id: null,
            totalBilled: { $sum: '$summary.netPayable' },
            totalPaid: { $sum: '$summary.totalPaid' },
          },
        },
      ])
      .toArray();

    const result = stats[0] || { totalBilled: 0, totalPaid: 0 };
    const totalDue = result.totalBilled - result.totalPaid;
    const collectionRate =
      result.totalBilled > 0 ? Math.round((result.totalPaid / result.totalBilled) * 100) : 0;

    return {
      totalBilled: result.totalBilled,
      totalCollected: result.totalPaid,
      totalDue,
      collectionRate,
    };
  }

  private async getAttendanceRate(tenantId: string, filters: Partial<DashboardFilters> = {}) {
    const tenantObjId = new ObjectId(tenantId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const matchFilter: Filter<Document> = {
      tenantId: tenantObjId,
      date: today,
    };

    if (filters.branchIds?.length) {
      matchFilter.branchId = { $in: filters.branchIds.map((id) => new ObjectId(id)) };
    }

    const stats = await collections.studentAttendance
      .aggregate([
        { $match: matchFilter },
        { $unwind: '$records' },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            present: {
              $sum: {
                $cond: [{ $in: ['$records.status', ['present', 'late']] }, 1, 0],
              },
            },
          },
        },
      ])
      .toArray();

    if (!stats[0] || stats[0].total === 0) return 0;
    return Math.round((stats[0].present / stats[0].total) * 100);
  }

  private async getAdmissionStats(tenantId: string, filters: Partial<DashboardFilters> = {}) {
    const tenantObjId = new ObjectId(tenantId);
    const matchFilter: Filter<Document> = { tenantId: tenantObjId };

    if (filters.branchIds?.length) {
      matchFilter.branchId = { $in: filters.branchIds.map((id) => new ObjectId(id)) };
    }

    const stats = await collections.leads
      .aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            converted: {
              $sum: { $cond: [{ $eq: ['$stage', 'converted'] }, 1, 0] },
            },
          },
        },
      ])
      .toArray();

    const result = stats[0] || { total: 0, converted: 0 };
    const conversionRate =
      result.total > 0 ? Math.round((result.converted / result.total) * 100) : 0;

    return {
      totalLeads: result.total,
      converted: result.converted,
      conversionRate,
    };
  }

  private async getTodayAttendance(
    tenantId: string,
    branchId: string,
    ids: ObjectId[] | null = null
  ) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stats = await collections.studentAttendance
      .aggregate([
        {
          $match: {
            tenantId: tenantObjId,
            branchId: branchObjId,
            date: today,
          },
        },
        { $unwind: '$records' },
        ...(ids ? [{ $match: { 'records.studentId': { $in: ids } } }] : []),
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            present: {
              $sum: {
                $cond: [{ $in: ['$records.status', ['present', 'late']] }, 1, 0],
              },
            },
          },
        },
      ])
      .toArray();

    if (!stats[0] || stats[0].total === 0) return { rate: 0, present: 0, total: 0 };

    return {
      rate: Math.round((stats[0].present / stats[0].total) * 100),
      present: stats[0].present,
      total: stats[0].total,
    };
  }

  /** Staff marked present/late today in the HR register. */
  private async getTodayStaffAttendance(
    tenantObjId: ObjectId,
    branchObjId: ObjectId,
    ids: ObjectId[] | null = null
  ) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [row] = await collections.staffAttendance
      .aggregate([
        {
          $match: {
            tenantId: tenantObjId,
            branchId: branchObjId,
            date: { $gte: today, $lt: new Date(today.getTime() + 86_400_000) },
          },
        },
        { $unwind: '$records' },
        ...(ids ? [{ $match: { 'records.staffId': { $in: ids } } }] : []),
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            present: {
              $sum: {
                $cond: [{ $in: ['$records.status', ['present', 'late', 'half_day']] }, 1, 0],
              },
            },
          },
        },
      ])
      .toArray();
    return { present: (row?.present as number) ?? 0, total: (row?.total as number) ?? 0 };
  }

  private async getTodayAttendanceDetails(
    tenantId: string,
    branchId: string,
    ids: ObjectId[] | null = null
  ) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stats = await collections.studentAttendance
      .aggregate([
        {
          $match: {
            tenantId: tenantObjId,
            branchId: branchObjId,
            date: today,
          },
        },
        { $unwind: '$records' },
        ...(ids ? [{ $match: { 'records.studentId': { $in: ids } } }] : []),
        {
          $group: {
            _id: '$records.status',
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    const result: Record<string, number> = {
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
    };

    stats.forEach((s) => {
      result[s._id] = s.count;
    });

    const total = Object.values(result).reduce((a, b) => a + b, 0);
    const attendanceRate =
      total > 0 ? Math.round(((result.present + result.late) / total) * 100) : 0;

    return {
      ...result,
      total,
      rate: attendanceRate,
    };
  }

  // ============ Scope Breakdown (Dean / HOD / Program dashboards) ============

  /**
   * One level below the caller's scope: departments for an institution (or
   * whole-campus) admin, sections for a department or program scope. Each row
   * carries active students and 30-day attendance; departments add faculty/HOD.
   */
  async getScopeBreakdown(
    tenantId: string,
    branchId: string,
    scope:
      | {
          type?: string;
          institutionIds?: string[];
          departmentIds?: string[];
          programIds?: string[];
        }
      | undefined,
    sc: DashboardScope = ALL
  ) {
    const title = await this.scopeTitle(scope);
    if (!scope || scope.type === 'institution' || !sc.studentIds) {
      const departments = (await departmentOverviewService.getOverview(tenantId, branchId)).filter(
        (d) =>
          d.type === 'academic' &&
          (scope?.type !== 'institution' ||
            (!!d.institution && (scope.institutionIds ?? []).includes(d.institution._id)))
      );
      return {
        title,
        level: 'department' as const,
        rows: departments.map((d) => ({
          id: d._id,
          name: d.name,
          meta: d.headOfDepartment?.displayName ?? null,
          students: d.students,
          faculty: d.faculty,
          attendancePct: d.attendancePct,
        })),
      };
    }

    const tenantOid = new ObjectId(tenantId);
    const sectionRows = await collections.students
      .aggregate([
        { $match: { tenantId: tenantOid, status: 'active', _id: { $in: sc.studentIds } } },
        { $group: { _id: '$currentEnrollment.sectionId', students: { $sum: 1 } } },
      ])
      .toArray();
    const sectionIds = sectionRows.map((r) => r._id).filter(Boolean) as ObjectId[];
    const since = new Date();
    since.setDate(since.getDate() - 30);
    since.setHours(0, 0, 0, 0);
    const [sections, attendance] = await Promise.all([
      collections.sections
        .find({ _id: { $in: sectionIds } })
        .project({ name: 1, classId: 1 })
        .toArray(),
      collections.studentAttendance
        .aggregate([
          {
            $match: { tenantId: tenantOid, sectionId: { $in: sectionIds }, date: { $gte: since } },
          },
          {
            $group: {
              _id: '$sectionId',
              present: { $sum: '$summary.present' },
              total: { $sum: '$summary.total' },
            },
          },
        ])
        .toArray(),
    ]);
    const classes = await collections.classes
      .find({ _id: { $in: sections.map((x) => x.classId as ObjectId) } })
      .project({ displayName: 1 })
      .toArray();
    const classMap = new Map(classes.map((c) => [c._id.toString(), c.displayName as string]));
    const sectionMap = new Map(sections.map((x) => [x._id.toString(), x]));
    const attMap = new Map(attendance.map((a) => [String(a._id), a]));

    const rows = sectionRows
      .filter((r) => r._id && sectionMap.has(String(r._id)))
      .map((r) => {
        const sec = sectionMap.get(String(r._id))!;
        const att = attMap.get(String(r._id));
        return {
          id: String(r._id),
          name: `${classMap.get(String(sec.classId)) ?? 'Class'} · ${sec.name as string}`,
          meta: null,
          students: r.students as number,
          faculty: null,
          attendancePct:
            att && (att.total as number) > 0
              ? Math.round(((att.present as number) / (att.total as number)) * 100)
              : null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    return { title, level: 'section' as const, rows };
  }

  /** Display name of what a scoped user oversees, e.g. "Audit Institute of Engineering". */
  private async scopeTitle(
    scope:
      | {
          type?: string;
          institutionIds?: string[];
          departmentIds?: string[];
          programIds?: string[];
        }
      | undefined
  ): Promise<string | null> {
    const pick = {
      institution: [collections.institutions, scope?.institutionIds],
      department: [collections.departments, scope?.departmentIds],
      program: [collections.programs, scope?.programIds],
    } as const;
    const entry = scope?.type ? pick[scope.type as keyof typeof pick] : undefined;
    if (!entry || !entry[1]?.length) return null;
    const docs = await entry[0]
      .find({ _id: { $in: entry[1].map((id) => new ObjectId(id)) } })
      .project({ name: 1 })
      .toArray();
    return docs.map((d) => d.name as string).join(', ') || null;
  }
}

export const dashboardService = new DashboardService();

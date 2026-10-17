import { ObjectId, WithId, Document, Filter } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { hrSettingsService } from './hrSettings.service';

interface LeaveDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  staffId: ObjectId;
  /** Leave type code from HR settings (CL, SL, EL, LWP, …). */
  leaveType: string;
  fromDate: Date;
  toDate: Date;
  days: number;
  isHalfDay: boolean;
  halfDayType?: 'first-half' | 'second-half';
  reason: string;
  documents?: Array<{ type: string; url: string }>;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  appliedBy?: ObjectId;
  approverId?: ObjectId;
  approverRemarks?: string;
  approvedAt?: Date;
  cancellationReason?: string;
  cancelledAt?: Date;
  appliedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApplyLeaveInput {
  leaveType: string;
  fromDate: string;
  toDate: string;
  isHalfDay?: boolean;
  halfDayType?: 'first-half' | 'second-half';
  reason: string;
  documents?: Array<{ type: string; url: string }>;
}

export interface LeaveListParams {
  page?: number;
  limit?: number;
  staffId?: string;
  /** Restrict to staff in these departments (HOD / dean scope); null = all. */
  departmentIds?: ObjectId[] | null;
  /** Leave out this staff member's own requests (an approver's queue). */
  excludeStaffId?: string;
  leaveType?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
  approverId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/** One leave type's position for a staff member in the current leave year. */
export interface LeaveBalanceItem {
  code: string;
  leaveType: string;
  color?: string;
  isPaid: boolean;
  /** No allowance cap (e.g. leave without pay). */
  unlimited: boolean;
  total: number;
  used: number;
  pending: number;
  available: number;
}

const DAY = 86_400_000;
/** Calendar date as YYYY-MM-DD in UTC — dates are stored at UTC midnight. */
const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const startOfUtcDay = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/**
 * Working days between two dates, inclusive: weekly offs (incl. the
 * alternate-Saturday rule) and staff holidays don't count against leave.
 * Exported for tests.
 */
export function countWorkingDays(
  from: Date,
  to: Date,
  weeklyOffs: {
    days: number[];
    alternateWeekday?: { enabled: boolean; day: number; pattern: string };
  },
  holidayKeys: Set<string>
): number {
  const nth = { first: [1], second: [2], third: [3], fourth: [4], alternate: [2, 4] } as Record<
    string,
    number[]
  >;
  let count = 0;
  for (let t = from.getTime(); t <= to.getTime(); t += DAY) {
    const d = new Date(t);
    const dow = d.getUTCDay();
    if (weeklyOffs.days.includes(dow)) continue;
    const alt = weeklyOffs.alternateWeekday;
    if (alt?.enabled && alt.day === dow) {
      const occurrence = Math.ceil(d.getUTCDate() / 7);
      if ((nth[alt.pattern] ?? []).includes(occurrence)) continue;
    }
    if (holidayKeys.has(dayKey(d))) continue;
    count++;
  }
  return count;
}

class LeaveService {
  /** Leave year: the current academic batch, else the calendar year. */
  private async leaveYear(tenantId: ObjectId, branchId: ObjectId) {
    const batch = await collections.academicBatches.findOne({
      tenantId,
      branchId,
      isCurrent: true,
    });
    if (batch?.startDate && batch?.endDate) {
      return { from: new Date(batch.startDate), to: new Date(batch.endDate) };
    }
    const y = new Date().getUTCFullYear();
    return { from: new Date(Date.UTC(y, 0, 1)), to: new Date(Date.UTC(y, 11, 31)) };
  }

  private async staffHolidayKeys(tenantId: ObjectId, branchId: ObjectId, from: Date, to: Date) {
    const holidays = await collections.holidays
      .find({
        tenantId,
        branchId,
        applicableFor: { $in: ['all', 'staff'] },
        date: { $lte: to },
        $or: [{ endDate: { $gte: from } }, { endDate: null, date: { $gte: from } }],
      })
      .project({ date: 1, endDate: 1 })
      .toArray();
    const keys = new Set<string>();
    for (const h of holidays) {
      const end = h.endDate ? new Date(h.endDate) : new Date(h.date);
      for (let t = startOfUtcDay(new Date(h.date)).getTime(); t <= end.getTime(); t += DAY) {
        keys.add(dayKey(new Date(t)));
      }
    }
    return keys;
  }

  async apply(
    tenantId: string,
    branchId: string,
    staffId: string,
    data: ApplyLeaveInput,
    appliedBy: string
  ) {
    const tenantOid = new ObjectId(tenantId);
    const branchOid = new ObjectId(branchId);
    const staffOid = new ObjectId(staffId);
    const fromDate = startOfUtcDay(new Date(data.fromDate));
    const toDate = startOfUtcDay(new Date(data.toDate));

    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw new ApiError('INVALID_DATES', 'Choose valid from and to dates', 400);
    }
    if (toDate < fromDate) {
      throw new ApiError('INVALID_DATES', 'The end date is before the start date', 400);
    }
    if (data.isHalfDay && dayKey(fromDate) !== dayKey(toDate)) {
      throw new ApiError('INVALID_DATES', 'A half day must start and end on the same date', 400);
    }
    if (!data.reason?.trim()) {
      throw new ApiError('VALIDATION_ERROR', 'Please give a reason for the leave', 400);
    }

    const settings = await hrSettingsService.getSettings(tenantId, branchId);
    const type = settings.leaveTypes.find((t) => t.code === data.leaveType && t.isActive);
    if (!type) {
      throw new ApiError('INVALID_LEAVE_TYPE', 'This leave type is not available', 400);
    }

    const today = startOfUtcDay(new Date());
    const noticeDays = Math.round((fromDate.getTime() - today.getTime()) / DAY);
    if (type.minDaysNotice > 0 && noticeDays < type.minDaysNotice) {
      throw new ApiError(
        'NOTICE_TOO_SHORT',
        `${type.name} needs ${type.minDaysNotice} day(s) notice`,
        400
      );
    }

    const holidays = await this.staffHolidayKeys(tenantOid, branchOid, fromDate, toDate);
    const working = countWorkingDays(fromDate, toDate, settings.weeklyOffs, holidays);
    if (working === 0) {
      throw new ApiError(
        'NO_WORKING_DAYS',
        'Those dates are all weekly offs or holidays — no leave is needed',
        400
      );
    }
    const days = data.isHalfDay ? 0.5 : working;

    const overlapping = await collections.leaves.findOne({
      tenantId: tenantOid,
      staffId: staffOid,
      status: { $in: ['pending', 'approved'] },
      fromDate: { $lte: toDate },
      toDate: { $gte: fromDate },
    });
    if (overlapping) {
      throw new ApiError(
        'OVERLAPPING_LEAVE',
        'You already have a leave request covering some of these dates',
        400
      );
    }

    if (type.defaultAllowance > 0) {
      const balance = (await this.getLeaveBalance(tenantId, branchId, staffId)).balances.find(
        (b) => b.code === type.code
      );
      if (balance && days > balance.available) {
        throw new ApiError(
          'INSUFFICIENT_BALANCE',
          `Only ${balance.available} day(s) of ${type.name} left (including pending requests)`,
          400
        );
      }
    }

    const now = new Date();
    const leave: LeaveDocument = {
      _id: new ObjectId(),
      tenantId: tenantOid,
      branchId: branchOid,
      staffId: staffOid,
      leaveType: type.code,
      fromDate,
      toDate,
      days,
      isHalfDay: data.isHalfDay || false,
      halfDayType: data.isHalfDay ? data.halfDayType : undefined,
      reason: data.reason.trim(),
      documents: data.documents,
      status: 'pending',
      appliedBy: new ObjectId(appliedBy),
      appliedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    await collections.leaves.insertOne(leave);
    logger.info({ leaveId: leave._id.toString(), staffId, days }, 'Leave applied');
    return this.formatLeave(leave);
  }

  async findById(tenantId: string, leaveId: string) {
    return this.formatLeave(await this.getLeave(tenantId, leaveId));
  }

  private async getLeave(tenantId: string, leaveId: string) {
    const leave = (await collections.leaves.findOne({
      _id: new ObjectId(leaveId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<LeaveDocument> | null;
    if (!leave) throw new ApiError('LEAVE_NOT_FOUND', 'Leave request not found', 404);
    return leave;
  }

  /** Whether a staff member falls inside an approver's department scope (null = everyone). */
  async staffInScope(staffId: ObjectId, departmentIds: ObjectId[] | null) {
    if (!departmentIds) return true;
    const staff = await collections.staff.findOne(
      { _id: staffId },
      { projection: { 'employment.departmentId': 1 } }
    );
    const dept = staff?.employment?.departmentId as ObjectId | undefined;
    return !!dept && departmentIds.some((d) => d.equals(dept));
  }

  async findAll(tenantId: string, branchId: string, params: LeaveListParams = {}) {
    const {
      page = 1,
      limit = 20,
      staffId,
      departmentIds = null,
      excludeStaffId,
      leaveType,
      status,
      fromDate,
      toDate,
      approverId,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };
    if (staffId) filter.staffId = new ObjectId(staffId);
    if (excludeStaffId) filter.staffId = { $ne: new ObjectId(excludeStaffId) };
    if (leaveType) filter.leaveType = leaveType;
    if (status) filter.status = status;
    if (fromDate || toDate) {
      filter.fromDate = {};
      if (fromDate) (filter.fromDate as Record<string, Date>).$gte = new Date(fromDate);
      if (toDate) (filter.fromDate as Record<string, Date>).$lte = new Date(toDate);
    }
    if (approverId) filter.approverId = new ObjectId(approverId);

    const scopeStages = departmentIds
      ? [{ $match: { 'staff.employment.departmentId': { $in: departmentIds } } }]
      : [];
    const skip = (page - 1) * limit;
    const base = [
      { $match: filter },
      { $lookup: { from: 'staff', localField: 'staffId', foreignField: '_id', as: 'staff' } },
      { $unwind: { path: '$staff', preserveNullAndEmptyArrays: true } },
      ...scopeStages,
    ];
    const [leaves, totalResult] = await Promise.all([
      collections.leaves
        .aggregate([
          ...base,
          { $sort: { [sortBy]: sortOrder === 'asc' ? 1 : -1, _id: sortOrder === 'asc' ? 1 : -1 } },
          { $skip: skip },
          { $limit: limit },
        ])
        .toArray(),
      collections.leaves.aggregate([...base, { $count: 'n' }]).toArray(),
    ]);
    const total = (totalResult[0]?.n as number) ?? 0;
    const types = await this.leaveTypeNames(tenantId, branchId);

    return {
      data: leaves.map((l) => this.formatLeaveWithStaff(l, types)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + leaves.length < total,
      },
    };
  }

  /**
   * Approve or reject. Approvers can't decide their own leave, and a scoped
   * approver (HOD, dean) only decides for staff in their departments.
   */
  async decide(
    tenantId: string,
    leaveId: string,
    decision: 'approved' | 'rejected',
    remarks: string,
    approver: { userId: string; staffId?: string; departmentIds: ObjectId[] | null }
  ) {
    const leave = await this.getLeave(tenantId, leaveId);
    if (leave.status !== 'pending') {
      throw new ApiError('ALREADY_PROCESSED', `This leave is already ${leave.status}`, 400);
    }
    if (approver.staffId && leave.staffId.equals(new ObjectId(approver.staffId))) {
      throw new ApiError('SELF_APPROVAL', 'You cannot approve or reject your own leave', 403);
    }
    if (!(await this.staffInScope(leave.staffId, approver.departmentIds))) {
      throw new ApiError(
        'OUT_OF_SCOPE',
        'This leave belongs to staff outside your department',
        403
      );
    }

    const now = new Date();
    // Conditional on still-pending so two approvers can't both act.
    const result = await collections.leaves.updateOne(
      { _id: leave._id, status: 'pending' },
      {
        $set: {
          status: decision,
          approverId: new ObjectId(approver.userId),
          approverRemarks: remarks,
          approvedAt: now,
          updatedAt: now,
        },
      }
    );
    if (result.modifiedCount === 0) {
      throw new ApiError('ALREADY_PROCESSED', 'This leave was just processed by someone else', 409);
    }
    logger.info({ leaveId, approverId: approver.userId, decision }, 'Leave decided');
    return this.findById(tenantId, leaveId);
  }

  /**
   * Withdraw a request. The applicant may cancel their own pending leave, or an
   * approved one that hasn't started; managers may cancel any active leave.
   */
  async cancel(
    tenantId: string,
    leaveId: string,
    reason: string,
    actor: { staffId?: string; isManager: boolean }
  ) {
    const leave = await this.getLeave(tenantId, leaveId);
    const isOwner = !!actor.staffId && leave.staffId.equals(new ObjectId(actor.staffId));
    if (!isOwner && !actor.isManager) {
      throw new ApiError('FORBIDDEN', 'You can only cancel your own leave', 403);
    }
    if (leave.status === 'cancelled' || leave.status === 'rejected') {
      throw new ApiError('NOT_CANCELLABLE', `This leave is already ${leave.status}`, 400);
    }
    if (
      leave.status === 'approved' &&
      !actor.isManager &&
      leave.fromDate <= startOfUtcDay(new Date())
    ) {
      throw new ApiError(
        'NOT_CANCELLABLE',
        'This leave has already started — ask your approver to cancel it',
        400
      );
    }

    const now = new Date();
    await collections.leaves.updateOne(
      { _id: leave._id },
      {
        $set: { status: 'cancelled', cancellationReason: reason, cancelledAt: now, updatedAt: now },
      }
    );
    logger.info({ leaveId, reason }, 'Leave cancelled');
    return this.findById(tenantId, leaveId);
  }

  async getMyLeaves(
    tenantId: string,
    branchId: string,
    staffId: string,
    params: LeaveListParams = {}
  ) {
    return this.findAll(tenantId, branchId, { ...params, staffId });
  }

  /**
   * Balance per configured leave type, computed from the leave records for the
   * current leave year — allowance minus approved minus pending days — so it
   * can never drift from the requests themselves.
   */
  async getLeaveBalance(tenantId: string, branchId: string, staffId: string) {
    const tenantOid = new ObjectId(tenantId);
    const branchOid = new ObjectId(branchId);
    const [settings, period] = await Promise.all([
      hrSettingsService.getSettings(tenantId, branchId),
      this.leaveYear(tenantOid, branchOid),
    ]);
    const usage = await collections.leaves
      .aggregate([
        {
          $match: {
            tenantId: tenantOid,
            staffId: new ObjectId(staffId),
            status: { $in: ['approved', 'pending'] },
            fromDate: { $gte: period.from, $lte: period.to },
          },
        },
        { $group: { _id: { type: '$leaveType', status: '$status' }, days: { $sum: '$days' } } },
      ])
      .toArray();
    const sum = (code: string, status: string) =>
      (usage.find((u) => u._id.type === code && u._id.status === status)?.days as number) ?? 0;

    const balances: LeaveBalanceItem[] = settings.leaveTypes
      .filter((t) => t.isActive)
      .map((t) => {
        const used = sum(t.code, 'approved');
        const pending = sum(t.code, 'pending');
        const unlimited = !(t.defaultAllowance > 0);
        return {
          code: t.code,
          leaveType: t.name,
          color: t.color,
          isPaid: t.isPaid,
          unlimited,
          total: t.defaultAllowance,
          used,
          pending,
          available: unlimited ? 0 : Math.max(0, t.defaultAllowance - used - pending),
        };
      });
    return { staffId, period, balances };
  }

  async getPendingApprovals(
    tenantId: string,
    branchId: string,
    params: {
      page?: number;
      limit?: number;
      departmentIds?: ObjectId[] | null;
      excludeStaffId?: string;
    } = {}
  ) {
    return this.findAll(tenantId, branchId, {
      ...params,
      status: 'pending',
      sortBy: 'appliedAt',
      sortOrder: 'asc',
    });
  }

  async getApprovalStats(
    tenantId: string,
    branchId: string,
    scope: { departmentIds?: ObjectId[] | null; excludeStaffId?: string } = {}
  ) {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const match: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };
    if (scope.excludeStaffId) match.staffId = { $ne: new ObjectId(scope.excludeStaffId) };
    const scoped = scope.departmentIds
      ? [
          { $lookup: { from: 'staff', localField: 'staffId', foreignField: '_id', as: 'staff' } },
          { $match: { 'staff.employment.departmentId': { $in: scope.departmentIds } } },
        ]
      : [];

    const [data = {}] = await collections.leaves
      .aggregate([
        { $match: match },
        ...scoped,
        {
          $facet: {
            pending: [
              { $match: { status: 'pending' } },
              { $group: { _id: null, count: { $sum: 1 }, totalDays: { $sum: '$days' } } },
            ],
            approvedThisMonth: [
              { $match: { status: 'approved', approvedAt: { $gte: monthStart } } },
              { $count: 'count' },
            ],
            rejectedThisMonth: [
              { $match: { status: 'rejected', approvedAt: { $gte: monthStart } } },
              { $count: 'count' },
            ],
          },
        },
      ])
      .toArray();

    return {
      pending: data.pending?.[0]?.count || 0,
      approvedThisMonth: data.approvedThisMonth?.[0]?.count || 0,
      rejectedThisMonth: data.rejectedThisMonth?.[0]?.count || 0,
      totalPendingDays: data.pending?.[0]?.totalDays || 0,
    };
  }

  async getLeaveReport(tenantId: string, branchId: string, fromDate: string, toDate: string) {
    const report = await collections.leaves
      .aggregate([
        {
          $match: {
            tenantId: new ObjectId(tenantId),
            branchId: new ObjectId(branchId),
            status: 'approved',
            fromDate: { $gte: new Date(fromDate), $lte: new Date(toDate) },
          },
        },
        {
          $group: {
            _id: { staffId: '$staffId', leaveType: '$leaveType' },
            totalDays: { $sum: '$days' },
            count: { $sum: 1 },
          },
        },
        {
          $lookup: { from: 'staff', localField: '_id.staffId', foreignField: '_id', as: 'staff' },
        },
        { $unwind: { path: '$staff', preserveNullAndEmptyArrays: true } },
      ])
      .toArray();

    return report.map((r) => ({
      staffId: r._id.staffId.toString(),
      staffName: r.staff?.displayName,
      employeeId: r.staff?.employeeId,
      leaveType: r._id.leaveType,
      totalDays: r.totalDays,
      count: r.count,
    }));
  }

  private async leaveTypeNames(tenantId: string, branchId: string) {
    const settings = await hrSettingsService.getSettings(tenantId, branchId);
    return new Map(settings.leaveTypes.map((t) => [t.code, t.name]));
  }

  private formatLeave(leave: LeaveDocument) {
    return {
      _id: leave._id.toString(),
      tenantId: leave.tenantId.toString(),
      branchId: leave.branchId.toString(),
      staffId: leave.staffId.toString(),
      leaveType: leave.leaveType,
      fromDate: leave.fromDate,
      toDate: leave.toDate,
      days: leave.days,
      isHalfDay: leave.isHalfDay,
      halfDayType: leave.halfDayType,
      reason: leave.reason,
      documents: leave.documents,
      status: leave.status,
      approverId: leave.approverId?.toString(),
      approverRemarks: leave.approverRemarks,
      approvedAt: leave.approvedAt,
      cancellationReason: leave.cancellationReason,
      cancelledAt: leave.cancelledAt,
      appliedAt: leave.appliedAt,
      createdAt: leave.createdAt,
      updatedAt: leave.updatedAt,
    };
  }

  private formatLeaveWithStaff(leave: Document, typeNames: Map<string, string>) {
    return {
      ...this.formatLeave(leave as LeaveDocument),
      leaveTypeName: typeNames.get(leave.leaveType) ?? leave.leaveType,
      staff: leave.staff
        ? {
            _id: leave.staff._id.toString(),
            employeeId: leave.staff.employeeId,
            displayName:
              leave.staff.displayName ??
              [leave.staff.firstName, leave.staff.lastName].filter(Boolean).join(' '),
          }
        : null,
    };
  }
}

export const leaveService = new LeaveService();

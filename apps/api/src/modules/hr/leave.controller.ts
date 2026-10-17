import { Request, Response, NextFunction } from 'express';
import { ObjectId } from 'mongodb';
import { leaveService, LeaveListParams } from './leave.service';
import { success, created } from '../../utils/response';
import { collections } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler';
import { hasPermission } from '../../middleware/rbac';
import { getScopedDepartmentIds } from '../../middleware/scope';

/** The staff record linked to the signed-in user, if any. */
async function selfStaffId(req: Request): Promise<string | undefined> {
  const staff = await collections.staff.findOne(
    { tenantId: new ObjectId(req.tenantId), userId: new ObjectId(req.user!.userId) },
    { projection: { _id: 1 } }
  );
  return staff?._id.toString();
}

async function requireSelfStaffId(req: Request): Promise<string> {
  const id = await selfStaffId(req);
  if (!id) {
    throw new ApiError(
      'STAFF_NOT_FOUND',
      'Your account is not linked to a staff profile, so leave is not available',
      404
    );
  }
  return id;
}

/** Approvers / HR: may see and act on other people's leave (within their scope). */
const isManager = (req: Request) =>
  ['approve', 'reject', 'edit'].some((a) => hasPermission(req.user, 'hr.leaves', a));

const requireBranch = (req: Request) => {
  if (!req.branchId) throw new ApiError('BRANCH_REQUIRED', 'Branch ID is required', 400);
  return req.branchId;
};

const listParams = (req: Request): LeaveListParams => ({
  page: req.query.page ? parseInt(req.query.page as string) : 1,
  limit: Math.min(req.query.limit ? parseInt(req.query.limit as string) : 20, 100),
  leaveType: req.query.leaveType as string,
  status: req.query.status as string,
  fromDate: req.query.fromDate as string,
  toDate: req.query.toDate as string,
  sortBy: req.query.sortBy as string,
  sortOrder: req.query.sortOrder as 'asc' | 'desc',
});

class LeaveController {
  /** Everyone's leave for managers (scoped to their departments); your own otherwise. */
  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      const branchId = requireBranch(req);
      const params = listParams(req);
      if (isManager(req)) {
        params.staffId = req.query.staffId as string;
        params.departmentIds = await getScopedDepartmentIds(req);
      } else {
        params.staffId = await requireSelfStaffId(req);
      }
      const result = await leaveService.findAll(req.tenantId!, branchId, params);
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const leave = await leaveService.findById(req.tenantId!, req.params.id as string);
      const mine = leave.staffId === (await selfStaffId(req));
      const visible =
        mine ||
        (isManager(req) &&
          (await leaveService.staffInScope(
            new ObjectId(leave.staffId),
            await getScopedDepartmentIds(req)
          )));
      if (!visible) throw new ApiError('LEAVE_NOT_FOUND', 'Leave request not found', 404);
      success(res, leave);
    } catch (error) {
      next(error);
    }
  }

  /** Apply for yourself; managers may apply on behalf of a staff member in scope. */
  async apply(req: Request, res: Response, next: NextFunction) {
    try {
      const branchId = requireBranch(req);
      const requested = req.body.staffId as string | undefined;
      const self = await selfStaffId(req);
      let staffId = self;
      if (requested && requested !== self) {
        if (
          !isManager(req) ||
          !(await leaveService.staffInScope(
            new ObjectId(requested),
            await getScopedDepartmentIds(req)
          ))
        ) {
          throw new ApiError('FORBIDDEN', 'You can only apply for your own leave', 403);
        }
        staffId = requested;
      }
      if (!staffId) staffId = await requireSelfStaffId(req);

      const leave = await leaveService.apply(
        req.tenantId!,
        branchId,
        staffId,
        req.body,
        req.user!.userId
      );
      created(res, leave, 'Leave applied successfully');
    } catch (error) {
      next(error);
    }
  }

  private async decide(
    req: Request,
    res: Response,
    next: NextFunction,
    d: 'approved' | 'rejected'
  ) {
    try {
      // Older clients send approverRemarks; accept either.
      const remarks = ((req.body.remarks ?? req.body.approverRemarks ?? '') as string).trim();
      if (d === 'rejected' && !remarks) {
        throw new ApiError('VALIDATION_ERROR', 'Please say why the leave is being rejected', 400);
      }
      const leave = await leaveService.decide(req.tenantId!, req.params.id as string, d, remarks, {
        userId: req.user!.userId,
        staffId: await selfStaffId(req),
        departmentIds: await getScopedDepartmentIds(req),
      });
      success(res, leave, undefined, d === 'approved' ? 'Leave approved' : 'Leave rejected');
    } catch (error) {
      next(error);
    }
  }

  approve = (req: Request, res: Response, next: NextFunction) =>
    this.decide(req, res, next, 'approved');

  reject = (req: Request, res: Response, next: NextFunction) =>
    this.decide(req, res, next, 'rejected');

  async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const leave = await leaveService.cancel(
        req.tenantId!,
        req.params.id as string,
        ((req.body?.reason as string) || '').trim(),
        { staffId: await selfStaffId(req), isManager: isManager(req) }
      );
      success(res, leave, undefined, 'Leave cancelled');
    } catch (error) {
      next(error);
    }
  }

  async getMyLeaves(req: Request, res: Response, next: NextFunction) {
    try {
      const branchId = requireBranch(req);
      const staffId = await requireSelfStaffId(req);
      const result = await leaveService.getMyLeaves(
        req.tenantId!,
        branchId,
        staffId,
        listParams(req)
      );
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  /** Your balance; managers may look up a staff member in scope via ?staffId. */
  async getBalance(req: Request, res: Response, next: NextFunction) {
    try {
      const branchId = requireBranch(req);
      const requested = req.query.staffId as string | undefined;
      const self = await selfStaffId(req);
      let staffId = self;
      if (requested && requested !== self) {
        if (
          !isManager(req) ||
          !(await leaveService.staffInScope(
            new ObjectId(requested),
            await getScopedDepartmentIds(req)
          ))
        ) {
          throw new ApiError('FORBIDDEN', "You can't view another person's leave balance", 403);
        }
        staffId = requested;
      }
      if (!staffId) staffId = await requireSelfStaffId(req);
      success(res, await leaveService.getLeaveBalance(req.tenantId!, branchId, staffId));
    } catch (error) {
      next(error);
    }
  }

  async getReport(req: Request, res: Response, next: NextFunction) {
    try {
      const branchId = requireBranch(req);
      const { fromDate, toDate } = req.query;
      if (!fromDate || !toDate) {
        throw new ApiError('VALIDATION_ERROR', 'fromDate and toDate are required', 400);
      }
      const report = await leaveService.getLeaveReport(
        req.tenantId!,
        branchId,
        fromDate as string,
        toDate as string
      );
      success(res, report);
    } catch (error) {
      next(error);
    }
  }

  /** The approver's queue: pending leave in their scope, never their own. */
  async getPendingApprovals(req: Request, res: Response, next: NextFunction) {
    try {
      const branchId = requireBranch(req);
      const result = await leaveService.getPendingApprovals(req.tenantId!, branchId, {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        departmentIds: await getScopedDepartmentIds(req),
        excludeStaffId: await selfStaffId(req),
      });
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getApprovalStats(req: Request, res: Response, next: NextFunction) {
    try {
      const branchId = requireBranch(req);
      const stats = await leaveService.getApprovalStats(req.tenantId!, branchId, {
        departmentIds: await getScopedDepartmentIds(req),
        excludeStaffId: await selfStaffId(req),
      });
      success(res, stats);
    } catch (error) {
      next(error);
    }
  }
}

export const leaveController = new LeaveController();

import { ObjectId } from 'mongodb';
import { collections } from '../../config/database';
import { getScopedDepartmentIds } from '../../middleware/scope';
import { hasPermission } from '../../middleware/rbac';
import { getStudentVisibilityFilter } from '../teaching/scope';
import type { DashboardScope } from './dashboard.service';
import { Request, Response, NextFunction } from 'express';
import { dashboardService } from './dashboard.service';
import { setupStatusService } from './setupStatus.service';
import { success } from '../../utils/response';

/**
 * The students and staff a scoped admin or HOD may count, so an institution
 * admin's dashboard shows their institution, not the whole campus.
 */
async function dashboardScope(req: Request): Promise<DashboardScope> {
  const tenantId = new ObjectId(req.tenantId!);
  const branchId = new ObjectId(req.branchId!);
  const [visibility, departmentIds] = await Promise.all([
    getStudentVisibilityFilter(req),
    getScopedDepartmentIds(req),
  ]);
  const [students, staff] = await Promise.all([
    visibility
      ? collections.students
          .find({ tenantId, branchId, ...visibility })
          .project({ _id: 1 })
          .toArray()
      : null,
    departmentIds
      ? collections.staff
          .find({ tenantId, branchId, 'employment.departmentId': { $in: departmentIds } })
          .project({ _id: 1 })
          .toArray()
      : null,
  ]);
  return {
    studentIds: students && students.map((d) => d._id as ObjectId),
    staffIds: staff && staff.map((d) => d._id as ObjectId),
  };
}

/** Fee figures on dashboards are a per-role choice (dashboard.fees); admins always see them. */
const canSeeFees = (req: Request) => hasPermission(req.user, 'dashboard.fees', 'view');

class DashboardController {
  // ============ Owner Dashboard ============

  async getOwnerKPIs(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = {
        branchIds: req.query.branchIds ? (req.query.branchIds as string).split(',') : undefined,
        academicBatchId: req.query.academicBatchId as string,
      };

      const data = await dashboardService.getOwnerKPIs(req.tenantId!, filters);
      success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async getOwnerStudentMetrics(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = {
        branchIds: req.query.branchIds ? (req.query.branchIds as string).split(',') : undefined,
      };

      const data = await dashboardService.getOwnerStudentMetrics(req.tenantId!, filters);
      success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async getOwnerFinanceMetrics(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = {
        branchIds: req.query.branchIds ? (req.query.branchIds as string).split(',') : undefined,
      };

      const data = await dashboardService.getOwnerFinanceMetrics(req.tenantId!, filters);
      success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async getOwnerAttendanceMetrics(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = {
        branchIds: req.query.branchIds ? (req.query.branchIds as string).split(',') : undefined,
      };

      const data = await dashboardService.getOwnerAttendanceMetrics(req.tenantId!, filters);
      success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async getOwnerStaffMetrics(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = {
        branchIds: req.query.branchIds ? (req.query.branchIds as string).split(',') : undefined,
      };

      const data = await dashboardService.getOwnerStaffMetrics(req.tenantId!, filters);
      success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async getOwnerAdmissionMetrics(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = {
        branchIds: req.query.branchIds ? (req.query.branchIds as string).split(',') : undefined,
      };

      const data = await dashboardService.getOwnerAdmissionMetrics(req.tenantId!, filters);
      success(res, data);
    } catch (error) {
      next(error);
    }
  }

  // ============ Branch Dashboard ============

  async getBranchKPIs(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const data = await dashboardService.getBranchKPIs(
        req.tenantId!,
        req.branchId,
        await dashboardScope(req)
      );
      if (!canSeeFees(req)) {
        const { finance: _f, feeCollected: _c, feeDue: _d, collectionRate: _r, ...rest } = data;
        success(res, { ...rest, finance: null });
        return;
      }
      success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async getBranchTodaySummary(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const data = await dashboardService.getBranchTodaySummary(
        req.tenantId!,
        req.branchId,
        await dashboardScope(req)
      );
      success(res, canSeeFees(req) ? data : { ...data, feeCollection: null });
    } catch (error) {
      next(error);
    }
  }

  async getScopeBreakdown(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await dashboardService.getScopeBreakdown(
        req.tenantId!,
        req.branchId!,
        req.user?.accessScope,
        await dashboardScope(req)
      );
      success(res, data);
    } catch (error) {
      next(error);
    }
  }

  // ============ Filter Options ============

  async getFilterOptions(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await dashboardService.getFilterOptions(req.tenantId!);
      success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async getOwnerKPIsFiltered(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = {
        branchIds: req.query.branchIds ? (req.query.branchIds as string).split(',') : undefined,
        academicBatchId: req.query.academicBatchId as string,
        state: req.query.state as string,
        city: req.query.city as string,
        institutionType: req.query.institutionType as
          | 'school'
          | 'college'
          | 'university'
          | undefined,
      };

      const data = await dashboardService.getOwnerKPIsWithFilters(req.tenantId!, filters);
      success(res, data);
    } catch (error) {
      next(error);
    }
  }

  // ============ Alerts ============

  async getAlerts(req: Request, res: Response, next: NextFunction) {
    try {
      // Branch from the query (owner views) or the X-Branch-Id header; scoped
      // admins and HODs only count their own students and staff.
      const branchId = (req.query.branchId as string | undefined) ?? req.branchId;
      const scope = req.branchId ? await dashboardScope(req) : undefined;
      const data = await dashboardService.getAlerts(req.tenantId!, branchId, scope);
      if (!canSeeFees(req)) {
        const alerts = data.alerts.filter((a) => a.type !== 'fee_due');
        success(res, { alerts, summary: { total: alerts.length } });
        return;
      }
      success(res, data);
    } catch (error) {
      next(error);
    }
  }

  // ============ Academic Batch Metrics ============

  async getMetricsByAcademicBatch(req: Request, res: Response, next: NextFunction) {
    try {
      const academicBatchId = req.params.academicBatchId as string;
      const branchId = req.query.branchId as string | undefined;

      if (!academicBatchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Academic batch ID is required' },
        });
      }

      const data = await dashboardService.getMetricsByAcademicBatch(
        req.tenantId!,
        academicBatchId,
        branchId
      );
      success(res, data);
    } catch (error) {
      next(error);
    }
  }

  // ============ Setup Checklist ============

  async getSetupStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await setupStatusService.getStatus(req.tenantId!);
      success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async dismissSetupTask(req: Request, res: Response, next: NextFunction) {
    try {
      const taskId = (req.body?.taskId ?? '') as string;
      if (!taskId) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'taskId is required' },
        });
      }
      await setupStatusService.dismissTask(req.tenantId!, taskId);
      success(res, { ok: true });
    } catch (error) {
      next(error);
    }
  }
}

export const dashboardController = new DashboardController();

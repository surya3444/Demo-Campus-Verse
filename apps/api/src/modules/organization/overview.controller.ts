import { Request, Response, NextFunction } from 'express';
import { ObjectId } from 'mongodb';
import { collections } from '../../config/database';
import { approvalService } from './approval.service';
import { success } from '../../utils/response';

/** Headline counts for the Organization → Overview page, in one round trip. */
class OverviewController {
  async getOverview(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = new ObjectId(req.tenantId!);
      const branchId = new ObjectId(req.branchId!);
      const active = { status: 'active' };
      // Same rule as the Users page: portal accounts (students/parents, role
      // level >= 20) are managed in their own modules, not counted as users.
      const portalRoleIds = (
        await collections.roles
          .find({ tenantId, level: { $gte: 20 } })
          .project({ _id: 1 })
          .toArray()
      ).map((r) => r._id);
      const operators = { tenantId, roleId: { $nin: portalRoleIds } };
      // A dean counts only their own institutions and the departments under them.
      const scope = req.user?.accessScope;
      const instIds =
        scope?.type === 'institution'
          ? (scope.institutionIds ?? []).map((id) => new ObjectId(id))
          : null;
      const inInst = (field: string) => (instIds ? { [field]: { $in: instIds } } : {});
      const deptIds = instIds
        ? (
            await collections.departments
              .find({ tenantId, branchId, institutionId: { $in: instIds } })
              .project({ _id: 1 })
              .toArray()
          ).map((d) => d._id)
        : null;
      const [
        institutions,
        campuses,
        departments,
        programs,
        users,
        activeUsers,
        roles,
        customFields,
        scheduledJobs,
        buildings,
        rooms,
        approvals,
      ] = await Promise.all([
        collections.institutions.countDocuments({ tenantId, branchId, ...inInst('_id') }),
        collections.branches.countDocuments({ tenantId, ...active }),
        collections.departments.countDocuments({
          tenantId,
          branchId,
          ...active,
          ...inInst('institutionId'),
        }),
        collections.programs.countDocuments({
          tenantId,
          branchId,
          ...(deptIds ? { departmentId: { $in: deptIds } } : {}),
        }),
        collections.users.countDocuments(operators),
        collections.users.countDocuments({ ...operators, ...active }),
        collections.roles.countDocuments({ tenantId, level: { $lt: 20 } }),
        collections.customFields.countDocuments({ tenantId }),
        collections.scheduledJobs.countDocuments({ tenantId }),
        collections.buildings.countDocuments({ tenantId, branchId }),
        collections.rooms.countDocuments({ tenantId, branchId }),
        approvalService.getPendingApprovals(req.tenantId!, req.branchId!, { limit: 1 }),
      ]);
      success(res, {
        institutions,
        campuses,
        departments,
        programs,
        users: { total: users, active: activeUsers },
        roles,
        customFields,
        scheduledJobs,
        infrastructure: { buildings, rooms },
        pendingApprovals: approvals.summary.totalPending,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const overviewController = new OverviewController();

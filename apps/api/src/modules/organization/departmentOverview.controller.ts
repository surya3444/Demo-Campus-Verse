import { Request, Response, NextFunction } from 'express';
import { departmentOverviewService } from './departmentOverview.service';
import { ObjectId } from 'mongodb';
import { success } from '../../utils/response';
import { collections } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler';

class DepartmentOverviewController {
  async getOverview(req: Request, res: Response, next: NextFunction) {
    try {
      const all = await departmentOverviewService.getOverview(req.tenantId!, req.branchId!);
      // A dean sees their institution's departments, an HOD their own;
      // campus-wide roles see everything.
      const scope = req.user?.accessScope;
      const data =
        scope?.type === 'institution'
          ? all.filter((d) => d.institution && scope.institutionIds?.includes(d.institution._id))
          : scope?.type === 'department'
            ? all.filter((d) => scope.departmentIds?.includes(d._id))
            : all;
      success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async getPeople(req: Request, res: Response, next: NextFunction) {
    try {
      const departmentId = req.params.id as string;
      // Same scope as the overview: a dean only their institution's
      // departments, an HOD only their own.
      const scope = req.user?.accessScope;
      if (scope?.type === 'department' && !scope.departmentIds?.includes(departmentId)) {
        throw new ApiError('FORBIDDEN', 'This department is outside your scope', 403);
      }
      if (scope?.type === 'institution') {
        const dept = await collections.departments.findOne(
          { _id: new ObjectId(departmentId), tenantId: new ObjectId(req.tenantId!) },
          { projection: { institutionId: 1 } }
        );
        if (!dept?.institutionId || !scope.institutionIds?.includes(String(dept.institutionId))) {
          throw new ApiError('FORBIDDEN', 'This department is outside your scope', 403);
        }
      }
      const data = await departmentOverviewService.getPeople(
        req.tenantId!,
        req.branchId!,
        departmentId
      );
      success(res, data);
    } catch (error) {
      next(error);
    }
  }
}

export const departmentOverviewController = new DepartmentOverviewController();

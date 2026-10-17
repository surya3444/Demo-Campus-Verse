import { assertStructureWriteInScope } from '../../middleware/scope';
import { getScopedDepartmentIds } from '../../middleware/scope';
import { Request, Response, NextFunction } from 'express';
import { departmentService } from './department.service';
import { success, created } from '../../utils/response';

class DepartmentController {
  // ============ Departments ============

  async findAllDepartments(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const includeInactive = req.query.includeInactive === 'true';
      const institutionId =
        typeof req.query.institutionId === 'string' ? req.query.institutionId : undefined;
      const departments = await departmentService.findAllDepartments(
        req.tenantId!,
        req.branchId,
        includeInactive,
        institutionId
      );
      // Narrow to the caller's departments (institution / department / program
      // grants); campus-wide shared departments stay visible to everyone.
      const scoped = await getScopedDepartmentIds(req);
      const allowed = scoped && new Set(scoped.map(String));
      success(
        res,
        allowed
          ? (departments as Array<{ _id: unknown; shared?: boolean }>).filter(
              (d) => d.shared || allowed.has(String(d._id))
            )
          : departments
      );
    } catch (error) {
      next(error);
    }
  }

  async findDepartmentById(req: Request, res: Response, next: NextFunction) {
    try {
      const department = await departmentService.findDepartmentById(
        req.tenantId!,
        req.params.id as string
      );
      success(res, department);
    } catch (error) {
      next(error);
    }
  }

  async createDepartment(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      await assertStructureWriteInScope(req, {
        institutionId: req.body.institutionId,
        shared: req.body.shared === true,
      });
      const department = await departmentService.createDepartment(
        req.tenantId!,
        req.branchId,
        req.body,
        req.user!.userId
      );
      created(res, department, 'Department created successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateDepartment(req: Request, res: Response, next: NextFunction) {
    try {
      const department = await departmentService.updateDepartment(
        req.tenantId!,
        req.params.id as string,
        req.body
      );
      success(res, department, undefined, 'Department updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteDepartment(req: Request, res: Response, next: NextFunction) {
    try {
      await departmentService.deleteDepartment(req.tenantId!, req.params.id as string);
      success(res, null, undefined, 'Department deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  // ============ Designations ============

  async findAllDesignations(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const includeInactive = req.query.includeInactive === 'true';
      const designations = await departmentService.findAllDesignations(
        req.tenantId!,
        req.branchId,
        includeInactive
      );
      success(res, designations);
    } catch (error) {
      next(error);
    }
  }

  async findDesignationById(req: Request, res: Response, next: NextFunction) {
    try {
      const designation = await departmentService.findDesignationById(
        req.tenantId!,
        req.params.id as string
      );
      success(res, designation);
    } catch (error) {
      next(error);
    }
  }

  async createDesignation(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const designation = await departmentService.createDesignation(
        req.tenantId!,
        req.branchId,
        req.body,
        req.user!.userId
      );
      created(res, designation, 'Designation created successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateDesignation(req: Request, res: Response, next: NextFunction) {
    try {
      const designation = await departmentService.updateDesignation(
        req.tenantId!,
        req.params.id as string,
        req.body
      );
      success(res, designation, undefined, 'Designation updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteDesignation(req: Request, res: Response, next: NextFunction) {
    try {
      await departmentService.deleteDesignation(req.tenantId!, req.params.id as string);
      success(res, null, undefined, 'Designation deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const departmentController = new DepartmentController();

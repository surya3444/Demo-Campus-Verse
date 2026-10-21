import { Request, Response, NextFunction } from 'express';
import { roleService, RoleListParams } from './role.service';
import { success, created } from '../../utils/response';

class RoleController {
  constructor() {
    // Bind methods to preserve 'this' context
    this.findAll = this.findAll.bind(this);
    this.findById = this.findById.bind(this);
    this.getAssignableRoles = this.getAssignableRoles.bind(this);
    this.create = this.create.bind(this);
    this.update = this.update.bind(this);
    this.delete = this.delete.bind(this);
  }

  private getCurrentUser(req: Request) {
    return {
      userId: req.user!.userId,
      roleCode: req.user!.roleCode,
      roleLevel: req.user!.roleLevel,
    };
  }

  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      const params: RoleListParams = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        search: req.query.search as string,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc',
      };

      const result = await roleService.findAll(req.tenantId!, params);
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const role = await roleService.findById(req.tenantId!, req.params.id as string);
      success(res, role);
    } catch (error) {
      next(error);
    }
  }

  // Get roles that the current user can assign to others
  async getAssignableRoles(req: Request, res: Response, next: NextFunction) {
    try {
      const currentUser = this.getCurrentUser(req);
      const roles = await roleService.getAssignableRoles(req.tenantId!, currentUser);
      success(res, roles);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const currentUser = this.getCurrentUser(req);
      const role = await roleService.create(req.tenantId!, req.body, currentUser);
      created(res, role, 'Role created successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const currentUser = this.getCurrentUser(req);
      const role = await roleService.update(
        req.tenantId!,
        req.params.id as string,
        req.body,
        currentUser
      );
      success(res, role, undefined, 'Role updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async reset(req: Request, res: Response, next: NextFunction) {
    try {
      const role = await roleService.resetToDefaults(
        req.tenantId!,
        req.params.id as string,
        this.getCurrentUser(req)
      );
      success(res, role, undefined, 'Role reset to its default permissions');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const currentUser = this.getCurrentUser(req);
      await roleService.delete(req.tenantId!, req.params.id as string, currentUser);
      success(res, null, undefined, 'Role deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const roleController = new RoleController();

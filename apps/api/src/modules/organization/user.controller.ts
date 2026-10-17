import { Request, Response, NextFunction } from 'express';
import { userService, UserListParams } from './user.service';
import { success, created } from '../../utils/response';

class UserController {
  constructor() {
    // Bind methods to preserve 'this' context
    this.findAll = this.findAll.bind(this);
    this.findById = this.findById.bind(this);
    this.create = this.create.bind(this);
    this.update = this.update.bind(this);
    this.updateStatus = this.updateStatus.bind(this);
    this.delete = this.delete.bind(this);
    this.resetPassword = this.resetPassword.bind(this);
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
      // Parse roleAssigned query param
      let roleAssigned: boolean | undefined;
      if (req.query.roleAssigned === 'true') {
        roleAssigned = true;
      } else if (req.query.roleAssigned === 'false') {
        roleAssigned = false;
      }

      const params: UserListParams = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        search: req.query.search as string,
        status: req.query.status as 'active' | 'inactive' | 'locked',
        roleId: req.query.roleId as string,
        branchId: req.query.branchId as string,
        roleAssigned,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc',
      };

      const result = await userService.findAll(req.tenantId!, params);
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await userService.findById(req.tenantId!, req.params.id as string);
      success(res, user);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const currentUser = this.getCurrentUser(req);
      const user = await userService.create(req.tenantId!, req.body, currentUser);
      const message = user.emailSent
        ? 'User created successfully. Login credentials have been sent to their email.'
        : 'User created successfully.';
      created(res, user, message);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const currentUser = this.getCurrentUser(req);
      const user = await userService.update(
        req.tenantId!,
        req.params.id as string,
        req.body,
        currentUser
      );
      success(res, user, undefined, 'User updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { status } = req.body;
      const currentUser = this.getCurrentUser(req);
      const user = await userService.updateStatus(
        req.tenantId!,
        req.params.id as string,
        status,
        req.user!.userId,
        currentUser
      );
      success(res, user, undefined, 'User status updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await userService.delete(req.tenantId!, req.params.id as string, req.user!.userId);
      success(res, null, undefined, 'User deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await userService.resetPassword(
        req.tenantId!,
        req.params.id as string,
        req.user!.userId
      );
      success(
        res,
        result,
        undefined,
        "Password reset successfully. New password has been sent to the user's email."
      );
    } catch (error) {
      next(error);
    }
  }
}

export const userController = new UserController();

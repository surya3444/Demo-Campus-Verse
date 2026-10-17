import { Request, Response, NextFunction } from 'express';
import { expenseService, ExpenseListParams } from './expense.service';
import { success, created } from '../../utils/response';

class ExpenseController {
  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const params: ExpenseListParams = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        search: req.query.search as string,
        status: req.query.status as string,
        category: req.query.category as string,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc',
      };

      const result = await expenseService.findAll(req.tenantId!, req.branchId, params);
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getMyExpenses(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const params: ExpenseListParams = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        status: req.query.status as string,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc',
      };

      const result = await expenseService.getMyExpenses(
        req.tenantId!,
        req.branchId,
        req.user!.userId,
        params
      );
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const stats = await expenseService.getStats(req.tenantId!, req.branchId);
      success(res, stats);
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const expense = await expenseService.findById(req.tenantId!, req.params.id as string);
      success(res, expense);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const expense = await expenseService.create(
        req.tenantId!,
        req.branchId,
        req.body,
        req.user!.userId,
        req.user!.email
      );
      created(res, expense, 'Expense created successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const expense = await expenseService.update(req.tenantId!, req.params.id as string, req.body);
      success(res, expense, undefined, 'Expense updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await expenseService.delete(req.tenantId!, req.params.id as string);
      success(res, null, undefined, 'Expense deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  async submit(req: Request, res: Response, next: NextFunction) {
    try {
      const expense = await expenseService.submit(
        req.tenantId!,
        req.params.id as string,
        req.user!.userId,
        req.user!.email
      );
      success(res, expense, undefined, 'Expense submitted for approval');
    } catch (error) {
      next(error);
    }
  }

  async approve(req: Request, res: Response, next: NextFunction) {
    try {
      const expense = await expenseService.approve(
        req.tenantId!,
        req.params.id as string,
        req.user!.userId,
        req.user!.email,
        req.body.remarks
      );
      success(res, expense, undefined, 'Expense approved successfully');
    } catch (error) {
      next(error);
    }
  }

  async reject(req: Request, res: Response, next: NextFunction) {
    try {
      const expense = await expenseService.reject(
        req.tenantId!,
        req.params.id as string,
        req.user!.userId,
        req.user!.email,
        req.body.remarks
      );
      success(res, expense, undefined, 'Expense rejected');
    } catch (error) {
      next(error);
    }
  }

  async markPaid(req: Request, res: Response, next: NextFunction) {
    try {
      const expense = await expenseService.markPaid(
        req.tenantId!,
        req.params.id as string,
        req.user!.userId,
        req.user!.email,
        req.body
      );
      success(res, expense, undefined, 'Expense marked as paid');
    } catch (error) {
      next(error);
    }
  }
}

export const expenseController = new ExpenseController();

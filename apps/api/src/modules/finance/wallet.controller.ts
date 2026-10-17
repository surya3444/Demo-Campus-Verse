import { Request, Response, NextFunction } from 'express';
import { walletService, WalletListParams, WalletTransactionListParams } from './wallet.service';
import { success, created } from '../../utils/response';

class WalletController {
  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const params: WalletListParams = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        studentId: req.query.studentId as string,
        hasBalance:
          req.query.hasBalance === 'true'
            ? true
            : req.query.hasBalance === 'false'
              ? false
              : undefined,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc',
      };

      const result = await walletService.findAll(req.tenantId!, req.branchId, params);
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const wallet = await walletService.findById(req.tenantId!, req.params.id as string);
      success(res, wallet);
    } catch (error) {
      next(error);
    }
  }

  async findByStudent(req: Request, res: Response, next: NextFunction) {
    try {
      const wallet = await walletService.findByStudentId(
        req.tenantId!,
        req.params.studentId as string
      );

      if (!wallet) {
        return res.status(404).json({
          success: false,
          error: { code: 'WALLET_NOT_FOUND', message: 'Wallet not found for this student' },
        });
      }

      success(res, wallet);
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

      const { studentId } = req.body;

      if (!studentId) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Student ID is required' },
        });
      }

      const wallet = await walletService.create(
        req.tenantId!,
        req.branchId,
        { studentId },
        req.user!.userId
      );
      created(res, wallet, 'Wallet created successfully');
    } catch (error) {
      next(error);
    }
  }

  async getOrCreate(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const { studentId } = req.body;

      if (!studentId) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Student ID is required' },
        });
      }

      const wallet = await walletService.getOrCreate(
        req.tenantId!,
        req.branchId,
        studentId,
        req.user!.userId
      );
      success(res, wallet);
    } catch (error) {
      next(error);
    }
  }

  async topUp(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const { amount, paymentMode, paymentDetails, description } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Valid amount is required' },
        });
      }

      if (!paymentMode) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Payment mode is required' },
        });
      }

      const result = await walletService.topUp(
        req.tenantId!,
        req.branchId,
        req.params.id as string,
        { amount, paymentMode, paymentDetails, description },
        req.user!.userId
      );
      success(res, result, undefined, 'Wallet topped up successfully');
    } catch (error) {
      next(error);
    }
  }

  async debit(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const { amount, category, referenceId, referenceType, description } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Valid amount is required' },
        });
      }

      if (!category) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Transaction category is required' },
        });
      }

      if (!description) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Description is required' },
        });
      }

      const result = await walletService.debit(
        req.tenantId!,
        req.branchId,
        req.params.id as string,
        { amount, category, referenceId, referenceType, description },
        req.user!.userId
      );
      success(res, result, undefined, 'Wallet debited successfully');
    } catch (error) {
      next(error);
    }
  }

  async getTransactions(req: Request, res: Response, next: NextFunction) {
    try {
      const params: WalletTransactionListParams = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        type: req.query.type as 'credit' | 'debit' | undefined,
        category: req.query.category as WalletTransactionListParams['category'],
        fromDate: req.query.fromDate as string,
        toDate: req.query.toDate as string,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc',
      };

      const result = await walletService.getTransactions(
        req.tenantId!,
        req.params.id as string,
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

      const stats = await walletService.getStats(req.tenantId!, req.branchId);
      success(res, stats);
    } catch (error) {
      next(error);
    }
  }

  async toggleStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { isActive } = req.body;

      if (typeof isActive !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'isActive must be a boolean' },
        });
      }

      const wallet = await walletService.toggleStatus(
        req.tenantId!,
        req.params.id as string,
        isActive,
        req.user!.userId
      );
      success(
        res,
        wallet,
        undefined,
        `Wallet ${isActive ? 'activated' : 'deactivated'} successfully`
      );
    } catch (error) {
      next(error);
    }
  }
}

export const walletController = new WalletController();

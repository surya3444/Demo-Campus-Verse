import { Request, Response, NextFunction } from 'express';
import { bedAllocationService } from './bedAllocation.service';
import { success, created } from '../../utils/response';

class BedAllocationController {
  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const result = await bedAllocationService.findAll(
        req.tenantId!,
        req.branchId,
        req.query as unknown as import('@campus-verse/shared/schemas').AllocationQueryInput
      );
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const allocation = await bedAllocationService.findById(
        req.tenantId!,
        req.params.id as string
      );
      success(res, allocation);
    } catch (error) {
      next(error);
    }
  }

  async allocate(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const allocation = await bedAllocationService.allocate(
        req.tenantId!,
        req.branchId,
        req.body,
        req.user!.userId
      );
      created(res, allocation, 'Bed allocated successfully');
    } catch (error) {
      next(error);
    }
  }

  async vacate(req: Request, res: Response, next: NextFunction) {
    try {
      const allocation = await bedAllocationService.vacate(
        req.tenantId!,
        req.params.id as string,
        req.body,
        req.user!.userId
      );
      success(res, allocation, undefined, 'Bed vacated successfully');
    } catch (error) {
      next(error);
    }
  }

  async transfer(req: Request, res: Response, next: NextFunction) {
    try {
      const allocation = await bedAllocationService.transfer(
        req.tenantId!,
        req.params.id as string,
        req.body,
        req.user!.userId
      );
      success(res, allocation, undefined, 'Bed transferred successfully');
    } catch (error) {
      next(error);
    }
  }

  async findByStudent(req: Request, res: Response, next: NextFunction) {
    try {
      const allocations = await bedAllocationService.findByStudent(
        req.tenantId!,
        req.params.studentId as string
      );
      success(res, allocations);
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

      const stats = await bedAllocationService.getStats(req.tenantId!, req.branchId);
      success(res, stats);
    } catch (error) {
      next(error);
    }
  }
}

export const bedAllocationController = new BedAllocationController();

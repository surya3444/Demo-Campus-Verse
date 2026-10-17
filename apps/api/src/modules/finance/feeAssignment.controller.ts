import { assertStudentSelfScope } from '../teaching/scope';
import { Request, Response, NextFunction } from 'express';
import { feeAssignmentService, FeeAssignmentListParams } from './feeAssignment.service';
import { success, created } from '../../utils/response';

class FeeAssignmentController {
  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const params: FeeAssignmentListParams = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        studentId: req.query.studentId as string,
        feeStructureId: req.query.feeStructureId as string,
        academicBatchId: req.query.academicBatchId as string,
        status: req.query.status as string,
        hasBalance:
          req.query.hasBalance === 'true'
            ? true
            : req.query.hasBalance === 'false'
              ? false
              : undefined,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc',
      };

      const result = await feeAssignmentService.findAll(req.tenantId!, req.branchId, params);
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const assignment = await feeAssignmentService.findById(
        req.tenantId!,
        req.params.id as string
      );
      success(res, assignment);
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

      const assignment = await feeAssignmentService.create(
        req.tenantId!,
        req.branchId,
        req.body,
        req.user!.userId
      );
      created(res, assignment, 'Fee assigned successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const assignment = await feeAssignmentService.update(
        req.tenantId!,
        req.params.id as string,
        req.body
      );
      success(res, assignment, undefined, 'Fee assignment updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async bulkCreate(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const { studentIds, feeStructureId, academicBatchId } = req.body;

      if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Student IDs are required' },
        });
      }

      const result = await feeAssignmentService.bulkCreate(
        req.tenantId!,
        req.branchId,
        { studentIds, feeStructureId, academicBatchId },
        req.user!.userId
      );

      success(res, result, undefined, `Assigned fees to ${result.success} students`);
    } catch (error) {
      next(error);
    }
  }

  async getByStudent(req: Request, res: Response, next: NextFunction) {
    try {
      // A student login may read only its own fees.
      await assertStudentSelfScope(req, req.params.studentId as string);
      const assignments = await feeAssignmentService.findByStudentId(
        req.tenantId!,
        req.params.studentId as string,
        req.query.academicBatchId as string
      );
      success(res, assignments);
    } catch (error) {
      next(error);
    }
  }

  async calculateFines(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const result = await feeAssignmentService.calculateFines(req.tenantId!, req.branchId);
      success(res, result, undefined, `Fines calculated for ${result.updated} assignments`);
    } catch (error) {
      next(error);
    }
  }
}

export const feeAssignmentController = new FeeAssignmentController();

import { Request, Response, NextFunction } from 'express';
import { registrationService } from './registration.service';
import { success, created } from '../../utils/response';
import { ApiError } from '../../middleware/errorHandler';

function requireContext(req: Request) {
  if (!req.tenantId || !req.branchId || !req.user) {
    throw new ApiError('CONTEXT_MISSING', 'Tenant or branch context missing', 400);
  }
  return { tenantId: req.tenantId, branchId: req.branchId, userId: req.user.userId };
}

/** Self-service endpoints resolve the student from the signed-in user. */
async function requireSelf(req: Request) {
  const ctx = requireContext(req);
  const studentId = await registrationService.resolveStudentForUser(ctx.tenantId, ctx.userId);
  return { ...ctx, studentId: studentId.toString() };
}

class RegistrationController {
  // ─── Student self-service ────────────────────────────────────────────────

  async myContext(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId, studentId } = await requireSelf(req);
      const context = await registrationService.getMyContext(
        tenantId,
        branchId,
        studentId,
        req.query.termId as string | undefined
      );
      success(res, context);
    } catch (error) {
      next(error);
    }
  }

  async submitMine(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId, studentId, userId } = await requireSelf(req);
      const registration = await registrationService.submit(
        tenantId,
        branchId,
        studentId,
        req.body,
        userId
      );
      created(res, registration, 'Registration submitted');
    } catch (error) {
      next(error);
    }
  }

  async updateMine(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId, studentId } = await requireSelf(req);
      const registration = await registrationService.updateSelections(
        tenantId,
        branchId,
        studentId,
        req.params.termId as string,
        req.body
      );
      success(res, registration, undefined, 'Registration updated');
    } catch (error) {
      next(error);
    }
  }

  async withdrawMine(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId, studentId } = await requireSelf(req);
      const result = await registrationService.withdraw(
        tenantId,
        branchId,
        studentId,
        req.params.termId as string
      );
      success(res, result, undefined, 'Registration withdrawn');
    } catch (error) {
      next(error);
    }
  }

  // ─── Registrar / admin ───────────────────────────────────────────────────

  async listForTerm(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId } = requireContext(req);
      const result = await registrationService.listForTerm(
        tenantId,
        branchId,
        req.params.termId as string,
        {
          departmentCode: req.query.departmentCode as string | undefined,
          page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
          limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
        }
      );
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async pendingForTerm(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId } = requireContext(req);
      const academicBatchId = req.query.academicBatchId as string;
      if (!academicBatchId) {
        throw new ApiError('INVALID_INPUT', 'academicBatchId is required', 400);
      }
      const result = await registrationService.pendingForTerm(
        tenantId,
        branchId,
        academicBatchId,
        req.params.termId as string,
        {
          departmentCode: req.query.departmentCode as string | undefined,
          limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        }
      );
      success(res, result.data, undefined, undefined, { truncated: result.truncated });
    } catch (error) {
      next(error);
    }
  }

  async overview(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId } = requireContext(req);
      const stats = await registrationService.overview(
        tenantId,
        branchId,
        req.params.termId as string
      );
      success(res, stats);
    } catch (error) {
      next(error);
    }
  }

  /** Admin override: register on a student's behalf, bypassing window + fee gate. */
  async submitForStudent(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId, userId } = requireContext(req);
      const registration = await registrationService.submit(
        tenantId,
        branchId,
        req.params.studentId as string,
        req.body,
        userId,
        { override: true, overriddenBy: userId }
      );
      created(res, registration, 'Registration submitted (override)');
    } catch (error) {
      next(error);
    }
  }

  /** Admin override: withdraw a student's registration at any time. */
  async withdrawForStudent(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId, userId } = requireContext(req);
      const result = await registrationService.withdraw(
        tenantId,
        branchId,
        req.params.studentId as string,
        req.params.termId as string,
        { override: true, overriddenBy: userId }
      );
      success(res, result, undefined, 'Registration withdrawn (override)');
    } catch (error) {
      next(error);
    }
  }
}

export const registrationController = new RegistrationController();

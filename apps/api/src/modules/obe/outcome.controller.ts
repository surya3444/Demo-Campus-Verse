import { Request, Response, NextFunction } from 'express';
import { obeOutcomeService } from './outcome.service';
import { success } from '../../utils/response';
import { ApiError } from '../../middleware/errorHandler';

class ObeOutcomeController {
  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const { subjectId, programId } = req.query as { subjectId?: string; programId?: string };
      if (!subjectId || !programId) {
        throw new ApiError('MISSING_PARAMS', 'subjectId and programId are required', 400);
      }
      const doc = await obeOutcomeService.get(req.tenantId!, req.branchId!, subjectId, programId);
      success(res, doc);
    } catch (error) {
      next(error);
    }
  }

  async upsert(req: Request, res: Response, next: NextFunction) {
    try {
      const doc = await obeOutcomeService.upsert(
        req.tenantId!,
        req.branchId!,
        req.body,
        req.user!.userId
      );
      success(res, doc, undefined, 'Course outcomes saved');
    } catch (error) {
      next(error);
    }
  }

  async listForProgram(req: Request, res: Response, next: NextFunction) {
    try {
      const { programId } = req.query as { programId?: string };
      if (!programId) {
        throw new ApiError('MISSING_PARAMS', 'programId is required', 400);
      }
      const docs = await obeOutcomeService.listForProgram(req.tenantId!, req.branchId!, programId);
      success(res, docs);
    } catch (error) {
      next(error);
    }
  }
}

export const obeOutcomeController = new ObeOutcomeController();

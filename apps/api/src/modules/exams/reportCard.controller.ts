import { Request, Response, NextFunction } from 'express';
import { reportCardService } from './reportCard.service';
import { transcriptService } from './transcript.service';
import { success, created } from '../../utils/response';
import { ApiError } from '../../middleware/errorHandler';

function requireContext(req: Request): { tenantId: string; branchId: string; userId: string } {
  if (!req.tenantId || !req.branchId || !req.user) {
    throw new ApiError('CONTEXT_MISSING', 'Tenant or branch context missing', 400);
  }
  return { tenantId: req.tenantId, branchId: req.branchId, userId: req.user.userId };
}

class ReportCardController {
  async generate(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId, userId } = requireContext(req);
      const { examId, sectionId, studentIds } = req.body as {
        examId: string;
        sectionId?: string;
        studentIds?: string[];
      };
      if (!examId) throw new ApiError('INVALID_INPUT', 'examId is required', 400);
      const result = await reportCardService.generate(
        tenantId,
        branchId,
        { examId, sectionId, studentIds },
        userId
      );
      created(res, result, 'Report cards generated');
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId } = requireContext(req);
      const rows = await reportCardService.list(tenantId, branchId, {
        examId: req.query.examId as string | undefined,
        sectionId: req.query.sectionId as string | undefined,
        studentId: req.query.studentId as string | undefined,
        status: req.query.status as string | undefined,
      });
      success(res, rows);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId } = requireContext(req);
      const rc = await reportCardService.getById(tenantId, branchId, req.params.id as string);
      success(res, rc);
    } catch (error) {
      next(error);
    }
  }

  /** Student-facing list — only published cards for the given student. */
  async listForStudent(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId } = requireContext(req);
      const studentId = req.params.studentId as string;
      const rows = await reportCardService.listForStudent(tenantId, studentId);
      success(res, rows);
    } catch (error) {
      next(error);
    }
  }

  /** Consolidated transcript: every semester, credits, SGPA, CGPA, backlogs. */
  async transcript(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId } = requireContext(req);
      const studentId = req.params.studentId as string;
      const transcript = await transcriptService.getForStudent(tenantId, studentId);
      success(res, transcript);
    } catch (error) {
      next(error);
    }
  }

  async publish(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId, userId } = requireContext(req);
      const rc = await reportCardService.publish(
        tenantId,
        branchId,
        req.params.id as string,
        userId
      );
      success(res, rc, undefined, 'Report card published');
    } catch (error) {
      next(error);
    }
  }

  async bulkPublish(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId, userId } = requireContext(req);
      const { examId, sectionId } = req.body as { examId: string; sectionId?: string };
      if (!examId) throw new ApiError('INVALID_INPUT', 'examId is required', 400);
      const result = await reportCardService.bulkPublish(
        tenantId,
        branchId,
        examId,
        userId,
        sectionId
      );
      success(res, result, undefined, 'Report cards bulk-published');
    } catch (error) {
      next(error);
    }
  }

  async unpublish(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId } = requireContext(req);
      const rc = await reportCardService.unpublish(tenantId, branchId, req.params.id as string);
      success(res, rc, undefined, 'Report card unpublished');
    } catch (error) {
      next(error);
    }
  }
}

export const reportCardController = new ReportCardController();

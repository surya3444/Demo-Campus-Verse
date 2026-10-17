import { Request, Response, NextFunction } from 'express';
import { hallTicketService } from './hallTicket.service';
import { success, created } from '../../utils/response';
import { ApiError } from '../../middleware/errorHandler';

function requireContext(req: Request) {
  if (!req.tenantId || !req.branchId || !req.user) {
    throw new ApiError('CONTEXT_MISSING', 'Tenant or branch context missing', 400);
  }
  return { tenantId: req.tenantId, branchId: req.branchId, userId: req.user.userId };
}

class HallTicketController {
  async generate(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId, userId } = requireContext(req);
      const { examId, sectionId, studentIds } = req.body as {
        examId: string;
        sectionId?: string;
        studentIds?: string[];
      };
      if (!examId) throw new ApiError('INVALID_INPUT', 'examId is required', 400);
      const result = await hallTicketService.generate(
        tenantId,
        branchId,
        { examId, sectionId, studentIds },
        userId
      );
      created(res, result, 'Hall tickets generated');
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId } = requireContext(req);
      const rows = await hallTicketService.list(tenantId, branchId, {
        examId: req.query.examId as string | undefined,
        sectionId: req.query.sectionId as string | undefined,
        studentId: req.query.studentId as string | undefined,
      });
      success(res, rows);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId } = requireContext(req);
      const t = await hallTicketService.getById(tenantId, branchId, req.params.id as string);
      success(res, t);
    } catch (error) {
      next(error);
    }
  }

  async listForStudent(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId } = requireContext(req);
      const rows = await hallTicketService.listForStudent(tenantId, req.params.studentId as string);
      success(res, rows);
    } catch (error) {
      next(error);
    }
  }

  async updateSeat(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId } = requireContext(req);
      const { seatNumber } = req.body as { seatNumber: string };
      if (!seatNumber) throw new ApiError('INVALID_INPUT', 'seatNumber required', 400);
      const t = await hallTicketService.updateSeat(
        tenantId,
        branchId,
        req.params.id as string,
        seatNumber
      );
      success(res, t);
    } catch (error) {
      next(error);
    }
  }
}

export const hallTicketController = new HallTicketController();

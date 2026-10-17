import { Request, Response, NextFunction } from 'express';
import { feedbackService, TicketListParams } from './feedback.service';
import { success, created } from '../../utils/response';

class FeedbackController {
  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const params: TicketListParams = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        search: req.query.search as string,
        status: req.query.status as string,
        category: req.query.category as string,
        priority: req.query.priority as string,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc',
      };

      const result = await feedbackService.findAll(
        req.tenantId!,
        req.branchId,
        req.user!.userId,
        req.user!.roleCode || '',
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

      const stats = await feedbackService.getStats(req.tenantId!, req.branchId);
      success(res, stats);
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const ticket = await feedbackService.findById(
        req.tenantId!,
        req.params.id as string,
        req.user!.userId,
        req.user!.roleCode || ''
      );
      success(res, ticket);
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

      // Determine submitter type
      const roleCode = req.user!.roleCode || '';
      const submitterType = roleCode === 'STUDENT' ? 'student' : 'staff';

      const ticket = await feedbackService.create(
        req.tenantId!,
        req.branchId,
        req.body,
        req.user!.userId,
        submitterType
      );
      created(res, ticket, 'Ticket submitted successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const ticket = await feedbackService.update(
        req.tenantId!,
        req.params.id as string,
        req.body,
        req.user!.userId,
        req.user!.roleCode || ''
      );
      success(res, ticket, undefined, 'Ticket updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await feedbackService.delete(req.tenantId!, req.params.id as string);
      success(res, null, undefined, 'Ticket deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  async assign(req: Request, res: Response, next: NextFunction) {
    try {
      const ticket = await feedbackService.assignTicket(
        req.tenantId!,
        req.params.id as string,
        req.body.assignedTo,
        req.body.assignedToName
      );
      success(res, ticket, undefined, 'Ticket assigned successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const ticket = await feedbackService.updateStatus(
        req.tenantId!,
        req.params.id as string,
        req.body.status,
        req.body.resolutionNote,
        req.user!.userId,
        req.user!.roleCode || ''
      );
      success(res, ticket, undefined, 'Ticket status updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async escalate(req: Request, res: Response, next: NextFunction) {
    try {
      const ticket = await feedbackService.escalateTicket(
        req.tenantId!,
        req.params.id as string,
        req.user!.userId
      );
      success(res, ticket, undefined, 'Ticket escalated successfully');
    } catch (error) {
      next(error);
    }
  }

  async addResponse(req: Request, res: Response, next: NextFunction) {
    try {
      const ticket = await feedbackService.addResponse(
        req.tenantId!,
        req.params.id as string,
        req.body.message,
        req.body.isInternal || false,
        req.user!.userId,
        req.user!.roleCode || ''
      );
      success(res, ticket, undefined, 'Response added successfully');
    } catch (error) {
      next(error);
    }
  }

  async submitSatisfaction(req: Request, res: Response, next: NextFunction) {
    try {
      const ticket = await feedbackService.submitSatisfaction(
        req.tenantId!,
        req.params.id as string,
        req.user!.userId,
        req.body.rating,
        req.body.comment
      );
      success(res, ticket, undefined, 'Satisfaction submitted successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const feedbackController = new FeedbackController();

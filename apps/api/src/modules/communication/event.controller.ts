import { Request, Response, NextFunction } from 'express';
import { eventService, EventListParams } from './event.service';
import { success, created } from '../../utils/response';

class EventController {
  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const params: EventListParams = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        search: req.query.search as string,
        type: req.query.type as string,
        status: req.query.status as string,
        fromDate: req.query.fromDate as string,
        toDate: req.query.toDate as string,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc',
      };

      const result = await eventService.findAll(req.tenantId!, req.branchId, params);
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const event = await eventService.findById(req.tenantId!, req.params.id as string);
      success(res, event);
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

      const event = await eventService.create(
        req.tenantId!,
        req.branchId,
        req.body,
        req.user!.userId
      );
      created(res, event, 'Event created successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const event = await eventService.update(req.tenantId!, req.params.id as string, req.body);
      success(res, event, undefined, 'Event updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await eventService.delete(req.tenantId!, req.params.id as string);
      success(res, null, undefined, 'Event deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const event = await eventService.updateStatus(
        req.tenantId!,
        req.params.id as string,
        'cancelled'
      );
      success(res, event, undefined, 'Event cancelled');
    } catch (error) {
      next(error);
    }
  }

  async getUpcoming(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const events = await eventService.getUpcoming(req.tenantId!, req.branchId, limit);
      success(res, events);
    } catch (error) {
      next(error);
    }
  }

  async getCalendar(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();
      const month = req.query.month
        ? parseInt(req.query.month as string)
        : new Date().getMonth() + 1;

      const events = await eventService.getCalendarEvents(req.tenantId!, req.branchId, year, month);
      success(res, events);
    } catch (error) {
      next(error);
    }
  }
}

export const eventController = new EventController();

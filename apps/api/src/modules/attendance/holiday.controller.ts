import { Request, Response, NextFunction } from 'express';
import { holidayService, CreateHolidayInput, UpdateHolidayInput } from './holiday.service';
import { logger } from '../../lib/logger';

class HolidayController {
  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { year, type, applicableFor, upcoming } = req.query;

      const holidays = await holidayService.findAll(req.tenantId!, req.branchId!, {
        year: year ? parseInt(year as string) : undefined,
        type: type as string,
        applicableFor: applicableFor as string,
        upcoming: upcoming === 'true',
      });

      res.json({ success: true, data: holidays });
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const holiday = await holidayService.findById(req.tenantId!, id);
      res.json({ success: true, data: holiday });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data: CreateHolidayInput = req.body;
      const holiday = await holidayService.create(
        req.tenantId!,
        req.branchId!,
        data,
        req.user!.userId
      );

      logger.info({ holidayId: holiday._id }, 'Holiday created');

      res.status(201).json({ success: true, data: holiday });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data: UpdateHolidayInput = req.body;

      const holiday = await holidayService.update(req.tenantId!, id, data);

      res.json({ success: true, data: holiday });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      await holidayService.delete(req.tenantId!, id);
      res.json({ success: true, message: 'Holiday deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await holidayService.getStats(req.tenantId!, req.branchId!);
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }
}

export const holidayController = new HolidayController();

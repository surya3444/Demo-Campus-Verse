import { Request, Response, NextFunction } from 'express';
import { roomService } from './room.service';
import { success, created } from '../../utils/response';

class RoomController {
  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const result = await roomService.findAll(
        req.tenantId!,
        req.branchId,
        req.query as unknown as import('@campus-verse/shared/schemas').RoomQueryInput
      );
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const room = await roomService.findById(req.tenantId!, req.params.id as string);
      success(res, room);
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

      const room = await roomService.create(
        req.tenantId!,
        req.branchId,
        req.body,
        req.user!.userId
      );
      created(res, room, 'Room created successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const room = await roomService.update(
        req.tenantId!,
        req.params.id as string,
        req.body,
        req.user!.userId
      );
      success(res, room, undefined, 'Room updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { status } = req.body;
      if (!status || !['maintenance', 'reserved', 'available'].includes(status)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Valid status (maintenance, reserved, available) is required',
          },
        });
      }

      const room = await roomService.updateStatus(
        req.tenantId!,
        req.params.id as string,
        status,
        req.user!.userId
      );
      success(res, room, undefined, 'Room status updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await roomService.delete(req.tenantId!, req.params.id as string);
      success(res, null, undefined, 'Room deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const roomController = new RoomController();

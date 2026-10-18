import { ObjectId } from 'mongodb';
import { ApiError } from '../../../middleware/errorHandler';
import { Request, Response, NextFunction } from 'express';
import { driveService } from './drive.service';
import { success, created, noContent } from '../../../utils/response';

class DriveController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await driveService.list(req.tenantId!, req.branchId!, {
        search: req.query.search as string,
        status: req.query.status as string,
        companyId: req.query.companyId as string,
        type: req.query.type as string,
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as string,
      });
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await driveService.getById(req.tenantId!, id);
      success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await driveService.create(
        req.tenantId!,
        req.branchId!,
        req.user!.userId,
        req.body
      );
      created(res, data, 'Placement drive created successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await driveService.update(req.tenantId!, id, req.body);
      success(res, data, undefined, 'Placement drive updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      await driveService.delete(req.tenantId!, id);
      noContent(res);
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await driveService.updateStatus(req.tenantId!, id, req.body.status);
      success(res, data, undefined, 'Drive status updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async addRound(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await driveService.addRound(req.tenantId!, id, req.body);
      success(res, data, undefined, 'Round added successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateRound(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const roundId = req.params.roundId as string;
      const data = await driveService.updateRound(req.tenantId!, id, roundId, req.body);
      success(res, data, undefined, 'Round updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async removeRound(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const roundId = req.params.roundId as string;
      const data = await driveService.removeRound(req.tenantId!, id, roundId);
      success(res, data, undefined, 'Round removed successfully');
    } catch (error) {
      next(error);
    }
  }

  async registerStudent(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const studentId = req.body?.studentId as string | undefined;
      if (!studentId || !ObjectId.isValid(studentId)) {
        throw new ApiError('STUDENT_REQUIRED', 'Choose a student to register', 400);
      }
      const data = await driveService.registerStudent(
        req.tenantId!,
        id,
        studentId,
        req.body.studentName
      );
      success(res, data, undefined, 'Student registered successfully');
    } catch (error) {
      next(error);
    }
  }

  async unregisterStudent(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const studentId = req.params.studentId as string;
      const data = await driveService.unregisterStudent(req.tenantId!, id, studentId);
      success(res, data, undefined, 'Student unregistered successfully');
    } catch (error) {
      next(error);
    }
  }

  async getRegistrations(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await driveService.getRegistrations(req.tenantId!, id);
      success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async submitRoundResults(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const roundId = req.params.roundId as string;
      const data = await driveService.submitRoundResults(
        req.tenantId!,
        id,
        roundId,
        req.body.qualifiedStudentIds
      );
      success(res, data, undefined, 'Round results submitted successfully');
    } catch (error) {
      next(error);
    }
  }

  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await driveService.getStats(req.tenantId!, req.branchId!);
      success(res, data);
    } catch (error) {
      next(error);
    }
  }
}

export const driveController = new DriveController();

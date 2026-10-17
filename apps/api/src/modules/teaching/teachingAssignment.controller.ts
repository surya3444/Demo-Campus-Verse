import { Request, Response, NextFunction } from 'express';
import { teachingAssignmentService } from './teachingAssignment.service';
import { success, created } from '../../utils/response';

class TeachingAssignmentController {
  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      const assignments = await teachingAssignmentService.findAll(req.tenantId!, req.branchId!, {
        staffId: req.query.staffId as string | undefined,
        sectionId: req.query.sectionId as string | undefined,
        subjectId: req.query.subjectId as string | undefined,
        status: req.query.status as 'active' | 'ended' | undefined,
      });
      success(res, assignments);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const assignment = await teachingAssignmentService.create(
        req.tenantId!,
        req.body,
        req.user?.userId
      );
      created(res, assignment, 'Teaching assignment created successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const assignment = await teachingAssignmentService.update(
        req.tenantId!,
        req.params.id as string,
        req.body
      );
      success(res, assignment, undefined, 'Teaching assignment updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await teachingAssignmentService.delete(req.tenantId!, req.params.id as string);
      success(res, result, undefined, 'Teaching assignment deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const teachingAssignmentController = new TeachingAssignmentController();

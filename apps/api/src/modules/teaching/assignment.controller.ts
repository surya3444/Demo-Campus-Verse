import { Request, Response, NextFunction } from 'express';
import { ObjectId } from 'mongodb';
import { assignmentService } from './assignment.service';
import { getStaffIdForUser } from './teaching.utils';
import { success, created } from '../../utils/response';
import { getScopedSectionIds } from '../../middleware/scope';
import { collections } from '../../config/database';

class AssignmentController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const staffId = await getStaffIdForUser(req.tenantId!, req.user!.userId);
      const assignment = await assignmentService.create(
        req.tenantId!,
        req.branchId!,
        req.body,
        staffId
      );
      created(res, assignment, 'Assignment created successfully');
    } catch (error) {
      next(error);
    }
  }

  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      const isAdmin = (req.user!.roleLevel ?? 99) <= 3;
      const isStudent = req.user!.roleCode === 'STUDENT';

      let staffId: string | undefined;
      if (!isAdmin && !isStudent) {
        staffId = await getStaffIdForUser(req.tenantId!, req.user!.userId);
      }

      const params = {
        sectionId: req.query.sectionId as string,
        restrictToSectionIds: await getScopedSectionIds(req),
        subjectId: req.query.subjectId as string,
        status: req.query.status as string,
        type: req.query.type as string,
        dateFrom: req.query.dateFrom as string,
        dateTo: req.query.dateTo as string,
        search: req.query.search as string,
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as string,
      };

      const result = await assignmentService.findAll(req.tenantId!, req.branchId!, params, staffId);
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const assignment = await assignmentService.findById(req.tenantId!, id);
      success(res, assignment);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const staffId = await getStaffIdForUser(req.tenantId!, req.user!.userId);
      const roleLevel = req.user!.roleLevel ?? 99;

      const assignment = await assignmentService.update(
        req.tenantId!,
        id,
        req.body,
        staffId,
        roleLevel
      );
      success(res, assignment, undefined, 'Assignment updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const staffId = await getStaffIdForUser(req.tenantId!, req.user!.userId);
      const roleLevel = req.user!.roleLevel ?? 99;

      await assignmentService.delete(req.tenantId!, id, staffId, roleLevel);
      success(res, null, undefined, 'Assignment deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  async publish(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const staffId = await getStaffIdForUser(req.tenantId!, req.user!.userId);
      const roleLevel = req.user!.roleLevel ?? 99;

      const assignment = await assignmentService.publish(req.tenantId!, id, staffId, roleLevel);
      success(res, assignment, undefined, 'Assignment published successfully');
    } catch (error) {
      next(error);
    }
  }

  async startGrading(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const staffId = await getStaffIdForUser(req.tenantId!, req.user!.userId);
      const roleLevel = req.user!.roleLevel ?? 99;

      const assignment = await assignmentService.startGrading(
        req.tenantId!,
        id,
        staffId,
        roleLevel
      );
      success(res, assignment, undefined, 'Assignment grading started');
    } catch (error) {
      next(error);
    }
  }

  async complete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const staffId = await getStaffIdForUser(req.tenantId!, req.user!.userId);
      const roleLevel = req.user!.roleLevel ?? 99;

      const assignment = await assignmentService.complete(req.tenantId!, id, staffId, roleLevel);
      success(res, assignment, undefined, 'Assignment completed successfully');
    } catch (error) {
      next(error);
    }
  }

  async submitAnswers(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;

      // Resolve studentId from body or from user's linked student record
      let studentId = req.body.studentId as string | undefined;
      if (!studentId) {
        const user = await collections.users.findOne({
          _id: new ObjectId(req.user!.userId),
          tenantId: new ObjectId(req.tenantId!),
        });
        studentId = user?.studentId ? (user.studentId as ObjectId).toString() : undefined;
      }
      if (!studentId) {
        return res.status(400).json({
          success: false,
          error: { code: 'STUDENT_NOT_FOUND', message: 'No student record linked to this user' },
        });
      }

      const result = await assignmentService.submitAnswers(
        req.tenantId!,
        req.branchId!,
        id,
        studentId,
        req.body
      );
      success(res, result, undefined, 'Assignment submitted successfully');
    } catch (error) {
      next(error);
    }
  }

  async reviewSubmission(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const submissionId = req.params.submissionId as string;
      const staffId = await getStaffIdForUser(req.tenantId!, req.user!.userId);
      const result = await assignmentService.reviewSubmission(
        req.tenantId!,
        id,
        submissionId,
        req.body,
        staffId
      );
      success(res, result, undefined, 'Submission reviewed successfully');
    } catch (error) {
      next(error);
    }
  }

  async getMySubmission(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const user = await collections.users.findOne({
        _id: new ObjectId(req.user!.userId),
        tenantId: new ObjectId(req.tenantId!),
      });
      const studentId = user?.studentId ? (user.studentId as ObjectId).toString() : null;
      if (!studentId) {
        return res.status(400).json({
          success: false,
          error: { code: 'STUDENT_NOT_FOUND', message: 'No student record linked' },
        });
      }
      const result = await assignmentService.getStudentSubmission(req.tenantId!, id, studentId);
      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async getSubmissions(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const result = await assignmentService.getSubmissions(req.tenantId!, id);
      success(res, result);
    } catch (error) {
      next(error);
    }
  }
}

export const assignmentController = new AssignmentController();

import { Request, Response, NextFunction } from 'express';
import { ObjectId } from 'mongodb';
import { questionnaireService } from './questionnaire.service';
import { getStaffIdForUser } from './teaching.utils';
import { success, created } from '../../utils/response';
import { collections } from '../../config/database';

class QuestionnaireController {
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
        subjectId: req.query.subjectId as string,
        status: req.query.status as string,
        search: req.query.search as string,
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as string,
      };

      const result = await questionnaireService.findAll(
        req.tenantId!,
        req.branchId!,
        params,
        staffId
      );
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const staffId = await getStaffIdForUser(req.tenantId!, req.user!.userId);
      const result = await questionnaireService.create(
        req.tenantId!,
        req.branchId!,
        req.body,
        staffId
      );
      created(res, result, 'Questionnaire created successfully');
    } catch (error) {
      next(error);
    }
  }

  async findByLessonPlan(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await questionnaireService.findByLessonPlan(
        req.tenantId!,
        req.params.lessonPlanId as string
      );
      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await questionnaireService.findById(req.tenantId!, req.params.id as string);
      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await questionnaireService.update(
        req.tenantId!,
        req.params.id as string,
        req.body
      );
      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async publish(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await questionnaireService.publish(req.tenantId!, req.params.id as string);
      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async submit(req: Request, res: Response, next: NextFunction) {
    try {
      // Resolve studentId: from body (explicit) or from user's linked student record
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
      const result = await questionnaireService.submit(
        req.tenantId!,
        req.branchId!,
        req.params.id as string,
        studentId,
        req.body
      );
      success(res, result);
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
      const result = await questionnaireService.getStudentSubmission(req.tenantId!, id, studentId);
      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async reviewSubmission(req: Request, res: Response, next: NextFunction) {
    try {
      const staffId = await getStaffIdForUser(req.tenantId!, req.user!.userId);
      const result = await questionnaireService.reviewSubmission(
        req.tenantId!,
        req.params.id as string,
        req.params.submissionId as string,
        req.body,
        staffId
      );
      success(res, result, undefined, 'Submission reviewed successfully');
    } catch (error) {
      next(error);
    }
  }

  async getSubmissions(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await questionnaireService.getSubmissions(
        req.tenantId!,
        req.params.id as string
      );
      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await questionnaireService.delete(req.tenantId!, req.params.id as string);
      success(res, result);
    } catch (error) {
      next(error);
    }
  }
}

export const questionnaireController = new QuestionnaireController();

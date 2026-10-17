import { Request, Response, NextFunction } from 'express';
import { gradeService } from './grade.service';
import { getStaffIdForUser } from './teaching.utils';
import { assertTeachingScope, assertAssignmentOwnership, assertStudentSelfScope } from './scope';
import { success, created } from '../../utils/response';

class GradeController {
  async gradeStudent(req: Request, res: Response, next: NextFunction) {
    try {
      await assertAssignmentOwnership(req, req.body.assignmentId);
      const staffId = await getStaffIdForUser(req.tenantId!, req.user!.userId);
      const grade = await gradeService.gradeStudent(
        req.tenantId!,
        req.branchId!,
        req.body,
        staffId
      );
      created(res, grade, 'Student graded successfully');
    } catch (error) {
      next(error);
    }
  }

  async bulkGrade(req: Request, res: Response, next: NextFunction) {
    try {
      await assertAssignmentOwnership(req, req.body.assignmentId);
      const staffId = await getStaffIdForUser(req.tenantId!, req.user!.userId);
      const result = await gradeService.bulkGrade(req.tenantId!, req.branchId!, req.body, staffId);
      success(res, result, undefined, 'Bulk grading completed successfully');
    } catch (error) {
      next(error);
    }
  }

  async getGradesForAssignment(req: Request, res: Response, next: NextFunction) {
    try {
      const assignmentId = req.params.assignmentId as string;
      await assertAssignmentOwnership(req, assignmentId);
      const grades = await gradeService.getGradesForAssignment(req.tenantId!, assignmentId);
      success(res, grades);
    } catch (error) {
      next(error);
    }
  }

  async getStudentGrades(req: Request, res: Response, next: NextFunction) {
    try {
      const studentId = req.params.studentId as string;
      await assertStudentSelfScope(req, studentId);
      const grades = await gradeService.getStudentGrades(req.tenantId!, studentId);
      success(res, grades);
    } catch (error) {
      next(error);
    }
  }

  async getSectionReport(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const sectionId = req.query.sectionId as string;
      if (!sectionId) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'sectionId query parameter is required' },
        });
      }

      await assertTeachingScope(req, sectionId);
      const report = await gradeService.getSectionReport(req.tenantId!, req.branchId, sectionId);
      success(res, report);
    } catch (error) {
      next(error);
    }
  }

  async getSectionStudentGrades(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const sectionId = req.query.sectionId as string;
      if (!sectionId) {
        return res.status(400).json({
          success: false,
          error: { code: 'SECTION_REQUIRED', message: 'sectionId query param is required' },
        });
      }

      await assertTeachingScope(req, sectionId);
      const data = await gradeService.getSectionStudentGrades(
        req.tenantId!,
        req.branchId,
        sectionId
      );
      success(res, data);
    } catch (error) {
      next(error);
    }
  }
}

export const gradeController = new GradeController();

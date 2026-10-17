import { assertStudentSelfScope, getStudentVisibilityFilter } from '../teaching/scope';
import { Request, Response, NextFunction } from 'express';
import { studentService, StudentListParams } from './student.service';
import { success, created } from '../../utils/response';
import { MulterS3File } from '../upload/upload.types';

class StudentController {
  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const rawCf = req.query.cf;
      let customFields: Record<string, string> | undefined;
      if (rawCf && typeof rawCf === 'object' && !Array.isArray(rawCf)) {
        customFields = {};
        for (const [k, v] of Object.entries(rawCf as Record<string, unknown>)) {
          if (typeof v === 'string' && v.length > 0) {
            customFields[k] = v;
          }
        }
        if (Object.keys(customFields).length === 0) {
          customFields = undefined;
        }
      }

      const params: StudentListParams = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        search: req.query.search as string,
        status: req.query.status as string | string[],
        classId: req.query.classId as string,
        programId: req.query.programId as string,
        sectionId: req.query.sectionId as string,
        academicBatchId: req.query.academicBatchId as string,
        category: req.query.category as string,
        gender: req.query.gender as string,
        visibilityFilter: await getStudentVisibilityFilter(req),
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc',
        customFields,
      };

      const result = await studentService.findAll(req.tenantId!, req.branchId, params);
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      // A student login may open only its own record (staff are unaffected).
      await assertStudentSelfScope(req, req.params.id as string);
      const student = await studentService.findById(req.tenantId!, req.params.id as string);
      success(res, student);
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

      const student = await studentService.create(
        req.tenantId!,
        req.branchId,
        req.body,
        req.user!.userId
      );
      created(res, student, 'Student created successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const student = await studentService.update(
        req.tenantId!,
        req.params.id as string,
        req.body,
        req.user!.userId
      );
      success(res, student, undefined, 'Student updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async resetPortalPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await studentService.resetPortalPassword(
        req.tenantId!,
        req.params.id as string,
        req.user!.userId
      );
      success(res, result, undefined, 'Portal password reset successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, reason } = req.body;
      const student = await studentService.updateStatus(
        req.tenantId!,
        req.params.id as string,
        status,
        reason || 'Status updated',
        req.user!.userId
      );
      success(res, student, undefined, 'Student status updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await studentService.delete(req.tenantId!, req.params.id as string);
      success(res, null, undefined, 'Student deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  async uploadPhoto(req: Request, res: Response, next: NextFunction) {
    try {
      const file = req.file as MulterS3File | undefined;
      if (!file) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_FILE', message: 'No file uploaded' },
        });
      }

      const student = await studentService.updatePhoto(
        req.tenantId!,
        req.params.id as string,
        file.location,
        file.key
      );

      success(res, student, undefined, 'Photo uploaded successfully');
    } catch (error) {
      next(error);
    }
  }

  async getEnrollmentHistory(req: Request, res: Response, next: NextFunction) {
    try {
      await assertStudentSelfScope(req, req.params.id as string);
      const history = await studentService.getEnrollmentHistory(
        req.tenantId!,
        req.params.id as string
      );
      success(res, history);
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

      const stats = await studentService.getStats(req.tenantId!, req.branchId);
      success(res, stats);
    } catch (error) {
      next(error);
    }
  }

  async getClassWiseReport(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const report = await studentService.getClassWiseReport(
        req.tenantId!,
        req.branchId,
        req.query.academicBatchId as string
      );
      success(res, report);
    } catch (error) {
      next(error);
    }
  }

  async getSectionWiseReport(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const report = await studentService.getSectionWiseReport(
        req.tenantId!,
        req.branchId,
        req.query.classId as string,
        req.query.academicBatchId as string
      );
      success(res, report);
    } catch (error) {
      next(error);
    }
  }

  async getActiveStudentReport(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const report = await studentService.getActiveStudentReport(
        req.tenantId!,
        req.branchId,
        req.query.academicBatchId as string
      );
      success(res, report);
    } catch (error) {
      next(error);
    }
  }

  async getCategoryWiseReport(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const report = await studentService.getCategoryWiseReport(
        req.tenantId!,
        req.branchId,
        req.query.academicBatchId as string
      );
      success(res, report);
    } catch (error) {
      next(error);
    }
  }

  async getNewAdmissionsReport(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const report = await studentService.getNewAdmissionsReport(
        req.tenantId!,
        req.branchId,
        req.query.fromDate as string,
        req.query.toDate as string
      );
      success(res, report);
    } catch (error) {
      next(error);
    }
  }

  // ============ Promote / Shuffle / Transfer ============

  async promote(req: Request, res: Response, next: NextFunction) {
    try {
      const student = await studentService.promoteStudent(
        req.tenantId!,
        req.params.id as string,
        req.body,
        req.user!.userId
      );
      success(res, student, undefined, 'Student promoted successfully');
    } catch (error) {
      next(error);
    }
  }

  async bulkPromote(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const result = await studentService.bulkPromote(
        req.tenantId!,
        req.branchId,
        req.body,
        req.user!.userId
      );
      success(res, result, undefined, 'Bulk promotion completed');
    } catch (error) {
      next(error);
    }
  }

  async shuffle(req: Request, res: Response, next: NextFunction) {
    try {
      const student = await studentService.shuffleStudent(
        req.tenantId!,
        req.params.id as string,
        req.body,
        req.user!.userId
      );
      success(res, student, undefined, 'Student shuffled to new section');
    } catch (error) {
      next(error);
    }
  }

  async transfer(req: Request, res: Response, next: NextFunction) {
    try {
      const student = await studentService.transferStudent(
        req.tenantId!,
        req.params.id as string,
        req.body,
        req.user!.userId
      );
      success(res, student, undefined, 'Student transferred successfully');
    } catch (error) {
      next(error);
    }
  }

  async exportStudents(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const params: StudentListParams = {
        status: req.query.status as string | string[],
        classId: req.query.classId as string,
        sectionId: req.query.sectionId as string,
        academicBatchId: req.query.academicBatchId as string,
      };

      const format = (req.query.format as 'csv' | 'json') || 'csv';

      const result = await studentService.exportStudents(
        req.tenantId!,
        req.branchId,
        params,
        format
      );

      if (format === 'csv' && 'content' in result) {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        return res.send(result.content);
      }

      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async getBulkUploadTemplate(_req: Request, res: Response, next: NextFunction) {
    try {
      const template = studentService.getBulkUploadTemplate();
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${template.filename}"`);
      res.send(template.content);
    } catch (error) {
      next(error);
    }
  }

  async getFeeSummary(req: Request, res: Response, next: NextFunction) {
    try {
      await assertStudentSelfScope(req, req.params.id as string);
      const summary = await studentService.getFeeSummary(req.tenantId!, req.params.id as string);
      success(res, summary);
    } catch (error) {
      next(error);
    }
  }

  async getAttendanceSummary(req: Request, res: Response, next: NextFunction) {
    try {
      await assertStudentSelfScope(req, req.params.id as string);
      const summary = await studentService.getAttendanceSummary(
        req.tenantId!,
        req.params.id as string
      );
      success(res, summary);
    } catch (error) {
      next(error);
    }
  }

  async getAlumniList(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const params = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        classId: req.query.classId as string,
        search: req.query.search as string,
        fromYear: req.query.fromYear as string,
        toYear: req.query.toYear as string,
      };

      const result = await studentService.getAlumniList(req.tenantId!, req.branchId, params);
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  // ============ Bulk operations triggered from list page selection ============

  async bulkUpdateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }
      const result = await studentService.bulkUpdateStatus(
        req.tenantId!,
        req.branchId,
        req.body,
        req.user!.userId
      );
      success(res, result, undefined, 'Student statuses updated');
    } catch (error) {
      next(error);
    }
  }

  async bulkShuffle(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }
      const result = await studentService.bulkShuffle(
        req.tenantId!,
        req.branchId,
        req.body,
        req.user!.userId
      );
      success(res, result, undefined, 'Students moved to new section');
    } catch (error) {
      next(error);
    }
  }

  async bulkDelete(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }
      const { studentIds } = req.body as { studentIds?: string[] };
      const result = await studentService.bulkDelete(req.tenantId!, req.branchId, studentIds || []);
      success(res, result, undefined, 'Students deleted');
    } catch (error) {
      next(error);
    }
  }

  async exportSelected(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }
      const { studentIds } = req.body as { studentIds?: string[] };
      const format = ((req.query.format as 'csv' | 'json') || 'csv') as 'csv' | 'json';

      const result = await studentService.exportStudentsByIds(
        req.tenantId!,
        req.branchId,
        studentIds || [],
        format
      );

      if (format === 'csv' && 'content' in result) {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        return res.send(result.content);
      }

      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async getAlumniStats(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const stats = await studentService.getAlumniStats(req.tenantId!, req.branchId);
      success(res, stats);
    } catch (error) {
      next(error);
    }
  }
}

export const studentController = new StudentController();

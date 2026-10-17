import { Request, Response, NextFunction } from 'express';
import { staffService, StaffListParams } from './staff.service';
import { success, created } from '../../utils/response';
import { getScopedDepartmentIds } from '../../middleware/scope';
import { MulterS3File } from '../upload/upload.types';

class StaffController {
  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const params: StaffListParams = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        search: req.query.search as string,
        departmentId: req.query.departmentId as string,
        restrictToDepartmentIds: await getScopedDepartmentIds(req),
        designationId: req.query.designationId as string,
        status: req.query.status as string,
        employmentType: req.query.employmentType as string,
        isTeaching:
          req.query.isTeaching === 'true'
            ? true
            : req.query.isTeaching === 'false'
              ? false
              : undefined,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc',
      };

      const result = await staffService.findAll(req.tenantId!, req.branchId, params);
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const staff = await staffService.findById(req.tenantId!, req.params.id as string);
      success(res, staff);
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

      const staff = await staffService.create(
        req.tenantId!,
        req.branchId,
        req.body,
        req.user!.userId,
        req.user!.roleLevel ?? 99
      );
      const msg =
        (staff as Record<string, unknown>).approvalStatus === 'pending_approval'
          ? 'Staff created — pending Group Owner approval'
          : 'Staff created successfully';
      created(res, staff, msg);
    } catch (error) {
      next(error);
    }
  }

  async getPendingApprovals(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await staffService.getPendingApprovals(req.tenantId!, req.branchId || undefined);
      success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async approveStaff(req: Request, res: Response, next: NextFunction) {
    try {
      const roleLevel = req.user!.roleLevel ?? 99;
      if (roleLevel > 2) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: 'Only Group Owner or Org Admin can approve staff',
          },
        });
      }
      const data = await staffService.approveStaff(
        req.tenantId!,
        req.params.id as string,
        req.user!.userId
      );
      success(res, data, undefined, 'Staff approved — user account created and welcome email sent');
    } catch (error) {
      next(error);
    }
  }

  async rejectStaff(req: Request, res: Response, next: NextFunction) {
    try {
      const roleLevel = req.user!.roleLevel ?? 99;
      if (roleLevel > 2) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: 'Only Group Owner or Org Admin can reject staff',
          },
        });
      }
      const data = await staffService.rejectStaff(
        req.tenantId!,
        req.params.id as string,
        req.user!.userId,
        req.body?.reason
      );
      success(res, data, undefined, 'Staff request rejected');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const staff = await staffService.update(req.tenantId!, req.params.id as string, req.body);
      success(res, staff, undefined, 'Staff updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, reason } = req.body;

      if (!status) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Status is required' },
        });
      }

      const staff = await staffService.updateStatus(
        req.tenantId!,
        req.params.id as string,
        status,
        reason || '',
        req.user!.userId
      );
      success(res, staff, undefined, 'Staff status updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await staffService.delete(req.tenantId!, req.params.id as string);
      success(res, null, undefined, 'Staff deleted successfully');
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

      const staff = await staffService.updatePhoto(
        req.tenantId!,
        req.params.id as string,
        file.location,
        file.key
      );

      success(res, staff, undefined, 'Photo uploaded successfully');
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

      const stats = await staffService.getStats(req.tenantId!, req.branchId);
      success(res, stats);
    } catch (error) {
      next(error);
    }
  }

  async getBulkUploadTemplate(_req: Request, res: Response, next: NextFunction) {
    try {
      const template = staffService.getBulkUploadTemplate();
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${template.filename}"`);
      res.send(template.content);
    } catch (error) {
      next(error);
    }
  }

  async validateBulkUpload(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const { csvContent } = req.body;

      if (!csvContent) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'CSV content is required' },
        });
      }

      const result = await staffService.validateBulkUpload(req.tenantId!, req.branchId, csvContent);
      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async processBulkUpload(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const { csvContent } = req.body;

      if (!csvContent) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'CSV content is required' },
        });
      }

      const result = await staffService.processBulkUpload(
        req.tenantId!,
        req.branchId,
        csvContent,
        req.user!.userId
      );

      if (result.success) {
        created(res, result, 'Staff members created successfully');
      } else {
        success(res, result);
      }
    } catch (error) {
      next(error);
    }
  }

  async getWorkload(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const staffId = req.query.staffId as string | undefined;
      const workload = await staffService.getWorkload(req.tenantId!, req.branchId, staffId);
      success(res, workload);
    } catch (error) {
      next(error);
    }
  }

  async assignWorkload(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const { staffId, subjects, classIds } = req.body;

      if (!staffId) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Staff ID is required' },
        });
      }

      const staff = await staffService.assignWorkload(req.tenantId!, req.branchId, staffId, {
        subjects,
        classIds,
      });
      success(res, staff, undefined, 'Workload assigned successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateWorkload(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const { subjects, classIds } = req.body;
      const staff = await staffService.assignWorkload(
        req.tenantId!,
        req.branchId,
        req.params.id as string,
        {
          subjects,
          classIds,
        }
      );
      success(res, staff, undefined, 'Workload updated successfully');
    } catch (error) {
      next(error);
    }
  }

  // ============ Resignation Management ============

  async submitResignation(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const { staffId, reason, requestedExitDate, remarks } = req.body;

      if (!staffId || !reason || !requestedExitDate) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Staff ID, reason, and requested exit date are required',
          },
        });
      }

      const resignation = await staffService.submitResignation(
        req.tenantId!,
        req.branchId,
        staffId,
        { reason, requestedExitDate, remarks }
      );
      created(res, resignation, 'Resignation submitted successfully');
    } catch (error) {
      next(error);
    }
  }

  async getResignations(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const params = {
        status: req.query.status as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      };

      const result = await staffService.getResignations(req.tenantId!, req.branchId, params);
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async approveResignation(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const { approvedExitDate, remarks } = req.body;

      if (!approvedExitDate) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Approved exit date is required' },
        });
      }

      const result = await staffService.approveResignation(
        req.tenantId!,
        req.branchId,
        req.params.id as string,
        { approvedExitDate, remarks },
        req.user!.userId
      );
      success(res, result, undefined, 'Resignation approved successfully');
    } catch (error) {
      next(error);
    }
  }

  async rejectResignation(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const { remarks } = req.body;

      if (!remarks) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Rejection reason is required' },
        });
      }

      const result = await staffService.rejectResignation(
        req.tenantId!,
        req.branchId,
        req.params.id as string,
        { remarks },
        req.user!.userId
      );
      success(res, result, undefined, 'Resignation rejected');
    } catch (error) {
      next(error);
    }
  }

  async getMyResignation(req: Request, res: Response, next: NextFunction) {
    try {
      // Get staff ID from query parameter (staff self-service)
      const staffId = req.query.staffId as string;

      if (!staffId) {
        return res.status(400).json({
          success: false,
          error: { code: 'STAFF_ID_REQUIRED', message: 'Staff ID is required' },
        });
      }

      const resignation = await staffService.getMyResignation(req.tenantId!, staffId);
      success(res, resignation);
    } catch (error) {
      next(error);
    }
  }

  async withdrawResignation(req: Request, res: Response, next: NextFunction) {
    try {
      const staffId = req.query.staffId as string;

      if (!staffId) {
        return res.status(400).json({
          success: false,
          error: { code: 'STAFF_ID_REQUIRED', message: 'Staff ID is required' },
        });
      }

      const result = await staffService.withdrawResignation(
        req.tenantId!,
        staffId,
        req.params.id as string
      );
      success(res, result, undefined, 'Resignation withdrawn successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const staffController = new StaffController();

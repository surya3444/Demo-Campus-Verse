import { Response, NextFunction, Request } from 'express';
import { studentBulkUploadService } from './bulkUpload.service';
import { success, noContent } from '../../utils/response';
import { getPagination, buildPaginationMeta } from '../../utils/pagination';
import { ApiError } from '../../middleware/errorHandler';

class StudentBulkUploadController {
  /**
   * Get bulk upload template with sample rows based on actual classes/sections
   * GET /students/bulk-upload/template?academicBatchId=xxx
   */
  async getTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId } = req;
      const { academicBatchId } = req.query;

      if (!branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      if (!academicBatchId || typeof academicBatchId !== 'string') {
        return res.status(400).json({
          success: false,
          error: { code: 'BATCH_REQUIRED', message: 'Academic batch ID is required' },
        });
      }

      const template = await studentBulkUploadService.getTemplate(
        tenantId!,
        branchId,
        academicBatchId
      );

      res.setHeader('Content-Type', template.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${template.filename}"`);
      res.send(template.content);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Validate bulk upload data
   * POST /students/bulk-upload/validate
   * Body: { academicBatchId: string, data: BulkStudentRow[] }
   */
  async validate(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId } = req;

      if (!branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const { academicBatchId, data } = req.body;

      if (!academicBatchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BATCH_REQUIRED', message: 'Academic batch ID is required' },
        });
      }

      if (!data || !Array.isArray(data) || data.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'DATA_REQUIRED', message: 'Data array is required' },
        });
      }

      if (data.length > 500) {
        return res.status(400).json({
          success: false,
          error: { code: 'DATA_TOO_LARGE', message: 'Maximum 500 rows allowed per upload' },
        });
      }

      const result = await studentBulkUploadService.validateRows(
        tenantId!,
        branchId,
        academicBatchId,
        data
      );

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Process bulk upload and create students
   * POST /students/bulk-upload
   * Body: { academicBatchId: string, data: ParsedStudent[] }
   */
  async process(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId } = req;

      if (!branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const { academicBatchId, data, fileName, source } = req.body;

      if (!academicBatchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BATCH_REQUIRED', message: 'Academic batch ID is required' },
        });
      }

      if (!data || !Array.isArray(data) || data.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'DATA_REQUIRED', message: 'Validated data array is required' },
        });
      }

      if (data.length > 500) {
        return res.status(400).json({
          success: false,
          error: { code: 'DATA_TOO_LARGE', message: 'Maximum 500 rows allowed per upload' },
        });
      }

      const result = await studentBulkUploadService.processUpload(
        tenantId!,
        branchId,
        academicBatchId,
        data,
        req.user!.userId,
        {
          fileName: typeof fileName === 'string' ? fileName : undefined,
          source: source === 'ai' || source === 'manual' || source === 'csv' ? source : undefined,
        }
      );

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List past bulk upload batches for the current branch (most recent first).
   * GET /students/bulk-uploads
   */
  async listUploads(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId } = req;
      if (!branchId) {
        throw new ApiError('BRANCH_REQUIRED', 'Branch ID is required', 400);
      }

      const { page, limit } = getPagination(req.query);
      const { uploads, total } = await studentBulkUploadService.listUploads(tenantId!, branchId, {
        skip: (page - 1) * limit,
        limit,
      });

      success(res, uploads, buildPaginationMeta(page, limit, total));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Hard-delete a bulk upload batch and every student it created.
   * DELETE /students/bulk-uploads/:id
   */
  async deleteUpload(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId } = req;
      if (!branchId) {
        throw new ApiError('BRANCH_REQUIRED', 'Branch ID is required', 400);
      }

      const { id } = req.params;
      await studentBulkUploadService.deleteUpload(tenantId!, branchId, id as string);

      noContent(res);
    } catch (error) {
      next(error);
    }
  }
}

export const studentBulkUploadController = new StudentBulkUploadController();

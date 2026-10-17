import { Request, Response, NextFunction } from 'express';
import { feeImportService } from './feeImport.service';
import { success, created } from '../../utils/response';

class FeeImportController {
  // ============ Fee Assignment Bulk Upload ============
  async uploadFeeAssignments(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const { academicBatchId, data } = req.body;

      if (!academicBatchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Academic batch ID is required' },
        });
      }

      if (!data || !Array.isArray(data) || data.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Data array is required' },
        });
      }

      const result = await feeImportService.processFeeUpload(
        req.tenantId!,
        req.branchId,
        academicBatchId,
        data,
        req.user!.userId
      );

      created(res, result, 'Fee assignments upload completed');
    } catch (error) {
      next(error);
    }
  }

  async validateFeeAssignments(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const { academicBatchId, data } = req.body;

      if (!academicBatchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Academic batch ID is required' },
        });
      }

      if (!data || !Array.isArray(data) || data.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Data array is required' },
        });
      }

      // First parse
      const { valid: parsedData, errors: parseErrors } =
        await feeImportService.parseFeeUpload(data);

      // Then validate
      const { valid, errors: validationErrors } = await feeImportService.validateFeeUpload(
        req.tenantId!,
        req.branchId,
        academicBatchId,
        parsedData
      );

      success(res, {
        totalRows: data.length,
        validRows: valid.length,
        invalidRows: parseErrors.length + validationErrors.length,
        errors: [...parseErrors, ...validationErrors],
      });
    } catch (error) {
      next(error);
    }
  }

  async getFeeUploadTemplate(_req: Request, res: Response, next: NextFunction) {
    try {
      const template = feeImportService.getFeeUploadTemplate();

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=fee-assignment-template.csv');
      res.send(template);
    } catch (error) {
      next(error);
    }
  }

  // ============ Concession Bulk Upload ============
  async uploadConcessions(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const { academicBatchId, data } = req.body;

      if (!academicBatchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Academic batch ID is required' },
        });
      }

      if (!data || !Array.isArray(data) || data.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Data array is required' },
        });
      }

      const result = await feeImportService.processConcessionUpload(
        req.tenantId!,
        req.branchId,
        academicBatchId,
        data,
        req.user!.userId
      );

      created(res, result, 'Concessions upload completed');
    } catch (error) {
      next(error);
    }
  }

  async validateConcessions(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const { academicBatchId, data } = req.body;

      if (!academicBatchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Academic batch ID is required' },
        });
      }

      if (!data || !Array.isArray(data) || data.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Data array is required' },
        });
      }

      // First parse
      const { valid: parsedData, errors: parseErrors } =
        await feeImportService.parseConcessionUpload(data);

      // Then validate
      const { valid, errors: validationErrors } = await feeImportService.validateConcessionUpload(
        req.tenantId!,
        req.branchId,
        academicBatchId,
        parsedData
      );

      success(res, {
        totalRows: data.length,
        validRows: valid.length,
        invalidRows: parseErrors.length + validationErrors.length,
        errors: [...parseErrors, ...validationErrors],
      });
    } catch (error) {
      next(error);
    }
  }

  async getConcessionUploadTemplate(_req: Request, res: Response, next: NextFunction) {
    try {
      const template = feeImportService.getConcessionUploadTemplate();

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=concession-template.csv');
      res.send(template);
    } catch (error) {
      next(error);
    }
  }
}

export const feeImportController = new FeeImportController();

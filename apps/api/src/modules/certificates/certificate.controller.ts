import { Request, Response, NextFunction } from 'express';
import { certificateService } from './certificate.service';
import { success, created } from '../../utils/response';

class CertificateController {
  // ============ Certificate Types ============

  async findAllTypes(req: Request, res: Response, next: NextFunction) {
    try {
      const category = req.query.category as 'student' | 'staff' | undefined;
      const types = await certificateService.findAllCertificateTypes(req.tenantId!, category);
      success(res, types);
    } catch (error) {
      next(error);
    }
  }

  async findTypeById(req: Request, res: Response, next: NextFunction) {
    try {
      const type = await certificateService.findCertificateTypeById(
        req.tenantId!,
        req.params.id as string
      );
      success(res, type);
    } catch (error) {
      next(error);
    }
  }

  async createType(req: Request, res: Response, next: NextFunction) {
    try {
      const type = await certificateService.createCertificateType(
        req.tenantId!,
        req.body,
        req.user!.userId
      );
      created(res, type, 'Certificate type created successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateType(req: Request, res: Response, next: NextFunction) {
    try {
      const type = await certificateService.updateCertificateType(
        req.tenantId!,
        req.params.id as string,
        req.body
      );
      success(res, type, undefined, 'Certificate type updated successfully');
    } catch (error) {
      next(error);
    }
  }

  // ============ Certificate Requests ============

  async findAllRequests(req: Request, res: Response, next: NextFunction) {
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
        status: req.query.status as string,
        category: req.query.category as string,
        requestorType: req.query.requestorType as string,
      };

      const result = await certificateService.findAllCertificateRequests(
        req.tenantId!,
        req.branchId,
        params
      );
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async findRequestById(req: Request, res: Response, next: NextFunction) {
    try {
      const request = await certificateService.findCertificateRequestById(
        req.tenantId!,
        req.params.id as string
      );
      success(res, request);
    } catch (error) {
      next(error);
    }
  }

  async createRequest(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const request = await certificateService.createCertificateRequest(
        req.tenantId!,
        req.branchId,
        req.body,
        req.user!.userId
      );
      created(res, request, 'Certificate request created successfully');
    } catch (error) {
      next(error);
    }
  }

  async approveRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const request = await certificateService.approveCertificateRequest(
        req.tenantId!,
        req.params.id as string,
        req.user!.userId,
        req.body.remarks
      );
      success(res, request, undefined, 'Certificate request approved');
    } catch (error) {
      next(error);
    }
  }

  async rejectRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const request = await certificateService.rejectCertificateRequest(
        req.tenantId!,
        req.params.id as string,
        req.user!.userId,
        req.body.reason
      );
      success(res, request, undefined, 'Certificate request rejected');
    } catch (error) {
      next(error);
    }
  }

  async issueRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const request = await certificateService.issueCertificate(
        req.tenantId!,
        req.params.id as string,
        req.user!.userId
      );
      success(res, request, undefined, 'Certificate issued successfully');
    } catch (error) {
      next(error);
    }
  }

  // ============ ID Cards ============

  async findAllIdCardTemplates(req: Request, res: Response, next: NextFunction) {
    try {
      const category = req.query.category as 'student' | 'staff' | undefined;
      const templates = await certificateService.findAllIdCardTemplates(
        req.tenantId!,
        req.branchId,
        category
      );
      success(res, templates);
    } catch (error) {
      next(error);
    }
  }

  async createIdCardTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const template = await certificateService.createIdCardTemplate(
        req.tenantId!,
        req.branchId,
        req.body,
        req.user!.userId
      );
      created(res, template, 'ID card template created successfully');
    } catch (error) {
      next(error);
    }
  }

  async generateIdCard(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const result = await certificateService.generateIdCard(req.tenantId!, req.branchId, req.body);
      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async bulkGenerateIdCards(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const { templateId, category, classId, sectionId, departmentId, ids } = req.body;

      if (!templateId || !category) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'templateId and category are required' },
        });
      }

      const result = await certificateService.bulkGenerateIdCards(
        req.tenantId!,
        req.branchId,
        { templateId, category, classId, sectionId, departmentId, ids },
        req.user!.userId
      );
      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  // ============ Reports ============

  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const stats = await certificateService.getCertificateStats(req.tenantId!, req.branchId);
      success(res, stats);
    } catch (error) {
      next(error);
    }
  }

  async getReport(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const params = {
        fromDate: req.query.fromDate as string,
        toDate: req.query.toDate as string,
        category: req.query.category as string,
        typeId: req.query.typeId as string,
        status: req.query.status as string,
      };

      const report = await certificateService.getCertificateReport(
        req.tenantId!,
        req.branchId,
        params
      );
      success(res, report);
    } catch (error) {
      next(error);
    }
  }
}

export const certificateController = new CertificateController();

import { Request, Response, NextFunction } from 'express';
import { schemeService } from './scheme.service';
import { success, created } from '../../utils/response';
import { ApiError } from '../../middleware/errorHandler';

function requireContext(req: Request) {
  if (!req.tenantId || !req.branchId || !req.user) {
    throw new ApiError('CONTEXT_MISSING', 'Tenant or branch context missing', 400);
  }
  return { tenantId: req.tenantId, branchId: req.branchId, userId: req.user.userId };
}

class SchemeController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId, userId } = requireContext(req);
      const scheme = await schemeService.create(tenantId, branchId, req.body, userId);
      created(res, scheme, 'Program scheme created');
    } catch (error) {
      next(error);
    }
  }

  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId } = requireContext(req);
      const schemes = await schemeService.findAll(tenantId, branchId, {
        departmentCode: req.query.departmentCode as string | undefined,
        programId: req.query.programId as string | undefined,
        semesterNumber: req.query.semesterNumber
          ? parseInt(req.query.semesterNumber as string, 10)
          : undefined,
        status: req.query.status as string | undefined,
      });
      success(res, schemes);
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId } = requireContext(req);
      const scheme = await schemeService.findById(tenantId, req.params.id as string, {
        expandSubjects: req.query.expand === 'subjects',
      });
      success(res, scheme);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId } = requireContext(req);
      const scheme = await schemeService.update(tenantId, req.params.id as string, req.body);
      success(res, scheme, undefined, 'Program scheme updated');
    } catch (error) {
      next(error);
    }
  }

  async publish(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId } = requireContext(req);
      const scheme = await schemeService.publish(tenantId, req.params.id as string);
      success(res, scheme, undefined, 'Program scheme published');
    } catch (error) {
      next(error);
    }
  }

  async archive(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId } = requireContext(req);
      const scheme = await schemeService.archive(tenantId, req.params.id as string);
      success(res, scheme, undefined, 'Program scheme archived');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId } = requireContext(req);
      await schemeService.delete(tenantId, req.params.id as string);
      success(res, null, undefined, 'Program scheme deleted');
    } catch (error) {
      next(error);
    }
  }

  async clone(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId, userId } = requireContext(req);
      const scheme = await schemeService.clone(
        tenantId,
        branchId,
        req.params.id as string,
        req.body,
        userId
      );
      created(res, scheme, 'Program scheme cloned');
    } catch (error) {
      next(error);
    }
  }
}

export const schemeController = new SchemeController();

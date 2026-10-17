import { getScopedInstitutionIds } from '../../middleware/scope';
import { Request, Response, NextFunction } from 'express';
import { institutionService } from './institution.service';
import { success, created } from '../../utils/response';

class InstitutionController {
  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      const institutions = await institutionService.findAll(req.tenantId!, req.branchId!, {
        status: req.query.status as 'active' | 'archived' | undefined,
      });
      const scoped = await getScopedInstitutionIds(req);
      const allowed = scoped && new Set(scoped.map(String));
      success(
        res,
        allowed
          ? (institutions as Array<{ _id: unknown }>).filter((i) => allowed.has(String(i._id)))
          : institutions
      );
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const institution = await institutionService.findById(req.tenantId!, req.params.id as string);
      success(res, institution);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const institution = await institutionService.create(
        req.tenantId!,
        req.branchId!,
        req.body,
        req.user?.userId
      );
      created(res, institution, 'Institution created successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const institution = await institutionService.update(
        req.tenantId!,
        req.params.id as string,
        req.body
      );
      success(res, institution, undefined, 'Institution updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await institutionService.delete(req.tenantId!, req.params.id as string);
      success(res, result, undefined, 'Institution deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const institutionController = new InstitutionController();

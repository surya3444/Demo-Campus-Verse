import { Request, Response, NextFunction } from 'express';
import { alumniProfileService } from './alumniProfile.service';
import { success } from '../../../utils/response';

class AlumniProfileController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await alumniProfileService.list(req.tenantId!, req.branchId!, {
        search: req.query.search as string,
        graduationYear: req.query.graduationYear
          ? parseInt(req.query.graduationYear as string)
          : undefined,
        company: req.query.company as string,
        isVerified: req.query.isVerified as string,
        willingToMentor: req.query.willingToMentor as string,
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as string,
      });
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await alumniProfileService.getById(req.tenantId!, id);
      success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async getMyProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await alumniProfileService.getMyProfile(req.tenantId!, req.user!.userId);
      success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await alumniProfileService.update(req.tenantId!, id, req.body);
      success(res, data, undefined, 'Alumni profile updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async verify(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await alumniProfileService.verify(req.tenantId!, id, req.user!.userId);
      success(res, data, undefined, 'Alumni profile verified successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const alumniProfileController = new AlumniProfileController();

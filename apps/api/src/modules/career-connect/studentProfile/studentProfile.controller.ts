import { Request, Response, NextFunction } from 'express';
import { studentProfileService } from './studentProfile.service';
import { success, created } from '../../../utils/response';
import { withPeople } from '../../../utils/people';

class StudentProfileController {
  async getMyProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const studentId = req.user!.userId;
      const data = await studentProfileService.getOrCreateProfile(req.tenantId!, studentId, '');
      success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const studentId = req.params.studentId as string;
      const data = await studentProfileService.getOrCreateProfile(
        req.tenantId!,
        studentId,
        (req.query.studentName as string) || ''
      );
      success(res, (await withPeople([data], 'studentId'))[0]);
    } catch (error) {
      next(error);
    }
  }

  async listProfiles(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await studentProfileService.list(req.tenantId!, req.branchId!, {
        search: req.query.search as string,
        placementStatus: req.query.placementStatus as string,
        skills: req.query.skills as string,
        department: req.query.department as string,
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

  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const studentId = req.params.studentId as string;
      const data = await studentProfileService.updateProfile(req.tenantId!, studentId, req.body);
      success(res, data, undefined, 'Profile updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async addSkill(req: Request, res: Response, next: NextFunction) {
    try {
      const studentId = req.params.studentId as string;
      const data = await studentProfileService.addSkill(req.tenantId!, studentId, req.body);
      created(res, data, 'Skill added successfully');
    } catch (error) {
      next(error);
    }
  }

  async removeSkill(req: Request, res: Response, next: NextFunction) {
    try {
      const studentId = req.params.studentId as string;
      const itemId = req.params.itemId as string;
      const data = await studentProfileService.removeSkill(req.tenantId!, studentId, itemId);
      success(res, data, undefined, 'Skill removed successfully');
    } catch (error) {
      next(error);
    }
  }

  async addCertification(req: Request, res: Response, next: NextFunction) {
    try {
      const studentId = req.params.studentId as string;
      const data = await studentProfileService.addCertification(req.tenantId!, studentId, req.body);
      created(res, data, 'Certification added successfully');
    } catch (error) {
      next(error);
    }
  }

  async removeCertification(req: Request, res: Response, next: NextFunction) {
    try {
      const studentId = req.params.studentId as string;
      const itemId = req.params.itemId as string;
      const data = await studentProfileService.removeCertification(
        req.tenantId!,
        studentId,
        itemId
      );
      success(res, data, undefined, 'Certification removed successfully');
    } catch (error) {
      next(error);
    }
  }

  async addProject(req: Request, res: Response, next: NextFunction) {
    try {
      const studentId = req.params.studentId as string;
      const data = await studentProfileService.addProject(req.tenantId!, studentId, req.body);
      created(res, data, 'Project added successfully');
    } catch (error) {
      next(error);
    }
  }

  async removeProject(req: Request, res: Response, next: NextFunction) {
    try {
      const studentId = req.params.studentId as string;
      const itemId = req.params.itemId as string;
      const data = await studentProfileService.removeProject(req.tenantId!, studentId, itemId);
      success(res, data, undefined, 'Project removed successfully');
    } catch (error) {
      next(error);
    }
  }

  async addExperience(req: Request, res: Response, next: NextFunction) {
    try {
      const studentId = req.params.studentId as string;
      const data = await studentProfileService.addExperience(req.tenantId!, studentId, req.body);
      created(res, data, 'Experience added successfully');
    } catch (error) {
      next(error);
    }
  }

  async removeExperience(req: Request, res: Response, next: NextFunction) {
    try {
      const studentId = req.params.studentId as string;
      const itemId = req.params.itemId as string;
      const data = await studentProfileService.removeExperience(req.tenantId!, studentId, itemId);
      success(res, data, undefined, 'Experience removed successfully');
    } catch (error) {
      next(error);
    }
  }

  async updatePreferences(req: Request, res: Response, next: NextFunction) {
    try {
      const studentId = req.params.studentId as string;
      const data = await studentProfileService.updatePreferences(
        req.tenantId!,
        studentId,
        req.body
      );
      success(res, data, undefined, 'Preferences updated successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const studentProfileController = new StudentProfileController();

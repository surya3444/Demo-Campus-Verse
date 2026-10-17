import { Request, Response, NextFunction } from 'express';
import {
  careersService,
  type VacancyStatus,
  type ApplicationStatus,
  type EmploymentType,
  type WorkMode,
} from './careers.service';
import { success, created, noContent } from '../../utils/response';
import { ApiError } from '../../middleware/errorHandler';

class CareersController {
  // ───────────── Vacancies: Public ─────────────

  async listPublishedVacancies(req: Request, res: Response, next: NextFunction) {
    try {
      const { category, department, employmentType, workMode, location, search, page, limit } =
        req.query;
      const result = await careersService.listVacanciesPublic({
        category: category as string | undefined,
        department: department as string | undefined,
        employmentType: employmentType as EmploymentType | undefined,
        workMode: workMode as WorkMode | undefined,
        location: location as string | undefined,
        search: search as string | undefined,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getVacancyBySlug(req: Request, res: Response, next: NextFunction) {
    try {
      const slug = req.params.slug as string;
      const vacancy = await careersService.getPublishedVacancyBySlug(slug);
      success(res, vacancy);
    } catch (error) {
      next(error);
    }
  }

  // ───────────── Vacancies: Admin ─────────────

  async listVacancies(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, search, page, limit } = req.query;
      const result = await careersService.listVacanciesAdmin({
        status: status as VacancyStatus | undefined,
        search: search as string | undefined,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getVacancy(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const vacancy = await careersService.getVacancyById(id);
      success(res, vacancy);
    } catch (error) {
      next(error);
    }
  }

  async createVacancy(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.superAdmin) throw new ApiError('UNAUTHORIZED', 'Not authenticated', 401);
      const vacancy = await careersService.createVacancy(req.body, req.superAdmin.adminId);
      created(res, vacancy, 'Vacancy created');
    } catch (error) {
      next(error);
    }
  }

  async updateVacancy(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const vacancy = await careersService.updateVacancy(id, req.body);
      success(res, vacancy, undefined, 'Vacancy updated');
    } catch (error) {
      next(error);
    }
  }

  async setVacancyStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { status } = req.body as { status?: VacancyStatus };
      if (status !== 'draft' && status !== 'published' && status !== 'closed') {
        throw new ApiError(
          'INVALID_INPUT',
          "status must be 'draft', 'published', or 'closed'",
          400
        );
      }
      const vacancy = await careersService.setVacancyStatus(id, status);
      success(res, vacancy, undefined, `Vacancy ${status}`);
    } catch (error) {
      next(error);
    }
  }

  async removeVacancy(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      await careersService.removeVacancy(id);
      noContent(res);
    } catch (error) {
      next(error);
    }
  }

  // ───────────── Applications: Public ─────────────

  async submitApplication(req: Request, res: Response, next: NextFunction) {
    try {
      const file = req.file as
        | (Express.Multer.File & { location?: string; key?: string })
        | undefined;

      const body = req.body as Record<string, string>;
      const resumeUrl = file?.location ?? body.resumeUrl;
      const resumeKey = file?.key ?? body.resumeKey;
      const resumeFileName = file?.originalname ?? body.resumeFileName;

      if (!resumeUrl) throw new ApiError('NO_FILE', 'Resume is required', 400);

      const application = await careersService.createApplication({
        vacancyId: body.vacancyId,
        fullName: body.fullName,
        email: body.email,
        phone: body.phone,
        coverLetter: body.coverLetter,
        resumeUrl,
        resumeKey,
        resumeFileName,
        linkedinUrl: body.linkedinUrl,
        portfolioUrl: body.portfolioUrl,
        source: {
          ip: req.ip,
          userAgent: req.get('user-agent') || undefined,
        },
      });
      created(res, application, 'Application submitted');
    } catch (error) {
      next(error);
    }
  }

  // ───────────── Applications: Admin ─────────────

  async listApplications(req: Request, res: Response, next: NextFunction) {
    try {
      const { vacancyId, status, search, page, limit } = req.query;
      const result = await careersService.listApplications({
        vacancyId: vacancyId as string | undefined,
        status: status as ApplicationStatus | undefined,
        search: search as string | undefined,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getApplication(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const application = await careersService.getApplicationById(id);
      success(res, application);
    } catch (error) {
      next(error);
    }
  }

  async updateApplicationStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { status, notes } = req.body as { status?: ApplicationStatus; notes?: string };
      if (!status) throw new ApiError('INVALID_INPUT', 'status is required', 400);
      const application = await careersService.updateApplicationStatus(id, status, notes);
      success(res, application, undefined, 'Application updated');
    } catch (error) {
      next(error);
    }
  }

  async removeApplication(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      await careersService.removeApplication(id);
      noContent(res);
    } catch (error) {
      next(error);
    }
  }
}

export const careersController = new CareersController();

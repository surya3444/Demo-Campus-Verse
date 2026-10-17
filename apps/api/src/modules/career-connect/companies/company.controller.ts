import { Request, Response, NextFunction } from 'express';
import { companyService } from './company.service';
import { success, created, noContent } from '../../../utils/response';

class CompanyController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await companyService.list(req.tenantId!, req.branchId!, {
        search: req.query.search as string,
        status: req.query.status as string,
        industry: req.query.industry as string,
        size: req.query.size as string,
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
      const data = await companyService.getById(req.tenantId!, id);
      success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await companyService.create(
        req.tenantId!,
        req.branchId!,
        req.user!.userId,
        req.body
      );
      created(res, data, 'Company created successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await companyService.update(req.tenantId!, id, req.body);
      success(res, data, undefined, 'Company updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      await companyService.delete(req.tenantId!, id);
      noContent(res);
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await companyService.updateStatus(req.tenantId!, id, req.body.status);
      success(res, data, undefined, 'Company status updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async addContact(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await companyService.addContact(req.tenantId!, id, req.body);
      success(res, data, undefined, 'Contact added successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateContact(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const contactId = req.params.contactId as string;
      const data = await companyService.updateContact(req.tenantId!, id, contactId, req.body);
      success(res, data, undefined, 'Contact updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async removeContact(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const contactId = req.params.contactId as string;
      const data = await companyService.removeContact(req.tenantId!, id, contactId);
      success(res, data, undefined, 'Contact removed successfully');
    } catch (error) {
      next(error);
    }
  }

  async addVisit(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await companyService.addVisit(req.tenantId!, id, req.user!.userId, req.body);
      success(res, data, undefined, 'Visit logged successfully');
    } catch (error) {
      next(error);
    }
  }

  async getVisits(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await companyService.getVisits(req.tenantId!, id);
      success(res, data);
    } catch (error) {
      next(error);
    }
  }
}

export const companyController = new CompanyController();

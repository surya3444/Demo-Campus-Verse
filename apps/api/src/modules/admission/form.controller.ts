import { Request, Response, NextFunction } from 'express';
import { formService } from './form.service';

class FormController {
  // ============ Form CRUD ============

  async createForm(req: Request, res: Response, next: NextFunction) {
    try {
      const form = await formService.createForm(
        req.tenantId!,
        req.branchId!,
        req.body,
        req.user!.userId
      );
      res.status(201).json({ success: true, data: form });
    } catch (error) {
      next(error);
    }
  }

  async updateForm(req: Request, res: Response, next: NextFunction) {
    try {
      const form = await formService.updateForm(
        req.tenantId!,
        req.branchId!,
        req.params.id as string,
        req.body,
        req.user!.userId
      );
      res.json({ success: true, data: form });
    } catch (error) {
      next(error);
    }
  }

  async deleteForm(req: Request, res: Response, next: NextFunction) {
    try {
      await formService.deleteForm(
        req.tenantId!,
        req.branchId!,
        req.params.id as string,
        req.user!.userId
      );
      res.json({ success: true, message: 'Form deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async getForm(req: Request, res: Response, next: NextFunction) {
    try {
      const form = await formService.getForm(req.tenantId!, req.branchId!, req.params.id as string);
      res.json({ success: true, data: form });
    } catch (error) {
      next(error);
    }
  }

  async getForms(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, status, type, search } = req.query;
      const result = await formService.getForms(req.tenantId!, req.branchId!, {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        status: status as string | undefined,
        type: type as string | undefined,
        search: search as string | undefined,
      });
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async duplicateForm(req: Request, res: Response, next: NextFunction) {
    try {
      const { name } = req.body;
      const form = await formService.duplicateForm(
        req.tenantId!,
        req.branchId!,
        req.params.id as string,
        name,
        req.user!.userId
      );
      res.status(201).json({ success: true, data: form });
    } catch (error) {
      next(error);
    }
  }

  // ============ Public Form Access ============

  async getPublicForm(req: Request, res: Response, next: NextFunction) {
    try {
      const form = await formService.getFormBySlug(req.params.slug as string);
      res.json({ success: true, data: form });
    } catch (error) {
      next(error);
    }
  }

  async submitPublicForm(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await formService.submitForm(req.params.slug as string, {
        data: req.body.data,
        files: req.body.files,
        source: {
          ip: req.ip,
          userAgent: req.get('user-agent'),
          referrer: req.get('referer'),
        },
      });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  // ============ Submissions ============

  async getSubmissions(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, status } = req.query;
      const result = await formService.getSubmissions(
        req.tenantId!,
        req.branchId!,
        req.params.formId as string,
        {
          page: page ? parseInt(page as string) : undefined,
          limit: limit ? parseInt(limit as string) : undefined,
          status: status as string | undefined,
        }
      );
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async getSubmission(req: Request, res: Response, next: NextFunction) {
    try {
      const submission = await formService.getSubmission(
        req.tenantId!,
        req.branchId!,
        req.params.submissionId as string
      );
      res.json({ success: true, data: submission });
    } catch (error) {
      next(error);
    }
  }

  async updateSubmissionStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, notes } = req.body;
      const submission = await formService.updateSubmissionStatus(
        req.tenantId!,
        req.branchId!,
        req.params.submissionId as string,
        status,
        notes
      );
      res.json({ success: true, data: submission });
    } catch (error) {
      next(error);
    }
  }
}

export const formController = new FormController();

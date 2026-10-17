import { Response, NextFunction, Request } from 'express';
import { admissionSettingsService } from './settings.service';

class SettingsController {
  // ============ Settings ============
  async getSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId } = req;
      if (!branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const settings = await admissionSettingsService.getSettings(tenantId!, branchId);
      res.json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  }

  async updateSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId } = req;
      if (!branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const settings = await admissionSettingsService.updateSettings(
        tenantId!,
        branchId,
        req.body,
        req.user!.userId
      );
      res.json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  }

  // ============ Sources ============
  async getSources(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId } = req;
      const sources = await admissionSettingsService.getSources(tenantId!, branchId);
      res.json({ success: true, data: sources });
    } catch (error) {
      next(error);
    }
  }

  async createSource(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId } = req;
      const source = await admissionSettingsService.createSource(
        tenantId!,
        branchId || null,
        req.body,
        req.user!.userId
      );
      res.status(201).json({ success: true, data: source });
    } catch (error) {
      next(error);
    }
  }

  async updateSource(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId } = req;
      const id = req.params.id as string;
      const source = await admissionSettingsService.updateSource(
        tenantId!,
        id,
        req.body,
        req.user!.userId
      );
      res.json({ success: true, data: source });
    } catch (error) {
      next(error);
    }
  }

  async deleteSource(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId } = req;
      const id = req.params.id as string;
      await admissionSettingsService.deleteSource(tenantId!, id, req.user!.userId);
      res.json({ success: true, message: 'Source deleted' });
    } catch (error) {
      next(error);
    }
  }

  // ============ Agents ============
  async getAgents(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId } = req;
      const { isActive, search } = req.query;

      const agents = await admissionSettingsService.getAgents(tenantId!, branchId, {
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        search: search as string,
      });
      res.json({ success: true, data: agents });
    } catch (error) {
      next(error);
    }
  }

  async getAgent(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId } = req;
      const id = req.params.id as string;
      const agent = await admissionSettingsService.getAgent(tenantId!, id);
      res.json({ success: true, data: agent });
    } catch (error) {
      next(error);
    }
  }

  async createAgent(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId } = req;
      const agent = await admissionSettingsService.createAgent(
        tenantId!,
        branchId || null,
        req.body,
        req.user!.userId
      );
      res.status(201).json({ success: true, data: agent });
    } catch (error) {
      next(error);
    }
  }

  async updateAgent(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId } = req;
      const id = req.params.id as string;
      const agent = await admissionSettingsService.updateAgent(
        tenantId!,
        id,
        req.body,
        req.user!.userId
      );
      res.json({ success: true, data: agent });
    } catch (error) {
      next(error);
    }
  }

  async deleteAgent(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId } = req;
      const id = req.params.id as string;
      await admissionSettingsService.deleteAgent(tenantId!, id, req.user!.userId);
      res.json({ success: true, message: 'Agent deleted' });
    } catch (error) {
      next(error);
    }
  }

  async getAgentStats(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId } = req;
      const id = req.params.id as string;
      const stats = await admissionSettingsService.getAgentStats(tenantId!, id);
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }

  // ============ Public Web Forms ============
  async getPublicEnquiryForm(req: Request, res: Response, next: NextFunction) {
    try {
      const branchId = req.params.branchId as string;
      const form = await admissionSettingsService.getPublicEnquiryForm(branchId);
      res.json({ success: true, data: form });
    } catch (error) {
      next(error);
    }
  }

  async submitPublicEnquiry(req: Request, res: Response, next: NextFunction) {
    try {
      const branchId = req.params.branchId as string;
      const result = await admissionSettingsService.submitPublicEnquiry(branchId, req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getPublicApplicationForm(req: Request, res: Response, next: NextFunction) {
    try {
      const branchId = req.params.branchId as string;
      const form = await admissionSettingsService.getPublicApplicationForm(branchId);
      res.json({ success: true, data: form });
    } catch (error) {
      next(error);
    }
  }

  async submitPublicApplication(req: Request, res: Response, next: NextFunction) {
    try {
      const branchId = req.params.branchId as string;
      const result = await admissionSettingsService.submitPublicApplication(branchId, req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

export const settingsController = new SettingsController();

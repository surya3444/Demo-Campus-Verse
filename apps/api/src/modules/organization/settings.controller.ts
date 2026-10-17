import { Request, Response, NextFunction } from 'express';
import { settingsService } from './settings.service';
import { success } from '../../utils/response';

class SettingsController {
  async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const profile = await settingsService.getOrganizationProfile(req.tenantId!);
      success(res, profile);
    } catch (error) {
      next(error);
    }
  }

  async getSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await settingsService.getSettings(req.tenantId!);
      success(res, settings);
    } catch (error) {
      next(error);
    }
  }

  async updateSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await settingsService.updateSettings(
        req.tenantId!,
        req.body,
        req.user!.userId
      );
      success(res, settings, undefined, 'Settings updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async getContact(req: Request, res: Response, next: NextFunction) {
    try {
      const contact = await settingsService.getContact(req.tenantId!);
      success(res, contact);
    } catch (error) {
      next(error);
    }
  }

  async updateContact(req: Request, res: Response, next: NextFunction) {
    try {
      const contact = await settingsService.updateContact(
        req.tenantId!,
        req.body,
        req.user!.userId
      );
      success(res, contact, undefined, 'Contact information updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async getLegalInfo(req: Request, res: Response, next: NextFunction) {
    try {
      const legalInfo = await settingsService.getLegalInfo(req.tenantId!);
      success(res, legalInfo);
    } catch (error) {
      next(error);
    }
  }

  async updateLegalInfo(req: Request, res: Response, next: NextFunction) {
    try {
      const legalInfo = await settingsService.updateLegalInfo(
        req.tenantId!,
        req.body,
        req.user!.userId
      );
      success(res, legalInfo, undefined, 'Legal information updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async getBranding(req: Request, res: Response, next: NextFunction) {
    try {
      const branding = await settingsService.getBranding(req.tenantId!);
      success(res, branding);
    } catch (error) {
      next(error);
    }
  }

  async updateBranding(req: Request, res: Response, next: NextFunction) {
    try {
      const branding = await settingsService.updateBranding(
        req.tenantId!,
        req.body,
        req.user!.userId
      );
      success(res, branding, undefined, 'Branding updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async getModules(req: Request, res: Response, next: NextFunction) {
    try {
      const modules = await settingsService.getEnabledModules(req.tenantId!);
      success(res, { enabledModules: modules });
    } catch (error) {
      next(error);
    }
  }

  async updateModules(req: Request, res: Response, next: NextFunction) {
    try {
      const { modules } = req.body as { modules: string[] };
      const enabledModules = await settingsService.updateEnabledModules(
        req.tenantId!,
        modules,
        req.user!.userId
      );
      success(res, { enabledModules }, undefined, 'Modules updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async getAcademicHierarchy(req: Request, res: Response, next: NextFunction) {
    try {
      const branchId = (req.query.branchId as string) || req.branchId;
      const hierarchy = await settingsService.getAcademicHierarchy(req.tenantId!, branchId);
      success(res, hierarchy);
    } catch (error) {
      next(error);
    }
  }

  async updateAcademicHierarchy(req: Request, res: Response, next: NextFunction) {
    try {
      const branchId = (req.query.branchId as string) || req.branchId;
      const hierarchy = await settingsService.updateAcademicHierarchy(
        req.tenantId!,
        req.body,
        req.user!.userId,
        branchId
      );
      success(res, hierarchy, undefined, 'Academic hierarchy updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async resetAcademicHierarchy(req: Request, res: Response, next: NextFunction) {
    try {
      const branchId = (req.query.branchId as string) || req.branchId;
      const hierarchy = await settingsService.resetAcademicHierarchy(
        req.tenantId!,
        req.user!.userId,
        branchId
      );
      success(res, hierarchy, undefined, 'Academic hierarchy reset to default');
    } catch (error) {
      next(error);
    }
  }
}

export const settingsController = new SettingsController();

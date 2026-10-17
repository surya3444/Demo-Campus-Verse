import { Request, Response } from 'express';
import { certificateSettingsService } from './certificateSettings.service';

class CertificateSettingsController {
  async getSettings(req: Request, res: Response) {
    const settings = await certificateSettingsService.getSettings(req.tenantId!, req.branchId!);
    res.json({ success: true, data: settings });
  }

  async updateSettings(req: Request, res: Response) {
    const settings = await certificateSettingsService.updateSettings(
      req.tenantId!,
      req.branchId!,
      req.body,
      req.user!.userId
    );
    res.json({ success: true, data: settings });
  }

  // Staff Certificate Types
  async addStaffCertificateType(req: Request, res: Response) {
    const settings = await certificateSettingsService.addStaffCertificateType(
      req.tenantId!,
      req.branchId!,
      req.body,
      req.user!.userId
    );
    res.json({ success: true, data: settings });
  }

  async updateStaffCertificateType(req: Request, res: Response) {
    const code = req.params.code as string;
    const settings = await certificateSettingsService.updateStaffCertificateType(
      req.tenantId!,
      req.branchId!,
      code,
      req.body,
      req.user!.userId
    );
    res.json({ success: true, data: settings });
  }

  async deleteStaffCertificateType(req: Request, res: Response) {
    const code = req.params.code as string;
    const settings = await certificateSettingsService.deleteStaffCertificateType(
      req.tenantId!,
      req.branchId!,
      code,
      req.user!.userId
    );
    res.json({ success: true, data: settings });
  }

  // Generate Numbers
  async generateCertificateNumber(req: Request, res: Response) {
    const number = await certificateSettingsService.generateCertificateNumber(
      req.tenantId!,
      req.branchId!
    );
    res.json({ success: true, data: { certificateNumber: number } });
  }

  async generateIdCardNumber(req: Request, res: Response) {
    const number = await certificateSettingsService.generateIdCardNumber(
      req.tenantId!,
      req.branchId!
    );
    res.json({ success: true, data: { idCardNumber: number } });
  }
}

export const certificateSettingsController = new CertificateSettingsController();

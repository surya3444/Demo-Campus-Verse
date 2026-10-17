import { Request, Response } from 'express';
import { communicationSettingsService } from './communicationSettings.service';

class CommunicationSettingsController {
  async getSettings(req: Request, res: Response) {
    const settings = await communicationSettingsService.getSettings(req.tenantId!, req.branchId!);
    res.json({ success: true, data: settings });
  }

  async updateSettings(req: Request, res: Response) {
    const settings = await communicationSettingsService.updateSettings(
      req.tenantId!,
      req.branchId!,
      req.body,
      req.user!.userId
    );
    res.json({ success: true, data: settings });
  }

  // Event Types
  async addEventType(req: Request, res: Response) {
    const settings = await communicationSettingsService.addEventType(
      req.tenantId!,
      req.branchId!,
      req.body,
      req.user!.userId
    );
    res.json({ success: true, data: settings });
  }

  async updateEventType(req: Request, res: Response) {
    const code = req.params.code as string;
    const settings = await communicationSettingsService.updateEventType(
      req.tenantId!,
      req.branchId!,
      code,
      req.body,
      req.user!.userId
    );
    res.json({ success: true, data: settings });
  }

  async deleteEventType(req: Request, res: Response) {
    const code = req.params.code as string;
    const settings = await communicationSettingsService.deleteEventType(
      req.tenantId!,
      req.branchId!,
      code,
      req.user!.userId
    );
    res.json({ success: true, data: settings });
  }

  // SMS Templates
  async addSMSTemplate(req: Request, res: Response) {
    const settings = await communicationSettingsService.addSMSTemplate(
      req.tenantId!,
      req.branchId!,
      req.body,
      req.user!.userId
    );
    res.json({ success: true, data: settings });
  }

  async updateSMSTemplate(req: Request, res: Response) {
    const code = req.params.code as string;
    const settings = await communicationSettingsService.updateSMSTemplate(
      req.tenantId!,
      req.branchId!,
      code,
      req.body,
      req.user!.userId
    );
    res.json({ success: true, data: settings });
  }

  async deleteSMSTemplate(req: Request, res: Response) {
    const code = req.params.code as string;
    const settings = await communicationSettingsService.deleteSMSTemplate(
      req.tenantId!,
      req.branchId!,
      code,
      req.user!.userId
    );
    res.json({ success: true, data: settings });
  }

  // Email Templates
  async addEmailTemplate(req: Request, res: Response) {
    const settings = await communicationSettingsService.addEmailTemplate(
      req.tenantId!,
      req.branchId!,
      req.body,
      req.user!.userId
    );
    res.json({ success: true, data: settings });
  }

  async updateEmailTemplate(req: Request, res: Response) {
    const code = req.params.code as string;
    const settings = await communicationSettingsService.updateEmailTemplate(
      req.tenantId!,
      req.branchId!,
      code,
      req.body,
      req.user!.userId
    );
    res.json({ success: true, data: settings });
  }

  async deleteEmailTemplate(req: Request, res: Response) {
    const code = req.params.code as string;
    const settings = await communicationSettingsService.deleteEmailTemplate(
      req.tenantId!,
      req.branchId!,
      code,
      req.user!.userId
    );
    res.json({ success: true, data: settings });
  }

  // Reports
  async getLoginReport(req: Request, res: Response) {
    const { startDate, endDate } = req.query;
    const report = await communicationSettingsService.getLoginReport(req.tenantId!, req.branchId!, {
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
    });
    res.json({ success: true, data: report });
  }

  async getNeverLoggedReport(req: Request, res: Response) {
    const report = await communicationSettingsService.getNeverLoggedReport(
      req.tenantId!,
      req.branchId!
    );
    res.json({ success: true, data: report });
  }

  async getNotificationReport(req: Request, res: Response) {
    const { startDate, endDate } = req.query;
    const report = await communicationSettingsService.getNotificationReport(
      req.tenantId!,
      req.branchId!,
      {
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
      }
    );
    res.json({ success: true, data: report });
  }
}

export const communicationSettingsController = new CommunicationSettingsController();

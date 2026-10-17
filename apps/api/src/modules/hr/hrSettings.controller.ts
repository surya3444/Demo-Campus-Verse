import { Request, Response } from 'express';
import { hrSettingsService } from './hrSettings.service';

class HRSettingsController {
  async getSettings(req: Request, res: Response) {
    const settings = await hrSettingsService.getSettings(req.tenantId!, req.branchId!);
    res.json({ success: true, data: settings });
  }

  async updateSettings(req: Request, res: Response) {
    const settings = await hrSettingsService.updateSettings(
      req.tenantId!,
      req.branchId!,
      req.body,
      req.user!.userId
    );
    res.json({ success: true, data: settings });
  }

  async addLeaveType(req: Request, res: Response) {
    const settings = await hrSettingsService.addLeaveType(
      req.tenantId!,
      req.branchId!,
      req.body,
      req.user!.userId
    );
    res.json({ success: true, data: settings });
  }

  async updateLeaveType(req: Request, res: Response) {
    const code = req.params.code as string;
    const settings = await hrSettingsService.updateLeaveType(
      req.tenantId!,
      req.branchId!,
      code,
      req.body,
      req.user!.userId
    );
    res.json({ success: true, data: settings });
  }

  async deleteLeaveType(req: Request, res: Response) {
    const code = req.params.code as string;
    const settings = await hrSettingsService.deleteLeaveType(
      req.tenantId!,
      req.branchId!,
      code,
      req.user!.userId
    );
    res.json({ success: true, data: settings });
  }

  // Shifts
  async addShift(req: Request, res: Response) {
    const settings = await hrSettingsService.addShift(
      req.tenantId!,
      req.branchId!,
      req.body,
      req.user!.userId
    );
    res.json({ success: true, data: settings });
  }

  async updateShift(req: Request, res: Response) {
    const code = req.params.code as string;
    const settings = await hrSettingsService.updateShift(
      req.tenantId!,
      req.branchId!,
      code,
      req.body,
      req.user!.userId
    );
    res.json({ success: true, data: settings });
  }

  async deleteShift(req: Request, res: Response) {
    const code = req.params.code as string;
    const settings = await hrSettingsService.deleteShift(
      req.tenantId!,
      req.branchId!,
      code,
      req.user!.userId
    );
    res.json({ success: true, data: settings });
  }

  // Weekly Offs
  async updateWeeklyOffs(req: Request, res: Response) {
    const settings = await hrSettingsService.updateWeeklyOffs(
      req.tenantId!,
      req.branchId!,
      req.body,
      req.user!.userId
    );
    res.json({ success: true, data: settings });
  }

  // Leave Encashment
  async updateLeaveEncashment(req: Request, res: Response) {
    const settings = await hrSettingsService.updateLeaveEncashment(
      req.tenantId!,
      req.branchId!,
      req.body,
      req.user!.userId
    );
    res.json({ success: true, data: settings });
  }
}

export const hrSettingsController = new HRSettingsController();

import { Request, Response } from 'express';
import { attendanceSettingsService } from './attendanceSettings.service';

class AttendanceSettingsController {
  async getSettings(req: Request, res: Response) {
    const settings = await attendanceSettingsService.getSettings(req.tenantId!, req.branchId!);
    res.json({ success: true, data: settings });
  }

  async updateSettings(req: Request, res: Response) {
    const settings = await attendanceSettingsService.updateSettings(
      req.tenantId!,
      req.branchId!,
      req.body,
      req.user!.userId
    );
    res.json({ success: true, data: settings });
  }

  // Attendance Statuses
  async addAttendanceStatus(req: Request, res: Response) {
    const settings = await attendanceSettingsService.addAttendanceStatus(
      req.tenantId!,
      req.branchId!,
      req.body,
      req.user!.userId
    );
    res.json({ success: true, data: settings });
  }

  async updateAttendanceStatus(req: Request, res: Response) {
    const code = req.params.code as string;
    const settings = await attendanceSettingsService.updateAttendanceStatus(
      req.tenantId!,
      req.branchId!,
      code,
      req.body,
      req.user!.userId
    );
    res.json({ success: true, data: settings });
  }

  async deleteAttendanceStatus(req: Request, res: Response) {
    const code = req.params.code as string;
    const settings = await attendanceSettingsService.deleteAttendanceStatus(
      req.tenantId!,
      req.branchId!,
      code,
      req.user!.userId
    );
    res.json({ success: true, data: settings });
  }

  // Holiday Integration
  async getWorkingDaysInRange(req: Request, res: Response) {
    const { startDate, endDate } = req.query;
    const result = await attendanceSettingsService.getWorkingDaysInRange(
      req.tenantId!,
      req.branchId!,
      new Date(startDate as string),
      new Date(endDate as string)
    );
    res.json({ success: true, data: result });
  }

  async getStudentAttendanceStats(req: Request, res: Response) {
    const studentId = req.params.studentId as string;
    const { startDate, endDate } = req.query;
    const result = await attendanceSettingsService.calculateAttendancePercentage(
      req.tenantId!,
      req.branchId!,
      studentId,
      new Date(startDate as string),
      new Date(endDate as string)
    );
    res.json({ success: true, data: result });
  }

  async getLowAttendanceStudents(req: Request, res: Response) {
    const { threshold } = req.query;
    const result = await attendanceSettingsService.getLowAttendanceStudents(
      req.tenantId!,
      req.branchId!,
      threshold ? Number(threshold) : undefined
    );
    res.json({ success: true, data: result });
  }
}

export const attendanceSettingsController = new AttendanceSettingsController();

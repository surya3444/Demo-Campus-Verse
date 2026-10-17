import { Request, Response, NextFunction } from 'express';
import { ObjectId } from 'mongodb';
import { payrollService } from './payroll.service';
import { success, created } from '../../utils/response';
import { collections } from '../../config/database';

class PayrollController {
  // ============ Salary Structures ============

  async getSalaryStructures(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await payrollService.getSalaryStructures(
        req.tenantId!,
        req.branchId!,
        req.query as Record<string, unknown>
      );
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getSalaryStructureById(req: Request, res: Response, next: NextFunction) {
    try {
      const structure = await payrollService.getSalaryStructureById(
        req.tenantId!,
        req.params.id as string
      );
      success(res, structure);
    } catch (error) {
      next(error);
    }
  }

  async suggestSalaryStructures(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await payrollService.suggestSalaryStructures(
        req.tenantId!,
        req.branchId!,
        req.params.staffId as string
      );
      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async createSalaryStructure(req: Request, res: Response, next: NextFunction) {
    try {
      const structure = await payrollService.createSalaryStructure(
        req.tenantId!,
        req.branchId!,
        req.body,
        req.user!.userId
      );
      created(res, structure, 'Salary structure created successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateSalaryStructure(req: Request, res: Response, next: NextFunction) {
    try {
      const structure = await payrollService.updateSalaryStructure(
        req.tenantId!,
        req.params.id as string,
        req.body
      );
      success(res, structure);
    } catch (error) {
      next(error);
    }
  }

  async deleteSalaryStructure(req: Request, res: Response, next: NextFunction) {
    try {
      const structure = await payrollService.deleteSalaryStructure(
        req.tenantId!,
        req.params.id as string
      );
      success(res, structure);
    } catch (error) {
      next(error);
    }
  }

  // ============ Salary Assignments ============

  async getSalaryAssignments(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await payrollService.getSalaryAssignments(
        req.tenantId!,
        req.branchId!,
        req.query as Record<string, unknown>
      );
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getStaffSalaryAssignment(req: Request, res: Response, next: NextFunction) {
    try {
      const assignment = await payrollService.getStaffSalaryAssignment(
        req.tenantId!,
        req.params.staffId as string
      );
      success(res, assignment);
    } catch (error) {
      next(error);
    }
  }

  async assignSalary(req: Request, res: Response, next: NextFunction) {
    try {
      const assignment = await payrollService.assignSalary(
        req.tenantId!,
        req.branchId!,
        req.body,
        req.user!.userId
      );
      created(res, assignment, 'Salary assigned successfully');
    } catch (error) {
      next(error);
    }
  }

  async reviseSalary(req: Request, res: Response, next: NextFunction) {
    try {
      const assignment = await payrollService.reviseSalary(
        req.tenantId!,
        req.params.id as string,
        req.body,
        req.user!.userId
      );
      created(res, assignment, 'Salary revised successfully');
    } catch (error) {
      next(error);
    }
  }

  async addCustomDeduction(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await payrollService.addCustomDeduction(
        req.tenantId!,
        req.params.id as string,
        req.body
      );
      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async updateCustomDeduction(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await payrollService.updateCustomDeduction(
        req.tenantId!,
        req.params.id as string,
        req.params.code as string,
        req.body
      );
      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  // ============ Payroll Runs ============

  async getPayrollRuns(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await payrollService.getPayrollRuns(
        req.tenantId!,
        req.branchId!,
        req.query as Record<string, unknown>
      );
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getPayrollRunById(req: Request, res: Response, next: NextFunction) {
    try {
      const run = await payrollService.getPayrollRunById(req.tenantId!, req.params.id as string);
      success(res, run);
    } catch (error) {
      next(error);
    }
  }

  async processPayroll(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await payrollService.processPayroll(
        req.tenantId!,
        req.branchId!,
        req.body,
        req.user!.userId
      );
      created(res, result, 'Payroll processed successfully');
    } catch (error) {
      next(error);
    }
  }

  async finalizePayroll(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await payrollService.finalizePayroll(
        req.tenantId!,
        req.params.id as string,
        req.user!.userId
      );
      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async cancelPayroll(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await payrollService.cancelPayroll(
        req.tenantId!,
        req.params.id as string,
        req.user!.userId
      );
      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  // ============ Payslips ============

  async getRunBreakdown(req: Request, res: Response, next: NextFunction) {
    try {
      success(
        res,
        await payrollService.getRunBreakdown(req.tenantId!, req.branchId!, req.params.id as string)
      );
    } catch (error) {
      next(error);
    }
  }

  async getPayslips(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await payrollService.getPayslips(
        req.tenantId!,
        req.branchId!,
        req.query as Record<string, unknown>
      );
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getMyPayslips(req: Request, res: Response, next: NextFunction) {
    try {
      // Find staff record linked to the current user
      const staff = await collections.staff.findOne({
        tenantId: new ObjectId(req.tenantId!),
        userId: new ObjectId(req.user!.userId),
        status: { $ne: 'terminated' },
      });

      if (!staff) {
        return res.status(400).json({
          success: false,
          error: { code: 'NOT_STAFF', message: 'No staff record linked to your account' },
        });
      }

      const result = await payrollService.getMyPayslips(
        req.tenantId!,
        staff._id.toString(),
        req.query as Record<string, unknown>
      );
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getPayslipById(req: Request, res: Response, next: NextFunction) {
    try {
      const payslip = await payrollService.getPayslipById(req.tenantId!, req.params.id as string);

      // If user only has view-own, check they own this payslip
      const userPermissions = req.user?.permissions || {};
      const payslipPerms = userPermissions['hr.payslips'] || [];
      const canViewAll = payslipPerms.includes('view');

      if (!canViewAll) {
        const staff = await collections.staff.findOne({
          tenantId: new ObjectId(req.tenantId!),
          userId: new ObjectId(req.user!.userId),
        });
        const staffId = staff?._id?.toString();

        if (!staffId || payslip.staffId.toString() !== staffId) {
          return res.status(403).json({
            success: false,
            error: { code: 'FORBIDDEN', message: 'You can only view your own payslips' },
          });
        }
      }

      success(res, payslip);
    } catch (error) {
      next(error);
    }
  }

  async updateDisbursement(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await payrollService.updateDisbursement(
        req.tenantId!,
        req.params.id as string,
        req.body,
        req.user!.userId
      );
      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async markRunPaid(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await payrollService.markRunPaid(
        req.tenantId!,
        req.branchId!,
        req.params.id as string,
        req.body,
        req.user!.userId
      );
      success(res, result, undefined, `${result.paid} salaries recorded as paid`);
    } catch (error) {
      next(error);
    }
  }

  async bulkUpdateDisbursement(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await payrollService.bulkUpdateDisbursement(
        req.tenantId!,
        req.body,
        req.user!.userId
      );
      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  // ============ Payroll Settings ============

  async getPayrollSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await payrollService.getPayrollSettings(req.tenantId!, req.branchId!);
      success(res, settings);
    } catch (error) {
      next(error);
    }
  }

  async updatePayrollSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await payrollService.updatePayrollSettings(
        req.tenantId!,
        req.branchId!,
        req.body
      );
      success(res, settings);
    } catch (error) {
      next(error);
    }
  }
}

export const payrollController = new PayrollController();

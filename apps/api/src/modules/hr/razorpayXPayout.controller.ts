import { Request, Response, NextFunction } from 'express';
import { ObjectId } from 'mongodb';
import { collections } from '../../config/database';
import { razorpayXPayoutService, OnboardXInput } from './razorpayXPayout.service';
import { ApiError } from '../../middleware/errorHandler';
import type { PayoutMode } from '../../services/razorpayX.service';

const VALID_MODES: PayoutMode[] = ['IMPS', 'NEFT', 'RTGS', 'UPI'];

class RazorpayXPayoutController {
  async getSettings(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) throw new ApiError('BRANCH_REQUIRED', 'Branch ID is required', 400);
      const data = await razorpayXPayoutService.getSettings(req.tenantId!, req.branchId);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  }

  async connect(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) throw new ApiError('BRANCH_REQUIRED', 'Branch ID is required', 400);
      const b = req.body as Partial<OnboardXInput>;
      if (!b?.keyId || !b.keySecret || !b.sourceAccountNumber || !b.webhookSecret) {
        throw new ApiError(
          'INVALID_INPUT',
          'keyId, keySecret, sourceAccountNumber and webhookSecret are required.',
          400
        );
      }
      const data = await razorpayXPayoutService.connect(
        req.tenantId!,
        req.branchId,
        b as OnboardXInput
      );
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  }

  async verify(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) throw new ApiError('BRANCH_REQUIRED', 'Branch ID is required', 400);
      const data = await razorpayXPayoutService.verify(req.tenantId!, req.branchId);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  }

  async disconnect(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) throw new ApiError('BRANCH_REQUIRED', 'Branch ID is required', 400);
      await razorpayXPayoutService.disconnect(req.tenantId!, req.branchId);
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  }

  async getBalance(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) throw new ApiError('BRANCH_REQUIRED', 'Branch ID is required', 400);
      const balancePaise = await razorpayXPayoutService.getBalance(req.tenantId!, req.branchId);
      res.json({ success: true, data: { balancePaise } });
    } catch (e) {
      next(e);
    }
  }

  async syncStaff(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) throw new ApiError('BRANCH_REQUIRED', 'Branch ID is required', 400);
      const staffId = req.params.id as string;
      if (!staffId) throw new ApiError('INVALID_INPUT', 'Staff id is required', 400);
      await razorpayXPayoutService.syncStaff(req.tenantId!, req.branchId, staffId);
      res.json({ success: true, data: { ok: true } });
    } catch (e) {
      next(e);
    }
  }

  async getRunPaySummary(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) throw new ApiError('BRANCH_REQUIRED', 'Branch ID is required', 400);
      const runId = req.params.id as string;
      const data = await razorpayXPayoutService.getRunPaySummary(
        req.tenantId!,
        req.branchId,
        runId
      );
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  }

  async payRun(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) throw new ApiError('BRANCH_REQUIRED', 'Branch ID is required', 400);
      const runId = req.params.id as string;
      const b = req.body as {
        mode?: string;
        staffIds?: string[];
        queueIfLowBalance?: boolean;
      };
      const mode: PayoutMode = VALID_MODES.includes(b.mode as PayoutMode)
        ? (b.mode as PayoutMode)
        : 'IMPS';
      const data = await razorpayXPayoutService.payRun(req.tenantId!, req.branchId, runId, {
        mode,
        staffIds: b.staffIds,
        paidBy: req.user!.userId,
        queueIfLowBalance: b.queueIfLowBalance,
      });
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  }

  async payPayslip(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) throw new ApiError('BRANCH_REQUIRED', 'Branch ID is required', 400);
      const payslipId = req.params.id as string;
      // Reuse payRun's logic by scoping to one payslip via staffIds — we
      // load the payslip once here just to derive the runId + staffId.
      const payslip = (await collections.payslips.findOne({
        _id: new ObjectId(payslipId),
        tenantId: new ObjectId(req.tenantId!),
        branchId: new ObjectId(req.branchId),
      })) as { payrollRunId: ObjectId; staffId: ObjectId } | null;
      if (!payslip) throw new ApiError('PAYSLIP_NOT_FOUND', 'Payslip not found', 404);
      const b = req.body as { mode?: string; queueIfLowBalance?: boolean };
      const mode: PayoutMode = VALID_MODES.includes(b.mode as PayoutMode)
        ? (b.mode as PayoutMode)
        : 'IMPS';
      const data = await razorpayXPayoutService.payRun(
        req.tenantId!,
        req.branchId,
        payslip.payrollRunId.toString(),
        {
          mode,
          staffIds: [payslip.staffId.toString()],
          paidBy: req.user!.userId,
          queueIfLowBalance: b.queueIfLowBalance,
        }
      );
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  }

  async refreshPayout(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) throw new ApiError('BRANCH_REQUIRED', 'Branch ID is required', 400);
      const payslipId = req.params.id as string;
      const data = await razorpayXPayoutService.refreshPayoutStatus(
        req.tenantId!,
        req.branchId,
        payslipId
      );
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  }
}

export const razorpayXPayoutController = new RazorpayXPayoutController();

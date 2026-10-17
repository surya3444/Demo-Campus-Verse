import { Request, Response, NextFunction } from 'express';
import { razorpayRouteService, OnboardRazorpayRouteInput } from './razorpayRoute.service';
import { ApiError } from '../../middleware/errorHandler';

class RazorpayRouteController {
  /**
   * GET /finance/settings/razorpay-route
   */
  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId } = req;
      if (!branchId) throw new ApiError('BRANCH_REQUIRED', 'Branch ID is required', 400);
      const status = await razorpayRouteService.getStatus(tenantId!, branchId);
      // We never leak the raw bank account from this endpoint either —
      // financeSettings.formatSettings masks it via the main /settings endpoint
      // and we mirror the masking here so callers get a single shape.
      if (!status) {
        res.json({ success: true, data: null });
        return;
      }
      const maskAccount = (s: string) =>
        s && s.length > 4 ? `${'*'.repeat(s.length - 4)}${s.slice(-4)}` : s;
      const maskPan = (s: string) =>
        s && s.length >= 5 ? `${s.slice(0, 2)}${'*'.repeat(s.length - 3)}${s.slice(-1)}` : s;
      res.json({
        success: true,
        data: {
          ...status,
          legal: { ...status.legal, panNumber: maskPan(status.legal.panNumber) },
          bank: { ...status.bank, accountNumber: maskAccount(status.bank.accountNumber) },
        },
      });
    } catch (e) {
      next(e);
    }
  }

  /**
   * POST /finance/settings/razorpay-route/onboard
   */
  async onboard(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId } = req;
      if (!branchId) throw new ApiError('BRANCH_REQUIRED', 'Branch ID is required', 400);
      const body = req.body as Partial<OnboardRazorpayRouteInput>;
      // Lightweight validation — bare minimum so we don't waste a Razorpay
      // API call. Full validation lives on the Razorpay side anyway.
      if (
        !body?.legal?.entityName ||
        !body.legal.businessType ||
        !body.legal.panNumber ||
        !body.contact?.email ||
        !body.contact?.phone ||
        !body.address?.line1 ||
        !body.address.city ||
        !body.address.state ||
        !body.address.pincode ||
        !body.bank?.accountNumber ||
        !body.bank.ifsc ||
        !body.bank.beneficiaryName
      ) {
        throw new ApiError(
          'INVALID_INPUT',
          'All legal, contact, address and bank fields are required.',
          400
        );
      }
      const route = await razorpayRouteService.onboard(
        tenantId!,
        branchId,
        body as OnboardRazorpayRouteInput
      );
      res.json({ success: true, data: route });
    } catch (e) {
      next(e);
    }
  }

  /**
   * POST /finance/settings/razorpay-route/refresh
   */
  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId } = req;
      if (!branchId) throw new ApiError('BRANCH_REQUIRED', 'Branch ID is required', 400);
      const route = await razorpayRouteService.refresh(tenantId!, branchId);
      res.json({ success: true, data: route });
    } catch (e) {
      next(e);
    }
  }

  /**
   * DELETE /finance/settings/razorpay-route — local disconnect (Razorpay
   * doesn't permit deleting a linked account; we just stop routing to it).
   */
  async disconnect(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId } = req;
      if (!branchId) throw new ApiError('BRANCH_REQUIRED', 'Branch ID is required', 400);
      await razorpayRouteService.disconnect(tenantId!, branchId);
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  }
}

export const razorpayRouteController = new RazorpayRouteController();

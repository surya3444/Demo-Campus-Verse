import { Request, Response, NextFunction } from 'express';
import { financeSettingsService } from './financeSettings.service';

class FinanceSettingsController {
  async getSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await financeSettingsService.getSettings(req.tenantId!, req.branchId!);
      res.json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  }

  async updateSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await financeSettingsService.updateSettings(
        req.tenantId!,
        req.branchId!,
        req.body,
        req.user!.userId
      );
      res.json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  }

  // Bank Accounts
  async addBankAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await financeSettingsService.addBankAccount(
        req.tenantId!,
        req.branchId!,
        req.body,
        req.user!.userId
      );
      res.json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  }

  async updateBankAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const accountId = req.params.accountId as string;
      const settings = await financeSettingsService.updateBankAccount(
        req.tenantId!,
        req.branchId!,
        accountId,
        req.body,
        req.user!.userId
      );
      res.json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  }

  async deleteBankAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const accountId = req.params.accountId as string;
      const settings = await financeSettingsService.deleteBankAccount(
        req.tenantId!,
        req.branchId!,
        accountId,
        req.user!.userId
      );
      res.json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  }

  // Payment Methods
  async updatePaymentMethod(req: Request, res: Response, next: NextFunction) {
    try {
      const code = req.params.code as string;
      const settings = await financeSettingsService.updatePaymentMethod(
        req.tenantId!,
        req.branchId!,
        code,
        req.body,
        req.user!.userId
      );
      res.json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  }

  // Wallet Categories
  async addWalletCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await financeSettingsService.addWalletCategory(
        req.tenantId!,
        req.branchId!,
        req.body,
        req.user!.userId
      );
      res.json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  }

  // Mandatory Fields
  async updateMandatoryFields(req: Request, res: Response, next: NextFunction) {
    try {
      const methodCode = req.params.methodCode as string;
      const settings = await financeSettingsService.updateMandatoryFields(
        req.tenantId!,
        req.branchId!,
        methodCode,
        req.body.fields,
        req.user!.userId
      );
      res.json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  }

  // Application Fee Settings
  async updateApplicationFeeSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await financeSettingsService.updateApplicationFeeSettings(
        req.tenantId!,
        req.branchId!,
        req.body,
        req.user!.userId
      );
      res.json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  }

  // Wallet Sequence Settings
  async updateWalletSequenceSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await financeSettingsService.updateWalletSequenceSettings(
        req.tenantId!,
        req.branchId!,
        req.body,
        req.user!.userId
      );
      res.json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  }
}

export const financeSettingsController = new FinanceSettingsController();

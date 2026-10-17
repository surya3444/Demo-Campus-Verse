import { Request, Response, NextFunction } from 'express';
import { offerService } from './offer.service';
import { success, created } from '../../../utils/response';

class OfferController {
  async createOffer(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await offerService.createOffer(
        req.tenantId!,
        req.branchId!,
        req.user!.userId,
        req.body
      );
      created(res, data, 'Offer created successfully');
    } catch (error) {
      next(error);
    }
  }

  async getOffersByDrive(req: Request, res: Response, next: NextFunction) {
    try {
      const driveId = req.params.driveId as string;
      const data = await offerService.getOffersByDrive(req.tenantId!, driveId);
      success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async respondToOffer(req: Request, res: Response, next: NextFunction) {
    try {
      const offerId = req.params.offerId as string;
      const data = await offerService.respondToOffer(
        req.tenantId!,
        offerId,
        req.user!.userId,
        req.body.status
      );
      success(res, data, undefined, 'Offer response recorded successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const offerController = new OfferController();

import { Request, Response, NextFunction } from 'express';
import { visitorPassService } from './visitorPass.service';
import { success, created } from '../../utils/response';

class VisitorPassController {
  async generate(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await visitorPassService.generatePass(
        req.tenantId!,
        req.params.id as string,
        req.user!.userId,
        req.body.validityHours
      );
      created(res, result, 'Visitor pass generated successfully');
    } catch (error) {
      next(error);
    }
  }

  async revoke(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await visitorPassService.revokePass(
        req.tenantId!,
        req.params.id as string,
        req.user!.userId
      );
      success(res, result, undefined, 'Visitor pass revoked successfully');
    } catch (error) {
      next(error);
    }
  }

  async verify(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await visitorPassService.verifyPass(
        req.tenantId!,
        req.params.passCode as string
      );
      success(res, result);
    } catch (error) {
      next(error);
    }
  }
}

export const visitorPassController = new VisitorPassController();

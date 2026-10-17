import { Request, Response, NextFunction } from 'express';
import { obeSurveyService } from './survey.service';
import { success } from '../../utils/response';

function userOf(req: Request) {
  return { userId: req.user!.userId, roleLevel: req.user!.roleLevel };
}

class ObeSurveyController {
  async open(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await obeSurveyService.setState(
        req.tenantId!,
        req.branchId!,
        req.params.id as string,
        'open',
        userOf(req)
      );
      success(res, result, undefined, 'Survey opened');
    } catch (error) {
      next(error);
    }
  }

  async close(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await obeSurveyService.setState(
        req.tenantId!,
        req.branchId!,
        req.params.id as string,
        'closed',
        userOf(req)
      );
      success(res, result, undefined, 'Survey closed');
    } catch (error) {
      next(error);
    }
  }

  async results(req: Request, res: Response, next: NextFunction) {
    try {
      const results = await obeSurveyService.results(
        req.tenantId!,
        req.branchId!,
        req.params.id as string
      );
      success(res, results);
    } catch (error) {
      next(error);
    }
  }

  async findMine(req: Request, res: Response, next: NextFunction) {
    try {
      const surveys = await obeSurveyService.findMine(
        req.tenantId!,
        req.branchId!,
        req.user!.userId
      );
      success(res, surveys);
    } catch (error) {
      next(error);
    }
  }

  async respond(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await obeSurveyService.respond(
        req.tenantId!,
        req.branchId!,
        req.params.offeringId as string,
        req.user!.userId,
        req.body
      );
      success(res, result, undefined, 'Thanks — your feedback was recorded');
    } catch (error) {
      next(error);
    }
  }
}

export const obeSurveyController = new ObeSurveyController();

import { Request, Response, NextFunction } from 'express';
import { obeOfferingService } from './offering.service';
import { success, created } from '../../utils/response';
import { getScopedSectionIds } from '../../middleware/scope';
import { ApiError } from '../../middleware/errorHandler';

function userOf(req: Request) {
  return { userId: req.user!.userId, roleLevel: req.user!.roleLevel };
}

class ObeOfferingController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const offering = await obeOfferingService.create(
        req.tenantId!,
        req.branchId!,
        req.body,
        req.user!.userId
      );
      created(res, offering, 'Offering created');
    } catch (error) {
      next(error);
    }
  }

  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { offerings, meta } = await obeOfferingService.findAll(
        req.tenantId!,
        req.branchId!,
        req.query as never,
        userOf(req),
        await getScopedSectionIds(req)
      );
      success(res, offerings, meta);
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const offering = await obeOfferingService.findById(
        req.tenantId!,
        req.branchId!,
        req.params.id as string
      );
      success(res, offering);
    } catch (error) {
      next(error);
    }
  }

  async getCohort(req: Request, res: Response, next: NextFunction) {
    try {
      const cohort = await obeOfferingService.getCohort(
        req.tenantId!,
        req.branchId!,
        req.params.id as string
      );
      success(res, cohort);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const offering = await obeOfferingService.update(
        req.tenantId!,
        req.branchId!,
        req.params.id as string,
        req.body,
        userOf(req)
      );
      success(res, offering, undefined, 'Offering updated');
    } catch (error) {
      next(error);
    }
  }

  async setStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const offering = await obeOfferingService.setStatus(
        req.tenantId!,
        req.branchId!,
        req.params.id as string,
        req.body.status,
        userOf(req)
      );
      success(res, offering, undefined, 'Offering status updated');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await obeOfferingService.delete(req.tenantId!, req.branchId!, req.params.id as string);
      success(res, null, undefined, 'Offering deleted');
    } catch (error) {
      next(error);
    }
  }

  async addInstrument(req: Request, res: Response, next: NextFunction) {
    try {
      const instrument = await obeOfferingService.addInstrument(
        req.tenantId!,
        req.branchId!,
        req.params.id as string,
        req.body,
        userOf(req)
      );
      created(res, instrument, 'Instrument added');
    } catch (error) {
      next(error);
    }
  }

  async updateInstrument(req: Request, res: Response, next: NextFunction) {
    try {
      const instrument = await obeOfferingService.updateInstrument(
        req.tenantId!,
        req.branchId!,
        req.params.id as string,
        req.params.instrumentId as string,
        req.body,
        userOf(req)
      );
      success(res, instrument, undefined, 'Instrument updated');
    } catch (error) {
      next(error);
    }
  }

  async deleteInstrument(req: Request, res: Response, next: NextFunction) {
    try {
      await obeOfferingService.deleteInstrument(
        req.tenantId!,
        req.branchId!,
        req.params.id as string,
        req.params.instrumentId as string,
        userOf(req)
      );
      success(res, null, undefined, 'Instrument deleted');
    } catch (error) {
      next(error);
    }
  }

  async examLinkCandidates(req: Request, res: Response, next: NextFunction) {
    try {
      const { subjectId, academicBatchId, termId } = req.query as {
        subjectId?: string;
        academicBatchId?: string;
        termId?: string;
      };
      if (!subjectId) throw new ApiError('MISSING_PARAMS', 'subjectId is required', 400);
      const candidates = await obeOfferingService.examLinkCandidates(req.tenantId!, req.branchId!, {
        subjectId,
        academicBatchId,
        termId,
      });
      success(res, candidates);
    } catch (error) {
      next(error);
    }
  }
}

export const obeOfferingController = new ObeOfferingController();

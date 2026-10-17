import { Request, Response, NextFunction } from 'express';
import { obeMarksService } from './marks.service';
import { success } from '../../utils/response';

class ObeMarksController {
  async getGrid(req: Request, res: Response, next: NextFunction) {
    try {
      const grid = await obeMarksService.getGrid(
        req.tenantId!,
        req.branchId!,
        req.params.id as string,
        req.params.instrumentId as string
      );
      success(res, grid);
    } catch (error) {
      next(error);
    }
  }

  async bulkUpsert(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await obeMarksService.bulkUpsert(
        req.tenantId!,
        req.branchId!,
        req.params.id as string,
        req.params.instrumentId as string,
        req.body,
        { userId: req.user!.userId, roleLevel: req.user!.roleLevel }
      );
      success(res, result, undefined, `Saved marks for ${result.saved} student(s)`);
    } catch (error) {
      next(error);
    }
  }

  async importCsv(req: Request, res: Response, next: NextFunction) {
    try {
      const commit = req.query.commit === 'true';
      const result = await obeMarksService.importCsv(
        req.tenantId!,
        req.branchId!,
        req.params.id as string,
        req.params.instrumentId as string,
        req.body.csv,
        commit,
        { userId: req.user!.userId, roleLevel: req.user!.roleLevel }
      );
      success(
        res,
        result,
        undefined,
        commit ? `Imported marks for ${result.valid} student(s)` : undefined
      );
    } catch (error) {
      next(error);
    }
  }
}

export const obeMarksController = new ObeMarksController();

import { Request, Response, NextFunction } from 'express';
import { obeProgramService } from './program.service';
import { success, created } from '../../utils/response';
import { getScopedDepartmentIds } from '../../middleware/scope';

class ObeProgramController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const program = await obeProgramService.create(
        req.tenantId!,
        req.branchId!,
        req.body,
        req.user!.userId
      );
      created(res, program, 'Program created');
    } catch (error) {
      next(error);
    }
  }

  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      const programs = await obeProgramService.findAll(
        req.tenantId!,
        req.branchId!,
        await getScopedDepartmentIds(req)
      );
      success(res, programs);
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const program = await obeProgramService.findById(
        req.tenantId!,
        req.branchId!,
        req.params.id as string
      );
      success(res, program);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const program = await obeProgramService.update(
        req.tenantId!,
        req.branchId!,
        req.params.id as string,
        req.body
      );
      success(res, program, undefined, 'Program updated');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await obeProgramService.delete(req.tenantId!, req.branchId!, req.params.id as string);
      success(res, null, undefined, 'Program deleted');
    } catch (error) {
      next(error);
    }
  }

  async updateCorrectiveActions(req: Request, res: Response, next: NextFunction) {
    try {
      const program = await obeProgramService.updateCorrectiveActions(
        req.tenantId!,
        req.branchId!,
        req.params.id as string,
        req.body.academicBatchId,
        req.body.actions
      );
      success(res, program, undefined, 'Corrective actions saved');
    } catch (error) {
      next(error);
    }
  }
}

export const obeProgramController = new ObeProgramController();

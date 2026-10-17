import { assertStructureWriteInScope } from '../../middleware/scope';
import { getScopedProgramIds } from '../../middleware/scope';
import { Request, Response, NextFunction } from 'express';
import { programService } from './program.service';
import { success, created } from '../../utils/response';

class ProgramController {
  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      const programs = await programService.findAll(req.tenantId!, req.branchId!, {
        departmentId: req.query.departmentId as string | undefined,
        status: req.query.status as 'active' | 'archived' | undefined,
        search: req.query.search as string | undefined,
      });
      const scoped = await getScopedProgramIds(req);
      const allowed = scoped && new Set(scoped.map(String));
      success(
        res,
        allowed
          ? (programs as Array<{ _id: unknown }>).filter((p) => allowed.has(String(p._id)))
          : programs
      );
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const program = await programService.findById(req.tenantId!, req.params.id as string);
      success(res, program);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      await assertStructureWriteInScope(req, {
        departmentId: req.body.departmentId,
        institutionId: req.body.institutionId,
      });
      const program = await programService.create(
        req.tenantId!,
        req.branchId!,
        req.body,
        req.user?.userId
      );
      created(res, program, 'Program created successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const program = await programService.update(req.tenantId!, req.params.id as string, req.body);
      success(res, program, undefined, 'Program updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await programService.delete(req.tenantId!, req.params.id as string);
      success(res, result, undefined, 'Program deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const programController = new ProgramController();

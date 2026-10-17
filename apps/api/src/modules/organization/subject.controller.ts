import { Request, Response, NextFunction } from 'express';
import { subjectService, SubjectListParams } from './subject.service';
import { ObjectId } from 'mongodb';
import { success, created } from '../../utils/response';
import { collections } from '../../config/database';
import { assertStructureWriteInScope } from '../../middleware/scope';

/**
 * A department-scoped admin (an HOD) may only write subjects their own
 * department owns; campus-wide subjects (no owner) stay with campus admins.
 * Campus-wide roles pass straight through.
 */
async function assertSubjectInScope(req: Request, ownerDepartmentId?: string | null) {
  await assertStructureWriteInScope(
    req,
    ownerDepartmentId ? { departmentId: String(ownerDepartmentId) } : {}
  );
}
async function ownerOf(req: Request, subjectId: string) {
  const s = await collections.subjects.findOne(
    { _id: new ObjectId(subjectId), tenantId: new ObjectId(req.tenantId!) },
    { projection: { ownerDepartmentId: 1 } }
  );
  return s?.ownerDepartmentId ? String(s.ownerDepartmentId) : null;
}

class SubjectController {
  async usage(req: Request, res: Response, next: NextFunction) {
    try {
      success(res, await subjectService.usage(req.tenantId!, req.branchId!));
    } catch (error) {
      next(error);
    }
  }

  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      const params: SubjectListParams = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 100,
        branchId: req.branchId || (req.query.branchId as string),
        type: req.query.type as 'theory' | 'practical' | 'both',
        institutionType: req.query.institutionType as 'school' | 'college' | 'university',
        status: req.query.status as 'active' | 'inactive',
        search: req.query.search as string,
        usableByDepartmentId: req.query.usableByDepartmentId as string | undefined,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc',
      };

      const result = await subjectService.findAll(req.tenantId!, params);
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const subject = await subjectService.findById(req.tenantId!, req.params.id as string);
      success(res, subject);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      await assertSubjectInScope(req, req.body.ownerDepartmentId);
      const subject = await subjectService.create(
        req.tenantId!,
        req.branchId,
        req.body,
        req.user!.userId
      );
      created(res, subject, 'Subject created successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      await assertSubjectInScope(req, await ownerOf(req, req.params.id as string));
      if (req.body.ownerDepartmentId !== undefined) {
        await assertSubjectInScope(req, req.body.ownerDepartmentId);
      }
      const subject = await subjectService.update(req.tenantId!, req.params.id as string, req.body);
      success(res, subject, undefined, 'Subject updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await assertSubjectInScope(req, await ownerOf(req, req.params.id as string));
      await subjectService.delete(req.tenantId!, req.params.id as string);
      success(res, null, undefined, 'Subject deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const subjectController = new SubjectController();

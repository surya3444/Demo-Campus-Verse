import { Request, Response, NextFunction } from 'express';
import { marksService } from './marks.service';
import { success, created } from '../../utils/response';
import { ApiError } from '../../middleware/errorHandler';
import { ObjectId } from 'mongodb';
import { collections } from '../../config/database';
import { assertOnRoster } from '../registration/roster';
import { assertTeachesSubject, assertTeachingScope } from '../teaching/scope';

function requireContext(req: Request): { tenantId: string; branchId: string; userId: string } {
  if (!req.tenantId || !req.branchId || !req.user) {
    throw new ApiError('CONTEXT_MISSING', 'Tenant or branch context missing', 400);
  }
  return { tenantId: req.tenantId, branchId: req.branchId, userId: req.user.userId };
}

/**
 * Marks may only be written by someone who teaches the paper's subject in each
 * student's section, and only for students on that subject's roster.
 */
async function guardMarks(req: Request, examId: string, paperId: string, studentIds: string[]) {
  const { tenantId, branchId } = requireContext(req);
  if (!ObjectId.isValid(examId) || !ObjectId.isValid(paperId)) return; // service answers
  const exam = await collections.exams.findOne(
    { _id: new ObjectId(examId), tenantId: new ObjectId(tenantId) },
    { projection: { papers: 1 } }
  );
  const paper = ((exam?.papers ?? []) as Array<{ _id: ObjectId; subjectId: ObjectId }>).find(
    (p) => String(p._id) === paperId
  );
  if (!paper) return; // service answers with its own not-found error
  const students = await collections.students
    .find({
      tenantId: new ObjectId(tenantId),
      _id: { $in: studentIds.map((id) => new ObjectId(id)) },
    })
    .project({ 'currentEnrollment.sectionId': 1 })
    .toArray();
  if (students.length !== new Set(studentIds).size) {
    throw new ApiError('STUDENT_NOT_FOUND', 'One or more students were not found', 404);
  }
  const bySection = new Map<string, string[]>();
  for (const st of students) {
    const sec = String(st.currentEnrollment?.sectionId);
    bySection.set(sec, [...(bySection.get(sec) ?? []), String(st._id)]);
  }
  for (const [sectionId, ids] of bySection) {
    await assertTeachesSubject(req, sectionId, String(paper.subjectId));
    await assertOnRoster(tenantId, branchId, sectionId, String(paper.subjectId), ids);
  }
}

class MarksController {
  async upsert(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId, userId } = requireContext(req);
      await guardMarks(req, req.body.examId, req.body.paperId, [req.body.studentId]);
      const result = await marksService.upsert(tenantId, branchId, req.body, userId);
      created(res, result, 'Mark saved');
    } catch (error) {
      next(error);
    }
  }

  async bulkUpsert(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId, userId } = requireContext(req);
      await guardMarks(
        req,
        req.body.examId,
        req.body.paperId,
        (req.body.marks ?? []).map((m: { studentId: string }) => m.studentId)
      );
      const result = await marksService.bulkUpsert(tenantId, branchId, req.body, userId);
      success(res, result, undefined, 'Marks saved');
    } catch (error) {
      next(error);
    }
  }

  async listForPaperSection(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId } = requireContext(req);
      const { examId, paperId, sectionId } = req.query as Record<string, string>;
      if (!examId || !paperId || !sectionId) {
        throw new ApiError('INVALID_INPUT', 'examId, paperId, sectionId are required', 400);
      }
      await assertTeachingScope(req, sectionId);
      const rows = await marksService.listForPaperSection(tenantId, branchId, {
        examId,
        paperId,
        sectionId,
      });
      success(res, rows);
    } catch (error) {
      next(error);
    }
  }

  async listForStudent(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId } = requireContext(req);
      const studentId = req.params.studentId as string;
      const onlyPublished = req.query.onlyPublished === 'true';
      const rows = await marksService.listForStudent(tenantId, studentId, { onlyPublished });
      success(res, rows);
    } catch (error) {
      next(error);
    }
  }

  async sectionReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId } = requireContext(req);
      const { examId, sectionId } = req.query as Record<string, string>;
      if (!examId || !sectionId) {
        throw new ApiError('INVALID_INPUT', 'examId and sectionId are required', 400);
      }
      const rows = await marksService.sectionReport(tenantId, branchId, examId, sectionId);
      success(res, rows);
    } catch (error) {
      next(error);
    }
  }

  async publishResults(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId, userId } = requireContext(req);
      const { examId, paperId, studentIds } = req.body as {
        examId: string;
        paperId?: string;
        studentIds?: string[];
      };
      if (!examId) throw new ApiError('INVALID_INPUT', 'examId is required', 400);
      const result = await marksService.publishResults(tenantId, branchId, examId, userId, {
        paperId,
        studentIds,
      });
      success(res, result, undefined, 'Results published');
    } catch (error) {
      next(error);
    }
  }
}

export const marksController = new MarksController();

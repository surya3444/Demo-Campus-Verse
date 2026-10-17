import { Request, Response, NextFunction } from 'express';
import { ObjectId } from 'mongodb';
import { liveClassService } from './liveClass.service';
import { getStaffIdForUser } from './teaching.utils';
import { collections } from '../../config/database';
import { success, created, noContent } from '../../utils/response';

class LiveClassController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const isAdmin = (req.user!.roleLevel ?? 99) <= 3;
      // Admins may schedule on behalf of a teacher who has no associated user yet,
      // so we tolerate the staff lookup failing for them.
      const staffId = await getStaffIdForUser(req.tenantId!, req.user!.userId).catch(() => '');
      const lc = await liveClassService.create(
        req.tenantId!,
        req.branchId!,
        req.user!.userId,
        req.body,
        staffId,
        isAdmin
      );
      created(res, lc, 'Live class scheduled');
    } catch (err) {
      next(err);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const isAdmin = (req.user!.roleLevel ?? 99) <= 3;
      const isStudent = req.user!.roleCode === 'STUDENT';

      let sectionFilter = req.query.sectionId as string | undefined;
      let staffId: string | undefined;
      // Students are scoped to their own section; resolve their branch from the
      // student record so visibility doesn't depend on an X-Branch-Id header.
      let branchIdForQuery = req.branchId;
      const emptyMeta = { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false };

      if (isStudent) {
        const student = await collections.students.findOne({
          tenantId: new ObjectId(req.tenantId!),
          userId: new ObjectId(req.user!.userId),
          status: 'active',
        });
        // The student's CURRENT section lives on their active enrollment; the
        // top-level sectionId can be stale after a promotion/shuffle.
        const studentSectionId = ((student?.currentEnrollment as { sectionId?: ObjectId })
          ?.sectionId ?? (student?.sectionId as ObjectId | undefined)) as ObjectId | undefined;
        if (!student || !studentSectionId) {
          success(res, [], emptyMeta);
          return;
        }
        sectionFilter = studentSectionId.toString();
        branchIdForQuery = (student.branchId as ObjectId).toString();
      } else if (req.query.mine === 'true' || (!isAdmin && !req.query.staffId)) {
        try {
          staffId = await getStaffIdForUser(req.tenantId!, req.user!.userId);
        } catch {
          success(res, [], emptyMeta);
          return;
        }
      } else if (isAdmin && req.query.staffId) {
        staffId = req.query.staffId as string;
      }

      const result = await liveClassService.list(req.tenantId!, branchIdForQuery!, {
        sectionId: sectionFilter,
        classId: req.query.classId as string,
        status: req.query.status as string,
        dateFrom: req.query.dateFrom as string,
        dateTo: req.query.dateTo as string,
        staffId,
        search: req.query.search as string,
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as string,
      });
      success(res, result.data, result.meta);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const lc = await liveClassService.getById(req.tenantId!, id);
      success(res, lc);
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const isAdmin = (req.user!.roleLevel ?? 99) <= 3;
      const staffId = await getStaffIdForUser(req.tenantId!, req.user!.userId).catch(() => '');
      const lc = await liveClassService.update(req.tenantId!, id, req.body, staffId, isAdmin);
      success(res, lc, undefined, 'Live class updated');
    } catch (err) {
      next(err);
    }
  }

  async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const isAdmin = (req.user!.roleLevel ?? 99) <= 3;
      const staffId = await getStaffIdForUser(req.tenantId!, req.user!.userId).catch(() => '');
      await liveClassService.cancel(req.tenantId!, id, staffId, isAdmin);
      noContent(res);
    } catch (err) {
      next(err);
    }
  }

  async start(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const isAdmin = (req.user!.roleLevel ?? 99) <= 3;
      const staffId = await getStaffIdForUser(req.tenantId!, req.user!.userId).catch(() => '');
      const lc = await liveClassService.start(req.tenantId!, id, staffId, isAdmin);
      success(res, lc, undefined, 'Live class started');
    } catch (err) {
      next(err);
    }
  }

  async end(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const isAdmin = (req.user!.roleLevel ?? 99) <= 3;
      const staffId = await getStaffIdForUser(req.tenantId!, req.user!.userId).catch(() => '');
      const lc = await liveClassService.end(req.tenantId!, id, staffId, isAdmin);
      success(res, lc, undefined, 'Live class ended');
    } catch (err) {
      next(err);
    }
  }

  async join(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const isAdmin = (req.user!.roleLevel ?? 99) <= 3;
      const result = await liveClassService.join(req.tenantId!, req.user!.userId, id, isAdmin);
      success(res, result);
    } catch (err) {
      next(err);
    }
  }

  async listMessages(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const result = await liveClassService.listMessages(req.tenantId!, id, {
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      });
      success(res, result.data, result.meta);
    } catch (err) {
      next(err);
    }
  }

  async listPolls(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const polls = await liveClassService.listPolls(req.tenantId!, id);
      success(res, polls);
    } catch (err) {
      next(err);
    }
  }

  async listParticipants(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const ps = await liveClassService.listParticipants(req.tenantId!, id);
      success(res, ps);
    } catch (err) {
      next(err);
    }
  }

  async kick(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const isAdmin = (req.user!.roleLevel ?? 99) <= 3;
      const staffId = await getStaffIdForUser(req.tenantId!, req.user!.userId).catch(() => '');
      await liveClassService.kickParticipant(
        req.tenantId!,
        id,
        req.body.userId as string,
        staffId,
        isAdmin
      );
      noContent(res);
    } catch (err) {
      next(err);
    }
  }

  async muteAll(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const isAdmin = (req.user!.roleLevel ?? 99) <= 3;
      const staffId = await getStaffIdForUser(req.tenantId!, req.user!.userId).catch(() => '');
      const result = await liveClassService.muteAll(req.tenantId!, id, staffId, isAdmin);
      success(res, result, undefined, `Muted ${result.mutedCount} participants`);
    } catch (err) {
      next(err);
    }
  }

  async updateLiveSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const isAdmin = (req.user!.roleLevel ?? 99) <= 3;
      const staffId = await getStaffIdForUser(req.tenantId!, req.user!.userId).catch(() => '');
      const lc = await liveClassService.updateLiveSettings(
        req.tenantId!,
        id,
        req.body,
        staffId,
        isAdmin
      );
      success(res, lc, undefined, 'Settings updated');
    } catch (err) {
      next(err);
    }
  }

  async startRecording(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const isAdmin = (req.user!.roleLevel ?? 99) <= 3;
      const staffId = await getStaffIdForUser(req.tenantId!, req.user!.userId).catch(() => '');
      const result = await liveClassService.startRecording(req.tenantId!, id, staffId, isAdmin);
      success(res, result, undefined, 'Recording starting');
    } catch (err) {
      next(err);
    }
  }

  async stopRecording(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const isAdmin = (req.user!.roleLevel ?? 99) <= 3;
      const staffId = await getStaffIdForUser(req.tenantId!, req.user!.userId).catch(() => '');
      await liveClassService.stopRecording(req.tenantId!, id, staffId, isAdmin);
      noContent(res);
    } catch (err) {
      next(err);
    }
  }
}

export const liveClassController = new LiveClassController();

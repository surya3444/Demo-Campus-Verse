import { ObjectId } from 'mongodb';
import { STUDENT_ROLE_LEVEL } from '@campus-verse/shared/constants';
import { collections } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler';
import { hasPermission } from '../../middleware/rbac';
import { getElectiveSubjectIds } from './scope';
import { Request, Response, NextFunction } from 'express';
import { timetableService } from './timetable.service';
import { timetableAutoService } from './timetableAuto.service';
import { getStaffIdForUser } from './teaching.utils';
import { success, created } from '../../utils/response';

class TimetableController {
  // ============ Slots ============

  async createSlot(req: Request, res: Response, next: NextFunction) {
    try {
      const slot = await timetableService.createSlot(req.tenantId!, req.branchId!, req.body);
      created(res, slot, 'Timetable slot created successfully');
    } catch (error) {
      next(error);
    }
  }

  async getSlots(req: Request, res: Response, next: NextFunction) {
    try {
      const classId = req.query.classId as string | undefined;
      const slots = await timetableService.getSlots(req.tenantId!, req.branchId!, classId);
      success(res, slots);
    } catch (error) {
      next(error);
    }
  }

  async copySlots(req: Request, res: Response, next: NextFunction) {
    try {
      const { sourceClassId, targetClassId } = req.body;
      const slots = await timetableService.copySlots(
        req.tenantId!,
        req.branchId!,
        sourceClassId,
        targetClassId
      );
      created(res, slots, 'Slots copied successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateSlot(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const slot = await timetableService.updateSlot(req.tenantId!, id, req.body);
      success(res, slot, undefined, 'Timetable slot updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteSlot(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      await timetableService.deleteSlot(req.tenantId!, id);
      success(res, null, undefined, 'Timetable slot deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  // ============ Entries ============

  async createEntry(req: Request, res: Response, next: NextFunction) {
    try {
      const entries = await timetableService.createEntry(
        req.tenantId!,
        req.branchId!,
        req.body,
        req.user!.userId
      );
      created(res, entries, 'Timetable entries created successfully');
    } catch (error) {
      next(error);
    }
  }

  async bulkCreateEntries(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await timetableService.bulkCreateEntries(
        req.tenantId!,
        req.branchId!,
        req.body.entries,
        req.user!.userId
      );
      success(res, result, undefined, 'Bulk timetable entries processed');
    } catch (error) {
      next(error);
    }
  }

  async generate(req: Request, res: Response, next: NextFunction) {
    try {
      success(
        res,
        await timetableAutoService.generate(
          req.tenantId!,
          req.branchId!,
          req.user!.userId,
          req.body
        )
      );
    } catch (error) {
      next(error);
    }
  }

  async clearSection(req: Request, res: Response, next: NextFunction) {
    try {
      success(
        res,
        await timetableService.clearSectionTimetable(
          req.tenantId!,
          req.branchId!,
          req.params.sectionId as string
        ),
        undefined,
        'Timetable cleared'
      );
    } catch (error) {
      next(error);
    }
  }

  async getBusyTeachers(req: Request, res: Response, next: NextFunction) {
    try {
      const { slotId, dayOfWeek, excludeGroupId } = req.query as Record<string, string | undefined>;
      if (!slotId || dayOfWeek === undefined) {
        throw new ApiError('VALIDATION_ERROR', 'slotId and dayOfWeek are required', 400);
      }
      success(
        res,
        await timetableService.getBusyTeachers(
          req.tenantId!,
          slotId,
          Number(dayOfWeek),
          excludeGroupId
        )
      );
    } catch (error) {
      next(error);
    }
  }

  async getSectionTimetable(req: Request, res: Response, next: NextFunction) {
    try {
      const sectionId = req.params.sectionId as string;
      const entries = await timetableService.getSectionTimetable(
        req.tenantId!,
        req.branchId!,
        sectionId
      );
      if ((req.user!.roleLevel ?? 99) < STUDENT_ROLE_LEVEL) {
        success(res, entries);
        return;
      }
      // A student sees their own section, and of its parallel electives only
      // the ones they registered for.
      const user = await collections.users.findOne(
        { _id: new ObjectId(req.user!.userId), tenantId: new ObjectId(req.tenantId!) },
        { projection: { studentId: 1 } }
      );
      const student = user?.studentId
        ? await collections.students.findOne(
            { _id: user.studentId as ObjectId },
            { projection: { 'currentEnrollment.sectionId': 1, 'currentEnrollment.labBatchId': 1 } }
          )
        : null;
      if (String(student?.currentEnrollment?.sectionId) !== sectionId) {
        throw new ApiError('SECTION_ACCESS_DENIED', 'You can only view your own timetable', 403);
      }
      const [electives, registrations] = await Promise.all([
        getElectiveSubjectIds(req.tenantId!, req.branchId!),
        collections.courseRegistrations
          .find({
            tenantId: new ObjectId(req.tenantId!),
            studentId: student!._id,
            status: 'submitted',
          })
          .project({ entries: 1 })
          .toArray(),
      ]);
      const taken = new Set(
        registrations.flatMap((r) =>
          ((r.entries ?? []) as Array<{ subjectId: ObjectId }>).map((e) => String(e.subjectId))
        )
      );
      success(
        res,
        (
          entries as Array<{
            subjectId?: unknown;
            isMandatory?: boolean;
            studentIds?: unknown[];
            batchId?: unknown;
          }>
        ).filter((e) => {
          // Lab periods: only their own batch's (all of them until they're put in one).
          const myBatch = student?.currentEnrollment?.labBatchId;
          if (e.batchId && myBatch && String(e.batchId) !== String(myBatch)) return false;
          const subject = String(e.subjectId);
          if (electives.has(subject)) return taken.has(subject);
          if (e.isMandatory === false && e.studentIds?.length) {
            return e.studentIds.some((id) => String(id) === String(student!._id));
          }
          return true;
        })
      );
    } catch (error) {
      next(error);
    }
  }

  async getMyTimetable(req: Request, res: Response, next: NextFunction) {
    try {
      // Anyone sees their own week; HR and timetable managers may open
      // another staff member's (asking without the right is refused, rather
      // than quietly answered with your own).
      let staffId: string;
      if (req.query.staffId) {
        const own = await getStaffIdForUser(req.tenantId!, req.user!.userId).catch(() => null);
        const mayViewOthers =
          hasPermission(req.user, 'teaching.timetable', 'create') ||
          hasPermission(req.user, 'hr.staff', 'view');
        if (req.query.staffId !== own && !mayViewOthers) {
          throw new ApiError('FORBIDDEN', 'You can only see your own timetable', 403);
        }
        staffId = req.query.staffId as string;
      } else {
        staffId = await getStaffIdForUser(req.tenantId!, req.user!.userId);
      }

      const entries = await timetableService.getMyTimetable(req.tenantId!, req.branchId!, staffId);
      success(res, entries);
    } catch (error) {
      next(error);
    }
  }

  async updateEntry(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const entry = await timetableService.updateEntry(req.tenantId!, id, req.body);
      success(res, entry, undefined, 'Timetable entry updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const groupId = req.params.groupId as string;
      const entries = await timetableService.updateGroup(req.tenantId!, groupId, req.body);
      success(res, entries, undefined, 'Timetable group updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteEntry(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      await timetableService.deleteEntry(req.tenantId!, id);
      success(res, null, undefined, 'Timetable entry deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const groupId = req.params.groupId as string;
      const result = await timetableService.deleteGroup(req.tenantId!, groupId);
      success(res, result, undefined, 'Timetable group deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const timetableController = new TimetableController();

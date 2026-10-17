import { ObjectId, Filter, Document, WithId } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { intersectScope } from '../../middleware/scope';
import { getPagination, buildPaginationMeta } from '../../utils/pagination';

interface LessonPlanDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  teacherId: ObjectId;
  teacherName: string;
  sectionId: ObjectId;
  sectionName: string;
  subjectId: ObjectId;
  subjectName: string;
  slotId?: ObjectId | null;
  title: string;
  description?: string;
  objectives?: string[];
  topics?: string[];
  resources?: string[];
  methodology?: string;
  assessment?: string;
  date: Date;
  duration?: number;
  status: 'draft' | 'published' | 'completed';
  teachingStatus: 'not_started' | 'ongoing' | 'completed_with_assignment' | 'completed';
  linkedAssignmentId?: ObjectId;
  notes?: string;
  attachments?: string[];
  createdAt: Date;
  updatedAt: Date;
}

class LessonPlanService {
  async create(
    tenantId: string,
    branchId: string,
    data: {
      sectionId: string;
      subjectId: string;
      slotId?: string;
      title: string;
      description?: string;
      objectives?: string[];
      topics?: string[];
      resources?: string[];
      methodology?: string;
      assessment?: string;
      date: string;
      duration?: number;
      status?: string;
      notes?: string;
      attachments?: string[];
    },
    teacherId: string
  ) {
    const tenantObjId = new ObjectId(tenantId);

    // Look up teacher name
    const teacher = await collections.staff.findOne({
      _id: new ObjectId(teacherId),
      tenantId: tenantObjId,
    });
    const teacherName = teacher
      ? (teacher.displayName as string) || `${teacher.firstName} ${teacher.lastName}`
      : '';

    // Look up section name
    const section = await collections.sections.findOne({
      _id: new ObjectId(data.sectionId),
      tenantId: tenantObjId,
    });
    const sectionName = (section?.name as string) || '';

    // Look up subject name
    const subject = await collections.subjects.findOne({
      _id: new ObjectId(data.subjectId),
      tenantId: tenantObjId,
    });
    const subjectName = (subject?.name as string) || '';

    const planId = new ObjectId();
    const now = new Date();

    const plan: Omit<LessonPlanDocument, '_id'> & { _id: ObjectId } = {
      _id: planId,
      tenantId: tenantObjId,
      branchId: new ObjectId(branchId),
      teacherId: new ObjectId(teacherId),
      teacherName,
      sectionId: new ObjectId(data.sectionId),
      sectionName,
      subjectId: new ObjectId(data.subjectId),
      subjectName,
      slotId: data.slotId ? new ObjectId(data.slotId) : null,
      title: data.title,
      description: data.description,
      objectives: data.objectives,
      topics: data.topics,
      resources: data.resources,
      methodology: data.methodology,
      assessment: data.assessment,
      date: new Date(data.date),
      duration: data.duration,
      status: (data.status as LessonPlanDocument['status']) || 'draft',
      teachingStatus: 'not_started',
      notes: data.notes,
      attachments: data.attachments,
      createdAt: now,
      updatedAt: now,
    };

    await collections.lessonPlans.insertOne(plan);

    logger.info({ planId: planId.toString(), tenantId, teacherId }, 'Lesson plan created');

    return this.formatLessonPlan(plan as WithId<LessonPlanDocument>);
  }

  async findAll(
    tenantId: string,
    branchId: string,
    params: {
      sectionId?: string;
      /** Scope guard: section ids the caller is confined to (null = unrestricted). */
      restrictToSectionIds?: ObjectId[] | null;
      subjectId?: string;
      status?: string;
      teachingStatus?: string;
      dateFrom?: string;
      dateTo?: string;
      search?: string;
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: string;
    },
    staffId?: string
  ) {
    const { page, limit, sortBy, sortOrder } = getPagination(params as Record<string, unknown>);

    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    if (staffId) {
      filter.teacherId = new ObjectId(staffId);
    }

    const sectionFilter = intersectScope(params.restrictToSectionIds ?? null, params.sectionId);
    if (sectionFilter !== undefined) {
      filter.sectionId = sectionFilter;
    }

    if (params.subjectId) {
      filter.subjectId = new ObjectId(params.subjectId);
    }

    if (params.status) {
      filter.status = params.status;
    }

    if (params.teachingStatus) {
      filter.teachingStatus = params.teachingStatus;
    }

    if (params.dateFrom || params.dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (params.dateFrom) dateFilter.$gte = new Date(params.dateFrom);
      if (params.dateTo) dateFilter.$lte = new Date(params.dateTo);
      filter.date = dateFilter;
    }

    if (params.search) {
      filter.$or = [
        { title: { $regex: params.search, $options: 'i' } },
        { description: { $regex: params.search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const [plans, total] = await Promise.all([
      collections.lessonPlans
        .find(filter)
        .sort({ [sortBy]: sortDirection, _id: sortDirection })
        .skip(skip)
        .limit(limit)
        .toArray() as Promise<WithId<LessonPlanDocument>[]>,
      collections.lessonPlans.countDocuments(filter),
    ]);

    const meta = buildPaginationMeta(page, limit, total);

    return {
      data: plans.map((plan) => this.formatLessonPlan(plan)),
      meta,
    };
  }

  async findById(tenantId: string, id: string) {
    const plan = (await collections.lessonPlans.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    })) as WithId<LessonPlanDocument> | null;

    if (!plan) {
      throw new ApiError('LESSON_PLAN_NOT_FOUND', 'Lesson plan not found', 404);
    }

    const formatted = this.formatLessonPlan(plan);

    // Enrich with slot info
    if (plan.slotId) {
      const slot = await collections.timetableSlots.findOne({ _id: plan.slotId });
      if (slot) {
        (formatted as Record<string, unknown>).slotName = slot.name as string;
        (formatted as Record<string, unknown>).slotStartTime = slot.startTime as string;
        (formatted as Record<string, unknown>).slotEndTime = slot.endTime as string;
      }
    }

    return formatted;
  }

  async update(
    tenantId: string,
    id: string,
    data: {
      sectionId?: string;
      subjectId?: string;
      slotId?: string | null;
      title?: string;
      description?: string;
      objectives?: string[];
      topics?: string[];
      resources?: string[];
      methodology?: string;
      assessment?: string;
      date?: string;
      duration?: number;
      status?: string;
      notes?: string;
      attachments?: string[];
    },
    staffId: string,
    roleLevel: number
  ) {
    const tenantObjId = new ObjectId(tenantId);

    const existing = (await collections.lessonPlans.findOne({
      _id: new ObjectId(id),
      tenantId: tenantObjId,
    })) as WithId<LessonPlanDocument> | null;

    if (!existing) {
      throw new ApiError('LESSON_PLAN_NOT_FOUND', 'Lesson plan not found', 404);
    }

    // Ownership check: non-admins can only update their own lesson plans
    if (roleLevel > 3 && existing.teacherId.toString() !== staffId) {
      throw new ApiError('FORBIDDEN', 'You can only update your own lesson plans', 403);
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.objectives !== undefined) updateData.objectives = data.objectives;
    if (data.topics !== undefined) updateData.topics = data.topics;
    if (data.resources !== undefined) updateData.resources = data.resources;
    if (data.methodology !== undefined) updateData.methodology = data.methodology;
    if (data.assessment !== undefined) updateData.assessment = data.assessment;
    if (data.date !== undefined) updateData.date = new Date(data.date);
    if (data.duration !== undefined) updateData.duration = data.duration;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.attachments !== undefined) updateData.attachments = data.attachments;

    if (data.slotId === null) updateData.slotId = null;
    else if (data.slotId !== undefined) updateData.slotId = new ObjectId(data.slotId);

    if (data.sectionId !== undefined) {
      updateData.sectionId = new ObjectId(data.sectionId);
      const section = await collections.sections.findOne({
        _id: new ObjectId(data.sectionId),
        tenantId: tenantObjId,
      });
      updateData.sectionName = (section?.name as string) || '';
    }

    if (data.subjectId !== undefined) {
      updateData.subjectId = new ObjectId(data.subjectId);
      const subject = await collections.subjects.findOne({
        _id: new ObjectId(data.subjectId),
        tenantId: tenantObjId,
      });
      updateData.subjectName = (subject?.name as string) || '';
    }

    await collections.lessonPlans.updateOne(
      { _id: new ObjectId(id), tenantId: tenantObjId },
      { $set: updateData }
    );

    logger.info({ planId: id, tenantId }, 'Lesson plan updated');

    return this.findById(tenantId, id);
  }

  async delete(tenantId: string, id: string, staffId: string, roleLevel: number) {
    const existing = (await collections.lessonPlans.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    })) as WithId<LessonPlanDocument> | null;

    if (!existing) {
      throw new ApiError('LESSON_PLAN_NOT_FOUND', 'Lesson plan not found', 404);
    }

    // Ownership check: non-admins can only delete their own lesson plans
    if (roleLevel > 3 && existing.teacherId.toString() !== staffId) {
      throw new ApiError('FORBIDDEN', 'You can only delete your own lesson plans', 403);
    }

    await collections.lessonPlans.deleteOne({ _id: new ObjectId(id) });

    logger.info({ planId: id, tenantId }, 'Lesson plan deleted');

    return { success: true };
  }

  async updateTeachingStatus(
    tenantId: string,
    id: string,
    data: {
      teachingStatus:
        | 'not_started'
        | 'ongoing'
        | 'delivered'
        | 'questionnaire_sent'
        | 'all_submitted'
        | 'completed_with_assignment'
        | 'completed';
      linkedAssignmentId?: string;
    },
    staffId: string,
    roleLevel: number
  ) {
    const tenantObjId = new ObjectId(tenantId);

    const existing = (await collections.lessonPlans.findOne({
      _id: new ObjectId(id),
      tenantId: tenantObjId,
    })) as WithId<LessonPlanDocument> | null;

    if (!existing) {
      throw new ApiError('LESSON_PLAN_NOT_FOUND', 'Lesson plan not found', 404);
    }

    // Ownership check: non-admins can only update their own lesson plans
    if (roleLevel > 3 && existing.teacherId.toString() !== staffId) {
      throw new ApiError('FORBIDDEN', 'You can only update your own lesson plans', 403);
    }

    // Only published plans can have teaching status updated
    if (existing.status !== 'published') {
      throw new ApiError(
        'INVALID_STATUS',
        'Teaching status can only be set on published lesson plans',
        400
      );
    }

    // Validate transitions
    const currentStatus = existing.teachingStatus || 'not_started';
    const validTransitions: Record<string, string[]> = {
      not_started: ['ongoing'],
      ongoing: ['delivered', 'completed_with_assignment', 'completed'],
      delivered: ['questionnaire_sent', 'completed'],
      questionnaire_sent: ['all_submitted', 'completed'],
      all_submitted: ['completed'],
      completed_with_assignment: ['completed'],
      completed: [],
    };

    if (!validTransitions[currentStatus]?.includes(data.teachingStatus)) {
      throw new ApiError(
        'INVALID_TRANSITION',
        `Cannot transition from '${currentStatus}' to '${data.teachingStatus}'`,
        400
      );
    }

    const updateData: Record<string, unknown> = {
      teachingStatus: data.teachingStatus,
      updatedAt: new Date(),
    };

    if (data.teachingStatus === 'completed_with_assignment' && data.linkedAssignmentId) {
      updateData.linkedAssignmentId = new ObjectId(data.linkedAssignmentId);
    }

    await collections.lessonPlans.updateOne(
      { _id: new ObjectId(id), tenantId: tenantObjId },
      { $set: updateData }
    );

    logger.info(
      { planId: id, tenantId, teachingStatus: data.teachingStatus },
      'Lesson plan teaching status updated'
    );

    return this.findById(tenantId, id);
  }

  private formatLessonPlan(plan: WithId<LessonPlanDocument>) {
    return {
      _id: plan._id.toString(),
      tenantId: plan.tenantId.toString(),
      branchId: plan.branchId.toString(),
      teacherId: plan.teacherId.toString(),
      teacherName: plan.teacherName,
      sectionId: plan.sectionId.toString(),
      sectionName: plan.sectionName,
      subjectId: plan.subjectId.toString(),
      subjectName: plan.subjectName,
      slotId: plan.slotId?.toString() || null,
      title: plan.title,
      description: plan.description,
      objectives: plan.objectives,
      topics: plan.topics,
      resources: plan.resources,
      methodology: plan.methodology,
      assessment: plan.assessment,
      date: plan.date,
      duration: plan.duration,
      status: plan.status,
      teachingStatus: plan.teachingStatus || 'not_started',
      linkedAssignmentId: plan.linkedAssignmentId?.toString() || undefined,
      notes: plan.notes,
      attachments: plan.attachments,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };
  }
}

export const lessonPlanService = new LessonPlanService();

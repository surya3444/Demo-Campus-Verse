import { ObjectId, Filter, Document } from 'mongodb';
import { collections } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler';
import { getPagination, buildPaginationMeta } from '../../utils/pagination';
import { generateCourseNumber } from '../../utils/generators';

class CourseService {
  async list(
    tenantId: string,
    branchId: string,
    roleLevel: number,
    query: {
      search?: string;
      status?: string;
      category?: string;
      level?: string;
      visibility?: string;
      instructorId?: string;
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: string;
    }
  ) {
    const { page, limit, sortBy, sortOrder } = getPagination(query);
    const skip = (page - 1) * limit;

    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
    };

    // Org-level admins see all tenant courses; others see visibility-scoped
    if (roleLevel > 2) {
      const branchOid = new ObjectId(branchId);
      filter.$or = [
        { branchId: branchOid },
        { visibility: 'all' },
        { visibility: 'selected_branches', visibleBranchIds: branchOid },
      ];
    }

    if (query.search) {
      filter.title = { $regex: query.search, $options: 'i' };
    }
    if (query.status) filter.status = query.status;
    if (query.category) filter.category = query.category;
    if (query.level) filter.level = query.level;
    if (query.visibility) filter.visibility = query.visibility;
    if (query.instructorId) filter.instructorId = query.instructorId;

    const [data, total] = await Promise.all([
      collections.courses
        .find(filter)
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1, _id: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collections.courses.countDocuments(filter),
    ]);

    return {
      data: data.map(this.formatCourse),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async getById(tenantId: string, id: string) {
    const course = await collections.courses.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!course) {
      throw new ApiError('COURSE_NOT_FOUND', 'Course not found', 404);
    }

    return this.formatCourse(course);
  }

  async create(tenantId: string, branchId: string, userId: string, data: Record<string, unknown>) {
    const now = new Date();
    const courseNumber = await generateCourseNumber(tenantId, branchId);

    // Add ObjectId to each module
    const modules = ((data.modules as Array<Record<string, unknown>>) || []).map((m) => ({
      ...m,
      _id: new ObjectId(),
    }));

    const doc = {
      ...data,
      courseNumber,
      modules,
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      visibility: 'branch' as const,
      status: (data.status as string) || 'draft',
      createdBy: new ObjectId(userId),
      createdAt: now,
      updatedAt: now,
    };

    const result = await collections.courses.insertOne(doc);
    return this.getById(tenantId, result.insertedId.toString());
  }

  async update(
    tenantId: string,
    id: string,
    userId: string,
    roleLevel: number,
    branchId: string,
    data: Record<string, unknown>
  ) {
    const course = await collections.courses.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!course) {
      throw new ApiError('COURSE_NOT_FOUND', 'Course not found', 404);
    }

    // Ownership enforcement: non-admins can only edit their own courses
    if (roleLevel > 3 && course.createdBy.toString() !== userId) {
      throw new ApiError('PERMISSION_DENIED', 'You can only edit courses you created', 403);
    }

    // Branch admins (roleLevel <= 3) can edit courses in their branch
    if (roleLevel > 2 && roleLevel <= 3 && course.branchId.toString() !== branchId) {
      throw new ApiError('PERMISSION_DENIED', 'You can only edit courses in your branch', 403);
    }

    // If modules are being updated, add ObjectIds to new ones
    if (data.modules) {
      data.modules = ((data.modules as Array<Record<string, unknown>>) || []).map((m) => ({
        ...m,
        _id: m._id ? new ObjectId(m._id as string) : new ObjectId(),
      }));
    }

    await collections.courses.updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...data, updatedAt: new Date() } }
    );

    return this.getById(tenantId, id);
  }

  async delete(tenantId: string, id: string, userId: string, roleLevel: number, branchId: string) {
    const course = await collections.courses.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!course) {
      throw new ApiError('COURSE_NOT_FOUND', 'Course not found', 404);
    }

    // Ownership enforcement
    if (roleLevel > 3 && course.createdBy.toString() !== userId) {
      throw new ApiError('PERMISSION_DENIED', 'You can only delete courses you created', 403);
    }

    if (roleLevel > 2 && roleLevel <= 3 && course.branchId.toString() !== branchId) {
      throw new ApiError('PERMISSION_DENIED', 'You can only delete courses in your branch', 403);
    }

    // Cascade: remove every lesson and quiz that belongs to this course so we
    // don't leave orphan documents behind once the course is gone.
    const courseObjectId = new ObjectId(id);
    await collections.lessons.deleteMany({
      tenantId: new ObjectId(tenantId),
      courseId: courseObjectId,
    });
    await collections.quizzes.deleteMany({
      tenantId: new ObjectId(tenantId),
      courseId: courseObjectId,
    });

    await collections.courses.deleteOne({ _id: courseObjectId });
  }

  async updateVisibility(
    tenantId: string,
    id: string,
    userId: string,
    roleLevel: number,
    data: { visibility: string; branchIds?: string[] }
  ) {
    if (roleLevel > 2) {
      throw new ApiError(
        'PERMISSION_DENIED',
        'Only organization-level admins can manage course visibility',
        403
      );
    }

    const course = await collections.courses.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!course) {
      throw new ApiError('COURSE_NOT_FOUND', 'Course not found', 404);
    }

    const now = new Date();
    const update: Record<string, unknown> = {
      visibility: data.visibility,
      approvedBy: new ObjectId(userId),
      approvedAt: now,
      updatedAt: now,
    };

    if (data.visibility === 'selected_branches' && data.branchIds) {
      update.visibleBranchIds = data.branchIds.map((id) => new ObjectId(id));
    } else {
      update.visibleBranchIds = [];
    }

    await collections.courses.updateOne({ _id: new ObjectId(id) }, { $set: update });

    return this.getById(tenantId, id);
  }

  formatCourse(doc: Document) {
    return {
      ...doc,
      _id: doc._id.toString(),
      tenantId: doc.tenantId?.toString(),
      branchId: doc.branchId?.toString(),
      createdBy: doc.createdBy?.toString(),
      approvedBy: doc.approvedBy?.toString(),
      visibleBranchIds: (doc.visibleBranchIds || []).map((id: ObjectId) => id?.toString()),
      modules: (doc.modules || []).map((m: Record<string, unknown>) => ({
        ...m,
        _id: (m._id as ObjectId)?.toString(),
      })),
    };
  }
}

export const courseService = new CourseService();

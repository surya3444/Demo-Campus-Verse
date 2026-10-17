import { ObjectId, Filter, Document } from 'mongodb';
import { collections } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler';
import { getPagination, buildPaginationMeta } from '../../utils/pagination';

class LessonService {
  async list(
    tenantId: string,
    courseId: string,
    query: { moduleId?: string; page?: number; limit?: number; sortBy?: string; sortOrder?: string }
  ) {
    const { page, limit, sortBy, sortOrder } = getPagination({
      ...query,
      sortBy: query.sortBy || 'order',
      sortOrder: query.sortOrder || 'asc',
    });
    const skip = (page - 1) * limit;

    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      courseId: new ObjectId(courseId),
    };

    if (query.moduleId) {
      filter.moduleId = new ObjectId(query.moduleId);
    }

    const [data, total] = await Promise.all([
      collections.lessons
        .find(filter)
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1, _id: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collections.lessons.countDocuments(filter),
    ]);

    return {
      data: data.map(this.formatLesson),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async getById(tenantId: string, courseId: string, lessonId: string) {
    const lesson = await collections.lessons.findOne({
      _id: new ObjectId(lessonId),
      tenantId: new ObjectId(tenantId),
      courseId: new ObjectId(courseId),
    });

    if (!lesson) {
      throw new ApiError('LESSON_NOT_FOUND', 'Lesson not found', 404);
    }

    return this.formatLesson(lesson);
  }

  async create(
    tenantId: string,
    courseId: string,
    branchId: string,
    userId: string,
    data: Record<string, unknown>
  ) {
    // Verify course exists
    const course = await collections.courses.findOne({
      _id: new ObjectId(courseId),
      tenantId: new ObjectId(tenantId),
    });
    if (!course) {
      throw new ApiError('COURSE_NOT_FOUND', 'Course not found', 404);
    }

    const now = new Date();
    const doc = {
      ...data,
      courseId: new ObjectId(courseId),
      moduleId: data.moduleId ? new ObjectId(data.moduleId as string) : undefined,
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      isPreview: data.isPreview || false,
      createdBy: new ObjectId(userId),
      createdAt: now,
      updatedAt: now,
    };

    const result = await collections.lessons.insertOne(doc);
    return this.getById(tenantId, courseId, result.insertedId.toString());
  }

  async update(
    tenantId: string,
    courseId: string,
    lessonId: string,
    data: Record<string, unknown>
  ) {
    const lesson = await collections.lessons.findOne({
      _id: new ObjectId(lessonId),
      tenantId: new ObjectId(tenantId),
      courseId: new ObjectId(courseId),
    });

    if (!lesson) {
      throw new ApiError('LESSON_NOT_FOUND', 'Lesson not found', 404);
    }

    await collections.lessons.updateOne(
      { _id: new ObjectId(lessonId) },
      { $set: { ...data, updatedAt: new Date() } }
    );

    return this.getById(tenantId, courseId, lessonId);
  }

  async delete(tenantId: string, courseId: string, lessonId: string) {
    const lesson = await collections.lessons.findOne({
      _id: new ObjectId(lessonId),
      tenantId: new ObjectId(tenantId),
      courseId: new ObjectId(courseId),
    });

    if (!lesson) {
      throw new ApiError('LESSON_NOT_FOUND', 'Lesson not found', 404);
    }

    await collections.lessons.deleteOne({ _id: new ObjectId(lessonId) });
  }

  async reorder(
    tenantId: string,
    courseId: string,
    lessonOrders: { lessonId: string; order: number }[]
  ) {
    const bulkOps = lessonOrders.map(({ lessonId, order }) => ({
      updateOne: {
        filter: {
          _id: new ObjectId(lessonId),
          tenantId: new ObjectId(tenantId),
          courseId: new ObjectId(courseId),
        },
        update: { $set: { order, updatedAt: new Date() } },
      },
    }));

    await collections.lessons.bulkWrite(bulkOps);
  }

  private formatLesson(doc: Document) {
    return {
      ...doc,
      _id: doc._id.toString(),
      tenantId: doc.tenantId?.toString(),
      courseId: doc.courseId?.toString(),
      moduleId: doc.moduleId?.toString(),
      branchId: doc.branchId?.toString(),
      createdBy: doc.createdBy?.toString(),
      // Array fallbacks so legacy docs (created before the schema expansion)
      // always come back with proper arrays instead of undefined.
      attachments: doc.attachments || [],
      learningObjectives: doc.learningObjectives || [],
      tags: doc.tags || [],
    };
  }
}

export const lessonService = new LessonService();

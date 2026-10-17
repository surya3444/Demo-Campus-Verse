import { ObjectId, Filter, Document } from 'mongodb';
import { collections } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler';
import { getPagination, buildPaginationMeta } from '../../utils/pagination';

class EnrollmentService {
  async list(
    tenantId: string,
    query: {
      courseId?: string;
      studentId?: string;
      status?: string;
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

    if (query.courseId) filter.courseId = new ObjectId(query.courseId);
    if (query.studentId) filter.studentId = new ObjectId(query.studentId);
    if (query.status) filter.status = query.status;

    const [data, total] = await Promise.all([
      collections.courseEnrollments
        .find(filter)
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1, _id: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collections.courseEnrollments.countDocuments(filter),
    ]);

    return {
      data: data.map(this.formatEnrollment),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async getById(tenantId: string, enrollmentId: string) {
    const enrollment = await collections.courseEnrollments.findOne({
      _id: new ObjectId(enrollmentId),
      tenantId: new ObjectId(tenantId),
    });

    if (!enrollment) {
      throw new ApiError('ENROLLMENT_NOT_FOUND', 'Enrollment not found', 404);
    }

    return this.formatEnrollment(enrollment);
  }

  async enrollStudents(tenantId: string, branchId: string, courseId: string, studentIds: string[]) {
    const course = await collections.courses.findOne({
      _id: new ObjectId(courseId),
      tenantId: new ObjectId(tenantId),
    });

    if (!course) {
      throw new ApiError('COURSE_NOT_FOUND', 'Course not found', 404);
    }

    if (course.status !== 'published') {
      throw new ApiError('COURSE_NOT_PUBLISHED', 'Can only enroll in published courses', 400);
    }

    // Check for duplicate enrollments
    const existingEnrollments = await collections.courseEnrollments
      .find({
        tenantId: new ObjectId(tenantId),
        courseId: new ObjectId(courseId),
        studentId: { $in: studentIds.map((id) => new ObjectId(id)) },
        status: { $ne: 'dropped' },
      })
      .toArray();

    const alreadyEnrolledIds = new Set(existingEnrollments.map((e) => e.studentId.toString()));

    const newStudentIds = studentIds.filter((id) => !alreadyEnrolledIds.has(id));

    if (newStudentIds.length === 0) {
      throw new ApiError('ALREADY_ENROLLED', 'All students are already enrolled', 400);
    }

    const now = new Date();
    const docs = newStudentIds.map((studentId) => ({
      courseId: new ObjectId(courseId),
      studentId: new ObjectId(studentId),
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      status: 'enrolled',
      enrolledAt: now,
      completionPercentage: 0,
      certificateIssued: false,
      createdAt: now,
      updatedAt: now,
    }));

    const result = await collections.courseEnrollments.insertMany(docs);

    return {
      enrolled: newStudentIds.length,
      skipped: alreadyEnrolledIds.size,
      insertedIds: Object.values(result.insertedIds).map((id) => id.toString()),
    };
  }

  async updateStatus(tenantId: string, enrollmentId: string, status: string) {
    const enrollment = await collections.courseEnrollments.findOne({
      _id: new ObjectId(enrollmentId),
      tenantId: new ObjectId(tenantId),
    });

    if (!enrollment) {
      throw new ApiError('ENROLLMENT_NOT_FOUND', 'Enrollment not found', 404);
    }

    const update: Record<string, unknown> = {
      status,
      updatedAt: new Date(),
    };

    if (status === 'completed') {
      update.completedAt = new Date();
      update.completionPercentage = 100;
    }

    await collections.courseEnrollments.updateOne(
      { _id: new ObjectId(enrollmentId) },
      { $set: update }
    );

    return this.getById(tenantId, enrollmentId);
  }

  private formatEnrollment(doc: Document) {
    return {
      ...doc,
      _id: doc._id.toString(),
      courseId: doc.courseId?.toString(),
      studentId: doc.studentId?.toString(),
      tenantId: doc.tenantId?.toString(),
      branchId: doc.branchId?.toString(),
    };
  }
}

export const enrollmentService = new EnrollmentService();

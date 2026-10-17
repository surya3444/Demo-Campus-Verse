import { ObjectId, Document } from 'mongodb';
import { collections } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler';

class ProgressService {
  async getCourseProgress(tenantId: string, enrollmentId: string) {
    const enrollment = await collections.courseEnrollments.findOne({
      _id: new ObjectId(enrollmentId),
      tenantId: new ObjectId(tenantId),
    });

    if (!enrollment) {
      throw new ApiError('ENROLLMENT_NOT_FOUND', 'Enrollment not found', 404);
    }

    const courseId = enrollment.courseId;

    // Get total lessons for this course
    const totalLessons = await collections.lessons.countDocuments({
      tenantId: new ObjectId(tenantId),
      courseId,
    });

    // Get completed lessons
    const completedLessons = await collections.lessonProgress.countDocuments({
      tenantId: new ObjectId(tenantId),
      enrollmentId: new ObjectId(enrollmentId),
      status: 'completed',
    });

    // Get all lesson progress
    const progressData = await collections.lessonProgress
      .find({
        tenantId: new ObjectId(tenantId),
        enrollmentId: new ObjectId(enrollmentId),
      })
      .toArray();

    const completionPercentage =
      totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    // Update enrollment completion percentage
    await collections.courseEnrollments.updateOne(
      { _id: new ObjectId(enrollmentId) },
      {
        $set: {
          completionPercentage,
          status:
            completionPercentage === 100
              ? 'completed'
              : enrollment.status === 'enrolled'
                ? 'in_progress'
                : enrollment.status,
          ...(completionPercentage === 100 ? { completedAt: new Date() } : {}),
          updatedAt: new Date(),
        },
      }
    );

    return {
      enrollmentId,
      courseId: courseId.toString(),
      totalLessons,
      completedLessons,
      completionPercentage,
      lessons: progressData.map(this.formatProgress),
    };
  }

  async updateLessonProgress(
    tenantId: string,
    enrollmentId: string,
    lessonId: string,
    studentId: string,
    data: { status: string; watchedDuration?: number }
  ) {
    const enrollment = await collections.courseEnrollments.findOne({
      _id: new ObjectId(enrollmentId),
      tenantId: new ObjectId(tenantId),
    });

    if (!enrollment) {
      throw new ApiError('ENROLLMENT_NOT_FOUND', 'Enrollment not found', 404);
    }

    const lesson = await collections.lessons.findOne({
      _id: new ObjectId(lessonId),
      courseId: enrollment.courseId,
    });

    if (!lesson) {
      throw new ApiError('LESSON_NOT_FOUND', 'Lesson not found', 404);
    }

    const now = new Date();
    const update: Record<string, unknown> = {
      status: data.status,
      updatedAt: now,
    };

    if (data.watchedDuration !== undefined) {
      update.watchedDuration = data.watchedDuration;
    }

    if (data.status === 'completed') {
      update.completedAt = now;
    }

    await collections.lessonProgress.updateOne(
      {
        tenantId: new ObjectId(tenantId),
        enrollmentId: new ObjectId(enrollmentId),
        lessonId: new ObjectId(lessonId),
      },
      {
        $set: update,
        $setOnInsert: {
          courseId: enrollment.courseId,
          studentId: new ObjectId(studentId),
          tenantId: new ObjectId(tenantId),
          enrollmentId: new ObjectId(enrollmentId),
          lessonId: new ObjectId(lessonId),
          createdAt: now,
        },
      },
      { upsert: true }
    );

    // Recalculate course progress
    return this.getCourseProgress(tenantId, enrollmentId);
  }

  private formatProgress(doc: Document) {
    return {
      ...doc,
      _id: doc._id.toString(),
      enrollmentId: doc.enrollmentId?.toString(),
      lessonId: doc.lessonId?.toString(),
      courseId: doc.courseId?.toString(),
      studentId: doc.studentId?.toString(),
      tenantId: doc.tenantId?.toString(),
    };
  }
}

export const progressService = new ProgressService();

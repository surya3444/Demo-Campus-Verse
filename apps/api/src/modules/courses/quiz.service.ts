import { ObjectId, Filter, Document } from 'mongodb';
import { collections } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler';
import { getPagination, buildPaginationMeta } from '../../utils/pagination';

class QuizService {
  async list(
    tenantId: string,
    courseId: string,
    query: { moduleId?: string; page?: number; limit?: number; sortBy?: string; sortOrder?: string }
  ) {
    const { page, limit, sortBy, sortOrder } = getPagination(query);
    const skip = (page - 1) * limit;

    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      courseId: new ObjectId(courseId),
    };

    if (query.moduleId) {
      filter.moduleId = new ObjectId(query.moduleId);
    }

    const [data, total] = await Promise.all([
      collections.quizzes
        .find(filter)
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1, _id: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collections.quizzes.countDocuments(filter),
    ]);

    return {
      data: data.map(this.formatQuiz),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async getById(tenantId: string, courseId: string, quizId: string) {
    const quiz = await collections.quizzes.findOne({
      _id: new ObjectId(quizId),
      tenantId: new ObjectId(tenantId),
      courseId: new ObjectId(courseId),
    });

    if (!quiz) {
      throw new ApiError('QUIZ_NOT_FOUND', 'Quiz not found', 404);
    }

    return this.formatQuiz(quiz);
  }

  async create(
    tenantId: string,
    courseId: string,
    branchId: string,
    userId: string,
    data: Record<string, unknown>
  ) {
    const course = await collections.courses.findOne({
      _id: new ObjectId(courseId),
      tenantId: new ObjectId(tenantId),
    });
    if (!course) {
      throw new ApiError('COURSE_NOT_FOUND', 'Course not found', 404);
    }

    const now = new Date();
    const questions = ((data.questions as Array<Record<string, unknown>>) || []).map((q) => ({
      ...q,
      _id: new ObjectId(),
    }));

    const doc = {
      ...data,
      questions,
      courseId: new ObjectId(courseId),
      moduleId: data.moduleId ? new ObjectId(data.moduleId as string) : undefined,
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      createdBy: new ObjectId(userId),
      createdAt: now,
      updatedAt: now,
    };

    const result = await collections.quizzes.insertOne(doc);
    return this.getById(tenantId, courseId, result.insertedId.toString());
  }

  async update(tenantId: string, courseId: string, quizId: string, data: Record<string, unknown>) {
    const quiz = await collections.quizzes.findOne({
      _id: new ObjectId(quizId),
      tenantId: new ObjectId(tenantId),
      courseId: new ObjectId(courseId),
    });

    if (!quiz) {
      throw new ApiError('QUIZ_NOT_FOUND', 'Quiz not found', 404);
    }

    if (data.questions) {
      data.questions = ((data.questions as Array<Record<string, unknown>>) || []).map((q) => ({
        ...q,
        _id: q._id ? new ObjectId(q._id as string) : new ObjectId(),
      }));
    }

    await collections.quizzes.updateOne(
      { _id: new ObjectId(quizId) },
      { $set: { ...data, updatedAt: new Date() } }
    );

    return this.getById(tenantId, courseId, quizId);
  }

  async delete(tenantId: string, courseId: string, quizId: string) {
    const quiz = await collections.quizzes.findOne({
      _id: new ObjectId(quizId),
      tenantId: new ObjectId(tenantId),
      courseId: new ObjectId(courseId),
    });

    if (!quiz) {
      throw new ApiError('QUIZ_NOT_FOUND', 'Quiz not found', 404);
    }

    await collections.quizzes.deleteOne({ _id: new ObjectId(quizId) });
  }

  async submitAttempt(
    tenantId: string,
    courseId: string,
    quizId: string,
    studentId: string,
    enrollmentId: string,
    answers: { questionId: string; answer: string }[]
  ) {
    const quiz = await collections.quizzes.findOne({
      _id: new ObjectId(quizId),
      tenantId: new ObjectId(tenantId),
      courseId: new ObjectId(courseId),
    });

    if (!quiz) {
      throw new ApiError('QUIZ_NOT_FOUND', 'Quiz not found', 404);
    }

    // Check max attempts
    const attemptCount = await collections.quizAttempts.countDocuments({
      quizId: new ObjectId(quizId),
      studentId: new ObjectId(studentId),
    });

    if (attemptCount >= (quiz.maxAttempts || 3)) {
      throw new ApiError('MAX_ATTEMPTS_REACHED', 'Maximum quiz attempts reached', 400);
    }

    // Auto-grade MCQ and true_false questions
    const questions = quiz.questions as Array<Record<string, unknown>>;
    let score = 0;
    let totalPoints = 0;

    for (const question of questions) {
      const qId = (question._id as ObjectId).toString();
      totalPoints += (question.points as number) || 1;
      const studentAnswer = answers.find((a) => a.questionId === qId);

      if (studentAnswer && question.type !== 'short_answer') {
        if (studentAnswer.answer === question.correctAnswer) {
          score += (question.points as number) || 1;
        }
      }
    }

    const passingScore = quiz.passingScore || 0;
    const scorePercentage = totalPoints > 0 ? (score / totalPoints) * 100 : 0;
    const passed = scorePercentage >= passingScore;

    const now = new Date();
    const attempt = {
      quizId: new ObjectId(quizId),
      courseId: new ObjectId(courseId),
      studentId: new ObjectId(studentId),
      enrollmentId: new ObjectId(enrollmentId),
      tenantId: new ObjectId(tenantId),
      answers: answers.map((a) => ({
        questionId: new ObjectId(a.questionId),
        answer: a.answer,
      })),
      score,
      totalPoints,
      passed,
      startedAt: now,
      submittedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    const result = await collections.quizAttempts.insertOne(attempt);

    return {
      _id: result.insertedId.toString(),
      score,
      totalPoints,
      scorePercentage: Math.round(scorePercentage),
      passed,
      submittedAt: now,
    };
  }

  async getAttempts(
    tenantId: string,
    quizId: string,
    query: { studentId?: string; page?: number; limit?: number }
  ) {
    const { page, limit } = getPagination(query);
    const skip = (page - 1) * limit;

    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      quizId: new ObjectId(quizId),
    };

    if (query.studentId) {
      filter.studentId = new ObjectId(query.studentId);
    }

    const [data, total] = await Promise.all([
      collections.quizAttempts
        .find(filter)
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collections.quizAttempts.countDocuments(filter),
    ]);

    return {
      data: data.map(this.formatAttempt),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  private formatQuiz(doc: Document) {
    return {
      ...doc,
      _id: doc._id.toString(),
      tenantId: doc.tenantId?.toString(),
      courseId: doc.courseId?.toString(),
      moduleId: doc.moduleId?.toString(),
      branchId: doc.branchId?.toString(),
      createdBy: doc.createdBy?.toString(),
      questions: (doc.questions || []).map((q: Record<string, unknown>) => ({
        ...q,
        _id: (q._id as ObjectId)?.toString(),
      })),
    };
  }

  private formatAttempt(doc: Document) {
    return {
      ...doc,
      _id: doc._id.toString(),
      quizId: doc.quizId?.toString(),
      courseId: doc.courseId?.toString(),
      studentId: doc.studentId?.toString(),
      enrollmentId: doc.enrollmentId?.toString(),
      tenantId: doc.tenantId?.toString(),
      answers: (doc.answers || []).map((a: Record<string, unknown>) => ({
        ...a,
        questionId: (a.questionId as ObjectId)?.toString(),
      })),
    };
  }
}

export const quizService = new QuizService();

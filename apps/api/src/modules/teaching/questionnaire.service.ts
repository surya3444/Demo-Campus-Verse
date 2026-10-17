import { ObjectId, WithId, Document, Filter } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { getPagination, buildPaginationMeta } from '../../utils/pagination';

interface QuestionDocument {
  _id: ObjectId;
  type: 'mcq' | 'short_answer' | 'true_false';
  question: string;
  options?: string[];
  correctAnswer: string;
  marks: number;
}

interface QuestionnaireDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  lessonPlanId: ObjectId;
  sectionId: ObjectId;
  subjectId: ObjectId;
  teacherId: ObjectId;
  title: string;
  questions: QuestionDocument[];
  totalMarks: number;
  dueDate?: Date;
  status: 'draft' | 'published' | 'closed';
  createdAt: Date;
  updatedAt: Date;
}

interface SubmissionDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  questionnaireId: ObjectId;
  studentId: ObjectId;
  answers: { questionId: ObjectId; answer: string }[];
  score: number;
  totalMarks: number;
  percentage: number;
  submittedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

class QuestionnaireService {
  async create(
    tenantId: string,
    branchId: string,
    data: {
      lessonPlanId: string;
      title: string;
      questions: {
        type: string;
        question: string;
        options?: string[];
        correctAnswer: string;
        marks: number;
      }[];
      dueDate?: Date;
    },
    staffId: string
  ) {
    const tenantObjId = new ObjectId(tenantId);

    // Fetch lesson plan to get sectionId and subjectId
    const lessonPlan = await collections.lessonPlans.findOne({
      _id: new ObjectId(data.lessonPlanId),
      tenantId: tenantObjId,
    });

    if (!lessonPlan) {
      throw new ApiError('LESSON_PLAN_NOT_FOUND', 'Lesson plan not found', 404);
    }

    // Check if questionnaire already exists for this lesson
    const existing = await collections.questionnaires.findOne({
      lessonPlanId: new ObjectId(data.lessonPlanId),
      tenantId: tenantObjId,
    });

    if (existing) {
      throw new ApiError(
        'QUESTIONNAIRE_EXISTS',
        'A questionnaire already exists for this lesson plan',
        409
      );
    }

    const questions: QuestionDocument[] = data.questions.map((q) => ({
      _id: new ObjectId(),
      type: q.type as QuestionDocument['type'],
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      marks: q.marks,
    }));

    const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);
    const now = new Date();

    const doc: Omit<QuestionnaireDocument, '_id'> & { _id: ObjectId } = {
      _id: new ObjectId(),
      tenantId: tenantObjId,
      branchId: new ObjectId(branchId),
      lessonPlanId: new ObjectId(data.lessonPlanId),
      sectionId: lessonPlan.sectionId as ObjectId,
      subjectId: lessonPlan.subjectId as ObjectId,
      teacherId: new ObjectId(staffId),
      title: data.title,
      questions,
      totalMarks,
      dueDate: data.dueDate || undefined,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };

    await collections.questionnaires.insertOne(doc);

    logger.info(
      { questionnaireId: doc._id.toString(), lessonPlanId: data.lessonPlanId, tenantId },
      'Questionnaire created'
    );

    return this.formatQuestionnaire(doc as WithId<QuestionnaireDocument>, lessonPlan);
  }

  async findAll(
    tenantId: string,
    branchId: string,
    params: {
      sectionId?: string;
      subjectId?: string;
      status?: string;
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

    if (params.sectionId) {
      filter.sectionId = new ObjectId(params.sectionId);
    }

    if (params.subjectId) {
      filter.subjectId = new ObjectId(params.subjectId);
    }

    if (params.status) {
      filter.status = params.status;
    }

    if (params.search) {
      filter.title = { $regex: params.search, $options: 'i' };
    }

    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const [questionnaires, total] = await Promise.all([
      collections.questionnaires
        .find(filter)
        .sort({ [sortBy]: sortDirection, _id: sortDirection })
        .skip(skip)
        .limit(limit)
        .toArray() as Promise<WithId<QuestionnaireDocument>[]>,
      collections.questionnaires.countDocuments(filter),
    ]);

    // Batch-fetch lesson plans to avoid N+1
    const lessonPlanIds = [...new Set(questionnaires.map((q) => q.lessonPlanId.toString()))];
    const lessonPlans =
      lessonPlanIds.length > 0
        ? await collections.lessonPlans
            .find({ _id: { $in: lessonPlanIds.map((id) => new ObjectId(id)) } })
            .toArray()
        : [];
    const lessonPlanMap = new Map(lessonPlans.map((lp) => [lp._id.toString(), lp]));

    const meta = buildPaginationMeta(page, limit, total);

    return {
      data: questionnaires.map((q) =>
        this.formatQuestionnaire(q, lessonPlanMap.get(q.lessonPlanId.toString()))
      ),
      meta,
    };
  }

  async findByLessonPlan(tenantId: string, lessonPlanId: string) {
    const doc = (await collections.questionnaires.findOne({
      lessonPlanId: new ObjectId(lessonPlanId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<QuestionnaireDocument> | null;

    if (!doc) return null;

    const lessonPlan = await collections.lessonPlans.findOne({
      _id: new ObjectId(lessonPlanId),
      tenantId: new ObjectId(tenantId),
    });

    return this.formatQuestionnaire(doc, lessonPlan);
  }

  async findById(tenantId: string, id: string) {
    const doc = (await collections.questionnaires.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    })) as WithId<QuestionnaireDocument> | null;

    if (!doc) {
      throw new ApiError('QUESTIONNAIRE_NOT_FOUND', 'Questionnaire not found', 404);
    }

    const lessonPlan = await collections.lessonPlans.findOne({
      _id: doc.lessonPlanId,
      tenantId: new ObjectId(tenantId),
    });

    return this.formatQuestionnaire(doc, lessonPlan);
  }

  async update(
    tenantId: string,
    id: string,
    data: {
      title?: string;
      questions?: {
        type: string;
        question: string;
        options?: string[];
        correctAnswer: string;
        marks: number;
      }[];
      dueDate?: Date;
    }
  ) {
    const existing = (await collections.questionnaires.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    })) as WithId<QuestionnaireDocument> | null;

    if (!existing) {
      throw new ApiError('QUESTIONNAIRE_NOT_FOUND', 'Questionnaire not found', 404);
    }

    if (existing.status !== 'draft') {
      throw new ApiError('CANNOT_EDIT', 'Only draft questionnaires can be edited', 400);
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (data.title !== undefined) updateData.title = data.title;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;

    if (data.questions) {
      const questions: QuestionDocument[] = data.questions.map((q) => ({
        _id: new ObjectId(),
        type: q.type as QuestionDocument['type'],
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        marks: q.marks,
      }));
      updateData.questions = questions;
      updateData.totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);
    }

    await collections.questionnaires.updateOne({ _id: new ObjectId(id) }, { $set: updateData });

    logger.info({ questionnaireId: id, tenantId }, 'Questionnaire updated');

    return this.findById(tenantId, id);
  }

  async publish(tenantId: string, id: string) {
    const existing = (await collections.questionnaires.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    })) as WithId<QuestionnaireDocument> | null;

    if (!existing) {
      throw new ApiError('QUESTIONNAIRE_NOT_FOUND', 'Questionnaire not found', 404);
    }

    if (existing.status !== 'draft') {
      throw new ApiError('CANNOT_PUBLISH', 'Only draft questionnaires can be published', 400);
    }

    await collections.questionnaires.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: 'published', updatedAt: new Date() } }
    );

    // Update lesson plan teaching status to questionnaire_sent
    const lessonPlan = await collections.lessonPlans.findOne({
      _id: existing.lessonPlanId,
      tenantId: new ObjectId(tenantId),
    });

    if (lessonPlan) {
      const currentStatus = (lessonPlan.teachingStatus as string) || 'not_started';
      if (currentStatus === 'delivered' || currentStatus === 'ongoing') {
        await collections.lessonPlans.updateOne(
          { _id: existing.lessonPlanId },
          { $set: { teachingStatus: 'questionnaire_sent', updatedAt: new Date() } }
        );
      }
    }

    logger.info({ questionnaireId: id, tenantId }, 'Questionnaire published');

    return this.findById(tenantId, id);
  }

  async submit(
    tenantId: string,
    branchId: string,
    questionnaireId: string,
    studentId: string,
    data: { answers: { questionId: string; answer: string }[] }
  ) {
    const questionnaire = (await collections.questionnaires.findOne({
      _id: new ObjectId(questionnaireId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<QuestionnaireDocument> | null;

    if (!questionnaire) {
      throw new ApiError('QUESTIONNAIRE_NOT_FOUND', 'Questionnaire not found', 404);
    }

    if (questionnaire.status !== 'published') {
      throw new ApiError('NOT_PUBLISHED', 'Questionnaire is not open for submissions', 400);
    }

    // Check for existing submission
    const existingSubmission = await collections.questionnaireSubmissions.findOne({
      questionnaireId: new ObjectId(questionnaireId),
      studentId: new ObjectId(studentId),
      tenantId: new ObjectId(tenantId),
    });

    if (existingSubmission) {
      throw new ApiError('ALREADY_SUBMITTED', 'You have already submitted this questionnaire', 409);
    }

    // Auto-grade
    let score = 0;
    const answers = data.answers.map((a) => {
      const question = questionnaire.questions.find((q) => q._id.toString() === a.questionId);
      if (question) {
        const isCorrect =
          question.correctAnswer.trim().toLowerCase() === a.answer.trim().toLowerCase();
        if (isCorrect) score += question.marks;
      }
      return { questionId: new ObjectId(a.questionId), answer: a.answer };
    });

    const totalMarks = questionnaire.totalMarks;
    const percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 10000) / 100 : 0;
    const now = new Date();

    const submission: Omit<SubmissionDocument, '_id'> & { _id: ObjectId } = {
      _id: new ObjectId(),
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      questionnaireId: new ObjectId(questionnaireId),
      studentId: new ObjectId(studentId),
      answers,
      score,
      totalMarks,
      percentage,
      submittedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    await collections.questionnaireSubmissions.insertOne(submission);

    // Check if all students in section have submitted
    const sectionStudentCount = await collections.students.countDocuments({
      tenantId: new ObjectId(tenantId),
      'currentEnrollment.sectionId': questionnaire.sectionId,
      status: 'active',
    });

    const submissionCount = await collections.questionnaireSubmissions.countDocuments({
      questionnaireId: new ObjectId(questionnaireId),
      tenantId: new ObjectId(tenantId),
    });

    if (submissionCount >= sectionStudentCount) {
      // All students submitted — update lesson plan status
      const lessonPlan = await collections.lessonPlans.findOne({
        _id: questionnaire.lessonPlanId,
        tenantId: new ObjectId(tenantId),
      });

      if (lessonPlan && (lessonPlan.teachingStatus as string) === 'questionnaire_sent') {
        await collections.lessonPlans.updateOne(
          { _id: questionnaire.lessonPlanId },
          { $set: { teachingStatus: 'all_submitted', updatedAt: new Date() } }
        );
      }
    }

    logger.info(
      { questionnaireId, studentId, score, percentage, tenantId },
      'Questionnaire submitted'
    );

    // Don't return scores — teacher must review first
    return {
      _id: submission._id.toString(),
      submittedAt: now,
    };
  }

  async reviewSubmission(
    tenantId: string,
    questionnaireId: string,
    submissionId: string,
    reviewData: { questionResults: { questionId: string; isCorrect: boolean }[] },
    reviewedBy: string
  ) {
    const tenantObjId = new ObjectId(tenantId);
    const questionnaireObjId = new ObjectId(questionnaireId);
    const submissionObjId = new ObjectId(submissionId);

    const questionnaire = (await collections.questionnaires.findOne({
      _id: questionnaireObjId,
      tenantId: tenantObjId,
    })) as WithId<QuestionnaireDocument> | null;

    if (!questionnaire) {
      throw new ApiError('QUESTIONNAIRE_NOT_FOUND', 'Questionnaire not found', 404);
    }

    const submission = await collections.questionnaireSubmissions.findOne({
      _id: submissionObjId,
      questionnaireId: questionnaireObjId,
      tenantId: tenantObjId,
    });

    if (!submission) {
      throw new ApiError('SUBMISSION_NOT_FOUND', 'Submission not found', 404);
    }

    if (submission.reviewed) {
      throw new ApiError('ALREADY_REVIEWED', 'This submission has already been reviewed', 409);
    }

    const resultMap = new Map(reviewData.questionResults.map((r) => [r.questionId, r.isCorrect]));

    let reviewedScore = 0;
    for (const q of questionnaire.questions) {
      const isCorrect = resultMap.get(q._id.toString());
      if (isCorrect) reviewedScore += q.marks;
    }

    const totalMarks = questionnaire.totalMarks;
    const percentage = totalMarks > 0 ? Math.round((reviewedScore / totalMarks) * 10000) / 100 : 0;
    const now = new Date();

    await collections.questionnaireSubmissions.updateOne(
      { _id: submissionObjId },
      {
        $set: {
          reviewed: true,
          reviewedScore,
          reviewedPercentage: percentage,
          questionResults: reviewData.questionResults,
          reviewedBy: new ObjectId(reviewedBy),
          reviewedAt: now,
          updatedAt: now,
        },
      }
    );

    // Write to grades — use lessonPlanId as assignmentId equivalent
    await collections.grades.updateOne(
      {
        assignmentId: questionnaireObjId,
        studentId: submission.studentId as ObjectId,
        tenantId: tenantObjId,
      },
      {
        $set: {
          assignmentId: questionnaireObjId,
          studentId: submission.studentId as ObjectId,
          tenantId: tenantObjId,
          branchId: submission.branchId as ObjectId,
          marksObtained: reviewedScore,
          totalMarks,
          percentage,
          remarks: 'Reviewed by teacher',
          gradedBy: new ObjectId(reviewedBy),
          gradedAt: now,
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true }
    );

    logger.info(
      { questionnaireId, submissionId, reviewedScore, percentage, tenantId },
      'Questionnaire submission reviewed'
    );

    return { reviewedScore, totalMarks, percentage };
  }

  async getSubmissions(tenantId: string, questionnaireId: string) {
    const submissions = (await collections.questionnaireSubmissions
      .find({
        questionnaireId: new ObjectId(questionnaireId),
        tenantId: new ObjectId(tenantId),
      })
      .sort({ submittedAt: -1 })
      .toArray()) as WithId<SubmissionDocument>[];

    // Look up student names
    const studentIds = submissions.map((s) => s.studentId);
    const students =
      studentIds.length > 0
        ? await collections.students
            .find({ _id: { $in: studentIds } })
            .project({ _id: 1, firstName: 1, lastName: 1, admissionNumber: 1 })
            .toArray()
        : [];

    const studentMap = new Map(
      students.map((s) => [
        (s._id as ObjectId).toString(),
        {
          name: `${s.firstName || ''} ${s.lastName || ''}`.trim(),
          admissionNumber: (s.admissionNumber as string) || '',
        },
      ])
    );

    return submissions.map((s) => {
      const student = studentMap.get(s.studentId.toString());
      return {
        _id: s._id.toString(),
        questionnaireId: s.questionnaireId.toString(),
        studentId: s.studentId.toString(),
        studentName: student?.name || '',
        admissionNumber: student?.admissionNumber || '',
        answers: s.answers.map((a) => ({
          questionId: a.questionId.toString(),
          answer: a.answer,
        })),
        score: s.score,
        totalMarks: s.totalMarks,
        percentage: s.percentage,
        submittedAt: s.submittedAt,
        reviewed: (s as Record<string, unknown>).reviewed || false,
        reviewedScore: (s as Record<string, unknown>).reviewedScore,
        reviewedPercentage: (s as Record<string, unknown>).reviewedPercentage,
        questionResults: (
          (s as Record<string, unknown>).questionResults as
            | Array<{ questionId: ObjectId; isCorrect: boolean }>
            | undefined
        )?.map((r) => ({ questionId: r.questionId.toString(), isCorrect: r.isCorrect })),
      };
    });
  }

  async getStudentSubmission(tenantId: string, questionnaireId: string, studentId: string) {
    const submission = await collections.questionnaireSubmissions.findOne({
      questionnaireId: new ObjectId(questionnaireId),
      studentId: new ObjectId(studentId),
      tenantId: new ObjectId(tenantId),
    });

    if (!submission) return null;

    const questionnaire = (await collections.questionnaires.findOne({
      _id: new ObjectId(questionnaireId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<QuestionnaireDocument> | null;

    return {
      _id: (submission._id as ObjectId).toString(),
      questionnaireId,
      reviewed: (submission as Record<string, unknown>).reviewed || false,
      reviewedScore: (submission as Record<string, unknown>).reviewedScore,
      totalMarks: submission.totalMarks,
      submittedAt: submission.submittedAt,
      answers: (submission.answers as Array<{ questionId: ObjectId; answer: string }>).map((a) => ({
        questionId: a.questionId.toString(),
        answer: a.answer,
      })),
      questionResults: (
        (submission as Record<string, unknown>).questionResults as
          | Array<{ questionId: ObjectId; isCorrect: boolean }>
          | undefined
      )?.map((r) => ({ questionId: r.questionId.toString(), isCorrect: r.isCorrect })),
      questions: questionnaire?.questions.map((q) => ({
        _id: q._id.toString(),
        question: q.question,
        type: q.type,
        options: q.options,
        correctAnswer: q.correctAnswer,
        marks: q.marks,
      })),
    };
  }

  async delete(tenantId: string, id: string) {
    const existing = await collections.questionnaires.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!existing) {
      throw new ApiError('QUESTIONNAIRE_NOT_FOUND', 'Questionnaire not found', 404);
    }

    // Delete submissions too
    await collections.questionnaireSubmissions.deleteMany({
      questionnaireId: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    await collections.questionnaires.deleteOne({ _id: new ObjectId(id) });

    logger.info({ questionnaireId: id, tenantId }, 'Questionnaire deleted');

    return { success: true };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private formatQuestionnaire(doc: WithId<QuestionnaireDocument>, lessonPlan?: any) {
    return {
      _id: doc._id.toString(),
      tenantId: doc.tenantId.toString(),
      branchId: doc.branchId.toString(),
      lessonPlanId: doc.lessonPlanId.toString(),
      sectionId: doc.sectionId.toString(),
      subjectId: doc.subjectId.toString(),
      teacherId: doc.teacherId.toString(),
      title: doc.title,
      questions: doc.questions.map((q) => ({
        _id: q._id.toString(),
        type: q.type,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        marks: q.marks,
      })),
      totalMarks: doc.totalMarks,
      dueDate: doc.dueDate,
      status: doc.status,
      lessonTitle: (lessonPlan?.title as string) || '',
      sectionName: (lessonPlan?.sectionName as string) || '',
      subjectName: (lessonPlan?.subjectName as string) || '',
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}

export const questionnaireService = new QuestionnaireService();

import { ObjectId, Filter, Document, WithId } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { intersectScope } from '../../middleware/scope';
import { getPagination, buildPaginationMeta } from '../../utils/pagination';

interface QuestionDocument {
  _id: ObjectId;
  type: 'mcq' | 'short_answer' | 'true_false';
  question: string;
  options?: string[];
  correctAnswer: string;
  marks: number;
}

interface AssignmentDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  teacherId: ObjectId;
  teacherName: string;
  sectionId: ObjectId;
  sectionName: string;
  subjectId: ObjectId;
  subjectName: string;
  title: string;
  description?: string;
  instructions?: string;
  type: 'homework' | 'classwork' | 'project' | 'test' | 'quiz' | 'other';
  totalMarks: number;
  questions?: QuestionDocument[];
  hasQuestions?: boolean;
  dueDate?: Date;
  assignedDate: Date;
  status: 'draft' | 'published' | 'grading' | 'completed';
  publishedAt?: Date;
  completedAt?: Date;
  attachments?: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface SubmissionDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  assignmentId: ObjectId;
  studentId: ObjectId;
  answers: { questionId: ObjectId; answer: string }[];
  score: number;
  totalMarks: number;
  percentage: number;
  submittedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

class AssignmentService {
  async create(
    tenantId: string,
    branchId: string,
    data: {
      sectionId: string;
      subjectId: string;
      title: string;
      description?: string;
      instructions?: string;
      type: string;
      totalMarks?: number;
      questions?: {
        type: string;
        question: string;
        options?: string[];
        correctAnswer: string;
        marks: number;
      }[];
      dueDate?: string;
      assignedDate?: string;
      status?: string;
      attachments?: string[];
      notes?: string;
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

    // Handle questions
    let questions: QuestionDocument[] | undefined;
    let hasQuestions = false;
    let totalMarks: number;

    if (data.questions && data.questions.length > 0) {
      questions = data.questions.map((q) => ({
        _id: new ObjectId(),
        type: q.type as QuestionDocument['type'],
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        marks: q.marks,
      }));
      hasQuestions = true;
      totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);
    } else {
      if (!data.totalMarks) {
        throw new ApiError(
          'TOTAL_MARKS_REQUIRED',
          'Total marks is required when no questions are provided',
          400
        );
      }
      totalMarks = data.totalMarks;
    }

    const assignmentId = new ObjectId();
    const now = new Date();

    const assignment: Omit<AssignmentDocument, '_id'> & { _id: ObjectId } = {
      _id: assignmentId,
      tenantId: tenantObjId,
      branchId: new ObjectId(branchId),
      teacherId: new ObjectId(teacherId),
      teacherName,
      sectionId: new ObjectId(data.sectionId),
      sectionName,
      subjectId: new ObjectId(data.subjectId),
      subjectName,
      title: data.title,
      description: data.description,
      instructions: data.instructions,
      type: data.type as AssignmentDocument['type'],
      totalMarks,
      questions,
      hasQuestions,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      assignedDate: data.assignedDate ? new Date(data.assignedDate) : now,
      status: (data.status as AssignmentDocument['status']) || 'draft',
      attachments: data.attachments,
      notes: data.notes,
      createdAt: now,
      updatedAt: now,
    };

    await collections.assignments.insertOne(assignment);

    logger.info(
      { assignmentId: assignmentId.toString(), tenantId, teacherId },
      'Assignment created'
    );

    return this.formatAssignment(assignment as WithId<AssignmentDocument>);
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
      type?: string;
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

    if (params.type) {
      filter.type = params.type;
    }

    if (params.dateFrom || params.dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (params.dateFrom) dateFilter.$gte = new Date(params.dateFrom);
      if (params.dateTo) dateFilter.$lte = new Date(params.dateTo);
      filter.assignedDate = dateFilter;
    }

    if (params.search) {
      filter.$or = [
        { title: { $regex: params.search, $options: 'i' } },
        { description: { $regex: params.search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const [assignments, total] = await Promise.all([
      collections.assignments
        .find(filter)
        .sort({ [sortBy]: sortDirection, _id: sortDirection })
        .skip(skip)
        .limit(limit)
        .toArray() as Promise<WithId<AssignmentDocument>[]>,
      collections.assignments.countDocuments(filter),
    ]);

    const meta = buildPaginationMeta(page, limit, total);

    return {
      data: assignments.map((a) => this.formatAssignment(a)),
      meta,
    };
  }

  async findById(tenantId: string, id: string) {
    const assignment = (await collections.assignments.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    })) as WithId<AssignmentDocument> | null;

    if (!assignment) {
      throw new ApiError('ASSIGNMENT_NOT_FOUND', 'Assignment not found', 404);
    }

    return this.formatAssignment(assignment);
  }

  async update(
    tenantId: string,
    id: string,
    data: {
      sectionId?: string;
      subjectId?: string;
      title?: string;
      description?: string;
      instructions?: string;
      type?: string;
      totalMarks?: number;
      dueDate?: string;
      assignedDate?: string;
      attachments?: string[];
      notes?: string;
    },
    staffId: string,
    roleLevel: number
  ) {
    const tenantObjId = new ObjectId(tenantId);

    const existing = (await collections.assignments.findOne({
      _id: new ObjectId(id),
      tenantId: tenantObjId,
    })) as WithId<AssignmentDocument> | null;

    if (!existing) {
      throw new ApiError('ASSIGNMENT_NOT_FOUND', 'Assignment not found', 404);
    }

    // Ownership check: non-admins can only update their own assignments
    if (roleLevel > 3 && existing.teacherId.toString() !== staffId) {
      throw new ApiError('FORBIDDEN', 'You can only update your own assignments', 403);
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.instructions !== undefined) updateData.instructions = data.instructions;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.dueDate !== undefined) updateData.dueDate = new Date(data.dueDate);
    if (data.assignedDate !== undefined) updateData.assignedDate = new Date(data.assignedDate);
    if (data.attachments !== undefined) updateData.attachments = data.attachments;
    if (data.notes !== undefined) updateData.notes = data.notes;

    // Handle questions update
    if ((data as Record<string, unknown>).questions !== undefined) {
      const questionsData = (data as Record<string, unknown>).questions as
        | {
            type: string;
            question: string;
            options?: string[];
            correctAnswer: string;
            marks: number;
          }[]
        | undefined;

      if (existing.status !== 'draft') {
        throw new ApiError(
          'CANNOT_EDIT_QUESTIONS',
          'Questions can only be edited in draft status',
          400
        );
      }

      if (questionsData && questionsData.length > 0) {
        const questions: QuestionDocument[] = questionsData.map((q) => ({
          _id: new ObjectId(),
          type: q.type as QuestionDocument['type'],
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          marks: q.marks,
        }));
        updateData.questions = questions;
        updateData.hasQuestions = true;
        updateData.totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);
      } else {
        updateData.questions = undefined;
        updateData.hasQuestions = false;
        if (data.totalMarks !== undefined) {
          updateData.totalMarks = data.totalMarks;
        }
      }
    } else if (data.totalMarks !== undefined) {
      updateData.totalMarks = data.totalMarks;
    }

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

    await collections.assignments.updateOne({ _id: new ObjectId(id) }, { $set: updateData });

    logger.info({ assignmentId: id, tenantId }, 'Assignment updated');

    return this.findById(tenantId, id);
  }

  async delete(tenantId: string, id: string, staffId: string, roleLevel: number) {
    const existing = (await collections.assignments.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    })) as WithId<AssignmentDocument> | null;

    if (!existing) {
      throw new ApiError('ASSIGNMENT_NOT_FOUND', 'Assignment not found', 404);
    }

    // Ownership check: non-admins can only delete their own assignments
    if (roleLevel > 3 && existing.teacherId.toString() !== staffId) {
      throw new ApiError('FORBIDDEN', 'You can only delete your own assignments', 403);
    }

    // Also delete related grades and submissions
    await collections.grades.deleteMany({
      assignmentId: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    await collections.assignmentSubmissions.deleteMany({
      assignmentId: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    // Clean up linked lesson plans — unlink the assignment and reset teaching status
    await collections.lessonPlans.updateMany(
      {
        linkedAssignmentId: new ObjectId(id),
        tenantId: new ObjectId(tenantId),
      },
      {
        $set: { teachingStatus: 'completed', updatedAt: new Date() },
        $unset: { linkedAssignmentId: '' },
      }
    );

    await collections.assignments.deleteOne({ _id: new ObjectId(id) });

    logger.info({ assignmentId: id, tenantId }, 'Assignment deleted');

    return { success: true };
  }

  async publish(tenantId: string, id: string, staffId: string, roleLevel: number) {
    const existing = (await collections.assignments.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    })) as WithId<AssignmentDocument> | null;

    if (!existing) {
      throw new ApiError('ASSIGNMENT_NOT_FOUND', 'Assignment not found', 404);
    }

    // Ownership check
    if (roleLevel > 3 && existing.teacherId.toString() !== staffId) {
      throw new ApiError('FORBIDDEN', 'You can only publish your own assignments', 403);
    }

    if (existing.status !== 'draft') {
      throw new ApiError(
        'INVALID_STATUS',
        `Cannot publish assignment with status '${existing.status}'. Only draft assignments can be published.`,
        400
      );
    }

    const now = new Date();
    await collections.assignments.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: 'published',
          publishedAt: now,
          updatedAt: now,
        },
      }
    );

    logger.info({ assignmentId: id, tenantId }, 'Assignment published');

    return this.findById(tenantId, id);
  }

  async startGrading(tenantId: string, id: string, staffId: string, roleLevel: number) {
    const existing = (await collections.assignments.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    })) as WithId<AssignmentDocument> | null;

    if (!existing) {
      throw new ApiError('ASSIGNMENT_NOT_FOUND', 'Assignment not found', 404);
    }

    // Ownership check
    if (roleLevel > 3 && existing.teacherId.toString() !== staffId) {
      throw new ApiError('FORBIDDEN', 'You can only grade your own assignments', 403);
    }

    if (existing.status !== 'published') {
      throw new ApiError(
        'INVALID_STATUS',
        `Cannot start grading for assignment with status '${existing.status}'. Only published assignments can be graded.`,
        400
      );
    }

    const now = new Date();
    await collections.assignments.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: 'grading',
          updatedAt: now,
        },
      }
    );

    logger.info({ assignmentId: id, tenantId }, 'Assignment grading started');

    return this.findById(tenantId, id);
  }

  async complete(tenantId: string, id: string, staffId: string, roleLevel: number) {
    const existing = (await collections.assignments.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    })) as WithId<AssignmentDocument> | null;

    if (!existing) {
      throw new ApiError('ASSIGNMENT_NOT_FOUND', 'Assignment not found', 404);
    }

    // Ownership check
    if (roleLevel > 3 && existing.teacherId.toString() !== staffId) {
      throw new ApiError('FORBIDDEN', 'You can only complete your own assignments', 403);
    }

    if (existing.status !== 'grading') {
      throw new ApiError(
        'INVALID_STATUS',
        `Cannot complete assignment with status '${existing.status}'. Only assignments in grading status can be completed.`,
        400
      );
    }

    const now = new Date();
    await collections.assignments.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: 'completed',
          completedAt: now,
          updatedAt: now,
        },
      }
    );

    logger.info({ assignmentId: id, tenantId }, 'Assignment completed');

    return this.findById(tenantId, id);
  }

  async submitAnswers(
    tenantId: string,
    branchId: string,
    assignmentId: string,
    studentId: string,
    data: { answers: { questionId: string; answer: string }[] }
  ) {
    const tenantObjId = new ObjectId(tenantId);
    const assignmentObjId = new ObjectId(assignmentId);
    const studentObjId = new ObjectId(studentId);

    // Validate assignment exists and is published
    const assignment = (await collections.assignments.findOne({
      _id: assignmentObjId,
      tenantId: tenantObjId,
    })) as WithId<AssignmentDocument> | null;

    if (!assignment) {
      throw new ApiError('ASSIGNMENT_NOT_FOUND', 'Assignment not found', 404);
    }

    if (assignment.status !== 'published') {
      throw new ApiError('NOT_PUBLISHED', 'Assignment is not open for submissions', 400);
    }

    if (!assignment.hasQuestions || !assignment.questions || assignment.questions.length === 0) {
      throw new ApiError('NO_QUESTIONS', 'This assignment does not have questions to answer', 400);
    }

    // Check for duplicate submission
    const existingSubmission = await collections.assignmentSubmissions.findOne({
      assignmentId: assignmentObjId,
      studentId: studentObjId,
      tenantId: tenantObjId,
    });

    if (existingSubmission) {
      throw new ApiError('ALREADY_SUBMITTED', 'You have already submitted this assignment', 409);
    }

    // Auto-grade
    let score = 0;
    const answers = data.answers.map((a) => {
      const question = assignment.questions!.find((q) => q._id.toString() === a.questionId);
      if (question) {
        const isCorrect =
          question.correctAnswer.trim().toLowerCase() === a.answer.trim().toLowerCase();
        if (isCorrect) score += question.marks;
      }
      return { questionId: new ObjectId(a.questionId), answer: a.answer };
    });

    const totalMarks = assignment.totalMarks;
    const percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 10000) / 100 : 0;
    const now = new Date();

    const submission: Omit<SubmissionDocument, '_id'> & { _id: ObjectId } = {
      _id: new ObjectId(),
      tenantId: tenantObjId,
      branchId: new ObjectId(branchId),
      assignmentId: assignmentObjId,
      studentId: studentObjId,
      answers,
      score,
      totalMarks,
      percentage,
      submittedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    await collections.assignmentSubmissions.insertOne(submission);

    logger.info(
      { assignmentId, studentId, score, percentage, tenantId },
      'Assignment answers submitted'
    );

    // Don't return scores — teacher must review first
    return {
      _id: submission._id.toString(),
      submittedAt: now,
    };
  }

  async reviewSubmission(
    tenantId: string,
    assignmentId: string,
    submissionId: string,
    reviewData: { questionResults: { questionId: string; isCorrect: boolean }[] },
    reviewedBy: string
  ) {
    const tenantObjId = new ObjectId(tenantId);
    const assignmentObjId = new ObjectId(assignmentId);
    const submissionObjId = new ObjectId(submissionId);

    const assignment = (await collections.assignments.findOne({
      _id: assignmentObjId,
      tenantId: tenantObjId,
    })) as WithId<AssignmentDocument> | null;

    if (!assignment || !assignment.questions) {
      throw new ApiError('ASSIGNMENT_NOT_FOUND', 'Assignment not found', 404);
    }

    const submission = await collections.assignmentSubmissions.findOne({
      _id: submissionObjId,
      assignmentId: assignmentObjId,
      tenantId: tenantObjId,
    });

    if (!submission) {
      throw new ApiError('SUBMISSION_NOT_FOUND', 'Submission not found', 404);
    }

    if (submission.reviewed) {
      throw new ApiError('ALREADY_REVIEWED', 'This submission has already been reviewed', 409);
    }

    // Calculate score from teacher's review
    const resultMap = new Map(reviewData.questionResults.map((r) => [r.questionId, r.isCorrect]));

    let reviewedScore = 0;
    for (const q of assignment.questions) {
      const isCorrect = resultMap.get(q._id.toString());
      if (isCorrect) reviewedScore += q.marks;
    }

    const totalMarks = assignment.totalMarks;
    const percentage = totalMarks > 0 ? Math.round((reviewedScore / totalMarks) * 10000) / 100 : 0;
    const now = new Date();

    // Update submission with review
    await collections.assignmentSubmissions.updateOne(
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

    // Write to grades collection
    await collections.grades.updateOne(
      {
        assignmentId: assignmentObjId,
        studentId: submission.studentId as ObjectId,
        tenantId: tenantObjId,
      },
      {
        $set: {
          assignmentId: assignmentObjId,
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
      { assignmentId, submissionId, reviewedScore, percentage, tenantId },
      'Assignment submission reviewed'
    );

    return { reviewedScore, totalMarks, percentage };
  }

  async getSubmissions(tenantId: string, assignmentId: string) {
    const submissions = (await collections.assignmentSubmissions
      .find({
        assignmentId: new ObjectId(assignmentId),
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
        assignmentId: s.assignmentId.toString(),
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

  async getStudentSubmission(tenantId: string, assignmentId: string, studentId: string) {
    const submission = await collections.assignmentSubmissions.findOne({
      assignmentId: new ObjectId(assignmentId),
      studentId: new ObjectId(studentId),
      tenantId: new ObjectId(tenantId),
    });

    if (!submission) return null;

    const assignment = (await collections.assignments.findOne({
      _id: new ObjectId(assignmentId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<AssignmentDocument> | null;

    return {
      _id: (submission._id as ObjectId).toString(),
      assignmentId,
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
      questions: assignment?.questions?.map((q) => ({
        _id: q._id.toString(),
        question: q.question,
        type: q.type,
        options: q.options,
        correctAnswer: q.correctAnswer,
        marks: q.marks,
      })),
    };
  }

  private formatAssignment(assignment: WithId<AssignmentDocument>, stripAnswers = false) {
    return {
      _id: assignment._id.toString(),
      tenantId: assignment.tenantId.toString(),
      branchId: assignment.branchId.toString(),
      teacherId: assignment.teacherId.toString(),
      teacherName: assignment.teacherName,
      sectionId: assignment.sectionId.toString(),
      sectionName: assignment.sectionName,
      subjectId: assignment.subjectId.toString(),
      subjectName: assignment.subjectName,
      title: assignment.title,
      description: assignment.description,
      instructions: assignment.instructions,
      type: assignment.type,
      totalMarks: assignment.totalMarks,
      hasQuestions: assignment.hasQuestions || false,
      questions: assignment.questions?.map((q) => ({
        _id: q._id.toString(),
        type: q.type,
        question: q.question,
        options: q.options,
        ...(stripAnswers ? {} : { correctAnswer: q.correctAnswer }),
        marks: q.marks,
      })),
      dueDate: assignment.dueDate,
      assignedDate: assignment.assignedDate,
      status: assignment.status,
      publishedAt: assignment.publishedAt,
      completedAt: assignment.completedAt,
      attachments: assignment.attachments,
      notes: assignment.notes,
      createdAt: assignment.createdAt,
      updatedAt: assignment.updatedAt,
    };
  }
}

export const assignmentService = new AssignmentService();

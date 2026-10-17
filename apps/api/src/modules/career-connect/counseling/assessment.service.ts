import { ObjectId, Filter, Document } from 'mongodb';
import { collections } from '../../../config/database';
import { ApiError } from '../../../middleware/errorHandler';
import { getPagination, buildPaginationMeta } from '../../../utils/pagination';

class AssessmentService {
  async list(
    tenantId: string,
    branchId: string,
    query: {
      studentId?: string;
      assessmentType?: string;
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
      branchId: new ObjectId(branchId),
    };

    if (query.studentId) filter.studentId = new ObjectId(query.studentId);
    if (query.assessmentType) filter.assessmentType = query.assessmentType;

    const [data, total] = await Promise.all([
      collections.careerAssessments
        .find(filter)
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1, _id: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collections.careerAssessments.countDocuments(filter),
    ]);

    return {
      data: data.map(this.formatAssessment),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async getById(tenantId: string, id: string) {
    const assessment = await collections.careerAssessments.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!assessment) {
      throw new ApiError('ASSESSMENT_NOT_FOUND', 'Career assessment not found', 404);
    }

    return this.formatAssessment(assessment);
  }

  async create(tenantId: string, branchId: string, userId: string, data: Record<string, unknown>) {
    const now = new Date();

    const doc = {
      ...data,
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      studentId: data.studentId ? new ObjectId(data.studentId as string) : undefined,
      conductedBy: new ObjectId(userId),
      createdAt: now,
      updatedAt: now,
    };

    const result = await collections.careerAssessments.insertOne(doc);

    return this.getById(tenantId, result.insertedId.toString());
  }

  async update(tenantId: string, id: string, data: Record<string, unknown>) {
    const assessment = await collections.careerAssessments.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!assessment) {
      throw new ApiError('ASSESSMENT_NOT_FOUND', 'Career assessment not found', 404);
    }

    if (data.studentId) {
      data.studentId = new ObjectId(data.studentId as string);
    }

    await collections.careerAssessments.updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...data, updatedAt: new Date() } }
    );

    return this.getById(tenantId, id);
  }

  async delete(tenantId: string, id: string) {
    const assessment = await collections.careerAssessments.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!assessment) {
      throw new ApiError('ASSESSMENT_NOT_FOUND', 'Career assessment not found', 404);
    }

    await collections.careerAssessments.deleteOne({ _id: new ObjectId(id) });
  }

  private formatAssessment(doc: Document) {
    return {
      ...doc,
      _id: doc._id.toString(),
      tenantId: doc.tenantId?.toString(),
      branchId: doc.branchId?.toString(),
      studentId: doc.studentId?.toString(),
      conductedBy: doc.conductedBy?.toString(),
    };
  }
}

export const assessmentService = new AssessmentService();

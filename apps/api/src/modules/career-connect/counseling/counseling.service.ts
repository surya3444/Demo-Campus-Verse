import { ObjectId, Filter, Document } from 'mongodb';
import { collections } from '../../../config/database';
import { ApiError } from '../../../middleware/errorHandler';
import { getPagination, buildPaginationMeta } from '../../../utils/pagination';
import { generateCounselingSessionNumber } from '../../../utils/generators';

class CounselingService {
  async list(
    tenantId: string,
    branchId: string,
    query: {
      search?: string;
      status?: string;
      sessionType?: string;
      audienceType?: string;
      studentId?: string;
      classId?: string;
      sectionId?: string;
      fromDate?: string;
      toDate?: string;
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

    if (query.search) {
      filter.topic = { $regex: query.search, $options: 'i' };
    }
    if (query.status) filter.status = query.status;
    if (query.sessionType) filter.sessionType = query.sessionType;
    if (query.audienceType) filter.audienceType = query.audienceType;
    if (query.studentId) filter.studentId = new ObjectId(query.studentId);
    if (query.classId) filter.classId = new ObjectId(query.classId);
    if (query.sectionId) filter.sectionId = new ObjectId(query.sectionId);

    if (query.fromDate || query.toDate) {
      const dateFilter: Record<string, Date> = {};
      if (query.fromDate) dateFilter.$gte = new Date(query.fromDate);
      if (query.toDate) dateFilter.$lte = new Date(query.toDate);
      filter.scheduledDate = dateFilter;
    }

    const [data, total] = await Promise.all([
      collections.careerCounselingSessions
        .find(filter)
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1, _id: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collections.careerCounselingSessions.countDocuments(filter),
    ]);

    return {
      data: data.map(this.formatSession),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async getById(tenantId: string, id: string) {
    const session = await collections.careerCounselingSessions.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!session) {
      throw new ApiError('SESSION_NOT_FOUND', 'Counseling session not found', 404);
    }

    return this.formatSession(session);
  }

  async create(tenantId: string, branchId: string, userId: string, data: Record<string, unknown>) {
    const now = new Date();
    const sessionNumber = await generateCounselingSessionNumber(tenantId, branchId);

    // Derive sessionType from audienceType for backward compat
    const audienceType = data.audienceType as string | undefined;
    if (audienceType && !data.sessionType) {
      if (audienceType === 'section' || audienceType === 'class') {
        data.sessionType = 'group';
      } else {
        data.sessionType = audienceType as string;
      }
    }

    const doc = {
      ...data,
      sessionNumber,
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      studentId: data.studentId ? new ObjectId(data.studentId as string) : undefined,
      studentIds: Array.isArray(data.studentIds)
        ? (data.studentIds as string[]).map((id) => new ObjectId(id))
        : undefined,
      classId: data.classId ? new ObjectId(data.classId as string) : undefined,
      sectionId: data.sectionId ? new ObjectId(data.sectionId as string) : undefined,
      counselorId: new ObjectId(userId),
      status: 'scheduled',
      createdBy: new ObjectId(userId),
      createdAt: now,
      updatedAt: now,
    };

    const result = await collections.careerCounselingSessions.insertOne(doc);

    return this.getById(tenantId, result.insertedId.toString());
  }

  async update(tenantId: string, id: string, data: Record<string, unknown>) {
    const session = await collections.careerCounselingSessions.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!session) {
      throw new ApiError('SESSION_NOT_FOUND', 'Counseling session not found', 404);
    }

    // Only scheduled sessions can be fully edited
    if (session.status !== 'scheduled') {
      throw new ApiError(
        'SESSION_NOT_EDITABLE',
        'Only scheduled sessions can be fully edited',
        400
      );
    }

    if (data.studentId) {
      data.studentId = new ObjectId(data.studentId as string);
    }
    if (Array.isArray(data.studentIds)) {
      data.studentIds = (data.studentIds as string[]).map((sid) => new ObjectId(sid));
    }
    if (data.classId) {
      data.classId = new ObjectId(data.classId as string);
    }
    if (data.sectionId) {
      data.sectionId = new ObjectId(data.sectionId as string);
    }

    await collections.careerCounselingSessions.updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...data, updatedAt: new Date() } }
    );

    return this.getById(tenantId, id);
  }

  async delete(tenantId: string, id: string) {
    const session = await collections.careerCounselingSessions.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!session) {
      throw new ApiError('SESSION_NOT_FOUND', 'Counseling session not found', 404);
    }

    if (session.status !== 'scheduled') {
      throw new ApiError('SESSION_NOT_DELETABLE', 'Only scheduled sessions can be deleted', 400);
    }

    await collections.careerCounselingSessions.deleteOne({ _id: new ObjectId(id) });
  }

  private formatSession(doc: Document) {
    return {
      ...doc,
      _id: doc._id.toString(),
      tenantId: doc.tenantId?.toString(),
      branchId: doc.branchId?.toString(),
      counselorId: doc.counselorId?.toString(),
      studentId: doc.studentId?.toString(),
      studentIds: Array.isArray(doc.studentIds)
        ? doc.studentIds.map((id: ObjectId) => id.toString())
        : doc.studentIds,
      classId: doc.classId?.toString(),
      sectionId: doc.sectionId?.toString(),
      createdBy: doc.createdBy?.toString(),
    };
  }
}

export const counselingService = new CounselingService();

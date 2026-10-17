import { ObjectId, Filter, Document, UpdateFilter } from 'mongodb';
import { collections } from '../../../config/database';
import { ApiError } from '../../../middleware/errorHandler';
import { getPagination, buildPaginationMeta } from '../../../utils/pagination';

class MentorshipService {
  async list(
    tenantId: string,
    branchId: string,
    query: {
      status?: string;
      mentorAlumniId?: string;
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

    if (query.status) filter.status = query.status;
    if (query.mentorAlumniId) filter.mentorAlumniId = new ObjectId(query.mentorAlumniId);

    const [data, total] = await Promise.all([
      collections.mentorshipPrograms
        .find(filter)
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1, _id: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collections.mentorshipPrograms.countDocuments(filter),
    ]);

    return {
      data: data.map(this.formatMentorship),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async getById(tenantId: string, id: string) {
    const mentorship = await collections.mentorshipPrograms.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!mentorship) {
      throw new ApiError('MENTORSHIP_NOT_FOUND', 'Mentorship program not found', 404);
    }

    return this.formatMentorship(mentorship);
  }

  async create(tenantId: string, branchId: string, userId: string, data: Record<string, unknown>) {
    // Validate mentor alumni profile exists
    const mentor = await collections.alumniProfiles.findOne({
      _id: new ObjectId(data.mentorAlumniId as string),
      tenantId: new ObjectId(tenantId),
    });

    if (!mentor) {
      throw new ApiError('ALUMNI_NOT_FOUND', 'Mentor alumni profile not found', 404);
    }

    const now = new Date();

    const doc = {
      ...data,
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      mentorAlumniId: new ObjectId(data.mentorAlumniId as string),
      menteeStudentId: new ObjectId(userId),
      status: 'requested',
      sessions: [],
      startDate: null,
      endDate: null,
      createdAt: now,
      updatedAt: now,
    };

    const result = await collections.mentorshipPrograms.insertOne(doc);

    return this.getById(tenantId, result.insertedId.toString());
  }

  async update(tenantId: string, id: string, data: Record<string, unknown>) {
    const mentorship = await collections.mentorshipPrograms.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!mentorship) {
      throw new ApiError('MENTORSHIP_NOT_FOUND', 'Mentorship program not found', 404);
    }

    const updateData: Record<string, unknown> = { ...data, updatedAt: new Date() };

    // Set startDate when status changes to active
    if (data.status === 'active' && mentorship.status !== 'active') {
      updateData.startDate = new Date();
    }

    // Set endDate when status changes to completed or cancelled
    if (
      (data.status === 'completed' || data.status === 'cancelled') &&
      mentorship.status !== 'completed' &&
      mentorship.status !== 'cancelled'
    ) {
      updateData.endDate = new Date();
    }

    await collections.mentorshipPrograms.updateOne({ _id: new ObjectId(id) }, { $set: updateData });

    return this.getById(tenantId, id);
  }

  async delete(tenantId: string, id: string) {
    const mentorship = await collections.mentorshipPrograms.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!mentorship) {
      throw new ApiError('MENTORSHIP_NOT_FOUND', 'Mentorship program not found', 404);
    }

    if (mentorship.status !== 'requested') {
      throw new ApiError(
        'MENTORSHIP_NOT_DELETABLE',
        'Only requested mentorship programs can be deleted',
        400
      );
    }

    await collections.mentorshipPrograms.deleteOne({ _id: new ObjectId(id) });
  }

  async addSession(
    tenantId: string,
    id: string,
    userId: string,
    sessionData: Record<string, unknown>
  ) {
    const mentorship = await collections.mentorshipPrograms.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!mentorship) {
      throw new ApiError('MENTORSHIP_NOT_FOUND', 'Mentorship program not found', 404);
    }

    if (mentorship.status !== 'active') {
      throw new ApiError(
        'MENTORSHIP_NOT_ACTIVE',
        'Only active mentorship programs can have sessions added',
        400
      );
    }

    const sessionDoc = {
      ...sessionData,
      _id: new ObjectId(),
      conductedBy: new ObjectId(userId),
      conductedAt: new Date(),
    };

    await collections.mentorshipPrograms.updateOne({ _id: new ObjectId(id) }, {
      $push: { sessions: sessionDoc },
      $set: { updatedAt: new Date() },
    } as unknown as UpdateFilter<Document>);

    return this.getById(tenantId, id);
  }

  private formatMentorship(doc: Document) {
    return {
      ...doc,
      _id: doc._id.toString(),
      tenantId: doc.tenantId?.toString(),
      branchId: doc.branchId?.toString(),
      mentorAlumniId: doc.mentorAlumniId?.toString(),
      menteeStudentId: doc.menteeStudentId?.toString(),
      sessions: (doc.sessions || []).map((s: Record<string, unknown>) => ({
        ...s,
        _id: (s._id as ObjectId)?.toString(),
        conductedBy: (s.conductedBy as ObjectId)?.toString(),
      })),
    };
  }
}

export const mentorshipService = new MentorshipService();

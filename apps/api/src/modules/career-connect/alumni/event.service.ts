import { ObjectId, Filter, Document, UpdateFilter } from 'mongodb';
import { collections } from '../../../config/database';
import { ApiError } from '../../../middleware/errorHandler';
import { getPagination, buildPaginationMeta } from '../../../utils/pagination';
import { generateAlumniEventNumber } from '../../../utils/generators';

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ['published'],
  published: ['completed', 'cancelled'],
};

class AlumniEventService {
  async list(
    tenantId: string,
    branchId: string,
    query: {
      search?: string;
      status?: string;
      type?: string;
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
      filter.title = { $regex: query.search, $options: 'i' };
    }
    if (query.status) filter.status = query.status;
    if (query.type) filter.type = query.type;
    if (query.fromDate || query.toDate) {
      filter.eventDate = {};
      if (query.fromDate) {
        (filter.eventDate as Record<string, unknown>).$gte = new Date(query.fromDate);
      }
      if (query.toDate) {
        (filter.eventDate as Record<string, unknown>).$lte = new Date(query.toDate);
      }
    }

    const [data, total] = await Promise.all([
      collections.alumniEvents
        .find(filter)
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1, _id: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collections.alumniEvents.countDocuments(filter),
    ]);

    return {
      data: data.map(this.formatEvent),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async getById(tenantId: string, id: string) {
    const event = await collections.alumniEvents.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!event) {
      throw new ApiError('EVENT_NOT_FOUND', 'Alumni event not found', 404);
    }

    return this.formatEvent(event);
  }

  async create(tenantId: string, branchId: string, userId: string, data: Record<string, unknown>) {
    const now = new Date();

    const eventNumber = await generateAlumniEventNumber(tenantId, branchId);

    const doc = {
      ...data,
      eventNumber,
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      status: 'draft',
      registrations: [],
      createdBy: new ObjectId(userId),
      createdAt: now,
      updatedAt: now,
    };

    const result = await collections.alumniEvents.insertOne(doc);

    return this.getById(tenantId, result.insertedId.toString());
  }

  async update(tenantId: string, id: string, data: Record<string, unknown>) {
    const event = await collections.alumniEvents.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!event) {
      throw new ApiError('EVENT_NOT_FOUND', 'Alumni event not found', 404);
    }

    if (!['draft', 'published'].includes(event.status as string)) {
      throw new ApiError('EVENT_NOT_EDITABLE', 'Only draft or published events can be edited', 400);
    }

    await collections.alumniEvents.updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...data, updatedAt: new Date() } }
    );

    return this.getById(tenantId, id);
  }

  async delete(tenantId: string, id: string) {
    const event = await collections.alumniEvents.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!event) {
      throw new ApiError('EVENT_NOT_FOUND', 'Alumni event not found', 404);
    }

    if (event.status !== 'draft') {
      throw new ApiError('EVENT_NOT_DELETABLE', 'Only draft events can be deleted', 400);
    }

    await collections.alumniEvents.deleteOne({ _id: new ObjectId(id) });
  }

  async updateStatus(tenantId: string, id: string, status: string) {
    const event = await collections.alumniEvents.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!event) {
      throw new ApiError('EVENT_NOT_FOUND', 'Alumni event not found', 404);
    }

    const currentStatus = event.status as string;
    const allowed = VALID_STATUS_TRANSITIONS[currentStatus] || [];

    if (!allowed.includes(status)) {
      throw new ApiError(
        'INVALID_STATUS_TRANSITION',
        `Cannot transition from ${currentStatus} to ${status}`,
        400
      );
    }

    await collections.alumniEvents.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status, updatedAt: new Date() } }
    );

    return this.getById(tenantId, id);
  }

  async register(tenantId: string, id: string, userId: string, userName: string) {
    const event = await collections.alumniEvents.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!event) {
      throw new ApiError('EVENT_NOT_FOUND', 'Alumni event not found', 404);
    }

    if (event.status !== 'published') {
      throw new ApiError(
        'REGISTRATION_NOT_OPEN',
        'Registration is only available for published events',
        400
      );
    }

    // Check capacity
    const registrations = (event.registrations as Array<Record<string, unknown>>) || [];
    if (event.maxCapacity && registrations.length >= (event.maxCapacity as number)) {
      throw new ApiError('EVENT_FULL', 'Event has reached maximum capacity', 400);
    }

    // Check if already registered
    const alreadyRegistered = registrations.some(
      (r) => (r.userId as ObjectId).toString() === userId
    );

    if (alreadyRegistered) {
      throw new ApiError('ALREADY_REGISTERED', 'User is already registered for this event', 400);
    }

    const registration = {
      userId: new ObjectId(userId),
      userName,
      registeredAt: new Date(),
    };

    await collections.alumniEvents.updateOne({ _id: new ObjectId(id) }, {
      $push: { registrations: registration },
      $set: { updatedAt: new Date() },
    } as unknown as UpdateFilter<Document>);

    return this.getById(tenantId, id);
  }

  private formatEvent(doc: Document) {
    return {
      ...doc,
      _id: doc._id.toString(),
      tenantId: doc.tenantId?.toString(),
      branchId: doc.branchId?.toString(),
      createdBy: doc.createdBy?.toString(),
      registrations: (doc.registrations || []).map((r: Record<string, unknown>) => ({
        ...r,
        userId: (r.userId as ObjectId)?.toString(),
      })),
    };
  }
}

export const alumniEventService = new AlumniEventService();

import { ObjectId, WithId, Document, Filter } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';

interface EventDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  title: string;
  description?: string;
  type: 'academic' | 'cultural' | 'sports' | 'exam' | 'ptm' | 'holiday';
  category?: string;
  startDate: Date;
  endDate: Date;
  isAllDay: boolean;
  startTime?: string;
  endTime?: string;
  timezone?: string;
  location?: {
    type: 'venue' | 'online' | 'hybrid';
    venue?: string;
    address?: string;
    meetingLink?: string;
  };
  audience?: {
    type: 'all' | 'staff' | 'students' | 'specific';
    branchIds?: ObjectId[];
    classIds?: ObjectId[];
    staffOnly?: boolean;
  };
  isRecurring: boolean;
  recurrence?: {
    pattern: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    daysOfWeek?: number[];
    endDate?: Date;
    occurrences?: number;
  };
  reminders?: Array<{
    type: 'email' | 'sms' | 'push';
    beforeMinutes: number;
  }>;
  status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEventInput {
  title: string;
  description?: string;
  type: 'academic' | 'cultural' | 'sports' | 'exam' | 'ptm' | 'holiday';
  category?: string;
  startDate: string;
  endDate: string;
  isAllDay?: boolean;
  startTime?: string;
  endTime?: string;
  location?: {
    type: 'venue' | 'online' | 'hybrid';
    venue?: string;
    address?: string;
    meetingLink?: string;
  };
  audience?: {
    type: 'all' | 'staff' | 'students' | 'specific';
    branchIds?: string[];
    classIds?: string[];
    staffOnly?: boolean;
  };
  isRecurring?: boolean;
  recurrence?: {
    pattern: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    daysOfWeek?: number[];
    endDate?: string;
    occurrences?: number;
  };
  reminders?: Array<{
    type: 'email' | 'sms' | 'push';
    beforeMinutes: number;
  }>;
}

export interface EventListParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

class EventService {
  async create(tenantId: string, branchId: string, data: CreateEventInput, createdBy: string) {
    const eventId = new ObjectId();
    const now = new Date();

    const event: Omit<EventDocument, '_id'> & { _id: ObjectId } = {
      _id: eventId,
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      title: data.title,
      description: data.description,
      type: data.type,
      category: data.category,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      isAllDay: data.isAllDay || false,
      startTime: data.startTime,
      endTime: data.endTime,
      location: data.location,
      audience: data.audience
        ? {
            type: data.audience.type,
            branchIds: data.audience.branchIds?.map((id) => new ObjectId(id)),
            classIds: data.audience.classIds?.map((id) => new ObjectId(id)),
            staffOnly: data.audience.staffOnly,
          }
        : undefined,
      isRecurring: data.isRecurring || false,
      recurrence: data.recurrence
        ? {
            ...data.recurrence,
            endDate: data.recurrence.endDate ? new Date(data.recurrence.endDate) : undefined,
          }
        : undefined,
      reminders: data.reminders,
      status: 'scheduled',
      createdBy: new ObjectId(createdBy),
      createdAt: now,
      updatedAt: now,
    };

    await collections.events.insertOne(event);

    logger.info({ eventId: eventId.toString(), title: data.title, tenantId }, 'Event created');

    return this.formatEvent(event as WithId<EventDocument>);
  }

  async findById(tenantId: string, eventId: string) {
    const event = (await collections.events.findOne({
      _id: new ObjectId(eventId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<EventDocument> | null;

    if (!event) {
      throw new ApiError('EVENT_NOT_FOUND', 'Event not found', 404);
    }

    return this.formatEvent(event);
  }

  async findAll(tenantId: string, branchId: string, params: EventListParams = {}) {
    const {
      page = 1,
      limit = 20,
      search,
      type,
      status,
      fromDate,
      toDate,
      sortBy = 'startDate',
      sortOrder = 'asc',
    } = params;

    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      $or: [{ branchId: new ObjectId(branchId) }, { 'audience.branchIds': new ObjectId(branchId) }],
    };

    if (search) {
      filter.$and = [
        {
          $or: [
            { title: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } },
          ],
        },
      ];
    }

    if (type) {
      filter.type = type;
    }

    if (status) {
      filter.status = status;
    }

    if (fromDate || toDate) {
      filter.startDate = {};
      if (fromDate) {
        (filter.startDate as Record<string, Date>).$gte = new Date(fromDate);
      }
      if (toDate) {
        (filter.startDate as Record<string, Date>).$lte = new Date(toDate);
      }
    }

    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const [events, total] = await Promise.all([
      collections.events
        .find(filter)
        .sort({ [sortBy]: sortDirection, _id: sortDirection })
        .skip(skip)
        .limit(limit)
        .toArray() as Promise<WithId<EventDocument>[]>,
      collections.events.countDocuments(filter),
    ]);

    return {
      data: events.map((e) => this.formatEvent(e)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + events.length < total,
      },
    };
  }

  async update(tenantId: string, eventId: string, data: Partial<CreateEventInput>) {
    const existing = (await collections.events.findOne({
      _id: new ObjectId(eventId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<EventDocument> | null;

    if (!existing) {
      throw new ApiError('EVENT_NOT_FOUND', 'Event not found', 404);
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
    if (data.endDate !== undefined) updateData.endDate = new Date(data.endDate);
    if (data.isAllDay !== undefined) updateData.isAllDay = data.isAllDay;
    if (data.startTime !== undefined) updateData.startTime = data.startTime;
    if (data.endTime !== undefined) updateData.endTime = data.endTime;
    if (data.location !== undefined) updateData.location = data.location;
    if (data.audience !== undefined) {
      updateData.audience = {
        type: data.audience.type,
        branchIds: data.audience.branchIds?.map((id) => new ObjectId(id)),
        classIds: data.audience.classIds?.map((id) => new ObjectId(id)),
        staffOnly: data.audience.staffOnly,
      };
    }
    if (data.isRecurring !== undefined) updateData.isRecurring = data.isRecurring;
    if (data.recurrence !== undefined) {
      updateData.recurrence = {
        ...data.recurrence,
        endDate: data.recurrence.endDate ? new Date(data.recurrence.endDate) : undefined,
      };
    }
    if (data.reminders !== undefined) updateData.reminders = data.reminders;

    await collections.events.updateOne({ _id: new ObjectId(eventId) }, { $set: updateData });

    logger.info({ eventId, tenantId }, 'Event updated');

    return this.findById(tenantId, eventId);
  }

  async delete(tenantId: string, eventId: string) {
    const event = await collections.events.findOne({
      _id: new ObjectId(eventId),
      tenantId: new ObjectId(tenantId),
    });

    if (!event) {
      throw new ApiError('EVENT_NOT_FOUND', 'Event not found', 404);
    }

    await collections.events.deleteOne({ _id: new ObjectId(eventId) });

    logger.info({ eventId, tenantId }, 'Event deleted');

    return { success: true };
  }

  async updateStatus(tenantId: string, eventId: string, status: EventDocument['status']) {
    const event = await collections.events.findOne({
      _id: new ObjectId(eventId),
      tenantId: new ObjectId(tenantId),
    });

    if (!event) {
      throw new ApiError('EVENT_NOT_FOUND', 'Event not found', 404);
    }

    await collections.events.updateOne(
      { _id: new ObjectId(eventId) },
      {
        $set: {
          status,
          updatedAt: new Date(),
        },
      }
    );

    return this.findById(tenantId, eventId);
  }

  async getUpcoming(tenantId: string, branchId: string, limit = 10) {
    const now = new Date();

    const events = (await collections.events
      .find({
        tenantId: new ObjectId(tenantId),
        $or: [
          { branchId: new ObjectId(branchId) },
          { 'audience.branchIds': new ObjectId(branchId) },
        ],
        startDate: { $gte: now },
        status: { $in: ['scheduled', 'ongoing'] },
      })
      .sort({ startDate: 1 })
      .limit(limit)
      .toArray()) as WithId<EventDocument>[];

    return events.map((e) => this.formatEvent(e));
  }

  async getCalendarEvents(tenantId: string, branchId: string, year: number, month: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const events = (await collections.events
      .find({
        tenantId: new ObjectId(tenantId),
        $and: [
          {
            $or: [
              { branchId: new ObjectId(branchId) },
              { 'audience.branchIds': new ObjectId(branchId) },
            ],
          },
          {
            $or: [
              { startDate: { $gte: startDate, $lte: endDate } },
              { endDate: { $gte: startDate, $lte: endDate } },
              {
                startDate: { $lte: startDate },
                endDate: { $gte: endDate },
              },
            ],
          },
        ],
      })
      .sort({ startDate: 1 })
      .toArray()) as WithId<EventDocument>[];

    return events.map((e) => this.formatEvent(e));
  }

  private formatEvent(event: WithId<EventDocument>) {
    return {
      _id: event._id.toString(),
      tenantId: event.tenantId.toString(),
      branchId: event.branchId.toString(),
      title: event.title,
      description: event.description,
      type: event.type,
      category: event.category,
      startDate: event.startDate,
      endDate: event.endDate,
      isAllDay: event.isAllDay,
      startTime: event.startTime,
      endTime: event.endTime,
      timezone: event.timezone,
      location: event.location,
      audience: event.audience
        ? {
            type: event.audience.type,
            branchIds: event.audience.branchIds?.map((id) => id.toString()),
            classIds: event.audience.classIds?.map((id) => id.toString()),
            staffOnly: event.audience.staffOnly,
          }
        : undefined,
      isRecurring: event.isRecurring,
      recurrence: event.recurrence,
      reminders: event.reminders,
      status: event.status,
      createdBy: event.createdBy.toString(),
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    };
  }
}

export const eventService = new EventService();

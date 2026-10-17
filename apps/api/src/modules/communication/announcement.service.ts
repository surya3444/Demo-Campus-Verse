import { ObjectId, WithId, Document, Filter } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';

interface AnnouncementDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  title: string;
  content: string;
  type: 'general' | 'urgent' | 'event' | 'holiday';
  priority: 'low' | 'medium' | 'high';
  audience: {
    type: 'all' | 'staff' | 'students' | 'parents' | 'specific';
    branchIds?: ObjectId[];
    classIds?: ObjectId[];
    roleIds?: ObjectId[];
  };
  publishAt?: Date;
  expiresAt?: Date;
  isPinned: boolean;
  attachments?: Array<{ name: string; url: string; type: string }>;
  status: 'draft' | 'pending-approval' | 'published' | 'archived';
  approvalRequired: boolean;
  approvedBy?: ObjectId;
  approvedAt?: Date;
  viewCount: number;
  acknowledgedBy?: ObjectId[];
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAnnouncementInput {
  title: string;
  content: string;
  type: 'general' | 'urgent' | 'event' | 'holiday';
  priority?: 'low' | 'medium' | 'high';
  audience?: {
    type: 'all' | 'staff' | 'students' | 'parents' | 'specific';
    branchIds?: string[];
    classIds?: string[];
    roleIds?: string[];
  };
  publishAt?: string;
  expiresAt?: string;
  isPinned?: boolean;
  attachments?: Array<{ name: string; url: string; type: string }>;
  approvalRequired?: boolean;
}

export interface AnnouncementListParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  status?: string;
  priority?: string;
  isPinned?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

class AnnouncementService {
  async create(
    tenantId: string,
    branchId: string,
    data: CreateAnnouncementInput,
    createdBy: string
  ) {
    const announcementId = new ObjectId();
    const now = new Date();

    const announcement: Omit<AnnouncementDocument, '_id'> & { _id: ObjectId } = {
      _id: announcementId,
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      title: data.title,
      content: data.content,
      type: data.type,
      priority: data.priority || 'medium',
      audience: {
        type: data.audience?.type || 'all',
        branchIds: data.audience?.branchIds?.map((id) => new ObjectId(id)),
        classIds: data.audience?.classIds?.map((id) => new ObjectId(id)),
        roleIds: data.audience?.roleIds?.map((id) => new ObjectId(id)),
      },
      publishAt: data.publishAt ? new Date(data.publishAt) : undefined,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      isPinned: data.isPinned || false,
      attachments: data.attachments,
      status: data.approvalRequired ? 'pending-approval' : 'draft',
      approvalRequired: data.approvalRequired || false,
      viewCount: 0,
      acknowledgedBy: [],
      createdBy: new ObjectId(createdBy),
      createdAt: now,
      updatedAt: now,
    };

    await collections.announcements.insertOne(announcement);

    logger.info(
      { announcementId: announcementId.toString(), title: data.title, tenantId },
      'Announcement created'
    );

    return this.formatAnnouncement(announcement as WithId<AnnouncementDocument>);
  }

  async findById(tenantId: string, announcementId: string) {
    const announcement = (await collections.announcements.findOne({
      _id: new ObjectId(announcementId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<AnnouncementDocument> | null;

    if (!announcement) {
      throw new ApiError('ANNOUNCEMENT_NOT_FOUND', 'Announcement not found', 404);
    }

    return this.formatAnnouncement(announcement);
  }

  async findAll(tenantId: string, branchId: string, params: AnnouncementListParams = {}) {
    const {
      page = 1,
      limit = 20,
      search,
      type,
      status,
      priority,
      isPinned,
      sortBy = 'createdAt',
      sortOrder = 'desc',
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
            { content: { $regex: search, $options: 'i' } },
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

    if (priority) {
      filter.priority = priority;
    }

    if (typeof isPinned === 'boolean') {
      filter.isPinned = isPinned;
    }

    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const [announcements, total] = await Promise.all([
      collections.announcements
        .find(filter)
        .sort({ isPinned: -1, [sortBy]: sortDirection, _id: sortDirection })
        .skip(skip)
        .limit(limit)
        .toArray() as Promise<WithId<AnnouncementDocument>[]>,
      collections.announcements.countDocuments(filter),
    ]);

    return {
      data: announcements.map((a) => this.formatAnnouncement(a)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + announcements.length < total,
      },
    };
  }

  async update(tenantId: string, announcementId: string, data: Partial<CreateAnnouncementInput>) {
    const existing = (await collections.announcements.findOne({
      _id: new ObjectId(announcementId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<AnnouncementDocument> | null;

    if (!existing) {
      throw new ApiError('ANNOUNCEMENT_NOT_FOUND', 'Announcement not found', 404);
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.title !== undefined) updateData.title = data.title;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.audience !== undefined) {
      updateData.audience = {
        type: data.audience.type || existing.audience.type,
        branchIds: data.audience.branchIds?.map((id) => new ObjectId(id)),
        classIds: data.audience.classIds?.map((id) => new ObjectId(id)),
        roleIds: data.audience.roleIds?.map((id) => new ObjectId(id)),
      };
    }
    if (data.publishAt !== undefined) updateData.publishAt = new Date(data.publishAt);
    if (data.expiresAt !== undefined) updateData.expiresAt = new Date(data.expiresAt);
    if (data.isPinned !== undefined) updateData.isPinned = data.isPinned;
    if (data.attachments !== undefined) updateData.attachments = data.attachments;

    await collections.announcements.updateOne(
      { _id: new ObjectId(announcementId) },
      { $set: updateData }
    );

    logger.info({ announcementId, tenantId }, 'Announcement updated');

    return this.findById(tenantId, announcementId);
  }

  async delete(tenantId: string, announcementId: string) {
    const announcement = await collections.announcements.findOne({
      _id: new ObjectId(announcementId),
      tenantId: new ObjectId(tenantId),
    });

    if (!announcement) {
      throw new ApiError('ANNOUNCEMENT_NOT_FOUND', 'Announcement not found', 404);
    }

    await collections.announcements.deleteOne({ _id: new ObjectId(announcementId) });

    logger.info({ announcementId, tenantId }, 'Announcement deleted');

    return { success: true };
  }

  async publish(tenantId: string, announcementId: string, publishedBy: string) {
    const announcement = (await collections.announcements.findOne({
      _id: new ObjectId(announcementId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<AnnouncementDocument> | null;

    if (!announcement) {
      throw new ApiError('ANNOUNCEMENT_NOT_FOUND', 'Announcement not found', 404);
    }

    if (announcement.status === 'published') {
      throw new ApiError('ALREADY_PUBLISHED', 'Announcement is already published', 400);
    }

    const now = new Date();

    await collections.announcements.updateOne(
      { _id: new ObjectId(announcementId) },
      {
        $set: {
          status: 'published',
          publishAt: now,
          approvedBy: new ObjectId(publishedBy),
          approvedAt: now,
          updatedAt: now,
        },
      }
    );

    logger.info({ announcementId, publishedBy }, 'Announcement published');

    return this.findById(tenantId, announcementId);
  }

  async archive(tenantId: string, announcementId: string) {
    const announcement = await collections.announcements.findOne({
      _id: new ObjectId(announcementId),
      tenantId: new ObjectId(tenantId),
    });

    if (!announcement) {
      throw new ApiError('ANNOUNCEMENT_NOT_FOUND', 'Announcement not found', 404);
    }

    await collections.announcements.updateOne(
      { _id: new ObjectId(announcementId) },
      {
        $set: {
          status: 'archived',
          updatedAt: new Date(),
        },
      }
    );

    return this.findById(tenantId, announcementId);
  }

  async incrementViewCount(tenantId: string, announcementId: string) {
    await collections.announcements.updateOne(
      { _id: new ObjectId(announcementId), tenantId: new ObjectId(tenantId) },
      { $inc: { viewCount: 1 } }
    );
  }

  async acknowledge(tenantId: string, announcementId: string, userId: string) {
    await collections.announcements.updateOne(
      { _id: new ObjectId(announcementId), tenantId: new ObjectId(tenantId) },
      { $addToSet: { acknowledgedBy: new ObjectId(userId) } }
    );
  }

  private formatAnnouncement(announcement: WithId<AnnouncementDocument>) {
    return {
      _id: announcement._id.toString(),
      tenantId: announcement.tenantId.toString(),
      branchId: announcement.branchId.toString(),
      title: announcement.title,
      content: announcement.content,
      type: announcement.type,
      priority: announcement.priority,
      audience: {
        type: announcement.audience.type,
        branchIds: announcement.audience.branchIds?.map((id) => id.toString()),
        classIds: announcement.audience.classIds?.map((id) => id.toString()),
        roleIds: announcement.audience.roleIds?.map((id) => id.toString()),
      },
      publishAt: announcement.publishAt,
      expiresAt: announcement.expiresAt,
      isPinned: announcement.isPinned,
      attachments: announcement.attachments,
      status: announcement.status,
      approvalRequired: announcement.approvalRequired,
      approvedBy: announcement.approvedBy?.toString(),
      approvedAt: announcement.approvedAt,
      viewCount: announcement.viewCount,
      acknowledgedBy: announcement.acknowledgedBy?.map((id) => id.toString()),
      createdBy: announcement.createdBy.toString(),
      createdAt: announcement.createdAt,
      updatedAt: announcement.updatedAt,
    };
  }
}

export const announcementService = new AnnouncementService();

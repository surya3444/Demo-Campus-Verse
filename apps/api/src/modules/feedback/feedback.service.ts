import { ObjectId, Filter, Document, UpdateFilter } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { generateTicketNumber } from '../../utils/generators';
import { generateId } from '../../utils/generators';

const ADMIN_ROLES = ['GROUP_OWNER', 'ORG_MODERATOR', 'ORG_ADMIN', 'BRANCH_ADMIN'];
const OWNER_ROLES = ['GROUP_OWNER', 'ORG_MODERATOR', 'ORG_ADMIN'];

const VALID_TRANSITIONS: Record<string, string[]> = {
  open: ['in_progress', 'escalated', 'closed'],
  in_progress: ['resolved', 'escalated', 'closed'],
  escalated: ['in_progress', 'resolved', 'closed'],
  resolved: ['closed', 'reopened'],
  reopened: ['in_progress', 'escalated', 'closed'],
};

export interface TicketListParams {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  category?: string;
  priority?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

class FeedbackService {
  async findAll(
    tenantId: string,
    branchId: string,
    userId: string,
    roleCode: string,
    params: TicketListParams
  ) {
    try {
      const skip = (params.page - 1) * params.limit;
      const isAdmin = ADMIN_ROLES.includes(roleCode);

      const filter: Filter<Document> = {
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
      };

      // Non-admins see only their own tickets
      if (!isAdmin) {
        filter.submittedBy = new ObjectId(userId);
      }

      if (params.search) {
        filter.$or = [
          { subject: { $regex: params.search, $options: 'i' } },
          { ticketNumber: { $regex: params.search, $options: 'i' } },
          { submitterName: { $regex: params.search, $options: 'i' } },
        ];
      }

      if (params.status) filter.status = params.status;
      if (params.category) filter.category = params.category;
      if (params.priority) filter.priority = params.priority;

      const sortBy = params.sortBy || 'createdAt';
      const sortOrder = params.sortOrder === 'asc' ? 1 : -1;

      const [data, total] = await Promise.all([
        collections.feedbackTickets
          .find(filter)
          .sort({ [sortBy]: sortOrder, _id: sortOrder })
          .skip(skip)
          .limit(params.limit)
          .toArray(),
        collections.feedbackTickets.countDocuments(filter),
      ]);

      return {
        data: data.map((doc) => this.formatTicket(doc, roleCode)),
        meta: {
          page: params.page,
          limit: params.limit,
          total,
          totalPages: Math.ceil(total / params.limit),
          hasMore: skip + params.limit < total,
        },
      };
    } catch (error) {
      logger.error({ err: error }, 'Failed to fetch feedback tickets');
      throw error;
    }
  }

  async getStats(tenantId: string, branchId: string) {
    try {
      const baseFilter = {
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
      };

      const [total, open, inProgress, escalated, resolved, closed] = await Promise.all([
        collections.feedbackTickets.countDocuments(baseFilter),
        collections.feedbackTickets.countDocuments({ ...baseFilter, status: 'open' }),
        collections.feedbackTickets.countDocuments({ ...baseFilter, status: 'in_progress' }),
        collections.feedbackTickets.countDocuments({ ...baseFilter, status: 'escalated' }),
        collections.feedbackTickets.countDocuments({ ...baseFilter, status: 'resolved' }),
        collections.feedbackTickets.countDocuments({ ...baseFilter, status: 'closed' }),
      ]);

      // Category breakdown
      const categoryBreakdown = await collections.feedbackTickets
        .aggregate([
          { $match: { ...baseFilter, status: { $nin: ['closed'] } } },
          { $group: { _id: '$category', count: { $sum: 1 } } },
        ])
        .toArray();

      return {
        total,
        open,
        inProgress,
        escalated,
        resolved,
        closed,
        categoryBreakdown: categoryBreakdown.map((c) => ({
          category: c._id,
          count: c.count,
        })),
      };
    } catch (error) {
      logger.error({ err: error }, 'Failed to fetch feedback stats');
      throw error;
    }
  }

  async findById(tenantId: string, id: string, userId: string, roleCode: string) {
    try {
      const ticket = await collections.feedbackTickets.findOne({
        _id: new ObjectId(id),
        tenantId: new ObjectId(tenantId),
      });

      if (!ticket) {
        throw new ApiError('NOT_FOUND', 'Ticket not found', 404);
      }

      // Non-admins can only see their own tickets
      const isAdmin = ADMIN_ROLES.includes(roleCode);
      if (!isAdmin && ticket.submittedBy.toString() !== userId) {
        throw new ApiError('FORBIDDEN', 'You can only view your own tickets', 403);
      }

      return this.formatTicket(ticket, roleCode);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error }, 'Failed to fetch feedback ticket');
      throw error;
    }
  }

  private async getUserName(userId: string): Promise<string> {
    const user = await collections.users.findOne(
      { _id: new ObjectId(userId) },
      { projection: { firstName: 1, lastName: 1, email: 1 } }
    );
    if (!user) return 'Unknown';
    if (user.firstName) return `${user.firstName} ${user.lastName || ''}`.trim();
    return user.email || 'Unknown';
  }

  async create(
    tenantId: string,
    branchId: string,
    data: Record<string, unknown>,
    userId: string,
    submitterType: 'student' | 'staff'
  ) {
    try {
      const ticketNumber = await generateTicketNumber(tenantId, branchId);
      const userName = await this.getUserName(userId);
      const now = new Date();

      const result = await collections.feedbackTickets.insertOne({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        ticketNumber,
        submittedBy: new ObjectId(userId),
        submitterType,
        submitterName: userName,
        isAnonymous: data.isAnonymous || false,
        subject: data.subject,
        description: data.description,
        category: data.category,
        priority: data.priority || 'medium',
        status: 'open',
        assignedTo: null,
        assignedToName: null,
        assignedAt: null,
        responses: [],
        resolvedAt: null,
        resolvedBy: null,
        resolutionNote: null,
        satisfaction: null,
        escalatedAt: null,
        closedAt: null,
        reopenedAt: null,
        createdBy: new ObjectId(userId),
        createdAt: now,
        updatedAt: now,
      });

      return this.findById(tenantId, result.insertedId.toString(), userId, 'ORG_OWNER');
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error }, 'Failed to create feedback ticket');
      throw error;
    }
  }

  async update(
    tenantId: string,
    id: string,
    data: Record<string, unknown>,
    userId: string,
    roleCode: string
  ) {
    try {
      const ticket = await collections.feedbackTickets.findOne({
        _id: new ObjectId(id),
        tenantId: new ObjectId(tenantId),
      });

      if (!ticket) {
        throw new ApiError('NOT_FOUND', 'Ticket not found', 404);
      }

      const isAdmin = ADMIN_ROLES.includes(roleCode);
      if (!isAdmin && ticket.submittedBy.toString() !== userId) {
        throw new ApiError('FORBIDDEN', 'You can only edit your own tickets', 403);
      }

      if (!isAdmin && ticket.status !== 'open') {
        throw new ApiError('INVALID_STATUS', 'Can only edit tickets in open status', 400);
      }

      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      const fields = ['subject', 'description', 'category', 'priority'];
      for (const field of fields) {
        if (data[field] !== undefined) updateData[field] = data[field];
      }

      const result = await collections.feedbackTickets.findOneAndUpdate(
        { _id: new ObjectId(id), tenantId: new ObjectId(tenantId) },
        { $set: updateData },
        { returnDocument: 'after' }
      );

      return this.formatTicket(result!, roleCode);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error }, 'Failed to update feedback ticket');
      throw error;
    }
  }

  async delete(tenantId: string, id: string) {
    try {
      const result = await collections.feedbackTickets.deleteOne({
        _id: new ObjectId(id),
        tenantId: new ObjectId(tenantId),
      });

      if (result.deletedCount === 0) {
        throw new ApiError('NOT_FOUND', 'Ticket not found', 404);
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error }, 'Failed to delete feedback ticket');
      throw error;
    }
  }

  async assignTicket(tenantId: string, id: string, assignedTo: string, assignedToName: string) {
    try {
      const now = new Date();
      const result = await collections.feedbackTickets.findOneAndUpdate(
        { _id: new ObjectId(id), tenantId: new ObjectId(tenantId) },
        {
          $set: {
            assignedTo: new ObjectId(assignedTo),
            assignedToName,
            assignedAt: now,
            status: 'in_progress',
            updatedAt: now,
          },
        },
        { returnDocument: 'after' }
      );

      if (!result) {
        throw new ApiError('NOT_FOUND', 'Ticket not found', 404);
      }

      return this.formatTicket(result, 'BRANCH_ADMIN');
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error }, 'Failed to assign feedback ticket');
      throw error;
    }
  }

  async updateStatus(
    tenantId: string,
    id: string,
    newStatus: string,
    resolutionNote: string | undefined,
    userId: string,
    roleCode: string
  ) {
    try {
      const ticket = await collections.feedbackTickets.findOne({
        _id: new ObjectId(id),
        tenantId: new ObjectId(tenantId),
      });

      if (!ticket) {
        throw new ApiError('NOT_FOUND', 'Ticket not found', 404);
      }

      // Submitter can reopen their own resolved ticket
      const isAdmin = ADMIN_ROLES.includes(roleCode);
      const isSubmitter = ticket.submittedBy.toString() === userId;

      if (!isAdmin && !(isSubmitter && newStatus === 'reopened' && ticket.status === 'resolved')) {
        throw new ApiError('FORBIDDEN', 'Not authorized to change ticket status', 403);
      }

      const validNext = VALID_TRANSITIONS[ticket.status] || [];
      if (!validNext.includes(newStatus)) {
        throw new ApiError(
          'INVALID_TRANSITION',
          `Cannot change status from "${ticket.status}" to "${newStatus}"`,
          400
        );
      }

      const now = new Date();
      const updateData: Record<string, unknown> = {
        status: newStatus,
        updatedAt: now,
      };

      if (newStatus === 'resolved') {
        updateData.resolvedAt = now;
        updateData.resolvedBy = new ObjectId(userId);
        if (resolutionNote) updateData.resolutionNote = resolutionNote;
      } else if (newStatus === 'closed') {
        updateData.closedAt = now;
      } else if (newStatus === 'reopened') {
        updateData.reopenedAt = now;
        updateData.resolvedAt = null;
        updateData.resolvedBy = null;
        updateData.resolutionNote = null;
        updateData.satisfaction = null;
      } else if (newStatus === 'escalated') {
        updateData.escalatedAt = now;
      }

      const result = await collections.feedbackTickets.findOneAndUpdate(
        { _id: new ObjectId(id), tenantId: new ObjectId(tenantId) },
        { $set: updateData },
        { returnDocument: 'after' }
      );

      return this.formatTicket(result!, roleCode);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error }, 'Failed to update feedback ticket status');
      throw error;
    }
  }

  async escalateTicket(tenantId: string, id: string, userId: string) {
    return this.updateStatus(tenantId, id, 'escalated', undefined, userId, 'BRANCH_ADMIN');
  }

  async addResponse(
    tenantId: string,
    ticketId: string,
    message: string,
    isInternal: boolean,
    userId: string,
    roleCode: string
  ) {
    try {
      const ticket = await collections.feedbackTickets.findOne({
        _id: new ObjectId(ticketId),
        tenantId: new ObjectId(tenantId),
      });

      if (!ticket) {
        throw new ApiError('NOT_FOUND', 'Ticket not found', 404);
      }

      const isAdmin = ADMIN_ROLES.includes(roleCode);
      if (!isAdmin && ticket.submittedBy.toString() !== userId) {
        throw new ApiError('FORBIDDEN', 'Not authorized to respond to this ticket', 403);
      }

      // Non-admins cannot add internal notes
      if (!isAdmin && isInternal) {
        throw new ApiError('FORBIDDEN', 'Only admins can add internal notes', 403);
      }

      if (ticket.status === 'closed') {
        throw new ApiError('INVALID_STATUS', 'Cannot add responses to a closed ticket', 400);
      }

      const respondedByName = await this.getUserName(userId);

      const response = {
        _id: generateId(),
        message,
        respondedBy: new ObjectId(userId),
        respondedByName,
        isInternal,
        createdAt: new Date(),
      };

      const result = await collections.feedbackTickets.findOneAndUpdate(
        { _id: new ObjectId(ticketId), tenantId: new ObjectId(tenantId) },
        {
          $push: { responses: response },
          $set: { updatedAt: new Date() },
        } as unknown as UpdateFilter<Document>,
        { returnDocument: 'after' }
      );

      return this.formatTicket(result!, roleCode);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error }, 'Failed to add response to feedback ticket');
      throw error;
    }
  }

  async submitSatisfaction(
    tenantId: string,
    ticketId: string,
    userId: string,
    rating: number,
    comment?: string
  ) {
    try {
      const ticket = await collections.feedbackTickets.findOne({
        _id: new ObjectId(ticketId),
        tenantId: new ObjectId(tenantId),
      });

      if (!ticket) {
        throw new ApiError('NOT_FOUND', 'Ticket not found', 404);
      }

      if (ticket.submittedBy.toString() !== userId) {
        throw new ApiError('FORBIDDEN', 'Only the ticket submitter can rate satisfaction', 403);
      }

      if (ticket.status !== 'resolved') {
        throw new ApiError(
          'INVALID_STATUS',
          'Can only rate satisfaction for resolved tickets',
          400
        );
      }

      if (ticket.satisfaction) {
        throw new ApiError('ALREADY_RATED', 'Satisfaction has already been submitted', 400);
      }

      const result = await collections.feedbackTickets.findOneAndUpdate(
        { _id: new ObjectId(ticketId), tenantId: new ObjectId(tenantId) },
        {
          $set: {
            satisfaction: {
              rating,
              comment: comment || null,
              submittedAt: new Date(),
            },
            updatedAt: new Date(),
          },
        },
        { returnDocument: 'after' }
      );

      return this.formatTicket(result!, 'STUDENT');
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error }, 'Failed to submit satisfaction');
      throw error;
    }
  }

  private formatTicket(doc: Document, roleCode: string) {
    const isOwner = OWNER_ROLES.includes(roleCode);
    const isAdmin = ADMIN_ROLES.includes(roleCode);

    const formatted: Record<string, unknown> = {
      ...doc,
      _id: doc._id.toString(),
      tenantId: doc.tenantId.toString(),
      branchId: doc.branchId.toString(),
      submittedBy: doc.submittedBy?.toString(),
      submitterName: doc.submitterName,
      assignedTo: doc.assignedTo?.toString() || null,
      resolvedBy: doc.resolvedBy?.toString() || null,
      createdBy: doc.createdBy?.toString(),
      responses: (doc.responses || []).map((r: Record<string, unknown>) => ({
        ...r,
        respondedBy: (r.respondedBy as ObjectId)?.toString(),
      })),
    };

    // Anonymous masking: hide submitter identity for non-owner admins
    if (doc.isAnonymous && !isOwner) {
      formatted.submittedBy = null;
      formatted.submitterName = 'Anonymous';
    }

    // Non-admins don't see internal responses
    if (!isAdmin) {
      formatted.responses = (formatted.responses as Record<string, unknown>[]).filter(
        (r) => !r.isInternal
      );
    }

    return formatted;
  }
}

export const feedbackService = new FeedbackService();

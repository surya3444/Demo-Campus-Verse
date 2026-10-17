import { ObjectId, WithId, Document, Filter, UpdateFilter } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { generateLeadNumber } from '../../utils/generators';

interface LeadDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  leadNumber: string;
  firstName: string;
  lastName: string;
  displayName: string;
  dateOfBirth?: Date;
  gender?: string;
  contact: {
    email?: string;
    phone: string;
    alternatePhone?: string;
  };
  parents?: {
    father?: { name: string; phone?: string; occupation?: string };
    mother?: { name: string; phone?: string; occupation?: string };
  };
  interestedIn: {
    academicBatchId?: ObjectId;
    classId?: ObjectId;
    stream?: string;
  };
  source: 'walk_in' | 'referral' | 'website' | 'social_media' | 'advertisement' | 'event' | 'other';
  sourceDetails?: string;
  referredBy?: string;
  assignedTo?: ObjectId;
  stage:
    | 'new'
    | 'contacted'
    | 'interested'
    | 'followup'
    | 'visit_scheduled'
    | 'visited'
    | 'converted'
    | 'lost';
  stageHistory: Array<{
    stage: string;
    date: Date;
    changedBy: ObjectId;
    notes?: string;
  }>;
  followups: Array<{
    _id?: ObjectId;
    date: Date;
    type: 'call' | 'email' | 'visit' | 'meeting';
    notes: string;
    nextFollowupDate?: Date;
    createdBy: ObjectId;
    completedAt?: Date;
    completedBy?: ObjectId;
    outcome?: 'interested' | 'not_interested' | 'no_response' | 'callback_requested' | 'converted';
  }>;
  nextFollowupDate?: Date;
  lostReason?: string;
  applicationId?: ObjectId;
  notes?: string;
  tags?: string[];
  customFields?: Record<string, unknown>;
  status: 'active' | 'converted' | 'lost';
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateLeadInput {
  firstName: string;
  lastName: string;
  dateOfBirth?: Date;
  gender?: string;
  contact: {
    email?: string;
    phone: string;
    alternatePhone?: string;
  };
  parents?: {
    father?: { name: string; phone?: string; occupation?: string };
    mother?: { name: string; phone?: string; occupation?: string };
  };
  interestedIn: {
    academicBatchId?: string;
    classId?: string;
    stream?: string;
  };
  source: 'walk_in' | 'referral' | 'website' | 'social_media' | 'advertisement' | 'event' | 'other';
  sourceDetails?: string;
  referredBy?: string;
  assignedTo?: string;
  notes?: string;
  tags?: string[];
  customFields?: Record<string, unknown>;
}

export interface LeadListParams {
  /** Caller's scoped classes (middleware/scope.ts); null/undefined = unrestricted. */
  restrictToClassIds?: ObjectId[] | null;
  page?: number;
  limit?: number;
  search?: string;
  stage?: string | string[];
  source?: string;
  assignedTo?: string;
  status?: string;
  hasFollowupDue?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

class LeadService {
  async create(tenantId: string, branchId: string, data: CreateLeadInput, createdBy: string) {
    const leadNumber = await generateLeadNumber(tenantId, branchId);
    const leadId = new ObjectId();
    const now = new Date();

    const lead: Omit<LeadDocument, '_id'> & { _id: ObjectId } = {
      _id: leadId,
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      leadNumber,
      firstName: data.firstName,
      lastName: data.lastName,
      displayName: `${data.firstName} ${data.lastName}`,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
      gender: data.gender,
      contact: data.contact,
      parents: data.parents,
      interestedIn: {
        ...(data.interestedIn.academicBatchId && {
          academicBatchId: new ObjectId(data.interestedIn.academicBatchId),
        }),
        ...(data.interestedIn.classId && { classId: new ObjectId(data.interestedIn.classId) }),
        stream: data.interestedIn.stream,
      },
      source: data.source,
      sourceDetails: data.sourceDetails,
      referredBy: data.referredBy,
      ...(data.assignedTo && { assignedTo: new ObjectId(data.assignedTo) }),
      stage: 'new',
      stageHistory: [
        {
          stage: 'new',
          date: now,
          changedBy: new ObjectId(createdBy),
          notes: 'Lead created',
        },
      ],
      followups: [],
      notes: data.notes,
      tags: data.tags,
      customFields: data.customFields,
      status: 'active',
      createdBy: new ObjectId(createdBy),
      createdAt: now,
      updatedAt: now,
    };

    await collections.leads.insertOne(lead);

    logger.info({ leadId: leadId.toString(), leadNumber, tenantId, branchId }, 'Lead created');

    return this.formatLead(lead as WithId<LeadDocument>);
  }

  async findById(tenantId: string, leadId: string) {
    const lead = (await collections.leads.findOne({
      _id: new ObjectId(leadId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<LeadDocument> | null;

    if (!lead) {
      throw new ApiError('LEAD_NOT_FOUND', 'Lead not found', 404);
    }

    return this.formatLead(lead);
  }

  async findAll(tenantId: string, branchId: string, params: LeadListParams = {}) {
    const {
      page = 1,
      limit = 20,
      search,
      stage,
      source,
      assignedTo,
      status,
      hasFollowupDue,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    if (params.restrictToClassIds) {
      // $and so an explicit class filter below can only narrow, never widen.
      filter.$and = [{ 'interestedIn.classId': { $in: params.restrictToClassIds } }];
    }

    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { leadNumber: { $regex: search, $options: 'i' } },
        { 'contact.phone': { $regex: search, $options: 'i' } },
        { 'contact.email': { $regex: search, $options: 'i' } },
      ];
    }

    if (stage) {
      if (Array.isArray(stage)) {
        filter.stage = { $in: stage };
      } else {
        filter.stage = stage;
      }
    }

    if (source) {
      filter.source = source;
    }

    if (assignedTo) {
      filter.assignedTo = new ObjectId(assignedTo);
    }

    if (status) {
      filter.status = status;
    } else {
      filter.status = 'active';
    }

    if (hasFollowupDue) {
      filter.nextFollowupDate = { $lte: new Date() };
    }

    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const [leads, total] = await Promise.all([
      collections.leads
        .find(filter)
        .sort({ [sortBy]: sortDirection, _id: sortDirection })
        .skip(skip)
        .limit(limit)
        .toArray() as Promise<WithId<LeadDocument>[]>,
      collections.leads.countDocuments(filter),
    ]);

    return {
      data: leads.map((lead) => this.formatLead(lead)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + leads.length < total,
      },
    };
  }

  async update(tenantId: string, leadId: string, data: Partial<CreateLeadInput>) {
    const existingLead = (await collections.leads.findOne({
      _id: new ObjectId(leadId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<LeadDocument> | null;

    if (!existingLead) {
      throw new ApiError('LEAD_NOT_FOUND', 'Lead not found', 404);
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.firstName !== undefined) {
      updateData.firstName = data.firstName;
      updateData.displayName = `${data.firstName} ${data.lastName || existingLead.lastName}`;
    }
    if (data.lastName !== undefined) {
      updateData.lastName = data.lastName;
      updateData.displayName = `${data.firstName || existingLead.firstName} ${data.lastName}`;
    }
    if (data.dateOfBirth !== undefined) updateData.dateOfBirth = new Date(data.dateOfBirth);
    if (data.gender !== undefined) updateData.gender = data.gender;
    if (data.contact !== undefined) updateData.contact = data.contact;
    if (data.parents !== undefined) updateData.parents = data.parents;
    if (data.interestedIn !== undefined) {
      updateData.interestedIn = {
        ...(data.interestedIn.academicBatchId && {
          academicBatchId: new ObjectId(data.interestedIn.academicBatchId),
        }),
        ...(data.interestedIn.classId && { classId: new ObjectId(data.interestedIn.classId) }),
        stream: data.interestedIn.stream,
      };
    }
    if (data.source !== undefined) updateData.source = data.source;
    if (data.sourceDetails !== undefined) updateData.sourceDetails = data.sourceDetails;
    if (data.referredBy !== undefined) updateData.referredBy = data.referredBy;
    if (data.assignedTo !== undefined) updateData.assignedTo = new ObjectId(data.assignedTo);
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.customFields !== undefined) updateData.customFields = data.customFields;

    await collections.leads.updateOne({ _id: new ObjectId(leadId) }, { $set: updateData });

    logger.info({ leadId, tenantId }, 'Lead updated');

    return this.findById(tenantId, leadId);
  }

  async updateStage(
    tenantId: string,
    leadId: string,
    stage: LeadDocument['stage'],
    notes: string | undefined,
    changedBy: string
  ) {
    const lead = (await collections.leads.findOne({
      _id: new ObjectId(leadId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<LeadDocument> | null;

    if (!lead) {
      throw new ApiError('LEAD_NOT_FOUND', 'Lead not found', 404);
    }

    const now = new Date();
    const stageEntry = {
      stage,
      date: now,
      changedBy: new ObjectId(changedBy),
      notes,
    };

    const updateData: Record<string, unknown> = {
      stage,
      updatedAt: now,
    };

    // If stage is converted or lost, update status accordingly
    if (stage === 'converted') {
      updateData.status = 'converted';
    } else if (stage === 'lost') {
      updateData.status = 'lost';
    }

    await collections.leads.updateOne({ _id: new ObjectId(leadId) }, {
      $set: updateData,
      $push: { stageHistory: stageEntry },
    } as unknown as UpdateFilter<Document>);

    logger.info({ leadId, tenantId, stage, changedBy }, 'Lead stage updated');

    return this.findById(tenantId, leadId);
  }

  async addFollowup(
    tenantId: string,
    leadId: string,
    followup: {
      type: 'call' | 'email' | 'visit' | 'meeting';
      notes: string;
      nextFollowupDate?: Date;
    },
    createdBy: string
  ) {
    const lead = await collections.leads.findOne({
      _id: new ObjectId(leadId),
      tenantId: new ObjectId(tenantId),
    });

    if (!lead) {
      throw new ApiError('LEAD_NOT_FOUND', 'Lead not found', 404);
    }

    const now = new Date();
    const followupEntry = {
      _id: new ObjectId(),
      date: now,
      type: followup.type,
      notes: followup.notes,
      nextFollowupDate: followup.nextFollowupDate ? new Date(followup.nextFollowupDate) : undefined,
      createdBy: new ObjectId(createdBy),
    };

    await collections.leads.updateOne({ _id: new ObjectId(leadId) }, {
      $set: {
        updatedAt: now,
        nextFollowupDate: followup.nextFollowupDate ? new Date(followup.nextFollowupDate) : null,
        stage: (lead as LeadDocument).stage === 'new' ? 'contacted' : (lead as LeadDocument).stage,
      },
      $push: { followups: followupEntry },
    } as unknown as UpdateFilter<Document>);

    logger.info({ leadId, tenantId, followupType: followup.type }, 'Followup added');

    return this.findById(tenantId, leadId);
  }

  async completeFollowup(
    tenantId: string,
    leadId: string,
    followupIndex: number,
    data: {
      outcome: 'interested' | 'not_interested' | 'no_response' | 'callback_requested' | 'converted';
      notes?: string;
      nextFollowupDate?: string;
    },
    completedBy: string
  ) {
    const lead = (await collections.leads.findOne({
      _id: new ObjectId(leadId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<LeadDocument> | null;

    if (!lead) {
      throw new ApiError('LEAD_NOT_FOUND', 'Lead not found', 404);
    }

    if (!lead.followups || followupIndex < 0 || followupIndex >= lead.followups.length) {
      throw new ApiError('FOLLOWUP_NOT_FOUND', 'Followup not found at specified index', 404);
    }

    const followup = lead.followups[followupIndex];
    if (followup.completedAt) {
      throw new ApiError(
        'FOLLOWUP_ALREADY_COMPLETED',
        'This followup has already been completed',
        400
      );
    }

    const now = new Date();
    const setFields: Record<string, unknown> = {
      [`followups.${followupIndex}.completedAt`]: now,
      [`followups.${followupIndex}.completedBy`]: new ObjectId(completedBy),
      [`followups.${followupIndex}.outcome`]: data.outcome,
      updatedAt: now,
    };

    if (data.notes) {
      setFields[`followups.${followupIndex}.notes`] = `${followup.notes}\n[Outcome: ${data.notes}]`;
    }

    if (data.nextFollowupDate) {
      setFields.nextFollowupDate = new Date(data.nextFollowupDate);
    } else {
      // Check if there are other pending followups
      const hasPendingFollowups = lead.followups.some(
        (f, i) => i !== followupIndex && !f.completedAt
      );
      if (!hasPendingFollowups) {
        setFields.nextFollowupDate = null;
      }
    }

    await collections.leads.updateOne({ _id: new ObjectId(leadId) }, { $set: setFields });

    logger.info({ leadId, tenantId, followupIndex, outcome: data.outcome }, 'Followup completed');

    return this.findById(tenantId, leadId);
  }

  async delete(tenantId: string, leadId: string) {
    const lead = await collections.leads.findOne({
      _id: new ObjectId(leadId),
      tenantId: new ObjectId(tenantId),
    });

    if (!lead) {
      throw new ApiError('LEAD_NOT_FOUND', 'Lead not found', 404);
    }

    await collections.leads.deleteOne({ _id: new ObjectId(leadId) });

    logger.info({ leadId, tenantId }, 'Lead deleted');

    return { success: true };
  }

  async getStats(tenantId: string, branchId: string) {
    const filter = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      status: 'active',
    };

    const pipeline = [
      { $match: filter },
      {
        $group: {
          _id: '$stage',
          count: { $sum: 1 },
        },
      },
    ];

    const stageStats = await collections.leads.aggregate(pipeline).toArray();
    const total = await collections.leads.countDocuments(filter);
    const followupDue = await collections.leads.countDocuments({
      ...filter,
      nextFollowupDate: { $lte: new Date() },
    });

    return {
      total,
      followupDue,
      byStage: Object.fromEntries(stageStats.map((s) => [s._id, s.count])),
    };
  }

  async getFollowupsDue(
    tenantId: string,
    branchId: string,
    params: {
      date?: string;
      assignedTo?: string;
      page?: number;
      limit?: number;
    } = {}
  ) {
    const { date, assignedTo, page = 1, limit = 20 } = params;

    // If date is provided, use that date's range, otherwise use today
    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const filter: Record<string, unknown> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      status: 'active',
      nextFollowupDate: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    };

    if (assignedTo) {
      filter.assignedTo = new ObjectId(assignedTo);
    }

    const skip = (page - 1) * limit;

    const [leads, total] = await Promise.all([
      collections.leads
        .find(filter)
        .sort({ nextFollowupDate: 1 })
        .skip(skip)
        .limit(limit)
        .toArray() as Promise<WithId<LeadDocument>[]>,
      collections.leads.countDocuments(filter),
    ]);

    return {
      data: leads.map((lead) => this.formatLead(lead)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + leads.length < total,
      },
    };
  }

  async getOverdueFollowups(
    tenantId: string,
    branchId: string,
    params: { assignedTo?: string; page?: number; limit?: number } = {}
  ) {
    const { assignedTo, page = 1, limit = 20 } = params;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const filter: Record<string, unknown> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      status: 'active',
      nextFollowupDate: { $lt: today },
    };

    if (assignedTo) {
      filter.assignedTo = new ObjectId(assignedTo);
    }

    const skip = (page - 1) * limit;

    const [leads, total] = await Promise.all([
      collections.leads
        .find(filter)
        .sort({ nextFollowupDate: 1 })
        .skip(skip)
        .limit(limit)
        .toArray() as Promise<WithId<LeadDocument>[]>,
      collections.leads.countDocuments(filter),
    ]);

    return {
      data: leads.map((lead) => this.formatLead(lead)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + leads.length < total,
      },
    };
  }

  async getFollowupStats(tenantId: string, branchId: string, assignedTo?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const endOfWeek = new Date(today);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    const baseFilter: Record<string, unknown> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      status: 'active',
    };

    if (assignedTo) {
      baseFilter.assignedTo = new ObjectId(assignedTo);
    }

    const [overdue, dueToday, dueThisWeek, total] = await Promise.all([
      collections.leads.countDocuments({
        ...baseFilter,
        nextFollowupDate: { $lt: today },
      }),
      collections.leads.countDocuments({
        ...baseFilter,
        nextFollowupDate: { $gte: today, $lt: tomorrow },
      }),
      collections.leads.countDocuments({
        ...baseFilter,
        nextFollowupDate: { $gte: today, $lt: endOfWeek },
      }),
      collections.leads.countDocuments({
        ...baseFilter,
        nextFollowupDate: { $exists: true, $ne: null },
      }),
    ]);

    return {
      overdue,
      dueToday,
      dueThisWeek,
      total,
    };
  }

  private formatLead(lead: WithId<LeadDocument>) {
    return {
      _id: lead._id.toString(),
      tenantId: lead.tenantId.toString(),
      branchId: lead.branchId.toString(),
      leadNumber: lead.leadNumber,
      firstName: lead.firstName,
      lastName: lead.lastName,
      displayName: lead.displayName,
      dateOfBirth: lead.dateOfBirth,
      gender: lead.gender,
      contact: lead.contact,
      parents: lead.parents,
      interestedIn: {
        academicBatchId: lead.interestedIn.academicBatchId?.toString(),
        classId: lead.interestedIn.classId?.toString(),
        stream: lead.interestedIn.stream,
      },
      source: lead.source,
      sourceDetails: lead.sourceDetails,
      referredBy: lead.referredBy,
      assignedTo: lead.assignedTo?.toString(),
      stage: lead.stage,
      stageHistory: lead.stageHistory.map((s) => ({
        ...s,
        changedBy: s.changedBy.toString(),
      })),
      followups: lead.followups.map((f) => ({
        ...f,
        _id: f._id?.toString(),
        createdBy: f.createdBy.toString(),
        completedBy: f.completedBy?.toString(),
      })),
      nextFollowupDate: lead.nextFollowupDate,
      lostReason: lead.lostReason,
      applicationId: lead.applicationId?.toString(),
      notes: lead.notes,
      tags: lead.tags,
      customFields: lead.customFields,
      status: lead.status,
      createdBy: lead.createdBy?.toString(),
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
    };
  }
}

export const leadService = new LeadService();

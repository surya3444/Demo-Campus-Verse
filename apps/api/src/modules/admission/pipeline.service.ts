import { ObjectId, WithId, Document } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { leadService } from './lead.service';
import { applicationService } from './application.service';

// Unified pipeline stages
export const PIPELINE_STAGES = [
  'new',
  'contacted',
  'interested',
  'followup',
  'visit_scheduled',
  'visited',
  'applied',
  'docs_verified',
  'fee_paid',
  'enrolled',
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

// Lead stages that map to pipeline stages
const LEAD_STAGES = [
  'new',
  'contacted',
  'interested',
  'followup',
  'visit_scheduled',
  'visited',
] as const;

// Application statuses that map to pipeline stages
const APPLICATION_STATUS_MAP: Record<string, PipelineStage> = {
  submitted: 'applied',
  under_review: 'applied', // Treat under_review as applied for kanban
  docs_verified: 'docs_verified',
  fee_paid: 'fee_paid',
  approved: 'fee_paid', // Treat approved as fee_paid (legacy)
  enrolled: 'enrolled',
};

export interface PipelineCard {
  _id: string;
  type: 'lead' | 'application';
  stage: PipelineStage;
  studentName: string;
  parentPhone?: string;
  parentName?: string;
  interestedIn?: string;
  source?: string;
  daysInStage: number;
  stageChangedAt: Date;
  createdAt: Date;
  // Attribution
  addedByName?: string;
  agentName?: string;
  lastActivity?: { byName: string; action: string; at: Date };
  // Lead-specific
  nextFollowupDate?: Date;
  // Application-specific
  applicationNumber?: string;
  // Raw data for detail view
  data: Record<string, unknown>;
}

// Verbs for "who did what" labels on pipeline cards
const LEAD_STAGE_VERBS: Record<string, string> = {
  new: 'added the lead',
  contacted: 'contacted the lead',
  interested: 'marked interested',
  followup: 'set a follow-up',
  visit_scheduled: 'scheduled a visit',
  visited: 'marked visited',
};

const APPLICATION_STATUS_VERBS: Record<string, string> = {
  submitted: 'submitted the application',
  under_review: 'started review',
  docs_verified: 'verified documents',
  fee_paid: 'recorded fee payment',
  approved: 'approved the application',
  enrolled: 'enrolled the student',
};

export interface PipelineResponse {
  stages: {
    [key in PipelineStage]: {
      cards: PipelineCard[];
      count: number;
    };
  };
  stats: {
    total: number;
    leads: number;
    applications: number;
    byStage: Record<PipelineStage, number>;
  };
}

class PipelineService {
  async getPipeline(
    tenantId: string,
    branchId: string,
    params: {
      search?: string;
      source?: string;
    } = {}
  ): Promise<PipelineResponse> {
    const { search, source } = params;

    // Fetch active leads (new, contacted, interested)
    const leadFilter: Record<string, unknown> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      status: 'active',
      stage: { $in: LEAD_STAGES },
    };

    if (search) {
      leadFilter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { 'contact.phone': { $regex: search, $options: 'i' } },
      ];
    }

    if (source) {
      leadFilter.source = source;
    }

    // Fetch applications (submitted through enrolled, excluding rejected/withdrawn)
    const applicationFilter: Record<string, unknown> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      status: {
        $in: ['submitted', 'under_review', 'docs_verified', 'fee_paid', 'approved', 'enrolled'],
      },
    };

    if (search) {
      applicationFilter.$or = [
        { 'student.firstName': { $regex: search, $options: 'i' } },
        { 'student.lastName': { $regex: search, $options: 'i' } },
        { applicationNumber: { $regex: search, $options: 'i' } },
      ];
    }

    if (source) {
      applicationFilter.source = source;
    }

    const [leads, applications] = await Promise.all([
      collections.leads.find(leadFilter).sort({ updatedAt: -1 }).toArray(),
      collections.applications
        .aggregate([
          { $match: applicationFilter },
          {
            $lookup: {
              from: 'classes',
              localField: 'classId',
              foreignField: '_id',
              as: 'class',
            },
          },
          { $unwind: { path: '$class', preserveNullAndEmptyArrays: true } },
          { $sort: { updatedAt: -1 } },
        ])
        .toArray(),
    ]);

    // ── Resolve actor + agent names in one batch ──────────────────────────
    const userIds = new Set<string>();
    const agentIds = new Set<string>();
    const collectUserId = (value: unknown) => {
      const id = value?.toString();
      if (id && ObjectId.isValid(id)) userIds.add(id);
    };

    for (const lead of leads) {
      collectUserId(lead.createdBy);
      collectUserId(lead.assignedTo);
      for (const h of (lead.stageHistory as Array<{ changedBy?: unknown }>) || []) {
        collectUserId(h.changedBy);
      }
      for (const f of (lead.followups as Array<{ createdBy?: unknown; completedBy?: unknown }>) ||
        []) {
        collectUserId(f.createdBy);
        collectUserId(f.completedBy);
      }
      const referredBy = lead.referredBy?.toString();
      if (referredBy && ObjectId.isValid(referredBy)) agentIds.add(referredBy);
    }
    for (const app of applications) {
      collectUserId(app.createdBy);
      for (const h of (app.statusHistory as Array<{ changedBy?: unknown }>) || []) {
        collectUserId(h.changedBy);
      }
    }

    const [users, agents] = await Promise.all([
      userIds.size > 0
        ? collections.users
            .find({ _id: { $in: [...userIds].map((id) => new ObjectId(id)) } })
            .project({ 'profile.displayName': 1, 'profile.firstName': 1, 'profile.lastName': 1 })
            .toArray()
        : [],
      agentIds.size > 0
        ? collections.admissionAgents
            .find({ _id: { $in: [...agentIds].map((id) => new ObjectId(id)) } })
            .project({ name: 1, code: 1 })
            .toArray()
        : [],
    ]);

    const userNames = new Map(
      users.map((u) => {
        const profile = u.profile as
          | { displayName?: string; firstName?: string; lastName?: string }
          | undefined;
        const name =
          profile?.displayName ||
          `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim() ||
          'Unknown';
        return [u._id.toString(), name] as const;
      })
    );
    const agentNames = new Map(agents.map((a) => [a._id.toString(), a.name as string] as const));
    const nameOf = (value: unknown): string | undefined =>
      value ? userNames.get(value.toString()) : undefined;

    // Initialize stages
    const stages: PipelineResponse['stages'] = {
      new: { cards: [], count: 0 },
      contacted: { cards: [], count: 0 },
      interested: { cards: [], count: 0 },
      followup: { cards: [], count: 0 },
      visit_scheduled: { cards: [], count: 0 },
      visited: { cards: [], count: 0 },
      applied: { cards: [], count: 0 },
      docs_verified: { cards: [], count: 0 },
      fee_paid: { cards: [], count: 0 },
      enrolled: { cards: [], count: 0 },
    };

    // Process leads
    for (const lead of leads) {
      const leadDoc = lead as WithId<Document>;
      const stage = leadDoc.stage as PipelineStage;

      if (!PIPELINE_STAGES.includes(stage)) continue;

      const lastStageChange =
        (leadDoc.stageHistory as Array<{ date: Date }>)?.slice(-1)[0]?.date || leadDoc.createdAt;
      const daysInStage = Math.floor(
        (Date.now() - new Date(lastStageChange).getTime()) / (1000 * 60 * 60 * 24)
      );

      // Last activity: the most recent stage change or follow-up, with its actor
      const stageHistory =
        (leadDoc.stageHistory as Array<{ stage: string; date: Date; changedBy?: unknown }>) || [];
      const followups =
        (leadDoc.followups as Array<{
          createdAt?: Date;
          createdBy?: unknown;
          completedAt?: Date;
          completedBy?: unknown;
        }>) || [];

      let lastActivity: PipelineCard['lastActivity'];
      const lastStage = stageHistory[stageHistory.length - 1];
      if (lastStage?.changedBy) {
        const byName = nameOf(lastStage.changedBy);
        if (byName) {
          lastActivity = {
            byName,
            action: LEAD_STAGE_VERBS[lastStage.stage] || `moved to ${lastStage.stage}`,
            at: lastStage.date,
          };
        }
      }
      for (const f of followups) {
        const completedAt = f.completedAt ? new Date(f.completedAt) : null;
        const createdAt = f.createdAt ? new Date(f.createdAt) : null;
        if (completedAt && (!lastActivity || completedAt > new Date(lastActivity.at))) {
          const byName = nameOf(f.completedBy);
          if (byName) lastActivity = { byName, action: 'completed a follow-up', at: completedAt };
        } else if (createdAt && (!lastActivity || createdAt > new Date(lastActivity.at))) {
          const byName = nameOf(f.createdBy);
          if (byName) lastActivity = { byName, action: 'followed up', at: createdAt };
        }
      }

      const card: PipelineCard = {
        _id: leadDoc._id.toString(),
        type: 'lead',
        stage,
        studentName: leadDoc.displayName || `${leadDoc.firstName} ${leadDoc.lastName}`,
        parentPhone: leadDoc.contact?.phone,
        parentName: leadDoc.parents?.father?.name || leadDoc.parents?.mother?.name,
        interestedIn: leadDoc.interestedIn?.stream,
        source: leadDoc.source,
        daysInStage,
        stageChangedAt: lastStageChange,
        createdAt: leadDoc.createdAt,
        addedByName: nameOf(leadDoc.createdBy),
        agentName: leadDoc.referredBy ? agentNames.get(leadDoc.referredBy.toString()) : undefined,
        lastActivity,
        nextFollowupDate: leadDoc.nextFollowupDate,
        data: this.formatLeadData(leadDoc, userNames, agentNames),
      };

      stages[stage].cards.push(card);
      stages[stage].count++;
    }

    // Process applications
    for (const app of applications) {
      const appDoc = app as WithId<Document>;
      const appStatus = appDoc.status as string;
      const stage = APPLICATION_STATUS_MAP[appStatus];

      if (!stage) continue;

      const statusHistory =
        (appDoc.statusHistory as Array<{ status: string; changedAt: Date; changedBy?: unknown }>) ||
        [];
      const lastStatusChange = statusHistory.slice(-1)[0]?.changedAt || appDoc.createdAt;
      const daysInStage = Math.floor(
        (Date.now() - new Date(lastStatusChange).getTime()) / (1000 * 60 * 60 * 24)
      );

      // Last activity: most recent status change, with its actor
      let lastActivity: PipelineCard['lastActivity'];
      const lastStatus = statusHistory[statusHistory.length - 1];
      if (lastStatus?.changedBy) {
        const byName = nameOf(lastStatus.changedBy);
        if (byName) {
          lastActivity = {
            byName,
            action: APPLICATION_STATUS_VERBS[lastStatus.status] || `moved to ${lastStatus.status}`,
            at: lastStatus.changedAt,
          };
        }
      }

      const card: PipelineCard = {
        _id: appDoc._id.toString(),
        type: 'application',
        stage,
        studentName: `${appDoc.student?.firstName} ${appDoc.student?.lastName}`,
        parentPhone: appDoc.parents?.father?.phone || appDoc.parents?.mother?.phone,
        parentName: appDoc.parents?.father?.name || appDoc.parents?.mother?.name,
        interestedIn: (appDoc.class as { name?: string })?.name,
        source: appDoc.source,
        daysInStage,
        stageChangedAt: lastStatusChange,
        createdAt: appDoc.createdAt,
        addedByName: nameOf(appDoc.createdBy),
        lastActivity,
        applicationNumber: appDoc.applicationNumber,
        data: this.formatApplicationData(appDoc, userNames),
      };

      stages[stage].cards.push(card);
      stages[stage].count++;
    }

    // Calculate stats
    const stats = {
      total: leads.length + applications.length,
      leads: leads.length,
      applications: applications.length,
      byStage: {} as Record<PipelineStage, number>,
    };

    for (const stage of PIPELINE_STAGES) {
      stats.byStage[stage] = stages[stage].count;
    }

    return { stages, stats };
  }

  async moveCard(
    tenantId: string,
    _branchId: string,
    cardId: string,
    cardType: 'lead' | 'application',
    toStage: PipelineStage,
    userId: string,
    notes?: string
  ) {
    if (cardType === 'lead') {
      return this.moveLeadCard(tenantId, cardId, toStage, userId, notes);
    } else {
      return this.moveApplicationCard(tenantId, cardId, toStage, userId, notes);
    }
  }

  private async moveLeadCard(
    tenantId: string,
    leadId: string,
    toStage: PipelineStage,
    userId: string,
    notes?: string
  ): Promise<unknown> {
    // Validate stage is a lead stage
    if (!LEAD_STAGES.includes(toStage as (typeof LEAD_STAGES)[number])) {
      throw new ApiError(
        'INVALID_STAGE',
        'Leads can only be moved to new, contacted, interested, followup, visit_scheduled, or visited stages',
        400
      );
    }

    return leadService.updateStage(
      tenantId,
      leadId,
      toStage as 'new' | 'contacted' | 'interested' | 'followup' | 'visit_scheduled' | 'visited',
      notes,
      userId
    );
  }

  private async moveApplicationCard(
    tenantId: string,
    applicationId: string,
    toStage: PipelineStage,
    userId: string,
    notes?: string
  ) {
    // Map pipeline stage to application status
    const statusMap: Record<string, string> = {
      applied: 'submitted',
      docs_verified: 'docs_verified',
      fee_paid: 'fee_paid',
      enrolled: 'enrolled',
    };

    const newStatus = statusMap[toStage];
    if (!newStatus) {
      throw new ApiError(
        'INVALID_STAGE',
        'Applications can only be moved to applied, docs_verified, fee_paid, or enrolled stages',
        400
      );
    }

    // For enrollment, use the enroll method
    if (toStage === 'enrolled') {
      return applicationService.enroll(tenantId, applicationId, {}, userId);
    }

    return applicationService.updateStatus(
      tenantId,
      applicationId,
      newStatus as 'submitted' | 'docs_verified' | 'fee_paid',
      userId,
      notes
    );
  }

  async convertLeadToApplication(
    tenantId: string,
    branchId: string,
    leadId: string,
    applicationData: {
      academicBatchId: string;
      classId: string;
      sectionId?: string;
      student?: {
        dateOfBirth?: string;
        gender?: 'male' | 'female' | 'other';
      };
      contact?: {
        address?: {
          city?: string;
          state?: string;
          pincode?: string;
          country?: string;
        };
      };
    },
    userId: string
  ) {
    // Build the data structure expected by convertFromLead
    const convertData: Record<string, unknown> = {
      academicBatchId: applicationData.academicBatchId,
      classId: applicationData.classId,
      sectionId: applicationData.sectionId,
    };

    if (applicationData.student) {
      convertData.student = applicationData.student;
    }

    if (applicationData.contact) {
      convertData.contact = applicationData.contact;
    }

    const result = await applicationService.convertFromLead(
      tenantId,
      branchId,
      leadId,
      convertData,
      userId
    );

    logger.info({ leadId, applicationId: result._id, tenantId }, 'Lead converted to application');

    return result;
  }

  private formatLeadData(
    lead: WithId<Document>,
    userNames: Map<string, string>,
    agentNames: Map<string, string>
  ): Record<string, unknown> {
    const nameOf = (value: unknown): string | undefined =>
      value ? userNames.get(value.toString()) : undefined;

    return {
      _id: lead._id.toString(),
      leadNumber: lead.leadNumber,
      firstName: lead.firstName,
      lastName: lead.lastName,
      displayName: lead.displayName,
      contact: lead.contact,
      parents: lead.parents,
      interestedIn: lead.interestedIn,
      source: lead.source,
      referredBy: lead.referredBy?.toString(),
      agentName: lead.referredBy ? agentNames.get(lead.referredBy.toString()) : undefined,
      stage: lead.stage,
      createdBy: lead.createdBy?.toString(),
      createdByName: nameOf(lead.createdBy),
      assignedTo: lead.assignedTo?.toString(),
      assignedToName: nameOf(lead.assignedTo),
      stageHistory: (
        (lead.stageHistory as Array<{ changedBy?: unknown } & Record<string, unknown>>) || []
      ).map((h) => ({
        ...h,
        changedBy: h.changedBy?.toString(),
        changedByName: nameOf(h.changedBy),
      })),
      followups: (
        (lead.followups as Array<
          { createdBy?: unknown; completedBy?: unknown } & Record<string, unknown>
        >) || []
      ).map((f) => ({
        ...f,
        createdBy: f.createdBy?.toString(),
        createdByName: nameOf(f.createdBy),
        completedBy: f.completedBy?.toString(),
        completedByName: nameOf(f.completedBy),
      })),
      nextFollowupDate: lead.nextFollowupDate,
      notes: lead.notes,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
    };
  }

  private formatApplicationData(
    app: WithId<Document>,
    userNames: Map<string, string>
  ): Record<string, unknown> {
    const klass = app.class as
      | { displayName?: string; name?: string; grade?: { name?: string } }
      | undefined;
    const nameOf = (value: unknown): string | undefined =>
      value ? userNames.get(value.toString()) : undefined;

    return {
      _id: app._id.toString(),
      applicationNumber: app.applicationNumber,
      student: app.student,
      contact: app.contact,
      parents: app.parents,
      classId: (app.classId as { toString: () => string } | undefined)?.toString(),
      sectionId: (app.sectionId as { toString: () => string } | undefined)?.toString(),
      academicBatchId: (app.academicBatchId as { toString: () => string } | undefined)?.toString(),
      className: klass?.displayName || klass?.grade?.name || klass?.name,
      status: app.status,
      createdBy: app.createdBy?.toString(),
      createdByName: nameOf(app.createdBy),
      statusHistory: (
        (app.statusHistory as Array<{ changedBy?: unknown } & Record<string, unknown>>) || []
      ).map((h) => ({
        ...h,
        changedBy: h.changedBy?.toString(),
        changedByName: nameOf(h.changedBy),
      })),
      documents: app.documents,
      source: app.source,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
    };
  }
}

export const pipelineService = new PipelineService();

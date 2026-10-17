import { ObjectId, WithId, Document } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { pipelineService } from './pipeline.service';

export interface LeadNote {
  _id: ObjectId;
  note: string;
  createdBy: ObjectId;
  createdByName?: string;
  createdAt: Date;
}

export interface MarketingLeadDocument extends Document {
  _id: ObjectId;
  firstName: string;
  lastName?: string;
  institution: string;
  institutionType?: string;
  phone?: string;
  email: string;
  message?: string;
  source: 'demo_request' | 'contact_form' | 'manual';
  /** Free-form key — must match a key in the pipeline settings doc. */
  stage: string;
  notes: LeadNote[];
  metadata?: {
    userAgent?: string;
    ipAddress?: string;
    referrer?: string;
    page?: string;
  };
  assignedTo?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
  contactedAt?: Date;
  wonAt?: Date;
  lostAt?: Date;
  lostReason?: string;
}

export interface CreateDemoLeadInput {
  firstName: string;
  lastName?: string;
  institution: string;
  institutionType?: string;
  phone?: string;
  email: string;
  message?: string;
  metadata?: MarketingLeadDocument['metadata'];
}

function formatLead(doc: WithId<MarketingLeadDocument>) {
  return {
    id: doc._id.toString(),
    firstName: doc.firstName,
    lastName: doc.lastName,
    institution: doc.institution,
    institutionType: doc.institutionType,
    phone: doc.phone,
    email: doc.email,
    message: doc.message,
    source: doc.source,
    stage: doc.stage,
    notes: (doc.notes || []).map((n) => ({
      id: n._id.toString(),
      note: n.note,
      createdBy: n.createdBy.toString(),
      createdByName: n.createdByName,
      createdAt: n.createdAt,
    })),
    metadata: doc.metadata,
    assignedTo: doc.assignedTo?.toString(),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    contactedAt: doc.contactedAt,
    wonAt: doc.wonAt,
    lostAt: doc.lostAt,
    lostReason: doc.lostReason,
  };
}

class MarketingLeadsService {
  async createDemoLead(input: CreateDemoLeadInput) {
    const now = new Date();
    const doc: MarketingLeadDocument = {
      _id: new ObjectId(),
      firstName: input.firstName.trim(),
      lastName: input.lastName?.trim() || undefined,
      institution: input.institution.trim(),
      institutionType: input.institutionType?.trim() || undefined,
      phone: input.phone?.trim() || undefined,
      email: input.email.trim().toLowerCase(),
      message: input.message?.trim() || undefined,
      source: 'demo_request',
      stage: 'new',
      notes: [],
      metadata: input.metadata,
      createdAt: now,
      updatedAt: now,
    };

    await collections.marketingLeads.insertOne(doc);
    logger.info(
      { leadId: doc._id.toString(), email: doc.email, institution: doc.institution },
      'Demo lead captured'
    );
    return formatLead(doc as WithId<MarketingLeadDocument>);
  }

  async listLeads(params: { stage?: string; search?: string; page?: number; limit?: number }) {
    const { stage, search, page = 1, limit = 100 } = params;

    const query: Record<string, unknown> = {};
    if (stage) query.stage = stage;
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { institution: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await collections.marketingLeads.countDocuments(query);
    const docs = (await collections.marketingLeads
      .find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray()) as WithId<MarketingLeadDocument>[];

    return {
      data: docs.map(formatLead),
      meta: { total, page, limit },
    };
  }

  async getLead(id: string) {
    if (!ObjectId.isValid(id)) {
      throw new ApiError('INVALID_ID', 'Invalid lead id', 400);
    }
    const doc = (await collections.marketingLeads.findOne({
      _id: new ObjectId(id),
    })) as WithId<MarketingLeadDocument> | null;
    if (!doc) throw new ApiError('NOT_FOUND', 'Lead not found', 404);
    return formatLead(doc);
  }

  async updateStage(id: string, stage: string, lostReason?: string) {
    if (!ObjectId.isValid(id)) {
      throw new ApiError('INVALID_ID', 'Invalid lead id', 400);
    }
    const validKeys = await pipelineService.getStageKeys();
    if (!validKeys.has(stage)) {
      throw new ApiError(
        'INVALID_STAGE',
        `Stage must be one of: ${[...validKeys].join(', ')}`,
        400
      );
    }

    const now = new Date();
    const set: Record<string, unknown> = { stage, updatedAt: now };

    if (stage === 'contacted') set.contactedAt = now;
    if (stage === 'won') set.wonAt = now;
    if (stage === 'lost') {
      set.lostAt = now;
      if (lostReason) set.lostReason = lostReason;
    }

    const unset: Record<string, ''> = {};
    if (stage !== 'lost') unset.lostReason = '';

    const update: Record<string, unknown> = { $set: set };
    if (Object.keys(unset).length) update.$unset = unset;

    const result = await collections.marketingLeads.findOneAndUpdate(
      { _id: new ObjectId(id) },
      update,
      { returnDocument: 'after' }
    );

    if (!result) throw new ApiError('NOT_FOUND', 'Lead not found', 404);
    return formatLead(result as WithId<MarketingLeadDocument>);
  }

  async addNote(id: string, note: string, adminId: string, adminName?: string) {
    if (!ObjectId.isValid(id)) {
      throw new ApiError('INVALID_ID', 'Invalid lead id', 400);
    }
    if (!note?.trim()) {
      throw new ApiError('INVALID_INPUT', 'Note cannot be empty', 400);
    }
    const noteEntry: LeadNote = {
      _id: new ObjectId(),
      note: note.trim(),
      createdBy: new ObjectId(adminId),
      createdByName: adminName,
      createdAt: new Date(),
    };

    const result = await collections.marketingLeads.findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $push: { notes: noteEntry } as never,
        $set: { updatedAt: new Date() },
      },
      { returnDocument: 'after' }
    );

    if (!result) throw new ApiError('NOT_FOUND', 'Lead not found', 404);
    return formatLead(result as WithId<MarketingLeadDocument>);
  }

  async deleteLead(id: string) {
    if (!ObjectId.isValid(id)) {
      throw new ApiError('INVALID_ID', 'Invalid lead id', 400);
    }
    const result = await collections.marketingLeads.findOneAndDelete({
      _id: new ObjectId(id),
    });
    if (!result) throw new ApiError('NOT_FOUND', 'Lead not found', 404);
    logger.info(
      { leadId: id, email: (result as WithId<MarketingLeadDocument>).email },
      'Marketing lead deleted'
    );
    return { id };
  }

  /**
   * Returns counts grouped by stage for every stage currently in the pipeline.
   * Stages that exist in the pipeline but have zero leads still appear (count: 0).
   * Stages found on lead docs that aren't in the pipeline (orphans) are returned
   * under the `_orphans` map for the UI to surface.
   */
  async getStats() {
    const stages = await pipelineService.getPipeline();
    const knownKeys = new Set(stages.map((s) => s.key));

    const grouped = await collections.marketingLeads
      .aggregate([{ $group: { _id: '$stage', count: { $sum: 1 } } }])
      .toArray();

    const byStage: Record<string, number> = {};
    const orphans: Record<string, number> = {};
    for (const s of stages) byStage[s.key] = 0;

    for (const row of grouped) {
      const key = row._id as string;
      const count = row.count as number;
      if (knownKeys.has(key)) {
        byStage[key] = count;
      } else if (key) {
        orphans[key] = count;
      }
    }

    const total =
      Object.values(byStage).reduce((a, b) => a + b, 0) +
      Object.values(orphans).reduce((a, b) => a + b, 0);

    return { total, byStage, orphans };
  }
}

export const marketingLeadsService = new MarketingLeadsService();

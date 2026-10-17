import { ObjectId, Document, WithId } from 'mongodb';
import { collections } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler';
import { logger } from '../../lib/logger';

export type StageColor =
  | 'slate'
  | 'blue'
  | 'amber'
  | 'violet'
  | 'emerald'
  | 'rose'
  | 'sky'
  | 'fuchsia'
  | 'lime'
  | 'orange'
  | 'teal';

export const ALLOWED_COLORS: StageColor[] = [
  'slate',
  'blue',
  'amber',
  'violet',
  'emerald',
  'rose',
  'sky',
  'fuchsia',
  'lime',
  'orange',
  'teal',
];

export interface PipelineStage {
  key: string;
  label: string;
  color: StageColor;
  order: number;
  isPermanent: boolean;
}

interface PipelineDocument extends Document {
  _id: ObjectId;
  key: 'pipeline';
  stages: PipelineStage[];
  createdAt: Date;
  updatedAt: Date;
}

const PIPELINE_KEY = 'pipeline';

const DEFAULT_STAGES: PipelineStage[] = [
  { key: 'new', label: 'New', color: 'slate', order: 0, isPermanent: true },
  { key: 'contacted', label: 'Contacted', color: 'blue', order: 1, isPermanent: false },
  {
    key: 'demo_scheduled',
    label: 'Demo Scheduled',
    color: 'amber',
    order: 2,
    isPermanent: false,
  },
  { key: 'qualified', label: 'Qualified', color: 'violet', order: 3, isPermanent: false },
  { key: 'won', label: 'Won', color: 'emerald', order: 4, isPermanent: true },
  { key: 'lost', label: 'Lost', color: 'rose', order: 5, isPermanent: true },
];

const PERMANENT_KEYS = new Set(['new', 'won', 'lost']);

function slugify(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

function sortByOrder(stages: PipelineStage[]): PipelineStage[] {
  return [...stages].sort((a, b) => a.order - b.order);
}

function renumber(stages: PipelineStage[]): PipelineStage[] {
  return stages.map((s, i) => ({ ...s, order: i }));
}

function validateInvariants(stages: PipelineStage[]): void {
  if (stages.length < 3) {
    throw new ApiError('INVALID_PIPELINE', 'Pipeline must contain new, won, and lost stages', 400);
  }
  if (stages[0].key !== 'new') {
    throw new ApiError('INVALID_PIPELINE', '"New" must be the first stage', 400);
  }
  if (stages[stages.length - 1].key !== 'lost') {
    throw new ApiError('INVALID_PIPELINE', '"Lost" must be the last stage', 400);
  }
  if (stages[stages.length - 2].key !== 'won') {
    throw new ApiError('INVALID_PIPELINE', '"Won" must be just before "Lost"', 400);
  }
  const keys = new Set<string>();
  for (const s of stages) {
    if (keys.has(s.key)) {
      throw new ApiError('INVALID_PIPELINE', `Duplicate stage key "${s.key}"`, 400);
    }
    keys.add(s.key);
  }
}

class PipelineService {
  async getPipeline(): Promise<PipelineStage[]> {
    let doc = (await collections.marketingLeadSettings.findOne({
      key: PIPELINE_KEY,
    })) as WithId<PipelineDocument> | null;

    if (!doc) {
      const now = new Date();
      const seed: PipelineDocument = {
        _id: new ObjectId(),
        key: PIPELINE_KEY,
        stages: DEFAULT_STAGES,
        createdAt: now,
        updatedAt: now,
      };
      await collections.marketingLeadSettings.insertOne(seed);

      // One-time migration: rename legacy 'converted' stage to 'won' on existing leads.
      try {
        const result = await collections.marketingLeads.updateMany(
          { stage: 'converted' },
          { $set: { stage: 'won' } }
        );
        if (result.modifiedCount > 0) {
          logger.info({ migrated: result.modifiedCount }, 'Migrated lead stage converted -> won');
        }
      } catch (err) {
        logger.warn({ err }, 'Pipeline seed migration failed (non-fatal)');
      }

      doc = seed as WithId<PipelineDocument>;
    }

    return sortByOrder(doc.stages || []);
  }

  async getStageKeys(): Promise<Set<string>> {
    const stages = await this.getPipeline();
    return new Set(stages.map((s) => s.key));
  }

  async addStage(input: {
    label: string;
    color?: StageColor;
    afterKey?: string;
  }): Promise<PipelineStage[]> {
    const label = input.label?.trim();
    if (!label) {
      throw new ApiError('INVALID_INPUT', 'Stage label is required', 400);
    }
    if (label.length > 40) {
      throw new ApiError('INVALID_INPUT', 'Stage label must be 40 characters or fewer', 400);
    }
    const color = input.color || 'slate';
    if (!ALLOWED_COLORS.includes(color)) {
      throw new ApiError(
        'INVALID_COLOR',
        `Color must be one of: ${ALLOWED_COLORS.join(', ')}`,
        400
      );
    }

    const stages = await this.getPipeline();

    // Generate unique key from label
    const baseKey = slugify(label) || `stage_${Date.now()}`;
    let key = baseKey;
    let suffix = 1;
    const existing = new Set(stages.map((s) => s.key));
    while (existing.has(key)) {
      key = `${baseKey}_${suffix}`;
      suffix++;
    }
    if (PERMANENT_KEYS.has(key)) {
      key = `${baseKey}_${Date.now().toString(36)}`;
    }

    // Determine insertion index. Stages can only live between `new` and `won`.
    // Default: just before `won`.
    const wonIdx = stages.findIndex((s) => s.key === 'won');
    let insertAt = wonIdx; // before won
    if (input.afterKey) {
      const afterIdx = stages.findIndex((s) => s.key === input.afterKey);
      if (afterIdx === -1) {
        throw new ApiError('INVALID_INPUT', `afterKey "${input.afterKey}" not found`, 400);
      }
      // Cannot insert after 'won' or 'lost'
      if (input.afterKey === 'won' || input.afterKey === 'lost') {
        throw new ApiError('INVALID_INPUT', 'Custom stages must live before "Won"', 400);
      }
      insertAt = afterIdx + 1;
    }

    const newStage: PipelineStage = {
      key,
      label,
      color,
      order: insertAt, // will be renumbered
      isPermanent: false,
    };

    const next = renumber([...stages.slice(0, insertAt), newStage, ...stages.slice(insertAt)]);
    validateInvariants(next);

    await collections.marketingLeadSettings.updateOne(
      { key: PIPELINE_KEY },
      { $set: { stages: next, updatedAt: new Date() } }
    );

    logger.info({ key, label, insertAt }, 'Pipeline stage added');
    return next;
  }

  async updateStage(
    stageKey: string,
    input: { label?: string; color?: StageColor }
  ): Promise<PipelineStage[]> {
    if (PERMANENT_KEYS.has(stageKey)) {
      throw new ApiError('PERMANENT_STAGE', 'Permanent stages cannot be modified', 400);
    }

    const stages = await this.getPipeline();
    const idx = stages.findIndex((s) => s.key === stageKey);
    if (idx === -1) {
      throw new ApiError('NOT_FOUND', `Stage "${stageKey}" not found`, 404);
    }

    const set: Partial<PipelineStage> = {};
    if (input.label !== undefined) {
      const label = input.label.trim();
      if (!label) {
        throw new ApiError('INVALID_INPUT', 'Stage label cannot be empty', 400);
      }
      if (label.length > 40) {
        throw new ApiError('INVALID_INPUT', 'Stage label must be 40 characters or fewer', 400);
      }
      set.label = label;
    }
    if (input.color !== undefined) {
      if (!ALLOWED_COLORS.includes(input.color)) {
        throw new ApiError(
          'INVALID_COLOR',
          `Color must be one of: ${ALLOWED_COLORS.join(', ')}`,
          400
        );
      }
      set.color = input.color;
    }
    if (Object.keys(set).length === 0) {
      return stages;
    }

    const update: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (set.label !== undefined) update['stages.$.label'] = set.label;
    if (set.color !== undefined) update['stages.$.color'] = set.color;

    await collections.marketingLeadSettings.updateOne(
      { key: PIPELINE_KEY, 'stages.key': stageKey },
      { $set: update }
    );

    logger.info({ stageKey, set }, 'Pipeline stage updated');
    return this.getPipeline();
  }

  async deleteStage(stageKey: string, reassignTo: string): Promise<PipelineStage[]> {
    if (PERMANENT_KEYS.has(stageKey)) {
      throw new ApiError('PERMANENT_STAGE', 'Permanent stages cannot be deleted', 400);
    }
    if (!reassignTo) {
      throw new ApiError('INVALID_INPUT', 'reassignTo is required to delete a stage', 400);
    }
    if (reassignTo === stageKey) {
      throw new ApiError('INVALID_INPUT', 'reassignTo cannot equal the stage being deleted', 400);
    }

    const stages = await this.getPipeline();
    const target = stages.find((s) => s.key === stageKey);
    if (!target) {
      throw new ApiError('NOT_FOUND', `Stage "${stageKey}" not found`, 404);
    }
    if (!stages.some((s) => s.key === reassignTo)) {
      throw new ApiError('INVALID_INPUT', `reassignTo stage "${reassignTo}" not found`, 400);
    }

    // Reassign leads BEFORE pulling the stage so the kanban never has orphans.
    const reassignResult = await collections.marketingLeads.updateMany(
      { stage: stageKey },
      { $set: { stage: reassignTo, updatedAt: new Date() } }
    );

    const next = renumber(stages.filter((s) => s.key !== stageKey));
    validateInvariants(next);

    await collections.marketingLeadSettings.updateOne(
      { key: PIPELINE_KEY },
      { $set: { stages: next, updatedAt: new Date() } }
    );

    logger.info(
      { stageKey, reassignTo, reassigned: reassignResult.modifiedCount },
      'Pipeline stage deleted'
    );
    return next;
  }

  async reorderStages(orderedKeys: string[]): Promise<PipelineStage[]> {
    if (!Array.isArray(orderedKeys) || orderedKeys.length === 0) {
      throw new ApiError('INVALID_INPUT', 'orderedKeys must be a non-empty array', 400);
    }

    const stages = await this.getPipeline();
    const currentKeys = new Set(stages.map((s) => s.key));
    const incomingKeys = new Set(orderedKeys);

    if (currentKeys.size !== incomingKeys.size) {
      throw new ApiError(
        'INVALID_INPUT',
        'orderedKeys must contain exactly the same stages as the current pipeline',
        400
      );
    }
    for (const k of orderedKeys) {
      if (!currentKeys.has(k)) {
        throw new ApiError('INVALID_INPUT', `Unknown stage key "${k}"`, 400);
      }
    }

    const byKey = new Map(stages.map((s) => [s.key, s]));
    const next = renumber(orderedKeys.map((k) => byKey.get(k)!));
    validateInvariants(next);

    await collections.marketingLeadSettings.updateOne(
      { key: PIPELINE_KEY },
      { $set: { stages: next, updatedAt: new Date() } }
    );

    logger.info({ orderedKeys }, 'Pipeline reordered');
    return next;
  }
}

export const pipelineService = new PipelineService();

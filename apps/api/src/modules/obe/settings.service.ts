import { ObjectId, WithId, Document } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { DEFAULT_OBE_SETTINGS, type ObeLevelBand } from '@campus-verse/shared/constants';
import type { ObeSettingsInput } from '@campus-verse/shared/schemas';

export interface ObeSettingsDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  internalThresholdPercent: number;
  internalLevelBands: ObeLevelBand[];
  externalLevelBands: ObeLevelBand[];
  directWeights: { internal: number; external: number };
  overallWeights: { direct: number; indirect: number };
  targetAttainmentLevel: number;
  maxAttainmentLevel: number;
  createdAt: Date;
  updatedAt: Date;
}

function buildDefaultSettings(tenantId: ObjectId, branchId: ObjectId): ObeSettingsDocument {
  const now = new Date();
  return {
    _id: new ObjectId(),
    tenantId,
    branchId,
    ...structuredClone(DEFAULT_OBE_SETTINGS),
    createdAt: now,
    updatedAt: now,
  };
}

function formatSettings(doc: WithId<ObeSettingsDocument>) {
  return {
    _id: doc._id.toString(),
    tenantId: doc.tenantId.toString(),
    branchId: doc.branchId.toString(),
    internalThresholdPercent: doc.internalThresholdPercent,
    internalLevelBands: doc.internalLevelBands,
    externalLevelBands: doc.externalLevelBands,
    directWeights: doc.directWeights,
    overallWeights: doc.overallWeights,
    targetAttainmentLevel: doc.targetAttainmentLevel,
    maxAttainmentLevel: doc.maxAttainmentLevel,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

class ObeSettingsService {
  async getSettings(tenantId: string, branchId: string) {
    const doc = await this.getSettingsDoc(tenantId, branchId);
    return formatSettings(doc);
  }

  /** Raw document for the attainment engine (avoids re-parsing strings). */
  async getSettingsDoc(tenantId: string, branchId: string): Promise<WithId<ObeSettingsDocument>> {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);

    let doc = (await collections.obeSettings.findOne({
      tenantId: tenantObjId,
      branchId: branchObjId,
    })) as WithId<ObeSettingsDocument> | null;

    if (!doc) {
      const seed = buildDefaultSettings(tenantObjId, branchObjId);
      await collections.obeSettings.insertOne(seed);
      doc = seed as WithId<ObeSettingsDocument>;
      logger.info({ tenantId, branchId }, 'OBE settings auto-seeded');
    }

    return doc;
  }

  async updateSettings(
    tenantId: string,
    branchId: string,
    data: ObeSettingsInput,
    updatedBy: string
  ) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    const fields: (keyof ObeSettingsInput)[] = [
      'internalThresholdPercent',
      'internalLevelBands',
      'externalLevelBands',
      'directWeights',
      'overallWeights',
      'targetAttainmentLevel',
      'maxAttainmentLevel',
    ];
    for (const f of fields) {
      if (data[f] !== undefined) updateData[f] = data[f];
    }

    const defaults = buildDefaultSettings(tenantObjId, branchObjId);
    const setKeys = new Set(Object.keys(updateData));
    const safeInsertDefaults: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(defaults)) {
      if (key === '_id' || key === 'createdAt' || setKeys.has(key)) continue;
      safeInsertDefaults[key] = value;
    }

    const result = await collections.obeSettings.findOneAndUpdate(
      { tenantId: tenantObjId, branchId: branchObjId },
      {
        $set: updateData,
        $setOnInsert: {
          ...safeInsertDefaults,
          createdAt: new Date(),
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    if (!result) throw new ApiError('SETTINGS_UPDATE_FAILED', 'Failed to update OBE settings', 500);
    logger.info({ tenantId, branchId, updatedBy }, 'OBE settings updated');
    return formatSettings(result as WithId<ObeSettingsDocument>);
  }
}

export const obeSettingsService = new ObeSettingsService();

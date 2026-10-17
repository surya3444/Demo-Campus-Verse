import { ObjectId, WithId, Document } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import {
  BOARD_PRESET_CONFIG,
  CBSE_GRADING_SCALE,
  DEFAULT_CO_SCHOLASTIC_AREAS,
  DEFAULT_CO_SCHOLASTIC_GRADES,
  defaultBoardPresetFor,
  type BoardPreset,
  type GradingScaleBand,
} from '@campus-verse/shared/constants';
import type { ExamSettingsInput } from '@campus-verse/shared/schemas';

export interface ExamSettingsDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  boardPreset: BoardPreset;
  gradingScale: GradingScaleBand[];
  coScholasticEnabled: boolean;
  coScholasticAreas: string[];
  coScholasticGrades: string[];
  passMarkPercent: number;
  passSubjectsRequired: 'all' | number;
  reportCard: {
    showAttendance: boolean;
    showRank: boolean;
    showRemarks: boolean;
    principalName?: string;
    schoolMotto?: string;
  };
  hallTicket: {
    seatingMode: 'roll_number' | 'manual';
    showQrCode: boolean;
    venueDefault?: string;
  };
  resultNotification: {
    sendSms: boolean;
    sendEmail: boolean;
    smsTemplate?: string;
    emailSubject?: string;
    emailBody?: string;
  };
  promotion: {
    passMarkPercent: number;
    passSubjectsRequired: 'all' | number;
  };
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Build a fresh settings document. Used for first-time read (auto-seed)
 * and when the admin switches board preset and explicitly resets defaults.
 */
function buildDefaultSettings(
  tenantId: ObjectId,
  branchId: ObjectId,
  preset: BoardPreset = 'cbse'
): ExamSettingsDocument {
  const presetConfig =
    preset === 'custom'
      ? {
          gradingScale: CBSE_GRADING_SCALE,
          coScholasticEnabled: false,
          coScholasticAreas: [],
          passMarkPercent: 33,
        }
      : BOARD_PRESET_CONFIG[preset];

  const now = new Date();
  return {
    _id: new ObjectId(),
    tenantId,
    branchId,
    boardPreset: preset,
    gradingScale: presetConfig.gradingScale,
    coScholasticEnabled: presetConfig.coScholasticEnabled,
    coScholasticAreas: presetConfig.coScholasticAreas.length
      ? presetConfig.coScholasticAreas
      : DEFAULT_CO_SCHOLASTIC_AREAS,
    coScholasticGrades: [...DEFAULT_CO_SCHOLASTIC_GRADES],
    passMarkPercent: presetConfig.passMarkPercent,
    passSubjectsRequired: 'all',
    reportCard: {
      showAttendance: true,
      showRank: true,
      showRemarks: true,
    },
    hallTicket: {
      seatingMode: 'roll_number',
      showQrCode: false,
    },
    resultNotification: {
      sendSms: false,
      sendEmail: true,
    },
    promotion: {
      passMarkPercent: presetConfig.passMarkPercent,
      passSubjectsRequired: 'all',
    },
    createdAt: now,
    updatedAt: now,
  };
}

function formatSettings(doc: WithId<ExamSettingsDocument>) {
  return {
    _id: doc._id.toString(),
    tenantId: doc.tenantId.toString(),
    branchId: doc.branchId.toString(),
    boardPreset: doc.boardPreset,
    gradingScale: doc.gradingScale,
    coScholasticEnabled: doc.coScholasticEnabled,
    coScholasticAreas: doc.coScholasticAreas,
    coScholasticGrades: doc.coScholasticGrades,
    passMarkPercent: doc.passMarkPercent,
    passSubjectsRequired: doc.passSubjectsRequired,
    reportCard: doc.reportCard,
    hallTicket: doc.hallTicket,
    resultNotification: doc.resultNotification,
    promotion: doc.promotion,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

class ExamSettingsService {
  async getSettings(tenantId: string, branchId: string) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);

    let doc = (await collections.examSettings.findOne({
      tenantId: tenantObjId,
      branchId: branchObjId,
    })) as WithId<ExamSettingsDocument> | null;

    if (!doc) {
      // Seed the preset that matches the institution: universities and colleges
      // grade on the UGC 10-point scale (pass at 40, no co-scholastic), schools
      // on CBSE. All presets stay switchable afterwards.
      const branch = await collections.branches.findOne(
        { _id: branchObjId, tenantId: tenantObjId },
        { projection: { institutionType: 1 } }
      );
      const preset = defaultBoardPresetFor(branch?.institutionType as string | undefined);
      const seed = buildDefaultSettings(tenantObjId, branchObjId, preset);
      await collections.examSettings.insertOne(seed);
      doc = seed as WithId<ExamSettingsDocument>;
      logger.info({ tenantId, branchId, preset }, 'Exam settings auto-seeded');
    }

    return formatSettings(doc);
  }

  /** Returns the grading scale for the branch, falling back to CBSE if not configured. */
  async getGradingScale(tenantId: string, branchId: string): Promise<GradingScaleBand[]> {
    const settings = await this.getSettings(tenantId, branchId);
    return settings.gradingScale.length > 0 ? settings.gradingScale : CBSE_GRADING_SCALE;
  }

  async updateSettings(
    tenantId: string,
    branchId: string,
    data: Partial<ExamSettingsInput>,
    updatedBy: string
  ) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);

    // If the board preset is switching, reseed the dependent fields the
    // caller didn't explicitly override.
    let presetDefaults: Partial<ExamSettingsDocument> | null = null;
    if (data.boardPreset && data.boardPreset !== 'custom') {
      const presetConfig = BOARD_PRESET_CONFIG[data.boardPreset];
      presetDefaults = {
        gradingScale: data.gradingScale ?? presetConfig.gradingScale,
        coScholasticEnabled: data.coScholasticEnabled ?? presetConfig.coScholasticEnabled,
        coScholasticAreas:
          data.coScholasticAreas ??
          (presetConfig.coScholasticAreas.length
            ? presetConfig.coScholasticAreas
            : DEFAULT_CO_SCHOLASTIC_AREAS),
        passMarkPercent: data.passMarkPercent ?? presetConfig.passMarkPercent,
      };
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    const fields: (keyof ExamSettingsInput)[] = [
      'boardPreset',
      'gradingScale',
      'coScholasticEnabled',
      'coScholasticAreas',
      'coScholasticGrades',
      'passMarkPercent',
      'passSubjectsRequired',
      'reportCard',
      'hallTicket',
      'resultNotification',
      'promotion',
    ];
    for (const f of fields) {
      if (data[f] !== undefined) updateData[f] = data[f];
    }
    if (presetDefaults) {
      for (const [k, v] of Object.entries(presetDefaults)) {
        if (updateData[k] === undefined) updateData[k] = v;
      }
    }

    // Sanity: if a grading scale is provided, ensure bands cover 0–100 and don't overlap badly.
    if (Array.isArray(updateData.gradingScale)) {
      this.validateScale(updateData.gradingScale as GradingScaleBand[]);
    }

    const defaultDoc = buildDefaultSettings(tenantObjId, branchObjId, 'cbse');
    const setKeys = new Set(Object.keys(updateData));
    const safeInsertDefaults: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(defaultDoc)) {
      if (key === '_id' || key === 'createdAt' || setKeys.has(key)) continue;
      safeInsertDefaults[key] = value;
    }

    const result = await collections.examSettings.findOneAndUpdate(
      { tenantId: tenantObjId, branchId: branchObjId },
      {
        $set: updateData,
        $setOnInsert: {
          ...safeInsertDefaults,
          tenantId: tenantObjId,
          branchId: branchObjId,
          createdAt: new Date(),
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    if (!result) throw new ApiError('SETTINGS_UPDATE_FAILED', 'Failed to update settings', 500);
    logger.info({ tenantId, branchId, updatedBy }, 'Exam settings updated');
    return formatSettings(result as WithId<ExamSettingsDocument>);
  }

  private validateScale(scale: GradingScaleBand[]) {
    if (scale.length === 0) {
      throw new ApiError('INVALID_SCALE', 'Grading scale needs at least one band', 400);
    }
    for (const band of scale) {
      if (band.minPercent > band.maxPercent) {
        throw new ApiError(
          'INVALID_SCALE',
          `Band "${band.grade}" has minPercent > maxPercent`,
          400
        );
      }
    }
  }
}

export const examSettingsService = new ExamSettingsService();

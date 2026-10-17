import { ObjectId, WithId, Document } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { obeSettingsService } from './settings.service';
import {
  obeOfferingService,
  type ObeInstrumentDocument,
  type ObeOfferingDocument,
} from './offering.service';
import { type ObeCourseOutcomeDocument } from './outcome.service';
import { obeProgramService } from './program.service';
import { resolveCohort, assertOfferingAccess } from './obe.utils';
import { type ObeMarkDocument } from './marks.service';
import {
  computeOfferingAttainment,
  type EngineInstrument,
  type OfferingComputeInput,
} from './attainment.engine';

export interface ObeAttainmentDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  offeringId: ObjectId;
  programId: ObjectId;
  subjectId: ObjectId;
  subjectCode: string;
  academicBatchId: ObjectId;
  termId: ObjectId;
  semesterNumber?: number;
  computedAt: Date;
  computedBy: ObjectId;
  cohortSize: number;
  surveyRespondents: number;
  settingsUsed: Record<string, unknown>;
  perInstrument: unknown[];
  perCo: unknown[];
  courseAverageCoAttainment: number | null;
  poAttainment: unknown[];
  psoAttainment: unknown[];
  isFinal: boolean;
  finalSnapshot?: Record<string, unknown>;
}

class ObeAttainmentService {
  private async loadOutcomeDoc(
    offering: WithId<ObeOfferingDocument>
  ): Promise<WithId<ObeCourseOutcomeDocument>> {
    const doc = (await collections.obeCourseOutcomes.findOne({
      tenantId: offering.tenantId,
      subjectId: offering.subjectId,
      programId: offering.programId,
    })) as WithId<ObeCourseOutcomeDocument> | null;
    if (!doc || doc.cos.length === 0) {
      throw new ApiError(
        'COS_NOT_DEFINED',
        "Define this course's outcomes (COs) before computing attainment",
        409
      );
    }
    return doc;
  }

  async compute(
    tenantId: string,
    branchId: string,
    offeringId: string,
    force: boolean,
    user: { userId: string; roleLevel?: number }
  ) {
    const offering = await obeOfferingService.getDoc(tenantId, branchId, offeringId);
    await assertOfferingAccess(tenantId, branchId, user, offering);
    if (offering.status === 'finalized') {
      throw new ApiError('OFFERING_FINALIZED', 'Reopen the offering before recomputing', 409);
    }

    const outcomeDoc = await this.loadOutcomeDoc(offering);
    const program = await obeProgramService.getDoc(
      tenantId,
      branchId,
      offering.programId.toString()
    );
    const settings = await obeSettingsService.getSettingsDoc(tenantId, branchId);

    const instruments = (await collections.obeInstruments
      .find({ tenantId: offering.tenantId, offeringId: offering._id })
      .sort({ order: 1, createdAt: 1 })
      .toArray()) as WithId<ObeInstrumentDocument>[];

    // Data-completeness gate: point at what's missing instead of silently
    // producing hollow numbers. `force` computes with whatever exists.
    const gaps: string[] = [];
    if (instruments.length === 0) gaps.push('no assessment instruments defined');
    if (!instruments.some((i) => i.kind === 'external')) {
      gaps.push('no external (end-semester) instrument linked');
    }

    const cohort = await resolveCohort(tenantId, branchId, offering);
    const cohortIds = cohort.map((s) => s.studentId);

    const engineInstruments: EngineInstrument[] = [];
    for (const instrument of instruments) {
      if (instrument.kind === 'internal') {
        const rows = (await collections.obeMarks
          .find({ tenantId: offering.tenantId, instrumentId: instrument._id })
          .toArray()) as WithId<ObeMarkDocument>[];
        if (rows.length === 0) gaps.push(`"${instrument.name}" has no marks entered`);
        engineInstruments.push({
          instrumentId: instrument._id.toString(),
          name: instrument.name,
          kind: 'internal',
          thresholdPercent:
            instrument.thresholdPercentOverride ?? settings.internalThresholdPercent,
          sets: (instrument.sets ?? []).map((set) => ({
            setId: set._id.toString(),
            label: set.label,
            items: set.items.map((item) => ({
              itemId: item._id.toString(),
              label: item.label,
              coIds: item.coIds.map(String),
              maxMarks: item.maxMarks,
            })),
          })),
          rows: rows.map((row) => ({
            studentId: row.studentId.toString(),
            absent: row.absent,
            setId: row.setId?.toString() ?? null,
            marks: Object.fromEntries(row.marks.map((m) => [m.itemId.toString(), m.marksObtained])),
          })),
        });
      } else {
        const results = await collections.examResults
          .find({
            tenantId: offering.tenantId,
            examId: instrument.examId,
            paperId: instrument.paperId,
            studentId: { $in: cohortIds },
          })
          .project({ marksObtained: 1, absent: 1 })
          .toArray();
        if (results.length === 0) {
          gaps.push(`"${instrument.name}" has no exam results for this cohort yet`);
        }
        engineInstruments.push({
          instrumentId: instrument._id.toString(),
          name: instrument.name,
          kind: 'external',
          passMarks: instrument.passMarks ?? 0,
          results: results.map((r) => ({
            marksObtained: r.marksObtained as number,
            absent: Boolean(r.absent),
          })),
        });
      }
    }

    if (gaps.length > 0 && !force) {
      throw new ApiError(
        'ATTAINMENT_DATA_GAPS',
        `Cannot compute yet: ${gaps.join('; ')}. Pass force=true to compute with the available data.`,
        409,
        gaps
      );
    }

    const surveyResponses = (await collections.obeSurveyResponses
      .find({ tenantId: offering.tenantId, offeringId: offering._id })
      .project({ ratings: 1 })
      .toArray()) as { ratings: { coId: ObjectId; rating: number }[] }[];

    const targetLevel = offering.targetLevel ?? settings.targetAttainmentLevel;
    const input: OfferingComputeInput = {
      settings: {
        internalThresholdPercent: settings.internalThresholdPercent,
        internalLevelBands: settings.internalLevelBands,
        externalLevelBands: settings.externalLevelBands,
        directWeights: settings.directWeights,
        overallWeights: settings.overallWeights,
        targetLevel,
        maxAttainmentLevel: settings.maxAttainmentLevel,
      },
      cos: outcomeDoc.cos.map((co) => ({ coId: co._id.toString(), code: co.code })),
      pos: program.pos.map((po) => ({ id: po._id.toString(), code: po.code })),
      psos: program.psos.map((pso) => ({ id: pso._id.toString(), code: pso.code })),
      poMapping: outcomeDoc.poMapping.map((cell) => ({
        coId: cell.coId.toString(),
        targetId: cell.poId.toString(),
        strength: cell.strength,
      })),
      psoMapping: outcomeDoc.psoMapping.map((cell) => ({
        coId: cell.coId.toString(),
        targetId: cell.psoId.toString(),
        strength: cell.strength,
      })),
      instruments: engineInstruments,
      surveyResponses: surveyResponses.map((r) =>
        r.ratings.map((rating) => ({ coId: rating.coId.toString(), rating: rating.rating }))
      ),
      cohortSize: cohort.length,
    };

    const result = computeOfferingAttainment(input);

    const now = new Date();
    const attainmentDoc = {
      tenantId: offering.tenantId,
      branchId: offering.branchId,
      offeringId: offering._id,
      programId: offering.programId,
      subjectId: offering.subjectId,
      subjectCode: offering.subjectCode,
      academicBatchId: offering.academicBatchId,
      termId: offering.termId,
      ...(offering.semesterNumber !== undefined ? { semesterNumber: offering.semesterNumber } : {}),
      computedAt: now,
      computedBy: new ObjectId(user.userId),
      cohortSize: cohort.length,
      surveyRespondents: result.surveyRespondents,
      settingsUsed: { ...input.settings },
      perInstrument: result.perInstrument,
      perCo: result.perCo,
      courseAverageCoAttainment: result.courseAverageCoAttainment,
      poAttainment: result.poAttainment,
      psoAttainment: result.psoAttainment,
      isFinal: false,
    };

    // Recompute-don't-patch: the cached doc is overwritten wholesale.
    await collections.obeAttainments.replaceOne(
      { tenantId: offering.tenantId, offeringId: offering._id },
      attainmentDoc,
      { upsert: true }
    );
    await collections.obeOfferings.updateOne(
      { _id: offering._id, tenantId: offering.tenantId },
      { $set: { status: 'computed', computedAt: now, studentCount: cohort.length, updatedAt: now } }
    );

    logger.info({ tenantId, offeringId, gaps }, 'OBE attainment computed');
    return this.get(tenantId, branchId, offeringId);
  }

  async get(tenantId: string, branchId: string, offeringId: string) {
    const offering = await obeOfferingService.getDoc(tenantId, branchId, offeringId);
    const doc = (await collections.obeAttainments.findOne({
      tenantId: offering.tenantId,
      offeringId: offering._id,
    })) as WithId<ObeAttainmentDocument> | null;
    if (!doc) {
      throw new ApiError('ATTAINMENT_NOT_COMPUTED', 'Attainment has not been computed yet', 404);
    }

    return {
      _id: doc._id.toString(),
      offeringId: doc.offeringId.toString(),
      subjectCode: doc.subjectCode,
      computedAt: doc.computedAt,
      cohortSize: doc.cohortSize,
      surveyRespondents: doc.surveyRespondents,
      settingsUsed: doc.settingsUsed,
      perInstrument: doc.perInstrument,
      perCo: doc.perCo,
      courseAverageCoAttainment: doc.courseAverageCoAttainment,
      poAttainment: doc.poAttainment,
      psoAttainment: doc.psoAttainment,
      isFinal: doc.isFinal,
      // Authored content merged from the offering so one fetch drives the tab.
      coCorrectiveActions: (offering.coCorrectiveActions ?? []).map((a) => ({
        coId: a.coId.toString(),
        text: a.text,
        updatedAt: a.updatedAt,
      })),
      offeringStatus: offering.status,
    };
  }

  async updateCorrectiveActions(
    tenantId: string,
    branchId: string,
    offeringId: string,
    actions: { coId: string; text: string }[],
    user: { userId: string; roleLevel?: number }
  ) {
    const offering = await obeOfferingService.getDoc(tenantId, branchId, offeringId);
    await assertOfferingAccess(tenantId, branchId, user, offering);

    const outcomeDoc = await this.loadOutcomeDoc(offering);
    const validCoIds = new Set(outcomeDoc.cos.map((co) => co._id.toString()));
    for (const action of actions) {
      if (!validCoIds.has(action.coId)) {
        throw new ApiError('INVALID_CO_ID', `Unknown CO id ${action.coId}`, 400);
      }
    }

    const now = new Date();
    await collections.obeOfferings.updateOne(
      { _id: offering._id, tenantId: offering.tenantId },
      {
        $set: {
          coCorrectiveActions: actions
            .filter((a) => a.text.trim().length > 0)
            .map((a) => ({ coId: new ObjectId(a.coId), text: a.text, updatedAt: now })),
          updatedAt: now,
        },
      }
    );
    return { saved: true };
  }

  async finalize(
    tenantId: string,
    branchId: string,
    offeringId: string,
    user: { userId: string; roleLevel?: number }
  ) {
    const offering = await obeOfferingService.getDoc(tenantId, branchId, offeringId);
    if (offering.status !== 'computed') {
      throw new ApiError('NOT_COMPUTED', 'Compute attainment before finalizing the offering', 409);
    }
    const attainment = (await collections.obeAttainments.findOne({
      tenantId: offering.tenantId,
      offeringId: offering._id,
    })) as WithId<ObeAttainmentDocument> | null;
    if (!attainment) {
      throw new ApiError('ATTAINMENT_NOT_COMPUTED', 'Attainment has not been computed yet', 404);
    }
    const outcomeDoc = await this.loadOutcomeDoc(offering);

    const now = new Date();
    await collections.obeAttainments.updateOne(
      { _id: attainment._id, tenantId: offering.tenantId },
      {
        $set: {
          isFinal: true,
          // Freeze the authored inputs so later CO/mapping edits can't silently
          // change what an accreditation snapshot claims it was computed from.
          finalSnapshot: {
            cos: outcomeDoc.cos,
            poMapping: outcomeDoc.poMapping,
            psoMapping: outcomeDoc.psoMapping,
            coCorrectiveActions: offering.coCorrectiveActions ?? [],
          },
        },
      }
    );
    await collections.obeOfferings.updateOne(
      { _id: offering._id, tenantId: offering.tenantId },
      {
        $set: {
          status: 'finalized',
          finalizedAt: now,
          finalizedBy: new ObjectId(user.userId),
          updatedAt: now,
        },
      }
    );
    logger.info({ tenantId, offeringId }, 'OBE offering finalized');
    return this.get(tenantId, branchId, offeringId);
  }

  async reopen(tenantId: string, branchId: string, offeringId: string) {
    const offering = await obeOfferingService.getDoc(tenantId, branchId, offeringId);
    if (offering.status !== 'finalized') {
      throw new ApiError('NOT_FINALIZED', 'Only finalized offerings can be reopened', 409);
    }
    const now = new Date();
    await Promise.all([
      collections.obeAttainments.updateOne(
        { tenantId: offering.tenantId, offeringId: offering._id },
        { $set: { isFinal: false }, $unset: { finalSnapshot: '' } }
      ),
      collections.obeOfferings.updateOne(
        { _id: offering._id, tenantId: offering.tenantId },
        {
          $set: { status: 'computed', updatedAt: now },
          $unset: { finalizedAt: '', finalizedBy: '' },
        }
      ),
    ]);
    logger.info({ tenantId, offeringId }, 'OBE offering reopened');
    return this.get(tenantId, branchId, offeringId);
  }
}

export const obeAttainmentService = new ObeAttainmentService();

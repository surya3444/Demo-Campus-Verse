import { ObjectId, WithId, Document } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import type { UpsertCourseOutcomesInput } from '@campus-verse/shared/schemas';
import { obeProgramService } from './program.service';

interface CoSubdoc {
  _id: ObjectId;
  code: string;
  statement: string;
  bloomLevel: number;
  order: number;
}

export interface ObeCourseOutcomeDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  subjectId: ObjectId;
  programId: ObjectId;
  cos: CoSubdoc[];
  poMapping: { coId: ObjectId; poId: ObjectId; strength: number; justification?: string }[];
  psoMapping: { coId: ObjectId; psoId: ObjectId; strength: number; justification?: string }[];
  updatedBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

function formatOutcomeDoc(doc: WithId<ObeCourseOutcomeDocument>) {
  return {
    _id: doc._id.toString(),
    tenantId: doc.tenantId.toString(),
    branchId: doc.branchId.toString(),
    subjectId: doc.subjectId.toString(),
    programId: doc.programId.toString(),
    cos: doc.cos.map((co) => ({ ...co, _id: co._id.toString() })),
    poMapping: doc.poMapping.map((cell) => ({
      coId: cell.coId.toString(),
      poId: cell.poId.toString(),
      strength: cell.strength,
      justification: cell.justification,
    })),
    psoMapping: doc.psoMapping.map((cell) => ({
      coId: cell.coId.toString(),
      psoId: cell.psoId.toString(),
      strength: cell.strength,
      justification: cell.justification,
    })),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

class ObeOutcomeService {
  /** Returns the CO doc for subject × program, or an empty shell if none exists yet. */
  async get(tenantId: string, branchId: string, subjectId: string, programId: string) {
    if (!ObjectId.isValid(subjectId) || !ObjectId.isValid(programId)) {
      throw new ApiError('INVALID_ID', 'Invalid subject or program id', 400);
    }
    const doc = (await collections.obeCourseOutcomes.findOne({
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      subjectId: new ObjectId(subjectId),
      programId: new ObjectId(programId),
    })) as WithId<ObeCourseOutcomeDocument> | null;

    if (!doc) {
      return {
        _id: null,
        subjectId,
        programId,
        cos: [],
        poMapping: [],
        psoMapping: [],
      };
    }
    return formatOutcomeDoc(doc);
  }

  async getDocByIds(
    tenantId: string,
    subjectId: ObjectId,
    programId: ObjectId
  ): Promise<WithId<ObeCourseOutcomeDocument> | null> {
    return (await collections.obeCourseOutcomes.findOne({
      tenantId: new ObjectId(tenantId),
      subjectId,
      programId,
    })) as WithId<ObeCourseOutcomeDocument> | null;
  }

  async upsert(
    tenantId: string,
    branchId: string,
    data: UpsertCourseOutcomesInput,
    updatedBy: string
  ) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);
    const subjectObjId = new ObjectId(data.subjectId);
    const programObjId = new ObjectId(data.programId);

    const subject = await collections.subjects.findOne(
      { _id: subjectObjId, tenantId: tenantObjId },
      { projection: { _id: 1 } }
    );
    if (!subject) throw new ApiError('SUBJECT_NOT_FOUND', 'Subject not found', 404);

    const program = await obeProgramService.getDoc(tenantId, branchId, data.programId);
    const validPoIds = new Set(program.pos.map((po) => po._id.toString()));
    const validPsoIds = new Set(program.psos.map((pso) => pso._id.toString()));
    for (const cell of data.poMapping) {
      if (!validPoIds.has(cell.poId)) {
        throw new ApiError('INVALID_PO_ID', `PO ${cell.poId} is not part of this program`, 400);
      }
    }
    for (const cell of data.psoMapping) {
      if (!validPsoIds.has(cell.psoId)) {
        throw new ApiError('INVALID_PSO_ID', `PSO ${cell.psoId} is not part of this program`, 400);
      }
    }

    // Preserve CO ids across edits — instruments, survey responses and
    // corrective actions reference them.
    const existing = (await collections.obeCourseOutcomes.findOne({
      tenantId: tenantObjId,
      branchId: branchObjId,
      subjectId: subjectObjId,
      programId: programObjId,
    })) as WithId<ObeCourseOutcomeDocument> | null;
    const existingCoIds = new Set((existing?.cos ?? []).map((co) => co._id.toString()));

    const cos: CoSubdoc[] = data.cos.map((co, i) => {
      if (co._id && !existingCoIds.has(co._id)) {
        throw new ApiError('INVALID_CO_ID', `Unknown CO id ${co._id}`, 400);
      }
      return {
        _id: co._id ? new ObjectId(co._id) : new ObjectId(),
        code: co.code,
        statement: co.statement,
        bloomLevel: co.bloomLevel,
        order: co.order ?? i,
      };
    });

    const poMapping = data.poMapping.map((cell) => ({
      coId: cos[cell.coIndex]._id,
      poId: new ObjectId(cell.poId),
      strength: cell.strength,
      ...(cell.justification ? { justification: cell.justification } : {}),
    }));
    const psoMapping = data.psoMapping.map((cell) => ({
      coId: cos[cell.coIndex]._id,
      psoId: new ObjectId(cell.psoId),
      strength: cell.strength,
      ...(cell.justification ? { justification: cell.justification } : {}),
    }));

    const now = new Date();
    const result = await collections.obeCourseOutcomes.findOneAndUpdate(
      {
        tenantId: tenantObjId,
        branchId: branchObjId,
        subjectId: subjectObjId,
        programId: programObjId,
      },
      {
        $set: {
          cos,
          poMapping,
          psoMapping,
          updatedBy: new ObjectId(updatedBy),
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true, returnDocument: 'after' }
    );

    if (!result)
      throw new ApiError('OUTCOMES_UPSERT_FAILED', 'Failed to save course outcomes', 500);
    logger.info(
      { tenantId, branchId, subjectId: data.subjectId, programId: data.programId },
      'Course outcomes saved'
    );
    return formatOutcomeDoc(result as WithId<ObeCourseOutcomeDocument>);
  }

  /** Subjects that already have COs for a program — used by list pages. */
  async listForProgram(tenantId: string, branchId: string, programId: string) {
    if (!ObjectId.isValid(programId)) {
      throw new ApiError('INVALID_ID', 'Invalid program id', 400);
    }
    const docs = (await collections.obeCourseOutcomes
      .find({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        programId: new ObjectId(programId),
      })
      .project({ subjectId: 1, cos: 1, poMapping: 1, psoMapping: 1, updatedAt: 1 })
      .toArray()) as WithId<ObeCourseOutcomeDocument>[];

    return docs.map((doc) => ({
      _id: doc._id.toString(),
      subjectId: doc.subjectId.toString(),
      coCount: doc.cos.length,
      poCellCount: doc.poMapping.length,
      psoCellCount: doc.psoMapping.length,
      updatedAt: doc.updatedAt,
    }));
  }
}

export const obeOutcomeService = new ObeOutcomeService();

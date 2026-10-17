import { ObjectId, WithId, Document } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import {
  MAX_CUSTOM_POS,
  OBE_PO_PRESETS,
  type ObeProgramPreset,
} from '@campus-verse/shared/constants';
import type { CreateObeProgramInput, UpdateObeProgramInput } from '@campus-verse/shared/schemas';
import { resolveDepartmentIdByCode } from '../hr/department.service';

interface PoSubdoc {
  _id: ObjectId;
  code: string;
  title: string;
  statement: string;
  isCustom: boolean;
  order: number;
}

interface PsoSubdoc {
  _id: ObjectId;
  code: string;
  statement: string;
  order: number;
}

export interface ObeProgramDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  departmentCode: string;
  /** Phase-5 re-key: FK → departments, resolved from departmentCode; the string stays canonical. */
  departmentId?: ObjectId;
  /** FK → programs — the curriculum program whose PO/PSO set this is. */
  curriculumProgramId?: ObjectId;
  curriculumProgramName?: string;
  name: string;
  preset: ObeProgramPreset;
  pos: PoSubdoc[];
  psos: PsoSubdoc[];
  poCorrectiveActions: {
    academicBatchId: ObjectId;
    poId: ObjectId;
    text: string;
    updatedAt: Date;
  }[];
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

function formatProgram(doc: WithId<ObeProgramDocument>) {
  return {
    _id: doc._id.toString(),
    tenantId: doc.tenantId.toString(),
    branchId: doc.branchId.toString(),
    departmentCode: doc.departmentCode,
    departmentId: doc.departmentId?.toString(),
    curriculumProgramId: doc.curriculumProgramId?.toString(),
    curriculumProgramName: doc.curriculumProgramName,
    name: doc.name,
    preset: doc.preset,
    pos: doc.pos.map((po) => ({ ...po, _id: po._id.toString() })),
    psos: doc.psos.map((pso) => ({ ...pso, _id: pso._id.toString() })),
    poCorrectiveActions: (doc.poCorrectiveActions ?? []).map((a) => ({
      academicBatchId: a.academicBatchId.toString(),
      poId: a.poId.toString(),
      text: a.text,
      updatedAt: a.updatedAt,
    })),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function assertCustomPoLimit(pos: { isCustom?: boolean }[]) {
  const customCount = pos.filter((po) => po.isCustom).length;
  if (customCount > MAX_CUSTOM_POS) {
    throw new ApiError(
      'TOO_MANY_CUSTOM_POS',
      `A program may add at most ${MAX_CUSTOM_POS} custom POs`,
      400
    );
  }
}

class ObeProgramService {
  /**
   * Resolve the curriculum program a PO/PSO set belongs to, checking branch
   * membership and department agreement. Shared by create and update.
   */
  private async resolveCurriculumProgram(
    tenantId: string,
    branchId: string,
    curriculumProgramId: string,
    departmentId?: ObjectId | null
  ): Promise<{ _id: ObjectId; name: string }> {
    const program = await collections.programs.findOne({
      _id: new ObjectId(curriculumProgramId),
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    });
    if (!program) {
      throw new ApiError('CURRICULUM_PROGRAM_NOT_FOUND', 'Program not found in this branch', 404);
    }
    if (departmentId && String(program.departmentId) !== departmentId.toString()) {
      throw new ApiError(
        'PROGRAM_DEPARTMENT_MISMATCH',
        'The selected program belongs to a different department',
        400
      );
    }
    return { _id: program._id as ObjectId, name: String(program.name) };
  }

  async create(tenantId: string, branchId: string, data: CreateObeProgramInput, createdBy: string) {
    const departmentCode = data.departmentCode.toUpperCase();

    // One PO/PSO set per curriculum program; departments that named no
    // program keep the original one-per-department uniqueness.
    const existing = await collections.obePrograms.findOne({
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      departmentCode,
      curriculumProgramId: data.curriculumProgramId
        ? new ObjectId(data.curriculumProgramId)
        : { $in: [null, undefined] },
    });
    if (existing) {
      throw new ApiError(
        'PROGRAM_EXISTS',
        data.curriculumProgramId
          ? 'This program already has a PO/PSO set in this branch'
          : `A program for department ${departmentCode} already exists in this branch`,
        409
      );
    }

    // Seed POs from the preset unless the caller supplied an explicit list.
    const posInput: NonNullable<CreateObeProgramInput['pos']> =
      data.pos ??
      OBE_PO_PRESETS[data.preset].pos.map((po, i) => ({
        code: po.code,
        title: po.title,
        statement: po.statement,
        isCustom: false,
        order: i,
      }));
    if (data.preset === 'custom' && posInput.length === 0) {
      throw new ApiError('POS_REQUIRED', 'Custom programs must define at least one PO', 400);
    }
    if (data.preset !== 'custom') assertCustomPoLimit(posInput);

    const departmentId = await resolveDepartmentIdByCode(tenantId, branchId, departmentCode);

    const curriculumProgram = data.curriculumProgramId
      ? await this.resolveCurriculumProgram(
          tenantId,
          branchId,
          data.curriculumProgramId,
          departmentId
        )
      : null;

    const now = new Date();
    const doc: ObeProgramDocument = {
      _id: new ObjectId(),
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      departmentCode,
      ...(departmentId && { departmentId }),
      ...(curriculumProgram && {
        curriculumProgramId: curriculumProgram._id,
        curriculumProgramName: curriculumProgram.name,
      }),
      name: data.name,
      preset: data.preset,
      pos: posInput.map((po, i) => ({
        _id: po._id ? new ObjectId(po._id) : new ObjectId(),
        code: po.code,
        title: po.title,
        statement: po.statement,
        isCustom: po.isCustom ?? false,
        order: po.order ?? i,
      })),
      psos: (data.psos ?? []).map((pso, i) => ({
        _id: pso._id ? new ObjectId(pso._id) : new ObjectId(),
        code: pso.code,
        statement: pso.statement,
        order: pso.order ?? i,
      })),
      poCorrectiveActions: [],
      createdBy: new ObjectId(createdBy),
      createdAt: now,
      updatedAt: now,
    };

    await collections.obePrograms.insertOne(doc);
    logger.info({ tenantId, branchId, departmentCode }, 'OBE program created');
    return formatProgram(doc as WithId<ObeProgramDocument>);
  }

  async findAll(
    tenantId: string,
    branchId: string,
    /** Scope guard: department ids the caller is confined to (null = unrestricted). */
    restrictToDepartmentIds: ObjectId[] | null = null
  ) {
    const docs = (await collections.obePrograms
      .find({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        ...(restrictToDepartmentIds !== null && {
          departmentId: { $in: restrictToDepartmentIds },
        }),
      })
      .sort({ departmentCode: 1, curriculumProgramName: 1 })
      .toArray()) as WithId<ObeProgramDocument>[];
    return docs.map(formatProgram);
  }

  async findById(tenantId: string, branchId: string, id: string) {
    const doc = await this.getDoc(tenantId, branchId, id);
    return formatProgram(doc);
  }

  async getDoc(
    tenantId: string,
    branchId: string,
    id: string
  ): Promise<WithId<ObeProgramDocument>> {
    if (!ObjectId.isValid(id)) {
      throw new ApiError('INVALID_ID', 'Invalid program id', 400);
    }
    const doc = (await collections.obePrograms.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    })) as WithId<ObeProgramDocument> | null;
    if (!doc) throw new ApiError('PROGRAM_NOT_FOUND', 'Program not found', 404);
    return doc;
  }

  async update(tenantId: string, branchId: string, id: string, data: UpdateObeProgramInput) {
    const existing = await this.getDoc(tenantId, branchId, id);

    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) update.name = data.name;

    if (data.curriculumProgramId !== undefined) {
      if (data.curriculumProgramId) {
        const program = await this.resolveCurriculumProgram(
          tenantId,
          branchId,
          data.curriculumProgramId,
          existing.departmentId
        );
        update.curriculumProgramId = program._id;
        update.curriculumProgramName = program.name;
      } else {
        update.curriculumProgramId = null;
        update.curriculumProgramName = null;
      }
    }

    if (data.pos !== undefined) {
      assertCustomPoLimit(data.pos);
      // Preserve subdocument ids so CO-PO mappings keep pointing at the same PO.
      const existingIds = new Set(existing.pos.map((po) => po._id.toString()));
      update.pos = data.pos.map((po, i) => {
        if (po._id && !existingIds.has(po._id)) {
          throw new ApiError('INVALID_PO_ID', `Unknown PO id ${po._id}`, 400);
        }
        return {
          _id: po._id ? new ObjectId(po._id) : new ObjectId(),
          code: po.code,
          title: po.title,
          statement: po.statement,
          isCustom: po.isCustom ?? false,
          order: po.order ?? i,
        };
      });
    }

    if (data.psos !== undefined) {
      const existingIds = new Set(existing.psos.map((pso) => pso._id.toString()));
      update.psos = data.psos.map((pso, i) => {
        if (pso._id && !existingIds.has(pso._id)) {
          throw new ApiError('INVALID_PSO_ID', `Unknown PSO id ${pso._id}`, 400);
        }
        return {
          _id: pso._id ? new ObjectId(pso._id) : new ObjectId(),
          code: pso.code,
          statement: pso.statement,
          order: pso.order ?? i,
        };
      });
    }

    const result = await collections.obePrograms.findOneAndUpdate(
      { _id: existing._id, tenantId: existing.tenantId, branchId: existing.branchId },
      { $set: update },
      { returnDocument: 'after' }
    );
    if (!result) throw new ApiError('PROGRAM_NOT_FOUND', 'Program not found', 404);
    return formatProgram(result as WithId<ObeProgramDocument>);
  }

  async delete(tenantId: string, branchId: string, id: string) {
    const doc = await this.getDoc(tenantId, branchId, id);

    const [outcomeCount, offeringCount] = await Promise.all([
      collections.obeCourseOutcomes.countDocuments({ tenantId: doc.tenantId, programId: doc._id }),
      collections.obeOfferings.countDocuments({ tenantId: doc.tenantId, programId: doc._id }),
    ]);
    if (outcomeCount > 0 || offeringCount > 0) {
      throw new ApiError(
        'PROGRAM_IN_USE',
        `Cannot delete: ${outcomeCount} course-outcome document(s) and ${offeringCount} offering(s) reference this program`,
        409
      );
    }

    await collections.obePrograms.deleteOne({ _id: doc._id, tenantId: doc.tenantId });
    logger.info({ tenantId, branchId, id }, 'OBE program deleted');
  }

  async updateCorrectiveActions(
    tenantId: string,
    branchId: string,
    id: string,
    academicBatchId: string,
    actions: { poId: string; text: string }[]
  ) {
    const doc = await this.getDoc(tenantId, branchId, id);
    const batchObjId = new ObjectId(academicBatchId);
    const poIds = new Set(doc.pos.map((po) => po._id.toString()));
    for (const action of actions) {
      if (!poIds.has(action.poId)) {
        throw new ApiError('INVALID_PO_ID', `Unknown PO id ${action.poId}`, 400);
      }
    }

    const now = new Date();
    // Replace this batch's entries wholesale; other batches' entries survive.
    const kept = (doc.poCorrectiveActions ?? []).filter(
      (a) => !a.academicBatchId.equals(batchObjId)
    );
    const next = [
      ...kept,
      ...actions
        .filter((a) => a.text.trim().length > 0)
        .map((a) => ({
          academicBatchId: batchObjId,
          poId: new ObjectId(a.poId),
          text: a.text,
          updatedAt: now,
        })),
    ];

    const result = await collections.obePrograms.findOneAndUpdate(
      { _id: doc._id, tenantId: doc.tenantId },
      { $set: { poCorrectiveActions: next, updatedAt: now } },
      { returnDocument: 'after' }
    );
    if (!result) throw new ApiError('PROGRAM_NOT_FOUND', 'Program not found', 404);
    return formatProgram(result as WithId<ObeProgramDocument>);
  }
}

export const obeProgramService = new ObeProgramService();

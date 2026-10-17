import { ObjectId, WithId, Document, Filter } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import {
  CreateProgramInput,
  UpdateProgramInput,
  YearTermPattern,
  summarizeTermPattern,
  totalTermsFor,
} from '@campus-verse/shared';

interface ProgramDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  /** Absent for institution-wide programs (MBBS run by the whole medical college). */
  departmentId?: ObjectId | null;
  institutionId?: ObjectId | null;
  name: string;
  code: string;
  degreeType: 'ug' | 'pg' | 'diploma' | 'phd' | 'certificate';
  durationYears: number;
  /** Derived: total terms across all years. */
  totalSemesters: number;
  /** Derived summary: the shared pattern, or 'mixed'. */
  termPattern: YearTermPattern | 'mixed';
  /** One pattern per year (index 0 = Year 1). */
  yearPatterns?: YearTermPattern[];
  specialization?: string;
  status: 'active' | 'archived';
  createdBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProgramListParams {
  departmentId?: string;
  status?: 'active' | 'archived';
  search?: string;
}

/**
 * Resolve the per-year plan a save should store. Explicit yearPatterns win
 * (and must cover every year); a bare termPattern applies to every year;
 * otherwise existing years keep their pattern and new years copy the last.
 */
export function planYears(
  durationYears: number,
  input: { yearPatterns?: YearTermPattern[]; termPattern?: YearTermPattern },
  existing?: YearTermPattern[]
): {
  yearPatterns: YearTermPattern[];
  termPattern: YearTermPattern | 'mixed';
  totalSemesters: number;
} {
  let yearPatterns: YearTermPattern[];
  if (input.yearPatterns) {
    if (input.yearPatterns.length !== durationYears) {
      throw new ApiError(
        'YEAR_PATTERNS_MISMATCH',
        `Give one term pattern per year: ${durationYears} expected, ${input.yearPatterns.length} given`,
        400
      );
    }
    yearPatterns = input.yearPatterns;
  } else if (input.termPattern || !existing?.length) {
    yearPatterns = Array(durationYears).fill(input.termPattern ?? 'semester');
  } else {
    yearPatterns = Array.from(
      { length: durationYears },
      (_, i) => existing[i] ?? existing[existing.length - 1]
    );
  }
  return {
    yearPatterns,
    termPattern: summarizeTermPattern(yearPatterns),
    totalSemesters: totalTermsFor({ durationYears, yearPatterns }),
  };
}

class ProgramService {
  private async assertDepartment(tenantId: string, branchId: string, departmentId: string) {
    const department = await collections.departments.findOne({
      _id: new ObjectId(departmentId),
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    });
    if (!department) {
      throw new ApiError('DEPARTMENT_NOT_FOUND', 'Department not found in this branch', 404);
    }
  }

  /**
   * Who owns a program: a department (and through it an institution), or an
   * institution directly when no single department runs it.
   */
  private async resolveOwner(
    tenantId: string,
    branchId: string,
    departmentId?: string,
    institutionId?: string
  ): Promise<{ departmentId: ObjectId | null; institutionId: ObjectId | null }> {
    if (departmentId) {
      await this.assertDepartment(tenantId, branchId, departmentId);
      const dept = await collections.departments.findOne(
        { _id: new ObjectId(departmentId) },
        { projection: { institutionId: 1 } }
      );
      return {
        departmentId: new ObjectId(departmentId),
        institutionId: (dept?.institutionId as ObjectId | undefined) ?? null,
      };
    }
    if (!institutionId) {
      throw new ApiError(
        'PROGRAM_OWNER_REQUIRED',
        'Pick the department or the institution that runs this program',
        400
      );
    }
    const institution = await collections.institutions.findOne({
      _id: new ObjectId(institutionId),
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      status: 'active',
    });
    if (!institution) {
      throw new ApiError('INSTITUTION_NOT_FOUND', 'Institution not found on this campus', 404);
    }
    return { departmentId: null, institutionId: institution._id };
  }

  async create(tenantId: string, branchId: string, data: CreateProgramInput, createdBy?: string) {
    const owner = await this.resolveOwner(
      tenantId,
      branchId,
      data.departmentId,
      data.institutionId
    );

    const code = data.code.toUpperCase();
    const existing = await collections.programs.findOne({
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      code,
    });
    if (existing) {
      throw new ApiError('DUPLICATE_PROGRAM_CODE', 'A program with this code already exists', 409);
    }

    const now = new Date();
    const doc: ProgramDocument = {
      _id: new ObjectId(),
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      departmentId: owner.departmentId,
      institutionId: owner.institutionId,
      name: data.name,
      code,
      degreeType: data.degreeType,
      durationYears: data.durationYears,
      ...planYears(data.durationYears, data),
      ...(data.specialization && { specialization: data.specialization }),
      status: 'active',
      createdAt: now,
      updatedAt: now,
      ...(createdBy && { createdBy: new ObjectId(createdBy) }),
    };

    await collections.programs.insertOne(doc);

    logger.info({ tenantId, branchId, programId: doc._id.toString() }, 'Program created');

    return this.formatProgram(doc as WithId<ProgramDocument>);
  }

  async findAll(tenantId: string, branchId: string, params: ProgramListParams = {}) {
    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };
    if (params.departmentId) filter.departmentId = new ObjectId(params.departmentId);
    if (params.status) filter.status = params.status;
    if (params.search) {
      filter.$or = [
        { name: { $regex: params.search, $options: 'i' } },
        { code: { $regex: params.search, $options: 'i' } },
      ];
    }

    const programs = (await collections.programs
      .find(filter)
      .sort({ name: 1 })
      .toArray()) as WithId<ProgramDocument>[];

    // Enrich with department names for the listing.
    const departmentIds = [
      ...new Set(
        programs.map((p) => p.departmentId?.toString()).filter((id): id is string => !!id)
      ),
    ];
    const departments = departmentIds.length
      ? await collections.departments
          .find({ _id: { $in: departmentIds.map((id) => new ObjectId(id)) } })
          .project({ name: 1, code: 1 })
          .toArray()
      : [];
    const departmentMap = new Map(departments.map((d) => [d._id.toString(), d]));

    return programs.map((p) => {
      const dept = p.departmentId ? departmentMap.get(p.departmentId.toString()) : undefined;
      return {
        ...this.formatProgram(p),
        department: dept
          ? { _id: dept._id.toString(), name: dept.name as string, code: dept.code as string }
          : null,
      };
    });
  }

  async findById(tenantId: string, programId: string) {
    const program = (await collections.programs.findOne({
      _id: new ObjectId(programId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<ProgramDocument> | null;

    if (!program) {
      throw new ApiError('PROGRAM_NOT_FOUND', 'Program not found', 404);
    }

    return this.formatProgram(program);
  }

  async update(tenantId: string, programId: string, data: UpdateProgramInput) {
    const existing = (await collections.programs.findOne({
      _id: new ObjectId(programId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<ProgramDocument> | null;

    if (!existing) {
      throw new ApiError('PROGRAM_NOT_FOUND', 'Program not found', 404);
    }

    if (data.departmentId && data.departmentId !== existing.departmentId?.toString()) {
      await this.assertDepartment(tenantId, existing.branchId.toString(), data.departmentId);
    }

    if (data.code && data.code.toUpperCase() !== existing.code) {
      const conflict = await collections.programs.findOne({
        tenantId: existing.tenantId,
        branchId: existing.branchId,
        code: data.code.toUpperCase(),
        _id: { $ne: existing._id },
      });
      if (conflict) {
        throw new ApiError(
          'DUPLICATE_PROGRAM_CODE',
          'A program with this code already exists',
          409
        );
      }
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.code !== undefined) updateData.code = data.code.toUpperCase();
    if (data.departmentId !== undefined || data.institutionId !== undefined) {
      const owner = await this.resolveOwner(
        tenantId,
        existing.branchId.toString(),
        data.departmentId,
        data.institutionId
      );
      updateData.departmentId = owner.departmentId;
      updateData.institutionId = owner.institutionId;
    }
    if (data.degreeType !== undefined) updateData.degreeType = data.degreeType;
    if (data.durationYears !== undefined) updateData.durationYears = data.durationYears;
    if (
      data.durationYears !== undefined ||
      data.yearPatterns !== undefined ||
      data.termPattern !== undefined
    ) {
      const plan = planYears(
        data.durationYears ?? existing.durationYears,
        data,
        existing.yearPatterns ??
          Array(existing.durationYears).fill(
            existing.termPattern === 'mixed' ? 'semester' : existing.termPattern
          )
      );
      // Shrinking the plan must not strand curricula already authored for
      // terms that would no longer exist.
      const stranded = await collections.programSchemes.countDocuments({
        tenantId: existing.tenantId,
        programId: existing._id,
        semesterNumber: { $gt: plan.totalSemesters },
      });
      if (stranded > 0) {
        throw new ApiError(
          'TERMS_IN_USE',
          `${stranded} curriculum scheme(s) exist beyond term ${plan.totalSemesters}; move or delete them first`,
          409
        );
      }
      Object.assign(updateData, plan);
    }
    if (data.specialization !== undefined) updateData.specialization = data.specialization;
    if (data.status !== undefined) updateData.status = data.status;

    await collections.programs.updateOne({ _id: existing._id }, { $set: updateData });

    logger.info({ tenantId, programId }, 'Program updated');

    return this.findById(tenantId, programId);
  }

  async delete(tenantId: string, programId: string) {
    const program = (await collections.programs.findOne({
      _id: new ObjectId(programId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<ProgramDocument> | null;

    if (!program) {
      throw new ApiError('PROGRAM_NOT_FOUND', 'Program not found', 404);
    }

    const classCount = await collections.classes.countDocuments({
      tenantId: new ObjectId(tenantId),
      programId: program._id,
    });
    if (classCount > 0) {
      throw new ApiError(
        'PROGRAM_HAS_CLASSES',
        `Cannot delete a program referenced by ${classCount} class(es). Archive it instead.`,
        400
      );
    }

    await collections.programs.deleteOne({ _id: program._id });

    logger.info({ tenantId, programId }, 'Program deleted');

    return { success: true };
  }

  private formatProgram(program: WithId<ProgramDocument>) {
    return {
      _id: program._id.toString(),
      tenantId: program.tenantId.toString(),
      branchId: program.branchId.toString(),
      departmentId: program.departmentId?.toString() ?? null,
      institutionId: program.institutionId?.toString() ?? null,
      name: program.name,
      code: program.code,
      degreeType: program.degreeType,
      durationYears: program.durationYears,
      totalSemesters: program.totalSemesters,
      termPattern: program.termPattern,
      yearPatterns:
        program.yearPatterns ??
        Array(program.durationYears).fill(
          program.termPattern === 'mixed' ? 'semester' : program.termPattern
        ),
      specialization: program.specialization,
      status: program.status,
      createdAt: program.createdAt,
      updatedAt: program.updatedAt,
    };
  }
}

export const programService = new ProgramService();

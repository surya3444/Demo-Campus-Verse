import { ObjectId, WithId, Document, Filter } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { institutionService } from '../organization/institution.service';

// ============ Department ============

/**
 * Phase-5 re-keying helper: resolve a department FK from a legacy code/name
 * string (case-insensitive — the same convention as the class-path match).
 * Null when nothing matches; callers keep the string as fallback.
 */
export async function resolveDepartmentIdByCode(
  tenantId: string,
  branchId: string,
  codeOrName: string
): Promise<ObjectId | null> {
  const needle = codeOrName.trim().toLowerCase();
  if (!needle) return null;

  const departments = await collections.departments
    .find(
      { tenantId: new ObjectId(tenantId), branchId: new ObjectId(branchId), status: 'active' },
      { projection: { code: 1, name: 1 } }
    )
    .toArray();

  const match = departments.find(
    (d) =>
      String(d.code ?? '')
        .trim()
        .toLowerCase() === needle ||
      String(d.name ?? '')
        .trim()
        .toLowerCase() === needle
  );
  return match ? (match._id as ObjectId) : null;
}

interface DepartmentDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  /**
   * Constituent institution this department belongs to. Always set on create —
   * the campus's default institution when the caller doesn't pick one — so the
   * institution → department → program chain is never partial.
   */
  institutionId?: ObjectId | null;
  /** Campus-wide department serving every institution (e.g. Basic Sciences). */
  shared?: boolean;
  name: string;
  code: string;
  type: 'academic' | 'administrative' | 'support';
  description?: string;
  headOfDepartment?: ObjectId;
  parentDepartmentId?: ObjectId;
  status: 'active' | 'inactive';
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDepartmentInput {
  name: string;
  code: string;
  type: 'academic' | 'administrative' | 'support';
  description?: string;
  headOfDepartment?: string;
  parentDepartmentId?: string;
  /** Constituent institution to file this department under; defaults to the campus default. */
  institutionId?: string;
  /** Campus-wide shared department (no institution); serves every institution. */
  shared?: boolean;
}

// ============ Designation ============

interface DesignationDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  name: string;
  code: string;
  category: 'teaching' | 'non-teaching' | 'management';
  level: number; // For hierarchy (1 = highest)
  description?: string;
  permissions?: string[];
  status: 'active' | 'inactive';
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDesignationInput {
  name: string;
  code: string;
  category: 'teaching' | 'non-teaching' | 'management';
  level: number;
  description?: string;
  permissions?: string[];
}

class DepartmentService {
  // ============ Departments ============

  /**
   * Resolve the institution a department belongs to. An explicit choice must be
   * an active institution on THIS campus — institutions are branch-scoped, so
   * filing a department under another campus's institution would silently break
   * the tree. No choice means the campus's default institution, which
   * `ensureDefaultInstitution` creates on demand.
   */
  private async resolveInstitutionId(
    tenantId: string,
    branchId: string,
    institutionId?: string
  ): Promise<ObjectId> {
    if (!institutionId) {
      const fallback = await institutionService.ensureDefaultUnlessUniversity(tenantId, branchId);
      if (!fallback) {
        throw new ApiError(
          'INSTITUTION_REQUIRED',
          'Pick the institution this department belongs to, or mark it as shared across institutions',
          400
        );
      }
      return fallback._id;
    }

    if (!ObjectId.isValid(institutionId)) {
      throw new ApiError('INSTITUTION_NOT_FOUND', 'Institution not found', 404);
    }

    const institution = await collections.institutions.findOne({
      _id: new ObjectId(institutionId),
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    });

    if (!institution) {
      throw new ApiError('INSTITUTION_NOT_FOUND', 'Institution not found on this campus', 404);
    }
    if (institution.status === 'archived') {
      throw new ApiError(
        'INSTITUTION_ARCHIVED',
        'Cannot file a department under an archived institution',
        400
      );
    }

    return institution._id;
  }

  async createDepartment(
    tenantId: string,
    branchId: string,
    data: CreateDepartmentInput,
    createdBy: string
  ) {
    // Check for duplicate code
    const existing = await collections.departments.findOne({
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      code: data.code.toUpperCase(),
    });

    if (existing) {
      throw new ApiError('DUPLICATE_CODE', 'Department code already exists', 400);
    }

    const institutionId = data.shared
      ? null
      : await this.resolveInstitutionId(tenantId, branchId, data.institutionId);

    const departmentId = new ObjectId();
    const now = new Date();

    const department: Omit<DepartmentDocument, '_id'> & { _id: ObjectId } = {
      _id: departmentId,
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      institutionId,
      ...(data.shared && { shared: true }),
      name: data.name,
      code: data.code.toUpperCase(),
      type: data.type,
      description: data.description,
      headOfDepartment: data.headOfDepartment ? new ObjectId(data.headOfDepartment) : undefined,
      parentDepartmentId: data.parentDepartmentId
        ? new ObjectId(data.parentDepartmentId)
        : undefined,
      status: 'active',
      createdBy: new ObjectId(createdBy),
      createdAt: now,
      updatedAt: now,
    };

    await collections.departments.insertOne(department);

    logger.info(
      {
        departmentId: departmentId.toString(),
        name: data.name,
        tenantId,
        institutionId: institutionId?.toString() ?? 'shared',
      },
      'Department created'
    );

    return this.formatDepartment(department as WithId<DepartmentDocument>);
  }

  async findAllDepartments(
    tenantId: string,
    branchId: string,
    includeInactive = false,
    institutionId?: string
  ) {
    // Adopts any pre-institution-tier departments into the campus default, so
    // the list never shows a department with no institution.
    await institutionService.ensureDefaultInstitution(tenantId, branchId);

    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    if (!includeInactive) {
      filter.status = 'active';
    }

    if (institutionId) {
      if (!ObjectId.isValid(institutionId)) {
        throw new ApiError('INVALID_INSTITUTION_ID', 'Invalid institution id', 400);
      }
      filter.institutionId = new ObjectId(institutionId);
    }

    const departments = (await collections.departments
      .aggregate([
        { $match: filter },
        {
          $lookup: {
            from: 'institutions',
            localField: 'institutionId',
            foreignField: '_id',
            as: 'institution',
          },
        },
        { $unwind: { path: '$institution', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'staff',
            localField: 'headOfDepartment',
            foreignField: '_id',
            as: 'hod',
          },
        },
        { $unwind: { path: '$hod', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'departments',
            localField: 'parentDepartmentId',
            foreignField: '_id',
            as: 'parentDepartment',
          },
        },
        { $unwind: { path: '$parentDepartment', preserveNullAndEmptyArrays: true } },
        { $sort: { name: 1 } },
      ])
      .toArray()) as WithId<DepartmentDocument>[];

    return departments.map((d) => this.formatDepartment(d));
  }

  async findDepartmentById(tenantId: string, departmentId: string) {
    const department = (await collections.departments.findOne({
      _id: new ObjectId(departmentId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<DepartmentDocument> | null;

    if (!department) {
      throw new ApiError('DEPARTMENT_NOT_FOUND', 'Department not found', 404);
    }

    return this.formatDepartment(department);
  }

  async updateDepartment(
    tenantId: string,
    departmentId: string,
    data: Partial<CreateDepartmentInput>
  ) {
    const existing = (await collections.departments.findOne({
      _id: new ObjectId(departmentId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<DepartmentDocument> | null;

    if (!existing) {
      throw new ApiError('DEPARTMENT_NOT_FOUND', 'Department not found', 404);
    }

    // Check for duplicate code if changing
    if (data.code && data.code.toUpperCase() !== existing.code) {
      const duplicate = await collections.departments.findOne({
        tenantId: new ObjectId(tenantId),
        branchId: existing.branchId,
        code: data.code.toUpperCase(),
        _id: { $ne: new ObjectId(departmentId) },
      });

      if (duplicate) {
        throw new ApiError('DUPLICATE_CODE', 'Department code already exists', 400);
      }
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.code !== undefined) updateData.code = data.code.toUpperCase();
    if (data.type !== undefined) updateData.type = data.type;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.headOfDepartment !== undefined) {
      updateData.headOfDepartment = data.headOfDepartment
        ? new ObjectId(data.headOfDepartment)
        : null;
    }
    if (data.parentDepartmentId !== undefined) {
      updateData.parentDepartmentId = data.parentDepartmentId
        ? new ObjectId(data.parentDepartmentId)
        : null;
    }
    // Moving a department between institutions on the same campus. Clearing it
    // is not offered: an unassigned department would be swept back into the
    // default institution by the next adoption pass, which reads as the move
    // silently reverting.
    if (data.shared !== undefined) {
      updateData.shared = data.shared;
      if (data.shared) updateData.institutionId = null;
    }
    if (data.institutionId !== undefined && !data.shared) {
      updateData.institutionId = await this.resolveInstitutionId(
        tenantId,
        existing.branchId.toString(),
        data.institutionId
      );
    }

    await collections.departments.updateOne(
      { _id: new ObjectId(departmentId) },
      { $set: updateData }
    );

    logger.info({ departmentId, tenantId }, 'Department updated');

    return this.findDepartmentById(tenantId, departmentId);
  }

  async deleteDepartment(tenantId: string, departmentId: string) {
    const department = (await collections.departments.findOne({
      _id: new ObjectId(departmentId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<DepartmentDocument> | null;

    if (!department) {
      throw new ApiError('DEPARTMENT_NOT_FOUND', 'Department not found', 404);
    }

    // Check if any staff are assigned to this department
    const staffCount = await collections.staff.countDocuments({
      tenantId: new ObjectId(tenantId),
      // `employment.departmentId` is the field staff records actually carry —
      // the old `employmentDetails.` path matched nothing, so this guard never
      // fired and departments with staff could be deleted.
      'employment.departmentId': new ObjectId(departmentId),
    });

    if (staffCount > 0) {
      throw new ApiError(
        'CANNOT_DELETE',
        `Cannot delete department. ${staffCount} staff members are assigned to it.`,
        400
      );
    }

    // Soft delete by setting status to inactive
    await collections.departments.updateOne(
      { _id: new ObjectId(departmentId) },
      { $set: { status: 'inactive', updatedAt: new Date() } }
    );

    logger.info({ departmentId, tenantId }, 'Department deleted (soft)');

    return { success: true };
  }

  // ============ Designations ============

  async createDesignation(
    tenantId: string,
    branchId: string,
    data: CreateDesignationInput,
    createdBy: string
  ) {
    // Check for duplicate code
    const existing = await collections.designations.findOne({
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      code: data.code.toUpperCase(),
    });

    if (existing) {
      throw new ApiError('DUPLICATE_CODE', 'Designation code already exists', 400);
    }

    const designationId = new ObjectId();
    const now = new Date();

    const designation: Omit<DesignationDocument, '_id'> & { _id: ObjectId } = {
      _id: designationId,
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      name: data.name,
      code: data.code.toUpperCase(),
      category: data.category,
      level: data.level,
      description: data.description,
      permissions: data.permissions,
      status: 'active',
      createdBy: new ObjectId(createdBy),
      createdAt: now,
      updatedAt: now,
    };

    await collections.designations.insertOne(designation);

    logger.info(
      { designationId: designationId.toString(), name: data.name, tenantId },
      'Designation created'
    );

    return this.formatDesignation(designation as WithId<DesignationDocument>);
  }

  async findAllDesignations(tenantId: string, branchId: string, includeInactive = false) {
    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    if (!includeInactive) {
      filter.status = 'active';
    }

    const designations = (await collections.designations
      .find(filter)
      .sort({ level: 1, name: 1 })
      .toArray()) as WithId<DesignationDocument>[];

    return designations.map((d) => this.formatDesignation(d));
  }

  async findDesignationById(tenantId: string, designationId: string) {
    const designation = (await collections.designations.findOne({
      _id: new ObjectId(designationId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<DesignationDocument> | null;

    if (!designation) {
      throw new ApiError('DESIGNATION_NOT_FOUND', 'Designation not found', 404);
    }

    return this.formatDesignation(designation);
  }

  async updateDesignation(
    tenantId: string,
    designationId: string,
    data: Partial<CreateDesignationInput>
  ) {
    const existing = (await collections.designations.findOne({
      _id: new ObjectId(designationId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<DesignationDocument> | null;

    if (!existing) {
      throw new ApiError('DESIGNATION_NOT_FOUND', 'Designation not found', 404);
    }

    // Check for duplicate code if changing
    if (data.code && data.code.toUpperCase() !== existing.code) {
      const duplicate = await collections.designations.findOne({
        tenantId: new ObjectId(tenantId),
        branchId: existing.branchId,
        code: data.code.toUpperCase(),
        _id: { $ne: new ObjectId(designationId) },
      });

      if (duplicate) {
        throw new ApiError('DUPLICATE_CODE', 'Designation code already exists', 400);
      }
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.code !== undefined) updateData.code = data.code.toUpperCase();
    if (data.category !== undefined) updateData.category = data.category;
    if (data.level !== undefined) updateData.level = data.level;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.permissions !== undefined) updateData.permissions = data.permissions;

    await collections.designations.updateOne(
      { _id: new ObjectId(designationId) },
      { $set: updateData }
    );

    logger.info({ designationId, tenantId }, 'Designation updated');

    return this.findDesignationById(tenantId, designationId);
  }

  async deleteDesignation(tenantId: string, designationId: string) {
    const designation = (await collections.designations.findOne({
      _id: new ObjectId(designationId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<DesignationDocument> | null;

    if (!designation) {
      throw new ApiError('DESIGNATION_NOT_FOUND', 'Designation not found', 404);
    }

    // Check if any staff have this designation
    const staffCount = await collections.staff.countDocuments({
      tenantId: new ObjectId(tenantId),
      'employmentDetails.designationId': new ObjectId(designationId),
    });

    if (staffCount > 0) {
      throw new ApiError(
        'CANNOT_DELETE',
        `Cannot delete designation. ${staffCount} staff members have this designation.`,
        400
      );
    }

    // Soft delete
    await collections.designations.updateOne(
      { _id: new ObjectId(designationId) },
      { $set: { status: 'inactive', updatedAt: new Date() } }
    );

    logger.info({ designationId, tenantId }, 'Designation deleted (soft)');

    return { success: true };
  }

  // ============ Format Helpers ============

  private formatDepartment(department: WithId<DepartmentDocument>) {
    const formatted: Record<string, unknown> = {
      _id: department._id.toString(),
      tenantId: department.tenantId.toString(),
      branchId: department.branchId.toString(),
      institutionId: department.institutionId?.toString(),
      shared: department.shared === true,
      name: department.name,
      code: department.code,
      type: department.type,
      description: department.description,
      headOfDepartment: department.headOfDepartment?.toString(),
      parentDepartmentId: department.parentDepartmentId?.toString(),
      status: department.status,
      createdAt: department.createdAt,
      updatedAt: department.updatedAt,
    };

    // Add joined data if available
    const deptWithJoins = department as unknown as {
      hod?: { firstName: string; lastName: string };
      parentDepartment?: { name: string };
      institution?: { _id: ObjectId; name: string; code: string };
    };
    if (deptWithJoins.hod) {
      formatted.hodName = `${deptWithJoins.hod.firstName} ${deptWithJoins.hod.lastName}`;
    }
    if (deptWithJoins.parentDepartment) {
      formatted.parentDepartmentName = deptWithJoins.parentDepartment.name;
    }
    if (deptWithJoins.institution) {
      formatted.institution = {
        _id: deptWithJoins.institution._id.toString(),
        name: deptWithJoins.institution.name,
        code: deptWithJoins.institution.code,
      };
    }

    return formatted;
  }

  private formatDesignation(designation: WithId<DesignationDocument>) {
    return {
      _id: designation._id.toString(),
      tenantId: designation.tenantId.toString(),
      branchId: designation.branchId.toString(),
      name: designation.name,
      code: designation.code,
      category: designation.category,
      level: designation.level,
      description: designation.description,
      permissions: designation.permissions,
      status: designation.status,
      createdAt: designation.createdAt,
      updatedAt: designation.updatedAt,
    };
  }
}

export const departmentService = new DepartmentService();

import { ObjectId, WithId, Document, Filter } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { CreateInstitutionInput, UpdateInstitutionInput } from '@campus-verse/shared';
import { clearBranchInstitutionCache } from '../../middleware/scope';

interface InstitutionDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  /** Campus this institution runs on. A campus hosts one or more institutions. */
  branchId: ObjectId;
  name: string;
  code: string;
  kind?: string;
  isDefault?: boolean;
  settings?: {
    admissionPrefix?: string;
    logo?: string;
    letterhead?: string;
  };
  status: 'active' | 'archived';
  createdBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

class InstitutionService {
  /**
   * Universities name their institutions themselves (engineering college,
   * medical college…); only schools and colleges get an implicit default
   * institution mirroring the campus.
   */
  async isUniversityCampus(tenantId: string, branchId: string): Promise<boolean> {
    const branch = await collections.branches.findOne(
      { _id: new ObjectId(branchId), tenantId: new ObjectId(tenantId) },
      { projection: { institutionType: 1 } }
    );
    return branch?.institutionType === 'university';
  }

  /** The campus default, created on demand, except on university campuses (null). */
  async ensureDefaultUnlessUniversity(tenantId: string, branchId: string) {
    if (await this.isUniversityCampus(tenantId, branchId)) return null;
    return this.ensureDefaultInstitution(tenantId, branchId);
  }

  /**
   * Every campus gets exactly one default institution carrying the CAMPUS's
   * identity (branch name + code) — never the tenant's. Stamping the tenant
   * identity (the old convention) made every campus's default look like the
   * same institution, and their shared code collides on the {tenantId, code}
   * unique index the moment a second campus exists. Idempotent and
   * self-healing: called from reads, writes and login; defaults still carrying
   * the tenant identity are re-stamped to their campus on first touch.
   */
  async ensureDefaultInstitution(
    tenantId: string,
    branchId: string
  ): Promise<WithId<InstitutionDocument>> {
    const tenantOid = new ObjectId(tenantId);
    const branchOid = new ObjectId(branchId);

    let institution = (await collections.institutions.findOne({
      tenantId: tenantOid,
      branchId: branchOid,
      isDefault: true,
    })) as WithId<InstitutionDocument> | null;

    if (institution) {
      return this.healDefaultIdentity(tenantOid, branchOid, institution).then((healed) =>
        this.adoptUnassignedDepartments(tenantId, tenantOid, branchOid, healed)
      );
    }

    const branch = await collections.branches.findOne(
      { _id: branchOid, tenantId: tenantOid },
      { projection: { name: 1, code: 1 } }
    );
    if (!branch) {
      throw new ApiError('BRANCH_NOT_FOUND', 'Branch not found', 404);
    }

    {
      const now = new Date();
      const doc: InstitutionDocument = {
        _id: new ObjectId(),
        tenantId: tenantOid,
        branchId: branchOid,
        name: branch.name as string,
        code: String(branch.code || 'MAIN').toUpperCase(),
        isDefault: true,
        settings: {},
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };

      try {
        await collections.institutions.insertOne(doc);
        institution = doc as WithId<InstitutionDocument>;
        logger.info({ tenantId, institutionId: doc._id.toString() }, 'Default institution created');
      } catch (err) {
        // Concurrent ensure — the partial unique index on {tenantId, isDefault}
        // guarantees a single winner; adopt it.
        institution = (await collections.institutions.findOne({
          tenantId: tenantOid,
          branchId: branchOid,
          isDefault: true,
        })) as WithId<InstitutionDocument> | null;
        if (!institution) throw err;
      }
    }

    return this.adoptUnassignedDepartments(tenantId, tenantOid, branchOid, institution);
  }

  /**
   * Re-stamp a default institution still carrying the tenant's NAME (the
   * pre-flip convention) with its campus's identity. Matching on the name
   * alone is deliberate: legacy defaults were stamped tenant-name but
   * variously tenant- or branch-code, and a default named exactly like the
   * tenant is precisely the every-campus-looks-the-same confusion this
   * removes. A default an admin renamed to anything else is left alone.
   */
  private async healDefaultIdentity(
    tenantOid: ObjectId,
    branchOid: ObjectId,
    institution: WithId<InstitutionDocument>
  ): Promise<WithId<InstitutionDocument>> {
    const tenant = await collections.tenants.findOne(
      { _id: tenantOid },
      { projection: { name: 1 } }
    );
    const carriesTenantIdentity = tenant && institution.name === tenant.name;
    if (!carriesTenantIdentity) return institution;

    const branch = await collections.branches.findOne(
      { _id: branchOid, tenantId: tenantOid },
      { projection: { name: 1, code: 1 } }
    );
    if (!branch) return institution;

    const name = branch.name as string;
    const code = String(branch.code || 'MAIN').toUpperCase();
    try {
      await collections.institutions.updateOne(
        { _id: institution._id },
        { $set: { name, code, updatedAt: new Date() } }
      );
      logger.info(
        { institutionId: institution._id.toString(), name, code },
        'Default institution re-stamped with campus identity'
      );
      return { ...institution, name, code };
    } catch {
      // A {tenantId, code} collision with an explicit institution — keep the
      // old identity rather than fail the read path that triggered the heal.
      return institution;
    }
  }

  /**
   * Departments predate the institution tier; adopt any unassigned ones on
   * this campus into its default institution so the tree is never partial.
   * Only legacy rows match — department create/update always stamps an
   * institutionId — so this never quietly undoes an admin's assignment.
   */
  private async adoptUnassignedDepartments(
    tenantId: string,
    tenantOid: ObjectId,
    branchOid: ObjectId,
    institution: WithId<InstitutionDocument>
  ): Promise<WithId<InstitutionDocument>> {
    const stamped = await collections.departments.updateMany(
      {
        tenantId: tenantOid,
        branchId: branchOid,
        institutionId: { $exists: false },
        shared: { $ne: true },
      },
      { $set: { institutionId: institution._id } }
    );
    if (stamped.modifiedCount > 0) {
      clearBranchInstitutionCache(tenantId);
    }

    return institution;
  }

  async findAll(
    tenantId: string,
    branchId: string,
    params: { status?: 'active' | 'archived' } = {}
  ) {
    await this.ensureDefaultUnlessUniversity(tenantId, branchId);

    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };
    if (params.status) filter.status = params.status;

    const institutions = (await collections.institutions
      .find(filter)
      .sort({ isDefault: -1, name: 1 })
      .toArray()) as WithId<InstitutionDocument>[];

    const departmentCounts = await Promise.all(
      institutions.map((inst) =>
        collections.departments.countDocuments({
          tenantId: new ObjectId(tenantId),
          institutionId: inst._id,
        })
      )
    );

    return institutions.map((inst, i) => ({
      ...this.formatInstitution(inst),
      departmentCount: departmentCounts[i] || 0,
    }));
  }

  async findById(tenantId: string, institutionId: string) {
    const institution = (await collections.institutions.findOne({
      _id: new ObjectId(institutionId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<InstitutionDocument> | null;

    if (!institution) {
      throw new ApiError('INSTITUTION_NOT_FOUND', 'Institution not found', 404);
    }

    return this.formatInstitution(institution);
  }

  async create(
    tenantId: string,
    branchId: string,
    data: CreateInstitutionInput,
    createdBy?: string
  ) {
    // Outside universities the default must exist before a second one is
    // added, so a campus's first "real" institution never becomes the default.
    await this.ensureDefaultUnlessUniversity(tenantId, branchId);

    const code = data.code.toUpperCase();
    const existing = await collections.institutions.findOne({
      tenantId: new ObjectId(tenantId),
      code,
    });
    if (existing) {
      throw new ApiError(
        'DUPLICATE_INSTITUTION_CODE',
        'An institution with this code already exists',
        409
      );
    }

    const now = new Date();
    const doc: InstitutionDocument = {
      _id: new ObjectId(),
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      name: data.name,
      code,
      ...(data.kind && { kind: data.kind }),
      settings: data.settings ?? {},
      status: 'active',
      createdAt: now,
      updatedAt: now,
      ...(createdBy && { createdBy: new ObjectId(createdBy) }),
    };

    await collections.institutions.insertOne(doc);

    clearBranchInstitutionCache(tenantId);

    logger.info({ tenantId, institutionId: doc._id.toString() }, 'Institution created');

    return this.formatInstitution(doc as WithId<InstitutionDocument>);
  }

  /**
   * What an institution holds. Documents stay branch-scoped, so the institution
   * reaches them through its departments — that chain is what separates two
   * institutions sharing one campus.
   */
  private async countScopedData(tenantOid: ObjectId, institutionId: ObjectId) {
    const departments = await collections.departments
      .find({ tenantId: tenantOid, institutionId })
      .project({ _id: 1 })
      .toArray();
    const departmentIds = departments.map((d) => d._id);

    const [staff, classes] = departmentIds.length
      ? await Promise.all([
          collections.staff.countDocuments({
            tenantId: tenantOid,
            'employment.departmentId': { $in: departmentIds },
          }),
          collections.classes.countDocuments({
            tenantId: tenantOid,
            departmentId: { $in: departmentIds },
          }),
        ])
      : [0, 0];

    const parts: string[] = [];
    if (departments.length) parts.push(`${departments.length} department(s)`);
    if (staff) parts.push(`${staff} staff`);
    if (classes) parts.push(`${classes} class(es)`);

    return { total: departments.length + staff + classes, summary: parts.join(', ') };
  }

  async update(tenantId: string, institutionId: string, data: UpdateInstitutionInput) {
    const existing = (await collections.institutions.findOne({
      _id: new ObjectId(institutionId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<InstitutionDocument> | null;

    if (!existing) {
      throw new ApiError('INSTITUTION_NOT_FOUND', 'Institution not found', 404);
    }

    if (data.status === 'archived' && existing.isDefault) {
      throw new ApiError(
        'CANNOT_ARCHIVE_DEFAULT',
        'The default institution cannot be archived',
        400
      );
    }

    if (data.code && data.code.toUpperCase() !== existing.code) {
      const conflict = await collections.institutions.findOne({
        tenantId: new ObjectId(tenantId),
        code: data.code.toUpperCase(),
        _id: { $ne: new ObjectId(institutionId) },
      });
      if (conflict) {
        throw new ApiError(
          'DUPLICATE_INSTITUTION_CODE',
          'An institution with this code already exists',
          409
        );
      }
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.code !== undefined) updateData.code = data.code.toUpperCase();
    if (data.kind !== undefined) updateData.kind = data.kind;
    if (data.settings !== undefined) updateData.settings = data.settings;
    if (data.status !== undefined) updateData.status = data.status;

    await collections.institutions.updateOne(
      { _id: new ObjectId(institutionId) },
      { $set: updateData }
    );

    logger.info({ tenantId, institutionId }, 'Institution updated');

    return this.findById(tenantId, institutionId);
  }

  async delete(tenantId: string, institutionId: string) {
    const institution = (await collections.institutions.findOne({
      _id: new ObjectId(institutionId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<InstitutionDocument> | null;

    if (!institution) {
      throw new ApiError('INSTITUTION_NOT_FOUND', 'Institution not found', 404);
    }

    if (institution.isDefault) {
      throw new ApiError('CANNOT_DELETE_DEFAULT', 'The default institution cannot be deleted', 400);
    }

    // The campus outlives the institution now — what blocks a delete is the
    // departments hanging off it and the data they carry.
    const populated = await this.countScopedData(new ObjectId(tenantId), institution._id);
    if (populated.total > 0) {
      throw new ApiError(
        'INSTITUTION_HAS_DATA',
        `Cannot delete an institution holding ${populated.summary}. Move or remove that data first.`,
        400
      );
    }

    await collections.institutions.deleteOne({ _id: institution._id });
    clearBranchInstitutionCache(tenantId);

    logger.info({ tenantId, institutionId }, 'Institution deleted');

    return { success: true };
  }

  private formatInstitution(institution: WithId<InstitutionDocument>) {
    return {
      _id: institution._id.toString(),
      tenantId: institution.tenantId.toString(),
      branchId: institution.branchId?.toString(),
      name: institution.name,
      code: institution.code,
      kind: institution.kind,
      isDefault: !!institution.isDefault,
      settings: institution.settings ?? {},
      status: institution.status,
      createdAt: institution.createdAt,
      updatedAt: institution.updatedAt,
    };
  }
}

export const institutionService = new InstitutionService();

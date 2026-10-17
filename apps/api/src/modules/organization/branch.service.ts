import { ObjectId, WithId, Document, Filter } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { InstitutionType } from '@campus-verse/shared';
import { institutionService } from './institution.service';
import { clearBranchInstitutionCache } from '../../middleware/scope';

interface BranchDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: string;
  name: string;
  code: string;
  institutionType: string;
  location: {
    state: string;
    city: string;
    address: {
      line1: string;
      line2?: string;
      city: string;
      state: string;
      country: string;
      pincode: string;
    };
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  contact?: {
    email?: string;
    phone?: string;
    alternatePhone?: string;
    website?: string;
  };
  infrastructure?: {
    hasHostel?: boolean;
    hasTransport?: boolean;
    hasCanteen?: boolean;
    hasLibrary?: boolean;
    hasLab?: boolean;
  };
  affiliations?: Array<{
    board: string;
    affiliationNumber: string;
    validUntil?: Date;
  }>;
  settings?: {
    weeklyOff?: string[];
    workingHours?: { start: string; end: string };
    attendanceTime?: { start: string; lateAfter: string; end: string };
  };
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
  createdBy?: ObjectId;
}

export interface CreateBranchInput {
  name: string;
  code: string;
  institutionType: InstitutionType;
  location: {
    state: string;
    city: string;
    address: {
      line1: string;
      line2?: string;
      city: string;
      state: string;
      country: string;
      pincode: string;
    };
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  contact?: {
    email?: string;
    phone?: string;
    alternatePhone?: string;
    website?: string;
  };
  infrastructure?: {
    hasHostel?: boolean;
    hasTransport?: boolean;
    hasCanteen?: boolean;
    hasLibrary?: boolean;
    hasLab?: boolean;
  };
  affiliations?: Array<{
    board: string;
    affiliationNumber: string;
    validUntil?: Date;
  }>;
  settings?: {
    weeklyOff?: string[];
    workingHours?: { start: string; end: string };
    attendanceTime?: { start: string; lateAfter: string; end: string };
  };
}

export interface UpdateBranchInput extends Partial<CreateBranchInput> {
  status?: 'active' | 'inactive';
}

export interface BranchListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'active' | 'inactive';
  institutionType?: InstitutionType;
  state?: string;
  city?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * A campus's type comes from the organization's signup choice. A single-type
 * organization (Verse University: university) has every campus of that type,
 * whatever the request says; a mixed group may pick, but only its own types.
 */
function campusTypeFor(tenantTypes: string[] | undefined, requested?: string): InstitutionType {
  const allowed = (tenantTypes?.length ? tenantTypes : ['school']) as InstitutionType[];
  if (allowed.length === 1) return allowed[0];
  if (requested && allowed.includes(requested as InstitutionType))
    return requested as InstitutionType;
  if (requested) {
    throw new ApiError(
      'INSTITUTION_TYPE_NOT_ALLOWED',
      `This organization runs ${allowed.join(', ')} campuses only`,
      400
    );
  }
  return allowed[0];
}

class BranchService {
  async create(tenantId: string, data: CreateBranchInput, userId?: string) {
    // Check if branch code already exists for this tenant
    const existingBranch = await collections.branches.findOne({
      tenantId: new ObjectId(tenantId),
      code: data.code.toUpperCase(),
    });

    if (existingBranch) {
      throw new ApiError('DUPLICATE_BRANCH_CODE', 'A branch with this code already exists', 409);
    }

    // Check tenant subscription limits
    const tenant = await collections.tenants.findOne({ _id: new ObjectId(tenantId) });
    if (!tenant) {
      throw new ApiError('TENANT_NOT_FOUND', 'Tenant not found', 404);
    }

    const branchCount = await collections.branches.countDocuments({
      tenantId: new ObjectId(tenantId),
    });

    // The plan sets the limit; a stored number from an older approval or a
    // self-serve signup (always 3) must not undercut it.
    const tenantData = tenant as { subscription?: { maxBranches?: number; plan?: string } };
    const planLimit =
      { starter: 3, professional: 10, enterprise: 50 }[tenantData.subscription?.plan ?? ''] ?? 1;
    const maxBranches = Math.max(tenantData.subscription?.maxBranches || 1, planLimit);
    if (branchCount >= maxBranches) {
      throw new ApiError(
        'BRANCH_LIMIT_EXCEEDED',
        `Your ${tenantData.subscription?.plan ?? 'current'} plan allows ${maxBranches} campuses and all ${branchCount} are in use. Contact support to upgrade.`,
        403
      );
    }

    const branchId = new ObjectId();
    const now = new Date();

    // Use provided institutionType or default to tenant's first institutionType
    const tenantWithTypes = tenant as { institutionTypes?: string[] };
    const institutionType = campusTypeFor(tenantWithTypes.institutionTypes, data.institutionType);

    const branch: Omit<BranchDocument, '_id'> & { _id: ObjectId } = {
      _id: branchId,
      tenantId: new ObjectId(tenantId),
      branchId: branchId.toString(),
      name: data.name,
      code: data.code.toUpperCase(),
      institutionType,
      location: data.location,
      contact: data.contact,
      infrastructure: data.infrastructure,
      affiliations: data.affiliations,
      settings: data.settings,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      ...(userId && { createdBy: new ObjectId(userId) }),
    };

    await collections.branches.insertOne(branch);

    // A campus hosts institutions, so give the new one its default immediately.
    // Non-fatal: a campus without it self-heals on the next institution read.
    try {
      await institutionService.ensureDefaultUnlessUniversity(tenantId, branchId.toString());
    } catch (err) {
      logger.warn({ tenantId, branchId: branchId.toString(), err }, 'Default institution deferred');
    }

    clearBranchInstitutionCache(tenantId);

    logger.info({ branchId: branchId.toString(), tenantId }, 'Branch created');

    return this.formatBranch(branch as WithId<BranchDocument>);
  }

  async findById(tenantId: string, branchId: string) {
    const branch = (await collections.branches.findOne({
      _id: new ObjectId(branchId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<BranchDocument> | null;

    if (!branch) {
      throw new ApiError('BRANCH_NOT_FOUND', 'Branch not found', 404);
    }

    return this.formatBranch(branch);
  }

  async findAll(tenantId: string, params: BranchListParams = {}) {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      institutionType,
      state,
      city,
      sortBy = 'name',
      sortOrder = 'asc',
    } = params;

    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
    };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { 'location.city': { $regex: search, $options: 'i' } },
      ];
    }

    if (status) {
      filter.status = status;
    }

    if (institutionType) {
      filter.institutionType = institutionType;
    }

    if (state) {
      filter['location.state'] = state;
    }

    if (city) {
      filter['location.city'] = city;
    }

    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const [branches, total] = await Promise.all([
      collections.branches
        .find(filter)
        .sort({ [sortBy]: sortDirection, _id: sortDirection })
        .skip(skip)
        .limit(limit)
        .toArray() as Promise<WithId<BranchDocument>[]>,
      collections.branches.countDocuments(filter),
    ]);

    // Per-branch counts. We use parallel countDocuments calls (one per branch)
    // matching the EXACT same pattern as getStats() below — that pattern is
    // proven to work on the per-branch detail card. Previously this used a
    // bulk $group aggregation which silently returned 0 in some data shapes
    // (suspected: when branchId is stored as a string instead of ObjectId on
    // legacy/imported records). The N+1 cost is negligible — branch lists are
    // small (typically < 50) and counts are indexed.
    const tenantObjId = new ObjectId(tenantId);
    const [studentCountsPerBranch, staffCountsPerBranch] = await Promise.all([
      Promise.all(
        branches.map((b) =>
          collections.students.countDocuments({
            tenantId: tenantObjId,
            branchId: b._id,
          })
        )
      ),
      Promise.all(
        branches.map((b) =>
          collections.staff.countDocuments({
            tenantId: tenantObjId,
            branchId: b._id,
          })
        )
      ),
    ]);

    return {
      data: branches.map((branch, i) => ({
        ...this.formatBranch(branch),
        studentCount: studentCountsPerBranch[i] || 0,
        staffCount: staffCountsPerBranch[i] || 0,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + branches.length < total,
      },
    };
  }

  async update(tenantId: string, branchId: string, data: UpdateBranchInput) {
    const existingBranch = await collections.branches.findOne({
      _id: new ObjectId(branchId),
      tenantId: new ObjectId(tenantId),
    });

    if (!existingBranch) {
      throw new ApiError('BRANCH_NOT_FOUND', 'Branch not found', 404);
    }

    // Check if new code conflicts with existing branch
    if (data.code && data.code.toUpperCase() !== (existingBranch as BranchDocument).code) {
      const codeConflict = await collections.branches.findOne({
        tenantId: new ObjectId(tenantId),
        code: data.code.toUpperCase(),
        _id: { $ne: new ObjectId(branchId) },
      });

      if (codeConflict) {
        throw new ApiError('DUPLICATE_BRANCH_CODE', 'A branch with this code already exists', 409);
      }
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.code !== undefined) updateData.code = data.code.toUpperCase();
    if (data.institutionType !== undefined) {
      const tenant = await collections.tenants.findOne(
        { _id: new ObjectId(tenantId) },
        { projection: { institutionTypes: 1 } }
      );
      updateData.institutionType = campusTypeFor(
        tenant?.institutionTypes as string[] | undefined,
        data.institutionType
      );
    }
    if (data.location !== undefined) updateData.location = data.location;
    if (data.contact !== undefined) updateData.contact = data.contact;
    if (data.infrastructure !== undefined) updateData.infrastructure = data.infrastructure;
    if (data.affiliations !== undefined) updateData.affiliations = data.affiliations;
    if (data.settings !== undefined) updateData.settings = data.settings;
    if (data.status !== undefined) updateData.status = data.status;

    await collections.branches.updateOne({ _id: new ObjectId(branchId) }, { $set: updateData });
    clearBranchInstitutionCache(tenantId);

    logger.info({ branchId, tenantId }, 'Branch updated');

    return this.findById(tenantId, branchId);
  }

  async delete(tenantId: string, branchId: string) {
    const branch = await collections.branches.findOne({
      _id: new ObjectId(branchId),
      tenantId: new ObjectId(tenantId),
    });

    if (!branch) {
      throw new ApiError('BRANCH_NOT_FOUND', 'Branch not found', 404);
    }

    // Check if branch has any associated data
    const [studentCount, staffCount] = await Promise.all([
      collections.students.countDocuments({ branchId: new ObjectId(branchId) }),
      collections.staff.countDocuments({ branchId: new ObjectId(branchId) }),
    ]);

    if (studentCount > 0 || staffCount > 0) {
      throw new ApiError(
        'BRANCH_HAS_DATA',
        `Cannot delete branch with existing data (${studentCount} students, ${staffCount} staff). Deactivate instead.`,
        400
      );
    }

    await collections.branches.deleteOne({ _id: new ObjectId(branchId) });

    logger.info({ branchId, tenantId }, 'Branch deleted');

    return { success: true };
  }

  async getStats(tenantId: string, branchId: string) {
    const branch = await collections.branches.findOne({
      _id: new ObjectId(branchId),
      tenantId: new ObjectId(tenantId),
    });

    if (!branch) {
      throw new ApiError('BRANCH_NOT_FOUND', 'Branch not found', 404);
    }

    const branchObjId = new ObjectId(branchId);

    const [totalStudents, activeStudents, totalStaff, activeStaff, classCount] = await Promise.all([
      collections.students.countDocuments({ branchId: branchObjId }),
      collections.students.countDocuments({ branchId: branchObjId, status: 'active' }),
      collections.staff.countDocuments({ branchId: branchObjId }),
      collections.staff.countDocuments({ branchId: branchObjId, status: 'active' }),
      collections.classes.countDocuments({ branchId: branchObjId }),
    ]);

    return {
      students: {
        total: totalStudents,
        active: activeStudents,
      },
      staff: {
        total: totalStaff,
        active: activeStaff,
      },
      classes: classCount,
    };
  }

  async getStatesAndCities(tenantId: string) {
    const branches = await collections.branches
      .find({ tenantId: new ObjectId(tenantId) })
      .project({ 'location.state': 1, 'location.city': 1 })
      .toArray();

    const stateMap = new Map<string, Set<string>>();

    branches.forEach((branch) => {
      const state = (branch as BranchDocument).location?.state;
      const city = (branch as BranchDocument).location?.city;

      if (state) {
        if (!stateMap.has(state)) {
          stateMap.set(state, new Set());
        }
        if (city) {
          stateMap.get(state)!.add(city);
        }
      }
    });

    return Array.from(stateMap.entries()).map(([state, cities]) => ({
      state,
      cities: Array.from(cities).sort(),
    }));
  }

  private formatBranch(branch: WithId<BranchDocument>) {
    return {
      _id: branch._id.toString(),
      tenantId: branch.tenantId.toString(),
      branchId: branch._id.toString(),
      name: branch.name,
      code: branch.code,
      institutionType: branch.institutionType as InstitutionType,
      location: branch.location,
      contact: branch.contact,
      infrastructure: branch.infrastructure,
      affiliations: branch.affiliations,
      settings: branch.settings,
      status: branch.status,
      createdAt: branch.createdAt,
      updatedAt: branch.updatedAt,
    };
  }
}

export const branchService = new BranchService();

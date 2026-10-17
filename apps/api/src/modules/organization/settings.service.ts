import { ObjectId } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { clearDepartmentScopeFlagCache } from '../../middleware/scope';
import { clearFeatureCache } from '../../middleware/moduleGating';
import {
  AcademicHierarchyConfig,
  DEFAULT_HIERARCHY_CONFIG,
  HierarchyLevel,
  InstitutionType,
} from '@campus-verse/shared';
import { ensureCoreModules } from '@campus-verse/shared/constants';

interface TenantSettings {
  timezone: string;
  dateFormat: string;
  currency: string;
  fiscalYearStart: string;
  /**
   * Enforce accessScope.type 'department' as a real narrowing filter. Off by
   * default because departmentIds rode in the JWT unenforced for years —
   * turning it on immediately narrows every department-scoped user, so it is
   * the tenant's decision, not ours.
   */
  enforceDepartmentScope?: boolean;
}

interface TenantContact {
  email: string;
  phone: string;
  website?: string;
  address: {
    /** Canonical street field — matches addressSchema, seeds and tenant
     *  creation. Legacy records may carry `street` instead; reads fall back. */
    line1: string;
    city: string;
    state: string;
    country: string;
    pincode: string;
  };
}

interface TenantLegalInfo {
  entityName?: string;
  gstNumber?: string;
  panNumber?: string;
  registrationNumber?: string;
  board?: string;
}

interface TenantBranding {
  logo?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

export interface UpdateSettingsInput {
  timezone?: string;
  dateFormat?: string;
  currency?: string;
  fiscalYearStart?: string;
  enforceDepartmentScope?: boolean;
}

export interface UpdateContactInput {
  email?: string;
  phone?: string;
  website?: string;
  address?: {
    line1?: string;
    /** @deprecated legacy alias for line1, still accepted from older clients. */
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    pincode?: string;
  };
}

export interface UpdateLegalInfoInput {
  entityName?: string;
  gstNumber?: string;
  panNumber?: string;
  registrationNumber?: string;
  board?: string;
}

export interface UpdateBrandingInput {
  logo?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

class SettingsService {
  async getOrganizationProfile(tenantId: string) {
    const tenant = await collections.tenants.findOne(
      { _id: new ObjectId(tenantId) },
      {
        projection: {
          name: 1,
          code: 1,
          institutionTypes: 1,
          contact: 1,
          legalInfo: 1,
          branding: 1,
          subscription: 1,
          settings: 1,
          status: 1,
          createdAt: 1,
        },
      }
    );

    if (!tenant) {
      throw new ApiError('TENANT_NOT_FOUND', 'Organization not found', 404);
    }

    return {
      _id: tenant._id.toString(),
      name: tenant.name,
      code: tenant.code,
      institutionTypes: tenant.institutionTypes,
      contact: tenant.contact,
      legalInfo: tenant.legalInfo,
      branding: tenant.branding,
      subscription: {
        plan: tenant.subscription?.plan,
        features: tenant.subscription?.features || [],
        maxBranches: tenant.subscription?.maxBranches,
        maxStudents: tenant.subscription?.maxStudents,
        maxStaff: tenant.subscription?.maxStaff,
        validUntil: tenant.subscription?.validUntil,
      },
      settings: tenant.settings,
      status: tenant.status,
      createdAt: tenant.createdAt,
    };
  }

  async getSettings(tenantId: string): Promise<TenantSettings> {
    const tenant = await collections.tenants.findOne(
      { _id: new ObjectId(tenantId) },
      { projection: { settings: 1 } }
    );

    if (!tenant) {
      throw new ApiError('TENANT_NOT_FOUND', 'Organization not found', 404);
    }

    return (
      tenant.settings || {
        timezone: 'Asia/Kolkata',
        dateFormat: 'DD/MM/YYYY',
        currency: 'INR',
        fiscalYearStart: '04-01',
        enforceDepartmentScope: false,
      }
    );
  }

  async updateSettings(
    tenantId: string,
    data: UpdateSettingsInput,
    updatedBy: string
  ): Promise<TenantSettings> {
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.timezone) updateData['settings.timezone'] = data.timezone;
    if (data.dateFormat) updateData['settings.dateFormat'] = data.dateFormat;
    if (data.currency) updateData['settings.currency'] = data.currency;
    if (data.fiscalYearStart) updateData['settings.fiscalYearStart'] = data.fiscalYearStart;
    if (data.enforceDepartmentScope !== undefined) {
      updateData['settings.enforceDepartmentScope'] = data.enforceDepartmentScope;
      // The flag is cached for 5 minutes per tenant; without this the switch
      // would appear to do nothing for the rest of the window.
      clearDepartmentScopeFlagCache(tenantId);
    }

    const result = await collections.tenants.findOneAndUpdate(
      { _id: new ObjectId(tenantId) },
      { $set: updateData },
      { returnDocument: 'after', projection: { settings: 1 } }
    );

    if (!result) {
      throw new ApiError('TENANT_NOT_FOUND', 'Organization not found', 404);
    }

    logger.info({ tenantId, updatedBy }, 'Organization settings updated');

    return result.settings;
  }

  async getContact(tenantId: string): Promise<TenantContact> {
    const tenant = await collections.tenants.findOne(
      { _id: new ObjectId(tenantId) },
      { projection: { contact: 1 } }
    );

    if (!tenant) {
      throw new ApiError('TENANT_NOT_FOUND', 'Organization not found', 404);
    }

    return tenant.contact;
  }

  async updateContact(
    tenantId: string,
    data: UpdateContactInput,
    updatedBy: string
  ): Promise<TenantContact> {
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.email) updateData['contact.email'] = data.email;
    if (data.phone) updateData['contact.phone'] = data.phone;
    if (data.website !== undefined) updateData['contact.website'] = data.website;
    if (data.address) {
      // Persist to line1 — the field addressSchema, the seeds, tenant creation
      // and the setup checklist all use. Writing `street` here is what left
      // "Complete your contact address" permanently unticked.
      const line1 = data.address.line1 ?? data.address.street;
      if (line1) {
        updateData['contact.address.line1'] = line1;
        updateData['contact.address.street'] = line1; // keep legacy readers in sync
      }
      if (data.address.city) updateData['contact.address.city'] = data.address.city;
      if (data.address.state) updateData['contact.address.state'] = data.address.state;
      if (data.address.country) updateData['contact.address.country'] = data.address.country;
      if (data.address.pincode) updateData['contact.address.pincode'] = data.address.pincode;
    }

    const result = await collections.tenants.findOneAndUpdate(
      { _id: new ObjectId(tenantId) },
      { $set: updateData },
      { returnDocument: 'after', projection: { contact: 1 } }
    );

    if (!result) {
      throw new ApiError('TENANT_NOT_FOUND', 'Organization not found', 404);
    }

    logger.info({ tenantId, updatedBy }, 'Organization contact updated');

    return result.contact;
  }

  async getLegalInfo(tenantId: string): Promise<TenantLegalInfo> {
    const tenant = await collections.tenants.findOne(
      { _id: new ObjectId(tenantId) },
      { projection: { legalInfo: 1 } }
    );

    if (!tenant) {
      throw new ApiError('TENANT_NOT_FOUND', 'Organization not found', 404);
    }

    return tenant.legalInfo || {};
  }

  async updateLegalInfo(
    tenantId: string,
    data: UpdateLegalInfoInput,
    updatedBy: string
  ): Promise<TenantLegalInfo> {
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.entityName !== undefined) updateData['legalInfo.entityName'] = data.entityName;
    if (data.gstNumber !== undefined) updateData['legalInfo.gstNumber'] = data.gstNumber;
    if (data.panNumber !== undefined) updateData['legalInfo.panNumber'] = data.panNumber;
    if (data.registrationNumber !== undefined)
      updateData['legalInfo.registrationNumber'] = data.registrationNumber;
    if (data.board !== undefined) updateData['legalInfo.board'] = data.board;

    const result = await collections.tenants.findOneAndUpdate(
      { _id: new ObjectId(tenantId) },
      { $set: updateData },
      { returnDocument: 'after', projection: { legalInfo: 1 } }
    );

    if (!result) {
      throw new ApiError('TENANT_NOT_FOUND', 'Organization not found', 404);
    }

    logger.info({ tenantId, updatedBy }, 'Organization legal info updated');

    return result.legalInfo || {};
  }

  async getBranding(tenantId: string): Promise<TenantBranding> {
    const tenant = await collections.tenants.findOne(
      { _id: new ObjectId(tenantId) },
      { projection: { branding: 1 } }
    );

    if (!tenant) {
      throw new ApiError('TENANT_NOT_FOUND', 'Organization not found', 404);
    }

    return tenant.branding || {};
  }

  async updateBranding(
    tenantId: string,
    data: UpdateBrandingInput,
    updatedBy: string
  ): Promise<TenantBranding> {
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.logo !== undefined) updateData['branding.logo'] = data.logo;
    if (data.primaryColor !== undefined) updateData['branding.primaryColor'] = data.primaryColor;
    if (data.secondaryColor !== undefined)
      updateData['branding.secondaryColor'] = data.secondaryColor;

    const result = await collections.tenants.findOneAndUpdate(
      { _id: new ObjectId(tenantId) },
      { $set: updateData },
      { returnDocument: 'after', projection: { branding: 1 } }
    );

    if (!result) {
      throw new ApiError('TENANT_NOT_FOUND', 'Organization not found', 404);
    }

    logger.info({ tenantId, updatedBy }, 'Organization branding updated');

    return result.branding || {};
  }

  async getEnabledModules(tenantId: string): Promise<string[]> {
    const tenant = await collections.tenants.findOne(
      { _id: new ObjectId(tenantId) },
      { projection: { 'subscription.features': 1 } }
    );

    if (!tenant) {
      throw new ApiError('TENANT_NOT_FOUND', 'Organization not found', 404);
    }

    return tenant.subscription?.features || ['core'];
  }

  async updateEnabledModules(
    tenantId: string,
    modules: string[],
    updatedBy: string
  ): Promise<string[]> {
    // Drop invalid codes and ensure core modules are always included
    const enabledModules = ensureCoreModules(modules);

    const result = await collections.tenants.findOneAndUpdate(
      { _id: new ObjectId(tenantId) },
      {
        $set: {
          'subscription.features': enabledModules,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after', projection: { 'subscription.features': 1 } }
    );

    if (!result) {
      throw new ApiError('TENANT_NOT_FOUND', 'Organization not found', 404);
    }

    // Clear the feature cache for this tenant
    clearFeatureCache(tenantId);

    logger.info({ tenantId, updatedBy, modules: enabledModules }, 'Organization modules updated');

    return result.subscription?.features || enabledModules;
  }

  /**
   * Resolve the academic hierarchy for a branch, falling through:
   *   branch.academicHierarchy → tenant.academicHierarchy → DEFAULT[branch.institutionType]
   *
   * When `branchId` is omitted, returns the tenant-level fallback (or the
   * default for the tenant's primary institution type).
   */
  async getAcademicHierarchy(
    tenantId: string,
    branchId?: string
  ): Promise<AcademicHierarchyConfig & { source: 'branch' | 'tenant' | 'default' }> {
    if (branchId) {
      const branch = await collections.branches.findOne(
        { _id: new ObjectId(branchId), tenantId: new ObjectId(tenantId) },
        { projection: { academicHierarchy: 1, institutionType: 1 } }
      );

      if (!branch) {
        throw new ApiError('BRANCH_NOT_FOUND', 'Branch not found', 404);
      }

      if (branch.academicHierarchy?.levels?.length) {
        return { ...branch.academicHierarchy, source: 'branch' };
      }

      const tenant = await collections.tenants.findOne(
        { _id: new ObjectId(tenantId) },
        { projection: { academicHierarchy: 1 } }
      );

      if (tenant?.academicHierarchy?.levels?.length) {
        return { ...tenant.academicHierarchy, source: 'tenant' };
      }

      const institutionType = (branch.institutionType as InstitutionType) || 'school';
      return { ...DEFAULT_HIERARCHY_CONFIG[institutionType], source: 'default' };
    }

    const tenant = await collections.tenants.findOne(
      { _id: new ObjectId(tenantId) },
      { projection: { academicHierarchy: 1, institutionTypes: 1 } }
    );

    if (!tenant) {
      throw new ApiError('TENANT_NOT_FOUND', 'Organization not found', 404);
    }

    if (tenant.academicHierarchy?.levels?.length) {
      return { ...tenant.academicHierarchy, source: 'tenant' };
    }

    const primaryInstitutionType: InstitutionType =
      (tenant.institutionTypes?.[0] as InstitutionType) || 'school';
    return { ...DEFAULT_HIERARCHY_CONFIG[primaryInstitutionType], source: 'default' };
  }

  /**
   * Ordered non-leaf level keys — the shape every stored class `path[]` must
   * match (see validatePath in class.service). Two configs with the same
   * non-leaf key sequence are interchangeable for existing classes, so
   * label/plural/leaf-name edits are always safe.
   */
  private nonLeafKeys(levels: HierarchyLevel[]): string[] {
    return [...levels]
      .sort((a, b) => a.order - b.order)
      .filter((l) => !l.isLeaf)
      .map((l) => l.key);
  }

  /**
   * Throw when switching a branch's resolved hierarchy to `newLevels` would
   * strand its existing classes — their `path[]` was validated against
   * `currentLevels` and every subsequent class edit would fail INVALID_PATH.
   */
  private async assertNoStrandedClasses(
    tenantId: string,
    branchId: ObjectId,
    branchName: string | undefined,
    currentLevels: HierarchyLevel[],
    newLevels: HierarchyLevel[]
  ): Promise<void> {
    if (this.nonLeafKeys(currentLevels).join('/') === this.nonLeafKeys(newLevels).join('/')) {
      return; // same shape — only labels differ, classes are unaffected
    }
    const classCount = await collections.classes.countDocuments({
      tenantId: new ObjectId(tenantId),
      branchId,
    });
    if (classCount > 0) {
      const where = branchName ? ` in branch "${branchName}"` : '';
      throw new ApiError(
        'HIERARCHY_IN_USE',
        `Cannot change the level structure: ${classCount} existing class(es)${where} were created with the current levels. Renaming labels is always allowed; to change the levels themselves, delete or migrate those classes first.`,
        409
      );
    }
  }

  async updateAcademicHierarchy(
    tenantId: string,
    data: AcademicHierarchyConfig,
    updatedBy: string,
    branchId?: string
  ): Promise<AcademicHierarchyConfig> {
    const sortedLevels = [...data.levels].sort((a, b) => a.order - b.order);

    if (branchId) {
      const current = await this.getAcademicHierarchy(tenantId, branchId);
      await this.assertNoStrandedClasses(
        tenantId,
        new ObjectId(branchId),
        undefined,
        current.levels,
        sortedLevels
      );

      const result = await collections.branches.findOneAndUpdate(
        { _id: new ObjectId(branchId), tenantId: new ObjectId(tenantId) },
        {
          $set: {
            academicHierarchy: { levels: sortedLevels },
            updatedAt: new Date(),
          },
        },
        { returnDocument: 'after', projection: { academicHierarchy: 1 } }
      );

      if (!result) {
        throw new ApiError('BRANCH_NOT_FOUND', 'Branch not found', 404);
      }

      logger.info(
        { tenantId, branchId, updatedBy, levelCount: sortedLevels.length },
        'Branch academic hierarchy updated'
      );

      return result.academicHierarchy;
    }

    // Tenant-level config governs every branch WITHOUT its own override —
    // make sure none of them has classes built on a different level shape.
    const [tenant, branches] = await Promise.all([
      collections.tenants.findOne(
        { _id: new ObjectId(tenantId) },
        { projection: { academicHierarchy: 1 } }
      ),
      collections.branches
        .find({ tenantId: new ObjectId(tenantId) })
        .project({ _id: 1, name: 1, institutionType: 1, academicHierarchy: 1 })
        .toArray(),
    ]);

    if (!tenant) {
      throw new ApiError('TENANT_NOT_FOUND', 'Organization not found', 404);
    }

    for (const b of branches) {
      if (b.academicHierarchy?.levels?.length) continue; // branch override wins
      const currentLevels: HierarchyLevel[] = tenant.academicHierarchy?.levels?.length
        ? tenant.academicHierarchy.levels
        : DEFAULT_HIERARCHY_CONFIG[(b.institutionType as InstitutionType) || 'school'].levels;
      await this.assertNoStrandedClasses(
        tenantId,
        b._id as ObjectId,
        b.name as string | undefined,
        currentLevels,
        sortedLevels
      );
    }

    const result = await collections.tenants.findOneAndUpdate(
      { _id: new ObjectId(tenantId) },
      {
        $set: {
          academicHierarchy: { levels: sortedLevels },
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after', projection: { academicHierarchy: 1 } }
    );

    if (!result) {
      throw new ApiError('TENANT_NOT_FOUND', 'Organization not found', 404);
    }

    logger.info(
      { tenantId, updatedBy, levelCount: sortedLevels.length },
      'Tenant academic hierarchy updated'
    );

    return result.academicHierarchy;
  }

  async resetAcademicHierarchy(
    tenantId: string,
    updatedBy: string,
    branchId?: string
  ): Promise<AcademicHierarchyConfig> {
    if (branchId) {
      // Reset = unset the branch override; falls back to tenant or default
      const branch = await collections.branches.findOne(
        { _id: new ObjectId(branchId), tenantId: new ObjectId(tenantId) },
        { projection: { name: 1, institutionType: 1, academicHierarchy: 1 } }
      );

      if (!branch) {
        throw new ApiError('BRANCH_NOT_FOUND', 'Branch not found', 404);
      }

      // Guard: if removing the override changes the level shape the branch's
      // classes were built on, block instead of stranding them.
      if (branch.academicHierarchy?.levels?.length) {
        const tenant = await collections.tenants.findOne(
          { _id: new ObjectId(tenantId) },
          { projection: { academicHierarchy: 1 } }
        );
        const fallbackLevels: HierarchyLevel[] = tenant?.academicHierarchy?.levels?.length
          ? tenant.academicHierarchy.levels
          : DEFAULT_HIERARCHY_CONFIG[(branch.institutionType as InstitutionType) || 'school']
              .levels;
        await this.assertNoStrandedClasses(
          tenantId,
          new ObjectId(branchId),
          branch.name as string | undefined,
          branch.academicHierarchy.levels,
          fallbackLevels
        );
      }

      await collections.branches.updateOne(
        { _id: new ObjectId(branchId), tenantId: new ObjectId(tenantId) },
        { $unset: { academicHierarchy: '' }, $set: { updatedAt: new Date() } }
      );

      logger.info({ tenantId, branchId, updatedBy }, 'Branch academic hierarchy reset');

      const resolved = await this.getAcademicHierarchy(tenantId, branchId);
      return { levels: resolved.levels };
    }

    const tenant = await collections.tenants.findOne(
      { _id: new ObjectId(tenantId) },
      { projection: { institutionTypes: 1, academicHierarchy: 1 } }
    );

    if (!tenant) {
      throw new ApiError('TENANT_NOT_FOUND', 'Organization not found', 404);
    }

    // Guard: after the reset, branches without their own override fall back to
    // the default for THEIR institution type — block if that would strand
    // classes built on the current tenant config.
    if (tenant.academicHierarchy?.levels?.length) {
      const branches = await collections.branches
        .find({ tenantId: new ObjectId(tenantId) })
        .project({ _id: 1, name: 1, institutionType: 1, academicHierarchy: 1 })
        .toArray();
      for (const b of branches) {
        if (b.academicHierarchy?.levels?.length) continue; // branch override wins
        const fallbackLevels =
          DEFAULT_HIERARCHY_CONFIG[(b.institutionType as InstitutionType) || 'school'].levels;
        await this.assertNoStrandedClasses(
          tenantId,
          b._id as ObjectId,
          b.name as string | undefined,
          tenant.academicHierarchy.levels,
          fallbackLevels
        );
      }
    }

    // Reset = remove the tenant override so each branch falls back to the
    // default for ITS OWN institution type (mirrors the branch-level reset).
    // Writing DEFAULT[primary type] here instead would pin mixed-type tenants
    // to one type's hierarchy.
    await collections.tenants.updateOne(
      { _id: new ObjectId(tenantId) },
      { $unset: { academicHierarchy: '' }, $set: { updatedAt: new Date() } }
    );

    logger.info({ tenantId, updatedBy }, 'Tenant academic hierarchy reset to default');

    const resolved = await this.getAcademicHierarchy(tenantId);
    return { levels: resolved.levels };
  }
}

export const settingsService = new SettingsService();

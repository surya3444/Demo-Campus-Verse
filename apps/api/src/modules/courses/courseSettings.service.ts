import { ObjectId, WithId, Document } from 'mongodb';
import { collections } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler';
import { logger } from '../../lib/logger';

// ============ Settings Types ============

type CourseCategory =
  | 'technical'
  | 'soft_skills'
  | 'aptitude'
  | 'language'
  | 'domain_specific'
  | 'certification_prep'
  | 'career_readiness'
  | 'general';

type CourseLevel = 'beginner' | 'intermediate' | 'advanced';
type CourseVisibility = 'branch' | 'selected_branches' | 'all';

interface CourseSettingsDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;

  // Defaults applied to new courses
  defaults: {
    category: CourseCategory;
    level: CourseLevel;
    visibility: CourseVisibility;
  };

  // Publishing & enrollment policies
  policies: {
    requireApproval: boolean;
    autoPublishOnApproval: boolean;
    allowSelfEnrollment: boolean;
  };

  createdAt: Date;
  updatedAt: Date;
  updatedBy?: ObjectId;
}

const DEFAULT_SETTINGS = {
  defaults: {
    category: 'general' as CourseCategory,
    level: 'beginner' as CourseLevel,
    visibility: 'branch' as CourseVisibility,
  },
  policies: {
    requireApproval: true,
    autoPublishOnApproval: true,
    allowSelfEnrollment: false,
  },
};

export interface UpdateCourseSettingsInput {
  defaults?: Partial<CourseSettingsDocument['defaults']>;
  policies?: Partial<CourseSettingsDocument['policies']>;
}

class CourseSettingsService {
  async getSettings(tenantId: string, branchId: string) {
    // Verify branch belongs to tenant
    const branch = await collections.branches.findOne({
      _id: new ObjectId(branchId),
      tenantId: new ObjectId(tenantId),
    });
    if (!branch) {
      throw new ApiError('BRANCH_NOT_FOUND', 'Branch not found', 404);
    }

    let settings = (await collections.courseSettings.findOne({
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    })) as WithId<CourseSettingsDocument> | null;

    // Auto-create defaults on first read so the frontend always has a value to render
    if (!settings) {
      const now = new Date();
      const newSettings = {
        _id: new ObjectId(),
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        ...DEFAULT_SETTINGS,
        createdAt: now,
        updatedAt: now,
      };
      await collections.courseSettings.insertOne(newSettings);
      settings = newSettings as WithId<CourseSettingsDocument>;
      logger.info({ tenantId, branchId }, 'Created default course settings');
    }

    return this.format(settings);
  }

  async updateSettings(
    tenantId: string,
    branchId: string,
    data: UpdateCourseSettingsInput,
    updatedBy: string
  ) {
    const branch = await collections.branches.findOne({
      _id: new ObjectId(branchId),
      tenantId: new ObjectId(tenantId),
    });
    if (!branch) {
      throw new ApiError('BRANCH_NOT_FOUND', 'Branch not found', 404);
    }

    // Ensure a record exists
    await this.getSettings(tenantId, branchId);

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
      updatedBy: new ObjectId(updatedBy),
    };

    if (data.defaults) {
      // Merge into nested object using dot-notation so we don't blow away other fields
      Object.entries(data.defaults).forEach(([k, v]) => {
        if (v !== undefined) updateData[`defaults.${k}`] = v;
      });
    }
    if (data.policies) {
      Object.entries(data.policies).forEach(([k, v]) => {
        if (v !== undefined) updateData[`policies.${k}`] = v;
      });
    }

    await collections.courseSettings.updateOne(
      {
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
      },
      { $set: updateData }
    );

    logger.info({ tenantId, branchId, updatedBy }, 'Course settings updated');
    return this.getSettings(tenantId, branchId);
  }

  private format(doc: WithId<CourseSettingsDocument>) {
    return {
      _id: doc._id.toString(),
      tenantId: doc.tenantId.toString(),
      branchId: doc.branchId.toString(),
      defaults: doc.defaults,
      policies: doc.policies,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      updatedBy: doc.updatedBy?.toString(),
    };
  }
}

export const courseSettingsService = new CourseSettingsService();

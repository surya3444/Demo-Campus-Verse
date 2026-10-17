import { ObjectId, WithId, Document } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';

// ============ Approval Email Settings Types ============
interface ApprovalEmailConfig {
  enabled: boolean;
  notifyOnRequest: boolean;
  notifyOnApproval: boolean;
  notifyOnRejection: boolean;
  notifyOnUndo: boolean;
  recipientRoles: string[];
  emailTemplateId?: string;
}

interface ApprovalSettingsDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;

  // Email settings per approval type
  concessionEmailSettings: ApprovalEmailConfig;
  feeCancellationEmailSettings: ApprovalEmailConfig;
  leaveEmailSettings: ApprovalEmailConfig;
  certificateEmailSettings: ApprovalEmailConfig;

  // General settings
  autoApproveThreshold: {
    concession: number; // Auto-approve concessions below this amount
    feeCancellation: number; // Auto-approve cancellations below this amount
  };

  escalationSettings: {
    enabled: boolean;
    escalateAfterDays: number;
    escalationRoles: string[];
  };

  createdAt: Date;
  updatedAt: Date;
}

const DEFAULT_EMAIL_CONFIG: ApprovalEmailConfig = {
  enabled: true,
  notifyOnRequest: true,
  notifyOnApproval: true,
  notifyOnRejection: true,
  notifyOnUndo: true,
  recipientRoles: ['BRANCH_ADMIN', 'FINANCE_HEAD'],
  emailTemplateId: undefined,
};

const DEFAULT_APPROVAL_SETTINGS: Omit<
  ApprovalSettingsDocument,
  '_id' | 'tenantId' | 'branchId' | 'createdAt' | 'updatedAt'
> = {
  concessionEmailSettings: { ...DEFAULT_EMAIL_CONFIG },
  feeCancellationEmailSettings: { ...DEFAULT_EMAIL_CONFIG },
  leaveEmailSettings: { ...DEFAULT_EMAIL_CONFIG, recipientRoles: ['HR_ADMIN', 'HR_HEAD'] },
  certificateEmailSettings: {
    ...DEFAULT_EMAIL_CONFIG,
    recipientRoles: ['BRANCH_ADMIN', 'ADMIN_STAFF'],
  },
  autoApproveThreshold: {
    concession: 0,
    feeCancellation: 0,
  },
  escalationSettings: {
    enabled: false,
    escalateAfterDays: 3,
    escalationRoles: ['BRANCH_ADMIN'],
  },
};

class ApprovalSettingsService {
  async getSettings(tenantId: string, branchId: string) {
    let settings = (await collections.approvalSettings.findOne({
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    })) as WithId<ApprovalSettingsDocument> | null;

    // If no settings exist, create default settings
    if (!settings) {
      const now = new Date();
      const newSettings = {
        _id: new ObjectId(),
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        ...DEFAULT_APPROVAL_SETTINGS,
        createdAt: now,
        updatedAt: now,
      } as ApprovalSettingsDocument;

      await collections.approvalSettings.insertOne(newSettings);
      settings = newSettings as WithId<ApprovalSettingsDocument>;
    }

    return this.formatSettings(settings);
  }

  async updateEmailSettings(
    tenantId: string,
    branchId: string,
    entityType: 'concession' | 'feeCancellation' | 'leave' | 'certificate',
    data: Partial<ApprovalEmailConfig>,
    updatedBy: string
  ) {
    const fieldName = `${entityType}EmailSettings` as keyof ApprovalSettingsDocument;
    const updateFields: Record<string, unknown> = { updatedAt: new Date() };

    // Build update object with dot notation
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        updateFields[`${fieldName}.${key}`] = value;
      }
    });

    const result = await collections.approvalSettings.findOneAndUpdate(
      {
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
      },
      {
        $set: updateFields,
        $setOnInsert: {
          tenantId: new ObjectId(tenantId),
          branchId: new ObjectId(branchId),
          ...DEFAULT_APPROVAL_SETTINGS,
          createdAt: new Date(),
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    logger.info({ branchId, tenantId, entityType, updatedBy }, 'Approval email settings updated');

    return this.formatSettings(result as unknown as WithId<ApprovalSettingsDocument>);
  }

  async updateAutoApproveThreshold(
    tenantId: string,
    branchId: string,
    data: Partial<{ concession: number; feeCancellation: number }>,
    updatedBy: string
  ) {
    const updateFields: Record<string, unknown> = { updatedAt: new Date() };

    if (data.concession !== undefined) {
      updateFields['autoApproveThreshold.concession'] = data.concession;
    }
    if (data.feeCancellation !== undefined) {
      updateFields['autoApproveThreshold.feeCancellation'] = data.feeCancellation;
    }

    const result = await collections.approvalSettings.findOneAndUpdate(
      {
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
      },
      {
        $set: updateFields,
        $setOnInsert: {
          tenantId: new ObjectId(tenantId),
          branchId: new ObjectId(branchId),
          ...DEFAULT_APPROVAL_SETTINGS,
          createdAt: new Date(),
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    logger.info({ branchId, tenantId, updatedBy }, 'Auto-approve threshold updated');

    return this.formatSettings(result as unknown as WithId<ApprovalSettingsDocument>);
  }

  async updateEscalationSettings(
    tenantId: string,
    branchId: string,
    data: Partial<ApprovalSettingsDocument['escalationSettings']>,
    updatedBy: string
  ) {
    const updateFields: Record<string, unknown> = { updatedAt: new Date() };

    if (data.enabled !== undefined) updateFields['escalationSettings.enabled'] = data.enabled;
    if (data.escalateAfterDays !== undefined)
      updateFields['escalationSettings.escalateAfterDays'] = data.escalateAfterDays;
    if (data.escalationRoles !== undefined)
      updateFields['escalationSettings.escalationRoles'] = data.escalationRoles;

    const result = await collections.approvalSettings.findOneAndUpdate(
      {
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
      },
      {
        $set: updateFields,
        $setOnInsert: {
          tenantId: new ObjectId(tenantId),
          branchId: new ObjectId(branchId),
          ...DEFAULT_APPROVAL_SETTINGS,
          createdAt: new Date(),
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    logger.info({ branchId, tenantId, updatedBy }, 'Escalation settings updated');

    return this.formatSettings(result as unknown as WithId<ApprovalSettingsDocument>);
  }

  private formatSettings(settings: WithId<ApprovalSettingsDocument>) {
    return {
      _id: settings._id.toString(),
      tenantId: settings.tenantId.toString(),
      branchId: settings.branchId.toString(),
      concessionEmailSettings: settings.concessionEmailSettings || DEFAULT_EMAIL_CONFIG,
      feeCancellationEmailSettings: settings.feeCancellationEmailSettings || DEFAULT_EMAIL_CONFIG,
      leaveEmailSettings: settings.leaveEmailSettings || {
        ...DEFAULT_EMAIL_CONFIG,
        recipientRoles: ['HR_ADMIN', 'HR_HEAD'],
      },
      certificateEmailSettings: settings.certificateEmailSettings || {
        ...DEFAULT_EMAIL_CONFIG,
        recipientRoles: ['BRANCH_ADMIN', 'ADMIN_STAFF'],
      },
      autoApproveThreshold: settings.autoApproveThreshold || { concession: 0, feeCancellation: 0 },
      escalationSettings: settings.escalationSettings || {
        enabled: false,
        escalateAfterDays: 3,
        escalationRoles: ['BRANCH_ADMIN'],
      },
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };
  }
}

export const approvalSettingsService = new ApprovalSettingsService();

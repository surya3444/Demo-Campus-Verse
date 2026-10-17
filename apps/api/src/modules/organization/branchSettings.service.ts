import { ObjectId, WithId, Document } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';

export interface Holiday {
  date: Date;
  name: string;
  type: 'public' | 'custom';
}

export interface BranchSettingsDocument extends Document {
  _id: ObjectId;
  branchId: ObjectId;
  tenantId: ObjectId;
  taxSettings: {
    gstRate: number;
    igstRate?: number;
    cessRate?: number;
  };
  feeRules: {
    lateFeePercentage: number;
    gracePeriodDays: number;
    lateFeeMaxAmount?: number;
  };
  communicationSettings: {
    smsEnabled: boolean;
    emailEnabled: boolean;
    whatsappEnabled: boolean;
  };
  holidays: Holiday[];
  weeklyOffs: number[]; // 0=Sunday, 1=Monday, etc.
  approvalEmailSettings?: {
    enabled: boolean;
    triggers: {
      onRequest: boolean;
      onApproval: boolean;
      onRejection: boolean;
    };
    recipients: {
      includeRequester: boolean;
      includeApprover: boolean;
      additionalEmails: string[];
    };
  };
  sortSettings?: {
    students: { field: string; order: 'asc' | 'desc' };
    staff: { field: string; order: 'asc' | 'desc' };
    transactions: { field: string; order: 'asc' | 'desc' };
  };
  branding?: {
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateBranchSettingsInput {
  taxSettings?: {
    gstRate?: number;
    igstRate?: number;
    cessRate?: number;
  };
  feeRules?: {
    lateFeePercentage?: number;
    gracePeriodDays?: number;
    lateFeeMaxAmount?: number;
  };
  communicationSettings?: {
    smsEnabled?: boolean;
    emailEnabled?: boolean;
    whatsappEnabled?: boolean;
  };
  holidays?: Holiday[];
  weeklyOffs?: number[];
  approvalEmailSettings?: {
    enabled?: boolean;
    triggers?: {
      onRequest?: boolean;
      onApproval?: boolean;
      onRejection?: boolean;
    };
    recipients?: {
      includeRequester?: boolean;
      includeApprover?: boolean;
      additionalEmails?: string[];
    };
  };
  sortSettings?: {
    students?: { field: string; order: 'asc' | 'desc' };
    staff?: { field: string; order: 'asc' | 'desc' };
    transactions?: { field: string; order: 'asc' | 'desc' };
  };
  branding?: {
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
  };
}

const DEFAULT_SETTINGS: Omit<
  BranchSettingsDocument,
  '_id' | 'branchId' | 'tenantId' | 'createdAt' | 'updatedAt'
> = {
  taxSettings: {
    gstRate: 18,
    igstRate: 18,
    cessRate: 0,
  },
  feeRules: {
    lateFeePercentage: 2,
    gracePeriodDays: 7,
    lateFeeMaxAmount: 5000,
  },
  communicationSettings: {
    smsEnabled: true,
    emailEnabled: true,
    whatsappEnabled: false,
  },
  holidays: [],
  weeklyOffs: [0], // Sunday off by default
  approvalEmailSettings: {
    enabled: true,
    triggers: {
      onRequest: true,
      onApproval: true,
      onRejection: true,
    },
    recipients: {
      includeRequester: true,
      includeApprover: true,
      additionalEmails: [],
    },
  },
  sortSettings: {
    students: { field: 'displayName', order: 'asc' },
    staff: { field: 'displayName', order: 'asc' },
    transactions: { field: 'createdAt', order: 'desc' },
  },
};

class BranchSettingsService {
  async getBranchSettings(tenantId: string, branchId: string) {
    // Verify branch exists and belongs to tenant
    const branch = await collections.branches.findOne({
      _id: new ObjectId(branchId),
      tenantId: new ObjectId(tenantId),
    });

    if (!branch) {
      throw new ApiError('BRANCH_NOT_FOUND', 'Branch not found', 404);
    }

    let settings = (await collections.branchSettings.findOne({
      branchId: new ObjectId(branchId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<BranchSettingsDocument> | null;

    // If no settings exist, create default settings
    if (!settings) {
      const now = new Date();
      const newSettings = {
        _id: new ObjectId(),
        branchId: new ObjectId(branchId),
        tenantId: new ObjectId(tenantId),
        ...DEFAULT_SETTINGS,
        createdAt: now,
        updatedAt: now,
      } as BranchSettingsDocument;

      await collections.branchSettings.insertOne(newSettings);
      settings = newSettings as WithId<BranchSettingsDocument>;
    }

    return this.formatSettings(settings);
  }

  async updateBranchSettings(
    tenantId: string,
    branchId: string,
    data: UpdateBranchSettingsInput,
    updatedBy: string
  ) {
    // Verify branch exists
    const branch = await collections.branches.findOne({
      _id: new ObjectId(branchId),
      tenantId: new ObjectId(tenantId),
    });

    if (!branch) {
      throw new ApiError('BRANCH_NOT_FOUND', 'Branch not found', 404);
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    // Build update object with dot notation for nested fields
    if (data.taxSettings) {
      if (data.taxSettings.gstRate !== undefined) {
        updateData['taxSettings.gstRate'] = data.taxSettings.gstRate;
      }
      if (data.taxSettings.igstRate !== undefined) {
        updateData['taxSettings.igstRate'] = data.taxSettings.igstRate;
      }
      if (data.taxSettings.cessRate !== undefined) {
        updateData['taxSettings.cessRate'] = data.taxSettings.cessRate;
      }
    }

    if (data.feeRules) {
      if (data.feeRules.lateFeePercentage !== undefined) {
        updateData['feeRules.lateFeePercentage'] = data.feeRules.lateFeePercentage;
      }
      if (data.feeRules.gracePeriodDays !== undefined) {
        updateData['feeRules.gracePeriodDays'] = data.feeRules.gracePeriodDays;
      }
      if (data.feeRules.lateFeeMaxAmount !== undefined) {
        updateData['feeRules.lateFeeMaxAmount'] = data.feeRules.lateFeeMaxAmount;
      }
    }

    if (data.communicationSettings) {
      if (data.communicationSettings.smsEnabled !== undefined) {
        updateData['communicationSettings.smsEnabled'] = data.communicationSettings.smsEnabled;
      }
      if (data.communicationSettings.emailEnabled !== undefined) {
        updateData['communicationSettings.emailEnabled'] = data.communicationSettings.emailEnabled;
      }
      if (data.communicationSettings.whatsappEnabled !== undefined) {
        updateData['communicationSettings.whatsappEnabled'] =
          data.communicationSettings.whatsappEnabled;
      }
    }

    if (data.holidays !== undefined) {
      updateData.holidays = data.holidays.map((h) => ({
        ...h,
        date: new Date(h.date),
      }));
    }

    if (data.weeklyOffs !== undefined) {
      updateData.weeklyOffs = data.weeklyOffs;
    }

    if (data.approvalEmailSettings) {
      if (data.approvalEmailSettings.enabled !== undefined) {
        updateData['approvalEmailSettings.enabled'] = data.approvalEmailSettings.enabled;
      }
      if (data.approvalEmailSettings.triggers) {
        if (data.approvalEmailSettings.triggers.onRequest !== undefined) {
          updateData['approvalEmailSettings.triggers.onRequest'] =
            data.approvalEmailSettings.triggers.onRequest;
        }
        if (data.approvalEmailSettings.triggers.onApproval !== undefined) {
          updateData['approvalEmailSettings.triggers.onApproval'] =
            data.approvalEmailSettings.triggers.onApproval;
        }
        if (data.approvalEmailSettings.triggers.onRejection !== undefined) {
          updateData['approvalEmailSettings.triggers.onRejection'] =
            data.approvalEmailSettings.triggers.onRejection;
        }
      }
      if (data.approvalEmailSettings.recipients) {
        if (data.approvalEmailSettings.recipients.includeRequester !== undefined) {
          updateData['approvalEmailSettings.recipients.includeRequester'] =
            data.approvalEmailSettings.recipients.includeRequester;
        }
        if (data.approvalEmailSettings.recipients.includeApprover !== undefined) {
          updateData['approvalEmailSettings.recipients.includeApprover'] =
            data.approvalEmailSettings.recipients.includeApprover;
        }
        if (data.approvalEmailSettings.recipients.additionalEmails !== undefined) {
          updateData['approvalEmailSettings.recipients.additionalEmails'] =
            data.approvalEmailSettings.recipients.additionalEmails;
        }
      }
    }

    if (data.sortSettings) {
      if (data.sortSettings.students) {
        updateData['sortSettings.students'] = data.sortSettings.students;
      }
      if (data.sortSettings.staff) {
        updateData['sortSettings.staff'] = data.sortSettings.staff;
      }
      if (data.sortSettings.transactions) {
        updateData['sortSettings.transactions'] = data.sortSettings.transactions;
      }
    }

    if (data.branding) {
      if (data.branding.logo !== undefined) {
        updateData['branding.logo'] = data.branding.logo;
      }
      if (data.branding.primaryColor !== undefined) {
        updateData['branding.primaryColor'] = data.branding.primaryColor;
      }
      if (data.branding.secondaryColor !== undefined) {
        updateData['branding.secondaryColor'] = data.branding.secondaryColor;
      }
    }

    // Upsert the settings
    const result = await collections.branchSettings.findOneAndUpdate(
      {
        branchId: new ObjectId(branchId),
        tenantId: new ObjectId(tenantId),
      },
      {
        $set: updateData,
        $setOnInsert: {
          branchId: new ObjectId(branchId),
          tenantId: new ObjectId(tenantId),
          createdAt: new Date(),
        },
      },
      {
        upsert: true,
        returnDocument: 'after',
      }
    );

    logger.info({ branchId, tenantId, updatedBy }, 'Branch settings updated');

    return this.formatSettings(result as WithId<BranchSettingsDocument>);
  }

  async getEffectiveSettings(tenantId: string, branchId: string) {
    // Get organization-level settings
    const tenant = await collections.tenants.findOne(
      { _id: new ObjectId(tenantId) },
      { projection: { settings: 1 } }
    );

    // Get branch-level settings
    const branchSettings = await this.getBranchSettings(tenantId, branchId);

    // Merge org settings with branch settings (branch takes precedence)
    return {
      organization: tenant?.settings || {},
      branch: branchSettings,
      effective: {
        ...DEFAULT_SETTINGS,
        ...branchSettings,
      },
    };
  }

  async addHoliday(tenantId: string, branchId: string, holiday: Holiday, addedBy: string) {
    // Verify branch exists
    const branch = await collections.branches.findOne({
      _id: new ObjectId(branchId),
      tenantId: new ObjectId(tenantId),
    });

    if (!branch) {
      throw new ApiError('BRANCH_NOT_FOUND', 'Branch not found', 404);
    }

    const result = await collections.branchSettings.findOneAndUpdate(
      {
        branchId: new ObjectId(branchId),
        tenantId: new ObjectId(tenantId),
      },
      {
        $push: {
          holidays: {
            date: new Date(holiday.date),
            name: holiday.name,
            type: holiday.type,
          },
        } as unknown,
        $set: { updatedAt: new Date() },
        $setOnInsert: {
          ...DEFAULT_SETTINGS,
          branchId: new ObjectId(branchId),
          tenantId: new ObjectId(tenantId),
          createdAt: new Date(),
        },
      } as Document,
      {
        upsert: true,
        returnDocument: 'after',
      }
    );

    logger.info({ branchId, tenantId, holiday: holiday.name, addedBy }, 'Holiday added');

    return this.formatSettings(result as unknown as WithId<BranchSettingsDocument>);
  }

  async removeHoliday(tenantId: string, branchId: string, holidayDate: string, removedBy: string) {
    const date = new Date(holidayDate);

    const result = await collections.branchSettings.findOneAndUpdate(
      {
        branchId: new ObjectId(branchId),
        tenantId: new ObjectId(tenantId),
      },
      {
        $pull: {
          holidays: {
            date: {
              $gte: new Date(date.setHours(0, 0, 0, 0)),
              $lt: new Date(date.setHours(23, 59, 59, 999)),
            },
          },
        } as unknown,
        $set: { updatedAt: new Date() },
      } as Document,
      {
        returnDocument: 'after',
      }
    );

    if (!result) {
      throw new ApiError('SETTINGS_NOT_FOUND', 'Branch settings not found', 404);
    }

    logger.info({ branchId, tenantId, holidayDate, removedBy }, 'Holiday removed');

    return this.formatSettings(result as unknown as WithId<BranchSettingsDocument>);
  }

  private formatSettings(settings: WithId<BranchSettingsDocument>) {
    return {
      _id: settings._id.toString(),
      branchId: settings.branchId.toString(),
      tenantId: settings.tenantId.toString(),
      taxSettings: settings.taxSettings,
      feeRules: settings.feeRules,
      communicationSettings: settings.communicationSettings,
      holidays: settings.holidays,
      weeklyOffs: settings.weeklyOffs,
      approvalEmailSettings: settings.approvalEmailSettings,
      sortSettings: settings.sortSettings,
      branding: settings.branding,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };
  }
}

export const branchSettingsService = new BranchSettingsService();

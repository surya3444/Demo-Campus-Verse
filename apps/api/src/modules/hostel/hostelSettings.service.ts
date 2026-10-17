import { ObjectId, WithId, Document } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { UpdateHostelSettingsInput } from '@campus-verse/shared/schemas';

interface HostelSettingsDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  visitingHours?: {
    start: string;
    end: string;
    days: number[];
  };
  messTimings?: {
    breakfast?: { start: string; end: string };
    lunch?: { start: string; end: string };
    snacks?: { start: string; end: string };
    dinner?: { start: string; end: string };
  };
  hostelRules: string[];
  notifications?: {
    allocationConfirmation: boolean;
    vacatingReminder: boolean;
    reminderDaysBefore: number;
  };
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const DEFAULT_SETTINGS: Omit<
  HostelSettingsDocument,
  '_id' | 'tenantId' | 'branchId' | 'createdBy' | 'createdAt' | 'updatedAt'
> = {
  visitingHours: {
    start: '10:00',
    end: '17:00',
    days: [0, 6], // Sunday and Saturday
  },
  messTimings: {
    breakfast: { start: '07:00', end: '09:00' },
    lunch: { start: '12:00', end: '14:00' },
    snacks: { start: '16:00', end: '17:00' },
    dinner: { start: '19:00', end: '21:00' },
  },
  hostelRules: [],
  notifications: {
    allocationConfirmation: true,
    vacatingReminder: true,
    reminderDaysBefore: 7,
  },
};

class HostelSettingsService {
  async getSettings(tenantId: string, branchId: string) {
    const settings = (await collections.hostelSettings.findOne({
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    })) as WithId<HostelSettingsDocument> | null;

    if (!settings) {
      // Return default settings (not persisted yet)
      return {
        _id: null,
        tenantId,
        branchId,
        ...DEFAULT_SETTINGS,
        createdAt: null,
        updatedAt: null,
      };
    }

    return this.formatSettings(settings);
  }

  async updateSettings(
    tenantId: string,
    branchId: string,
    data: UpdateHostelSettingsInput,
    updatedBy: string
  ) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);
    const now = new Date();

    const existing = await collections.hostelSettings.findOne({
      tenantId: tenantObjId,
      branchId: branchObjId,
    });

    if (existing) {
      // Update existing settings
      const updateData: Record<string, unknown> = {
        updatedAt: now,
      };

      if (data.visitingHours !== undefined) {
        updateData.visitingHours = data.visitingHours;
      }

      if (data.messTimings !== undefined) {
        updateData.messTimings = {
          ...(existing.messTimings as Record<string, unknown>),
          ...data.messTimings,
        };
      }

      if (data.hostelRules !== undefined) {
        updateData.hostelRules = data.hostelRules;
      }

      if (data.notifications !== undefined) {
        updateData.notifications = {
          ...(existing.notifications as Record<string, unknown>),
          ...data.notifications,
        };
      }

      await collections.hostelSettings.updateOne({ _id: existing._id }, { $set: updateData });

      logger.info({ tenantId, branchId, updatedBy }, 'Hostel settings updated');
    } else {
      // Create new settings
      const settingsId = new ObjectId();

      const settings: HostelSettingsDocument = {
        _id: settingsId,
        tenantId: tenantObjId,
        branchId: branchObjId,
        visitingHours: data.visitingHours || DEFAULT_SETTINGS.visitingHours,
        messTimings: {
          ...DEFAULT_SETTINGS.messTimings,
          ...(data.messTimings || {}),
        },
        hostelRules: data.hostelRules || DEFAULT_SETTINGS.hostelRules,
        notifications: {
          ...DEFAULT_SETTINGS.notifications!,
          ...(data.notifications || {}),
        },
        createdBy: new ObjectId(updatedBy),
        createdAt: now,
        updatedAt: now,
      };

      await collections.hostelSettings.insertOne(settings);

      logger.info(
        { settingsId: settingsId.toString(), tenantId, branchId },
        'Hostel settings created'
      );
    }

    return this.getSettings(tenantId, branchId);
  }

  private formatSettings(settings: WithId<HostelSettingsDocument>) {
    return {
      _id: settings._id.toString(),
      tenantId: settings.tenantId.toString(),
      branchId: settings.branchId.toString(),
      visitingHours: settings.visitingHours,
      messTimings: settings.messTimings,
      hostelRules: settings.hostelRules,
      notifications: settings.notifications,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };
  }
}

export const hostelSettingsService = new HostelSettingsService();

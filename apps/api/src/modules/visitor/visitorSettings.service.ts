import { ObjectId } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';

const DEFAULT_SETTINGS = {
  autoGeneratePassCode: true,
  passCodePrefix: 'VP',
  passValidityHours: 8,
  requirePhotoForCheckIn: false,
  requireIdForCheckIn: false,
  allowPreRegistration: true,
  customPurposes: [],
};

class VisitorSettingsService {
  async get(tenantId: string, branchId: string) {
    try {
      let settings = await collections.visitorSettings.findOne({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
      });

      if (!settings) {
        const now = new Date();
        const result = await collections.visitorSettings.insertOne({
          tenantId: new ObjectId(tenantId),
          branchId: new ObjectId(branchId),
          ...DEFAULT_SETTINGS,
          createdAt: now,
          updatedAt: now,
        });

        settings = await collections.visitorSettings.findOne({ _id: result.insertedId });
      }

      return this.formatSettings(settings!);
    } catch (error) {
      logger.error({ err: error }, 'Failed to get visitor settings');
      throw error;
    }
  }

  async update(tenantId: string, branchId: string, data: Record<string, unknown>) {
    try {
      const updateData: Record<string, unknown> = { updatedAt: new Date() };

      const fields = [
        'autoGeneratePassCode',
        'passCodePrefix',
        'passValidityHours',
        'requirePhotoForCheckIn',
        'requireIdForCheckIn',
        'allowPreRegistration',
        'customPurposes',
      ];

      for (const field of fields) {
        if (data[field] !== undefined) updateData[field] = data[field];
      }

      const result = await collections.visitorSettings.findOneAndUpdate(
        {
          tenantId: new ObjectId(tenantId),
          branchId: new ObjectId(branchId),
        },
        { $set: updateData },
        { returnDocument: 'after', upsert: true }
      );

      return this.formatSettings(result!);
    } catch (error) {
      logger.error({ err: error }, 'Failed to update visitor settings');
      throw error;
    }
  }

  private formatSettings(doc: Record<string, unknown>) {
    return {
      ...doc,
      _id: (doc._id as ObjectId).toString(),
      tenantId: (doc.tenantId as ObjectId).toString(),
      branchId: (doc.branchId as ObjectId).toString(),
    };
  }
}

export const visitorSettingsService = new VisitorSettingsService();

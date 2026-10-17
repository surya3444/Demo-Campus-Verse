import { ObjectId } from 'mongodb';
import { collections } from '../../config/database';
import { TransportSettingsInput } from '@campus-verse/shared/schemas';

const DEFAULT_SETTINGS = {
  googleMapsApiKey: '',
  defaultCurrency: 'INR',
  defaultFrequency: 'monthly' as const,
  autoAssignEnrollmentCode: true,
  notifyOnEnrollment: false,
};

class TransportSettingsService {
  async get(tenantId: string, branchId: string) {
    const settings = await collections.transportSettings.findOne({
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    });

    if (!settings) {
      return {
        tenantId,
        branchId,
        ...DEFAULT_SETTINGS,
      };
    }

    return {
      _id: settings._id.toString(),
      tenantId: settings.tenantId.toString(),
      branchId: settings.branchId.toString(),
      googleMapsApiKey: (settings.googleMapsApiKey as string) || '',
      defaultCurrency: (settings.defaultCurrency as string) || 'INR',
      defaultFrequency:
        (settings.defaultFrequency as 'monthly' | 'quarterly' | 'yearly') || 'monthly',
      autoAssignEnrollmentCode: settings.autoAssignEnrollmentCode !== false,
      notifyOnEnrollment: Boolean(settings.notifyOnEnrollment),
      createdAt: settings.createdAt as Date,
      updatedAt: settings.updatedAt as Date,
    };
  }

  async update(
    tenantId: string,
    branchId: string,
    data: TransportSettingsInput,
    updatedBy: string
  ) {
    const now = new Date();
    const updateDoc: Record<string, unknown> = { updatedAt: now };

    if (data.googleMapsApiKey !== undefined) updateDoc.googleMapsApiKey = data.googleMapsApiKey;
    if (data.defaultCurrency !== undefined) updateDoc.defaultCurrency = data.defaultCurrency;
    if (data.defaultFrequency !== undefined) updateDoc.defaultFrequency = data.defaultFrequency;
    if (data.autoAssignEnrollmentCode !== undefined)
      updateDoc.autoAssignEnrollmentCode = data.autoAssignEnrollmentCode;
    if (data.notifyOnEnrollment !== undefined)
      updateDoc.notifyOnEnrollment = data.notifyOnEnrollment;

    await collections.transportSettings.updateOne(
      {
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
      },
      {
        $set: updateDoc,
        $setOnInsert: {
          tenantId: new ObjectId(tenantId),
          branchId: new ObjectId(branchId),
          createdBy: new ObjectId(updatedBy),
          createdAt: now,
        },
      },
      { upsert: true }
    );

    return this.get(tenantId, branchId);
  }
}

export const transportSettingsService = new TransportSettingsService();

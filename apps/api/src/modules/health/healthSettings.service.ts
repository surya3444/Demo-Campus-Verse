import { ObjectId, WithId, Document } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { UpdateHealthSettingsInput } from '@campus-verse/shared/schemas';

interface HealthSettingsDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  enableHealthModule: boolean;
  enableStudentHealth: boolean;
  enableStaffHealth: boolean;
  infirmary: {
    enabled: boolean;
    name?: string;
    location?: string;
    operatingHours?: {
      start: string;
      end: string;
    };
    contactNumber?: string;
    emergencyNumber?: string;
  };
  checkups: {
    enableAnnualCheckups: boolean;
    defaultCheckupMonth?: number;
    reminderDaysBefore?: number;
    includeVisionByDefault: boolean;
    includeHearingByDefault: boolean;
    includeDentalByDefault: boolean;
    includeGrowthByDefault: boolean;
  };
  vaccinations: {
    enableVaccinationTracking: boolean;
    sendReminders: boolean;
    reminderDaysBefore?: number;
    requiredVaccines?: string[];
  };
  alerts: {
    enableHealthAlerts: boolean;
    alertOverdueVaccinations: boolean;
    alertOverdueCheckups: boolean;
    alertMedicationReminders: boolean;
  };
  privacy: {
    restrictHealthDataAccess: boolean;
    allowedRoles?: string[];
    requireConsentForDataSharing: boolean;
  };
  emergencyProtocol?: {
    steps?: string[];
    emergencyContacts?: Array<{
      name: string;
      role: string;
      phone: string;
    }>;
    nearestHospital?: {
      name: string;
      address: string;
      phone: string;
      distance?: string;
    };
  };
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const DEFAULT_SETTINGS: Omit<HealthSettingsDocument, '_id' | 'tenantId' | 'branchId' | 'createdBy' | 'createdAt' | 'updatedAt'> = {
  enableHealthModule: true,
  enableStudentHealth: true,
  enableStaffHealth: true,
  infirmary: {
    enabled: true,
    name: 'School Infirmary',
  },
  checkups: {
    enableAnnualCheckups: true,
    defaultCheckupMonth: 7, // July
    reminderDaysBefore: 7,
    includeVisionByDefault: true,
    includeHearingByDefault: true,
    includeDentalByDefault: true,
    includeGrowthByDefault: true,
  },
  vaccinations: {
    enableVaccinationTracking: true,
    sendReminders: true,
    reminderDaysBefore: 14,
    requiredVaccines: [],
  },
  alerts: {
    enableHealthAlerts: true,
    alertOverdueVaccinations: true,
    alertOverdueCheckups: true,
    alertMedicationReminders: false,
  },
  privacy: {
    restrictHealthDataAccess: true,
    allowedRoles: [],
    requireConsentForDataSharing: true,
  },
};

class HealthSettingsService {
  async getSettings(tenantId: string, branchId: string) {
    const settings = await collections.healthSettings.findOne({
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    }) as WithId<HealthSettingsDocument> | null;

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

  async updateSettings(tenantId: string, branchId: string, data: UpdateHealthSettingsInput, updatedBy: string) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);
    const now = new Date();

    const existing = await collections.healthSettings.findOne({
      tenantId: tenantObjId,
      branchId: branchObjId,
    });

    if (existing) {
      // Update existing settings
      const updateData: Record<string, unknown> = {
        updatedAt: now,
      };

      if (data.enableHealthModule !== undefined) updateData.enableHealthModule = data.enableHealthModule;
      if (data.enableStudentHealth !== undefined) updateData.enableStudentHealth = data.enableStudentHealth;
      if (data.enableStaffHealth !== undefined) updateData.enableStaffHealth = data.enableStaffHealth;

      if (data.infirmary) {
        updateData.infirmary = {
          ...(existing.infirmary as Record<string, unknown>),
          ...data.infirmary,
        };
      }

      if (data.checkups) {
        updateData.checkups = {
          ...(existing.checkups as Record<string, unknown>),
          ...data.checkups,
        };
      }

      if (data.vaccinations) {
        updateData.vaccinations = {
          ...(existing.vaccinations as Record<string, unknown>),
          ...data.vaccinations,
        };
      }

      if (data.alerts) {
        updateData.alerts = {
          ...(existing.alerts as Record<string, unknown>),
          ...data.alerts,
        };
      }

      if (data.privacy) {
        updateData.privacy = {
          ...(existing.privacy as Record<string, unknown>),
          ...data.privacy,
        };
      }

      if (data.emergencyProtocol !== undefined) {
        updateData.emergencyProtocol = data.emergencyProtocol;
      }

      await collections.healthSettings.updateOne(
        { _id: existing._id },
        { $set: updateData }
      );

      logger.info({ tenantId, branchId, updatedBy }, 'Health settings updated');
    } else {
      // Create new settings
      const settingsId = new ObjectId();

      const settings: HealthSettingsDocument = {
        _id: settingsId,
        tenantId: tenantObjId,
        branchId: branchObjId,
        enableHealthModule: data.enableHealthModule ?? DEFAULT_SETTINGS.enableHealthModule,
        enableStudentHealth: data.enableStudentHealth ?? DEFAULT_SETTINGS.enableStudentHealth,
        enableStaffHealth: data.enableStaffHealth ?? DEFAULT_SETTINGS.enableStaffHealth,
        infirmary: {
          ...DEFAULT_SETTINGS.infirmary,
          ...(data.infirmary || {}),
        },
        checkups: {
          ...DEFAULT_SETTINGS.checkups,
          ...(data.checkups || {}),
        },
        vaccinations: {
          ...DEFAULT_SETTINGS.vaccinations,
          ...(data.vaccinations || {}),
        },
        alerts: {
          ...DEFAULT_SETTINGS.alerts,
          ...(data.alerts || {}),
        },
        privacy: {
          ...DEFAULT_SETTINGS.privacy,
          ...(data.privacy || {}),
        },
        emergencyProtocol: data.emergencyProtocol,
        createdBy: new ObjectId(updatedBy),
        createdAt: now,
        updatedAt: now,
      };

      await collections.healthSettings.insertOne(settings);

      logger.info({ settingsId: settingsId.toString(), tenantId, branchId }, 'Health settings created');
    }

    return this.getSettings(tenantId, branchId);
  }

  async initializeSettings(tenantId: string, branchId: string, createdBy: string) {
    const existing = await collections.healthSettings.findOne({
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    });

    if (existing) {
      return this.formatSettings(existing as WithId<HealthSettingsDocument>);
    }

    const settingsId = new ObjectId();
    const now = new Date();

    const settings: HealthSettingsDocument = {
      _id: settingsId,
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      enableHealthModule: DEFAULT_SETTINGS.enableHealthModule,
      enableStudentHealth: DEFAULT_SETTINGS.enableStudentHealth,
      enableStaffHealth: DEFAULT_SETTINGS.enableStaffHealth,
      infirmary: DEFAULT_SETTINGS.infirmary,
      checkups: DEFAULT_SETTINGS.checkups,
      vaccinations: DEFAULT_SETTINGS.vaccinations,
      alerts: DEFAULT_SETTINGS.alerts,
      privacy: DEFAULT_SETTINGS.privacy,
      createdBy: new ObjectId(createdBy),
      createdAt: now,
      updatedAt: now,
    };

    await collections.healthSettings.insertOne(settings);

    logger.info({ settingsId: settingsId.toString(), tenantId, branchId }, 'Health settings initialized');

    return this.formatSettings(settings as WithId<HealthSettingsDocument>);
  }

  private formatSettings(settings: WithId<HealthSettingsDocument>) {
    return {
      _id: settings._id.toString(),
      tenantId: settings.tenantId.toString(),
      branchId: settings.branchId.toString(),
      enableHealthModule: settings.enableHealthModule,
      enableStudentHealth: settings.enableStudentHealth,
      enableStaffHealth: settings.enableStaffHealth,
      infirmary: settings.infirmary,
      checkups: settings.checkups,
      vaccinations: settings.vaccinations,
      alerts: settings.alerts,
      privacy: settings.privacy,
      emergencyProtocol: settings.emergencyProtocol,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };
  }
}

export const healthSettingsService = new HealthSettingsService();

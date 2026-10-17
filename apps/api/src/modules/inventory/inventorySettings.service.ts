import { ObjectId } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';

const DEFAULT_SETTINGS = {
  autoGenerateAssetCode: true,
  assetCodePrefix: 'AST',
  requireApprovalForProcurement: true,
  defaultUnit: 'piece',
};

class InventorySettingsService {
  async get(tenantId: string, branchId: string) {
    try {
      const settings = await collections.inventorySettings.findOne({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
      });

      if (!settings) {
        return {
          ...DEFAULT_SETTINGS,
          tenantId,
          branchId,
        };
      }

      return {
        ...settings,
        _id: settings._id.toString(),
        tenantId: settings.tenantId.toString(),
        branchId: settings.branchId.toString(),
      };
    } catch (error) {
      logger.error({ err: error }, 'Failed to fetch inventory settings');
      throw error;
    }
  }

  async update(tenantId: string, branchId: string, data: Record<string, unknown>) {
    try {
      const now = new Date();

      const result = await collections.inventorySettings.findOneAndUpdate(
        {
          tenantId: new ObjectId(tenantId),
          branchId: new ObjectId(branchId),
        },
        {
          $set: {
            ...data,
            updatedAt: now,
          },
          $setOnInsert: {
            tenantId: new ObjectId(tenantId),
            branchId: new ObjectId(branchId),
            createdAt: now,
          },
        },
        { upsert: true, returnDocument: 'after' }
      );

      return {
        ...result!,
        _id: result!._id.toString(),
        tenantId: result!.tenantId.toString(),
        branchId: result!.branchId.toString(),
      };
    } catch (error) {
      logger.error({ err: error }, 'Failed to update inventory settings');
      throw error;
    }
  }
}

export const inventorySettingsService = new InventorySettingsService();

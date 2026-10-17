import { ObjectId } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { generatePassCode } from '../../utils/generators';

class VisitorPassService {
  async generatePass(tenantId: string, visitorId: string, userId: string, validityHours?: number) {
    try {
      const visitor = await collections.visitors.findOne({
        _id: new ObjectId(visitorId),
        tenantId: new ObjectId(tenantId),
      });

      if (!visitor) {
        throw new ApiError('NOT_FOUND', 'Visitor not found', 404);
      }

      if (visitor.status !== 'checked_in') {
        throw new ApiError(
          'INVALID_STATUS',
          'Can only generate a pass for a checked-in visitor',
          400
        );
      }

      // Get settings for default validity
      const settings = await collections.visitorSettings.findOne({
        tenantId: new ObjectId(tenantId),
        branchId: visitor.branchId,
      });

      const hours = validityHours || settings?.passValidityHours || 8;
      const passCode = generatePassCode();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + hours * 60 * 60 * 1000);

      // Deactivate any existing active pass
      await collections.visitorPasses.updateMany(
        {
          visitorId: new ObjectId(visitorId),
          tenantId: new ObjectId(tenantId),
          isActive: true,
        },
        { $set: { isActive: false, revokedAt: now, revokedBy: new ObjectId(userId) } }
      );

      // Create pass record
      await collections.visitorPasses.insertOne({
        tenantId: new ObjectId(tenantId),
        branchId: visitor.branchId,
        visitorId: new ObjectId(visitorId),
        passCode,
        issuedAt: now,
        expiresAt,
        isActive: true,
        revokedAt: null,
        revokedBy: null,
        createdBy: new ObjectId(userId),
        createdAt: now,
        updatedAt: now,
      });

      // Update visitor document
      await collections.visitors.updateOne(
        { _id: new ObjectId(visitorId) },
        {
          $set: {
            passCode,
            passIssuedAt: now,
            passExpiresAt: expiresAt,
            updatedAt: now,
          },
        }
      );

      return { passCode, issuedAt: now, expiresAt };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error }, 'Failed to generate visitor pass');
      throw error;
    }
  }

  async revokePass(tenantId: string, visitorId: string, userId: string) {
    try {
      const visitor = await collections.visitors.findOne({
        _id: new ObjectId(visitorId),
        tenantId: new ObjectId(tenantId),
      });

      if (!visitor) {
        throw new ApiError('NOT_FOUND', 'Visitor not found', 404);
      }

      if (!visitor.passCode) {
        throw new ApiError('NO_PASS', 'No active pass found for this visitor', 400);
      }

      const now = new Date();

      // Deactivate pass records
      await collections.visitorPasses.updateMany(
        {
          visitorId: new ObjectId(visitorId),
          tenantId: new ObjectId(tenantId),
          isActive: true,
        },
        {
          $set: {
            isActive: false,
            revokedAt: now,
            revokedBy: new ObjectId(userId),
            updatedAt: now,
          },
        }
      );

      // Clear pass from visitor document
      await collections.visitors.updateOne(
        { _id: new ObjectId(visitorId) },
        {
          $set: {
            passCode: null,
            passIssuedAt: null,
            passExpiresAt: null,
            updatedAt: now,
          },
        }
      );

      return { revoked: true };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error }, 'Failed to revoke visitor pass');
      throw error;
    }
  }

  async verifyPass(tenantId: string, passCode: string) {
    try {
      const pass = await collections.visitorPasses.findOne({
        tenantId: new ObjectId(tenantId),
        passCode,
        isActive: true,
      });

      if (!pass) {
        return { valid: false, message: 'Pass not found or has been revoked' };
      }

      if (new Date() > pass.expiresAt) {
        return { valid: false, message: 'Pass has expired' };
      }

      const visitor = await collections.visitors.findOne({
        _id: pass.visitorId,
        tenantId: new ObjectId(tenantId),
      });

      return {
        valid: true,
        visitor: visitor
          ? {
              name: visitor.name,
              phone: visitor.phone,
              company: visitor.company,
              purpose: visitor.purpose,
              hostName: visitor.hostName,
              status: visitor.status,
              checkInTime: visitor.checkInTime,
            }
          : null,
        pass: {
          passCode: pass.passCode,
          issuedAt: pass.issuedAt,
          expiresAt: pass.expiresAt,
        },
      };
    } catch (error) {
      logger.error({ err: error }, 'Failed to verify visitor pass');
      throw error;
    }
  }
}

export const visitorPassService = new VisitorPassService();

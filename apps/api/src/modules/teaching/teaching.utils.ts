import { ObjectId } from 'mongodb';
import { collections } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler';
import { logger } from '../../lib/logger';

export async function getStaffIdForUser(tenantId: string, userId: string): Promise<string> {
  const tenantOid = new ObjectId(tenantId);
  const userOid = new ObjectId(userId);

  // Primary lookup: staff linked by userId
  const staff = await collections.staff.findOne({
    tenantId: tenantOid,
    userId: userOid,
    status: 'active',
  });
  if (staff) {
    return staff._id.toString();
  }

  // Fallback: find user's email, then match to unlinked staff by email
  const user = await collections.users.findOne({ _id: userOid, tenantId: tenantOid });
  if (user?.email) {
    const unlinkedStaff = await collections.staff.findOne({
      tenantId: tenantOid,
      'contact.email': user.email.toLowerCase(),
      status: 'active',
      userId: { $exists: false },
    });

    if (unlinkedStaff) {
      // Auto-link for future requests
      await collections.staff.updateOne(
        { _id: unlinkedStaff._id },
        { $set: { userId: userOid, updatedAt: new Date() } }
      );
      await collections.users.updateOne(
        { _id: userOid },
        { $set: { staffId: unlinkedStaff._id, updatedAt: new Date() } }
      );
      logger.info(
        { staffId: unlinkedStaff._id.toString(), userId, tenantId },
        'Auto-linked existing staff to user via email fallback'
      );
      return unlinkedStaff._id.toString();
    }
  }

  throw new ApiError(
    'STAFF_NOT_FOUND',
    'No staff record found for this user. Please create a staff record in the HR module first.',
    404
  );
}

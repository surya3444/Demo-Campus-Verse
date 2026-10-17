/**
 * Adds the built-in Institution Admin and HOD roles to existing university and
 * college tenants (new tenants get them from DEFAULT_ROLES). Idempotent: a
 * tenant that already has a role with the code keeps it.
 *
 * Run with: npx tsx src/scripts/seed-university-roles.ts
 */
import 'dotenv/config';
import { ObjectId } from 'mongodb';
import { DEFAULT_ROLES } from '@campus-verse/shared/constants';
import { connectDatabase, closeDatabase, collections } from '../config/database';

const CODES = ['INSTITUTION_ADMIN', 'HOD'];

(async () => {
  await connectDatabase();
  const tenants = await collections.tenants
    .find({ institutionTypes: { $in: ['university', 'college'] } })
    .project({ name: 1 })
    .toArray();
  for (const tenant of tenants) {
    for (const role of DEFAULT_ROLES.filter((r) => CODES.includes(r.code))) {
      const exists = await collections.roles.findOne({ tenantId: tenant._id, code: role.code });
      if (exists) {
        console.log(`${tenant.name}: ${role.code} exists — kept`);
        continue;
      }
      const now = new Date();
      await collections.roles.insertOne({
        _id: new ObjectId(),
        tenantId: tenant._id,
        name: role.name,
        code: role.code,
        description: role.description,
        isSystemRole: false,
        level: role.level,
        permissions: { ...role.permissions },
        createdAt: now,
        updatedAt: now,
      });
      console.log(`${tenant.name}: ${role.code} added`);
    }
  }
  await closeDatabase();
})();

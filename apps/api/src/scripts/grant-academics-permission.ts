/**
 * Campus and institution admins build the academic structure through the new
 * organization.academics permission. Adds it to existing Org Admin, Branch
 * Admin and Institution Admin roles (new tenants get it from the shared role
 * definitions). Idempotent.
 *
 * Run with: npx tsx src/scripts/grant-academics-permission.ts [--tenant <id>]
 */
import 'dotenv/config';
import { ObjectId } from 'mongodb';
import { connectDatabase, closeDatabase, collections } from '../config/database';

const tenantArg = process.argv[process.argv.indexOf('--tenant') + 1];
const onlyTenant = process.argv.includes('--tenant') && tenantArg ? new ObjectId(tenantArg) : null;

(async () => {
  await connectDatabase();
  // Permission keys contain dots ("organization.academics"), which update
  // paths would read as nesting, so each role's permissions are rewritten whole.
  const roles = await collections.roles
    .find({
      code: { $in: ['ORG_ADMIN', 'BRANCH_ADMIN', 'INSTITUTION_ADMIN'] },
      ...(onlyTenant && { tenantId: onlyTenant }),
    })
    .toArray();
  let granted = 0;
  for (const role of roles) {
    const permissions = { ...(role.permissions as Record<string, unknown>) };
    // Repair an earlier run that wrote a nested permissions.organization object.
    const nested = permissions.organization as Record<string, unknown> | undefined;
    if (nested && !Array.isArray(nested)) delete permissions.organization;
    if (Array.isArray(permissions['organization.academics']) && !nested) continue;
    permissions['organization.academics'] = ['view', 'create', 'edit', 'delete'];
    await collections.roles.updateOne(
      { _id: role._id },
      { $set: { permissions, updatedAt: new Date() } }
    );
    granted++;
  }
  console.log(`granted to ${granted} role(s)`);
  await closeDatabase();
})();

/**
 * Fee figures on dashboards are now gated by the dashboard.fees permission, so
 * admins can turn them off per role. Roles saved before it existed lack the key
 * and would silently lose their fee tiles; this grants it to every role that
 * showed fees until now — students and any role with the branch dashboard view
 * (deans, HODs, coordinators, accountants…). Teachers' dashboards never showed
 * fees, so they're left out. Admin roles always see fees and are skipped.
 * Idempotent.
 *
 * Run with: npx tsx src/scripts/grant-dashboard-fees-permission.ts [--tenant <id>] [--dry-run]
 */
import 'dotenv/config';
import { ObjectId } from 'mongodb';
import { connectDatabase, closeDatabase, collections } from '../config/database';

const tenantArg = process.argv[process.argv.indexOf('--tenant') + 1];
const onlyTenant = process.argv.includes('--tenant') && tenantArg ? new ObjectId(tenantArg) : null;
const dryRun = process.argv.includes('--dry-run');
const SKIP = ['GROUP_OWNER', 'ORG_MODERATOR', 'ORG_ADMIN', 'BRANCH_ADMIN', 'TEACHER'];

(async () => {
  await connectDatabase();
  const roles = await collections.roles
    .find({ code: { $nin: SKIP }, ...(onlyTenant && { tenantId: onlyTenant }) })
    .toArray();
  let granted = 0;
  for (const role of roles) {
    // Permission keys contain dots, which update paths read as nesting, so
    // each role's permissions map is rewritten whole.
    const permissions = { ...(role.permissions as Record<string, string[]>) };
    if (permissions['dashboard.fees']) continue;
    const showedFees = role.code === 'STUDENT' || !!permissions['dashboard.branchView'];
    if (!showedFees) continue;
    permissions['dashboard.fees'] = ['view'];
    console.log(`${dryRun ? '[dry-run] would grant' : 'grant'} → ${role.code} (${role.name})`);
    if (!dryRun) {
      await collections.roles.updateOne(
        { _id: role._id },
        { $set: { permissions, updatedAt: new Date() } }
      );
    }
    granted++;
  }
  console.log(`${dryRun ? 'would grant' : 'granted'} to ${granted} role(s)`);
  await closeDatabase();
})();

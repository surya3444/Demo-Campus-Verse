/**
 * Leave permissions use view / create / approve / reject, but HOD roles were
 * seeded with ['view', 'edit'] — so HODs couldn't apply for their own leave and
 * the Roles editor couldn't show their approver grant. Rewrites any role whose
 * hr.leaves holds 'edit' to the standard approver set (keeping what it had).
 * The API still honours 'edit' meanwhile. Idempotent.
 *
 * Run with: npx tsx src/scripts/fix-leave-permissions.ts [--tenant <id>] [--dry-run]
 */
import 'dotenv/config';
import { ObjectId } from 'mongodb';
import { connectDatabase, closeDatabase, collections } from '../config/database';

const tenantArg = process.argv[process.argv.indexOf('--tenant') + 1];
const onlyTenant = process.argv.includes('--tenant') && tenantArg ? new ObjectId(tenantArg) : null;
const dryRun = process.argv.includes('--dry-run');

(async () => {
  await connectDatabase();
  // Permission keys contain dots, so match in code rather than by query path.
  const all = await collections.roles.find(onlyTenant ? { tenantId: onlyTenant } : {}).toArray();
  let fixed = 0;
  for (const role of all) {
    const permissions = { ...(role.permissions as Record<string, string[]>) };
    const leaves = permissions['hr.leaves'];
    if (!leaves?.includes('edit')) continue;
    const next = [
      ...new Set([...leaves.filter((a) => a !== 'edit'), 'view', 'create', 'approve', 'reject']),
    ];
    console.log(
      `${dryRun ? '[dry-run] ' : ''}${role.code}: ${leaves.join('|')} → ${next.join('|')}`
    );
    if (!dryRun) {
      permissions['hr.leaves'] = next;
      await collections.roles.updateOne(
        { _id: role._id },
        { $set: { permissions, updatedAt: new Date() } }
      );
    }
    fixed++;
  }
  console.log(`${dryRun ? 'would fix' : 'fixed'} ${fixed} role(s)`);
  await closeDatabase();
})();

/**
 * University campuses no longer get an implicit "default institution". This
 * removes the ones already created, but only when nothing uses them: no
 * department, program or user grant points at the default. Idempotent.
 *
 * Run with: npx tsx src/scripts/remove-empty-university-defaults.ts [--dry-run] [--tenant <id>]
 */
import 'dotenv/config';
import { ObjectId } from 'mongodb';
import { connectDatabase, closeDatabase, collections } from '../config/database';
import { clearBranchInstitutionCache } from '../middleware/scope';

const dryRun = process.argv.includes('--dry-run');
const tenantArg = process.argv[process.argv.indexOf('--tenant') + 1];
const onlyTenant = process.argv.includes('--tenant') && tenantArg ? new ObjectId(tenantArg) : null;

(async () => {
  await connectDatabase();
  const campuses = await collections.branches
    .find({ institutionType: 'university', ...(onlyTenant && { tenantId: onlyTenant }) })
    .project({ name: 1, tenantId: 1 })
    .toArray();
  for (const campus of campuses) {
    const def = await collections.institutions.findOne({ branchId: campus._id, isDefault: true });
    if (!def) continue;
    const [departments, programs, users] = await Promise.all([
      collections.departments.countDocuments({ institutionId: def._id }),
      collections.programs.countDocuments({ institutionId: def._id }),
      collections.users.countDocuments({ 'accessScope.institutionIds': def._id }),
    ]);
    if (departments || programs || users) {
      console.log(
        `kept   ${campus.name}: "${def.name}" (${departments} departments, ${programs} programs, ${users} users)`
      );
      continue;
    }
    if (!dryRun) {
      await collections.institutions.deleteOne({ _id: def._id });
      clearBranchInstitutionCache(String(campus.tenantId));
    }
    console.log(`${dryRun ? 'would remove' : 'removed'} ${campus.name}: "${def.name}"`);
  }
  await closeDatabase();
})();

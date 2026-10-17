/* eslint-disable no-console */
/**
 * Invert the institution tier: institutions move from ABOVE branches to BELOW
 * them, so a campus hosts one or more constituent institutions.
 *
 *   before:  Institution --(branch.institutionId)--> Branch
 *   after:   Branch --(institution.branchId)--> Institution --> Department
 *
 * For each institution we adopt its *first* existing campus as the host and
 * re-point the rest: a campus that had institution X now hosts a same-named
 * institution of its own, because an institution can no longer span campuses.
 * Departments are then stamped with the institution of their branch.
 *
 * Idempotent — institutions that already carry branchId are left alone. Dry-run
 * by default; --apply writes.
 *
 * Usage:
 *   MONGODB_URI="..." pnpm exec tsx infrastructure/scripts/migrate-institutions-under-branches.ts [--apply]
 */
import { MongoClient, ObjectId } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../apps/api/.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/campusverse';
const APPLY = process.argv.includes('--apply');

(async () => {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db();
  console.log(`DB: ${db.databaseName}   mode: ${APPLY ? 'APPLY' : 'dry run'}\n`);

  const institutions = db.collection('institutions');
  const branches = db.collection('branches');
  const departments = db.collection('departments');

  const plan = { hosted: 0, cloned: 0, orphanCampuses: 0, departments: 0 };

  for (const tenant of await db.collection('tenants').find({}).project({ name: 1 }).toArray()) {
    const tenantId = tenant._id;
    const tenantBranches = await branches.find({ tenantId }).toArray();
    if (!tenantBranches.length) continue;

    const tenantInstitutions = await institutions.find({ tenantId }).toArray();
    console.log(`── ${tenant.name}: ${tenantBranches.length} campus(es), ${tenantInstitutions.length} institution(s)`);

    for (const inst of tenantInstitutions) {
      if (inst.branchId) continue; // already migrated

      // Campuses that pointed at this institution, in creation order.
      const owned = tenantBranches
        .filter((b) => String(b.institutionId) === String(inst._id))
        .sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));

      if (!owned.length) {
        // Institution with no campus (the bug this migration also repairs):
        // host it on the tenant's first campus.
        const fallback = tenantBranches[0];
        console.log(`   ${inst.name}: no campus → hosting on "${fallback.name}"`);
        plan.hosted++;
        if (APPLY) {
          await institutions.updateOne({ _id: inst._id }, { $set: { branchId: fallback._id } });
        }
        continue;
      }

      const [host, ...rest] = owned;
      console.log(`   ${inst.name}: hosted on "${host.name}"`);
      plan.hosted++;
      if (APPLY) {
        await institutions.updateOne({ _id: inst._id }, { $set: { branchId: host._id } });
      }

      // An institution can no longer span campuses; give each extra campus its
      // own institution rather than silently dropping the link.
      for (const extra of rest) {
        console.log(`      + cloning "${inst.name}" onto "${extra.name}"`);
        plan.cloned++;
        if (APPLY) {
          await institutions.insertOne({
            tenantId,
            branchId: extra._id,
            name: inst.name,
            code: `${inst.code}-${String(extra.code).slice(0, 6)}`.toUpperCase(),
            kind: inst.kind,
            isDefault: true, // sole institution on that campus
            settings: inst.settings ?? {},
            status: inst.status ?? 'active',
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }
    }

    // Campuses with no institution at all get a default named after the tenant.
    for (const branch of tenantBranches) {
      const has = APPLY
        ? await institutions.countDocuments({ tenantId, branchId: branch._id })
        : (await institutions.countDocuments({ tenantId, branchId: branch._id })) ||
          tenantInstitutions.filter((i) => String(i.institutionId ?? '') === String(branch._id))
            .length;
      if (has) continue;
      const stillOwned = tenantInstitutions.some(
        (i) => String(branch.institutionId) === String(i._id)
      );
      if (stillOwned) continue;
      console.log(`   campus "${branch.name}" has no institution → creating default`);
      plan.orphanCampuses++;
      if (APPLY) {
        await institutions.insertOne({
          tenantId,
          branchId: branch._id,
          name: tenant.name,
          code: String(branch.code).toUpperCase(),
          isDefault: true,
          settings: {},
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    // Departments inherit the institution hosted on their campus. Where a
    // campus hosts several, the default wins — a human must split the rest.
    for (const branch of tenantBranches) {
      const hosted = APPLY
        ? await institutions.find({ tenantId, branchId: branch._id }).toArray()
        : [];
      const target = hosted.find((i) => i.isDefault) ?? hosted[0];
      const unassigned = await departments.countDocuments({
        tenantId,
        branchId: branch._id,
        institutionId: { $exists: false },
      });
      if (!unassigned) continue;
      plan.departments += unassigned;
      console.log(`   ${unassigned} department(s) on "${branch.name}" → institution`);
      if (APPLY && target) {
        await departments.updateMany(
          { tenantId, branchId: branch._id, institutionId: { $exists: false } },
          { $set: { institutionId: target._id } }
        );
      }
    }
  }

  console.log(
    `\n${APPLY ? 'Applied' : 'Would apply'}: ${plan.hosted} hosted, ${plan.cloned} cloned, ` +
      `${plan.orphanCampuses} default(s) created, ${plan.departments} department(s) stamped`
  );
  if (!APPLY) console.log('Re-run with --apply to write.');

  // The old FK stays in place: harmless, and it is the only way back.
  await client.close();
})();

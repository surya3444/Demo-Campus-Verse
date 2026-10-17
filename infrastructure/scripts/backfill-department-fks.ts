/* eslint-disable no-console */
/**
 * University tier, Phase 5: stamp departmentId FKs onto documents keyed by
 * legacy departmentCode strings — obe_programs and program_schemes — by
 * matching the code against the branch's active department registry
 * (code/name, case-insensitive). New documents get the FK at create time;
 * this converges existing data.
 *
 * Idempotent — documents that already carry departmentId are skipped, and the
 * legacy string stays canonical (FKs are additive). Dry-run by default;
 * --apply writes. Unmatched codes are reported for manual resolution.
 *
 * Usage:
 *   pnpm --filter @campus-verse/api exec tsx infrastructure/scripts/backfill-department-fks.ts [--apply]
 */
import { MongoClient, ObjectId } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../apps/api/.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/campusverse';
const APPLY = process.argv.includes('--apply');

const TARGETS = [
  { collection: 'obe_programs', label: 'OBE programs' },
  { collection: 'program_schemes', label: 'Program schemes' },
] as const;

(async () => {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db();
  console.log(`DB: ${db.databaseName}`);
  console.log(`Mode: ${APPLY ? 'apply' : 'dry-run'}\n`);

  // department registry per branch, keyed by lowercased code/name
  const deptCache = new Map<string, Map<string, ObjectId>>();
  async function branchDepartments(tenantId: ObjectId, branchId: ObjectId) {
    const key = `${tenantId}|${branchId}`;
    if (!deptCache.has(key)) {
      const departments = await db
        .collection('departments')
        .find({ tenantId, branchId, status: 'active' }, { projection: { code: 1, name: 1 } })
        .toArray();
      const map = new Map<string, ObjectId>();
      for (const d of departments) {
        for (const k of [d.code, d.name]) {
          const norm = String(k ?? '')
            .trim()
            .toLowerCase();
          if (norm && !map.has(norm)) map.set(norm, d._id);
        }
      }
      deptCache.set(key, map);
    }
    return deptCache.get(key)!;
  }

  const unmatched = new Map<string, number>();

  for (const target of TARGETS) {
    let stamped = 0;
    let skipped = 0;
    let missed = 0;

    const docs = await db
      .collection(target.collection)
      .find(
        { departmentId: { $exists: false } },
        { projection: { tenantId: 1, branchId: 1, departmentCode: 1 } }
      )
      .toArray();

    for (const doc of docs) {
      if (!doc.departmentCode) {
        skipped++;
        continue;
      }
      const registry = await branchDepartments(doc.tenantId, doc.branchId);
      const match = registry.get(String(doc.departmentCode).trim().toLowerCase());
      if (!match) {
        missed++;
        const key = `${target.collection}: "${doc.departmentCode}"`;
        unmatched.set(key, (unmatched.get(key) ?? 0) + 1);
        continue;
      }
      stamped++;
      if (APPLY) {
        await db
          .collection(target.collection)
          .updateOne({ _id: doc._id }, { $set: { departmentId: match } });
      }
    }

    console.log(
      `${target.label}: ${docs.length} without FK — ${APPLY ? 'stamped' : 'would stamp'} ${stamped}, unmatched ${missed}, no-code ${skipped}`
    );
  }

  if (unmatched.size > 0) {
    console.log('\n── Unmatched department codes (create/rename the department, re-run) ──');
    for (const [key, count] of unmatched) {
      console.log(`  ${key} — ${count} doc(s)`);
    }
  }
  if (!APPLY) console.log('\nRe-run with --apply to write.');

  await client.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

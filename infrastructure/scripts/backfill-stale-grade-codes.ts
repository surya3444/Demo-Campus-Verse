/**
 * Backfill: repair `applicableTo.gradeCodes` on fee_structures whose codes
 * no longer match ANY class in their branch.
 *
 * Why codes go stale: grade codes used to be derived from legacy class fields
 * (`school:X`, `college:BCom:2`, `university:CS:1`). After classes moved to
 * the unified `path[]` shape, codes are derived as
 * `{levelKey}:{code}[/{levelKey}:{code}...]` (see shared/utils/academic.ts).
 * Structures carrying old-format codes silently match zero students.
 *
 * What this script does, per structure with a non-empty gradeCodes:
 *   - Codes that match a current class in the same tenant+branch are KEPT.
 *   - If NONE match, codes are recomputed from `applicableTo.classIds`
 *     (the legacy targeting the old migration originally read from).
 *   - Structures with empty gradeCodes are left alone — they match via
 *     classIds/sectionIds or org-wide, both of which still work.
 *   - If recompute yields nothing (no classIds, classes deleted), the
 *     structure is reported but NOT modified.
 *
 * Idempotent: a second run finds every code valid and changes nothing.
 * Dry-run by default — pass --apply to write.
 *
 * Usage:
 *   pnpm --filter @campus-verse/api exec tsx infrastructure/scripts/backfill-stale-grade-codes.ts
 *   MONGODB_URI="mongodb://localhost:27017/campusverse" pnpm tsx infrastructure/scripts/backfill-stale-grade-codes.ts --apply
 */

import { MongoClient, ObjectId } from 'mongodb';
// Relative source import: workspace packages aren't resolvable from
// infrastructure/, and tsx compiles the shared TS source fine.
import { gradeCodeFor } from '../../packages/shared/src/utils/academic';

const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/campusverse';
const APPLY = process.argv.includes('--apply');

interface FeeStructureDoc {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  name: string;
  applicableTo?: {
    gradeCodes?: string[];
    classIds?: ObjectId[];
  };
}

interface ClassDoc {
  _id: ObjectId;
  path?: Array<{ levelKey: string; name?: string; code?: string }>;
}

(async () => {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db();
  console.log(
    `Connected to ${db.databaseName}${APPLY ? '' : ' (dry run — pass --apply to write)'}\n`
  );

  let total = 0;
  let untargeted = 0;
  let valid = 0;
  let repaired = 0;
  let unrepairable = 0;

  // Valid grade codes per tenant:branch, computed lazily.
  const validCodesCache = new Map<string, Set<string>>();
  async function validCodesFor(tenantId: ObjectId, branchId: ObjectId): Promise<Set<string>> {
    const key = `${tenantId.toHexString()}:${branchId.toHexString()}`;
    let cached = validCodesCache.get(key);
    if (!cached) {
      const classes = (await db
        .collection('classes')
        .find({ tenantId, branchId })
        .project({ _id: 1, path: 1 })
        .toArray()) as unknown as ClassDoc[];
      cached = new Set(classes.map((c) => gradeCodeFor(c)).filter((c): c is string => c !== null));
      validCodesCache.set(key, cached);
    }
    return cached;
  }

  const cursor = db.collection('fee_structures').find({});
  while (await cursor.hasNext()) {
    const s = (await cursor.next()) as unknown as FeeStructureDoc | null;
    if (!s) continue;
    total++;

    const codes = s.applicableTo?.gradeCodes || [];
    if (codes.length === 0) {
      // Org-wide or classIds/sectionIds-targeted — matching still works.
      untargeted++;
      continue;
    }

    const validCodes = await validCodesFor(s.tenantId, s.branchId);
    if (codes.some((c) => validCodes.has(c))) {
      // At least one live code — structure still matches; leave it alone.
      valid++;
      continue;
    }

    // Every code is dead. Recompute from the legacy classIds targeting.
    const classIds = s.applicableTo?.classIds || [];
    let newCodes: string[] = [];
    if (classIds.length > 0) {
      const classDocs = (await db
        .collection('classes')
        .find({ _id: { $in: classIds } })
        .project({ _id: 1, path: 1 })
        .toArray()) as unknown as ClassDoc[];
      newCodes = Array.from(
        new Set(classDocs.map((c) => gradeCodeFor(c)).filter((c): c is string => c !== null))
      );
    }

    if (newCodes.length === 0) {
      unrepairable++;
      console.log(
        `  ✗ ${s._id.toString()} "${s.name}" — dead codes [${codes.join(', ')}], ` +
          `no classIds to recompute from. Re-assign manually from the Fee Structures page.`
      );
      continue;
    }

    if (APPLY) {
      await db
        .collection('fee_structures')
        .updateOne(
          { _id: s._id },
          { $set: { 'applicableTo.gradeCodes': newCodes, updatedAt: new Date() } }
        );
    }
    repaired++;
    console.log(
      `  ✓ ${s._id.toString()} "${s.name}" — [${codes.join(', ')}] → [${newCodes.join(', ')}]`
    );
  }

  console.log(
    `\nDone. total=${total} untargeted=${untargeted} valid=${valid} ` +
      `repaired=${repaired}${APPLY ? '' : ' (not written — dry run)'} unrepairable=${unrepairable}`
  );
  console.log(
    'After applying, use the Sync button on the fee counter (or wait for the next enrollment) to create the missing assignments.'
  );
  await client.close();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

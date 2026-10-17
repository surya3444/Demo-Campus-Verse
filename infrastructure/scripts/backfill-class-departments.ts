/* eslint-disable no-console */
/**
 * University tier, Phase 1: backfill Class.departmentId by matching each
 * class's path[0] against the branch's department registry (code/name,
 * case-insensitive — the same convention the Departments overview and the
 * class-write dual-write use, via matchDepartmentForPathTop).
 *
 * Modes:
 *   (default)  Dry run — prints what would change plus an unmatched report.
 *   --apply    Write the matched FKs.
 *   --check    Consistency check for CI/cron: verifies every stored
 *              departmentId still matches what path[0] resolves to today.
 *              Exits 1 on any mismatch, 0 when clean.
 *
 * Idempotent — matched values are recomputed from scratch each run, and
 * classes whose stored FK already equals the match are untouched.
 *
 * Usage:
 *   pnpm --filter @campus-verse/api exec tsx infrastructure/scripts/backfill-class-departments.ts [--apply|--check]
 */
import { MongoClient, ObjectId } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
// Relative source import: infrastructure/ has no node_modules link to the
// workspace packages, and tsx compiles the TS source directly.
import {
  matchDepartmentForPathTop,
  isDepartmentLevelKey,
} from '../../packages/shared/src/utils/academic';

dotenv.config({ path: path.resolve(__dirname, '../../apps/api/.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/campusverse';
const APPLY = process.argv.includes('--apply');
const CHECK = process.argv.includes('--check');

interface UnmatchedEntry {
  tenant: string;
  branch: string;
  pathTop: string;
  classCount: number;
}

(async () => {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db();
  console.log(`DB: ${db.databaseName}`);
  console.log(`Mode: ${CHECK ? 'check' : APPLY ? 'apply' : 'dry-run'}\n`);

  const tenants = await db
    .collection('tenants')
    .find({}, { projection: { name: 1 } })
    .toArray();
  const tenantNames = new Map(tenants.map((t) => [t._id.toString(), t.name as string]));

  const branches = await db
    .collection('branches')
    .find({}, { projection: { tenantId: 1, name: 1 } })
    .toArray();

  let matched = 0;
  let written = 0;
  let mismatches = 0;
  const unmatched: UnmatchedEntry[] = [];

  for (const branch of branches) {
    const tenantName = tenantNames.get(branch.tenantId.toString()) ?? branch.tenantId.toString();

    const departments = await db
      .collection('departments')
      .find(
        { tenantId: branch.tenantId, branchId: branch._id, status: 'active' },
        { projection: { code: 1, name: 1 } }
      )
      .toArray();

    const classes = await db
      .collection('classes')
      .find(
        { tenantId: branch.tenantId, branchId: branch._id },
        { projection: { path: 1, departmentId: 1, displayName: 1 } }
      )
      .toArray();
    if (classes.length === 0) continue;

    // Group classes by their path-top signature so the unmatched report is
    // one row per distinct department label, not per class.
    const unmatchedByTop = new Map<string, number>();

    for (const cls of classes) {
      const top = (
        cls.path as Array<{ levelKey?: string; name?: string; code?: string }> | undefined
      )?.[0];
      // Same gate as the dual-write: only department-like top levels
      // ('department', 'stream') carry a department identity. School grades
      // neither match nor get reported.
      if (!top || !isDepartmentLevelKey(top.levelKey)) continue;

      const match = matchDepartmentForPathTop(top, departments);

      if (!match) {
        const key = `${top.code ?? ''}|${top.name ?? ''}`;
        unmatchedByTop.set(key, (unmatchedByTop.get(key) ?? 0) + 1);
        if (CHECK && cls.departmentId) {
          mismatches++;
          console.log(
            `MISMATCH [${tenantName} / ${branch.name}] "${cls.displayName}": stored departmentId ${cls.departmentId} but path no longer matches any department`
          );
        }
        continue;
      }

      matched++;
      const matchId = (match._id as ObjectId).toString();
      const storedId = cls.departmentId ? String(cls.departmentId) : null;

      if (CHECK) {
        if (storedId && storedId !== matchId) {
          mismatches++;
          console.log(
            `MISMATCH [${tenantName} / ${branch.name}] "${cls.displayName}": stored ${storedId}, path resolves to ${matchId} (${match.name})`
          );
        }
        continue;
      }

      if (storedId === matchId) continue;

      if (APPLY) {
        await db
          .collection('classes')
          .updateOne({ _id: cls._id }, { $set: { departmentId: match._id } });
        written++;
      } else {
        written++; // dry-run: count what WOULD be written
      }
    }

    for (const [key, count] of unmatchedByTop) {
      const [code, name] = key.split('|');
      unmatched.push({
        tenant: tenantName,
        branch: branch.name as string,
        pathTop: name || code,
        classCount: count,
      });
    }
  }

  if (unmatched.length > 0) {
    console.log(
      '\n── Unmatched (department-level classes whose path[0] resolves to no department) ──'
    );
    for (const u of unmatched) {
      console.log(
        `  [${u.tenant} / ${u.branch}] "${u.pathTop}" — ${u.classCount} class(es); create/rename the department or fix the class path, then re-run`
      );
    }
  }

  if (CHECK) {
    console.log(`\nCheck complete: ${matched} matched, ${mismatches} mismatch(es).`);
    if (mismatches > 0) process.exit(1);
  } else {
    console.log(
      `\n${APPLY ? 'Applied' : 'Dry run'}: ${matched} class(es) matched, ${written} FK(s) ${APPLY ? 'written' : 'would be written'}, ${unmatched.length} unmatched group(s).`
    );
    if (!APPLY) console.log('Re-run with --apply to write.');
  }

  await client.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

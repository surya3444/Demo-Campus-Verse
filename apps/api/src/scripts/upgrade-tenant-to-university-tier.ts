/**
 * Bring an EXISTING tenant fully onto the university tier.
 *
 * Tenants seeded before the tier landed are half-migrated: departments may
 * carry an institutionId (the runtime adoption pass stamps those lazily) while
 * classes still have no programId and sections have no lab batches. The
 * Programs page then lists degrees nothing points at, and the Academic
 * Structure page shows cohorts with no program. This closes those gaps:
 *
 *   1. every campus has a default institution carrying the CAMPUS's identity
 *   2. every department is filed under an institution
 *   3. every academic department offers at least one program
 *   4. every class is linked to a program of its own department
 *   5. first-year sections get lab batches, and their students get a batch
 *
 * Idempotent: re-running changes nothing. DRY RUN unless --apply is passed.
 *
 * Usage:
 *   pnpm --filter @campus-verse/api exec tsx \
 *     src/scripts/upgrade-tenant-to-university-tier.ts NEXUNI-DEMO
 *   pnpm --filter @campus-verse/api exec tsx \
 *     src/scripts/upgrade-tenant-to-university-tier.ts NEXUNI-DEMO --apply
 */

import { MongoClient, Db, ObjectId, WithId, Document } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const URI = process.env.MONGODB_URI;
const APPLY = process.argv.includes('--apply');
const TENANT_CODE = process.argv.slice(2).find((a) => !a.startsWith('--'));

/** "Year 3", "3rd Year", "III Year" → 3. Mirrors yearNumberFromPath in class.service. */
function yearFromPath(
  pathEntries: Array<{ levelKey?: string; name?: string }> = []
): number | null {
  const entry = pathEntries.find((p) => String(p.levelKey ?? '').toLowerCase() === 'year');
  const digits = String(entry?.name ?? '').match(/\d+/);
  return digits ? Number(digits[0]) : null;
}

/** "Computer Science" → "B.Tech Computer Science", code "BTECH-CS". */
function defaultProgramFor(dept: WithId<Document>) {
  return {
    name: `B.Tech ${dept.name}`,
    code: `BTECH-${String(dept.code).toUpperCase()}`,
    degreeType: 'ug' as const,
    durationYears: 4,
    totalSemesters: 8,
    termPattern: 'semester' as const,
  };
}

async function main() {
  if (!URI) {
    console.error('MONGODB_URI is not set.');
    process.exit(1);
  }
  if (!TENANT_CODE) {
    console.error('Usage: ... upgrade-tenant-to-university-tier.ts <TENANT_CODE> [--apply]');
    process.exit(1);
  }

  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db();

  const tenant = await db.collection('tenants').findOne({ code: TENANT_CODE });
  if (!tenant) {
    console.error(`Tenant "${TENANT_CODE}" not found in ${db.databaseName}.`);
    await client.close();
    process.exit(1);
  }

  console.log(`\nDB: ${db.databaseName}   Tenant: ${TENANT_CODE} (${tenant._id})`);
  console.log(
    APPLY ? 'MODE: APPLY — writes enabled\n' : 'MODE: DRY RUN — no writes (pass --apply)\n'
  );

  try {
    await upgrade(db, tenant._id as ObjectId);
  } finally {
    await client.close();
  }
}

async function upgrade(db: Db, tenantId: ObjectId) {
  const now = new Date();
  const changes: string[] = [];
  const write = async (label: string, fn: () => Promise<unknown>) => {
    changes.push(label);
    if (APPLY) await fn();
  };

  const branches = await db.collection('branches').find({ tenantId }).toArray();

  // ── 1. A default institution per campus ──────────────────────────────────
  for (const branch of branches) {
    const existing = await db
      .collection('institutions')
      .findOne({ tenantId, branchId: branch._id, isDefault: true });
    if (existing) continue;
    const code = String(branch.code || 'MAIN').toUpperCase();
    await write(
      `+ institution "${branch.name}" (${code}) — default for campus ${branch.name}`,
      () =>
        db.collection('institutions').insertOne({
          _id: new ObjectId(),
          tenantId,
          branchId: branch._id,
          name: branch.name,
          code,
          isDefault: true,
          settings: {},
          status: 'active',
          createdAt: now,
          updatedAt: now,
        })
    );
  }

  // ── 2. Every department under an institution ─────────────────────────────
  for (const branch of branches) {
    const fallback = await db
      .collection('institutions')
      .findOne({ tenantId, branchId: branch._id, isDefault: true });
    // In dry run the default may not exist yet; nothing to report against it.
    if (!fallback) continue;
    const orphans = await db
      .collection('departments')
      .find({ tenantId, branchId: branch._id, institutionId: { $exists: false } })
      .toArray();
    if (!orphans.length) continue;
    await write(
      `~ ${orphans.length} department(s) on ${branch.name} → institution "${fallback.name}"`,
      () =>
        db
          .collection('departments')
          .updateMany(
            { tenantId, branchId: branch._id, institutionId: { $exists: false } },
            { $set: { institutionId: fallback._id, updatedAt: now } }
          )
    );
  }

  // ── 3. Every academic department offers a program ────────────────────────
  const departments = await db
    .collection('departments')
    .find({ tenantId, status: 'active' })
    .toArray();
  // Cache per department so step 4 can link without re-reading.
  const programsByDept = new Map<string, WithId<Document>[]>();
  for (const dept of departments) {
    const programs = await db
      .collection('programs')
      .find({ tenantId, departmentId: dept._id, status: 'active' })
      .toArray();
    programsByDept.set(dept._id.toString(), programs);

    if (programs.length || dept.type !== 'academic') continue;
    const seed = defaultProgramFor(dept);
    const doc = {
      _id: new ObjectId(),
      tenantId,
      branchId: dept.branchId,
      departmentId: dept._id,
      ...seed,
      status: 'active' as const,
      createdAt: now,
      updatedAt: now,
    };
    programsByDept.set(dept._id.toString(), [doc as unknown as WithId<Document>]);
    await write(`+ program "${seed.name}" (${seed.code}) under ${dept.code}`, () =>
      db.collection('programs').insertOne(doc)
    );
  }

  // ── 4. Link classes to a program of their own department ─────────────────
  const classes = await db
    .collection('classes')
    .find({ tenantId, programId: { $in: [null, undefined] } })
    .toArray();
  let linked = 0;
  let skipped = 0;
  for (const cls of classes) {
    if (!cls.departmentId) {
      skipped++;
      continue;
    }
    const candidates = programsByDept.get(String(cls.departmentId)) ?? [];
    const year = yearFromPath(cls.path);
    // A "Year N" cohort under a department offering both UG and PG is the UG
    // one — a PG program that short can't hold Year 3+, and the UG degree is
    // what a bare year-cohort has always meant here. Programs too short for
    // the year are excluded outright.
    const viable = candidates.filter(
      (p) => year === null || !p.durationYears || year <= Number(p.durationYears)
    );
    const chosen = viable.find((p) => p.degreeType === 'ug') ?? viable[0];
    if (!chosen) {
      skipped++;
      continue;
    }
    linked++;
    await write(`~ class "${cls.displayName}" → program ${chosen.code}`, () =>
      db
        .collection('classes')
        .updateOne({ _id: cls._id }, { $set: { programId: chosen._id, updatedAt: now } })
    );
  }
  if (skipped) console.log(`  (${skipped} class(es) left unlinked — no program fits)`);

  // ── 5. Lab batches on first-year sections ────────────────────────────────
  // Batches exist to split a section for practicals, which is a UG first-year
  // concern here — a PG cohort gets none, so linked PG classes are excluded.
  // A class with no program link at all still qualifies (the legacy case).
  const pgProgramIds = new Set(
    (
      await db
        .collection('programs')
        .find({ tenantId, degreeType: { $nin: ['ug', 'diploma'] } })
        .project({ _id: 1 })
        .toArray()
    ).map((p) => p._id.toString())
  );
  const firstYearClassIds = (
    await db.collection('classes').find({ tenantId }).project({ path: 1, programId: 1 }).toArray()
  )
    .filter(
      (c) =>
        yearFromPath(c.path as Array<{ levelKey?: string; name?: string }>) === 1 &&
        !(c.programId && pgProgramIds.has(String(c.programId)))
    )
    .map((c) => c._id);

  const sections = firstYearClassIds.length
    ? await db
        .collection('sections')
        .find({ tenantId, classId: { $in: firstYearClassIds }, batches: { $exists: false } })
        .toArray()
    : [];

  for (const section of sections) {
    const batches = [
      { _id: new ObjectId(), name: 'Batch 1' },
      { _id: new ObjectId(), name: 'Batch 2' },
    ];
    await write(`+ lab batches on section "${section.name}"`, () =>
      db
        .collection('sections')
        .updateOne({ _id: section._id }, { $set: { batches, updatedAt: now } })
    );

    // Split that section's students alternately across the two batches.
    const students = await db
      .collection('students')
      .find({ tenantId, 'currentEnrollment.sectionId': section._id })
      .project({ _id: 1 })
      .sort({ _id: 1 })
      .toArray();
    if (!students.length) continue;
    await write(`~ ${students.length} student(s) in "${section.name}" → a lab batch`, async () => {
      for (let i = 0; i < students.length; i++) {
        await db
          .collection('students')
          .updateOne(
            { _id: students[i]._id },
            { $set: { 'currentEnrollment.labBatchId': batches[i % 2]._id, updatedAt: now } }
          );
      }
    });
  }

  // ── Report ───────────────────────────────────────────────────────────────
  if (!changes.length) {
    console.log('Nothing to do — this tenant is already fully on the university tier.');
    return;
  }
  for (const line of changes) console.log('  ' + line);
  console.log(
    `\n${changes.length} change(s) ${APPLY ? 'applied' : 'pending'}; ${linked} class(es) linked to a program.`
  );
  if (!APPLY) console.log('Re-run with --apply to write them.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

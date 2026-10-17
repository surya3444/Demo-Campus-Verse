/* eslint-disable no-console */
/**
 * Backfill user accounts for students that don't have one.
 *
 * Symptom this fixes: students inserted via the old bulk-upload flow (before
 * we added user-creation to the importer) have no row in the `users`
 * collection, which means they can't sign in.
 *
 * Strategy:
 *   - Find every student with an email (`contact.email`) but no linked `userId`.
 *   - Look up the tenant's `STUDENT` role.
 *   - Create a `users` row with a temp password `${FirstName}@${last4Admission}`
 *     and `mustChangePassword: true`.
 *   - Link bidirectionally (students.userId / users.studentId).
 *   - Print one CSV-style line per row so the admin can hand out the temp
 *     credentials.
 *
 * Idempotent — safe to re-run; rows that already have a userId are skipped.
 *
 * Usage:
 *   MONGODB_URI="..." pnpm tsx infrastructure/scripts/backfill-student-users.ts
 *   MONGODB_URI="..." pnpm tsx infrastructure/scripts/backfill-student-users.ts --dry-run
 *
 * --dry-run: prints exactly what would be created/linked but performs zero
 * writes. Always do this first against prod, eyeball the output, then re-run
 * without the flag.
 */
import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';

const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/campusverse';
const DRY_RUN = process.argv.includes('--dry-run');

async function run() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db();
  if (DRY_RUN) {
    console.log('--- DRY RUN: no writes will be performed ---\n');
  }

  const students = db.collection('students');
  const users = db.collection('users');
  const roles = db.collection('roles');

  // Per-tenant role cache so we don't repeat the same lookup
  const roleByTenant = new Map<string, ObjectId>();

  async function ensureStudentRoleId(tenantId: ObjectId): Promise<ObjectId | null> {
    const key = tenantId.toString();
    if (roleByTenant.has(key)) return roleByTenant.get(key)!;
    const role = await roles.findOne({ tenantId, code: 'STUDENT' });
    if (!role) {
      console.warn(`  ⚠ tenant ${key}: STUDENT role missing — skipping its students`);
      return null;
    }
    roleByTenant.set(key, role._id as ObjectId);
    return role._id as ObjectId;
  }

  // Candidates: have email, are not already linked to a user, and are in a
  // logically-loginable state. Soft-deleted students were removed on purpose
  // and must not get fresh credentials. `--include-all` overrides this if you
  // really need to backfill historical buckets.
  const INCLUDE_ALL = process.argv.includes('--include-all');
  const statusFilter = INCLUDE_ALL ? {} : { status: { $in: ['active', 'pending'] } };
  if (!INCLUDE_ALL) {
    console.log('Scope: status in [active, pending] only. Pass --include-all to widen.\n');
  }
  const cursor = students.find({
    ...statusFilter,
    'contact.email': { $exists: true, $ne: '' },
    $or: [{ userId: { $exists: false } }, { userId: null }],
  });

  let attempted = 0;
  let created = 0;
  let linked = 0;
  let skipped = 0;
  console.log('admissionNumber,email,tempPassword,result');

  for await (const s of cursor) {
    attempted++;
    const email = ((s.contact as { email?: string })?.email || '').toLowerCase().trim();
    const firstName = (s.firstName as string) || '';
    const lastName = (s.lastName as string) || '';
    const admissionNumber = (s.admissionNumber as string) || '';
    if (!email || !firstName || !admissionNumber) {
      skipped++;
      continue;
    }
    const tenantId = s.tenantId as ObjectId;
    const branchId = s.branchId as ObjectId;
    const studentId = s._id as ObjectId;

    const roleId = await ensureStudentRoleId(tenantId);
    if (!roleId) {
      skipped++;
      continue;
    }

    // If a user already exists with this email in this tenant, link instead of creating.
    const existing = await users.findOne({ tenantId, email });
    if (existing) {
      if (!existing.studentId) {
        if (!DRY_RUN) {
          await Promise.all([
            students.updateOne(
              { _id: studentId },
              { $set: { userId: existing._id, updatedAt: new Date() } }
            ),
            users.updateOne({ _id: existing._id }, { $set: { studentId, updatedAt: new Date() } }),
          ]);
        }
        linked++;
        console.log(
          `${admissionNumber},${email},(existing user — linked),${DRY_RUN ? 'WOULD-LINK' : 'linked'}`
        );
      } else {
        skipped++;
      }
      continue;
    }

    const last4 = admissionNumber.slice(-4);
    const tempPassword = `${firstName.trim()}@${last4}`;
    const userId = new ObjectId();
    const now = new Date();
    if (!DRY_RUN) {
      const passwordHash = await bcrypt.hash(tempPassword, 12);
      await users.insertOne({
        _id: userId,
        tenantId,
        email,
        passwordHash,
        profile: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          displayName: `${firstName.trim()} ${lastName.trim()}`.trim(),
        },
        roleId,
        accessScope: {
          type: 'branch',
          branchIds: [branchId],
        },
        security: {
          mfaEnabled: false,
          passwordChangedAt: now,
          loginAttempts: 0,
          mustChangePassword: true,
        },
        status: 'pending',
        studentId,
        createdAt: now,
        updatedAt: now,
      });
      await students.updateOne({ _id: studentId }, { $set: { userId, updatedAt: new Date() } });
    }
    created++;
    console.log(
      `${admissionNumber},${email},${tempPassword},${DRY_RUN ? 'WOULD-CREATE' : 'created'}`
    );
  }

  console.log(
    `\nDone${DRY_RUN ? ' (dry run)' : ''}. ${attempted} candidate(s); ${created} ${
      DRY_RUN ? 'would-create' : 'created'
    }, ${linked} ${DRY_RUN ? 'would-link' : 'linked'}, ${skipped} skipped.`
  );
  await client.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

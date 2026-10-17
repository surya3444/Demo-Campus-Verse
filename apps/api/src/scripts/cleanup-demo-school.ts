/**
 * Removes the SCHDEMO demo tenant and all data scoped to its tenantId.
 *
 * Usage: tsx src/scripts/cleanup-demo-school.ts [tenantId?]
 * Defaults to looking up tenant by code: 'SCHDEMO'.
 */

import { MongoClient, ObjectId } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const URI = process.env.MONGODB_URI;
if (!URI) {
  console.error('MONGODB_URI not set');
  process.exit(1);
}

const COLLECTIONS = [
  'branches',
  'roles',
  'users',
  'academic_batches',
  'departments',
  'designations',
  'subjects',
  'staff',
  'classes',
  'sections',
  'students',
  'student_enrollments',
  'admission_sources',
  'leads',
  'applications',
  'fee_structures',
  'fee_assignments',
  'fee_transactions',
  'transport_buses',
  'transport_enrollments',
  'transport_settings',
  'timetable_slots',
  'timetable_entries',
  'lesson_plans',
  'lessons',
  'assignments',
  'grades',
  'questionnaires',
  'feed_posts',
  'finance_settings',
  'attendance_settings',
  'admission_settings',
  'communication_settings',
  'visitor_settings',
  'course_settings',
  'certificate_types',
  'certificate_requests',
  'id_card_templates',
  'student_attendance',
  'staff_attendance',
  'counters',
  'settings',
  'audit_logs',
  'custom_fields',
];

async function main() {
  const client = new MongoClient(URI!);
  await client.connect();
  const db = client.db();

  const arg = process.argv[2];
  let tenantId: ObjectId;
  if (arg) {
    if (!ObjectId.isValid(arg)) {
      console.error(`Invalid tenantId: ${arg}`);
      process.exit(1);
    }
    tenantId = new ObjectId(arg);
  } else {
    const t = await db.collection('tenants').findOne({ code: 'SCHDEMO' });
    if (!t) {
      console.log('No SCHDEMO tenant found. Nothing to clean up.');
      await client.close();
      return;
    }
    tenantId = t._id as ObjectId;
  }

  const tenantDoc = await db.collection('tenants').findOne({ _id: tenantId });
  if (!tenantDoc) {
    console.error(`Tenant ${tenantId} not found.`);
    process.exit(1);
  }
  if (tenantDoc.code !== 'SCHDEMO') {
    console.error(
      `⛔ Refusing to delete tenant ${tenantId} (code: ${tenantDoc.code}). Only SCHDEMO is cleanable by this script.`
    );
    process.exit(1);
  }

  console.log(`Cleaning up tenant ${tenantId} (${tenantDoc.name})...`);
  let total = 0;
  for (const coll of COLLECTIONS) {
    const r = await db.collection(coll).deleteMany({ tenantId });
    if (r.deletedCount > 0) console.log(`  ${coll}: ${r.deletedCount}`);
    total += r.deletedCount;
  }
  const t = await db.collection('tenants').deleteOne({ _id: tenantId });
  total += t.deletedCount;
  console.log(`  tenants: ${t.deletedCount}`);
  console.log(`\n✅ Cleanup complete. ${total} documents deleted.`);
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

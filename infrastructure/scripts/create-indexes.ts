import { MongoClient, Db } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { createLiveClassIndexes } from '../../apps/api/src/scripts/create-live-class-indexes';

dotenv.config({ path: path.resolve(__dirname, '../../apps/api/.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const URI = process.env.MONGODB_URI;

/** Drop an index by name when present; a missing index is not an error. */
async function dropIndexIfExists(db: Db, collection: string, indexName: string) {
  try {
    await db.collection(collection).dropIndex(indexName);
    console.log(`dropped stale index ${collection}.${indexName}`);
  } catch (err) {
    const code = (err as { code?: number }).code;
    // 27 = IndexNotFound, 26 = NamespaceNotFound — both mean "nothing to do".
    if (code !== 27 && code !== 26) throw err;
  }
}

(async () => {
  if (!URI) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db();
  console.log(`DB: ${db.databaseName}\n`);

  console.log('=== Live classes ===');
  await createLiveClassIndexes(db);

  console.log('\n=== Bulk upload history ===');
  // Cascade delete + per-batch live count query students by their batch id.
  await db.collection('students').createIndex({ tenantId: 1, bulkUploadId: 1 });
  // History list: most-recent-first within a branch.
  await db.collection('bulk_uploads').createIndex({ tenantId: 1, branchId: 1, createdAt: -1 });
  console.log('bulk upload indexes ensured');

  console.log('\n=== Activity / audit logs ===');
  await db.collection('audit_logs').createIndex({ tenantId: 1, createdAt: -1 });
  await db.collection('audit_logs').createIndex({ tenantId: 1, userId: 1, createdAt: -1 });
  await db
    .collection('audit_logs')
    .createIndex({ tenantId: 1, targetType: 1, targetId: 1, createdAt: -1 });
  await db.collection('audit_logs').createIndex({ tenantId: 1, action: 1, createdAt: -1 });
  console.log('audit log indexes ensured');

  console.log('\n=== Course registration ===');
  // One active scheme per department × semester per branch.
  await db
    .collection('program_schemes')
    .createIndex({ tenantId: 1, branchId: 1, departmentCode: 1, semesterNumber: 1, status: 1 });
  // Program-keyed schemes: the lookup registration does first for a student
  // whose class carries a programId.
  await db
    .collection('program_schemes')
    .createIndex({ tenantId: 1, branchId: 1, programId: 1, semesterNumber: 1, status: 1 });
  // A student registers at most once per term (withdrawn ones don't count).
  await db
    .collection('course_registrations')
    .createIndex(
      { tenantId: 1, studentId: 1, termId: 1 },
      { unique: true, partialFilterExpression: { status: 'submitted' } }
    );
  // Registrar views: list/count per term, and per-scheme aggregation.
  await db
    .collection('course_registrations')
    .createIndex({ tenantId: 1, branchId: 1, termId: 1, status: 1 });
  await db.collection('course_registrations').createIndex({ tenantId: 1, schemeId: 1, status: 1 });
  console.log('course registration indexes ensured');

  console.log('\n=== OBE attainment ===');
  await db.collection('obe_settings').createIndex({ tenantId: 1, branchId: 1 }, { unique: true });
  // PO/PSO sets are per curriculum program, so the uniqueness key gained
  // curriculumProgramId (missing === null, which keeps "one per department"
  // true for department-wide sets). The pre-program unique index would block
  // a department's second program, so drop it first — idempotent.
  await dropIndexIfExists(db, 'obe_programs', 'tenantId_1_branchId_1_departmentCode_1');
  await db
    .collection('obe_programs')
    .createIndex(
      { tenantId: 1, branchId: 1, departmentCode: 1, curriculumProgramId: 1 },
      { unique: true }
    );
  await db
    .collection('obe_course_outcomes')
    .createIndex({ tenantId: 1, branchId: 1, subjectId: 1, programId: 1 }, { unique: true });
  // One offering per subject × batch × term per branch.
  await db.collection('obe_offerings').createIndex(
    // One offering per subject, term and OBE program (open electives are
    // offered once under each taker program).
    { tenantId: 1, branchId: 1, subjectId: 1, academicBatchId: 1, termId: 1, programId: 1 },
    { unique: true }
  );
  await db
    .collection('obe_offerings')
    .createIndex({ tenantId: 1, branchId: 1, academicBatchId: 1, termId: 1, programId: 1 });
  await db.collection('obe_instruments').createIndex({ tenantId: 1, offeringId: 1, order: 1 });
  // Marks upsert key.
  await db
    .collection('obe_marks')
    .createIndex({ tenantId: 1, instrumentId: 1, studentId: 1 }, { unique: true });
  await db.collection('obe_marks').createIndex({ tenantId: 1, offeringId: 1, studentId: 1 });
  // Survey dedupe: one response per student per offering.
  await db
    .collection('obe_survey_responses')
    .createIndex({ tenantId: 1, offeringId: 1, studentId: 1 }, { unique: true });
  await db
    .collection('obe_attainments')
    .createIndex({ tenantId: 1, offeringId: 1 }, { unique: true });
  // Program dashboard aggregation.
  await db
    .collection('obe_attainments')
    .createIndex({ tenantId: 1, branchId: 1, programId: 1, academicBatchId: 1 });
  console.log('OBE indexes ensured');

  console.log('\n=== University tier (institutions / programs / class FKs) ===');
  await db.collection('institutions').createIndex({ tenantId: 1, code: 1 }, { unique: true });
  await db
    .collection('institutions')
    // One default institution per CAMPUS — institutions sit below branches, so
    // every campus has its own default.
    .createIndex(
      { tenantId: 1, branchId: 1, isDefault: 1 },
      { unique: true, partialFilterExpression: { isDefault: true } }
    );
  await db.collection('institutions').createIndex({ tenantId: 1, branchId: 1 });
  await db.collection('departments').createIndex({ tenantId: 1, institutionId: 1 });
  await db
    .collection('programs')
    .createIndex({ tenantId: 1, branchId: 1, code: 1 }, { unique: true });
  await db.collection('programs').createIndex({ tenantId: 1, branchId: 1, departmentId: 1 });
  await db.collection('classes').createIndex({ tenantId: 1, branchId: 1, departmentId: 1 });
  // Teaching assignments: teacher-side and section-side lookups (doc §6.2).
  await db
    .collection('teaching_assignments')
    .createIndex({ tenantId: 1, branchId: 1, staffId: 1, status: 1 });
  await db
    .collection('teaching_assignments')
    .createIndex({ tenantId: 1, branchId: 1, sectionId: 1, subjectId: 1, status: 1 });
  // Scope-guard fast path (branch-agnostic: cross-branch teaching).
  await db
    .collection('teaching_assignments')
    .createIndex({ tenantId: 1, staffId: 1, sectionId: 1, status: 1 });
  // Scholarships: per-student view and receivables dashboards.
  await db.collection('scholarships').createIndex({ tenantId: 1, branchId: 1, studentId: 1 });
  await db
    .collection('scholarships')
    .createIndex({ tenantId: 1, branchId: 1, status: 1, createdAt: -1 });
  // Promotions: policy match on promote, listing views.
  await db
    .collection('promotion_policies')
    .createIndex({ tenantId: 1, fromDesignationId: 1, toDesignationId: 1, status: 1 });
  await db
    .collection('staff_promotions')
    .createIndex({ tenantId: 1, branchId: 1, status: 1, createdAt: -1 });
  await db.collection('staff_promotions').createIndex({ tenantId: 1, staffId: 1 });
  console.log('University tier indexes ensured');

  console.log('\nAll done.');
  await client.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * OBE offerings become unique per subject, term AND OBE program, so an open
 * elective can be offered once under each taker program. Replaces the old
 * unique index (without programId). Idempotent.
 *
 * Run with: npx tsx src/scripts/migrate-obe-offering-index.ts
 */
import 'dotenv/config';
import { connectDatabase, closeDatabase, getDb } from '../config/database';

const OLD = 'tenantId_1_branchId_1_subjectId_1_academicBatchId_1_termId_1';

(async () => {
  await connectDatabase();
  const col = getDb().collection('obe_offerings');
  const names = (await col.indexes()).map((i) => i.name);
  if (names.includes(OLD)) {
    await col.dropIndex(OLD);
    console.log('dropped', OLD);
  }
  const name = await col.createIndex(
    { tenantId: 1, branchId: 1, subjectId: 1, academicBatchId: 1, termId: 1, programId: 1 },
    { unique: true }
  );
  console.log('ensured', name);
  await closeDatabase();
})();

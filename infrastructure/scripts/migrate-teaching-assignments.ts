/* eslint-disable no-console */
/**
 * University tier, Phase 2: expand class-granular staff.teaching.subjects
 * into section-granular teaching_assignments rows — one row per (staff,
 * subject, section of the class). Also captures section-level links
 * (sections.subjects[].teacherId), which are already section-granular.
 *
 * staff.teaching.subjects is left in place as a denormalized summary (My
 * Classes still reads it as a fallback); Phase 5 retires it.
 *
 * Idempotent — an existing active assignment for the same (staff, section,
 * subject) is never duplicated. Dry-run by default; --apply writes.
 *
 * Usage:
 *   pnpm --filter @campus-verse/api exec tsx infrastructure/scripts/migrate-teaching-assignments.ts [--apply]
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
  console.log(`DB: ${db.databaseName}`);
  console.log(`Mode: ${APPLY ? 'apply' : 'dry-run'}\n`);

  const now = new Date();
  let toCreate = 0;
  let skippedExisting = 0;

  // Candidate rows keyed by staff|section|subject for dedupe across sources.
  const candidates = new Map<
    string,
    {
      tenantId: ObjectId;
      branchId: ObjectId;
      academicBatchId: ObjectId;
      staffId: ObjectId;
      subjectId: ObjectId;
      sectionId: ObjectId;
    }
  >();

  const classCache = new Map<string, { academicBatchId: ObjectId; branchId: ObjectId } | null>();
  async function classMeta(classId: ObjectId) {
    const key = classId.toString();
    if (!classCache.has(key)) {
      const cls = await db
        .collection('classes')
        .findOne({ _id: classId }, { projection: { academicBatchId: 1, branchId: 1 } });
      classCache.set(
        key,
        cls
          ? {
              academicBatchId: cls.academicBatchId as ObjectId,
              branchId: cls.branchId as ObjectId,
            }
          : null
      );
    }
    return classCache.get(key);
  }

  // Source 1: staff.teaching.subjects (class-level → expand to all sections).
  const staffWithTeaching = await db
    .collection('staff')
    .find(
      { 'teaching.subjects.0': { $exists: true }, status: 'active' },
      { projection: { tenantId: 1, 'teaching.subjects': 1 } }
    )
    .toArray();

  for (const staff of staffWithTeaching) {
    const subjects = (
      staff.teaching as {
        subjects: Array<{ subjectId: ObjectId; classIds: ObjectId[] }>;
      }
    ).subjects;
    for (const subj of subjects) {
      for (const classId of subj.classIds ?? []) {
        const meta = await classMeta(classId);
        if (!meta) continue;
        const sections = await db
          .collection('sections')
          .find(
            { classId, tenantId: staff.tenantId, status: 'active' },
            { projection: { _id: 1, branchId: 1 } }
          )
          .toArray();
        for (const section of sections) {
          const key = `${staff._id}|${section._id}|${subj.subjectId}`;
          if (!candidates.has(key)) {
            candidates.set(key, {
              tenantId: staff.tenantId as ObjectId,
              branchId: (section.branchId as ObjectId) ?? meta.branchId,
              academicBatchId: meta.academicBatchId,
              staffId: staff._id as ObjectId,
              subjectId: subj.subjectId,
              sectionId: section._id as ObjectId,
            });
          }
        }
      }
    }
  }

  // Source 2: sections.subjects[].teacherId (already section-granular).
  const sectionsWithTeachers = await db
    .collection('sections')
    .find(
      { 'subjects.teacherId': { $exists: true }, status: 'active' },
      { projection: { tenantId: 1, branchId: 1, classId: 1, subjects: 1 } }
    )
    .toArray();

  for (const section of sectionsWithTeachers) {
    const meta = await classMeta(section.classId as ObjectId);
    if (!meta) continue;
    for (const entry of (section.subjects as Array<{
      subjectId: ObjectId;
      teacherId?: ObjectId;
    }>) ?? []) {
      if (!entry.teacherId) continue;
      const key = `${entry.teacherId}|${section._id}|${entry.subjectId}`;
      if (!candidates.has(key)) {
        candidates.set(key, {
          tenantId: section.tenantId as ObjectId,
          branchId: section.branchId as ObjectId,
          academicBatchId: meta.academicBatchId,
          staffId: entry.teacherId,
          subjectId: entry.subjectId,
          sectionId: section._id as ObjectId,
        });
      }
    }
  }

  console.log(`${candidates.size} candidate assignment(s) from both sources.`);

  for (const candidate of candidates.values()) {
    const existing = await db.collection('teaching_assignments').findOne({
      tenantId: candidate.tenantId,
      staffId: candidate.staffId,
      sectionId: candidate.sectionId,
      subjectId: candidate.subjectId,
      status: 'active',
    });
    if (existing) {
      skippedExisting++;
      continue;
    }

    toCreate++;
    if (APPLY) {
      await db.collection('teaching_assignments').insertOne({
        _id: new ObjectId(),
        ...candidate,
        role: 'primary',
        status: 'active',
        migratedFrom: 'staff_teaching_migration',
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  console.log(
    `\n${APPLY ? 'Created' : 'Would create'} ${toCreate} assignment(s); ${skippedExisting} already existed.`
  );
  if (!APPLY) console.log('Re-run with --apply to write.');

  await client.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

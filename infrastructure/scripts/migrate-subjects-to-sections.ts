/* eslint-disable no-console */
/**
 * Migrate `classes.subjects[]` → `sections.subjects[]`.
 *
 * Subjects (with their teacher + periodsPerWeek) used to live on each class
 * doc, which meant every section under that class implicitly inherited the
 * same set and the same teacher. Subjects are now per-section so each section
 * can have its own teacher.
 *
 * For every class that has a non-empty `subjects[]`:
 *   1. Copy the array onto every section under that class. If a section
 *      already has a subjects[] (re-run safety), merge by subjectId — section
 *      entries win on conflict.
 *   2. Unset `subjects` on the class doc.
 *
 * Idempotent — safe to re-run. Classes without `subjects[]` are skipped.
 *
 * Usage:
 *   pnpm --filter @campus-verse/api exec tsx infrastructure/scripts/migrate-subjects-to-sections.ts
 *   MONGODB_URI="mongodb://localhost:27017/campusverse" pnpm tsx infrastructure/scripts/migrate-subjects-to-sections.ts
 */
import { MongoClient, ObjectId } from 'mongodb';

const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/campusverse';

interface SubjectEntry {
  subjectId: ObjectId;
  teacherId?: ObjectId;
  periodsPerWeek?: number;
}

async function run() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db();

  const classes = db.collection('classes');
  const sections = db.collection('sections');

  const classesWithSubjects = await classes
    .find({ subjects: { $exists: true, $ne: [] } })
    .project({ _id: 1, tenantId: 1, subjects: 1 })
    .toArray();

  console.log(`Found ${classesWithSubjects.length} classes with legacy subjects[]`);

  let sectionsUpdated = 0;
  let classesCleared = 0;

  for (const cls of classesWithSubjects) {
    const classSubjects = (cls.subjects ?? []) as SubjectEntry[];
    if (classSubjects.length === 0) continue;

    const classSections = await sections
      .find({ classId: cls._id, tenantId: cls.tenantId })
      .toArray();

    for (const section of classSections) {
      const existing = (section.subjects ?? []) as SubjectEntry[];
      const existingIds = new Set(existing.map((s) => s.subjectId.toString()));

      const merged = [...existing];
      for (const cs of classSubjects) {
        if (!existingIds.has(cs.subjectId.toString())) {
          merged.push(cs);
        }
      }

      await sections.updateOne(
        { _id: section._id },
        { $set: { subjects: merged, updatedAt: new Date() } }
      );
      sectionsUpdated++;
    }

    await classes.updateOne(
      { _id: cls._id },
      { $unset: { subjects: '' }, $set: { updatedAt: new Date() } }
    );
    classesCleared++;

    console.log(
      `  · class ${cls._id.toString()}: copied ${classSubjects.length} subjects to ${classSections.length} sections`
    );
  }

  console.log(
    `\nDone. ${classesCleared} class docs cleared, ${sectionsUpdated} section docs updated.`
  );

  await client.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

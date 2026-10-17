/* eslint-disable no-undef */
/**
 * Migration: backfill `applicableTo.gradeCodes` on existing fee_structures
 * documents from their legacy `applicableTo.classIds`. After this runs,
 * structures match students by stable grade code (survives across batches)
 * instead of by per-batch class _id.
 *
 * Idempotent: skips structures that already have gradeCodes set.
 *
 * Usage:
 *   mongosh <connection-string> migrate-fee-structures-to-grades.js
 *
 * Recommended workflow:
 *   1. Deploy backend changes that introduce gradeCodes.
 *   2. Run this script.
 *   3. From the Fee Structures page, click "Re-sync" on any structure that
 *      still shows "0 assigned" — this picks up students that the original
 *      classId-based auto-assign missed (the bug this migration is fixing).
 */

function gradeCodeFor(c) {
  const type = c.institutionType || 'school';
  if (type === 'school') {
    const code = (c.grade && (c.grade.code || c.grade.name)) || null;
    return code ? 'school:' + code : null;
  }
  if (type === 'college') {
    const code = (c.stream && (c.stream.code || c.stream.name)) || null;
    if (!code) return null;
    const year = c.stream && c.stream.year ? ':' + c.stream.year : '';
    return 'college:' + code + year;
  }
  if (type === 'university') {
    const code = (c.department && (c.department.code || c.department.name)) || null;
    if (!code) return null;
    const yearNum =
      c.year && c.year.number !== undefined
        ? ':' + c.year.number
        : c.year && c.year.name
          ? ':' + c.year.name
          : '';
    return 'university:' + code + yearNum;
  }
  return null;
}

let migrated = 0;
let skipped = 0;
let failed = 0;

const cursor = db.fee_structures.find({});
while (cursor.hasNext()) {
  const s = cursor.next();
  const existing = (s.applicableTo && s.applicableTo.gradeCodes) || [];
  if (existing.length > 0) {
    skipped += 1;
    continue;
  }

  const classIds = (s.applicableTo && s.applicableTo.classIds) || [];
  if (classIds.length === 0) {
    // Org-wide structure (no class targeting). Nothing to backfill.
    skipped += 1;
    continue;
  }

  const classes = db.classes.find({ _id: { $in: classIds } }).toArray();
  const codes = Array.from(new Set(classes.map((c) => gradeCodeFor(c)).filter((g) => g !== null)));

  if (codes.length === 0) {
    print(
      'Skipped ' +
        s._id +
        ' (' +
        s.code +
        '): could not derive any grade codes from ' +
        classIds.length +
        ' classIds'
    );
    failed += 1;
    continue;
  }

  db.fee_structures.updateOne(
    { _id: s._id },
    { $set: { 'applicableTo.gradeCodes': codes, updatedAt: new Date() } }
  );
  print('Migrated ' + s._id + ' (' + s.code + ') → ' + codes.join(', '));
  migrated += 1;
}

print('---');
print('Migration complete.');
print('Migrated:    ' + migrated);
print('Skipped:     ' + skipped);
print('Failed:      ' + failed);
print('');
print(
  'Next: open /finance/fee-structures and click Re-sync on any structure ' +
    'still showing "0 assigned" to backfill missing assignments.'
);

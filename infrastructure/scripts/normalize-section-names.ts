/* eslint-disable no-console */
/**
 * Normalize legacy `sections.name` values to the uniform `{leafLabel} {identifier}`
 * format that the AddSection dialog now enforces for new rows.
 *
 * Pre-fix, names were stored uppercased (`"SECTION A"`) and the dialog let users
 * type freely, so collections accumulate a mix:
 *   "A", "SECTION A", "Section A", "section a", "Grade 9 A", "Boys", …
 *
 * For every section this script:
 *   1. Resolves the branch's leaf hierarchy level (with the same fallback chain
 *      the API uses: branch → tenant → DEFAULT[institutionType]).
 *   2. Strips any leading occurrence of the leaf label (case-insensitive) so we
 *      have just the identifier ("a", "SECTION A" → "A", "Grade 9 A" → "Grade 9 A").
 *   3. Rebuilds the name as `"{LeafLabel} {identifier}"` with the leaf label in
 *      Title Case and the identifier upper-cased only when it's a single letter
 *      (so "Boys" / "Morning" stay capitalized as the user wrote them).
 *   4. Recomputes `code` from the new name.
 *
 * Conflicts inside a class (two old rows that collapse to the same new name)
 * are reported, not renamed — they need a human decision (merge or rename).
 *
 * Idempotent — re-running after a clean pass is a no-op.
 *
 * Usage:
 *   pnpm --filter @campus-verse/api exec tsx infrastructure/scripts/normalize-section-names.ts
 *   DRY_RUN=1 pnpm --filter @campus-verse/api exec tsx infrastructure/scripts/normalize-section-names.ts
 *   MONGODB_URI="mongodb://localhost:27017/campusverse" pnpm tsx infrastructure/scripts/normalize-section-names.ts
 */
import { MongoClient, ObjectId } from 'mongodb';

const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/campusverse';
const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

type InstitutionType = 'school' | 'college' | 'university';

interface HierarchyLevel {
  key: string;
  label: string;
  labelPlural: string;
  isLeaf: boolean;
  order: number;
}

// Inlined to keep this script self-contained (matches the pattern other scripts
// in this directory use). Mirrors `DEFAULT_HIERARCHY_CONFIG` in
// `packages/shared/src/types/organization.ts` — keep in sync if defaults change.
const DEFAULT_HIERARCHY_CONFIG: Record<InstitutionType, { levels: HierarchyLevel[] }> = {
  school: {
    levels: [
      { key: 'grade', label: 'Grade', labelPlural: 'Grades', isLeaf: false, order: 1 },
      { key: 'section', label: 'Section', labelPlural: 'Sections', isLeaf: true, order: 2 },
    ],
  },
  college: {
    levels: [
      { key: 'stream', label: 'Stream', labelPlural: 'Streams', isLeaf: false, order: 1 },
      { key: 'year', label: 'Year', labelPlural: 'Years', isLeaf: false, order: 2 },
      { key: 'section', label: 'Section', labelPlural: 'Sections', isLeaf: true, order: 3 },
    ],
  },
  university: {
    levels: [
      {
        key: 'department',
        label: 'Department',
        labelPlural: 'Departments',
        isLeaf: false,
        order: 1,
      },
      { key: 'year', label: 'Year', labelPlural: 'Years', isLeaf: false, order: 2 },
      { key: 'section', label: 'Section', labelPlural: 'Sections', isLeaf: true, order: 3 },
    ],
  },
};

function slug(s: string): string {
  return s
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_]/g, '')
    .slice(0, 12);
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|\s)([a-z])/g, (_, sep, ch: string) => sep + ch.toUpperCase());
}

/**
 * Pull the identifier out of a raw section name by removing any prefix that
 * matches the leaf label (case-insensitive). Falls back to the full trimmed
 * name when there's no recognizable prefix.
 */
function extractIdentifier(rawName: string, leafLabel: string): string {
  const trimmed = rawName.trim();
  if (!trimmed) return '';
  const leafLower = leafLabel.toLowerCase();
  const lower = trimmed.toLowerCase();
  if (lower === leafLower) return '';
  if (lower.startsWith(leafLower)) {
    const rest = trimmed.slice(leafLabel.length).trim();
    // Common separators we shed: "Section-A" / "Section_A" / "Section:A".
    return rest.replace(/^[-_:.]/, '').trim();
  }
  return trimmed;
}

function normalizeIdentifier(identifier: string): string {
  const t = identifier.trim();
  if (!t) return '';
  // A single alpha character is always upper-cased ("a" → "A"). Anything longer
  // is preserved as the user typed (so "Boys" / "Morning" / "10A" survive).
  if (t.length === 1 && /[a-zA-Z]/.test(t)) return t.toUpperCase();
  return t;
}

function normalizeName(rawName: string, leafLabel: string): string {
  const id = normalizeIdentifier(extractIdentifier(rawName, leafLabel));
  const label = titleCase(leafLabel.trim());
  if (!id) return label; // edge: a section literally named "Section" stays "Section"
  return `${label} ${id}`;
}

async function resolveLeafLabelForBranch(
  db: ReturnType<MongoClient['db']>,
  branchId: ObjectId,
  tenantId: ObjectId,
  cache: Map<string, string>
): Promise<string> {
  const cacheKey = branchId.toString();
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const branch = (await db
    .collection('branches')
    .findOne(
      { _id: branchId, tenantId },
      { projection: { academicHierarchy: 1, institutionType: 1 } }
    )) as {
    academicHierarchy?: { levels?: HierarchyLevel[] };
    institutionType?: InstitutionType;
  } | null;

  const branchLevels = branch?.academicHierarchy?.levels;
  if (branchLevels?.length) {
    const leaf = branchLevels.find((l) => l.isLeaf);
    if (leaf?.label?.trim()) {
      cache.set(cacheKey, leaf.label.trim());
      return leaf.label.trim();
    }
  }

  const tenant = (await db
    .collection('tenants')
    .findOne({ _id: tenantId }, { projection: { academicHierarchy: 1, institutionTypes: 1 } })) as {
    academicHierarchy?: { levels?: HierarchyLevel[] };
    institutionTypes?: InstitutionType[];
  } | null;

  const tenantLevels = tenant?.academicHierarchy?.levels;
  if (tenantLevels?.length) {
    const leaf = tenantLevels.find((l) => l.isLeaf);
    if (leaf?.label?.trim()) {
      cache.set(cacheKey, leaf.label.trim());
      return leaf.label.trim();
    }
  }

  const institutionType: InstitutionType =
    branch?.institutionType || tenant?.institutionTypes?.[0] || 'school';
  const fallback = DEFAULT_HIERARCHY_CONFIG[institutionType].levels.find((l) => l.isLeaf);
  const label = fallback?.label?.trim() || 'Section';
  cache.set(cacheKey, label);
  return label;
}

async function run() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db();
  const sections = db.collection('sections');

  console.log(`Connected to ${URI}`);
  console.log(DRY_RUN ? '[DRY RUN] no writes will be made' : 'Live run — sections will be updated');

  const all = await sections
    .find({}, { projection: { _id: 1, tenantId: 1, branchId: 1, classId: 1, name: 1, code: 1 } })
    .toArray();

  console.log(`Inspecting ${all.length} sections`);

  // Cache leaf-label resolution per branch so we don't re-hit Mongo for each section.
  const leafLabelCache = new Map<string, string>();
  // Track normalized names per class so we can detect collapse-collisions in-batch.
  const classCollisions = new Map<string, Map<string, string>>(); // classId → (normalizedLower → originalName)

  let unchanged = 0;
  let updated = 0;
  const conflicts: Array<{
    classId: string;
    normalized: string;
    original: string;
    conflictWith: string;
  }> = [];
  let errors = 0;

  for (const doc of all) {
    try {
      const branchId = doc.branchId as ObjectId | undefined;
      const tenantId = doc.tenantId as ObjectId | undefined;
      const classId = doc.classId as ObjectId | undefined;
      const original = (doc.name as string) ?? '';
      if (!branchId || !tenantId || !classId) {
        console.warn(`Section ${doc._id} missing tenant/branch/class — skipped`);
        errors += 1;
        continue;
      }

      const leafLabel = await resolveLeafLabelForBranch(db, branchId, tenantId, leafLabelCache);
      const normalized = normalizeName(original, leafLabel);

      if (normalized === original) {
        unchanged += 1;
        continue;
      }

      // Collision check within the same class. Look up sibling sections first
      // (excluding self) to detect a clash, both against the DB and within this batch.
      const classKey = classId.toString();
      let taken = classCollisions.get(classKey);
      if (!taken) {
        taken = new Map();
        classCollisions.set(classKey, taken);
      }
      const normLower = normalized.toLowerCase();

      const dbSibling = await sections.findOne(
        {
          _id: { $ne: doc._id },
          tenantId,
          classId,
          name: { $regex: `^${normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
        },
        { projection: { name: 1 } }
      );

      const inBatchConflict = taken.get(normLower);
      if (dbSibling || inBatchConflict) {
        const conflictWith =
          (dbSibling?.name as string | undefined) ?? inBatchConflict ?? '(unknown)';
        conflicts.push({
          classId: classKey,
          normalized,
          original,
          conflictWith,
        });
        continue;
      }

      taken.set(normLower, original);

      const newCode = slug(normalized) || (doc.code as string) || normalized.toUpperCase();
      if (!DRY_RUN) {
        await sections.updateOne(
          { _id: doc._id },
          { $set: { name: normalized, code: newCode, updatedAt: new Date() } }
        );
      }
      updated += 1;
      console.log(`  ${doc._id.toString().slice(-6)}  "${original}" → "${normalized}"`);
    } catch (err) {
      errors += 1;
      console.error(`Section ${doc._id}: ${(err as Error).message}`);
    }
  }

  console.log('');
  console.log('─────── Summary ───────');
  console.log(`  Unchanged: ${unchanged}`);
  console.log(`  ${DRY_RUN ? 'Would update' : 'Updated'}:  ${updated}`);
  console.log(`  Conflicts: ${conflicts.length}`);
  console.log(`  Errors:    ${errors}`);

  if (conflicts.length > 0) {
    console.log('');
    console.log(
      'Conflicts (manual intervention required — two sections in the same class collapse to the same name):'
    );
    for (const c of conflicts) {
      console.log(
        `  class ${c.classId.slice(-6)}: "${c.original}" would become "${c.normalized}", which clashes with "${c.conflictWith}"`
      );
    }
  }

  await client.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

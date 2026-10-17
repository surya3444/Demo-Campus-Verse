/* eslint-disable no-console */
/**
 * Migrate the `classes` collection from the legacy polymorphic shape
 * (`grade`/`stream`/`department`/`year`/`batch`/`institutionType`) to the
 * unified `path[]` shape that matches the resolved branch hierarchy.
 *
 * Idempotent — safe to re-run. Classes that already have a non-empty `path[]`
 * are skipped (only legacy fields are unset).
 *
 * Usage:
 *   pnpm --filter @campus-verse/api exec tsx infrastructure/scripts/migrate-class-path.ts
 *   MONGODB_URI="mongodb://localhost:27017/campusverse" pnpm tsx infrastructure/scripts/migrate-class-path.ts
 */
import { MongoClient, ObjectId, Db } from 'mongodb';
import {
  AcademicHierarchyConfig,
  DEFAULT_HIERARCHY_CONFIG,
  HierarchyLevel,
  InstitutionType,
} from '@campus-verse/shared';

const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/campusverse';

interface LegacyClassDoc {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  institutionType?: string;
  grade?: { name?: string; code?: string; order?: number };
  stream?: { name?: string; code?: string; year?: string };
  department?: { name?: string; code?: string };
  year?: { name?: string; number?: number };
  batch?: { name?: string; code?: string };
  displayName?: string;
  path?: Array<{ levelKey: string; name: string; code: string; order?: number }>;
}

async function resolveBranchHierarchy(
  db: Db,
  tenantId: ObjectId,
  branchId: ObjectId,
  fallbackInstitutionType?: string
): Promise<{ hierarchy: AcademicHierarchyConfig; institutionType: InstitutionType }> {
  const branch = await db
    .collection('branches')
    .findOne({ _id: branchId }, { projection: { academicHierarchy: 1, institutionType: 1 } });

  const institutionType =
    (branch?.institutionType as InstitutionType) ||
    (fallbackInstitutionType as InstitutionType) ||
    'school';

  if (branch?.academicHierarchy?.levels?.length) {
    return { hierarchy: branch.academicHierarchy, institutionType };
  }

  const tenant = await db
    .collection('tenants')
    .findOne({ _id: tenantId }, { projection: { academicHierarchy: 1 } });

  if (tenant?.academicHierarchy?.levels?.length) {
    return { hierarchy: tenant.academicHierarchy, institutionType };
  }

  return { hierarchy: DEFAULT_HIERARCHY_CONFIG[institutionType], institutionType };
}

/**
 * Derive a path[] from legacy polymorphic fields, mapping each non-leaf
 * hierarchy level to whatever sub-object the legacy class was carrying.
 */
function derivePathFromLegacy(
  cls: LegacyClassDoc,
  hierarchy: AcademicHierarchyConfig,
  institutionType: InstitutionType
): Array<{ levelKey: string; name: string; code: string; order?: number }> {
  const ordered: HierarchyLevel[] = [...hierarchy.levels].sort((a, b) => a.order - b.order);
  const nonLeaf = ordered.filter((l) => !l.isLeaf);

  // Default mapping: pick whatever legacy field best matches the level key.
  return nonLeaf.map((level) => {
    const key = level.key.toLowerCase();

    // Direct key matches first.
    if (key === 'grade' && cls.grade?.name) {
      return {
        levelKey: level.key,
        name: cls.grade.name,
        code: cls.grade.code || cls.grade.name,
        order: cls.grade.order,
      };
    }
    if (key === 'stream' && cls.stream?.name) {
      return {
        levelKey: level.key,
        name: cls.stream.name,
        code: cls.stream.code || cls.stream.name,
      };
    }
    if (key === 'department' && cls.department?.name) {
      return {
        levelKey: level.key,
        name: cls.department.name,
        code: cls.department.code || cls.department.name,
      };
    }
    if (key === 'year' && cls.year?.name) {
      return {
        levelKey: level.key,
        name: cls.year.name,
        code: String(cls.year.number ?? cls.year.name),
        order: cls.year.number,
      };
    }
    if (key === 'batch' && cls.batch?.name) {
      return {
        levelKey: level.key,
        name: cls.batch.name,
        code: cls.batch.code || cls.batch.name,
      };
    }

    // Fallback: pick the most-specific available sub-object for this institutionType.
    if (institutionType === 'school' && cls.grade?.name) {
      return {
        levelKey: level.key,
        name: cls.grade.name,
        code: cls.grade.code || cls.grade.name,
      };
    }
    if (institutionType === 'college' && cls.stream?.name) {
      return {
        levelKey: level.key,
        name: cls.stream.name,
        code: cls.stream.code || cls.stream.name,
      };
    }
    if (institutionType === 'university' && cls.department?.name) {
      return {
        levelKey: level.key,
        name: cls.department.name,
        code: cls.department.code || cls.department.name,
      };
    }

    return {
      levelKey: level.key,
      name: cls.displayName || level.label || level.key,
      code: cls.displayName || level.key,
    };
  });
}

(async () => {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db();
  console.log(`Connected to ${db.databaseName}\n`);

  const cursor = db.collection('classes').find({});
  let total = 0;
  let migrated = 0;
  let skipped = 0;
  let cleanedOnly = 0;

  while (await cursor.hasNext()) {
    const cls = (await cursor.next()) as unknown as LegacyClassDoc | null;
    if (!cls) continue;
    total++;

    const hasPath = Array.isArray(cls.path) && cls.path.length > 0;

    if (hasPath) {
      // Already migrated — just strip legacy fields if present.
      const unset = collectLegacyFieldsToUnset(cls);
      if (Object.keys(unset).length > 0) {
        await db
          .collection('classes')
          .updateOne({ _id: cls._id }, { $unset: unset, $set: { updatedAt: new Date() } });
        cleanedOnly++;
      } else {
        skipped++;
      }
      continue;
    }

    const { hierarchy, institutionType } = await resolveBranchHierarchy(
      db,
      cls.tenantId,
      cls.branchId,
      cls.institutionType
    );
    const path = derivePathFromLegacy(cls, hierarchy, institutionType);
    const displayName = path.map((p) => p.name).join(' · ') || cls.displayName || 'Untitled';

    const unset = collectLegacyFieldsToUnset(cls);

    await db.collection('classes').updateOne(
      { _id: cls._id },
      {
        $set: { path, displayName, updatedAt: new Date() },
        ...(Object.keys(unset).length ? { $unset: unset } : {}),
      }
    );
    migrated++;
    console.log(`  ✓ ${cls._id.toString()} → "${displayName}" (${path.length} levels)`);
  }

  console.log(
    `\nDone. total=${total} migrated=${migrated} cleaned=${cleanedOnly} skipped=${skipped}`
  );
  await client.close();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

function collectLegacyFieldsToUnset(cls: LegacyClassDoc): Record<string, ''> {
  const unset: Record<string, ''> = {};
  for (const k of ['institutionType', 'grade', 'stream', 'department', 'year', 'batch'] as const) {
    if (cls[k] !== undefined) unset[k] = '';
  }
  return unset;
}

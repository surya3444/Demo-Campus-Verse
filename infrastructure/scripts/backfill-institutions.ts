/* eslint-disable no-console */
/**
 * University tier, Phase 1: give every tenant its default institution and
 * stamp every branch with an institutionId.
 *
 * Metadata-only and idempotent — safe to re-run. Tenants that already have a
 * default institution are skipped; only branches missing institutionId are
 * stamped. (The API's institutionService.ensureDefaultInstitution does the
 * same lazily; this script converges all tenants up front.)
 *
 * Usage:
 *   pnpm --filter @campus-verse/api exec tsx infrastructure/scripts/backfill-institutions.ts
 *   MONGODB_URI="mongodb://localhost:27017/campusverse" pnpm tsx infrastructure/scripts/backfill-institutions.ts
 */
import { MongoClient, ObjectId } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../apps/api/.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/campusverse';

(async () => {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db();
  console.log(`DB: ${db.databaseName}\n`);

  const tenants = await db
    .collection('tenants')
    .find({}, { projection: { name: 1, code: 1 } })
    .toArray();

  let created = 0;
  let stamped = 0;

  for (const tenant of tenants) {
    let inst = await db
      .collection('institutions')
      .findOne({ tenantId: tenant._id, isDefault: true });

    if (!inst) {
      const now = new Date();
      const doc = {
        _id: new ObjectId(),
        tenantId: tenant._id,
        name: tenant.name as string,
        code: String(tenant.code || 'MAIN').toUpperCase(),
        isDefault: true,
        settings: {},
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };
      await db.collection('institutions').insertOne(doc);
      inst = doc;
      created++;
      console.log(`+ default institution for tenant "${tenant.name}" (${doc.code})`);
    }

    const result = await db
      .collection('branches')
      .updateMany(
        { tenantId: tenant._id, institutionId: { $exists: false } },
        { $set: { institutionId: inst._id } }
      );
    if (result.modifiedCount > 0) {
      stamped += result.modifiedCount;
      console.log(`  stamped ${result.modifiedCount} branch(es) of "${tenant.name}"`);
    }
  }

  console.log(
    `\nDone. ${tenants.length} tenant(s): ${created} default institution(s) created, ${stamped} branch(es) stamped.`
  );
  await client.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

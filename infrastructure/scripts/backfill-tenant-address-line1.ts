/**
 * Backfill: copy `contact.address.street` → `contact.address.line1` on tenants
 * where line1 is empty.
 *
 * The organization settings form used to save the street into `address.street`,
 * while addressSchema, tenant creation, the seeds and the setup checklist all
 * read `address.line1`. Anyone who filled in their address through Settings
 * therefore left line1 empty, and "Complete your contact address" stayed
 * unticked forever.
 *
 * Idempotent: tenants that already have a non-empty line1 are untouched.
 * Dry-run by default — pass --apply to write.
 *
 * Usage:
 *   pnpm --filter @campus-verse/api exec tsx infrastructure/scripts/backfill-tenant-address-line1.ts
 *   ... --apply
 */

import { MongoClient, ObjectId } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../apps/api/.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const URI = process.env.MONGODB_URI;
const APPLY = process.argv.includes('--apply');

interface TenantDoc {
  _id: ObjectId;
  name: string;
  code: string;
  contact?: { address?: { line1?: string; street?: string } };
}

(async () => {
  if (!URI) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db();
  console.log(
    `Connected to ${db.databaseName}${APPLY ? '' : ' (dry run — pass --apply to write)'}\n`
  );

  const tenants = (await db.collection('tenants').find({}).toArray()) as unknown as TenantDoc[];

  let fixed = 0;
  let alreadyOk = 0;
  let nothingToCopy = 0;

  for (const t of tenants) {
    const addr = t.contact?.address ?? {};
    if (addr.line1 && addr.line1.trim()) {
      alreadyOk++;
      continue;
    }
    if (!addr.street || !addr.street.trim()) {
      nothingToCopy++;
      continue;
    }
    if (APPLY) {
      await db
        .collection('tenants')
        .updateOne(
          { _id: t._id },
          { $set: { 'contact.address.line1': addr.street, updatedAt: new Date() } }
        );
    }
    fixed++;
    console.log(`  ✓ ${t.code ?? t._id.toString()} "${t.name}" — line1 ← "${addr.street}"`);
  }

  console.log(
    `\nDone. tenants=${tenants.length} fixed=${fixed}${APPLY ? '' : ' (not written)'} ` +
      `alreadyOk=${alreadyOk} noStreet=${nothingToCopy}`
  );
  await client.close();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Removes the demo platform: every document belonging to the three demo
 * tenants (Aranya University, Vedanta University, Sunrise Public Schools) in
 * every collection, plus their signups. Nothing outside those tenants is
 * touched. Dry run by default; pass --yes to delete.
 *
 * Run from apps/api: npx tsx src/scripts/demo-platform/cleanup.ts [--yes]
 */
import 'dotenv/config';
import { connectDatabase, closeDatabase, getDb } from '../../config/database';

const OWNER_EMAILS = [
  'cvdemo-aranya-owner@yopmail.com',
  'cvdemo-vedanta-owner@yopmail.com',
  'cvdemo-sunrise-owner@yopmail.com',
];
const yes = process.argv.includes('--yes');

(async () => {
  await connectDatabase();
  const db = getDb();
  const tenants = await db
    .collection('tenants')
    .find({ 'contact.email': { $in: OWNER_EMAILS } })
    .project({ _id: 1, name: 1, code: 1 })
    .toArray();
  if (!tenants.length) {
    console.log('No demo tenants found.');
    process.exit(0);
  }
  const ids = tenants.map((t) => t._id);
  console.log('Demo tenants:', tenants.map((t) => `${t.name} (${t.code})`).join(', '));
  let total = 0;
  for (const { name } of await db.listCollections().toArray()) {
    const col = db.collection(name);
    const filter = name === 'tenants' ? { _id: { $in: ids } } : { tenantId: { $in: ids } };
    const n = await col.countDocuments(filter);
    if (!n) continue;
    total += n;
    console.log(`${yes ? 'deleting' : 'would delete'} ${String(n).padStart(6)}  ${name}`);
    if (yes) await col.deleteMany(filter);
  }
  const signups = { 'admin.email': { $in: OWNER_EMAILS } };
  const s = await db.collection('organization_signups').countDocuments(signups);
  if (s) {
    console.log(
      `${yes ? 'deleting' : 'would delete'} ${String(s).padStart(6)}  organization_signups`
    );
    if (yes) await db.collection('organization_signups').deleteMany(signups);
  }
  console.log(
    `${yes ? 'Deleted' : 'Dry run —'} ${total + s} documents.${yes ? '' : ' Re-run with --yes to delete.'}`
  );
  await closeDatabase();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

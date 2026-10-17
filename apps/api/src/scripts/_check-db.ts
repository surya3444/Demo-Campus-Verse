import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const URI = process.env.MONGODB_URI!;

(async () => {
  const c = new MongoClient(URI);
  await c.connect();
  const db = c.db();
  console.log('DB:', db.databaseName);
  const colls = await db.listCollections().toArray();
  console.log('\nCollections + counts:');
  for (const col of colls.sort((a, b) => a.name.localeCompare(b.name))) {
    const n = await db.collection(col.name).countDocuments();
    console.log(`  ${col.name}: ${n}`);
  }
  console.log('\nAll tenants:');
  const tenants = await db
    .collection('tenants')
    .find({}, { projection: { name: 1, code: 1, status: 1 } })
    .toArray();
  console.log(JSON.stringify(tenants, null, 2));
  await c.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

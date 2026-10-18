/**
 * Demo platform, phase 18: profile photos for one organisation's students and
 * staff, by gender, from the randomuser.me portrait set (hot-linked; S3 isn't
 * configured on the demo). Photo upload needs S3, so the field is set directly
 * — scoped to that one tenant.
 *
 * Run (from apps/api): npx tsx src/scripts/demo-platform/18-photos.ts <tenantId>
 */
import 'dotenv/config';
import { ObjectId, type AnyBulkWriteOperation, type Document } from 'mongodb';
import { connectDatabase, closeDatabase, collections } from '../../config/database';

/**
 * Hand-picked from the set for a South Indian campus: plausible faces, plain
 * ID-style shots (no caps, sunglasses or joke poses).
 */
// men/69 is reserved for the group owner's portrait.
const MEN = [4, 5, 7, 9, 11, 12, 20, 26, 30, 35, 37, 38, 39, 41, 45, 47, 48, 50, 56, 58, 65, 67, 73, 77, 85, 86, 87, 90, 95, 97, 98, 61, 46];
const WOMEN = [1, 2, 8, 12, 13, 15, 19, 22, 26, 28, 29, 40, 42, 46, 53, 56, 61, 63, 70, 75, 76, 78, 79, 85, 88, 95, 98, 99, 17, 66];
const url = (female: boolean, i: number) =>
  `https://randomuser.me/api/portraits/${female ? 'women' : 'men'}/${i}.jpg`;

/** Spread faces: consecutive people get portraits far apart in the set. */
const nth = (female: boolean, k: number, offset: number) => {
  const set = female ? WOMEN : MEN;
  return set[(k * 7 + offset) % set.length];
};

async function assign(coll: typeof collections.students, tenantId: ObjectId, offset: number) {
  const people = await coll
    .find({ tenantId })
    .project({ gender: 1 })
    .sort({ _id: 1 })
    .toArray();
  const count = { f: 0, m: 0 };
  const ops: AnyBulkWriteOperation<Document>[] = people.map((p) => {
    const female = p.gender === 'female';
    const k = female ? count.f++ : count.m++;
    return {
      updateOne: { filter: { _id: p._id, tenantId }, update: { $set: { photo: url(female, nth(female, k, offset)) } } },
    };
  });
  for (let i = 0; i < ops.length; i += 500) await coll.bulkWrite(ops.slice(i, i + 500));
  return people.length;
}

(async () => {
  const id = process.argv[2];
  if (!id || !ObjectId.isValid(id)) throw new Error('Pass the tenant id');
  await connectDatabase();
  const tenantId = new ObjectId(id);
  const students = await assign(collections.students, tenantId, 3);
  const staff = await assign(collections.staff, tenantId, 17);
  console.log(`photos set: ${students} students, ${staff} staff`);
  await closeDatabase();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

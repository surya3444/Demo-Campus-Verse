/* eslint-disable no-console */
import { MongoClient, ObjectId } from 'mongodb';

const URI = process.env.MONGODB_URI || '';
const TENANT_OWNER_EMAIL = process.env.OWNER_EMAIL || 'orgdev@yopmail.com';

async function run() {
  if (!URI) throw new Error('MONGODB_URI missing');
  const c = new MongoClient(URI);
  await c.connect();
  const db = c.db();
  const owner = await db.collection('users').findOne({ email: TENANT_OWNER_EMAIL });
  if (!owner) {
    console.log(`No owner user with email ${TENANT_OWNER_EMAIL}`);
    await c.close();
    return;
  }
  const tenantId = owner.tenantId;

  const active = await db
    .collection('students')
    .find({ tenantId, status: 'active' })
    .project({ admissionNumber: 1, firstName: 1, lastName: 1, userId: 1, 'contact.email': 1 })
    .toArray();

  const userIds = active.filter((s) => s.userId).map((s) => s.userId as ObjectId);
  const users = userIds.length
    ? await db
        .collection('users')
        .find({ _id: { $in: userIds } })
        .project({ status: 1, email: 1 })
        .toArray()
    : [];
  const userById = new Map(users.map((u) => [(u._id as ObjectId).toString(), u]));

  console.log(
    ['admissionNumber', 'name', 'student.email', 'hasUser', 'user.status', 'canLogin'].join('\t')
  );
  let withUser = 0;
  let canLogin = 0;
  for (const s of active) {
    const u = s.userId ? userById.get((s.userId as ObjectId).toString()) : null;
    const cl = !!u && u.status !== 'inactive' && (u.status as string) !== 'deleted';
    if (s.userId) withUser++;
    if (cl) canLogin++;
    console.log(
      [
        s.admissionNumber ?? '-',
        `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim(),
        (s.contact as { email?: string } | undefined)?.email ?? '(no email)',
        s.userId ? 'yes' : 'NO',
        u?.status ?? '-',
        cl ? 'YES' : 'NO',
      ].join('\t')
    );
  }
  console.log(
    `\nTotal active: ${active.length}, with user link: ${withUser}, can log in: ${canLogin}`
  );

  await c.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

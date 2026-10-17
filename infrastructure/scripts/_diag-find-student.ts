/* eslint-disable no-console */
import { MongoClient } from 'mongodb';

const URI = process.env.MONGODB_URI || '';
const TENANT_OWNER_EMAIL = process.env.OWNER_EMAIL || 'orgdev@yopmail.com';
const STUDENT_EMAIL = process.env.STUDENT_EMAIL || 'aarav.sharma@student.example.com';

async function run() {
  if (!URI) throw new Error('MONGODB_URI missing');
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db();

  // 1. Find tenant via the owner user
  const owner = await db.collection('users').findOne({ email: TENANT_OWNER_EMAIL });
  if (!owner) {
    console.log(`No user found with email ${TENANT_OWNER_EMAIL}`);
    await client.close();
    return;
  }
  const tenantId = owner.tenantId;
  console.log(`✓ Tenant: ${tenantId}\n`);

  // 2. Find student doc(s)
  const students = await db
    .collection('students')
    .find({ tenantId, 'contact.email': STUDENT_EMAIL })
    .toArray();

  console.log(`-- students.contact.email == ${STUDENT_EMAIL} (in tenant): ${students.length}`);
  for (const s of students) {
    console.log(
      JSON.stringify(
        {
          _id: s._id.toString(),
          admissionNumber: s.admissionNumber,
          firstName: s.firstName,
          lastName: s.lastName,
          status: s.status,
          userId: s.userId?.toString?.() ?? null,
          branchId: s.branchId?.toString?.() ?? null,
          currentEnrollment: s.currentEnrollment
            ? {
                academicBatchId: (s.currentEnrollment as any).academicBatchId?.toString?.(),
                classId: (s.currentEnrollment as any).classId?.toString?.(),
                sectionId: (s.currentEnrollment as any).sectionId?.toString?.(),
                className: (s.currentEnrollment as any).className,
                sectionName: (s.currentEnrollment as any).sectionName,
              }
            : null,
          createdAt: s.createdAt,
        },
        null,
        2
      )
    );
  }

  // 3. Search by name in case email isn't stored where I think
  if (students.length === 0) {
    const byName = await db
      .collection('students')
      .find({ tenantId, firstName: /aarav/i, lastName: /sharma/i })
      .toArray();
    console.log(`\n-- fallback by firstName ~ aarav, lastName ~ sharma: ${byName.length}`);
    for (const s of byName) {
      console.log(
        JSON.stringify(
          {
            _id: s._id.toString(),
            admissionNumber: s.admissionNumber,
            contact: s.contact,
            status: s.status,
            userId: s.userId?.toString?.() ?? null,
            currentEnrollment: s.currentEnrollment,
            createdAt: s.createdAt,
          },
          null,
          2
        )
      );
    }
  }

  // 4. Find user(s) with that email in this tenant
  const userRows = await db.collection('users').find({ tenantId, email: STUDENT_EMAIL }).toArray();
  console.log(`\n-- users.email == ${STUDENT_EMAIL} (in tenant): ${userRows.length}`);
  for (const u of userRows) {
    console.log(
      JSON.stringify(
        {
          _id: u._id.toString(),
          email: u.email,
          status: u.status,
          studentId: u.studentId?.toString?.() ?? null,
          roleId: u.roleId?.toString?.() ?? null,
          createdAt: u.createdAt,
        },
        null,
        2
      )
    );
  }

  // 5. Active student count + status breakdown for context
  const breakdown = await db
    .collection('students')
    .aggregate([
      { $match: { tenantId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ])
    .toArray();
  console.log('\n-- student status breakdown for tenant:');
  for (const b of breakdown) console.log(`   ${b._id ?? '(none)'}: ${b.count}`);

  await client.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

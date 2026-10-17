/**
 * Seeds one fully-shaped student account for the org owned by a specified
 * user email. Mirrors student.service.ts.create() so the seeded record looks
 * identical to one created via the API.
 *
 * Usage:
 *   pnpm --filter @campus-verse/api exec tsx src/scripts/seed-student.ts
 *   pnpm --filter @campus-verse/api exec tsx src/scripts/seed-student.ts orgdev@yopmail.com
 *
 * Idempotent: if a student already exists with the same email under that
 * tenant + branch, the script skips the insert and prints what would have
 * been created instead.
 */
import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from the apps/api root so the script picks up MONGODB_URI without
// needing the dev to prefix every invocation.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/campus_verse';
const OWNER_EMAIL = (process.argv[2] || 'orgdev@yopmail.com').toLowerCase();

// The student we want to seed. Picked to satisfy every required + most
// optional fields so the resulting doc is fully populated. Name was chosen
// to not collide with anything already in the orgdev tenant.
const STUDENT = {
  firstName: 'Tara',
  lastName: 'Banerjee',
  email: 'tara.banerjee@yopmail.com',
  dateOfBirth: '2011-03-22',
  gender: 'female' as const,
  category: 'general' as const,
  bloodGroup: 'B+',
  nationality: 'Indian',
  religion: 'Hindu',
  aadharNumber: '4321-8765-1098',
  rollNumber: 'SEED-001',
  phone: '+91-9812345670',
  alternatePhone: '+91-9812345671',
  address: {
    line1: '52 Park Street',
    line2: 'Apt 4B',
    city: 'Kolkata',
    state: 'West Bengal',
    country: 'India',
    pincode: '700016',
  },
  father: {
    name: 'Sourav Banerjee',
    phone: '+91-9831122334',
    email: 'sourav.banerjee@yopmail.com',
    occupation: 'Architect',
    qualification: 'B.Arch',
  },
  mother: {
    name: 'Rina Banerjee',
    phone: '+91-9831122335',
    email: 'rina.banerjee@yopmail.com',
    occupation: 'Teacher',
    qualification: 'M.A., B.Ed',
  },
};

async function pickClassAndSection(
  db: ReturnType<MongoClient['db']>,
  tenantId: ObjectId,
  branchId: ObjectId,
  academicBatchId: ObjectId
) {
  // Prefer a class explicitly tied to this branch + batch. Some seeds attach
  // classes by tenant only — fall back to tenant-scoped query in that case.
  const branchScoped = await db.collection('classes').findOne({
    tenantId,
    branchId,
    academicBatchId,
    status: { $ne: 'deleted' },
  });
  const klass =
    branchScoped ||
    (await db.collection('classes').findOne({
      tenantId,
      status: { $ne: 'deleted' },
    }));

  if (!klass) {
    throw new Error('No classes found for this tenant. Create at least one class first.');
  }

  const section = await db.collection('sections').findOne({
    classId: klass._id,
    status: { $ne: 'deleted' },
  });
  if (!section) {
    throw new Error(
      `No sections found for class "${klass.displayName}" (${klass._id}). Create a section first.`
    );
  }
  return { klass, section };
}

async function nextSequence(
  db: ReturnType<MongoClient['db']>,
  type: string,
  tenantId: ObjectId,
  branchId?: ObjectId,
  academicBatchId?: ObjectId
): Promise<number> {
  const filter: Record<string, unknown> = { tenantId, type };
  if (branchId) filter.branchId = branchId;
  if (academicBatchId) filter.academicBatchId = academicBatchId;

  const result = await db.collection('counters').findOneAndUpdate(
    filter,
    {
      $inc: { sequence: 1 },
      $setOnInsert: {
        tenantId,
        type,
        ...(branchId && { branchId }),
        ...(academicBatchId && { academicBatchId }),
      },
    },
    { upsert: true, returnDocument: 'after' }
  );
  return result!.sequence as number;
}

const pad = (n: number, len = 4) => String(n).padStart(len, '0');

async function seed() {
  console.log(`🌱 Seeding student for org owned by "${OWNER_EMAIL}"...`);
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db();
  console.log('📦 Connected to MongoDB');

  try {
    // 1. Resolve tenant via the owner user.
    const owner = await db.collection('users').findOne({ email: OWNER_EMAIL });
    if (!owner) {
      throw new Error(
        `Owner user not found for email "${OWNER_EMAIL}". Make sure the org has been signed up and approved.`
      );
    }
    const tenantId = owner.tenantId as ObjectId;
    if (!tenantId) {
      throw new Error(`Owner user "${OWNER_EMAIL}" has no tenantId on it.`);
    }
    const tenant = await db.collection('tenants').findOne({ _id: tenantId });
    if (!tenant) throw new Error(`Tenant ${tenantId} not found.`);
    console.log(`🏢 Tenant: ${tenant.name} (${tenant.code})`);

    // 2. Pick a branch (first active one for this tenant).
    const branch = await db.collection('branches').findOne({
      tenantId,
      status: 'active',
    });
    if (!branch) {
      throw new Error(`No active branches for tenant ${tenantId}.`);
    }
    const branchId = branch._id as ObjectId;
    console.log(`🏫 Branch: ${branch.name} (${branch.code})`);

    // 3. Pick the current academic batch.
    const batch =
      (await db.collection('academic_batches').findOne({ tenantId, isCurrent: true })) ||
      (await db.collection('academic_batches').findOne({ tenantId, status: 'active' })) ||
      (await db.collection('academic_batches').findOne({ tenantId }));
    if (!batch) {
      throw new Error(`No academic batch found for tenant ${tenantId}.`);
    }
    const academicBatchId = batch._id as ObjectId;
    console.log(`📅 Academic batch: ${batch.name} (${batch.code})`);

    // 4. Pick a class + section.
    const { klass, section } = await pickClassAndSection(db, tenantId, branchId, academicBatchId);
    console.log(`📚 Class: ${klass.displayName} / Section: ${section.name}`);

    // 5. Idempotency: skip if this student is already seeded.
    const existing = await db.collection('students').findOne({
      tenantId,
      branchId,
      'contact.email': STUDENT.email.toLowerCase(),
    });
    if (existing) {
      console.log(
        `⚠️  Student ${STUDENT.email} already exists for this tenant + branch (admissionNumber=${existing.admissionNumber}). Skipping.`
      );
      return;
    }

    // 6. Generate identifiers — same shapes student.service uses.
    const admissionSeq = await nextSequence(
      db,
      'admissionNumber',
      tenantId,
      branchId,
      academicBatchId
    );
    const admissionNumber = `${branch.code}-${batch.code}-${pad(admissionSeq)}`;
    const enrollmentSeq = await nextSequence(db, 'enrollmentCode', tenantId);
    const enrollmentCode = `EN${pad(enrollmentSeq, 8)}`;

    const studentId = new ObjectId();
    const now = new Date();

    // 7. Insert student document.
    const studentDoc = {
      _id: studentId,
      tenantId,
      branchId,
      admissionNumber,
      enrollmentCode,
      rollNumber: STUDENT.rollNumber,
      firstName: STUDENT.firstName,
      lastName: STUDENT.lastName,
      displayName: `${STUDENT.firstName} ${STUDENT.lastName}`,
      dateOfBirth: new Date(STUDENT.dateOfBirth),
      gender: STUDENT.gender,
      bloodGroup: STUDENT.bloodGroup,
      nationality: STUDENT.nationality,
      religion: STUDENT.religion,
      category: STUDENT.category,
      aadharNumber: STUDENT.aadharNumber,
      contact: {
        email: STUDENT.email.toLowerCase(),
        phone: STUDENT.phone,
        alternatePhone: STUDENT.alternatePhone,
        address: {
          current: STUDENT.address,
          permanent: STUDENT.address,
        },
      },
      parents: {
        father: STUDENT.father,
        mother: STUDENT.mother,
      },
      primaryContactType: 'father',
      admissionDate: now,
      admissionType: 'new',
      currentEnrollment: {
        academicBatchId,
        classId: klass._id,
        sectionId: section._id,
        className: klass.displayName,
        sectionName: section.name,
      },
      status: 'active',
      statusHistory: [
        {
          status: 'active',
          date: now,
          reason: 'Seeded via seed-student.ts',
          changedBy: owner._id,
        },
      ],
      createdBy: owner._id,
      createdAt: now,
      updatedAt: now,
    };
    await db.collection('students').insertOne(studentDoc);
    console.log(`👦 Student inserted (admissionNumber=${admissionNumber})`);

    // 8. Enrollment record.
    await db.collection('student_enrollments').insertOne({
      tenantId,
      branchId,
      studentId,
      academicBatchId,
      classId: klass._id,
      sectionId: section._id,
      enrollmentDate: now,
      enrollmentType: 'new',
      status: 'active',
      createdBy: owner._id,
      createdAt: now,
      updatedAt: now,
    });
    console.log(`📝 Enrollment record inserted`);

    // 9. Create the login user — needs the STUDENT role for this tenant.
    const studentRole = await db.collection('roles').findOne({ tenantId, code: 'STUDENT' });
    let userId: ObjectId | null = null;
    let tempPassword: string | null = null;

    if (!studentRole) {
      console.log(
        `⚠️  STUDENT role missing for tenant — skipping user account creation. Run /apps/api seed first or add the role.`
      );
    } else {
      const last4 = admissionNumber.slice(-4);
      tempPassword = `${STUDENT.firstName}@${last4}`;
      const passwordHash = await bcrypt.hash(tempPassword, 12);
      userId = new ObjectId();

      await db.collection('users').insertOne({
        _id: userId,
        tenantId,
        email: STUDENT.email.toLowerCase(),
        passwordHash,
        profile: {
          firstName: STUDENT.firstName,
          lastName: STUDENT.lastName,
          displayName: `${STUDENT.firstName} ${STUDENT.lastName}`,
        },
        roleId: studentRole._id,
        accessScope: {
          type: 'branch',
          branchIds: [branchId],
        },
        security: {
          mfaEnabled: false,
          passwordChangedAt: now,
          loginAttempts: 0,
          mustChangePassword: true,
        },
        status: 'active',
        studentId,
        createdBy: owner._id,
        createdAt: now,
        updatedAt: now,
      });

      await db
        .collection('students')
        .updateOne({ _id: studentId }, { $set: { userId, updatedAt: new Date() } });
      console.log(`🔐 User account created (userId=${userId})`);
    }

    console.log('\n✅ Seed completed!\n');
    console.log('┌──────────────────────────────────────────────────────────────┐');
    console.log('│ Seeded student summary                                       │');
    console.log('├──────────────────────────────────────────────────────────────┤');
    console.log(`│ Name              : ${STUDENT.firstName} ${STUDENT.lastName}`);
    console.log(`│ Admission Number  : ${admissionNumber}`);
    console.log(`│ Enrollment Code   : ${enrollmentCode}`);
    console.log(`│ Class / Section   : ${klass.displayName} / ${section.name}`);
    console.log(`│ Tenant            : ${tenant.name} (${tenant.code})`);
    console.log(`│ Branch            : ${branch.name} (${branch.code})`);
    console.log(`│ Academic Year     : ${batch.name} (${batch.code})`);
    if (tempPassword) {
      console.log('├──────────────────────────────────────────────────────────────┤');
      console.log('│ Login                                                        │');
      console.log(`│ Email             : ${STUDENT.email}`);
      console.log(`│ Temporary Password: ${tempPassword}`);
      console.log('│ (mustChangePassword=true — student is forced to reset)       │');
    }
    console.log('└──────────────────────────────────────────────────────────────┘');
  } finally {
    await client.close();
  }
}

seed().catch((err) => {
  console.error('\n❌ Seed failed:', err.message || err);
  process.exit(1);
});

/**
 * Seeds a SECOND student (Kabir Malhotra) alongside Tara. Same tenant,
 * same branch, same class + section — so the section-scoped activity
 * seed-tara-activity created (announcements, events, timetable,
 * assignments, exams) all show up on this student's dashboard too.
 *
 * The per-student piece — attendance — is patched into the existing
 * `student_attendance` batch records: we push a new record for Kabir into
 * each of the docs tagged `seedSource: 'tara-activity'` and bump the
 * summary counts, matching how a second student would look in real life
 * sharing the same class.
 *
 * Usage:
 *   pnpm --filter @campus-verse/api seed:kabir
 */
import { MongoClient, ObjectId, type UpdateFilter, type Document } from 'mongodb';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/campus_verse';
const OWNER_EMAIL = (process.argv[2] || 'orgdev@yopmail.com').toLowerCase();

// Distinct identity — not colliding with anything in the tenant.
const STUDENT = {
  firstName: 'Kabir',
  lastName: 'Malhotra',
  email: 'kabir.malhotra@yopmail.com',
  dateOfBirth: '2010-11-08',
  gender: 'male' as const,
  category: 'general' as const,
  bloodGroup: 'A+',
  nationality: 'Indian',
  religion: 'Hindu',
  aadharNumber: '9876-5432-1098',
  rollNumber: 'SEED-002',
  phone: '+91-9811223344',
  alternatePhone: '+91-9811223345',
  address: {
    line1: '34 Sector 22',
    line2: 'Near City Park',
    city: 'Chandigarh',
    state: 'Chandigarh',
    country: 'India',
    pincode: '160022',
  },
  father: {
    name: 'Ravi Malhotra',
    phone: '+91-9814455667',
    email: 'ravi.malhotra@yopmail.com',
    occupation: 'Civil Engineer',
    qualification: 'B.E.',
  },
  mother: {
    name: 'Meera Malhotra',
    phone: '+91-9814455668',
    email: 'meera.malhotra@yopmail.com',
    occupation: 'Paediatrician',
    qualification: 'MBBS, DCH',
  },
};

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
  const r = await db.collection('counters').findOneAndUpdate(
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
  return r!.sequence as number;
}

const pad = (n: number, len = 4) => String(n).padStart(len, '0');

async function seed() {
  console.log(`🌱 Seeding second student for org owned by "${OWNER_EMAIL}"...`);
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db();
  console.log('📦 Connected to MongoDB');

  try {
    // Locate tenant via owner user.
    const owner = await db.collection('users').findOne({ email: OWNER_EMAIL });
    if (!owner) throw new Error(`Owner user "${OWNER_EMAIL}" not found.`);
    const tenantId = owner.tenantId as ObjectId;
    if (!tenantId) throw new Error(`Owner has no tenantId.`);
    const tenant = await db.collection('tenants').findOne({ _id: tenantId });
    if (!tenant) throw new Error(`Tenant ${tenantId} not found.`);
    console.log(`🏢 Tenant: ${tenant.name} (${tenant.code})`);

    // Anchor to the same class/section that seed-tara-activity populated.
    // We use the tagged attendance record instead of Tara herself because
    // Tara's `currentEnrollment` gets stripped when a student is soft-deleted.
    const anchor = (await db
      .collection('student_attendance')
      .findOne({ tenantId, seedSource: 'tara-activity' })) as {
      branchId: ObjectId;
      classId: ObjectId;
      sectionId: ObjectId;
    } | null;
    if (!anchor) {
      throw new Error(
        'No seed-tara-activity attendance records found — run `pnpm seed:tara-activity` first so I know which class + section to plant Kabir into.'
      );
    }
    const branchId = anchor.branchId;
    const classId = anchor.classId;
    const sectionId = anchor.sectionId;
    const branch = await db.collection('branches').findOne({ _id: branchId });
    if (!branch) throw new Error(`Branch ${branchId} not found.`);
    const klass = await db.collection('classes').findOne({ _id: classId });
    const section = await db.collection('sections').findOne({ _id: sectionId });
    if (!klass || !section)
      throw new Error('Class or section referenced by activity seed is missing.');
    const className = klass.displayName as string;
    const sectionName = section.name as string;
    const academicBatchId =
      ((klass as { academicBatchId?: ObjectId }).academicBatchId as ObjectId | undefined) ??
      ((await db.collection('academic_batches').findOne({ tenantId, isCurrent: true }))?._id as
        | ObjectId
        | undefined);
    if (!academicBatchId) throw new Error('Could not resolve an academic batch for this tenant.');
    const batch = await db.collection('academic_batches').findOne({ _id: academicBatchId });
    console.log(`🏫 Branch: ${branch.name} (${branch.code})`);
    console.log(`📅 Academic batch: ${batch?.name ?? '?'} (${batch?.code ?? '?'})`);
    console.log(`📚 Class / Section: ${className} / ${sectionName}`);

    // Idempotency: skip if this student is already seeded.
    const existing = await db.collection('students').findOne({
      tenantId,
      branchId,
      'contact.email': STUDENT.email.toLowerCase(),
    });
    if (existing) {
      console.log(
        `⚠️  Student ${STUDENT.email} already exists for this branch (admissionNumber=${existing.admissionNumber}). Skipping.`
      );
      return;
    }

    // Generate identifiers using the same counters student.service.ts uses.
    const admissionSeq = await nextSequence(
      db,
      'admissionNumber',
      tenantId,
      branchId,
      academicBatchId
    );
    const admissionNumber = `${branch.code}-${batch?.code}-${pad(admissionSeq)}`;
    const enrollmentSeq = await nextSequence(db, 'enrollmentCode', tenantId);
    const enrollmentCode = `EN${pad(enrollmentSeq, 8)}`;

    const studentId = new ObjectId();
    const now = new Date();

    // Insert student.
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
      parents: { father: STUDENT.father, mother: STUDENT.mother },
      primaryContactType: 'father',
      admissionDate: now,
      admissionType: 'new',
      currentEnrollment: {
        academicBatchId,
        classId,
        sectionId,
        className,
        sectionName,
      },
      status: 'active',
      statusHistory: [
        {
          status: 'active',
          date: now,
          reason: 'Seeded via seed-kabir.ts',
          changedBy: owner._id,
        },
      ],
      createdBy: owner._id,
      createdAt: now,
      updatedAt: now,
    };
    await db.collection('students').insertOne(studentDoc);
    console.log(`👦 Student inserted (admissionNumber=${admissionNumber})`);

    // Enrollment record.
    await db.collection('student_enrollments').insertOne({
      tenantId,
      branchId,
      studentId,
      academicBatchId,
      classId,
      sectionId,
      enrollmentDate: now,
      enrollmentType: 'new',
      status: 'active',
      createdBy: owner._id,
      createdAt: now,
      updatedAt: now,
    });
    console.log(`📝 Enrollment record inserted`);

    // User account (login).
    const studentRole = await db.collection('roles').findOne({ tenantId, code: 'STUDENT' });
    let userId: ObjectId | null = null;
    let tempPassword: string | null = null;
    if (!studentRole) {
      console.log(`⚠️  STUDENT role missing — skipping user creation.`);
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
        accessScope: { type: 'branch', branchIds: [branchId] },
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

    // Inject Kabir into existing seeded attendance batch records so his
    // dashboard shows the same 22-day history. Pattern differs from Tara's
    // (different absent + late days) so it doesn't look like copy-paste.
    const kabirAbsent = new Set([3, 10, 17]);
    const kabirLate = new Set([6, 15]);
    const attendanceDocs = await db
      .collection('student_attendance')
      .find({ tenantId, branchId, sectionId, seedSource: 'tara-activity' })
      .sort({ date: -1 })
      .toArray();
    let attendancePatched = 0;
    for (let i = 0; i < attendanceDocs.length; i++) {
      const doc = attendanceDocs[i] as { _id: ObjectId; records?: unknown[] };
      // If Kabir is somehow already in this record, skip (idempotent).
      const already = (doc.records || []).some(
        (r) => (r as { studentId?: ObjectId }).studentId?.toString() === studentId.toString()
      );
      if (already) continue;
      const status = kabirAbsent.has(i) ? 'absent' : kabirLate.has(i) ? 'late' : 'present';
      const newRecord: Record<string, unknown> = { studentId, status };
      if (status === 'late') {
        newRecord.inTime = '09:05';
        newRecord.remarks = 'Rain delay';
      } else if (status === 'absent') {
        newRecord.remarks = 'Family function';
      }
      // The Mongo driver's typed UpdateFilter is very fussy about $push shape;
      // the local doc is untyped so we cast the update object once.
      const update = {
        $push: { records: newRecord },
        $inc: {
          'summary.total': 1,
          ...(status === 'present' && { 'summary.present': 1 }),
          ...(status === 'absent' && { 'summary.absent': 1 }),
          ...(status === 'late' && { 'summary.late': 1 }),
        },
        $set: { updatedAt: new Date() },
      } as unknown as UpdateFilter<Document>;
      await db.collection('student_attendance').updateOne({ _id: doc._id }, update);
      attendancePatched++;
    }
    console.log(`📊 Attendance: added Kabir to ${attendancePatched} existing batch records`);

    // Report card.
    console.log('\n✅ Seed completed!');
    console.log('┌──────────────────────────────────────────────────────────────┐');
    console.log('│ Second student summary                                       │');
    console.log('├──────────────────────────────────────────────────────────────┤');
    console.log(`│ Name              : ${STUDENT.firstName} ${STUDENT.lastName}`);
    console.log(`│ Admission Number  : ${admissionNumber}`);
    console.log(`│ Enrollment Code   : ${enrollmentCode}`);
    console.log(`│ Class / Section   : ${className} / ${sectionName} (shared with Tara)`);
    console.log(`│ Tenant / Branch   : ${tenant.name} · ${branch.name}`);
    if (tempPassword) {
      console.log('├──────────────────────────────────────────────────────────────┤');
      console.log('│ Login                                                        │');
      console.log(`│ Email             : ${STUDENT.email}`);
      console.log(`│ Temporary Password: ${tempPassword}`);
      console.log('│ (mustChangePassword=true — forced reset on first login)      │');
    }
    console.log('└──────────────────────────────────────────────────────────────┘');
    console.log(
      '\nDashboard will show the same announcements / events / assignments / timetable / exams as Tara, plus his own attendance history.'
    );
  } finally {
    await client.close();
  }
}

seed().catch((err) => {
  console.error('\n❌ Seed failed:', err.message || err);
  process.exit(1);
});

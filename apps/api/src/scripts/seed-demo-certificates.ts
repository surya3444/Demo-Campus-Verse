/**
 * Seeds certificate types + a realistic mix of certificate requests for the
 * SCHDEMO tenant (Greenfield Public School). Idempotent: refuses to run if
 * certificate types already exist for SCHDEMO. Touches only SCHDEMO data.
 *
 * Cleanup is handled by the existing cleanup-demo-school.ts (it already
 * deletes everything scoped to the SCHDEMO tenantId).
 */

import { MongoClient, ObjectId } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const URI = process.env.MONGODB_URI;
if (!URI) {
  console.error('MONGODB_URI not set');
  process.exit(1);
}

const TENANT_CODE = 'SCHDEMO';

// ─── Certificate type definitions ────────────────────────────────────────────

interface SeedType {
  name: string;
  code: string;
  category: 'student' | 'staff';
  description: string;
  sequencePrefix: string;
  requiresApproval: boolean;
  approvalLevels?: number;
  fields: Array<{
    name: string;
    label: string;
    type: 'text' | 'date' | 'number' | 'select';
    required: boolean;
    options?: string[];
  }>;
}

const CERTIFICATE_TYPES: SeedType[] = [
  {
    name: 'Bonafide Certificate',
    code: 'BONAFIDE',
    category: 'student',
    description: 'Confirms the student is enrolled at the school for the current academic session.',
    sequencePrefix: 'GFS-BON-',
    requiresApproval: true,
    approvalLevels: 1,
    fields: [
      { name: 'purpose', label: 'Purpose', type: 'text', required: true },
      { name: 'session', label: 'Academic Session', type: 'text', required: true },
    ],
  },
  {
    name: 'Transfer Certificate',
    code: 'TC',
    category: 'student',
    description:
      'Issued when a student is leaving the school. Required for admission to a new school.',
    sequencePrefix: 'GFS-TC-',
    requiresApproval: true,
    approvalLevels: 2,
    fields: [
      { name: 'lastClass', label: 'Last Class Attended', type: 'text', required: true },
      { name: 'reasonForLeaving', label: 'Reason for Leaving', type: 'text', required: true },
      { name: 'lastDate', label: 'Last Date of Attendance', type: 'date', required: true },
    ],
  },
  {
    name: 'Character Certificate',
    code: 'CHAR',
    category: 'student',
    description:
      'Verifies the conduct and character of the student during their time at the school.',
    sequencePrefix: 'GFS-CHR-',
    requiresApproval: true,
    approvalLevels: 1,
    fields: [
      { name: 'periodFrom', label: 'Period From', type: 'date', required: true },
      { name: 'periodTo', label: 'Period To', type: 'date', required: true },
      {
        name: 'conduct',
        label: 'Conduct',
        type: 'select',
        required: true,
        options: ['Excellent', 'Very Good', 'Good', 'Satisfactory'],
      },
    ],
  },
  {
    name: 'Conduct Certificate',
    code: 'CONDUCT',
    category: 'student',
    description:
      'Short-form conduct verification, typically for short-term programs and visa applications.',
    sequencePrefix: 'GFS-COND-',
    requiresApproval: true,
    approvalLevels: 1,
    fields: [{ name: 'purpose', label: 'Purpose', type: 'text', required: true }],
  },
  {
    name: 'Migration Certificate',
    code: 'MIG',
    category: 'student',
    description:
      'Required when a student is moving to a board or university outside the current state.',
    sequencePrefix: 'GFS-MIG-',
    requiresApproval: true,
    approvalLevels: 2,
    fields: [
      {
        name: 'destinationBoard',
        label: 'Destination Board / University',
        type: 'text',
        required: true,
      },
      { name: 'completedClass', label: 'Class Completed', type: 'text', required: true },
    ],
  },
  {
    name: 'Study Certificate',
    code: 'STUDY',
    category: 'student',
    description:
      'Confirms the year-by-year study record of a student. Often required for scholarships.',
    sequencePrefix: 'GFS-STUDY-',
    requiresApproval: true,
    approvalLevels: 1,
    fields: [
      { name: 'fromYear', label: 'From Academic Year', type: 'text', required: true },
      { name: 'toYear', label: 'To Academic Year', type: 'text', required: true },
      { name: 'purpose', label: 'Purpose', type: 'text', required: true },
    ],
  },
  {
    name: 'Service Certificate',
    code: 'SERVICE',
    category: 'staff',
    description: 'For staff members — confirms employment period, designation, and service record.',
    sequencePrefix: 'GFS-SVC-',
    requiresApproval: true,
    approvalLevels: 1,
    fields: [
      { name: 'designation', label: 'Designation', type: 'text', required: true },
      { name: 'fromDate', label: 'Service From', type: 'date', required: true },
      { name: 'toDate', label: 'Service To', type: 'date', required: true },
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PURPOSES_BONAFIDE = [
  'Bank account opening',
  'Passport application',
  'Scholarship application',
  'Train concession pass',
  'Aadhaar enrolment',
];

const PURPOSES_GENERIC = [
  'Visa application',
  'Higher studies admission',
  'Employment verification',
  'Government scholarship',
  'College admission',
];

const CONDUCT_OPTIONS = ['Excellent', 'Very Good', 'Good'];

const REJECTION_REASONS = [
  'Required documents not attached',
  'Incorrect personal details on file — please update first',
  'Outstanding fees on the student account',
  'Awaiting parent verification',
];

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]!;
const ago = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

// ─── Driver ──────────────────────────────────────────────────────────────────

async function main() {
  const client = new MongoClient(URI!);
  await client.connect();
  const db = client.db();
  console.log('Connected to', db.databaseName);

  const tenant = await db.collection('tenants').findOne({ code: TENANT_CODE });
  if (!tenant) {
    console.error(`\n⛔ Tenant ${TENANT_CODE} not found. Run seed-demo-school.ts first.`);
    process.exit(1);
  }
  const tenantId = tenant._id as ObjectId;

  const branch = await db.collection('branches').findOne({ tenantId, code: 'GFS-MC' });
  if (!branch) {
    console.error('\n⛔ Main Campus branch not found inside SCHDEMO. Aborting.');
    process.exit(1);
  }
  const branchId = branch._id as ObjectId;

  const owner = await db.collection('users').findOne({ tenantId, email: 'owner@greenfield.demo' });
  const principal = await db
    .collection('users')
    .findOne({ tenantId, email: 'principal@greenfield.demo' });
  const ownerId = (owner?._id ?? new ObjectId()) as ObjectId;
  const principalId = (principal?._id ?? ownerId) as ObjectId;

  // Idempotency: bail if certificate types already exist
  const existingTypes = await db.collection('certificate_types').countDocuments({ tenantId });
  if (existingTypes > 0) {
    console.error(
      `\n⛔ ${existingTypes} certificate types already exist for ${TENANT_CODE}. Refusing to seed.`
    );
    console.error('   Run cleanup-demo-school.ts first if you want to reseed.');
    process.exit(1);
  }

  // ─── Insert certificate types ──────────────────────────────────────────────
  console.log('\n📜 Creating certificate types…');
  const typeDocs = CERTIFICATE_TYPES.map((def) => ({
    _id: new ObjectId(),
    tenantId,
    name: def.name,
    code: def.code,
    category: def.category,
    description: def.description,
    template:
      '<p>To Whom It May Concern,</p><p>This is to certify that {{name}} of {{class}} {{section}} is a bonafide student of Greenfield Public School…</p>',
    fields: def.fields,
    requiresApproval: def.requiresApproval,
    approvalLevels: def.approvalLevels,
    sequencePrefix: def.sequencePrefix,
    currentSequence: 0,
    status: 'active' as const,
    createdBy: ownerId,
    createdAt: ago(60),
    updatedAt: ago(60),
  }));
  await db.collection('certificate_types').insertMany(typeDocs);
  for (const t of typeDocs) {
    console.log(`   ✓ ${t.code.padEnd(10, ' ')} ${t.name}`);
  }

  // Map type codes back so we can pick them by code below
  const typesByCode = new Map(typeDocs.map((t) => [t.code, t]));

  // ─── Pick students to issue certificates to ────────────────────────────────
  const students = await db.collection('students').find({ tenantId, branchId }).limit(40).toArray();

  if (students.length === 0) {
    console.error(
      '\n⛔ No students found for the Main Campus branch. Run seed-demo-school.ts first.'
    );
    process.exit(1);
  }

  // ─── Build a realistic distribution of requests ────────────────────────────
  // 40 requests total: a healthy mix of statuses + most-common types weighted higher
  const statusDistribution: Array<{
    status: 'pending' | 'approved' | 'rejected' | 'issued';
    count: number;
  }> = [
    { status: 'issued', count: 18 },
    { status: 'approved', count: 8 },
    { status: 'pending', count: 10 },
    { status: 'rejected', count: 4 },
  ];

  // Type weights (Bonafide is most common, others less)
  const typeWeights: Array<{ code: string; weight: number }> = [
    { code: 'BONAFIDE', weight: 14 },
    { code: 'STUDY', weight: 7 },
    { code: 'CHAR', weight: 6 },
    { code: 'CONDUCT', weight: 5 },
    { code: 'TC', weight: 4 },
    { code: 'MIG', weight: 3 },
    { code: 'SERVICE', weight: 1 }, // staff cert — rare for school student demo
  ];
  const weightedPool: string[] = [];
  for (const w of typeWeights) {
    for (let i = 0; i < w.weight; i++) weightedPool.push(w.code);
  }

  const requestDocs: Array<Record<string, unknown>> = [];
  const sequenceByPrefix: Record<string, number> = {};

  for (const { status, count } of statusDistribution) {
    for (let i = 0; i < count; i++) {
      const typeCode = pick(weightedPool);
      const type = typesByCode.get(typeCode);
      if (!type) continue;

      const student = pick(students);
      const requestedAt = ago(Math.floor(Math.random() * 75) + 2);
      const sequence = (sequenceByPrefix[type.sequencePrefix] ?? 0) + 1;
      sequenceByPrefix[type.sequencePrefix] = sequence;
      const certificateNumber = `${type.sequencePrefix}${String(sequence).padStart(5, '0')}`;

      // Build per-type field values
      const fieldValues: Record<string, unknown> = {};
      switch (type.code) {
        case 'BONAFIDE':
          fieldValues.purpose = pick(PURPOSES_BONAFIDE);
          fieldValues.session = 'AY 2025-26';
          break;
        case 'TC':
          fieldValues.lastClass = student.currentEnrollment?.className ?? 'Grade 5';
          fieldValues.reasonForLeaving = pick([
            'Family relocation',
            'Transfer to boarding school',
            'Parent job change',
          ]);
          fieldValues.lastDate = ago(Math.floor(Math.random() * 30) + 5)
            .toISOString()
            .split('T')[0];
          break;
        case 'CHAR':
          fieldValues.periodFrom = '2024-04-01';
          fieldValues.periodTo = '2026-03-31';
          fieldValues.conduct = pick(CONDUCT_OPTIONS);
          break;
        case 'CONDUCT':
          fieldValues.purpose = pick(PURPOSES_GENERIC);
          break;
        case 'MIG':
          fieldValues.destinationBoard = pick([
            'CBSE — out of state',
            'ICSE — out of state',
            'IB — international',
          ]);
          fieldValues.completedClass = student.currentEnrollment?.className ?? 'Grade 10';
          break;
        case 'STUDY':
          fieldValues.fromYear = '2022-23';
          fieldValues.toYear = '2025-26';
          fieldValues.purpose = pick(PURPOSES_GENERIC);
          break;
      }

      const doc: Record<string, unknown> = {
        _id: new ObjectId(),
        tenantId,
        branchId,
        certificateNumber,
        certificateTypeId: type._id,
        category: 'student',
        requestorId: student._id,
        requestorType: 'student',
        // Snapshot a friendly identifier so reports don't have to join again
        requestorName: student.displayName,
        admissionNumber: student.admissionNumber,
        className: student.currentEnrollment?.className ?? null,
        sectionName: student.currentEnrollment?.sectionName ?? null,
        purpose: typeof fieldValues.purpose === 'string' ? fieldValues.purpose : undefined,
        fieldValues,
        status,
        requestedBy: ownerId,
        createdAt: requestedAt,
        updatedAt: requestedAt,
      };

      // Status-specific fields
      if (status === 'approved' || status === 'issued') {
        const approvedAt = new Date(requestedAt.getTime() + 24 * 60 * 60 * 1000);
        doc.approvals = [
          {
            level: 1,
            approvedBy: principalId,
            approvedAt,
            remarks: 'Verified and approved.',
          },
        ];
        doc.updatedAt = approvedAt;
      }
      if (status === 'issued') {
        const issuedAt = new Date(requestedAt.getTime() + 2 * 24 * 60 * 60 * 1000);
        doc.issuedAt = issuedAt;
        doc.issuedBy = ownerId;
        doc.generatedDocument = {
          url: `https://demo.greenfield.app/certificates/${certificateNumber}.pdf`,
          generatedAt: issuedAt,
        };
        doc.updatedAt = issuedAt;
      }
      if (status === 'rejected') {
        const rejectedAt = new Date(requestedAt.getTime() + 12 * 60 * 60 * 1000);
        doc.rejectionReason = pick(REJECTION_REASONS);
        doc.updatedAt = rejectedAt;
      }

      requestDocs.push(doc);
    }
  }

  console.log(`\n📨 Creating ${requestDocs.length} certificate requests…`);
  await db.collection('certificate_requests').insertMany(requestDocs);

  // Update each type's currentSequence so future requests pick up where we left off
  for (const [prefix, lastSeq] of Object.entries(sequenceByPrefix)) {
    await db
      .collection('certificate_types')
      .updateOne(
        { tenantId, sequencePrefix: prefix },
        { $set: { currentSequence: lastSeq, updatedAt: new Date() } }
      );
  }

  // ─── Summary ───────────────────────────────────────────────────────────────
  const counts: Record<string, number> = {};
  for (const r of requestDocs) {
    const s = r.status as string;
    counts[s] = (counts[s] || 0) + 1;
  }

  console.log(`\n✅ Done.
Seeded:
  ${typeDocs.length} certificate types
  ${requestDocs.length} requests
    pending:  ${counts.pending ?? 0}
    approved: ${counts.approved ?? 0}
    issued:   ${counts.issued ?? 0}
    rejected: ${counts.rejected ?? 0}

🧹 To remove these along with the rest of SCHDEMO:
  pnpm --filter @campus-verse/api exec tsx src/scripts/cleanup-demo-school.ts ${tenantId}
`);

  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

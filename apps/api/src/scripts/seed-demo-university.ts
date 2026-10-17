/**
 * Seed a complete DEMO UNIVERSITY tenant exercising the course-registration
 * module end to end:
 *
 *   - Tenant "Nexus Institute of Technology" (university) + Main Campus branch
 *   - AY 2026-27 batch with Odd (registration OPEN) + Even (upcoming) terms
 *   - CS / ME / EE departments × Years 1-4, one section each
 *   - Subject catalogue with credits + CBCS categories
 *   - Published schemes: CS & ME semesters 1 and 3 (elective baskets with
 *     seat caps — one CS elective deliberately near-full)
 *   - ~60 students; a few with logins; some pre-registered; three with
 *     OVERDUE fees (to demo the fee-clearance block)
 *
 * Usage:
 *   pnpm --filter @campus-verse/api exec tsx src/scripts/seed-demo-university.ts
 *
 * Idempotence: refuses to run if the tenant code already exists.
 * All demo logins use password: Demo@1234
 */

import { MongoClient, Db, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import * as path from 'path';
import {
  PERMISSIONS,
  ORG_ADMIN_PERMISSIONS,
  BRANCH_ADMIN_PERMISSIONS,
  STUDENT_PERMISSIONS,
  SYSTEM_ROLES,
  ROLE_HIERARCHY,
} from '@campus-verse/shared/constants';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const URI = process.env.MONGODB_URI;
const TENANT_CODE = 'NEXUNI-DEMO';
const PASSWORD = 'Demo@1234';

const DAY = 24 * 60 * 60 * 1000;

// ─── Catalogue data ─────────────────────────────────────────────────────────

const DEPARTMENTS = [
  { code: 'CS', name: 'Computer Science' },
  { code: 'ME', name: 'Mechanical Engineering' },
  { code: 'EE', name: 'Electrical Engineering' },
] as const;

interface SubjectSeed {
  code: string;
  name: string;
  credits: number;
  category: 'DSC' | 'DSE' | 'GE' | 'AECC' | 'SEC' | 'VAC';
}

// dept → semester → { cores, electives }
const CURRICULUM: Record<
  string,
  Record<number, { cores: SubjectSeed[]; electives: SubjectSeed[] }>
> = {
  CS: {
    1: {
      cores: [
        { code: 'CS101', name: 'Programming Fundamentals', credits: 4, category: 'DSC' },
        { code: 'MA101', name: 'Engineering Mathematics I', credits: 4, category: 'DSC' },
        { code: 'PH101', name: 'Engineering Physics', credits: 3, category: 'DSC' },
        { code: 'EN101', name: 'Communicative English', credits: 2, category: 'AECC' },
      ],
      electives: [
        { code: 'SE101', name: 'Web Design Basics', credits: 3, category: 'SEC' },
        { code: 'SE102', name: 'Python for Everyone', credits: 3, category: 'SEC' },
        { code: 'SE103', name: 'Digital Literacy Lab', credits: 3, category: 'SEC' },
      ],
    },
    3: {
      cores: [
        { code: 'CS301', name: 'Data Structures & Algorithms', credits: 4, category: 'DSC' },
        { code: 'CS302', name: 'Operating Systems', credits: 4, category: 'DSC' },
        { code: 'CS303', name: 'Database Management Systems', credits: 4, category: 'DSC' },
        { code: 'MA301', name: 'Discrete Mathematics', credits: 3, category: 'DSC' },
      ],
      electives: [
        { code: 'CS351', name: 'Artificial Intelligence Basics', credits: 3, category: 'DSE' },
        { code: 'CS352', name: 'Computer Graphics', credits: 3, category: 'DSE' },
        { code: 'CS353', name: 'Cyber Security Fundamentals', credits: 3, category: 'DSE' },
      ],
    },
  },
  ME: {
    1: {
      cores: [
        { code: 'ME101', name: 'Engineering Mechanics', credits: 4, category: 'DSC' },
        { code: 'MA102', name: 'Engineering Mathematics I (ME)', credits: 4, category: 'DSC' },
        { code: 'CH101', name: 'Engineering Chemistry', credits: 3, category: 'DSC' },
        { code: 'EN102', name: 'Professional English', credits: 2, category: 'AECC' },
      ],
      electives: [
        { code: 'ME151', name: 'Workshop Practice', credits: 3, category: 'SEC' },
        { code: 'ME152', name: 'CAD Fundamentals', credits: 3, category: 'SEC' },
      ],
    },
    3: {
      cores: [
        { code: 'ME301', name: 'Thermodynamics', credits: 4, category: 'DSC' },
        { code: 'ME302', name: 'Fluid Mechanics', credits: 4, category: 'DSC' },
        { code: 'ME303', name: 'Strength of Materials', credits: 4, category: 'DSC' },
        { code: 'MA302', name: 'Numerical Methods', credits: 3, category: 'DSC' },
      ],
      electives: [
        { code: 'ME351', name: 'Automotive Engineering', credits: 3, category: 'DSE' },
        { code: 'ME352', name: 'Renewable Energy Systems', credits: 3, category: 'DSE' },
        { code: 'ME353', name: 'Robotics & Automation', credits: 3, category: 'DSE' },
      ],
    },
  },
};

const FIRST_NAMES = [
  'Aarav',
  'Vivaan',
  'Aditya',
  'Arjun',
  'Sai',
  'Reyansh',
  'Krishna',
  'Ishaan',
  'Ananya',
  'Diya',
  'Aadhya',
  'Saanvi',
  'Myra',
  'Aarohi',
  'Anika',
  'Navya',
  'Rohan',
  'Kabir',
  'Dev',
  'Advik',
  'Kiara',
  'Riya',
  'Pari',
  'Ahana',
];
const LAST_NAMES = [
  'Sharma',
  'Verma',
  'Reddy',
  'Nair',
  'Iyer',
  'Menon',
  'Patel',
  'Singh',
  'Das',
  'Bose',
  'Kulkarni',
  'Joshi',
  'Rao',
  'Gupta',
  'Mehta',
  'Pillai',
];

function nameFor(i: number) {
  return {
    firstName: FIRST_NAMES[i % FIRST_NAMES.length],
    lastName: LAST_NAMES[Math.floor(i / FIRST_NAMES.length + i) % LAST_NAMES.length],
  };
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  if (!URI) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db();
  console.log('Connected to', db.databaseName);

  const existing = await db.collection('tenants').findOne({ code: TENANT_CODE });
  if (existing) {
    console.error(`\n⛔ Tenant "${TENANT_CODE}" already exists (id: ${existing._id}).`);
    printCleanup(existing._id as ObjectId);
    await client.close();
    process.exit(1);
  }

  const tenantId = new ObjectId();
  console.log(`\n🌱 Seeding demo university: ${TENANT_CODE} (${tenantId})`);

  try {
    await seed(db, tenantId);
    console.log('\n✅ Demo university seeded!\n');
    printCredentials();
    printCleanup(tenantId);
  } catch (err) {
    console.error('\n❌ Seed failed mid-way. Rolling back tenant data...');
    await rollback(db, tenantId);
    throw err;
  } finally {
    await client.close();
  }
}

async function seed(db: Db, tenantId: ObjectId) {
  const now = new Date();
  const branchId = new ObjectId();

  // ── Tenant + branch ──────────────────────────────────────────────────────
  await db.collection('tenants').insertOne({
    _id: tenantId,
    tenantId: tenantId.toString(),
    name: 'Nexus Institute of Technology',
    code: TENANT_CODE,
    institutionTypes: ['university'],
    contact: {
      email: 'registrar.nexuni@yopmail.com',
      phone: '+919876540000',
      address: {
        line1: '1 University Road',
        city: 'Hyderabad',
        state: 'Telangana',
        country: 'India',
        pincode: '500032',
      },
    },
    branding: { primaryColor: '#7C3AED', secondaryColor: '#A78BFA' },
    subscription: {
      plan: 'enterprise',
      maxBranches: 3,
      maxStudents: 10000,
      maxStaff: 500,
      features: [
        'core',
        'students',
        'admissions',
        'finance',
        'attendance',
        'teaching',
        'exams',
        'registration',
        'obe',
        'careerConnect',
        'hostel',
        'communications',
        // Department registry + staff live here; a university needs both.
        'hr',
      ],
      validUntil: new Date(now.getTime() + 365 * DAY),
    },
    settings: {
      timezone: 'Asia/Kolkata',
      dateFormat: 'DD/MM/YYYY',
      currency: 'INR',
      fiscalYearStart: '04-01',
    },
    onboardingCompleted: true,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });

  await db.collection('branches').insertOne({
    _id: branchId,
    tenantId,
    branchId: branchId.toString(),
    name: 'Main Campus',
    code: 'MAIN',
    institutionType: 'university',
    location: {
      state: 'Telangana',
      city: 'Hyderabad',
      address: {
        line1: '1 University Road',
        city: 'Hyderabad',
        state: 'Telangana',
        country: 'India',
        pincode: '500032',
      },
    },
    contact: { email: 'main.nexuni@yopmail.com', phone: '+919876540001' },
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });

  // ── Roles + users ────────────────────────────────────────────────────────
  const roleDocs = [
    {
      _id: new ObjectId(),
      tenantId,
      name: 'Group Owner',
      code: SYSTEM_ROLES.GROUP_OWNER,
      isSystemRole: true,
      level: ROLE_HIERARCHY[SYSTEM_ROLES.GROUP_OWNER],
      permissions: PERMISSIONS,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: new ObjectId(),
      tenantId,
      name: 'Org Admin',
      code: SYSTEM_ROLES.ORG_ADMIN,
      isSystemRole: true,
      level: ROLE_HIERARCHY[SYSTEM_ROLES.ORG_ADMIN],
      permissions: ORG_ADMIN_PERMISSIONS,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: new ObjectId(),
      tenantId,
      name: 'Branch Admin',
      code: SYSTEM_ROLES.BRANCH_ADMIN,
      isSystemRole: true,
      level: ROLE_HIERARCHY[SYSTEM_ROLES.BRANCH_ADMIN],
      permissions: BRANCH_ADMIN_PERMISSIONS,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: new ObjectId(),
      tenantId,
      name: 'Student',
      code: 'STUDENT',
      isSystemRole: true,
      level: 100,
      permissions: STUDENT_PERMISSIONS,
      createdAt: now,
      updatedAt: now,
    },
  ];
  await db.collection('roles').insertMany(roleDocs);
  const roleIds = Object.fromEntries(roleDocs.map((r) => [r.code, r._id]));

  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const ownerId = new ObjectId();
  const registrarId = new ObjectId();
  await db.collection('users').insertMany([
    {
      _id: ownerId,
      tenantId,
      email: 'owner@yopmail.com',
      passwordHash,
      phone: '+919876540002',
      profile: { firstName: 'Meera', lastName: 'Krishnan', displayName: 'Meera Krishnan' },
      roleId: roleIds[SYSTEM_ROLES.GROUP_OWNER],
      accessScope: { type: 'global', branchIds: [] },
      status: 'active',
      failedLoginAttempts: 0,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: registrarId,
      tenantId,
      email: 'registrar@yopmail.com',
      passwordHash,
      phone: '+919876540003',
      profile: { firstName: 'Suresh', lastName: 'Pillai', displayName: 'Suresh Pillai' },
      roleId: roleIds[SYSTEM_ROLES.BRANCH_ADMIN],
      accessScope: { type: 'branch', branchIds: [branchId] },
      status: 'active',
      failedLoginAttempts: 0,
      createdAt: now,
      updatedAt: now,
    },
  ]);

  // ── Academic batch with terms ────────────────────────────────────────────
  const batchId = new ObjectId();
  const oddTermId = new ObjectId();
  const evenTermId = new ObjectId();
  await db.collection('academic_batches').insertOne({
    _id: batchId,
    tenantId,
    branchId,
    name: 'AY 2026-27',
    code: 'AY2627',
    startDate: new Date('2026-07-01'),
    endDate: new Date('2027-06-30'),
    isCurrent: true,
    terms: [
      {
        _id: oddTermId,
        name: 'Odd Semester 2026',
        half: 'odd',
        startDate: new Date('2026-07-15'),
        endDate: new Date('2026-12-15'),
        // Open now: opened yesterday, closes in 14 days.
        registrationWindow: {
          opensAt: new Date(now.getTime() - 1 * DAY),
          closesAt: new Date(now.getTime() + 14 * DAY),
        },
        addDropDeadline: new Date(now.getTime() + 21 * DAY),
      },
      {
        _id: evenTermId,
        name: 'Even Semester 2027',
        half: 'even',
        startDate: new Date('2027-01-05'),
        endDate: new Date('2027-05-30'),
        registrationWindow: {
          opensAt: new Date('2026-12-20'),
          closesAt: new Date('2027-01-10'),
        },
      },
    ],
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });

  // ── Classes (dept × year) + sections ─────────────────────────────────────
  interface ClassSeed {
    classId: ObjectId;
    sectionId: ObjectId;
    dept: (typeof DEPARTMENTS)[number];
    year: number;
  }
  const classSeeds: ClassSeed[] = [];
  const classDocs = [];
  const sectionDocs = [];
  for (const dept of DEPARTMENTS) {
    for (let year = 1; year <= 4; year++) {
      const classId = new ObjectId();
      const sectionId = new ObjectId();
      classSeeds.push({ classId, sectionId, dept, year });
      classDocs.push({
        _id: classId,
        tenantId,
        branchId,
        academicBatchId: batchId,
        path: [
          { levelKey: 'department', name: dept.name, code: dept.code, order: 1 },
          { levelKey: 'year', name: `Year ${year}`, code: `Y${year}`, order: year },
        ],
        displayName: `${dept.name} · Year ${year}`,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });
      sectionDocs.push({
        _id: sectionId,
        tenantId,
        branchId,
        classId,
        name: 'A',
        code: 'A',
        capacity: 60,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  await db.collection('classes').insertMany(classDocs);
  await db.collection('sections').insertMany(sectionDocs);

  // ── HR department registry ───────────────────────────────────────────────
  // Mirror the academic departments (class path[0]) into the HR registry, the
  // same way onboarding completion does. Staff assignment, HOD, the department
  // overview counts and the subject catalogue's owner-department all read from
  // here — the seed sets onboardingCompleted directly, so that hook never runs.
  await db.collection('departments').insertMany(
    DEPARTMENTS.map((d) => ({
      _id: new ObjectId(),
      tenantId,
      branchId,
      name: d.name,
      code: d.code,
      type: 'academic' as const,
      status: 'active' as const,
      createdBy: registrarId,
      createdAt: now,
      updatedAt: now,
    }))
  );

  // ── Subjects ─────────────────────────────────────────────────────────────
  const subjectIdByCode = new Map<string, ObjectId>();
  const subjectDocs = [];
  for (const dept of Object.keys(CURRICULUM)) {
    for (const sem of Object.keys(CURRICULUM[dept]).map(Number)) {
      const { cores, electives } = CURRICULUM[dept][sem];
      for (const s of [...cores, ...electives]) {
        if (subjectIdByCode.has(s.code)) continue;
        const id = new ObjectId();
        subjectIdByCode.set(s.code, id);
        subjectDocs.push({
          _id: id,
          tenantId,
          branchId,
          name: s.name,
          code: s.code,
          shortName: s.code,
          type: 'both',
          category: s.category,
          credits: s.credits,
          status: 'active',
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  }
  await db.collection('subjects').insertMany(subjectDocs);

  // ── Program schemes (published) ──────────────────────────────────────────
  // The CS Sem-3 AI elective is deliberately capped low so the "seats left"
  // countdown shows on stage; everything else gets a comfortable cap.
  const schemeIdByKey = new Map<string, ObjectId>();
  const basketSlotIdByScheme = new Map<string, string>();
  const schemeDocs = [];
  for (const dept of Object.keys(CURRICULUM)) {
    for (const sem of Object.keys(CURRICULUM[dept]).map(Number)) {
      const { cores, electives } = CURRICULUM[dept][sem];
      const schemeId = new ObjectId();
      const basketSlotId = new ObjectId().toHexString();
      schemeIdByKey.set(`${dept}:${sem}`, schemeId);
      basketSlotIdByScheme.set(`${dept}:${sem}`, basketSlotId);
      schemeDocs.push({
        _id: schemeId,
        tenantId,
        branchId,
        departmentCode: dept,
        departmentName: DEPARTMENTS.find((d) => d.code === dept)!.name,
        semesterNumber: sem,
        slots: [
          ...cores.map((s) => ({
            slotId: new ObjectId().toHexString(),
            kind: 'core' as const,
            category: s.category,
            subjectId: subjectIdByCode.get(s.code)!,
            credits: s.credits,
          })),
          {
            slotId: basketSlotId,
            kind: 'basket' as const,
            label: sem === 1 ? 'Skill Elective' : 'Professional Elective I',
            category: electives[0]?.category,
            chooseCount: 1,
            options: electives.map((s) => ({
              subjectId: subjectIdByCode.get(s.code)!,
              credits: s.credits,
              seatCap: dept === 'CS' && sem === 3 && s.code === 'CS351' ? 10 : 40,
              seatsTaken: 0,
            })),
          },
        ],
        minCredits: 12,
        maxCredits: 24,
        status: 'published',
        publishedAt: now,
        createdBy: registrarId,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  await db.collection('program_schemes').insertMany(schemeDocs);

  // Attach scheme subjects to the matching sections (mirrors the publish-time
  // sync in scheme.service) so gradebook, timetable, and marks entry see them.
  for (const cls of classSeeds) {
    const sems = [2 * cls.year - 1, 2 * cls.year];
    const sectionSubjects = sems.flatMap((sem) => {
      const cur = CURRICULUM[cls.dept.code]?.[sem];
      return cur
        ? [...cur.cores, ...cur.electives].map((s) => ({
            subjectId: subjectIdByCode.get(s.code)!,
            periodsPerWeek: 0,
            semesterNumber: sem,
          }))
        : [];
    });
    if (sectionSubjects.length > 0) {
      await db
        .collection('sections')
        .updateOne({ _id: cls.sectionId }, { $set: { subjects: sectionSubjects } });
    }
  }

  // ── Students ─────────────────────────────────────────────────────────────
  // 10 per class for Years 1-2 of every department (registerable cohorts).
  interface StudentSeed {
    studentId: ObjectId;
    cls: ClassSeed;
    displayName: string;
    email: string;
  }
  const studentSeeds: StudentSeed[] = [];
  const studentDocs = [];
  let counter = 1;
  for (const cls of classSeeds.filter((c) => c.year <= 2)) {
    for (let i = 0; i < 10; i++) {
      const { firstName, lastName } = nameFor(counter);
      const studentId = new ObjectId();
      const email = `student${counter}@yopmail.com`;
      studentSeeds.push({
        studentId,
        cls,
        displayName: `${firstName} ${lastName}`,
        email,
      });
      studentDocs.push({
        _id: studentId,
        tenantId,
        branchId,
        admissionNumber: `NIT-2026-${String(counter).padStart(4, '0')}`,
        rollNumber: `${cls.dept.code}${cls.year}${String(i + 1).padStart(2, '0')}`,
        firstName,
        lastName,
        displayName: `${firstName} ${lastName}`,
        dateOfBirth: new Date(2007 - cls.year, counter % 12, 10),
        gender: counter % 2 === 0 ? 'female' : 'male',
        nationality: 'Indian',
        contact: { email },
        currentEnrollment: {
          academicBatchId: batchId,
          classId: cls.classId,
          sectionId: cls.sectionId,
          className: `${cls.dept.name} · Year ${cls.year}`,
          enrolledAt: now,
        },
        admissionDate: now,
        admissionType: 'new',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });
      counter++;
    }
  }
  await db.collection('students').insertMany(studentDocs);

  // Logins for two showcase students (both CS Year 2 → Semester 3):
  //   asha@yopmail.com   — fees clear, ready to register
  //   rahul@yopmail.com  — OVERDUE fees, blocked at submit
  const csY2 = studentSeeds.filter((s) => s.cls.dept.code === 'CS' && s.cls.year === 2);
  const cleanStudent = csY2[0];
  const blockedStudent = csY2[1];
  const showcase = [
    { seed: cleanStudent, email: 'asha@yopmail.com', name: ['Asha', 'Rao'] },
    { seed: blockedStudent, email: 'rahul@yopmail.com', name: ['Rahul', 'Nair'] },
  ];
  const studentUserDocs = showcase.map(({ seed, email, name }) => {
    const userId = new ObjectId();
    return {
      user: {
        _id: userId,
        tenantId,
        email,
        passwordHash,
        profile: { firstName: name[0], lastName: name[1], displayName: name.join(' ') },
        roleId: roleIds.STUDENT,
        accessScope: { type: 'branch' as const, branchIds: [branchId] },
        status: 'active',
        failedLoginAttempts: 0,
        createdAt: now,
        updatedAt: now,
      },
      studentId: seed.studentId,
      displayName: name.join(' '),
    };
  });
  await db.collection('users').insertMany(studentUserDocs.map((d) => d.user));
  for (const d of studentUserDocs) {
    await db.collection('students').updateOne(
      { _id: d.studentId },
      {
        $set: {
          userId: d.user._id,
          firstName: d.user.profile.firstName,
          lastName: d.user.profile.lastName,
          displayName: d.displayName,
          'contact.email': d.user.email,
        },
      }
    );
  }

  // ── Fees: one semester-fee structure, assignments for everyone ───────────
  // Most students: installment PAID (balance 0). Three students (including
  // rahul@): OVERDUE balance so the fee gate demo works.
  const structureId = new ObjectId();
  await db.collection('fee_structures').insertOne({
    _id: structureId,
    tenantId,
    branchId,
    name: 'Semester Fee 2026-27',
    code: 'SEMFEE-2627',
    applicableTo: { classIds: [], sectionIds: [], gradeCodes: [] },
    components: [
      {
        name: 'Tuition',
        code: 'TUITION',
        type: 'mandatory',
        amount: 60000,
        frequency: 'term-wise',
        taxable: false,
        refundable: false,
      },
    ],
    installments: [],
    fineRules: { type: 'fixed', amount: 0, gracePeriodDays: 0 },
    concessionRules: { requireApproval: true, maxPercentage: 100, allowedTypes: [] },
    category: 'tuition',
    totalAmount: 60000,
    mandatoryTotal: 60000,
    isActive: true,
    createdBy: ownerId,
    createdAt: now,
    updatedAt: now,
  });

  const overdueIds = new Set<string>([
    blockedStudent.studentId.toString(),
    studentSeeds[3].studentId.toString(),
    studentSeeds[17].studentId.toString(),
  ]);
  const assignmentDocs = studentSeeds.map((s) => {
    const overdue = overdueIds.has(s.studentId.toString());
    return {
      _id: new ObjectId(),
      tenantId,
      branchId,
      studentId: s.studentId,
      academicBatchId: batchId,
      feeStructureId: structureId,
      type: 'tuition',
      components: [],
      installments: [
        {
          installmentNumber: 1,
          name: 'Odd Semester Fee',
          dueDate: new Date(now.getTime() - 10 * DAY),
          amount: 60000,
          fineAmount: 0,
          totalDue: 60000,
          paidAmount: overdue ? 0 : 60000,
          balance: overdue ? 60000 : 0,
          status: overdue ? 'overdue' : 'paid',
        },
      ],
      summary: {
        totalFee: 60000,
        totalDiscount: 0,
        totalTax: 0,
        netPayable: 60000,
        totalPaid: overdue ? 0 : 60000,
        totalFine: 0,
        balance: overdue ? 60000 : 0,
      },
      concessions: [],
      status: 'active',
      createdBy: ownerId,
      createdAt: now,
      updatedAt: now,
    };
  });
  await db.collection('fee_assignments').insertMany(assignmentDocs);

  // ── Pre-registrations: 8 CS Year-2 students (fills the AI elective) ──────
  const csScheme = schemeDocs.find((s) => s.departmentCode === 'CS' && s.semesterNumber === 3)!;
  const csBasketSlotId = basketSlotIdByScheme.get('CS:3')!;
  const csCores = csScheme.slots.filter((s) => s.kind === 'core');
  const ai = subjectIdByCode.get('CS351')!;
  const graphics = subjectIdByCode.get('CS352')!;

  // Skip the two showcase students so they can register live on stage.
  const preRegistrants = csY2
    .filter(
      (s) =>
        s.studentId.toString() !== cleanStudent.studentId.toString() &&
        s.studentId.toString() !== blockedStudent.studentId.toString()
    )
    .slice(0, 8);

  let aiTaken = 0;
  let graphicsTaken = 0;
  const registrationDocs = preRegistrants.map((s, i) => {
    // First 6 grab the capped AI elective (cap 10 → "4 seats left" on stage).
    const electiveId = i < 6 ? ai : graphics;
    if (i < 6) aiTaken++;
    else graphicsTaken++;
    const entries = [
      ...csCores.map((slot) => ({
        slotId: slot.slotId,
        kind: 'core' as const,
        category: slot.category,
        subjectId: slot.subjectId!,
        credits: slot.credits!,
      })),
      {
        slotId: csBasketSlotId,
        kind: 'basket' as const,
        category: 'DSE',
        subjectId: electiveId,
        credits: 3,
      },
    ];
    return {
      _id: new ObjectId(),
      tenantId,
      branchId,
      studentId: s.studentId,
      academicBatchId: batchId,
      termId: oddTermId,
      schemeId: csScheme._id,
      departmentCode: 'CS',
      semesterNumber: 3,
      entries,
      totalCredits: entries.reduce((sum, e) => sum + e.credits, 0),
      status: 'submitted',
      submittedAt: new Date(now.getTime() - (8 - i) * 60 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
    };
  });
  await db.collection('course_registrations').insertMany(registrationDocs);

  // Keep the scheme's seat counters consistent with the pre-registrations.
  const csBasket = csScheme.slots.find(
    (s): s is Extract<(typeof csScheme.slots)[number], { kind: 'basket' }> =>
      s.kind === 'basket' && s.slotId === csBasketSlotId
  )!;
  await db.collection('program_schemes').updateOne(
    { _id: csScheme._id, 'slots.slotId': csBasketSlotId },
    {
      $set: {
        'slots.$.options': csBasket.options.map((o) => ({
          ...o,
          seatsTaken:
            o.subjectId.toString() === ai.toString()
              ? aiTaken
              : o.subjectId.toString() === graphics.toString()
                ? graphicsTaken
                : 0,
        })),
      },
    }
  );

  console.log(
    `  tenant=1 branch=1 users=${2 + studentUserDocs.length} classes=${classDocs.length} ` +
      `sections=${sectionDocs.length} subjects=${subjectDocs.length} schemes=${schemeDocs.length} ` +
      `students=${studentDocs.length} registrations=${registrationDocs.length}`
  );
}

// ─── Rollback / helpers ─────────────────────────────────────────────────────

const TENANT_COLLECTIONS = [
  'tenants',
  'branches',
  'roles',
  'users',
  'academic_batches',
  'classes',
  'sections',
  'subjects',
  'departments',
  'students',
  'program_schemes',
  'course_registrations',
  'fee_structures',
  'fee_assignments',
];

async function rollback(db: Db, tenantId: ObjectId) {
  for (const name of TENANT_COLLECTIONS) {
    if (name === 'tenants') {
      await db.collection(name).deleteOne({ _id: tenantId });
    } else {
      await db.collection(name).deleteMany({ tenantId });
    }
  }
  console.log('Rolled back all demo-university data.');
}

function printCredentials() {
  console.log('  Logins (password: Demo@1234)');
  console.log('    owner@yopmail.com      — Group Owner');
  console.log('    registrar@yopmail.com  — Branch Admin / registrar');
  console.log('    asha@yopmail.com       — CS Year 2 student (fees clear — can register)');
  console.log('    rahul@yopmail.com      — CS Year 2 student (OVERDUE fees — blocked)');
  console.log('');
  console.log('  Demo beats:');
  console.log(
    '    1. registrar → Course Registration → Curriculum tab (CS/ME sem 1 & 3 published)'
  );
  console.log(
    '    2. asha → Course Registration: AI elective shows "4 seats left" (cap 10, 6 taken)'
  );
  console.log('    3. rahul → blocked with overdue-fee card and a "View my fees" link');
  console.log('    4. registrar → Registrations tab: fill bars, registered/pending lists, CSV');
}

function printCleanup(tenantId: ObjectId) {
  console.log(`\n  To remove this tenant's data:`);
  console.log(
    `  pnpm --filter @campus-verse/api exec tsx -e "import('mongodb').then(async ({MongoClient, ObjectId}) => { const c = new MongoClient(process.env.MONGODB_URI!); await c.connect(); const db = c.db(); const tid = new ObjectId('${tenantId}'); for (const n of ${JSON.stringify(TENANT_COLLECTIONS)}) { if (n==='tenants') await db.collection(n).deleteOne({_id: tid}); else await db.collection(n).deleteMany({tenantId: tid}); } console.log('done'); await c.close(); })"`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

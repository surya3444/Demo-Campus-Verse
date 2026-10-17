/**
 * Seed a DEMO UNIVERSITY that exercises the full academic hierarchy, top to
 * bottom, exactly as the architecture describes it:
 *
 *   University (tenant)
 *     └─ Branch / campus            ×3 (Hyderabad populated, Bengaluru + Pune bare)
 *         └─ Institution            Engineering, Design (+ the campus default)
 *             └─ Department         CSE, Mechanical → Engineering; Architecture → Design
 *                 └─ Program        UG + PG, each with its own durationYears
 *                     └─ Year       one Class per program-year, FK'd to both
 *                         └─ Section
 *                             └─ Lab batch
 *
 * The Hyderabad campus overrides `academicHierarchy` to department → program →
 * year → section, so Program is a real level on the class path as well as a FK.
 * Bengaluru keeps the stock university hierarchy — both shapes coexist in one
 * tenant, which is the point of the config being per-branch.
 *
 * Also seeded: AY 2026-27 with odd/even terms, staff with HODs, students
 * enrolled down to lab batches, and five logins covering global, campus,
 * institution, program and student scope.
 *
 * Usage:
 *   pnpm --filter @campus-verse/api exec tsx src/scripts/seed-demo-hierarchy.ts
 *
 *   # against local Mongo instead of whatever .env points at:
 *   MONGODB_URI=mongodb://localhost:27017/campusverse pnpm --filter @campus-verse/api \
 *     exec tsx src/scripts/seed-demo-hierarchy.ts
 *
 * Idempotence: refuses to run if the tenant code already exists.
 * All demo logins use password: Demo@1234
 */

import { summarizeTermPattern, totalTermsFor } from '@campus-verse/shared';
import { MongoClient, Db, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import * as path from 'path';
import {
  PERMISSIONS,
  BRANCH_ADMIN_PERMISSIONS,
  TEACHER_PERMISSIONS,
  STUDENT_PERMISSIONS,
  SYSTEM_ROLES,
  ROLE_HIERARCHY,
} from '@campus-verse/shared/constants';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const URI = process.env.MONGODB_URI;
const TENANT_CODE = 'VERSEUNI-DEMO';
const PASSWORD = 'Demo@1234';
const DAY = 24 * 60 * 60 * 1000;

/**
 * Every demo address is a yopmail.com inbox so anyone can open it. The trailing
 * "1" is not decoration: one email may exist in several tenants and login picks
 * the record whose password verifies — with every demo tenant sharing one
 * password, an unnumbered owner@ would be ambiguous against the older
 * NEXUNI-DEMO seed. Number 1 = this tenant.
 */
const EMAILS = {
  owner: 'owner1@yopmail.com',
  registrar: 'registrar1@yopmail.com',
  dean: 'dean1@yopmail.com',
  coordinator: 'coordinator1@yopmail.com',
  teacher: 'teacher1@yopmail.com',
  /** Also student #1's contact address — the showcase login is that student. */
  student: 'student1@yopmail.com',
} as const;

// ─── The tree, as data ──────────────────────────────────────────────────────

/** Institutions on the Hyderabad campus, besides its default. */
const INSTITUTIONS = [
  { key: 'ENGG', name: 'Institute of Engineering', code: 'ENGG', kind: 'engineering' },
  { key: 'DESIGN', name: 'Institute of Design', code: 'DESIGN', kind: 'design' },
] as const;

type InstitutionKey = (typeof INSTITUTIONS)[number]['key'] | 'DEFAULT';

const DEPARTMENTS: Array<{
  key: string;
  name: string;
  code: string;
  institution: InstitutionKey;
  type: 'academic' | 'administrative';
}> = [
  {
    key: 'CSE',
    name: 'Computer Science & Engineering',
    code: 'CSE',
    institution: 'ENGG',
    type: 'academic',
  },
  {
    key: 'MECH',
    name: 'Mechanical Engineering',
    code: 'MECH',
    institution: 'ENGG',
    type: 'academic',
  },
  { key: 'ARCH', name: 'Architecture', code: 'ARCH', institution: 'DESIGN', type: 'academic' },
  // Sits under the campus default — proof that the default institution is a
  // real home, not a placeholder.
  {
    key: 'ADMIN',
    name: 'Registry & Administration',
    code: 'ADMIN',
    institution: 'DEFAULT',
    type: 'administrative',
  },
];

const PROGRAMS: Array<{
  key: string;
  department: string;
  name: string;
  code: string;
  degreeType: 'ug' | 'pg';
  durationYears: number;
  totalSemesters: number;
  /** Per-year term pattern; absent = semesters every year. */
  yearPatterns?: Array<'annual' | 'semester' | 'trimester'>;
  specialization?: string;
  /** Sections to create per year; index 0 is Year 1. Missing → one section. */
  sectionsPerYear?: number;
}> = [
  {
    key: 'BTCSEIOT',
    department: 'CSE',
    name: 'B.Tech CSE (Internet of Things)',
    code: 'BTCSEIOT',
    degreeType: 'ug',
    durationYears: 4,
    totalSemesters: 8,
    specialization: 'Internet of Things',
    sectionsPerYear: 2,
  },
  {
    key: 'BTCSEAI',
    department: 'CSE',
    name: 'B.Tech CSE (AI & Machine Learning)',
    code: 'BTCSEAI',
    degreeType: 'ug',
    durationYears: 4,
    totalSemesters: 8,
    specialization: 'Artificial Intelligence & ML',
  },
  {
    key: 'MTCSE',
    department: 'CSE',
    name: 'M.Tech Computer Science',
    code: 'MTCSE',
    degreeType: 'pg',
    durationYears: 2,
    totalSemesters: 4,
  },
  {
    key: 'BTME',
    department: 'MECH',
    name: 'B.Tech Mechanical Engineering',
    code: 'BTME',
    degreeType: 'ug',
    durationYears: 4,
    // Annual first year, then semesters — 1 + 2 + 2 + 2 = 7 terms.
    yearPatterns: ['annual', 'semester', 'semester', 'semester'],
    totalSemesters: 7,
  },
  {
    key: 'BARCH',
    department: 'ARCH',
    name: 'B.Arch',
    code: 'BARCH',
    degreeType: 'ug',
    durationYears: 5,
    totalSemesters: 10,
  },
  {
    key: 'MARCH',
    department: 'ARCH',
    name: 'M.Arch (Urban Design)',
    code: 'MARCH',
    degreeType: 'pg',
    durationYears: 2,
    totalSemesters: 4,
    specialization: 'Urban Design',
  },
];

/** Hyderabad puts Program on the path; the stock university config does not. */
const HYD_HIERARCHY = {
  levels: [
    { key: 'department', label: 'Department', labelPlural: 'Departments', isLeaf: false, order: 1 },
    { key: 'program', label: 'Program', labelPlural: 'Programs', isLeaf: false, order: 2 },
    { key: 'year', label: 'Year', labelPlural: 'Years', isLeaf: false, order: 3 },
    { key: 'section', label: 'Section', labelPlural: 'Sections', isLeaf: true, order: 4 },
  ],
};

const FIRST_NAMES = [
  'Aarav',
  'Diya',
  'Vihaan',
  'Ananya',
  'Arjun',
  'Ishita',
  'Kabir',
  'Meera',
  'Rohan',
  'Saanvi',
  'Aditya',
  'Nithya',
  'Karthik',
  'Pooja',
  'Rehan',
  'Tara',
  'Vikram',
  'Zoya',
  'Nikhil',
  'Aisha',
  'Devansh',
  'Riya',
  'Yash',
  'Sneha',
];
const LAST_NAMES = [
  'Sharma',
  'Reddy',
  'Nair',
  'Iyer',
  'Patel',
  'Menon',
  'Rao',
  'Gupta',
  'Pillai',
  'Kulkarni',
  'Bose',
  'Chauhan',
];

function nameFor(i: number) {
  return {
    firstName: FIRST_NAMES[i % FIRST_NAMES.length],
    lastName: LAST_NAMES[Math.floor(i / FIRST_NAMES.length) % LAST_NAMES.length],
  };
}

// ─── Entry point ────────────────────────────────────────────────────────────

async function main() {
  if (!URI) {
    console.error('MONGODB_URI is not set (apps/api/.env or the environment).');
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
  console.log(`\n🌱 Seeding demo hierarchy: ${TENANT_CODE} (${tenantId})`);

  try {
    await seed(db, tenantId);
    console.log('\n✅ Demo hierarchy seeded!\n');
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

  const hydId = new ObjectId();
  const blrId = new ObjectId();
  const pneId = new ObjectId();

  // ── Tenant ───────────────────────────────────────────────────────────────
  await db.collection('tenants').insertOne({
    _id: tenantId,
    tenantId: tenantId.toString(),
    name: 'Verse University',
    code: TENANT_CODE,
    institutionTypes: ['university'],
    contact: {
      email: 'registrar.verse@yopmail.com',
      phone: '+919810000000',
      address: {
        line1: '1 Verse Avenue',
        city: 'Hyderabad',
        state: 'Telangana',
        country: 'India',
        pincode: '500081',
      },
    },
    branding: { primaryColor: '#0F766E', secondaryColor: '#5EEAD4' },
    subscription: {
      plan: 'enterprise',
      maxBranches: 5,
      maxStudents: 20000,
      maxStaff: 1000,
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
        'hr',
        'communications',
      ],
      validUntil: new Date(now.getTime() + 365 * DAY),
    },
    settings: {
      timezone: 'Asia/Kolkata',
      dateFormat: 'DD/MM/YYYY',
      currency: 'INR',
      fiscalYearStart: '04-01',
      // Two institutions share the Hyderabad campus, and documents are
      // branch-scoped — department scope is the only thing that keeps
      // Engineering and Design apart, so this tenant opts in.
      enforceDepartmentScope: true,
    },
    onboardingCompleted: true,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });

  // ── Branches ─────────────────────────────────────────────────────────────
  const branchSeeds = [
    {
      _id: hydId,
      name: 'Hyderabad Campus',
      code: 'HYD',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '500081',
      hierarchy: HYD_HIERARCHY,
    },
    {
      _id: blrId,
      name: 'Bengaluru Campus',
      code: 'BLR',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560103',
      hierarchy: null,
    },
    {
      _id: pneId,
      name: 'Pune Campus',
      code: 'PNE',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411045',
      hierarchy: null,
    },
  ];
  await db.collection('branches').insertMany(
    branchSeeds.map((b, i) => ({
      _id: b._id,
      tenantId,
      branchId: b._id.toString(),
      name: b.name,
      code: b.code,
      institutionType: 'university',
      location: {
        state: b.state,
        city: b.city,
        address: {
          line1: `${i + 1} Verse Avenue`,
          city: b.city,
          state: b.state,
          country: 'India',
          pincode: b.pincode,
        },
      },
      contact: {
        email: `${b.code.toLowerCase()}.verse@yopmail.com`,
        phone: `+91981000000${i + 1}`,
      },
      ...(b.hierarchy && { academicHierarchy: b.hierarchy }),
      status: 'active',
      createdAt: now,
      updatedAt: now,
    }))
  );

  // ── Institutions ─────────────────────────────────────────────────────────
  // Every campus gets its default carrying the CAMPUS's identity; Hyderabad
  // gets two constituent institutions on top. `ensureDefaultInstitution` would
  // create the defaults lazily, but seeding them keeps the tree complete from
  // the first request.
  const institutionIds: Record<string, ObjectId> = {};
  const institutionDocs = branchSeeds.map((b) => {
    const _id = new ObjectId();
    if (b._id.equals(hydId)) institutionIds.DEFAULT = _id;
    return {
      _id,
      tenantId,
      branchId: b._id,
      name: b.name,
      code: b.code,
      isDefault: true,
      settings: {},
      status: 'active' as const,
      createdAt: now,
      updatedAt: now,
    };
  });
  for (const inst of INSTITUTIONS) {
    const _id = new ObjectId();
    institutionIds[inst.key] = _id;
    institutionDocs.push({
      _id,
      tenantId,
      branchId: hydId,
      name: inst.name,
      code: inst.code,
      // `kind` is a free label; only the constituent institutions carry one.
      ...({ kind: inst.kind } as object),
      isDefault: false as unknown as true,
      settings: { admissionPrefix: inst.code },
      status: 'active' as const,
      createdAt: now,
      updatedAt: now,
    });
  }
  await db.collection('institutions').insertMany(institutionDocs);

  // ── Roles ────────────────────────────────────────────────────────────────
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
      name: 'Dean',
      code: 'DEAN',
      isSystemRole: false,
      level: ROLE_HIERARCHY[SYSTEM_ROLES.BRANCH_ADMIN],
      permissions: BRANCH_ADMIN_PERMISSIONS,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: new ObjectId(),
      tenantId,
      name: 'Program Coordinator',
      code: 'PROGRAM_COORDINATOR',
      isSystemRole: false,
      level: 4,
      permissions: BRANCH_ADMIN_PERMISSIONS,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: new ObjectId(),
      tenantId,
      name: 'Teacher',
      code: 'TEACHER',
      isSystemRole: false,
      level: 10,
      permissions: TEACHER_PERMISSIONS,
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

  // ── Departments ──────────────────────────────────────────────────────────
  const departmentIds: Record<string, ObjectId> = {};
  const ownerId = new ObjectId();
  await db.collection('departments').insertMany(
    DEPARTMENTS.map((d) => {
      const _id = new ObjectId();
      departmentIds[d.key] = _id;
      return {
        _id,
        tenantId,
        branchId: hydId,
        institutionId: institutionIds[d.institution],
        name: d.name,
        code: d.code,
        type: d.type,
        status: 'active' as const,
        createdBy: ownerId,
        createdAt: now,
        updatedAt: now,
      };
    })
  );

  // ── Designations ─────────────────────────────────────────────────────────
  const designationDefs = [
    { key: 'PROF', name: 'Professor', code: 'PROF', level: 1 },
    { key: 'ASSOC', name: 'Associate Professor', code: 'ASSOC', level: 2 },
    { key: 'ASST', name: 'Assistant Professor', code: 'ASST', level: 3 },
  ];
  const designationIds: Record<string, ObjectId> = {};
  await db.collection('designations').insertMany(
    designationDefs.map((d) => {
      const _id = new ObjectId();
      designationIds[d.key] = _id;
      return {
        _id,
        tenantId,
        branchId: hydId,
        name: d.name,
        code: d.code,
        category: 'teaching' as const,
        level: d.level,
        status: 'active' as const,
        createdBy: ownerId,
        createdAt: now,
        updatedAt: now,
      };
    })
  );

  // ── Programs ─────────────────────────────────────────────────────────────
  const programIds: Record<string, ObjectId> = {};
  await db.collection('programs').insertMany(
    PROGRAMS.map((p) => {
      const _id = new ObjectId();
      programIds[p.key] = _id;
      return {
        _id,
        tenantId,
        branchId: hydId,
        departmentId: departmentIds[p.department],
        name: p.name,
        code: p.code,
        degreeType: p.degreeType,
        durationYears: p.durationYears,
        yearPatterns: p.yearPatterns ?? Array(p.durationYears).fill('semester'),
        totalSemesters: totalTermsFor({
          durationYears: p.durationYears,
          yearPatterns: p.yearPatterns ?? Array(p.durationYears).fill('semester'),
        }),
        termPattern: summarizeTermPattern(
          p.yearPatterns ?? Array(p.durationYears).fill('semester')
        ),
        ...(p.specialization && { specialization: p.specialization }),
        status: 'active' as const,
        createdBy: ownerId,
        createdAt: now,
        updatedAt: now,
      };
    })
  );

  // ── Academic batch + semesters ───────────────────────────────────────────
  // Two halves per year: a Year-N student is in semester 2N-1 in the odd term
  // and 2N in the even one — which is why the tree carries Year, not Semester.
  const batchId = new ObjectId();
  await db.collection('academic_batches').insertOne({
    _id: batchId,
    tenantId,
    branchId: hydId,
    name: 'AY 2026-27',
    code: 'AY2627',
    startDate: new Date('2026-07-01'),
    endDate: new Date('2027-06-30'),
    isCurrent: true,
    terms: [
      {
        _id: new ObjectId(),
        name: 'Odd Semester 2026',
        half: 'odd',
        startDate: new Date('2026-07-15'),
        endDate: new Date('2026-12-15'),
        registrationWindow: {
          opensAt: new Date(now.getTime() - DAY),
          closesAt: new Date(now.getTime() + 14 * DAY),
        },
        addDropDeadline: new Date(now.getTime() + 21 * DAY),
      },
      {
        _id: new ObjectId(),
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

  // ── Classes (program × year) + sections + lab batches ────────────────────
  interface Cohort {
    classId: ObjectId;
    sectionId: ObjectId;
    programKey: string;
    departmentKey: string;
    year: number;
    displayName: string;
    labBatchIds: ObjectId[];
  }
  const cohorts: Cohort[] = [];
  const classDocs = [];
  const sectionDocs = [];

  for (const program of PROGRAMS) {
    const department = DEPARTMENTS.find((d) => d.key === program.department)!;
    for (let year = 1; year <= program.durationYears; year++) {
      const classId = new ObjectId();
      const displayName = `${department.name} · ${program.name} · Year ${year}`;
      classDocs.push({
        _id: classId,
        tenantId,
        branchId: hydId,
        academicBatchId: batchId,
        // path[i].levelKey lines up with HYD_HIERARCHY's non-leaf levels.
        path: [
          { levelKey: 'department', name: department.name, code: department.code, order: 1 },
          { levelKey: 'program', name: program.name, code: program.code },
          { levelKey: 'year', name: `Year ${year}`, code: `Y${year}` },
        ],
        displayName,
        // Both FKs, written the way the service writes them: departmentId is
        // derived from path[0], programId is explicit.
        departmentId: departmentIds[program.department],
        programId: programIds[program.key],
        capacity: 60,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });

      const sectionCount = year === 1 ? (program.sectionsPerYear ?? 1) : 1;
      for (let s = 0; s < sectionCount; s++) {
        const sectionId = new ObjectId();
        const sectionName = String.fromCharCode(65 + s); // A, B
        // Lab batches only where practicals actually split the section — the
        // first-year UG sections.
        const labBatchIds =
          year === 1 && program.degreeType === 'ug' ? [new ObjectId(), new ObjectId()] : [];
        sectionDocs.push({
          _id: sectionId,
          tenantId,
          branchId: hydId,
          classId,
          name: `Section ${sectionName}`,
          code: sectionName,
          capacity: 60,
          ...(labBatchIds.length && {
            batches: labBatchIds.map((id, i) => ({ _id: id, name: `Batch ${i + 1}` })),
          }),
          status: 'active',
          createdAt: now,
          updatedAt: now,
        });
        cohorts.push({
          classId,
          sectionId,
          programKey: program.key,
          departmentKey: program.department,
          year,
          displayName,
          labBatchIds,
        });
      }
    }
  }
  await db.collection('classes').insertMany(classDocs);
  await db.collection('sections').insertMany(sectionDocs);

  // ── Users ────────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const registrarId = new ObjectId();
  const deanUserId = new ObjectId();
  const coordinatorUserId = new ObjectId();
  const teacherUserId = new ObjectId();

  const userDocs = [
    {
      _id: ownerId,
      tenantId,
      email: EMAILS.owner,
      passwordHash,
      phone: '+919810000010',
      profile: { firstName: 'Lakshmi', lastName: 'Varma', displayName: 'Lakshmi Varma' },
      roleId: roleIds[SYSTEM_ROLES.GROUP_OWNER],
      // Global: every campus, every institution.
      accessScope: { type: 'global', branchIds: [] },
      status: 'active',
      failedLoginAttempts: 0,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: registrarId,
      tenantId,
      email: EMAILS.registrar,
      passwordHash,
      phone: '+919810000011',
      profile: { firstName: 'Suresh', lastName: 'Pillai', displayName: 'Suresh Pillai' },
      roleId: roleIds[SYSTEM_ROLES.BRANCH_ADMIN],
      // One campus, both institutions on it.
      accessScope: { type: 'branch', branchIds: [hydId] },
      status: 'active',
      failedLoginAttempts: 0,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: deanUserId,
      tenantId,
      email: EMAILS.dean,
      passwordHash,
      phone: '+919810000012',
      profile: { firstName: 'Anil', lastName: 'Deshpande', displayName: 'Anil Deshpande' },
      roleId: roleIds.DEAN,
      // DEPARTMENT scope, not 'institution'. Both record the Engineering link,
      // but narrowing is keyed on the type being exactly 'department'
      // (middleware/scope.ts) — an 'institution'-typed user gets campus entry
      // and sees everything on it, including Design's. Listing the institution
      // alongside keeps the Dean's remit visible without loosening the filter.
      accessScope: {
        type: 'department',
        institutionIds: [institutionIds.ENGG],
        branchIds: [hydId],
        departmentIds: [departmentIds.CSE, departmentIds.MECH],
      },
      status: 'active',
      failedLoginAttempts: 0,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: coordinatorUserId,
      tenantId,
      email: EMAILS.coordinator,
      passwordHash,
      phone: '+919810000013',
      profile: { firstName: 'Nandini', lastName: 'Rao', displayName: 'Nandini Rao' },
      roleId: roleIds.PROGRAM_COORDINATOR,
      // Program scope — narrower than department, and enforced unconditionally.
      accessScope: {
        type: 'program',
        branchIds: [hydId],
        programIds: [programIds.BTCSEIOT],
      },
      status: 'active',
      failedLoginAttempts: 0,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: teacherUserId,
      tenantId,
      email: EMAILS.teacher,
      passwordHash,
      phone: '+919810000014',
      profile: { firstName: 'Ravi', lastName: 'Menon', displayName: 'Ravi Menon' },
      roleId: roleIds.TEACHER,
      accessScope: { type: 'branch', branchIds: [hydId] },
      status: 'active',
      failedLoginAttempts: 0,
      createdAt: now,
      updatedAt: now,
    },
  ];

  // ── Staff (HODs + the teacher login) ─────────────────────────────────────
  const staffDefs = [
    {
      firstName: 'Anil',
      lastName: 'Deshpande',
      dept: 'CSE',
      desig: 'PROF',
      userId: deanUserId,
      hodOf: 'CSE',
    },
    {
      firstName: 'Ravi',
      lastName: 'Menon',
      dept: 'CSE',
      desig: 'ASST',
      userId: teacherUserId,
      hodOf: null,
    },
    {
      firstName: 'Nandini',
      lastName: 'Rao',
      dept: 'CSE',
      desig: 'ASSOC',
      userId: coordinatorUserId,
      hodOf: null,
    },
    {
      firstName: 'Gopal',
      lastName: 'Iyer',
      dept: 'MECH',
      desig: 'PROF',
      userId: null,
      hodOf: 'MECH',
    },
    {
      firstName: 'Farah',
      lastName: 'Sheikh',
      dept: 'ARCH',
      desig: 'PROF',
      userId: null,
      hodOf: 'ARCH',
    },
  ];
  const emailByUserId = new Map<string, string>([
    [deanUserId.toString(), EMAILS.dean],
    [teacherUserId.toString(), EMAILS.teacher],
    [coordinatorUserId.toString(), EMAILS.coordinator],
  ]);
  const staffEmailFor = (userId: ObjectId | null, index: number) =>
    (userId && emailByUserId.get(userId.toString())) || `staff${index + 1}@yopmail.com`;

  const staffDocs = staffDefs.map((s, i) => ({
    _id: new ObjectId(),
    tenantId,
    branchId: hydId,
    employeeId: `VU${String(i + 1).padStart(5, '0')}`,
    firstName: s.firstName,
    lastName: s.lastName,
    displayName: `${s.firstName} ${s.lastName}`,
    gender: i % 2 === 0 ? 'male' : 'female',
    nationality: 'Indian',
    contact: {
      // A staff member who can log in is reachable at the address they log in
      // with; the rest get a plain numbered inbox.
      email: staffEmailFor(s.userId, i),
      phone: `+9198100001${20 + i}`,
    },
    employment: {
      joiningDate: new Date(now.getTime() - 600 * DAY),
      employmentType: 'permanent',
      // The FK the institution tier counts staff through.
      departmentId: departmentIds[s.dept],
      designationId: designationIds[s.desig],
    },
    teaching: { isTeaching: true, subjects: null, classTeacherOf: null, periodsPerWeek: null },
    userId: s.userId,
    status: 'active',
    createdBy: ownerId,
    createdAt: now,
    updatedAt: now,
    approvalStatus: 'approved',
  }));
  await db.collection('staff').insertMany(staffDocs);

  // Point each department at its HOD, and each staff-backed user at its staff row.
  for (let i = 0; i < staffDefs.length; i++) {
    const def = staffDefs[i];
    if (def.hodOf) {
      await db
        .collection('departments')
        .updateOne(
          { _id: departmentIds[def.hodOf] },
          { $set: { headOfDepartment: staffDocs[i]._id, updatedAt: now } }
        );
    }
    if (def.userId) {
      const user = userDocs.find((u) => u._id.equals(def.userId!));
      if (user) (user as Record<string, unknown>).staffId = staffDocs[i]._id;
    }
  }
  await db.collection('users').insertMany(userDocs);

  // ── Students ─────────────────────────────────────────────────────────────
  // Everyone lands in a first-year cohort, so the lab-batch split is visible.
  const intakeCohorts = cohorts.filter((c) => c.year === 1);
  const studentDocs = [];
  let counter = 1;
  for (const cohort of intakeCohorts) {
    for (let i = 0; i < 6; i++) {
      const { firstName, lastName } = nameFor(counter);
      const program = PROGRAMS.find((p) => p.key === cohort.programKey)!;
      studentDocs.push({
        _id: new ObjectId(),
        tenantId,
        branchId: hydId,
        admissionNumber: `VU-2026-${String(counter).padStart(4, '0')}`,
        rollNumber: `${program.code}${String(i + 1).padStart(3, '0')}`,
        firstName,
        lastName,
        displayName: `${firstName} ${lastName}`,
        dateOfBirth: new Date(2008, counter % 12, ((counter * 3) % 27) + 1),
        gender: counter % 2 === 0 ? 'female' : 'male',
        nationality: 'Indian',
        contact: { email: `student${counter}@yopmail.com` },
        currentEnrollment: {
          academicBatchId: batchId,
          classId: cohort.classId,
          sectionId: cohort.sectionId,
          // Alternate students between the two lab batches.
          ...(cohort.labBatchIds.length && { labBatchId: cohort.labBatchIds[i % 2] }),
          className: cohort.displayName,
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

  // One student login, in the IoT Year-1 Section A lab batch 1.
  const showcase = studentDocs[0];
  const studentUserId = new ObjectId();
  await db.collection('users').insertOne({
    _id: studentUserId,
    tenantId,
    email: EMAILS.student,
    passwordHash,
    profile: {
      firstName: showcase.firstName,
      lastName: showcase.lastName,
      displayName: showcase.displayName,
    },
    roleId: roleIds.STUDENT,
    accessScope: { type: 'branch', branchIds: [hydId] },
    // Both directions, like enrolment does: the student self-view guard
    // (teaching/scope.ts) resolves the caller's record through users.studentId.
    studentId: showcase._id,
    status: 'active',
    failedLoginAttempts: 0,
    createdAt: now,
    updatedAt: now,
  });
  await db
    .collection('students')
    .updateOne(
      { _id: showcase._id },
      { $set: { userId: studentUserId, 'contact.email': EMAILS.student, updatedAt: now } }
    );

  console.log(
    `  branches=${branchSeeds.length} institutions=${institutionDocs.length} ` +
      `departments=${DEPARTMENTS.length} programs=${PROGRAMS.length} classes=${classDocs.length} ` +
      `sections=${sectionDocs.length} labBatches=${sectionDocs.filter((s) => 'batches' in s).length * 2} ` +
      `staff=${staffDocs.length} students=${studentDocs.length} users=${userDocs.length + 1}`
  );
}

// ─── Rollback / helpers ─────────────────────────────────────────────────────

const TENANT_COLLECTIONS = [
  'tenants',
  'branches',
  'institutions',
  'roles',
  'users',
  'departments',
  'designations',
  'programs',
  'academic_batches',
  'classes',
  'sections',
  'staff',
  'students',
];

async function rollback(db: Db, tenantId: ObjectId) {
  for (const name of TENANT_COLLECTIONS) {
    if (name === 'tenants') await db.collection(name).deleteOne({ _id: tenantId });
    else await db.collection(name).deleteMany({ tenantId });
  }
  console.log('Rolled back all demo-hierarchy data.');
}

function printCredentials() {
  console.log(`  Logins (password: ${PASSWORD})`);
  const pad = (e: string) => e.padEnd(26);
  console.log(`    ${pad(EMAILS.owner)}— Group Owner, global scope (all 3 campuses)`);
  console.log(`    ${pad(EMAILS.registrar)}— Branch Admin, Hyderabad campus`);
  console.log(`    ${pad(EMAILS.dean)}— Dean, INSTITUTION scope (Engineering only)`);
  console.log(`    ${pad(EMAILS.coordinator)}— PROGRAM scope (B.Tech CSE IoT only)`);
  console.log(`    ${pad(EMAILS.teacher)}— Teacher, CSE department`);
  console.log(`    ${pad(EMAILS.student)}— Student, IoT Year 1 · Section A · Batch 1`);
  console.log('');
  console.log('  What to look at:');
  console.log('    1. Organization → Institutions: campus default + Engineering + Design');
  console.log('    2. Organization → Departments: cards grouped under their institution');
  console.log('    3. Organization → Programs: department → UG/PG → program');
  console.log('    4. Organization → Academic Structure: department · program · year · section,');
  console.log('       "New class" year picker bounded by the program (B.Arch offers Year 1-5)');
  console.log('    5. Sections A of the first-year UG cohorts carry Batch 1 / Batch 2');
  console.log('    6. dean.engg vs registrar: the Dean never sees Architecture');
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

/**
 * Isolated demo seeder for school presentations.
 *
 * Creates ONE new tenant (code: SCHDEMO) with rich school data so the UI
 * looks alive during a demo. Refuses to run if SCHDEMO already exists.
 *
 * Touches NOTHING outside the new tenant. Cleanup is one Mongo command.
 */

import { Db, MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import * as path from 'path';
import {
  PERMISSIONS,
  SYSTEM_ROLES,
  ROLE_HIERARCHY,
  ORG_ADMIN_PERMISSIONS,
  BRANCH_ADMIN_PERMISSIONS,
  TEACHER_PERMISSIONS,
  ACCOUNTANT_PERMISSIONS,
  ADMISSION_COUNSELOR_PERMISSIONS,
  HR_MANAGER_PERMISSIONS,
} from '@campus-verse/shared';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const URI = process.env.MONGODB_URI;
if (!URI) {
  console.error('MONGODB_URI not set');
  process.exit(1);
}

const TENANT_CODE = 'SCHDEMO';
const PASSWORD = 'Demo@123';

// ---- helpers ----------------------------------------------------------------

const now = new Date();
const ago = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
const future = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]!;
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

const FIRST_NAMES_M = [
  'Aarav',
  'Vihaan',
  'Aditya',
  'Vivaan',
  'Arjun',
  'Reyansh',
  'Ayaan',
  'Krishna',
  'Ishaan',
  'Shaurya',
  'Kabir',
  'Atharv',
  'Veer',
  'Aryan',
  'Rudra',
  'Yuvan',
  'Dhruv',
  'Karthik',
  'Rohan',
  'Siddharth',
  'Pranav',
  'Aniket',
  'Harsh',
];
const FIRST_NAMES_F = [
  'Aadhya',
  'Saanvi',
  'Aanya',
  'Pari',
  'Diya',
  'Riya',
  'Anaya',
  'Myra',
  'Sara',
  'Ira',
  'Kiara',
  'Ananya',
  'Avni',
  'Navya',
  'Kavya',
  'Aarohi',
  'Ishita',
  'Shanaya',
  'Tara',
  'Mira',
  'Khushi',
  'Ridhima',
  'Anvi',
];
const SURNAMES = [
  'Sharma',
  'Verma',
  'Patel',
  'Reddy',
  'Iyer',
  'Nair',
  'Mehta',
  'Kapoor',
  'Singh',
  'Khan',
  'Joshi',
  'Gupta',
  'Agarwal',
  'Pillai',
  'Rao',
  'Das',
  'Banerjee',
  'Mukherjee',
  'Chopra',
  'Bhatia',
  'Malhotra',
  'Yadav',
  'Mishra',
];

function makeName(): { firstName: string; lastName: string; gender: 'male' | 'female' } {
  const isMale = Math.random() < 0.5;
  return {
    firstName: pick(isMale ? FIRST_NAMES_M : FIRST_NAMES_F),
    lastName: pick(SURNAMES),
    gender: isMale ? 'male' : 'female',
  };
}

function makePhone(): string {
  return '+91' + (rand(70, 99) * 100000000 + rand(0, 99999999)).toString().padStart(10, '0');
}

// ---- main -------------------------------------------------------------------

async function main() {
  const client = new MongoClient(URI!);
  await client.connect();
  const db = client.db();
  console.log('Connected to', db.databaseName);

  const existing = await db.collection('tenants').findOne({ code: TENANT_CODE });
  if (existing) {
    console.error(`\n⛔ Tenant with code "${TENANT_CODE}" already exists (id: ${existing._id}).`);
    console.error('   Refusing to seed. To wipe and re-seed, run cleanup first:');
    printCleanup(existing._id as ObjectId);
    await client.close();
    process.exit(1);
  }

  const tenantId = new ObjectId();
  console.log(`\n🌱 Seeding new demo tenant: ${TENANT_CODE} (${tenantId})`);

  try {
    const ctx = await seedTenant(db, tenantId);
    await seedAcademic(db, tenantId, ctx);
    await seedStudentsAndEnrollments(db, tenantId, ctx);
    await seedAdmissions(db, tenantId, ctx);
    await seedFinance(db, tenantId, ctx);
    await seedTransport(db, tenantId, ctx);
    await seedTeaching(db, tenantId, ctx);
    await seedFeed(db, tenantId, ctx);
    await seedSettings(db, tenantId, ctx);

    console.log('\n✅ Demo seed complete!\n');
    printSummary(ctx);
    printCredentials();
    printCleanup(tenantId);
  } catch (err) {
    console.error('\n❌ Seed failed mid-way. Cleaning up new tenant data...');
    await rollback(db, tenantId);
    throw err;
  } finally {
    await client.close();
  }
}

// ---- tenant + roles + users + branches --------------------------------------

interface SeedCtx {
  ownerId: ObjectId;
  branchAdminId: ObjectId;
  teacherUserId: ObjectId;
  accountantUserId: ObjectId;
  admissionUserId: ObjectId;
  branch1Id: ObjectId;
  branch2Id: ObjectId;
  roleIds: Record<string, ObjectId>;
  batchId: ObjectId;
  classIds: ObjectId[]; // grades 1-10
  sectionIds: ObjectId[];
  studentIds: ObjectId[];
  staffIds: ObjectId[];
  teacherStaffId: ObjectId;
  subjectIds: ObjectId[];
  feeStructureIds: ObjectId[];
  feeAssignmentIds: ObjectId[];
  busIds: ObjectId[];
  classMap: {
    classId: ObjectId;
    sections: { sectionId: ObjectId; name: string }[];
    gradeOrder: number;
    gradeName: string;
  }[];
  counts: Record<string, number>;
}

async function seedTenant(db: Db, tenantId: ObjectId): Promise<SeedCtx> {
  const counts: Record<string, number> = {};

  // Tenant
  await db.collection('tenants').insertOne({
    _id: tenantId,
    tenantId: tenantId.toString(),
    name: 'Greenfield Public School',
    code: TENANT_CODE,
    institutionTypes: ['school'],
    contact: {
      email: 'demo-owner@campusverse-demo.com',
      phone: '+919876500000',
      address: {
        line1: '12 Education Lane',
        city: 'Bangalore',
        state: 'Karnataka',
        country: 'India',
        pincode: '560001',
      },
    },
    branding: {
      primaryColor: '#0EA5E9',
      secondaryColor: '#22D3EE',
    },
    subscription: {
      plan: 'enterprise',
      maxBranches: 5,
      maxStudents: 5000,
      maxStaff: 200,
      features: [
        'core',
        'students',
        'attendance',
        'hr',
        'admissions',
        'finance',
        'communications',
        'certificates',
        'health',
        'careerConnect',
        'teaching',
        'courses',
        'transport',
        'hostel',
        'inventory',
        'visitors',
      ],
      validUntil: future(365),
    },
    settings: {
      timezone: 'Asia/Kolkata',
      dateFormat: 'DD/MM/YYYY',
      currency: 'INR',
      fiscalYearStart: '04-01',
    },
    academicHierarchy: {
      levels: [
        { key: 'grade', label: 'Grade', labelPlural: 'Grades', isLeaf: false, order: 1 },
        { key: 'section', label: 'Section', labelPlural: 'Sections', isLeaf: true, order: 2 },
      ],
    },
    onboardingCompleted: true,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });
  counts.tenants = 1;

  // Branches
  const branch1Id = new ObjectId();
  const branch2Id = new ObjectId();
  await db.collection('branches').insertMany([
    {
      _id: branch1Id,
      tenantId,
      branchId: branch1Id.toString(),
      name: 'Main Campus - Indiranagar',
      code: 'GFS-MC',
      institutionType: 'school',
      location: {
        city: 'Bangalore',
        state: 'Karnataka',
        country: 'India',
        pincode: '560038',
        address: {
          line1: '12 100 Feet Road',
          city: 'Bangalore',
          state: 'Karnataka',
          country: 'India',
          pincode: '560038',
        },
      },
      contact: { email: 'main@greenfield-demo.com', phone: '+918012340001' },
      infrastructure: {
        hasHostel: false,
        hasTransport: true,
        hasCanteen: true,
        hasLibrary: true,
        hasLab: true,
      },
      settings: {
        weeklyOff: ['sunday'],
        workingHours: { start: '08:00', end: '15:30' },
        attendanceTime: { start: '08:00', lateAfter: '08:30', end: '15:30' },
      },
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: branch2Id,
      tenantId,
      branchId: branch2Id.toString(),
      name: 'North Campus - Hebbal',
      code: 'GFS-NC',
      institutionType: 'school',
      location: {
        city: 'Bangalore',
        state: 'Karnataka',
        country: 'India',
        pincode: '560024',
        address: {
          line1: '45 Outer Ring Road',
          city: 'Bangalore',
          state: 'Karnataka',
          country: 'India',
          pincode: '560024',
        },
      },
      contact: { email: 'north@greenfield-demo.com', phone: '+918012340002' },
      infrastructure: {
        hasHostel: false,
        hasTransport: true,
        hasCanteen: true,
        hasLibrary: true,
        hasLab: true,
      },
      settings: {
        weeklyOff: ['sunday'],
        workingHours: { start: '08:00', end: '15:30' },
        attendanceTime: { start: '08:00', lateAfter: '08:30', end: '15:30' },
      },
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
  ]);
  counts.branches = 2;

  // Roles
  const roleIds: Record<string, ObjectId> = {};
  const systemRoles = [
    {
      code: SYSTEM_ROLES.GROUP_OWNER,
      name: 'Group Owner',
      description: 'Owner with full access',
      permissions: PERMISSIONS,
      level: ROLE_HIERARCHY[SYSTEM_ROLES.GROUP_OWNER],
    },
    {
      code: SYSTEM_ROLES.ORG_ADMIN,
      name: 'Org Admin',
      description: 'Org-level admin',
      permissions: ORG_ADMIN_PERMISSIONS,
      level: ROLE_HIERARCHY[SYSTEM_ROLES.ORG_ADMIN],
    },
    {
      code: SYSTEM_ROLES.BRANCH_ADMIN,
      name: 'Branch Admin',
      description: 'Branch-level admin',
      permissions: BRANCH_ADMIN_PERMISSIONS,
      level: ROLE_HIERARCHY[SYSTEM_ROLES.BRANCH_ADMIN],
    },
  ];
  const operationalRoles = [
    {
      code: 'TEACHER',
      name: 'Teacher',
      description: 'Classroom teacher',
      permissions: TEACHER_PERMISSIONS,
      level: 10,
    },
    {
      code: 'ACCOUNTANT',
      name: 'Accountant',
      description: 'Finance operations',
      permissions: ACCOUNTANT_PERMISSIONS,
      level: 10,
    },
    {
      code: 'ADMISSION_COUNSELOR',
      name: 'Admission Counselor',
      description: 'Lead and application management',
      permissions: ADMISSION_COUNSELOR_PERMISSIONS,
      level: 10,
    },
    {
      code: 'HR_MANAGER',
      name: 'HR Manager',
      description: 'Staff and HR management',
      permissions: HR_MANAGER_PERMISSIONS,
      level: 10,
    },
  ];
  const allRoleDocs = [
    ...systemRoles.map((r) => ({
      _id: new ObjectId(),
      tenantId,
      name: r.name,
      code: r.code,
      description: r.description,
      isSystemRole: true,
      level: r.level,
      permissions: r.permissions,
      createdAt: now,
      updatedAt: now,
    })),
    ...operationalRoles.map((r) => ({
      _id: new ObjectId(),
      tenantId,
      name: r.name,
      code: r.code,
      description: r.description,
      isSystemRole: false,
      level: r.level,
      permissions: r.permissions,
      createdAt: now,
      updatedAt: now,
    })),
  ];
  await db.collection('roles').insertMany(allRoleDocs);
  for (const r of allRoleDocs) roleIds[r.code] = r._id;
  counts.roles = allRoleDocs.length;

  // Users
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const ownerId = new ObjectId();
  const branchAdminId = new ObjectId();
  const teacherUserId = new ObjectId();
  const accountantUserId = new ObjectId();
  const admissionUserId = new ObjectId();

  await db.collection('users').insertMany([
    {
      _id: ownerId,
      tenantId,
      email: 'owner@greenfield.demo',
      passwordHash,
      phone: '+919876500001',
      profile: { firstName: 'Rajesh', lastName: 'Krishnan', displayName: 'Rajesh Krishnan' },
      roleId: roleIds[SYSTEM_ROLES.GROUP_OWNER],
      accessScope: { type: 'global', branchIds: [] },
      preferences: { language: 'en', notifications: { email: true, sms: true, push: true } },
      status: 'active',
      failedLoginAttempts: 0,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: branchAdminId,
      tenantId,
      email: 'principal@greenfield.demo',
      passwordHash,
      phone: '+919876500002',
      profile: { firstName: 'Priya', lastName: 'Menon', displayName: 'Priya Menon' },
      roleId: roleIds[SYSTEM_ROLES.BRANCH_ADMIN],
      accessScope: { type: 'branch', branchIds: [branch1Id] },
      preferences: { language: 'en', notifications: { email: true, sms: true, push: true } },
      status: 'active',
      failedLoginAttempts: 0,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: teacherUserId,
      tenantId,
      email: 'teacher@greenfield.demo',
      passwordHash,
      phone: '+919876500003',
      profile: { firstName: 'Anjali', lastName: 'Sharma', displayName: 'Anjali Sharma' },
      roleId: roleIds.TEACHER,
      accessScope: { type: 'branch', branchIds: [branch1Id] },
      preferences: { language: 'en', notifications: { email: true, sms: true, push: true } },
      status: 'active',
      failedLoginAttempts: 0,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: accountantUserId,
      tenantId,
      email: 'accountant@greenfield.demo',
      passwordHash,
      phone: '+919876500004',
      profile: { firstName: 'Vikram', lastName: 'Iyer', displayName: 'Vikram Iyer' },
      roleId: roleIds.ACCOUNTANT,
      accessScope: { type: 'branch', branchIds: [branch1Id] },
      preferences: { language: 'en', notifications: { email: true, sms: true, push: true } },
      status: 'active',
      failedLoginAttempts: 0,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: admissionUserId,
      tenantId,
      email: 'admissions@greenfield.demo',
      passwordHash,
      phone: '+919876500005',
      profile: { firstName: 'Neha', lastName: 'Reddy', displayName: 'Neha Reddy' },
      roleId: roleIds.ADMISSION_COUNSELOR,
      accessScope: { type: 'branch', branchIds: [branch1Id] },
      preferences: { language: 'en', notifications: { email: true, sms: true, push: true } },
      status: 'active',
      failedLoginAttempts: 0,
      createdAt: now,
      updatedAt: now,
    },
  ]);
  counts.users = 5;

  return {
    ownerId,
    branchAdminId,
    teacherUserId,
    accountantUserId,
    admissionUserId,
    branch1Id,
    branch2Id,
    roleIds,
    batchId: new ObjectId(),
    classIds: [],
    sectionIds: [],
    studentIds: [],
    staffIds: [],
    teacherStaffId: new ObjectId(),
    subjectIds: [],
    feeStructureIds: [],
    feeAssignmentIds: [],
    busIds: [],
    classMap: [],
    counts,
  };
}

// ---- academic structure -----------------------------------------------------

async function seedAcademic(db: Db, tenantId: ObjectId, ctx: SeedCtx) {
  const { branch1Id, ownerId } = ctx;

  // Academic batch
  await db.collection('academic_batches').insertOne({
    _id: ctx.batchId,
    tenantId,
    branchId: branch1Id,
    name: 'Academic Year 2025-2026',
    code: 'AY2026',
    startDate: new Date('2025-04-01'),
    endDate: new Date('2026-03-31'),
    isCurrent: true,
    terms: [
      { name: 'Term 1', startDate: new Date('2025-04-01'), endDate: new Date('2025-09-30') },
      { name: 'Term 2', startDate: new Date('2025-10-01'), endDate: new Date('2026-03-31') },
    ],
    status: 'active',
    createdAt: now,
    updatedAt: now,
    createdBy: ownerId,
  });
  ctx.counts.academic_batches = 1;

  // Departments
  const deptScience = new ObjectId();
  const deptArts = new ObjectId();
  const deptAdmin = new ObjectId();
  await db.collection('departments').insertMany([
    {
      _id: deptScience,
      tenantId,
      branchId: branch1Id,
      name: 'Science',
      code: 'SCI',
      type: 'academic',
      description: 'Maths, Science',
      headOfDepartment: null,
      parentDepartmentId: null,
      status: 'active',
      createdBy: ownerId,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: deptArts,
      tenantId,
      branchId: branch1Id,
      name: 'Languages',
      code: 'LANG',
      type: 'academic',
      description: 'English, Hindi, Kannada',
      headOfDepartment: null,
      parentDepartmentId: null,
      status: 'active',
      createdBy: ownerId,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: deptAdmin,
      tenantId,
      branchId: branch1Id,
      name: 'Administration',
      code: 'ADMIN',
      type: 'non_academic',
      description: 'Office and admin staff',
      headOfDepartment: null,
      parentDepartmentId: null,
      status: 'active',
      createdBy: ownerId,
      createdAt: now,
      updatedAt: now,
    },
  ]);
  ctx.counts.departments = 3;

  // Designations
  const desigTeacher = new ObjectId();
  const desigPrincipal = new ObjectId();
  const desigAccountant = new ObjectId();
  await db.collection('designations').insertMany([
    {
      _id: desigTeacher,
      tenantId,
      branchId: branch1Id,
      name: 'Teacher',
      code: 'TCH',
      category: 'teaching',
      level: 5,
      description: 'Classroom teacher',
      permissions: null,
      status: 'active',
      createdBy: ownerId,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: desigPrincipal,
      tenantId,
      branchId: branch1Id,
      name: 'Principal',
      code: 'PRN',
      category: 'administrative',
      level: 1,
      description: 'School principal',
      permissions: null,
      status: 'active',
      createdBy: ownerId,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: desigAccountant,
      tenantId,
      branchId: branch1Id,
      name: 'Accountant',
      code: 'ACC',
      category: 'administrative',
      level: 5,
      description: 'Finance staff',
      permissions: null,
      status: 'active',
      createdBy: ownerId,
      createdAt: now,
      updatedAt: now,
    },
  ]);
  ctx.counts.designations = 3;

  // Subjects
  const subjectDefs = [
    { name: 'Mathematics', code: 'MATH' },
    { name: 'English', code: 'ENG' },
    { name: 'Science', code: 'SCI' },
    { name: 'Social Studies', code: 'SOC' },
    { name: 'Hindi', code: 'HIN' },
    { name: 'Kannada', code: 'KAN' },
    { name: 'Computer Science', code: 'CS' },
    { name: 'Physical Education', code: 'PE' },
  ];
  const subjects = subjectDefs.map((s) => ({
    _id: new ObjectId(),
    tenantId,
    branchId: branch1Id,
    name: s.name,
    code: s.code,
    shortName: s.code,
    type: 'both',
    applicableTo: null,
    credits: null,
    maxMarks: null,
    passingMarks: null,
    status: 'active',
    createdBy: ownerId,
    createdAt: now,
    updatedAt: now,
  }));
  await db.collection('subjects').insertMany(subjects);
  ctx.subjectIds = subjects.map((s) => s._id);
  ctx.counts.subjects = subjects.length;

  // Staff (8 — owner-mapped principal, plus 6 teachers, 1 accountant)
  const staffDefs: Array<{
    firstName: string;
    lastName: string;
    gender: 'male' | 'female';
    email: string;
    isTeaching: boolean;
    designationId: ObjectId;
    departmentId: ObjectId;
    classTeacherOf?: ObjectId;
    userId?: ObjectId;
  }> = [];
  const teacherStaffId = new ObjectId();
  ctx.teacherStaffId = teacherStaffId;
  // The teacher user → Anjali Sharma → also a staff record
  staffDefs.push({
    firstName: 'Anjali',
    lastName: 'Sharma',
    gender: 'female',
    email: 'teacher@greenfield.demo',
    isTeaching: true,
    designationId: desigTeacher,
    departmentId: deptScience,
    userId: ctx.teacherUserId,
  });
  staffDefs.push({
    firstName: 'Suresh',
    lastName: 'Pillai',
    gender: 'male',
    email: 'suresh.p@greenfield.demo',
    isTeaching: true,
    designationId: desigTeacher,
    departmentId: deptScience,
  });
  staffDefs.push({
    firstName: 'Lakshmi',
    lastName: 'Nair',
    gender: 'female',
    email: 'lakshmi.n@greenfield.demo',
    isTeaching: true,
    designationId: desigTeacher,
    departmentId: deptArts,
  });
  staffDefs.push({
    firstName: 'Rakesh',
    lastName: 'Joshi',
    gender: 'male',
    email: 'rakesh.j@greenfield.demo',
    isTeaching: true,
    designationId: desigTeacher,
    departmentId: deptArts,
  });
  staffDefs.push({
    firstName: 'Meera',
    lastName: 'Gupta',
    gender: 'female',
    email: 'meera.g@greenfield.demo',
    isTeaching: true,
    designationId: desigTeacher,
    departmentId: deptScience,
  });
  staffDefs.push({
    firstName: 'Arun',
    lastName: 'Verma',
    gender: 'male',
    email: 'arun.v@greenfield.demo',
    isTeaching: true,
    designationId: desigTeacher,
    departmentId: deptScience,
  });
  // Principal mapped to branchAdminId user
  staffDefs.push({
    firstName: 'Priya',
    lastName: 'Menon',
    gender: 'female',
    email: 'principal@greenfield.demo',
    isTeaching: false,
    designationId: desigPrincipal,
    departmentId: deptAdmin,
    userId: ctx.branchAdminId,
  });
  staffDefs.push({
    firstName: 'Vikram',
    lastName: 'Iyer',
    gender: 'male',
    email: 'accountant@greenfield.demo',
    isTeaching: false,
    designationId: desigAccountant,
    departmentId: deptAdmin,
    userId: ctx.accountantUserId,
  });

  const staffIds: ObjectId[] = [teacherStaffId];
  for (let i = 1; i < staffDefs.length; i++) staffIds.push(new ObjectId());

  const staffDocs = staffDefs.map((s, i) => ({
    _id: i === 0 ? teacherStaffId : staffIds[i],
    tenantId,
    branchId: branch1Id,
    employeeId: `EMP${String(i + 1).padStart(5, '0')}`,
    firstName: s.firstName,
    lastName: s.lastName,
    displayName: `${s.firstName} ${s.lastName}`,
    dateOfBirth: new Date(
      `19${rand(80, 95)}-${String(rand(1, 12)).padStart(2, '0')}-${String(rand(1, 28)).padStart(2, '0')}`
    ),
    gender: s.gender,
    bloodGroup: null,
    nationality: 'Indian',
    photo: null,
    contact: {
      email: s.email,
      phone: makePhone(),
      alternatePhone: null,
      emergencyContact: null,
      address: null,
    },
    employment: {
      joiningDate: ago(rand(180, 1500)),
      confirmationDate: null,
      employmentType: 'permanent',
      departmentId: s.departmentId,
      designationId: s.designationId,
      noticePeriod: null,
    },
    teaching: {
      isTeaching: s.isTeaching,
      subjects: s.isTeaching ? [{ subjectId: pick(ctx.subjectIds) }] : null,
      classTeacherOf: null,
      periodsPerWeek: null,
    },
    qualifications: null,
    userId: s.userId ?? null,
    status: 'active',
    statusHistory: [
      { status: 'active', date: now, reason: 'Staff created', changedBy: ctx.ownerId },
    ],
    createdBy: ctx.ownerId,
    createdAt: now,
    updatedAt: now,
    approvalStatus: 'approved',
  }));
  await db.collection('staff').insertMany(staffDocs);
  ctx.staffIds = staffIds;
  ctx.counts.staff = staffDocs.length;

  // Classes (Grade 1 to Grade 10) + sections (A, B, C)
  const classDocs = [];
  const sectionDocs = [];
  ctx.classMap = [];
  for (let g = 1; g <= 10; g++) {
    const classId = new ObjectId();
    classDocs.push({
      _id: classId,
      tenantId,
      branchId: branch1Id,
      academicBatchId: ctx.batchId,
      path: [{ levelKey: 'grade', name: `Grade ${g}`, code: `G${g}`, order: g }],
      displayName: `Grade ${g}`,
      capacity: 90,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      createdBy: ctx.ownerId,
      subjects: ctx.subjectIds.slice(0, 6).map((sid) => ({
        subjectId: sid,
        teacherId: pick(ctx.staffIds.slice(0, 6)),
        periodsPerWeek: rand(3, 6),
      })),
    });
    ctx.classIds.push(classId);

    const sectionsForClass: { sectionId: ObjectId; name: string }[] = [];
    for (const letter of ['A', 'B', 'C']) {
      const sectionId = new ObjectId();
      sectionDocs.push({
        _id: sectionId,
        tenantId,
        branchId: branch1Id,
        classId,
        name: `SECTION ${letter}`,
        code: `Section ${letter}`,
        capacity: 30,
        roomNumber: `${g}${letter}`,
        status: 'active',
        createdAt: now,
        updatedAt: now,
        createdBy: ctx.ownerId,
        sectionTeacherId: pick(ctx.staffIds.slice(0, 6)),
      });
      ctx.sectionIds.push(sectionId);
      sectionsForClass.push({ sectionId, name: `SECTION ${letter}` });
    }
    ctx.classMap.push({
      classId,
      sections: sectionsForClass,
      gradeOrder: g,
      gradeName: `Grade ${g}`,
    });
  }
  await db.collection('classes').insertMany(classDocs);
  await db.collection('sections').insertMany(sectionDocs);
  ctx.counts.classes = classDocs.length;
  ctx.counts.sections = sectionDocs.length;
}

// ---- students + enrollments -------------------------------------------------

async function seedStudentsAndEnrollments(db: Db, tenantId: ObjectId, ctx: SeedCtx) {
  const { branch1Id } = ctx;
  const studentDocs = [];
  const enrollmentDocs = [];
  let i = 1;
  for (const cls of ctx.classMap) {
    // ~12 students per grade, distributed across A/B/C
    for (let s = 0; s < 12; s++) {
      const section = cls.sections[s % cls.sections.length]!;
      const name = makeName();
      const sid = new ObjectId();
      const dob = new Date(2025 - (cls.gradeOrder + 5), rand(0, 11), rand(1, 28));
      const admNum = `GFS-MC-AY2026-${String(i).padStart(4, '0')}`;
      const enrCode = `EN${String(i).padStart(8, '0')}`;
      studentDocs.push({
        _id: sid,
        tenantId,
        branchId: branch1Id,
        admissionNumber: admNum,
        enrollmentCode: enrCode,
        firstName: name.firstName,
        lastName: name.lastName,
        displayName: `${name.firstName} ${name.lastName}`,
        dateOfBirth: dob,
        gender: name.gender,
        bloodGroup: null,
        nationality: 'Indian',
        religion: null,
        caste: null,
        category: 'general',
        aadharNumber: null,
        contact: {
          email: `${name.firstName.toLowerCase()}.${name.lastName.toLowerCase()}${i}@greenfield.demo`,
          phone: makePhone(),
        },
        parents: {
          father: {
            name: `${pick(SURNAMES)} ${name.lastName}`,
            phone: makePhone(),
            occupation: pick(['Engineer', 'Doctor', 'Business', 'Teacher', 'Bank Officer']),
          },
          mother: {
            name: `${pick(FIRST_NAMES_F)} ${name.lastName}`,
            phone: makePhone(),
            occupation: pick(['Homemaker', 'Teacher', 'Doctor', 'Business']),
          },
        },
        primaryContactType: 'father',
        admissionDate: ago(rand(30, 720)),
        admissionType: 'new',
        previousSchool: null,
        currentEnrollment: {
          academicBatchId: ctx.batchId,
          classId: cls.classId,
          sectionId: section.sectionId,
          className: cls.gradeName,
          sectionName: section.name,
        },
        status: 'active',
        statusHistory: [
          {
            status: 'active',
            date: ago(rand(30, 720)),
            reason: 'New admission',
            changedBy: ctx.ownerId,
          },
        ],
        createdBy: ctx.ownerId,
        createdAt: ago(rand(30, 720)),
        updatedAt: now,
      });
      enrollmentDocs.push({
        _id: new ObjectId(),
        tenantId,
        branchId: branch1Id,
        studentId: sid,
        academicBatchId: ctx.batchId,
        classId: cls.classId,
        sectionId: section.sectionId,
        enrollmentDate: ago(rand(30, 720)),
        enrollmentType: 'new',
        status: 'active',
        createdBy: ctx.ownerId,
        createdAt: now,
        updatedAt: now,
      });
      ctx.studentIds.push(sid);
      i++;
    }
  }
  await db.collection('students').insertMany(studentDocs);
  await db.collection('student_enrollments').insertMany(enrollmentDocs);
  ctx.counts.students = studentDocs.length;
  ctx.counts.student_enrollments = enrollmentDocs.length;
}

// ---- admissions: leads + applications + sources -----------------------------

async function seedAdmissions(db: Db, tenantId: ObjectId, ctx: SeedCtx) {
  const { branch1Id } = ctx;

  // Sources
  const sources = [
    { code: 'walk_in', name: 'Walk-in', category: 'organic' },
    { code: 'referral', name: 'Referral', category: 'organic' },
    { code: 'website', name: 'Website Form', category: 'digital' },
    { code: 'instagram', name: 'Instagram', category: 'digital' },
    { code: 'facebook', name: 'Facebook', category: 'digital' },
    { code: 'newspaper', name: 'Newspaper Ad', category: 'offline' },
  ];
  await db.collection('admission_sources').insertMany(
    sources.map((s, i) => ({
      _id: new ObjectId(),
      code: s.code,
      name: s.name,
      category: s.category,
      isActive: true,
      order: i + 1,
      tenantId,
      branchId: branch1Id,
      createdAt: now,
      updatedAt: now,
    }))
  );
  ctx.counts.admission_sources = sources.length;

  // Leads — distribute across stages so the Kanban looks alive
  const stageDistribution: Array<{ stage: string; count: number }> = [
    { stage: 'new', count: 4 },
    { stage: 'contacted', count: 3 },
    { stage: 'interested', count: 3 },
    { stage: 'followup', count: 2 },
    { stage: 'visit_scheduled', count: 2 },
    { stage: 'visited', count: 2 },
  ];
  const leadDocs = [];
  let leadCounter = 1;
  for (const { stage, count } of stageDistribution) {
    for (let i = 0; i < count; i++) {
      const name = makeName();
      const stageHistory: Array<{
        stage: string;
        date: Date;
        changedBy: ObjectId;
        notes: string | null;
      }> = [
        {
          stage: 'new',
          date: ago(rand(2, 30)),
          changedBy: ctx.admissionUserId,
          notes: 'Lead created',
        },
      ];
      const order = ['new', 'contacted', 'interested', 'followup', 'visit_scheduled', 'visited'];
      const idx = order.indexOf(stage);
      for (let s = 1; s <= idx; s++) {
        stageHistory.push({
          stage: order[s]!,
          date: ago(rand(1, 14)),
          changedBy: ctx.admissionUserId,
          notes: null,
        });
      }
      const followups =
        stage === 'followup' || stage === 'visit_scheduled'
          ? [
              {
                _id: new ObjectId(),
                scheduledDate: future(rand(1, 7)),
                type: 'call',
                notes: 'Schedule a campus tour',
                status: 'pending',
                createdBy: ctx.admissionUserId,
                createdAt: now,
              },
            ]
          : [];
      leadDocs.push({
        _id: new ObjectId(),
        tenantId,
        branchId: branch1Id,
        leadNumber: `LD2600${String(leadCounter).padStart(3, '0')}`,
        firstName: name.firstName,
        lastName: name.lastName,
        displayName: `${name.firstName} ${name.lastName}`,
        dateOfBirth: new Date(
          `20${rand(15, 22)}-${String(rand(1, 12)).padStart(2, '0')}-${String(rand(1, 28)).padStart(2, '0')}`
        ),
        gender: name.gender,
        contact: { phone: makePhone(), email: `lead${leadCounter}@parent.demo` },
        parents: {
          father: { name: `${pick(FIRST_NAMES_M)} ${name.lastName}`, phone: makePhone() },
        },
        interestedIn: { className: `Grade ${rand(1, 10)}`, stream: null },
        source: pick(sources).code,
        sourceDetails: null,
        referredBy: null,
        stage,
        stageHistory,
        followups,
        notes: pick([
          'Parents visited yesterday',
          'Sibling already enrolled',
          'Looking for transport from Whitefield',
          'Wants to confirm sports facilities',
          null,
        ]),
        tags: pick([['priority'], ['transport-needed'], ['sibling'], null]),
        status: 'active',
        createdBy: ctx.admissionUserId,
        createdAt: ago(rand(2, 30)),
        updatedAt: now,
      });
      leadCounter++;
    }
  }
  await db.collection('leads').insertMany(leadDocs);
  ctx.counts.leads = leadDocs.length;

  // Applications across status: submitted, docs_verified, fee_paid, enrolled
  const appStages: Array<{ status: string; count: number }> = [
    { status: 'submitted', count: 3 },
    { status: 'docs_verified', count: 2 },
    { status: 'fee_paid', count: 2 },
    { status: 'enrolled', count: 1 },
  ];
  const applicationDocs = [];
  let appCounter = 1;
  for (const { status, count } of appStages) {
    for (let i = 0; i < count; i++) {
      const name = makeName();
      const statusOrder = ['submitted', 'docs_verified', 'fee_paid', 'enrolled'];
      const idx = statusOrder.indexOf(status);
      const statusHistory = [];
      for (let s = 0; s <= idx; s++) {
        statusHistory.push({
          status: statusOrder[s]!,
          changedAt: ago(rand(1, 14) * (idx - s + 1)),
          changedBy: ctx.admissionUserId,
          remarks: null,
        });
      }
      applicationDocs.push({
        _id: new ObjectId(),
        tenantId,
        branchId: branch1Id,
        applicationNumber: `APP2600${String(appCounter).padStart(3, '0')}`,
        academicBatchId: ctx.batchId,
        classId: pick(ctx.classIds),
        sectionId: null,
        student: {
          firstName: name.firstName,
          lastName: name.lastName,
          dateOfBirth: new Date(
            `20${rand(15, 22)}-${String(rand(1, 12)).padStart(2, '0')}-${String(rand(1, 28)).padStart(2, '0')}`
          ),
          gender: name.gender,
        },
        contact: {
          address: { city: 'Bangalore', state: 'Karnataka', pincode: '560001', country: 'India' },
          phone: makePhone(),
          email: `app${appCounter}@parent.demo`,
        },
        parents: {
          father: { name: `${pick(FIRST_NAMES_M)} ${name.lastName}`, phone: makePhone() },
        },
        previousEducation: null,
        source: pick(sources).code,
        leadId: null,
        referredBy: null,
        status,
        statusHistory,
        createdBy: ctx.admissionUserId,
        createdAt: ago(rand(5, 30)),
        updatedAt: now,
        remarks: null,
      });
      appCounter++;
    }
  }
  await db.collection('applications').insertMany(applicationDocs);
  ctx.counts.applications = applicationDocs.length;
}

// ---- finance: structures, assignments, transactions -------------------------

async function seedFinance(db: Db, tenantId: ObjectId, ctx: SeedCtx) {
  const { branch1Id } = ctx;

  // Fee structures - one per grade
  const fsDocs = [];
  for (const cls of ctx.classMap) {
    const tuition = 25000 + cls.gradeOrder * 2000;
    const transport = 12000;
    const lab = cls.gradeOrder >= 6 ? 4000 : 0;
    const components = [
      {
        name: 'Tuition Fee',
        code: 'TUITION',
        type: 'mandatory',
        amount: tuition,
        frequency: 'yearly',
        taxable: false,
        refundable: false,
      },
      {
        name: 'Transport Fee',
        code: 'TRANSPORT',
        type: 'optional',
        amount: transport,
        frequency: 'yearly',
        taxable: false,
        refundable: false,
      },
    ];
    if (lab > 0) {
      components.push({
        name: 'Lab Fee',
        code: 'LAB',
        type: 'mandatory',
        amount: lab,
        frequency: 'yearly',
        taxable: false,
        refundable: false,
      });
    }
    const total = components.reduce((s, c) => s + c.amount, 0);
    const mandatory = components
      .filter((c) => c.type === 'mandatory')
      .reduce((s, c) => s + c.amount, 0);
    const fsId = new ObjectId();
    fsDocs.push({
      _id: fsId,
      tenantId,
      branchId: branch1Id,
      name: `${cls.gradeName} Fee Structure`,
      code: `FEE_G${cls.gradeOrder}`,
      applicableTo: {
        institutionType: null,
        classIds: [],
        gradeCodes: [`grade:G${cls.gradeOrder}`],
        streams: null,
        categories: null,
      },
      components,
      installments: [
        { name: 'Term 1', dueDate: new Date('2025-06-30'), amount: Math.round(total / 2) },
        { name: 'Term 2', dueDate: new Date('2025-12-31'), amount: total - Math.round(total / 2) },
      ],
      finalDueDate: new Date('2026-03-31'),
      fineRules: { type: 'fixed', amount: 500, gracePeriodDays: 7, maxFine: 5000 },
      concessionRules: {
        requireApproval: true,
        maxPercentage: 25,
        allowedTypes: ['scholarship', 'sibling', 'staff_ward'],
      },
      category: 'tuition',
      totalAmount: total,
      mandatoryTotal: mandatory,
      isActive: true,
      createdBy: ctx.ownerId,
      createdAt: now,
      updatedAt: now,
    });
    ctx.feeStructureIds.push(fsId);
  }
  await db.collection('fee_structures').insertMany(fsDocs);
  ctx.counts.fee_structures = fsDocs.length;

  // Fee assignments — one per student
  const faDocs = [];
  for (let i = 0; i < ctx.studentIds.length; i++) {
    const studentId = ctx.studentIds[i]!;
    const gradeOrder = Math.floor(i / 12) + 1;
    const fs = fsDocs[gradeOrder - 1]!;
    const components = fs.components.map((c) => ({
      componentCode: c.code,
      name: c.name,
      originalAmount: c.amount,
      discountAmount: 0,
      finalAmount: c.amount,
      taxAmount: 0,
      totalAmount: c.amount,
      type: c.type,
    }));
    // 30% have partial payment, 10% fully paid, rest unpaid
    const r = Math.random();
    const totalPaid = r < 0.1 ? fs.totalAmount : r < 0.4 ? Math.round(fs.totalAmount / 2) : 0;
    const balance = fs.totalAmount - totalPaid;
    faDocs.push({
      _id: new ObjectId(),
      tenantId,
      branchId: branch1Id,
      studentId,
      academicBatchId: ctx.batchId,
      feeStructureId: fs._id,
      type: 'tuition',
      components,
      installments: fs.installments,
      summary: {
        totalFee: fs.totalAmount,
        totalDiscount: 0,
        totalTax: 0,
        netPayable: fs.totalAmount,
        totalPaid,
        totalFine: 0,
        balance,
      },
      concessions: [],
      status: 'active',
      createdBy: ctx.ownerId,
      createdAt: now,
      updatedAt: now,
    });
  }
  await db.collection('fee_assignments').insertMany(faDocs);
  ctx.feeAssignmentIds = faDocs.map((fa) => fa._id);
  ctx.counts.fee_assignments = faDocs.length;

  // Fee transactions — for the paid ones
  const txDocs = [];
  let receiptCounter = 1;
  for (const fa of faDocs) {
    if (fa.summary.totalPaid > 0) {
      txDocs.push({
        _id: new ObjectId(),
        tenantId,
        branchId: branch1Id,
        receiptNumber: `RCP26${String(receiptCounter).padStart(6, '0')}`,
        studentId: fa.studentId,
        feeAssignmentId: fa._id,
        academicBatchId: ctx.batchId,
        type: 'collection',
        amount: fa.summary.totalPaid,
        paymentMethod: pick(['CASH', 'UPI', 'BANK_TRANSFER', 'CARD']),
        paymentDate: ago(rand(7, 60)),
        components: fa.components.map((c) => ({
          componentCode: c.componentCode,
          name: c.name,
          paidAmount: Math.round(c.totalAmount * (fa.summary.totalPaid / fa.summary.totalFee)),
        })),
        reference: pick(['UPI: 4538274', 'NEFT: HDFC2378', 'Cash counter', 'POS terminal']),
        status: 'completed',
        collectedBy: ctx.accountantUserId,
        createdBy: ctx.accountantUserId,
        createdAt: ago(rand(7, 60)),
        updatedAt: now,
      });
      receiptCounter++;
    }
  }
  if (txDocs.length > 0) await db.collection('fee_transactions').insertMany(txDocs);
  ctx.counts.fee_transactions = txDocs.length;
}

// ---- transport --------------------------------------------------------------

async function seedTransport(db: Db, tenantId: ObjectId, ctx: SeedCtx) {
  const { branch1Id } = ctx;

  const buses = [
    {
      _id: new ObjectId(),
      tenantId,
      branchId: branch1Id,
      busNumber: 'KA-01-1234',
      name: 'Sapphire Express',
      type: 'standard',
      capacity: 45,
      driverName: 'Manjunath K',
      driverPhone: '+919845001234',
      conductorName: 'Ravi Shetty',
      conductorPhone: '+919845001235',
      vehicleRegistration: 'KA01AB1234',
      startLocation: {
        name: 'School Main Gate',
        address: 'Greenfield Public School, Indiranagar, Bangalore',
        placeId: 'mock-place-school',
        location: { lat: 12.9716, lng: 77.5946 },
      },
      stops: [
        {
          _id: new ObjectId(),
          name: 'Indiranagar Metro',
          address: 'Indiranagar Metro Station, Bangalore',
          placeId: 'mock-stop-1',
          location: { lat: 12.9784, lng: 77.6408 },
          sequence: 0,
          pickupTime: '07:15',
          dropTime: '15:45',
          fare: null,
          enrolledStudents: 0,
        },
        {
          _id: new ObjectId(),
          name: 'CMH Road',
          address: 'CMH Road, Bangalore',
          placeId: 'mock-stop-2',
          location: { lat: 12.9748, lng: 77.6402 },
          sequence: 1,
          pickupTime: '07:25',
          dropTime: '15:55',
          fare: null,
          enrolledStudents: 0,
        },
        {
          _id: new ObjectId(),
          name: 'Domlur Junction',
          address: 'Domlur Junction, Bangalore',
          placeId: 'mock-stop-3',
          location: { lat: 12.9617, lng: 77.6387 },
          sequence: 2,
          pickupTime: '07:35',
          dropTime: '16:05',
          fare: null,
          enrolledStudents: 0,
        },
      ],
      routePolyline: null,
      totalDistanceMeters: 12000,
      totalDurationSeconds: 1800,
      pricing: { mode: 'flat', flatPrice: 2500, currency: 'INR', frequency: 'monthly' },
      enrolledCount: 0,
      status: 'active',
      notes: 'AC bus with GPS tracking',
      createdBy: ctx.ownerId,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: new ObjectId(),
      tenantId,
      branchId: branch1Id,
      busNumber: 'KA-01-5678',
      name: 'Emerald Cruiser',
      type: 'standard',
      capacity: 40,
      driverName: 'Krishna Murthy',
      driverPhone: '+919845005678',
      conductorName: null,
      conductorPhone: null,
      vehicleRegistration: 'KA01CD5678',
      startLocation: {
        name: 'School Main Gate',
        address: 'Greenfield Public School, Indiranagar, Bangalore',
        placeId: 'mock-place-school',
        location: { lat: 12.9716, lng: 77.5946 },
      },
      stops: [
        {
          _id: new ObjectId(),
          name: 'Whitefield Main Road',
          address: 'Whitefield, Bangalore',
          placeId: 'mock-stop-4',
          location: { lat: 12.9698, lng: 77.7499 },
          sequence: 0,
          pickupTime: '06:50',
          dropTime: '16:20',
          fare: 3000,
          enrolledStudents: 0,
        },
        {
          _id: new ObjectId(),
          name: 'Marathahalli Bridge',
          address: 'Marathahalli, Bangalore',
          placeId: 'mock-stop-5',
          location: { lat: 12.9591, lng: 77.6974 },
          sequence: 1,
          pickupTime: '07:05',
          dropTime: '16:35',
          fare: 2500,
          enrolledStudents: 0,
        },
        {
          _id: new ObjectId(),
          name: 'HAL Old Airport Road',
          address: 'HAL, Bangalore',
          placeId: 'mock-stop-6',
          location: { lat: 12.9606, lng: 77.648 },
          sequence: 2,
          pickupTime: '07:20',
          dropTime: '16:50',
          fare: 2000,
          enrolledStudents: 0,
        },
      ],
      routePolyline: null,
      totalDistanceMeters: 18000,
      totalDurationSeconds: 2700,
      pricing: { mode: 'per_stop', flatPrice: null, currency: 'INR', frequency: 'monthly' },
      enrolledCount: 0,
      status: 'active',
      notes: null,
      createdBy: ctx.ownerId,
      createdAt: now,
      updatedAt: now,
    },
  ];
  await db.collection('transport_buses').insertMany(buses);
  ctx.busIds = buses.map((b) => b._id);
  ctx.counts.transport_buses = buses.length;

  // Transport enrollments — 10 students
  const enrollDocs = [];
  for (let i = 0; i < 10; i++) {
    const bus = buses[i % 2]!;
    const stop = bus.stops[i % bus.stops.length]!;
    const studentId = ctx.studentIds[i]!;
    const studentDoc = await db.collection('students').findOne({ _id: studentId });
    const isFlat = bus.pricing.mode === 'flat';
    const price = isFlat ? bus.pricing.flatPrice! : (stop.fare ?? 2500);
    enrollDocs.push({
      _id: new ObjectId(),
      tenantId,
      branchId: branch1Id,
      busId: bus._id,
      busNumber: bus.busNumber,
      busName: bus.name,
      stopId: stop._id,
      stopName: stop.name,
      pickupTime: stop.pickupTime,
      dropTime: stop.dropTime,
      studentId,
      studentName: studentDoc?.displayName ?? 'Student',
      admissionNumber: studentDoc?.admissionNumber ?? null,
      classId: studentDoc?.currentEnrollment?.classId ?? null,
      className: studentDoc?.currentEnrollment?.className ?? null,
      sectionId: studentDoc?.currentEnrollment?.sectionId ?? null,
      sectionName: studentDoc?.currentEnrollment?.sectionName ?? null,
      pickupEnabled: true,
      dropEnabled: true,
      startDate: ago(60),
      priceSnapshot: price,
      frequencySnapshot: 'monthly',
      pricingModeSnapshot: bus.pricing.mode,
      currencySnapshot: 'INR',
      status: 'active',
      createdBy: ctx.ownerId,
      createdAt: ago(60),
      updatedAt: now,
    });
  }
  await db.collection('transport_enrollments').insertMany(enrollDocs);
  ctx.counts.transport_enrollments = enrollDocs.length;

  // Update bus enrolled counts
  for (const bus of buses) {
    const cnt = enrollDocs.filter((e) => e.busId.equals(bus._id)).length;
    await db
      .collection('transport_buses')
      .updateOne({ _id: bus._id }, { $set: { enrolledCount: cnt } });
  }
}

// ---- teaching: timetable, lesson plans, assignments, grades -----------------

async function seedTeaching(db: Db, tenantId: ObjectId, ctx: SeedCtx) {
  const { branch1Id, teacherStaffId } = ctx;
  // Pick Grade 5, Section A as the demo section (so it's in the middle)
  const demoClass = ctx.classMap[4]!; // Grade 5
  const demoSection = demoClass.sections[0]!;

  // Timetable slots (6 periods)
  const slots = [];
  for (let p = 1; p <= 6; p++) {
    const startHour = 8 + p - 1;
    const slotId = new ObjectId();
    slots.push({
      _id: slotId,
      tenantId,
      branchId: branch1Id,
      classId: demoClass.classId,
      name: `Period ${p}`,
      startTime: `${String(startHour).padStart(2, '0')}:00`,
      endTime: `${String(startHour).padStart(2, '0')}:45`,
      type: 'period',
      order: p,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
  }
  await db.collection('timetable_slots').insertMany(slots);
  ctx.counts.timetable_slots = slots.length;

  // Timetable entries — Mon-Fri, 6 periods each
  const entries = [];
  for (let day = 1; day <= 5; day++) {
    for (let p = 0; p < 6; p++) {
      entries.push({
        _id: new ObjectId(),
        tenantId,
        branchId: branch1Id,
        sectionId: demoSection.sectionId,
        subjectId: ctx.subjectIds[(day + p) % ctx.subjectIds.length],
        teacherId: pick(ctx.staffIds.slice(0, 6)),
        slotId: slots[p]!._id,
        dayOfWeek: day,
        roomNumber: '5A',
        notes: null,
        groupId: new ObjectId(),
        isMandatory: true,
        studentIds: null,
        linkedSectionIds: null,
        createdBy: ctx.ownerId,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  await db.collection('timetable_entries').insertMany(entries);
  ctx.counts.timetable_entries = entries.length;

  // Lesson plans (2 published)
  const lessonPlans = [
    {
      _id: new ObjectId(),
      tenantId,
      branchId: branch1Id,
      teacherId: teacherStaffId,
      teacherName: 'Anjali Sharma',
      sectionId: demoSection.sectionId,
      sectionName: demoSection.name,
      subjectId: ctx.subjectIds[0]!,
      subjectName: 'Mathematics',
      slotId: slots[0]!._id,
      title: 'Fractions: Equivalent and Comparing',
      date: ago(2),
      duration: 45,
      description:
        'Begin with a quick recap of proper and improper fractions. Use a number line to introduce equivalent fractions visually. Hand out worksheet for pair practice.',
      objectives: [
        'Identify equivalent fractions',
        'Compare two fractions using cross-multiplication',
        'Convert improper fractions to mixed numbers',
      ],
      topics: [],
      resources: ['NCERT Maths Ch. 7', 'Fraction wall poster', 'Worksheet: Equivalent fractions'],
      status: 'published',
      teachingStatus: 'completed',
      createdAt: ago(2),
      updatedAt: now,
    },
    {
      _id: new ObjectId(),
      tenantId,
      branchId: branch1Id,
      teacherId: teacherStaffId,
      teacherName: 'Anjali Sharma',
      sectionId: demoSection.sectionId,
      sectionName: demoSection.name,
      subjectId: ctx.subjectIds[2]!,
      subjectName: 'Science',
      slotId: slots[1]!._id,
      title: 'States of Matter — Solids, Liquids, Gases',
      date: future(1),
      duration: 45,
      description:
        'Demonstrate states of matter using ice (solid), water (liquid), and a balloon (gas). Discuss particle arrangement using a sand-and-jar model.',
      objectives: [
        'Differentiate between three states of matter',
        'Explain particle behaviour in each state',
        'Identify changes of state in everyday life',
      ],
      topics: [],
      resources: [
        'NCERT Science Ch. 5',
        'Ice, water, balloon for demo',
        'Worksheet: States of matter',
      ],
      status: 'published',
      teachingStatus: 'planned',
      createdAt: now,
      updatedAt: now,
    },
  ];
  await db.collection('lesson_plans').insertMany(lessonPlans);
  ctx.counts.lesson_plans = lessonPlans.length;

  // Assignments + grades
  const assignment1Id = new ObjectId();
  const assignment2Id = new ObjectId();
  await db.collection('assignments').insertMany([
    {
      _id: assignment1Id,
      tenantId,
      branchId: branch1Id,
      teacherId: teacherStaffId,
      teacherName: 'Anjali Sharma',
      sectionId: demoSection.sectionId,
      sectionName: demoSection.name,
      subjectId: ctx.subjectIds[0],
      subjectName: 'Mathematics',
      title: 'Fractions Worksheet',
      description: 'Complete problems 1-10 from the worksheet on equivalent fractions.',
      type: 'homework',
      totalMarks: 20,
      hasQuestions: false,
      assignedDate: ago(5),
      dueDate: ago(1),
      status: 'completed',
      publishedAt: ago(5),
      completedAt: now,
      createdAt: ago(5),
      updatedAt: now,
    },
    {
      _id: assignment2Id,
      tenantId,
      branchId: branch1Id,
      teacherId: teacherStaffId,
      teacherName: 'Anjali Sharma',
      sectionId: demoSection.sectionId,
      sectionName: demoSection.name,
      subjectId: ctx.subjectIds[2],
      subjectName: 'Science',
      title: 'States of Matter Quiz',
      description: 'Take-home quiz on states of matter, due next Monday.',
      type: 'test',
      totalMarks: 25,
      hasQuestions: false,
      assignedDate: ago(1),
      dueDate: future(6),
      status: 'published',
      publishedAt: ago(1),
      completedAt: null,
      createdAt: ago(1),
      updatedAt: now,
    },
  ]);
  ctx.counts.assignments = 2;

  // Grades for assignment1 — students in Grade 5 Section A
  const grade5SectionA = ctx.studentIds.filter((_, idx) => {
    const gradeIdx = Math.floor(idx / 12);
    const sectionIdx = idx % 3;
    return gradeIdx === 4 && sectionIdx === 0;
  });
  if (grade5SectionA.length > 0) {
    const grades = grade5SectionA.map((sid) => ({
      _id: new ObjectId(),
      assignmentId: assignment1Id,
      studentId: sid,
      tenantId,
      branchId: branch1Id,
      marksObtained: rand(12, 20),
      totalMarks: 20,
      percentage: 0, // computed below
      remarks: pick(['Excellent', 'Good work', 'Needs improvement', 'Well done', null]),
      gradedAt: ago(0),
      gradedBy: ctx.teacherUserId,
      createdAt: now,
      updatedAt: now,
    }));
    grades.forEach((g) => {
      g.percentage = Math.round((g.marksObtained / g.totalMarks) * 100);
    });
    await db.collection('grades').insertMany(grades);
    ctx.counts.grades = grades.length;
  }
}

// ---- feed (announcements) ---------------------------------------------------

async function seedFeed(db: Db, tenantId: ObjectId, ctx: SeedCtx) {
  const { branch1Id } = ctx;
  await db.collection('feed_posts').insertMany([
    {
      _id: new ObjectId(),
      tenantId,
      branchId: branch1Id,
      content:
        '🎉 Annual Sports Day is on Saturday, May 17. Parents are warmly invited to attend. Schedule and venue map have been shared via SMS.',
      media: [],
      audience: 'everyone',
      authorId: ctx.branchAdminId,
      authorSnapshot: {
        name: 'Priya Menon',
        avatar: null,
        roleCode: 'BRANCH_ADMIN',
        roleLabel: 'Principal',
      },
      likedBy: [],
      likeCount: 0,
      commentCount: 0,
      comments: [],
      isPinned: true,
      isFlagged: false,
      status: 'active',
      createdAt: ago(2),
      updatedAt: ago(2),
    },
    {
      _id: new ObjectId(),
      tenantId,
      branchId: branch1Id,
      content:
        'Reminder: Mid-term exams begin next Monday. Detailed time tables have been circulated to class teachers. Please ensure all dues are cleared before the exam date.',
      media: [],
      audience: 'everyone',
      authorId: ctx.ownerId,
      authorSnapshot: {
        name: 'Rajesh Krishnan',
        avatar: null,
        roleCode: 'GROUP_OWNER',
        roleLabel: 'Owner',
      },
      likedBy: [],
      likeCount: 0,
      commentCount: 0,
      comments: [],
      isPinned: false,
      isFlagged: false,
      status: 'active',
      createdAt: ago(5),
      updatedAt: ago(5),
    },
  ]);
  ctx.counts.feed_posts = 2;
}

// ---- module settings --------------------------------------------------------

async function seedSettings(db: Db, tenantId: ObjectId, ctx: SeedCtx) {
  const { branch1Id } = ctx;

  await db.collection('finance_settings').insertOne({
    _id: new ObjectId(),
    branchId: branch1Id,
    tenantId,
    bankAccounts: [],
    paymentMethods: [
      {
        code: 'CASH',
        name: 'Cash',
        type: 'cash',
        isEnabled: true,
        requiresReference: false,
        requiresBankDetails: false,
        order: 1,
      },
      {
        code: 'UPI',
        name: 'UPI',
        type: 'upi',
        isEnabled: true,
        requiresReference: true,
        requiresBankDetails: false,
        order: 2,
      },
      {
        code: 'CARD',
        name: 'Credit/Debit Card',
        type: 'card',
        isEnabled: true,
        requiresReference: true,
        requiresBankDetails: false,
        order: 3,
      },
      {
        code: 'BANK_TRANSFER',
        name: 'Bank Transfer',
        type: 'bank_transfer',
        isEnabled: true,
        requiresReference: true,
        requiresBankDetails: true,
        order: 4,
      },
      {
        code: 'CHEQUE',
        name: 'Cheque',
        type: 'cheque',
        isEnabled: true,
        requiresReference: true,
        requiresBankDetails: true,
        order: 5,
      },
    ],
    receiptSettings: {
      prefix: 'RCP',
      padding: 6,
      includeYear: true,
      yearFormat: '2',
      showQRCode: true,
      footerText: 'Thank you. Computer-generated receipt.',
      duplicateCopies: 2,
    },
    concessionSettings: {
      maxPercentage: 25,
      maxAmount: 0,
      requiresApproval: true,
      approvalThreshold: 5000,
      eligibleCategories: ['Sibling', 'Merit', 'Staff Ward'],
      allowMultipleConcessions: false,
      allowedReasons: ['Sibling discount', 'Merit-based scholarship', 'Staff ward discount'],
    },
    cancellationSettings: {
      allowedWithinDays: 30,
      requiresApproval: true,
      approvalRoles: ['BRANCH_ADMIN', 'ACCOUNTANT'],
      allowPartialCancellation: true,
      refundDeductionPercentage: 0,
      refundDeductionFixed: 0,
    },
    orgFeeSettings: {
      defaultDueDay: 10,
      penaltyStartAfterDays: 15,
      penaltyType: 'percentage',
      penaltyValue: 2,
      maxPenaltyCap: 5000,
      reminderBeforeDays: [7, 3, 1],
      autoLockAfterDueDays: 90,
    },
    walletCategories: [],
    mandatoryFields: {},
    createdAt: now,
    updatedAt: now,
  });
  ctx.counts.finance_settings = 1;

  await db.collection('attendance_settings').insertOne({
    _id: new ObjectId(),
    branchId: branch1Id,
    tenantId,
    generalSettings: {
      workingDays: [1, 2, 3, 4, 5, 6],
      startTime: '08:00',
      endTime: '15:30',
      lateThresholdMinutes: 15,
      halfDayThresholdMinutes: 180,
      autoLockAfterDays: 7,
      requireRemarks: false,
      allowFutureAttendance: false,
      lowAttendanceThreshold: 75,
      excludeHolidays: true,
    },
    attendanceStatuses: [
      {
        code: 'PRESENT',
        name: 'Present',
        color: '#10B981',
        countsAsPresent: true,
        countsAsAbsent: false,
        countsAsHalfDay: false,
        requiresRemarks: false,
        isActive: true,
      },
      {
        code: 'ABSENT',
        name: 'Absent',
        color: '#EF4444',
        countsAsPresent: false,
        countsAsAbsent: true,
        countsAsHalfDay: false,
        requiresRemarks: false,
        isActive: true,
      },
      {
        code: 'LATE',
        name: 'Late',
        color: '#F59E0B',
        countsAsPresent: true,
        countsAsAbsent: false,
        countsAsHalfDay: false,
        requiresRemarks: true,
        isActive: true,
      },
      {
        code: 'HALF_DAY',
        name: 'Half Day',
        color: '#3B82F6',
        countsAsPresent: false,
        countsAsAbsent: false,
        countsAsHalfDay: true,
        requiresRemarks: false,
        isActive: true,
      },
      {
        code: 'EXCUSED',
        name: 'Excused Absence',
        color: '#8B5CF6',
        countsAsPresent: false,
        countsAsAbsent: false,
        countsAsHalfDay: false,
        requiresRemarks: true,
        isActive: true,
      },
      {
        code: 'HOLIDAY',
        name: 'Holiday',
        color: '#6B7280',
        countsAsPresent: false,
        countsAsAbsent: false,
        countsAsHalfDay: false,
        requiresRemarks: false,
        isActive: true,
      },
    ],
    alertSettings: {
      lowAttendanceAlert: true,
      lowAttendanceThreshold: 75,
      parentNotification: true,
      notificationChannels: ['sms', 'email'],
      alertFrequency: 'weekly',
    },
    exportSettings: {
      defaultFormat: 'xlsx',
      includeHolidays: true,
      includeWeekends: false,
      showPercentage: true,
    },
    createdAt: now,
    updatedAt: now,
  });
  ctx.counts.attendance_settings = 1;

  await db.collection('admission_settings').insertOne({
    _id: new ObjectId(),
    tenantId,
    branchId: branch1Id,
    applicationNumber: {
      prefix: 'APP',
      startingNumber: 1,
      currentNumber: 0,
      padding: 5,
      includeYear: true,
      yearFormat: '2',
      resetYearly: true,
    },
    admissionNumber: {
      prefix: 'ADM',
      startingNumber: 1,
      currentNumber: 0,
      padding: 5,
      includeYear: true,
      yearFormat: '2',
      resetYearly: true,
    },
    leadCode: {
      prefix: 'LEAD',
      startingNumber: 1,
      currentNumber: 0,
      padding: 4,
      includeYear: true,
      yearFormat: '4',
      resetYearly: true,
    },
    enrollmentCode: {
      prefix: 'ENR',
      startingNumber: 1,
      currentNumber: 0,
      padding: 5,
      includeYear: true,
      yearFormat: '2',
      resetYearly: false,
    },
    taskNumber: {
      prefix: 'TASK',
      startingNumber: 1,
      currentNumber: 0,
      padding: 4,
      includeYear: true,
      yearFormat: '4',
      separator: '-',
      resetYearly: true,
    },
    enquiryStages: [
      { code: 'new', name: 'New', order: 0, color: '#64748b', isDefault: true },
      { code: 'contacted', name: 'Contacted', order: 1, color: '#3b82f6' },
      { code: 'followup', name: 'Follow-up', order: 2, color: '#f59e0b' },
      { code: 'interested', name: 'Interested', order: 3, color: '#8b5cf6' },
      { code: 'visit_scheduled', name: 'Visit Scheduled', order: 5, color: '#06b6d4' },
      { code: 'visited', name: 'Visited', order: 6, color: '#10b981' },
      { code: 'converted', name: 'Converted', order: 998, color: '#22c55e', isTerminal: true },
      { code: 'lost', name: 'Lost', order: 999, color: '#ef4444', isTerminal: true },
    ],
    applicationFee: {
      enabled: false,
      amount: 0,
      currency: 'INR',
      paymentModes: ['cash', 'upi', 'card'],
    },
    requiredFields: {
      student: ['firstName', 'lastName', 'dateOfBirth', 'gender'],
      parents: ['father.name', 'father.phone'],
      documents: [],
      previousEducation: [],
    },
    documentTypes: [
      {
        code: 'birth_certificate',
        name: 'Birth Certificate',
        required: true,
        category: 'identity',
      },
      { code: 'aadhar_card', name: 'Aadhar Card', required: true, category: 'identity' },
      { code: 'previous_tc', name: 'Transfer Certificate', required: false, category: 'academic' },
      { code: 'photo', name: 'Passport Photo', required: true, category: 'other' },
    ],
    webForms: { enquiry: { enabled: false }, application: { enabled: false } },
    createdAt: now,
    updatedAt: now,
  });
  ctx.counts.admission_settings = 1;
}

// ---- output ----------------------------------------------------------------

function printSummary(ctx: SeedCtx) {
  console.log('Seeded counts:');
  for (const [k, v] of Object.entries(ctx.counts)) {
    console.log(`  ${k.padEnd(28)} ${v}`);
  }
}

function printCredentials() {
  console.log('\n📋 Demo Login Credentials (password: ' + PASSWORD + ')');
  console.log('  ┌──────────────────┬───────────────────────────────────┐');
  console.log('  │ Role             │ Email                             │');
  console.log('  ├──────────────────┼───────────────────────────────────┤');
  console.log('  │ Group Owner      │ owner@greenfield.demo             │');
  console.log('  │ Principal        │ principal@greenfield.demo         │');
  console.log('  │ Teacher          │ teacher@greenfield.demo           │');
  console.log('  │ Accountant       │ accountant@greenfield.demo        │');
  console.log('  │ Admissions       │ admissions@greenfield.demo        │');
  console.log('  └──────────────────┴───────────────────────────────────┘');
}

function printCleanup(tenantId: ObjectId) {
  console.log('\n🧹 To remove this demo tenant entirely after the demo, run:');
  console.log(
    `     pnpm --filter @campus-verse/api exec tsx src/scripts/cleanup-demo-school.ts ${tenantId}`
  );
  console.log('   (cleanup script also created — see apps/api/src/scripts/cleanup-demo-school.ts)');
}

// ---- rollback (for failed seeds) -------------------------------------------

async function rollback(db: Db, tenantId: ObjectId) {
  const colls = [
    'tenants',
    'branches',
    'roles',
    'users',
    'academic_batches',
    'departments',
    'designations',
    'subjects',
    'staff',
    'classes',
    'sections',
    'students',
    'student_enrollments',
    'admission_sources',
    'leads',
    'applications',
    'fee_structures',
    'fee_assignments',
    'fee_transactions',
    'transport_buses',
    'transport_enrollments',
    'timetable_slots',
    'timetable_entries',
    'lesson_plans',
    'assignments',
    'grades',
    'feed_posts',
    'finance_settings',
    'attendance_settings',
    'admission_settings',
  ];
  let total = 0;
  for (const c of colls) {
    if (c === 'tenants') {
      const r = await db.collection(c).deleteMany({ _id: tenantId });
      total += r.deletedCount;
    } else {
      const r = await db.collection(c).deleteMany({ tenantId });
      total += r.deletedCount;
    }
  }
  console.log(`Rolled back ${total} documents.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Seed TWO complete organisations owned by one person, to exercise the
 * multi-org switcher and both institution shapes side by side:
 *
 *   SURYAUNI  "Surya Institute of Technology" (university)
 *               Main Campus  — CS/ME/EE × Years 1-4
 *               City Campus  — CS/EE     × Years 1-2
 *   SURYASCH  "Surya Public School" (school)
 *               Central Campus — Grades 1-8 × A,B
 *               North Campus   — Grades 1-5 × A
 *
 * Owner logs in as suryatejuni@yopmail.com and switches between them (the app
 * keys organisations off one user document PER TENANT sharing an email).
 *
 * Each org gets: branches, academic year (+semesters for the university),
 * departments, designations, staff with teacher logins, subjects, classes,
 * sections with subjects+teachers, students with logins, fee structures and
 * assignments, attendance registers, and a completed exam with published
 * report cards. The university additionally gets published curricula and
 * course registrations, plus computed SGPA/CGPA and backlogs.
 *
 * Usage:
 *   pnpm --filter @campus-verse/api exec tsx src/scripts/seed-surya-orgs.ts
 *
 * Idempotent: refuses to run if either tenant code exists. Rolls back on
 * failure. All logins use password: Demo@1234
 */

import { MongoClient, Db, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import * as path from 'path';
import {
  PERMISSIONS,
  ORG_ADMIN_PERMISSIONS,
  BRANCH_ADMIN_PERMISSIONS,
  TEACHER_PERMISSIONS,
  ACCOUNTANT_PERMISSIONS,
  STUDENT_PERMISSIONS,
  SYSTEM_ROLES,
  ROLE_HIERARCHY,
  BOARD_PRESET_CONFIG,
  DEFAULT_CO_SCHOLASTIC_AREAS,
  DEFAULT_CO_SCHOLASTIC_GRADES,
  defaultModulesFor,
  defaultBoardPresetFor,
  gradeForPercent,
  type GradingScaleBand,
} from '@campus-verse/shared/constants';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const URI = process.env.MONGODB_URI;
const OWNER_EMAIL = 'suryatejuni@yopmail.com';
const PASSWORD = 'Demo@1234';
const UNI_CODE = 'SURYAUNI';
const SCH_CODE = 'SURYASCH';
const DAY = 24 * 60 * 60 * 1000;

// Deterministic pseudo-random so re-seeds look the same.
let seedCounter = 7;
function rand(min: number, max: number): number {
  seedCounter = (seedCounter * 1103515245 + 12345) & 0x7fffffff;
  return min + (seedCounter % (max - min + 1));
}

const FIRST = [
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
  'Vihaan',
  'Atharv',
  'Shaurya',
  'Anaya',
  'Ira',
  'Zara',
];
const LAST = [
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
let nameSeq = 0;
function nextName() {
  const f = FIRST[nameSeq % FIRST.length];
  const l = LAST[Math.floor(nameSeq / 3) % LAST.length];
  nameSeq++;
  return { firstName: f, lastName: l, displayName: `${f} ${l}` };
}

const DESIGNATIONS_UNI = [
  { name: 'Professor', code: 'PROF', category: 'teaching' as const, level: 1 },
  { name: 'Associate Professor', code: 'ASSOCPROF', category: 'teaching' as const, level: 2 },
  { name: 'Assistant Professor', code: 'ASSTPROF', category: 'teaching' as const, level: 3 },
  { name: 'Lab Assistant', code: 'LABASST', category: 'teaching' as const, level: 5 },
  { name: 'Registrar', code: 'REGISTRAR', category: 'management' as const, level: 1 },
  { name: 'Accountant', code: 'ACCT', category: 'non-teaching' as const, level: 4 },
];
const DESIGNATIONS_SCH = [
  { name: 'Principal', code: 'PRINCIPAL', category: 'management' as const, level: 1 },
  { name: 'Senior Teacher', code: 'SRTEACHER', category: 'teaching' as const, level: 2 },
  { name: 'Teacher', code: 'TEACHER', category: 'teaching' as const, level: 3 },
  { name: 'Lab Assistant', code: 'LABASST', category: 'teaching' as const, level: 5 },
  { name: 'Accountant', code: 'ACCT', category: 'non-teaching' as const, level: 4 },
];

// ─── University curriculum ──────────────────────────────────────────────────

interface SubjectSeed {
  code: string;
  name: string;
  credits?: number;
  category?: 'DSC' | 'DSE' | 'GE' | 'AECC' | 'SEC' | 'VAC';
}

const UNI_SUBJECTS: Record<
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
      ],
      electives: [
        { code: 'ME351', name: 'Automotive Engineering', credits: 3, category: 'DSE' },
        { code: 'ME352', name: 'Renewable Energy Systems', credits: 3, category: 'DSE' },
      ],
    },
  },
  EE: {
    1: {
      cores: [
        { code: 'EE101', name: 'Basic Electrical Engineering', credits: 4, category: 'DSC' },
        { code: 'MA103', name: 'Engineering Mathematics I (EE)', credits: 4, category: 'DSC' },
      ],
      electives: [
        { code: 'EE151', name: 'Electronics Workshop', credits: 3, category: 'SEC' },
        { code: 'EE152', name: 'Circuit Simulation', credits: 3, category: 'SEC' },
      ],
    },
    3: {
      cores: [
        { code: 'EE301', name: 'Signals & Systems', credits: 4, category: 'DSC' },
        { code: 'EE302', name: 'Control Systems', credits: 4, category: 'DSC' },
      ],
      electives: [
        { code: 'EE351', name: 'Power Electronics', credits: 3, category: 'DSE' },
        { code: 'EE352', name: 'Embedded Systems', credits: 3, category: 'DSE' },
      ],
    },
  },
};

const SCHOOL_SUBJECTS: SubjectSeed[] = [
  { code: 'ENG', name: 'English' },
  { code: 'MATH', name: 'Mathematics' },
  { code: 'SCI', name: 'Science' },
  { code: 'SST', name: 'Social Studies' },
  { code: 'HIN', name: 'Hindi' },
  { code: 'COMP', name: 'Computer Science' },
  { code: 'PE', name: 'Physical Education' },
];

const UNI_DEPARTMENTS = [
  { code: 'CS', name: 'Computer Science' },
  { code: 'ME', name: 'Mechanical Engineering' },
  { code: 'EE', name: 'Electrical Engineering' },
];
const SCHOOL_DEPARTMENTS = [
  { code: 'PRI', name: 'Primary' },
  { code: 'SEC', name: 'Secondary' },
  { code: 'ADMIN', name: 'Administration' },
];

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

  for (const code of [UNI_CODE, SCH_CODE]) {
    const existing = await db.collection('tenants').findOne({ code });
    if (existing) {
      console.error(`\n⛔ Tenant "${code}" already exists (${existing._id}). Refusing to seed.`);
      printCleanup([existing._id as ObjectId]);
      await client.close();
      process.exit(1);
    }
  }

  const uniId = new ObjectId();
  const schId = new ObjectId();
  console.log(`\n🌱 Seeding ${UNI_CODE} (${uniId}) and ${SCH_CODE} (${schId})`);

  try {
    const passwordHash = await bcrypt.hash(PASSWORD, 12);
    const uni = await seedUniversity(db, uniId, passwordHash);
    const sch = await seedSchool(db, schId, passwordHash);

    console.log('\n✅ Both organisations seeded!\n');
    console.log(`  ${UNI_CODE}: ${uni.summary}`);
    console.log(`  ${SCH_CODE}: ${sch.summary}`);
    printCredentials();
    printCleanup([uniId, schId]);
  } catch (err) {
    console.error('\n❌ Seed failed. Rolling back both tenants...');
    await rollback(db, [uniId, schId]);
    throw err;
  } finally {
    await client.close();
  }
}

// ─── Shared builders ────────────────────────────────────────────────────────

function buildRoles(tenantId: ObjectId, now: Date) {
  const defs = [
    {
      code: SYSTEM_ROLES.GROUP_OWNER,
      name: 'Group Owner',
      perms: PERMISSIONS,
      level: ROLE_HIERARCHY[SYSTEM_ROLES.GROUP_OWNER],
      system: true,
    },
    {
      code: SYSTEM_ROLES.ORG_ADMIN,
      name: 'Org Admin',
      perms: ORG_ADMIN_PERMISSIONS,
      level: ROLE_HIERARCHY[SYSTEM_ROLES.ORG_ADMIN],
      system: true,
    },
    {
      code: SYSTEM_ROLES.BRANCH_ADMIN,
      name: 'Branch Admin',
      perms: BRANCH_ADMIN_PERMISSIONS,
      level: ROLE_HIERARCHY[SYSTEM_ROLES.BRANCH_ADMIN],
      system: true,
    },
    { code: 'TEACHER', name: 'Teacher', perms: TEACHER_PERMISSIONS, level: 10, system: false },
    {
      code: 'ACCOUNTANT',
      name: 'Accountant',
      perms: ACCOUNTANT_PERMISSIONS,
      level: 10,
      system: false,
    },
    { code: 'STUDENT', name: 'Student', perms: STUDENT_PERMISSIONS, level: 100, system: true },
  ];
  return defs.map((r) => ({
    _id: new ObjectId(),
    tenantId,
    name: r.name,
    code: r.code,
    isSystemRole: r.system,
    level: r.level,
    permissions: r.perms,
    createdAt: now,
    updatedAt: now,
  }));
}

function addressFor(city: string, state: string, line1: string, pincode: string) {
  return { line1, city, state, country: 'India', pincode };
}

/** Exam settings seeded with the preset matching the institution type. */
function buildExamSettings(
  tenantId: ObjectId,
  branchId: ObjectId,
  institutionType: string,
  now: Date
) {
  const preset = defaultBoardPresetFor(institutionType);
  const cfg = BOARD_PRESET_CONFIG[preset as 'cbse' | 'ugc'];
  return {
    _id: new ObjectId(),
    tenantId,
    branchId,
    boardPreset: preset,
    gradingScale: cfg.gradingScale,
    coScholasticEnabled: cfg.coScholasticEnabled,
    coScholasticAreas: cfg.coScholasticAreas.length
      ? cfg.coScholasticAreas
      : DEFAULT_CO_SCHOLASTIC_AREAS,
    coScholasticGrades: [...DEFAULT_CO_SCHOLASTIC_GRADES],
    passMarkPercent: cfg.passMarkPercent,
    passSubjectsRequired: 'all',
    reportCard: { showAttendance: true, showRank: true, showRemarks: true },
    hallTicket: { seatingMode: 'roll_number', showQrCode: false },
    resultNotification: { sendSms: false, sendEmail: true },
    promotion: { passMarkPercent: cfg.passMarkPercent, passSubjectsRequired: 'all' },
    createdAt: now,
    updatedAt: now,
  };
}

interface StaffSpec {
  designationCode: string;
  departmentCode: string;
  isTeacher: boolean;
}

/** Create staff docs (+ user logins for teachers) for one branch. */
async function seedStaff(
  db: Db,
  tenantId: ObjectId,
  branchId: ObjectId,
  branchPrefix: string,
  specs: StaffSpec[],
  deptIdByCode: Map<string, ObjectId>,
  desigIdByCode: Map<string, ObjectId>,
  teacherRoleId: ObjectId,
  passwordHash: string,
  now: Date
) {
  const staffDocs = [];
  const userDocs = [];
  const teacherStaffIds: ObjectId[] = [];
  let i = 1;

  for (const spec of specs) {
    const n = nextName();
    const staffId = new ObjectId();
    const employeeId = `${branchPrefix}-EMP${String(i).padStart(3, '0')}`;
    let userId: ObjectId | undefined;

    if (spec.isTeacher) {
      userId = new ObjectId();
      userDocs.push({
        _id: userId,
        tenantId,
        email: `${branchPrefix.toLowerCase()}.teacher${i}@yopmail.com`,
        passwordHash,
        profile: { firstName: n.firstName, lastName: n.lastName, displayName: n.displayName },
        roleId: teacherRoleId,
        accessScope: { type: 'branch' as const, branchIds: [branchId] },
        staffId,
        status: 'active',
        failedLoginAttempts: 0,
        createdAt: now,
        updatedAt: now,
      });
      teacherStaffIds.push(staffId);
    }

    staffDocs.push({
      _id: staffId,
      tenantId,
      branchId,
      employeeId,
      firstName: n.firstName,
      lastName: n.lastName,
      displayName: n.displayName,
      gender: i % 2 === 0 ? 'female' : 'male',
      dateOfBirth: new Date(1985 + (i % 12), i % 12, 12),
      contact: {
        email: `${branchPrefix.toLowerCase()}.staff${i}@yopmail.com`,
        phone: `+9198765${String(40000 + i).slice(-5)}`,
      },
      employment: {
        departmentId: deptIdByCode.get(spec.departmentCode),
        designationId: desigIdByCode.get(spec.designationCode),
        joiningDate: new Date(2020 + (i % 5), i % 12, 1),
        employmentType: 'full-time',
      },
      ...(userId && { userId }),
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
    i++;
  }

  if (staffDocs.length) await db.collection('staff').insertMany(staffDocs);
  if (userDocs.length) await db.collection('users').insertMany(userDocs);
  return { staffDocs, teacherStaffIds };
}

/** Attendance registers for the last `days` working days. */
function buildAttendance(
  tenantId: ObjectId,
  branchId: ObjectId,
  classId: ObjectId,
  sectionId: ObjectId,
  studentIds: ObjectId[],
  markedBy: ObjectId,
  days: number,
  now: Date
) {
  const docs = [];
  for (let d = 1; d <= days; d++) {
    const date = new Date(now.getTime() - d * DAY);
    if (date.getDay() === 0 || date.getDay() === 6) continue; // skip weekends
    date.setHours(0, 0, 0, 0);
    const records = studentIds.map((sid) => {
      const roll = rand(1, 100);
      const status = roll > 92 ? 'absent' : roll > 88 ? 'late' : 'present';
      return { studentId: sid, status };
    });
    docs.push({
      _id: new ObjectId(),
      tenantId,
      branchId,
      classId,
      sectionId,
      date,
      records,
      summary: {
        total: records.length,
        present: records.filter((r) => r.status === 'present').length,
        absent: records.filter((r) => r.status === 'absent').length,
        late: records.filter((r) => r.status === 'late').length,
        halfDay: 0,
        leave: 0,
      },
      markedBy,
      markedAt: date,
      isLocked: false,
    });
  }
  return docs;
}

interface ExamStudentCtx {
  studentId: ObjectId;
  studentName: string;
  admissionNumber: string;
  classId: ObjectId;
  sectionId: ObjectId;
  sectionName: string;
  className: string;
}

/**
 * Build a completed exam with marks and PUBLISHED report cards for the given
 * students. Mirrors what reportCard.service produces so transcripts and (for
 * credit-bearing subjects) SGPA/CGPA work without running the API.
 */
function buildExamWithResults(
  tenantId: ObjectId,
  branchId: ObjectId,
  academicBatchId: ObjectId,
  termId: ObjectId | undefined,
  termName: string,
  semesterNumber: number | undefined,
  examName: string,
  classIds: ObjectId[],
  papers: Array<{ subjectId: ObjectId; subjectName: string; credits?: number }>,
  students: ExamStudentCtx[],
  scale: GradingScaleBand[],
  passMarkPercent: number,
  actorId: ObjectId,
  now: Date
) {
  const examId = new ObjectId();
  const paperDocs = papers.map((p) => ({
    _id: new ObjectId(),
    subjectId: p.subjectId,
    subjectName: p.subjectName,
    totalMarks: 100,
    passMarks: passMarkPercent,
  }));

  const exam = {
    _id: examId,
    tenantId,
    branchId,
    academicBatchId,
    ...(termId && { termId }),
    termName,
    name: examName,
    type: 'end_term',
    classIds,
    papers: paperDocs,
    status: 'results_published',
    startDate: new Date(now.getTime() - 30 * DAY),
    endDate: new Date(now.getTime() - 20 * DAY),
    createdBy: actorId,
    createdAt: now,
    updatedAt: now,
  };

  const results = [];
  const reportCards = [];

  for (const s of students) {
    const scholastic = [];
    let obtained = 0;
    let total = 0;
    let allPassed = true;
    let weighted = 0;
    let credits = 0;
    let earned = 0;

    for (let pi = 0; pi < paperDocs.length; pi++) {
      const paper = paperDocs[pi];
      const credit = papers[pi].credits;
      // Mostly comfortable marks, with the occasional fail to exercise backlogs.
      const marks = rand(1, 100) > 92 ? rand(20, 38) : rand(45, 96);
      const percentage = marks;
      const band = gradeForPercent(percentage, scale);
      const passed = percentage >= passMarkPercent;
      if (!passed) allPassed = false;

      results.push({
        _id: new ObjectId(),
        tenantId,
        branchId,
        examId,
        paperId: paper._id,
        studentId: s.studentId,
        admissionNumber: s.admissionNumber,
        studentName: s.studentName,
        sectionId: s.sectionId,
        classId: s.classId,
        subjectId: paper.subjectId,
        subjectName: paper.subjectName,
        marksObtained: marks,
        totalMarks: 100,
        passMarks: passMarkPercent,
        percentage,
        grade: band?.grade,
        gradePoints: band?.points,
        passed,
        absent: false,
        enteredBy: actorId,
        enteredAt: now,
        publishedAt: now,
        publishedBy: actorId,
        createdAt: now,
        updatedAt: now,
      });

      scholastic.push({
        paperId: paper._id,
        subjectId: paper.subjectId,
        subjectName: paper.subjectName,
        marksObtained: marks,
        totalMarks: 100,
        percentage,
        grade: band?.grade,
        ...(credit !== undefined && { credits: credit }),
        ...(band?.points !== undefined && { gradePoints: band.points }),
        passed,
        absent: false,
      });

      obtained += marks;
      total += 100;
      if (credit) {
        credits += credit;
        if (band?.points !== undefined) weighted += credit * band.points;
        if (passed) earned += credit;
      }
    }

    const pct = total > 0 ? Math.round((obtained / total) * 10000) / 100 : 0;
    const overallBand = gradeForPercent(pct, scale);

    reportCards.push({
      _id: new ObjectId(),
      tenantId,
      branchId,
      examId,
      studentId: s.studentId,
      admissionNumber: s.admissionNumber,
      studentName: s.studentName,
      sectionId: s.sectionId,
      sectionName: s.sectionName,
      classId: s.classId,
      className: s.className,
      academicBatchId,
      ...(termId && { termId }),
      termName,
      ...(semesterNumber !== undefined && { semesterNumber }),
      examName,
      scholastic,
      overall: {
        totalMarksObtained: obtained,
        totalMarks: total,
        percentage: pct,
        grade: overallBand?.grade,
        passed: allPassed,
        ...(credits > 0 && {
          sgpa: Math.round((weighted / credits) * 100) / 100,
          totalCredits: credits,
          earnedCredits: earned,
        }),
      },
      status: 'published',
      generatedBy: actorId,
      generatedAt: now,
      publishedBy: actorId,
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }

  return { exam, results, reportCards };
}

/** Compute the academicSummary the exams module would produce on publish. */
function academicSummaryFrom(
  cards: Array<{
    termId?: ObjectId;
    termName: string;
    semesterNumber?: number;
    examId: ObjectId;
    scholastic: Array<{
      subjectId: ObjectId;
      subjectName: string;
      credits?: number;
      gradePoints?: number;
      passed: boolean;
      absent: boolean;
    }>;
  }>,
  now: Date
) {
  let cumWeighted = 0;
  let cumCredits = 0;
  let cumEarned = 0;
  const semesters = [];
  const backlogs = [];

  for (const card of cards) {
    let weighted = 0;
    let credits = 0;
    let earned = 0;
    for (const row of card.scholastic) {
      if (row.credits) {
        credits += row.credits;
        if (row.gradePoints !== undefined) weighted += row.credits * row.gradePoints;
        if (row.passed) earned += row.credits;
      }
      if (!row.passed) {
        backlogs.push({
          subjectId: row.subjectId.toString(),
          subjectName: row.subjectName,
          termName: card.termName,
          ...(card.termId && { termId: card.termId.toString() }),
          examId: card.examId.toString(),
          attempts: 1,
        });
      }
    }
    semesters.push({
      ...(card.termId && { termId: card.termId.toString() }),
      termName: card.termName,
      semesterNumber: card.semesterNumber,
      sgpa: credits > 0 ? Math.round((weighted / credits) * 100) / 100 : null,
      totalCredits: credits,
      earnedCredits: earned,
      subjectCount: card.scholastic.length,
    });
    cumWeighted += weighted;
    cumCredits += credits;
    cumEarned += earned;
  }

  return {
    cgpa: cumCredits > 0 ? Math.round((cumWeighted / cumCredits) * 100) / 100 : null,
    totalCredits: cumCredits,
    earnedCredits: cumEarned,
    semesters,
    backlogs,
    updatedAt: now,
  };
}

// ─── University ─────────────────────────────────────────────────────────────

async function seedUniversity(db: Db, tenantId: ObjectId, passwordHash: string) {
  const now = new Date();
  const counts: Record<string, number> = {};

  await db.collection('tenants').insertOne({
    _id: tenantId,
    tenantId: tenantId.toString(),
    name: 'Surya Institute of Technology',
    code: UNI_CODE,
    institutionTypes: ['university'],
    contact: {
      email: OWNER_EMAIL,
      phone: '+919876500100',
      address: addressFor('Hyderabad', 'Telangana', '1 Surya Campus Road', '500032'),
    },
    branding: { primaryColor: '#7C3AED', secondaryColor: '#A78BFA' },
    subscription: {
      plan: 'enterprise',
      maxBranches: 5,
      maxStudents: 10000,
      maxStaff: 500,
      features: defaultModulesFor('university').concat(['communications', 'finance', 'admissions']),
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

  const roles = buildRoles(tenantId, now);
  await db.collection('roles').insertMany(roles);
  const roleId = Object.fromEntries(roles.map((r) => [r.code, r._id]));

  // Branches
  const mainId = new ObjectId();
  const cityId = new ObjectId();
  await db.collection('branches').insertMany([
    {
      _id: mainId,
      tenantId,
      branchId: mainId.toString(),
      name: 'Main Campus',
      code: 'MAIN',
      institutionType: 'university',
      location: {
        state: 'Telangana',
        city: 'Hyderabad',
        address: addressFor('Hyderabad', 'Telangana', '1 Surya Campus Road', '500032'),
      },
      contact: { email: 'main.surya@yopmail.com', phone: '+919876500101' },
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: cityId,
      tenantId,
      branchId: cityId.toString(),
      name: 'City Campus',
      code: 'CITY',
      institutionType: 'university',
      location: {
        state: 'Telangana',
        city: 'Secunderabad',
        address: addressFor('Secunderabad', 'Telangana', '22 MG Road', '500003'),
      },
      contact: { email: 'city.surya@yopmail.com', phone: '+919876500102' },
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
  ]);
  counts.branches = 2;

  // Owner + registrar users
  const ownerId = new ObjectId();
  const registrarId = new ObjectId();
  await db.collection('users').insertMany([
    {
      _id: ownerId,
      tenantId,
      email: OWNER_EMAIL,
      passwordHash,
      phone: '+919876500100',
      profile: { firstName: 'Surya', lastName: 'Teja', displayName: 'Surya Teja' },
      roleId: roleId[SYSTEM_ROLES.GROUP_OWNER],
      accessScope: { type: 'global', branchIds: [] },
      status: 'active',
      failedLoginAttempts: 0,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: registrarId,
      tenantId,
      email: 'surya.registrar@yopmail.com',
      passwordHash,
      profile: { firstName: 'Meera', lastName: 'Krishnan', displayName: 'Meera Krishnan' },
      roleId: roleId[SYSTEM_ROLES.BRANCH_ADMIN],
      accessScope: { type: 'branch', branchIds: [mainId] },
      status: 'active',
      failedLoginAttempts: 0,
      createdAt: now,
      updatedAt: now,
    },
  ]);

  // Academic year with two semesters (odd currently open for registration)
  const batchId = new ObjectId();
  const oddTermId = new ObjectId();
  const evenTermId = new ObjectId();
  await db.collection('academic_batches').insertOne({
    _id: batchId,
    tenantId,
    branchId: mainId,
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
        registrationWindow: {
          opensAt: new Date(now.getTime() - DAY),
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
        registrationWindow: { opensAt: new Date('2026-12-20'), closesAt: new Date('2027-01-10') },
      },
    ],
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });

  // Departments + designations per branch
  const deptDocs = [];
  const desigDocs = [];
  const deptIdByBranchCode = new Map<string, ObjectId>();
  const desigIdByBranchCode = new Map<string, ObjectId>();
  for (const branchId of [mainId, cityId]) {
    for (const d of UNI_DEPARTMENTS) {
      const id = new ObjectId();
      deptIdByBranchCode.set(`${branchId}:${d.code}`, id);
      deptDocs.push({
        _id: id,
        tenantId,
        branchId,
        name: d.name,
        code: d.code,
        type: 'academic',
        status: 'active',
        createdBy: ownerId,
        createdAt: now,
        updatedAt: now,
      });
    }
    for (const d of DESIGNATIONS_UNI) {
      const id = new ObjectId();
      desigIdByBranchCode.set(`${branchId}:${d.code}`, id);
      desigDocs.push({
        _id: id,
        tenantId,
        branchId,
        name: d.name,
        code: d.code,
        category: d.category,
        level: d.level,
        status: 'active',
        createdBy: ownerId,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  await db.collection('departments').insertMany(deptDocs);
  await db.collection('designations').insertMany(desigDocs);
  counts.departments = deptDocs.length;
  counts.designations = desigDocs.length;

  // Subjects (shared across branches)
  const subjectIdByCode = new Map<string, ObjectId>();
  const subjectDocs = [];
  for (const dept of Object.keys(UNI_SUBJECTS)) {
    for (const sem of Object.keys(UNI_SUBJECTS[dept]).map(Number)) {
      const { cores, electives } = UNI_SUBJECTS[dept][sem];
      for (const s of [...cores, ...electives]) {
        if (subjectIdByCode.has(s.code)) continue;
        const id = new ObjectId();
        subjectIdByCode.set(s.code, id);
        subjectDocs.push({
          _id: id,
          tenantId,
          branchId: mainId,
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
  counts.subjects = subjectDocs.length;

  // Classes + sections per branch
  interface UniClass {
    classId: ObjectId;
    sectionId: ObjectId;
    branchId: ObjectId;
    dept: string;
    deptName: string;
    year: number;
  }
  const uniClasses: UniClass[] = [];
  const classDocs = [];
  const sectionDocs = [];
  const layout: Array<{ branchId: ObjectId; depts: string[]; years: number[] }> = [
    { branchId: mainId, depts: ['CS', 'ME', 'EE'], years: [1, 2, 3, 4] },
    { branchId: cityId, depts: ['CS', 'EE'], years: [1, 2] },
  ];
  for (const l of layout) {
    for (const code of l.depts) {
      const deptName = UNI_DEPARTMENTS.find((d) => d.code === code)!.name;
      for (const year of l.years) {
        const classId = new ObjectId();
        const sectionId = new ObjectId();
        uniClasses.push({ classId, sectionId, branchId: l.branchId, dept: code, deptName, year });
        classDocs.push({
          _id: classId,
          tenantId,
          branchId: l.branchId,
          academicBatchId: batchId,
          path: [
            { levelKey: 'department', name: deptName, code, order: 1 },
            { levelKey: 'year', name: `Year ${year}`, code: `Y${year}`, order: year },
          ],
          displayName: `${deptName} · Year ${year}`,
          status: 'active',
          createdAt: now,
          updatedAt: now,
        });
        sectionDocs.push({
          _id: sectionId,
          tenantId,
          branchId: l.branchId,
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
  }
  await db.collection('classes').insertMany(classDocs);
  await db.collection('sections').insertMany(sectionDocs);
  counts.classes = classDocs.length;
  counts.sections = sectionDocs.length;

  // Staff per branch
  const staffSpecsMain: StaffSpec[] = [
    { designationCode: 'PROF', departmentCode: 'CS', isTeacher: true },
    { designationCode: 'ASSOCPROF', departmentCode: 'CS', isTeacher: true },
    { designationCode: 'ASSTPROF', departmentCode: 'ME', isTeacher: true },
    { designationCode: 'ASSTPROF', departmentCode: 'EE', isTeacher: true },
    { designationCode: 'LABASST', departmentCode: 'CS', isTeacher: true },
    { designationCode: 'REGISTRAR', departmentCode: 'CS', isTeacher: false },
    { designationCode: 'ACCT', departmentCode: 'CS', isTeacher: false },
  ];
  const staffSpecsCity: StaffSpec[] = [
    { designationCode: 'ASSOCPROF', departmentCode: 'CS', isTeacher: true },
    { designationCode: 'ASSTPROF', departmentCode: 'EE', isTeacher: true },
    { designationCode: 'ACCT', departmentCode: 'CS', isTeacher: false },
  ];
  const mainStaff = await seedStaff(
    db,
    tenantId,
    mainId,
    'SUM',
    staffSpecsMain,
    new Map(
      [...deptIdByBranchCode]
        .filter(([k]) => k.startsWith(String(mainId)))
        .map(([k, v]) => [k.split(':')[1], v])
    ),
    new Map(
      [...desigIdByBranchCode]
        .filter(([k]) => k.startsWith(String(mainId)))
        .map(([k, v]) => [k.split(':')[1], v])
    ),
    roleId.TEACHER,
    passwordHash,
    now
  );
  const cityStaff = await seedStaff(
    db,
    tenantId,
    cityId,
    'SUC',
    staffSpecsCity,
    new Map(
      [...deptIdByBranchCode]
        .filter(([k]) => k.startsWith(String(cityId)))
        .map(([k, v]) => [k.split(':')[1], v])
    ),
    new Map(
      [...desigIdByBranchCode]
        .filter(([k]) => k.startsWith(String(cityId)))
        .map(([k, v]) => [k.split(':')[1], v])
    ),
    roleId.TEACHER,
    passwordHash,
    now
  );
  counts.staff = mainStaff.staffDocs.length + cityStaff.staffDocs.length;

  // Attach subjects to sections (semester-tagged), assign teachers
  for (const c of uniClasses) {
    const teacherPool = c.branchId.equals(mainId)
      ? mainStaff.teacherStaffIds
      : cityStaff.teacherStaffIds;
    const sems = [2 * c.year - 1, 2 * c.year];
    const entries = sems.flatMap((sem) => {
      const cur = UNI_SUBJECTS[c.dept]?.[sem];
      if (!cur) return [];
      return [...cur.cores, ...cur.electives].map((s, idx) => ({
        subjectId: subjectIdByCode.get(s.code)!,
        periodsPerWeek: 4,
        semesterNumber: sem,
        teacherId: teacherPool[idx % teacherPool.length],
      }));
    });
    if (entries.length) {
      await db
        .collection('sections')
        .updateOne(
          { _id: c.sectionId },
          { $set: { subjects: entries, sectionTeacherId: teacherPool[0], updatedAt: now } }
        );
    }
  }

  // Published curricula for semesters 1 and 3
  const schemeDocs = [];
  for (const dept of Object.keys(UNI_SUBJECTS)) {
    for (const sem of Object.keys(UNI_SUBJECTS[dept]).map(Number)) {
      const { cores, electives } = UNI_SUBJECTS[dept][sem];
      schemeDocs.push({
        _id: new ObjectId(),
        tenantId,
        branchId: mainId,
        departmentCode: dept,
        departmentName: UNI_DEPARTMENTS.find((d) => d.code === dept)!.name,
        semesterNumber: sem,
        slots: [
          ...cores.map((s) => ({
            slotId: new ObjectId().toHexString(),
            kind: 'core' as const,
            category: s.category,
            subjectId: subjectIdByCode.get(s.code)!,
            credits: s.credits!,
          })),
          {
            slotId: new ObjectId().toHexString(),
            kind: 'basket' as const,
            label: sem === 1 ? 'Skill Elective' : 'Professional Elective I',
            category: electives[0]?.category,
            chooseCount: 1,
            options: electives.map((s) => ({
              subjectId: subjectIdByCode.get(s.code)!,
              credits: s.credits!,
              seatCap: 40,
              seatsTaken: 0,
            })),
          },
        ],
        minCredits: 10,
        maxCredits: 26,
        status: 'published',
        publishedAt: now,
        createdBy: registrarId,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  await db.collection('program_schemes').insertMany(schemeDocs);
  counts.schemes = schemeDocs.length;

  // Students
  const studentDocs = [];
  const studentUserDocs = [];
  const byClass = new Map<string, ExamStudentCtx[]>();
  let sn = 1;
  for (const c of uniClasses) {
    const perClass = c.branchId.equals(mainId) ? 8 : 5;
    const list: ExamStudentCtx[] = [];
    for (let k = 0; k < perClass; k++) {
      const n = nextName();
      const sid = new ObjectId();
      const adm = `SIT-2026-${String(sn).padStart(4, '0')}`;
      const className = `${c.deptName} · Year ${c.year}`;
      studentDocs.push({
        _id: sid,
        tenantId,
        branchId: c.branchId,
        admissionNumber: adm,
        rollNumber: `${c.dept}${c.year}${String(k + 1).padStart(2, '0')}`,
        firstName: n.firstName,
        lastName: n.lastName,
        displayName: n.displayName,
        dateOfBirth: new Date(2007 - c.year, k % 12, 14),
        gender: k % 2 === 0 ? 'male' : 'female',
        nationality: 'Indian',
        abcId: String(100000000000 + sn),
        contact: { email: `sit.student${sn}@yopmail.com` },
        currentEnrollment: {
          academicBatchId: batchId,
          classId: c.classId,
          sectionId: c.sectionId,
          className,
          sectionName: 'A',
          enrolledAt: now,
        },
        admissionDate: now,
        admissionType: 'new',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });
      list.push({
        studentId: sid,
        studentName: n.displayName,
        admissionNumber: adm,
        classId: c.classId,
        sectionId: c.sectionId,
        sectionName: 'A',
        className,
      });
      sn++;
    }
    byClass.set(c.classId.toString(), list);
  }
  await db.collection('students').insertMany(studentDocs);
  counts.students = studentDocs.length;

  // One showcase student login (CS Year 2 on Main → Semester 3)
  const csY2 = uniClasses.find(
    (c) => c.branchId.equals(mainId) && c.dept === 'CS' && c.year === 2
  )!;
  const showcase = byClass.get(csY2.classId.toString())![0];
  const showcaseUserId = new ObjectId();
  studentUserDocs.push({
    _id: showcaseUserId,
    tenantId,
    email: 'surya.student@yopmail.com',
    passwordHash,
    profile: { firstName: 'Asha', lastName: 'Rao', displayName: 'Asha Rao' },
    roleId: roleId.STUDENT,
    accessScope: { type: 'branch', branchIds: [mainId] },
    status: 'active',
    failedLoginAttempts: 0,
    createdAt: now,
    updatedAt: now,
  });
  await db.collection('users').insertMany(studentUserDocs);
  await db
    .collection('students')
    .updateOne(
      { _id: showcase.studentId },
      {
        $set: {
          userId: showcaseUserId,
          firstName: 'Asha',
          lastName: 'Rao',
          displayName: 'Asha Rao',
          'contact.email': 'surya.student@yopmail.com',
          updatedAt: now,
        },
      }
    );
  showcase.studentName = 'Asha Rao';

  // Fees: one structure per branch, assignments for everyone (some overdue)
  const feeDocs = [];
  const assignDocs: ReturnType<typeof buildFeeAssignment>[] = [];
  for (const [bId, label] of [
    [mainId, 'Main'],
    [cityId, 'City'],
  ] as Array<[ObjectId, string]>) {
    const structureId = new ObjectId();
    feeDocs.push({
      _id: structureId,
      tenantId,
      branchId: bId,
      name: `Semester Fee 2026-27 (${label})`,
      code: `SEMFEE-${label.toUpperCase()}`,
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
    const branchStudents = studentDocs.filter((s) => (s.branchId as ObjectId).equals(bId));
    branchStudents.forEach((s, idx) => {
      const overdue = idx % 9 === 0; // ~1 in 9 owes money
      assignDocs.push(
        buildFeeAssignment(
          tenantId,
          bId,
          s._id as ObjectId,
          batchId,
          structureId,
          overdue,
          ownerId,
          now
        )
      );
    });
  }
  await db.collection('fee_structures').insertMany(feeDocs);
  await db.collection('fee_assignments').insertMany(assignDocs);
  counts.feeAssignments = assignDocs.length;

  // Course registrations for CS Year 2 (Semester 3) on Main
  const csScheme = schemeDocs.find((s) => s.departmentCode === 'CS' && s.semesterNumber === 3)!;
  const csBasket = csScheme.slots.find((s) => s.kind === 'basket')!;
  const csCores = csScheme.slots.filter((s) => s.kind === 'core');
  const regDocs = [];
  const csY2Students = byClass.get(csY2.classId.toString())!;
  // Everyone except the showcase student, so they can register live.
  for (let i = 1; i < csY2Students.length; i++) {
    const s = csY2Students[i];
    const opt = csBasket.options[i % csBasket.options.length];
    const entries = [
      ...csCores.map((slot) => ({
        slotId: slot.slotId,
        kind: 'core' as const,
        category: slot.category,
        subjectId: slot.subjectId!,
        credits: slot.credits!,
      })),
      {
        slotId: csBasket.slotId,
        kind: 'basket' as const,
        category: 'DSE',
        subjectId: opt.subjectId,
        credits: opt.credits,
      },
    ];
    regDocs.push({
      _id: new ObjectId(),
      tenantId,
      branchId: mainId,
      studentId: s.studentId,
      academicBatchId: batchId,
      termId: oddTermId,
      schemeId: csScheme._id,
      departmentCode: 'CS',
      semesterNumber: 3,
      entries,
      totalCredits: entries.reduce((t, e) => t + e.credits, 0),
      status: 'submitted',
      submittedAt: new Date(now.getTime() - i * 3600 * 1000),
      createdAt: now,
      updatedAt: now,
    });
    opt.seatsTaken += 1;
  }
  if (regDocs.length) await db.collection('course_registrations').insertMany(regDocs);
  // Persist the seat counters we just consumed.
  await db
    .collection('program_schemes')
    .updateOne({ _id: csScheme._id }, { $set: { slots: csScheme.slots, updatedAt: now } });
  counts.registrations = regDocs.length;

  // Exam settings (UGC) per branch
  await db
    .collection('exam_settings')
    .insertMany([
      buildExamSettings(tenantId, mainId, 'university', now),
      buildExamSettings(tenantId, cityId, 'university', now),
    ]);

  // A completed Semester 3 exam for CS Year 2 on Main, with published cards
  const ugcScale = BOARD_PRESET_CONFIG.ugc.gradingScale;
  const sem3 = UNI_SUBJECTS.CS[3];
  const examPapers = sem3.cores.map((s) => ({
    subjectId: subjectIdByCode.get(s.code)!,
    subjectName: s.name,
    credits: s.credits,
  }));
  const { exam, results, reportCards } = buildExamWithResults(
    tenantId,
    mainId,
    batchId,
    oddTermId,
    'Odd Semester 2026',
    3,
    'End Semester Examination',
    [csY2.classId],
    examPapers,
    csY2Students,
    ugcScale,
    BOARD_PRESET_CONFIG.ugc.passMarkPercent,
    registrarId,
    now
  );
  await db.collection('exams').insertOne(exam);
  await db.collection('exam_results').insertMany(results);
  await db.collection('report_cards').insertMany(reportCards);
  counts.reportCards = reportCards.length;

  // academicSummary (SGPA/CGPA/backlogs) — what publish would have computed
  for (const card of reportCards) {
    const summary = academicSummaryFrom([card], now);
    await db
      .collection('students')
      .updateOne({ _id: card.studentId }, { $set: { academicSummary: summary, updatedAt: now } });
  }

  // Attendance — last 3 weeks for every Main Campus section
  const attendanceDocs = [];
  for (const c of uniClasses.filter((x) => x.branchId.equals(mainId))) {
    const ids = byClass.get(c.classId.toString())!.map((s) => s.studentId);
    attendanceDocs.push(
      ...buildAttendance(tenantId, mainId, c.classId, c.sectionId, ids, registrarId, 21, now)
    );
  }
  await db.collection('student_attendance').insertMany(attendanceDocs);
  counts.attendanceRegisters = attendanceDocs.length;

  return {
    summary: `2 branches · ${counts.classes} classes · ${counts.students} students · ${counts.staff} staff · ${counts.schemes} curricula · ${counts.registrations} registrations · ${counts.reportCards} report cards · ${counts.attendanceRegisters} attendance registers`,
  };
}

function buildFeeAssignment(
  tenantId: ObjectId,
  branchId: ObjectId,
  studentId: ObjectId,
  academicBatchId: ObjectId,
  feeStructureId: ObjectId,
  overdue: boolean,
  actorId: ObjectId,
  now: Date
) {
  const amount = 60000;
  return {
    _id: new ObjectId(),
    tenantId,
    branchId,
    studentId,
    academicBatchId,
    feeStructureId,
    type: 'tuition',
    components: [],
    installments: [
      {
        installmentNumber: 1,
        name: 'Term Fee',
        dueDate: new Date(now.getTime() - 10 * DAY),
        amount,
        fineAmount: 0,
        totalDue: amount,
        paidAmount: overdue ? 0 : amount,
        balance: overdue ? amount : 0,
        status: overdue ? 'overdue' : 'paid',
      },
    ],
    summary: {
      totalFee: amount,
      totalDiscount: 0,
      totalTax: 0,
      netPayable: amount,
      totalPaid: overdue ? 0 : amount,
      totalFine: 0,
      balance: overdue ? amount : 0,
    },
    concessions: [],
    status: 'active',
    createdBy: actorId,
    createdAt: now,
    updatedAt: now,
  };
}

// ─── School ─────────────────────────────────────────────────────────────────

async function seedSchool(db: Db, tenantId: ObjectId, passwordHash: string) {
  const now = new Date();
  const counts: Record<string, number> = {};

  await db.collection('tenants').insertOne({
    _id: tenantId,
    tenantId: tenantId.toString(),
    name: 'Surya Public School',
    code: SCH_CODE,
    institutionTypes: ['school'],
    contact: {
      email: OWNER_EMAIL,
      phone: '+919876500200',
      address: addressFor('Hyderabad', 'Telangana', '9 Surya School Lane', '500018'),
    },
    branding: { primaryColor: '#0EA5E9', secondaryColor: '#22D3EE' },
    subscription: {
      plan: 'professional',
      maxBranches: 5,
      maxStudents: 5000,
      maxStaff: 200,
      features: defaultModulesFor('school').concat([
        'finance',
        'admissions',
        'exams',
        'communications',
        'hr',
      ]),
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

  const roles = buildRoles(tenantId, now);
  await db.collection('roles').insertMany(roles);
  const roleId = Object.fromEntries(roles.map((r) => [r.code, r._id]));

  const centralId = new ObjectId();
  const northId = new ObjectId();
  await db.collection('branches').insertMany([
    {
      _id: centralId,
      tenantId,
      branchId: centralId.toString(),
      name: 'Central Campus',
      code: 'CENTRAL',
      institutionType: 'school',
      location: {
        state: 'Telangana',
        city: 'Hyderabad',
        address: addressFor('Hyderabad', 'Telangana', '9 Surya School Lane', '500018'),
      },
      contact: { email: 'central.surya@yopmail.com', phone: '+919876500201' },
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: northId,
      tenantId,
      branchId: northId.toString(),
      name: 'North Campus',
      code: 'NORTH',
      institutionType: 'school',
      location: {
        state: 'Telangana',
        city: 'Hyderabad',
        address: addressFor('Hyderabad', 'Telangana', '77 North Avenue', '500072'),
      },
      contact: { email: 'north.surya@yopmail.com', phone: '+919876500202' },
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
  ]);
  counts.branches = 2;

  const ownerId = new ObjectId();
  const principalId = new ObjectId();
  await db.collection('users').insertMany([
    {
      _id: ownerId,
      tenantId,
      email: OWNER_EMAIL,
      passwordHash,
      phone: '+919876500200',
      profile: { firstName: 'Surya', lastName: 'Teja', displayName: 'Surya Teja' },
      roleId: roleId[SYSTEM_ROLES.GROUP_OWNER],
      accessScope: { type: 'global', branchIds: [] },
      status: 'active',
      failedLoginAttempts: 0,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: principalId,
      tenantId,
      email: 'surya.principal@yopmail.com',
      passwordHash,
      profile: { firstName: 'Priya', lastName: 'Menon', displayName: 'Priya Menon' },
      roleId: roleId[SYSTEM_ROLES.BRANCH_ADMIN],
      accessScope: { type: 'branch', branchIds: [centralId] },
      status: 'active',
      failedLoginAttempts: 0,
      createdAt: now,
      updatedAt: now,
    },
  ]);

  const batchId = new ObjectId();
  await db.collection('academic_batches').insertOne({
    _id: batchId,
    tenantId,
    branchId: centralId,
    name: 'AY 2026-27',
    code: 'AY2627',
    startDate: new Date('2026-04-01'),
    endDate: new Date('2027-03-31'),
    isCurrent: true,
    terms: [
      {
        _id: new ObjectId(),
        name: 'Term 1',
        startDate: new Date('2026-04-01'),
        endDate: new Date('2026-09-30'),
      },
      {
        _id: new ObjectId(),
        name: 'Term 2',
        startDate: new Date('2026-10-01'),
        endDate: new Date('2027-03-31'),
      },
    ],
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });

  // Departments + designations
  const deptDocs = [];
  const desigDocs = [];
  const deptIdByBranchCode = new Map<string, ObjectId>();
  const desigIdByBranchCode = new Map<string, ObjectId>();
  for (const bId of [centralId, northId]) {
    for (const d of SCHOOL_DEPARTMENTS) {
      const id = new ObjectId();
      deptIdByBranchCode.set(`${bId}:${d.code}`, id);
      deptDocs.push({
        _id: id,
        tenantId,
        branchId: bId,
        name: d.name,
        code: d.code,
        type: d.code === 'ADMIN' ? 'administrative' : 'academic',
        status: 'active',
        createdBy: ownerId,
        createdAt: now,
        updatedAt: now,
      });
    }
    for (const d of DESIGNATIONS_SCH) {
      const id = new ObjectId();
      desigIdByBranchCode.set(`${bId}:${d.code}`, id);
      desigDocs.push({
        _id: id,
        tenantId,
        branchId: bId,
        name: d.name,
        code: d.code,
        category: d.category,
        level: d.level,
        status: 'active',
        createdBy: ownerId,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  await db.collection('departments').insertMany(deptDocs);
  await db.collection('designations').insertMany(desigDocs);
  counts.departments = deptDocs.length;

  // Subjects (no credits — schools don't use them)
  const subjectIdByCode = new Map<string, ObjectId>();
  const subjectDocs = SCHOOL_SUBJECTS.map((s) => {
    const id = new ObjectId();
    subjectIdByCode.set(s.code, id);
    return {
      _id: id,
      tenantId,
      branchId: centralId,
      name: s.name,
      code: s.code,
      shortName: s.code,
      type: 'both',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
  });
  await db.collection('subjects').insertMany(subjectDocs);
  counts.subjects = subjectDocs.length;

  // Classes: Central grades 1-8 × A,B; North grades 1-5 × A
  interface SchClass {
    classId: ObjectId;
    sectionId: ObjectId;
    branchId: ObjectId;
    grade: number;
    sectionName: string;
  }
  const schClasses: SchClass[] = [];
  const classDocs = [];
  const sectionDocs = [];
  const classByGrade = new Map<string, ObjectId>();
  for (const [bId, grades, sections] of [
    [centralId, 8, ['A', 'B']],
    [northId, 5, ['A']],
  ] as Array<[ObjectId, number, string[]]>) {
    for (let g = 1; g <= grades; g++) {
      const classId = new ObjectId();
      classByGrade.set(`${bId}:${g}`, classId);
      classDocs.push({
        _id: classId,
        tenantId,
        branchId: bId,
        academicBatchId: batchId,
        path: [{ levelKey: 'grade', name: `Grade ${g}`, code: `G${g}`, order: g }],
        displayName: `Grade ${g}`,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });
      for (const sec of sections) {
        const sectionId = new ObjectId();
        schClasses.push({ classId, sectionId, branchId: bId, grade: g, sectionName: sec });
        sectionDocs.push({
          _id: sectionId,
          tenantId,
          branchId: bId,
          classId,
          name: sec,
          code: sec,
          capacity: 40,
          status: 'active',
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  }
  await db.collection('classes').insertMany(classDocs);
  await db.collection('sections').insertMany(sectionDocs);
  counts.classes = classDocs.length;
  counts.sections = sectionDocs.length;

  // Staff
  const specsCentral: StaffSpec[] = [
    { designationCode: 'PRINCIPAL', departmentCode: 'ADMIN', isTeacher: false },
    { designationCode: 'SRTEACHER', departmentCode: 'PRI', isTeacher: true },
    { designationCode: 'TEACHER', departmentCode: 'PRI', isTeacher: true },
    { designationCode: 'TEACHER', departmentCode: 'SEC', isTeacher: true },
    { designationCode: 'TEACHER', departmentCode: 'SEC', isTeacher: true },
    { designationCode: 'ACCT', departmentCode: 'ADMIN', isTeacher: false },
  ];
  const specsNorth: StaffSpec[] = [
    { designationCode: 'SRTEACHER', departmentCode: 'PRI', isTeacher: true },
    { designationCode: 'TEACHER', departmentCode: 'PRI', isTeacher: true },
  ];
  const centralStaff = await seedStaff(
    db,
    tenantId,
    centralId,
    'SPC',
    specsCentral,
    new Map(
      [...deptIdByBranchCode]
        .filter(([k]) => k.startsWith(String(centralId)))
        .map(([k, v]) => [k.split(':')[1], v])
    ),
    new Map(
      [...desigIdByBranchCode]
        .filter(([k]) => k.startsWith(String(centralId)))
        .map(([k, v]) => [k.split(':')[1], v])
    ),
    roleId.TEACHER,
    passwordHash,
    now
  );
  const northStaff = await seedStaff(
    db,
    tenantId,
    northId,
    'SPN',
    specsNorth,
    new Map(
      [...deptIdByBranchCode]
        .filter(([k]) => k.startsWith(String(northId)))
        .map(([k, v]) => [k.split(':')[1], v])
    ),
    new Map(
      [...desigIdByBranchCode]
        .filter(([k]) => k.startsWith(String(northId)))
        .map(([k, v]) => [k.split(':')[1], v])
    ),
    roleId.TEACHER,
    passwordHash,
    now
  );
  counts.staff = centralStaff.staffDocs.length + northStaff.staffDocs.length;

  // Subjects onto sections with teachers
  for (const c of schClasses) {
    const pool = c.branchId.equals(centralId)
      ? centralStaff.teacherStaffIds
      : northStaff.teacherStaffIds;
    const subs = SCHOOL_SUBJECTS.slice(0, c.grade <= 5 ? 5 : 7);
    await db.collection('sections').updateOne(
      { _id: c.sectionId },
      {
        $set: {
          subjects: subs.map((s, idx) => ({
            subjectId: subjectIdByCode.get(s.code)!,
            periodsPerWeek: 5,
            teacherId: pool[idx % pool.length],
          })),
          sectionTeacherId: pool[c.grade % pool.length],
          updatedAt: now,
        },
      }
    );
  }

  // Students
  const studentDocs = [];
  const byClass = new Map<string, ExamStudentCtx[]>();
  let sn = 1;
  for (const c of schClasses) {
    const list: ExamStudentCtx[] = [];
    const perSection = c.branchId.equals(centralId) ? 8 : 6;
    for (let k = 0; k < perSection; k++) {
      const n = nextName();
      const sid = new ObjectId();
      const adm = `SPS-2026-${String(sn).padStart(4, '0')}`;
      studentDocs.push({
        _id: sid,
        tenantId,
        branchId: c.branchId,
        admissionNumber: adm,
        rollNumber: String(k + 1),
        firstName: n.firstName,
        lastName: n.lastName,
        displayName: n.displayName,
        dateOfBirth: new Date(2026 - 5 - c.grade, k % 12, 9),
        gender: k % 2 === 0 ? 'female' : 'male',
        nationality: 'Indian',
        contact: { email: `sps.student${sn}@yopmail.com` },
        parents: {
          father: {
            name: `${n.lastName} Senior`,
            phone: `+9199887${String(70000 + sn).slice(-5)}`,
          },
        },
        currentEnrollment: {
          academicBatchId: batchId,
          classId: c.classId,
          sectionId: c.sectionId,
          className: `Grade ${c.grade}`,
          sectionName: c.sectionName,
          enrolledAt: now,
        },
        admissionDate: now,
        admissionType: 'new',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });
      list.push({
        studentId: sid,
        studentName: n.displayName,
        admissionNumber: adm,
        classId: c.classId,
        sectionId: c.sectionId,
        sectionName: c.sectionName,
        className: `Grade ${c.grade}`,
      });
      sn++;
    }
    byClass.set(c.sectionId.toString(), list);
  }
  await db.collection('students').insertMany(studentDocs);
  counts.students = studentDocs.length;

  // Fees
  const feeDocs = [];
  const assignDocs: ReturnType<typeof buildFeeAssignment>[] = [];
  for (const [bId, label] of [
    [centralId, 'Central'],
    [northId, 'North'],
  ] as Array<[ObjectId, string]>) {
    const structureId = new ObjectId();
    feeDocs.push({
      _id: structureId,
      tenantId,
      branchId: bId,
      name: `Annual Fee 2026-27 (${label})`,
      code: `ANNUAL-${label.toUpperCase()}`,
      applicableTo: { classIds: [], sectionIds: [], gradeCodes: [] },
      components: [
        {
          name: 'Tuition',
          code: 'TUITION',
          type: 'mandatory',
          amount: 42000,
          frequency: 'yearly',
          taxable: false,
          refundable: false,
        },
      ],
      installments: [],
      fineRules: { type: 'fixed', amount: 200, gracePeriodDays: 7 },
      concessionRules: {
        requireApproval: true,
        maxPercentage: 25,
        allowedTypes: ['sibling', 'staff_ward'],
      },
      category: 'tuition',
      totalAmount: 42000,
      mandatoryTotal: 42000,
      isActive: true,
      createdBy: ownerId,
      createdAt: now,
      updatedAt: now,
    });
    studentDocs
      .filter((s) => (s.branchId as ObjectId).equals(bId))
      .forEach((s, idx) =>
        assignDocs.push(
          buildFeeAssignment(
            tenantId,
            bId,
            s._id as ObjectId,
            batchId,
            structureId,
            idx % 7 === 0,
            ownerId,
            now
          )
        )
      );
  }
  await db.collection('fee_structures').insertMany(feeDocs);
  await db.collection('fee_assignments').insertMany(assignDocs);
  counts.feeAssignments = assignDocs.length;

  // Exam settings (CBSE) + a completed Term 1 exam for Grade 5 A on Central
  await db
    .collection('exam_settings')
    .insertMany([
      buildExamSettings(tenantId, centralId, 'school', now),
      buildExamSettings(tenantId, northId, 'school', now),
    ]);

  const cbse = BOARD_PRESET_CONFIG.cbse;
  const g5 = schClasses.find(
    (c) => c.branchId.equals(centralId) && c.grade === 5 && c.sectionName === 'A'
  )!;
  const g5Students = byClass.get(g5.sectionId.toString())!;
  const schoolPapers = SCHOOL_SUBJECTS.slice(0, 5).map((s) => ({
    subjectId: subjectIdByCode.get(s.code)!,
    subjectName: s.name,
  }));
  const { exam, results, reportCards } = buildExamWithResults(
    tenantId,
    centralId,
    batchId,
    undefined,
    'Term 1',
    undefined,
    'Term 1 Examination',
    [g5.classId],
    schoolPapers,
    g5Students,
    cbse.gradingScale,
    cbse.passMarkPercent,
    principalId,
    now
  );
  await db.collection('exams').insertOne(exam);
  await db.collection('exam_results').insertMany(results);
  await db.collection('report_cards').insertMany(reportCards);
  counts.reportCards = reportCards.length;

  // Attendance for every Central section
  const attendanceDocs = [];
  for (const c of schClasses.filter((x) => x.branchId.equals(centralId))) {
    const ids = byClass.get(c.sectionId.toString())!.map((s) => s.studentId);
    attendanceDocs.push(
      ...buildAttendance(tenantId, centralId, c.classId, c.sectionId, ids, principalId, 21, now)
    );
  }
  await db.collection('student_attendance').insertMany(attendanceDocs);
  counts.attendanceRegisters = attendanceDocs.length;

  return {
    summary: `2 branches · ${counts.classes} classes · ${counts.sections} sections · ${counts.students} students · ${counts.staff} staff · ${counts.reportCards} report cards · ${counts.attendanceRegisters} attendance registers`,
  };
}

// ─── Rollback / output ──────────────────────────────────────────────────────

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
  'designations',
  'staff',
  'students',
  'program_schemes',
  'course_registrations',
  'fee_structures',
  'fee_assignments',
  'exam_settings',
  'exams',
  'exam_results',
  'report_cards',
  'student_attendance',
];

async function rollback(db: Db, tenantIds: ObjectId[]) {
  for (const tid of tenantIds) {
    for (const name of TENANT_COLLECTIONS) {
      if (name === 'tenants') await db.collection(name).deleteOne({ _id: tid });
      else await db.collection(name).deleteMany({ tenantId: tid });
    }
  }
  console.log('Rolled back.');
}

function printCredentials() {
  console.log('\n  Logins (password: Demo@1234)');
  console.log(`    ${OWNER_EMAIL}       — Group Owner of BOTH orgs (use the org switcher)`);
  console.log('    surya.registrar@yopmail.com    — University · Main Campus admin');
  console.log('    surya.principal@yopmail.com    — School · Central Campus admin');
  console.log('    surya.student@yopmail.com      — University student (CS Year 2 → Sem 3)');
  console.log('    sum.teacher1@yopmail.com       — University teacher (Main Campus)');
  console.log('    spc.teacher2@yopmail.com       — School teacher (Central Campus)');
}

function printCleanup(tenantIds: ObjectId[]) {
  const ids = tenantIds.map((t) => `'${t.toHexString()}'`).join(', ');
  console.log('\n  To remove this data:');
  console.log(
    `  pnpm --filter @campus-verse/api exec tsx -e "import('mongodb').then(async ({MongoClient, ObjectId}) => { const c = new MongoClient(process.env.MONGODB_URI!); await c.connect(); const db = c.db(); for (const raw of [${ids}]) { const tid = new ObjectId(raw); for (const n of ${JSON.stringify(TENANT_COLLECTIONS)}) { if (n==='tenants') await db.collection(n).deleteOne({_id: tid}); else await db.collection(n).deleteMany({tenantId: tid}); } } console.log('done'); await c.close(); })"`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

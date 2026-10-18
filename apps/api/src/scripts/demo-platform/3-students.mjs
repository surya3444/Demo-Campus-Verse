// Phase 3 — fee structures, then students (with parents and logins) in every
// section. Each student's first-login password from the API is recorded; a few
// per section are switched to the shared demo password for easy demos.
import { session, pool, loadState, saveState, log, person, int, pick, PASSWORD, API } from './lib.mjs';
import { ORGS, STUDENTS_PER_SECTION } from './spec.mjs';

const only = process.argv[2];
const OCCUPATIONS = ['Engineer', 'Teacher', 'Doctor', 'Business Owner', 'Farmer', 'Government Employee', 'Accountant', 'Lawyer', 'Homemaker', 'Software Developer', 'Bank Officer', 'Nurse'];
const CATEGORIES = ['general', 'general', 'general', 'obc', 'obc', 'sc', 'st', 'ews'];

function feeFor(org, k) {
  if (org.type === 'school') {
    const tuition = 42000 + k.year * 4000;
    return [
      { name: 'Tuition Fee', code: 'TUI', amount: tuition, type: 'mandatory', frequency: 'yearly' },
      { name: 'Development Fee', code: 'DEV', amount: 8000, type: 'mandatory', frequency: 'yearly' },
      { name: 'Lab & Library', code: 'LAB', amount: 3500, type: 'mandatory', frequency: 'yearly' },
      { name: 'Activity Fee', code: 'ACT', amount: 2500, type: 'mandatory', frequency: 'yearly' },
    ];
  }
  const base = { MBA: 160000, MPHARM: 140000, LLM: 110000, MCOM: 70000, BALLB: 120000, BPHARM: 130000, BDES: 150000, BBA: 90000, BCA: 85000, BCOM: 60000, BSCBT: 80000 }[k.programCode] ?? 145000;
  return [
    { name: 'Tuition Fee', code: 'TUI', amount: base, type: 'mandatory', frequency: 'yearly' },
    { name: 'Examination Fee', code: 'EXM', amount: 6000, type: 'mandatory', frequency: 'yearly' },
    { name: 'Library & Lab', code: 'LAB', amount: 9000, type: 'mandatory', frequency: 'yearly' },
    { name: 'Student Activities', code: 'ACT', amount: 4000, type: 'mandatory', frequency: 'yearly' },
  ];
}

for (const org of ORGS.filter((o) => !only || o.key === only)) {
  const st = loadState(org.key);
  const owner = await session(org.owner);
  log(`== ${org.key}`);
  const uni = org.type === 'university';
  const perSection = STUDENTS_PER_SECTION[org.type];
  let seq = Object.values(st.campuses).reduce((n, c) => n + (c.students?.length ?? 0), 0);

  for (const c of org.campuses) {
    const cs = st.campuses[c.code];
    const B = { branchId: cs.branchId };
    cs.students ??= [];
    cs.feeStructures ??= {};

    // Fee structures, one per class, split into two instalments
    for (const k of cs.classes) {
      if (cs.feeStructures[k.key]) continue;
      const components = feeFor(org, k);
      const fs = await owner.call(
        'POST',
        '/finance/structures',
        {
          name: `${uni ? k.programCode + ' Year ' + k.year : 'Grade ' + k.year} Fee 2026-27`,
          code: `FS-${c.code}-${k.key}`,
          academicBatchId: cs.batchId,
          applicableTo: { classIds: [k.classId] },
          components,
          installments: [
            { name: 'Term 1', dueDate: uni ? '2026-08-10' : '2026-05-15', components: components.map((x) => ({ componentCode: x.code, amount: Math.round(x.amount * 0.6) })) },
            { name: 'Term 2', dueDate: uni ? '2027-01-15' : '2026-11-15', components: components.map((x) => ({ componentCode: x.code, amount: x.amount - Math.round(x.amount * 0.6) })) },
          ],
          category: 'tuition',
          isActive: true,
        },
        B
      );
      cs.feeStructures[k.key] = fs._id;
    }
    saveState(org.key, st);

    // Students
    const have = new Set(cs.students.map((s) => s.sectionId + ':' + s.roll));
    const jobs = [];
    for (const k of cs.classes) {
      for (const sec of k.sections) {
        for (let r = 1; r <= perSection; r++) {
          if (!have.has(sec + ':' + r)) jobs.push({ k, sec, r });
        }
      }
    }
    log(`  ${c.code}: creating ${jobs.length} students`);
    await pool(jobs, org.key === 'marian' ? 12 : 5, async ({ k, sec, r }) => {
      const p = person();
      const father = person();
      const n = ++seq;
      const email =
        org.key === 'marian'
          ? `s${String(n).padStart(4, '0')}@${org.domain}`
          : `cvdemo-${org.key}-${c.code.toLowerCase()}-s${String(n).padStart(4, '0')}@yopmail.com`;
      const age = uni ? 17 + k.year + int(0, 1) : 5 + k.year;
      const body = {
        firstName: p.firstName,
        lastName: p.lastName,
        gender: p.gender,
        dateOfBirth: `${2026 - age}-${String(int(1, 12)).padStart(2, '0')}-${String(int(1, 28)).padStart(2, '0')}`,
        category: pick(CATEGORIES),
        bloodGroup: pick(['A+', 'B+', 'O+', 'AB+', 'O-', 'A-']),
        contact: {
          email,
          phone: `${int(6, 9)}${String(int(100000000, 999999999))}`,
          address: { current: { line1: `${int(1, 300)}, ${pick(['MG Road', 'Station Road', 'Temple Street', 'Lake View Layout', 'Gandhi Nagar', 'Nehru Colony'])}`, city: c.city, state: c.state, country: 'India', pincode: c.pincode } },
        },
        parents: {
          father: { name: `${father.firstName.replace(/a$/, 'an')} ${p.lastName}`, occupation: pick(OCCUPATIONS), phone: `9${String(int(100000000, 999999999))}` },
          mother: { name: `${person().firstName} ${p.lastName}`, occupation: pick(OCCUPATIONS) },
        },
        primaryContactType: 'father',
        admissionDate: uni ? `${2027 - k.year}-07-${String(int(1, 28)).padStart(2, '0')}` : `${2027 - k.year}-04-${String(int(1, 28)).padStart(2, '0')}`,
        admissionType: 'new',
        rollNumber: String(r).padStart(2, '0'),
        academicBatchId: cs.batchId,
        classId: k.classId,
        sectionId: sec,
      };
      const created = await owner.call('POST', '/students', body, B);
      const stu = created.student ?? created;
      cs.students.push({ id: stu._id, email, name: `${p.firstName} ${p.lastName}`, sectionId: sec, classKey: k.key, roll: r, tempPassword: created.tempPassword ?? stu.tempPassword ?? null });
      if (cs.students.length % 100 === 0) {
        saveState(org.key, st);
        log(`    ${c.code}: ${cs.students.length} students`);
      }
    });
    saveState(org.key, st);

    // Two per section on the shared demo password (real login + change-password)
    const sample = [];
    for (const k of cs.classes) for (const sec of k.sections) sample.push(...cs.students.filter((s) => s.sectionId === sec && s.roll <= 2 && !s.demoPassword));
    await pool(sample, 3, async (s) => {
      if (!s.tempPassword) return;
      const lr = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: s.email, password: s.tempPassword }) }).then((r) => r.json());
      if (!lr.success) return log('    login failed for', s.email, JSON.stringify(lr.error).slice(0, 120));
      const cr = await fetch(`${API}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${lr.data.accessToken}` },
        body: JSON.stringify({ currentPassword: s.tempPassword, newPassword: PASSWORD, confirmPassword: PASSWORD }),
      }).then((r) => r.json());
      if (cr.success) s.demoPassword = true;
      else log('    change-password failed', s.email, JSON.stringify(cr.error).slice(0, 160));
    });
    saveState(org.key, st);
    log(`  ${c.code}: ${cs.students.length} students, ${cs.students.filter((s) => s.demoPassword).length} on the demo password`);
  }
}
log('phase 3 done');

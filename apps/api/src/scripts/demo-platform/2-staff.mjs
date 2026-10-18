// Phase 2 — staff with logins in every role, then teachers on every section
// subject and a class teacher on every section. Created by the owner via HR.
import { session, pool, loadState, saveState, log, person, int } from './lib.mjs';
import { ORGS } from './spec.mjs';

const only = process.argv[2];
const TEACHERS_PER_INSTITUTION = 75;
const SCHOOL_TEACHERS = 45;

const CAMPUS_ROLES = (uni) => [
  ['BRANCH_ADMIN', 'admin', 1],
  ['ACCOUNTANT', 'accounts', 2],
  ['HR_MANAGER', 'hr', 1],
  ['ADMISSION_COUNSELOR', 'admissions', 2],
  ['RECEPTIONIST', 'frontdesk', 1],
  ['HOSTEL_WARDEN', 'warden', 1],
  ['INVENTORY_MANAGER', 'stores', 1],
  ...(uni ? [['PLACEMENT_OFFICER', 'placements', 1]] : []),
];

let phoneSeq = 0;
for (const org of ORGS.filter((o) => !only || o.key === only)) {
  const st = loadState(org.key);
  const owner = await session(org.owner);
  log(`== ${org.key}`);
  const orgIdx = ORGS.indexOf(org);

  for (const c of org.campuses) {
    const cs = st.campuses[c.code];
    const B = { branchId: cs.branchId };
    cs.staff ??= [];
    const has = new Set(cs.staff.map((s) => s.email));

    const make = async (spec) => {
      if (has.has(spec.email)) return cs.staff.find((s) => s.email === spec.email);
      const p = person();
      phoneSeq++;
      const body = {
        firstName: spec.firstName ?? p.firstName,
        lastName: spec.lastName ?? p.lastName,
        gender: p.gender,
        dateOfBirth: `${int(1968, 1996)}-0${int(1, 9)}-1${int(0, 9)}`,
        contact: { email: spec.email, phone: `9${orgIdx}${String(10_000_000 + phoneSeq + cs.staff.length * 7).slice(-8)}` },
        employment: {
          joiningDate: `20${int(10, 25)}-0${int(1, 9)}-0${int(1, 9)}`,
          employmentType: spec.contract ? 'contract' : 'permanent',
          ...(spec.departmentId && { departmentId: spec.departmentId }),
        },
        ...(spec.teaching && { teaching: { isTeaching: true } }),
        ...(spec.roleCode && { roleCode: spec.roleCode, password: undefined }),
        ...(spec.accessScope && { accessScope: spec.accessScope }),
      };
      if (spec.roleCode) body.password = (await import('./lib.mjs')).PASSWORD;
      let staff;
      try {
        staff = await owner.call('POST', '/hr/staff', body, B);
      } catch (e) {
        // Created on an earlier, interrupted run but not recorded — adopt it.
        if (e.code !== 'DUPLICATE_EMAIL') throw e;
        const found = await owner.call('GET', `/hr/staff?search=${encodeURIComponent(spec.email)}&limit=5`, undefined, B);
        staff = (found.staff ?? found).find((x) => x.contact?.email === spec.email);
        if (!staff) throw e;
        body.firstName = staff.firstName;
        body.lastName = staff.lastName;
      }
      const rec = {
        id: staff._id,
        email: spec.email,
        name: `${body.firstName} ${body.lastName}`,
        role: spec.roleCode ?? 'STAFF (no login)',
        title: spec.title,
        departmentId: spec.departmentId,
        institutionCode: spec.institutionCode,
        teaching: !!spec.teaching,
      };
      cs.staff.push(rec);
      has.add(spec.email);
      if (cs.staff.length % 25 === 0) saveState(org.key, st);
      return rec;
    };

    const base = `cvdemo-${org.key}-${c.code.toLowerCase()}`;
    // Orgs on their own domain (Marian) get real-looking addresses.
    const em = (local) => (org.key === 'marian' ? `${local}@${org.domain}` : `${base}-${local}@yopmail.com`);
    // Campus-level roles
    for (const [roleCode, slugName, n] of CAMPUS_ROLES(org.type === 'university')) {
      for (let i = 1; i <= n; i++) {
        await make({ email: em(`${slugName}${n > 1 ? i : ''}`), roleCode, title: roleCode === 'BRANCH_ADMIN' ? (org.type === 'school' ? 'Principal' : 'Campus Director') : slugName });
      }
    }

    if (org.type === 'university') {
      for (const inst of c.institutions) {
        const is = cs.institutions[inst.code];
        const ib = inst.code.toLowerCase();
        await make({ email: em(`${ib}-dean`), roleCode: 'INSTITUTION_ADMIN', title: 'Dean', institutionCode: inst.code, accessScope: { type: 'institution', institutionIds: [is.id] } });
        const depts = inst.departments.map((d) => ({ code: d.code, id: is.departments[d.code].id }));
        for (const d of depts) {
          await make({ email: em(`${ib}-${d.code.toLowerCase()}-hod`), roleCode: 'HOD', title: 'HOD', teaching: true, departmentId: d.id, institutionCode: inst.code, accessScope: { type: 'department', departmentIds: [d.id] } });
        }
        const specs = [];
        // Marian: about one teacher per three section-subjects (min 6).
        const load = cs.classes
          .filter((k) => k.institutionCode === inst.code)
          .reduce((n, k) => n + k.sections.length * k.subjectIds.length, 0);
        const nTeachers = org.key === 'marian' ? Math.max(6, Math.ceil(load / 3)) : TEACHERS_PER_INSTITUTION;
        for (let t = 1; t <= nTeachers; t++) {
          const d = depts[(t - 1) % depts.length];
          specs.push({ email: em(`${ib}-${d.code.toLowerCase()}-t${String(t).padStart(3, '0')}`), roleCode: 'TEACHER', title: t % 7 === 0 ? 'Associate Professor' : t % 3 === 0 ? 'Professor' : 'Assistant Professor', teaching: true, departmentId: d.id, institutionCode: inst.code, contract: t % 11 === 0 });
        }
        for (let n = 1; n <= (org.key === 'marian' ? Math.min(12, 2 + depts.length) : 12); n++) {
          specs.push({ email: em(`${ib}-office${n}`), title: n <= 6 ? 'Lab Assistant' : 'Office Assistant', departmentId: depts[n % depts.length].id, institutionCode: inst.code, contract: n % 3 === 0 });
        }
        await pool(specs, 4, make);
        saveState(org.key, st);
        log(`  ${c.code}/${inst.code}: ${cs.staff.filter((s) => s.institutionCode === inst.code).length} staff`);
      }
    } else {
      const specs = [];
      for (let t = 1; t <= SCHOOL_TEACHERS; t++) {
        specs.push({ email: em(`t${String(t).padStart(3, '0')}`), roleCode: 'TEACHER', title: t <= 5 ? 'Senior Teacher' : 'Teacher', teaching: true, contract: t % 9 === 0 });
      }
      for (let n = 1; n <= 8; n++) specs.push({ email: em(`office${n}`), title: n <= 3 ? 'Lab Assistant' : 'Support Staff' });
      await pool(specs, 4, make);
    }
    saveState(org.key, st);

    // Teachers onto every section subject (same department) + class teachers.
    if (!cs.teachersAssigned) {
      const teachers = cs.staff.filter((s) => s.teaching);
      const byDept = new Map();
      for (const t of teachers) {
        const k = t.departmentId ?? 'all';
        if (!byDept.has(k)) byDept.set(k, []);
        byDept.get(k).push(t);
      }
      const cursor = new Map();
      const nextTeacher = (deptId) => {
        const list = byDept.get(deptId ?? 'all') ?? teachers;
        const i = cursor.get(deptId) ?? 0;
        cursor.set(deptId, i + 1);
        return list[i % list.length];
      };
      const jobs = [];
      for (const k of cs.classes) {
        for (const sec of k.sections) {
          jobs.push(['class', sec, nextTeacher(k.departmentId)]);
          for (const sub of k.subjectIds) jobs.push(['subject', sec, nextTeacher(k.departmentId), sub]);
        }
      }
      await pool(jobs, 4, async ([kind, sec, t, sub]) => {
        if (kind === 'class') {
          await owner.call('PUT', `/organization/sections/${sec}/assign-teacher`, { staffId: t.id }, B).catch((e) => log('  class teacher skip', e.message.slice(0, 120)));
        } else {
          await owner.call('PUT', `/organization/sections/${sec}/subjects/${sub}`, { teacherId: t.id }, B);
        }
      });
      cs.teachersAssigned = true;
      saveState(org.key, st);
    }
    log(`  ${c.code}: ${cs.staff.length} staff, ${cs.staff.filter((s) => s.role !== 'STAFF (no login)').length} with logins`);
  }
}
log('phase 2 done');

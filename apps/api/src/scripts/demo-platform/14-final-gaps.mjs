// Phase 14 — the last gaps: leave for HODs/deans/campus admins, school
// departments, and counselling sessions.
import { session, loadState, saveState, log, pick, int } from './lib.mjs';
import { ORGS } from './spec.mjs';

const sessions = new Map();
const sess = async (email) => {
  if (!sessions.has(email)) sessions.set(email, await session(email));
  return sessions.get(email);
};
const soft = (label) => (e) => log(`   ${label}:`, e.message.slice(0, 170));

for (const org of ORGS.filter((o) => !process.argv[2] || o.key === process.argv[2])) {
  const st = loadState(org.key);
  const owner = await session(org.owner);
  log(`== ${org.key}`);
  for (const c of org.campuses) {
    const cs = st.campuses[c.code];
    const B = { branchId: cs.branchId };
    cs.gaps ??= {};
    const role = (r) => cs.staff.filter((s) => s.role === r);
    const out = [];

    // Leave for senior staff, approved by the campus admin (admins by the owner)
    if (!cs.gaps.seniorLeave) {
      const admin = await sess(role('BRANCH_ADMIN')[0].email);
      let n = 0;
      for (const s of [...role('HOD'), ...role('INSTITUTION_ADMIN'), ...role('BRANCH_ADMIN'), ...role('ACCOUNTANT'), ...role('HR_MANAGER'), ...role('ADMISSION_COUNSELOR'), ...role('RECEPTIONIST'), ...role('HOSTEL_WARDEN'), ...role('INVENTORY_MANAGER'), ...role('PLACEMENT_OFFICER')]) {
        const me = await sess(s.email);
        const mine = await me.call('GET', '/hr/leaves/my?limit=5', undefined, B).catch(() => []);
        if ((mine.length ?? 0) > 0) continue;
        const lv = await me.call('POST', '/hr/leaves', { ...(() => { const d = `2026-10-${String(int(23, 30)).padStart(2, '0')}`; return { fromDate: d, toDate: d }; })(), leaveType: 'CL', reason: pick(['Family function', 'Personal work', 'Attending a wedding']) }, B).catch(() => null)
          ?? await me.call('POST', '/hr/leaves', { ...(() => { const d = `2026-09-${String(int(2, 24)).padStart(2, '0')}`; return { fromDate: d, toDate: d }; })(), leaveType: 'SL', reason: 'Fever' }, B).catch(soft('leave'));
        if (!lv) continue;
        const approver = s.role === 'BRANCH_ADMIN' ? owner : admin;
        if (n % 3 !== 2) await approver.call('PUT', `/hr/leaves/${lv._id}/approve`, { remarks: 'Approved' }, B).catch(() => {});
        n++;
      }
      cs.gaps.seniorLeave = n;
      out.push(`${n} senior-staff leaves`);
    }

    // School departments (HR → Departments) with teachers attached
    if (org.type === 'school' && !cs.gaps.schoolDepts) {
      const depts = [];
      for (const [name, code] of [['Science', 'SCI'], ['Mathematics', 'MAT'], ['Languages', 'LNG'], ['Social Studies', 'SST'], ['Computer Science', 'CSC']]) {
        const d = await owner.call('POST', '/hr/departments', { name, code: `${code}${c.code.slice(1)}`, type: 'academic' }, B).catch(soft('department'));
        if (d) depts.push(d._id);
      }
      for (const [i, t] of role('TEACHER').entries()) {
        if (!depts.length) break;
        await owner.call('PUT', `/hr/staff/${t.id}`, { employment: { departmentId: depts[i % depts.length] } }, B).catch(() => {});
      }
      cs.gaps.schoolDepts = depts.length;
      out.push(`${depts.length} departments`);
    }

    // Counselling sessions (placement officer at universities, campus admin at schools)
    if (!cs.gaps.counseling) {
      const who = await sess((role('PLACEMENT_OFFICER')[0] ?? role('BRANCH_ADMIN')[0]).email);
      const students = (cs.students ?? []).filter((s) => s.demoPassword).slice(0, 6);
      let n = 0;
      for (const [i, s] of students.entries()) {
        await who.call('POST', '/career-connect/counseling/sessions', { sessionType: 'individual', audienceType: 'individual', studentId: s.id, scheduledDate: `2026-10-${String(15 + i).padStart(2, '0')}T11:00:00.000Z`, topic: pick(['Career options after graduation', 'Choosing electives', 'Exam stress and time management', 'Higher studies abroad']), notes: 'Follow-up in two weeks' }, B).then(() => n++).catch((e) => n === 0 && soft('counseling')(e));
      }
      cs.gaps.counseling = n;
      out.push(`${n} counselling sessions`);
    }
    saveState(org.key, st);
    log(`  ${c.code}: ${out.join(' · ')}`);
  }
}
log('phase 14 done');

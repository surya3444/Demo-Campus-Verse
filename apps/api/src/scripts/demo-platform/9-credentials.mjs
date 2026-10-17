// Writes DEMO-CREDENTIALS.md (the accounts worth demoing, by role) and
// demo-accounts.csv (every account) next to demo-password.txt.
import fs from 'fs';
import path from 'path';
import { loadState, STATE_DIR } from './lib.mjs';
import { ORGS } from './spec.mjs';

const ROOT = path.dirname(STATE_DIR);
const rows = [['organisation', 'campus', 'role', 'name', 'email', 'password']];
const md = [];
const SHARED = '(shared demo password — line 1 of demo-password.txt)';
// Accounts whose password a person changed in the app since they were created.
const CHANGED = { 'cvdemo-aranya-ablr-admin@yopmail.com': '(changed in the app — line 2 of demo-password.txt)' };
const pw = (email, fallback) => CHANGED[email] ?? fallback;

md.push('# Demo platform credentials', '');
md.push('Three demo organisations built through the real Campus Verse API on the production database. Every **staff** login and the **owner** logins use the one shared password stored in `demo-password.txt` (next to this file). Students listed below are on the same password; every other student has their own first-login password in `demo-accounts.csv` and is asked to change it on first sign-in.', '');
md.push('Remove everything with `npx tsx src/scripts/demo-platform/cleanup.ts` (run from `campus-verse-hub/apps/api`).', '');

for (const org of ORGS) {
  const st = loadState(org.key);
  md.push(`## ${org.key === 'aranya' ? 'Aranya University' : org.key === 'vedanta' ? 'Vedanta University' : 'Sunrise Public Schools'}`, '');
  md.push(`- **Owner (Group Owner):** \`${org.owner}\``, '');
  rows.push([org.key, '', 'GROUP_OWNER', 'Owner', org.owner, SHARED]);
  for (const c of org.campuses) {
    const cs = st.campuses?.[c.code];
    if (!cs) continue;
    md.push(`### ${c.name}`, '', '| Role | Name | Email |', '|---|---|---|');
    const show = (s, label) => md.push(`| ${label ?? s.title ?? s.role} | ${s.name} | \`${s.email}\`${CHANGED[s.email] ? ' — **uses line 2**' : ''} |`);
    const staff = cs.staff ?? [];
    for (const r of ['BRANCH_ADMIN', 'ACCOUNTANT', 'HR_MANAGER', 'ADMISSION_COUNSELOR', 'RECEPTIONIST', 'HOSTEL_WARDEN', 'INVENTORY_MANAGER', 'PLACEMENT_OFFICER']) {
      const s = staff.find((x) => x.role === r);
      if (s) show(s, { BRANCH_ADMIN: org.type === 'school' ? 'Principal (Campus Admin)' : 'Campus Admin', ACCOUNTANT: 'Accountant', HR_MANAGER: 'HR Manager', ADMISSION_COUNSELOR: 'Admission Counsellor', RECEPTIONIST: 'Receptionist', HOSTEL_WARDEN: 'Hostel Warden', INVENTORY_MANAGER: 'Inventory Manager', PLACEMENT_OFFICER: 'Placement Officer' }[r]);
    }
    for (const s of staff.filter((x) => x.role === 'INSTITUTION_ADMIN')) show(s, `Dean — ${s.institutionCode}`);
    for (const s of staff.filter((x) => x.role === 'HOD')) show(s, `HOD — ${s.institutionCode}`);
    const teachers = staff.filter((x) => x.role === 'TEACHER');
    for (const s of teachers.slice(0, 4)) show(s, `Teacher${s.institutionCode ? ' — ' + s.institutionCode : ''}`);
    const demoStudents = (cs.students ?? []).filter((s) => s.demoPassword);
    for (const s of demoStudents.slice(0, 4)) md.push(`| Student (${s.classKey}) | ${s.name} | \`${s.email}\` |`);
    md.push('', `${staff.length} staff (${teachers.length} teachers), ${(cs.students ?? []).length} students on this campus. All are in \`demo-accounts.csv\`.`, '');
    for (const s of staff) rows.push([org.key, c.code, s.role, s.name, s.email, s.role === 'STAFF (no login)' ? '(no login)' : pw(s.email, SHARED)]);
    for (const s of cs.students ?? []) rows.push([org.key, c.code, 'STUDENT', s.name, s.email, s.demoPassword ? SHARED : s.tempPassword ?? '']);
  }
}

md.push('## Totals', '', `${rows.length - 1} accounts in \`demo-accounts.csv\`.`, '');
fs.writeFileSync(path.join(ROOT, 'DEMO-CREDENTIALS.md'), md.join('\n'));
fs.writeFileSync(
  path.join(ROOT, 'demo-accounts.csv'),
  rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
);
fs.chmodSync(path.join(ROOT, 'demo-accounts.csv'), 0o600);
console.log(`wrote DEMO-CREDENTIALS.md and demo-accounts.csv (${rows.length - 1} accounts)`);

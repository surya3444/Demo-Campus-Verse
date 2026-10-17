// Phase 11 — designation ladders, every staff member on a designation, a few
// staff promotions, and a draft student promotion run into AY 2027-28 (left
// for review, so current classes don't change).
import { session, pool, loadState, saveState, log, rnd } from './lib.mjs';
import { ORGS } from './spec.mjs';

const only = process.argv[2];

// Lower level = more senior (same convention as role levels).
const LADDER = {
  university: [
    ['Campus Director', 'DIR', 'management', 1], ['Dean', 'DEAN', 'management', 2], ['Head of Department', 'HOD', 'management', 3],
    ['Professor', 'PROF', 'teaching', 4], ['Associate Professor', 'ASP', 'teaching', 5], ['Assistant Professor', 'AP', 'teaching', 6],
  ],
  school: [
    ['Principal', 'PRIN', 'management', 1], ['Senior Teacher', 'STCH', 'teaching', 4], ['Teacher', 'TCH', 'teaching', 5],
  ],
  common: [
    ['HR Manager', 'HRM', 'management', 3], ['Placement Officer', 'PLO', 'management', 4], ['Accountant', 'ACC', 'non-teaching', 6],
    ['Admission Counsellor', 'ADC', 'non-teaching', 7], ['Hostel Warden', 'WAR', 'non-teaching', 7], ['Store Keeper', 'STK', 'non-teaching', 7],
    ['Receptionist', 'REC', 'non-teaching', 8], ['Lab Assistant', 'LA', 'non-teaching', 9], ['Office Assistant', 'OA', 'non-teaching', 9], ['Support Staff', 'SS', 'non-teaching', 10],
  ],
};

const TITLE_TO_CODE = {
  'Assistant Professor': 'AP', 'Associate Professor': 'ASP', Professor: 'PROF', HOD: 'HOD', Dean: 'DEAN', 'Campus Director': 'DIR',
  Teacher: 'TCH', 'Senior Teacher': 'STCH', Principal: 'PRIN', 'Office Assistant': 'OA', 'Lab Assistant': 'LA', 'Support Staff': 'SS',
  frontdesk: 'REC', warden: 'WAR', stores: 'STK', admissions: 'ADC', accounts: 'ACC', placements: 'PLO', hr: 'HRM',
};

for (const org of ORGS.filter((o) => !only || o.key === only)) {
  const st = loadState(org.key);
  const owner = await session(org.owner);
  log(`== ${org.key}`);
  for (const c of org.campuses) {
    const cs = st.campuses[c.code];
    const B = { branchId: cs.branchId };
    cs.designations ??= {};

    const existing = await owner.call('GET', '/hr/designations?limit=100', undefined, B);
    for (const d of existing.designations ?? existing) cs.designations[d.code?.replace(`${c.code}-`, '')] ??= d._id;
    for (const [name, code, category, level] of [...LADDER[org.type], ...LADDER.common]) {
      if (cs.designations[code]) {
        // Correct the level on designations created with the old (inverted) ladder.
        await owner.call('PUT', `/hr/designations/${cs.designations[code]}`, { level }, B).catch(() => {});
        continue;
      }
      const d = await owner.call('POST', '/hr/designations', { name, code: `${c.code}-${code}`, category, level, description: `${name} — ${c.name}` }, B);
      cs.designations[code] = d._id;
    }
    saveState(org.key, st);

    cs.designated ??= {};
    await pool(cs.staff.filter((s) => !cs.designated[s.id]), 4, async (s) => {
      const code = TITLE_TO_CODE[s.title] ?? (s.role === 'BRANCH_ADMIN' ? (org.type === 'school' ? 'PRIN' : 'DIR') : null);
      const designationId = code && cs.designations[code];
      if (!designationId) return;
      await owner.call('PUT', `/hr/staff/${s.id}`, { employment: { designationId } }, B).catch((e) => log('   designate:', e.message.slice(0, 150)));
      cs.designated[s.id] = code;
    });
    saveState(org.key, st);

    // Promote a few staff up the ladder
    if (!cs.promoted) {
      const up = org.type === 'school' ? [['TCH', 'STCH']] : [['AP', 'ASP'], ['ASP', 'PROF']];
      let n = 0;
      for (const [from, to] of up) {
        const pool_ = cs.staff.filter((s) => cs.designated[s.id] === from && rnd() < 0.08).slice(0, 5);
        for (const s of pool_) {
          await owner
            .call('POST', `/hr/staff/${s.id}/promote`, { toDesignationId: cs.designations[to], effectiveFrom: '2026-10-01', remarks: 'Annual performance review — promoted' }, B)
            .then(() => {
              n++;
              cs.designated[s.id] = to;
            })
            .catch((e) => n === 0 && log('   promote:', e.message.slice(0, 160)));
        }
      }
      cs.promoted = n;
      saveState(org.key, st);
      log(`  ${c.code}: ${Object.keys(cs.designated).length} staff designated, ${n} promoted`);
    }

    // Next academic year (not activated) + a draft promotion run for review
    if (!cs.promotionRun) {
      const uni = org.type === 'university';
      const batches = await owner.call('GET', '/organization/academic-batches', undefined, B);
      let next = (batches.batches ?? batches).find((b) => b.code === 'AY2728');
      next ??= await owner.call('POST', '/organization/academic-batches', uni
        ? { name: 'AY 2027-28', code: 'AY2728', startDate: '2027-07-01', endDate: '2028-06-30', terms: [
            { name: 'Odd Semester 2027', half: 'odd', pattern: 'semester', startDate: '2027-07-15', endDate: '2027-12-15' },
            { name: 'Even Semester 2028', half: 'even', pattern: 'semester', startDate: '2028-01-05', endDate: '2028-05-31' },
          ] }
        : { name: 'AY 2027-28', code: 'AY2728', startDate: '2027-04-01', endDate: '2028-03-31' }, B);
      const run = await owner.call('POST', '/exams/promotions/runs', { fromBatchId: cs.batchId, toBatchId: next._id }, B).catch((e) => (log('   promotion run:', e.message.slice(0, 170)), null));
      cs.promotionRun = run?._id ?? 'failed';
      saveState(org.key, st);
      log(`  ${c.code}: promotion run ${run ? 'drafted' : 'not created'} into AY 2027-28`);
    }
  }
}
log('phase 11 done');

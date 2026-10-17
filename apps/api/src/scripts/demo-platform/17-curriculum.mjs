// Phase 17 — the curriculum (Course Registration → Curriculum) was empty: the
// demo attached subjects straight onto sections. For every university
// program-year, publish this odd semester's scheme (Year N → Sem 2N−1) from
// the subjects its sections already teach. Publishing only adds missing
// section subjects, so teacher assignments are untouched.
import { session, loadState, saveState, log } from './lib.mjs';
import { ORGS } from './spec.mjs';

for (const org of ORGS.filter((o) => o.type === 'university')) {
  const st = loadState(org.key);
  const owner = await session(org.owner);
  log(`== ${org.key}`);
  for (const c of org.campuses) {
    const cs = st.campuses[c.code];
    const B = { branchId: cs.branchId };
    cs.gaps ??= {};
    if (cs.gaps.curriculum) continue;

    const have = await owner.call('GET', '/registration/schemes', undefined, B).catch(() => []);
    const taken = new Set((have.data ?? have).map((s) => `${s.programId ?? s.departmentCode}:${s.semesterNumber}`));
    const classes = await owner.call('GET', `/organization/classes?academicBatchId=${cs.batchId}&limit=200`, undefined, B);
    const subjectsRes = await owner.call('GET', '/organization/subjects?limit=500', undefined, B);
    const credits = new Map((subjectsRes.data ?? subjectsRes).map((s) => [s._id, s.credits ?? 3]));

    let published = 0;
    for (const k of (classes.data ?? classes).filter((x) => x.programId)) {
      const year = Number(((k.path.find((p) => p.levelKey === 'year') ?? {}).code ?? '').replace(/\D/g, ''));
      if (!year) continue;
      const sem = 2 * year - 1;
      if (taken.has(`${k.programId}:${sem}`)) continue;
      const ids = new Set();
      for (const s of k.sections ?? []) {
        const sec = await owner.call('GET', `/organization/sections/${s._id}`, undefined, B).catch(() => null);
        for (const x of sec?.subjects ?? []) ids.add(String(x.subjectId?._id ?? x.subjectId));
      }
      if (!ids.size) continue;
      const slots = [...ids].map((subjectId) => ({ kind: 'core', subjectId, credits: credits.get(subjectId) ?? 3 }));
      const total = slots.reduce((n, s) => n + s.credits, 0);
      const top = k.path[0];
      const scheme = await owner
        .call('POST', '/registration/schemes', { departmentCode: top.code, departmentName: top.name, programId: k.programId, semesterNumber: sem, slots, minCredits: Math.min(total, 16), maxCredits: Math.min(Math.max(total, 16), 60) }, B)
        .catch((e) => log('   scheme:', k.displayName, e.message.slice(0, 160)));
      if (!scheme) continue;
      await owner.call('POST', `/registration/schemes/${scheme._id}/publish`, {}, B).then(() => published++).catch((e) => log('   publish:', e.message.slice(0, 160)));
    }
    cs.gaps.curriculum = published;
    saveState(org.key, st);
    log(`  ${c.code}: ${published} semester curricula published`);
  }
}
log('phase 17 done');

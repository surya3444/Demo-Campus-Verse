// Phase 12 — OBE attainment needs an external instrument: link each offering
// to its subject's paper in the published Mid-Semester exam, then compute.
import { session, loadState, saveState, log } from './lib.mjs';
import { ORGS } from './spec.mjs';

for (const org of ORGS.filter((o) => o.type === 'university')) {
  const st = loadState(org.key);
  const owner = await session(org.owner);
  log(`== ${org.key}`);
  for (const c of org.campuses) {
    const cs = st.campuses[c.code];
    const B = { branchId: cs.branchId };
    let computed = 0;
    for (const [code, P] of Object.entries(cs.obe ?? {})) {
      if (code === 'done' || !P.offerings) continue;
      for (const off of P.offerings) {
        if (off.computed) {
          computed++;
          continue;
        }
        const examId = cs.exams?.[`${off.classId}:mid1`]?.id;
        if (!examId) continue;
        const exam = await owner.call('GET', `/exams/${examId}`, undefined, B);
        const paper = (exam.papers ?? []).find((p) => String(p.subjectId) === String(off.subjectId));
        if (!paper) continue;
        if (!off.external) {
          await owner
            .call('POST', `/obe/offerings/${off.id}/instruments`, { name: 'Mid-Semester Examination I', kind: 'external', order: 5, examId, paperId: paper._id }, B)
            .then(() => (off.external = true))
            .catch((e) => log('   external:', e.message.slice(0, 170)));
        }
        await owner
          .call('POST', `/obe/offerings/${off.id}/compute`, {}, B)
          .then(() => {
            off.computed = true;
            computed++;
          })
          .catch((e) => log('   compute:', e.message.slice(0, 170)));
        saveState(org.key, st);
      }
    }
    log(`  ${c.code}: ${computed} offerings with computed attainment`);
  }
}
log('phase 12 done');

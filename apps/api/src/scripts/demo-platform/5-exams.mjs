// Phase 5 — exams: completed + published, marked-but-unpublished, and an
// upcoming exam with hall tickets. Marks follow each student's ability.
import { session, pool, loadState, saveState, log, rnd } from './lib.mjs';
import { ORGS } from './spec.mjs';

const only = process.argv[2];

const ability = new Map();
const abilityOf = (id) => {
  if (!ability.has(id)) {
    // mean-ish 0.62, a few toppers and a few strugglers
    const u = (rnd() + rnd() + rnd()) / 3;
    ability.set(id, Math.min(0.97, Math.max(0.22, 0.3 + u * 0.65)));
  }
  return ability.get(id);
};
const mark = (id, total) => {
  const a = abilityOf(id);
  const v = Math.round(total * Math.min(1, Math.max(0, a + (rnd() - 0.5) * 0.25)));
  return v;
};

const PLAN = {
  university: [
    { key: 'mid1', name: 'Mid-Semester Examination I', type: 'mid_term', start: '2026-09-07', days: 5, total: 50, pass: 20, state: 'published' },
    { key: 'ut2', name: 'Unit Test II', type: 'unit_test', start: '2026-10-05', days: 3, total: 25, pass: 10, state: 'marked' },
    { key: 'endsem', name: 'End Semester Examination', type: 'final', start: '2026-12-01', days: 10, total: 100, pass: 40, state: 'scheduled' },
  ],
  school: [
    { key: 'ut1', name: 'Unit Test 1', type: 'unit_test', start: '2026-07-13', days: 5, total: 25, pass: 9, state: 'published' },
    { key: 'hy', name: 'Half-Yearly Examination', type: 'half_yearly', start: '2026-09-21', days: 8, total: 80, pass: 27, state: 'published' },
    { key: 'ut3', name: 'Unit Test 3', type: 'unit_test', start: '2026-11-16', days: 5, total: 25, pass: 9, state: 'scheduled' },
  ],
};

const addDays = (d, n) => {
  const t = new Date(d + 'T00:00:00Z');
  let added = 0;
  while (added < n) {
    t.setUTCDate(t.getUTCDate() + 1);
    if (t.getUTCDay() !== 0) added++;
  }
  return t.toISOString().slice(0, 10);
};

for (const org of ORGS.filter((o) => !only || o.key === only)) {
  const st = loadState(org.key);
  const owner = await session(org.owner);
  log(`== ${org.key}`);
  for (const c of org.campuses) {
    const cs = st.campuses[c.code];
    const B = { branchId: cs.branchId };
    cs.exams ??= {};
    const batch = await owner.call('GET', `/organization/academic-batches/${cs.batchId}`, undefined, B);
    const oddTerm = (batch.terms ?? []).find((t) => t.half === 'odd');
    const studentsBySection = new Map();
    for (const s of cs.students ?? []) {
      if (!studentsBySection.has(s.sectionId)) studentsBySection.set(s.sectionId, []);
      studentsBySection.get(s.sectionId).push(s);
    }

    await pool(cs.classes, 3, async (k) => {
      for (const plan of PLAN[org.type]) {
        const key = `${k.classId}:${plan.key}`;
        if (cs.exams[key]?.done) continue;
        // Reuse an exam already on the server (an earlier, interrupted run).
        if (!cs.exams[key]?.id) {
          const found = await owner.call('GET', `/exams?classId=${k.classId}&academicBatchId=${cs.batchId}&limit=50`, undefined, B);
          const hit = (found.exams ?? found).find((e) => e.name === plan.name);
          if (hit) cs.exams[key] = { id: hit._id };
        }
        const ex =
          cs.exams[key]?.id
            ? await owner.call('GET', `/exams/${cs.exams[key].id}`, undefined, B)
            : await owner.call(
                'POST',
                '/exams',
                {
                  academicBatchId: cs.batchId,
                  ...(oddTerm ? { termId: oddTerm._id } : { termName: plan.type === 'half_yearly' ? 'Term 1' : plan.key === 'ut3' ? 'Term 2' : 'Term 1' }),
                  name: plan.name,
                  type: plan.type,
                  classIds: [k.classId],
                  papers: k.subjectIds.map((subjectId) => ({ subjectId, totalMarks: plan.total, passMarks: plan.pass })),
                  startDate: plan.start,
                  endDate: addDays(plan.start, plan.days),
                  instructions: 'Carry your hall ticket and college ID. Reach the hall 15 minutes early.',
                },
                B
              );
        cs.exams[key] = { id: ex._id };
        if (ex.status === 'results_published' || (plan.state === 'marked' && ex.status === 'completed' && cs.exams[key].marked)) {
          cs.exams[key].done = true;
          saveState(org.key, st);
          continue;
        }
        // One paper a day, morning slot, all sections of the class
        for (const [i, paper] of (ex.papers ?? []).entries()) {
          await owner
            .call('POST', '/exams/schedules/bulk', { examId: ex._id, paperId: paper._id, sectionIds: k.sections, date: addDays(plan.start, i), startTime: '10:00', endTime: plan.total >= 80 ? '13:00' : '11:30', room: `Hall ${1 + (i % 4)}` }, B)
            .catch((e) => {
              if (!/exist|already|duplicate/i.test(e.message)) throw e;
            });
        }
        if (plan.state === 'scheduled') {
          await owner.call('PUT', `/exams/${ex._id}/status`, { status: 'scheduled' }, B).catch(() => {});
          for (const sec of k.sections) {
            await owner.call('POST', '/exams/hall-tickets/generate', { examId: ex._id, sectionId: sec }, B).catch((e) => log('    hall tickets:', e.message.slice(0, 140)));
          }
        } else {
          for (const status of ['scheduled', 'ongoing', 'completed']) {
            await owner.call('PUT', `/exams/${ex._id}/status`, { status }, B).catch(() => {});
          }
          const students = k.sections.flatMap((s) => studentsBySection.get(s) ?? []);
          for (const paper of ex.papers ?? []) {
            if (!students.length) break;
            await owner.call(
              'POST',
              '/exams/marks/bulk',
              {
                examId: ex._id,
                paperId: paper._id,
                marks: students.map((s) => {
                  const absent = rnd() < 0.02;
                  return { studentId: s.id, marksObtained: absent ? 0 : mark(s.id, plan.total), absent };
                }),
              },
              B
            );
          }
          if (plan.state === 'published') {
            await owner.call('POST', '/exams/results/publish', { examId: ex._id }, B).catch((e) => log('    publish:', e.message.slice(0, 140)));
            for (const sec of k.sections) {
              await owner.call('POST', '/exams/report-cards/generate', { examId: ex._id, sectionId: sec }, B).catch((e) => log('    report cards:', e.message.slice(0, 140)));
            }
            await owner.call('POST', '/exams/report-cards/bulk-publish', { examId: ex._id }, B).catch((e) => log('    publish cards:', e.message.slice(0, 140)));
          }
        }
        cs.exams[key].done = true;
        saveState(org.key, st);
      }
    });
    log(`  ${c.code}: ${Object.values(cs.exams).filter((e) => e.done).length} exams`);
  }
}
log('phase 5 done');

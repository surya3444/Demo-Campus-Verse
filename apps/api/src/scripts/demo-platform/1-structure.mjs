// Phase 1 — campuses, academic year, institutions, departments, programs,
// subjects, classes and sections, created by each organisation's owner.
// Re-runnable: everything created is recorded in demo-state/<org>.json.
import { session, pool, loadState, saveState, log } from './lib.mjs';
import { ORGS, SUBJECTS, subjectKey } from './spec.mjs';

const only = process.argv[2];

async function ensure(state, key, make) {
  if (state[key]) return state[key];
  state[key] = await make();
  return state[key];
}

for (const org of ORGS.filter((o) => !only || o.key === only)) {
  const st = loadState(org.key);
  st.campuses ??= {};
  const owner = await session(org.owner);
  log(`== ${org.key} (${owner.user().tenant?.code})`);
  st.tenantId = owner.user().tenantId ?? owner.user().tenant?._id;

  const existing = await owner.call('GET', '/organization/branches?limit=50');
  const existingByCode = new Map((existing.branches ?? existing).map((b) => [b.code, b]));

  for (const c of org.campuses) {
    const cs = (st.campuses[c.code] ??= {});
    cs.branchId ??=
      existingByCode.get(c.code)?._id ??
      (
        await owner.call('POST', '/organization/branches', {
          name: c.name,
          code: c.code,
          institutionType: org.type,
          location: { address: c.address, city: c.city, state: c.state, country: 'India', pincode: c.pincode },
          contact: { email: `${c.code.toLowerCase()}@${org.domain}`, phone: '80' + String(45670000 + Object.keys(st.campuses).length) },
        })
      )._id;
    const B = { branchId: cs.branchId };
    log(`  campus ${c.code} ${cs.branchId}`);
    saveState(org.key, st);

    // University campuses: Department → Program → Year → Section
    if (org.type === 'university' && !cs.hierarchy) {
      await owner.call(
        'PUT',
        '/organization/academic-hierarchy',
        {
          levels: [
            { key: 'department', label: 'Department', labelPlural: 'Departments', isLeaf: false, order: 1 },
            { key: 'program', label: 'Program', labelPlural: 'Programs', isLeaf: false, order: 2 },
            { key: 'year', label: 'Year', labelPlural: 'Years', isLeaf: false, order: 3 },
            { key: 'section', label: 'Section', labelPlural: 'Sections', isLeaf: true, order: 4 },
          ],
        },
        B
      );
      cs.hierarchy = true;
    }

    // Academic year
    await ensure(cs, 'batchId', async () => {
      const uni = org.type === 'university';
      const batch = await owner.call(
        'POST',
        '/organization/academic-batches',
        uni
          ? {
              name: 'AY 2026-27',
              code: 'AY2627',
              startDate: '2026-07-01',
              endDate: '2027-06-30',
              terms: [
                { name: 'Odd Semester 2026', half: 'odd', pattern: 'semester', startDate: '2026-07-15', endDate: '2026-12-15' },
                { name: 'Even Semester 2027', half: 'even', pattern: 'semester', startDate: '2027-01-05', endDate: '2027-05-31' },
              ],
            }
          : { name: 'AY 2026-27', code: 'AY2627', startDate: '2026-04-01', endDate: '2027-03-31' },
        B
      );
      await owner.call('PUT', `/organization/academic-batches/${batch._id}/activate`, {}, B);
      return batch._id;
    });
    saveState(org.key, st);

    cs.classes ??= [];
    cs.subjects ??= {};
    const hier = await owner.call('GET', '/organization/academic-hierarchy', undefined, B);
    const levels = hier.levels.filter((l) => !l.isLeaf).map((l) => l.key);

    if (org.type === 'university') {
      cs.institutions ??= {};
      for (const inst of c.institutions) {
        const is = (cs.institutions[inst.code] ??= {});
        await ensure(is, 'id', async () =>
          (await owner.call('POST', '/organization/institutions', { name: inst.name, code: inst.code, kind: inst.kind }, B))._id
        );
        is.departments ??= {};
        for (const d of inst.departments) {
          const ds = (is.departments[d.code] ??= {});
          await ensure(ds, 'id', async () =>
            (await owner.call('POST', '/hr/departments', { name: d.name, code: d.code, type: 'academic', institutionId: is.id }, B))._id
          );
          ds.programs ??= {};
          for (const p of d.programs) {
            const ps = (ds.programs[p.code] ??= {});
            await ensure(ps, 'id', async () =>
              (
                await owner.call(
                  'POST',
                  '/organization/programs',
                  { departmentId: ds.id, name: p.name, code: p.code, degreeType: p.degreeType, durationYears: p.years, termPattern: 'semester' },
                  B
                )
              )._id
            );
            const list = SUBJECTS[subjectKey(p.code)];
            for (let y = 1; y <= p.years; y++) {
              const key = `${p.code}-Y${y}`;
              if (cs.classes.some((k) => k.key === key)) continue;
              // Subjects for this program-year
              const names = list[Math.min(y, list.length) - 1];
              const subjectIds = [];
              for (const [n, name] of names.entries()) {
                const code = `${c.code.slice(1)}${p.code}${y}${n + 1}`.slice(0, 20);
                const sub =
                  cs.subjects[code] ??
                  (
                    await owner.call(
                      'POST',
                      '/organization/subjects',
                      { name, code, type: n === 1 ? 'both' : 'theory', credits: n === 4 ? 2 : 4, maxMarks: 100, passingMarks: 40, ownerDepartmentId: ds.id },
                      B
                    )
                  )._id;
                cs.subjects[code] = sub;
                subjectIds.push(sub);
              }
              const path = levels.map((lv) =>
                lv === 'department'
                  ? { levelKey: 'department', name: d.name, code: d.code }
                  : lv === 'program'
                    ? { levelKey: 'program', name: p.name, code: p.code }
                    : { levelKey: 'year', name: `Year ${y}`, code: `Y${y}` }
              );
              const cls = await owner.call('POST', '/organization/classes', { academicBatchId: cs.batchId, path, programId: ps.id }, B);
              const nSections = y === 1 && p.sectionsY1 ? p.sectionsY1 : 1;
              const sections = [];
              for (let s = 0; s < nSections; s++) {
                const sec = await owner.call('POST', `/organization/classes/${cls._id}/sections`, { classId: cls._id, name: 'ABCD'[s], capacity: 60 }, B);
                for (const subjectId of subjectIds) {
                  await owner.call('POST', `/organization/sections/${sec._id}/subjects`, { subjectId, periodsPerWeek: 4 }, B);
                }
                sections.push(sec._id);
              }
              cs.classes.push({ key, classId: cls._id, sections, subjectIds, year: y, programId: ps.id, programCode: p.code, departmentId: ds.id, institutionId: is.id, institutionCode: inst.code, departmentCode: d.code });
              saveState(org.key, st);
            }
          }
        }
      }
    } else {
      // School: Grade → Section, one shared subject list per campus
      const subjectIds = [];
      for (const [n, name] of SUBJECTS.SCHOOL.entries()) {
        const code = `${c.code}SUB${n + 1}`;
        cs.subjects[code] ??= (
          await owner.call('POST', '/organization/subjects', { name, code, type: 'theory', maxMarks: 100, passingMarks: 33 }, B)
        )._id;
        subjectIds.push(cs.subjects[code]);
      }
      for (let g = 1; g <= org.grades; g++) {
        const key = `G${g}`;
        if (cs.classes.some((k) => k.key === key)) continue;
        const path = [{ levelKey: levels[0], name: `Grade ${g}`, code: `G${g}` }];
        const cls = await owner.call('POST', '/organization/classes', { academicBatchId: cs.batchId, path }, B);
        const subs = g <= 2 ? subjectIds.filter((_, i) => i !== 2 && i !== 6) : subjectIds;
        const sections = await pool(Array.from({ length: org.sectionsPerGrade }, (_, s) => s), 2, async (s) => {
          const sec = await owner.call('POST', `/organization/classes/${cls._id}/sections`, { classId: cls._id, name: 'ABCD'[s], capacity: 40 }, B);
          for (const subjectId of subs) {
            await owner.call('POST', `/organization/sections/${sec._id}/subjects`, { subjectId, periodsPerWeek: 5 }, B);
          }
          return sec._id;
        });
        cs.classes.push({ key, classId: cls._id, sections, subjectIds: subs, year: g });
        saveState(org.key, st);
      }
    }
    log(`  ${c.code}: ${cs.classes.length} classes, ${cs.classes.reduce((n, k) => n + k.sections.length, 0)} sections, ${Object.keys(cs.subjects).length} subjects`);
  }
  saveState(org.key, st);
}
log('phase 1 done');

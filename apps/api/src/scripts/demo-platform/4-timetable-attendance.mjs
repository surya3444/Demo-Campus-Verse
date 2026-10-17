// Phase 4 — holidays, timetables for every section, student attendance since
// 1 Sep (today partly open), staff attendance since 1 Aug.
import { session, pool, loadState, saveState, log, rnd, int } from './lib.mjs';
import { ORGS } from './spec.mjs';

const only = process.argv[2];
const steps = (process.argv[3] ?? 'holidays,timetable,attendance,staff').split(',');
const TODAY = '2026-10-14';

const HOLIDAYS = [
  { name: 'Independence Day', date: '2026-08-15', type: 'national' },
  { name: 'Ganesh Chaturthi', date: '2026-09-14', type: 'religious' },
  { name: 'Gandhi Jayanti', date: '2026-10-02', type: 'national' },
  { name: 'Dussehra', date: '2026-10-20', endDate: '2026-10-21', type: 'religious' },
  { name: 'Diwali Break', date: '2026-11-08', endDate: '2026-11-11', type: 'vacation' },
  { name: 'Kannada Rajyotsava', date: '2026-11-01', type: 'local' },
  { name: 'Christmas', date: '2026-12-25', type: 'religious' },
  { name: 'Republic Day', date: '2027-01-26', type: 'national' },
];
const HOLIDAY_SET = new Set(['2026-08-15', '2026-09-14', '2026-10-02']);

function workingDays(from, to) {
  const out = [];
  for (let t = new Date(from + 'T00:00:00Z'); t <= new Date(to + 'T00:00:00Z'); t = new Date(t.getTime() + 86_400_000)) {
    const k = t.toISOString().slice(0, 10);
    if (t.getUTCDay() !== 0 && !HOLIDAY_SET.has(k)) out.push(k);
  }
  return out;
}

const SLOTS = [
  ['P1', '09:00', '09:50', 'period'],
  ['P2', '09:50', '10:40', 'period'],
  ['Short Break', '10:40', '10:55', 'break'],
  ['P3', '10:55', '11:45', 'period'],
  ['P4', '11:45', '12:35', 'period'],
  ['Lunch', '12:35', '13:20', 'lunch'],
  ['P5', '13:20', '14:10', 'period'],
  ['P6', '14:10', '15:00', 'period'],
];

// Each student keeps a personal attendance tendency so reports look real.
const tendency = new Map();
const rateFor = (id) => {
  if (!tendency.has(id)) {
    const r = rnd();
    tendency.set(id, r < 0.08 ? 0.62 + rnd() * 0.1 : r < 0.25 ? 0.78 + rnd() * 0.08 : 0.88 + rnd() * 0.11);
  }
  return tendency.get(id);
};

for (const org of ORGS.filter((o) => !only || o.key === only)) {
  const st = loadState(org.key);
  const owner = await session(org.owner);
  log(`== ${org.key}`);

  for (const c of org.campuses) {
    const cs = st.campuses[c.code];
    const B = { branchId: cs.branchId };

    if (steps.includes('holidays') && !cs.holidays) {
      for (const h of HOLIDAYS) {
        await owner.call('POST', '/attendance/holidays', { ...h, applicableFor: 'all' }, B).catch((e) => {
          if (e.code !== 'HOLIDAY_EXISTS') throw e;
        });
      }
      cs.holidays = true;
      saveState(org.key, st);
    }

    if (steps.includes('timetable')) {
      cs.timetable ??= {};
      for (const k of cs.classes) {
        // Bell schedule per class
        if (!cs.timetable[k.classId]) {
          const slots = [];
          for (const [i, [name, startTime, endTime, type]] of SLOTS.entries()) {
            const s = await owner.call('POST', '/teaching/timetable/slots', { classId: k.classId, name, startTime, endTime, order: i, type }, B);
            slots.push({ id: s._id, type, name });
          }
          cs.timetable[k.classId] = { slots, sections: {} };
          saveState(org.key, st);
        }
        const tt = cs.timetable[k.classId];
        const periods = tt.slots.filter((s) => s.type === 'period');
        for (const [si, sec] of k.sections.entries()) {
          if (tt.sections[sec]) continue;
          const subs = await owner.call('GET', `/organization/sections/${sec}/subjects`, undefined, B);
          const rows = (subs.subjects ?? subs).filter((x) => x.teacherId || x.teacher?._id);
          if (!rows.length) continue;
          let made = 0;
          // Mon–Sat, six periods; rotate so no subject is always first period
          const entries = [];
          for (let day = 1; day <= 6; day++) {
            for (const [pi, slot] of periods.entries()) {
              const r = rows[(pi + day + si) % rows.length];
              entries.push({ sectionId: sec, slotId: slot.id, dayOfWeek: day, subjects: [{ subjectId: r.subjectId ?? r.subject?._id ?? r._id, teacherId: r.teacherId ?? r.teacher?._id, roomNumber: `${c.code.slice(1)}-${100 + (k.year * 10) + si}` }] });
            }
          }
          // One bulk call per section; the API inserts what fits and reports
          // teacher clashes (a teacher already busy that hour) instead of failing.
          const res = await owner.call(
            'POST',
            '/teaching/timetable/entries/bulk',
            { entries: entries.map((e) => ({ sectionId: e.sectionId, slotId: e.slotId, dayOfWeek: e.dayOfWeek, ...e.subjects[0] })) },
            B
          );
          made = res.summary?.created ?? res.created ?? entries.length - (res.conflicts?.length ?? 0);
          tt.sections[sec] = made;
          saveState(org.key, st);
        }
      }
      const total = Object.values(cs.timetable).reduce((n, t) => n + Object.values(t.sections).reduce((a, b) => a + b, 0), 0);
      log(`  ${c.code}: timetable ${total} periods`);
    }

    if (steps.includes('attendance')) {
      cs.attendanceDays ??= {};
      const days = workingDays(org.type === 'school' ? '2026-09-01' : '2026-09-01', TODAY);
      const bySection = new Map();
      for (const s of cs.students ?? []) {
        if (!bySection.has(s.sectionId)) bySection.set(s.sectionId, []);
        bySection.get(s.sectionId).push(s);
      }
      const jobs = [];
      for (const k of cs.classes) {
        for (const [si, sec] of k.sections.entries()) {
          for (const d of days) {
            // Leave about a third of today's registers open for teachers.
            if (d === TODAY && (si + k.year) % 3 === 0) continue;
            if (!cs.attendanceDays[`${sec}:${d}`]) jobs.push({ k, sec, d });
          }
        }
      }
      log(`  ${c.code}: ${jobs.length} attendance registers to mark`);
      let n = 0;
      await pool(jobs, 4, async ({ k, sec, d }) => {
        const students = bySection.get(sec) ?? [];
        if (!students.length) return;
        const records = students.map((s) => {
          const roll = rnd();
          const rate = rateFor(s.id);
          return { studentId: s.id, status: roll < rate ? (rnd() < 0.05 ? 'late' : 'present') : rnd() < 0.2 ? 'leave' : 'absent' };
        });
        await owner.call('POST', '/attendance/students', { classId: k.classId, sectionId: sec, date: d, records }, B);
        cs.attendanceDays[`${sec}:${d}`] = 1;
        if (++n % 200 === 0) {
          saveState(org.key, st);
          log(`    ${c.code}: ${n} registers`);
        }
      });
      saveState(org.key, st);
    }

    if (steps.includes('staff')) {
      cs.staffAttendance ??= {};
      const days = workingDays('2026-08-01', TODAY);
      const staffTendency = new Map((cs.staff ?? []).map((s) => [s.id, 0.9 + rnd() * 0.09]));
      await pool(days.filter((d) => !cs.staffAttendance[d]), 2, async (d) => {
        const records = (cs.staff ?? []).map((s) => {
          const present = rnd() < staffTendency.get(s.id);
          const late = present && rnd() < 0.06;
          return present
            ? { staffId: s.id, status: late ? 'late' : 'present', checkIn: late ? `09:${String(int(16, 45))}` : `08:${String(int(30, 58))}`, checkOut: `${int(16, 17)}:${String(int(10, 55))}` }
            : { staffId: s.id, status: 'absent' };
        });
        await owner.call('POST', '/hr/attendance', { date: d, records }, B);
        cs.staffAttendance[d] = 1;
      });
      saveState(org.key, st);
      log(`  ${c.code}: staff attendance ${Object.keys(cs.staffAttendance).length} days`);
    }
  }
}
log('phase 4 done');

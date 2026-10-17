// Phase 7 — admissions pipeline, announcements & events, hostels, transport,
// and OBE for the engineering programmes.
import { session, pool, loadState, saveState, log, rnd, pick, int, person } from './lib.mjs';
import { ORGS } from './spec.mjs';

const only = process.argv[2];
const steps = (process.argv[3] ?? 'admissions,comms,hostel,transport,obe').split(',');
const SOURCES = ['website', 'walk_in', 'referral', 'social_media', 'newspaper', 'education_fair', 'phone'];
const STAGES = ['new', 'contacted', 'interested', 'followup', 'visit_scheduled', 'visited'];

for (const org of ORGS.filter((o) => !only || o.key === only)) {
  const st = loadState(org.key);
  const owner = await session(org.owner);
  log(`== ${org.key}`);
  const uni = org.type === 'university';

  for (const c of org.campuses) {
    const cs = st.campuses[c.code];
    const B = { branchId: cs.branchId };
    const byRole = (r) => cs.staff.filter((s) => s.role === r);

    // ── Admissions ───────────────────────────────────────────────────────
    if (steps.includes('admissions') && !cs.admissions?.done) {
      cs.admissions ??= { leads: [] };
      const counselors = await Promise.all(byRole('ADMISSION_COUNSELOR').map((s) => session(s.email)));
      const y1 = cs.classes.filter((k) => k.year === 1 || (!uni && k.year <= 3));
      const N = uni ? 140 : 90;
      if (!cs.admissions.leads.length) {
        const existing = [];
        for (let page = 1; page <= 5; page++) {
          const r = await owner.call('GET', `/admissions/leads?limit=100&page=${page}`, undefined, B);
          const rows = r.leads ?? r;
          existing.push(...rows);
          if (rows.length < 100) break;
        }
        for (const l of existing) {
          cs.admissions.leads.push({ id: l._id, stage: l.stage, classId: l.interestedIn?.classId, counselor: null });
        }
      }
      for (let i = cs.admissions.leads.length; i < N; i++) {
        const cons = counselors[i % counselors.length];
        const p = person();
        const k = pick(y1);
        const lead = await cons.call(
          'POST',
          '/admissions/leads',
          {
            firstName: p.firstName,
            lastName: p.lastName,
            gender: p.gender,
            contact: { phone: `${int(6, 9)}${String(int(100000000, 999999999))}`, email: `cvdemo-${org.key}-lead${c.code.toLowerCase()}${i}@yopmail.com` },
            parent: { name: `${person().firstName} ${p.lastName}`, phone: `9${String(int(100000000, 999999999))}` },
            interestedIn: { academicBatchId: cs.batchId, classId: k.classId },
            source: pick(SOURCES),
            notes: pick(['Asked about scholarships', 'Interested in placements record', 'Wants hostel accommodation', 'Sibling already studying here', 'Comparing with two other colleges', 'Needs transport from the city']),
          },
          B
        );
        const stage = i < N * 0.62 ? STAGES[Math.min(STAGES.length - 1, Math.floor(rnd() * STAGES.length))] : 'visited';
        if (stage !== 'new') await cons.call('PUT', `/admissions/leads/${lead._id}/stage`, { stage, notes: 'Spoke to parent' }, B).catch(() => {});
        if (rnd() < 0.7) {
          const due = new Date(Date.UTC(2026, 9, int(8, 22)));
          await cons.call('POST', `/admissions/leads/${lead._id}/followup`, { type: pick(['call', 'call', 'email', 'visit', 'meeting']), notes: pick(['Call back after counselling session', 'Share fee structure PDF', 'Invite for campus tour', 'Discuss scholarship eligibility']), nextFollowupDate: due.toISOString() }, B).catch(() => {});
        }
        cs.admissions.leads.push({ id: lead._id, stage, classId: k.classId, counselor: cons.email });
        if (i % 20 === 0) saveState(org.key, st);
      }
      // Convert the visited leads; move some through to fee paid / enrolled.
      // Leads converted on an earlier run: find their applications instead of converting again.
      const apps = [];
      for (let page = 1; page <= 5; page++) {
        const r = await owner.call('GET', `/admissions/applications?limit=100&page=${page}`, undefined, B);
        const rows = r.applications ?? r;
        apps.push(...rows);
        if (rows.length < 100) break;
      }
      for (const l of cs.admissions.leads) {
        const a = apps.find((x) => String(x.leadId) === String(l.id));
        if (a) {
          l.applicationId = a._id;
          l.stage = 'visited';
        }
      }
      const visited = cs.admissions.leads.filter((l) => l.stage === 'visited' && (!l.applicationId || !l.moved));
      for (const [j, l] of visited.entries()) {
        if (!l.applicationId) {
        const app = await owner.call('GET', `/admissions/leads/${l.id}`, undefined, B).then((lead) => owner.call('POST', `/admissions/leads/${l.id}/convert`, {
          academicBatchId: cs.batchId,
          classId: l.classId ?? lead.interestedIn?.classId,
          // Leads don't capture a date of birth; the application form does.
          student: { firstName: lead.firstName, lastName: lead.lastName || 'Kumar', gender: lead.gender || 'male', dateOfBirth: uni ? `200${int(7, 8)}-0${int(1, 9)}-1${int(0, 9)}` : `201${int(6, 9)}-0${int(1, 9)}-1${int(0, 9)}` },
        }, B)).catch((e) => (log('   convert:', e.message.slice(0, 160)), null));
        if (!app) continue;
        l.applicationId = app._id ?? app.application?._id;
        }
        l.moved = true;
        const target = j % 5; // 0,1 applied · 2 docs · 3 fee paid · 4 enrolled
        if (target >= 2) await owner.call('PUT', `/admissions/pipeline/${l.applicationId}/move`, { type: 'application', toStage: 'docs_verified', notes: 'Documents verified at the counter' }, B).catch((e) => log('   move docs:', e.message.slice(0, 120)));
        if (target >= 3) await owner.call('PUT', `/admissions/pipeline/${l.applicationId}/move`, { type: 'application', toStage: 'fee_paid', notes: 'Admission fee received' }, B).catch((e) => log('   move fee:', e.message.slice(0, 120)));
        if (target >= 4) {
          await owner.call('PUT', `/admissions/applications/${l.applicationId}/status`, { status: 'approved', remarks: 'Documents and fee verified' }, B).catch(() => {});
          const k = cs.classes.find((x) => x.classId === l.classId);
          await owner.call('POST', `/admissions/applications/${l.applicationId}/enroll`, { sectionId: k?.sections[0] }, B).catch((e) => log('   enroll:', e.message.slice(0, 160)));
          l.enrolled = true;
        }
      }
      cs.admissions.done = true;
      saveState(org.key, st);
      log(`  ${c.code}: ${cs.admissions.leads.length} leads, ${cs.admissions.leads.filter((l) => l.applicationId).length} applications, ${cs.admissions.leads.filter((l) => l.enrolled).length} enrolled`);
    }

    // ── Announcements & events ───────────────────────────────────────────
    if (steps.includes('comms') && !cs.comms) {
      const posts = [
        { title: uni ? 'Mid-Semester results published' : 'Half-Yearly results published', content: 'Results are now available in the student portal. Parents can view report cards from the dashboard. Re-evaluation requests close on 25 October.', type: 'general', audience: { type: 'all' }, isPinned: true, priority: 'high' },
        { title: 'Dussehra holidays — 20 & 21 October', content: 'The campus will remain closed on 20 and 21 October for Dussehra. Classes resume on 22 October as per the regular timetable.', type: 'holiday', audience: { type: 'all' } },
        { title: 'Fee reminder: Term 2 instalment', content: 'Term 2 fees are due as per the schedule. Pay online via UPI, card or net banking, or at the accounts counter between 9:30 AM and 3:30 PM.', type: 'urgent', audience: { type: 'students' }, priority: 'high' },
        { title: uni ? 'Placement drive — TCS, Infosys & Bosch this month' : 'Annual Sports Day — registrations open', content: uni ? 'Final-year students must register on the placement portal by 18 October. Pre-placement talks are on 24 October in the auditorium.' : 'House-wise registrations for track events, kabaddi and chess are open till 20 October. Parents are welcome on Sports Day.', type: 'event', audience: { type: 'students' } },
        { title: 'Faculty meeting — curriculum review', content: 'All faculty to attend the curriculum review meeting on Friday at 3:30 PM in the seminar hall. HODs to bring the CO attainment summaries.', type: 'general', audience: { type: 'staff' } },
        { title: 'Library timings extended for exams', content: 'The central library will stay open until 9 PM on weekdays from 15 November to the end of the examinations.', type: 'general', audience: { type: 'all' } },
      ];
      for (const p of posts) await owner.call('POST', '/communications/announcements', { ...p, audience: { ...p.audience, branchIds: [cs.branchId] } }, B);
      const events = [
        { title: uni ? 'Tech Fest — Innovate 2026' : 'Science Exhibition', type: 'cultural', startDate: '2026-10-29', endDate: '2026-10-30', startTime: '09:30', endTime: '17:00', description: 'Project expo, hackathon and invited talks.' },
        { title: 'Parent–Teacher Meeting', type: 'ptm', startDate: '2026-10-24', endDate: '2026-10-24', startTime: '10:00', endTime: '13:00', description: 'Discuss mid-term performance with class teachers.' },
        { title: uni ? 'End Semester Examinations' : 'Unit Test 3', type: 'exam', startDate: uni ? '2026-12-01' : '2026-11-16', endDate: uni ? '2026-12-12' : '2026-11-21', isAllDay: true, description: 'Detailed timetable on the exams page.' },
        { title: 'Annual Sports Meet', type: 'sports', startDate: '2026-11-14', endDate: '2026-11-15', startTime: '08:00', endTime: '16:00', description: 'Inter-department athletics and team events.' },
        { title: 'Guest Lecture: AI in Industry', type: 'academic', startDate: '2026-10-17', endDate: '2026-10-17', startTime: '11:00', endTime: '12:30', description: 'Talk by an industry practitioner, open to all.' },
        { title: 'Diwali Break', type: 'holiday', startDate: '2026-11-08', endDate: '2026-11-11', isAllDay: true, description: 'Campus closed.' },
      ];
      for (const e of events) {
        await owner.call('POST', '/communications/events', { ...e, isAllDay: e.isAllDay ?? false, location: { type: 'venue', venue: e.type === 'sports' ? 'Main Grounds' : 'Auditorium' }, audience: { type: 'all', branchIds: [cs.branchId] } }, B).catch((err) => log('   event:', err.message.slice(0, 160)));
      }
      cs.comms = true;
      saveState(org.key, st);
      log(`  ${c.code}: announcements + events`);
    }

    // ── Hostel ───────────────────────────────────────────────────────────
    if (steps.includes('hostel') && !cs.hostel?.done) {
      cs.hostel ??= {};
      const warden = byRole('HOSTEL_WARDEN')[0];
      const blocks = uni ? [['Krishna Boys Hostel', 'KBH', 'boys'], ['Kaveri Girls Hostel', 'KGH', 'girls']] : [['Residential Block', 'RES', 'co-ed']];
      for (const [name, code, type] of blocks) {
        if (cs.hostel[code]) continue;
        const existingH = await owner.call('GET', '/hostel/hostels?limit=50', undefined, B);
        const found = (existingH.hostels ?? existingH).find((x) => x.code === code);
        const h = found ?? await owner.call('POST', '/hostel/hostels', { name, code, type, totalFloors: 3, floors: ['Ground', 'First', 'Second'], wardenId: warden?.id, wardenName: warden?.name, amenities: ['Wi-Fi', 'Mess', 'Laundry', 'Reading Room', 'Gym'] }, B);
        const rooms = [];
        const existingR = await owner.call('GET', `/hostel/rooms?hostelId=${h._id}&limit=100`, undefined, B);
        const haveRooms = new Map((existingR.rooms ?? existingR).map((r) => [r.roomNumber, r]));
        for (let f = 0; f < 3; f++) {
          for (let r = 1; r <= 10; r++) {
            const num = `${f + 1}${String(r).padStart(2, '0')}`;
            if (haveRooms.has(num)) {
              rooms.push({ id: haveRooms.get(num)._id, capacity: haveRooms.get(num).capacity, used: haveRooms.get(num).occupiedBeds ?? 0 });
              continue;
            }
            const room = await owner.call('POST', '/hostel/rooms', { hostelId: h._id, roomNumber: `${f + 1}${String(r).padStart(2, '0')}`, floor: ['Ground', 'First', 'Second'][f], capacity: r % 4 === 0 ? 2 : 3, type: r % 4 === 0 ? 'double' : 'triple' }, B);
            rooms.push({ id: room._id, capacity: r % 4 === 0 ? 2 : 3, used: 0 });
          }
        }
        cs.hostel[code] = { id: h._id, type, rooms };
        saveState(org.key, st);
      }
      // ~15% of (older) students get a bed, by gender
      const sample = (cs.students ?? []).filter((s, i) => i % 7 === 0);
      let allocated = 0;
      for (const s of sample) {
        const female = /a$|i$|ee$/.test(s.name.split(' ')[0]);
        const block = Object.values(cs.hostel).find((b) => b.type === 'co-ed' || b.type === (female ? 'girls' : 'boys'));
        const room = block?.rooms.find((r) => r.used < r.capacity);
        if (!room) continue;
        await owner.call('POST', '/hostel/allocations', { hostelId: block.id, roomId: room.id, studentId: s.id, bedNumber: "ABCD"[room.used], allocationDate: '2026-07-20', expectedVacatingDate: '2027-05-31' }, B).then(() => {
          room.used++;
          allocated++;
        }).catch((e) => allocated === 0 && log('   allocation:', e.message.slice(0, 160)));
      }
      cs.hostel.done = allocated > 0;
      saveState(org.key, st);
      log(`  ${c.code}: hostel allocations ${allocated}`);
    }

    // ── Transport ────────────────────────────────────────────────────────
    if (steps.includes('transport') && !cs.transport?.done) {
      cs.transport ??= { buses: [] };
      const routes = ['North', 'South', 'East', 'West', 'Central'];
      for (const [i, r] of routes.entries()) {
        if (cs.transport.buses[i]) continue;
        const bus = await owner.call(
          'POST',
          '/transport/buses',
          {
            name: `${r} Route`,
            busNumber: `${c.code.slice(1)}-${String(i + 1).padStart(2, '0')}`,
            vehicleRegistration: `KA-0${int(1, 9)}-${pick(['AB', 'CD', 'EF', 'MN'])}-${int(1000, 9999)}`,
            capacity: 50,
            driverName: `${person().firstName} ${person().lastName}`,
            driverPhone: `9${String(int(100000000, 999999999))}`,
            conductorName: `${person().firstName} ${person().lastName}`,
            startLocation: { name: `${c.name}`, location: { lat: 12.9 + rnd() * 0.1, lng: 77.5 + rnd() * 0.1 } },
            stops: Array.from({ length: 6 }, (_, s) => ({ name: `${r} Stop ${s + 1}`, sequence: s, location: { lat: 12.9 + rnd() * 0.2, lng: 77.5 + rnd() * 0.2 }, pickupTime: `07:${String(10 + s * 7).padStart(2, '0')}`, dropTime: `16:${String(10 + s * 7).padStart(2, '0')}` })),
            pricing: { mode: 'flat', flatPrice: uni ? 2200 : 1800, currency: 'INR', frequency: 'monthly' },
          },
          B
        );
        cs.transport.buses[i] = { id: bus._id, stops: (bus.stops ?? []).map((x) => x._id) };
        saveState(org.key, st);
      }
      let enrolled = 0;
      for (const [i, s] of (cs.students ?? []).filter((_, i) => i % 4 === 1).entries()) {
        const b = cs.transport.buses[i % cs.transport.buses.length];
        if (!b.stops.length) break;
        await owner.call('POST', '/transport/enrollments', { busId: b.id, stopId: b.stops[i % b.stops.length], studentId: s.id }, B).then(() => enrolled++).catch(() => {});
      }
      cs.transport.done = true;
      saveState(org.key, st);
      log(`  ${c.code}: transport ${cs.transport.buses.length} buses, ${enrolled} riders`);
    }

    // ── OBE (engineering B.Tech programmes) ─────────────────────────────
    if (steps.includes('obe') && uni && !cs.obe?.done) {
      cs.obe ??= {};
      const batch = await owner.call('GET', `/organization/academic-batches/${cs.batchId}`, undefined, B);
      const term = (batch.terms ?? []).find((t) => t.half === 'odd');
      const btech = [...new Set(cs.classes.filter((k) => /^BT/.test(k.programCode)).map((k) => k.programCode))];
      for (const code of btech) {
        const k0 = cs.classes.find((k) => k.programCode === code);
        if (!cs.obe[code]) {
          const prog = await owner.call('POST', '/obe/programs', { departmentCode: k0.departmentCode, curriculumProgramId: k0.programId, name: `${code.slice(2)} — NBA Tier II`, preset: 'nba_ug_engineering' }, B);
          cs.obe[code] = { id: prog._id, pos: (prog.pos ?? []).map((p) => p._id), offerings: [] };
          saveState(org.key, st);
        }
        const P = cs.obe[code];
        // Year 2 & 3 subjects get COs, a CO–PO matrix, an offering, two internal tests, marks, attainment.
        for (const k of cs.classes.filter((x) => x.programCode === code && (x.year === 2 || x.year === 3))) {
          for (const subjectId of k.subjectIds.slice(0, 3)) {
            if (P.offerings.some((o) => o.subjectId === subjectId && o.classId === k.classId)) continue;
            const cos = Array.from({ length: 4 }, (_, i) => ({ code: `CO${i + 1}`, statement: ['Explain the fundamental concepts and terminology', 'Apply techniques to solve standard problems', 'Analyse a given system and identify trade-offs', 'Design and evaluate a solution for a real-world scenario'][i], bloomLevel: [2, 3, 4, 6][i], order: i }));
            const poMapping = [];
            cos.forEach((_, ci) => P.pos.slice(0, 12).forEach((poId, pi) => {
              if ((ci + pi) % 3 !== 2) poMapping.push({ coIndex: ci, poId, strength: ((ci + pi) % 3) + 1 });
            }));
            const outcomes = await owner.call('PUT', '/obe/outcomes', { subjectId, programId: P.id, cos, poMapping, psoMapping: [] }, B).catch((e) => (log('   COs:', e.message.slice(0, 160)), null));
            if (!outcomes) continue;
            const coIds = (outcomes.cos ?? []).map((x) => x._id);
            const off = await owner.call('POST', '/obe/offerings', { programId: P.id, subjectId, academicBatchId: cs.batchId, termId: term._id, sectionIds: k.sections, targetLevel: 2 }, B).catch((e) => (log('   offering:', e.message.slice(0, 160)), null));
            if (!off) continue;
            const students = (cs.students ?? []).filter((s) => k.sections.includes(s.sectionId));
            for (const [ti, name] of ['Internal Assessment 1', 'Internal Assessment 2'].entries()) {
              const inst = await owner.call('POST', `/obe/offerings/${off._id}/instruments`, { name, kind: 'internal', order: ti, sets: [{ label: 'Set A', items: coIds.map((co, i) => ({ label: `Q${i + 1}`, coIds: [co], maxMarks: 10 })) }] }, B).catch((e) => (log('   instrument:', e.message.slice(0, 160)), null));
              if (!inst) continue;
              const set = (inst.sets ?? inst.instruments?.slice(-1)[0]?.sets ?? [])[0];
              const items = set?.items ?? [];
              const instId = inst._id ?? inst.instruments?.slice(-1)[0]?._id;
              if (!items.length || !students.length) continue;
              for (let i = 0; i < students.length; i += 200) {
                await owner.call('PUT', `/obe/offerings/${off._id}/instruments/${instId}/marks`, {
                  rows: students.slice(i, i + 200).map((s) => ({ studentId: s.id, setId: set._id, absent: false, marks: items.map((it) => ({ itemId: it._id, marksObtained: Math.min(10, Math.max(0, Math.round(4 + rnd() * 6.5))) })) })),
                }, B).catch((e) => log('   marks:', e.message.slice(0, 160)));
              }
            }
            await owner.call('POST', `/obe/offerings/${off._id}/compute`, {}, B).catch((e) => log('   compute:', e.message.slice(0, 160)));
            P.offerings.push({ id: off._id, subjectId, classId: k.classId });
            saveState(org.key, st);
          }
        }
      }
      cs.obe.done = true;
      saveState(org.key, st);
      log(`  ${c.code}: OBE ${Object.keys(cs.obe).filter((x) => x !== 'done').length} programmes, ${Object.values(cs.obe).reduce((n, p) => n + (p.offerings?.length ?? 0), 0)} offerings`);
    }
  }
}
log('phase 7 done');

// Phase 13 — fill every section the empty-page audit found bare.
import { session, pool, loadState, saveState, log, rnd, pick, int, person } from './lib.mjs';
import { ORGS } from './spec.mjs';

const only = process.argv[2];
const steps = (process.argv[3] ?? 'announce,health,visits,hostelRules,feedTags,jobs,profiles,alumni,scholarships,concessions,policies,infra,jobsched,corrective,bulk').split(',');
const sessions = new Map();
const sess = async (email) => {
  if (!sessions.has(email)) sessions.set(email, await session(email));
  return sessions.get(email);
};
const soft = (label) => (e) => log(`   ${label}:`, e.message.slice(0, 170));
const once = (cs, key) => {
  cs.gaps ??= {};
  if (cs.gaps[key]) return false;
  return true;
};
const done = (org, st, cs, key, v = true) => {
  cs.gaps[key] = v;
  saveState(org.key, st);
};

for (const org of ORGS.filter((o) => !only || o.key === only)) {
  const st = loadState(org.key);
  const owner = await session(org.owner);
  log(`== ${org.key}`);
  const uni = org.type === 'university';

  for (const c of org.campuses) {
    const cs = st.campuses[c.code];
    const B = { branchId: cs.branchId };
    const role = (r) => cs.staff.filter((s) => s.role === r);
    const students = cs.students ?? [];
    const report = [];

    if (steps.includes('announce') && once(cs, 'announce')) {
      const list = await owner.call('GET', '/communications/announcements?limit=50', undefined, B);
      let n = 0;
      for (const a of list.announcements ?? list) {
        if (a.status === 'published') continue;
        await owner.call('PUT', `/communications/announcements/${a._id}/publish`, {}, B).then(() => n++).catch(soft('publish'));
      }
      report.push(`${n} announcements published`);
      done(org, st, cs, 'announce', n);
    }

    if (steps.includes('health') && once(cs, 'health')) {
      const recFor = async (type, id) => {
        const r = await owner.call('GET', `/health/records/person/${type}/${id}`, undefined, B).catch(() => null);
        return r?._id ?? r?.record?._id;
      };
      const campaign = await owner.call('POST', '/health/checkups/campaigns', { name: 'Annual Health Check-up 2026', description: 'Vision, dental, hearing and growth screening for all students.', targetType: 'all_students', personType: 'student', scheduledDate: '2026-09-15', scheduledEndDate: '2026-09-30', venue: 'Medical Room', checkupType: 'annual' }, B).catch(soft('campaign'));
      if (campaign) await owner.call('POST', `/health/checkups/campaigns/${campaign._id}/start`, {}, B).catch(() => {});
      const sample = students.filter((_, i) => i % 9 === 0).slice(0, 40);
      let checkups = 0, vacc = 0, visits = 0;
      await pool(sample, 3, async (s, i) => {
        const rid = await recFor('student', s.id);
        if (!rid) return;
        await owner.call('POST', '/health/checkups', { healthRecordId: rid, personType: 'student', personId: s.id, campaignId: campaign?._id, checkupDate: `2026-09-${String(int(15, 29)).padStart(2, '0')}`, checkupType: 'annual', vitals: { heightCm: int(120, 180), weightKg: int(25, 75), temperatureC: 36.6, pulseRate: int(68, 92), bloodPressureSystolic: int(100, 124), bloodPressureDiastolic: int(64, 82) }, findings: [pick(['Healthy', 'Mild myopia — glasses advised', 'Dental cavity — refer to dentist', 'Healthy'])], recommendations: [pick(['Annual review', 'Eye test in 6 months', 'Increase water intake'])] }, B).then(() => checkups++).catch((e) => checkups === 0 && soft('checkup')(e));
        await owner.call('POST', '/health/vaccinations', { healthRecordId: rid, personType: 'student', personId: s.id, vaccineName: pick(['Tetanus (Td)', 'Hepatitis B', 'HPV', 'Typhoid']), doseNumber: 1, totalDoses: 2, administeredDate: '2026-08-12', administeredBy: 'Campus Medical Officer', status: i % 4 === 0 ? 'scheduled' : 'completed', scheduledDate: '2026-10-28' }, B).then(() => vacc++).catch((e) => vacc === 0 && soft('vaccination')(e));
        if (false && i % 3 === 0) {
          const d = `2026-10-${String(int(1, 13)).padStart(2, '0')}`;
          await owner.call('POST', '/health/visits', { healthRecordId: rid, personType: 'student', personId: s.id, visitType: pick(['illness', 'injury', 'routine']), visitDate: d, arrivalTime: `${d}T10:${String(int(10, 50))}:00.000Z`, chiefComplaint: pick(['Headache', 'Fever', 'Sprained ankle during sports', 'Stomach ache', 'Minor cut on hand']), symptoms: ['Discomfort'], painLevel: int(2, 6) }, B).then(() => visits++).catch((e) => visits === 0 && soft('visit')(e));
        }
      });
      report.push(`health: ${checkups} checkups, ${vacc} vaccinations, ${visits} visits`);
      done(org, st, cs, 'health', checkups);
    }

    if (steps.includes('visits') && once(cs, 'visits')) {
      const nurse = role('HOSTEL_WARDEN')[0] ?? role('BRANCH_ADMIN')[0];
      let visits = 0;
      for (const [i, s] of students.filter((_, i) => i % 27 === 0).slice(0, 14).entries()) {
        const r = await owner.call('GET', `/health/records/person/student/${s.id}`, undefined, B).catch(() => null);
        const rid = r?._id ?? r?.record?._id;
        if (!rid) continue;
        const d = `2026-10-${String(int(1, 13)).padStart(2, '0')}`;
        await owner.call('POST', '/health/visits', { healthRecordId: rid, personType: 'student', personId: s.id, visitType: pick(['illness', 'injury', 'routine']), visitDate: d, arrivalTime: `${d}T10:${String(10 + i * 3).padStart(2, '0')}:00.000Z`, chiefComplaint: pick(['Headache', 'Fever', 'Sprained ankle during sports', 'Stomach ache', 'Minor cut on hand']), symptoms: ['Discomfort'], painLevel: int(2, 6), attendedBy: nurse.id }, B).then(() => visits++).catch((e) => visits === 0 && soft('visit')(e));
      }
      report.push(`${visits} sick-room visits`);
      done(org, st, cs, 'visits', visits);
    }

    if (steps.includes('hostelRules') && once(cs, 'hostelRules')) {
      await owner.call('PUT', '/hostel/settings', { hostelRules: ['Gates close at 9:30 PM; late entry needs the warden’s permission.', 'Visitors allowed only in the common room, 4–7 PM.', 'Silence hours from 10 PM to 6 AM.', 'Cooking appliances are not allowed in rooms.', 'Report maintenance issues to the warden’s office.', 'Mess timings: breakfast 7–9, lunch 12:30–2, dinner 7:30–9:30.'] }, B).catch(soft('rules'));
      done(org, st, cs, 'hostelRules');
    }

    if (steps.includes('feedTags') && once(cs, 'feedTags')) {
      const authors = [...role('TEACHER').slice(0, 5), ...students.filter((s) => s.demoPassword).slice(0, 5)];
      const posts = ['Hackathon weekend was incredible! #Hackathon2026 #CodeCampus', 'Our team won the inter-college quiz 🎉 #QuizChampions #ProudMoment', 'Library reading challenge starts Monday #ReadMore #LibraryLove', 'Sports day practice in full swing #SportsDay #TeamSpirit', 'Guest lecture on AI was eye-opening #AI #Learning', 'Plant a tree drive this Saturday #GoGreen #NSS', 'Results are out — congratulations everyone! #Results #HardWorkPaysOff', 'Cultural fest rehearsals tonight #Utsav2026 #Dance'];
      let n = 0;
      for (const [i, a] of authors.entries()) {
        const me = await sess(a.email);
        await me.call('POST', '/feed/posts', { postType: 'post', content: posts[i % posts.length], audience: 'everyone' }, B).then(() => n++).catch((e) => n === 0 && soft('feed')(e));
      }
      report.push(`${n} hashtag posts`);
      done(org, st, cs, 'feedTags', n);
    }

    if (uni && steps.includes('jobs') && once(cs, 'jobs')) {
      const po = await sess(role('PLACEMENT_OFFICER')[0].email);
      const cos = await po.call('GET', '/career-connect/companies?limit=20', undefined, B).catch(() => []);
      const companies = cos.companies ?? cos;
      let n = 0;
      for (const [i, [title, type]] of [['Software Engineer — Graduate', 'job'], ['Data Analyst', 'job'], ['Summer Intern — Product', 'internship'], ['Graduate Engineer Trainee', 'job'], ['Marketing Intern', 'internship'], ['Associate Consultant', 'job']].entries()) {
        const co = companies[i % Math.max(1, companies.length)];
        await po.call('POST', '/career-connect/jobs', { title, companyId: co?._id, companyName: co?.name ?? 'Partner company', type, description: `${title} role for final-year students. Training provided.`, requirements: ['Good communication', 'Problem solving', 'CGPA 6.5+'], location: pick(['Bengaluru', 'Pune', 'Hyderabad', 'Remote']), workMode: pick(['onsite', 'hybrid', 'remote']), applicationDeadline: `2026-11-${String(int(5, 28)).padStart(2, '0')}` }, B).then(() => n++).catch((e) => n === 0 && soft('job')(e));
      }
      report.push(`${n} job postings`);
      done(org, st, cs, 'jobs', n);
    }

    if (uni && steps.includes('profiles') && once(cs, 'profiles')) {
      const po = await sess(role('PLACEMENT_OFFICER')[0].email);
      let n = 0;
      for (const s of students.filter((x) => /Y[34]$/.test(x.classKey)).slice(0, 25)) {
        await po.call('GET', `/career-connect/student-profiles/${s.id}?studentName=${encodeURIComponent(s.name)}`, undefined, B).catch(() => {});
        await po.call('PUT', `/career-connect/student-profiles/${s.id}`, { skills: [{ name: pick(['Python', 'Java', 'SQL', 'Excel', 'AutoCAD', 'React']), proficiency: pick(['intermediate', 'advanced']) }, { name: pick(['Communication', 'Teamwork', 'Leadership']), proficiency: 'intermediate' }], projects: [{ title: pick(['Smart attendance system', 'Inventory dashboard', 'IoT weather station', 'Chatbot for FAQs']), description: 'Final-year project', technologies: ['Python', 'React'] }], placementPreferences: { preferredRoles: ['Software Engineer'], preferredLocations: ['Bengaluru', 'Pune'], expectedCtc: int(5, 9) * 100000 } }, B).then(() => n++).catch((e) => n === 0 && soft('profile')(e));
      }
      report.push(`${n} student career profiles`);
      done(org, st, cs, 'profiles', n);
    }

    if (steps.includes('alumni') && once(cs, 'alumni')) {
      const finalYear = students.filter((x) => (uni ? /Y4$/.test(x.classKey) : x.classKey === 'G10') && x.roll > 30).slice(0, 8);
      let n = 0;
      for (const s of finalYear) {
        await owner.call('PUT', `/students/${s.id}/status`, { status: 'alumni', reason: 'Graduated — batch of 2026' }, B).then(() => {
          n++;
          s.alumni = true;
        }).catch((e) => n === 0 && soft('alumni')(e));
      }
      if (uni) {
        await owner.call('POST', '/career-connect/alumni/events', { title: 'Alumni Homecoming 2026', type: 'reunion', description: 'Meet your batchmates and faculty.', eventDate: '2026-12-19', venue: 'Main Auditorium', maxCapacity: 300 }, B).catch(soft('alumni event'));
      }
      report.push(`${n} alumni`);
      done(org, st, cs, 'alumni', n);
    }

    if (steps.includes('scholarships') && once(cs, 'scholarships')) {
      const acct = await sess(role('ACCOUNTANT')[0].email);
      let n = 0;
      for (const s of students.filter((_, i) => i % 40 === 3).slice(0, 12)) {
        await acct.call('POST', '/finance/scholarships', { studentId: s.id, scheme: pick(['Post-Matric Scholarship (SC/ST)', 'Merit-cum-Means Scholarship', 'Vidyasiri Scholarship', 'Institution Merit Award']), sponsor: pick(['government', 'government', 'institution', 'private']), sanctionedAmount: pick([10000, 15000, 25000, 35000]), applicationRef: `SCH-${int(100000, 999999)}`, remarks: 'Documents verified' }, B).then(() => n++).catch((e) => n === 0 && soft('scholarship')(e));
      }
      report.push(`${n} scholarships`);
      done(org, st, cs, 'scholarships', n);
    }

    if (steps.includes('concessions') && once(cs, 'concessions')) {
      const acct = await sess(role('ACCOUNTANT')[0].email);
      let n = 0;
      for (const s of students.filter((_, i) => i % 45 === 7).slice(0, 10)) {
        const fa = await acct.call('GET', `/finance/assignments/student/${s.id}`, undefined, B).catch(() => []);
        const feeAssignmentId = (fa.assignments ?? fa)[0]?._id;
        if (!feeAssignmentId) continue;
        await acct.call('POST', '/finance/concessions', { studentId: s.id, academicBatchId: cs.batchId, feeAssignmentId, type: pick(['sibling', 'merit', 'need-based', 'staff-ward']), name: pick(['Sibling concession', 'Merit concession', 'Financial hardship', 'Staff ward']), discountType: 'percentage', discountValue: pick([5, 10, 15, 20]), appliedTo: 'tuition', reason: 'Request submitted with supporting documents' }, B).then(() => n++).catch((e) => n === 0 && soft('concession')(e));
      }
      report.push(`${n} concession requests`);
      done(org, st, cs, 'concessions', n);
    }

    if (steps.includes('policies') && once(cs, 'policies')) {
      const d = cs.designations ?? {};
      const pairs = uni ? [['AP', 'ASP', 8], ['ASP', 'PROF', 10], ['PROF', 'HOD', 6]] : [['TCH', 'STCH', 8]];
      let n = 0;
      for (const [from, to, pct] of pairs) {
        if (!d[from] || !d[to]) continue;
        await owner.call('POST', '/hr/promotion-policies', { fromDesignationId: d[from], toDesignationId: d[to], increment: { type: 'percentage', value: pct, base: 'basic' }, requiresApproval: true }, B).then(() => n++).catch(soft('policy'));
      }
      report.push(`${n} promotion policies`);
      done(org, st, cs, 'policies', n);
    }

    if (steps.includes('infra') && once(cs, 'infra')) {
      let rooms = 0;
      for (const [name, code, floors] of uni ? [['Academic Block A', 'ABA', 4], ['Academic Block B', 'ABB', 3], ['Administration Block', 'ADM', 2]] : [['Main Building', 'MAIN', 3], ['Junior Wing', 'JUN', 2]]) {
        const b = await owner.call('POST', '/organization/infrastructure/buildings', { name, code: `${code}${c.code.slice(1)}`, floors: Array.from({ length: floors }, (_, f) => ({ name: f === 0 ? 'Ground Floor' : `Floor ${f}`, number: f })), description: `${name}, ${c.name}` }, B).catch(soft('building'));
        if (!b) continue;
        for (const fl of b.floors ?? []) {
          for (let r = 1; r <= 4; r++) {
            await owner.call('POST', '/organization/infrastructure/rooms', { buildingId: b._id, floorId: fl._id, roomNumber: `${code}-${fl.number}${String(r).padStart(2, '0')}`, type: code === 'ADM' ? 'office' : r === 4 ? 'lab' : 'classroom', capacity: r === 4 ? 30 : 60, amenities: ['Projector', 'Whiteboard', 'Fans'] }, B).then(() => rooms++).catch((e) => rooms === 0 && soft('room')(e));
          }
        }
      }
      report.push(`${rooms} rooms in buildings`);
      done(org, st, cs, 'infra', rooms);
    }

    if (steps.includes('jobsched') && once(cs, 'jobsched')) {
      // Created inactive with no recipients — they show on the page but never run or send anything.
      let n = 0;
      for (const [name, code, type, sched] of [['Daily attendance summary', 'DAILY-ATT', 'report', { type: 'daily', time: '18:00' }], ['Weekly fee collection report', 'WEEKLY-FEE', 'report', { type: 'weekly', dayOfWeek: 1, time: '09:00' }], ['Monthly payroll reminder', 'MONTHLY-PAY', 'reminder', { type: 'monthly', dayOfMonth: 25, time: '10:00' }], ['Nightly data sync', 'NIGHT-SYNC', 'sync', { type: 'daily', time: '02:00' }]]) {
        const j = await owner.call('POST', '/organization/scheduled-jobs', { name, code: `${code}-${c.code}`, description: name, type, schedule: { ...sched, timezone: 'Asia/Kolkata' }, config: { module: type === 'sync' ? 'organization' : type === 'reminder' ? 'hr' : 'finance', action: code.toLowerCase(), recipients: [] }, isActive: false }, B).catch(soft('scheduled job'));
        if (j) {
          n++;
          if (j.isActive) await owner.call('PUT', `/organization/scheduled-jobs/${j._id}`, { isActive: false }, B).catch(() => {});
        }
      }
      report.push(`${n} scheduled jobs (inactive)`);
      done(org, st, cs, 'jobsched', n);
    }

    if (uni && steps.includes('corrective') && once(cs, 'corrective')) {
      let n = 0;
      for (const P of Object.values(cs.obe ?? {})) {
        for (const off of (P.offerings ?? []).slice(0, 4)) {
          const a = await owner.call('GET', `/obe/offerings/${off.id}/attainment`, undefined, B).catch(() => null);
          const cos = (a?.cos ?? a?.coAttainment ?? []).map((x) => x.coId ?? x._id).filter(Boolean).slice(0, 2);
          if (!cos.length) continue;
          await owner.call('PUT', `/obe/offerings/${off.id}/corrective-actions`, { actions: cos.map((coId) => ({ coId, text: 'Extra tutorial sessions and a remedial assignment for students below the threshold; revisit in the next internal.' })) }, B).then(() => n++).catch((e) => n === 0 && soft('corrective')(e));
        }
      }
      report.push(`${n} offerings with corrective actions`);
      done(org, st, cs, 'corrective', n);
    }

    if (steps.includes('bulk') && once(cs, 'bulk')) {
      const k = cs.classes.find((x) => x.year === 1) ?? cs.classes[0];
      const cls = await owner.call('GET', `/organization/classes/${k.classId}`, undefined, B);
      const sec = await owner.call('GET', `/organization/sections/${k.sections[0]}`, undefined, B);
      const rows = Array.from({ length: 12 }, (_, i) => {
        const p = person();
        return { firstName: p.firstName, lastName: p.lastName, gender: p.gender, dateOfBirth: uni ? '2008-03-14' : '2020-06-09', email: `cvdemo-${org.key}-${c.code.toLowerCase()}-bu${String(i + 1).padStart(2, '0')}@yopmail.com`, phone: p.phone, fatherPhone: `9${String(int(100000000, 999999999))}`, className: cls.displayName, sectionName: sec.name, rollNumber: String(60 + i), admissionDate: '2026-10-05', category: 'general' };
      });
      await owner.call('POST', '/students/bulk-upload/validate', { academicBatchId: cs.batchId, data: rows }, B).catch(soft('bulk validate'));
      const up = await owner.call('POST', '/students/bulk-upload', { academicBatchId: cs.batchId, data: rows }, B).catch(soft('bulk upload'));
      report.push(`bulk upload: ${up ? (up.successCount ?? up.created ?? rows.length) : 0} students`);
      done(org, st, cs, 'bulk', !!up);
    }

    log(`  ${c.code}: ${report.join(' · ')}`);
  }
}
log('phase 13 done');

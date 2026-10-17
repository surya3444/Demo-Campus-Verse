// Phase 8 — teachers' own work (assignments with grades, lesson plans) at
// their own logins, plus campus feed, student feedback tickets, certificate
// requests and placement companies/drives.
import { session, pool, loadState, saveState, log, rnd, pick, int } from './lib.mjs';
import { ORGS } from './spec.mjs';

const only = process.argv[2];
const steps = (process.argv[3] ?? 'teaching,feed,feedback,certificates,placements').split(',');
const sessions = new Map();
const sess = async (email) => {
  if (!sessions.has(email)) sessions.set(email, await session(email));
  return sessions.get(email);
};
const ago = (days) => new Date(Date.UTC(2026, 9, 14) - days * 86_400_000).toISOString().slice(0, 10);

for (const org of ORGS.filter((o) => !only || o.key === only)) {
  const st = loadState(org.key);
  const owner = await session(org.owner);
  log(`== ${org.key}`);
  const uni = org.type === 'university';

  for (const c of org.campuses) {
    const cs = st.campuses[c.code];
    const B = { branchId: cs.branchId };
    const staffById = new Map(cs.staff.map((s) => [s.id, s]));
    const studentsBySection = new Map();
    for (const s of cs.students ?? []) {
      if (!studentsBySection.has(s.sectionId)) studentsBySection.set(s.sectionId, []);
      studentsBySection.get(s.sectionId).push(s);
    }

    if (steps.includes('teaching')) {
      cs.teaching ??= {};
      const jobs = [];
      for (const k of cs.classes) {
        for (const sec of k.sections) {
          if (cs.teaching[sec]) continue;
          jobs.push({ k, sec });
        }
      }
      await pool(jobs, 4, async ({ k, sec }) => {
        const subs = await owner.call('GET', `/organization/sections/${sec}/subjects`, undefined, B);
        const rows = (subs.subjects ?? subs).filter((x) => x.teacherId || x.teacher?._id).slice(0, 3);
        const students = studentsBySection.get(sec) ?? [];
        let made = 0;
        for (const r of rows) {
          const teacherId = r.teacherId ?? r.teacher?._id;
          const subjectId = r.subjectId ?? r.subject?._id ?? r._id;
          const subjectName = r.subjectName ?? r.subject?.name ?? r.name ?? 'the subject';
          const t = staffById.get(teacherId);
          if (!t || t.role === 'STAFF (no login)') continue;
          const me = await sess(t.email);
          // Past assignment — published, graded
          const past = await me.call('POST', '/teaching/assignments', { sectionId: sec, subjectId, title: `${subjectName}: Problem Set ${int(1, 3)}`, description: `Solve the exercises from the chapter discussed in class. Show all steps.`, type: 'homework', totalMarks: 20, assignedDate: ago(int(18, 25)), dueDate: ago(int(8, 12)), status: 'published' }, B);
          if (students.length) {
            await me.call('POST', '/teaching/grades/bulk', { assignmentId: past._id, grades: students.filter(() => rnd() < 0.92).map((s) => ({ studentId: s.id, marksObtained: int(9, 20), remarks: pick(['Good work', 'Neat presentation', 'Revise the derivation', 'Well done', 'Show more steps']) })) }, B).catch((e) => log('   grades:', e.message.slice(0, 140)));
            await me.call('PUT', `/teaching/assignments/${past._id}/complete`, {}, B).catch(() => {});
          }
          // Open assignment — due this week
          await me.call('POST', '/teaching/assignments', { sectionId: sec, subjectId, title: `${subjectName}: ${pick(['Mini project proposal', 'Case study write-up', 'Chapter review questions', 'Lab record submission'])}`, description: 'Submit before the due date. Late submissions lose 10%.', type: pick(['homework', 'project', 'classwork']), totalMarks: pick([10, 20, 25]), assignedDate: ago(int(1, 4)), dueDate: ago(-int(2, 9)), status: 'published' }, B);
          // Lesson plans — one delivered last week, one coming up
          const delivered = await me.call('POST', '/teaching/lesson-plans', { sectionId: sec, subjectId, title: `${subjectName} — Unit ${int(2, 3)} introduction`, date: ago(int(3, 7)), objectives: ['Understand the core definitions', 'Work through two solved examples'], topics: ['Definitions', 'Worked examples', 'Q&A'], methodology: 'Lecture with board work and discussion', duration: 50, status: 'published' }, B);
          await me.call('PUT', `/teaching/lesson-plans/${delivered._id}/teaching-status`, { teachingStatus: 'delivered' }, B).catch(() => {});
          await me.call('POST', '/teaching/lesson-plans', { sectionId: sec, subjectId, title: `${subjectName} — Unit ${int(3, 4)} problem solving`, date: ago(-int(1, 6)), objectives: ['Apply the methods to new problems'], topics: ['Practice problems', 'Common mistakes'], methodology: 'Guided practice in groups', duration: 50, status: 'published' }, B);
          made++;
        }
        cs.teaching[sec] = made;
        if (Object.keys(cs.teaching).length % 10 === 0) saveState(org.key, st);
      });
      saveState(org.key, st);
      log(`  ${c.code}: teaching content for ${Object.keys(cs.teaching).length} sections`);
    }

    if (steps.includes('feed') && !cs.feed) {
      const authors = [cs.staff.find((s) => s.role === 'BRANCH_ADMIN'), ...cs.staff.filter((s) => s.role === 'TEACHER').slice(0, 4)].filter(Boolean);
      const posts = [
        ['notice', 'Congratulations to our debate team for winning the inter-college championship! 🏆'],
        ['post', 'Throwback to last week’s robotics workshop — 120 students built line-following bots in a day.'],
        ['post', 'Reminder: the library has added 400 new titles this month. Drop by and explore.'],
        ['notice', 'NSS blood donation camp on Friday in the main block, 9 AM to 1 PM. Every donor gets a certificate.'],
        ['post', 'Proud of our students who presented papers at the national conference this weekend.'],
      ];
      for (const [i, [postType, content]] of posts.entries()) {
        const a = await sess(authors[i % authors.length].email);
        await a.call('POST', '/feed/posts', { postType, content, audience: 'everyone' }, B).catch((e) => log('   feed:', e.message.slice(0, 140)));
      }
      cs.feed = true;
      saveState(org.key, st);
    }

    if (steps.includes('feedback') && !cs.feedback) {
      const students = (cs.students ?? []).filter((s) => s.demoPassword).slice(0, 8);
      const asks = [
        ['Wi-Fi drops in the library', 'infrastructure', 'medium'],
        ['Projector not working in Room 204', 'infrastructure', 'high'],
        ['Request for more evening lab hours', 'academic', 'low'],
        ['Hostel mess food quality', 'hostel', 'medium'],
        ['Fee receipt not received by email', 'finance', 'high'],
        ['Need clarity on internal assessment marks', 'academic', 'medium'],
      ];
      for (const [i, s] of students.entries()) {
        const me = await sess(s.email);
        const [subject, category, priority] = asks[i % asks.length];
        await me.call('POST', '/feedback', { subject, description: `${subject}. This has been happening for the past week — please look into it.`, category, priority, isAnonymous: i % 4 === 0 }, B).catch((e) => log('   feedback:', e.message.slice(0, 140)));
      }
      cs.feedback = true;
      saveState(org.key, st);
    }

    if (steps.includes('certificates') && !cs.certificates) {
      const types = [];
      const haveTypes = await owner.call('GET', '/certificates/types?limit=50', undefined, B).catch(() => []);
      const haveByCode = new Map((haveTypes.types ?? haveTypes).map?.((t) => [t.code, t._id]) ?? []);
      for (const [name, code] of [['Bonafide Certificate', 'BONA'], ['Transfer Certificate', 'TC'], ['Character Certificate', 'CHAR']]) {
        const existingId = haveByCode.get(`${code}${c.code.slice(1)}`.toUpperCase());
        if (existingId) {
          types.push(existingId);
          continue;
        }
        const t = await owner.call('POST', '/certificates/types', { name, code: `${code}${c.code.slice(1)}`, description: `${name} issued by the institution`, requiresApproval: true, fee: code === 'TC' ? 500 : 100 }, B).catch((e) => (log('   cert type:', e.message.slice(0, 160)), null));
        if (t) types.push(t._id);
      }
      for (const [i, s] of (cs.students ?? []).filter((_, i) => i % 60 === 0).entries()) {
        if (!types.length) break;
        await owner.call('POST', '/certificates/requests', { certificateTypeId: types[i % types.length], requestorId: s.id, requestorType: 'student', studentId: s.id, purpose: pick(['Bank loan application', 'Passport application', 'Scholarship', 'Internship']), copies: 1 }, B).catch((e) => i === 0 && log('   cert request:', e.message.slice(0, 160)));
      }
      cs.certificates = true;
      saveState(org.key, st);
    }

    if (steps.includes('placements') && uni && !cs.placements) {
      const po = cs.staff.find((s) => s.role === 'PLACEMENT_OFFICER');
      const me = po ? await sess(po.email) : owner;
      for (const [name, industry] of [['Tata Consultancy Services', 'IT Services'], ['Infosys', 'IT Services'], ['Bosch India', 'Automotive'], ['HDFC Bank', 'Banking'], ['Zoho', 'Software Products']]) {
        const have = await me.call('GET', '/career-connect/companies?limit=50', undefined, B).catch(() => []);
        const prior = (have.companies ?? have).find?.((x) => x.name === name);
        const co = prior ?? await me.call('POST', '/career-connect/companies', { name, industry, website: `https://www.${name.split(' ')[0].toLowerCase()}.com`, description: `${name} — campus recruitment partner`, hrContacts: [{ name: 'Campus Relations', email: `campus@${name.split(' ')[0].toLowerCase()}.example.com`, phone: `9${String(int(100000000, 999999999))}` }] }, B).catch((e) => (log('   company:', e.message.slice(0, 160)), null));
        if (!co) continue;
        await me.call('POST', '/career-connect/drives', { companyId: co._id, title: `${name} Campus Drive 2027`, type: 'on_campus', academicBatchId: cs.batchId, description: 'On-campus recruitment for final-year students.', registrationDeadline: '2026-10-24', driveDate: '2026-10-28', jobProfile: { role: pick(['Software Engineer', 'Graduate Engineer Trainee', 'Analyst', 'Associate']), description: 'Full-time role after graduation', ctc: int(4, 12) * 100000, location: pick(['Bengaluru', 'Pune', 'Hyderabad', 'Chennai']), jobType: 'job' } }, B).catch((e) => log('   drive:', e.message.slice(0, 160)));
      }
      cs.placements = true;
      saveState(org.key, st);
    }
  }
}
log('phase 8 done');

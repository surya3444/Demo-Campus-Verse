// Phase 15 — sections the second audit still found bare: career profiles and
// alumni (now listed per campus), fee cancellation/refund approvals, today's
// sick-room visits and OBE corrective actions.
import { session, loadState, saveState, log, pick, int } from './lib.mjs';
import { ORGS } from './spec.mjs';

const sessions = new Map();
const sess = async (email) => {
  if (!sessions.has(email)) sessions.set(email, await session(email));
  return sessions.get(email);
};
const soft = (label) => (e) => log(`   ${label}:`, e.message.slice(0, 170));
const TODAY = '2026-10-14';
const COMPANIES = [['Infosys', 'Systems Engineer'], ['TCS', 'Assistant Consultant'], ['Wipro', 'Project Engineer'], ['Deloitte', 'Analyst'], ['Flipkart', 'SDE I'], ['Zoho', 'Member Technical Staff'], ['HDFC Bank', 'Management Trainee'], ['IISc', 'Research Scholar']];

for (const org of ORGS.filter((o) => !process.argv[2] || o.key === process.argv[2])) {
  const st = loadState(org.key);
  const owner = await session(org.owner);
  const uni = org.type === 'university';
  log(`== ${org.key}`);
  for (const c of org.campuses) {
    const cs = st.campuses[c.code];
    const B = { branchId: cs.branchId };
    const role = (r) => cs.staff.filter((s) => s.role === r);
    const students = cs.students ?? [];
    cs.gaps ??= {};
    const out = [];

    // Career profiles for final and pre-final years (opening one creates it on this campus)
    if (uni && !cs.gaps.profiles2) {
      const po = await sess(role('PLACEMENT_OFFICER')[0].email);
      let n = 0;
      for (const s of students.filter((x) => /Y[34]$/.test(x.classKey) && x.roll <= 12).slice(0, 40)) {
        const p = await po.call('GET', `/career-connect/student-profiles/${s.id}?studentName=${encodeURIComponent(s.name)}`, undefined, B).catch(() => null);
        if (!p) continue;
        if (!p.skills?.length) {
          await po.call('PUT', `/career-connect/student-profiles/${s.id}`, { skills: [{ name: pick(['Python', 'Java', 'SQL', 'Excel', 'AutoCAD', 'React']), proficiency: pick(['intermediate', 'advanced']) }, { name: pick(['Communication', 'Teamwork', 'Leadership']), proficiency: 'advanced' }] }, B).catch(() => {});
        }
        n++;
      }
      cs.gaps.profiles2 = n;
      out.push(`${n} career profiles`);
    }

    // Alumni: re-marking graduates creates their directory entries, then fill where they work
    if (!cs.gaps.alumni2) {
      let n = 0;
      for (const s of students.filter((x) => x.alumni)) {
        await owner.call('PUT', `/students/${s.id}/status`, { status: 'alumni', reason: 'Graduated — batch of 2026' }, B).catch(soft('alumni status'));
      }
      const list = await owner.call('GET', '/career-connect/alumni?limit=50', undefined, B).catch(() => []);
      for (const [i, a] of (list.data ?? list).entries()) {
        const [company, roleName] = uni ? COMPANIES[i % COMPANIES.length] : [pick(['Delhi Public School (Class 11)', 'Kendriya Vidyalaya (Class 11)', 'Narayana Junior College']), 'Student'];
        await owner.call('PUT', `/career-connect/alumni/${a._id}`, { currentCompany: company, currentRole: roleName, location: pick(['Bengaluru', 'Pune', 'Hyderabad', 'Mumbai', 'Chennai']), mentorshipInfo: { willingToMentor: uni && i % 2 === 0, expertise: uni ? ['Interview prep', 'Career guidance'] : [] } }, B).then(() => n++).catch((e) => n === 0 && soft('alumni')(e));
        if (i % 3 === 0) await owner.call('PUT', `/career-connect/alumni/${a._id}/verify`, {}, B).catch(() => {});
      }
      cs.gaps.alumni2 = n;
      out.push(`${n} alumni profiles`);
    }

    // Fee cancellation and refund requests (refunds are book entries; no gateway call)
    if (!cs.gaps.approvals) {
      const acct = owner; // only org-level finance can raise cancellations/refunds
      const tx = await acct.call('GET', '/finance/transactions?limit=8', undefined, B).catch(() => []);
      const txs = (tx.transactions ?? tx.data ?? tx).slice(0, 4);
      const made = [];
      for (const [i, t] of txs.entries()) {
        const body = i % 2 ? { type: 'refund', transactionId: t._id, refundAmount: Math.round((t.totalAmount ?? 1000) * 0.1), reason: 'Hostel mess charges billed twice in this receipt' } : { type: 'cancellation', transactionId: t._id, reason: pick(['Wrong student selected at the counter', 'Cheque returned by the bank']) };
        const r = await acct.call('POST', '/finance/approval-requests', body, B).catch(soft('approval'));
        if (r) made.push(r);
      }
      if (made[1]) await owner.call('POST', `/finance/approval-requests/${made[1]._id}/approve`, { remarks: 'Verified with the mess office' }, B).catch(soft('approve'));
      if (made[2]) await owner.call('POST', `/finance/approval-requests/${made[2]._id}/reject`, { remarks: 'Receipt is correct; please re-check' }, B).catch(soft('reject'));
      cs.gaps.approvals = made.length;
      out.push(`${made.length} fee approval requests`);
    }

    // A few sick-room visits today so "Today's visits" has entries
    if (!cs.gaps.visitsToday) {
      let n = 0;
      for (const [i, s] of students.filter((_, i) => i % 27 === 0).slice(0, 3).entries()) {
        const r = await owner.call('GET', `/health/records/person/student/${s.id}`, undefined, B).catch(() => null);
        const rid = r?._id ?? r?.record?._id;
        if (!rid) continue;
        await owner.call('POST', '/health/visits', { healthRecordId: rid, personType: 'student', personId: s.id, visitType: pick(['illness', 'routine']), visitDate: TODAY, arrivalTime: `${TODAY}T0${4 + i}:${String(int(10, 50))}:00.000Z`, chiefComplaint: pick(['Headache', 'Mild fever', 'Stomach ache']), treatment: 'Rest and paracetamol', disposition: 'returned_to_class', attendedBy: (role('HOSTEL_WARDEN')[0] ?? role('BRANCH_ADMIN')[0]).id }, B).then(() => n++).catch((e) => n === 0 && soft('visit')(e));
      }
      cs.gaps.visitsToday = n;
      out.push(`${n} visits today`);
    }

    // OBE corrective actions on COs that fell short
    if (uni && !cs.gaps.corrective) {
      let n = 0;
      for (const P of Object.values(cs.obe ?? {})) {
        for (const off of (P.offerings ?? []).filter((o) => o.computed).slice(0, 4)) {
          const a = await owner.call('GET', `/obe/offerings/${off.id}/attainment`, undefined, B).catch(() => null);
          const arr = Object.values(a ?? {}).find((v) => Array.isArray(v) && v[0]?.coId) ?? [];
          const cos = arr.map((x) => String(x.coId)).slice(0, 2);
          if (!cos.length) continue;
          await owner.call('PUT', `/obe/offerings/${off.id}/corrective-actions`, { actions: cos.map((coId) => ({ coId, text: 'Extra tutorial sessions and a remedial assignment for students below the threshold; revisit in the next internal.' })) }, B).then(() => n++).catch((e) => n === 0 && soft('corrective')(e));
        }
      }
      cs.gaps.corrective = n;
      out.push(`${n} offerings with corrective actions`);
    }

    // The teachers listed in DEMO-CREDENTIALS.md get a leave and a concern of their own
    if (!cs.gaps.demoTeachers) {
      const admin = await sess(role('BRANCH_ADMIN')[0].email);
      let n = 0;
      for (const [i, t] of role('TEACHER').slice(0, 4).entries()) {
        const me = await sess(t.email);
        const mine = await me.call('GET', '/hr/leaves/my?limit=5', undefined, B).catch(() => []);
        if (!(mine.length ?? mine.data?.length)) {
          const d = `2026-10-${String(26 + i).padStart(2, '0')}`;
          const lv = await me.call('POST', '/hr/leaves', { fromDate: d, toDate: d, leaveType: 'CL', reason: pick(['Family function', 'Personal work', 'Medical appointment']) }, B).catch(soft('teacher leave'));
          if (lv && i % 2 === 0) await admin.call('PUT', `/hr/leaves/${lv._id}/approve`, { remarks: 'Approved' }, B).catch(() => {});
        }
        await me.call('POST', '/feedback', { subject: pick(['Smart board in my classroom is not working', 'Need a second projector for lab sessions']), description: 'Affects daily classes — please fix this week.', category: 'infrastructure', priority: 'medium', isAnonymous: false }, B).catch(() => {});
        n++;
      }
      cs.gaps.demoTeachers = n;
      out.push(`${n} demo teachers with leave and a concern`);
    }

    // Programme-level corrective actions (OBE reports) on the first two POs
    if (uni && !cs.gaps.poCorrective) {
      let n = 0;
      for (const P of Object.values(cs.obe ?? {}).filter((p) => p?.id && p.pos?.length)) {
        await owner.call('PUT', `/obe/programs/${P.id}/corrective-actions`, { academicBatchId: cs.batchId, actions: [{ poId: P.pos[0], text: 'Add an industry mini-project in the 5th semester to lift problem-analysis attainment.' }, { poId: P.pos[1], text: 'Run design-thinking workshops each term; review in the next PAC meeting.' }] }, B).then(() => n++).catch((e) => n === 0 && soft('po corrective')(e));
      }
      cs.gaps.poCorrective = n;
      out.push(`${n} programmes with corrective actions`);
    }

    // Deans, HODs and office staff file their own expense claims and concerns
    if (!cs.gaps.staffOwn) {
      const admin = await sess(role('BRANCH_ADMIN')[0].email);
      let e = 0, f = 0;
      const people = ['INSTITUTION_ADMIN', 'HOD', 'ACCOUNTANT', 'HR_MANAGER', 'ADMISSION_COUNSELOR', 'RECEPTIONIST', 'HOSTEL_WARDEN', 'INVENTORY_MANAGER', 'PLACEMENT_OFFICER'].flatMap(role);
      for (const [i, s] of people.entries()) {
        const me = await sess(s.email).catch(() => null);
        if (!me) continue;
        const [title, category, amount] = pick([['Conference registration fee', 'travel', 4500], ['Stationery for the department office', 'supplies', 1800], ['Cab to the university exam cell', 'travel', 900], ['Refreshments for the parents’ meeting', 'events', 2400]]);
        const x = await me.call('POST', '/expenses', { title, description: `${title} — bills attached at the accounts office.`, category, amount: amount + int(0, 600) }, B).catch((err) => e === 0 && soft('expense')(err));
        if (x) {
          await me.call('PUT', `/expenses/${x._id}/submit`, {}, B).catch(() => {});
          if (s.role !== 'BRANCH_ADMIN' && i % 3 !== 2) await admin.call('PUT', `/expenses/${x._id}/approve`, { remarks: 'Approved' }, B).catch(() => {});
          e++;
        }
        const [subject, cat] = pick([['Projector in the seminar hall flickers', 'infrastructure'], ['Wi-Fi drops in the staff room', 'infrastructure'], ['Salary slip shows the wrong PF amount', 'finance'], ['Need more lab slots for the department', 'academic']]);
        await me.call('POST', '/feedback', { subject, description: `${subject}. Raised on behalf of the department — please look into it this week.`, category: cat, priority: pick(['low', 'medium', 'high']), isAnonymous: false }, B).then(() => f++).catch((err) => f === 0 && soft('feedback')(err));
      }
      cs.gaps.staffOwn = e + f;
      out.push(`${e} staff expense claims · ${f} staff concerns`);
    }

    saveState(org.key, st);
    log(`  ${c.code}: ${out.join(' · ')}`);
  }
}
log('phase 15 done');

// Phase 10 — inventory, visitors, health records, expense claims and online
// courses, each done at the login of the person who would really do it.
import { session, pool, loadState, saveState, log, rnd, pick, int, person } from './lib.mjs';
import { ORGS } from './spec.mjs';

const only = process.argv[2];
const steps = (process.argv[3] ?? 'inventory,visitors,health,expenses,courses').split(',');
const sessions = new Map();
const sess = async (email) => {
  if (!sessions.has(email)) sessions.set(email, await session(email));
  return sessions.get(email);
};
const soft = (label) => (e) => log(`   ${label}:`, e.message.slice(0, 170));

for (const org of ORGS.filter((o) => !only || o.key === only)) {
  const st = loadState(org.key);
  const owner = await session(org.owner);
  log(`== ${org.key}`);
  const uni = org.type === 'university';

  for (const c of org.campuses) {
    const cs = st.campuses[c.code];
    const B = { branchId: cs.branchId };
    const role = (r) => cs.staff.filter((s) => s.role === r);
    const teachers = role('TEACHER');

    if (steps.includes('inventory') && !cs.inventory) {
      const mgr = await sess(role('INVENTORY_MANAGER')[0].email);
      const cats = {};
      for (const [name, code] of [['IT Equipment', 'IT'], ['Furniture', 'FUR'], ['Lab Equipment', 'LAB'], ['Sports Equipment', 'SPT'], ['Audio Visual', 'AV']]) {
        cats[code] = (await mgr.call('POST', '/inventory/categories', { name, code: `${code}${c.code.slice(1)}`, description: `${name} for ${c.name}` }, B).catch(soft('category')))?._id;
      }
      const items = [
        ['Dell OptiPlex Desktop', 'IT', 'Dell', 48000], ['HP LaserJet Printer', 'IT', 'HP', 22000], ['Lenovo ThinkPad Laptop', 'IT', 'Lenovo', 68000], ['Cisco Network Switch', 'IT', 'Cisco', 35000],
        ['Epson Projector', 'AV', 'Epson', 42000], ['JBL PA System', 'AV', 'JBL', 28000], ['Interactive Smart Board', 'AV', 'BenQ', 120000],
        ['Steel Almirah', 'FUR', 'Godrej', 14000], ['Lecture Hall Benches', 'FUR', 'Featherlite', 6500], ['Staff Room Table', 'FUR', 'Godrej', 9000],
        ['Digital Oscilloscope', 'LAB', 'Tektronix', 85000], ['Compound Microscope', 'LAB', 'Olympus', 32000], ['Fume Hood', 'LAB', 'Labconco', 150000],
        ['Cricket Kit', 'SPT', 'SG', 12000], ['Basketball Set', 'SPT', 'Nivia', 4500], ['Table Tennis Table', 'SPT', 'Stag', 26000],
      ];
      const assets = [];
      for (const [i, [name, cat, mfr, price]] of items.entries()) {
        for (let n = 1; n <= (cat === 'FUR' ? 3 : 2); n++) {
          const a = await mgr.call('POST', '/inventory/assets', { name, categoryId: cats[cat], manufacturer: mfr, serialNumber: `${c.code}-${cat}-${String(i * 10 + n).padStart(4, '0')}`, location: pick(['Block A', 'Block B', 'Main Lab', 'Library', 'Admin Office', 'Sports Room']), purchaseDate: `202${int(2, 6)}-0${int(1, 9)}-15`, purchasePrice: price, currentValue: Math.round(price * (0.6 + rnd() * 0.35)), condition: pick(['new', 'good', 'good', 'fair']), quantity: 1 }, B).catch(soft('asset'));
          if (a) assets.push(a._id);
        }
      }
      for (const [i, t] of teachers.slice(0, 6).entries()) {
        const u = (await sess(t.email)).user();
        if (!assets[i]) break;
        await mgr.call('POST', '/inventory/issues', { assetId: assets[i * 2], issuedTo: { userId: u._id ?? u.id, userName: t.name, department: t.institutionCode ?? 'Academics' }, issueDate: '2026-09-02', expectedReturnDate: '2027-03-31', conditionAtIssue: 'good', remarks: 'Issued for classroom use' }, B).catch(soft('issue'));
      }
      cs.inventory = assets.length;
      saveState(org.key, st);
      log(`  ${c.code}: inventory ${assets.length} assets`);
    }

    if (steps.includes('visitors') && !cs.visitors) {
      const desk = await sess(role('RECEPTIONIST')[0].email);
      let n = 0;
      for (let i = 0; i < 18; i++) {
        const p = person();
        const host = pick([...role('BRANCH_ADMIN'), ...role('ACCOUNTANT'), ...teachers.slice(0, 10)]);
        const v = await desk.call('POST', '/visitors', { name: `${p.firstName} ${p.lastName}`, phone: p.phone, company: pick(['', 'Parent', 'Vendor — Stationery', 'Courier', 'Alumni', 'Guest Lecturer', 'Government Inspector']), idType: pick(['aadhar', 'driving_license', 'pan']), idNumber: String(int(100000000, 999999999)), purpose: pick(['Meet class teacher', 'Fee enquiry', 'Admission enquiry', 'Delivery', 'Guest lecture', 'Collect documents']), hostName: host.name, numberOfVisitors: int(1, 3), vehicleNumber: rnd() < 0.4 ? `KA-0${int(1, 5)}-${pick(['MN', 'AB', 'JK'])}-${int(1000, 9999)}` : undefined, type: 'walk_in' }, B).catch(soft('visitor'));
        if (!v) continue;
        await desk.call('POST', `/visitors/${v._id}/check-in`, {}, B).catch(() => {});
        if (i < 14) await desk.call('POST', `/visitors/${v._id}/check-out`, {}, B).catch(() => {});
        n++;
      }
      cs.visitors = n;
      saveState(org.key, st);
      log(`  ${c.code}: visitors ${n}`);
    }

    if (steps.includes('health') && !cs.health) {
      let n = 0;
      const people = [...(cs.students ?? []).filter((_, i) => i % 9 === 0).map((s) => ['student', s]), ...cs.staff.filter((_, i) => i % 6 === 0).map((s) => ['staff', s])];
      await pool(people, 3, async ([personType, p]) => {
        await owner.call('POST', '/health/records', {
          personType,
          personId: p.id,
          bloodGroup: pick(['A+', 'B+', 'O+', 'AB+', 'O-', 'B-']),
          heightCm: personType === 'student' && !uni ? int(110, 165) : int(150, 185),
          weightKg: personType === 'student' && !uni ? int(20, 55) : int(45, 85),
          allergies: rnd() < 0.15 ? [pick([{ name: 'Peanuts', category: 'food' }, { name: 'Dust mites', category: 'environmental' }, { name: 'Pollen', category: 'environmental' }, { name: 'Penicillin', category: 'medication' }])].map((x) => ({ ...x, severity: pick(['mild', 'moderate']), symptoms: ['Sneezing', 'Rashes'] })) : [],
          emergencyContacts: [{ name: `${person().firstName} ${p.name.split(' ').slice(-1)[0]}`, relation: personType === 'student' ? 'Father' : 'Spouse', phone: `9${String(int(100000000, 999999999))}` }],
          notes: 'Annual health check up to date',
        }, B).then(() => n++).catch((e) => n === 0 && soft('health')(e));
      });
      cs.health = n;
      saveState(org.key, st);
      log(`  ${c.code}: health records ${n}`);
    }

    if (steps.includes('expenses') && !cs.expenses) {
      const admin = await sess(role('BRANCH_ADMIN')[0].email);
      let n = 0;
      for (const [i, t] of teachers.slice(0, 10).entries()) {
        const me = await sess(t.email);
        const [title, category, amount] = pick([['Conference registration fee', 'travel', 4500], ['Lab consumables', 'supplies', 2800], ['Workshop travel — bus fare', 'travel', 1200], ['Printing of question papers', 'supplies', 950], ['Projector bulb replacement', 'maintenance', 3400], ['Sports day refreshments', 'events', 5200]]);
        const e = await me.call('POST', '/expenses', { title, description: `${title} — bills attached at the accounts office.`, category, amount: amount + int(0, 600) }, B).catch(soft('expense'));
        if (!e) continue;
        await me.call('PUT', `/expenses/${e._id}/submit`, {}, B).catch(() => {});
        if (i % 3 !== 2) await admin.call('PUT', `/expenses/${e._id}/approve`, { remarks: 'Approved' }, B).catch(soft('approve'));
        if (i % 3 === 0) await admin.call('PUT', `/expenses/${e._id}/mark-paid`, { paymentMode: 'bank_transfer', remarks: 'Reimbursed' }, B).catch(() => {});
        n++;
      }
      cs.expenses = n;
      saveState(org.key, st);
      log(`  ${c.code}: expense claims ${n}`);
    }

    if (steps.includes('courses') && !cs.courses) {
      const list = uni
        ? [['Python for Data Science', 'technical'], ['Aptitude & Reasoning Bootcamp', 'aptitude'], ['Communication for Interviews', 'soft_skills']]
        : [['Spoken English Basics', 'language'], ['Fun with Coding (Scratch)', 'technical'], ['Olympiad Maths Practice', 'aptitude']];
      const made = [];
      for (const [i, [title, category]] of list.entries()) {
        const t = teachers[i * 3] ?? teachers[0];
        const course = await owner.call('POST', '/courses', { title, description: `${title}: a self-paced course with short video lessons, practice and quizzes.`, category, level: pick(['beginner', 'intermediate']), duration: int(6, 14), tags: [category], instructorId: t.id, instructorName: t.name, modules: [1, 2, 3].map((m) => ({ title: `Module ${m}`, order: m - 1, duration: 60 })), status: 'draft' }, B).catch(soft('course'));
        if (!course) continue;
        for (const [m, mod] of (course.modules ?? []).entries()) {
          for (let l = 0; l < 3; l++) {
            await owner.call('POST', `/courses/${course._id}/lessons`, { courseId: course._id, moduleId: mod._id, title: `${mod.title}, lesson ${l + 1}`, type: 'video', contentUrl: 'https://www.youtube.com/watch?v=rfscVS0vtbw', duration: int(8, 20), order: m * 3 + l, isPreview: m === 0 && l === 0 }, B).catch(soft('lesson'));
          }
        }
        await owner.call('PUT', `/courses/${course._id}`, { status: 'published' }, B).catch(soft('publish course'));
        await owner.call('PUT', `/courses/${course._id}/visibility`, { visibility: 'public', isPublic: true }, B).catch(() => {});
        made.push(course._id);
      }
      cs.courses = made.length;
      saveState(org.key, st);
      log(`  ${c.code}: ${made.length} courses`);
    }

    // Enrol the demo-password students (one call per course with their ids)
    if (steps.includes('courses') && !cs.courseEnrolled) {
      const found = await owner.call('GET', '/courses?limit=50', undefined, B);
      const ids = (found.courses ?? found).map((x) => x._id);
      const learners = (cs.students ?? []).filter((x) => x.demoPassword).map((x) => x.id);
      let n = 0;
      for (const [i, courseId] of ids.entries()) {
        const group = learners.filter((_, j) => j % ids.length === i);
        if (!group.length) continue;
        await owner.call('POST', '/courses/enrollments', { courseId, studentIds: group }, B).then(() => (n += group.length)).catch(soft('enroll'));
      }
      cs.courseEnrolled = n;
      saveState(org.key, st);
      log(`  ${c.code}: ${n} course enrolments`);
    }
  }
}
log('phase 10 done');

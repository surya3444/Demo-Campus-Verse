// Phase 20 — a full placement season (recruiters with real websites, drives
// through rounds to offers and acceptances) and a busy campus health centre
// (completed check-ups, six weeks of sick-room visits, vaccinations), all
// through the API as the owner. Re-runnable: progress lives in demo-state.
import { session, pool, loadState, saveState, log, pick, int, rnd } from './lib.mjs';
import { ORGS } from './spec.mjs';

const only = process.argv[2] ?? 'marian';
const steps = (process.argv[3] ?? 'careers,health').split(',');
const org = ORGS.find((o) => o.key === only);
const st = loadState(org.key);
const cs = st.campuses[org.campuses[0].code];
const B = { branchId: cs.branchId };
const owner = await session(org.owner);
const list = (r, k) => (Array.isArray(r) ? r : r?.[k] ?? r?.data ?? []);
const day = (d) => new Date(Date.UTC(2026, d[0] - 1, d[1], 4, 30)).toISOString();

// ── Placements ───────────────────────────────────────────────────────────
const finalYear = new Map(); // programCode → final year number
for (const k of cs.classes) finalYear.set(k.programCode, Math.max(finalYear.get(k.programCode) ?? 0, k.year));
const finalists = (codes) =>
  cs.students.filter((s) => {
    const k = cs.classes.find((c) => c.key === s.classKey);
    return k && codes.includes(k.programCode) && k.year === finalYear.get(k.programCode);
  });
const ENG = ['BTCE', 'BTCSE', 'BTEEE', 'BTECE', 'BTME', 'BTAIML', 'BTECM', 'BTELC'];
const CS = ['BTCSE', 'BTAIML', 'BTECM', 'IMCA', 'MCA', 'BSCCS'];
const MGMT = ['MBA', 'MBAE', 'BCOMBIS', 'MCOM', 'BBALSCM'];
const ELEC = ['BTECE', 'BTECM', 'BTELC', 'BTEEE', 'BTCSE'];
const CORE = ['BTME', 'BTCE', 'BTEEE', 'BTELC'];

// [company, website, industry, size, role, ctc, pool, registered, offers, status, offerDay, location]
const DRIVES = [
  ['Amazon', 'https://www.amazon.jobs', 'E-commerce & Cloud', 'enterprise', 'SDE I', 1800000, CS, 40, 3, 'completed', [8, 20], 'Bengaluru'],
  ['TCS', 'https://www.tcs.com', 'IT Services', 'enterprise', 'Systems Engineer (Digital)', 700000, [...ENG, ...CS], 180, 34, 'completed', [8, 26], 'Kochi'],
  ['Infosys', 'https://www.infosys.com', 'IT Services', 'enterprise', 'Specialist Programmer', 625000, [...CS, ...ENG], 160, 22, 'completed', [9, 2], 'Thiruvananthapuram'],
  ['UST', 'https://www.ust.com', 'Digital Transformation', 'enterprise', 'Developer', 450000, [...CS, ...ENG], 140, 26, 'completed', [9, 5], 'Thiruvananthapuram'],
  ['IBS Software', 'https://www.ibsplc.com', 'Travel Technology', 'large', 'Software Engineer', 550000, CS, 90, 14, 'completed', [9, 9], 'Technopark, Thiruvananthapuram'],
  ['Tata Elxsi', 'https://www.tataelxsi.com', 'Design & Embedded', 'large', 'Embedded Engineer', 600000, ELEC, 80, 9, 'completed', [9, 12], 'Thiruvananthapuram'],
  ['Quest Global', 'https://www.quest-global.com', 'Engineering Services', 'large', 'Engineer', 475000, CORE, 85, 15, 'completed', [9, 16], 'Thiruvananthapuram'],
  ['Accenture', 'https://www.accenture.com', 'Consulting & Technology', 'enterprise', 'Associate Software Engineer', 450000, [...ENG, ...CS, ...MGMT], 200, 30, 'completed', [9, 19], 'Bengaluru'],
  ['Cognizant', 'https://www.cognizant.com', 'IT Services', 'enterprise', 'Programmer Analyst', 400000, [...ENG, ...CS], 150, 20, 'completed', [9, 23], 'Kochi'],
  ['Bosch', 'https://www.bosch.com', 'Automotive & Engineering', 'enterprise', 'Graduate Engineer Trainee', 700000, ['BTME', 'BTEEE', 'BTECE', 'BTELC'], 60, 6, 'completed', [9, 26], 'Coimbatore'],
  ['L&T Construction', 'https://www.larsentoubro.com', 'Construction & Infrastructure', 'enterprise', 'Graduate Engineer Trainee', 650000, ['BTCE', 'BTME', 'MTGT'], 50, 7, 'completed', [9, 30], 'Chennai'],
  ['Deloitte', 'https://www.deloitte.com', 'Consulting', 'enterprise', 'Analyst', 750000, [...MGMT, ...CS], 70, 8, 'completed', [10, 3], 'Bengaluru'],
  ['EY', 'https://www.ey.com', 'Professional Services', 'enterprise', 'Associate', 650000, MGMT, 55, 7, 'completed', [10, 6], 'Kochi'],
  ['Federal Bank', 'https://www.federalbank.co.in', 'Banking', 'large', 'Management Trainee', 600000, MGMT, 45, 6, 'completed', [10, 9], 'Aluva'],
  ['HDFC Bank', 'https://www.hdfcbank.com', 'Banking', 'enterprise', 'Relationship Manager', 550000, MGMT, 50, 6, 'completed', [10, 12], 'Thiruvananthapuram'],
  ['Capgemini', 'https://www.capgemini.com', 'Consulting & Technology', 'enterprise', 'Analyst', 425000, [...ENG, ...CS], 120, 0, 'in_progress', [10, 15], 'Bengaluru'],
  ['Zoho', 'https://www.zoho.com', 'Software Products', 'large', 'Member Technical Staff', 550000, CS, 60, 0, 'registration_open', [10, 24], 'Chennai'],
  ['Wipro', 'https://www.wipro.com', 'IT Services', 'enterprise', 'Project Engineer', 350000, [...ENG, ...CS], 45, 0, 'registration_open', [10, 28], 'Kochi'],
];

if (steps.includes('careers')) {
  cs.careers ??= { drives: {}, placed: [] };
  const placed = new Set(cs.careers.placed);
  const companies = new Map(list(await owner.call('GET', '/career-connect/companies?limit=100', undefined, B), 'companies').map((c) => [c.name, c]));
  const drives = list(await owner.call('GET', '/career-connect/drives?limit=100', undefined, B), 'drives');

  for (const [name, website, industry, size, role, ctc, codes, nReg, nOffers, target, offerDay, location] of DRIVES) {
    const ds = (cs.careers.drives[name] ??= {});
    if (ds.done) continue;
    let company = companies.get(name);
    if (!company) {
      company = await owner.call('POST', '/career-connect/companies', { name, industry, website, size, locations: [location], description: `${name} — campus recruitment partner`, partnership: { type: ctc >= 700000 ? 'premium' : 'regular' } }, B);
    } else if (company.website !== website) {
      await owner.call('PUT', `/career-connect/companies/${company._id}`, { website, industry, size }, B).catch(() => null);
    }
    let drive = ds.id ? { _id: ds.id } : drives.find((d) => d.companyName === name && d.status !== 'cancelled');
    if (!drive) {
      drive = await owner.call('POST', '/career-connect/drives', {
        title: `${name} Campus Drive 2026-27`, companyId: company._id, type: 'on_campus', academicBatchId: cs.batchId,
        registrationDeadline: day([offerDay[0], Math.max(1, offerDay[1] - 6)]),
        jobProfile: { role, ctc, location, jobType: 'job', description: `${role} — full-time role after graduation.` },
      }, B);
    }
    ds.id = drive._id;
    saveState(org.key, st);
    const full = await owner.call('GET', `/career-connect/drives/${ds.id}`, undefined, B);
    const go = async (s) => owner.call('PUT', `/career-connect/drives/${ds.id}/status`, { status: s }, B).catch((e) => { if (!/transition|already/i.test(e.message)) throw e; });
    const order = ['draft', 'registration_open', 'registration_closed', 'in_progress', 'completed'];
    const at = (s) => order.indexOf(s);
    if (at(full.status) < at('registration_open')) await go('registration_open');

    // Registrations
    const already = new Set((full.registrations ?? []).map((r) => String(r.studentId)));
    const poolStudents = finalists(codes).filter((s) => !already.has(s.id)).sort(() => rnd() - 0.5);
    const want = Math.max(0, Math.min(nReg, poolStudents.length + already.size) - already.size);
    await pool(poolStudents.slice(0, want), 8, (s) =>
      owner.call('POST', `/career-connect/drives/${ds.id}/register`, { studentId: s.id, studentName: s.name }, B).catch(() => null)
    );
    if (target === 'registration_open') { ds.done = true; saveState(org.key, st); log(`  ${name}: registration open`); continue; }

    await go('registration_closed');
    await go('in_progress');
    const now = await owner.call('GET', `/career-connect/drives/${ds.id}`, undefined, B);
    const regs = (now.registrations ?? []).map((r) => String(r.studentId));
    // Rounds: aptitude → technical → HR
    const roundsSpec = [['aptitude', 'Online Aptitude Test', -9], ['technical', 'Technical Interview', -4], ['hr', 'HR Interview', -1]];
    let rounds = now.rounds ?? [];
    for (const [i, [type, rname, off]] of roundsSpec.entries()) {
      if (!rounds.some((r) => r.type === type)) {
        await owner.call('POST', `/career-connect/drives/${ds.id}/rounds`, { roundNumber: i + 1, type, name: rname, date: day([offerDay[0], Math.max(1, offerDay[1] + off)]), venue: i === 0 ? 'CSE Lab Complex' : 'Placement Cell' }, B);
      }
    }
    rounds = (await owner.call('GET', `/career-connect/drives/${ds.id}`, undefined, B)).rounds ?? [];
    if (target === 'in_progress') {
      const apt = rounds.find((r) => r.type === 'aptitude');
      if (apt && apt.status !== 'completed') {
        await owner.call('POST', `/career-connect/drives/${ds.id}/rounds/${apt._id}/results`, { qualifiedStudentIds: regs.filter(() => rnd() < 0.55) }, B);
      }
      ds.done = true; saveState(org.key, st); log(`  ${name}: aptitude done, interviews in progress`); continue;
    }
    // Funnel: aptitude ~55%, technical narrows to ~2x offers, HR = offers
    const eligibleForOffer = regs.filter((id) => !placed.has(id));
    const offers = eligibleForOffer.sort(() => rnd() - 0.5).slice(0, nOffers);
    const technical = [...new Set([...offers, ...regs.filter(() => rnd() < 0.18)])];
    const aptitude = [...new Set([...technical, ...regs.filter(() => rnd() < 0.4)])];
    const res = { aptitude, technical, hr: offers };
    for (const r of rounds) {
      if (r.status === 'completed' || !res[r.type]?.length) continue;
      await owner.call('POST', `/career-connect/drives/${ds.id}/rounds/${r._id}/results`, { qualifiedStudentIds: res[r.type] }, B);
    }
    // Offers + acceptances
    ds.offers ??= [];
    const made = new Set(ds.offers);
    await pool(offers.filter((id) => !made.has(id)), 6, async (studentId) => {
      const bump = ctc >= 1000000 ? 0 : int(0, 3) * 25000;
      const offer = await owner.call('POST', `/career-connect/drives/${ds.id}/offers`, {
        driveId: ds.id, studentId, role, ctc: ctc + bump, location,
        offerDate: day(offerDay), joiningDate: day([7, 1]).replace('2026', '2027'),
      }, B);
      ds.offers.push(studentId);
      const accept = !placed.has(studentId) && rnd() < 0.9;
      await owner.call('PUT', `/career-connect/offers/${offer._id}/respond`, { status: accept ? 'accepted' : 'declined' }, B).catch(() => null);
      if (accept) placed.add(studentId);
    });
    await go('completed');
    cs.careers.placed = [...placed];
    ds.done = true;
    saveState(org.key, st);
    log(`  ${name}: ${regs.length} registered, ${offers.length} offers`);
  }
  log(`  careers: ${placed.size} students placed`);
}

// ── Health centre ────────────────────────────────────────────────────────
if (steps.includes('health')) {
  cs.healthCentre ??= {};
  const H = cs.healthCentre;
  // Records by person
  const records = new Map();
  for (let page = 1; page <= 20; page++) {
    const r = await owner.call('GET', `/health/records?limit=100&page=${page}`, undefined, B);
    const rows = list(r, 'records');
    for (const x of rows) records.set(String(x.personId), x);
    if (rows.length < 100) break;
  }
  const people = [...records.values()].filter((r) => r.personType === 'student');
  const nurse = cs.staff.find((s) => s.role === 'HOSTEL_WARDEN') ?? cs.staff[0];

  if (!H.checkups) {
    let done = 0;
    for (let round = 0; round < 4 && done < 300; round++) {
      const r = await owner.call('GET', `/health/checkups?status=scheduled&limit=100`, undefined, B);
      const rows = list(r, 'checkups');
      if (!rows.length) break;
      await pool(rows.slice(0, 300 - done), 8, async (c) => {
        const h = int(150, 184), w = int(46, 84);
        const bmi = Math.round((w / ((h / 100) ** 2)) * 10) / 10;
        const vis = rnd();
        await owner.call('POST', `/health/checkups/${c._id}/complete`, {
          vitals: { heightCm: h, weightKg: w, bmi, bloodPressureSystolic: int(104, 132), bloodPressureDiastolic: int(64, 86), pulseRate: int(62, 92), temperatureCelsius: 36.6, oxygenSaturation: int(97, 99) },
          visionExam: { result: vis < 0.78 ? 'normal' : vis < 0.93 ? 'corrected' : 'needs_correction', leftEye: vis < 0.78 ? '6/6' : '6/9', rightEye: vis < 0.78 ? '6/6' : '6/9' },
          hearingExam: { result: 'normal' },
          findings: bmi < 18.5 ? ['Underweight — nutrition advice'] : bmi > 25 ? ['Overweight — activity plan'] : ['Healthy'],
          recommendations: ['Annual review next year'],
          followUpRequired: bmi < 17 || bmi > 28,
        }, B).catch(() => null);
      });
      done += Math.min(rows.length, 300 - done);
    }
    H.checkups = done;
    saveState(org.key, st);
    log(`  health: ${done} check-ups completed`);
  }

  if (!H.visits) {
    const COMPLAINTS = [
      ['illness', 'Fever and body ache', 'Viral fever', 'Paracetamol 500 mg, rest and fluids'],
      ['illness', 'Headache', 'Tension headache', 'Rest in sick room, paracetamol'],
      ['illness', 'Stomach ache', 'Gastritis', 'Antacid, light diet advised'],
      ['illness', 'Cold and cough', 'Upper respiratory infection', 'Cetirizine, steam inhalation'],
      ['illness', 'Migraine', 'Migraine episode', 'Rest in a dark room, analgesic'],
      ['illness', 'Dizziness', 'Low blood sugar', 'Glucose drink, observation 30 min'],
      ['illness', 'Allergic rash', 'Contact dermatitis', 'Antihistamine, calamine lotion'],
      ['injury', 'Sprained ankle during football', 'Grade 1 ankle sprain', 'RICE, crepe bandage'],
      ['injury', 'Minor cut in workshop', 'Superficial laceration', 'Wound cleaned and dressed'],
      ['injury', 'Knee abrasion on basketball court', 'Abrasion', 'Antiseptic dressing'],
      ['routine', 'BP check', 'Normal blood pressure', 'No treatment needed'],
      ['routine', 'Eye irritation after lab', 'Mild conjunctival irritation', 'Eye wash, lubricant drops'],
      ['emergency', 'Fainted at morning assembly', 'Vasovagal syncope', 'Observation, ORS, parent informed'],
    ];
    const OUT = ['returned_to_class', 'returned_to_class', 'returned_to_class', 'returned_to_class', 'sent_home', 'sent_home', 'referred', 'under_observation'];
    const today = new Date();
    const dates = [];
    for (let back = 45; back >= 1; back--) {
      const d = new Date(today.getTime() - back * 86_400_000);
      if (d.getUTCDay() === 0) continue;
      for (let n = int(0, 3); n > 0; n--) dates.push({ d, open: false });
    }
    for (let n = 0; n < 5; n++) dates.push({ d: today, open: n >= 3 });
    let made = 0;
    await pool(dates, 6, async ({ d, open }) => {
      const p = pick(people);
      const [visitType, chiefComplaint, diagnosis, treatment] = pick(COMPLAINTS);
      const hour = int(3, 10);
      const arrival = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour, int(0, 59)));
      const v = await owner.call('POST', '/health/visits', {
        healthRecordId: p._id, personType: 'student', personId: p.personId, visitType,
        visitDate: arrival.toISOString(), arrivalTime: arrival.toISOString(), chiefComplaint,
        symptoms: [chiefComplaint.split(' ')[0]],
        vitals: { temperatureCelsius: visitType === 'illness' && /Fever/.test(chiefComplaint) ? 38.4 : 36.8, pulseRate: int(70, 98), oxygenSaturation: int(96, 99) },
        isIncident: visitType === 'injury', attendedBy: nurse.id,
      }, B).catch(() => null);
      if (!v) return;
      made++;
      if (open) return;
      await owner.call('PUT', `/health/visits/${v._id}/close`, {
        outcome: visitType === 'emergency' ? 'referred' : pick(OUT), diagnosis, treatment,
        departureTime: new Date(arrival.getTime() + int(20, 90) * 60_000).toISOString(),
      }, B).catch(() => null);
    });
    H.visits = made;
    saveState(org.key, st);
    log(`  health: ${made} sick-room visits`);
  }

  if (!H.vaccinations) {
    const VACC = [['Hepatitis B', 3], ['Typhoid', 1], ['Tetanus (Td)', 1], ['HPV', 2], ['Influenza', 1], ['COVID-19 booster', 1]];
    let made = 0;
    await pool(Array.from({ length: 120 }, (_, i) => i), 6, async (i) => {
      const p = pick(people);
      const [vaccineName, totalDoses] = pick(VACC);
      const kind = i % 10; // 7 given, 2 due soon, 1 overdue
      const body = {
        healthRecordId: p._id, personType: 'student', personId: p.personId, vaccineName, doseNumber: 1, totalDoses,
        ...(kind < 7
          ? { status: 'completed', administeredDate: day([int(6, 9), int(1, 28)]), administeredBy: 'Campus Medical Officer', manufacturer: pick(['Serum Institute of India', 'Bharat Biotech', 'Biological E']), batchNumber: `B${int(10000, 99999)}` }
          : kind < 9
            ? { status: 'scheduled', scheduledDate: new Date(Date.now() + int(2, 25) * 86_400_000).toISOString() }
            : { status: 'overdue', scheduledDate: day([9, int(1, 25)]) }),
      };
      if (await owner.call('POST', '/health/vaccinations', body, B).catch(() => null)) made++;
    });
    H.vaccinations = made;
    saveState(org.key, st);
    log(`  health: ${made} vaccinations`);
  }
}
log('phase 20 done');

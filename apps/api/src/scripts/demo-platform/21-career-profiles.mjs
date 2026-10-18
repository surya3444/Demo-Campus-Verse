// Phase 21 — a real career profile for every student who took part in a
// placement drive: skills that fit their programme, projects, certifications,
// internships and preferences. Placed students carry their accepted offer
// (set by phase 21b's backfill / the offer flow itself).
import { session, pool, loadState, saveState, log, pick, int, rnd } from './lib.mjs';
import { ORGS } from './spec.mjs';

const only = process.argv[2] ?? 'marian';
const org = ORGS.find((o) => o.key === only);
const st = loadState(org.key);
const cs = st.campuses[org.campuses[0].code];
const B = { branchId: cs.branchId };
const owner = await session(org.owner);
const list = (r, k) => (Array.isArray(r) ? r : r?.[k] ?? r?.data ?? []);

const TRACKS = {
  software: {
    skills: [['Java', 'Programming'], ['Python', 'Programming'], ['Data Structures & Algorithms', 'Core CS'], ['SQL', 'Databases'], ['React', 'Web'], ['Node.js', 'Web'], ['Git', 'Tools'], ['Spring Boot', 'Web'], ['Machine Learning', 'AI'], ['AWS', 'Cloud'], ['Docker', 'DevOps']],
    projects: [
      ['Campus Lost & Found App', 'A React Native app for reporting and claiming lost items on campus, with image matching.', ['React Native', 'Firebase']],
      ['Smart Attendance using Face Recognition', 'Classroom attendance from a single photo using a fine-tuned FaceNet model.', ['Python', 'OpenCV', 'TensorFlow']],
      ['Kerala Flood Relief Coordinator', 'A web portal matching relief camps with volunteers and supplies in real time.', ['Node.js', 'MongoDB', 'React']],
      ['Malayalam News Summariser', 'An NLP pipeline that summarises Malayalam news articles into three lines.', ['Python', 'Transformers']],
      ['Expense Splitter', 'A full-stack app to split hostel expenses with UPI deep links.', ['Next.js', 'PostgreSQL']],
    ],
    certs: [['AWS Certified Cloud Practitioner', 'Amazon Web Services'], ['Google Data Analytics Certificate', 'Google'], ['Java SE 11 Developer', 'Oracle'], ['NPTEL — Programming in Java', 'NPTEL'], ['Meta Front-End Developer', 'Meta']],
    interns: [['TCS', 'Software Intern'], ['UST', 'Engineering Intern'], ['IBS Software', 'Summer Intern'], ['Technopark startup — Fingent', 'Web Developer Intern']],
    roles: ['Software Engineer', 'Full-stack Developer', 'Data Analyst'],
  },
  electronics: {
    skills: [['Embedded C', 'Embedded'], ['VLSI Design', 'Electronics'], ['MATLAB', 'Tools'], ['Arduino', 'Embedded'], ['PCB Design', 'Electronics'], ['Verilog', 'Electronics'], ['IoT', 'Embedded'], ['Python', 'Programming'], ['Signal Processing', 'Electronics']],
    projects: [
      ['IoT Coconut Farm Monitor', 'Soil moisture and weather sensing with LoRa for smallholder coconut farms.', ['ESP32', 'LoRa', 'MQTT']],
      ['Smart Energy Meter', 'A prepaid smart meter with load analytics and tamper alerts.', ['Arduino', 'GSM']],
      ['Gesture-controlled Wheelchair', 'An accelerometer glove that steers a wheelchair for patients with limited mobility.', ['Embedded C', 'MPU6050']],
    ],
    certs: [['NPTEL — Embedded Systems Design', 'NPTEL'], ['Cisco IoT Fundamentals', 'Cisco'], ['MATLAB Onramp', 'MathWorks']],
    interns: [['KELTRON', 'Electronics Intern'], ['Tata Elxsi', 'Embedded Intern'], ['VSSC (ISRO)', 'Project Trainee']],
    roles: ['Embedded Engineer', 'Design Engineer', 'Hardware Engineer'],
  },
  core: {
    skills: [['AutoCAD', 'Design'], ['SolidWorks', 'Design'], ['ANSYS', 'Analysis'], ['STAAD.Pro', 'Structures'], ['Project Management', 'Management'], ['Revit', 'Design'], ['Primavera', 'Management'], ['Quality Control', 'Manufacturing']],
    projects: [
      ['Low-cost Flood-resistant Housing', 'Design and costing of raised, modular housing for Kuttanad.', ['STAAD.Pro', 'Revit']],
      ['Solar-assisted Dryer for Spices', 'A solar dryer that cuts cardamom drying time by 30%.', ['SolidWorks', 'ANSYS']],
      ['Traffic Study — Kazhakuttam Junction', 'Signal timing redesign from a week of video traffic counts.', ['VISSIM', 'Excel']],
    ],
    certs: [['Autodesk Certified User — AutoCAD', 'Autodesk'], ['NPTEL — Strength of Materials', 'NPTEL'], ['Six Sigma Yellow Belt', 'KPMG']],
    interns: [['L&T Construction', 'Site Engineer Intern'], ['KSEB', 'Trainee'], ['BrahMos Aerospace', 'Mechanical Intern']],
    roles: ['Graduate Engineer Trainee', 'Site Engineer', 'Design Engineer'],
  },
  business: {
    skills: [['Financial Analysis', 'Finance'], ['Excel', 'Tools'], ['Power BI', 'Analytics'], ['Marketing Strategy', 'Marketing'], ['Supply Chain', 'Operations'], ['Tally ERP', 'Accounting'], ['Business Communication', 'Soft skills'], ['SAP', 'Tools']],
    projects: [
      ['Market Study — Kerala Ayurveda Exports', 'Export potential and pricing for five Ayurveda brands in the GCC.', ['Excel', 'Survey']],
      ['Working-capital Dashboard', 'A Power BI dashboard tracking receivables for a local distributor.', ['Power BI', 'Excel']],
      ['Port Logistics Optimisation', 'Container dwell-time analysis for Vizhinjam port operations.', ['Python', 'Excel']],
    ],
    certs: [['NISM Series V-A', 'NISM'], ['Google Digital Marketing', 'Google'], ['Financial Modelling', 'Corporate Finance Institute']],
    interns: [['Federal Bank', 'Summer Intern'], ['HDFC Bank', 'Management Intern'], ['DP World Cochin', 'Operations Intern']],
    roles: ['Management Trainee', 'Business Analyst', 'Relationship Manager'],
  },
};
const trackOf = (code) =>
  /CSE|AIML|IMCA|MCA|BSCCS/.test(code) ? 'software' : /ECE|ECM|ELC|EEE/.test(code) ? 'electronics' : /MBA|COM|BBA/.test(code) ? 'business' : 'core';

const classOf = new Map(cs.classes.map((k) => [k.key, k]));
const students = new Map(cs.students.map((s) => [s.id, s]));
// Everyone who registered for a drive.
const drives = list(await owner.call('GET', '/career-connect/drives?limit=100', undefined, B), 'drives');
const ids = new Set();
for (const d of drives) {
  const full = await owner.call('GET', `/career-connect/drives/${d._id}`, undefined, B);
  for (const r of full.registrations ?? []) ids.add(String(r.studentId));
}
cs.careerProfiles ??= {};
const todo = [...ids].filter((id) => !cs.careerProfiles[id] && students.has(id));
log(`  ${ids.size} drive participants, ${todo.length} to build`);

let done = 0;
await pool(todo, 8, async (id) => {
  const s = students.get(id);
  const k = classOf.get(s.classKey);
  const t = TRACKS[trackOf(k?.programCode ?? '')];
  const shuffled = (a) => [...a].sort(() => rnd() - 0.5);
  const lv = ['intermediate', 'advanced', 'advanced', 'expert'];
  const body = {
    skills: shuffled(t.skills).slice(0, int(4, 7)).map(([name, category]) => ({ name, category, proficiency: pick(lv) })),
    projects: shuffled(t.projects).slice(0, int(1, 2)).map(([title, description, technologies]) => ({ title, description, technologies, startDate: `2025-${String(int(1, 9)).padStart(2, '0')}-01`, endDate: `2026-${String(int(1, 6)).padStart(2, '0')}-28` })),
    certifications: shuffled(t.certs).slice(0, int(0, 2)).map(([name, issuingOrg]) => ({ name, issuingOrg, issueDate: `2026-0${int(1, 8)}-15` })),
    experience: rnd() < 0.55 ? [{ ...(([company, role]) => ({ company, role }))(pick(t.interns)), type: 'internship', startDate: '2026-05-15', endDate: '2026-07-15', description: 'Summer internship with a project demo to the team lead.', isCurrent: false }] : [],
    placementPreferences: { isOptedIn: true, preferredRoles: shuffled(t.roles).slice(0, 2), preferredLocations: shuffled(['Thiruvananthapuram', 'Kochi', 'Bengaluru', 'Chennai', 'Hyderabad']).slice(0, 2), expectedCTC: pick([450000, 500000, 600000, 700000, 800000]), willingToRelocate: rnd() < 0.7 },
  };
  try {
    await owner.call('GET', `/career-connect/student-profiles/${id}`, undefined, B);
    await owner.call('PUT', `/career-connect/student-profiles/${id}`, body, B);
    cs.careerProfiles[id] = true;
    if (++done % 100 === 0) {
      saveState(org.key, st);
      log(`    ${done}/${todo.length}`);
    }
  } catch (e) {
    log('   skip', id, e.message.slice(0, 120));
  }
});
saveState(org.key, st);
log(`phase 21 done: ${done} career profiles`);

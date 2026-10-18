/**
 * Demo platform, phase 22: a living alumni network and job board for one
 * organisation — graduated batches (2014–2025) with photos and careers,
 * mentorships with final-year students, alumni referrals, alumni events and
 * live job postings with applications. Direct writes (these flows are tied to
 * the signed-in alumnus/student), scoped to one tenant; safe to re-run.
 *
 * Run (from apps/api): npx tsx src/scripts/demo-platform/22-alumni-network.ts <tenantId>
 */
import 'dotenv/config';
import { ObjectId, type Document } from 'mongodb';
import { connectDatabase, closeDatabase, collections } from '../../config/database';

let seed = 22;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const pick = <T>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
const shuffled = <T>(xs: T[]) => [...xs].sort(() => rnd() - 0.5);
const day = 86_400_000;
const at = (y: number, m: number, d = 1) => new Date(Date.UTC(y, m - 1, d));

const MEN = [4, 5, 7, 9, 11, 12, 20, 26, 30, 35, 37, 38, 39, 41, 45, 47, 48, 50, 56, 58, 65, 67, 73, 77, 85];
const WOMEN = [1, 2, 8, 12, 13, 15, 19, 22, 26, 28, 29, 40, 42, 46, 53, 56, 61, 63, 70, 75, 76, 78];
const photo = (f: boolean, i: number) =>
  `https://randomuser.me/api/portraits/${f ? 'women' : 'men'}/${(f ? WOMEN : MEN)[(i * 7 + 3) % (f ? WOMEN : MEN).length]}.jpg`;

// name, female, programme, grad year, [company, role, city] now, earlier roles, higher study
type A = [string, boolean, string, number, [string, string, string], [string, string][], [string, string, string]?];
const CSE = 'Computer Science & Engineering · B.Tech Computer Science & Engineering';
const ECE = 'Electronics & Communication Engineering · B.Tech Electronics & Communication Engineering';
const MECH = 'Mechanical Engineering · B.Tech Mechanical Engineering';
const CIVIL = 'Civil Engineering · B.Tech Civil Engineering';
const MBA = 'Computer Applications · Integrated Master of Computer Applications (MCA)';
const ALUMNI: A[] = [
  ['Arjun Menon', false, CSE, 2016, ['Google', 'Senior Software Engineer', 'Bengaluru'], [['Flipkart', 'Software Engineer'], ['Infosys', 'Systems Engineer']]],
  ['Neha Thomas', true, CSE, 2018, ['Microsoft', 'Software Engineer II', 'Hyderabad'], [['Zoho', 'Member Technical Staff']]],
  ['Rahul Krishnan', false, CSE, 2015, ['Amazon', 'Engineering Manager', 'Bengaluru'], [['Amazon', 'SDE II'], ['TCS', 'Developer']], ['IIM Kozhikode', 'Executive PGP', 'Management']],
  ['Aswathy Nair', true, CSE, 2019, ['Freshworks', 'Product Manager', 'Chennai'], [['Freshworks', 'Software Engineer']], ['IIM Bangalore', 'MBA', 'Business Administration']],
  ['Vishnu Prasad', false, CSE, 2020, ['Zoho', 'Member Technical Staff', 'Chennai'], [['Zoho', 'Intern']]],
  ['Fathima Rasheed', true, CSE, 2017, ['IBM', 'Data Scientist', 'Kochi'], [['UST Global', 'Data Analyst']], ['IIT Madras', 'M.Tech', 'Data Science']],
  ['Sreejith Pillai', false, CSE, 2014, ['UST Global', 'Delivery Head', 'Thiruvananthapuram'], [['UST Global', 'Project Manager'], ['Wipro', 'Software Engineer']]],
  ['Gayathri Varma', true, CSE, 2021, ['Atlassian', 'Software Engineer', 'Bengaluru'], [['Infosys', 'Systems Engineer']]],
  ['Midhun Joseph', false, CSE, 2022, ['Razorpay', 'Backend Engineer', 'Bengaluru'], []],
  ['Anjali Suresh', true, CSE, 2023, ['TCS', 'Digital Engineer', 'Kochi'], []],
  ['Abhishek Nambiar', false, CSE, 2018, ['Swiggy', 'Senior Data Engineer', 'Bengaluru'], [['Accenture', 'Associate Software Engineer']]],
  ['Reshma Kurian', true, CSE, 2016, ['Deloitte', 'Manager — Technology Consulting', 'Bengaluru'], [['Deloitte', 'Consultant']], ['University of Edinburgh', 'MSc', 'Computer Science']],
  ['Adarsh Rajeev', false, ECE, 2017, ['Qualcomm', 'Senior Engineer — Modem', 'Hyderabad'], [['Tata Elxsi', 'Embedded Engineer']]],
  ['Lakshmi Menon', true, ECE, 2019, ['Texas Instruments', 'Analog Design Engineer', 'Bengaluru'], [], ['IISc Bengaluru', 'M.Tech', 'Electronic Systems']],
  ['Nikhil Varghese', false, ECE, 2020, ['Bosch India', 'Embedded Software Engineer', 'Bengaluru'], []],
  ['Divya Mohan', true, ECE, 2015, ['ISRO — VSSC', 'Scientist / Engineer SD', 'Thiruvananthapuram'], [['ISRO — VSSC', 'Scientist / Engineer SC']]],
  ['Jithin George', false, ECE, 2021, ['Tata Elxsi', 'Engineer — Automotive', 'Thiruvananthapuram'], []],
  ['Akhil Shaji', false, MECH, 2016, ['Tata Motors', 'Senior Manager — Product Design', 'Pune'], [['Ashok Leyland', 'Design Engineer']]],
  ['Sneha Babu', true, MECH, 2018, ['L&T', 'Project Engineer', 'Chennai'], []],
  ['Manu Mathew', false, MECH, 2014, ['Cochin Shipyard', 'Deputy General Manager', 'Kochi'], [['Cochin Shipyard', 'Manager']]],
  ['Ajay Unnikrishnan', false, MECH, 2022, ['Mahindra & Mahindra', 'Graduate Engineer', 'Chennai'], []],
  ['Athira Gopan', true, CIVIL, 2017, ['L&T Construction', 'Planning Manager', 'Mumbai'], [['Sobha Ltd', 'Site Engineer']]],
  ['Ebin Thomas', false, CIVIL, 2019, ['AECOM', 'Structural Engineer', 'Bengaluru'], [], ['NIT Calicut', 'M.Tech', 'Structural Engineering']],
  ['Ananya Raj', true, CIVIL, 2021, ['Kerala PWD', 'Assistant Engineer', 'Thiruvananthapuram'], []],
  ['Sanjay Iyer', false, MBA, 2015, ['HDFC Bank', 'Vice President — Retail', 'Mumbai'], [['ICICI Bank', 'Relationship Manager']]],
  ['Meera Krishnakumar', true, MBA, 2018, ['EY', 'Senior Consultant', 'Kochi'], [['KPMG', 'Analyst']]],
  ['Rohit Das', false, MBA, 2020, ['Federal Bank', 'Manager — Credit', 'Kochi'], []],
  ['Parvathy Sunil', true, MBA, 2022, ['Deloitte', 'Business Analyst', 'Hyderabad'], []],
  ['Kiran Joy', false, CSE, 2024, ['Infosys', 'Systems Engineer', 'Mysuru'], []],
  ['Aiswarya Biju', true, CSE, 2025, ['Zoho', 'Member Technical Staff', 'Chennai'], []],
  ['Hari Shankar', false, ECE, 2024, ['Wipro', 'Project Engineer', 'Bengaluru'], []],
  ['Nimisha Ravi', true, CSE, 2023, ['IIT Bombay', 'PhD Scholar — AI', 'Mumbai'], [], ['IIT Bombay', 'PhD', 'Computer Science']],
];

const EXPERTISE: Record<string, string[]> = {
  [CSE]: ['System design', 'Interview prep', 'DSA', 'Product thinking', 'Open source', 'Higher studies abroad'],
  [ECE]: ['VLSI careers', 'Embedded systems', 'GATE & PSU prep', 'Research careers'],
  [MECH]: ['Core engineering jobs', 'Design tools', 'Manufacturing careers'],
  [CIVIL]: ['Site to planning roles', 'Government exams', 'Structural design'],
  [MBA]: ['Banking & fintech careers', 'Consulting cases', 'Analytics roles'],
};

(async () => {
  const id = process.argv[2];
  if (!id || !ObjectId.isValid(id)) throw new Error('Pass the tenant id');
  await connectDatabase();
  const tenantId = new ObjectId(id);
  const branch = await collections.branches.findOne({ tenantId });
  if (!branch) throw new Error('No branch');
  const branchId = branch._id;
  const owner = await collections.users.findOne({ tenantId, email: /^owner@/ });
  const now = new Date();

  // ── 1. Graduated alumni: student record + alumni profile ───────────────
  const companies = await collections.placementCompanies.find({ tenantId }).project({ name: 1 }).toArray();
  const companyId = (n: string) => companies.find((c) => c.name === n)?._id ?? null;
  let fi = 0, mi = 0, made = 0;
  for (const [k, [name, female, cls, year, [company, role, city], past, study]] of ALUMNI.entries()) {
    const [firstName, ...rest] = name.split(' ');
    const admissionNumber = `MEDC-ALU${year}-${String(k + 1).padStart(3, '0')}`;
    const email = `${name.toLowerCase().replace(/[^a-z]+/g, '.')}.${year % 100}@alumni.marianeducity.org`;
    const student = {
      tenantId, branchId, admissionNumber, rollNumber: String(int(1, 60)),
      firstName, lastName: rest.join(' '), displayName: name,
      gender: female ? 'female' : 'male', nationality: 'Indian',
      contact: { email, phone: `9${int(100000000, 999999999)}`, address: { current: { city, state: '', country: 'India' } } },
      admissionDate: at(year - 4, 7, 15), admissionType: 'new',
      currentEnrollment: { className: `${cls} · Class of ${year}`, sectionName: pick(['A', 'B']) },
      status: 'alumni',
      statusHistory: [{ status: 'alumni', date: at(year, 6, 30), reason: `Graduated — batch of ${year}` }],
      photo: photo(female, female ? fi++ : mi++),
      academicSummary: { cgpa: Math.round((6.8 + rnd() * 2.8) * 100) / 100, backlogs: [] },
      createdBy: owner?._id, createdAt: now, updatedAt: now,
    };
    const s = await collections.students.findOneAndUpdate(
      { tenantId, admissionNumber },
      { $set: student },
      { upsert: true, returnDocument: 'after' }
    );
    const yearsIn = 2026 - year;
    let cursor = at(year, 7, 1);
    const history = [...past].reverse().map(([c, r]) => {
      const span = Math.max(1, Math.floor(yearsIn / (past.length + 1)));
      const h = { company: c, role: r, startDate: cursor, endDate: at(cursor.getUTCFullYear() + span, int(1, 12)), isCurrent: false };
      cursor = h.endDate;
      return h;
    });
    history.push({ company, role, startDate: cursor, endDate: undefined as unknown as Date, isCurrent: true });
    const mentor = yearsIn >= 3 && k % 3 !== 2;
    const profile = {
      tenantId, branchId, studentId: s!._id, studentName: name, graduationYear: year,
      currentCompany: company, currentRole: role, location: city,
      companyId: companyId(company),
      email, linkedInUrl: `https://www.linkedin.com/in/${name.toLowerCase().replace(/[^a-z]+/g, '-')}-${year % 100}`,
      bio: `${role} at ${company}. ${cls.split(' · ')[1]}, class of ${year}. Happy to help juniors with ${(EXPERTISE[cls] ?? [])[0]?.toLowerCase() ?? 'careers'}.`,
      careerHistory: history.reverse(),
      higherEducation: study ? [{ institution: study[0], degree: study[1], field: study[2], startYear: year + 1, endYear: study[1] === 'PhD' ? undefined : year + 3 }] : [],
      skills: shuffled(EXPERTISE[cls] ?? []).slice(0, 3),
      achievements: k % 4 === 0 ? [pick(['Spot award, 2024', 'Speaker at PyCon India', 'Patent filed, 2023', 'Best Outgoing Student'])] : [],
      mentorshipInfo: { willingToMentor: mentor, expertise: shuffled(EXPERTISE[cls] ?? []).slice(0, 3), maxMentees: mentor ? int(2, 4) : undefined },
      willingToReferStudents: k % 2 === 0,
      isVerified: k % 5 !== 4, verifiedBy: k % 5 !== 4 ? owner?._id : null, verifiedAt: k % 5 !== 4 ? at(2026, int(1, 9), int(1, 28)) : null,
      updatedAt: now,
    };
    await collections.alumniProfiles.updateOne(
      { tenantId, studentId: s!._id },
      { $set: profile, $setOnInsert: { createdAt: now } },
      { upsert: true }
    );
    made++;
  }
  // The batch-of-2026 alumni from earlier phases: give them a career line too
  for (const a of await collections.alumniProfiles.find({ tenantId, graduationYear: 2026 }).toArray()) {
    if (a.careerHistory?.length || !a.currentCompany) continue;
    await collections.alumniProfiles.updateOne({ _id: a._id }, {
      $set: {
        careerHistory: [{ company: a.currentCompany, role: a.currentRole, startDate: at(2026, 7, 1), isCurrent: true }],
        bio: `${a.currentRole} at ${a.currentCompany}. Batch of 2026.`,
      },
    });
  }
  const alumni = await collections.alumniProfiles.find({ tenantId, branchId }).toArray();
  const mentors = alumni.filter((a) => a.mentorshipInfo?.willingToMentor);

  // ── 2. Final-year students to connect with ─────────────────────────────
  const finalYears = await collections.students
    .find({ tenantId, status: 'active', 'currentEnrollment.className': /Year 4$/ })
    .project({ displayName: 1, firstName: 1, lastName: 1, userId: 1, currentEnrollment: 1 })
    .toArray();
  const pool = shuffled(finalYears);
  const nameOf = (s: Document) => s.displayName || `${s.firstName} ${s.lastName}`;

  // ── 3. Mentorships ─────────────────────────────────────────────────────
  await collections.mentorshipPrograms.deleteMany({ tenantId, seeded: 22 });
  const GOALS = ['Crack product-company interviews', 'Build a portfolio project', 'Prepare for GATE', 'Choose between job and MS', 'Improve system design', 'Land a summer internship', 'Prepare a strong résumé'];
  const AREA: Record<string, string> = { one_on_one: 'Career guidance', group: 'Interview preparation circle', project_based: 'Capstone project mentoring' };
  let p = 0;
  const mentorships: Document[] = [];
  for (const m of mentors) {
    const n = Math.min(m.mentorshipInfo?.maxMentees ?? 2, int(1, 3));
    for (let j = 0; j < n && p < pool.length; j++) {
      const s = pool[p++];
      const type = pick(['one_on_one', 'one_on_one', 'group', 'project_based']);
      const status = pick(['active', 'active', 'active', 'completed', 'requested']);
      const start = new Date(now.getTime() - int(20, 150) * day);
      const sessions = status === 'requested' ? [] : Array.from({ length: int(2, 6) }, (_, i) => ({
        _id: new ObjectId(),
        date: new Date(start.getTime() + (i + 1) * int(9, 16) * day),
        duration: pick([30, 45, 60]),
        notes: pick([
          'Walked through two mock DSA rounds; work on edge cases.',
          'Reviewed résumé — tightened project bullets with numbers.',
          'Discussed offer comparison and growth paths.',
          'System design basics: load balancers, caching, queues.',
          'Shortlisted three target companies and referral plan.',
          'GATE strategy — topic weightage and test series.',
        ]),
        conductedBy: m._id,
        conductedAt: new Date(start.getTime() + (i + 1) * 12 * day),
      })).filter((x) => x.date < now);
      mentorships.push({
        tenantId, branchId, mentorAlumniId: m._id, menteeStudentId: s._id,
        mentorName: m.studentName, menteeName: nameOf(s),
        areaOfGuidance: `${AREA[type]} — ${pick(m.mentorshipInfo?.expertise ?? ['Careers'])}`,
        programType: type, goals: shuffled(GOALS).slice(0, int(2, 3)),
        status, sessions,
        startDate: status === 'requested' ? null : start,
        endDate: status === 'completed' ? new Date(start.getTime() + 90 * day) : null,
        ...(status === 'completed' && { feedback: { mentorRating: int(4, 5), menteeRating: int(4, 5), comments: 'Clear, practical guidance every session.' } }),
        seeded: 22, createdAt: new Date(start.getTime() - 5 * day), updatedAt: now,
      });
    }
  }
  if (mentorships.length) await collections.mentorshipPrograms.insertMany(mentorships);

  // ── 4. Referrals ───────────────────────────────────────────────────────
  await collections.alumniReferrals.deleteMany({ tenantId, seeded: 22 });
  const referrers = alumni.filter((a) => a.willingToReferStudents && a.graduationYear < 2024);
  const ROLE: Record<string, string> = { Google: 'Software Engineer, University Graduate', Microsoft: 'Software Engineer', Amazon: 'SDE I — New Grad', Atlassian: 'Graduate Software Engineer', Freshworks: 'Associate Product Manager', Qualcomm: 'Associate Engineer — Hardware', 'Texas Instruments': 'Analog Design Intern' };
  const deptOf = new Map(ALUMNI.map((x) => [x[0], x[2]]));
  const DEPT_ROLE: Record<string, string> = {
    [CSE]: 'Software Engineer — New Grad',
    [ECE]: 'Associate Engineer — Hardware',
    [MECH]: 'Graduate Engineer Trainee',
    [CIVIL]: 'Graduate Engineer Trainee — Projects',
    [MBA]: 'Business Analyst',
  };
  const referrals = referrers.slice(0, 12).map((a, i) => {
    const status = i < 7 ? 'open' : i < 10 ? 'in_progress' : 'closed';
    const referred = shuffled(finalYears).slice(0, status === 'open' ? int(0, 3) : int(2, 5)).map((s) => ({
      studentId: s._id, studentName: nameOf(s),
      status: pick(['referred', 'referred', 'interviewing', 'hired', 'rejected']),
      referredAt: new Date(now.getTime() - int(2, 40) * day),
    }));
    return {
      tenantId, branchId, alumniId: a._id, alumniName: a.studentName,
      companyName: a.currentCompany, roleTitle: ROLE[a.currentCompany] ?? DEPT_ROLE[deptOf.get(a.studentName) ?? CSE] ?? 'Graduate Trainee',
      jobType: i % 4 === 3 ? 'internship' : 'job',
      description: `My team at ${a.currentCompany} is hiring. Share your résumé and a line on your strongest project — I'll refer the best fits directly.`,
      applicationDeadline: new Date(now.getTime() + int(-10, 40) * day),
      status, studentsReferred: referred, createdBy: owner?._id, seeded: 22,
      createdAt: new Date(now.getTime() - int(5, 60) * day), updatedAt: now,
    };
  });
  if (referrals.length) await collections.alumniReferrals.insertMany(referrals);

  // ── 5. Events ──────────────────────────────────────────────────────────
  await collections.alumniEvents.deleteMany({ tenantId, seeded: 22 });
  const sp = (n: string) => {
    const a = alumni.find((x) => x.studentName === n)!;
    return { name: n, designation: a.currentRole, company: a.currentCompany, alumniId: a._id };
  };
  const reg = (n: number) => shuffled(finalYears).slice(0, n).map((s) => ({
    userId: s.userId ?? s._id, studentId: s._id, userName: nameOf(s), registeredAt: new Date(now.getTime() - int(1, 20) * day),
  }));
  const EVENTS = [
    ['From campus to Google: the interview loop, demystified', 'guest_lecture', 9, 'Seminar Hall 2', false, ['Arjun Menon'], 240, 'published', 160],
    ['Embedded careers fireside — Qualcomm, TI & Bosch', 'networking', 16, 'ECE Block Auditorium', false, ['Adarsh Rajeev', 'Lakshmi Menon', 'Nikhil Varghese'], 180, 'published', 92],
    ['Product management bootcamp', 'workshop', 23, '', true, ['Aswathy Nair'], 120, 'published', 118],
    ['Banking & consulting careers panel', 'networking', 30, 'MBA Block, Room 101', false, ['Sanjay Iyer', 'Meera Krishnakumar'], 150, 'published', 74],
    ['Marian Career Fair 2026', 'career_fair', 44, 'Main Ground Pavilion', false, [], 1200, 'published', 0],
    ['Alumni Homecoming — Class of 2016', 'reunion', 62, 'Main Auditorium', false, ['Reshma Kurian', 'Akhil Shaji'], 400, 'published', 0],
    ['Life at ISRO — a scientist’s journey', 'guest_lecture', -12, 'Main Auditorium', false, ['Divya Mohan'], 300, 'completed', 268],
    ['Resume clinic with alumni recruiters', 'workshop', -26, 'Library Seminar Room', false, ['Reshma Kurian', 'Meera Krishnakumar'], 80, 'completed', 80],
    ['Data science in production — IBM', 'guest_lecture', -41, '', true, ['Fathima Rasheed'], 200, 'completed', 176],
  ] as const;
  const studentPool = finalYears.length;
  await collections.alumniEvents.insertMany(EVENTS.map(([title, type, d, venue, virtual, speakers, cap, status, regs], i) => ({
    tenantId, branchId, title, type,
    description: {
      guest_lecture: 'An hour with one of our own — the real path, the setbacks and what they would do differently. Open Q&A after.',
      networking: 'Small-table conversations with alumni working in the field. Bring questions; résumés welcome.',
      workshop: 'Hands-on, limited seats. Work on your own material with alumni giving live feedback.',
      career_fair: 'Recruiters from 40+ companies, on-the-spot shortlisting and alumni help desks for every department.',
      reunion: 'Ten years on — batchmates, faculty and a walk through the new campus. Families welcome.',
    }[type],
    eventDate: new Date(at(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate()).getTime() + d * day + (type === 'career_fair' ? 4 : 10) * 3600_000),
    endDate: new Date(at(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate()).getTime() + d * day + (type === 'career_fair' ? 11.5 : 12) * 3600_000),
    venue: virtual ? '' : venue, isVirtual: virtual, virtualLink: virtual ? 'https://meet.google.com/' : undefined,
    speakers: speakers.map(sp), maxCapacity: cap, status,
    registrations: reg(Math.min(regs, studentPool)),
    eventNumber: `ALU26${String(i + 10).padStart(5, '0')}`,
    createdBy: owner?._id, seeded: 22, createdAt: new Date(now.getTime() - 30 * day), updatedAt: now,
  })));
  await collections.alumniEvents.deleteMany({ tenantId, title: 'Alumni Homecoming 2026', seeded: { $exists: false } });

  // ── 6. Job board: live postings + applications ─────────────────────────
  const JOBS = [
    ['Software Development Engineer I', 'Amazon', 'job', 'Bengaluru', 'hybrid', 1800000, 2400000, 7.5, ['DSA', 'Any OOP language', 'CGPA 7.5+']],
    ['Associate Consultant — Technology', 'Deloitte', 'job', 'Hyderabad', 'hybrid', 700000, 850000, 6.5, ['Analytical thinking', 'SQL basics', 'Strong communication']],
    ['Embedded Software Intern', 'Bosch India', 'internship', 'Bengaluru', 'onsite', 0, 0, 7, ['Embedded C', 'Microcontrollers', 'ECE / EEE']],
    ['Data Analyst — Graduate', 'Federal Bank', 'job', 'Kochi', 'onsite', 600000, 750000, 6.5, ['Excel & SQL', 'Power BI', 'Statistics']],
    ['Graduate Engineer Trainee — Projects', 'L&T Construction', 'job', 'Chennai', 'onsite', 550000, 650000, 6.5, ['Civil / Mechanical', 'Site readiness', 'AutoCAD']],
    ['Product Design Intern', 'Freshworks', 'internship', 'Chennai', 'hybrid', 0, 0, 7, ['Figma', 'Portfolio', 'User research basics']],
    ['Systems Engineer', 'Infosys', 'job', 'Mysuru', 'onsite', 360000, 450000, 6, ['Any graduate', 'Logical reasoning']],
    ['Member Technical Staff', 'Zoho', 'job', 'Chennai', 'onsite', 800000, 1000000, 7, ['Strong fundamentals', 'Java or C++']],
  ] as const;
  for (const [i, [title, company, type, location, workMode, min, max, cgpa, reqs]] of JOBS.entries()) {
    await collections.jobPostings.updateOne(
      { tenantId, title, companyName: company },
      {
        $set: {
          tenantId, branchId, title, companyName: company, companyId: companyId(company), type, location, workMode,
          description: `${title} at ${company}, ${location}. Open to final-year students${type === 'internship' ? ' for a six-month internship with a pre-placement offer route' : ''}. Training provided.`,
          requirements: reqs, eligibility: { minCGPA: cgpa },
          ...(type === 'job' ? { salary: { min, max } } : { stipend: { amount: pick([25000, 30000, 40000]), duration: '6 months' } }),
          applicationDeadline: new Date(now.getTime() + int(6, 35) * day),
          status: 'active', updatedAt: now,
        },
        $setOnInsert: { postingNumber: `JOB26${String(100 + i).padStart(5, '0')}`, createdBy: owner?._id, createdAt: new Date(now.getTime() - int(4, 20) * day) },
      },
      { upsert: true }
    );
  }
  await collections.jobPostings.updateMany({ tenantId, status: 'draft' }, { $set: { status: 'active', updatedAt: now } });
  const postings = await collections.jobPostings.find({ tenantId, status: 'active' }).toArray();
  await collections.jobApplications.deleteMany({ tenantId, seeded: 22 });
  const COVER = [
    'I built a placement-tracker app used by my department and would love to bring that ownership to your team.',
    'My final-year project on this exact problem space taught me a lot — happy to walk you through it.',
    'I interned last summer and am looking for a full-time role where I can keep learning fast.',
  ];
  const apps: Document[] = [];
  for (const post of postings) {
    for (const s of shuffled(finalYears).slice(0, int(14, 48))) {
      const appliedAt = new Date(now.getTime() - int(0, 14) * day - int(0, 20) * 3600_000);
      const status = pick(['applied', 'applied', 'applied', 'shortlisted', 'shortlisted', 'interview', 'rejected', 'selected']);
      apps.push({
        tenantId, branchId, studentId: s._id, studentName: nameOf(s), jobPostingId: post._id,
        jobTitle: post.title, companyName: post.companyName, coverLetter: pick(COVER), status,
        appliedAt, seeded: 22, createdAt: appliedAt, updatedAt: now,
      });
    }
  }
  if (apps.length) await collections.jobApplications.insertMany(apps);
  for (const post of postings)
    await collections.jobPostings.updateOne({ _id: post._id }, { $set: { applicationCount: apps.filter((a) => a.jobPostingId.equals(post._id)).length } });

  console.log(`alumni ${made} (+ ${alumni.length - made} existing) · mentorships ${mentorships.length} · referrals ${referrals.length} · events ${EVENTS.length} · jobs ${postings.length} · applications ${apps.length}`);
  await closeDatabase();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

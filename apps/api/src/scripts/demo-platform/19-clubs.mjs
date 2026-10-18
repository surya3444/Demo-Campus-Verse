// Phase 19 — campus clubs with coordinators, student leads and members,
// created by the owner through the Clubs API. Marian EduCity's list mirrors
// what Kerala campuses actually run (IEEE SB, TinkerHub, IEDC, NSS, NCC,
// Bhoomithrasena, Red Ribbon Club, NASA for architecture…).
import { session, loadState, saveState, log, pick, rnd } from './lib.mjs';
import { ORGS } from './spec.mjs';

const only = process.argv[2] ?? 'marian';

// [name, category, emoji, theme, institution code | null, members, tagline, meeting, tags, highlights, description]
const CLUBS = [
  ['IEEE Student Branch', 'technical', '⚡', 'ocean', 'MEC', 120, 'Advancing technology for humanity — workshops, paper presentations and IEEE Day.', ['Every Wednesday', '4:00 PM', 'Seminar Hall, EC Block'], ['ieee', 'electronics', 'research'], ['Best Student Branch nominee, IEEE Kerala Section 2026', '48 hours of hands-on workshops this semester'], 'The IEEE Student Branch connects students with the world’s largest technical professional body: expert talks, IEEE Xtreme coding marathons, paper-writing clinics and industry visits.'],
  ['TinkerHub Campus Community', 'technical', '🛠️', 'forest', null, 95, 'Learn by building — maker sessions, open-source sprints and weekend hackathons.', ['Every Friday', '5:00 PM', 'Innovation Lab'], ['opensource', 'makers', 'hackathons'], ['Hosted a 24-hour Build-a-thon with 140 participants', '12 open-source contributions merged this term'], 'A peer-learning community where anyone can walk in with an idea and walk out with something that works.'],
  ['IEDC — Innovation & Entrepreneurship Development Centre', 'professional', '💡', 'gold', null, 80, 'Turn ideas into startups with Kerala Startup Mission mentoring and pre-incubation.', ['Every Thursday', '3:30 PM', 'IEDC Studio'], ['startups', 'ksum', 'innovation'], ['3 student startups pre-incubated with KSUM', 'Idea Fest 2026 — 64 teams pitched'], 'Supported by Kerala Startup Mission, IEDC runs idea pitches, prototyping grants and founder meet-ups for students across every institution on campus.'],
  ['Robotics Club', 'technical', '🤖', 'midnight', 'MEC', 70, 'Build, code and race robots — from line followers to autonomous drones.', ['Tuesday & Friday', '4:30 PM', 'Robotics Lab, ME Block'], ['robotics', 'iot', 'drones'], ['Finalists, e-Yantra Robotics Competition 2026', 'Built the campus’s first autonomous delivery rover'], 'Hands-on robotics for every branch: embedded C, sensors, ROS and plenty of trial and error.'],
  ['Google Developer Student Club', 'technical', '💻', 'aurora', 'MEC', 110, 'Learn Google technologies and build solutions for local problems.', ['Every Monday', '4:00 PM', 'CSE Lab 3'], ['android', 'cloud', 'ai'], ['Solution Challenge 2026 — Top 100 globally', 'Study jams on Gen AI, Flutter and Cloud'], 'Peer-to-peer learning on Android, Flutter, Cloud and AI, with study jams and the annual Solution Challenge.'],
  ['NSS Unit', 'social', '🤝', 'ember', null, 150, 'Not me, but you — village adoption, blood drives and coastal clean-ups.', ['Every Saturday', '9:00 AM', 'NSS Office'], ['nss', 'volunteering', 'community'], ['Adopted Menamkulam fishing village', '1,200 units of blood donated in 2025-26'], 'The National Service Scheme unit runs a seven-day annual camp, weekly community work and disaster-relief volunteering.'],
  ['NCC Unit', 'social', '🎖️', 'forest', null, 90, 'Unity and discipline — drill, camps and adventure training.', ['Tue & Sat', '7:00 AM', 'Parade Ground'], ['ncc', 'leadership', 'fitness'], ['2 cadets selected for Republic Day Camp, New Delhi', 'C-certificate pass rate 96%'], 'National Cadet Corps training with the Kerala battalion: parade, shooting, trekking and national camps.'],
  ['Bhoomithrasena Club', 'wellness', '🌱', 'forest', 'MCAS', 60, 'Kerala’s green army — tree planting, waste audits and a plastic-free campus.', ['Every Wednesday', '3:30 PM', 'Botany Garden'], ['environment', 'sustainability'], ['Planted 1,500 saplings along Kazhakuttam corridor', 'Campus declared green-protocol compliant'], 'Supported by Kerala’s Department of Environment, the club leads the campus green protocol, mangrove walks and eco-audits.'],
  ['Red Ribbon Club', 'social', '🎗️', 'berry', null, 55, 'Health awareness, HIV/AIDS education and voluntary blood donation.', ['First Monday', '3:30 PM', 'Seminar Hall 1'], ['health', 'awareness'], ['World AIDS Day campus rally — 800 participants'], 'Run with the Kerala State AIDS Control Society: awareness campaigns, peer education and blood-donor registries.'],
  ['NASA Unit — Architecture', 'arts', '🏛️', 'gold', 'MCAP', 70, 'National Association of Students of Architecture — trophies, design charrettes and conventions.', ['Every Thursday', '4:00 PM', 'Studio 4, Architecture Block'], ['architecture', 'design', 'nasa'], ['Citation, Louis I. Kahn Trophy 2026', 'Delegation of 40 to the NASA Annual Convention'], 'Marian’s NASA India unit prepares entries for national trophies and hosts zonal design charrettes.'],
  ['Design Collective', 'arts', '🎨', 'sunset', 'MSD', 50, 'Where designers critique, collaborate and ship real briefs.', ['Every Friday', '3:00 PM', 'Design Studio'], ['ux', 'branding', 'portfolio'], ['Rebranded 3 local NGOs pro bono', 'Kerala Design Week showcase'], 'Open crits, live client briefs and portfolio nights for designers from every discipline.'],
  ['Marian Arts Club', 'cultural', '🎭', 'sunset', null, 140, 'The heartbeat of campus — fests, theatre, music and everything on stage.', ['Every Tuesday', '4:30 PM', 'Main Auditorium'], ['arts', 'festival', 'theatre'], ['Overall runners-up, University Youth Festival 2026', 'Organisers of Marian Utsav — 4,000 footfall'], 'The Arts Club runs the annual Marian Utsav and coaches students for the university youth festival.'],
  ['Marian Beats — Music Club', 'cultural', '🎸', 'berry', null, 85, 'Bands, carnatic ensembles and open mics every month.', ['Every Thursday', '5:00 PM', 'Music Room'], ['music', 'band', 'openmic'], ['Campus band “Kaayal” — 2 original singles released'], 'From classical to indie rock, the music club gives every musician a stage and a band.'],
  ['Step Up Marian — Dance Crew', 'cultural', '💃', 'aurora', null, 70, 'Classical, folk and street — one crew, every style.', ['Mon & Wed', '5:00 PM', 'Dance Studio'], ['dance', 'performance'], ['Winners, Inter-collegiate Group Dance 2026'], 'Bharatanatyam, Mohiniyattam, Thiruvathira and hip-hop under one roof.'],
  ['Lens & Light — Photography Club', 'arts', '📸', 'midnight', null, 65, 'Photo walks, editing labs and the annual campus exhibition.', ['Every Saturday', '6:30 AM', 'Meet at Main Gate'], ['photography', 'editing'], ['Photo walk at Varkala cliffs', 'Exhibition “Monsoon Frames” — 120 prints'], 'Learn composition, light and editing, then show your best work at the annual exhibition.'],
  ['Frames — Film Club', 'arts', '🎬', 'ember', null, 45, 'Screenings, short films and conversations about cinema.', ['Every Friday', '6:00 PM', 'AV Theatre'], ['film', 'cinema', 'shortfilm'], ['Short film “Thira” selected for IDSFFK student section'], 'Weekly screenings of world and Malayalam cinema, plus a short-film workshop each semester.'],
  ['Literary & Debate Society', 'literary', '✍️', 'ocean', 'MCAS', 55, 'Write, argue, persuade — debates, MUNs and the campus magazine.', ['Every Wednesday', '4:00 PM', 'Library Seminar Room'], ['debate', 'mun', 'writing'], ['Best Delegation, Kerala Model UN 2026', 'Campus magazine “Margam” — 4th edition'], 'Parliamentary debates, creative writing circles and the editorial team behind the campus magazine.'],
  ['Quiz Club', 'literary', '🧠', 'aurora', null, 50, 'General, business, tech and sports quizzing — buzzers ready.', ['Every Tuesday', '4:00 PM', 'Seminar Hall 2'], ['quiz', 'trivia'], ['Regional finalists, Tata Crucible Campus Quiz'], 'Weekly quizzes and training for national campus quizzes.'],
  ['Marian Sports Club', 'sports', '⚽', 'forest', null, 160, 'Football, cricket, athletics and more — train, compete, win.', ['Daily', '6:00 AM & 4:30 PM', 'Marian Sports Complex'], ['football', 'cricket', 'athletics'], ['University football champions 2025-26', '6 athletes in the Kerala University team'], 'Coached training for football, cricket, volleyball, basketball and athletics, plus the inter-institution league.'],
  ['Chess Club', 'sports', '♟️', 'midnight', null, 40, 'Rated tournaments, puzzles and simultaneous exhibitions.', ['Every Saturday', '2:00 PM', 'Recreation Hall'], ['chess', 'strategy'], ['Hosted a FIDE-rated open with 180 players'], 'From beginners to rated players — weekly blitz, coaching and tournaments.'],
  ['E-Cell, Marian Business School', 'professional', '🚀', 'gold', 'MBS', 60, 'Founders, funding and B-plans — the MBA startup engine.', ['Every Monday', '5:00 PM', 'MBS Board Room'], ['entrepreneurship', 'bplan'], ['B-Plan winners, IIM Kozhikode Konfluence 2026'], 'Business-plan competitions, founder fireside chats and a mentoring network of alumni entrepreneurs.'],
  ['Finance & Investment Club', 'professional', '📈', 'ocean', 'MBS', 45, 'Markets, valuations and the student-run mock portfolio.', ['Every Thursday', '5:00 PM', 'Bloomberg Lab'], ['finance', 'markets'], ['Mock portfolio beat the Nifty 50 by 6% this year'], 'Equity research, stock pitches and a student-managed paper portfolio.'],
  ['Craft Guild', 'arts', '🧵', 'ember', 'MCACE', 30, 'Coir, bamboo, mural and wood — Kerala’s crafts, kept alive.', ['Every Wednesday', '2:00 PM', 'Craft Centre'], ['crafts', 'heritage'], ['Stall at Kerala Arts & Crafts Village, Kovalam'], 'Master artisans mentor students in traditional Kerala crafts and help them sell their work.'],
  ['Teachers’ Forum', 'literary', '📚', 'forest', 'SJTC', 35, 'Future teachers sharing lesson ideas, micro-teaching and school outreach.', ['Every Friday', '3:00 PM', 'SJTC Hall'], ['education', 'teaching'], ['Adopted 3 government schools for weekend tutoring'], 'Micro-teaching circles, education debates and outreach in nearby schools.'],
  ['Cyber Security Club', 'technical', '🔐', 'midnight', 'MSCA', 40, 'Capture-the-flag, ethical hacking and secure coding.', ['Every Tuesday', '5:00 PM', 'MCA Lab'], ['ctf', 'security'], ['Top 20, Kerala Police Cyberdome CTF 2026'], 'Weekly CTF practice, bug-bounty walkthroughs and talks with Kerala Police Cyberdome.'],
  ['Women Development Cell', 'social', '🌸', 'berry', null, 75, 'Leadership, safety and wellbeing programmes for women on campus.', ['Second Friday', '3:30 PM', 'Seminar Hall 1'], ['women', 'leadership', 'wellbeing'], ['Self-defence training for 400 students'], 'Workshops on leadership, legal rights, health and safety, plus mentoring by women alumni.'],
  ['Malayalam Sahithya Vedi', 'literary', '📜', 'gold', null, 40, 'Poetry, kathaprasangam and Malayalam literature evenings.', ['Every Thursday', '4:00 PM', 'Library Seminar Room'], ['malayalam', 'poetry'], ['Hosted poet Murukan Kattakada for Vayana Dinam'], 'A home for Malayalam writing: poetry readings, book discussions and Vayana Dinam celebrations.'],
];

// Crest icon per club (web app icon set).
const ICON = {"IEEE Student Branch": "zap", "TinkerHub Campus Community": "wrench", "IEDC — Innovation & Entrepreneurship Development Centre": "bulb", "Robotics Club": "bot", "Google Developer Student Club": "code", "NSS Unit": "handshake", "NCC Unit": "medal", "Bhoomithrasena Club": "sprout", "Red Ribbon Club": "ribbon", "NASA Unit — Architecture": "landmark", "Design Collective": "palette", "Marian Arts Club": "drama", "Marian Beats — Music Club": "guitar", "Step Up Marian — Dance Crew": "dancer", "Lens & Light — Photography Club": "camera", "Frames — Film Club": "film", "Literary & Debate Society": "mic", "Quiz Club": "brain", "Marian Sports Club": "trophy", "Chess Club": "crown", "E-Cell, Marian Business School": "rocket", "Finance & Investment Club": "chart", "Craft Guild": "scissors", "Teachers’ Forum": "book", "Cyber Security Club": "lock", "Women Development Cell": "flower", "Malayalam Sahithya Vedi": "scroll"};

const org = ORGS.find((o) => o.key === only);
const st = loadState(org.key);
const cs = st.campuses[org.campuses[0].code];
const B = { branchId: cs.branchId };
const owner = await session(org.owner);
cs.clubs ??= {};

const instIds = new Map(Object.entries(cs.institutions ?? {}).map(([code, i]) => [code, i.id]));
const classInst = new Map(cs.classes.map((k) => [k.key, k.institutionCode]));
const studentsOf = (code) => cs.students.filter((s) => !code || classInst.get(s.classKey) === code);
const teachersOf = (code) => cs.staff.filter((s) => s.role === 'TEACHER' && (!code || s.institutionCode === code));
const sample = (list, n) => {
  const pool = [...list];
  const out = [];
  while (pool.length && out.length < n) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  return out;
};

for (const [name, category, emoji, theme, inst, members, tagline, [day, time, venue], tags, highlights, description] of CLUBS) {
  if (cs.clubs[name]) continue;
  const coord = pick(teachersOf(inst).length ? teachersOf(inst) : teachersOf(null));
  const club = await owner.call(
    'POST',
    '/clubs',
    {
      name, category, emoji, icon: ICON[name], theme, tagline, description, tags, highlights,
      institutionId: inst ? instIds.get(inst) : null,
      coordinatorStaffId: coord.id,
      meeting: { day, time, venue },
    },
    B
  );
  const pool = studentsOf(inst);
  const chosen = sample(pool, Math.min(members, pool.length));
  const leads = chosen.slice(0, 2).map((s) => s.id);
  await owner.call('POST', `/clubs/${club._id}/members`, { studentIds: chosen.slice(2).map((s) => s.id), role: 'member' }, B);
  await owner.call('POST', `/clubs/${club._id}/members`, { studentIds: leads, role: 'lead' }, B);
  cs.clubs[name] = club._id;
  saveState(org.key, st);
  log(`  ${emoji} ${name}: ${chosen.length} members`);
}
log(`phase 19 done: ${Object.keys(cs.clubs).length} clubs`);

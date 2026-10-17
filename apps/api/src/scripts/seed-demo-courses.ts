/**
 * Seeds courses + modules + lessons for the SCHDEMO tenant
 * (Greenfield Public School). Idempotent: refuses to run if the demo
 * courses already exist. Touches nothing outside SCHDEMO.
 *
 * Cleanup:
 *   tsx src/scripts/cleanup-demo-school.ts <tenantId>
 * (the existing cleanup script also covers courses + lessons)
 */

import { Db, MongoClient, ObjectId } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const URI = process.env.MONGODB_URI;
if (!URI) {
  console.error('MONGODB_URI not set');
  process.exit(1);
}

const TENANT_CODE = 'SCHDEMO';

// ─── Lesson + module type definitions ────────────────────────────────────────

type LessonType = 'video' | 'document' | 'live';

interface SeedLesson {
  title: string;
  description?: string;
  type: LessonType;
  duration: number;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  contentUrl?: string;
  contentHtml?: string;
  isPreview?: boolean;
}

interface SeedModule {
  title: string;
  description?: string;
  lessons: SeedLesson[];
}

interface SeedCourse {
  title: string;
  description: string;
  category:
    | 'technical'
    | 'soft_skills'
    | 'aptitude'
    | 'language'
    | 'domain_specific'
    | 'certification_prep'
    | 'career_readiness'
    | 'general';
  level: 'beginner' | 'intermediate' | 'advanced';
  status: 'published' | 'draft';
  instructor?: string;
  modules: SeedModule[];
}

// ─── Reusable rich HTML for document lessons ────────────────────────────────

const docOvercomingFear = `
<h2>Why we feel afraid on stage</h2>
<p>Public speaking anxiety is one of the most common fears in the world — even seasoned speakers feel it.
Your body reads "all eyes on me" as a threat and triggers the same fight-or-flight response it uses for real danger.
The good news? That nervous energy isn't your enemy. It's <strong>fuel</strong>.</p>

<h3>Three quick reframes</h3>
<ul>
  <li><strong>The audience is on your side.</strong> They came to listen, not to judge. Most are silently rooting for you.</li>
  <li><strong>Adrenaline is energy.</strong> Channel it into gestures, voice, and pace instead of trying to suppress it.</li>
  <li><strong>Mistakes vanish in seconds.</strong> A stumble feels huge to you, but the audience forgets it almost immediately.</li>
</ul>

<h3>Try this before your next talk</h3>
<p>Stand tall, plant your feet, and take three slow breaths in through your nose and out through your mouth.
Then walk to the front like you belong there — because you do.</p>

<p>In the next lesson we'll cover <em>body language</em> — what to do with your hands, where to look, and how to use silence on purpose.</p>
`;

const docNouns = `
<h2>Nouns: the words that name things</h2>
<p>A noun is a word that names a person, place, thing, or idea. They're the building blocks of every sentence
you'll ever speak or write.</p>

<h3>The four families of nouns</h3>
<ol>
  <li><strong>Common nouns</strong> name a general thing — <em>teacher, river, book</em>.</li>
  <li><strong>Proper nouns</strong> name a specific one and start with a capital letter — <em>Mrs. Sharma, Ganga, "Wings of Fire"</em>.</li>
  <li><strong>Abstract nouns</strong> name ideas you can't touch — <em>kindness, freedom, time</em>.</li>
  <li><strong>Collective nouns</strong> name a group as a single unit — <em>a flock of birds, a team, a class</em>.</li>
</ol>

<h3>Spot the noun</h3>
<p>Read this sentence and find every noun: <em>"On Tuesday, the entire class watched a documentary about elephants in Kerala."</em></p>
<p>If you found <strong>Tuesday</strong>, <strong>class</strong>, <strong>documentary</strong>, <strong>elephants</strong>, and <strong>Kerala</strong> — perfect.</p>

<h3>Practice</h3>
<p>Write three sentences about your weekend. Underline every noun you used. We'll review them together in class.</p>
`;

const docVariables = `
<h2>What is a variable?</h2>
<p>Imagine you have a labeled box. You can put a number, a word, or anything else in the box, and you can swap
out what's inside whenever you want. The label on the box stays the same — that's the variable's name.</p>

<pre><code>let score = 0;
let playerName = "Aarav";
let isWinning = true;</code></pre>

<h3>Three rules to remember</h3>
<ul>
  <li>Names should describe what's inside — <code>age</code> beats <code>x</code>.</li>
  <li>Names can't have spaces — use <code>firstName</code> or <code>first_name</code>.</li>
  <li>The contents can change, but the name stays the same.</li>
</ul>

<h3>Try it</h3>
<p>Open your code editor and create three variables: your favourite colour, your age, and whether or not you have a pet.
Print them to the console one by one.</p>
`;

const docResume = `
<h2>Building your first resume</h2>
<p>A resume is your story on a single page. The goal is to help a stranger understand who you are, what you can do,
and why they should talk to you next.</p>

<h3>The five sections of a great resume</h3>
<ol>
  <li><strong>Header</strong> — your name, phone number, email, and a single line about who you are.</li>
  <li><strong>Education</strong> — most recent first. Include your school, expected year of completion, and key subjects.</li>
  <li><strong>Achievements</strong> — competitions you placed in, projects you led, or roles like class representative.</li>
  <li><strong>Skills</strong> — things you can demonstrably do (Python, public speaking, design).</li>
  <li><strong>Activities</strong> — sports, clubs, volunteer work — anything that shows initiative.</li>
</ol>

<h3>Write to the reader</h3>
<p>Put yourself in the place of someone who doesn't know you. Would each line make them want to learn more?
If a line could be deleted without losing meaning — delete it.</p>

<p>Keep it to one page. Use the same font everywhere. White space is your friend. We'll review your draft in the next session.</p>
`;

const docDivisibility = `
<h2>Divisibility tests you should memorise</h2>
<p>Most Olympiad number-theory problems become trivial once you can spot divisibility instantly. Memorise these,
practice them daily, and you'll save minutes per question.</p>

<h3>The cheat sheet</h3>
<ul>
  <li><strong>÷ 2:</strong> last digit is even.</li>
  <li><strong>÷ 3:</strong> sum of digits is divisible by 3.</li>
  <li><strong>÷ 4:</strong> last two digits form a number divisible by 4.</li>
  <li><strong>÷ 5:</strong> last digit is 0 or 5.</li>
  <li><strong>÷ 6:</strong> divisible by both 2 and 3.</li>
  <li><strong>÷ 8:</strong> last three digits divisible by 8.</li>
  <li><strong>÷ 9:</strong> sum of digits is divisible by 9.</li>
  <li><strong>÷ 11:</strong> alternating sum of digits is divisible by 11.</li>
</ul>

<h3>Worked example</h3>
<p>Is <strong>71280</strong> divisible by 36?</p>
<p>36 = 4 × 9. Check 4: last two digits are <em>80</em>, divisible by 4 ✓. Check 9: digit sum is 7+1+2+8+0 = 18, divisible by 9 ✓.
So yes — 71280 is divisible by 36.</p>

<h3>Practice set</h3>
<p>For each number, find every divisor between 2 and 12: <strong>1248, 9009, 4400, 81675</strong>.</p>
`;

// ─── Course definitions ──────────────────────────────────────────────────────

const COURSES: SeedCourse[] = [
  {
    title: 'Introduction to Coding for Kids',
    description:
      'A gentle, project-based introduction to programming for students in Grades 6–9. Build a calculator, a simple game, and learn to think like a programmer.',
    category: 'technical',
    level: 'beginner',
    status: 'published',
    instructor: 'Anjali Sharma',
    modules: [
      {
        title: 'Getting Started',
        description: 'Set up your tools and write your very first line of code.',
        lessons: [
          {
            title: 'Welcome to coding',
            description: 'Why coding is the most empowering skill you can learn this decade.',
            type: 'document',
            duration: 4,
            difficulty: 'beginner',
            contentHtml: `<h2>Why learn to code?</h2><p>Code is how you talk to computers — and computers run almost everything around you. Learning to code means you stop being a passive user and start being a creator. Over the next six lessons we'll build small projects together, debug them when they break, and finish with something you can show your friends.</p><h3>What you'll need</h3><ul><li>A laptop or shared school computer</li><li>A free account on the class coding platform (set up next lesson)</li><li>Curiosity, patience, and a willingness to make mistakes</li></ul><p>Mistakes are not failures — they're the fastest way to learn. Every working program in the world started as a broken one.</p>`,
            isPreview: true,
          },
          {
            title: 'What is code, really?',
            description: 'A 10-minute walkthrough of how computers actually run programs.',
            type: 'video',
            duration: 11,
            difficulty: 'beginner',
            contentUrl: 'https://www.youtube.com/watch?v=zOjov-2OZ0E',
            isPreview: true,
          },
          {
            title: 'Variables and labels',
            description: "Computers remember things using 'variables'. Here's how they work.",
            type: 'document',
            duration: 6,
            difficulty: 'beginner',
            contentHtml: docVariables,
          },
        ],
      },
      {
        title: 'Your First Programs',
        description: 'Apply what you learned to build small, real things.',
        lessons: [
          {
            title: 'Loops: doing things over and over',
            description: 'Make the computer repeat tasks for you — without copy-paste.',
            type: 'video',
            duration: 9,
            difficulty: 'beginner',
            contentUrl: 'https://www.youtube.com/watch?v=tKTZoB2Vjuk',
          },
          {
            title: 'Project: build a tip calculator',
            description: 'Put variables and loops together to build something useful.',
            type: 'document',
            duration: 12,
            difficulty: 'beginner',
            contentHtml: `<h2>Project: tip calculator</h2><p>You're going to build a small program that asks for the bill amount and the tip percentage, and tells you exactly how much to pay.</p><h3>Step 1 — Plan</h3><p>Before writing any code, write down the steps in plain English. What does the program ask for first? What does it calculate? What does it print?</p><h3>Step 2 — Code</h3><pre><code>let bill = 1200;
let tipPercent = 10;
let tip = bill * tipPercent / 100;
let total = bill + tip;
console.log("Total:", total);</code></pre><h3>Step 3 — Improve</h3><ul><li>Ask the user for the bill instead of hard-coding it.</li><li>Round the total to two decimal places.</li><li>Add support for splitting the bill across multiple people.</li></ul><p>When you're stuck, talk through your code line by line as if you were the computer. The bug almost always reveals itself.</p>`,
          },
          {
            title: 'Live coding session: Q&A',
            description:
              'Bring your bugs and questions — we debug them together on a shared screen.',
            type: 'live',
            duration: 45,
            difficulty: 'beginner',
            contentUrl: 'https://meet.google.com/abc-defg-hij',
          },
        ],
      },
    ],
  },

  {
    title: 'Public Speaking 101',
    description:
      'Conquer stage fright, design memorable talks, and project your voice with confidence. Designed for students preparing for assemblies, debates, and class presentations.',
    category: 'soft_skills',
    level: 'beginner',
    status: 'published',
    instructor: 'Priya Menon',
    modules: [
      {
        title: 'Foundations',
        description: 'Build the inner game before stepping on the outer stage.',
        lessons: [
          {
            title: 'Overcoming stage fright',
            description: 'Why your body panics — and how to use that energy to your advantage.',
            type: 'document',
            duration: 5,
            difficulty: 'beginner',
            contentHtml: docOvercomingFear,
            isPreview: true,
          },
          {
            title: 'Body language fundamentals',
            description: 'Posture, gestures, and where to put your hands when you speak.',
            type: 'video',
            duration: 14,
            difficulty: 'beginner',
            contentUrl: 'https://www.youtube.com/watch?v=Ks-_Mh1QhMc',
            isPreview: true,
          },
          {
            title: 'Voice modulation: pace, pitch, pause',
            description: "Your voice is an instrument. Here's how to play it.",
            type: 'document',
            duration: 6,
            difficulty: 'beginner',
            contentHtml: `<h2>The three controls of a good voice</h2><p>A flat voice puts an audience to sleep faster than anything else. The fix is three controls you already have — you just need to use them on purpose.</p><h3>Pace</h3><p>Slow down to emphasise. Speed up to build excitement. Most beginners speak too fast — record yourself and listen back. If you can't follow your own words, neither can the audience.</p><h3>Pitch</h3><p>Vary it. A monotone is easy to tune out. Try this: read the same sentence three times, ending high, low, and flat. Notice which feels most engaging.</p><h3>Pause</h3><p>The hardest one. Stop speaking. Count to two in your head. Continue. Pauses make the audience lean in — and give you time to think. Use them after important points, not before.</p>`,
          },
        ],
      },
      {
        title: 'Practice & Feedback',
        description:
          'Real practice with real feedback — the only thing that actually moves the needle.',
        lessons: [
          {
            title: 'Impromptu speaking workshop',
            description: 'Random topics, 90-second speeches, instant peer feedback.',
            type: 'live',
            duration: 60,
            difficulty: 'beginner',
            contentUrl: 'https://meet.google.com/xyz-uvwx-yz',
          },
          {
            title: 'Self-review checklist',
            description: 'After every talk, run through these ten questions.',
            type: 'document',
            duration: 4,
            difficulty: 'beginner',
            contentHtml: `<h2>Run this checklist after every speech</h2><ol><li>Did I open with something the audience cared about?</li><li>Was my main message a single sentence I could say in 10 seconds?</li><li>Did I support it with at least one story or example?</li><li>Did I vary my pace at least three times?</li><li>Did I use any pauses on purpose?</li><li>Did my eyes find at least three different parts of the room?</li><li>Did I avoid filler words (um, like, basically)?</li><li>Did I close with a clear call to action or a memorable line?</li><li>Did I stay within the time limit?</li><li>What's the one thing I'd change next time?</li></ol><p>Don't try to fix everything at once. Pick one item per talk and focus on it.</p>`,
          },
        ],
      },
    ],
  },

  {
    title: 'English Grammar Essentials',
    description:
      'A sharp, no-nonsense walkthrough of the grammar that actually matters in writing and speech. Suitable for Grades 5–8.',
    category: 'language',
    level: 'beginner',
    status: 'published',
    instructor: 'Lakshmi Nair',
    modules: [
      {
        title: 'Parts of Speech',
        description: 'Master the eight building blocks of every English sentence.',
        lessons: [
          {
            title: 'Nouns: the names of things',
            description: 'Common, proper, abstract, and collective — with practice.',
            type: 'document',
            duration: 5,
            difficulty: 'beginner',
            contentHtml: docNouns,
            isPreview: true,
          },
          {
            title: 'Verbs: action and being',
            description: 'The engine of every sentence — without verbs, nothing happens.',
            type: 'document',
            duration: 6,
            difficulty: 'beginner',
            contentHtml: `<h2>Verbs do the work</h2><p>If a sentence is a story, the verb is what happens. <em>"The dog barks."</em> No verb, no story.</p><h3>Two flavours</h3><ul><li><strong>Action verbs</strong> describe doing something — <em>run, write, think, decide</em>.</li><li><strong>Being verbs</strong> describe a state — <em>is, are, was, were, seems, becomes</em>.</li></ul><h3>Tenses, the short version</h3><p>Verbs change shape based on <em>when</em> the action happens — past, present, future. <em>"I walk"</em> (present), <em>"I walked"</em> (past), <em>"I will walk"</em> (future). Learn the irregular ones — <em>go/went/gone, see/saw/seen</em> — by reading widely.</p><h3>Practice</h3><p>Find every verb in this paragraph: <em>"Last Sunday we visited the museum, looked at ancient pottery, and decided that we will return next month."</em> (Hint: there are five.)</p>`,
          },
          {
            title: 'Adjectives & adverbs',
            description: 'Words that paint pictures — when used in moderation.',
            type: 'document',
            duration: 5,
            difficulty: 'beginner',
            contentHtml: `<h2>Words that describe</h2><p>Adjectives describe nouns. Adverbs describe verbs (and sometimes adjectives). Both are spices — useful in small doses, terrible by the spoonful.</p><h3>Adjective examples</h3><p><em>The <strong>red</strong> car. A <strong>brilliant</strong> idea. The <strong>tired</strong> teacher.</em></p><h3>Adverb examples</h3><p><em>She ran <strong>quickly</strong>. He spoke <strong>softly</strong>. They argued <strong>endlessly</strong>.</em></p><h3>The professional secret</h3><p>Strong writers prefer strong nouns and verbs over piling up descriptors. <em>"He walked quickly"</em> is fine — but <em>"He hurried"</em> is sharper. <em>"A very big house"</em> is weak — try <em>"a mansion"</em> instead.</p>`,
          },
        ],
      },
      {
        title: 'Sentence Construction',
        description: 'Put the parts together into clear, correct sentences.',
        lessons: [
          {
            title: 'Subject-verb agreement',
            description:
              "Singular subjects take singular verbs. Plural takes plural. Easy — until it isn't.",
            type: 'video',
            duration: 8,
            difficulty: 'beginner',
            contentUrl: 'https://www.youtube.com/watch?v=zRwKUQRnKOQ',
          },
          {
            title: 'Common mistakes to avoid',
            description: 'The eight grammar errors that show up in every student essay.',
            type: 'document',
            duration: 7,
            difficulty: 'beginner',
            contentHtml: `<h2>The most common mistakes — and the fixes</h2><ol><li><strong>Its vs. it's.</strong> <em>Its</em> = belongs to it. <em>It's</em> = it is. <em>"The dog wagged its tail. It's a happy dog."</em></li><li><strong>Your vs. you're.</strong> <em>Your</em> = belongs to you. <em>You're</em> = you are.</li><li><strong>There vs. their vs. they're.</strong> <em>There</em> = a place. <em>Their</em> = belongs to them. <em>They're</em> = they are.</li><li><strong>Run-on sentences.</strong> When two complete thoughts smash together without punctuation. Split them with a full stop or join with a connector.</li><li><strong>Comma splices.</strong> Like above, but with a comma where a full stop should be.</li><li><strong>Misplaced apostrophes.</strong> Apostrophes show possession or contraction — never plurals. <em>Two cats</em>, not <em>two cat's</em>.</li><li><strong>Dangling modifiers.</strong> <em>"Walking to school, the rain started"</em> — but the rain wasn't walking.</li><li><strong>Mixing up me/I.</strong> <em>"He gave it to John and me"</em> — not <em>"to John and I"</em>. Drop the other person and see which sounds right.</li></ol>`,
          },
        ],
      },
    ],
  },

  {
    title: 'Math Olympiad Prep',
    description:
      'Sharpen the problem-solving skills you need for school olympiads — number theory, geometry, combinatorics. For students in Grades 8–10 with strong fundamentals.',
    category: 'aptitude',
    level: 'intermediate',
    status: 'published',
    instructor: 'Suresh Pillai',
    modules: [
      {
        title: 'Number Theory',
        description: 'The playground of olympiad problems.',
        lessons: [
          {
            title: 'Why number theory matters',
            description: 'A short overview of where olympiad problems usually come from.',
            type: 'document',
            duration: 4,
            difficulty: 'intermediate',
            contentHtml: `<h2>Why number theory matters in olympiads</h2><p>Almost half the problems in any school olympiad reduce to a question about whole numbers — divisibility, primes, modular arithmetic. The kids who do well aren't necessarily the fastest computers; they're the ones who recognise patterns.</p><h3>Three habits to build</h3><ul><li><strong>Always ask "what's the remainder?"</strong> Modular arithmetic unlocks more problems than any other tool.</li><li><strong>Look for primes.</strong> If a number factors strangely, find its prime factorisation first.</li><li><strong>Try small cases.</strong> If you can't see the pattern at <em>n = 100</em>, check <em>n = 1, 2, 3, 4, 5</em> first.</li></ul><p>Over the next two lessons we'll build the muscle to spot divisibility instantly and use modular arithmetic like a pro.</p>`,
            isPreview: true,
          },
          {
            title: 'Divisibility rules deep-dive',
            description: 'Memorise these eight rules and most problems become 30-second sprints.',
            type: 'document',
            duration: 7,
            difficulty: 'intermediate',
            contentHtml: docDivisibility,
          },
          {
            title: 'Modular arithmetic intuition',
            description: 'A 12-minute walkthrough that finally makes "mod" click.',
            type: 'video',
            duration: 12,
            difficulty: 'intermediate',
            contentUrl: 'https://www.youtube.com/watch?v=5OjZWSdxlU0',
          },
        ],
      },
      {
        title: 'Geometry',
        description: 'Triangles, circles, and the constructions you must know cold.',
        lessons: [
          {
            title: 'Triangle inequalities',
            description: 'Three small rules that solve a surprising number of problems.',
            type: 'document',
            duration: 6,
            difficulty: 'intermediate',
            contentHtml: `<h2>Three triangle facts to memorise</h2><ol><li><strong>Triangle inequality:</strong> any side is less than the sum of the other two. If three lengths violate this, they can't form a triangle.</li><li><strong>Angle sum:</strong> the three interior angles always sum to 180°. Always.</li><li><strong>Side-angle correspondence:</strong> the longest side faces the largest angle. The shortest faces the smallest. Use this to translate between geometry and inequalities.</li></ol><h3>Worked problem</h3><p>The sides of a triangle are <em>x</em>, <em>x + 3</em>, and <em>10</em>. What integer values can <em>x</em> take?</p><p>By the triangle inequality:</p><ul><li>x + (x + 3) > 10 → 2x > 7 → x > 3.5</li><li>x + 10 > x + 3 → always true</li><li>(x + 3) + 10 > x → always true</li></ul><p>So x must be at least 4. Combined with the upper limit (each side < sum of others), x can be 4, 5, 6, 7, 8, or 9.</p>`,
          },
          {
            title: 'Circle theorems live walkthrough',
            description:
              'Inscribed angles, power of a point, and tangent properties — with diagrams.',
            type: 'live',
            duration: 75,
            difficulty: 'intermediate',
            contentUrl: 'https://meet.google.com/jkl-mnop-qrs',
          },
        ],
      },
    ],
  },

  {
    title: 'Career Readiness for Class 12',
    description:
      'A six-week program for Class 12 students preparing for college applications, scholarships, and that nerve-wracking first interview.',
    category: 'career_readiness',
    level: 'intermediate',
    status: 'published',
    instructor: 'Neha Reddy',
    modules: [
      {
        title: 'Self-Discovery',
        description: 'Before applying anywhere, know what you actually want.',
        lessons: [
          {
            title: 'Interest mapping exercise',
            description:
              'A 30-minute structured reflection to surface what you genuinely care about.',
            type: 'document',
            duration: 8,
            difficulty: 'intermediate',
            contentHtml: `<h2>Interest mapping — find your direction in 30 minutes</h2><p>Most students pick a stream or college based on what their friends or parents are doing. That's fine — until two years in, when you realise you don't actually enjoy it. This exercise costs you 30 minutes and saves you years.</p><h3>Step 1: list activities (10 min)</h3><p>Open a fresh page. List everything you've done in the last year that you genuinely lost track of time doing. Include schoolwork, hobbies, conversations, video games, books, anything.</p><h3>Step 2: tag each one (10 min)</h3><p>Beside each activity write one or two of these tags: <em>creative, analytical, social, hands-on, helping, leading, learning, building</em>. Don't overthink — go with your gut.</p><h3>Step 3: count and reflect (10 min)</h3><p>Which tags appear most? That's your <strong>interest fingerprint</strong>. Now ask: which careers, courses, or projects align with this pattern? Write down five.</p><p>You'll bring this to next week's parent-counsellor session.</p>`,
            isPreview: true,
          },
          {
            title: 'Career landscape today',
            description: 'A quick survey of what jobs even exist in 2026 — and which are growing.',
            type: 'video',
            duration: 18,
            difficulty: 'intermediate',
            contentUrl: 'https://www.youtube.com/watch?v=oHg5SJYRHA0',
          },
        ],
      },
      {
        title: 'Application Skills',
        description: 'The practical artefacts every applicant needs.',
        lessons: [
          {
            title: 'Building your first resume',
            description: 'A one-page resume that actually gets read — written for school students.',
            type: 'document',
            duration: 7,
            difficulty: 'intermediate',
            contentHtml: docResume,
          },
          {
            title: 'Interview preparation',
            description: 'How to answer the five questions every interview opens with.',
            type: 'video',
            duration: 22,
            difficulty: 'intermediate',
            contentUrl: 'https://www.youtube.com/watch?v=PCWVi5pAa30',
          },
          {
            title: 'Mock interview clinic',
            description: 'Live mock interviews with feedback. Bring your resume.',
            type: 'live',
            duration: 90,
            difficulty: 'intermediate',
            contentUrl: 'https://meet.google.com/qrs-tuvw-xyz',
          },
        ],
      },
    ],
  },
];

// ─── Driver ──────────────────────────────────────────────────────────────────

async function main() {
  const client = new MongoClient(URI!);
  await client.connect();
  const db = client.db();
  console.log('Connected to', db.databaseName);

  const tenant = await db.collection('tenants').findOne({ code: TENANT_CODE });
  if (!tenant) {
    console.error(`\n⛔ Tenant ${TENANT_CODE} not found. Run seed-demo-school.ts first.`);
    await client.close();
    process.exit(1);
  }
  const tenantId = tenant._id as ObjectId;

  // Pick the main branch as the home for these courses.
  const branch = await db.collection('branches').findOne({ tenantId, code: 'GFS-MC' });
  if (!branch) {
    console.error('\n⛔ Main Campus branch not found inside SCHDEMO. Aborting.');
    await client.close();
    process.exit(1);
  }
  const branchId = branch._id as ObjectId;

  // Use the demo Group Owner as the createdBy + instructor for everything.
  const owner = await db.collection('users').findOne({ tenantId, email: 'owner@greenfield.demo' });
  const ownerId = (owner?._id ?? new ObjectId()) as ObjectId;

  // Idempotency: bail if the first demo course is already there.
  const existing = await db
    .collection('courses')
    .findOne({ tenantId, courseNumber: 'GFS-CRS-001' });
  if (existing) {
    console.error(
      `\n⛔ Demo courses already exist for ${TENANT_CODE} (first course id: ${existing._id}).`
    );
    console.error('   Refusing to seed. To wipe, run cleanup-demo-school.ts and re-seed.');
    await client.close();
    process.exit(1);
  }

  console.log(`\n🌱 Seeding ${COURSES.length} courses for ${TENANT_CODE}…`);

  let totalLessons = 0;
  let totalModules = 0;

  for (let i = 0; i < COURSES.length; i++) {
    const def = COURSES[i]!;
    const courseId = new ObjectId();
    const courseNumber = `GFS-CRS-${String(i + 1).padStart(3, '0')}`;
    const now = new Date();

    // Modules embedded on the course doc (matches existing schema).
    const moduleDocs = def.modules.map((m, idx) => ({
      _id: new ObjectId(),
      title: m.title,
      description: m.description ?? '',
      order: idx + 1,
      duration: m.lessons.reduce((s, l) => s + (l.duration ?? 0), 0),
    }));

    const totalCourseDurationMinutes = moduleDocs.reduce((s, m) => s + (m.duration ?? 0), 0);
    const totalCourseDurationHours = Math.max(1, Math.round(totalCourseDurationMinutes / 60));

    const courseDoc = {
      _id: courseId,
      tenantId,
      branchId,
      courseNumber,
      title: def.title,
      description: def.description,
      category: def.category,
      level: def.level,
      status: def.status,
      visibility: 'all' as const, // org-wide so it shows up everywhere in the demo
      instructor: def.instructor ?? 'Greenfield Faculty',
      duration: totalCourseDurationHours,
      modules: moduleDocs,
      createdBy: ownerId,
      createdAt: now,
      updatedAt: now,
    };

    await db.collection('courses').insertOne(courseDoc);
    totalModules += moduleDocs.length;

    // Now write lessons — top-level documents linked by courseId + moduleId.
    const lessonDocs: Array<Record<string, unknown>> = [];
    let courseLessonOrder = 0;
    for (let mi = 0; mi < def.modules.length; mi++) {
      const module = def.modules[mi]!;
      const moduleId = moduleDocs[mi]!._id;
      for (let li = 0; li < module.lessons.length; li++) {
        const lesson = module.lessons[li]!;
        courseLessonOrder += 1;
        lessonDocs.push({
          _id: new ObjectId(),
          tenantId,
          branchId,
          courseId,
          moduleId,
          title: lesson.title,
          description: lesson.description ?? '',
          type: lesson.type,
          duration: lesson.duration,
          difficulty: lesson.difficulty,
          contentUrl: lesson.contentUrl,
          contentHtml: lesson.contentHtml,
          order: courseLessonOrder,
          isPreview: lesson.isPreview ?? false,
          isFree: lesson.isPreview ?? false,
          createdBy: ownerId,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
    if (lessonDocs.length > 0) {
      await db.collection('lessons').insertMany(lessonDocs);
      totalLessons += lessonDocs.length;
    }

    console.log(
      `  ✓ ${courseNumber}  ${def.title.padEnd(38, ' ')}  ${moduleDocs.length} modules · ${lessonDocs.length} lessons`
    );
  }

  // Counter doc — keeps generateCourseNumber() in sync if anything is created later.
  await db.collection('counters').updateOne(
    { tenantId, name: 'course_number' },
    {
      $set: {
        tenantId,
        name: 'course_number',
        value: COURSES.length,
        prefix: 'GFS-CRS',
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );

  console.log(`\n✅ Done. Seeded:
  ${COURSES.length} courses
  ${totalModules} modules
  ${totalLessons} lessons

🧹 To remove these (along with the rest of SCHDEMO):
  pnpm --filter @campus-verse/api exec tsx src/scripts/cleanup-demo-school.ts ${tenantId}
`);

  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

void function _unusedTypeReference(_db: Db) {
  /* keeps Db type referenced for future helpers */
};

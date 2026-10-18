import { ObjectId } from 'mongodb';
import { collections } from '../../../config/database';
import { ApiError } from '../../../middleware/errorHandler';
import { logger } from '../../../lib/logger';

/**
 * Virtual Placement Office: a live feed of job openings in India, pulled from
 * free public sources — company career boards (Greenhouse, Lever, Ashby) for
 * on-site roles in Indian cities, and remote boards (Himalayas, Jobicy,
 * Remotive) for roles open to candidates in India. No API keys needed.
 * Placement staff can share any opening to the campus job board.
 */

export interface FeedJob {
  id: string;
  title: string;
  company: string;
  logo: string | null;
  website: string | null;
  location: string;
  city: string | null;
  remote: boolean;
  type: string;
  category: string;
  fresher: boolean;
  salary: string | null;
  url: string;
  postedAt: string | null;
  source: string;
  sourceUrl: string;
}

// Company career boards with Indian offices (public JSON, no key)
const GREENHOUSE: Record<string, [string, string]> = {
  stripe: ['Stripe', 'stripe.com'],
  databricks: ['Databricks', 'databricks.com'],
  mongodb: ['MongoDB', 'mongodb.com'],
  okta: ['Okta', 'okta.com'],
  zscaler: ['Zscaler', 'zscaler.com'],
  inmobi: ['InMobi', 'inmobi.com'],
  rubrik: ['Rubrik', 'rubrik.com'],
  gitlab: ['GitLab', 'gitlab.com'],
  groww: ['Groww', 'groww.in'],
  druva: ['Druva', 'druva.com'],
  hackerrank: ['HackerRank', 'hackerrank.com'],
  elastic: ['Elastic', 'elastic.co'],
  twilio: ['Twilio', 'twilio.com'],
  coinbase: ['Coinbase', 'coinbase.com'],
  airbnb: ['Airbnb', 'airbnb.com'],
};
const LEVER: Record<string, [string, string]> = {
  meesho: ['Meesho', 'meesho.com'],
  zeta: ['Zeta', 'zeta.tech'],
};
const ASHBY: Record<string, [string, string]> = {
  sarvam: ['Sarvam AI', 'sarvam.ai'],
  atlan: ['Atlan', 'atlan.com'],
};

const CITIES: Array<[RegExp, string]> = [
  [/bengaluru|bangalore/i, 'Bengaluru'],
  [/hyderabad/i, 'Hyderabad'],
  [/mumbai/i, 'Mumbai'],
  [/pune/i, 'Pune'],
  [/gurgaon|gurugram/i, 'Gurugram'],
  [/noida/i, 'Noida'],
  [/new delhi|delhi/i, 'Delhi'],
  [/chennai/i, 'Chennai'],
  [/kochi|cochin/i, 'Kochi'],
  [/thiruvananthapuram|trivandrum/i, 'Thiruvananthapuram'],
  [/ahmedabad/i, 'Ahmedabad'],
  [/kolkata/i, 'Kolkata'],
  [/jaipur/i, 'Jaipur'],
];
const cityOf = (s: string) => CITIES.find(([r]) => r.test(s))?.[1] ?? null;
const inIndia = (s: string) => /india/i.test(s) || cityOf(s) !== null;

const CATEGORIES: Array<[RegExp, string]> = [
  [/\bintern(ship)?\b/i, 'Internships'],
  [/data|machine learning|\bml\b|\bai\b|analyst|scientist|analytics/i, 'Data & AI'],
  [/design|ux|ui\b/i, 'Design'],
  [/product manager|product owner|\bpm\b|program manager/i, 'Product'],
  [/engineer|developer|sde|devops|sre|software|backend|frontend|full.?stack|qa|test|security|architect|platform/i, 'Engineering'],
  [/sales|marketing|growth|account|business development|partnership|brand|content/i, 'Sales & Marketing'],
  [/finance|audit|accountant|legal|people|hr\b|talent|recruit|operations|ops\b|procurement/i, 'Business & Ops'],
  [/support|success|customer/i, 'Customer Success'],
];
const categoryOf = (title: string) => CATEGORIES.find(([r]) => r.test(title))?.[1] ?? 'Other';
const FRESHER =
  /\binterns?(hip)?\b|graduate|new grad|fresher|entry|junior|trainee|associate(?! director| vice| manager)|early career|campus|\bsde ?(1|i)\b|engineer ?(1|i)\b|apprentice/i;
const SENIOR = /senior|sr\.?|staff|principal|lead|head|director|manager|vp\b|chief/i;
const isFresher = (t: string) => FRESHER.test(t) && !SENIOR.test(t);

// AI-training gig marketplaces that flood remote boards — not placement material
const GIG = /^(mercor|micro1|askable|outlier|alignerr|dataannotation)/i;

const clean = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim();

async function getJson(url: string, timeout = 12_000): Promise<unknown> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeout),
    headers: { 'User-Agent': 'CampusVerse-VPO/1.0 (+https://campusverse.app)', Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

function job(p: Omit<FeedJob, 'category' | 'fresher' | 'city'> & { city?: string | null }): FeedJob {
  return {
    ...p,
    title: clean(p.title),
    city: p.city ?? cityOf(p.location),
    category: categoryOf(p.title),
    fresher: isFresher(p.title),
  };
}

async function greenhouse(slug: string, [company, site]: [string, string]) {
  const d = (await getJson(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`)) as {
    jobs: Array<{ id: number; title: string; location?: { name?: string }; absolute_url: string; first_published?: string; updated_at?: string }>;
  };
  return d.jobs
    .filter((j) => inIndia(j.location?.name ?? ''))
    .map((j) =>
      job({
        id: `gh-${slug}-${j.id}`,
        title: j.title,
        company,
        logo: null,
        website: site,
        location: clean(j.location?.name),
        remote: /remote/i.test(j.location?.name ?? ''),
        type: /\binterns?(hip)?\b/i.test(j.title) ? 'Internship' : 'Full-time',
        salary: null,
        url: j.absolute_url,
        postedAt: j.first_published ?? j.updated_at ?? null,
        source: `${company} careers`,
        sourceUrl: `https://boards.greenhouse.io/${slug}`,
      })
    );
}

async function lever(slug: string, [company, site]: [string, string]) {
  const d = (await getJson(`https://api.lever.co/v0/postings/${slug}?mode=json`, 20_000)) as Array<{
    id: string; text: string; hostedUrl: string; createdAt: number; workplaceType?: string; country?: string;
    categories?: { location?: string; commitment?: string; allLocations?: string[] };
  }>;
  return d
    .filter((j) => j.country === 'IN' || inIndia((j.categories?.allLocations ?? [j.categories?.location ?? '']).join(' ')))
    .map((j) =>
      job({
        id: `lv-${slug}-${j.id}`,
        title: j.text,
        company,
        logo: null,
        website: site,
        location: clean(j.categories?.location) || 'India',
        remote: j.workplaceType === 'remote',
        type: j.categories?.commitment || 'Full-time',
        salary: null,
        url: j.hostedUrl,
        postedAt: new Date(j.createdAt).toISOString(),
        source: `${company} careers`,
        sourceUrl: `https://jobs.lever.co/${slug}`,
      })
    );
}

async function ashby(slug: string, [company, site]: [string, string]) {
  const d = (await getJson(`https://api.ashbyhq.com/posting-api/job-board/${slug}`)) as {
    jobs: Array<{ id: string; title: string; location?: string; jobUrl: string; publishedAt?: string; isRemote?: boolean; employmentType?: string; address?: { postalAddress?: { addressCountry?: string } } }>;
  };
  return d.jobs
    .filter((j) => j.address?.postalAddress?.addressCountry === 'India' || inIndia(j.location ?? ''))
    .map((j) =>
      job({
        id: `ab-${slug}-${j.id}`,
        title: j.title,
        company,
        logo: null,
        website: site,
        location: clean(j.location) || 'India',
        remote: !!j.isRemote,
        type: j.employmentType === 'Intern' ? 'Internship' : j.employmentType === 'PartTime' ? 'Part-time' : 'Full-time',
        salary: null,
        url: j.jobUrl,
        postedAt: j.publishedAt ?? null,
        source: `${company} careers`,
        sourceUrl: `https://jobs.ashbyhq.com/${slug}`,
      })
    );
}

const money = (min?: number | null, max?: number | null, cur?: string | null, per?: string | null) => {
  if (!min && !max) return null;
  // Some boards post placeholder ranges (e.g. 2k–450k); not worth showing
  if (min && max && max / min > 8) return null;
  const sym = cur === 'INR' ? '₹' : cur === 'USD' ? '$' : cur === 'EUR' ? '€' : `${cur ?? ''} `;
  const k = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));
  const range = min && max && min !== max ? `${sym}${k(min)}–${k(max)}` : `${sym}${k((max || min) as number)}`;
  return `${range}${per === 'hourly' ? '/hr' : per === 'monthly' ? '/mo' : '/yr'}`;
};

async function himalayas() {
  const pages = await Promise.all(
    [0, 20, 40, 60].map((offset) =>
      getJson(`https://himalayas.app/jobs/api/search?country=India&limit=20&offset=${offset}`).catch(() => ({ jobs: [] }))
    )
  );
  type H = {
    guid?: string; title: string; companyName: string; companyLogo?: string; employmentType?: string;
    minSalary?: number; maxSalary?: number; currency?: string; salaryPeriod?: string;
    locationRestrictions?: string[]; applicationLink?: string; pubDate?: number;
  };
  return pages
    .flatMap((p) => (p as { jobs: H[] }).jobs)
    .filter((j) => j.employmentType !== 'Contractor' && !GIG.test(j.companyName) && !/\$|expert \(msc|ai training/i.test(j.title))
    .map((j) =>
      job({
        id: `hm-${j.guid ?? j.applicationLink ?? j.title}`,
        title: j.title,
        company: clean(j.companyName),
        logo: j.companyLogo ?? null,
        website: null,
        location: j.locationRestrictions?.length ? `Remote · ${j.locationRestrictions.slice(0, 2).join(', ')}` : 'Remote · Worldwide',
        city: null,
        remote: true,
        type: j.employmentType === 'Intern' ? 'Internship' : j.employmentType || 'Full-time',
        salary: money(j.minSalary, j.maxSalary, j.currency, j.salaryPeriod),
        url: j.applicationLink ?? j.guid ?? 'https://himalayas.app/jobs',
        postedAt: j.pubDate ? new Date(j.pubDate * 1000).toISOString() : null,
        source: 'Himalayas',
        sourceUrl: 'https://himalayas.app',
      })
    );
}

async function jobicy() {
  const d = (await getJson('https://jobicy.com/api/v2/remote-jobs?count=50&geo=apac')) as {
    jobs: Array<{
      id: number; url: string; jobTitle: string; companyName: string; companyLogo?: string; jobGeo?: string;
      jobType?: string[]; pubDate?: string; annualSalaryMin?: number; annualSalaryMax?: number; salaryCurrency?: string;
    }>;
  };
  return d.jobs
    .filter((j) => /anywhere|apac|asia|india/i.test(j.jobGeo ?? ''))
    .map((j) =>
      job({
        id: `jc-${j.id}`,
        title: j.jobTitle,
        company: clean(j.companyName),
        logo: j.companyLogo ?? null,
        website: null,
        location: `Remote · ${j.jobGeo ?? 'APAC'}`,
        city: null,
        remote: true,
        type: /intern/i.test(j.jobType?.join(' ') ?? '') ? 'Internship' : 'Full-time',
        salary: money(j.annualSalaryMin, j.annualSalaryMax, j.salaryCurrency, 'annual'),
        url: j.url,
        postedAt: j.pubDate && !isNaN(Date.parse(j.pubDate)) ? new Date(j.pubDate).toISOString() : null,
        source: 'Jobicy',
        sourceUrl: 'https://jobicy.com',
      })
    );
}

async function remotive() {
  const d = (await getJson('https://remotive.com/api/remote-jobs?limit=100')) as {
    jobs: Array<{ id: number; url: string; title: string; company_name: string; company_logo?: string; job_type?: string; publication_date?: string; candidate_required_location?: string; salary?: string }>;
  };
  return d.jobs
    .filter((j) => /worldwide|anywhere|apac|asia|india/i.test(j.candidate_required_location ?? ''))
    .map((j) =>
      job({
        id: `rm-${j.id}`,
        title: j.title,
        company: clean(j.company_name),
        logo: j.company_logo ?? null,
        website: null,
        location: `Remote · ${j.candidate_required_location}`,
        city: null,
        remote: true,
        type: j.job_type === 'internship' ? 'Internship' : j.job_type === 'part_time' ? 'Part-time' : 'Full-time',
        salary: clean(j.salary) || null,
        url: j.url,
        postedAt: j.publication_date ? new Date(j.publication_date + 'Z').toISOString() : null,
        source: 'Remotive',
        sourceUrl: 'https://remotive.com',
      })
    );
}

// Newest first, but company-career roles in Indian cities lead: a remote-board
// listing ranks as if posted three days earlier.
const rank = (j: FeedJob) => new Date(j.postedAt ?? 0).getTime() - (j.website ? 0 : 3 * 86_400_000);
const FOUNDER = /co-?founder|founding|\bcxo\b|\bceo\b|\bcto\b|\bcso\b|interpreter|translator|linguist/i;

const TTL = 30 * 60_000;
type Feed = { at: number; jobs: FeedJob[]; sources: Array<{ name: string; count: number; ok: boolean }> };
let cache: Feed | null = null;
let inflight: Promise<Feed> | null = null;

async function refresh(): Promise<Feed> {
  const tasks: Array<[string, Promise<FeedJob[]>]> = [
    ...Object.entries(GREENHOUSE).map(([s, c]) => [c[0], greenhouse(s, c)] as [string, Promise<FeedJob[]>]),
    ...Object.entries(LEVER).map(([s, c]) => [c[0], lever(s, c)] as [string, Promise<FeedJob[]>]),
    ...Object.entries(ASHBY).map(([s, c]) => [c[0], ashby(s, c)] as [string, Promise<FeedJob[]>]),
    ['Himalayas', himalayas()],
    ['Jobicy', jobicy()],
    ['Remotive', remotive()],
  ];
  const settled = await Promise.allSettled(tasks.map(([, p]) => p));
  const sources = settled.map((r, i) => ({
    name: tasks[i][0],
    ok: r.status === 'fulfilled',
    count: r.status === 'fulfilled' ? r.value.length : 0,
  }));
  settled.forEach((r, i) => r.status === 'rejected' && logger.warn({ source: tasks[i][0], err: String(r.reason) }, 'VPO source failed'));
  const seen = new Set<string>();
  const jobs = settled
    .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    .filter((j) => j.url && !FOUNDER.test(j.title) && !seen.has(j.id) && seen.add(j.id))
    .sort((a, b) => rank(b) - rank(a));
  return { at: Date.now(), jobs, sources };
}

/** Start (or join) a refresh; keeps the last good feed if every source fails. */
function revalidate(): Promise<Feed> {
  if (!inflight) {
    inflight = refresh()
      .then((c) => {
        if (c.jobs.length || !cache) cache = c;
        return cache;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

async function feed(): Promise<Feed> {
  if (cache && Date.now() - cache.at < TTL) return cache;
  // Serve stale data while a refresh runs; only the very first call waits.
  const next = revalidate();
  return cache ?? next;
}

/** Fill the feed at boot and keep it fresh, so nobody waits on a cold fetch. */
export function warmVpoFeed() {
  if (process.env.NODE_ENV === 'test') return;
  const run = () => revalidate().catch((e) => logger.warn({ err: String(e) }, 'VPO warm-up failed'));
  setTimeout(run, 5_000);
  setInterval(run, TTL).unref();
}

const tally = (xs: Array<string | null>) => {
  const m = new Map<string, number>();
  for (const x of xs) if (x) m.set(x, (m.get(x) ?? 0) + 1);
  return [...m].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
};

class VpoService {
  async jobs(
    tenantId: string,
    q: { search?: string; category?: string; city?: string; fresher?: string; remote?: string; page?: string; limit?: string }
  ) {
    const f = await feed();
    const all = f.jobs;
    const rx = q.search ? new RegExp(q.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null;
    let list = all;
    if (rx) list = list.filter((j) => rx.test(j.title) || rx.test(j.company) || rx.test(j.location));
    if (q.fresher === 'true') list = list.filter((j) => j.fresher);
    if (q.remote === 'true') list = list.filter((j) => j.remote);
    if (q.remote === 'false') list = list.filter((j) => !j.remote);
    if (q.city) list = list.filter((j) => j.city === q.city);
    const facetBase = list;
    if (q.category) list = list.filter((j) => j.category === q.category);
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(60, Math.max(1, Number(q.limit) || 24));
    const shared = await collections.jobPostings
      .find({ tenantId: new ObjectId(tenantId), vpoJobId: { $in: list.slice((page - 1) * limit, page * limit).map((j) => j.id) } })
      .project({ vpoJobId: 1 })
      .toArray();
    const sharedIds = new Set(shared.map((s) => s.vpoJobId as string));
    const day = Date.now() - 86_400_000;
    const companies = new Map<string, { name: string; logo: string | null; website: string | null; count: number }>();
    for (const j of all) {
      const c = companies.get(j.company) ?? { name: j.company, logo: j.logo, website: j.website, count: 0 };
      c.count++;
      companies.set(j.company, c);
    }
    return {
      jobs: list.slice((page - 1) * limit, page * limit).map((j) => ({ ...j, shared: sharedIds.has(j.id) })),
      total: list.length,
      page,
      limit,
      updatedAt: new Date(f.at).toISOString(),
      stats: {
        total: all.length,
        newToday: all.filter((j) => j.postedAt && new Date(j.postedAt).getTime() > day).length,
        fresher: all.filter((j) => j.fresher).length,
        inCities: all.filter((j) => !j.remote).length,
        remote: all.filter((j) => j.remote).length,
        companies: companies.size,
      },
      categories: tally(facetBase.map((j) => j.category)),
      cities: tally(all.map((j) => j.city)),
      topCompanies: [...companies.values()].sort((a, b) => b.count - a.count).slice(0, 24),
      sources: f.sources,
    };
  }

  /** Copy an opening onto the campus job board so students see it. */
  async share(tenantId: string, branchId: string, userId: string, jobId: string) {
    const f = await feed();
    const j = f.jobs.find((x) => x.id === jobId);
    if (!j) throw new ApiError('VPO_JOB_NOT_FOUND', 'This opening is no longer in the feed', 404);
    const tenant = new ObjectId(tenantId);
    const existing = await collections.jobPostings.findOne({ tenantId: tenant, vpoJobId: j.id });
    if (existing) return { _id: existing._id.toString(), alreadyShared: true };
    const now = new Date();
    const count = await collections.jobPostings.countDocuments({ tenantId: tenant });
    const doc = {
      tenantId: tenant,
      branchId: new ObjectId(branchId),
      title: j.title,
      companyName: j.company,
      companyWebsite: j.website,
      companyLogo: j.logo,
      type: j.type === 'Internship' ? 'internship' : 'job',
      description: `${j.title} at ${j.company} — ${j.location}.\n\nShared from the Virtual Placement Office (${j.source}). Apply directly on the company's site.`,
      requirements: j.fresher ? ['Open to freshers / final-year students'] : [],
      location: j.city ?? j.location,
      workMode: j.remote ? 'remote' : 'onsite',
      externalUrl: j.url,
      source: j.source,
      vpoJobId: j.id,
      applicationDeadline: new Date(now.getTime() + 21 * 86_400_000),
      status: 'active',
      applicationCount: 0,
      postingNumber: `JOB${String(now.getFullYear()).slice(2)}V${String(count + 1).padStart(5, '0')}`,
      createdBy: new ObjectId(userId),
      createdAt: now,
      updatedAt: now,
    };
    const r = await collections.jobPostings.insertOne(doc);
    return { _id: r.insertedId.toString(), alreadyShared: false };
  }
}

export const vpoService = new VpoService();

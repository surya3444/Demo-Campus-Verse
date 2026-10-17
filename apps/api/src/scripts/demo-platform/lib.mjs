// Shared helpers for the demo-platform build. Everything goes through the real
// HTTP API as real users, so the data is exactly what the app itself creates.
import fs from 'fs';
import path from 'path';

export const API = process.env.DEMO_API ?? 'http://localhost:3001/api/v1';
const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '../../../../../..');
// Line 1 is the shared demo password (later lines may hold changed ones).
export const PASSWORD = fs.readFileSync(path.join(ROOT, 'demo-password.txt'), 'utf8').split('\n')[0].trim();
export const STATE_DIR = path.join(ROOT, 'demo-state');
fs.mkdirSync(STATE_DIR, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** A signed-in user. call(method, path, body, {branchId}) → data; throws with the API's message. */
// Every password line in demo-password.txt; accounts whose password a person
// changed in the app are tried with the later lines.
const ALL_PASSWORDS = fs.readFileSync(path.join(ROOT, 'demo-password.txt'), 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);

export async function session(email, password = PASSWORD) {
  let token = null;
  let user = null;
  const login = async () => {
    for (let attempt = 0; ; attempt++) {
      const r = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 429 && attempt < 20) {
        await sleep(30_000);
        continue;
      }
      if (!j.success && j.error?.code === 'INVALID_CREDENTIALS') {
        const next = ALL_PASSWORDS[ALL_PASSWORDS.indexOf(password) + 1];
        if (next) {
          password = next;
          continue;
        }
      }
      if (!j.success) throw new Error(`login ${email}: ${JSON.stringify(j.error)}`);
      token = j.data.accessToken;
      user = j.data.user;
      return;
    }
  };
  await login();
  const call = async (method, p, body, opts = {}) => {
    for (let attempt = 0; ; attempt++) {
      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
      if (opts.branchId) headers['x-branch-id'] = opts.branchId;
      let r;
      try {
        r = await fetch(`${API}${p}`, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
        });
      } catch (netErr) {
        // API restarting (tsx watch) or a dropped connection — wait and retry.
        if (attempt < 20) {
          await sleep(3000);
          continue;
        }
        throw netErr;
      }
      if (r.status === 429 && attempt < 30) {
        const wait = Number(r.headers.get('ratelimit-reset') ?? 10);
        await sleep((wait + 1) * 1000);
        continue;
      }
      if (r.status === 401 && attempt < 2) {
        await login();
        continue;
      }
      if (r.status >= 500 && attempt < 3) {
        await sleep(2000);
        continue;
      }
      const j = await r.json().catch(() => ({}));
      if (!j.success) {
        const err = new Error(`${method} ${p} → ${r.status} ${JSON.stringify(j.error ?? j).slice(0, 400)}`);
        err.status = r.status;
        err.code = j.error?.code;
        throw err;
      }
      return opts.full ? j : j.data;
    }
  };
  return { call, user: () => user, email, relogin: login };
}

/** Run fn over items with a fixed concurrency. */
export async function pool(items, size, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k], k);
      }
    })
  );
  return out;
}

// Several phases run at once against the same file, each owning different
// keys. Saving is a three-way merge: only what *this* process changed since it
// loaded is written over what's on disk, so phases never erase each other.
const snapshots = new Map();
const stateFile = (org) => path.join(STATE_DIR, `${org}.json`);
const readState = (org) => (fs.existsSync(stateFile(org)) ? JSON.parse(fs.readFileSync(stateFile(org), 'utf8')) : {});
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
function merge(disk, base, mine) {
  for (const k of Object.keys(mine)) {
    if (isObj(mine[k]) && isObj(disk[k])) disk[k] = merge(disk[k], isObj(base?.[k]) ? base[k] : {}, mine[k]);
    else if (JSON.stringify(mine[k]) !== JSON.stringify(base?.[k])) disk[k] = mine[k];
  }
  return disk;
}
export function loadState(org) {
  const st = readState(org);
  snapshots.set(org, JSON.parse(JSON.stringify(st)));
  return st;
}
export function saveState(org, mine) {
  const merged = merge(readState(org), snapshots.get(org) ?? {}, mine);
  const tmp = `${stateFile(org)}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(merged, null, 2));
  fs.renameSync(tmp, stateFile(org));
  snapshots.set(org, JSON.parse(JSON.stringify(mine)));
}

// Deterministic pseudo-random so re-runs produce the same people.
let seed = 20261014;
export function rnd() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}
export const pick = (a) => a[Math.floor(rnd() * a.length)];
export const int = (min, max) => min + Math.floor(rnd() * (max - min + 1));

const FIRST_M = ['Aarav','Vivaan','Aditya','Arjun','Sai','Reyansh','Krishna','Ishaan','Rohan','Kabir','Vihaan','Ayaan','Dhruv','Karthik','Rahul','Nikhil','Pranav','Siddharth','Varun','Harsh','Manish','Suresh','Rajesh','Vikram','Anil','Deepak','Gaurav','Akash','Yash','Om','Tejas','Abhinav','Kunal','Mohit','Naveen','Pavan','Ravi','Sandeep','Tarun','Uday'];
const FIRST_F = ['Ananya','Diya','Saanvi','Aadhya','Isha','Kavya','Meera','Priya','Riya','Sneha','Pooja','Anjali','Divya','Lakshmi','Nisha','Shreya','Tanvi','Varsha','Neha','Aishwarya','Bhavana','Chitra','Deepika','Gayatri','Harini','Jyoti','Keerthi','Lavanya','Madhuri','Nandini','Pallavi','Radhika','Sahana','Swathi','Uma','Vidya','Yamini','Zoya','Rashmi','Sunita'];
const LAST = ['Sharma','Verma','Iyer','Reddy','Nair','Rao','Patel','Gupta','Kulkarni','Deshpande','Joshi','Menon','Pillai','Shetty','Hegde','Kamath','Bhat','Naidu','Chowdary','Singh','Yadav','Mishra','Pandey','Agarwal','Malhotra','Kapoor','Bose','Das','Mukherjee','Banerjee','Ghosh','Sinha','Jain','Mehta','Shah','Desai','Pawar','Patil','Gowda','Krishnan'];

export function person(i) {
  const female = rnd() < 0.48;
  return {
    firstName: pick(female ? FIRST_F : FIRST_M),
    lastName: pick(LAST),
    gender: female ? 'female' : 'male',
    phone: `9${String(int(100000000, 999999999))}`,
  };
}

export const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
export const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

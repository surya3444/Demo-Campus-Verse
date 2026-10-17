/**
 * Timetable auto-generation: a pure solver (no DB) so it can be tested alone.
 *
 * Hard rules: a teacher is never in two places at once (by clock time, so
 * years with different period timings still can't double-book anyone); a
 * whole-section class owns its period; a lab batch is in one place at a time;
 * a lab is a run of consecutive periods that never crosses a break.
 *
 * Soft rules (scored, lower is better): a subject at most once a day,
 * teachers within their daily limit and without long unbroken runs, the
 * section's load spread over the week, theory early in the day, and parallel
 * lab batches sharing a block so the section isn't idle.
 *
 * Method: most-constrained-first greedy placement, a one-step repair that
 * moves a blocking class to make room, and many randomised restarts within a
 * time budget, keeping the best week.
 */

export interface SolverSlot {
  id: string;
  start: string;
  end: string;
  type: string;
}

export interface SolverSection {
  id: string;
  /** Full day in order, breaks included (a lab can't span a break). */
  slots: SolverSlot[];
}

export interface SolverUnit {
  key: string;
  sectionId: string;
  subjectId: string;
  teacherId: string;
  batchId?: string;
  /** Consecutive periods (1 for theory, usually 2 for a lab). */
  length: number;
  kind: 'theory' | 'lab';
}

/** Something already in the week that the solver must work around. */
export interface SolverFixed {
  teacherId?: string;
  day: number;
  start: string;
  end: string;
  /** When it sits in a section being generated, the cell it occupies. */
  sectionId?: string;
  slotId?: string;
  batchId?: string | null;
  subjectId?: string;
}

export interface SolverOptions {
  days: number[];
  maxPerDay: number;
  seed: number;
  maxAttempts?: number;
  timeBudgetMs?: number;
}

export interface SolverPlacement {
  unitKey: string;
  day: number;
  slotIds: string[];
}

export type UnplacedReason = 'NO_PERIODS' | 'SECTION_FULL' | 'TEACHER_BUSY';

export interface SolverResult {
  placements: SolverPlacement[];
  unplaced: Array<{ unitKey: string; reason: UnplacedReason }>;
  penalty: number;
  attempts: number;
}

type Interval = { start: string; end: string };
type Block = SolverSlot[];
type Cell = { whole: boolean; batches: Set<string> };

const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;

/** Deterministic PRNG so "apply" reproduces exactly the week that was previewed. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Runs of `length` consecutive teaching periods with no break between. */
function blocksOf(section: SolverSection, length: number): Block[] {
  const out: Block[] = [];
  const s = section.slots;
  for (let i = 0; i + length <= s.length; i++) {
    const run = s.slice(i, i + length);
    if (run.every((x) => x.type === 'period')) out.push(run);
  }
  return out;
}

class Week {
  teacher = new Map<string, Map<number, Interval[]>>();
  cells = new Map<string, Cell>();
  subjectDay = new Map<string, number>();
  sectionDay = new Map<string, number>();
  /** Same subject in the same period on other days (variety). */
  subjectSlot = new Map<string, number>();
  /** Placements (by unit key) sitting in a cell, for the repair step. */
  cellUnits = new Map<string, Set<string>>();

  teacherDay(t: string, d: number) {
    let days = this.teacher.get(t);
    if (!days) this.teacher.set(t, (days = new Map()));
    let list = days.get(d);
    if (!list) days.set(d, (list = []));
    return list;
  }
  cell(sectionId: string, slotId: string, day: number) {
    const k = `${sectionId}|${slotId}|${day}`;
    let c = this.cells.get(k);
    if (!c) this.cells.set(k, (c = { whole: false, batches: new Set() }));
    return c;
  }
  bump(map: Map<string, number>, k: string, by: number) {
    map.set(k, (map.get(k) ?? 0) + by);
  }
}

const subjectKey = (u: SolverUnit, day: number) =>
  u.kind === 'lab'
    ? `${u.sectionId}|${u.subjectId}|lab|${u.batchId ?? ''}|${day}`
    : `${u.sectionId}|${u.subjectId}|${day}`;

function cellFree(w: Week, u: SolverUnit, block: Block, day: number) {
  return block.every((slot) => {
    const c = w.cells.get(`${u.sectionId}|${slot.id}|${day}`);
    if (!c) return true;
    if (u.batchId) return !c.whole && !c.batches.has(u.batchId);
    return !c.whole && c.batches.size === 0;
  });
}

function teacherFree(w: Week, u: SolverUnit, block: Block, day: number) {
  const span = { start: block[0].start, end: block[block.length - 1].end };
  return !w.teacherDay(u.teacherId, day).some((x) => overlaps(x, span));
}

function canPlace(w: Week, u: SolverUnit, block: Block, day: number, maxPerDay: number) {
  if (!cellFree(w, u, block, day) || !teacherFree(w, u, block, day)) return false;
  const already = w.subjectDay.get(subjectKey(u, day)) ?? 0;
  if (u.kind === 'lab' ? already >= 1 : already >= 2) return false;
  // Soft above the limit, hard two periods past it.
  return w.teacherDay(u.teacherId, day).length + block.length <= maxPerDay + 2;
}

function score(
  w: Week,
  u: SolverUnit,
  block: Block,
  day: number,
  index: number,
  maxPerDay: number,
  jitter: number
) {
  let s = jitter;
  const same = w.subjectDay.get(subjectKey(u, day)) ?? 0;
  if (u.kind === 'theory' && same) s += 60;
  s += (w.subjectSlot.get(`${u.sectionId}|${u.subjectId}|${block[0].id}`) ?? 0) * 2.5;

  const load = w.teacherDay(u.teacherId, day);
  const over = load.length + block.length - maxPerDay;
  if (over > 0) s += 35 * over;
  s += load.length * 2; // spread a teacher's week

  // Long unbroken teaching runs tire teachers.
  const span = { start: block[0].start, end: block[block.length - 1].end };
  const touching = load.filter((x) => x.end === span.start || x.start === span.end).length;
  if (touching && load.length + block.length >= 4) s += 8 * touching;

  s += (w.sectionDay.get(`${u.sectionId}|${day}`) ?? 0) * 1.5; // spread the section's week
  if (u.kind === 'theory') s += index * 0.8; // theory earlier, compact days

  if (u.batchId) {
    // Parallel batches in one block keep the whole section busy together.
    const shared = block.some(
      (slot) => (w.cells.get(`${u.sectionId}|${slot.id}|${day}`)?.batches.size ?? 0) > 0
    );
    s += shared ? -12 : 4;
  }
  return s;
}

function apply(
  w: Week,
  u: SolverUnit,
  block: Block,
  day: number,
  sign: 1 | -1,
  ref: Interval & { key?: string }
) {
  const list = w.teacherDay(u.teacherId, day);
  if (sign === 1) list.push(ref);
  else list.splice(list.indexOf(ref), 1);
  for (const slot of block) {
    const c = w.cell(u.sectionId, slot.id, day);
    if (u.batchId) {
      if (sign === 1) c.batches.add(u.batchId);
      else c.batches.delete(u.batchId);
    } else c.whole = sign === 1;
    const ck = `${u.sectionId}|${slot.id}|${day}`;
    let set = w.cellUnits.get(ck);
    if (!set) w.cellUnits.set(ck, (set = new Set()));
    if (sign === 1) set.add(u.key);
    else set.delete(u.key);
  }
  w.bump(w.subjectDay, subjectKey(u, day), sign);
  w.bump(w.sectionDay, `${u.sectionId}|${day}`, sign * block.length);
  w.bump(w.subjectSlot, `${u.sectionId}|${u.subjectId}|${block[0].id}`, sign);
}

export function solveTimetable(
  sections: SolverSection[],
  units: SolverUnit[],
  fixed: SolverFixed[],
  opts: SolverOptions
): SolverResult {
  const maxAttempts = opts.maxAttempts ?? 60;
  const budget = opts.timeBudgetMs ?? 2500;
  const started = Date.now();
  const sectionById = new Map(sections.map((s) => [s.id, s]));
  const blockCache = new Map<string, Block[]>();
  const blocks = (u: SolverUnit) => {
    const k = `${u.sectionId}|${u.length}`;
    let b = blockCache.get(k);
    if (!b) {
      const sec = sectionById.get(u.sectionId);
      blockCache.set(k, (b = sec ? blocksOf(sec, u.length) : []));
    }
    return b;
  };
  const unitByKey = new Map(units.map((u) => [u.key, u]));
  const teacherDemand = new Map<string, number>();
  for (const u of units) {
    teacherDemand.set(u.teacherId, (teacherDemand.get(u.teacherId) ?? 0) + u.length);
  }

  const seedWeek = () => {
    const w = new Week();
    for (const f of fixed) {
      if (f.teacherId) w.teacherDay(f.teacherId, f.day).push({ start: f.start, end: f.end });
      if (f.sectionId && f.slotId) {
        const c = w.cell(f.sectionId, f.slotId, f.day);
        if (f.batchId) c.batches.add(f.batchId);
        else c.whole = true;
        w.bump(w.sectionDay, `${f.sectionId}|${f.day}`, 1);
        if (f.subjectId) w.bump(w.subjectDay, `${f.sectionId}|${f.subjectId}|${f.day}`, 1);
      }
    }
    return w;
  };

  let best: SolverResult | null = null;
  let attempts = 0;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0 && Date.now() - started > budget) break;
    attempts++;
    const rand = mulberry32(opts.seed * 7919 + attempt);
    const noise = attempt === 0 ? 0 : 1;
    const w = seedWeek();
    const placed = new Map<string, { day: number; block: Block; ref: Interval }>();
    let penalty = 0;

    // Labs (long, multi-constraint) first, then the busiest teachers.
    const order = [...units]
      .map((u) => ({
        u,
        k:
          (u.kind === 'lab' ? 10000 : 0) +
          u.length * 1000 +
          (teacherDemand.get(u.teacherId) ?? 0) * 10 +
          rand() * 40 * noise,
      }))
      .sort((a, b) => b.k - a.k)
      .map((x) => x.u);

    const bestSpot = (u: SolverUnit) => {
      let spot: { day: number; block: Block; s: number } | null = null;
      for (const day of opts.days) {
        blocks(u).forEach((block, index) => {
          if (!canPlace(w, u, block, day, opts.maxPerDay)) return;
          const s = score(w, u, block, day, index, opts.maxPerDay, rand() * 3 * noise);
          if (!spot || s < spot.s) spot = { day, block, s };
        });
      }
      return spot as { day: number; block: Block; s: number } | null;
    };
    const put = (u: SolverUnit, day: number, block: Block) => {
      const ref = { start: block[0].start, end: block[block.length - 1].end };
      apply(w, u, block, day, 1, ref);
      placed.set(u.key, { day, block, ref });
    };
    const lift = (u: SolverUnit) => {
      const p = placed.get(u.key)!;
      apply(w, u, p.block, p.day, -1, p.ref);
      placed.delete(u.key);
      return p;
    };

    const unplaced: SolverUnit[] = [];
    for (const u of order) {
      const spot = bestSpot(u);
      if (spot) {
        put(u, spot.day, spot.block);
        penalty += spot.s;
      } else unplaced.push(u);
    }

    // Repair: free a spot by moving the one class in the way somewhere else.
    for (let i = unplaced.length - 1; i >= 0; i--) {
      const u = unplaced[i];
      let fixedIt = false;
      for (const day of opts.days) {
        if (fixedIt) break;
        for (const block of blocks(u)) {
          if (!teacherFree(w, u, block, day)) continue;
          const blockers = new Set<string>();
          for (const slot of block) {
            for (const k of w.cellUnits.get(`${u.sectionId}|${slot.id}|${day}`) ?? []) {
              blockers.add(k);
            }
          }
          if (blockers.size !== 1) continue;
          const v = unitByKey.get([...blockers][0])!;
          const was = lift(v);
          if (canPlace(w, u, block, day, opts.maxPerDay)) {
            put(u, day, block);
            const spot = bestSpot(v);
            if (spot) {
              put(v, spot.day, spot.block);
              unplaced.splice(i, 1);
              fixedIt = true;
              break;
            }
            lift(u);
          }
          put(v, was.day, was.block);
        }
      }
    }

    const unplacedPeriods = unplaced.reduce((n, u) => n + u.length, 0);
    const result: SolverResult = {
      placements: [...placed].map(([unitKey, p]) => ({
        unitKey,
        day: p.day,
        slotIds: p.block.map((s) => s.id),
      })),
      unplaced: unplaced.map((u) => {
        if (!blocks(u).length) return { unitKey: u.key, reason: 'NO_PERIODS' as const };
        const roomAnywhere = opts.days.some((d) => blocks(u).some((b) => cellFree(w, u, b, d)));
        return { unitKey: u.key, reason: roomAnywhere ? 'TEACHER_BUSY' : 'SECTION_FULL' };
      }),
      penalty: unplacedPeriods * 1000 + penalty,
      attempts,
    };
    if (!best || result.penalty < best.penalty) best = result;
    if (unplacedPeriods === 0 && attempt >= 8) break; // good enough; stop early
  }

  return { ...best!, attempts };
}

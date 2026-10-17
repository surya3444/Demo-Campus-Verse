import { describe, expect, it } from 'vitest';
import {
  solveTimetable,
  type SolverSection,
  type SolverUnit,
} from '../../modules/teaching/timetableSolver';

const DAY = [
  { id: 'p1', start: '09:00', end: '09:50', type: 'period' },
  { id: 'p2', start: '09:50', end: '10:40', type: 'period' },
  { id: 'br', start: '10:40', end: '11:00', type: 'break' },
  { id: 'p3', start: '11:00', end: '11:50', type: 'period' },
  { id: 'p4', start: '11:50', end: '12:40', type: 'period' },
  { id: 'lu', start: '12:40', end: '13:30', type: 'lunch' },
  { id: 'p5', start: '13:30', end: '14:20', type: 'period' },
  { id: 'p6', start: '14:20', end: '15:10', type: 'period' },
];
const section = (id: string): SolverSection => ({
  id,
  slots: DAY.map((s) => ({ ...s, id: `${id}-${s.id}` })),
});
const time = (slotId: string) => DAY.find((s) => slotId.endsWith(`-${s.id}`))!;
const days = [1, 2, 3, 4, 5];

function units(): SolverUnit[] {
  const out: SolverUnit[] = [];
  const theory = (sec: string, subj: string, teacher: string, n: number) => {
    for (let i = 0; i < n; i++) {
      out.push({
        key: `${sec}:${subj}:${i}`,
        sectionId: sec,
        subjectId: subj,
        teacherId: teacher,
        length: 1,
        kind: 'theory',
      });
    }
  };
  // Two sections share their maths and physics teachers.
  for (const sec of ['A', 'B']) {
    theory(sec, 'math', 'tMath', 4);
    theory(sec, 'phy', 'tPhy', 3);
    theory(sec, 'eng', `tEng${sec}`, 3);
    // Each section has two lab batches doing physics and chemistry labs.
    for (const batch of ['b1', 'b2']) {
      out.push({
        key: `${sec}:phylab:${batch}`,
        sectionId: sec,
        subjectId: 'phylab',
        teacherId: `tLab${batch}`,
        batchId: `${sec}${batch}`,
        length: 2,
        kind: 'lab',
      });
      out.push({
        key: `${sec}:chemlab:${batch}`,
        sectionId: sec,
        subjectId: 'chemlab',
        teacherId: `tChem${batch}`,
        batchId: `${sec}${batch}`,
        length: 2,
        kind: 'lab',
      });
    }
  }
  return out;
}

describe('solveTimetable', () => {
  it('places everything without any clash', () => {
    const us = units();
    const res = solveTimetable([section('A'), section('B')], us, [], {
      days,
      maxPerDay: 5,
      seed: 1,
    });
    expect(res.unplaced).toEqual([]);
    expect(res.placements).toHaveLength(us.length);

    const byKey = new Map(us.map((u) => [u.key, u]));
    const teacherAt = new Set<string>();
    const cellWhole = new Set<string>();
    const batchAt = new Set<string>();
    for (const p of res.placements) {
      const u = byKey.get(p.unitKey)!;
      expect(p.slotIds).toHaveLength(u.length);
      if (u.kind === 'lab') {
        // consecutive periods, never across the break/lunch
        const idx = p.slotIds.map((id) => DAY.findIndex((s) => id.endsWith(`-${s.id}`)));
        expect(idx[1]).toBe(idx[0] + 1);
      }
      for (const id of p.slotIds) {
        const t = `${u.teacherId}|${p.day}|${time(id).start}`;
        expect(teacherAt.has(t)).toBe(false);
        teacherAt.add(t);
        const c = `${u.sectionId}|${p.day}|${id}`;
        if (u.batchId) {
          expect(cellWhole.has(c)).toBe(false);
          expect(batchAt.has(`${c}|${u.batchId}`)).toBe(false);
          batchAt.add(`${c}|${u.batchId}`);
        } else {
          expect(cellWhole.has(c)).toBe(false);
          expect([...batchAt].some((b) => b.startsWith(`${c}|`))).toBe(false);
          cellWhole.add(c);
        }
      }
    }
  });

  it('is deterministic for a seed (preview == apply)', () => {
    const run = () =>
      solveTimetable([section('A'), section('B')], units(), [], { days, maxPerDay: 5, seed: 42 });
    expect(run().placements).toEqual(run().placements);
  });

  it('works around a teacher who is busy elsewhere', () => {
    const us = units().filter((u) => u.subjectId === 'math');
    // tMath teaches another program every morning period on every day.
    const fixed = days.flatMap((day) =>
      DAY.filter((s) => s.type === 'period' && s.start < '12:00').map((s) => ({
        teacherId: 'tMath',
        day,
        start: s.start,
        end: s.end,
      }))
    );
    const res = solveTimetable([section('A'), section('B')], us, fixed, {
      days,
      maxPerDay: 5,
      seed: 3,
    });
    expect(res.unplaced).toEqual([]);
    for (const p of res.placements) expect(time(p.slotIds[0]).start >= '13:30').toBe(true);
  });

  it('reports a section that is simply over-full', () => {
    const us: SolverUnit[] = Array.from({ length: 40 }, (_, i) => ({
      key: `A:x:${i}`,
      sectionId: 'A',
      subjectId: `s${i % 10}`,
      teacherId: `t${i % 10}`,
      length: 1,
      kind: 'theory' as const,
    }));
    const res = solveTimetable([section('A')], us, [], { days, maxPerDay: 6, seed: 1 });
    // 6 periods x 5 days = 30 cells
    expect(res.placements).toHaveLength(30);
    expect(res.unplaced).toHaveLength(10);
    expect(res.unplaced.every((u) => u.reason === 'SECTION_FULL')).toBe(true);
  });
});

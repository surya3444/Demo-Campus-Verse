import { describe, it, expect } from 'vitest';
import {
  levelFromBands,
  computeItemStats,
  computeExternalLevel,
  computeStudentTotal,
  computeInstrumentCoValues,
  computeCoDirect,
  computeOverall,
  computeIndirect,
  computeMappingAverages,
  computePoAttainment,
  round2,
  mean,
  type EngineSet,
  type EngineMarksRow,
} from '../../modules/obe/attainment.engine';
import { DEFAULT_OBE_SETTINGS } from '@campus-verse/shared/constants';

const INTERNAL_BANDS = DEFAULT_OBE_SETTINGS.internalLevelBands; // 60/80/90 → L1/L2/L3
const EXTERNAL_BANDS = DEFAULT_OBE_SETTINGS.externalLevelBands; // 50/60/70 → L1/L2/L3

describe('levelFromBands', () => {
  it('maps internal band boundaries exactly', () => {
    expect(levelFromBands(59.99, INTERNAL_BANDS)).toBe(0);
    expect(levelFromBands(60, INTERNAL_BANDS)).toBe(1);
    expect(levelFromBands(79.99, INTERNAL_BANDS)).toBe(1);
    expect(levelFromBands(80, INTERNAL_BANDS)).toBe(2);
    expect(levelFromBands(89.99, INTERNAL_BANDS)).toBe(2);
    expect(levelFromBands(90, INTERNAL_BANDS)).toBe(3);
    expect(levelFromBands(100, INTERNAL_BANDS)).toBe(3);
  });

  it('maps external band boundaries exactly', () => {
    expect(levelFromBands(49.99, EXTERNAL_BANDS)).toBe(0);
    expect(levelFromBands(50, EXTERNAL_BANDS)).toBe(1);
    expect(levelFromBands(60, EXTERNAL_BANDS)).toBe(2);
    expect(levelFromBands(70, EXTERNAL_BANDS)).toBe(3);
  });

  it('returns null for null percent (nobody attempted)', () => {
    expect(levelFromBands(null, INTERNAL_BANDS)).toBeNull();
  });

  it('is order-insensitive to band declaration order', () => {
    const shuffled = [INTERNAL_BANDS[2], INTERNAL_BANDS[0], INTERNAL_BANDS[1]];
    expect(levelFromBands(85, shuffled)).toBe(2);
  });
});

describe('computeItemStats', () => {
  const set: EngineSet = {
    setId: 'set1',
    label: 'SET-1',
    items: [
      { itemId: 'q1', label: 'Q1', coIds: ['co1'], maxMarks: 5 },
      { itemId: 'q2', label: 'Q2', coIds: ['co2'], maxMarks: 5 },
    ],
  };

  it('counts only attempting students in the denominator, 0 counts as attempted', () => {
    const rows: EngineMarksRow[] = [
      { studentId: 's1', absent: false, setId: 'set1', marks: { q1: 5 } }, // attempted q1 only
      { studentId: 's2', absent: false, setId: 'set1', marks: { q1: 0, q2: 4 } }, // 0 attempted, fails threshold
      { studentId: 's3', absent: false, setId: 'set1', marks: { q2: 2 } },
      { studentId: 's4', absent: true, setId: 'set1', marks: {} }, // absent — excluded entirely
    ];
    const [q1, q2] = computeItemStats(set, rows, 60, INTERNAL_BANDS);
    expect(q1.attempted).toBe(2);
    expect(q1.cleared).toBe(1); // 5 > 3; 0 < 3
    expect(q1.percentCleared).toBe(50);
    expect(q1.level).toBe(0);
    expect(q2.attempted).toBe(2);
    expect(q2.cleared).toBe(1); // 4 > 3; 2 < 3
  });

  it('threshold is strict — exactly 60% of max marks does NOT clear', () => {
    const rows: EngineMarksRow[] = [
      { studentId: 's1', absent: false, setId: 'set1', marks: { q1: 3 } }, // exactly 60% of 5
      { studentId: 's2', absent: false, setId: 'set1', marks: { q1: 4 } },
    ];
    const [q1] = computeItemStats(set, rows, 60, INTERNAL_BANDS);
    expect(q1.cleared).toBe(1); // only the 4 clears
    expect(q1.percentCleared).toBe(50);
  });

  it('yields null percent/level when nobody attempted an item', () => {
    const rows: EngineMarksRow[] = [
      { studentId: 's1', absent: false, setId: 'set1', marks: { q1: 4 } },
    ];
    const [, q2] = computeItemStats(set, rows, 60, INTERNAL_BANDS);
    expect(q2.attempted).toBe(0);
    expect(q2.percentCleared).toBeNull();
    expect(q2.level).toBeNull();
  });
});

describe('computeExternalLevel', () => {
  it('excludes absentees from the denominator', () => {
    const results = [
      { marksObtained: 30, absent: false },
      { marksObtained: 20, absent: false },
      { marksObtained: 0, absent: true },
    ];
    const stat = computeExternalLevel(results, 26, EXTERNAL_BANDS);
    expect(stat.present).toBe(2);
    expect(stat.passed).toBe(1);
    expect(stat.percentPassed).toBe(50);
    expect(stat.level).toBe(1);
  });

  it('pass mark is inclusive', () => {
    const stat = computeExternalLevel([{ marksObtained: 26, absent: false }], 26, EXTERNAL_BANDS);
    expect(stat.passed).toBe(1);
  });

  it('handles an empty result set', () => {
    const stat = computeExternalLevel([], 26, EXTERNAL_BANDS);
    expect(stat.percentPassed).toBeNull();
    expect(stat.level).toBeNull();
  });
});

describe('computeStudentTotal', () => {
  it('best-2-of-4 keeps the two highest scores', () => {
    expect(computeStudentTotal({ q1: 4, q2: 0, q3: 5, q4: 3 }, 2)).toBe(9);
  });
  it('null bestOf sums everything', () => {
    expect(computeStudentTotal({ q1: 4, q2: 3 }, null)).toBe(7);
  });
});

describe('computeInstrumentCoValues', () => {
  it('averages item levels within a set, then set values across sets', () => {
    // CO1: set1 has two items (levels 2 and 3 → 2.5), set2 has one (level 1) → mean(2.5, 1) = 1.75
    const statsBySet = [
      [
        {
          setId: 'set1',
          setLabel: 'SET-1',
          itemId: 'a',
          label: 'Q1',
          coIds: ['co1'],
          maxMarks: 5,
          attempted: 5,
          cleared: 4,
          percentCleared: 80,
          level: 2,
        },
        {
          setId: 'set1',
          setLabel: 'SET-1',
          itemId: 'b',
          label: 'Q2',
          coIds: ['co1'],
          maxMarks: 5,
          attempted: 5,
          cleared: 5,
          percentCleared: 100,
          level: 3,
        },
      ],
      [
        {
          setId: 'set2',
          setLabel: 'SET-2',
          itemId: 'c',
          label: 'Q1',
          coIds: ['co1'],
          maxMarks: 5,
          attempted: 5,
          cleared: 3,
          percentCleared: 60,
          level: 1,
        },
      ],
    ];
    const values = computeInstrumentCoValues(statsBySet, ['co1', 'co2']);
    expect(values.get('co1')).toBeCloseTo(1.75, 5);
    expect(values.get('co2')).toBeNull();
  });

  it('skips null-level items (nobody attempted)', () => {
    const statsBySet = [
      [
        {
          setId: 'set1',
          setLabel: 'SET-1',
          itemId: 'a',
          label: 'Q1',
          coIds: ['co1'],
          maxMarks: 5,
          attempted: 0,
          cleared: 0,
          percentCleared: null,
          level: null,
        },
        {
          setId: 'set1',
          setLabel: 'SET-1',
          itemId: 'b',
          label: 'Q2',
          coIds: ['co1'],
          maxMarks: 5,
          attempted: 4,
          cleared: 4,
          percentCleared: 100,
          level: 3,
        },
      ],
    ];
    expect(computeInstrumentCoValues(statsBySet, ['co1']).get('co1')).toBe(3);
  });
});

describe('computeCoDirect / computeOverall — weight renormalization', () => {
  const dw = DEFAULT_OBE_SETTINGS.directWeights;
  const ow = DEFAULT_OBE_SETTINGS.overallWeights;

  it('blends 0.2 internal + 0.8 external', () => {
    expect(computeCoDirect(1.625, 3, dw)).toBeCloseTo(2.73, 2);
  });
  it('missing external → internal at full weight', () => {
    expect(computeCoDirect(1.5, null, dw)).toBe(1.5);
  });
  it('missing internal → external at full weight', () => {
    expect(computeCoDirect(null, 3, dw)).toBe(3);
  });
  it('both missing → null', () => {
    expect(computeCoDirect(null, null, dw)).toBeNull();
  });
  it('overall blends 0.9 direct + 0.1 indirect on the ROUNDED direct', () => {
    expect(computeOverall(2.73, 2.52, ow)).toBeCloseTo(2.71, 2);
  });
  it('missing indirect → direct at full weight', () => {
    expect(computeOverall(2.73, null, ow)).toBe(2.73);
  });
});

describe('computeIndirect', () => {
  it('equals Σ(level × count) ÷ respondents', () => {
    // 2 respondents at 1, 12 at 2, 19 at 3 → 83/33 = 2.52
    const responses = [
      ...Array.from({ length: 2 }, () => [{ coId: 'co1', rating: 1 }]),
      ...Array.from({ length: 12 }, () => [{ coId: 'co1', rating: 2 }]),
      ...Array.from({ length: 19 }, () => [{ coId: 'co1', rating: 3 }]),
    ];
    expect(computeIndirect(responses).get('co1')).toBeCloseTo(2.52, 2);
  });

  it('rates each CO over its own respondent count', () => {
    const responses = [
      [
        { coId: 'co1', rating: 3 },
        { coId: 'co2', rating: 1 },
      ],
      [{ coId: 'co1', rating: 1 }],
    ];
    const indirect = computeIndirect(responses);
    expect(indirect.get('co1')).toBe(2);
    expect(indirect.get('co2')).toBe(1);
  });
});

describe('computeMappingAverages', () => {
  it('averages over mapped cells only and nulls unmapped columns', () => {
    const cells = [
      { coId: 'co1', targetId: 'po1', strength: 2 },
      { coId: 'co2', targetId: 'po1', strength: 3 },
      { coId: 'co1', targetId: 'po4', strength: 2 },
    ];
    const averages = computeMappingAverages(cells, ['po1', 'po2', 'po4']);
    expect(averages.get('po1')).toEqual({ weightedAverage: 2.5, mappedCount: 2 });
    expect(averages.get('po2')).toEqual({ weightedAverage: null, mappedCount: 0 });
    expect(averages.get('po4')).toEqual({ weightedAverage: 2, mappedCount: 1 });
  });
});

describe('computePoAttainment', () => {
  it('is weightedAverage × courseCoAverage ÷ maxLevel', () => {
    expect(computePoAttainment(2.67, 2.71, 3)).toBeCloseTo(2.41, 2);
    expect(computePoAttainment(1, 2.71, 3)).toBeCloseTo(0.9, 2);
  });
});

describe('round2 / mean', () => {
  it('round2 rounds half away from zero at 2dp', () => {
    expect(round2(2.725)).toBe(2.73);
    expect(round2(2.704)).toBe(2.7);
  });
  it('mean of empty list is null', () => {
    expect(mean([])).toBeNull();
  });
});

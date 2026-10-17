import { describe, it, expect, vi } from 'vitest';
import {
  resolveYearPatterns,
  summarizeTermPattern,
  termLabelFor,
  termNumberFor,
  totalTermsFor,
  yearTermRanges,
  termAppliesToYear,
  type YearTermPattern,
} from '@campus-verse/shared';

vi.mock('@/config/database', () => ({ collections: {}, getDb: vi.fn() }));

import { deriveTermNumber, parseYearNumber } from '@/modules/organization/termNumbering';
import { planYears } from '@/modules/organization/program.service';

/**
 * Per-year term patterns: each year of a program can be annual, semester or
 * trimester, and terms are numbered across the whole program.
 */

const mixed = {
  durationYears: 4,
  yearPatterns: ['annual', 'semester', 'semester', 'semester'] as const,
};
const mixedPlan = { ...mixed, yearPatterns: [...mixed.yearPatterns] };

describe('year plans', () => {
  it('numbers terms across an annual first year then semesters', () => {
    expect(totalTermsFor(mixedPlan)).toBe(7);
    expect(yearTermRanges(mixedPlan).map((r) => [r.year, r.first, r.last])).toEqual([
      [1, 1, 1],
      [2, 2, 3],
      [3, 4, 5],
      [4, 6, 7],
    ]);
  });

  it('keeps an annual year on one term for the whole session', () => {
    expect(termNumberFor(mixedPlan, 1, 1)).toBe(1); // odd half
    expect(termNumberFor(mixedPlan, 1, 2)).toBe(1); // even half
  });

  it('shifts later semesters by the annual year', () => {
    expect(termNumberFor(mixedPlan, 2, 1)).toBe(2);
    expect(termNumberFor(mixedPlan, 2, 2)).toBe(3);
    expect(termNumberFor(mixedPlan, 4, 2)).toBe(7);
  });

  it('matches the old 2N-1 / 2N rule for all-semester programs', () => {
    const plan = { durationYears: 4, termPattern: 'semester' };
    for (let year = 1; year <= 4; year++) {
      expect(termNumberFor(plan, year, 1)).toBe(2 * year - 1);
      expect(termNumberFor(plan, year, 2)).toBe(2 * year);
    }
  });

  it('runs trimester years across three positions', () => {
    const plan = {
      durationYears: 2,
      yearPatterns: ['trimester', 'semester'] as Array<'trimester' | 'semester'>,
    };
    expect([1, 2, 3].map((p) => termNumberFor(plan, 1, p))).toEqual([1, 2, 3]);
    expect([1, 2].map((p) => termNumberFor(plan, 2, p))).toEqual([4, 5]);
  });

  it('falls back to termPattern for programs saved before per-year patterns', () => {
    expect(resolveYearPatterns({ durationYears: 3, termPattern: 'annual' })).toEqual([
      'annual',
      'annual',
      'annual',
    ]);
    expect(totalTermsFor({ durationYears: 3, termPattern: 'annual' })).toBe(3);
  });

  it('summarises and labels', () => {
    expect(summarizeTermPattern(['semester', 'semester'])).toBe('semester');
    expect(summarizeTermPattern(['annual', 'semester'])).toBe('mixed');
    expect(termLabelFor(mixedPlan, 1)).toBe('Year 1 (annual)');
    expect(termLabelFor(mixedPlan, 3)).toBe('Sem 3 · Year 2');
  });

  it('returns nothing for a year the program does not have', () => {
    expect(termNumberFor(mixedPlan, 5, 1)).toBeUndefined();
  });
});

describe('deriveTermNumber', () => {
  it('prefers an explicit term number', () => {
    expect(deriveTermNumber({ semesterNumber: 5, half: 'odd' }, 1, mixedPlan)).toBe(5);
  });

  it('uses the class program plan for a session half', () => {
    expect(deriveTermNumber({ half: 'even' }, 2, mixedPlan)).toBe(3);
    expect(
      deriveTermNumber({ part: 3 }, 1, { durationYears: 1, yearPatterns: ['trimester'] })
    ).toBe(3);
  });

  it('keeps classic numbering for a class with no program', () => {
    expect(deriveTermNumber({ half: 'odd' }, 3)).toBe(5);
    expect(deriveTermNumber({ half: 'even' }, 3)).toBe(6);
  });

  it('cannot derive without a session position or year', () => {
    expect(deriveTermNumber({}, 2, mixedPlan)).toBeUndefined();
    expect(deriveTermNumber({ half: 'odd' }, undefined, mixedPlan)).toBeUndefined();
  });

  it('reads the year from the class path', () => {
    expect(
      parseYearNumber([
        { levelKey: 'department', name: 'CSE' },
        { levelKey: 'year', name: 'Year 3' },
      ])
    ).toBe(3);
  });
});

describe('planYears (program save)', () => {
  it('stores explicit per-year patterns with derived totals', () => {
    expect(planYears(4, { yearPatterns: [...mixed.yearPatterns] })).toEqual({
      yearPatterns: ['annual', 'semester', 'semester', 'semester'],
      termPattern: 'mixed',
      totalSemesters: 7,
    });
  });

  it('rejects a plan that does not cover every year', () => {
    expect(() => planYears(4, { yearPatterns: ['annual', 'semester'] })).toThrow(
      /one term pattern per year/
    );
  });

  it('applies a bare termPattern to every year', () => {
    expect(planYears(3, { termPattern: 'trimester' })).toMatchObject({
      termPattern: 'trimester',
      totalSemesters: 9,
    });
  });

  it('keeps existing years and copies the last when the duration grows', () => {
    expect(planYears(5, {}, ['annual', 'semester', 'semester', 'semester']).yearPatterns).toEqual([
      'annual',
      'semester',
      'semester',
      'semester',
      'semester',
    ]);
  });
});

describe('calendars per pattern (one academic year, several calendars)', () => {
  const mba = { durationYears: 2, yearPatterns: ['trimester', 'trimester'] as YearTermPattern[] };
  const btech = {
    durationYears: 4,
    yearPatterns: ['annual', 'semester', 'semester', 'semester'] as YearTermPattern[],
  };

  it('keeps a trimester year out of semester terms and in its own trimesters', () => {
    expect(deriveTermNumber({ half: 'odd', pattern: 'semester' }, 1, mba)).toBeUndefined();
    expect(deriveTermNumber({ part: 3, pattern: 'trimester' }, 1, mba)).toBe(3);
  });

  it('keeps semester years out of trimester terms', () => {
    expect(deriveTermNumber({ part: 1, pattern: 'trimester' }, 2, btech)).toBeUndefined();
    expect(deriveTermNumber({ half: 'even', pattern: 'semester' }, 2, btech)).toBe(3);
  });

  it('lets an annual year sit in any non-trimester term', () => {
    expect(deriveTermNumber({ half: 'even', pattern: 'semester' }, 1, btech)).toBe(1);
    expect(deriveTermNumber({ part: 2, pattern: 'trimester' }, 1, btech)).toBeUndefined();
  });

  it('leaves untagged terms as before', () => {
    expect(termAppliesToYear(undefined, 'trimester')).toBe(true);
    expect(deriveTermNumber({ half: 'odd' }, 1, mba)).toBe(1);
  });
});

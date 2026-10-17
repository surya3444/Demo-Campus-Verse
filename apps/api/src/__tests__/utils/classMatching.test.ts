import { describe, it, expect } from 'vitest';
import { resolveClassByName, classMatchKeys } from '@campus-verse/shared/utils';

/**
 * Bulk-upload class resolution. The cases below are the spellings real import
 * sheets actually contain — and, just as importantly, the ones that MUST stay
 * unresolved: a bare "Year 1" belongs to every department, and guessing a
 * department for it would silently enrol students in the wrong programme.
 */

const school = [1, 2, 5, 10].map((g) => ({
  displayName: `Grade ${g}`,
  path: [{ levelKey: 'grade', name: `Grade ${g}`, code: `G${g}` }],
}));

const university = [
  {
    displayName: 'Computer Science · Year 1',
    path: [
      { levelKey: 'department', name: 'Computer Science', code: 'CS' },
      { levelKey: 'year', name: 'Year 1', code: 'Y1' },
    ],
  },
  {
    displayName: 'Computer Science · Year 2',
    path: [
      { levelKey: 'department', name: 'Computer Science', code: 'CS' },
      { levelKey: 'year', name: 'Year 2', code: 'Y2' },
    ],
  },
  {
    displayName: 'Mechanical Engineering · Year 1',
    path: [
      { levelKey: 'department', name: 'Mechanical Engineering', code: 'ME' },
      { levelKey: 'year', name: 'Year 1', code: 'Y1' },
    ],
  },
];

describe('resolveClassByName — school (single-level hierarchy)', () => {
  it.each([
    ['Grade 5', 'Grade 5'],
    ['grade 5', 'Grade 5'],
    ['GRADE 5', 'Grade 5'],
    ['G5', 'Grade 5'],
    ['g-5', 'Grade 5'],
    ['5', 'Grade 5'],
    ['Class 5', 'Grade 5'],
    ['Std 5', 'Grade 5'],
    ['Standard 10', 'Grade 10'],
    ['  10  ', 'Grade 10'],
  ])('resolves %j → %s', (input, expected) => {
    expect(resolveClassByName(input, school)?.displayName).toBe(expected);
  });

  it.each([['99'], ['Grade 99'], ['Nursery'], ['']])('refuses %j', (input) => {
    expect(resolveClassByName(input, school)).toBeNull();
  });
});

describe('resolveClassByName — university (department × year)', () => {
  it.each([
    ['Computer Science · Year 1', 'Computer Science · Year 1'],
    ['Computer Science Year 1', 'Computer Science · Year 1'],
    ['CS Year 1', 'Computer Science · Year 1'],
    ['CS Y1', 'Computer Science · Year 1'],
    ['CS-1', 'Computer Science · Year 1'],
    ['cs1', 'Computer Science · Year 1'],
    ['CS Year 2', 'Computer Science · Year 2'],
    ['ME Year 1', 'Mechanical Engineering · Year 1'],
    ['ME-1', 'Mechanical Engineering · Year 1'],
    ['mechanical engineering year 1', 'Mechanical Engineering · Year 1'],
  ])('resolves %j → %s', (input, expected) => {
    expect(resolveClassByName(input, university)?.displayName).toBe(expected);
  });

  // Ambiguity must fail loudly (the row shows as unresolved) rather than
  // silently picking whichever department happens to sort first.
  it.each([
    ['Year 1'], // three departments have a Year 1
    ['1'],
    ['Computer Science'], // two years under this department
    ['CS'],
    ['CSE 1'], // department code that does not exist
  ])('refuses ambiguous or unknown %j', (input) => {
    expect(resolveClassByName(input, university)).toBeNull();
  });
});

describe('classMatchKeys', () => {
  it('gives a single-level class a bare-number key', () => {
    expect(classMatchKeys(school[2])).toContain('5');
  });

  it('does NOT give a multi-level class a bare-number key', () => {
    expect(classMatchKeys(university[0]).has('1')).toBe(false);
  });

  it('handles a class with no path', () => {
    expect(resolveClassByName('Grade 5', [{ displayName: 'Grade 5' }])?.displayName).toBe(
      'Grade 5'
    );
  });

  it('tolerates empty path segments', () => {
    const keys = classMatchKeys({
      displayName: 'Grade 5',
      path: [{ levelKey: 'grade', name: '', code: '' }],
    });
    expect(keys).toContain('grade5');
  });
});

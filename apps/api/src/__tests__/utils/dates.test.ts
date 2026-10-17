import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  formatDate,
  formatDateTime,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  addDays,
  subtractDays,
  daysBetween,
  isDateInRange,
  getAge,
  getAcademicYear,
} from '../../utils/dates';

describe('formatDate', () => {
  it('formats Date object with default format', () => {
    const result = formatDate(new Date('2025-01-15'));
    expect(result).toBe('15/01/2025');
  });

  it('formats with custom format', () => {
    const result = formatDate(new Date('2025-01-15'), 'YYYY-MM-DD');
    expect(result).toBe('2025-01-15');
  });

  it('formats string date', () => {
    const result = formatDate('2025-06-20');
    expect(result).toBe('20/06/2025');
  });
});

describe('formatDateTime', () => {
  it('formats date with time', () => {
    const result = formatDateTime(new Date('2025-01-15T10:30:00Z'));
    expect(result).toMatch(/15\/01\/2025/);
    expect(result).toMatch(/\d{2}:\d{2}/);
  });

  it('uses custom format', () => {
    const result = formatDateTime(new Date('2025-01-15T10:30:00Z'), 'YYYY-MM-DD HH:mm:ss');
    expect(result).toMatch(/2025-01-15/);
  });
});

describe('startOfDay / endOfDay', () => {
  it('startOfDay returns midnight', () => {
    const result = startOfDay('2025-01-15T14:30:00');
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
  });

  it('endOfDay returns 23:59:59', () => {
    const result = endOfDay('2025-01-15T14:30:00');
    expect(result.getHours()).toBe(23);
    expect(result.getMinutes()).toBe(59);
    expect(result.getSeconds()).toBe(59);
  });
});

describe('startOfMonth / endOfMonth', () => {
  it('startOfMonth returns 1st of month', () => {
    const result = startOfMonth('2025-03-15');
    expect(result.getDate()).toBe(1);
  });

  it('endOfMonth returns last day of month', () => {
    const result = endOfMonth('2025-02-15');
    expect(result.getDate()).toBe(28); // 2025 is not leap year
  });

  it('endOfMonth handles leap year', () => {
    const result = endOfMonth('2024-02-15');
    expect(result.getDate()).toBe(29);
  });
});

describe('addDays / subtractDays', () => {
  it('adds days correctly', () => {
    const result = addDays('2025-01-28', 5);
    expect(result.getDate()).toBe(2);
    expect(result.getMonth()).toBe(1); // Feb
  });

  it('subtracts days correctly', () => {
    const result = subtractDays('2025-01-05', 10);
    expect(result.getMonth()).toBe(11); // Dec of prev year
    expect(result.getDate()).toBe(26);
  });
});

describe('daysBetween', () => {
  it('calculates days between two dates', () => {
    expect(daysBetween('2025-01-01', '2025-01-31')).toBe(30);
  });

  it('returns 0 for same date', () => {
    expect(daysBetween('2025-01-01', '2025-01-01')).toBe(0);
  });

  it('returns negative for reversed dates', () => {
    expect(daysBetween('2025-01-31', '2025-01-01')).toBe(-30);
  });
});

describe('isDateInRange', () => {
  it('returns true when date is in range', () => {
    expect(isDateInRange('2025-01-15', '2025-01-01', '2025-01-31')).toBe(true);
  });

  it('returns true on range boundaries (inclusive)', () => {
    expect(isDateInRange('2025-01-01', '2025-01-01', '2025-01-31')).toBe(true);
    expect(isDateInRange('2025-01-31', '2025-01-01', '2025-01-31')).toBe(true);
  });

  it('returns false when date is outside range', () => {
    expect(isDateInRange('2025-02-01', '2025-01-01', '2025-01-31')).toBe(false);
  });
});

describe('getAge', () => {
  it('calculates age from birth date', () => {
    const birthDate = new Date();
    birthDate.setFullYear(birthDate.getFullYear() - 15);
    expect(getAge(birthDate)).toBe(15);
  });

  it('returns 0 for current year birth', () => {
    const birthDate = new Date();
    expect(getAge(birthDate)).toBe(0);
  });
});

describe('getAcademicYear', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns current-next year format after April', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15'));
    expect(getAcademicYear()).toBe('2025-26');
    vi.useRealTimers();
  });

  it('returns prev-current year format before April', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-02-15'));
    expect(getAcademicYear()).toBe('2024-25');
    vi.useRealTimers();
  });

  it('returns current-next year in April', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-04-01'));
    expect(getAcademicYear()).toBe('2025-26');
    vi.useRealTimers();
  });
});

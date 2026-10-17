import { describe, it, expect, vi } from 'vitest';

vi.mock('../../config/database', () => ({ collections: {} }));
vi.mock('./../../modules/hr/hrSettings.service', () => ({ hrSettingsService: {} }));

import { countWorkingDays } from '../../modules/hr/leave.service';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const sundaysOff = { days: [0] };

describe('countWorkingDays', () => {
  it('counts a single weekday as one day', () => {
    expect(countWorkingDays(d('2026-10-14'), d('2026-10-14'), sundaysOff, new Set())).toBe(1);
  });

  it('skips weekly offs', () => {
    // Fri 16 → Mon 19 Oct 2026: Fri, Sat, Mon (Sunday off)
    expect(countWorkingDays(d('2026-10-16'), d('2026-10-19'), sundaysOff, new Set())).toBe(3);
  });

  it('skips the 2nd and 4th Saturday when the alternate rule is on', () => {
    const offs = { days: [0], alternateWeekday: { enabled: true, day: 6, pattern: 'alternate' } };
    // Oct 2026 Saturdays: 3 (1st), 10 (2nd), 17 (3rd), 24 (4th), 31 (5th)
    expect(countWorkingDays(d('2026-10-10'), d('2026-10-10'), offs, new Set())).toBe(0);
    expect(countWorkingDays(d('2026-10-17'), d('2026-10-17'), offs, new Set())).toBe(1);
    expect(countWorkingDays(d('2026-10-24'), d('2026-10-24'), offs, new Set())).toBe(0);
  });

  it('skips holidays', () => {
    const holidays = new Set(['2026-10-20']);
    // Mon 19 → Wed 21: Mon, Wed (Tue is a holiday)
    expect(countWorkingDays(d('2026-10-19'), d('2026-10-21'), sundaysOff, holidays)).toBe(2);
  });

  it('returns zero when every day is off', () => {
    expect(countWorkingDays(d('2026-10-18'), d('2026-10-18'), sundaysOff, new Set())).toBe(0);
  });
});

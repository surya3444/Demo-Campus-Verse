import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import isBetween from 'dayjs/plugin/isBetween';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);
dayjs.extend(isBetween);

const DEFAULT_TIMEZONE = 'Asia/Kolkata';

export function now(tz = DEFAULT_TIMEZONE): dayjs.Dayjs {
  return dayjs().tz(tz);
}

export function parseDate(
  date: string | Date,
  format?: string,
  tz = DEFAULT_TIMEZONE
): dayjs.Dayjs {
  if (format) {
    return dayjs(date, format).tz(tz);
  }
  return dayjs(date).tz(tz);
}

export function formatDate(date: Date | string | dayjs.Dayjs, format = 'DD/MM/YYYY'): string {
  return dayjs(date).format(format);
}

export function formatDateTime(
  date: Date | string | dayjs.Dayjs,
  format = 'DD/MM/YYYY HH:mm'
): string {
  return dayjs(date).format(format);
}

export function startOfDay(date: Date | string | dayjs.Dayjs): Date {
  return dayjs(date).startOf('day').toDate();
}

export function endOfDay(date: Date | string | dayjs.Dayjs): Date {
  return dayjs(date).endOf('day').toDate();
}

export function startOfMonth(date: Date | string | dayjs.Dayjs): Date {
  return dayjs(date).startOf('month').toDate();
}

export function endOfMonth(date: Date | string | dayjs.Dayjs): Date {
  return dayjs(date).endOf('month').toDate();
}

export function addDays(date: Date | string | dayjs.Dayjs, days: number): Date {
  return dayjs(date).add(days, 'day').toDate();
}

export function subtractDays(date: Date | string | dayjs.Dayjs, days: number): Date {
  return dayjs(date).subtract(days, 'day').toDate();
}

export function daysBetween(startDate: Date | string, endDate: Date | string): number {
  return dayjs(endDate).diff(dayjs(startDate), 'day');
}

export function isDateInRange(
  date: Date | string,
  startDate: Date | string,
  endDate: Date | string
): boolean {
  return dayjs(date).isBetween(startDate, endDate, 'day', '[]');
}

export function getAge(birthDate: Date | string): number {
  return dayjs().diff(dayjs(birthDate), 'year');
}

export function getAcademicYear(): string {
  const now = dayjs();
  const year = now.year();
  const month = now.month(); // 0-indexed

  // Academic year typically starts in April (month 3)
  if (month >= 3) {
    return `${year}-${(year + 1).toString().slice(-2)}`;
  }
  return `${year - 1}-${year.toString().slice(-2)}`;
}

/**
 * Parse a JWT-style duration string ("15m", "7d", "90d") into seconds.
 * Falls back when the string doesn't match `<number><s|m|h|d>`.
 */
export function parseDurationSeconds(duration: string, fallbackSeconds: number): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return fallbackSeconds;
  const value = parseInt(match[1], 10);
  const factor = { s: 1, m: 60, h: 3600, d: 86400 }[match[2] as 's' | 'm' | 'h' | 'd'];
  return value * factor;
}

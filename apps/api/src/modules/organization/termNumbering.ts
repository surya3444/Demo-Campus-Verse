import { ObjectId } from 'mongodb';
import {
  sessionTermPosition,
  termAppliesToYear,
  termNumberFor,
  yearTermRanges,
  YearTermPattern,
} from '@campus-verse/shared';
import { collections } from '../../config/database';

/**
 * Which absolute term a class is in during a session term.
 *
 * Terms are numbered across a program and each year has its own pattern
 * (annual / semester / trimester), so the number depends on the class's
 * program and year, not just the session term. One place for registration,
 * OBE offerings and report cards to ask.
 */

export type TermPlan = {
  durationYears: number;
  termPattern?: string;
  yearPatterns?: YearTermPattern[];
};

export interface SessionTerm {
  half?: 'odd' | 'even';
  part?: number;
  semesterNumber?: number;
  /** Calendar the term belongs to; a year of another pattern is not in it. */
  pattern?: YearTermPattern;
}

type PathEntry = { levelKey: string; name?: string; code?: string; order?: number };

/** Parse the year number out of a class path entry ("Year 2" / "Y2" / order). */
export function parseYearNumber(path: PathEntry[]): number | undefined {
  const yearEntry = path.find((p) => p.levelKey === 'year') ?? path[1];
  if (!yearEntry) return undefined;
  if (yearEntry.order !== undefined && yearEntry.order >= 1 && yearEntry.order <= 10) {
    return yearEntry.order;
  }
  const digits = (yearEntry.code ?? yearEntry.name ?? '').match(/(\d+)/);
  return digits ? parseInt(digits[1], 10) : undefined;
}

/**
 * Absolute term number, or undefined when the term carries neither an
 * explicit number nor a session position. A class with no program keeps the
 * classic two-semesters-per-year numbering.
 */
export function deriveTermNumber(
  term: SessionTerm,
  yearNumber?: number,
  plan?: TermPlan
): number | undefined {
  if (term.semesterNumber !== undefined) return term.semesterNumber;
  const position = sessionTermPosition(term);
  if (position === undefined || yearNumber === undefined) return undefined;
  // One academic year can run several calendars; a year only sits in terms
  // of its own calendar (an MBA trimester year is not in "Odd Semester").
  const yearPattern = plan ? yearTermRanges(plan)[yearNumber - 1]?.pattern : 'semester';
  if (yearPattern && !termAppliesToYear(term.pattern, yearPattern)) return undefined;
  return termNumberFor(
    plan ?? { durationYears: yearNumber, termPattern: 'semester' },
    yearNumber,
    position
  );
}

/** Term number per class id for one session term (classes that can't be resolved are omitted). */
export async function termNumbersForClasses(
  classIds: ObjectId[],
  term: SessionTerm
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (classIds.length === 0) return out;

  const classes = await collections.classes
    .find({ _id: { $in: classIds } })
    .project({ path: 1, programId: 1 })
    .toArray();
  const programIds = [
    ...new Set(
      classes
        .map((c) => c.programId)
        .filter(Boolean)
        .map(String)
    ),
  ];
  const plans = new Map(
    (programIds.length
      ? await collections.programs
          .find({ _id: { $in: programIds.map((id) => new ObjectId(id)) } })
          .project({ durationYears: 1, termPattern: 1, yearPatterns: 1 })
          .toArray()
      : []
    ).map((p) => [p._id.toString(), p as unknown as TermPlan])
  );

  for (const c of classes) {
    const number = deriveTermNumber(
      term,
      parseYearNumber((c.path ?? []) as PathEntry[]),
      c.programId ? plans.get(String(c.programId)) : undefined
    );
    if (number !== undefined) out.set(c._id.toString(), number);
  }
  return out;
}

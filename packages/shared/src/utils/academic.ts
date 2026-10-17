/**
 * Grade-code derivation shared by the API (fee matching) and the web app
 * (fee-structure assignment picker). Both sides MUST produce identical codes,
 * so this is the single source of truth — do not fork this logic locally.
 */

export interface GradeCodePathEntry {
  levelKey: string;
  name?: string;
  code?: string;
}

/**
 * Compute a stable grade code from a class's hierarchy path, e.g.
 *   [{levelKey:'grade', code:'G5'}]                     → "grade:G5"
 *   [{levelKey:'department', code:'CS'},
 *    {levelKey:'year', code:'Y1'}]                      → "department:CS/year:Y1"
 *
 * The code is batch-independent: the same path in any academic batch yields
 * the same code, which is what lets fee structures survive year-to-year.
 * Returns null when the class has no usable path.
 */
export function gradeCodeFor(classDoc: { path?: GradeCodePathEntry[] }): string | null {
  if (!classDoc.path?.length) return null;
  const segments = classDoc.path
    .map((p) => {
      const code = (p.code || p.name || '').trim();
      if (!code) return null;
      return `${p.levelKey}:${code}`;
    })
    .filter((s): s is string => !!s);
  return segments.length ? segments.join('/') : null;
}

// ─── Class-path ↔ department matching ───────────────────────────────────────

/**
 * Hierarchy level keys whose path entry denotes an academic department.
 * Universities use 'department', colleges use 'stream' (their streams function
 * as departments — registration already derives departmentCode from path[0]).
 * Schools ('grade') never resolve a department FK.
 */
export const DEPARTMENT_PATH_LEVEL_KEYS = ['department', 'stream'] as const;

export function isDepartmentLevelKey(levelKey: unknown): boolean {
  return (DEPARTMENT_PATH_LEVEL_KEYS as readonly string[]).includes(String(levelKey ?? ''));
}

/**
 * Match a class path's top entry to a department by code or name,
 * case-insensitive — the single convention shared by the Organization →
 * Departments overview, the Class.departmentId dual-write, and the backfill/
 * consistency scripts. Returns the matched department or null; never guesses
 * on partial matches.
 */
export function matchDepartmentForPathTop<T extends { code?: unknown; name?: unknown }>(
  pathTop: { code?: unknown; name?: unknown } | undefined,
  departments: T[]
): T | null {
  if (!pathTop) return null;
  const norm = (v: unknown) =>
    String(v ?? '')
      .trim()
      .toLowerCase();
  const topKeys = new Set([norm(pathTop.code), norm(pathTop.name)]);
  topKeys.delete('');
  if (topKeys.size === 0) return null;
  return departments.find((d) => topKeys.has(norm(d.code)) || topKeys.has(norm(d.name))) ?? null;
}

// ─── Subject sharing (Global / Core / Shared) ───────────────────────────────

/**
 * May a subject be attached to a curriculum in the given department context?
 * The single rule shared by the attach-point validation, the subject pickers,
 * and (later) teaching-assignment validation:
 * - no department context (schools, unresolved classes) → always usable
 * - 'global' → usable everywhere
 * - no owner set (legacy subjects) → unrestricted
 * - otherwise: usable by the owner, plus offeredToDepartmentIds for 'shared'
 */
export function isSubjectUsableByDepartment(
  subject: {
    sharing?: string | null;
    ownerDepartmentId?: unknown;
    offeredToDepartmentIds?: unknown[] | null;
  },
  departmentId: string | null | undefined
): boolean {
  if (!departmentId) return true;
  if (subject.sharing === 'global') return true;
  if (!subject.ownerDepartmentId) return true;
  if (String(subject.ownerDepartmentId) === departmentId) return true;
  if (subject.sharing === 'shared') {
    return (subject.offeredToDepartmentIds ?? []).some((id) => String(id) === departmentId);
  }
  return false;
}

// ─── Class-name matching (bulk upload) ──────────────────────────────────────

/**
 * Normalise a class label for comparison: case-folded, punctuation and
 * whitespace removed. "Computer Science · Year 1" and "computer-science year1"
 * both collapse to "computerscienceyear1".
 */
function normaliseClassLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Words that carry no identity of their own — they name the *level*, not the
 * class, so "Class 5" / "Std 5" / "5" all mean the same grade.
 */
const GENERIC_LEVEL_WORDS = new Set([
  '',
  'class',
  'grade',
  'std',
  'standard',
  'level',
  'year',
  'yr',
  'sem',
  'semester',
  'form',
  'div',
  'division',
]);

/** Trailing number in a segment, e.g. "Year 1" → "1", "G5" → "5". */
function segmentNumber(entry: GradeCodePathEntry): string | null {
  const source = `${entry.name ?? ''} ${entry.code ?? ''}`;
  const match = source.match(/(\d+)/);
  return match ? match[1] : null;
}

/**
 * Every spelling of a class that a human might reasonably put in a spreadsheet.
 *
 * A school class has one path level ("Grade 5") and accepts the bare number,
 * because nothing else can collide. A university class has two ("Computer
 * Science" × "Year 1"), so it accepts every name/code combination of its
 * segments — "CS Year 1", "CS-1", "Computer Science Year 1" — but deliberately
 * NOT a bare "1" or "Year 1", which every department shares.
 */
export function classMatchKeys(cls: {
  displayName?: string;
  path?: GradeCodePathEntry[];
}): Set<string> {
  const keys = new Set<string>();
  if (cls.displayName) keys.add(normaliseClassLabel(cls.displayName));

  const path = (cls.path ?? []).filter((p) => (p.name ?? p.code ?? '').trim());
  if (path.length === 0) return keys;

  // Cartesian product over each segment's {name, code, trailing number}.
  const perSegment = path.map((entry) => {
    const forms = new Set<string>();
    if (entry.name?.trim()) forms.add(normaliseClassLabel(entry.name));
    if (entry.code?.trim()) forms.add(normaliseClassLabel(entry.code));
    // The number alone is only unambiguous for the LAST segment (the year or
    // grade); a leading segment reduced to a number would be meaningless.
    return forms;
  });
  const lastNumber = segmentNumber(path[path.length - 1]);
  if (lastNumber) perSegment[perSegment.length - 1].add(lastNumber);

  let combos: string[] = [''];
  for (const forms of perSegment) {
    const next: string[] = [];
    for (const prefix of combos) for (const form of forms) next.push(prefix + form);
    combos = next;
  }
  for (const combo of combos) if (combo) keys.add(combo);

  // Single-level hierarchies (schools) also accept the bare grade number.
  if (path.length === 1 && lastNumber) keys.add(lastNumber);

  return keys;
}

/**
 * Resolve a free-text class name from a spreadsheet to exactly one class.
 * Returns null when nothing matches or when the value is ambiguous — callers
 * should surface the row for manual correction rather than guess.
 */
export function resolveClassByName<T extends { displayName?: string; path?: GradeCodePathEntry[] }>(
  value: string,
  classes: T[]
): T | null {
  const needle = normaliseClassLabel(value ?? '');
  if (!needle) return null;

  const exact = classes.filter((c) => classMatchKeys(c).has(needle));
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null; // ambiguous — don't guess

  // "Class 5" for a school whose classes are named "Grade 5": the number is the
  // only load-bearing part, and the rest is a generic word for the level. Only
  // the number is matched, and only against classes that publish a bare-number
  // key — which single-level (school) hierarchies do and universities don't, so
  // "Year 1" across four departments still refuses to resolve.
  const number = needle.match(/^([a-z]*)(\d+)$/);
  if (number && GENERIC_LEVEL_WORDS.has(number[1])) {
    const byNumber = classes.filter((c) => classMatchKeys(c).has(number[2]));
    if (byNumber.length === 1) return byNumber[0];
    if (byNumber.length > 1) return null;
  }

  // Last resort: a unique substring match against the full display name.
  const partial = classes.filter((c) => {
    const label = normaliseClassLabel(c.displayName ?? '');
    return !!label && (label.includes(needle) || needle.includes(label));
  });
  return partial.length === 1 ? partial[0] : null;
}

// ─── Program year patterns ──────────────────────────────────────────────────
//
// A program's years need not share one term pattern: B.Pharm-style programs
// run an annual first year and semesters after it, and any mix is allowed.
// Terms are numbered across the whole program — year 1 annual is term 1, so
// year 2's semesters are terms 2 and 3. Every module that needs "which term
// is a Year-N student in right now" goes through termNumberFor.

export type YearTermPattern = 'annual' | 'semester' | 'trimester';

export const YEAR_TERM_PATTERNS: YearTermPattern[] = ['annual', 'semester', 'trimester'];

/** Terms in one year of the given pattern. */
export function termsPerYear(pattern: YearTermPattern): number {
  return pattern === 'annual' ? 1 : pattern === 'trimester' ? 3 : 2;
}

interface ProgramTermShape {
  durationYears: number;
  termPattern?: string;
  yearPatterns?: YearTermPattern[] | null;
}

/**
 * One pattern per year. Programs saved before per-year patterns existed (or
 * with a uniform pattern) fall back to `termPattern` for every year.
 */
export function resolveYearPatterns(program: ProgramTermShape): YearTermPattern[] {
  const fallback: YearTermPattern = YEAR_TERM_PATTERNS.includes(
    program.termPattern as YearTermPattern
  )
    ? (program.termPattern as YearTermPattern)
    : 'semester';
  return Array.from(
    { length: Math.max(1, program.durationYears) },
    (_, i) => program.yearPatterns?.[i] ?? fallback
  );
}

/** Total terms across the program — what `totalSemesters` stores. */
export function totalTermsFor(program: ProgramTermShape): number {
  return resolveYearPatterns(program).reduce((sum, p) => sum + termsPerYear(p), 0);
}

/** `termPattern` for storage: the shared pattern, or 'mixed'. */
export function summarizeTermPattern(patterns: YearTermPattern[]): YearTermPattern | 'mixed' {
  return patterns.every((p) => p === patterns[0]) ? patterns[0] : 'mixed';
}

/** The absolute term numbers each year spans, for pickers and labels. */
export function yearTermRanges(
  program: ProgramTermShape
): Array<{ year: number; pattern: YearTermPattern; first: number; last: number }> {
  let next = 1;
  return resolveYearPatterns(program).map((pattern, i) => {
    const first = next;
    next += termsPerYear(pattern);
    return { year: i + 1, pattern, first, last: next - 1 };
  });
}

/**
 * Position of a session term within the academic year: 1, 2 or 3. Two-term
 * calendars use half ('odd' = 1, 'even' = 2); trimester calendars set part.
 */
/**
 * Does a session term apply to a program year of this pattern? Untagged terms
 * apply to every year. A trimester year runs only on trimester terms, a
 * semester year only on semester terms; an annual year spans the session, so
 * any non-trimester term carries it.
 */
export function termAppliesToYear(
  termPattern: YearTermPattern | undefined,
  yearPattern: YearTermPattern
): boolean {
  if (!termPattern) return true;
  if (yearPattern === 'annual') return termPattern !== 'trimester';
  return termPattern === yearPattern;
}

export function sessionTermPosition(term: { half?: string; part?: number }): number | undefined {
  if (term.part !== undefined) return term.part;
  if (term.half === 'odd') return 1;
  if (term.half === 'even') return 2;
  return undefined;
}

/**
 * Absolute term number a Year-N student is in during a session term.
 *
 * An annual year has one term for the whole session; a semester year maps
 * the session's halves to its two terms; a trimester year maps parts 1-3.
 * ponytail: a semester year in a three-part session treats part 3 as its
 * second term; a trimester year in a two-part calendar never reaches its
 * third term — run trimester years on a trimester (part 1-3) calendar.
 */
export function termNumberFor(
  program: ProgramTermShape,
  yearNumber: number,
  position: number
): number | undefined {
  const range = yearTermRanges(program)[yearNumber - 1];
  if (!range) return undefined;
  const termsInYear = range.last - range.first + 1;
  return range.first + Math.min(Math.max(position, 1), termsInYear) - 1;
}

/** "Year 1 (annual)" / "Sem 3" style label for an absolute term number. */
export function termLabelFor(program: ProgramTermShape, termNumber: number): string {
  const range = yearTermRanges(program).find((r) => termNumber >= r.first && termNumber <= r.last);
  if (!range) return `Term ${termNumber}`;
  if (range.pattern === 'annual') return `Year ${range.year} (annual)`;
  const noun = range.pattern === 'trimester' ? 'Trimester' : 'Sem';
  return `${noun} ${termNumber} · Year ${range.year}`;
}

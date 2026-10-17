/**
 * Exam & Report Card constants
 *
 * Defines:
 * - Exam types Indian schools recognise (unit test, mid-term, half-yearly, etc.)
 * - Board presets that auto-load grading scales + co-scholastic settings
 * - Default grading-scale bands per board
 * - Default co-scholastic areas (CBSE preset)
 *
 * The tenant's exam settings record stores their effective values; these
 * constants only seed the defaults the user can later customise.
 */

export const EXAM_TYPES = [
  'unit_test',
  'mid_term',
  'half_yearly',
  'annual',
  'final',
  'custom',
] as const;

export type ExamType = (typeof EXAM_TYPES)[number];

export const EXAM_TYPE_LABELS: Record<ExamType, string> = {
  unit_test: 'Unit Test',
  mid_term: 'Mid-Term Exam',
  half_yearly: 'Half-Yearly Exam',
  annual: 'Annual Exam',
  final: 'Final Exam',
  custom: 'Custom',
};

export const EXAM_STATUSES = [
  'draft',
  'scheduled',
  'ongoing',
  'completed',
  'results_published',
  'cancelled',
] as const;

export type ExamStatus = (typeof EXAM_STATUSES)[number];

export const BOARD_PRESETS = ['cbse', 'icse', 'ugc', 'custom'] as const;
export type BoardPreset = (typeof BOARD_PRESETS)[number];

export interface GradingScaleBand {
  /** Inclusive lower bound, percentage 0–100. */
  minPercent: number;
  /** Inclusive upper bound, percentage 0–100. */
  maxPercent: number;
  /** Letter/symbol shown to users (e.g. 'A1', 'B+', 'Pass'). */
  grade: string;
  /** Optional grade points (10-point system for CBSE etc.). */
  points?: number;
  /** Optional descriptor surfaced on report cards. */
  remark?: string;
}

/**
 * CBSE 9-point grading scale.
 * https://www.cbse.gov.in — A1 (10) to E2 (failure).
 */
export const CBSE_GRADING_SCALE: GradingScaleBand[] = [
  { minPercent: 91, maxPercent: 100, grade: 'A1', points: 10, remark: 'Outstanding' },
  { minPercent: 81, maxPercent: 90, grade: 'A2', points: 9, remark: 'Excellent' },
  { minPercent: 71, maxPercent: 80, grade: 'B1', points: 8, remark: 'Very Good' },
  { minPercent: 61, maxPercent: 70, grade: 'B2', points: 7, remark: 'Good' },
  { minPercent: 51, maxPercent: 60, grade: 'C1', points: 6, remark: 'Above Average' },
  { minPercent: 41, maxPercent: 50, grade: 'C2', points: 5, remark: 'Average' },
  { minPercent: 33, maxPercent: 40, grade: 'D', points: 4, remark: 'Pass' },
  { minPercent: 21, maxPercent: 32, grade: 'E1', points: 0, remark: 'Needs Improvement' },
  { minPercent: 0, maxPercent: 20, grade: 'E2', points: 0, remark: 'Unsatisfactory' },
];

/**
 * Generic ICSE / percentage-style scale (broad bands, schools typically tune).
 */
export const ICSE_GRADING_SCALE: GradingScaleBand[] = [
  { minPercent: 90, maxPercent: 100, grade: 'A', points: 5, remark: 'Distinction' },
  { minPercent: 75, maxPercent: 89, grade: 'B', points: 4, remark: 'First Class' },
  { minPercent: 60, maxPercent: 74, grade: 'C', points: 3, remark: 'Second Class' },
  { minPercent: 40, maxPercent: 59, grade: 'D', points: 2, remark: 'Pass' },
  { minPercent: 0, maxPercent: 39, grade: 'E', points: 0, remark: 'Fail' },
];

export const DEFAULT_CO_SCHOLASTIC_AREAS: string[] = [
  'Work Education',
  'Art Education',
  'Health & Physical Education',
  'Discipline',
  'Attitude & Values',
];

/**
 * Letter grades used for co-scholastic assessment (CBSE preset).
 * Schools can override in settings.
 */
export const DEFAULT_CO_SCHOLASTIC_GRADES = ['A', 'B', 'C', 'D'] as const;

/**
 * UGC 10-point letter scale (CBCS) — the standard for Indian universities and
 * autonomous colleges. `points` feeds credit-weighted SGPA/CGPA, so these
 * values are the ones that show up on transcripts.
 *
 * Note the pass boundary differs sharply from CBSE: F below 40 (not 33), so a
 * 35% score is a backlog here where CBSE would award 4 points and a pass.
 */
export const UGC_GRADING_SCALE: GradingScaleBand[] = [
  { minPercent: 90, maxPercent: 100, grade: 'O', points: 10, remark: 'Outstanding' },
  { minPercent: 80, maxPercent: 89, grade: 'A+', points: 9, remark: 'Excellent' },
  { minPercent: 70, maxPercent: 79, grade: 'A', points: 8, remark: 'Very Good' },
  { minPercent: 60, maxPercent: 69, grade: 'B+', points: 7, remark: 'Good' },
  { minPercent: 50, maxPercent: 59, grade: 'B', points: 6, remark: 'Above Average' },
  { minPercent: 45, maxPercent: 49, grade: 'C', points: 5, remark: 'Average' },
  { minPercent: 40, maxPercent: 44, grade: 'P', points: 4, remark: 'Pass' },
  { minPercent: 0, maxPercent: 39, grade: 'F', points: 0, remark: 'Fail' },
];

export interface BoardPresetConfig {
  gradingScale: GradingScaleBand[];
  coScholasticEnabled: boolean;
  coScholasticAreas: string[];
  passMarkPercent: number;
}

export const BOARD_PRESET_CONFIG: Record<Exclude<BoardPreset, 'custom'>, BoardPresetConfig> = {
  cbse: {
    gradingScale: CBSE_GRADING_SCALE,
    coScholasticEnabled: true,
    coScholasticAreas: DEFAULT_CO_SCHOLASTIC_AREAS,
    passMarkPercent: 33,
  },
  icse: {
    gradingScale: ICSE_GRADING_SCALE,
    coScholasticEnabled: false,
    coScholasticAreas: [],
    passMarkPercent: 40,
  },
  ugc: {
    gradingScale: UGC_GRADING_SCALE,
    // Co-scholastic is a school-board concept; universities don't grade
    // art/health/discipline alongside academics.
    coScholasticEnabled: false,
    coScholasticAreas: [],
    passMarkPercent: 40,
  },
};

/** The preset a newly-created branch should start on, by institution type. */
export function defaultBoardPresetFor(institutionType?: string): BoardPreset {
  return institutionType === 'college' || institutionType === 'university' ? 'ugc' : 'cbse';
}

/**
 * Look up the grade band a percentage falls into. Returns null if no band
 * matches (caller should treat as ungraded / configure scale).
 */
export function gradeForPercent(
  percent: number,
  scale: GradingScaleBand[]
): GradingScaleBand | null {
  for (const band of scale) {
    if (percent >= band.minPercent && percent <= band.maxPercent) return band;
  }
  return null;
}

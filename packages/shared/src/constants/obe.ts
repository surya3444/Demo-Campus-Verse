/**
 * OBE (Outcome Based Education) constants — Bloom's taxonomy, NBA/MBA Program
 * Outcome presets, mapping strengths, and default attainment settings.
 *
 * The attainment methodology (thresholds, level bands, weights) follows the
 * standard NBA process; every number here is only a default — branches tune
 * them in obe_settings.
 */

// ── Bloom's taxonomy ──────────────────────────────────────────────────────────

export const BLOOM_LEVELS = [
  {
    level: 1,
    code: 'L1',
    name: 'Remember',
    description: 'Recalling facts, terms and basic concepts',
  },
  {
    level: 2,
    code: 'L2',
    name: 'Understand',
    description: 'Explaining ideas or concepts in your own words',
  },
  {
    level: 3,
    code: 'L3',
    name: 'Apply',
    description: 'Using knowledge in new situations or solving problems',
  },
  {
    level: 4,
    code: 'L4',
    name: 'Analyze',
    description: 'Breaking information into parts and understanding relationships',
  },
  {
    level: 5,
    code: 'L5',
    name: 'Evaluate',
    description: 'Making judgments based on evidence and criteria',
  },
  {
    level: 6,
    code: 'L6',
    name: 'Create',
    description: 'Generating new ideas, products or ways of thinking',
  },
] as const;

export type BloomLevel = (typeof BLOOM_LEVELS)[number]['level'];

// ── CO→PO/PSO mapping strengths ───────────────────────────────────────────────

export const MAPPING_STRENGTHS = [
  { value: 1, label: 'Slight (Low)' },
  { value: 2, label: 'Moderate (Medium)' },
  { value: 3, label: 'Substantial (High)' },
] as const;

export type MappingStrength = (typeof MAPPING_STRENGTHS)[number]['value'];

// ── Program Outcome presets ───────────────────────────────────────────────────

export interface PoPresetItem {
  code: string;
  title: string;
  statement: string;
}

/** NBA Graduate Attributes — common to all UG engineering programs. */
export const NBA_UG_ENGINEERING_POS: PoPresetItem[] = [
  {
    code: 'PO1',
    title: 'Engineering Knowledge',
    statement:
      'Apply knowledge of mathematics, science, engineering fundamentals and specialization to solve complex engineering problems.',
  },
  {
    code: 'PO2',
    title: 'Problem Analysis',
    statement:
      'Identify, formulate, review research literature and analyze complex problems using first principles of mathematics, natural sciences and engineering sciences.',
  },
  {
    code: 'PO3',
    title: 'Design / Development of Solutions',
    statement:
      'Design solutions and system components that meet specified needs with consideration for society, safety, culture and environment.',
  },
  {
    code: 'PO4',
    title: 'Conduct Investigations of Complex Problems',
    statement:
      'Use research-based knowledge and research methods to analyze, interpret data and synthesize the information to provide valid conclusions.',
  },
  {
    code: 'PO5',
    title: 'Modern Tool Usage',
    statement:
      'Create, select and apply appropriate modern engineering and IT tools including prediction and modeling with an understanding of their limitations.',
  },
  {
    code: 'PO6',
    title: 'The Engineer and Society',
    statement:
      'Apply reasoning informed by the contextual knowledge to assess societal, health, safety, legal and cultural issues.',
  },
  {
    code: 'PO7',
    title: 'Environment and Sustainability',
    statement:
      'Understand the impact of engineering solutions in environmental contexts and demonstrate the need for sustainable development.',
  },
  {
    code: 'PO8',
    title: 'Ethics',
    statement:
      'Apply ethical principles and commit to professional ethics and responsibilities and norms of the engineering practice.',
  },
  {
    code: 'PO9',
    title: 'Individual and Team Work',
    statement:
      'Function effectively as an individual, and as a member or leader in diverse teams and multidisciplinary settings.',
  },
  {
    code: 'PO10',
    title: 'Communication',
    statement:
      'Communicate effectively on complex engineering activities with the engineering community and with society.',
  },
  {
    code: 'PO11',
    title: 'Project Management and Finance',
    statement:
      'Apply engineering and management principles to manage projects and finance in multidisciplinary environments.',
  },
  {
    code: 'PO12',
    title: 'Life-long Learning',
    statement:
      'Recognize the need for, and have the preparation and ability to engage in independent and life-long learning.',
  },
];

/** NBA PG (M.Tech) program outcomes. PSOs are not required for PG programs. */
export const NBA_PG_POS: PoPresetItem[] = [
  {
    code: 'PO1',
    title: 'Research and Investigation',
    statement:
      'An ability to independently carry out research / investigation and development work to solve practical problems.',
  },
  {
    code: 'PO2',
    title: 'Technical Communication',
    statement: 'An ability to write and present a substantial technical report / document.',
  },
  {
    code: 'PO3',
    title: 'Mastery in Specialization',
    statement:
      'Demonstrate a degree of mastery over the area as per the specialization of the program, at a level higher than the requirements of the appropriate bachelor program.',
  },
];

/** MBA program outcomes. PSOs are not required for MBA programs. */
export const MBA_POS: PoPresetItem[] = [
  {
    code: 'PO1',
    title: 'Management Knowledge',
    statement: 'Apply knowledge of management theories and practices to solve business problems.',
  },
  {
    code: 'PO2',
    title: 'Analytical and Critical Thinking',
    statement: 'Foster analytical and critical thinking abilities for data-based decision making.',
  },
  {
    code: 'PO3',
    title: 'Value-Based Leadership',
    statement: 'Ability to develop value based leadership ability.',
  },
  {
    code: 'PO4',
    title: 'Global, Economic, Legal and Ethical Understanding',
    statement:
      'Ability to understand, analyze and communicate global, economic, legal, and ethical aspects of business.',
  },
  {
    code: 'PO5',
    title: 'Leadership and Teamwork',
    statement:
      'Ability to lead themselves and others in the achievement of organizational goals, contributing effectively to a team environment.',
  },
];

export const OBE_PO_PRESETS = {
  nba_ug_engineering: { name: 'NBA UG Engineering (12 POs)', pos: NBA_UG_ENGINEERING_POS },
  nba_pg: { name: 'NBA PG / M.Tech (3 POs)', pos: NBA_PG_POS },
  mba: { name: 'MBA (5 POs)', pos: MBA_POS },
  custom: { name: 'Custom', pos: [] as PoPresetItem[] },
} as const;

export type ObeProgramPreset = keyof typeof OBE_PO_PRESETS;

/** Programs may add at most this many custom POs on top of a preset. */
export const MAX_CUSTOM_POS = 3;

// ── Offering lifecycle ────────────────────────────────────────────────────────

export const OBE_OFFERING_STATUSES = ['draft', 'data_entry', 'computed', 'finalized'] as const;
export type ObeOfferingStatus = (typeof OBE_OFFERING_STATUSES)[number];

export const OBE_SURVEY_STATUSES = ['not_started', 'open', 'closed'] as const;
export type ObeSurveyStatus = (typeof OBE_SURVEY_STATUSES)[number];

export const OBE_INSTRUMENT_KINDS = ['internal', 'external'] as const;
export type ObeInstrumentKind = (typeof OBE_INSTRUMENT_KINDS)[number];

// ── Default attainment settings ───────────────────────────────────────────────

export interface ObeLevelBand {
  level: number;
  /** Minimum percent (of students clearing the threshold) that earns this level. */
  minPercent: number;
}

export interface ObeSettingsValues {
  /** A student "clears" an internal question/component at >= this % of its max marks. */
  internalThresholdPercent: number;
  /** Attainment level from % of attempting students clearing the internal threshold. */
  internalLevelBands: ObeLevelBand[];
  /** Attainment level from % of students scoring >= passMarks in the external exam. */
  externalLevelBands: ObeLevelBand[];
  /** Direct CO attainment = internal × w.internal + external × w.external. */
  directWeights: { internal: number; external: number };
  /** Overall CO attainment = direct × w.direct + indirect × w.indirect. */
  overallWeights: { direct: number; indirect: number };
  /** COs at or above this overall level are considered attained. */
  targetAttainmentLevel: number;
  /** Scale maximum — divisor in the PO formula and the survey rating cap. */
  maxAttainmentLevel: number;
}

export const DEFAULT_OBE_SETTINGS: ObeSettingsValues = {
  internalThresholdPercent: 60,
  internalLevelBands: [
    { level: 1, minPercent: 60 },
    { level: 2, minPercent: 80 },
    { level: 3, minPercent: 90 },
  ],
  externalLevelBands: [
    { level: 1, minPercent: 50 },
    { level: 2, minPercent: 60 },
    { level: 3, minPercent: 70 },
  ],
  directWeights: { internal: 0.2, external: 0.8 },
  overallWeights: { direct: 0.9, indirect: 0.1 },
  targetAttainmentLevel: 2,
  maxAttainmentLevel: 3,
};

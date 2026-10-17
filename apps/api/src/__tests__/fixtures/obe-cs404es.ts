/**
 * Golden-master fixture: course CS404ES (Formal Languages and Automata Theory)
 * from the client's OBE methodology document — 6 COs, Mid-1/Mid-2 each with an
 * Objective+Assignment component and a 4-set descriptive test, a 75-mark end
 * semester exam (pass 26) and a 33-respondent course-end survey.
 *
 * Mid-1 descriptive SET-1 uses the document's REAL question-wise marks
 * (Annexure-1, 14 students). Other sets are synthesized to reproduce the
 * document's published set-wise CO values exactly, since their raw rows are
 * not included in the document.
 *
 * Where the document's own arithmetic slips (its course average prints 2.72
 * but its six CO overalls average to 2.713), the expectations here assert the
 * formula-consistent value with a note.
 */
import type {
  EngineMarksRow,
  EngineSet,
  OfferingComputeInput,
} from '../../modules/obe/attainment.engine';
import { DEFAULT_OBE_SETTINGS } from '@campus-verse/shared/constants';

const CO = ['co1', 'co2', 'co3', 'co4', 'co5', 'co6'];
const PO_IDS = Array.from({ length: 12 }, (_, i) => `po${i + 1}`);
const PSO_IDS = ['pso1', 'pso2', 'pso3'];

/**
 * Synthesize rows for one set where each student attempts exactly one item:
 * `cleared` students score full marks (> threshold), the rest score 0.
 */
function syntheticRows(
  setId: string,
  items: { itemId: string; maxMarks: number; attempted: number; cleared: number }[]
): EngineMarksRow[] {
  const rows: EngineMarksRow[] = [];
  for (const item of items) {
    for (let i = 0; i < item.attempted; i++) {
      rows.push({
        studentId: `syn-${setId}-${item.itemId}-${i}`,
        absent: false,
        setId,
        marks: { [item.itemId]: i < item.cleared ? item.maxMarks : 0 },
      });
    }
  }
  return rows;
}

/** Single-component set (Objective+Assignment): one 15-mark item, threshold 9. */
function objAssignInstrument(
  instrumentId: string,
  name: string,
  coIds: string[],
  cleared: number,
  attempted: number
) {
  const setId = `${instrumentId}-set`;
  const itemId = `${instrumentId}-item`;
  const rows: EngineMarksRow[] = Array.from({ length: attempted }, (_, i) => ({
    studentId: `syn-${instrumentId}-${i}`,
    absent: false,
    setId,
    // 10 clears (10 > 9); 9 attempts without clearing (9 > 9 is false).
    marks: { [itemId]: i < cleared ? 10 : 9 },
  }));
  const sets: EngineSet[] = [
    {
      setId,
      label: 'SET-1',
      items: [{ itemId, label: 'OBJ+ASSIG', coIds, maxMarks: 15 }],
    },
  ];
  return {
    instrumentId,
    name,
    kind: 'internal' as const,
    thresholdPercent: 60,
    sets,
    rows,
  };
}

/** Annexure-1 SET-1 — the document's real question-wise marks (14 students). */
export const MID1_DESC_SET1_ROWS: EngineMarksRow[] = [
  { studentId: 's01', absent: false, setId: 'm1d-s1', marks: { q11: 4, q14: 3 } },
  { studentId: 's02', absent: false, setId: 'm1d-s1', marks: { q12: 5, q13: 5 } },
  { studentId: 's03', absent: false, setId: 'm1d-s1', marks: { q11: 5, q12: 5 } },
  { studentId: 's04', absent: false, setId: 'm1d-s1', marks: { q13: 5, q14: 5 } },
  { studentId: 's05', absent: false, setId: 'm1d-s1', marks: { q13: 5, q14: 5 } },
  { studentId: 's06', absent: false, setId: 'm1d-s1', marks: { q13: 5, q14: 5 } },
  { studentId: 's07', absent: false, setId: 'm1d-s1', marks: { q11: 5, q14: 5 } },
  { studentId: 's08', absent: false, setId: 'm1d-s1', marks: { q13: 5, q14: 5 } },
  { studentId: 's09', absent: false, setId: 'm1d-s1', marks: { q11: 5, q13: 5 } },
  { studentId: 's10', absent: false, setId: 'm1d-s1', marks: { q11: 1, q13: 5 } },
  { studentId: 's11', absent: false, setId: 'm1d-s1', marks: { q11: 5, q12: 5 } },
  { studentId: 's12', absent: false, setId: 'm1d-s1', marks: { q14: 5 } },
  { studentId: 's13', absent: false, setId: 'm1d-s1', marks: { q11: 5, q13: 5 } },
  { studentId: 's14', absent: false, setId: 'm1d-s1', marks: { q14: 5 } },
];

function mid1Descriptive() {
  const sets: EngineSet[] = [
    {
      setId: 'm1d-s1',
      label: 'SET-1',
      items: [
        { itemId: 'q11', label: 'Q1', coIds: ['co1'], maxMarks: 5 },
        { itemId: 'q12', label: 'Q2', coIds: ['co2'], maxMarks: 5 },
        { itemId: 'q13', label: 'Q3', coIds: ['co2'], maxMarks: 5 },
        { itemId: 'q14', label: 'Q4', coIds: ['co3'], maxMarks: 5 },
      ],
    },
    // SET-2 → CO values 2 / 3 / 1 (document: CO1 via two L2 questions).
    {
      setId: 'm1d-s2',
      label: 'SET-2',
      items: [
        { itemId: 'q21', label: 'Q1', coIds: ['co1'], maxMarks: 5 },
        { itemId: 'q22', label: 'Q2', coIds: ['co1'], maxMarks: 5 },
        { itemId: 'q23', label: 'Q3', coIds: ['co2'], maxMarks: 5 },
        { itemId: 'q24', label: 'Q4', coIds: ['co3'], maxMarks: 5 },
      ],
    },
    // SET-3 → CO values 2 / 1 / 3.
    {
      setId: 'm1d-s3',
      label: 'SET-3',
      items: [
        { itemId: 'q31', label: 'Q1', coIds: ['co1'], maxMarks: 5 },
        { itemId: 'q32', label: 'Q2', coIds: ['co2'], maxMarks: 5 },
        { itemId: 'q33', label: 'Q3', coIds: ['co3'], maxMarks: 5 },
      ],
    },
    // SET-4 → CO values 3 / 3 / 3.
    {
      setId: 'm1d-s4',
      label: 'SET-4',
      items: [
        { itemId: 'q41', label: 'Q1', coIds: ['co1'], maxMarks: 5 },
        { itemId: 'q42', label: 'Q2', coIds: ['co2'], maxMarks: 5 },
        { itemId: 'q43', label: 'Q3', coIds: ['co3'], maxMarks: 5 },
      ],
    },
  ];
  const rows: EngineMarksRow[] = [
    ...MID1_DESC_SET1_ROWS,
    // 80% → L2, 80% → L2, 100% → L3, 66.67% → L1
    ...syntheticRows('m1d-s2', [
      { itemId: 'q21', maxMarks: 5, attempted: 10, cleared: 8 },
      { itemId: 'q22', maxMarks: 5, attempted: 5, cleared: 4 },
      { itemId: 'q23', maxMarks: 5, attempted: 3, cleared: 3 },
      { itemId: 'q24', maxMarks: 5, attempted: 6, cleared: 4 },
    ]),
    // L2 / L1 / L3
    ...syntheticRows('m1d-s3', [
      { itemId: 'q31', maxMarks: 5, attempted: 10, cleared: 8 },
      { itemId: 'q32', maxMarks: 5, attempted: 10, cleared: 6 },
      { itemId: 'q33', maxMarks: 5, attempted: 10, cleared: 9 },
    ]),
    // L3 / L3 / L3
    ...syntheticRows('m1d-s4', [
      { itemId: 'q41', maxMarks: 5, attempted: 10, cleared: 10 },
      { itemId: 'q42', maxMarks: 5, attempted: 10, cleared: 10 },
      { itemId: 'q43', maxMarks: 5, attempted: 10, cleared: 10 },
    ]),
  ];
  return {
    instrumentId: 'mid1-desc',
    name: 'Mid-1 Descriptive',
    kind: 'internal' as const,
    thresholdPercent: 60,
    sets,
    rows,
  };
}

function mid2Descriptive() {
  const sets: EngineSet[] = [
    // SET-1 → CO4 2, CO5 2, CO6 — (no CO6 question in this set).
    {
      setId: 'm2d-s1',
      label: 'SET-1',
      items: [
        { itemId: 'r11', label: 'Q1', coIds: ['co4'], maxMarks: 5 },
        { itemId: 'r12', label: 'Q2', coIds: ['co5'], maxMarks: 5 },
      ],
    },
    // SET-2 → CO4 2.5 (L2+L3), CO5 3, CO6 1.
    {
      setId: 'm2d-s2',
      label: 'SET-2',
      items: [
        { itemId: 'r21', label: 'Q1', coIds: ['co4'], maxMarks: 5 },
        { itemId: 'r22', label: 'Q2', coIds: ['co4'], maxMarks: 5 },
        { itemId: 'r23', label: 'Q3', coIds: ['co5'], maxMarks: 5 },
        { itemId: 'r24', label: 'Q4', coIds: ['co6'], maxMarks: 5 },
      ],
    },
    // SET-3 → CO4 3, CO5 —, CO6 2.5 (L2+L3).
    {
      setId: 'm2d-s3',
      label: 'SET-3',
      items: [
        { itemId: 'r31', label: 'Q1', coIds: ['co4'], maxMarks: 5 },
        { itemId: 'r32', label: 'Q2', coIds: ['co6'], maxMarks: 5 },
        { itemId: 'r33', label: 'Q3', coIds: ['co6'], maxMarks: 5 },
      ],
    },
    // SET-4 → CO4 2.5, CO5 3, CO6 1.
    {
      setId: 'm2d-s4',
      label: 'SET-4',
      items: [
        { itemId: 'r41', label: 'Q1', coIds: ['co4'], maxMarks: 5 },
        { itemId: 'r42', label: 'Q2', coIds: ['co4'], maxMarks: 5 },
        { itemId: 'r43', label: 'Q3', coIds: ['co5'], maxMarks: 5 },
        { itemId: 'r44', label: 'Q4', coIds: ['co6'], maxMarks: 5 },
      ],
    },
  ];
  const rows: EngineMarksRow[] = [
    ...syntheticRows('m2d-s1', [
      { itemId: 'r11', maxMarks: 5, attempted: 10, cleared: 8 }, // L2
      { itemId: 'r12', maxMarks: 5, attempted: 10, cleared: 8 }, // L2
    ]),
    ...syntheticRows('m2d-s2', [
      { itemId: 'r21', maxMarks: 5, attempted: 10, cleared: 8 }, // L2
      { itemId: 'r22', maxMarks: 5, attempted: 10, cleared: 9 }, // L3
      { itemId: 'r23', maxMarks: 5, attempted: 10, cleared: 9 }, // L3
      { itemId: 'r24', maxMarks: 5, attempted: 10, cleared: 6 }, // L1
    ]),
    ...syntheticRows('m2d-s3', [
      { itemId: 'r31', maxMarks: 5, attempted: 10, cleared: 9 }, // L3
      { itemId: 'r32', maxMarks: 5, attempted: 10, cleared: 8 }, // L2
      { itemId: 'r33', maxMarks: 5, attempted: 10, cleared: 9 }, // L3
    ]),
    ...syntheticRows('m2d-s4', [
      { itemId: 'r41', maxMarks: 5, attempted: 10, cleared: 8 }, // L2
      { itemId: 'r42', maxMarks: 5, attempted: 10, cleared: 9 }, // L3
      { itemId: 'r43', maxMarks: 5, attempted: 10, cleared: 9 }, // L3
      { itemId: 'r44', maxMarks: 5, attempted: 10, cleared: 6 }, // L1
    ]),
  ];
  return {
    instrumentId: 'mid2-desc',
    name: 'Mid-2 Descriptive',
    kind: 'internal' as const,
    thresholdPercent: 60,
    sets,
    rows,
  };
}

/** Survey ratings per CO: [count of 1s, count of 2s, count of 3s] over 33 students. */
const SURVEY_DISTRIBUTION: Record<string, [number, number, number]> = {
  co1: [2, 12, 19],
  co2: [1, 12, 20],
  co3: [2, 11, 20],
  co4: [1, 10, 22],
  co5: [1, 11, 21],
  co6: [1, 12, 20],
};

function surveyResponses(): { coId: string; rating: number }[][] {
  const ratingsByCo = new Map<string, number[]>();
  for (const [coId, [ones, twos, threes]] of Object.entries(SURVEY_DISTRIBUTION)) {
    ratingsByCo.set(coId, [
      ...Array.from({ length: ones }, () => 1),
      ...Array.from({ length: twos }, () => 2),
      ...Array.from({ length: threes }, () => 3),
    ]);
  }
  return Array.from({ length: 33 }, (_, i) =>
    CO.map((coId) => ({ coId, rating: ratingsByCo.get(coId)![i] }))
  );
}

/** CO-PO matrix from the document (strength by coId × poId; missing = unmapped). */
const CO_PO_CELLS: [string, string, number][] = [
  ['co1', 'po1', 2],
  ['co1', 'po2', 2],
  ['co1', 'po3', 1],
  ['co1', 'po10', 1],
  ['co1', 'po12', 1],
  ['co2', 'po1', 3],
  ['co2', 'po2', 3],
  ['co2', 'po3', 2],
  ['co2', 'po4', 2],
  ['co2', 'po5', 1],
  ['co2', 'po10', 1],
  ['co2', 'po12', 2],
  ['co3', 'po1', 3],
  ['co3', 'po2', 3],
  ['co3', 'po3', 3],
  ['co3', 'po4', 1],
  ['co3', 'po5', 1],
  ['co3', 'po10', 1],
  ['co3', 'po12', 2],
  ['co4', 'po1', 3],
  ['co4', 'po2', 3],
  ['co4', 'po3', 2],
  ['co4', 'po4', 2],
  ['co4', 'po5', 1],
  ['co4', 'po10', 1],
  ['co4', 'po12', 2],
  ['co5', 'po1', 3],
  ['co5', 'po2', 3],
  ['co5', 'po3', 2],
  ['co5', 'po4', 2],
  ['co5', 'po5', 1],
  ['co5', 'po10', 1],
  ['co5', 'po12', 2],
  ['co6', 'po1', 2],
  ['co6', 'po2', 2],
  ['co6', 'po10', 1],
  ['co6', 'po12', 1],
];

const CO_PSO_CELLS: [string, string, number][] = [
  ['co1', 'pso1', 2],
  ['co1', 'pso2', 2],
  ['co1', 'pso3', 2],
  ['co2', 'pso1', 3],
  ['co2', 'pso2', 2],
  ['co2', 'pso3', 2],
  ['co3', 'pso1', 3],
  ['co3', 'pso2', 1],
  ['co3', 'pso3', 1],
  ['co4', 'pso1', 3],
  ['co4', 'pso2', 2],
  ['co4', 'pso3', 2],
  ['co5', 'pso1', 3],
  ['co5', 'pso2', 2],
  ['co5', 'pso3', 2],
  ['co6', 'pso1', 2],
  ['co6', 'pso2', 1],
  ['co6', 'pso3', 1],
];

export function buildCs404esInput(): OfferingComputeInput {
  return {
    settings: {
      ...structuredClone(DEFAULT_OBE_SETTINGS),
      targetLevel: DEFAULT_OBE_SETTINGS.targetAttainmentLevel,
    },
    cos: CO.map((coId, i) => ({ coId, code: `CO${i + 1}` })),
    pos: PO_IDS.map((id, i) => ({ id, code: `PO${i + 1}` })),
    psos: PSO_IDS.map((id, i) => ({ id, code: `PSO${i + 1}` })),
    poMapping: CO_PO_CELLS.map(([coId, targetId, strength]) => ({ coId, targetId, strength })),
    psoMapping: CO_PSO_CELLS.map(([coId, targetId, strength]) => ({ coId, targetId, strength })),
    instruments: [
      objAssignInstrument('mid1-obj', 'Mid-1 Objective+Assignment', ['co1', 'co2', 'co3'], 33, 49), // 67.35% → L1
      mid1Descriptive(),
      objAssignInstrument('mid2-obj', 'Mid-2 Objective+Assignment', ['co4', 'co5', 'co6'], 38, 49), // 77.55% → L1
      mid2Descriptive(),
      {
        instrumentId: 'endsem',
        name: 'End Semester',
        kind: 'external' as const,
        passMarks: 26,
        // 35 of 49 present students score >= 26 → 71.43% → L3.
        results: Array.from({ length: 49 }, (_, i) => ({
          marksObtained: i < 35 ? 40 : 20,
          absent: false,
        })),
      },
    ],
    surveyResponses: surveyResponses(),
    cohortSize: 33,
  };
}

/** Published values from the document (chained 2-dp rounding). */
export const CS404ES_EXPECTED = {
  ieAverages: { co1: 1.63, co2: 1.75, co3: 1.63, co4: 1.75, co5: 1.83, co6: 1.25 },
  direct: { co1: 2.73, co2: 2.75, co3: 2.73, co4: 2.75, co5: 2.77, co6: 2.65 },
  indirect: { co1: 2.52, co2: 2.58, co3: 2.55, co4: 2.64, co5: 2.61, co6: 2.58 },
  overall: { co1: 2.71, co2: 2.73, co3: 2.71, co4: 2.74, co5: 2.75, co6: 2.64 },
  // The document prints 2.72 but its own six CO overalls average to 2.713.
  courseAverage: 2.71,
  poWeightedAverage: {
    po1: 2.67,
    po2: 2.67,
    po3: 2.0,
    po4: 1.75,
    po5: 1.0,
    po6: null,
    po7: null,
    po8: null,
    po9: null,
    po10: 1.0,
    po11: null,
    po12: 1.67,
  } as Record<string, number | null>,
  // Derived from courseAverage 2.71 (document uses its 2.72, shifting a few
  // cells by 0.01: PO1/PO2 2.42, PO4 1.59, PO5/PO10 0.91).
  poAttainment: {
    po1: 2.41,
    po2: 2.41,
    po3: 1.81,
    po4: 1.58,
    po5: 0.9,
    po6: null,
    po7: null,
    po8: null,
    po9: null,
    po10: 0.9,
    po11: null,
    po12: 1.51,
  } as Record<string, number | null>,
  psoWeightedAverage: { pso1: 2.67, pso2: 1.67, pso3: 1.67 } as Record<string, number>,
  psoAttainment: { pso1: 2.41, pso2: 1.51, pso3: 1.51 } as Record<string, number>,
};

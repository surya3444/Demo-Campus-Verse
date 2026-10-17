/**
 * OBE attainment computation — pure functions, no I/O, fully unit-tested.
 *
 * Methodology (standard NBA process):
 *   item level      = band(% of attempting students clearing the threshold)
 *   set CO value    = mean of the set's item levels mapping that CO
 *   instr CO value  = mean of set CO values across the instrument's sets
 *   IE (internal)   = mean of instrument CO values across internal instruments
 *   EE (external)   = band(% of students scoring pass marks), same for all COs
 *   direct          = w.internal·IE + w.external·EE
 *   indirect        = Σ survey rating / respondents, per CO
 *   overall         = w.direct·direct + w.indirect·indirect
 *   PO attainment   = CO-PO column weighted average × course CO average ÷ maxLevel
 *
 * Published stages are rounded to 2 dp and later stages chain off the rounded
 * values — this mirrors how NBA files are prepared (each table feeds the next),
 * so our reports reproduce the institution's spreadsheets digit for digit.
 */

export interface LevelBand {
  level: number;
  minPercent: number;
}

export interface EngineItem {
  itemId: string;
  label: string;
  coIds: string[];
  maxMarks: number;
}

export interface EngineSet {
  setId: string;
  label: string;
  items: EngineItem[];
}

export interface EngineMarksRow {
  studentId: string;
  absent: boolean;
  setId?: string | null;
  /** itemId → marksObtained. A missing key = not attempted; 0 = attempted. */
  marks: Record<string, number>;
}

export type EngineInstrument =
  | {
      instrumentId: string;
      name: string;
      kind: 'internal';
      thresholdPercent: number;
      sets: EngineSet[];
      rows: EngineMarksRow[];
    }
  | {
      instrumentId: string;
      name: string;
      kind: 'external';
      passMarks: number;
      results: { marksObtained: number; absent: boolean }[];
    };

export interface ItemStat {
  setId: string;
  setLabel: string;
  itemId: string;
  label: string;
  coIds: string[];
  maxMarks: number;
  attempted: number;
  cleared: number;
  percentCleared: number | null;
  level: number | null;
}

export interface ExternalStat {
  present: number;
  passed: number;
  percentPassed: number | null;
  level: number | null;
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Highest band whose minPercent the given percent reaches; 0 below every band.
 * A null percent (nobody attempted) yields null — excluded from averages.
 */
export function levelFromBands(percent: number | null, bands: LevelBand[]): number | null {
  if (percent === null) return null;
  const sorted = [...bands].sort((a, b) => b.minPercent - a.minPercent);
  for (const band of sorted) {
    if (percent >= band.minPercent) return band.level;
  }
  return 0;
}

/**
 * Per-question stats for one set. `rows` must already be limited to students
 * who answered this set. A student attempted an item iff they are not absent
 * and the item appears in their marks map (an explicit 0 counts as attempted).
 * Clearing is STRICTLY MORE than the threshold ("students secured > threshold
 * marks" in the NBA worksheets): at 60% of a 5-mark question, a 3 does not
 * clear. The external pass check is inclusive (>= passMarks) by contrast.
 */
export function computeItemStats(
  set: EngineSet,
  rows: EngineMarksRow[],
  thresholdPercent: number,
  bands: LevelBand[]
): ItemStat[] {
  return set.items.map((item) => {
    const threshold = (thresholdPercent / 100) * item.maxMarks;
    let attempted = 0;
    let cleared = 0;
    for (const row of rows) {
      if (row.absent) continue;
      const obtained = row.marks[item.itemId];
      if (obtained === undefined) continue;
      attempted++;
      if (obtained > threshold) cleared++;
    }
    const percentCleared = attempted > 0 ? round2((cleared / attempted) * 100) : null;
    return {
      setId: set.setId,
      setLabel: set.label,
      itemId: item.itemId,
      label: item.label,
      coIds: item.coIds,
      maxMarks: item.maxMarks,
      attempted,
      cleared,
      percentCleared,
      level: levelFromBands(percentCleared, bands),
    };
  });
}

/** External exam: % of present students scoring at least the pass marks. */
export function computeExternalLevel(
  results: { marksObtained: number; absent: boolean }[],
  passMarks: number,
  bands: LevelBand[]
): ExternalStat {
  const present = results.filter((r) => !r.absent);
  const passed = present.filter((r) => r.marksObtained >= passMarks).length;
  const percentPassed = present.length > 0 ? round2((passed / present.length) * 100) : null;
  return {
    present: present.length,
    passed,
    percentPassed,
    level: levelFromBands(percentPassed, bands),
  };
}

/** Student display total — best-of keeps the top N item scores. */
export function computeStudentTotal(
  marks: Record<string, number>,
  bestOfCount: number | null | undefined
): number {
  const values = Object.values(marks).sort((a, b) => b - a);
  const counted = bestOfCount ? values.slice(0, bestOfCount) : values;
  return counted.reduce((sum, v) => sum + v, 0);
}

/**
 * One internal instrument's per-CO value: mean over sets of (mean of the set's
 * item levels mapping the CO). Sets/items with nobody attempting drop out.
 */
export function computeInstrumentCoValues(
  itemStatsBySet: ItemStat[][],
  coIds: string[]
): Map<string, number | null> {
  const result = new Map<string, number | null>();
  for (const coId of coIds) {
    const setValues: number[] = [];
    for (const setStats of itemStatsBySet) {
      const levels = setStats
        .filter((stat) => stat.coIds.includes(coId) && stat.level !== null)
        .map((stat) => stat.level as number);
      const setValue = mean(levels);
      if (setValue !== null) setValues.push(setValue);
    }
    result.set(coId, mean(setValues));
  }
  return result;
}

/** Weighted blend where a missing side hands its weight to the other. */
function blend(
  a: number | null,
  b: number | null,
  weightA: number,
  weightB: number
): number | null {
  if (a === null && b === null) return null;
  if (a === null) return b;
  if (b === null) return a;
  return a * weightA + b * weightB;
}

export function computeCoDirect(
  internal: number | null,
  external: number | null,
  weights: { internal: number; external: number }
): number | null {
  const value = blend(internal, external, weights.internal, weights.external);
  return value === null ? null : round2(value);
}

export function computeOverall(
  direct: number | null,
  indirect: number | null,
  weights: { direct: number; indirect: number }
): number | null {
  const value = blend(direct, indirect, weights.direct, weights.indirect);
  return value === null ? null : round2(value);
}

/** Per-CO indirect attainment: Σ rating ÷ respondents who rated that CO. */
export function computeIndirect(
  responses: { coId: string; rating: number }[][]
): Map<string, number> {
  const sums = new Map<string, { total: number; count: number }>();
  for (const response of responses) {
    for (const { coId, rating } of response) {
      const entry = sums.get(coId) ?? { total: 0, count: 0 };
      entry.total += rating;
      entry.count += 1;
      sums.set(coId, entry);
    }
  }
  const result = new Map<string, number>();
  for (const [coId, { total, count }] of sums) {
    result.set(coId, round2(total / count));
  }
  return result;
}

/** CO-PO/PSO column averages over mapped cells only; unmapped column → null. */
export function computeMappingAverages(
  cells: { coId: string; targetId: string; strength: number }[],
  targetIds: string[]
): Map<string, { weightedAverage: number | null; mappedCount: number }> {
  const result = new Map<string, { weightedAverage: number | null; mappedCount: number }>();
  for (const targetId of targetIds) {
    const strengths = cells.filter((c) => c.targetId === targetId).map((c) => c.strength);
    const avg = mean(strengths);
    result.set(targetId, {
      weightedAverage: avg === null ? null : round2(avg),
      mappedCount: strengths.length,
    });
  }
  return result;
}

export function computePoAttainment(
  weightedAverage: number,
  courseCoAverage: number,
  maxLevel: number
): number {
  return round2((weightedAverage * courseCoAverage) / maxLevel);
}

// ── Orchestrator ─────────────────────────────────────────────────────────────

export interface OfferingComputeInput {
  settings: {
    internalThresholdPercent: number;
    internalLevelBands: LevelBand[];
    externalLevelBands: LevelBand[];
    directWeights: { internal: number; external: number };
    overallWeights: { direct: number; indirect: number };
    targetLevel: number;
    maxAttainmentLevel: number;
  };
  cos: { coId: string; code: string }[];
  pos: { id: string; code: string }[];
  psos: { id: string; code: string }[];
  poMapping: { coId: string; targetId: string; strength: number }[];
  psoMapping: { coId: string; targetId: string; strength: number }[];
  instruments: EngineInstrument[];
  /** One entry per survey respondent. */
  surveyResponses: { coId: string; rating: number }[][];
  cohortSize: number;
}

export interface OfferingAttainmentResult {
  perInstrument: {
    instrumentId: string;
    name: string;
    kind: 'internal' | 'external';
    items?: ItemStat[];
    external?: ExternalStat;
  }[];
  perCo: {
    coId: string;
    code: string;
    internalLevels: number[];
    internalAttainment: number | null;
    externalAttainment: number | null;
    directAttainment: number | null;
    indirectAttainment: number | null;
    overallAttainment: number | null;
    targetMet: boolean;
  }[];
  courseAverageCoAttainment: number | null;
  poAttainment: {
    outcomeId: string;
    code: string;
    weightedAverage: number | null;
    attainment: number | null;
  }[];
  psoAttainment: {
    outcomeId: string;
    code: string;
    weightedAverage: number | null;
    attainment: number | null;
  }[];
  surveyRespondents: number;
}

export function computeOfferingAttainment(input: OfferingComputeInput): OfferingAttainmentResult {
  const { settings } = input;
  const coIds = input.cos.map((co) => co.coId);

  // Instrument stats + per-instrument CO values.
  const perInstrument: OfferingAttainmentResult['perInstrument'] = [];
  const internalCoValues: Map<string, number | null>[] = [];
  const externalLevels: number[] = [];

  for (const instrument of input.instruments) {
    if (instrument.kind === 'internal') {
      const itemStatsBySet = instrument.sets.map((set) =>
        computeItemStats(
          set,
          instrument.rows.filter((row) => (row.setId ?? instrument.sets[0]?.setId) === set.setId),
          instrument.thresholdPercent,
          settings.internalLevelBands
        )
      );
      internalCoValues.push(computeInstrumentCoValues(itemStatsBySet, coIds));
      perInstrument.push({
        instrumentId: instrument.instrumentId,
        name: instrument.name,
        kind: 'internal',
        items: itemStatsBySet.flat(),
      });
    } else {
      const external = computeExternalLevel(
        instrument.results,
        instrument.passMarks,
        settings.externalLevelBands
      );
      if (external.level !== null) externalLevels.push(external.level);
      perInstrument.push({
        instrumentId: instrument.instrumentId,
        name: instrument.name,
        kind: 'external',
        external,
      });
    }
  }

  const indirectByCo = computeIndirect(input.surveyResponses);
  const externalAttainment = mean(externalLevels);

  const perCo = input.cos.map((co) => {
    const instrumentValues = internalCoValues
      .map((values) => values.get(co.coId) ?? null)
      .filter((v): v is number => v !== null);
    const internalAttainment = mean(instrumentValues);
    const directAttainment = computeCoDirect(
      internalAttainment,
      externalAttainment,
      settings.directWeights
    );
    const indirectAttainment = indirectByCo.get(co.coId) ?? null;
    const overallAttainment = computeOverall(
      directAttainment,
      indirectAttainment,
      settings.overallWeights
    );
    return {
      coId: co.coId,
      code: co.code,
      internalLevels: instrumentValues.map(round2),
      internalAttainment: internalAttainment === null ? null : round2(internalAttainment),
      externalAttainment: externalAttainment === null ? null : round2(externalAttainment),
      directAttainment,
      indirectAttainment,
      overallAttainment,
      targetMet: overallAttainment !== null && overallAttainment >= settings.targetLevel,
    };
  });

  const overallValues = perCo
    .map((co) => co.overallAttainment)
    .filter((v): v is number => v !== null);
  const courseAvgRaw = mean(overallValues);
  const courseAverageCoAttainment = courseAvgRaw === null ? null : round2(courseAvgRaw);

  const outcomeAttainment = (
    targets: { id: string; code: string }[],
    cells: { coId: string; targetId: string; strength: number }[]
  ) => {
    const averages = computeMappingAverages(
      cells,
      targets.map((t) => t.id)
    );
    return targets.map((target) => {
      const { weightedAverage } = averages.get(target.id)!;
      return {
        outcomeId: target.id,
        code: target.code,
        weightedAverage,
        attainment:
          weightedAverage === null || courseAverageCoAttainment === null
            ? null
            : computePoAttainment(
                weightedAverage,
                courseAverageCoAttainment,
                settings.maxAttainmentLevel
              ),
      };
    });
  };

  return {
    perInstrument,
    perCo,
    courseAverageCoAttainment,
    poAttainment: outcomeAttainment(input.pos, input.poMapping),
    psoAttainment: outcomeAttainment(input.psos, input.psoMapping),
    surveyRespondents: input.surveyResponses.length,
  };
}

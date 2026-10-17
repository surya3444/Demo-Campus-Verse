import { describe, it, expect } from 'vitest';
import { computeOfferingAttainment } from '../../modules/obe/attainment.engine';
import { buildCs404esInput, CS404ES_EXPECTED } from '../fixtures/obe-cs404es';

/**
 * Golden-master test against the client's OBE methodology document (course
 * CS404ES). Every published table value must reproduce exactly — the fixture
 * documents the two spots where the document's own arithmetic slips.
 */
describe('CS404ES golden master', () => {
  const result = computeOfferingAttainment(buildCs404esInput());
  const byCo = Object.fromEntries(result.perCo.map((co) => [co.coId, co]));
  const byPo = Object.fromEntries(result.poAttainment.map((po) => [po.outcomeId, po]));
  const byPso = Object.fromEntries(result.psoAttainment.map((pso) => [pso.outcomeId, pso]));

  it('reproduces the Annexure-1 Mid-1 descriptive SET-1 question table', () => {
    const mid1Desc = result.perInstrument.find((i) => i.instrumentId === 'mid1-desc')!;
    const set1 = mid1Desc.items!.filter((item) => item.setLabel === 'SET-1');
    expect(set1.map((s) => s.attempted)).toEqual([7, 3, 8, 8]);
    expect(set1.map((s) => s.cleared)).toEqual([6, 3, 8, 7]);
    expect(set1.map((s) => s.percentCleared)).toEqual([85.71, 100, 100, 87.5]);
    expect(set1.map((s) => s.level)).toEqual([2, 3, 3, 2]);
  });

  it('computes internal (IE) attainment per CO', () => {
    for (const [coId, expected] of Object.entries(CS404ES_EXPECTED.ieAverages)) {
      expect(byCo[coId].internalAttainment, coId).toBeCloseTo(expected, 2);
    }
  });

  it('applies the external level (3) uniformly', () => {
    const endsem = result.perInstrument.find((i) => i.instrumentId === 'endsem')!;
    expect(endsem.external!.percentPassed).toBeCloseTo(71.43, 2);
    expect(endsem.external!.level).toBe(3);
    for (const coId of Object.keys(CS404ES_EXPECTED.direct)) {
      expect(byCo[coId].externalAttainment).toBe(3);
    }
  });

  it('computes direct CO attainment (0.2 IE + 0.8 EE)', () => {
    for (const [coId, expected] of Object.entries(CS404ES_EXPECTED.direct)) {
      expect(byCo[coId].directAttainment, coId).toBe(expected);
    }
  });

  it('computes indirect CO attainment from the survey', () => {
    for (const [coId, expected] of Object.entries(CS404ES_EXPECTED.indirect)) {
      expect(byCo[coId].indirectAttainment, coId).toBe(expected);
    }
    expect(result.surveyRespondents).toBe(33);
  });

  it('computes overall CO attainment (0.9 direct + 0.1 indirect) and course average', () => {
    for (const [coId, expected] of Object.entries(CS404ES_EXPECTED.overall)) {
      expect(byCo[coId].overallAttainment, coId).toBe(expected);
    }
    expect(result.courseAverageCoAttainment).toBe(CS404ES_EXPECTED.courseAverage);
  });

  it('flags every CO as meeting the target level of 2', () => {
    for (const co of result.perCo) {
      expect(co.targetMet, co.code).toBe(true);
    }
  });

  it('computes CO-PO weighted averages over mapped cells only', () => {
    for (const [poId, expected] of Object.entries(CS404ES_EXPECTED.poWeightedAverage)) {
      expect(byPo[poId].weightedAverage, poId).toBe(expected);
    }
  });

  it('computes PO attainment = weighted average × course CO average ÷ 3', () => {
    for (const [poId, expected] of Object.entries(CS404ES_EXPECTED.poAttainment)) {
      expect(byPo[poId].attainment, poId).toBe(expected);
    }
  });

  it('computes PSO weighted averages and attainment', () => {
    for (const [psoId, expected] of Object.entries(CS404ES_EXPECTED.psoWeightedAverage)) {
      expect(byPso[psoId].weightedAverage, psoId).toBe(expected);
    }
    for (const [psoId, expected] of Object.entries(CS404ES_EXPECTED.psoAttainment)) {
      expect(byPso[psoId].attainment, psoId).toBe(expected);
    }
  });
});

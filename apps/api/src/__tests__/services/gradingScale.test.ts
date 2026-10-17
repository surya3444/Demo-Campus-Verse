import { describe, it, expect } from 'vitest';
import {
  CBSE_GRADING_SCALE,
  UGC_GRADING_SCALE,
  BOARD_PRESET_CONFIG,
  defaultBoardPresetFor,
  gradeForPercent,
} from '@campus-verse/shared/constants';

describe('UGC grading scale', () => {
  it('covers 0-100 with no gaps or overlaps', () => {
    const sorted = [...UGC_GRADING_SCALE].sort((a, b) => a.minPercent - b.minPercent);
    expect(sorted[0].minPercent).toBe(0);
    expect(sorted[sorted.length - 1].maxPercent).toBe(100);
    for (let i = 1; i < sorted.length; i++) {
      // each band starts exactly one point above the previous band's end
      expect(sorted[i].minPercent).toBe(sorted[i - 1].maxPercent + 1);
    }
    // every percentage resolves to exactly one band
    for (let p = 0; p <= 100; p++) {
      expect(gradeForPercent(p, UGC_GRADING_SCALE)).not.toBeNull();
    }
  });

  it('is a 10-point scale topping out at O = 10', () => {
    const top = gradeForPercent(95, UGC_GRADING_SCALE);
    expect(top?.grade).toBe('O');
    expect(top?.points).toBe(10);
  });

  it('fails below 40 where CBSE would pass — the transcript-critical difference', () => {
    // 35% is a pass worth 4 points under CBSE...
    const cbse = gradeForPercent(35, CBSE_GRADING_SCALE);
    expect(cbse?.grade).toBe('D');
    expect(cbse?.points).toBe(4);

    // ...and a zero-point fail under UGC.
    const ugc = gradeForPercent(35, UGC_GRADING_SCALE);
    expect(ugc?.grade).toBe('F');
    expect(ugc?.points).toBe(0);
  });

  it('awards P = 4 exactly at the 40% pass mark', () => {
    const band = gradeForPercent(40, UGC_GRADING_SCALE);
    expect(band?.grade).toBe('P');
    expect(band?.points).toBe(4);
    expect(BOARD_PRESET_CONFIG.ugc.passMarkPercent).toBe(40);
  });

  it('disables co-scholastic, which is a school-board concept', () => {
    expect(BOARD_PRESET_CONFIG.ugc.coScholasticEnabled).toBe(false);
    expect(BOARD_PRESET_CONFIG.cbse.coScholasticEnabled).toBe(true);
  });

  it('defaults universities and colleges to UGC, schools to CBSE', () => {
    expect(defaultBoardPresetFor('university')).toBe('ugc');
    expect(defaultBoardPresetFor('college')).toBe('ugc');
    expect(defaultBoardPresetFor('school')).toBe('cbse');
    expect(defaultBoardPresetFor(undefined)).toBe('cbse');
  });
});

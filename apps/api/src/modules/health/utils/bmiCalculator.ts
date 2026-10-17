/**
 * BMI Calculator Utility
 * Calculates Body Mass Index and provides categorization
 */

export interface BmiResult {
  bmi: number;
  category: 'underweight' | 'normal' | 'overweight' | 'obese';
  message: string;
}

/**
 * Calculate BMI from height (cm) and weight (kg)
 */
export function calculateBmi(heightCm: number, weightKg: number): number {
  if (heightCm <= 0 || weightKg <= 0) {
    throw new Error('Height and weight must be positive values');
  }

  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);

  return Math.round(bmi * 10) / 10; // Round to 1 decimal place
}

/**
 * Get BMI category based on WHO standards
 */
export function getBmiCategory(bmi: number): BmiResult['category'] {
  if (bmi < 18.5) return 'underweight';
  if (bmi < 25) return 'normal';
  if (bmi < 30) return 'overweight';
  return 'obese';
}

/**
 * Get BMI with category and message
 */
export function getBmiResult(heightCm: number, weightKg: number): BmiResult {
  const bmi = calculateBmi(heightCm, weightKg);
  const category = getBmiCategory(bmi);

  const messages: Record<BmiResult['category'], string> = {
    underweight: 'BMI indicates underweight. Consider nutritional assessment.',
    normal: 'BMI is within normal range.',
    overweight: 'BMI indicates overweight. Consider lifestyle modifications.',
    obese: 'BMI indicates obesity. Medical consultation recommended.',
  };

  return {
    bmi,
    category,
    message: messages[category],
  };
}

/**
 * Calculate ideal weight range based on height (using BMI 18.5-24.9)
 */
export function getIdealWeightRange(heightCm: number): { min: number; max: number } {
  const heightM = heightCm / 100;
  return {
    min: Math.round(18.5 * heightM * heightM * 10) / 10,
    max: Math.round(24.9 * heightM * heightM * 10) / 10,
  };
}

/**
 * Calculate BMI percentile for children (simplified version)
 * In production, use CDC or WHO growth charts with exact age/sex data
 */
export function calculateBmiPercentile(
  bmi: number,
  ageInMonths: number,
  gender: 'male' | 'female'
): number | null {
  // This is a simplified approximation
  // For production, use actual CDC/WHO growth chart data
  if (ageInMonths < 24 || ageInMonths > 240) {
    return null; // Outside typical range for child percentiles
  }

  // Simplified percentile calculation (not medically accurate)
  // In production, interpolate from actual growth chart data
  const medianBmi = gender === 'male' ? 17.5 : 17.2;
  const stdDev = 2.5;

  // Z-score calculation
  const zScore = (bmi - medianBmi) / stdDev;

  // Convert z-score to percentile (normal distribution approximation)
  const percentile = normalCdfApprox(zScore) * 100;

  return Math.round(percentile);
}

/**
 * Approximate normal cumulative distribution function
 */
function normalCdfApprox(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Calculate height percentile for children (simplified version)
 */
export function calculateHeightPercentile(
  heightCm: number,
  ageInMonths: number,
  gender: 'male' | 'female'
): number | null {
  if (ageInMonths < 24 || ageInMonths > 240) {
    return null;
  }

  // Simplified height median by age (approximation)
  const baseHeight = gender === 'male' ? 87 : 85; // At 24 months
  const growthRate = gender === 'male' ? 0.5 : 0.48; // cm per month (simplified)
  const medianHeight = baseHeight + (ageInMonths - 24) * growthRate;
  const stdDev = 5;

  const zScore = (heightCm - medianHeight) / stdDev;
  const percentile = normalCdfApprox(zScore) * 100;

  return Math.round(percentile);
}

/**
 * Calculate weight percentile for children (simplified version)
 */
export function calculateWeightPercentile(
  weightKg: number,
  ageInMonths: number,
  gender: 'male' | 'female'
): number | null {
  if (ageInMonths < 24 || ageInMonths > 240) {
    return null;
  }

  // Simplified weight median by age (approximation)
  const baseWeight = gender === 'male' ? 12.5 : 12; // At 24 months
  const growthRate = gender === 'male' ? 0.2 : 0.19; // kg per month (simplified)
  const medianWeight = baseWeight + (ageInMonths - 24) * growthRate;
  const stdDev = 3;

  const zScore = (weightKg - medianWeight) / stdDev;
  const percentile = normalCdfApprox(zScore) * 100;

  return Math.round(percentile);
}

/**
 * Calculate age in months from date of birth
 */
export function calculateAgeInMonths(dateOfBirth: Date): number {
  const now = new Date();
  const months =
    (now.getFullYear() - dateOfBirth.getFullYear()) * 12 +
    (now.getMonth() - dateOfBirth.getMonth());
  return months;
}

/**
 * Calculate all growth percentiles
 */
export function calculateGrowthPercentiles(
  heightCm: number,
  weightKg: number,
  dateOfBirth: Date,
  gender: 'male' | 'female'
): {
  ageInMonths: number;
  bmi: number;
  heightPercentile: number | null;
  weightPercentile: number | null;
  bmiPercentile: number | null;
} {
  const ageInMonths = calculateAgeInMonths(dateOfBirth);
  const bmi = calculateBmi(heightCm, weightKg);

  return {
    ageInMonths,
    bmi,
    heightPercentile: calculateHeightPercentile(heightCm, ageInMonths, gender),
    weightPercentile: calculateWeightPercentile(weightKg, ageInMonths, gender),
    bmiPercentile: calculateBmiPercentile(bmi, ageInMonths, gender),
  };
}

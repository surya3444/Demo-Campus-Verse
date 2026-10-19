import { describe, expect, it } from 'vitest';
import { computeAnnualTax, computePayslip, DEFAULT_PAYROLL_SETTINGS } from '../../modules/hr/payrollMath';

const S = DEFAULT_PAYROLL_SETTINGS;

describe('computeAnnualTax (new regime, FY 2025-26)', () => {
  it('charges nothing up to ₹12L taxable (87A rebate)', () => {
    // 12,75,000 gross − 75,000 standard deduction = 12,00,000 taxable
    expect(computeAnnualTax(1275000, 'new').annualTax).toBe(0);
  });

  it('applies marginal relief just above ₹12L', () => {
    // taxable 12,10,000: slab tax 61,500 → capped at 10,000 above the limit, + 4% cess
    const t = computeAnnualTax(1285000, 'new');
    expect(t.taxableIncome).toBe(1210000);
    expect(t.annualTax).toBe(10400);
  });

  it('uses the full slabs well above the limit', () => {
    // taxable 20,00,000: 0 + 20k + 40k + 60k + 80k = 2,00,000, + 4% cess
    expect(computeAnnualTax(2075000, 'new').annualTax).toBe(208000);
  });

  it('old regime: ₹50k standard deduction and rebate up to ₹5L', () => {
    expect(computeAnnualTax(550000, 'old').annualTax).toBe(0);
    // taxable 7,50,000: 12,500 + 50,000 = 62,500, + 4% cess
    expect(computeAnnualTax(800000, 'old').annualTax).toBe(65000);
  });
});

describe('computePayslip', () => {
  const salary = {
    earnings: [
      { code: 'BASIC', name: 'Basic', amount: 30000 },
      { code: 'DA', name: 'Dearness Allowance', amount: 6000 },
      { code: 'HRA', name: 'House Rent Allowance', amount: 12000 },
    ],
  };

  it('caps PF wages at ₹15,000 and skips ESI above the threshold', () => {
    const p = computePayslip(salary, S);
    expect(p.grossEarnings).toBe(48000);
    expect(p.deductions.find((d) => d.code === 'PF')?.amount).toBe(1800);
    expect(p.employer.pf).toBe(1800);
    expect(p.deductions.some((d) => d.code === 'ESI')).toBe(false);
    // 48,000 × 12 = 5,76,000 — under the rebate, so no TDS
    expect(p.deductions.some((d) => d.code === 'TDS')).toBe(false);
    expect(p.netPayable).toBe(46200);
  });

  it('pro-rates every earning for loss of pay', () => {
    const p = computePayslip({ ...salary, lopDays: 2 }, S);
    // 24 of 26 days paid
    expect(p.earnings.find((e) => e.code === 'BASIC')?.amount).toBeCloseTo(27692.31, 2);
    expect(p.lopDeduction).toBeCloseTo(3692.31, 2);
  });

  it('applies ESI within the threshold, with the employer share', () => {
    const p = computePayslip({ earnings: [{ code: 'BASIC', name: 'Basic', amount: 18000 }] }, S);
    expect(p.deductions.find((d) => d.code === 'ESI')?.amount).toBe(135);
    expect(p.employer.esi).toBe(585);
  });

  it('applies loan recoveries only inside their window', () => {
    const loan = { code: 'LOAN', name: 'Loan recovery', amount: 2000, startMonth: '2026-11', endMonth: '2027-04' };
    expect(computePayslip({ ...salary, customDeductions: [loan], period: '2026-10' }, S).deductions.some((d) => d.code === 'LOAN')).toBe(false);
    expect(computePayslip({ ...salary, customDeductions: [loan], period: '2026-12' }, S).deductions.some((d) => d.code === 'LOAN')).toBe(true);
  });
});

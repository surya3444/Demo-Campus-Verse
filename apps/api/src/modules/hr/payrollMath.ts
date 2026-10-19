/**
 * Payroll maths in one place — the monthly payslip, statutory deductions and
 * income tax — so a payroll run, the salary-structure preview and the
 * "how pay is calculated" rules all agree. Pure functions, no I/O.
 *
 * Indian payroll, FY 2025-26:
 * - PF: employee and employer each 12% of PF wages (Basic + DA), capped at
 *   ₹15,000 wages a month.
 * - ESI: 0.75% employee / 3.25% employer of gross, only while gross ≤ ₹21,000.
 * - Professional tax: the state slab the gross falls in.
 * - TDS: projected annual income, standard deduction, regime slabs, Section
 *   87A rebate (with marginal relief in the new regime), 4% cess; spread
 *   evenly over 12 months.
 * - Loss of pay: (unpaid absent days ÷ working days) of every earning.
 */

export interface PayrollSettings {
  pfRate: number; // employer
  employeePfRate: number;
  esiEmployerRate: number;
  esiEmployeeRate: number;
  esiThreshold: number;
  ptSlabs: Array<{ fromAmount: number; toAmount: number; tax: number }>;
  tdsRegime: 'old' | 'new';
  workingDaysPerMonth: number;
  autoCalculateLOP: boolean;
  payslipNumberPrefix?: string;
}

export const DEFAULT_PAYROLL_SETTINGS: PayrollSettings = {
  pfRate: 12,
  employeePfRate: 12,
  esiEmployerRate: 3.25,
  esiEmployeeRate: 0.75,
  esiThreshold: 21000,
  ptSlabs: [],
  tdsRegime: 'new',
  payslipNumberPrefix: 'PS',
  workingDaysPerMonth: 26,
  autoCalculateLOP: true,
};

export const PF_WAGE_CEILING = 15000;
/** Components that count as PF wages. */
export const PF_WAGE_CODES = ['BASIC', 'DA'];

export const TAX_REGIMES = {
  new: {
    label: 'New regime (FY 2025-26)',
    standardDeduction: 75000,
    rebateUpTo: 1200000,
    slabs: [
      { upTo: 400000, rate: 0 },
      { upTo: 800000, rate: 5 },
      { upTo: 1200000, rate: 10 },
      { upTo: 1600000, rate: 15 },
      { upTo: 2000000, rate: 20 },
      { upTo: 2400000, rate: 25 },
      { upTo: Infinity, rate: 30 },
    ],
  },
  old: {
    label: 'Old regime',
    standardDeduction: 50000,
    rebateUpTo: 500000,
    slabs: [
      { upTo: 250000, rate: 0 },
      { upTo: 500000, rate: 5 },
      { upTo: 1000000, rate: 20 },
      { upTo: Infinity, rate: 30 },
    ],
  },
} as const;
export const CESS_RATE = 4;

const r2 = (n: number) => Math.round(n * 100) / 100;

export interface AnnualTax {
  regime: 'old' | 'new';
  annualProjectedIncome: number;
  standardDeduction: number;
  taxableIncome: number;
  slabTax: number;
  rebate: number;
  cess: number;
  annualTax: number;
  monthlyTds: number;
}

/** Income tax on a projected annual income under a regime. */
export function computeAnnualTax(annualIncome: number, regime: 'old' | 'new'): AnnualTax {
  const R = TAX_REGIMES[regime];
  const taxableIncome = Math.max(0, annualIncome - R.standardDeduction);
  let slabTax = 0;
  let prev = 0;
  for (const s of R.slabs) {
    if (taxableIncome <= prev) break;
    slabTax += (Math.min(taxableIncome, s.upTo) - prev) * (s.rate / 100);
    prev = s.upTo;
  }
  // 87A: no tax up to the rebate limit; in the new regime, marginal relief
  // caps the tax at the income above the limit.
  let rebate = 0;
  if (taxableIncome <= R.rebateUpTo) rebate = slabTax;
  else if (regime === 'new') rebate = Math.max(0, slabTax - (taxableIncome - R.rebateUpTo));
  const afterRebate = slabTax - rebate;
  const cess = afterRebate * (CESS_RATE / 100);
  const annualTax = r2(afterRebate + cess);
  return {
    regime,
    annualProjectedIncome: r2(annualIncome),
    standardDeduction: R.standardDeduction,
    taxableIncome: r2(taxableIncome),
    slabTax: r2(slabTax),
    rebate: r2(rebate),
    cess: r2(cess),
    annualTax,
    monthlyTds: r2(annualTax / 12),
  };
}

export interface Line {
  code: string;
  name: string;
  amount: number;
}
export interface CustomDeduction extends Line {
  isActive?: boolean;
  startMonth?: string;
  endMonth?: string;
}

export interface PayslipInput {
  earnings: Line[];
  personalAllowances?: Line[];
  /** Fixed deductions from the salary assignment (not PF/ESI/PT/TDS). */
  deductions?: Line[];
  customDeductions?: CustomDeduction[];
  /** YYYY-MM, to apply custom deductions in their window. */
  period?: string;
  /** Unpaid days absent this month. */
  lopDays?: number;
}

export interface PayslipResult {
  workingDays: number;
  lopDays: number;
  lopDeduction: number;
  fullGross: number;
  earnings: Line[];
  deductions: Line[];
  grossEarnings: number;
  totalDeductions: number;
  netPayable: number;
  employer: { pf: number; esi: number; total: number };
  /** Monthly cost to the campus: gross + employer contributions. */
  monthlyCost: number;
  tds: AnnualTax;
  explain: string[];
}

const STATUTORY = ['PF', 'ESI', 'PT', 'TDS'];

/** One month's payslip for one person. */
export function computePayslip(input: PayslipInput, settings: PayrollSettings): PayslipResult {
  const workingDays = settings.workingDaysPerMonth || 26;
  const lopDays = settings.autoCalculateLOP ? Math.min(workingDays, Math.max(0, input.lopDays ?? 0)) : 0;
  const ratio = (workingDays - lopDays) / workingDays;
  const all = [...(input.earnings ?? []), ...(input.personalAllowances ?? [])];
  const fullGross = r2(all.reduce((n, e) => n + (e.amount || 0), 0));
  const earnings = all.map((e) => ({ code: e.code, name: e.name, amount: r2(e.amount * ratio) }));
  const grossEarnings = r2(earnings.reduce((n, e) => n + e.amount, 0));
  const lopDeduction = r2(fullGross - grossEarnings);
  const explain: string[] = [];
  if (lopDays) explain.push(`${lopDays} unpaid day${lopDays === 1 ? '' : 's'} of ${workingDays}: every earning paid at ${(ratio * 100).toFixed(1)}%.`);

  const deductions: Line[] = (input.deductions ?? [])
    .filter((d) => !STATUTORY.includes(d.code))
    .map((d) => ({ code: d.code, name: d.name, amount: r2(d.amount * ratio) }));

  // PF on Basic + DA, wages capped
  const pfWages = Math.min(
    PF_WAGE_CEILING,
    earnings.filter((e) => PF_WAGE_CODES.includes(e.code)).reduce((n, e) => n + e.amount, 0)
  );
  const pf = r2(pfWages * (settings.employeePfRate / 100));
  const employerPf = r2(pfWages * (settings.pfRate / 100));
  if (pf > 0) {
    deductions.push({ code: 'PF', name: 'Provident Fund', amount: pf });
    explain.push(`PF ${settings.employeePfRate}% of ₹${pfWages.toLocaleString('en-IN')} (Basic + DA, capped at ₹${PF_WAGE_CEILING.toLocaleString('en-IN')}).`);
  }

  // ESI only within the threshold
  let esi = 0;
  let employerEsi = 0;
  if (grossEarnings > 0 && grossEarnings <= settings.esiThreshold) {
    esi = r2(grossEarnings * (settings.esiEmployeeRate / 100));
    employerEsi = r2(grossEarnings * (settings.esiEmployerRate / 100));
    if (esi > 0) deductions.push({ code: 'ESI', name: 'Employee State Insurance', amount: esi });
    explain.push(`ESI ${settings.esiEmployeeRate}% — gross is within ₹${settings.esiThreshold.toLocaleString('en-IN')}.`);
  }

  // Professional tax slab
  const slab = (settings.ptSlabs ?? []).find((s) => grossEarnings >= s.fromAmount && grossEarnings <= s.toAmount);
  if (slab?.tax) {
    deductions.push({ code: 'PT', name: 'Professional Tax', amount: slab.tax });
    explain.push(`Professional tax ₹${slab.tax} for gross ₹${slab.fromAmount.toLocaleString('en-IN')}–${slab.toAmount.toLocaleString('en-IN')}.`);
  }

  // TDS on this month's gross projected over the year
  const tds = computeAnnualTax(grossEarnings * 12, settings.tdsRegime);
  if (tds.monthlyTds > 0) {
    deductions.push({ code: 'TDS', name: 'Tax Deducted at Source', amount: tds.monthlyTds });
    explain.push(`TDS: ₹${tds.annualTax.toLocaleString('en-IN')} a year on taxable ₹${tds.taxableIncome.toLocaleString('en-IN')} (${TAX_REGIMES[tds.regime].label}), ÷ 12.`);
  } else if (grossEarnings > 0) {
    explain.push(`No TDS — taxable income ₹${tds.taxableIncome.toLocaleString('en-IN')} is covered by the Section 87A rebate.`);
  }

  // Loans, advances and other recoveries in their window
  for (const cd of input.customDeductions ?? []) {
    if (cd.isActive === false) continue;
    if (input.period && cd.startMonth && input.period < cd.startMonth) continue;
    if (input.period && cd.endMonth && input.period > cd.endMonth) continue;
    deductions.push({ code: cd.code, name: cd.name, amount: r2(cd.amount) });
  }

  const totalDeductions = r2(deductions.reduce((n, d) => n + d.amount, 0));
  const employer = { pf: employerPf, esi: employerEsi, total: r2(employerPf + employerEsi) };
  return {
    workingDays,
    lopDays,
    lopDeduction,
    fullGross,
    earnings,
    deductions,
    grossEarnings,
    totalDeductions,
    netPayable: r2(grossEarnings - totalDeductions),
    employer,
    monthlyCost: r2(grossEarnings + employer.total),
    tds,
    explain,
  };
}

/** The payroll rules in plain words, with this campus's numbers. */
export function describeRules(settings: PayrollSettings) {
  const R = TAX_REGIMES[settings.tdsRegime];
  const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
  return [
    {
      key: 'gross',
      title: 'Gross pay',
      rule: 'Gross = every earning in the person’s salary (Basic, DA, HRA, allowances) plus any personal allowance they were given.',
    },
    {
      key: 'lop',
      title: 'Loss of pay',
      rule: settings.autoCalculateLOP
        ? `A month has ${settings.workingDaysPerMonth} working days. Each day marked absent without approved paid leave is unpaid; a half-day counts as half. Every earning is paid in proportion to the days paid.`
        : 'Loss of pay is switched off — attendance does not change pay.',
    },
    {
      key: 'pf',
      title: 'Provident Fund',
      rule: `${settings.employeePfRate}% of PF wages (Basic + DA) is deducted, and the campus adds ${settings.pfRate}%. PF wages are capped at ${inr(PF_WAGE_CEILING)} a month, so the most either side pays is ${inr((PF_WAGE_CEILING * settings.employeePfRate) / 100)}.`,
    },
    {
      key: 'esi',
      title: 'ESI',
      rule: `Only for people whose gross is ${inr(settings.esiThreshold)} or less: ${settings.esiEmployeeRate}% from the employee and ${settings.esiEmployerRate}% from the campus.`,
    },
    {
      key: 'pt',
      title: 'Professional tax',
      rule: settings.ptSlabs?.length
        ? `Deducted by gross slab: ${settings.ptSlabs.map((s) => `${inr(s.fromAmount)}–${inr(s.toAmount)} → ${inr(s.tax)}`).join('; ')}.`
        : 'No professional-tax slabs are set for this campus.',
    },
    {
      key: 'tds',
      title: 'Income tax (TDS)',
      rule: `${R.label}: this month’s gross × 12, minus the ${inr(R.standardDeduction)} standard deduction, taxed at ${R.slabs
        .map((s, i) => `${s.rate}%${s.upTo === Infinity ? ' above' : ` up to ${inr(s.upTo)}`}${i < R.slabs.length - 1 ? '' : ''}`)
        .join(', ')}. No tax if taxable income is ${inr(R.rebateUpTo)} or less (Section 87A${settings.tdsRegime === 'new' ? ', with marginal relief just above it' : ''}). 4% cess on top; the year’s tax is split evenly over 12 months.`,
    },
    {
      key: 'other',
      title: 'Loans and recoveries',
      rule: 'Loan or advance recoveries are deducted every month between their start and end month until the full amount is recovered; one-time deductions apply once.',
    },
    {
      key: 'net',
      title: 'Take-home and cost',
      rule: 'Take-home = gross − all deductions. Cost to the campus each month = gross + employer PF + employer ESI.',
    },
    {
      key: 'flow',
      title: 'A pay run',
      rule: 'Calculate the month (payslips are drafts you can recalculate) → review and finalize (locks the month) → pay through the payout gateway or record a bank transfer → payslips are released to staff.',
    },
  ];
}

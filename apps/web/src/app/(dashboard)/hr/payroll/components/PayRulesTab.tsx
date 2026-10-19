'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calculator, Info } from 'lucide-react';
import { payrollApi } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Meter, Panel, Segmented } from '@/components/connect/kit';

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/**
 * "How pay works": the payroll rules in plain words with this campus's
 * numbers, and a calculator that runs the exact maths a pay run uses.
 */
export function PayRulesTab() {
  const { data: rulesData } = useQuery({ queryKey: ['payroll-rules'], queryFn: () => payrollApi.getPayrollRules() });
  const rules = rulesData?.data.rules ?? [];

  const [basic, setBasic] = useState('35000');
  const [da, setDa] = useState('7000');
  const [hra, setHra] = useState('14000');
  const [other, setOther] = useState('9000');
  const [lop, setLop] = useState(0);
  const [regime, setRegime] = useState<'new' | 'old'>('new');
  const [debounced, setDebounced] = useState({ basic, da, hra, other, lop, regime });
  useEffect(() => {
    const t = setTimeout(() => setDebounced({ basic, da, hra, other, lop, regime }), 300);
    return () => clearTimeout(t);
  }, [basic, da, hra, other, lop, regime]);

  const n = (s: string) => Math.max(0, Number(s) || 0);
  const earnings = [
    { code: 'BASIC', name: 'Basic', amount: n(debounced.basic) },
    { code: 'DA', name: 'Dearness Allowance', amount: n(debounced.da) },
    { code: 'HRA', name: 'House Rent Allowance', amount: n(debounced.hra) },
    { code: 'SPECIAL', name: 'Special Allowance', amount: n(debounced.other) },
  ].filter((e) => e.amount > 0);
  const { data: previewData, isFetching } = useQuery({
    queryKey: ['payslip-preview', debounced],
    queryFn: () => payrollApi.previewPayslip({ earnings, lopDays: debounced.lop, regime: debounced.regime }),
    enabled: earnings.some((e) => e.code === 'BASIC'),
    placeholderData: (prev) => prev,
  });
  const p = previewData?.data;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
      <Panel title="How pay is calculated" description="The exact rules every pay run follows, with this campus’s settings">
        <ol className="space-y-5">
          {rules.map((r, i) => (
            <li key={r.key} className="flex gap-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{i + 1}</span>
              <div>
                <p className="font-semibold">{r.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{r.rule}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-6 flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Rates, the working days and professional-tax slabs come from Payroll settings. Tax slabs follow the Income-tax Act for FY 2025-26.
        </p>
      </Panel>

      <div className="space-y-4 xl:sticky xl:top-20 xl:self-start">
        <Panel title={<span className="flex items-center gap-2"><Calculator className="h-4 w-4 text-primary" />Try a salary</span>} description="Same maths as a pay run">
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ['Basic', basic, setBasic],
                ['DA', da, setDa],
                ['HRA', hra, setHra],
                ['Other allowances', other, setOther],
              ] as const
            ).map(([label, v, set]) => (
              <div key={label} className="space-y-1">
                <Label className="text-xs">{label} / month</Label>
                <Input type="number" value={v} onChange={(e) => set(e.target.value)} className="h-9 tabular-nums" />
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              <Label className="text-xs">Unpaid days</Label>
              <input type="range" min={0} max={10} value={lop} onChange={(e) => setLop(Number(e.target.value))} className="w-28 accent-[hsl(var(--primary))]" />
              <span className="w-4 tabular-nums">{lop}</span>
            </div>
            <Segmented<'new' | 'old'>
              value={regime}
              onChange={setRegime}
              options={[
                { value: 'new', label: 'New regime' },
                { value: 'old', label: 'Old regime' },
              ]}
            />
          </div>

          {p && (
            <div className={cn('mt-5 space-y-4 transition-opacity', isFetching && 'opacity-60')}>
              <div className="grid grid-cols-3 gap-2 text-center">
                <Big label="Gross" value={inr(p.grossEarnings)} />
                <Big label="Deductions" value={inr(p.totalDeductions)} tone="text-rose-600" />
                <Big label="Take-home" value={inr(p.netPayable)} tone="text-success" />
              </div>
              <div>
                <div className="flex h-3 overflow-hidden rounded-full bg-muted">
                  <span className="bg-success" style={{ width: `${(p.netPayable / Math.max(1, p.grossEarnings)) * 100}%` }} />
                  {p.deductions.map((d, i) => (
                    <span key={d.code} className={['bg-rose-500', 'bg-amber-500', 'bg-violet-500', 'bg-sky-500', 'bg-slate-500'][i % 5]} style={{ width: `${(d.amount / Math.max(1, p.grossEarnings)) * 100}%` }} />
                  ))}
                </div>
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y">
                  {p.earnings.map((e) => (
                    <tr key={e.code}>
                      <td className="py-1.5">{e.name}</td>
                      <td className="py-1.5 text-right tabular-nums">{inr(e.amount)}</td>
                    </tr>
                  ))}
                  {p.lopDeduction > 0 && (
                    <tr>
                      <td className="py-1.5 text-muted-foreground">Loss of pay ({p.lopDays} days)</td>
                      <td className="py-1.5 text-right tabular-nums text-rose-600">−{inr(p.lopDeduction)}</td>
                    </tr>
                  )}
                  {p.deductions.map((d) => (
                    <tr key={d.code}>
                      <td className="py-1.5 text-muted-foreground">{d.name}</td>
                      <td className="py-1.5 text-right tabular-nums text-rose-600">−{inr(d.amount)}</td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td className="py-2">Take-home</td>
                    <td className="py-2 text-right tabular-nums text-success">{inr(p.netPayable)}</td>
                  </tr>
                </tbody>
              </table>
              <div className="rounded-lg bg-muted/40 p-3 text-xs">
                <p className="font-medium">Cost to campus {inr(p.monthlyCost)}/month · {inr(p.monthlyCost * 12)}/year</p>
                <p className="mt-0.5 text-muted-foreground">
                  Includes employer PF {inr(p.employer.pf)}
                  {p.employer.esi ? ` and ESI ${inr(p.employer.esi)}` : ''}.
                </p>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Income tax this year</p>
                <div className="flex justify-between text-sm">
                  <span>Taxable {inr(p.tds.taxableIncome)}</span>
                  <span className="font-semibold tabular-nums">{p.tds.annualTax ? inr(p.tds.annualTax) : 'Nil'}</span>
                </div>
                <Meter value={Math.min(100, (p.tds.taxableIncome / 2400000) * 100)} className="mt-1.5" />
                {p.tds.rebate > 0 && <p className="mt-1 text-xs text-success">Section 87A rebate saves {inr(p.tds.rebate)}</p>}
              </div>
              <ul className="space-y-1 border-t pt-3 text-xs text-muted-foreground">
                {p.explain.map((x) => (
                  <li key={x}>• {x}</li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Big({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-muted/40 px-2 py-2.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn('text-base font-bold tabular-nums', tone)}>{value}</p>
    </div>
  );
}

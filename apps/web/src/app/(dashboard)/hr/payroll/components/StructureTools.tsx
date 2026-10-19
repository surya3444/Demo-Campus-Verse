'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Eye, Pencil, Sparkles, Trash2 } from 'lucide-react';
import { payrollApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { StatusPill } from '@/components/connect/kit';

export interface Component {
  code: string;
  name: string;
  type: 'fixed' | 'percentage';
  percentageOf?: string;
  defaultAmount: number;
  isTaxable?: boolean;
  isFixed?: boolean;
  isStatutory?: boolean;
  isAutoCalculated?: boolean;
}

const STATUTORY = ['PF', 'ESI', 'PT', 'TDS'];
const PALETTE = ['bg-primary', 'bg-sky-500', 'bg-violet-500', 'bg-amber-500', 'bg-emerald-500', 'bg-rose-500', 'bg-slate-500'];
const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/**
 * Turn a structure's components into rupee amounts for a given Basic:
 * fixed amounts as they are, "x% of CODE" against that component (in any
 * order), "x% of GROSS" against the fixed + resolved total.
 */
export function resolveEarnings(components: Component[], basic: number) {
  const out = new Map<string, number>();
  const basicC = components.find((c) => c.code === 'BASIC');
  out.set('BASIC', basicC?.type === 'fixed' && basicC.defaultAmount ? basicC.defaultAmount : basic);
  for (let pass = 0; pass < 4; pass++) {
    for (const c of components) {
      if (!c.code || c.code === 'BASIC' || out.has(c.code)) continue;
      if (c.type === 'fixed') out.set(c.code, c.defaultAmount || 0);
      else if (c.percentageOf && c.percentageOf !== 'GROSS' && out.has(c.percentageOf))
        out.set(c.code, ((out.get(c.percentageOf) ?? 0) * (c.defaultAmount || 0)) / 100);
    }
  }
  const subtotal = [...out.values()].reduce((n, v) => n + v, 0);
  for (const c of components) if (c.code && !out.has(c.code) && c.percentageOf === 'GROSS') out.set(c.code, (subtotal * (c.defaultAmount || 0)) / 100);
  return components
    .filter((c) => c.code)
    .map((c) => ({ code: c.code, name: c.name || c.code, amount: Math.round(out.get(c.code) ?? 0) }));
}

/* ── Templates ─────────────────────────────────────────────────────── */

const E = (code: string, name: string, type: 'fixed' | 'percentage', amount: number, of?: string): Component => ({
  code,
  name,
  type,
  defaultAmount: amount,
  percentageOf: of,
  isTaxable: code !== 'CONV',
  isFixed: code === 'BASIC',
});

export const STRUCTURE_TEMPLATES: Array<{ key: string; name: string; code: string; blurb: string; basic: number; earnings: Component[] }> = [
  {
    key: 'teaching',
    name: 'Teaching faculty',
    code: 'TEACH',
    blurb: 'Basic + DA 12% + HRA 40% + academic allowance',
    basic: 45000,
    earnings: [E('BASIC', 'Basic', 'fixed', 0), E('DA', 'Dearness Allowance', 'percentage', 12, 'BASIC'), E('HRA', 'House Rent Allowance', 'percentage', 40, 'BASIC'), E('ACAD', 'Academic Allowance', 'fixed', 4000), E('CONV', 'Conveyance', 'fixed', 1600)],
  },
  {
    key: 'nonteaching',
    name: 'Non-teaching staff',
    code: 'NONTEACH',
    blurb: 'Basic + DA 10% + HRA 30% + conveyance',
    basic: 22000,
    earnings: [E('BASIC', 'Basic', 'fixed', 0), E('DA', 'Dearness Allowance', 'percentage', 10, 'BASIC'), E('HRA', 'House Rent Allowance', 'percentage', 30, 'BASIC'), E('CONV', 'Conveyance', 'fixed', 1200)],
  },
  {
    key: 'leadership',
    name: 'Leadership (HoD, Dean)',
    code: 'LEAD',
    blurb: 'Basic + DA + HRA 50% + responsibility allowance',
    basic: 90000,
    earnings: [E('BASIC', 'Basic', 'fixed', 0), E('DA', 'Dearness Allowance', 'percentage', 12, 'BASIC'), E('HRA', 'House Rent Allowance', 'percentage', 50, 'BASIC'), E('RESP', 'Responsibility Allowance', 'fixed', 15000)],
  },
  {
    key: 'contract',
    name: 'Contract / guest',
    code: 'CONTRACT',
    blurb: 'One consolidated monthly pay',
    basic: 30000,
    earnings: [E('BASIC', 'Consolidated Pay', 'fixed', 0)],
  },
];

export function StructureTemplates({ onPick }: { onPick: (t: (typeof STRUCTURE_TEMPLATES)[number]) => void }) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-primary" /> Start from a template
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {STRUCTURE_TEMPLATES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onPick(t)}
            className="rounded-xl border p-3 text-left transition hover:border-primary/40 hover:bg-primary/[0.03]"
          >
            <p className="text-sm font-semibold">{t.name}</p>
            <p className="text-xs text-muted-foreground">{t.blurb}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Live preview ──────────────────────────────────────────────────── */

export function StructurePreview({ earnings, deductions }: { earnings: Component[]; deductions: Component[] }) {
  const [basic, setBasic] = useState('40000');
  const [key, setKey] = useState('');
  const lines = resolveEarnings(earnings, Number(basic) || 0).filter((l) => l.amount > 0);
  const fixedDeductions = deductions
    .filter((d) => d.code && !STATUTORY.includes(d.code) && d.type === 'fixed' && d.defaultAmount > 0)
    .map((d) => ({ code: d.code, name: d.name || d.code, amount: d.defaultAmount }));
  const manualStatutory = deductions.filter((d) => STATUTORY.includes(d.code));
  const payload = JSON.stringify({ lines, fixedDeductions });
  useEffect(() => {
    const t = setTimeout(() => setKey(payload), 350);
    return () => clearTimeout(t);
  }, [payload]);
  const { data, isFetching } = useQuery({
    queryKey: ['structure-preview', key],
    queryFn: () => payrollApi.previewPayslip({ earnings: lines, deductions: fixedDeductions }),
    enabled: !!key && lines.some((l) => l.code === 'BASIC'),
    placeholderData: (prev) => prev,
  });
  const p = data?.data;
  const gross = lines.reduce((n, l) => n + l.amount, 0) || 1;

  return (
    <aside className="space-y-4 rounded-2xl border bg-muted/20 p-4 lg:sticky lg:top-0 lg:self-start">
      <div>
        <p className="text-sm font-semibold">Live preview</p>
        <p className="text-xs text-muted-foreground">What someone on this structure takes home</p>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Sample Basic / month</Label>
        <Input type="number" value={basic} onChange={(e) => setBasic(e.target.value)} className="h-9 bg-card tabular-nums" />
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
        {lines.map((l, i) => (
          <span key={l.code} className={PALETTE[i % PALETTE.length]} style={{ width: `${(l.amount / gross) * 100}%` }} title={`${l.name} ${inr(l.amount)}`} />
        ))}
      </div>
      <ul className="space-y-1.5 text-sm">
        {lines.map((l, i) => (
          <li key={l.code} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <span className={cn('h-2 w-2 rounded-full', PALETTE[i % PALETTE.length])} />
              {l.name}
            </span>
            <span className="tabular-nums">{inr(l.amount)}</span>
          </li>
        ))}
      </ul>
      {p && (
        <div className={cn('space-y-3 border-t pt-3 transition-opacity', isFetching && 'opacity-60')}>
          <Row label="Gross" value={inr(p.grossEarnings)} />
          {p.deductions.map((d) => (
            <Row key={d.code} label={d.name} value={`−${inr(d.amount)}`} muted />
          ))}
          <Row label="Take-home" value={inr(p.netPayable)} strong />
          <div className="rounded-lg bg-card p-2.5 text-xs">
            <p className="font-medium">CTC {inr(p.monthlyCost * 12)} / year</p>
            <p className="text-muted-foreground">Gross + employer PF{p.employer.esi ? ' + ESI' : ''}</p>
          </div>
        </div>
      )}
      {manualStatutory.length > 0 && (
        <p className="flex gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {manualStatutory.map((d) => d.code).join(', ')} {manualStatutory.length > 1 ? 'are' : 'is'} calculated automatically in every pay run from the law and Payroll settings — values entered here are ignored.
        </p>
      )}
      {!earnings.some((e) => e.code === 'BASIC') && <p className="text-xs text-rose-600">Add a BASIC earning — PF and many allowances are worked out from it.</p>}
    </aside>
  );
}

function Row({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className={cn('flex justify-between text-sm', strong && 'font-semibold', muted && 'text-muted-foreground')}>
      <span>{label}</span>
      <span className={cn('tabular-nums', strong && 'text-success', muted && 'text-rose-600')}>{value}</span>
    </div>
  );
}

/* ── Card for the list ─────────────────────────────────────────────── */

export function StructureCard({
  s,
  appliesTo,
  canEdit,
  onView,
  onEdit,
  onDelete,
}: {
  s: { _id: string; name: string; code: string; description?: string; status: string; earnings: Component[]; deductions: Component[] };
  appliesTo: string;
  canEdit: boolean;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const sample = 40000;
  const lines = resolveEarnings(s.earnings, sample).filter((l) => l.amount > 0);
  const gross = lines.reduce((n, l) => n + l.amount, 0);
  return (
    <div className="group flex flex-col rounded-2xl border bg-card p-5 shadow-xs transition hover:-translate-y-0.5 hover:shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{s.name}</p>
          <p className="font-mono text-xs text-muted-foreground">{s.code}</p>
        </div>
        <StatusPill status={s.status} />
      </div>
      {s.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{s.description}</p>}
      <div className="mt-4">
        <div className="flex h-2 overflow-hidden rounded-full bg-muted">
          {lines.map((l, i) => (
            <span key={l.code} className={PALETTE[i % PALETTE.length]} style={{ width: `${(l.amount / Math.max(1, gross)) * 100}%` }} />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {lines.map((l, i) => (
            <span key={l.code} className="flex items-center gap-1">
              <span className={cn('h-1.5 w-1.5 rounded-full', PALETTE[i % PALETTE.length])} />
              {l.name}
            </span>
          ))}
        </div>
      </div>
      <p className="mt-3 text-sm">
        At Basic {inr(sample)} → gross <span className="font-semibold tabular-nums">{inr(gross)}</span>
      </p>
      <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3 [margin-top:1rem]">
        <span className="truncate text-xs text-muted-foreground">Applies to {appliesTo}</span>
        <div className="flex shrink-0 gap-1 opacity-70 transition group-hover:opacity-100">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onView} aria-label="View">
            <Eye className="h-4 w-4" />
          </Button>
          {canEdit && (
            <>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit} aria-label="Edit">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete} aria-label="Deactivate">
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

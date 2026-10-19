'use client';

import { CalendarDays, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

/* ── Payment plans ─────────────────────────────────────────────────── */

export type PlanType = 'full' | 'semester' | 'quarterly' | 'monthly' | 'custom';
export interface PaymentPlan {
  type: PlanType;
  /** ISO date of the first instalment. */
  firstDueDate: string;
  /** Split of the total per instalment, in %; must add up to 100. */
  splits: number[];
  /** Months between instalments. */
  intervalMonths: number;
}

export const PLAN_PRESETS: Record<
  Exclude<PlanType, 'custom'>,
  { label: string; blurb: string; splits: number[]; intervalMonths: number }
> = {
  full: { label: 'One payment', blurb: 'The full year at once', splits: [100], intervalMonths: 0 },
  semester: {
    label: 'Two semesters',
    blurb: '50% now, 50% in six months',
    splits: [50, 50],
    intervalMonths: 6,
  },
  quarterly: {
    label: 'Four quarters',
    blurb: '25% every three months',
    splits: [25, 25, 25, 25],
    intervalMonths: 3,
  },
  monthly: {
    label: 'Ten months',
    blurb: '10% each month of the academic year',
    splits: Array(10).fill(10),
    intervalMonths: 1,
  },
};

/** A sensible first due date: the 10th of next month. */
export const nextDueDate = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 10).toISOString().slice(0, 10);
};

export function defaultPlan(): PaymentPlan {
  return { type: 'semester', firstDueDate: nextDueDate(), ...PLAN_PRESETS.semester };
}

const addMonths = (iso: string, n: number) => {
  const d = new Date(iso);
  return new Date(d.getFullYear(), d.getMonth() + n, d.getDate());
};

const ORDINAL = [
  'First',
  'Second',
  'Third',
  'Fourth',
  'Fifth',
  'Sixth',
  'Seventh',
  'Eighth',
  'Ninth',
  'Tenth',
  'Eleventh',
  'Twelfth',
];
const nameFor = (plan: PaymentPlan, i: number) =>
  plan.splits.length === 1
    ? 'Full payment'
    : plan.type === 'semester'
      ? `Semester ${i + 1}`
      : plan.type === 'quarterly'
        ? `Quarter ${i + 1}`
        : plan.type === 'monthly'
          ? addMonths(plan.firstDueDate, i * plan.intervalMonths).toLocaleDateString('en-IN', {
              month: 'long',
            })
          : `${ORDINAL[i] ?? `#${i + 1}`} instalment`;

/**
 * Instalments for a set of component amounts: every component is split by
 * the plan's percentages (rounded to the rupee; the last instalment takes
 * the remainder so totals always match).
 */
export function buildInstallments(
  components: Array<{ code: string; amount: number }>,
  plan: PaymentPlan
) {
  const splits = plan.splits.length ? plan.splits : [100];
  return splits.map((pct, i) => ({
    name: nameFor(plan, i),
    dueDate: addMonths(plan.firstDueDate, i * plan.intervalMonths).toISOString(),
    percentage: pct,
    components: components.map((c) => {
      const share = Math.round((c.amount * pct) / 100);
      const before = splits.slice(0, i).reduce((n, p) => n + Math.round((c.amount * p) / 100), 0);
      return {
        componentCode: c.code,
        amount: i === splits.length - 1 ? Math.max(0, c.amount - before) : share,
      };
    }),
  }));
}

export function PaymentPlanPicker({
  plan,
  onChange,
  total,
}: {
  plan: PaymentPlan;
  onChange: (p: PaymentPlan) => void;
  total?: number;
}) {
  const sum = plan.splits.reduce((n, s) => n + s, 0);
  const schedule = buildInstallments([{ code: 'T', amount: total ?? 0 }], plan);
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-5">
        {(Object.keys(PLAN_PRESETS) as Array<Exclude<PlanType, 'custom'>>).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() =>
              onChange({
                ...plan,
                type: k,
                splits: [...PLAN_PRESETS[k].splits],
                intervalMonths: PLAN_PRESETS[k].intervalMonths,
              })
            }
            className={cn(
              'rounded-xl border p-2.5 text-left transition',
              plan.type === k ? 'border-primary bg-primary/[0.06]' : 'hover:border-primary/40'
            )}
          >
            <p className="text-sm font-semibold">{PLAN_PRESETS[k].label}</p>
            <p className="text-[11px] leading-snug text-muted-foreground">
              {PLAN_PRESETS[k].blurb}
            </p>
          </button>
        ))}
        <button
          type="button"
          onClick={() =>
            onChange({ ...plan, type: 'custom', intervalMonths: plan.intervalMonths || 1 })
          }
          className={cn(
            'rounded-xl border p-2.5 text-left transition',
            plan.type === 'custom' ? 'border-primary bg-primary/[0.06]' : 'hover:border-primary/40'
          )}
        >
          <p className="text-sm font-semibold">Custom</p>
          <p className="text-[11px] leading-snug text-muted-foreground">Your own split</p>
        </button>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">First due date</Label>
          <Input
            type="date"
            value={plan.firstDueDate}
            onChange={(e) => onChange({ ...plan, firstDueDate: e.target.value })}
            className="h-9 w-44"
          />
        </div>
        {plan.type === 'custom' && (
          <>
            <div className="space-y-1">
              <Label className="text-xs">Split (%), comma-separated</Label>
              <Input
                value={plan.splits.join(', ')}
                onChange={(e) =>
                  onChange({
                    ...plan,
                    splits: e.target.value
                      .split(',')
                      .map((x) => Number(x.trim()))
                      .filter((x) => x > 0),
                  })
                }
                className="h-9 w-56"
                placeholder="40, 30, 30"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Months apart</Label>
              <Input
                type="number"
                min={1}
                max={12}
                value={plan.intervalMonths}
                onChange={(e) =>
                  onChange({ ...plan, intervalMonths: Math.max(1, Number(e.target.value) || 1) })
                }
                className="h-9 w-24"
              />
            </div>
          </>
        )}
      </div>
      {sum !== 100 && (
        <p className="text-xs text-rose-600">The split adds up to {sum}% — it must be 100%.</p>
      )}
      <ol className="flex flex-wrap gap-2">
        {schedule.map((s) => (
          <li key={s.name + s.dueDate} className="rounded-lg border bg-card px-3 py-2 text-xs">
            <p className="font-medium">{s.name}</p>
            <p className="flex items-center gap-1 text-muted-foreground">
              <CalendarDays className="h-3 w-3" />
              {new Date(s.dueDate).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </p>
            <p className="mt-0.5 tabular-nums">
              {s.percentage}%{total ? ` · ₹${s.components[0].amount.toLocaleString('en-IN')}` : ''}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ── Late fee ──────────────────────────────────────────────────────── */

export interface FineRule {
  enabled: boolean;
  type: 'fixed' | 'percentage' | 'daily';
  amount: number;
  gracePeriodDays: number;
  maxFine: number;
}
export const DEFAULT_FINE: FineRule = {
  enabled: false,
  type: 'daily',
  amount: 25,
  gracePeriodDays: 7,
  maxFine: 1000,
};

export const describeFine = (f?: Partial<FineRule> | null) =>
  !f || f.enabled === false || !f.amount
    ? 'No late fee'
    : `${f.type === 'fixed' ? `₹${f.amount} once` : f.type === 'percentage' ? `${f.amount}% of the balance` : `₹${f.amount} a day`} after ${f.gracePeriodDays ?? 0} grace day${f.gracePeriodDays === 1 ? '' : 's'}${f.maxFine ? `, up to ₹${f.maxFine.toLocaleString('en-IN')}` : ''}`;

export function LateFeeEditor({
  fine,
  onChange,
}: {
  fine: FineRule;
  onChange: (f: FineRule) => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border p-4">
      <label className="flex items-center justify-between gap-3">
        <span>
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <Clock className="h-4 w-4 text-primary" /> Late fee
          </span>
          <span className="block text-xs text-muted-foreground">{describeFine(fine)}</span>
        </span>
        <Switch checked={fine.enabled} onCheckedChange={(v) => onChange({ ...fine, enabled: v })} />
      </label>
      {fine.enabled && (
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs">Charged as</Label>
            <Select
              value={fine.type}
              onValueChange={(v) => onChange({ ...fine, type: v as FineRule['type'] })}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">₹ per day</SelectItem>
                <SelectItem value="fixed">One-time ₹</SelectItem>
                <SelectItem value="percentage">% of balance</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">
              {fine.type === 'percentage' ? 'Percent' : 'Amount (₹)'}
            </Label>
            <Input
              type="number"
              min={0}
              value={fine.amount}
              onChange={(e) => onChange({ ...fine, amount: Number(e.target.value) || 0 })}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Grace days</Label>
            <Input
              type="number"
              min={0}
              value={fine.gracePeriodDays}
              onChange={(e) => onChange({ ...fine, gracePeriodDays: Number(e.target.value) || 0 })}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Cap (₹)</Label>
            <Input
              type="number"
              min={0}
              value={fine.maxFine}
              onChange={(e) => onChange({ ...fine, maxFine: Number(e.target.value) || 0 })}
              className="h-9"
            />
          </div>
        </div>
      )}
    </div>
  );
}

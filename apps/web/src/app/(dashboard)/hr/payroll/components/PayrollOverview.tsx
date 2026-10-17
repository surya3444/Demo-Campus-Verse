'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CheckCircle2,
  Circle,
  CircleDot,
  IndianRupee,
  Loader2,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { payrollApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

interface Run {
  _id: string;
  month: number;
  year: number;
  staffCount: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  status: string;
  processedAt?: string;
  finalizedAt?: string;
}
type Breakdown = Awaited<ReturnType<typeof payrollApi.getPayrollRunBreakdown>>['data'];

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** ₹2.28 Cr / ₹15.3 L / ₹8,400 — Indian units for headline numbers and axes. */
function inr(n: number) {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)} L`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

const reduceMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Counts up to `target` once (eased); instant for reduced-motion users. */
function useCountUp(target: number, duration = 1100) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!target || reduceMotion()) return setValue(target);
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setValue(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}

/** Fills from 0 to `pct` just after mount, so bars and meters grow in. */
function useGrow(pct: number, delay = 0) {
  const [w, setW] = useState(reduceMotion() ? pct : 0);
  useEffect(() => {
    if (reduceMotion()) return setW(pct);
    const id = setTimeout(() => setW(pct), 60 + delay);
    return () => clearTimeout(id);
  }, [pct, delay]);
  return w;
}

function Kpi({
  label,
  value,
  format,
  hint,
  icon: Icon,
  delay,
}: {
  label: string;
  value: number;
  format: (n: number) => string;
  hint: string;
  icon: typeof Users;
  delay: number;
}) {
  const shown = useCountUp(value);
  return (
    <div
      className="rounded-xl border bg-card p-4 motion-safe:animate-fade-up [animation-fill-mode:both]"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
      </div>
      <p className="mt-2 font-display text-2xl font-bold tabular-nums">{format(shown)}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function Meter({
  value,
  max,
  delay = 0,
  label,
}: {
  value: number;
  max: number;
  delay?: number;
  label: string;
}) {
  const pct = max ? (value / max) * 100 : 0;
  const w = useGrow(pct, delay);
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-muted"
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <div
        className="h-full rounded-full bg-[var(--pay-net)] transition-[width] duration-1000 ease-out"
        style={{ width: `${w}%` }}
      />
    </div>
  );
}

/** Processed → Finalized → Paid, lighting up in order. */
function RunJourney({ run, breakdown }: { run: Run; breakdown: Breakdown | null }) {
  const paid = breakdown?.paidCount ?? 0;
  const steps = [
    {
      title: 'Processed',
      detail: run.processedAt
        ? new Date(run.processedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
        : 'Payslips created',
      state: 'done' as const,
    },
    {
      title: 'Finalized',
      detail:
        run.status === 'finalized'
          ? run.finalizedAt
            ? new Date(run.finalizedAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
              })
            : 'Approved'
          : 'Awaiting approval',
      state: run.status === 'finalized' ? ('done' as const) : ('current' as const),
    },
    {
      title: 'Paid',
      detail: `${paid.toLocaleString('en-IN')} of ${run.staffCount.toLocaleString('en-IN')} credited`,
      state:
        paid >= run.staffCount && run.staffCount > 0
          ? ('done' as const)
          : run.status === 'finalized'
            ? ('current' as const)
            : ('todo' as const),
    },
  ];
  const Icon = { done: CheckCircle2, current: CircleDot, todo: Circle };
  return (
    <section
      className="rounded-xl border bg-card p-5 motion-safe:animate-fade-up [animation-fill-mode:both]"
      style={{ animationDelay: '80ms' }}
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Latest payroll
          </p>
          <h3 className="font-display text-xl font-semibold">
            {MONTH_LONG[run.month - 1]} {run.year}
          </h3>
        </div>
        <p className="text-sm text-muted-foreground">
          {run.staffCount.toLocaleString('en-IN')} staff · net {formatCurrency(run.totalNet)}
        </p>
      </div>
      <ol className="mt-5 grid grid-cols-3 gap-3">
        {steps.map((s, i) => {
          const I = Icon[s.state];
          return (
            <li
              key={s.title}
              className="motion-safe:animate-fade-up [animation-fill-mode:both]"
              style={{ animationDelay: `${250 + i * 220}ms` }}
            >
              <div className="flex items-center gap-2">
                <I
                  className={`h-5 w-5 shrink-0 ${s.state === 'todo' ? 'text-muted-foreground' : 'text-primary'} ${s.state === 'current' ? 'motion-safe:animate-pulse-soft' : ''}`}
                  aria-hidden
                />
                <span className="text-sm font-semibold">{s.title}</span>
                <span className="sr-only">
                  {s.state === 'done'
                    ? 'done'
                    : s.state === 'current'
                      ? 'in progress'
                      : 'not started'}
                </span>
              </div>
              <p className="ml-7 text-xs text-muted-foreground">{s.detail}</p>
            </li>
          );
        })}
      </ol>
      <div className="mt-4 space-y-1">
        <Meter value={paid} max={run.staffCount} delay={700} label="Salaries credited" />
        <p className="text-right text-xs text-muted-foreground tabular-nums">
          {run.staffCount ? Math.round((paid / run.staffCount) * 100) : 0}% credited
        </p>
      </div>
    </section>
  );
}

/** A ranked list of bars (one series), growing in one after another. */
function BarList({
  rows,
  total,
  columns = 1,
}: {
  rows: Array<{ label: string; value: number; note?: string }>;
  total: number;
  /** 2 = flow into two columns on wide screens. */
  columns?: 1 | 2;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className={columns === 2 ? 'grid gap-x-10 gap-y-3 md:grid-cols-2' : 'space-y-3'}>
      {rows.map((r, i) => (
        <BarRow
          key={r.label}
          {...r}
          pct={(r.value / max) * 100}
          share={total ? r.value / total : 0}
          delay={i * 90}
        />
      ))}
    </ul>
  );
}
function BarRow({
  label,
  value,
  note,
  pct,
  share,
  delay,
}: {
  label: string;
  value: number;
  note?: string;
  pct: number;
  share: number;
  delay: number;
}) {
  const w = useGrow(pct, delay);
  return (
    <li title={`${label}: ${formatCurrency(value)}${note ? ` · ${note}` : ''}`}>
      <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
        <span className="truncate">{label}</span>
        <span className="shrink-0 tabular-nums text-muted-foreground">
          {inr(value)} <span className="text-xs">· {Math.round(share * 100)}%</span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-[var(--pay-net)] transition-[width] duration-700 ease-out"
          style={{ width: `${w}%` }}
        />
      </div>
      {note && <p className="mt-0.5 text-[11px] text-muted-foreground">{note}</p>}
    </li>
  );
}

function TrendTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { label: string; net: number; deductions: number; staff: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold">{d.label}</p>
      <p className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-sm bg-[var(--pay-net)]" /> Take-home{' '}
        {formatCurrency(d.net)}
      </p>
      <p className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-sm bg-[var(--pay-ded)]" /> Deductions{' '}
        {formatCurrency(d.deductions)}
      </p>
      <p className="mt-1 text-muted-foreground">
        Gross {formatCurrency(d.net + d.deductions)} · {d.staff} staff
      </p>
    </div>
  );
}

export function PayrollOverview() {
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);

  useEffect(() => {
    payrollApi
      .getPayrollRuns({ limit: 12 })
      .then((r) => setRuns(((r.data ?? []) as Run[]).filter((x) => x.status !== 'cancelled')))
      .catch(() => {
        toast.error('Failed to load payroll data');
        setRuns([]);
      });
  }, []);

  const sorted = useMemo(
    () => [...(runs ?? [])].sort((a, b) => a.year - b.year || a.month - b.month),
    [runs]
  );
  const latest = sorted[sorted.length - 1];

  useEffect(() => {
    if (!latest) return;
    payrollApi
      .getPayrollRunBreakdown(latest._id)
      .then((r) => setBreakdown(r.data))
      .catch(() => setBreakdown(null));
  }, [latest?._id]); // re-fetch only when the latest run changes

  if (runs === null) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!latest) {
    return (
      <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        No payroll runs yet. Process your first payroll from the “Process Payroll” tab.
      </p>
    );
  }

  const year = latest.year;
  const paidThisYear = sorted
    .filter((r) => r.year === year && r.status === 'finalized')
    .reduce((n, r) => n + r.totalNet, 0);
  const trend = sorted.slice(-6).map((r) => ({
    label: `${MONTH[r.month - 1]} ${String(r.year).slice(2)}`,
    net: Math.round(r.totalNet),
    deductions: Math.round(r.totalDeductions),
    staff: r.staffCount,
    pending: r.status !== 'finalized',
  }));
  const earnTotal = (breakdown?.earnings ?? []).reduce((n, e) => n + e.amount, 0);
  const deptTotal = (breakdown?.departments ?? []).reduce((n, d) => n + d.net, 0);

  return (
    <div className="payroll-viz space-y-6">
      {/* Series colours, validated (CVD + contrast) for the light and dark card surfaces. */}
      <style>{`.payroll-viz{--pay-net:#2a78d6;--pay-ded:#eb6834}.dark .payroll-viz{--pay-net:#3987e5;--pay-ded:#d95926}`}</style>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi
          label="Staff on payroll"
          value={latest.staffCount}
          format={(n) => Math.round(n).toLocaleString('en-IN')}
          hint={`${MONTH_LONG[latest.month - 1]} ${latest.year}`}
          icon={Users}
          delay={0}
        />
        <Kpi
          label="Net payroll"
          value={latest.totalNet}
          format={inr}
          hint={`Take-home for ${MONTH_LONG[latest.month - 1]}`}
          icon={Wallet}
          delay={70}
        />
        <Kpi
          label={`Paid in ${year}`}
          value={paidThisYear}
          format={inr}
          hint={`${sorted.filter((r) => r.year === year && r.status === 'finalized').length} months finalized`}
          icon={IndianRupee}
          delay={140}
        />
        <Kpi
          label="Avg. take-home"
          value={latest.staffCount ? latest.totalNet / latest.staffCount : 0}
          format={inr}
          hint="Per staff member"
          icon={TrendingUp}
          delay={210}
        />
      </div>

      <RunJourney run={latest} breakdown={breakdown} />

      <div className="grid gap-6 lg:grid-cols-5">
        <section
          className="rounded-xl border bg-card p-5 motion-safe:animate-fade-up [animation-fill-mode:both] lg:col-span-3"
          style={{ animationDelay: '160ms' }}
        >
          <h3 className="font-semibold">Payroll cost — last {trend.length} months</h3>
          <p className="text-xs text-muted-foreground">
            Take-home plus deductions make up gross pay.
          </p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={trend}
                barCategoryGap="28%"
                margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
              >
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="0" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={80}
                  tickFormatter={(v: number) => inr(v)}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                />
                <Tooltip cursor={{ fill: 'hsl(var(--muted) / 0.5)' }} content={<TrendTooltip />} />
                <Legend
                  iconType="square"
                  iconSize={10}
                  wrapperStyle={{ fontSize: 12 }}
                  formatter={(v) => <span className="text-muted-foreground">{v}</span>}
                />
                <Bar
                  dataKey="net"
                  name="Take-home"
                  stackId="pay"
                  fill="var(--pay-net)"
                  stroke="hsl(var(--card))"
                  strokeWidth={2}
                  animationDuration={900}
                  isAnimationActive={!reduceMotion()}
                />
                <Bar
                  dataKey="deductions"
                  name="Deductions"
                  stackId="pay"
                  fill="var(--pay-ded)"
                  stroke="hsl(var(--card))"
                  strokeWidth={2}
                  radius={[4, 4, 0, 0]}
                  animationBegin={250}
                  animationDuration={900}
                  isAnimationActive={!reduceMotion()}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section
          className="rounded-xl border bg-card p-5 motion-safe:animate-fade-up [animation-fill-mode:both] lg:col-span-2"
          style={{ animationDelay: '240ms' }}
        >
          <h3 className="font-semibold">Where {MONTH_LONG[latest.month - 1]}&apos;s pay goes</h3>
          <p className="mb-4 text-xs text-muted-foreground">Gross earnings by component</p>
          {breakdown ? (
            <>
              <BarList
                rows={breakdown.earnings.map((e) => ({ label: e.name, value: e.amount }))}
                total={earnTotal}
              />
              <div className="mt-5 border-t pt-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Deducted
                </p>
                <ul className="space-y-1 text-sm">
                  {breakdown.deductions.map((d) => (
                    <li key={d.code} className="flex justify-between">
                      <span>{d.name}</span>
                      <span className="tabular-nums text-muted-foreground">{inr(d.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          )}
        </section>
      </div>

      {breakdown && breakdown.departments.length > 0 && (
        <section
          className="rounded-xl border bg-card p-5 motion-safe:animate-fade-up [animation-fill-mode:both]"
          style={{ animationDelay: '320ms' }}
        >
          <h3 className="font-semibold">Take-home by department</h3>
          <p className="mb-4 text-xs text-muted-foreground">
            {MONTH_LONG[latest.month - 1]} {latest.year}
          </p>
          <BarList
            rows={breakdown.departments.map((d) => ({
              label: d.name,
              value: d.net,
              note: `${d.staff} staff`,
            }))}
            total={deptTotal}
            columns={2}
          />
        </section>
      )}

      <section
        className="motion-safe:animate-fade-up [animation-fill-mode:both]"
        style={{ animationDelay: '400ms' }}
      >
        <h3 className="mb-3 text-lg font-semibold">Payroll runs</h3>
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3">Month</th>
                <th className="p-3 text-right">Staff</th>
                <th className="p-3 text-right">Gross</th>
                <th className="p-3 text-right">Deductions</th>
                <th className="p-3 text-right">Net</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[...sorted].reverse().map((r, i) => (
                <tr
                  key={r._id}
                  className="motion-safe:animate-fade-up [animation-fill-mode:both]"
                  style={{ animationDelay: `${450 + i * 50}ms` }}
                >
                  <td className="p-3 font-medium">
                    {MONTH_LONG[r.month - 1]} {r.year}
                  </td>
                  <td className="p-3 text-right tabular-nums">{r.staffCount}</td>
                  <td className="p-3 text-right tabular-nums">{formatCurrency(r.totalGross)}</td>
                  <td className="p-3 text-right tabular-nums">
                    {formatCurrency(r.totalDeductions)}
                  </td>
                  <td className="p-3 text-right font-semibold tabular-nums">
                    {formatCurrency(r.totalNet)}
                  </td>
                  <td className="p-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${r.status === 'finalized' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'}`}
                    >
                      {r.status === 'finalized' ? (
                        <CheckCircle2 className="h-3 w-3" aria-hidden />
                      ) : (
                        <CircleDot className="h-3 w-3" aria-hidden />
                      )}
                      {r.status === 'finalized' ? 'Finalized' : 'Awaiting approval'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

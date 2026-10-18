'use client';

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCountUp } from '@/hooks/useCountUp';

/* Shared pieces for the premium Connect modules (Career, Health). */

export const inr = (n: number) =>
  n >= 1e7
    ? `₹${(n / 1e7).toFixed(2)} Cr`
    : n >= 1e5
      ? `₹${(n / 1e5).toFixed(n >= 1e6 ? 0 : 1)} L`
      : `₹${Math.round(n).toLocaleString('en-IN')}`;
export const lpa = (n: number) => `₹${(n / 1e5).toFixed(n % 1e5 ? 1 : 0)} LPA`;

export function PremiumBadge({
  label = 'Premium',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-950 shadow-[0_0_24px_rgba(251,191,36,0.45)]',
        className
      )}
    >
      <Star className="h-3.5 w-3.5 fill-amber-600 text-amber-600" />
      {label}
    </span>
  );
}

/** Cinematic navy stage used for hub heroes. */
export function Stage({
  children,
  glow = ['#0abfff', '#7c3aed'],
  className,
}: {
  children: ReactNode;
  glow?: [string, string];
  className?: string;
}) {
  return (
    <section
      className={cn(
        'relative isolate overflow-hidden rounded-[28px] bg-[#031230] text-white shadow-[0_30px_80px_-30px_rgba(5,40,110,0.85)]',
        className
      )}
    >
      <div
        className="absolute inset-0 -z-10"
        style={{
          background: `radial-gradient(60% 80% at 85% 10%, ${glow[0]}40, transparent 60%), radial-gradient(50% 70% at 0% 100%, ${glow[1]}45, transparent 65%)`,
        }}
      />
      <div
        className="absolute inset-0 -z-10 opacity-[0.12]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '22px 22px',
        }}
      />
      {children}
    </section>
  );
}

export function Counter({
  value,
  format = (n: number) => Math.round(n).toLocaleString('en-IN'),
  duration = 1300,
  delay = 0,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  delay?: number;
}) {
  const [go, setGo] = useState(delay === 0);
  useEffect(() => {
    if (delay === 0) return;
    const t = setTimeout(() => setGo(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  const v = useCountUp(go ? value : 0, duration);
  return <>{format(v)}</>;
}

/** Animated radial gauge. */
export function Ring({
  value,
  size = 120,
  stroke = 10,
  color = '#0abfff',
  track = 'rgba(148,163,184,0.25)',
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: ReactNode;
}) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setV(Math.max(0, Math.min(100, value))), 120);
    return () => clearTimeout(t);
  }, [value]);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * v) / 100}
          style={{
            transition: 'stroke-dashoffset 1.4s cubic-bezier(.2,.8,.2,1)',
            filter: `drop-shadow(0 0 6px ${color}88)`,
          }}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">{children}</span>
    </span>
  );
}

const MONO = ['#0b5cad', '#0e7490', '#7c3aed', '#be123c', '#b45309', '#047857'];

/** Company logo from its website's icon; a brand-tinted monogram if none. */
export function CompanyLogo({
  name,
  website,
  size = 44,
  className,
  style,
}: {
  name: string;
  website?: string | null;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const host = (() => {
    try {
      return website ? new URL(website).hostname : '';
    } catch {
      return '';
    }
  })();
  const [failed, setFailed] = useState(!host);
  const initials = name
    .replace(/&/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  const tint = MONO[name.length % MONO.length];
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5',
        className
      )}
      style={{ width: size, height: size, ...style }}
      title={name}
    >
      {failed ? (
        <span
          className="flex h-full w-full items-center justify-center font-display font-extrabold text-white"
          style={{
            background: `linear-gradient(135deg, ${tint}, ${tint}cc)`,
            fontSize: size * 0.36,
          }}
        >
          {initials}
        </span>
      ) : (
        <img
          src={`https://www.google.com/s2/favicons?domain=${host}&sz=128`}
          alt={name}
          className="h-[68%] w-[68%] object-contain"
          onLoad={(e) => e.currentTarget.naturalWidth < 32 && setFailed(true)}
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}

export function SectionCard({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'rounded-[22px] border bg-card p-5 shadow-[0_1px_2px_rgba(5,40,110,0.05),0_14px_36px_-26px_rgba(5,40,110,0.45)] sm:p-6',
        className
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Chart tooltip in the app's style. */
export function ChartTip({
  active,
  payload,
  label,
  fmt,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  fmt?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border bg-card/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <p className="mb-1 font-semibold">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ml-auto font-semibold tabular-nums">
            {fmt ? fmt(p.value) : p.value.toLocaleString('en-IN')}
          </span>
        </p>
      ))}
    </div>
  );
}

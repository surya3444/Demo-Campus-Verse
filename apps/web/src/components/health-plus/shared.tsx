'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { CheckSquare, HeartPulse, Pill, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Shared pieces for the upcoming Health Connect benefits (cInsurance,
 * Pharma-C). Status wording is the client's and must stay as written —
 * nothing here may imply a benefit is live before launch.
 */

export const BENEFITS = [
  {
    key: 'insurance',
    title: 'Student Accident Insurance',
    status: 'Awaiting Partner Approval',
    href: '/health/insurance',
    icon: ShieldCheck,
    tone: 'from-indigo-500 to-sky-500',
    dot: 'bg-amber-400',
  },
  {
    key: 'checkup',
    title: 'Health Check-up Program',
    status: 'Under Partner Onboarding',
    href: '/health/checkups',
    icon: HeartPulse,
    tone: 'from-rose-500 to-orange-400',
    dot: 'bg-sky-400',
  },
  {
    key: 'pharma',
    title: 'Pharmacy Discounts',
    status: 'Coming Soon',
    href: '/health/pharma-c',
    icon: Pill,
    tone: 'from-emerald-500 to-teal-400',
    dot: 'bg-emerald-400',
  },
] as const;

export function UpcomingBenefits({ highlight }: { highlight?: (typeof BENEFITS)[number]['key'] }) {
  return (
    <section>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Upcoming benefits</p>
      <div className="mt-3 grid gap-4 md:grid-cols-3">
        {BENEFITS.map((b, i) => (
          <Link
            key={b.key}
            href={b.href}
            className={cn(
              'hp-rise group relative overflow-hidden rounded-2xl border bg-card p-5 shadow-xs transition hover:-translate-y-1 hover:shadow-soft',
              highlight === b.key && 'ring-2 ring-primary/30'
            )}
            style={{ animationDelay: `${120 + i * 90}ms` }}
          >
            <span className={cn('pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br opacity-20 blur-2xl transition-opacity group-hover:opacity-35', b.tone)} />
            <span className={cn('relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg', b.tone)}>
              <b.icon className="h-5 w-5" />
            </span>
            <p className="relative mt-4 font-semibold">{b.title}</p>
            <p className="relative mt-1.5 inline-flex items-center gap-2 rounded-full bg-muted/70 px-2.5 py-1 text-xs font-medium text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-60', b.dot)} />
                <span className={cn('relative inline-flex h-2 w-2 rounded-full', b.dot)} />
              </span>
              {b.status}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** The client's statements, verbatim, as checked items. */
export function Disclaimers({ items, title = 'Where things stand' }: { items: string[]; title?: string }) {
  return (
    <section className="rounded-2xl border bg-card p-6 shadow-xs">
      <p className="font-display text-base font-semibold">{title}</p>
      <ul className="mt-4 space-y-3">
        {items.map((t) => (
          <li key={t} className="flex gap-3 text-sm leading-relaxed">
            <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span className="text-foreground/85">{t}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A vertical journey: done → current (pulsing) → next steps. */
export function Journey({ steps, current }: { steps: Array<{ title: string; text: string }>; current: number }) {
  return (
    <ol className="relative space-y-6">
      <span className="absolute bottom-3 left-[15px] top-3 w-px bg-border" />
      <span
        className="hp-grow absolute left-[15px] top-3 w-px origin-top bg-gradient-to-b from-primary to-[hsl(var(--brand-cyan))]"
        style={{ height: `${(current / Math.max(1, steps.length - 1)) * 100}%` }}
      />
      {steps.map((s, i) => {
        const state = i < current ? 'done' : i === current ? 'now' : 'next';
        return (
          <li key={s.title} className="relative flex gap-4">
            <span
              className={cn(
                'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                state === 'done' && 'bg-primary text-primary-foreground',
                state === 'now' && 'bg-card text-primary ring-2 ring-primary',
                state === 'next' && 'bg-muted text-muted-foreground'
              )}
            >
              {state === 'now' && <span className="absolute inset-0 animate-ping rounded-full bg-primary/25" />}
              {i + 1}
            </span>
            <div className="pt-1">
              <p className={cn('text-sm font-semibold', state === 'next' && 'text-muted-foreground')}>
                {s.title}
                {state === 'now' && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">In progress</span>}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">{s.text}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em]">{children}</p>;
}

/** Keyframes shared by both pages; motion stops for reduced-motion users. */
export const HP_CSS = `
@keyframes hpFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
@keyframes hpFloatB{0%,100%{transform:translateY(0) rotate(-6deg)}50%{transform:translateY(8px) rotate(-2deg)}}
@keyframes hpSpin{to{transform:rotate(360deg)}}
@keyframes hpPulse{0%{transform:scale(.85);opacity:.7}100%{transform:scale(1.35);opacity:0}}
@keyframes hpRise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
@keyframes hpGrow{from{transform:scaleY(0)}to{transform:scaleY(1)}}
@keyframes hpShine{0%{transform:translateX(-120%) skewX(-20deg)}60%,100%{transform:translateX(220%) skewX(-20deg)}}
@keyframes hpDash{to{stroke-dashoffset:0}}
@keyframes hpDrift{0%{transform:translate(0,0) rotate(0)}50%{transform:translate(14px,-18px) rotate(25deg)}100%{transform:translate(0,0) rotate(0)}}
.hp-float{animation:hpFloat 6s ease-in-out infinite}
.hp-float-b{animation:hpFloatB 7s ease-in-out infinite}
.hp-spin{animation:hpSpin 22s linear infinite}
.hp-spin-rev{animation:hpSpin 30s linear infinite reverse}
.hp-pulse{animation:hpPulse 2.8s ease-out infinite}
.hp-rise{animation:hpRise .7s cubic-bezier(.2,.7,.2,1) both}
.hp-grow{animation:hpGrow 1.4s cubic-bezier(.2,.7,.2,1) .4s both}
.hp-shine{animation:hpShine 4.5s ease-in-out infinite}
.hp-dash{stroke-dasharray:240;stroke-dashoffset:240;animation:hpDash 2.2s ease-out .3s forwards}
.hp-drift{animation:hpDrift 9s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.hp-float,.hp-float-b,.hp-spin,.hp-spin-rev,.hp-pulse,.hp-rise,.hp-grow,.hp-shine,.hp-drift{animation:none}.hp-dash{stroke-dashoffset:0;animation:none}}
`;

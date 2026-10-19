'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowUpRight, HeartPulse, Pill, ShieldCheck } from 'lucide-react';
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
    bg: 'linear-gradient(135deg,#312e81 0%,#4f46e5 55%,#0ea5e9 100%)',
    dot: 'bg-amber-300',
  },
  {
    key: 'checkup',
    title: 'Health Check-up Program',
    status: 'Under Partner Onboarding',
    href: '/health/checkups',
    icon: HeartPulse,
    bg: 'linear-gradient(135deg,#881337 0%,#e11d48 55%,#fb923c 100%)',
    dot: 'bg-sky-300',
  },
  {
    key: 'pharma',
    title: 'Pharmacy Discounts',
    status: 'Coming Soon',
    href: '/health/pharma-c',
    icon: Pill,
    bg: 'linear-gradient(135deg,#064e3b 0%,#059669 55%,#2dd4bf 100%)',
    dot: 'bg-emerald-200',
  },
] as const;

type BenefitKey = (typeof BENEFITS)[number]['key'];

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function useTyping(text: string, speed = 18) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (reduced()) return setN(text.length);
    setN(0);
    const id = setInterval(() => setN((v) => (v >= text.length ? (clearInterval(id), v) : v + 1)), speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return text.slice(0, n);
}

/** Pulsing status dot. */
export function LiveDot({ className }: { className?: string }) {
  return (
    <span className="relative flex h-2 w-2">
      <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-70', className)} />
      <span className={cn('relative inline-flex h-2 w-2 rounded-full', className)} />
    </span>
  );
}

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Departure-board text: every tile flips through letters, then settles. */
export function SplitFlap({ text, className }: { text: string; className?: string }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (reduced()) return setTick(999);
    setTick(0);
    const id = setInterval(() => setTick((t) => (t > text.length + 14 ? (clearInterval(id), t) : t + 1)), 45);
    return () => clearInterval(id);
  }, [text]);
  return (
    <div className={cn('flex flex-wrap gap-x-3 gap-y-1', className)} aria-label={text}>
      {text.split(' ').map((word, w, all) => {
        const offset = all.slice(0, w).join(' ').length + (w ? 1 : 0);
        return (
          <span key={w} className="flex gap-[3px]">
            {word.split('').map((c, j) => {
              const k = offset + j;
              const ch = tick > k + 10 ? c : GLYPHS[(k * 7 + tick * 3) % GLYPHS.length];
              return (
                <span
                  key={j}
                  aria-hidden
                  className="relative flex h-8 w-[22px] items-center justify-center overflow-hidden rounded-[4px] bg-[#0a0f2c] font-mono text-sm font-bold text-amber-200 shadow-[inset_0_1px_0_rgba(255,255,255,.08),0_2px_0_rgba(0,0,0,.4)]"
                >
                  {ch}
                  <span className="absolute inset-x-0 top-1/2 h-px bg-black/60" />
                </span>
              );
            })}
          </span>
        );
      })}
    </div>
  );
}

/** Upcoming benefits as a wallet: cards stack, fan out on hover, current page in front. */
export function BenefitWallet({ front }: { front: BenefitKey }) {
  const cards = [...BENEFITS.filter((b) => b.key !== front), ...BENEFITS.filter((b) => b.key === front)];
  return (
    <div className="group/wallet relative h-[300px] w-full [perspective:1400px]">
      {cards.map((b, k) => {
        const isFront = k === cards.length - 1;
        return (
          <Link
            key={b.key}
            href={b.href}
            style={{ background: b.bg, ['--y' as string]: `${k * 54}px`, ['--y2' as string]: `${k * 78}px` }}
            className={cn(
              'absolute inset-x-0 top-0 h-[190px] overflow-hidden rounded-[22px] p-5 text-white shadow-[0_-8px_30px_-12px_rgba(0,0,0,.45)] transition-all duration-500 ease-[cubic-bezier(.2,.8,.2,1)]',
              '[transform:translateY(var(--y))] group-hover/wallet:[transform:translateY(var(--y2))] hover:!brightness-110'
            )}
          >
            <span className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full border-[16px] border-white/10" />
            <span
              className="pointer-events-none absolute inset-0 opacity-[0.15]"
              style={{ backgroundImage: 'repeating-linear-gradient(115deg, rgba(255,255,255,.5) 0 1px, transparent 1px 9px)' }}
            />
            {isFront && <span className="hp-shine pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent" />}
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
                  <b.icon className="h-4 w-4" />
                </span>
                <p className="text-sm font-semibold">{b.title}</p>
              </div>
              <ArrowUpRight className="h-4 w-4 opacity-70" />
            </div>
            <div className="relative mt-16 flex items-end justify-between">
              <span className="inline-flex items-center gap-2 rounded-full bg-black/20 px-3 py-1 text-xs font-semibold backdrop-blur">
                <LiveDot className={b.dot} />
                {b.status}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/60">Campus Verse</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

/** Keyframes shared by both pages; motion stops for reduced-motion users. */
export const HP_CSS = `
@keyframes hpFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
@keyframes hpSpin{to{transform:rotate(360deg)}}
@keyframes hpRise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
@keyframes hpShine{0%{transform:translateX(-120%) skewX(-20deg)}60%,100%{transform:translateX(320%) skewX(-20deg)}}
@keyframes hpCharge{to{stroke-dashoffset:-200}}
@keyframes hpGlow{0%,100%{opacity:.55}50%{opacity:1}}
@keyframes hpPrint{from{transform:translateY(-100%)}to{transform:translateY(0)}}
@keyframes hpTravel{0%{left:0%}45%,55%{left:50%}100%{left:100%}}
@keyframes hpStamp{0%{opacity:0;transform:scale(1.8) rotate(-14deg)}70%{opacity:1;transform:scale(.95) rotate(-14deg)}100%{opacity:1;transform:scale(1) rotate(-14deg)}}
@keyframes hpDrift{0%,100%{transform:translate(0,0) rotate(var(--r,0deg))}50%{transform:translate(10px,-14px) rotate(calc(var(--r,0deg) + 20deg))}}
@keyframes hpRain{from{transform:translate(0,-20px)}to{transform:translate(-14px,320px)}}
@keyframes hpTwinkle{0%,100%{opacity:.25}50%{opacity:1}}
@keyframes hpSweep{0%{transform:rotate(-175deg)}50%{transform:rotate(-5deg)}100%{transform:rotate(-175deg)}}
@keyframes hpRipple{0%{transform:scale(1);opacity:.7}100%{transform:scale(1.12);opacity:0}}
@keyframes hpSplash{0%{transform:scale(.2);opacity:0}20%{opacity:.9}100%{transform:scale(1.6);opacity:0}}
@keyframes hpBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}
@keyframes hpWave{0%,100%{transform:skewY(0)}50%{transform:skewY(8deg)}}
.hp-rain{animation:hpRain 1s linear infinite}
.hp-twinkle{animation:hpTwinkle 3s ease-in-out infinite}
.hp-sweep{animation:hpSweep 7s ease-in-out infinite}
.hp-ripple{animation:hpRipple 3.2s ease-out infinite}
.hp-splash{animation:hpSplash 1.6s ease-out infinite}
.hp-bob{animation:hpBob .9s ease-in-out infinite}
.hp-wave{animation:hpWave 1.6s ease-in-out infinite}
.hp-float{animation:hpFloat 6s ease-in-out infinite}
.hp-spin{animation:hpSpin 40s linear infinite}
.hp-rise{animation:hpRise .7s cubic-bezier(.2,.7,.2,1) both}
.hp-shine{animation:hpShine 5s ease-in-out infinite}
.hp-charge{stroke-dasharray:60 140;animation:hpCharge 2.4s linear infinite}
.hp-glow{animation:hpGlow 2.6s ease-in-out infinite}
.hp-print{animation:hpPrint 2.6s cubic-bezier(.4,0,.2,1) .3s both}
.hp-travel{animation:hpTravel 6s ease-in-out infinite}
.hp-stamp{animation:hpStamp .6s cubic-bezier(.2,.9,.3,1.2) .8s both}
.hp-drift{animation:hpDrift 8s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.hp-rain,.hp-twinkle,.hp-sweep,.hp-ripple,.hp-splash,.hp-bob,.hp-wave,.hp-float,.hp-spin,.hp-rise,.hp-shine,.hp-charge,.hp-glow,.hp-print,.hp-travel,.hp-stamp,.hp-drift{animation:none}}
`;

/** "Campus Verse Exclusive" seal for the page header. */
export function ExclusiveBadge() {
  return (
    <div className="rounded-full bg-gradient-to-r from-[hsl(var(--primary)/.5)] via-[hsl(var(--brand-cyan))] to-[hsl(var(--primary)/.5)] p-px shadow-[0_8px_24px_-12px_hsl(var(--brand-cyan)/.7)]">
      <div className="relative flex items-center gap-2.5 overflow-hidden rounded-full bg-card py-1.5 pl-1.5 pr-4">
        <span className="hp-shine pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-transparent via-[hsl(var(--brand-cyan)/.18)] to-transparent" />
        <img src="/icon_color.svg" alt="" className="h-7 w-7" />
        <span className="font-display text-sm font-bold">Campus Verse</span>
        <span className="h-4 w-px bg-border" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[hsl(var(--brand-cyan))]">Exclusive</span>
      </div>
    </div>
  );
}

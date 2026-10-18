'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, X } from 'lucide-react';
import type { Club } from '@/lib/api';
import { useCountUp } from '@/hooks/useCountUp';
import { ClubCrest } from './clubVisuals';

const DURATION = 6800;

function Ticker({ value, label, delay }: { value: number; label: string; delay: number }) {
  const [go, setGo] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGo(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  const v = useCountUp(go ? value : 0, 1400);
  return (
    <div className="animate-[club-fade-up_0.6s_both]" style={{ animationDelay: `${delay}ms` }}>
      <p className="font-display text-4xl font-extrabold tabular-nums text-white sm:text-5xl">
        {Math.round(v).toLocaleString('en-IN')}
      </p>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/55">
        {label}
      </p>
    </div>
  );
}

/**
 * The "ad" that plays when someone opens Clubs: beams, rising sparks, the
 * title assembling letter by letter and every club's crest flying into orbit.
 */
export function ClubsIntro({
  clubs,
  orgName,
  onDone,
}: {
  clubs: Club[];
  orgName: string;
  onDone: () => void;
}) {
  const [leaving, setLeaving] = useState(false);
  const close = () => {
    if (leaving) return;
    setLeaving(true);
    setTimeout(onDone, 520);
  };
  useEffect(() => {
    const t = setTimeout(close, DURATION);
    const key = (e: KeyboardEvent) => (e.key === 'Escape' || e.key === 'Enter') && close();
    window.addEventListener('keydown', key);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', key);
    };
  }, []);

  const sparks = useMemo(
    () =>
      Array.from({ length: 46 }, (_, i) => ({
        left: `${(i * 37) % 100}%`,
        size: 2 + ((i * 13) % 4),
        dur: 5 + ((i * 7) % 6),
        delay: (i % 10) * 0.35,
        color: ['#0abfff', '#fde68a', '#ffffff', '#a78bfa'][i % 4],
      })),
    []
  );
  const ring = clubs.slice(0, 14);
  const inner = ring.slice(0, 6);
  const outer = ring.slice(6);
  const members = clubs.reduce((n, c) => n + c.memberCount, 0);
  const title = 'Clubs';

  const orbit = (list: Club[], radius: number, size: number, base: number) =>
    list.map((c, i) => {
      const a = (i / list.length) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * radius;
      const y = Math.sin(a) * radius;
      return (
        <span
          key={c._id}
          className="absolute left-1/2 top-1/2"
          style={{ transform: `translate(calc(${x}px - 50%), calc(${y}px - 50%))` }}
        >
          <span
            className="block animate-[club-fly-in_1.1s_cubic-bezier(.2,.9,.25,1)_both]"
            style={
              {
                '--fx': `${x * 3}px`,
                '--fy': `${y * 3}px`,
                animationDelay: `${base + i * 90}ms`,
              } as CSSProperties
            }
          >
            <span className="block animate-[club-spin-rev_60s_linear_infinite]">
              <ClubCrest icon={c.icon} category={c.category} theme={c.theme} size={size} />
            </span>
          </span>
        </span>
      );
    });

  return createPortal(
    <div
      role="dialog"
      aria-label="Welcome to Clubs"
      className={`fixed inset-0 z-[90] overflow-hidden bg-[#020b24] text-white ${leaving ? 'animate-[club-iris-out_0.52s_ease-in_forwards]' : ''}`}
    >
      {/* light */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 50% at 50% 45%, rgba(10,191,255,0.22), transparent 70%), radial-gradient(40% 40% at 20% 80%, rgba(167,139,250,0.18), transparent 70%)',
        }}
      />
      {[-30, 0, 30].map((r, i) => (
        <div
          key={r}
          className="absolute left-1/2 top-[-20%] h-[140%] w-[22vw] origin-top -translate-x-1/2 animate-[club-beam_7s_ease-in-out_infinite]"
          style={{
            rotate: `${r}deg`,
            animationDelay: `${i * 1.2}s`,
            background: 'linear-gradient(to bottom, rgba(10,191,255,0.28), transparent 70%)',
            filter: 'blur(18px)',
          }}
        />
      ))}
      {sparks.map((s, i) => (
        <span
          key={i}
          className="absolute bottom-[-10px] rounded-full animate-[club-rise_linear_infinite]"
          style={{
            left: s.left,
            width: s.size,
            height: s.size,
            background: s.color,
            boxShadow: `0 0 8px ${s.color}`,
            animationDuration: `${s.dur}s`,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
      {/* grain */}
      <div
        className="absolute inset-0 opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27160%27 height=%27160%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence baseFrequency=%270.9%27/%3E%3C/filter%3E%3Crect width=%27160%27 height=%27160%27 filter=%27url(%23n)%27/%3E%3C/svg%3E")',
        }}
      />

      {/* orbit */}
      <div className="absolute left-1/2 top-1/2 h-0 w-0">
        <div className="absolute animate-[club-spin_60s_linear_infinite]">
          {orbit(outer, 400, 52, 1500)}
        </div>
        <div className="absolute animate-[club-spin-rev_45s_linear_infinite]">
          {orbit(inner, 290, 58, 1100)}
        </div>
        <span className="absolute left-1/2 top-1/2 h-[580px] w-[580px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />
        <span className="absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-white/[0.07]" />
      </div>

      {/* copy */}
      <div className="relative flex h-full flex-col items-center justify-center px-6 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.45em] text-white/60 animate-[club-fade-up_0.8s_0.15s_both]">
          {orgName} presents
        </p>
        <h1 className="mt-3 font-display text-[64px] font-extrabold leading-none tracking-tight sm:text-[112px] [perspective:600px]">
          {title.split('').map((ch, i) => (
            <span
              key={i}
              className="club-gradient-text inline-block animate-[club-letter_0.9s_cubic-bezier(.2,.8,.2,1)_both]"
              style={{ animationDelay: `${450 + i * 110}ms` }}
            >
              {ch}
            </span>
          ))}
        </h1>
        <p className="mt-4 max-w-md text-base text-white/75 animate-[club-fade-up_0.8s_1.2s_both] sm:text-lg">
          Where campus comes alive — find your people, build something, lead something.
        </p>
        <div className="mt-8 flex gap-10 sm:gap-14">
          <Ticker value={clubs.length} label="Clubs" delay={2300} />
          <Ticker value={members} label="Members" delay={2550} />
          <Ticker
            value={new Set(clubs.map((c) => c.category)).size}
            label="Categories"
            delay={2800}
          />
        </div>
        <button
          onClick={close}
          className="group mt-10 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-semibold text-[#05286e] shadow-[0_0_40px_rgba(10,191,255,0.45)] transition hover:scale-105 animate-[club-fade-up_0.7s_3.3s_both]"
        >
          Enter Clubs
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </button>
      </div>

      <button
        onClick={close}
        className="absolute right-5 top-5 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80 ring-1 ring-white/15 backdrop-blur hover:bg-white/20"
      >
        Skip <X className="h-3.5 w-3.5" />
      </button>
      {/* progress */}
      <span
        className="absolute bottom-0 left-0 h-[3px] w-full origin-left bg-gradient-to-r from-[#0abfff] to-[#fde68a] animate-[club-progress_linear_both]"
        style={{ animationDuration: `${DURATION}ms` }}
      />
    </div>,
    document.body
  );
}

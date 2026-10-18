'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, Users } from 'lucide-react';
import type { Club } from '@/lib/api';
import { cn } from '@/lib/utils';
import { ClubCrest, Faces, categoryOf, themeOf } from './clubVisuals';
import { JoinButton } from './ClubCard';

const SLIDE_MS = 6500;

function useTyping(text: string, start: boolean, speed = 22) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    if (!start) return;
    const id = setInterval(
      () => setN((v) => (v >= text.length ? (clearInterval(id), v) : v + 1)),
      speed
    );
    return () => clearInterval(id);
  }, [text, start, speed]);
  return text.slice(0, n);
}

/** Auto-playing "commercial" for the biggest clubs. */
export function ClubsShowcase({ clubs, onChange }: { clubs: Club[]; onChange: (c: Club) => void }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const slide = clubs[i % Math.max(1, clubs.length)];
  useEffect(() => {
    if (paused || clubs.length < 2) return;
    const t = setTimeout(() => setI((v) => (v + 1) % clubs.length), SLIDE_MS);
    return () => clearTimeout(t);
  }, [i, paused, clubs.length]);
  const typed = useTyping(slide?.tagline ?? '', !!slide);
  if (!slide) return null;
  const th = themeOf(slide.theme);
  const cat = categoryOf(slide.category);
  const go = (d: number) => setI((v) => (v + d + clubs.length) % clubs.length);

  return (
    <section
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="relative isolate overflow-hidden rounded-[28px] bg-[#031230] text-white shadow-[0_30px_80px_-30px_rgba(5,40,110,0.8)]"
    >
      {/* colour layers cross-fade per slide */}
      {clubs.map((c, k) => {
        const t = themeOf(c.theme);
        return (
          <div
            key={c._id}
            className={cn(
              'absolute inset-0 -z-10 transition-opacity duration-1000',
              k === i ? 'opacity-100' : 'opacity-0'
            )}
            style={{
              background: `radial-gradient(70% 90% at 78% 40%, ${t.c2}55, transparent 65%), radial-gradient(60% 80% at 10% 100%, ${t.c1}66, transparent 70%)`,
            }}
          />
        );
      })}
      <div
        className="absolute inset-0 -z-10 opacity-[0.12]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '22px 22px',
        }}
      />

      {/* story progress */}
      <div className="absolute inset-x-6 top-5 z-10 flex gap-1.5">
        {clubs.map((c, k) => (
          <button
            key={c._id}
            onClick={() => setI(k)}
            className="h-1 flex-1 overflow-hidden rounded-full bg-white/20"
            aria-label={`Show ${c.name}`}
          >
            <span
              key={`${i}-${k}`}
              className={cn(
                'block h-full origin-left rounded-full bg-white',
                k < i
                  ? 'scale-x-100'
                  : k === i
                    ? 'animate-[club-progress_linear_both]'
                    : 'scale-x-0'
              )}
              style={
                k === i
                  ? {
                      animationDuration: `${SLIDE_MS}ms`,
                      animationPlayState: paused ? 'paused' : 'running',
                    }
                  : undefined
              }
            />
          </button>
        ))}
      </div>

      <div className="grid min-h-[400px] items-center gap-8 px-6 pb-10 pt-14 sm:px-10 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div key={slide._id} className="relative z-10">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ring-1 ring-white/20 backdrop-blur animate-[club-fade-up_0.5s_both]">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            Featured · {cat.label}
          </p>
          <h2 className="mt-4 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-5xl">
            {slide.name.split(' ').map((w, k) => (
              <span
                key={k}
                className="mr-[0.25em] inline-block animate-[club-letter_0.7s_cubic-bezier(.2,.8,.2,1)_both]"
                style={{ animationDelay: `${120 + k * 90}ms` }}
              >
                {w}
              </span>
            ))}
          </h2>
          {slide.institutionName && (
            <p className="mt-2 text-sm font-medium text-white/60 animate-[club-fade-up_0.5s_0.3s_both]">
              {slide.institutionName}
            </p>
          )}
          <p className="mt-4 min-h-[3.5rem] max-w-xl text-lg leading-relaxed text-white/85">
            {typed}
            <span className="ml-0.5 inline-block h-5 w-[2px] translate-y-1 bg-[#0abfff] animate-[club-caret_0.9s_step-end_infinite]" />
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4 animate-[club-fade-up_0.6s_0.5s_both]">
            <JoinButton
              club={slide}
              size="lg"
              onChange={(c) => onChange({ ...slide, ...c })}
              className="!bg-white !text-[#05286e]"
            />
            <Link
              href={`/clubs/${slide._id}`}
              className="inline-flex items-center gap-1 text-sm font-semibold text-white/85 underline-offset-4 hover:text-white hover:underline"
            >
              View club
            </Link>
            <span className="flex items-center gap-2 text-sm text-white/75">
              <Faces faces={slide.faces ?? []} size={30} />
              <Users className="h-4 w-4" />
              {slide.memberCount.toLocaleString('en-IN')} members
            </span>
          </div>
        </div>

        <div
          key={`art-${slide._id}`}
          className="relative hidden h-[340px] items-center justify-center md:flex"
        >
          <span
            className="absolute h-[360px] w-[360px] rounded-full opacity-60 animate-[club-spin_18s_linear_infinite]"
            style={{
              background: `repeating-conic-gradient(from 0deg, ${th.c2}33 0deg 6deg, transparent 6deg 18deg)`,
              maskImage: 'radial-gradient(circle, black 30%, transparent 70%)',
            }}
          />
          <span
            className="absolute h-64 w-64 rounded-full border border-white/15 animate-[club-spin-rev_30s_linear_infinite]"
            style={{ borderStyle: 'dashed' }}
          />
          {(slide.faces ?? []).slice(0, 4).map((f, k) => (
            <img
              key={k}
              src={f.photo ?? ''}
              alt=""
              className="absolute h-12 w-12 rounded-full object-cover ring-2 ring-white/70 shadow-lg animate-[club-float_4s_ease-in-out_infinite]"
              style={{
                top: `${[14, 62, 20, 70][k]}%`,
                left: `${[18, 12, 76, 80][k]}%`,
                animationDelay: `${k * 0.6}s`,
              }}
            />
          ))}
          <span className="animate-[club-pop_0.8s_cubic-bezier(.2,.9,.3,1.3)_both]">
            <ClubCrest
              icon={slide.icon}
              category={slide.category}
              theme={slide.theme}
              size={190}
              live
              gold
            />
          </span>
        </div>
      </div>

      <div className="absolute bottom-5 right-6 z-10 flex gap-2">
        {[
          [ChevronLeft, -1],
          [ChevronRight, 1],
        ].map(([Icon, d]) => {
          const I = Icon as typeof ChevronLeft;
          return (
            <button
              key={String(d)}
              onClick={() => go(d as number)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20 backdrop-blur transition hover:bg-white/20"
            >
              <I className="h-4 w-4" />
            </button>
          );
        })}
      </div>
    </section>
  );
}

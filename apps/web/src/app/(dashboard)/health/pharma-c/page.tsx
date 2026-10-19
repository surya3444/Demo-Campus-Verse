'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Bell, QrCode, ScanLine, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/authStore';
import { BenefitWallet, HP_CSS, LiveDot, useTyping } from '@/components/health-plus/shared';

const NOTES = [
  'Pharmacy discounts for students are coming soon.',
  'Partner pharmacies, discount rates and terms will be announced at launch.',
  'Nothing is redeemable until the programme formally launches.',
];
const INTRO = 'Student discounts at partner pharmacies, carried in your pocket inside Campus Verse.';

const HOW = [
  { icon: Store, title: 'Find a partner pharmacy', text: 'Partner pharmacies will be listed right here.' },
  { icon: QrCode, title: 'Show your Pharma-C card', text: 'Your card lives in the app, next to your student ID.' },
  { icon: ScanLine, title: 'Save at the counter', text: 'The discount is applied at billing.' },
];

const CAPSULES = [
  { pos: 'left-[4%] top-[18%]', r: '30deg', a: '#ffffff', b: '#6ee7b7', d: 0 },
  { pos: 'right-[2%] top-[8%]', r: '-24deg', a: '#fde68a', b: '#fb923c', d: 1.4 },
  { pos: 'left-[10%] bottom-[10%]', r: '-48deg', a: '#bae6fd', b: '#22d3ee', d: 2.2 },
  { pos: 'right-[6%] bottom-[18%]', r: '60deg', a: '#fecdd3', b: '#f472b6', d: 0.7 },
];

// Torn-paper bottom edge
const TEETH = 18;
const TORN = `polygon(0 0,100% 0,${Array.from({ length: TEETH * 2 + 1 }, (_, i) => `${100 - (i * 100) / (TEETH * 2)}% ${i % 2 ? 'calc(100% - 10px)' : '100%'}`).join(',')})`;

function Capsule({ a, b }: { a: string; b: string }) {
  return (
    <span className="flex h-7 w-16 overflow-hidden rounded-full shadow-[0_10px_20px_-6px_rgba(0,0,0,.5)]">
      <span className="h-full w-1/2" style={{ background: `linear-gradient(180deg, ${a}, ${a}cc)` }} />
      <span className="h-full w-1/2" style={{ background: `linear-gradient(180deg, ${b}, ${b}bb)` }} />
    </span>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline gap-1 text-[12px]">
      <span>{k}</span>
      <span className="flex-1 translate-y-[-3px] border-b border-dotted border-stone-400" />
      <span className="font-bold">{v}</span>
    </div>
  );
}

function Receipt({ campus }: { campus: string }) {
  return (
    <div className="relative mx-auto w-[290px]">
      {/* printer slot */}
      <div className="relative z-10 h-5 rounded-full bg-gradient-to-b from-[#0b2b26] to-[#021612] shadow-[0_6px_14px_rgba(0,0,0,.5)] ring-1 ring-white/10">
        <span className="absolute inset-x-6 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-black" />
        <span className="absolute right-3 top-1/2 -translate-y-1/2">
          <LiveDot className="bg-emerald-400" />
        </span>
      </div>
      <div className="-mt-2.5 overflow-hidden px-3">
        <div
          className="hp-print bg-[#fbfaf6] px-5 pb-8 pt-6 font-mono text-stone-800 shadow-[0_20px_40px_-12px_rgba(0,0,0,.6)]"
          style={{ clipPath: TORN }}
        >
          <p className="text-center text-[11px] font-bold tracking-[0.35em]">PHARMA-C</p>
          <p className="mt-0.5 truncate text-center text-[10px] tracking-wider text-stone-500">{campus.toUpperCase()}</p>
          <div className="my-3 border-t-2 border-dashed border-stone-300" />
          <p className="text-[11px] font-bold">STUDENT DISCOUNT CARD</p>
          <div className="mt-2 space-y-1.5">
            <Row k="Partner pharmacies" v="TBA" />
            <Row k="Discount rates" v="TBA" />
            <Row k="Terms" v="TBA" />
          </div>
          <div className="my-3 border-t-2 border-dashed border-stone-300" />
          <div className="flex items-center justify-between text-[12px] font-bold">
            <span>STATUS</span>
            <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-white">COMING SOON</span>
          </div>
          <div className="mt-4 flex h-10 items-stretch justify-center gap-[2px]" aria-hidden>
            {Array.from({ length: 46 }, (_, i) => (
              <span key={i} className="bg-stone-800" style={{ width: [1, 2, 1, 3, 1, 1, 2][i % 7] }} />
            ))}
          </div>
          <p className="mt-2 text-center text-[9px] tracking-[0.25em] text-stone-500">PREVIEW · NOT REDEEMABLE</p>
        </div>
      </div>
    </div>
  );
}

export default function PharmaCPage() {
  const tenant = useAuthStore((s) => (s.user?.tenant as { name?: string } | undefined)?.name);
  const [notified, setNotified] = useState(false);
  const typed = useTyping(INTRO, 24);

  return (
    <div className="space-y-8">
      <style>{HP_CSS}</style>

      <section className="relative isolate overflow-hidden rounded-[28px] bg-[#021b17] text-white shadow-[0_30px_80px_-30px_rgba(2,27,23,.9)]">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(55% 80% at 78% 40%, rgba(16,185,129,.45), transparent 65%), radial-gradient(45% 70% at 0% 100%, rgba(45,212,191,.28), transparent 70%)',
          }}
        />
        {/* pharmacy-cross lattice */}
        <span
          className="absolute inset-0 -z-10 opacity-[0.09]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='36' height='36'%3E%3Cpath d='M15 9h6v6h6v6h-6v6h-6v-6H9v-6h6z' fill='white'/%3E%3C/svg%3E\")",
            maskImage: 'linear-gradient(90deg, transparent 5%, #000 60%)',
          }}
        />

        <div className="grid items-center gap-10 px-6 py-10 sm:px-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-200/80">Health Connect · Pharma-C</p>
            <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-300/30">
              <LiveDot className="bg-emerald-300" />
              Coming Soon
            </span>
            <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-5xl">
              <span className="hp-rise inline-block" style={{ animationDelay: '120ms' }}>
                Less on the bill.
              </span>
              <br />
              <span
                className="hp-rise inline-block bg-gradient-to-r from-emerald-200 via-teal-200 to-cyan-200 bg-clip-text text-transparent"
                style={{ animationDelay: '260ms' }}
              >
                More for the semester.
              </span>
            </h1>
            <p className="mt-5 min-h-[3.5rem] max-w-lg text-[15px] leading-relaxed text-emerald-50/80">
              {typed}
              <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-emerald-300" />
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Button
                size="lg"
                disabled={notified}
                onClick={() => {
                  setNotified(true);
                  toast.success('You’ll see it here the moment it launches');
                }}
                className="!bg-white !text-[#021b17] hover:!bg-white/90"
              >
                <Bell className="mr-2 h-4 w-4" />
                {notified ? 'We’ll keep you posted' : 'Notify me at launch'}
              </Button>
              <span className="text-xs text-white/50">Partners and rates announced at launch.</span>
            </div>
          </div>

          <div className="relative min-h-[380px]">
            {CAPSULES.map((c, i) => (
              <span key={i} className={`absolute ${c.pos}`}>
                <span className="hp-drift block" style={{ ['--r' as string]: c.r, animationDelay: `${c.d}s` }}>
                  <Capsule a={c.a} b={c.b} />
                </span>
              </span>
            ))}
            <Receipt campus={tenant ?? 'Your campus'} />
          </div>
        </div>
      </section>

      {/* How it will work: a capsule travels the counter */}
      <section className="hp-rise overflow-hidden rounded-2xl border bg-card p-7 shadow-xs" style={{ animationDelay: '120ms' }}>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">How it will work</p>
            <p className="mt-1 font-display text-xl font-bold">Three steps from shelf to savings</p>
          </div>
          <p className="text-xs text-muted-foreground">The planned experience once Pharma-C launches.</p>
        </div>
        <div className="relative mt-8">
          <div className="absolute left-[16.66%] right-[16.66%] top-7 hidden h-0 border-t-2 border-dashed border-emerald-500/30 md:block">
            <span className="hp-travel absolute top-0 -translate-x-1/2 -translate-y-1/2">
              <span className="block scale-75">
                <Capsule a="#ffffff" b="#10b981" />
              </span>
            </span>
          </div>
          <ol className="relative grid gap-6 md:grid-cols-3">
            {HOW.map((h, i) => (
              <li key={h.title} className="flex flex-col items-center text-center">
                <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-[0_12px_24px_-8px_rgba(16,185,129,.6)] ring-4 ring-card">
                  <h.icon className="h-6 w-6" />
                  <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-card font-mono text-[11px] font-bold text-emerald-600 shadow ring-1 ring-emerald-500/30">
                    {i + 1}
                  </span>
                </span>
                <p className="mt-4 text-sm font-semibold">{h.title}</p>
                <p className="mt-1 max-w-[220px] text-sm text-muted-foreground">{h.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* Notes, set on a prescription pad */}
        <section
          className="hp-rise relative overflow-hidden rounded-2xl border bg-[#fdfcf7] text-stone-800 shadow-xs dark:bg-card dark:text-foreground"
          style={{ animationDelay: '200ms' }}
        >
          <div className="flex items-center justify-between bg-emerald-700 px-7 py-3 text-white">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em]">Pharma-C · Before you ask</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/70">Campus Verse</p>
          </div>
          <div className="relative px-7 pb-7 pt-5">
            <p className="font-serif text-5xl font-bold italic leading-none text-emerald-700/80">
              R<span className="text-3xl">x</span>
            </p>
            <ul className="mt-3 divide-y divide-emerald-600/15 border-y border-emerald-600/15">
              {NOTES.map((n) => (
                <li key={n} className="flex gap-3 py-3 font-serif text-[16px] italic leading-[24px]">
                  <span className="text-emerald-600">—</span>
                  {n}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-right font-serif text-sm italic text-stone-500">— Health Connect</p>
          </div>
        </section>

        <section className="hp-rise" style={{ animationDelay: '280ms' }}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Upcoming benefits</p>
          <p className="mb-4 mt-1 text-sm text-muted-foreground">Hover the wallet to see everything on the way.</p>
          <BenefitWallet front="pharma" />
        </section>
      </div>
    </div>
  );
}

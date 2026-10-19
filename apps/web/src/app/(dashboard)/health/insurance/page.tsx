'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Bell, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHero } from '@/components/ui/page-hero';
import { cn } from '@/lib/utils';
import { BenefitWallet, ExclusiveBadge, HP_CSS, SplitFlap, useTyping } from '@/components/health-plus/shared';

// The client's wording — keep verbatim
const STATUS_LINE =
  'Student accidental insurance coverage is under discussion with an insurance partner and is subject to regulatory, contractual and partner approvals.';
const NOTES = [
  STATUS_LINE,
  'Insurance benefits will be activated only after formal launch and policy issuance.',
  'Details of coverage, eligibility, exclusions and claim process will be announced separately.',
];

const STAGES = ['Partner discussion', 'Regulatory, contractual & partner approvals', 'Policy issuance', 'Formal launch'];
const CURRENT = 0;
// Each stage is one layer of the shield, innermost first
const SCALES = [0.42, 0.62, 0.81, 1];
const SHIELD = 'M120 10 L220 46 V124 C220 190 176 236 120 252 C64 236 20 190 20 124 V46 Z';
const at = (s: number) => `translate(120 130) scale(${s}) translate(-120 -130)`;

function ForgedShield() {
  return (
    <svg viewBox="0 0 240 262" className="h-full w-full overflow-visible">
      <defs>
        <linearGradient id="ciCore" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c7d2fe" />
          <stop offset=".5" stopColor="#6366f1" />
          <stop offset="1" stopColor="#0ea5e9" />
        </linearGradient>
        <radialGradient id="ciHalo">
          <stop offset="0" stopColor="#818cf8" stopOpacity=".7" />
          <stop offset="1" stopColor="#818cf8" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="120" cy="130" r="70" fill="url(#ciHalo)" className="hp-glow" />
      {SCALES.map((s, i) => {
        const done = i < CURRENT;
        const now = i === CURRENT;
        const y = 130 - 84 * s;
        return (
          <g key={i}>
            {now ? (
              <>
                <path d={SHIELD} transform={at(s)} fill="url(#ciCore)" />
                <path
                  d={SHIELD}
                  transform={at(s)}
                  pathLength={200}
                  fill="none"
                  stroke="#fff"
                  strokeWidth={2.5}
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                  className="hp-charge"
                />
              </>
            ) : (
              <path
                d={SHIELD}
                transform={at(s)}
                fill={done ? 'rgba(129,140,248,.18)' : 'none'}
                stroke={done ? '#a5b4fc' : 'rgba(255,255,255,.28)'}
                strokeWidth={1.5}
                strokeDasharray={done ? undefined : '3 6'}
                vectorEffect="non-scaling-stroke"
              />
            )}
            <circle cx={120 + 100 * s} cy={y} r={now ? 4 : 2.5} fill={now ? '#fcd34d' : 'rgba(255,255,255,.5)'} />
          </g>
        );
      })}
      {/* cap + pulse in the core */}
      <g fill="none" stroke="#fff" strokeLinecap="round" strokeLinejoin="round">
        <path d="M100 122 L120 112 L140 122 L120 132 Z" fill="#fff" stroke="none" />
        <path d="M108 127 V137 C108 142 132 142 132 137 V127" strokeWidth="4" />
        <path d="M96 152 H108 L113 144 L120 160 L126 148 L130 152 H144" strokeWidth="3" />
      </g>
    </svg>
  );
}

export default function CInsurancePage() {
  const [notified, setNotified] = useState(false);
  const typed = useTyping(STATUS_LINE);

  return (
    <div className="space-y-6">
      <style>{HP_CSS}</style>
      <PageHero icon={ShieldCheck} eyebrow="Health Connect · cInsurance" title="cInsurance" description="Student accident insurance for your campus, on its way." actions={<ExclusiveBadge />} className="md:[&>div]:items-center" />

      <section className="relative isolate overflow-hidden rounded-[28px] bg-[#070b24] text-white shadow-[0_30px_80px_-30px_rgba(7,11,36,.9)]">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(60% 80% at 80% 35%, rgba(99,102,241,.45), transparent 65%), radial-gradient(50% 70% at 0% 100%, rgba(14,165,233,.3), transparent 70%)',
          }}
        />
        <span
          className="hp-spin absolute -right-20 -top-24 -z-10 h-[620px] w-[620px] rounded-full opacity-50"
          style={{
            background: 'repeating-conic-gradient(from 0deg, rgba(165,180,252,.18) 0deg 2deg, transparent 2deg 12deg)',
            maskImage: 'radial-gradient(circle, #000 25%, transparent 68%)',
          }}
        />

        <div className="grid items-center gap-8 px-6 py-10 sm:px-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div>
            <div className="inline-block rounded-xl bg-black/40 p-2 ring-1 ring-white/10">
              <p className="mb-1.5 px-0.5 font-mono text-[9px] uppercase tracking-[0.3em] text-white/40">Status</p>
              <SplitFlap text="AWAITING PARTNER APPROVAL" />
            </div>
            <h2 className="mt-6 font-display text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-5xl">
              {['Protection', 'for', 'every'].map((w, k) => (
                <span key={w} className="hp-rise mr-[0.25em] inline-block" style={{ animationDelay: `${150 + k * 90}ms` }}>
                  {w}
                </span>
              ))}
              <br />
              <span
                className="hp-rise inline-block bg-gradient-to-r from-sky-300 via-indigo-200 to-fuchsia-300 bg-clip-text text-transparent"
                style={{ animationDelay: '450ms' }}
              >
                student, in the making.
              </span>
            </h2>
            <p className="mt-5 min-h-[4.5rem] max-w-xl text-[15px] leading-relaxed text-indigo-100/85">
              {typed}
              <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-sky-300" />
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Button
                size="lg"
                disabled={notified}
                onClick={() => {
                  setNotified(true);
                  toast.success('You’ll see it here the moment it launches');
                }}
                className="!bg-white !text-[#070b24] hover:!bg-white/90"
              >
                <Bell className="mr-2 h-4 w-4" />
                {notified ? 'We’ll keep you posted' : 'Notify me at launch'}
              </Button>
              <span className="text-xs text-white/50">Nothing is active until policy issuance.</span>
            </div>
          </div>

          <div className="relative">
            <div className="hp-float mx-auto h-[290px] w-full max-w-[370px]">
              <ForgedShield />
            </div>
            <ol className="mt-4 grid grid-cols-2 gap-2">
              {STAGES.map((s, i) => (
                <li
                  key={s}
                  className={cn(
                    'flex items-start gap-2 rounded-xl px-3 py-2 text-xs ring-1 backdrop-blur',
                    i === CURRENT ? 'bg-amber-300/10 text-amber-100 ring-amber-300/30' : 'bg-white/[0.04] text-white/55 ring-white/10'
                  )}
                >
                  <span className="font-mono font-bold">{String(i + 1).padStart(2, '0')}</span>
                  <span className="leading-snug">
                    {s}
                    {i === CURRENT && <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wider text-amber-300">In progress</span>}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* Notice, set like a policy document */}
        <section className="hp-rise relative overflow-hidden rounded-2xl border bg-card shadow-xs" style={{ animationDelay: '120ms' }}>
          <div className="flex items-center justify-between border-b border-dashed px-7 py-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">cInsurance · Notice to students</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Ref. CI-001</p>
          </div>
          <div className="relative px-7 pb-16 pt-6">
            <p className="font-serif text-2xl italic text-foreground">Where things stand</p>
            <ol className="mt-5 space-y-4">
              {NOTES.map((n, i) => (
                <li key={n} className="flex gap-4">
                  <span className="w-7 shrink-0 font-serif text-2xl leading-none text-indigo-500/60">§{i + 1}</span>
                  <p className="pt-0.5 text-[15px] leading-relaxed text-foreground/85">{n}</p>
                </li>
              ))}
            </ol>
            <span className="hp-stamp pointer-events-none absolute bottom-5 right-6 rounded-md border-[3px] border-double border-rose-500/60 px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-[0.2em] text-rose-500/70">
              Subject to approval
            </span>
          </div>
          <div className="h-1.5 bg-[linear-gradient(90deg,#312e81,#4f46e5,#0ea5e9)]" />
        </section>

        <section className="hp-rise" style={{ animationDelay: '220ms' }}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Upcoming benefits</p>
          <p className="mb-4 mt-1 text-sm text-muted-foreground">Hover the wallet to see everything on the way.</p>
          <BenefitWallet front="insurance" />
        </section>
      </div>
    </div>
  );
}

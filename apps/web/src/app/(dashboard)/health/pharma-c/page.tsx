'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Bell, QrCode, ScanLine, ShoppingBag, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/authStore';
import { Disclaimers, UpcomingBenefits, HP_CSS } from '@/components/health-plus/shared';

const NOTES = [
  'Pharmacy discounts for students are coming soon.',
  'Partner pharmacies, discount rates and terms will be announced at launch.',
  'Nothing is redeemable until the programme formally launches.',
];

const CAPSULES = [
  { cls: 'left-[6%] top-[14%] rotate-[28deg]', tone: 'from-white to-emerald-200', delay: 0 },
  { cls: 'right-[8%] top-[10%] -rotate-[20deg]', tone: 'from-amber-200 to-orange-300', delay: 1.2 },
  { cls: 'left-[14%] bottom-[12%] -rotate-[40deg]', tone: 'from-sky-200 to-cyan-300', delay: 2.1 },
  { cls: 'right-[4%] bottom-[22%] rotate-[55deg]', tone: 'from-rose-200 to-pink-300', delay: 0.6 },
];

const HOW = [
  { icon: Store, title: 'Find a partner pharmacy', text: 'Partner pharmacies will be listed right here.' },
  { icon: QrCode, title: 'Show your Pharma-C card', text: 'Your card lives in the app, next to your student ID.' },
  { icon: ScanLine, title: 'Save at the counter', text: 'The discount is applied at billing.' },
];

export default function PharmaCPage() {
  const tenant = useAuthStore((s) => (s.user?.tenant as { name?: string } | undefined)?.name);
  const [notified, setNotified] = useState(false);

  return (
    <div className="space-y-8">
      <style>{HP_CSS}</style>

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl bg-[#04322b] text-white shadow-[0_30px_80px_-30px_rgba(4,50,43,.75)]">
        <span className="pointer-events-none absolute -left-24 -top-28 h-96 w-96 rounded-full bg-emerald-400/35 blur-[110px]" />
        <span className="pointer-events-none absolute -bottom-32 right-10 h-96 w-96 rounded-full bg-teal-300/25 blur-[110px]" />
        <span
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
            maskImage: 'radial-gradient(ellipse at 70% 40%, #000 10%, transparent 65%)',
          }}
        />

        <div className="relative grid items-center gap-10 p-7 sm:p-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="hp-rise">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Health Connect · Pharma-C</p>
            <span className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-200">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
              </span>
              Coming Soon
            </span>
            <h1 className="mt-5 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
              Pharmacy discounts,
              <br />
              <span className="bg-gradient-to-r from-emerald-200 via-teal-200 to-cyan-200 bg-clip-text text-transparent">made for students.</span>
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-emerald-50/80">
              Pharma-C will bring student discounts at partner pharmacies, right inside Campus Verse. Partners and rates will be announced at launch.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                onClick={() => {
                  setNotified(true);
                  toast.success('You’ll see it here the moment it launches');
                }}
                disabled={notified}
                className="bg-white text-[#04322b] hover:bg-white/90"
              >
                <Bell className="mr-2 h-4 w-4" />
                {notified ? 'We’ll keep you posted' : 'Notify me at launch'}
              </Button>
            </div>
          </div>

          {/* Illustration: pharmacy bag with drifting capsules */}
          <div className="relative mx-auto h-[340px] w-full max-w-[420px]">
            <span className="hp-pulse absolute inset-0 m-auto h-44 w-44 rounded-full bg-emerald-300/25" />
            <div className="hp-spin absolute inset-0 m-auto h-[290px] w-[290px] rounded-full border border-dashed border-white/15" />
            {CAPSULES.map((c, i) => (
              <span key={i} className={`absolute ${c.cls}`}>
                <span className="hp-drift block" style={{ animationDelay: `${c.delay}s` }}>
                  <span className={`flex h-6 w-14 overflow-hidden rounded-full bg-gradient-to-r shadow-lg ${c.tone}`}>
                    <span className="h-full w-1/2 bg-white/80" />
                  </span>
                </span>
              </span>
            ))}
            <svg viewBox="0 0 200 220" className="hp-float absolute inset-0 m-auto h-52 w-52 drop-shadow-[0_24px_40px_rgba(16,185,129,.5)]">
              <defs>
                <linearGradient id="bagG" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#6ee7b7" />
                  <stop offset=".55" stopColor="#10b981" />
                  <stop offset="1" stopColor="#0d9488" />
                </linearGradient>
                <linearGradient id="bagS" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#fff" stopOpacity=".5" />
                  <stop offset=".45" stopColor="#fff" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M70 62 V48 C70 30 84 18 100 18 C116 18 130 30 130 48 V62" fill="none" stroke="#fff" strokeOpacity=".85" strokeWidth="9" strokeLinecap="round" />
              <rect x="26" y="58" width="148" height="148" rx="26" fill="url(#bagG)" />
              <rect x="26" y="58" width="148" height="148" rx="26" fill="url(#bagS)" />
              <rect x="80" y="100" width="40" height="80" rx="9" fill="#fff" />
              <rect x="60" y="120" width="80" height="40" rx="9" fill="#fff" />
              {/* % tag */}
              <g transform="translate(140 44) rotate(14)">
                <circle r="26" fill="#fbbf24" />
                <text textAnchor="middle" dy="8" fontSize="24" fontWeight="800" fill="#78350f">%</text>
              </g>
            </svg>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        {/* ── How it will work ────────────────────────────────────── */}
        <section className="hp-rise rounded-2xl border bg-card p-6 shadow-xs" style={{ animationDelay: '80ms' }}>
          <p className="font-display text-base font-semibold">How it will work</p>
          <p className="mt-0.5 text-sm text-muted-foreground">The planned experience once Pharma-C launches.</p>
          <ol className="mt-6 grid gap-4 sm:grid-cols-3">
            {HOW.map((h, i) => (
              <li key={h.title} className="group relative rounded-2xl border bg-gradient-to-b from-emerald-500/[0.06] to-transparent p-5 transition hover:-translate-y-1 hover:shadow-soft">
                <span className="absolute right-4 top-3 font-display text-4xl font-bold text-emerald-500/15">{i + 1}</span>
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-400 text-white shadow-lg transition group-hover:scale-110">
                  <h.icon className="h-5 w-5" />
                </span>
                <p className="mt-4 text-sm font-semibold">{h.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{h.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Discount card preview ───────────────────────────────── */}
        <section className="hp-rise space-y-4" style={{ animationDelay: '160ms' }}>
          <div className="group [perspective:1200px]">
            <div className="relative aspect-[1.586] overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700 p-6 text-white shadow-[0_24px_60px_-24px_rgba(13,148,136,.8)] transition duration-500 [transform-style:preserve-3d] group-hover:[transform:rotateX(6deg)_rotateY(-10deg)]">
              <span className="hp-shine pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
              <span className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full border-[18px] border-white/10" />
              <div className="relative flex h-full flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">Pharma-C <span className="ml-1.5 rounded-full bg-white/20 px-1.5 py-0.5 tracking-wider">Preview</span></p>
                    <p className="mt-0.5 text-sm font-semibold">{tenant ?? 'Your campus'}</p>
                  </div>
                  <ShoppingBag className="h-7 w-7 text-white/80" />
                </div>
                <div className="flex h-10 items-end gap-[3px]" aria-hidden>
                  {Array.from({ length: 42 }, (_, i) => (
                    <span key={i} className="bg-white/85" style={{ width: i % 3 === 0 ? 3 : 1.5, height: `${60 + ((i * 37) % 40)}%` }} />
                  ))}
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-white/60">Member</p>
                    <p className="text-sm font-semibold">Student name</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-white/60">Status</p>
                    <p className="text-sm font-semibold">Coming soon</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <p className="text-center text-xs text-muted-foreground">A preview of the Pharma-C card. It can’t be used until launch.</p>
        </section>
      </div>

      <Disclaimers items={NOTES} />
      <UpcomingBenefits highlight="pharma" />
    </div>
  );
}

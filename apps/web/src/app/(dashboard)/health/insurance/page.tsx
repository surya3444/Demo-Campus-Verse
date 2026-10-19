'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { BadgeCheck, Bell, Building2, Sparkles, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/authStore';
import { Disclaimers, Journey, UpcomingBenefits, HP_CSS } from '@/components/health-plus/shared';

// The client's wording — keep verbatim
const STATUS_LINE =
  'Student accidental insurance coverage is under discussion with an insurance partner and is subject to regulatory, contractual and partner approvals.';
const NOTES = [
  STATUS_LINE,
  'Insurance benefits will be activated only after formal launch and policy issuance.',
  'Details of coverage, eligibility, exclusions and claim process will be announced separately.',
];

export default function CInsurancePage() {
  const tenant = useAuthStore((s) => (s.user?.tenant as { name?: string } | undefined)?.name);
  const [notified, setNotified] = useState(false);

  return (
    <div className="space-y-8">
      <style>{HP_CSS}</style>

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl bg-[#0b1440] text-white shadow-[0_30px_80px_-30px_rgba(11,20,64,.75)]">
        <span className="pointer-events-none absolute -left-24 -top-28 h-96 w-96 rounded-full bg-indigo-500/40 blur-[110px]" />
        <span className="pointer-events-none absolute -bottom-32 right-10 h-96 w-96 rounded-full bg-sky-400/30 blur-[110px]" />
        <span
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,.9) 1px, transparent 0)',
            backgroundSize: '22px 22px',
            maskImage: 'radial-gradient(ellipse at 70% 40%, #000 10%, transparent 65%)',
          }}
        />

        <div className="relative grid items-center gap-10 p-7 sm:p-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="hp-rise">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">
              Health Connect · cInsurance
            </p>
            <span className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-semibold text-amber-200">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-300 opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-300" />
              </span>
              Awaiting Partner Approval
            </span>
            <h1 className="mt-5 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
              Student accident
              <br />
              <span className="bg-gradient-to-r from-sky-300 via-indigo-200 to-violet-300 bg-clip-text text-transparent">insurance, on campus.</span>
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-indigo-100/85">{STATUS_LINE}</p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                onClick={() => {
                  setNotified(true);
                  toast.success('You’ll see it here the moment it launches');
                }}
                disabled={notified}
                className="bg-white text-[#0b1440] hover:bg-white/90"
              >
                <Bell className="mr-2 h-4 w-4" />
                {notified ? 'We’ll keep you posted' : 'Notify me at launch'}
              </Button>
              <span className="text-xs text-indigo-200/70">Benefits activate only after formal launch and policy issuance.</span>
            </div>
          </div>

          {/* Illustration: shield with orbits and floating tags */}
          <div className="relative mx-auto h-[340px] w-full max-w-[420px]">
            <div className="hp-spin absolute inset-0 m-auto h-[300px] w-[300px] rounded-full border border-dashed border-white/15" />
            <div className="hp-spin-rev absolute left-1/2 top-1/2 h-[230px] w-[230px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10">
              <span className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-sky-300 shadow-[0_0_14px_4px_rgba(125,211,252,.6)]" />
            </div>
            <span className="hp-pulse absolute inset-0 m-auto h-40 w-40 rounded-full bg-indigo-400/30" />
            <svg viewBox="0 0 200 220" className="hp-float absolute inset-0 m-auto h-44 w-44 drop-shadow-[0_24px_40px_rgba(79,70,229,.55)]">
              <defs>
                <linearGradient id="shieldG" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#a5b4fc" />
                  <stop offset=".5" stopColor="#6366f1" />
                  <stop offset="1" stopColor="#0ea5e9" />
                </linearGradient>
                <linearGradient id="shieldS" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#fff" stopOpacity=".55" />
                  <stop offset=".5" stopColor="#fff" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M100 8 L182 38 V104 C182 158 146 196 100 212 C54 196 18 158 18 104 V38 Z" fill="url(#shieldG)" />
              <path d="M100 8 L182 38 V104 C182 158 146 196 100 212 C54 196 18 158 18 104 V38 Z" fill="url(#shieldS)" />
              <path d="M100 22 L170 48 V104 C170 150 140 182 100 197 C60 182 30 150 30 104 V48 Z" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="2" />
              {/* graduation cap + heartbeat */}
              <path d="M64 92 L100 76 L136 92 L100 108 Z" fill="#fff" />
              <path d="M78 99 V116 C78 124 122 124 122 116 V99" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
              <path className="hp-dash" d="M48 146 H78 L88 128 L102 162 L114 138 L122 146 H152" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {[
              { icon: Users, label: 'Built for students', cls: '-left-4 top-4', anim: 'hp-float-b' },
              { icon: Building2, label: 'Partner-backed', cls: '-right-4 bottom-16', anim: 'hp-float' },
              { icon: Sparkles, label: 'Inside Campus Verse', cls: 'bottom-2 left-2', anim: 'hp-float' },
            ].map((t, i) => (
              <div
                key={t.label}
                className={`${t.anim} absolute ${t.cls} flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-medium backdrop-blur-md`}
                style={{ animationDelay: `${i * 0.8}s` }}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-white/15">
                  <t.icon className="h-3.5 w-3.5" />
                </span>
                {t.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        {/* ── Journey ─────────────────────────────────────────────── */}
        <section className="hp-rise rounded-2xl border bg-card p-6 shadow-xs" style={{ animationDelay: '80ms' }}>
          <p className="font-display text-base font-semibold">The road to launch</p>
          <p className="mt-0.5 text-sm text-muted-foreground">Each step needs to be complete before any benefit is available.</p>
          <div className="mt-6">
            <Journey
              current={0}
              steps={[
                { title: 'Partner discussion', text: 'Coverage is being discussed with an insurance partner.' },
                { title: 'Regulatory & contractual approvals', text: 'Regulatory, contractual and partner approvals.' },
                { title: 'Policy issuance', text: 'The policy is formally issued.' },
                { title: 'Formal launch', text: 'Coverage, eligibility, exclusions and the claim process are announced and benefits activate.' },
              ]}
            />
          </div>
        </section>

        {/* ── Policy card preview ─────────────────────────────────── */}
        <section className="hp-rise space-y-4" style={{ animationDelay: '160ms' }}>
          <div className="group [perspective:1200px]">
            <div className="relative aspect-[1.586] overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-sky-600 p-6 text-white shadow-[0_24px_60px_-24px_rgba(67,56,202,.8)] transition duration-500 [transform-style:preserve-3d] group-hover:[transform:rotateX(6deg)_rotateY(-10deg)]">
              <span className="hp-shine pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
              <span className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full border-[18px] border-white/10" />
              <span className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full border-[22px] border-white/[0.07]" />
              <div className="relative flex h-full flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">cInsurance <span className="ml-1.5 rounded-full bg-white/20 px-1.5 py-0.5 tracking-wider">Preview</span></p>
                    <p className="mt-0.5 text-sm font-semibold">{tenant ?? 'Your campus'}</p>
                  </div>
                  <BadgeCheck className="h-7 w-7 text-white/80" />
                </div>
                <div className="flex items-center gap-3">
                  <span className="h-8 w-11 rounded-md bg-gradient-to-br from-amber-200 to-amber-400 shadow-inner" />
                  <p className="font-mono text-lg tracking-[0.2em] text-white/90">•••• •••• ••••</p>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-white/60">Policy holder</p>
                    <p className="text-sm font-semibold">Student name</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-white/60">Status</p>
                    <p className="text-sm font-semibold">Not issued</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            A preview of the digital policy card students will carry in the app once a policy is issued.
          </p>
        </section>
      </div>

      <Disclaimers items={NOTES} />
      <UpcomingBenefits highlight="insurance" />
    </div>
  );
}

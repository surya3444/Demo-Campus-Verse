'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  AlertTriangle,
  Award,
  BedDouble,
  BookOpen,
  Briefcase,
  Bus,
  CalendarCheck,
  FileBadge,
  GraduationCap,
  HeartPulse,
  IndianRupee,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Users,
} from 'lucide-react';
import type { Student360 } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  Avatar,
  CompanyLogo,
  Meter,
  Num,
  Panel,
  Pill,
  Ring,
  StatusPill,
  fmtDate,
  lpa,
} from '@/components/connect/kit';

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const PRIMARY = 'hsl(var(--primary))';
const GOOD = 'hsl(var(--success))';

/* ── Hero ────────────────────────────────────────────────────────────── */

export function Student360Hero({ data, actions }: { data: Student360; actions?: ReactNode }) {
  const s = data.student;
  const chips: Array<{ icon: typeof Mail; label: string; tone?: string }> = [
    { icon: FileBadge, label: s.admissionNumber },
    ...(s.age ? [{ icon: CalendarCheck, label: `${s.age} years${s.gender ? ` · ${s.gender}` : ''}` }] : []),
    ...(s.bloodGroup ? [{ icon: HeartPulse, label: `Blood ${s.bloodGroup}`, tone: 'text-rose-600' }] : []),
    data.hostel
      ? { icon: BedDouble, label: `${data.hostel.hostel} · ${data.hostel.room}` }
      : { icon: MapPin, label: 'Day scholar' },
    ...(data.transport ? [{ icon: Bus, label: `${data.transport.bus} · ${data.transport.stop}` }] : []),
    ...(s.hasPortal ? [{ icon: KeyRound, label: 'Portal active' }] : []),
  ];
  return (
    <section className="relative overflow-hidden rounded-2xl border bg-card shadow-xs">
      <div
        className="relative h-36 overflow-hidden sm:h-40"
        style={{ background: 'linear-gradient(120deg, hsl(var(--primary)) 0%, hsl(218 72% 32%) 55%, hsl(200 80% 45%) 120%)' }}
      >
        <span
          className="absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,.9) 1px, transparent 0)',
            backgroundSize: '18px 18px',
            maskImage: 'linear-gradient(100deg, transparent 20%, #000 80%)',
          }}
        />
        <span className="pointer-events-none absolute -right-10 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <p className="pointer-events-none absolute bottom-3 right-6 hidden select-none font-display text-5xl font-bold tracking-tight text-white/10 md:block">
          {s.department}
        </p>
      </div>
      <div className="relative px-6 pb-6">
        <div className="-mt-14 flex flex-col gap-5 lg:flex-row lg:items-start">
          <Avatar person={{ name: s.name, photo: s.photo }} size={116} className="shrink-0 shadow-lg ring-4 ring-card" />
          {/* Sits below the banner, level with the bottom half of the photo */}
          <div className="min-w-0 flex-1 lg:pt-[64px]">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-display text-3xl font-bold leading-tight tracking-tight">{s.name}</h1>
              <StatusPill status={s.status} />
            </div>
            <p className="mt-1 text-muted-foreground">
              {[s.program, s.section && `Section ${s.section}`, s.rollNumber && `Roll ${s.rollNumber}`].filter(Boolean).join(' · ')}
            </p>
          </div>
          {actions && <div className="flex flex-wrap gap-2 lg:pt-[64px]">{actions}</div>}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {chips.map((c) => (
            <span key={c.label} className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium">
              <c.icon className={cn('h-3.5 w-3.5 text-muted-foreground', c.tone)} />
              {c.label}
            </span>
          ))}
          {s.contact?.phone && (
            <a href={`tel:${s.contact.phone}`} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium hover:bg-muted/50">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              {s.contact.phone}
            </a>
          )}
          {s.contact?.email && (
            <a href={`mailto:${s.contact.email}`} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium hover:bg-muted/50">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              {s.contact.email}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

/* ── Pulse: one tile per side of the student's life ─────────────────── */

function Tile({ label, icon: Icon, href, children }: { label: string; icon: typeof Mail; href?: string; children: ReactNode }) {
  const body = (
    <div className="group relative h-full overflow-hidden rounded-xl border bg-card p-4 shadow-xs transition hover:-translate-y-0.5 hover:shadow-soft">
      <span className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-primary/[0.07] blur-xl" />
      <div className="relative flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-primary/70" />
      </div>
      <div className="relative mt-2">{children}</div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function Student360Pulse({ data }: { data: Student360 }) {
  const a = data.academics;
  const f = data.fees;
  const h = data.health;
  const c = data.career;
  const att = a.attendance?.percent ?? null;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Tile label="Attendance" icon={CalendarCheck}>
        <div className="flex items-center gap-3">
          <Ring value={att ?? 0} size={52} stroke={5} color={att !== null && att < 75 ? '#e11d48' : GOOD}>
            <span className="text-[11px] font-semibold tabular-nums">{att !== null ? `${Math.round(att)}%` : '—'}</span>
          </Ring>
          <p className="text-xs leading-snug text-muted-foreground">
            {a.attendance?.held ? `${a.attendance.present} of ${a.attendance.held} days` : 'Not marked yet'}
          </p>
        </div>
      </Tile>
      <Tile label="CGPA" icon={GraduationCap}>
        <p className="text-2xl font-bold tabular-nums">{a.cgpa !== null ? <Num value={a.cgpa} format={(n) => n.toFixed(2)} /> : '—'}</p>
        <p className="text-xs text-muted-foreground">
          {a.exams.at(-1)?.rank ? `Rank ${a.exams.at(-1)?.rank} · ` : ''}
          {a.backlogs ? `${a.backlogs} backlog${a.backlogs > 1 ? 's' : ''}` : 'No backlogs'}
        </p>
      </Tile>
      {f && (
        <Tile label="Fees" icon={IndianRupee}>
          <p className={cn('text-lg font-bold tabular-nums', f.due > 0 ? 'text-rose-600' : 'text-success')}>
            {f.due > 0 ? `${inr(f.due)} due` : f.total ? 'Fully paid' : '—'}
          </p>
          <Meter value={f.total ? (f.paid / f.total) * 100 : 0} color={GOOD} className="mt-2" />
          <p className="mt-1 text-[11px] text-muted-foreground">
            {inr(f.paid)} of {inr(f.total)}
          </p>
        </Tile>
      )}
      {h && (
        <Tile label="Health" icon={HeartPulse} href={h.recordId ? `/health/records/${h.recordId}` : undefined}>
          {h.allergies.length ? (
            <p className="flex items-center gap-1.5 text-sm font-semibold text-rose-600">
              <AlertTriangle className="h-4 w-4" />
              {h.allergies.length} allerg{h.allergies.length > 1 ? 'ies' : 'y'}
            </p>
          ) : (
            <p className="flex items-center gap-1.5 text-sm font-semibold text-success">
              <ShieldCheck className="h-4 w-4" />
              {h.recordId ? 'No alerts' : 'No record yet'}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {[h.bmi && `BMI ${Number(h.bmi).toFixed(1)}`, h.visits.length && `${h.visits.length} visit${h.visits.length > 1 ? 's' : ''}`].filter(Boolean).join(' · ') || 'Nothing recorded'}
          </p>
        </Tile>
      )}
      {c && (
        <Tile label="Career" icon={Briefcase} href={`/career-connect/student-profile/${data.student.id}`}>
          {c.placement ? (
            <div className="flex items-center gap-2.5">
              <CompanyLogo name={c.placement.company} website={c.placement.website} size={32} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{c.placement.company}</p>
                <p className="text-xs font-medium text-success">{lpa(c.placement.ctc)}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Ring value={c.readiness ?? 0} size={52} stroke={5} color={PRIMARY}>
                <span className="text-[11px] font-semibold">{c.readiness ?? 0}%</span>
              </Ring>
              <p className="text-xs leading-snug text-muted-foreground">Profile ready · {c.drives.length} drive{c.drives.length === 1 ? '' : 's'}</p>
            </div>
          )}
        </Tile>
      )}
      <Tile label="Campus life" icon={Sparkles}>
        <p className="text-sm font-semibold">
          {data.clubs.length ? `${data.clubs.length} club${data.clubs.length > 1 ? 's' : ''}` : 'No clubs yet'}
        </p>
        <p className="mt-1 flex gap-1 text-lg leading-none">{data.clubs.slice(0, 5).map((cl) => <span key={cl.id}>{cl.emoji ?? '•'}</span>)}</p>
        <p className="mt-1 text-xs text-muted-foreground">{data.hostel ? `Hostel · room ${data.hostel.room}` : data.transport ? `Bus ${data.transport.bus}` : 'Day scholar'}</p>
      </Tile>
    </div>
  );
}

/* ── Overview ────────────────────────────────────────────────────────── */

export function Student360Overview({ data }: { data: Student360 }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-6">
        <Academics data={data} />
        {data.academics.attendance && <Attendance data={data} />}
        {data.career && <Career data={data} />}
        {data.health && <Health data={data} />}
      </div>
      <div className="space-y-6">
        <IdCard data={data} />
        {data.fees && <Fees data={data} />}
        <CampusLife data={data} />
        <Family data={data} />
        {data.certificates && data.certificates.length > 0 && <Certificates data={data} />}
        <Timeline data={data} />
      </div>
    </div>
  );
}

function Academics({ data }: { data: Student360 }) {
  const a = data.academics;
  const latest = a.exams.at(-1);
  return (
    <Panel
      title={<Title icon={BookOpen}>Academics</Title>}
      description={data.student.program ?? undefined}
    >
      <div className="grid gap-6 md:grid-cols-[180px_minmax(0,1fr)]">
        <div className="rounded-xl bg-primary/[0.05] p-4 text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">CGPA</p>
          <p className="mt-1 font-display text-5xl font-bold tabular-nums text-primary">{a.cgpa?.toFixed(2) ?? '—'}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {a.earnedCredits ? `${a.earnedCredits}${a.totalCredits ? `/${a.totalCredits}` : ''} credits` : ''}
          </p>
          {latest?.rank ? (
            <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/10">
              <Award className="h-3 w-3" /> Class rank {latest.rank}
            </p>
          ) : null}
        </div>
        <div className="min-w-0 space-y-5">
          {a.exams.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Exams</p>
              <ul className="space-y-2.5">
                {a.exams.map((e) => (
                  <li key={e.name}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate">{e.name}</span>
                      <span className="shrink-0 tabular-nums">
                        <span className="font-semibold">{e.percentage ?? '—'}%</span>
                        {e.grade && <span className="text-muted-foreground"> · {e.grade}</span>}
                        {e.sgpa && <span className="text-muted-foreground"> · SGPA {e.sgpa}</span>}
                      </span>
                    </div>
                    <Meter value={e.percentage ?? 0} color={e.passed === false ? '#e11d48' : PRIMARY} className="mt-1.5" />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {a.subjects.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Latest marks by subject</p>
              <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {a.subjects.slice(0, 8).map((x, i) => (
                  <div key={`${x.subject}-${i}`} className="flex items-center justify-between gap-2 border-b border-dashed pb-1.5 text-sm">
                    <span className="truncate">{x.subject}</span>
                    <span className={cn('shrink-0 tabular-nums', x.passed === false && 'text-rose-600')}>
                      {x.absent ? 'Absent' : `${x.marks ?? '—'}${x.max ? `/${x.max}` : ''}`}
                      {x.grade && <span className="ml-1.5 rounded bg-muted px-1 text-[11px] font-semibold">{x.grade}</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {a.assignments.graded > 0 && (
            <p className="text-xs text-muted-foreground">
              {a.assignments.graded} assignments graded · average {a.assignments.average}%
            </p>
          )}
          {!a.exams.length && !a.subjects.length && <p className="text-sm text-muted-foreground">No exam results yet.</p>}
        </div>
      </div>
    </Panel>
  );
}

function Attendance({ data }: { data: Student360 }) {
  const at = data.academics.attendance!;
  const color = (st: string) =>
    /present/.test(st) ? 'bg-success' : /late|half/.test(st) ? 'bg-amber-400' : /absent/.test(st) ? 'bg-rose-500' : /leave|excused/.test(st) ? 'bg-sky-400' : 'bg-muted';
  return (
    <Panel
      title={<Title icon={CalendarCheck}>Attendance</Title>}
      description={at.held ? `${at.present} present · ${at.absent} absent of ${at.held} working days` : 'No attendance marked yet'}
      action={
        at.percent !== null ? (
          <span className={cn('text-2xl font-bold tabular-nums', at.percent < 75 ? 'text-rose-600' : 'text-success')}>{at.percent}%</span>
        ) : undefined
      }
    >
      {at.recent.length > 0 && (
        <>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Last {at.recent.length} working days</p>
          <div className="flex flex-wrap gap-1">
            {at.recent.map((d) => (
              <span
                key={d.date}
                title={`${fmtDate(d.date, { weekday: 'short', day: 'numeric', month: 'short' })} — ${d.status}`}
                className={cn('h-5 w-5 rounded-[5px]', color(d.status))}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-muted-foreground">
            {[['bg-success', 'Present'], ['bg-amber-400', 'Late'], ['bg-rose-500', 'Absent'], ['bg-sky-400', 'Leave']].map(([c, l]) => (
              <span key={l} className="flex items-center gap-1.5">
                <span className={cn('h-2.5 w-2.5 rounded-sm', c)} />
                {l}
              </span>
            ))}
          </div>
        </>
      )}
      {at.monthly.length > 1 && (
        <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(70px,1fr))] gap-3">
          {at.monthly.map((m) => (
            <div key={m.month} className="rounded-lg bg-muted/40 p-2.5 text-center">
              <p className="text-[11px] text-muted-foreground">
                {new Date(`${m.month}-01`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })}
              </p>
              <p className={cn('text-sm font-semibold tabular-nums', m.percent < 75 && 'text-rose-600')}>{m.percent}%</p>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function Career({ data }: { data: Student360 }) {
  const c = data.career!;
  return (
    <Panel
      title={<Title icon={Briefcase}>Career</Title>}
      action={
        <Link href={`/career-connect/student-profile/${data.student.id}`} className="text-sm font-medium text-primary hover:underline">
          Career profile
        </Link>
      }
    >
      {c.placement && (
        <div className="mb-5 flex items-center gap-4 overflow-hidden rounded-xl border border-success/25 bg-success/[0.06] p-4">
          <CompanyLogo name={c.placement.company} website={c.placement.website} size={48} className="rounded-xl" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-success">Placed</p>
            <p className="truncate text-lg font-semibold">
              {c.placement.role ? `${c.placement.role} at ` : ''}
              {c.placement.company}
            </p>
            <p className="text-sm text-muted-foreground">
              {[c.placement.location, c.placement.date && `accepted ${fmtDate(c.placement.date)}`].filter(Boolean).join(' · ')}
            </p>
          </div>
          <p className="font-display text-2xl font-bold tabular-nums text-success">{lpa(c.placement.ctc)}</p>
        </div>
      )}
      <div className="grid gap-6 md:grid-cols-[120px_minmax(0,1fr)]">
        <div className="flex flex-col items-center gap-2">
          <Ring value={c.readiness ?? 0} size={92} stroke={8} color={PRIMARY}>
            <span className="text-lg font-bold tabular-nums">{c.readiness ?? 0}%</span>
          </Ring>
          <p className="text-center text-xs text-muted-foreground">Placement-ready profile</p>
        </div>
        <div className="min-w-0 space-y-4">
          {c.skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {c.skills.map((k) => (
                <span key={k.name} className="rounded-lg border px-2.5 py-1 text-xs font-medium">
                  {k.name}
                  {k.level && <span className="ml-1 font-normal capitalize text-muted-foreground">· {k.level}</span>}
                </span>
              ))}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <MiniStat label="Projects" value={c.projects.length} />
            <MiniStat label="Certifications" value={c.certifications.length} />
            <MiniStat label="Drives" value={c.drives.length} />
          </div>
          {c.offers.length + c.drives.length > 0 && (
            <ul className="divide-y rounded-xl border">
              {[...c.offers.map((o) => ({ ...o, kind: 'Offer' })), ...c.drives.filter((d) => !c.offers.some((o) => o.company === d.company)).map((d) => ({ company: d.company, website: d.website, role: d.role, ctc: d.ctc, status: d.status, date: null, kind: 'Drive' }))]
                .slice(0, 5)
                .map((o, i) => (
                  <li key={`${o.company}-${i}`} className="flex items-center gap-3 px-3 py-2.5">
                    <CompanyLogo name={o.company} website={o.website} size={30} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{o.company}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {o.kind} · {o.role ?? '—'}
                        {o.ctc ? ` · ${lpa(o.ctc)}` : ''}
                      </p>
                    </div>
                    <StatusPill status={o.status} />
                  </li>
                ))}
            </ul>
          )}
          {c.mentors.map((m) => (
            <div key={m.id} className="flex items-center gap-3 rounded-xl bg-muted/40 p-3">
              <Avatar person={m} size={36} />
              <p className="min-w-0 flex-1 text-sm">
                Mentored by <span className="font-semibold">{m.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {[m.role, m.company].filter(Boolean).join(' · ')} · {m.sessions} session{m.sessions === 1 ? '' : 's'}
                </span>
              </p>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function Health({ data }: { data: Student360 }) {
  const h = data.health!;
  return (
    <Panel
      title={<Title icon={Stethoscope}>Health</Title>}
      action={
        h.recordId ? (
          <Link href={`/health/records/${h.recordId}`} className="text-sm font-medium text-primary hover:underline">
            Health record
          </Link>
        ) : undefined
      }
    >
      {!h.recordId ? (
        <p className="text-sm text-muted-foreground">No health record yet — one opens automatically on the first sick-room visit.</p>
      ) : (
        <div className="space-y-5">
          {h.allergies.length > 0 && (
            <div className="flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-500/10 dark:text-rose-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <span className="font-semibold">Allergic to</span> {h.allergies.map((a) => `${a.name}${a.severity ? ` (${a.severity})` : ''}`).join(', ')}
              </span>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-4">
            <MiniStat label="Blood group" value={h.bloodGroup ?? '—'} />
            <MiniStat label="BMI" value={h.bmi ? Number(h.bmi).toFixed(1) : '—'} />
            <MiniStat label="Height" value={h.heightCm ? `${h.heightCm} cm` : '—'} />
            <MiniStat label="Weight" value={h.weightKg ? `${h.weightKg} kg` : '—'} />
          </div>
          {h.conditions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {h.conditions.map((c) => (
                <Pill key={c.name} tone="amber">
                  {c.name}
                </Pill>
              ))}
            </div>
          )}
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Sick-room visits</p>
              {h.visits.length ? (
                <ul className="space-y-2">
                  {h.visits.slice(0, 4).map((v) => (
                    <li key={v.id}>
                      <Link href={`/health/visits/${v.id}`} className="block rounded-lg p-2 text-sm transition hover:bg-muted/50">
                        <span className="font-medium">{v.complaint}</span>
                        <span className="block text-xs text-muted-foreground">
                          {fmtDate(v.date, { day: 'numeric', month: 'short' })}
                          {v.diagnosis ? ` · ${v.diagnosis}` : ''}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No visits.</p>
              )}
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Vaccinations & check-ups</p>
              <ul className="space-y-2 text-sm">
                {h.vaccinations.map((v, i) => (
                  <li key={`${v.name}-${i}`} className="flex items-center justify-between gap-2">
                    <span>
                      {v.name} <span className="text-muted-foreground">· dose {v.dose}</span>
                    </span>
                    <StatusPill status={v.status} />
                  </li>
                ))}
                {h.checkups.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2">
                    <span className="capitalize">
                      {c.type} check-up <span className="text-muted-foreground">· {fmtDate(c.date, { day: 'numeric', month: 'short' })}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">{c.findings[0] ?? (c.bmi ? `BMI ${c.bmi}` : '')}</span>
                  </li>
                ))}
                {!h.vaccinations.length && !h.checkups.length && <li className="text-muted-foreground">None recorded.</li>}
              </ul>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}

function Fees({ data }: { data: Student360 }) {
  const f = data.fees!;
  const pct = f.total ? Math.round((f.paid / f.total) * 100) : 0;
  return (
    <Panel
      title={<Title icon={IndianRupee}>Fees</Title>}
      action={
        f.due > 0 ? (
          <Link href={`/finance/fee-counter?search=${encodeURIComponent(data.student.admissionNumber)}`} className="text-sm font-medium text-primary hover:underline">
            Collect
          </Link>
        ) : undefined
      }
    >
      {!f.assignments.length ? (
        <p className="text-sm text-muted-foreground">No fee structure assigned.</p>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <Ring value={pct} size={76} stroke={7} color={GOOD}>
              <span className="text-sm font-bold tabular-nums">{pct}%</span>
            </Ring>
            <div>
              <p className={cn('text-2xl font-bold tabular-nums', f.due > 0 ? 'text-rose-600' : 'text-success')}>{f.due > 0 ? inr(f.due) : 'Paid'}</p>
              <p className="text-xs text-muted-foreground">
                {f.due > 0 ? 'outstanding' : 'nothing outstanding'} · {inr(f.paid)} of {inr(f.total)} paid
              </p>
              {f.nextDueDate && f.due > 0 && <p className="mt-0.5 text-xs text-amber-700">Next instalment {fmtDate(f.nextDueDate)}</p>}
            </div>
          </div>
          <ul className="mt-4 space-y-2.5">
            {f.assignments.map((a) => (
              <li key={a.id}>
                <div className="flex justify-between text-sm">
                  <span className="capitalize">{a.name ?? `${a.type} fee`}</span>
                  <span className="tabular-nums text-muted-foreground">{inr(a.total)}</span>
                </div>
                <Meter value={a.total ? (a.paid / a.total) * 100 : 0} color={GOOD} className="mt-1" />
              </li>
            ))}
          </ul>
          {f.transactions.length > 0 && (
            <>
              <p className="mb-2 mt-5 text-xs font-medium text-muted-foreground">Receipts</p>
              <ul className="divide-y text-sm">
                {f.transactions.slice(0, 4).map((x) => (
                  <li key={x.id} className="flex items-center justify-between gap-2 py-2">
                    <span>
                      <span className="font-medium tabular-nums">{inr(x.amount)}</span>
                      <span className="block text-xs text-muted-foreground">
                        {x.receiptNumber} · {fmtDate(x.date, { day: 'numeric', month: 'short' })}
                      </span>
                    </span>
                    <span className="text-xs capitalize text-muted-foreground">{x.mode?.replace('_', ' ')}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </Panel>
  );
}

function IdCard({ data }: { data: Student360 }) {
  const s = data.student;
  const card = data.idCard;
  const primary = card?.primary ?? 'hsl(var(--primary))';
  const accent = card?.accent ?? '#f2b705';
  // A deterministic pattern standing in for the QR on screen
  const cells = Array.from({ length: 81 }, (_, i) => (s.admissionNumber.charCodeAt(i % s.admissionNumber.length) * (i + 7)) % 3 === 0);
  return (
    <div className="group [perspective:1200px]">
      <div className="relative overflow-hidden rounded-2xl text-white shadow-soft transition duration-500 [transform-style:preserve-3d] group-hover:[transform:rotateY(-8deg)_rotateX(4deg)]" style={{ background: `linear-gradient(140deg, ${primary}, ${primary} 55%, #0b1b3f)` }}>
        <span className="absolute inset-x-0 top-0 h-1.5" style={{ background: accent }} />
        <span className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="relative p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold tracking-tight">{card?.title ?? 'Student ID'}</p>
              <p className="text-[10px] text-white/70">{card?.subtitle}</p>
            </div>
            <span className="rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black" style={{ background: accent }}>
              Student
            </span>
          </div>
          <div className="mt-4 flex gap-4">
            <Avatar person={{ name: s.name, photo: s.photo }} size={72} className="rounded-xl ring-2 ring-white/40" />
            <div className="min-w-0 text-xs leading-relaxed">
              <p className="truncate text-base font-semibold">{s.name}</p>
              <p className="truncate text-white/80">{s.program}</p>
              <p className="text-white/80">
                {s.section ? `Sec ${s.section}` : ''} {s.rollNumber ? `· Roll ${s.rollNumber}` : ''}
              </p>
              <p className="font-mono text-white/90">{s.admissionNumber}</p>
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <div className="text-[10px] text-white/70">
              {s.bloodGroup && <p>Blood group <span className="font-semibold text-white">{s.bloodGroup}</span></p>}
              {card?.validTill && <p>Valid till {fmtDate(card.validTill, { month: 'short', year: 'numeric' })}</p>}
              <p className="mt-2 border-t border-white/30 pt-1 italic">{card?.signatureLabel ?? 'Principal'}</p>
            </div>
            <div className="grid grid-cols-9 gap-[1.5px] rounded-md bg-white p-1.5">
              {cells.map((on, i) => (
                <span key={i} className={cn('h-[5px] w-[5px]', on ? 'bg-black' : 'bg-white')} />
              ))}
            </div>
          </div>
        </div>
      </div>
      <Link href="/students/id-cards" className="mt-2 block text-center text-xs text-muted-foreground hover:text-foreground">
        Print or redesign ID cards →
      </Link>
    </div>
  );
}

function CampusLife({ data }: { data: Student360 }) {
  const { hostel, transport, clubs } = data;
  if (!hostel && !transport && !clubs.length) return null;
  return (
    <Panel title={<Title icon={Sparkles}>Campus life</Title>}>
      <div className="space-y-4">
        {hostel && (
          <div className="flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BedDouble className="h-5 w-5" />
            </span>
            <div className="text-sm">
              <p className="font-semibold">{hostel.hostel}</p>
              <p className="text-muted-foreground">
                Room {hostel.room} · bed {hostel.bed}
                {hostel.warden ? ` · warden ${hostel.warden}` : ''}
              </p>
              {hostel.since && <p className="text-xs text-muted-foreground">Since {fmtDate(hostel.since)}</p>}
            </div>
          </div>
        )}
        {transport && (
          <div className="flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Bus className="h-5 w-5" />
            </span>
            <div className="text-sm">
              <p className="font-semibold">
                {transport.bus} · {transport.route}
              </p>
              <p className="text-muted-foreground">
                {transport.stop}
                {transport.pickup ? ` · pickup ${transport.pickup}` : ''}
                {transport.drop ? ` · drop ${transport.drop}` : ''}
              </p>
              {transport.driver && (
                <p className="text-xs text-muted-foreground">
                  Driver {transport.driver}
                  {transport.driverPhone ? ` · ${transport.driverPhone}` : ''}
                </p>
              )}
            </div>
          </div>
        )}
        {clubs.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {clubs.map((c) => (
              <Link key={c.id} href={`/clubs/${c.id}`} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition hover:border-primary/40">
                <span className="text-sm">{c.emoji ?? '•'}</span>
                {c.name}
                {c.role !== 'member' && <span className="capitalize text-primary">· {c.role}</span>}
              </Link>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}

function Family({ data }: { data: Student360 }) {
  const s = data.student;
  const people = Object.entries(s.parents ?? {})
    .filter(([, p]) => p?.name)
    .map(([rel, p]) => ({ rel, ...p! }));
  const addr = s.contact?.address?.current;
  if (!people.length && !addr) return null;
  return (
    <Panel title={<Title icon={Users}>Family & contact</Title>}>
      <ul className="space-y-3">
        {people.map((p) => (
          <li key={p.rel} className="flex items-center gap-3">
            <Avatar person={{ name: p.name ?? '?' }} size={34} />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium">
                {p.name}
                {s.primaryContactType === p.rel && <span className="ml-1.5 text-[10px] font-semibold uppercase text-primary">Primary</span>}
              </p>
              <p className="truncate text-xs capitalize text-muted-foreground">
                {p.rel}
                {p.occupation ? ` · ${p.occupation}` : ''}
              </p>
            </div>
            {p.phone && (
              <a href={`tel:${p.phone}`} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground" title={p.phone}>
                <Phone className="h-4 w-4" />
              </a>
            )}
          </li>
        ))}
      </ul>
      {addr?.line1 && (
        <p className="mt-4 flex gap-2 border-t pt-3 text-xs text-muted-foreground">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {[addr.line1, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ')}
        </p>
      )}
    </Panel>
  );
}

function Certificates({ data }: { data: Student360 }) {
  return (
    <Panel title={<Title icon={FileBadge}>Certificates</Title>}>
      <ul className="space-y-2.5">
        {data.certificates!.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="min-w-0">
              <span className="block truncate font-medium">{c.type}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {c.number}
                {c.purpose ? ` · ${c.purpose}` : ''}
              </span>
            </span>
            <StatusPill status={c.status} />
          </li>
        ))}
      </ul>
    </Panel>
  );
}

const KIND: Record<string, { icon: typeof Mail; color: string }> = {
  admission: { icon: GraduationCap, color: 'bg-primary' },
  fee: { icon: IndianRupee, color: 'bg-success' },
  exam: { icon: BookOpen, color: 'bg-violet-500' },
  health: { icon: Stethoscope, color: 'bg-rose-500' },
  career: { icon: Briefcase, color: 'bg-amber-500' },
  club: { icon: Sparkles, color: 'bg-sky-500' },
  certificate: { icon: FileBadge, color: 'bg-slate-500' },
  hostel: { icon: BedDouble, color: 'bg-teal-600' },
};

function Timeline({ data }: { data: Student360 }) {
  if (!data.timeline.length) return null;
  return (
    <Panel title={<Title icon={CalendarCheck}>Journey</Title>} description="Everything that happened, newest first">
      <ol className="relative space-y-4 before:absolute before:bottom-2 before:left-[13px] before:top-2 before:w-px before:bg-border">
        {data.timeline.slice(0, 12).map((e, i) => {
          const k = KIND[e.kind] ?? KIND.admission;
          return (
            <li key={i} className="relative flex gap-3">
              <span className={cn('relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white ring-4 ring-card', k.color)}>
                <k.icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 pt-0.5 text-sm">
                <p className="font-medium leading-snug">{e.title}</p>
                <p className="text-xs text-muted-foreground">
                  {fmtDate(e.date, { day: 'numeric', month: 'short', year: 'numeric' })}
                  {e.detail ? ` · ${e.detail}` : ''}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

function Title({ icon: Icon, children }: { icon: typeof Mail; children: ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-primary" />
      {children}
    </span>
  );
}

function MiniStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}


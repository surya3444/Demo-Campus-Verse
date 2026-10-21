'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  CalendarClock,
  Crown,
  Loader2,
  MapPin,
  Pencil,
  Search,
  Trophy,
  UserRound,
  Users,
} from 'lucide-react';
import { clubsApi, type Club } from '@/lib/api';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';
import { useCountUp } from '@/hooks/useCountUp';
import { ClubBanner, JoinButton } from '@/components/clubs/ClubCard';
import { ClubCrest, Reveal, categoryOf, iconOf, themeOf } from '@/components/clubs/clubVisuals';

function Stat({ value, label }: { value: number; label: string }) {
  const v = useCountUp(value, 1300);
  return (
    <div className="rounded-2xl bg-white/10 px-4 py-2.5 ring-1 ring-white/15 backdrop-blur">
      <p className="font-display text-2xl font-extrabold tabular-nums">
        {Math.round(v).toLocaleString('en-IN')}
      </p>
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60">{label}</p>
    </div>
  );
}

function FaceRow({
  faces,
  reverse,
}: {
  faces: Array<{ photo?: string | null; name: string }>;
  reverse?: boolean;
}) {
  if (!faces.length) return null;
  const loop = [...faces, ...faces];
  return (
    <div className="overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
      <div
        className="flex w-max gap-3 animate-[club-marquee_40s_linear_infinite]"
        style={reverse ? { animationDirection: 'reverse' } : undefined}
      >
        {loop.map((f, i) => (
          <img
            key={i}
            src={f.photo ?? ''}
            alt={f.name}
            title={f.name}
            className="h-11 w-11 rounded-full object-cover ring-2 ring-white shadow-sm"
          />
        ))}
      </div>
    </div>
  );
}

export default function ClubPage() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission('clubs.manage', 'edit');
  const q = useQuery({
    queryKey: ['club', id],
    queryFn: () => clubsApi.get(id).then((r) => r.data),
  });
  const [club, setClub] = useState<Club | null>(null);
  useEffect(() => setClub(q.data ?? null), [q.data]);
  const [find, setFind] = useState('');

  if (!club) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  const th = themeOf(club.theme);
  const cat = categoryOf(club.category);
  const CatIcon = iconOf(cat.icon);
  const all = club.members ?? [];
  const leads = all.filter((m) => m.role === 'lead');
  const withPhotos = all.filter((m) => m.photo);
  const members = all.filter((m) => !find || m.name.toLowerCase().includes(find.toLowerCase()));

  return (
    <div className="space-y-6">
      <Link
        href="/clubs"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All clubs
      </Link>

      {/* Stage */}
      <section className="group overflow-hidden rounded-[28px] shadow-[0_30px_80px_-35px_rgba(5,40,110,0.8)] animate-[club-fade-up_0.6s_both]">
        <ClubBanner club={club} className="min-h-[340px] text-white">
          <div className="relative grid items-center gap-8 px-6 py-10 sm:px-10 md:grid-cols-[auto_minmax(0,1fr)]">
            <div className="relative mx-auto flex h-56 w-56 items-center justify-center">
              <span
                className="absolute inset-[-30%] rounded-full opacity-70 animate-[club-spin_22s_linear_infinite]"
                style={{
                  background: `repeating-conic-gradient(from 0deg, ${th.c2}40 0deg 5deg, transparent 5deg 15deg)`,
                  maskImage: 'radial-gradient(circle, black 25%, transparent 68%)',
                }}
              />
              <span className="animate-[club-pop_0.9s_cubic-bezier(.2,.9,.3,1.3)_both]">
                <ClubCrest
                  icon={club.icon}
                  category={club.category}
                  theme={club.theme}
                  size={170}
                  live
                  gold
                />
              </span>
            </div>
            <div>
              <p className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ring-1 ring-white/20 backdrop-blur animate-[club-fade-up_0.5s_0.2s_both]">
                <CatIcon className="h-3.5 w-3.5" />
                {cat.label}
                {club.institutionName ? ` · ${club.institutionName}` : ''}
              </p>
              <h1 className="mt-3 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
                {club.name.split(' ').map((w, k) => (
                  <span
                    key={k}
                    className="mr-[0.25em] inline-block animate-[club-letter_0.8s_cubic-bezier(.2,.8,.2,1)_both]"
                    style={{ animationDelay: `${250 + k * 90}ms` }}
                  >
                    {w}
                  </span>
                ))}
              </h1>
              <p className="mt-3 max-w-2xl text-lg text-white/85 animate-[club-fade-up_0.6s_0.6s_both]">
                {club.tagline}
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3 animate-[club-fade-up_0.6s_0.8s_both]">
                <Stat value={club.memberCount} label="Members" />
                <Stat value={leads.length} label="Student leads" />
                <JoinButton
                  club={club}
                  size="lg"
                  className="!bg-white !text-[#05286e]"
                  onChange={() => q.refetch()}
                />
                {canEdit && (
                  <Link
                    href={`/clubs/new?edit=${club._id}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2.5 text-sm font-semibold ring-1 ring-white/25 backdrop-blur transition hover:bg-white/20"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Link>
                )}
              </div>
            </div>
          </div>
        </ClubBanner>
        <div className="space-y-3 bg-card py-5">
          <FaceRow faces={withPhotos.slice(0, 24)} />
          <FaceRow faces={withPhotos.slice(24, 48)} reverse />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {club.description && (
            <Reveal>
              <section className="rounded-[22px] border bg-card p-6">
                <h2 className="font-display text-lg font-bold tracking-tight">About the club</h2>
                <p className="mt-2 whitespace-pre-line leading-relaxed text-muted-foreground">
                  {club.description}
                </p>
                {club.tags.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {club.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-[hsl(var(--brand-cyan))]/30 bg-[hsl(var(--brand-cyan))]/10 px-2.5 py-0.5 text-xs font-semibold text-primary"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </section>
            </Reveal>
          )}

          {club.highlights.length > 0 && (
            <Reveal delay={80}>
              <section className="rounded-[22px] border bg-card p-6">
                <h2 className="font-display text-lg font-bold tracking-tight">Highlights</h2>
                <ol className="relative mt-4 space-y-4 border-l-2 border-dashed border-border pl-6">
                  {club.highlights.map((h, i) => (
                    <Reveal key={h} delay={i * 120}>
                      <li className="relative">
                        <span
                          className="absolute -left-[37px] top-0 flex h-8 w-8 items-center justify-center rounded-full text-white shadow-lg"
                          style={{
                            background: `linear-gradient(135deg, ${th.c2}, ${th.c1})`,
                            boxShadow: `0 0 0 4px hsl(var(--card)), 0 0 18px ${th.c2}88`,
                          }}
                        >
                          <Trophy className="h-4 w-4" />
                        </span>
                        <p className="pt-1 font-medium">{h}</p>
                      </li>
                    </Reveal>
                  ))}
                </ol>
              </section>
            </Reveal>
          )}

          <Reveal delay={120}>
            <section className="rounded-[22px] border bg-card p-6">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="font-display text-lg font-bold tracking-tight">
                  Members{' '}
                  <span className="text-muted-foreground">
                    · {club.memberCount.toLocaleString('en-IN')}
                  </span>
                </h2>
                <div className="relative ml-auto w-full sm:w-60">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={find}
                    onChange={(e) => setFind(e.target.value)}
                    placeholder="Find a member"
                    className="h-9 w-full rounded-full border bg-background pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--brand-cyan))]/30"
                  />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {members.slice(0, 120).map((m, i) => (
                  <div
                    key={m._id}
                    className="flex items-center gap-2.5 rounded-2xl border p-2.5 transition hover:-translate-y-0.5 hover:shadow-sm animate-[club-fade-up_0.5s_both]"
                    style={{ animationDelay: `${Math.min(i, 24) * 20}ms` }}
                  >
                    {m.photo ? (
                      <img
                        src={m.photo}
                        alt=""
                        className="h-10 w-10 rounded-full object-cover"
                        style={
                          m.role === 'lead'
                            ? { boxShadow: `0 0 0 2px hsl(var(--card)), 0 0 0 4px ${th.c2}` }
                            : undefined
                        }
                      />
                    ) : (
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                        <UserRound className="h-4 w-4 text-muted-foreground" />
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="flex items-center gap-1 truncate text-sm font-semibold">
                        {m.name}
                        {m.role === 'lead' && (
                          <Crown className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-500" />
                        )}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {m.role === 'lead' ? 'Student lead' : m.subtitle}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {members.length === 0 && (
                <p className="mt-4 text-sm text-muted-foreground">
                  No members yet — be the first to join.
                </p>
              )}
            </section>
          </Reveal>
        </div>

        <aside className="space-y-4">
          <Reveal>
            <div
              className="relative overflow-hidden rounded-[22px] p-[1.5px]"
              style={{ background: `linear-gradient(135deg, ${th.c2}, ${th.c1})` }}
            >
              <div className="rounded-[21px] bg-card p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Meets
                </p>
                <p className="mt-2 flex items-center gap-2 font-display text-lg font-bold">
                  <CalendarClock className="h-5 w-5" style={{ color: th.c1 }} />
                  {[club.meeting.day, club.meeting.time].filter(Boolean).join(' · ') ||
                    'To be announced'}
                </p>
                {club.meeting.venue && (
                  <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    {club.meeting.venue}
                  </p>
                )}
              </div>
            </div>
          </Reveal>
          {club.coordinator && (
            <Reveal delay={80}>
              <div className="rounded-[22px] border bg-card p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Faculty coordinator
                </p>
                <div className="mt-3 flex items-center gap-3">
                  {club.coordinator.photo ? (
                    <img
                      src={club.coordinator.photo}
                      alt=""
                      className="h-12 w-12 rounded-full object-cover ring-2 ring-[hsl(var(--brand-cyan))]/40"
                    />
                  ) : (
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <UserRound className="h-5 w-5" />
                    </span>
                  )}
                  <p className="font-semibold">{club.coordinator.name}</p>
                </div>
              </div>
            </Reveal>
          )}
          {leads.length > 0 && (
            <Reveal delay={140}>
              <div className="rounded-[22px] border bg-card p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Student leads
                </p>
                <ul className="mt-3 space-y-3">
                  {leads.map((m) => (
                    <li key={m._id} className="flex items-center gap-3">
                      {m.photo && (
                        <img
                          src={m.photo}
                          alt=""
                          className="h-10 w-10 rounded-full object-cover"
                          style={{ boxShadow: `0 0 0 2px hsl(var(--card)), 0 0 0 4px ${th.c2}` }}
                        />
                      )}
                      <div className="min-w-0">
                        <p className="flex items-center gap-1 truncate text-sm font-semibold">
                          {m.name} <Crown className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">{m.subtitle}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          )}
          <Reveal delay={200}>
            <div className={cn('flex items-center gap-3 rounded-[22px] border bg-card p-5')}>
              <Users className="h-5 w-5 text-[hsl(var(--brand-cyan))]" />
              <p className="text-sm text-muted-foreground">
                Anyone at {club.institutionName ?? 'the campus'} can join — tap <b>Join</b> above.
              </p>
            </div>
          </Reveal>
        </aside>
      </div>
    </div>
  );
}

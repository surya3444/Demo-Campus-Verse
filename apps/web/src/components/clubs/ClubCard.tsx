'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, CalendarClock, Check, Flame, Loader2, MapPin, Users } from 'lucide-react';
import { toast } from 'sonner';
import { clubsApi, type Club } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  ClubCrest,
  Confetti,
  Faces,
  Tilt,
  categoryOf,
  iconOf,
  themeOf,
  themeVars,
  useConfettiColors,
} from './clubVisuals';

export { CLUB_THEMES, CLUB_CATEGORY, themeOf, categoryOf } from './clubVisuals';

/** Full-screen "Welcome to the club" moment after joining. */
function WelcomeBurst({ club, onDone }: { club: Club; onDone: () => void }) {
  const colors = useConfettiColors(club.theme);
  useEffect(() => {
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [onDone]);
  const th = themeOf(club.theme);
  return createPortal(
    <div
      onClick={onDone}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#020b24]/70 backdrop-blur-sm animate-[club-iris-out_0.45s_ease-in_2.15s_forwards]"
    >
      <div className="relative flex flex-col items-center text-center text-white">
        <span
          className="absolute top-6 h-40 w-40 rounded-full animate-[club-pulse-ring_1.4s_ease-out_infinite]"
          style={{ background: th.c2, opacity: 0.4 }}
        />
        <span
          className="absolute top-6 h-40 w-40 rounded-full animate-[club-pulse-ring_1.4s_ease-out_0.5s_infinite]"
          style={{ background: th.c1, opacity: 0.4 }}
        />
        <div className="relative animate-[club-pop_0.7s_cubic-bezier(.2,.9,.3,1.3)_both]">
          <ClubCrest
            icon={club.icon}
            category={club.category}
            theme={club.theme}
            size={150}
            live
            gold
          />
          <Confetti colors={colors} count={40} />
        </div>
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 animate-[club-fade-up_0.5s_0.35s_both]">
          You’re in
        </p>
        <p className="mt-2 font-display text-3xl font-extrabold tracking-tight animate-[club-fade-up_0.6s_0.45s_both] sm:text-4xl">
          Welcome to <span className="club-gradient-text">{club.name}</span>
        </p>
      </div>
    </div>,
    document.body
  );
}

export function JoinButton({
  club,
  onChange,
  className,
  size = 'md',
}: {
  club: Club;
  onChange: (c: Pick<Club, 'memberCount' | 'isMember'>) => void;
  className?: string;
  size?: 'md' | 'lg';
}) {
  const [busy, setBusy] = useState(false);
  const [welcome, setWelcome] = useState(false);
  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    try {
      const r = club.isMember ? await clubsApi.leave(club._id) : await clubsApi.join(club._id);
      onChange(r.data);
      if (r.data.isMember) setWelcome(true);
      else toast(`You left ${club.name}`);
    } catch {
      toast.error('Could not update your membership');
    } finally {
      setBusy(false);
    }
  };
  const pad = size === 'lg' ? 'px-6 py-2.5 text-[15px]' : 'px-4 py-1.5 text-sm';
  return (
    <>
      {club.isMember ? (
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          className={cn(
            'group/join relative inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 font-semibold text-emerald-700 transition-all hover:border-rose-400/50 hover:bg-rose-500/10 hover:text-rose-600 dark:text-emerald-300',
            pad,
            className
          )}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4 group-hover/join:hidden" />
          )}
          <span className="group-hover/join:hidden">Member</span>
          <span className="hidden group-hover/join:inline">Leave club</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          className={cn(
            'group/join relative inline-flex items-center gap-1.5 overflow-hidden rounded-full bg-primary font-semibold text-primary-foreground shadow-[0_6px_20px_-6px_hsl(var(--primary)/0.6)] transition-all hover:-translate-y-px hover:shadow-[0_10px_28px_-8px_hsl(var(--brand-cyan)/0.7)] active:scale-95',
            pad,
            className
          )}
        >
          <span className="absolute inset-0 bg-gradient-to-r from-primary via-[hsl(var(--brand-cyan))] to-primary bg-[length:200%_auto] opacity-0 transition-opacity duration-300 group-hover/join:opacity-100 group-hover/join:animate-[club-pan_1.6s_linear_infinite]" />
          <span className="relative flex items-center gap-1.5">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Join
            <ArrowRight className="h-4 w-4 transition-transform group-hover/join:translate-x-0.5" />
          </span>
        </button>
      )}
      {welcome && <WelcomeBurst club={club} onDone={() => setWelcome(false)} />}
    </>
  );
}

/** Banner art: navy stage lit by the club's colours, with a cursor-follow glow. */
export function ClubBanner({
  club,
  className,
  children,
}: {
  club: Pick<Club, 'theme'>;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn('relative overflow-hidden bg-[#041637]', className)}
      style={themeVars(club.theme)}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, rgba(255,255,255,0.10), transparent 35%, rgba(4,22,55,0.35)), radial-gradient(90% 120% at 100% 0%, rgba(255,255,255,0.28), transparent 55%), linear-gradient(120deg, var(--c1) 0%, var(--c2) 100%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            'radial-gradient(260px circle at var(--mx,50%) var(--my,50%), rgba(255,255,255,0.22), transparent 60%)',
        }}
      />
      <svg className="absolute inset-0 h-full w-full opacity-[0.14]" aria-hidden>
        <defs>
          <pattern id="club-grid" width="22" height="22" patternUnits="userSpaceOnUse">
            <path d="M22 0H0V22" fill="none" stroke="white" strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#club-grid)" />
      </svg>
      {children}
    </div>
  );
}

export function ClubCard({
  club,
  onChange,
  delay = 0,
  trending,
}: {
  club: Club;
  onChange: (c: Club) => void;
  delay?: number;
  trending?: boolean;
}) {
  const cat = categoryOf(club.category);
  const CatIcon = iconOf(cat.icon);
  return (
    <div
      className="animate-[club-fade-up_0.6s_cubic-bezier(.2,.8,.2,1)_both]"
      style={{ animationDelay: `${delay}ms` }}
    >
      <Tilt className="group h-full rounded-[22px]">
        <Link
          href={`/clubs/${club._id}`}
          className="relative flex h-full flex-col overflow-hidden rounded-[22px] border border-border/70 bg-card shadow-[0_1px_2px_rgba(5,40,110,0.06),0_12px_32px_-20px_rgba(5,40,110,0.45)] transition-shadow duration-300 group-hover:shadow-[0_24px_60px_-24px_rgba(5,40,110,0.55)]"
        >
          <ClubBanner club={club} className="h-28">
            <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white ring-1 ring-white/20 backdrop-blur-md">
              <CatIcon className="h-3 w-3" />
              {cat.label}
            </span>
            {trending && (
              <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-2.5 py-1 text-[11px] font-bold text-white shadow">
                <Flame className="h-3 w-3" />
                Trending
              </span>
            )}
          </ClubBanner>
          {/* light sweep across the card on hover */}
          <span className="pointer-events-none absolute inset-y-0 -left-1/2 z-20 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-0 group-hover:animate-[club-shine_1.1s_ease-out] group-hover:opacity-100" />

          <div className="relative -mt-9 px-5">
            <ClubCrest
              icon={club.icon}
              category={club.category}
              theme={club.theme}
              size={62}
              className="transition-transform duration-500 group-hover:-translate-y-1 group-hover:rotate-[-6deg] group-hover:scale-110"
            />
          </div>

          <div className="flex flex-1 flex-col gap-2 px-5 pb-5 pt-2">
            <div>
              <h3 className="font-display text-[17px] font-bold leading-snug tracking-tight text-foreground">
                {club.name}
              </h3>
              {club.institutionName && (
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {club.institutionName}
                </p>
              )}
            </div>
            <p className="line-clamp-2 flex-1 text-sm leading-relaxed text-muted-foreground">
              {club.tagline}
            </p>
            {(club.meeting.day || club.meeting.venue) && (
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {club.meeting.day && (
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="h-3.5 w-3.5 text-[hsl(var(--brand-cyan))]" />
                    {[club.meeting.day, club.meeting.time].filter(Boolean).join(' · ')}
                  </span>
                )}
                {club.meeting.venue && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-[hsl(var(--brand-cyan))]" />
                    {club.meeting.venue}
                  </span>
                )}
              </div>
            )}
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-dashed pt-3.5">
              <div className="flex items-center gap-2">
                <Faces faces={club.faces ?? []} size={28} />
                <span className="inline-flex items-center gap-1 text-xs font-semibold tabular-nums text-foreground/80">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  {club.memberCount.toLocaleString('en-IN')}
                </span>
              </div>
              <JoinButton club={club} onChange={(c) => onChange({ ...club, ...c })} />
            </div>
          </div>
        </Link>
      </Tilt>
    </div>
  );
}

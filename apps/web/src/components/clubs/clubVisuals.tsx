'use client';

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  BookOpenText,
  Bot,
  Brain,
  Briefcase,
  Camera,
  Clapperboard,
  CodeXml,
  Cpu,
  Crown,
  Disc3,
  Drama,
  Feather,
  Flag,
  Flower2,
  Footprints,
  Globe2,
  Guitar,
  HeartHandshake,
  Landmark,
  Lightbulb,
  LockKeyhole,
  Medal,
  Mic2,
  Palette,
  PersonStanding,
  Ribbon,
  Rocket,
  Scissors,
  ScrollText,
  ShieldCheck,
  Sprout,
  TrendingUp,
  Trophy,
  Volleyball,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── Palette: jewel tones that sit well on Campus Verse navy ─────────────── */

export const CLUB_THEMES: Record<string, { c1: string; c2: string; label: string }> = {
  ocean: { c1: '#1d4ed8', c2: '#0abfff', label: 'Sapphire' },
  aurora: { c1: '#0891b2', c2: '#a78bfa', label: 'Aurora' },
  forest: { c1: '#047857', c2: '#34d399', label: 'Emerald' },
  berry: { c1: '#6d28d9', c2: '#e879f9', label: 'Amethyst' },
  sunset: { c1: '#be123c', c2: '#fb923c', label: 'Coral' },
  ember: { c1: '#b91c1c', c2: '#f59e0b', label: 'Ember' },
  midnight: { c1: '#05286e', c2: '#3b82f6', label: 'Midnight' },
  gold: { c1: '#a16207', c2: '#fde047', label: 'Gold' },
};
export const themeOf = (t?: string) => CLUB_THEMES[t ?? ''] ?? CLUB_THEMES.ocean;
export const themeVars = (t?: string) => {
  const th = themeOf(t);
  return { '--c1': th.c1, '--c2': th.c2 } as CSSProperties;
};

/* ── Crest icons ─────────────────────────────────────────────────────────── */

export const CLUB_ICONS: Record<string, LucideIcon> = {
  circuit: Cpu,
  bot: Bot,
  bulb: Lightbulb,
  rocket: Rocket,
  code: CodeXml,
  shield: ShieldCheck,
  lock: LockKeyhole,
  zap: Zap,
  wrench: Wrench,
  handshake: HeartHandshake,
  medal: Medal,
  flag: Flag,
  sprout: Sprout,
  ribbon: Ribbon,
  flower: Flower2,
  landmark: Landmark,
  palette: Palette,
  drama: Drama,
  guitar: Guitar,
  disc: Disc3,
  dancer: PersonStanding,
  mic: Mic2,
  camera: Camera,
  film: Clapperboard,
  feather: Feather,
  scroll: ScrollText,
  book: BookOpenText,
  brain: Brain,
  globe: Globe2,
  trophy: Trophy,
  volleyball: Volleyball,
  footprints: Footprints,
  crown: Crown,
  chart: TrendingUp,
  briefcase: Briefcase,
  scissors: Scissors,
};

export const CLUB_CATEGORY: Record<string, { label: string; icon: string }> = {
  technical: { label: 'Technical', icon: 'circuit' },
  cultural: { label: 'Cultural', icon: 'drama' },
  arts: { label: 'Arts & Design', icon: 'palette' },
  sports: { label: 'Sports', icon: 'trophy' },
  social: { label: 'Social Impact', icon: 'handshake' },
  professional: { label: 'Professional', icon: 'briefcase' },
  literary: { label: 'Literary', icon: 'feather' },
  wellness: { label: 'Eco & Wellness', icon: 'sprout' },
};
export const categoryOf = (c?: string) => CLUB_CATEGORY[c ?? ''] ?? CLUB_CATEGORY.social;
export const iconOf = (icon?: string, category?: string): LucideIcon =>
  CLUB_ICONS[icon ?? ''] ?? CLUB_ICONS[categoryOf(category).icon];

/* ── Crest ───────────────────────────────────────────────────────────────── */

const SHIELD = 'M50 3 L92 17 V58 C92 86 73 104 50 113 C27 104 8 86 8 58 V17 Z';

/**
 * A heraldic crest in the club's colours: bevelled rim, gloss, an icon, and a
 * light sweep. `live` adds a slow halo and float for hero moments.
 */
export function ClubCrest({
  icon,
  category,
  theme,
  size = 64,
  live,
  gold,
  className,
  style,
}: {
  icon?: string;
  category?: string;
  theme?: string;
  size?: number;
  live?: boolean;
  gold?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const id = useId().replace(/:/g, '');
  const th = themeOf(theme);
  const Icon = iconOf(icon, category);
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center',
        live && 'animate-[club-float_5s_ease-in-out_infinite]',
        className
      )}
      style={{ width: size, height: size * 1.13, ...style }}
    >
      {live && (
        <>
          <span
            className="absolute -inset-[35%] rounded-full opacity-70 blur-xl animate-[club-spin_9s_linear_infinite]"
            style={{
              background: `conic-gradient(from 0deg, transparent, ${th.c2}, transparent 40%, ${th.c1}, transparent 75%)`,
            }}
          />
          <span
            className="absolute -inset-[18%] rounded-full border border-white/25 animate-[club-spin-rev_14s_linear_infinite]"
            style={{ borderStyle: 'dashed' }}
          />
        </>
      )}
      <svg
        viewBox="0 0 100 116"
        className="relative h-full w-full drop-shadow-[0_10px_18px_rgba(5,40,110,0.35)]"
      >
        <defs>
          <linearGradient id={`f${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={th.c2} />
            <stop offset="1" stopColor={th.c1} />
          </linearGradient>
          <linearGradient id={`r${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0"
              stopColor={gold ? '#fde68a' : '#ffffff'}
              stopOpacity={gold ? 1 : 0.9}
            />
            <stop
              offset="1"
              stopColor={gold ? '#b45309' : '#ffffff'}
              stopOpacity={gold ? 1 : 0.25}
            />
          </linearGradient>
          <linearGradient id={`s${id}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0.75" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <clipPath id={`c${id}`}>
            <path d={SHIELD} />
          </clipPath>
        </defs>
        <path d={SHIELD} fill={`url(#f${id})`} stroke={`url(#r${id})`} strokeWidth={gold ? 4 : 3} />
        <path
          d={SHIELD}
          fill="none"
          stroke="#fff"
          strokeOpacity="0.35"
          strokeWidth="1.2"
          transform="translate(7 8) scale(0.86)"
        />
        <g clipPath={`url(#c${id})`}>
          <ellipse cx="50" cy="8" rx="58" ry="40" fill="#fff" opacity="0.18" />
          <rect
            x="-40"
            y="-10"
            width="40"
            height="140"
            fill={`url(#s${id})`}
            className="animate-[club-shine_4.5s_ease-in-out_infinite]"
            style={{ animationDelay: `${(id.length % 7) * 0.4}s` }}
          />
        </g>
      </svg>
      <Icon
        className="absolute text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.35)]"
        style={{ width: size * 0.42, height: size * 0.42, top: size * 0.3 }}
        strokeWidth={2.1}
      />
    </span>
  );
}

/* ── Faces ───────────────────────────────────────────────────────────────── */

export function Faces({
  faces,
  size = 28,
  fan,
}: {
  faces: Array<{ name: string; photo?: string | null }>;
  size?: number;
  fan?: boolean;
}) {
  return (
    <span className="flex">
      {faces.slice(0, 5).map((f, i) => (
        <span
          key={i}
          title={f.name}
          className="relative rounded-full ring-2 ring-card transition-all duration-300"
          style={{
            width: size,
            height: size,
            marginLeft: i ? (fan ? -4 : -size * 0.35) : 0,
            zIndex: 10 - i,
          }}
        >
          {f.photo ? (
            <img src={f.photo} alt="" className="h-full w-full rounded-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
              {f.name.slice(0, 1)}
            </span>
          )}
        </span>
      ))}
    </span>
  );
}

/* ── Confetti ────────────────────────────────────────────────────────────── */

export function Confetti({ count = 26, colors }: { count?: number; colors: string[] }) {
  const bits = useRef(
    Array.from({ length: count }, (_, i) => {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const d = 70 + Math.random() * 90;
      return {
        x: `${Math.cos(a) * d}px`,
        y: `${Math.sin(a) * d - 30}px`,
        r: `${Math.random() * 720 - 360}deg`,
        c: colors[i % colors.length],
        w: 5 + Math.random() * 5,
        delay: Math.random() * 0.12,
      };
    })
  ).current;
  return (
    <span className="pointer-events-none absolute left-1/2 top-1/2 z-50">
      {bits.map((b, i) => (
        <span
          key={i}
          className="absolute rounded-[2px] animate-[club-confetti_0.95s_cubic-bezier(.2,.7,.3,1)_forwards]"
          style={
            {
              '--x': b.x,
              '--y': b.y,
              '--r': b.r,
              width: b.w,
              height: b.w * 0.45,
              background: b.c,
              animationDelay: `${b.delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}

/* ── Scroll reveal ───────────────────────────────────────────────────────── */

export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => e.isIntersecting && (setOn(true), io.disconnect()),
      { threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={cn(
        on ? 'animate-[club-fade-up_0.7s_cubic-bezier(.2,.8,.2,1)_both]' : 'opacity-0',
        className
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ── 3D tilt ─────────────────────────────────────────────────────────────── */

export function Tilt({
  children,
  className,
  max = 7,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateX(${-y * max}deg) rotateY(${x * max}deg) translateY(-4px)`;
    el.style.setProperty('--mx', `${(x + 0.5) * 100}%`);
    el.style.setProperty('--my', `${(y + 0.5) * 100}%`);
  };
  const leave = () => {
    if (ref.current) ref.current.style.transform = '';
  };
  return (
    <div
      ref={ref}
      onMouseMove={move}
      onMouseLeave={leave}
      className={cn('transition-transform duration-200 ease-out will-change-transform', className)}
    >
      {children}
    </div>
  );
}

/** Small "you're in" checkmark burst used by Join. */
export function useConfettiColors(theme?: string) {
  const th = themeOf(theme);
  return [th.c1, th.c2, '#fde047', '#0abfff', '#ffffff'];
}

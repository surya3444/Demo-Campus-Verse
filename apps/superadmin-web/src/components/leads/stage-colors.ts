import type { StageColor } from '@/lib/api';

/**
 * Single source of truth for stage colors.
 *
 * Class strings are kept literal so Tailwind's JIT picks them up at build time.
 * Adding a new color here means also adding it to ALLOWED_COLORS in the API
 * service so the client can persist it.
 */
export const STAGE_COLOR_MAP: Record<
  StageColor,
  {
    /** Pill / chip background — soft tint with darker text. */
    chip: string;
    /** Compact 24px swatch used in the color picker. */
    swatch: string;
    /** Used by the existing settings dialog header pill. */
    header: string;
    /** Saturated dot used next to a column label. */
    dot: string;
    /** 3-px top accent bar for the column (saturated). */
    accent: string;
    /** 2-px left rail on lead cards (saturated). */
    rail: string;
    /** Soft tinted background for the column drop area. */
    softBg: string;
    /** Tint shown when a card is being dragged over the column. */
    hoverBg: string;
    /** Avatar circle background (soft) and matching text class. */
    avatarBg: string;
    avatarText: string;
    /** Empty-state icon tint — uses the same hue at 400. */
    iconTint: string;
  }
> = {
  slate: {
    chip: 'bg-slate-100 text-slate-700',
    swatch: 'bg-slate-300 ring-slate-500',
    header: 'bg-slate-100 text-slate-700 border-slate-200',
    dot: 'bg-slate-500',
    accent: 'bg-slate-400',
    rail: 'bg-slate-400',
    softBg: 'bg-slate-50/60',
    hoverBg: 'bg-slate-100/80',
    avatarBg: 'bg-slate-100',
    avatarText: 'text-slate-700',
    iconTint: 'text-slate-400',
  },
  blue: {
    chip: 'bg-blue-100 text-blue-700',
    swatch: 'bg-blue-300 ring-blue-500',
    header: 'bg-blue-50 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
    accent: 'bg-blue-500',
    rail: 'bg-blue-500',
    softBg: 'bg-blue-50/40',
    hoverBg: 'bg-blue-100/60',
    avatarBg: 'bg-blue-100',
    avatarText: 'text-blue-700',
    iconTint: 'text-blue-400',
  },
  amber: {
    chip: 'bg-amber-100 text-amber-700',
    swatch: 'bg-amber-300 ring-amber-500',
    header: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
    accent: 'bg-amber-500',
    rail: 'bg-amber-500',
    softBg: 'bg-amber-50/40',
    hoverBg: 'bg-amber-100/60',
    avatarBg: 'bg-amber-100',
    avatarText: 'text-amber-700',
    iconTint: 'text-amber-400',
  },
  violet: {
    chip: 'bg-violet-100 text-violet-700',
    swatch: 'bg-violet-300 ring-violet-500',
    header: 'bg-violet-50 text-violet-700 border-violet-200',
    dot: 'bg-violet-500',
    accent: 'bg-violet-500',
    rail: 'bg-violet-500',
    softBg: 'bg-violet-50/40',
    hoverBg: 'bg-violet-100/60',
    avatarBg: 'bg-violet-100',
    avatarText: 'text-violet-700',
    iconTint: 'text-violet-400',
  },
  emerald: {
    chip: 'bg-emerald-100 text-emerald-700',
    swatch: 'bg-emerald-300 ring-emerald-500',
    header: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
    accent: 'bg-emerald-500',
    rail: 'bg-emerald-500',
    softBg: 'bg-emerald-50/40',
    hoverBg: 'bg-emerald-100/60',
    avatarBg: 'bg-emerald-100',
    avatarText: 'text-emerald-700',
    iconTint: 'text-emerald-400',
  },
  rose: {
    chip: 'bg-rose-100 text-rose-700',
    swatch: 'bg-rose-300 ring-rose-500',
    header: 'bg-rose-50 text-rose-700 border-rose-200',
    dot: 'bg-rose-500',
    accent: 'bg-rose-500',
    rail: 'bg-rose-500',
    softBg: 'bg-rose-50/40',
    hoverBg: 'bg-rose-100/60',
    avatarBg: 'bg-rose-100',
    avatarText: 'text-rose-700',
    iconTint: 'text-rose-400',
  },
  sky: {
    chip: 'bg-sky-100 text-sky-700',
    swatch: 'bg-sky-300 ring-sky-500',
    header: 'bg-sky-50 text-sky-700 border-sky-200',
    dot: 'bg-sky-500',
    accent: 'bg-sky-500',
    rail: 'bg-sky-500',
    softBg: 'bg-sky-50/40',
    hoverBg: 'bg-sky-100/60',
    avatarBg: 'bg-sky-100',
    avatarText: 'text-sky-700',
    iconTint: 'text-sky-400',
  },
  fuchsia: {
    chip: 'bg-fuchsia-100 text-fuchsia-700',
    swatch: 'bg-fuchsia-300 ring-fuchsia-500',
    header: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
    dot: 'bg-fuchsia-500',
    accent: 'bg-fuchsia-500',
    rail: 'bg-fuchsia-500',
    softBg: 'bg-fuchsia-50/40',
    hoverBg: 'bg-fuchsia-100/60',
    avatarBg: 'bg-fuchsia-100',
    avatarText: 'text-fuchsia-700',
    iconTint: 'text-fuchsia-400',
  },
  lime: {
    chip: 'bg-lime-100 text-lime-700',
    swatch: 'bg-lime-300 ring-lime-500',
    header: 'bg-lime-50 text-lime-700 border-lime-200',
    dot: 'bg-lime-500',
    accent: 'bg-lime-500',
    rail: 'bg-lime-500',
    softBg: 'bg-lime-50/40',
    hoverBg: 'bg-lime-100/60',
    avatarBg: 'bg-lime-100',
    avatarText: 'text-lime-700',
    iconTint: 'text-lime-400',
  },
  orange: {
    chip: 'bg-orange-100 text-orange-700',
    swatch: 'bg-orange-300 ring-orange-500',
    header: 'bg-orange-50 text-orange-700 border-orange-200',
    dot: 'bg-orange-500',
    accent: 'bg-orange-500',
    rail: 'bg-orange-500',
    softBg: 'bg-orange-50/40',
    hoverBg: 'bg-orange-100/60',
    avatarBg: 'bg-orange-100',
    avatarText: 'text-orange-700',
    iconTint: 'text-orange-400',
  },
  teal: {
    chip: 'bg-teal-100 text-teal-700',
    swatch: 'bg-teal-300 ring-teal-500',
    header: 'bg-teal-50 text-teal-700 border-teal-200',
    dot: 'bg-teal-500',
    accent: 'bg-teal-500',
    rail: 'bg-teal-500',
    softBg: 'bg-teal-50/40',
    hoverBg: 'bg-teal-100/60',
    avatarBg: 'bg-teal-100',
    avatarText: 'text-teal-700',
    iconTint: 'text-teal-400',
  },
};

export const STAGE_COLOR_OPTIONS: StageColor[] = [
  'slate',
  'blue',
  'sky',
  'teal',
  'emerald',
  'lime',
  'amber',
  'orange',
  'rose',
  'fuchsia',
  'violet',
];

export const ORPHAN_HEADER_CLASSES = 'bg-zinc-100 text-zinc-700 border-zinc-300 border-dashed';

'use client';

import { useMemo, type CSSProperties, type ReactNode } from 'react';
import qrcode from 'qrcode-generator';
import type { IdCardDesignConfig, IdCardField } from '@campus-verse/shared/schemas';
import { cn } from '@/lib/utils';

/**
 * Student ID cards drawn at true CR80 size (85.6 × 54 mm) in mm units, so the
 * same markup previews on screen (scaled) and prints to exact size.
 */

export type { IdCardDesignConfig, IdCardField };

export interface CardStudent {
  id: string;
  name: string;
  photo?: string;
  rollNumber?: string;
  admissionNumber?: string;
  program?: string;
  section?: string;
  dateOfBirth?: string;
  bloodGroup?: string;
  phone?: string;
  guardianPhone?: string;
}

export interface CardOrg {
  name: string;
  campus?: string;
  address?: string;
  phone?: string;
  email?: string;
  logo?: string;
}

export const CARD_MM = { long: 85.6, short: 54 };

export const FIELD_LABEL: Record<IdCardField, string> = {
  rollNumber: 'Roll No.',
  admissionNumber: 'Adm. No.',
  program: 'Program',
  section: 'Section',
  dateOfBirth: 'Date of birth',
  bloodGroup: 'Blood group',
  phone: 'Phone',
  guardianPhone: 'Guardian',
  validTill: 'Valid till',
};

const BACK_DEFAULT = {
  enabled: true,
  instructions:
    'This card must be carried at all times on campus.\nShow it on request to security and staff.\nLoss must be reported to the office immediately.\nThe card is not transferable.',
  showAddress: true,
  showEmergency: true,
};

const BASE_FIELDS: IdCardField[] = [
  'program',
  'section',
  'rollNumber',
  'admissionNumber',
  'bloodGroup',
  'validTill',
];

export const PRESETS: Array<{
  key: IdCardDesignConfig['template'];
  name: string;
  blurb: string;
  config: IdCardDesignConfig;
}> = [
  {
    key: 'classic',
    name: 'Classic Portrait',
    blurb: 'Colour header, centred photo, gold accent — the traditional campus card.',
    config: {
      template: 'classic',
      orientation: 'portrait',
      colors: { primary: '#0B2A5B', accent: '#E3A72F' },
      photoShape: 'rounded',
      fields: BASE_FIELDS,
      showQr: true,
      signatureLabel: 'Principal',
      back: BACK_DEFAULT,
    },
  },
  {
    key: 'modern',
    name: 'Modern Wave',
    blurb: 'Curved colour header, circular photo and a bold ID band.',
    config: {
      template: 'modern',
      orientation: 'portrait',
      colors: { primary: '#0F4C81', accent: '#14B8C7' },
      photoShape: 'circle',
      fields: ['program', 'section', 'rollNumber', 'bloodGroup', 'phone', 'validTill'],
      showQr: true,
      signatureLabel: 'Registrar',
      back: BACK_DEFAULT,
    },
  },
  {
    key: 'minimal',
    name: 'Executive Minimal',
    blurb: 'Landscape, white and understated — reads like a corporate badge.',
    config: {
      template: 'minimal',
      orientation: 'landscape',
      colors: { primary: '#111827', accent: '#2563EB' },
      photoShape: 'rounded',
      fields: ['program', 'section', 'rollNumber', 'admissionNumber', 'bloodGroup', 'validTill'],
      showQr: true,
      signatureLabel: 'Dean of Students',
      back: BACK_DEFAULT,
    },
  },
  {
    key: 'campus',
    name: 'Campus Landscape',
    blurb: 'Colour side panel with the photo, details on the right.',
    config: {
      template: 'campus',
      orientation: 'landscape',
      colors: { primary: '#7A1F3D', accent: '#E0B252' },
      photoShape: 'rounded',
      fields: ['program', 'section', 'rollNumber', 'dateOfBirth', 'bloodGroup', 'validTill'],
      showQr: true,
      signatureLabel: 'Principal',
      back: BACK_DEFAULT,
    },
  },
];

export const SAMPLE_STUDENT: CardStudent = {
  id: 'sample',
  name: 'Aarav Sharma',
  rollNumber: '21',
  admissionNumber: 'ADM-2026-0142',
  program: 'B.Tech CSE · Year 2',
  section: 'A',
  dateOfBirth: '2007-08-14',
  bloodGroup: 'O+',
  phone: '98450 12345',
  guardianPhone: '98450 67890',
};

const initials = (s: string) =>
  s
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

const fmtDate = (v?: string) =>
  v
    ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';

function fieldValue(f: IdCardField, s: CardStudent, validTill?: string) {
  switch (f) {
    case 'dateOfBirth':
      return fmtDate(s.dateOfBirth);
    case 'validTill':
      return fmtDate(validTill);
    default:
      return s[f] ?? '';
  }
}

export function Qr({ text, size, className }: { text: string; size: string; className?: string }) {
  const { d, n } = useMemo(() => {
    const q = qrcode(0, 'M');
    q.addData(text);
    q.make();
    const count = q.getModuleCount();
    let path = '';
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) if (q.isDark(r, c)) path += `M${c},${r}h1v1h-1z`;
    }
    return { d: path, n: count };
  }, [text]);
  return (
    <svg
      viewBox={`-1 -1 ${n + 2} ${n + 2}`}
      style={{ width: size, height: size }}
      shapeRendering="crispEdges"
      className={cn('shrink-0 bg-white', className)}
    >
      <path d={d} fill="#111" />
    </svg>
  );
}

function Logo({ org, size, light }: { org: CardOrg; size: string; light?: boolean }) {
  if (org.logo) {
    return (
      <img
        src={org.logo}
        alt=""
        style={{ width: size, height: size }}
        className={cn('shrink-0 rounded-[1mm] object-contain', light && 'bg-white p-[0.5mm]')}
      />
    );
  }
  return (
    <span
      style={{ width: size, height: size, fontSize: `calc(${size} * 0.38)` }}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-bold',
        light ? 'bg-white/95 text-[var(--c1)]' : 'bg-[var(--c1)] text-white'
      )}
    >
      {initials(org.name) || 'C'}
    </span>
  );
}

function Photo({
  s,
  w,
  h,
  shape,
  className,
}: {
  s: CardStudent;
  w: string;
  h: string;
  shape: 'rounded' | 'circle';
  className?: string;
}) {
  const radius = shape === 'circle' ? '9999px' : '1.6mm';
  return s.photo ? (
    <img
      src={s.photo}
      alt=""
      style={{ width: w, height: shape === 'circle' ? w : h, borderRadius: radius }}
      className={cn('shrink-0 object-cover', className)}
    />
  ) : (
    <span
      style={{
        width: w,
        height: shape === 'circle' ? w : h,
        borderRadius: radius,
        fontSize: `calc(${w} * 0.32)`,
      }}
      className={cn(
        'flex shrink-0 items-center justify-center bg-gradient-to-br from-slate-100 to-slate-300 font-semibold text-slate-500',
        className
      )}
    >
      {initials(s.name)}
    </span>
  );
}

function Signature({ d, align = 'right' }: { d: IdCardDesignConfig; align?: 'left' | 'right' }) {
  return (
    <div className={cn('flex min-w-0 flex-col', align === 'right' ? 'items-end' : 'items-start')}>
      {d.signatureUrl ? (
        <img src={d.signatureUrl} alt="" className="h-[5mm] max-w-[18mm] object-contain" />
      ) : (
        <span className="h-[5mm] font-serif text-[9px] italic leading-[5mm] text-slate-400">
          Signature
        </span>
      )}
      <span className="mt-[0.4mm] w-[16mm] border-t border-slate-400" />
      <span className="mt-[0.3mm] text-[5px] font-semibold uppercase tracking-wider text-slate-500">
        {d.signatureLabel || 'Authorised signatory'}
      </span>
    </div>
  );
}

function Fields({
  d,
  s,
  validTill,
  cols = 2,
  dark,
}: {
  d: IdCardDesignConfig;
  s: CardStudent;
  validTill?: string;
  cols?: 1 | 2;
  dark?: boolean;
}) {
  const rows = d.fields
    .filter((f) => f !== 'program' && f !== 'section')
    .map((f) => ({ f, v: fieldValue(f, s, validTill) }))
    .filter((r) => r.v);
  return (
    <div
      className={cn('grid gap-x-[2mm] gap-y-[0.9mm]', cols === 2 ? 'grid-cols-2' : 'grid-cols-1')}
    >
      {rows.map(({ f, v }) => (
        <div key={f} className="min-w-0">
          <p
            className={cn(
              'text-[4.8px] font-semibold uppercase tracking-[0.08em]',
              dark ? 'text-white/60' : 'text-slate-400'
            )}
          >
            {FIELD_LABEL[f]}
          </p>
          <p
            className={cn(
              'truncate text-[6.6px] font-semibold leading-tight',
              dark ? 'text-white' : 'text-slate-800',
              f === 'bloodGroup' && !dark && 'text-red-600'
            )}
          >
            {v}
          </p>
        </div>
      ))}
    </div>
  );
}

/** "B.Tech CSE · Year 2 · Section A" under the name, when those fields are on. */
function Course({
  d,
  s,
  className,
}: {
  d: IdCardDesignConfig;
  s: CardStudent;
  className?: string;
}) {
  const text = [
    d.fields.includes('program') && s.program,
    d.fields.includes('section') && s.section && `Section ${s.section}`,
  ]
    .filter(Boolean)
    .join(' · ');
  return text ? (
    <p
      className={cn('line-clamp-2 text-[5.8px] font-medium leading-snug text-slate-500', className)}
    >
      {text}
    </p>
  ) : null;
}

const qrText = (s: CardStudent, org: CardOrg) =>
  `STUDENT|${org.name}|${s.admissionNumber || s.id}|${s.name}`;

/** Fixed-size card shell: CR80, colours as CSS vars, prints in colour. */
function Shell({
  d,
  children,
  className,
}: {
  d: IdCardDesignConfig;
  children: ReactNode;
  className?: string;
}) {
  const portrait = d.orientation === 'portrait';
  return (
    <div
      className={cn(
        'idcard relative overflow-hidden rounded-[3mm] bg-white text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.08),0_8px_24px_-12px_rgba(0,0,0,0.35)] [print-color-adjust:exact] [-webkit-print-color-adjust:exact]',
        className
      )}
      style={
        {
          width: `${portrait ? CARD_MM.short : CARD_MM.long}mm`,
          height: `${portrait ? CARD_MM.long : CARD_MM.short}mm`,
          '--c1': d.colors.primary,
          '--c2': d.colors.accent,
          fontFamily: 'var(--font-sans, ui-sans-serif, system-ui)',
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}

export function IdCardFront({
  design: d,
  student: s,
  org,
  validTill,
}: {
  design: IdCardDesignConfig;
  student: CardStudent;
  org: CardOrg;
  validTill?: string;
}) {
  if (d.logoUrl) org = { ...org, logo: d.logoUrl };
  const title = d.title || org.name;
  const subtitle = d.subtitle || org.campus || '';

  if (d.template === 'modern') {
    return (
      <Shell d={d}>
        <div className="absolute inset-x-0 top-0 h-[30mm] bg-gradient-to-br from-[var(--c1)] to-[color-mix(in_srgb,var(--c1)_70%,var(--c2))]" />
        <svg
          viewBox="0 0 54 12"
          preserveAspectRatio="none"
          className="absolute left-0 top-[24mm] h-[12mm] w-full"
        >
          <path d="M0 4 C 14 12, 32 -2, 54 6 L54 12 L0 12 Z" fill="white" />
          <path d="M0 4 C 14 12, 32 -2, 54 6" fill="none" stroke="var(--c2)" strokeWidth="0.8" />
        </svg>
        <div className="relative flex items-center gap-[1.8mm] px-[3.5mm] pt-[3mm] text-white">
          <Logo org={org} size="7.5mm" light />
          <div className="min-w-0">
            <p className="truncate text-[7.2px] font-bold uppercase leading-tight tracking-wide">
              {title}
            </p>
            <p className="truncate text-[5px] text-white/75">{subtitle}</p>
          </div>
        </div>
        <div className="relative mt-[4mm] flex justify-center">
          <span className="rounded-full bg-white p-[0.7mm] shadow-md ring-[0.5mm] ring-[var(--c2)]">
            <Photo s={s} w="22mm" h="22mm" shape="circle" />
          </span>
        </div>
        <div className="relative mt-[1.6mm] px-[3.5mm] text-center">
          <p className="truncate text-[9.5px] font-bold leading-tight text-[var(--c1)]">{s.name}</p>
          <Course d={d} s={s} className="mt-[0.3mm]" />
          <p className="mt-[0.3mm] text-[5.4px] font-semibold uppercase tracking-[0.2em] text-[var(--c2)]">
            Student
          </p>
        </div>
        <div className="relative mx-[3.5mm] mt-[1.4mm] rounded-[1mm] bg-[var(--c1)] py-[0.8mm] text-center font-mono text-[6.5px] font-bold tracking-[0.15em] text-white">
          {s.admissionNumber || s.rollNumber || '—'}
        </div>
        <div className="relative mt-[1.8mm] px-[3.5mm]">
          <Fields
            d={{ ...d, fields: d.fields.filter((f) => f !== 'admissionNumber') }}
            s={s}
            validTill={validTill}
          />
        </div>
        <div className="absolute inset-x-[3.5mm] bottom-[2.6mm] flex items-end justify-between">
          <Signature d={d} align="left" />
          {d.showQr && (
            <Qr text={qrText(s, org)} size="11mm" className="rounded-[0.6mm] p-[0.3mm]" />
          )}
        </div>
        <div className="absolute inset-x-0 bottom-0 h-[1.2mm] bg-gradient-to-r from-[var(--c1)] to-[var(--c2)]" />
      </Shell>
    );
  }

  if (d.template === 'minimal') {
    return (
      <Shell d={d}>
        <div className="absolute inset-y-0 left-0 w-[1.6mm] bg-[var(--c1)]" />
        <div className="absolute inset-y-0 left-[1.6mm] w-[0.6mm] bg-[var(--c2)]" />
        <div className="flex items-center gap-[1.6mm] py-[2.6mm] pl-[5mm] pr-[3.5mm]">
          <Logo org={org} size="6.5mm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[7.2px] font-bold uppercase leading-tight tracking-wide text-[var(--c1)]">
              {title}
            </p>
            <p className="truncate text-[5px] text-slate-500">{subtitle}</p>
          </div>
          <span className="rounded-[0.8mm] border border-[var(--c2)] px-[1.2mm] py-[0.3mm] text-[4.8px] font-bold uppercase tracking-[0.18em] text-[var(--c2)]">
            Student ID
          </span>
        </div>
        <div className="mx-[3.5mm] ml-[5mm] border-t border-slate-200" />
        <div className="flex gap-[3mm] py-[2.4mm] pl-[5mm] pr-[3.5mm]">
          <Photo s={s} w="19mm" h="23.5mm" shape={d.photoShape} className="ring-1 ring-slate-200" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[9.5px] font-bold leading-tight text-slate-900">{s.name}</p>
            <Course d={d} s={s} className="mt-[0.3mm]" />
            <div className="mt-[1.4mm]">
              <Fields d={d} s={s} validTill={validTill} />
            </div>
          </div>
          {d.showQr && <Qr text={qrText(s, org)} size="12.5mm" className="self-start" />}
        </div>
        <div className="absolute bottom-[2mm] left-[5mm] right-[3.5mm] flex items-end justify-between">
          <span className="text-[4.8px] text-slate-400">
            {org.phone ? `Office ${org.phone}` : ''}
          </span>
          <Signature d={d} />
        </div>
      </Shell>
    );
  }

  if (d.template === 'campus') {
    return (
      <Shell d={d} className="flex">
        <div className="relative flex w-[29mm] shrink-0 flex-col items-center bg-[var(--c1)] px-[2mm] pt-[3mm] text-white">
          <div className="absolute -right-[6mm] top-0 h-full w-[12mm] skew-x-[-8deg] bg-[var(--c2)] opacity-25" />
          <Logo org={org} size="8mm" light />
          <span className="relative mt-[2.4mm] rounded-[1.8mm] bg-white p-[0.6mm] shadow-md">
            <Photo s={s} w="20mm" h="24mm" shape={d.photoShape} />
          </span>
          <span className="relative mt-[1.8mm] rounded-full bg-[var(--c2)] px-[2.2mm] py-[0.4mm] text-[5px] font-bold uppercase tracking-[0.2em] text-[var(--c1)]">
            Student
          </span>
        </div>
        <div className="relative flex min-w-0 flex-1 flex-col px-[3mm] pt-[3mm]">
          <p className="truncate text-[7.2px] font-bold uppercase leading-tight tracking-wide text-[var(--c1)]">
            {title}
          </p>
          <p className="truncate text-[5px] text-slate-500">{subtitle}</p>
          <div className="mt-[1.4mm] h-[0.5mm] w-[10mm] rounded bg-[var(--c2)]" />
          <p className="mt-[1.6mm] truncate text-[9.5px] font-bold leading-tight">{s.name}</p>
          <Course d={d} s={s} className="mt-[0.3mm]" />
          <div className="mt-[1.4mm]">
            <Fields d={d} s={s} validTill={validTill} />
          </div>
          <div className="absolute bottom-[2.4mm] left-[3mm] right-[3mm] flex items-end justify-between">
            {d.showQr ? <Qr text={qrText(s, org)} size="10mm" /> : <span />}
            <Signature d={d} />
          </div>
        </div>
      </Shell>
    );
  }

  // classic
  return (
    <Shell d={d}>
      <div className="relative h-[27mm] overflow-hidden bg-[var(--c1)] text-white">
        <div className="absolute -right-[10mm] -top-[14mm] h-[30mm] w-[30mm] rounded-full bg-[var(--c2)] opacity-20" />
        <div className="absolute -left-[8mm] top-[12mm] h-[22mm] w-[22mm] rounded-full bg-white opacity-[0.06]" />
        <div className="relative flex flex-col items-center px-[3mm] pt-[2.6mm] text-center">
          <Logo org={org} size="7.5mm" light />
          <p className="mt-[1mm] line-clamp-2 text-[7px] font-bold uppercase leading-tight tracking-wide">
            {title}
          </p>
          <p className="truncate text-[5px] text-white/75">{subtitle}</p>
        </div>
      </div>
      <div className="relative -mt-[6mm] flex justify-center">
        <span className="rounded-[2mm] bg-white p-[0.7mm] shadow-md">
          <Photo s={s} w="20mm" h="24mm" shape={d.photoShape} />
        </span>
      </div>
      <div className="mt-[1.4mm] px-[3mm] text-center">
        <p className="truncate text-[9.5px] font-bold leading-tight text-[var(--c1)]">{s.name}</p>
        <Course d={d} s={s} className="mt-[0.3mm]" />
        <span className="mt-[0.6mm] inline-block rounded-full bg-[var(--c2)] px-[2.4mm] py-[0.3mm] text-[5px] font-bold uppercase tracking-[0.2em] text-[var(--c1)]">
          Student
        </span>
      </div>
      <div className="mt-[1.8mm] px-[3.5mm]">
        <Fields d={d} s={s} validTill={validTill} />
      </div>
      <div className="absolute inset-x-[3.5mm] bottom-[3.2mm] flex items-end justify-between">
        {d.showQr ? <Qr text={qrText(s, org)} size="10.5mm" /> : <span />}
        <Signature d={d} />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-[1.6mm] bg-[var(--c2)]" />
    </Shell>
  );
}

export function IdCardBack({
  design: d,
  student: s,
  org,
}: {
  design: IdCardDesignConfig;
  student: CardStudent;
  org: CardOrg;
}) {
  if (d.logoUrl) org = { ...org, logo: d.logoUrl };
  const lines = d.back.instructions
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const address = [org.name, org.campus, org.address].filter(Boolean);
  return (
    <Shell d={d} className="flex flex-col">
      <div className="flex items-center gap-[1.6mm] bg-[var(--c1)] px-[3.5mm] py-[2mm] text-white">
        <Logo org={org} size="5.5mm" light />
        <p className="truncate text-[6.4px] font-bold uppercase tracking-wide">
          {d.title || org.name}
        </p>
      </div>
      <div className="h-[0.6mm] bg-[var(--c2)]" />
      <div className="flex min-h-0 flex-1 flex-col gap-[2mm] px-[3.5mm] py-[2.4mm]">
        {lines.length > 0 && (
          <div>
            <p className="text-[5px] font-bold uppercase tracking-[0.14em] text-[var(--c1)]">
              Instructions
            </p>
            <ul className="mt-[0.6mm] space-y-[0.4mm]">
              {lines.map((l) => (
                <li key={l} className="flex gap-[1mm] text-[5.4px] leading-snug text-slate-600">
                  <span className="mt-[0.9mm] h-[0.8mm] w-[0.8mm] shrink-0 rounded-full bg-[var(--c2)]" />
                  {l}
                </li>
              ))}
            </ul>
          </div>
        )}
        {d.back.showEmergency && (s.guardianPhone || s.bloodGroup) && (
          <div className="flex gap-[2mm] rounded-[1mm] bg-slate-50 px-[1.8mm] py-[1.2mm]">
            {s.guardianPhone && (
              <div>
                <p className="text-[4.6px] font-semibold uppercase tracking-wider text-slate-400">
                  In emergency call
                </p>
                <p className="text-[6.4px] font-bold text-slate-800">{s.guardianPhone}</p>
              </div>
            )}
            {s.bloodGroup && (
              <div>
                <p className="text-[4.6px] font-semibold uppercase tracking-wider text-slate-400">
                  Blood group
                </p>
                <p className="text-[6.4px] font-bold text-red-600">{s.bloodGroup}</p>
              </div>
            )}
          </div>
        )}
        {d.orientation === 'portrait' && (
          <div className="my-auto flex flex-col items-center gap-[1mm] text-center">
            {d.showQr && (
              <Qr
                text={qrText(s, org)}
                size="16mm"
                className="rounded-[0.8mm] p-[0.4mm] ring-1 ring-slate-200"
              />
            )}
            <p className="text-[4.6px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Card no.
            </p>
            <p className="font-mono text-[7px] font-bold tracking-[0.12em] text-[var(--c1)]">
              {s.admissionNumber || s.rollNumber || s.id.slice(-8).toUpperCase()}
            </p>
          </div>
        )}
        {d.back.showAddress && (
          <div className="mt-auto">
            <p className="text-[4.6px] font-semibold uppercase tracking-wider text-slate-400">
              If found, please return to
            </p>
            <p className="text-[5.6px] font-semibold leading-snug text-slate-700">
              {address.join(', ')}
            </p>
            {(org.phone || org.email) && (
              <p className="text-[5.2px] text-slate-500">
                {[org.phone, org.email].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        )}
      </div>
      <div className="h-[1.2mm] bg-gradient-to-r from-[var(--c1)] to-[var(--c2)]" />
    </Shell>
  );
}

/** Scales a true-size card for on-screen use while keeping layout box correct. */
export function CardScale({
  design,
  scale,
  children,
}: {
  design: IdCardDesignConfig;
  scale: number;
  children: ReactNode;
}) {
  const portrait = design.orientation === 'portrait';
  const w = (portrait ? CARD_MM.short : CARD_MM.long) * scale;
  const h = (portrait ? CARD_MM.long : CARD_MM.short) * scale;
  return (
    <div style={{ width: `${w}mm`, height: `${h}mm` }} className="relative shrink-0">
      <div
        style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
        className="absolute left-0 top-0"
      >
        {children}
      </div>
    </div>
  );
}

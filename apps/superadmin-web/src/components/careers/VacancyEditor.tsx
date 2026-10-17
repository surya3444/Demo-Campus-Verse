'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Save,
  Send,
  Pencil,
  Briefcase,
  Building2,
  MapPin,
  Tag as TagIcon,
  Clock,
  IndianRupee,
  Feather,
  Type,
  TextQuote,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  vacanciesApi,
  type Vacancy,
  type VacancyInput,
  type VacancyStatus,
  type EmploymentType,
  type WorkMode,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const RichTextEditor = dynamic(
  () => import('@/components/ui/rich-text-editor').then((m) => m.RichTextEditor),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[420px] w-full rounded-xl" />,
  }
);

interface Props {
  vacancy?: Vacancy;
}

const stripHtml = (html: string) =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const EMPLOYMENT_OPTIONS: { value: EmploymentType; label: string }[] = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
];

const WORK_MODE_OPTIONS: { value: WorkMode; label: string }[] = [
  { value: 'onsite', label: 'Onsite' },
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
];

const DEPARTMENT_OPTIONS = [
  'Engineering',
  'Product',
  'Design',
  'Sales',
  'Marketing',
  'Customer Success',
  'Operations',
  'People & Talent',
  'Finance',
  'Founder’s Office',
];

const SALARY_RANGE_OPTIONS = [
  '₹3–6 LPA',
  '₹6–10 LPA',
  '₹10–15 LPA',
  '₹15–22 LPA',
  '₹22–32 LPA',
  '₹32–45 LPA',
  '₹45–60 LPA',
  '₹60 LPA+',
  'Competitive',
  'Stipend (Internship)',
  'Unpaid (Internship)',
];

const CATEGORY_OPTIONS = [
  'Software Engineering',
  'Frontend Engineering',
  'Backend Engineering',
  'Mobile Engineering',
  'DevOps & Infrastructure',
  'QA & Test Engineering',
  'Data & ML',
  'Product Management',
  'Product Design',
  'UX Research',
  'Sales & Business Development',
  'Marketing & Growth',
  'Content & Communications',
  'Customer Success',
  'Implementation & Onboarding',
  'Operations',
  'HR & Recruiting',
  'Finance & Accounting',
  'Internship',
];

export function VacancyEditor({ vacancy }: Props) {
  const router = useRouter();
  const isEdit = !!vacancy;
  const titleRef = useRef<HTMLTextAreaElement>(null);

  const [title, setTitle] = useState(vacancy?.title ?? '');
  const [department, setDepartment] = useState(vacancy?.department ?? '');
  const [category, setCategory] = useState(vacancy?.category ?? '');
  const [location, setLocation] = useState(vacancy?.location ?? '');
  const [employmentType, setEmploymentType] = useState<EmploymentType>(
    vacancy?.employmentType ?? 'full_time'
  );
  const [workMode, setWorkMode] = useState<WorkMode>(vacancy?.workMode ?? 'onsite');
  const [experience, setExperience] = useState(vacancy?.experience ?? '');
  const [salaryRange, setSalaryRange] = useState(vacancy?.salaryRange ?? '');
  const [hideSalary, setHideSalary] = useState(vacancy?.hideSalary ?? false);
  const [shortDescription, setShortDescription] = useState(vacancy?.shortDescription ?? '');
  const [description, setDescription] = useState(vacancy?.description ?? '');
  const [saving, setSaving] = useState<VacancyStatus | null>(null);

  const plainText = stripHtml(description);
  const wordCount = plainText ? plainText.split(/\s+/).length : 0;
  const isPublished = vacancy?.status === 'published';
  const isClosed = vacancy?.status === 'closed';

  const growTitle = () => {
    const el = titleRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  };
  useEffect(growTitle, []);

  const buildInput = (status: VacancyStatus): VacancyInput => ({
    title: title.trim(),
    department: department.trim() || 'General',
    category: category.trim() || 'General',
    location: location.trim() || 'Visakhapatnam, India',
    employmentType,
    workMode,
    experience: experience.trim() || undefined,
    salaryRange: salaryRange.trim() || undefined,
    hideSalary,
    shortDescription: shortDescription.trim() || undefined,
    description,
    status,
  });

  const save = async (status: VacancyStatus) => {
    if (!title.trim()) return toast.error('A title is required');
    if (!plainText) return toast.error('Write a job description before saving');
    setSaving(status);
    try {
      if (isEdit) {
        await vacanciesApi.update(vacancy!.id, buildInput(status));
      } else {
        await vacanciesApi.create(buildInput(status));
      }
      toast.success(
        status === 'published' ? 'Published' : status === 'closed' ? 'Closed' : 'Saved'
      );
      router.push('/careers/vacancies');
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save vacancy');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="relative min-h-full pb-28">
      {/* Atmospheric backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-6 -top-6 z-0 h-[540px] md:-inset-x-8 md:-top-8"
        style={{
          background:
            'radial-gradient(ellipse 48% 70% at 18% 0%, hsl(var(--primary) / 0.10), transparent 70%), radial-gradient(ellipse 42% 60% at 86% 6%, hsl(var(--brand-cyan) / 0.11), transparent 72%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-6 -top-6 z-0 h-[440px] opacity-[0.5] md:-inset-x-8 md:-top-8"
        style={{
          backgroundImage: 'radial-gradient(hsl(var(--primary) / 0.10) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          maskImage: 'radial-gradient(ellipse 80% 75% at 50% 8%, black 35%, transparent 82%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 75% at 50% 8%, black 35%, transparent 82%)',
        }}
      />

      {/* Floating header island */}
      <header className="sticky top-[72px] z-30 mx-auto mb-9 w-full max-w-[940px] lg:top-5">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card/80 px-2.5 py-2 shadow-[0_8px_30px_-12px_rgb(4_38_109_/_0.20)] backdrop-blur-xl">
          <div className="flex items-center gap-1.5">
            <Link
              href="/careers/vacancies"
              className="group inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
              <span className="hidden sm:inline">Vacancies</span>
            </Link>
            <span className="h-5 w-px bg-border" />
            <span className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm">
              <span className="relative flex h-2 w-2">
                {!isPublished && !isClosed && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(var(--warning))] opacity-60" />
                )}
                <span
                  className={cn(
                    'relative inline-flex h-2 w-2 rounded-full',
                    isPublished
                      ? 'bg-[hsl(var(--success))]'
                      : isClosed
                        ? 'bg-muted-foreground'
                        : 'bg-[hsl(var(--warning))]'
                  )}
                />
              </span>
              <span className="font-medium text-foreground">
                {isEdit
                  ? isPublished
                    ? 'Published'
                    : isClosed
                      ? 'Closed'
                      : 'Draft'
                  : 'New vacancy'}
              </span>
              <span className="hidden text-muted-foreground/60 tabular-nums md:inline">
                · {wordCount.toLocaleString()} {wordCount === 1 ? 'word' : 'words'}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isPublished && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => save('closed')}
                loading={saving === 'closed'}
                disabled={saving !== null}
                className="rounded-xl text-muted-foreground"
              >
                <Lock className="h-4 w-4" />
                <span className="hidden sm:inline">Close</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => save('draft')}
              loading={saving === 'draft'}
              disabled={saving !== null}
              className="rounded-xl"
            >
              <Save className="h-4 w-4" />
              <span className="hidden sm:inline">Save draft</span>
            </Button>
            <Button
              size="sm"
              onClick={() => save('published')}
              loading={saving === 'published'}
              disabled={saving !== null}
              className="rounded-xl px-4"
            >
              <Send className="h-4 w-4" />
              {isPublished ? 'Update' : 'Publish'}
            </Button>
          </div>
        </div>
      </header>

      {/* Writing sheet */}
      <article className="relative z-10 mx-auto w-full max-w-[940px] overflow-hidden rounded-[26px] border border-border bg-card shadow-[0_24px_60px_-24px_rgb(4_38_109_/_0.18)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

        <div className="px-6 py-11 sm:px-10 md:px-16 md:py-14">
          {/* Eyebrow */}
          <div className="animate-fade-up mb-3.5 flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            <Feather className="h-3 w-3 text-[hsl(var(--brand-cyan))]" />
            {isEdit ? 'Editing vacancy' : 'New vacancy'}
          </div>

          {/* Title */}
          <div
            className="group animate-fade-up flex items-start gap-3"
            style={{ animationDelay: '0.04s' }}
          >
            <textarea
              ref={titleRef}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                growTitle();
              }}
              rows={1}
              placeholder="Role title (e.g. Senior Backend Engineer)"
              className="w-full resize-none overflow-hidden bg-transparent font-display text-[2.5rem] font-bold leading-[1.1] tracking-tight text-foreground placeholder:text-muted-foreground/30 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => titleRef.current?.focus()}
              title="Edit title"
              className="mt-3 shrink-0 rounded-lg p-1.5 text-muted-foreground/40 opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </div>

          {/* Chips */}
          <div
            className="animate-fade-up mt-5 flex flex-wrap items-center gap-2.5"
            style={{ animationDelay: '0.08s' }}
          >
            <ChipCombobox
              icon={Building2}
              value={department}
              onChange={setDepartment}
              placeholder="Department"
              suggestions={DEPARTMENT_OPTIONS}
            />
            <ChipCombobox
              icon={TagIcon}
              value={category}
              onChange={setCategory}
              placeholder="Category"
              suggestions={CATEGORY_OPTIONS}
            />
            <ChipInput
              icon={MapPin}
              value={location}
              onChange={setLocation}
              placeholder="Location"
            />
            <ChipSelect
              icon={Briefcase}
              value={employmentType}
              onChange={(v) => setEmploymentType(v as EmploymentType)}
              options={EMPLOYMENT_OPTIONS}
            />
            <ChipSelect
              icon={MapPin}
              value={workMode}
              onChange={(v) => setWorkMode(v as WorkMode)}
              options={WORK_MODE_OPTIONS}
            />
            <ChipInput
              icon={Clock}
              value={experience}
              onChange={setExperience}
              placeholder="Experience (e.g. 3–5 yrs)"
            />
            <ChipCombobox
              icon={IndianRupee}
              value={salaryRange}
              onChange={setSalaryRange}
              placeholder="Salary range"
              suggestions={SALARY_RANGE_OPTIONS}
            />
            <button
              type="button"
              onClick={() => setHideSalary((h) => !h)}
              title={
                hideSalary
                  ? 'Salary is hidden on the public careers page'
                  : 'Salary is visible on the public careers page'
              }
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border py-1.5 pl-3 pr-3.5 text-xs font-medium transition-colors',
                hideSalary
                  ? 'border-border bg-secondary/50 text-muted-foreground hover:text-foreground'
                  : 'border-[hsl(var(--brand-cyan))]/40 bg-[hsl(var(--brand-cyan))]/10 text-[hsl(var(--brand-cyan))]'
              )}
            >
              {hideSalary ? (
                <>
                  <EyeOff className="h-3.5 w-3.5" />
                  Salary hidden
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5" />
                  Salary shown
                </>
              )}
            </button>
          </div>

          <div className="my-8 h-px bg-gradient-to-r from-border via-border to-transparent" />

          {/* Short description */}
          <div className="animate-fade-up mb-6" style={{ animationDelay: '0.10s' }}>
            <label className="mb-2 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <TextQuote className="h-3.5 w-3.5" />
              Short summary (1–2 sentences)
            </label>
            <textarea
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              rows={2}
              maxLength={220}
              placeholder="A one-line hook that appears on the careers listing card. Leave empty to auto-generate from the JD."
              className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
            />
          </div>

          {/* JD body */}
          <div className="animate-fade-up" style={{ animationDelay: '0.14s' }}>
            <div className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Job description
            </div>
            <RichTextEditor
              bordered={false}
              content={vacancy?.description ?? ''}
              onChange={setDescription}
            />
          </div>

          {/* Footer meta */}
          <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Type className="h-3.5 w-3.5" />
              <span className="tabular-nums">{wordCount.toLocaleString()} words</span>
            </span>
            <span className="ml-auto hidden items-center gap-1.5 sm:inline-flex">
              Type{' '}
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                /
              </kbd>{' '}
              for blocks
            </span>
          </div>
        </div>
      </article>
    </div>
  );
}

function ChipCombobox({
  icon: Icon,
  value,
  onChange,
  placeholder,
  suggestions,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  suggestions: string[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const query = value.trim().toLowerCase();
  // Show all when empty; otherwise rank prefix matches first, then substring matches.
  const filtered = (() => {
    if (!query) return suggestions;
    const starts = suggestions.filter((s) => s.toLowerCase().startsWith(query));
    const contains = suggestions.filter(
      (s) => !s.toLowerCase().startsWith(query) && s.toLowerCase().includes(query)
    );
    return [...starts, ...contains];
  })();

  useEffect(() => {
    setActiveIndex(0);
  }, [value, open]);

  const pick = (val: string) => {
    onChange(val);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (filtered[activeIndex]) {
        e.preventDefault();
        pick(filtered[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <label className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 py-1.5 pl-3 pr-3.5 text-sm transition-colors focus-within:border-[hsl(var(--brand-cyan))]/50 focus-within:bg-secondary">
          <Icon className="h-3.5 w-3.5 text-[hsl(var(--brand-cyan))]" />
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className="bg-transparent font-medium text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
            size={Math.max(value.length || placeholder.length, 8)}
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            autoComplete="off"
          />
        </label>
      </PopoverAnchor>
      {filtered.length > 0 && (
        <PopoverContent
          align="start"
          sideOffset={6}
          className="max-h-64 w-[260px] overflow-y-auto"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {filtered.map((opt, idx) => (
            <button
              key={opt}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                pick(opt);
                inputRef.current?.focus();
              }}
              onMouseEnter={() => setActiveIndex(idx)}
              className={cn(
                'flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition-colors',
                idx === activeIndex
                  ? 'bg-primary/10 text-primary'
                  : 'text-foreground hover:bg-muted'
              )}
            >
              {opt}
            </button>
          ))}
        </PopoverContent>
      )}
    </Popover>
  );
}

function ChipInput({
  icon: Icon,
  value,
  onChange,
  placeholder,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 py-1.5 pl-3 pr-3.5 text-sm transition-colors focus-within:border-[hsl(var(--brand-cyan))]/50 focus-within:bg-secondary">
      <Icon className="h-3.5 w-3.5 text-[hsl(var(--brand-cyan))]" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-transparent font-medium text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
        size={Math.max(value.length || placeholder.length, 8)}
      />
    </label>
  );
}

function ChipSelect({
  icon: Icon,
  value,
  onChange,
  options,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 py-1.5 pl-3 pr-3 text-sm transition-colors focus-within:border-[hsl(var(--brand-cyan))]/50 focus-within:bg-secondary">
      <Icon className="h-3.5 w-3.5 text-[hsl(var(--brand-cyan))]" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer bg-transparent font-medium text-foreground focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-card text-foreground">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

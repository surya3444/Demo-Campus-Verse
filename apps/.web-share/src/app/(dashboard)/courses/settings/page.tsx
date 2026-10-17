'use client';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, ShieldCheck, Sparkles, Workflow, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { coursesApi } from '@/lib/api';

const CATEGORY_OPTIONS = [
  { value: 'general', label: 'General' },
  { value: 'technical', label: 'Technical' },
  { value: 'soft_skills', label: 'Soft Skills' },
  { value: 'aptitude', label: 'Aptitude' },
  { value: 'language', label: 'Language' },
  { value: 'domain_specific', label: 'Domain Specific' },
  { value: 'certification_prep', label: 'Certification Prep' },
  { value: 'career_readiness', label: 'Career Readiness' },
];

const LEVEL_OPTIONS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

const VISIBILITY_OPTIONS = [
  { value: 'branch', label: 'My branch only' },
  { value: 'selected_branches', label: 'Selected branches' },
  { value: 'all', label: 'All branches' },
];

export default function CoursesSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [defaultCategory, setDefaultCategory] = useState('general');
  const [defaultLevel, setDefaultLevel] = useState('beginner');
  const [defaultVisibility, setDefaultVisibility] = useState('branch');
  const [requireApproval, setRequireApproval] = useState(true);
  const [allowSelfEnrollment, setAllowSelfEnrollment] = useState(false);
  const [autoPublishOnApproval, setAutoPublishOnApproval] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await coursesApi.getCourseSettings();
        if (cancelled) return;
        if (response.success && response.data) {
          const s = response.data;
          if (s.defaults) {
            if (s.defaults.category) setDefaultCategory(s.defaults.category);
            if (s.defaults.level) setDefaultLevel(s.defaults.level);
            if (s.defaults.visibility) setDefaultVisibility(s.defaults.visibility);
          }
          if (s.policies) {
            if (typeof s.policies.requireApproval === 'boolean')
              setRequireApproval(s.policies.requireApproval);
            if (typeof s.policies.autoPublishOnApproval === 'boolean')
              setAutoPublishOnApproval(s.policies.autoPublishOnApproval);
            if (typeof s.policies.allowSelfEnrollment === 'boolean')
              setAllowSelfEnrollment(s.policies.allowSelfEnrollment);
          }
        }
      } catch (error) {
        console.error('Failed to load course settings:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await coursesApi.updateCourseSettings({
        defaults: {
          category: defaultCategory,
          level: defaultLevel,
          visibility: defaultVisibility,
        },
        policies: {
          requireApproval,
          autoPublishOnApproval,
          allowSelfEnrollment,
        },
      });
      if (response.success) {
        toast.success('Course settings saved');
      } else {
        throw new Error('Save failed');
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* ─── Header ─── */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            <Sparkles className="h-3 w-3 text-accent" />
            <span>Course Configuration</span>
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
            Courses settings
          </h1>
          <p className="text-sm text-muted-foreground">
            Defaults applied when authors create new courses, and the rules around publishing and
            enrollment.
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={loading || saving}
          size="lg"
          className="gap-2 shadow-soft"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save changes
            </>
          )}
        </Button>
      </header>

      {loading ? (
        <div className="space-y-6">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      ) : (
        <>
          {/* ─── Defaults panel ─── */}
          <section className="rounded-2xl border bg-card shadow-soft">
            <header className="flex items-start gap-4 border-b px-6 py-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Workflow className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Defaults
                </p>
                <h2 className="font-display text-lg font-semibold mt-0.5">New course defaults</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Whenever someone opens the course builder, these are pre-selected. Authors can
                  still override per course.
                </p>
              </div>
            </header>

            <div className="grid gap-5 p-6 md:grid-cols-3">
              <SettingField label="Category" htmlFor="default-category">
                <Select value={defaultCategory} onValueChange={setDefaultCategory}>
                  <SelectTrigger id="default-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingField>

              <SettingField label="Level" htmlFor="default-level">
                <Select value={defaultLevel} onValueChange={setDefaultLevel}>
                  <SelectTrigger id="default-level">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEVEL_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingField>

              <SettingField label="Visibility" htmlFor="default-visibility">
                <Select value={defaultVisibility} onValueChange={setDefaultVisibility}>
                  <SelectTrigger id="default-visibility">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VISIBILITY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingField>
            </div>
          </section>

          {/* ─── Policies panel ─── */}
          <section className="rounded-2xl border bg-card shadow-soft">
            <header className="flex items-start gap-4 border-b px-6 py-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10">
                <ShieldCheck className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Policies
                </p>
                <h2 className="font-display text-lg font-semibold mt-0.5">
                  Publishing &amp; enrollment
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Who can publish what, and how learners get into a course.
                </p>
              </div>
            </header>

            <ul className="divide-y divide-border">
              <PolicyRow
                title="Require approval before publishing"
                description="Instructor-created courses must be approved by a branch admin before learners see them."
                checked={requireApproval}
                onChange={setRequireApproval}
              />
              <PolicyRow
                title="Auto-publish on approval"
                description={
                  <>
                    Approved courses automatically transition from{' '}
                    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
                      draft
                    </code>{' '}
                    to{' '}
                    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
                      published
                    </code>
                    . Disable to require an explicit publish step.
                  </>
                }
                checked={autoPublishOnApproval}
                onChange={setAutoPublishOnApproval}
                disabled={!requireApproval}
                hint={!requireApproval ? 'Enabled only when approval is required.' : undefined}
              />
              <PolicyRow
                title="Allow learner self-enrollment"
                description="Students can enrol themselves in published courses without an admin assigning them."
                checked={allowSelfEnrollment}
                onChange={setAllowSelfEnrollment}
              />
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

// ─────────────────────── Sub-components ────────────────────────────

function SettingField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label
        htmlFor={htmlFor}
        className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
      >
        {label}
      </Label>
      {children}
    </div>
  );
}

function PolicyRow({
  title,
  description,
  checked,
  onChange,
  disabled,
  hint,
}: {
  title: string;
  description: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <li className="flex items-start justify-between gap-6 px-6 py-5">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
        {hint && <p className="text-[11px] italic text-muted-foreground/80">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </li>
  );
}

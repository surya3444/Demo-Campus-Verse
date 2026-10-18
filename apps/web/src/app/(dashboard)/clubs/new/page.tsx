'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { clubsApi, hrApi, organizationApi, type Club, type ClubInput } from '@/lib/api';
import { cn } from '@/lib/utils';
import { ClubCard } from '@/components/clubs/ClubCard';
import {
  CLUB_CATEGORY,
  CLUB_ICONS,
  CLUB_THEMES,
  ClubCrest,
  iconOf,
} from '@/components/clubs/clubVisuals';

const NONE = '__none__';

function ClubForm() {
  const router = useRouter();
  const editId = useSearchParams().get('edit');
  const [form, setForm] = useState<ClubInput>({
    name: '',
    category: 'technical',
    tagline: '',
    description: '',
    icon: 'rocket',
    theme: 'aurora',
    meeting: {},
    tags: [],
    highlights: [],
  });
  const [institutions, setInstitutions] = useState<Array<{ _id: string; name: string }>>([]);
  const [staff, setStaff] = useState<Array<{ _id: string; name: string }>>([]);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof ClubInput>(k: K, v: ClubInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    organizationApi
      .getInstitutions({ status: 'active' })
      .then((r) => setInstitutions((r.data ?? []) as Array<{ _id: string; name: string }>))
      .catch(() => setInstitutions([]));
    hrApi
      .getStaff({ isTeaching: true, status: 'active', limit: 300 })
      .then((r) =>
        setStaff(
          (
            (r.data ?? []) as Array<{
              _id: string;
              displayName?: string;
              firstName?: string;
              lastName?: string;
            }>
          )
            .map((s) => ({
              _id: s._id,
              name: s.displayName || [s.firstName, s.lastName].filter(Boolean).join(' '),
            }))
            .sort((a, b) => a.name.localeCompare(b.name))
        )
      )
      .catch(() => setStaff([]));
  }, []);

  useEffect(() => {
    if (!editId) return;
    clubsApi.get(editId).then(({ data: c }) =>
      setForm({
        name: c.name,
        category: c.category,
        tagline: c.tagline,
        description: c.description,
        icon: c.icon,
        theme: c.theme,
        institutionId: c.institutionId,
        coordinatorStaffId: c.coordinator?.staffId ?? null,
        meeting: c.meeting,
        tags: c.tags,
        highlights: c.highlights,
      })
    );
  }, [editId]);

  const preview: Club = {
    _id: 'preview',
    name: form.name || 'Your club name',
    category: form.category,
    tagline: form.tagline || 'A one-line pitch that makes people want to join.',
    description: form.description ?? '',
    emoji: '',
    icon: form.icon ?? '',
    theme: form.theme,
    institutionId: form.institutionId ?? null,
    institutionName: institutions.find((i) => i._id === form.institutionId)?.name ?? null,
    coordinator: null,
    meeting: form.meeting ?? {},
    tags: form.tags ?? [],
    highlights: [],
    memberCount: 0,
    isMember: false,
    faces: [],
  };

  const save = async () => {
    if (form.name.trim().length < 2) return toast.error('Give the club a name');
    setSaving(true);
    try {
      const clean = (o?: Record<string, string | undefined>) =>
        Object.fromEntries(Object.entries(o ?? {}).filter(([, v]) => v && v.trim()));
      const r = await clubsApi.save(
        {
          ...form,
          name: form.name.trim(),
          tagline: form.tagline?.trim() || undefined,
          description: form.description?.trim() || undefined,
          meeting: clean(form.meeting),
        },
        editId ?? undefined
      );
      toast.success(editId ? 'Club updated' : `${r.data.name} is live 🎉`);
      router.push(`/clubs/${r.data._id}`);
    } catch (err) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e.response?.data?.error?.message || 'Could not save the club');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" /> Clubs
        </p>
        <h1 className="font-sans text-3xl font-extrabold tracking-tight">
          {editId ? 'Edit club' : 'Start a club'}
        </h1>
        <p className="text-muted-foreground">
          Give it a look and a purpose — the card on the right is exactly what students will see.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6 rounded-2xl border bg-card p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Club name</Label>
              <Input
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="e.g. IEEE Student Branch"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Tagline</Label>
              <Input
                value={form.tagline}
                onChange={(e) => set('tagline', e.target.value)}
                placeholder="One line that sells it"
                maxLength={120}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(CLUB_CATEGORY).map(([k, c]) => {
                const Icon = iconOf(c.icon);
                const on = form.category === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => set('category', k)}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm font-medium transition',
                      on
                        ? 'border-primary bg-primary text-primary-foreground shadow-md'
                        : 'hover:border-primary/40'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-full',
                        on
                          ? 'bg-white/15'
                          : 'bg-gradient-to-br from-primary to-[hsl(var(--brand-cyan))] text-white'
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Crest</Label>
            <div className="grid grid-cols-6 gap-2 sm:grid-cols-9 lg:grid-cols-12">
              {Object.keys(CLUB_ICONS).map((key) => (
                <button
                  key={key}
                  type="button"
                  title={key}
                  onClick={() => set('icon', key)}
                  className={cn(
                    'flex items-center justify-center rounded-xl py-1.5 transition hover:-translate-y-0.5 hover:bg-muted',
                    form.icon === key &&
                      'bg-[hsl(var(--brand-cyan))]/10 ring-2 ring-[hsl(var(--brand-cyan))]'
                  )}
                >
                  <ClubCrest icon={key} theme={form.theme} size={34} />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Colour</Label>
            <div className="flex flex-wrap gap-3">
              {Object.entries(CLUB_THEMES).map(([k, t]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => set('theme', k)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-2xl px-2 py-2 transition hover:-translate-y-0.5',
                    form.theme === k && 'bg-muted ring-2 ring-primary'
                  )}
                >
                  <ClubCrest icon={form.icon} theme={k} size={40} />
                  <span className="text-[11px] font-medium text-muted-foreground">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>About the club</Label>
            <Textarea
              rows={4}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="What you do, who it's for, what members get out of it"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Institution</Label>
              <Select
                value={form.institutionId ?? NONE}
                onValueChange={(v) => set('institutionId', v === NONE ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Whole campus</SelectItem>
                  {institutions.map((i) => (
                    <SelectItem key={i._id} value={i._id}>
                      {i.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Faculty coordinator</Label>
              <Select
                value={form.coordinatorStaffId ?? NONE}
                onValueChange={(v) => set('coordinatorStaffId', v === NONE ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None yet</SelectItem>
                  {staff.map((s) => (
                    <SelectItem key={s._id} value={s._id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {(
              [
                ['day', 'Meets on', 'Every Friday'],
                ['time', 'Time', '4:00 PM'],
                ['venue', 'Venue', 'Seminar Hall 2'],
              ] as const
            ).map(([k, label, ph]) => (
              <div key={k} className="space-y-1.5">
                <Label>{label}</Label>
                <Input
                  value={form.meeting?.[k] ?? ''}
                  onChange={(e) => set('meeting', { ...form.meeting, [k]: e.target.value })}
                  placeholder={ph}
                />
              </div>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Tags (comma separated)</Label>
              <Input
                value={(form.tags ?? []).join(', ')}
                onChange={(e) =>
                  set(
                    'tags',
                    e.target.value
                      .split(',')
                      .map((t) => t.trim())
                      .filter(Boolean)
                      .slice(0, 10)
                  )
                }
                placeholder="robotics, iot, hackathons"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Highlights (one per line)</Label>
              <Textarea
                rows={3}
                value={(form.highlights ?? []).join('\n')}
                onChange={(e) =>
                  set(
                    'highlights',
                    e.target.value
                      .split('\n')
                      .map((t) => t.trim())
                      .filter(Boolean)
                      .slice(0, 8)
                  )
                }
                placeholder="Winners, State Robotics Challenge 2026"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="ghost" onClick={() => router.back()} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editId ? 'Save changes' : 'Create club'}
            </Button>
          </div>
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Live preview
          </p>
          <div className="pointer-events-none">
            <ClubCard club={preview} onChange={() => undefined} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NewClubPage() {
  return (
    <Suspense fallback={null}>
      <ClubForm />
    </Suspense>
  );
}

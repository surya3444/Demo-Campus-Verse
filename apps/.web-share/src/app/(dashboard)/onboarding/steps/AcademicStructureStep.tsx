'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight,
  ArrowLeft,
  Loader2,
  Plus,
  X,
  Layers,
  Sparkles,
  ChevronRight,
  Users,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { academicApi, organizationApi } from '@/lib/api';
import type { ClassItem } from './types';
import { SCHOOL_GRADES, COLLEGE_STREAMS, UNIVERSITY_DEPARTMENTS } from './constants';
import { cn } from '@/lib/utils';

interface HierarchyLevel {
  key: string;
  label: string;
  labelPlural: string;
  isLeaf: boolean;
  order: number;
}

interface LevelValue {
  name: string;
  code: string;
  order?: number;
}

interface AcademicStructureStepProps {
  institutionType: string;
  branchId?: string;
  academicBatchId: string;
  saving: boolean;
  setSaving: (saving: boolean) => void;
  onSave: (classes: ClassItem[]) => void;
  goBack: () => void;
}

const slug = (s: string) =>
  s
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);

/** Default presets for the most common level keys, used to seed the picker. */
function presetsFor(levelKey: string): LevelValue[] {
  const key = levelKey.toLowerCase();
  if (key === 'grade') {
    return SCHOOL_GRADES.slice(3, 13).map((g) => ({ name: g.name, code: g.code, order: g.order }));
  }
  if (key === 'stream') {
    return COLLEGE_STREAMS.map((s) => ({ name: s.name, code: s.code }));
  }
  if (key === 'department') {
    return UNIVERSITY_DEPARTMENTS.map((d) => ({ name: d.name, code: d.code }));
  }
  if (key === 'year') {
    return [1, 2, 3, 4].map((n) => ({ name: `Year ${n}`, code: `Y${n}`, order: n }));
  }
  if (key === 'semester') {
    return [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
      name: `Semester ${n}`,
      code: `S${n}`,
      order: n,
    }));
  }
  return [];
}

export function AcademicStructureStep({
  institutionType,
  branchId,
  academicBatchId,
  saving,
  setSaving,
  onSave,
  goBack,
}: AcademicStructureStepProps) {
  const [hierarchy, setHierarchy] = useState<HierarchyLevel[] | null>(null);
  const [hierarchyError, setHierarchyError] = useState<string | null>(null);
  // For each non-leaf level (by index), the set of selected values.
  const [perLevel, setPerLevel] = useState<LevelValue[][]>([]);
  // Per-level draft for the "add custom" inputs.
  const [drafts, setDrafts] = useState<Record<number, string>>({});

  // Fetch the resolved hierarchy for this branch on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await organizationApi.getAcademicHierarchy(branchId);
        const levels: HierarchyLevel[] = res.data?.levels ?? [];
        const ordered = [...levels].sort((a, b) => a.order - b.order);
        if (cancelled) return;
        setHierarchy(ordered);
        const nonLeaf = ordered.filter((l) => !l.isLeaf);
        // Seed level 0 with sensible defaults so onboarding feels alive.
        setPerLevel(
          nonLeaf.map((level, idx) => {
            if (idx === 0) {
              if (level.key.toLowerCase() === 'grade') {
                return SCHOOL_GRADES.slice(3, 13).map((g) => ({
                  name: g.name,
                  code: g.code,
                  order: g.order,
                }));
              }
            }
            return [];
          })
        );
      } catch (err) {
        console.error('Failed to load hierarchy', err);
        setHierarchyError('Could not load your hierarchy. Try refreshing.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [branchId]);

  const orderedHierarchy = hierarchy ?? [];
  const nonLeaf = useMemo(() => orderedHierarchy.filter((l) => !l.isLeaf), [orderedHierarchy]);
  const leafLevel = useMemo(() => orderedHierarchy.find((l) => l.isLeaf), [orderedHierarchy]);

  /** All combinations across the non-leaf levels — one Class per combination. */
  const stagedClasses = useMemo<ClassItem[]>(() => {
    if (perLevel.length !== nonLeaf.length) return [];
    if (nonLeaf.length === 0) return [];
    if (perLevel.some((arr) => arr.length === 0)) return [];

    const cartesian = (arrs: LevelValue[][]): LevelValue[][] => {
      return arrs.reduce<LevelValue[][]>(
        (acc, curr) => acc.flatMap((prefix) => curr.map((c) => [...prefix, c])),
        [[]]
      );
    };

    return cartesian(perLevel).map((combo) => {
      const path = combo.map((v, i) => ({
        levelKey: nonLeaf[i].key,
        name: v.name,
        code: v.code,
        order: v.order,
      }));
      return { displayName: path.map((p) => p.name).join(' · '), path };
    });
  }, [perLevel, nonLeaf]);

  const togglePreset = (levelIdx: number, value: LevelValue) => {
    setPerLevel((curr) => {
      const next = curr.map((arr) => [...arr]);
      const list = next[levelIdx] ?? [];
      const exists = list.findIndex((v) => v.code === value.code);
      if (exists >= 0) {
        list.splice(exists, 1);
      } else {
        list.push(value);
      }
      next[levelIdx] = list;
      return next;
    });
  };

  const addCustom = (levelIdx: number) => {
    const raw = drafts[levelIdx]?.trim();
    if (!raw) return;
    const code = slug(raw);
    if (!code) {
      toast.error('Please use letters or numbers');
      return;
    }
    setPerLevel((curr) => {
      const next = curr.map((arr) => [...arr]);
      const list = next[levelIdx] ?? [];
      if (list.some((v) => v.code === code)) {
        toast.error('Already added');
        return curr;
      }
      list.push({ name: raw, code, order: list.length + 1 });
      next[levelIdx] = list;
      return next;
    });
    setDrafts((d) => ({ ...d, [levelIdx]: '' }));
  };

  const removeValue = (levelIdx: number, code: string) => {
    setPerLevel((curr) => {
      const next = curr.map((arr) => [...arr]);
      next[levelIdx] = (next[levelIdx] ?? []).filter((v) => v.code !== code);
      return next;
    });
  };

  const handleSave = async () => {
    if (stagedClasses.length === 0) {
      toast.error('Pick at least one value for every level');
      return;
    }
    setSaving(true);
    const created: ClassItem[] = [];
    let failures = 0;

    try {
      for (const item of stagedClasses) {
        try {
          const res = await academicApi.createClass({
            academicBatchId,
            path: item.path,
          });
          if (res.success && res.data?._id) {
            // Default leaf entry — one section A under each new class.
            try {
              await academicApi.createSection(res.data._id, { name: 'A', code: 'A' });
            } catch {
              /* leaf creation is non-critical */
            }
            created.push(item);
          } else {
            failures++;
          }
        } catch {
          failures++;
        }
      }

      if (created.length > 0) {
        if (failures > 0) toast.warning(`Created ${created.length}. ${failures} failed.`);
        else toast.success(`Created ${created.length} classes`);
        onSave(created);
      } else {
        toast.error('Could not create any classes');
      }
    } finally {
      setSaving(false);
    }
  };

  // ─── Loading & error states ─────────────────────────────────────────────

  if (hierarchyError) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
        <AlertCircle className="mx-auto mb-3 h-8 w-8 text-destructive" />
        <p className="text-sm text-destructive">{hierarchyError}</p>
      </div>
    );
  }

  if (!hierarchy) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-7 w-7 animate-spin" />
        <p className="text-sm">Loading your structure…</p>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      {/* Hero — what we're building */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/[0.04] via-background to-[hsl(var(--brand-cyan)/0.05)] p-7">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[hsl(var(--brand-cyan)/0.08)] blur-3xl" />
        <div className="relative space-y-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary/60" />
            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary/60">
              Step 4 · Academic Structure
            </span>
          </div>
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            Pick what each level contains. We&apos;ll create the classes for you.
          </h2>
          <p className="text-sm text-muted-foreground">
            Your <span className="font-medium text-foreground">{institutionType}</span> branch is
            set up with this hierarchy. Choose the values for each level — every combination becomes
            a class.
          </p>

          {/* Hierarchy preview */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {orderedHierarchy.map((level, idx) => (
              <span key={level.key} className="flex items-center gap-2">
                {idx > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />}
                <Badge
                  variant="outline"
                  className={cn(
                    'gap-1.5 rounded-full border-2 px-3 py-1 font-medium',
                    level.isLeaf
                      ? 'border-[hsl(var(--brand-cyan))] bg-[hsl(var(--brand-cyan)/0.08)] text-primary'
                      : 'border-primary/15 bg-primary/[0.04] text-primary'
                  )}
                >
                  {level.isLeaf && <Users className="h-3 w-3" />}
                  {level.label}
                </Badge>
              </span>
            ))}
          </div>
        </div>
      </div>

      {nonLeaf.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-muted/30 p-8 text-center">
          <AlertCircle className="mx-auto mb-2 h-6 w-6 text-amber-500" />
          <p className="text-sm text-muted-foreground">
            Your hierarchy only has a leaf level — there&apos;s nothing to set up here. Continue to
            create one default class.
          </p>
        </div>
      ) : (
        nonLeaf.map((level, idx) => {
          const presets = presetsFor(level.key);
          const selected = perLevel[idx] ?? [];
          const selectedCodes = new Set(selected.map((v) => v.code));
          const draft = drafts[idx] ?? '';

          return (
            <div key={level.key} className="rounded-2xl border bg-card shadow-sm">
              <div className="flex items-start justify-between border-b px-6 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/8 font-serif text-sm italic text-primary">
                    {idx + 1}
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold">{level.labelPlural}</h3>
                    <p className="text-xs text-muted-foreground">
                      Pick the {level.labelPlural.toLowerCase()} you offer.
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="rounded-full font-medium">
                  {selected.length} selected
                </Badge>
              </div>

              <div className="space-y-4 p-6">
                {presets.length > 0 && (
                  <div>
                    <Label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      <Sparkles className="mr-1 inline h-3 w-3" />
                      Suggested
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {presets.map((p) => {
                        const isOn = selectedCodes.has(p.code);
                        return (
                          <button
                            key={p.code}
                            type="button"
                            onClick={() => togglePreset(idx, p)}
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                              isOn
                                ? 'border-primary/40 bg-primary/8 text-primary shadow-sm'
                                : 'border-input bg-background text-foreground hover:border-primary/30 hover:bg-primary/5'
                            )}
                          >
                            {isOn ? (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            ) : (
                              <Plus className="h-3.5 w-3.5" />
                            )}
                            {p.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <Label
                    htmlFor={`custom-${idx}`}
                    className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                  >
                    Add custom
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id={`custom-${idx}`}
                      value={draft}
                      onChange={(e) => setDrafts((d) => ({ ...d, [idx]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addCustom(idx);
                        }
                      }}
                      placeholder={`Add a ${level.label.toLowerCase()}…`}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => addCustom(idx)}
                      disabled={!draft.trim()}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {selected.length > 0 && (
                  <div className="rounded-lg border border-dashed bg-muted/30 p-3">
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Selected
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.map((v) => (
                        <span
                          key={v.code}
                          className="group inline-flex items-center gap-1 rounded-md bg-background px-2 py-1 text-xs font-medium ring-1 ring-border"
                        >
                          {v.name}
                          <button
                            type="button"
                            onClick={() => removeValue(idx, v.code)}
                            className="text-muted-foreground/60 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}

      {/* Live summary */}
      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Will create
            </p>
            <p className="mt-1 font-display text-2xl font-semibold">
              {stagedClasses.length}{' '}
              <span className="text-muted-foreground">
                {stagedClasses.length === 1 ? 'class' : 'classes'}
              </span>
            </p>
            {leafLevel && stagedClasses.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Each gets one default {leafLevel.label.toLowerCase()} — you can add more later.
              </p>
            )}
          </div>
          {stagedClasses.length > 0 && (
            <div className="flex max-h-32 max-w-md flex-wrap gap-1.5 overflow-y-auto sm:justify-end">
              {stagedClasses.slice(0, 12).map((c) => (
                <span
                  key={c.displayName}
                  className="inline-flex items-center rounded-md border bg-background px-2 py-0.5 text-[11px] font-medium"
                >
                  {c.displayName}
                </span>
              ))}
              {stagedClasses.length > 12 && (
                <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                  +{stagedClasses.length - 12} more
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between border-t pt-5">
        <Button variant="outline" onClick={goBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving || stagedClasses.length === 0}
          className="gap-1.5"
          size="lg"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
          Create {stagedClasses.length || ''} & continue
        </Button>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { organizationApi } from '@/lib/api';
import {
  GripVertical,
  Plus,
  Trash2,
  Save,
  Loader2,
  RotateCcw,
  Users,
  ChevronRight,
  Building2,
  Layers,
  Sparkles,
  Globe,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface HierarchyLevel {
  key: string;
  label: string;
  labelPlural: string;
  isLeaf: boolean;
  order: number;
}

interface BranchOption {
  _id: string;
  name: string;
  code: string;
  institutionType: 'school' | 'college' | 'university';
}

type HierarchySource = 'branch' | 'tenant' | 'default';

const TENANT_SCOPE = '__tenant__';

export function HierarchyConfigTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [levels, setLevels] = useState<HierarchyLevel[]>([]);
  const [source, setSource] = useState<HierarchySource>('default');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [scope, setScope] = useState<string>(TENANT_SCOPE);
  const [branches, setBranches] = useState<BranchOption[]>([]);

  useEffect(() => {
    loadBranches();
  }, []);

  useEffect(() => {
    loadHierarchy(scope === TENANT_SCOPE ? undefined : scope);
  }, [scope]);

  const loadBranches = async () => {
    try {
      const response = await organizationApi.getBranches({ status: 'active', limit: 100 });
      setBranches(response.data || []);
    } catch (err) {
      console.error('Failed to load branches', err);
    }
  };

  const loadHierarchy = async (branchId?: string) => {
    try {
      setLoading(true);
      const response = await organizationApi.getAcademicHierarchy(branchId);
      const data = response.data || {};
      setLevels(data.levels || []);
      setSource((data.source as HierarchySource) || 'default');
    } catch (error) {
      console.error('Failed to load hierarchy:', error);
      toast.error('Failed to load academic hierarchy');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const leafLevels = levels.filter((l) => l.isLeaf);
    if (leafLevels.length !== 1) {
      toast.error('Mark exactly one level as the leaf — that is where students enroll');
      return;
    }
    if (levels.some((l) => !l.label.trim() || !l.labelPlural.trim())) {
      toast.error('Every level needs a label and plural form');
      return;
    }
    const keys = levels.map((l) => l.key);
    if (new Set(keys).size !== keys.length) {
      toast.error('Each level key must be unique');
      return;
    }

    try {
      setSaving(true);
      await organizationApi.updateAcademicHierarchy(
        { levels },
        scope === TENANT_SCOPE ? undefined : scope
      );
      toast.success(
        scope === TENANT_SCOPE
          ? 'Tenant hierarchy saved'
          : `Hierarchy saved for ${branches.find((b) => b._id === scope)?.name ?? 'branch'}`
      );
      loadHierarchy(scope === TENANT_SCOPE ? undefined : scope);
    } catch (error) {
      console.error('Failed to save hierarchy:', error);
      // Surface the server's message — e.g. the HIERARCHY_IN_USE guard
      // explains exactly why a structural change was rejected.
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message || 'Failed to save academic hierarchy');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      setSaving(true);
      await organizationApi.resetAcademicHierarchy(scope === TENANT_SCOPE ? undefined : scope);
      toast.success('Reverted to default');
      loadHierarchy(scope === TENANT_SCOPE ? undefined : scope);
    } catch (error) {
      console.error('Failed to reset hierarchy:', error);
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message || 'Failed to reset academic hierarchy');
    } finally {
      setSaving(false);
    }
  };

  const addLevel = () => {
    if (levels.length >= 5) return;
    const newOrder = levels.length + 1;
    setLevels([
      ...levels,
      {
        key: `level_${newOrder}`,
        label: '',
        labelPlural: '',
        isLeaf: false,
        order: newOrder,
      },
    ]);
  };

  const removeLevel = (index: number) => {
    if (levels.length <= 1) {
      toast.error('At least one level is required');
      return;
    }
    const next = levels.filter((_, i) => i !== index).map((l, i) => ({ ...l, order: i + 1 }));
    setLevels(next);
  };

  const updateLevel = (index: number, field: keyof HierarchyLevel, value: string | boolean) => {
    const next = [...levels];
    next[index] = { ...next[index], [field]: value };

    if (field === 'label' && typeof value === 'string') {
      const currentKey = next[index].key;
      if (!currentKey || currentKey.startsWith('level_') || currentKey === '') {
        next[index].key = value
          .toLowerCase()
          .replace(/\s+/g, '_')
          .replace(/[^a-z_]/g, '');
      }
      if (!next[index].labelPlural) {
        next[index].labelPlural = value + 's';
      }
    }

    if (field === 'isLeaf' && value === true) {
      next.forEach((l, i) => {
        if (i !== index) l.isLeaf = false;
      });
    }

    setLevels(next);
  };

  const handleDragStart = (index: number) => setDraggedIndex(index);

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    const next = [...levels];
    const dragged = next[draggedIndex];
    next.splice(draggedIndex, 1);
    next.splice(index, 0, dragged);
    setLevels(next.map((l, i) => ({ ...l, order: i + 1 })));
    setDraggedIndex(index);
  };

  const handleDragEnd = () => setDraggedIndex(null);

  const orderedLevels = useMemo(() => [...levels].sort((a, b) => a.order - b.order), [levels]);
  const leafLabel = useMemo(
    () => orderedLevels.find((l) => l.isLeaf)?.label || 'leaf',
    [orderedLevels]
  );

  const sourceCopy: Record<
    HierarchySource,
    { label: string; tone: string; icon: React.ReactNode }
  > = {
    branch: {
      label: 'Branch override',
      tone: 'bg-emerald-50 text-emerald-900 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-800',
      icon: <Building2 className="h-3.5 w-3.5" />,
    },
    tenant: {
      label: 'Tenant default',
      tone: 'bg-primary/5 text-primary ring-primary/15',
      icon: <Globe className="h-3.5 w-3.5" />,
    },
    default: {
      label: 'System default',
      tone: 'bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-800',
      icon: <Sparkles className="h-3.5 w-3.5" />,
    },
  };

  if (loading) {
    return (
      <div className="flex min-h-[480px] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Loading hierarchy…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero — context + inheritance source */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/[0.04] via-background to-[hsl(var(--brand-cyan)/0.04)] p-8 shadow-sm">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[hsl(var(--brand-cyan)/0.05)] blur-3xl" />
        <div className="absolute -left-12 bottom-0 h-48 w-48 rounded-full bg-primary/[0.04] blur-3xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary/60" />
              <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary/60">
                Academic Structure
              </span>
            </div>
            <h2 className="text-3xl font-semibold tracking-tight text-foreground">
              Shape how your institution is organized.
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Define the levels every class is built from — from the broadest grouping down to where
              students actually enroll. Each branch can override the tenant default when its
              structure is different.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:flex-col lg:items-end">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Editing</span>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger className="w-[260px] bg-background/80 backdrop-blur">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TENANT_SCOPE}>
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-primary" />
                      <span>Tenant default</span>
                    </div>
                  </SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b._id} value={b._id}>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span>{b.name}</span>
                        <span className="text-xs text-muted-foreground">· {b.code}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset',
                sourceCopy[source].tone
              )}
            >
              {sourceCopy[source].icon}
              <span>Showing: {sourceCopy[source].label}</span>
            </div>
          </div>
        </div>

        {/* Live preview rail */}
        <div className="relative mt-8 rounded-xl border border-dashed bg-background/60 px-5 py-5 backdrop-blur">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Preview
            </span>
            <span className="text-xs text-muted-foreground">
              {orderedLevels.length} {orderedLevels.length === 1 ? 'level' : 'levels'}
            </span>
          </div>
          {orderedLevels.length === 0 ? (
            <p className="text-sm text-muted-foreground">No levels yet — add one to begin.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {orderedLevels.map((level, idx) => (
                <div key={level.key || idx} className="flex items-center gap-2">
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
                    {level.label || `Level ${idx + 1}`}
                  </Badge>
                </div>
              ))}
            </div>
          )}
          {orderedLevels.some((l) => l.isLeaf) && (
            <p className="mt-3 text-xs text-muted-foreground">
              Students enroll at <span className="font-medium text-foreground">{leafLabel}</span>.
              Everything above is a navigational container.
            </p>
          )}
        </div>
      </div>

      {/* Levels editor */}
      <div className="rounded-2xl border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-6 py-5">
          <div>
            <h3 className="text-base font-semibold tracking-tight">Hierarchy levels</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Drag to reorder. Mark exactly one level as the leaf — that is where students enroll.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={addLevel}
            disabled={levels.length >= 5}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Add level
          </Button>
        </div>

        <div className="divide-y">
          {orderedLevels.map((level, index) => {
            const isDragging = draggedIndex === index;
            return (
              <div
                key={level.key || index}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={cn(
                  'group relative grid grid-cols-[auto_3rem_1fr_auto] items-center gap-4 px-6 py-5 transition-all',
                  isDragging ? 'bg-primary/5 opacity-60 shadow-inner' : 'hover:bg-muted/40'
                )}
              >
                <div className="cursor-grab text-muted-foreground/40 transition-colors group-hover:text-muted-foreground">
                  <GripVertical className="h-5 w-5" />
                </div>

                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full font-serif text-sm italic ring-1',
                    level.isLeaf
                      ? 'bg-[hsl(var(--brand-cyan)/0.12)] text-primary ring-[hsl(var(--brand-cyan)/0.4)]'
                      : 'bg-muted text-muted-foreground ring-border'
                  )}
                >
                  {index + 1}
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.4fr_1.4fr_auto]">
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Singular
                    </label>
                    <Input
                      value={level.label}
                      onChange={(e) => updateLevel(index, 'label', e.target.value)}
                      placeholder="Grade"
                      className="h-9 border-input/60 bg-background"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Plural
                    </label>
                    <Input
                      value={level.labelPlural}
                      onChange={(e) => updateLevel(index, 'labelPlural', e.target.value)}
                      placeholder="Grades"
                      className="h-9 border-input/60 bg-background"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Role
                    </label>
                    <button
                      type="button"
                      onClick={() => updateLevel(index, 'isLeaf', !level.isLeaf)}
                      className={cn(
                        'flex h-9 w-full items-center justify-center gap-1.5 rounded-md border-2 px-3 text-xs font-medium transition-all',
                        level.isLeaf
                          ? 'border-[hsl(var(--brand-cyan))] bg-[hsl(var(--brand-cyan)/0.08)] text-primary shadow-sm'
                          : 'border-input/60 bg-background text-muted-foreground hover:border-input'
                      )}
                    >
                      <Users className="h-3.5 w-3.5" />
                      {level.isLeaf ? 'Students enroll here' : 'Container'}
                    </button>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeLevel(index)}
                  disabled={levels.length <= 1}
                  className="text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between rounded-b-2xl border-t bg-muted/30 px-6 py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={saving}
            className="gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {scope === TENANT_SCOPE ? 'Reset to system default' : 'Use tenant default'}
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving' : 'Save changes'}
          </Button>
        </div>
      </div>

      {/* Helper rail */}
      <div className="grid gap-4 sm:grid-cols-3">
        <HelperCard
          title="Container levels"
          body="Top-down groupings like Grade or Department. Used for organization and reporting — never hold students directly."
          icon={<Layers className="h-4 w-4" />}
        />
        <HelperCard
          title="The leaf level"
          body="The single level where students are enrolled. Usually a Section, but can be anything that fits your model."
          icon={<Users className="h-4 w-4" />}
          accent
        />
        <HelperCard
          title="Per-branch overrides"
          body="A multi-institution group can override the tenant default per branch — a school branch and a college branch can each have their own."
          icon={<Building2 className="h-4 w-4" />}
        />
      </div>
    </div>
  );
}

function HelperCard({
  title,
  body,
  icon,
  accent,
}: {
  title: string;
  body: string;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border bg-card p-5 transition-all hover:shadow-sm',
        accent && 'border-[hsl(var(--brand-cyan)/0.4)] bg-[hsl(var(--brand-cyan)/0.04)]'
      )}
    >
      <div
        className={cn(
          'mb-3 inline-flex h-8 w-8 items-center justify-center rounded-md',
          accent ? 'bg-[hsl(var(--brand-cyan)/0.15)] text-primary' : 'bg-primary/5 text-primary/70'
        )}
      >
        {icon}
      </div>
      <h4 className="text-sm font-semibold tracking-tight text-foreground">{title}</h4>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

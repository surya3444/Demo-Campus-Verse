'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import {
  Loader2,
  Mail,
  Phone,
  Building2,
  Search,
  MessageSquare,
  Plus,
  Calendar,
  AlertCircle,
  Settings,
  Sparkles,
  Trophy,
  Frown,
  Inbox,
  PhoneCall,
  CalendarClock,
  Users,
  TrendingUp,
  TrendingDown,
  Clock,
  RefreshCw,
  ArrowRight,
  KanbanSquare,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  leadsApi,
  pipelineApi,
  type LeadStage,
  type MarketingLead,
  type PipelineStage,
} from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { STAGE_COLOR_MAP, ORPHAN_HEADER_CLASSES } from '@/components/leads/stage-colors';
import { StageSettingsDialog } from '@/components/leads/StageSettingsDialog';
import { KpiStrip, type KpiItem } from '@/components/dashboard/KpiStrip';

const ORPHAN_DROPPABLE_ID = '__orphan__';

/* ────────────────────────── Helpers ────────────────────────── */

function timeAgo(input: string | Date): string {
  const date = new Date(input);
  const diff = Date.now() - date.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 45) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const wk = Math.floor(day / 7);
  if (wk < 4) return `${wk}w ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(day / 365)}y ago`;
}

function initialsFor(first: string, last?: string): string {
  const a = first.trim()[0]?.toUpperCase() || '';
  const b = last?.trim()[0]?.toUpperCase() || '';
  return a + b || '?';
}

interface StageEmpty {
  icon: LucideIcon;
  copy: string;
}

/** Per-key copy for known/permanent stages. Custom stages fall back to a generic message. */
const EMPTY_STATE_BY_KEY: Record<string, StageEmpty> = {
  new: { icon: Inbox, copy: 'New requests will land here' },
  contacted: { icon: PhoneCall, copy: 'Move here after first reach-out' },
  demo_scheduled: { icon: CalendarClock, copy: 'Demo on the calendar' },
  qualified: { icon: Sparkles, copy: 'Strong-fit prospects' },
  won: { icon: Trophy, copy: 'Celebrate the closed deals' },
  lost: { icon: Frown, copy: 'Learn from these' },
};

const GENERIC_EMPTY: StageEmpty = { icon: ArrowRight, copy: 'Drag a card here' };

/* ────────────────────────── Page ────────────────────────── */

export default function LeadsKanbanPage() {
  const [pipeline, setPipeline] = useState<PipelineStage[]>([]);
  const [leads, setLeads] = useState<MarketingLead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<MarketingLead | null>(null);
  const [noteText, setNoteText] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [showLostDialog, setShowLostDialog] = useState(false);
  const [pendingLostMove, setPendingLostMove] = useState<{
    leadId: string;
    fromStage: LeadStage;
  } | null>(null);
  const [lostReason, setLostReason] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchAll = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (opts.silent) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      const [pipelineRes, leadsRes] = await Promise.all([pipelineApi.get(), leadsApi.list()]);
      if (pipelineRes.success) setPipeline(pipelineRes.data);
      if (leadsRes.success) setLeads(leadsRes.data);
    } catch (err) {
      console.error('Failed to load leads or pipeline', err);
      toast.error('Failed to load leads');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const filteredLeads = useMemo(() => {
    if (!search.trim()) return leads;
    const q = search.toLowerCase();
    return leads.filter(
      (l) =>
        l.firstName.toLowerCase().includes(q) ||
        l.lastName?.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        l.institution.toLowerCase().includes(q)
    );
  }, [leads, search]);

  const grouped = useMemo(() => {
    const knownKeys = new Set(pipeline.map((s) => s.key));
    const map: Record<string, MarketingLead[]> = {};
    for (const s of pipeline) map[s.key] = [];
    const orphans: MarketingLead[] = [];
    for (const lead of filteredLeads) {
      if (knownKeys.has(lead.stage)) map[lead.stage].push(lead);
      else orphans.push(lead);
    }
    return { map, orphans };
  }, [filteredLeads, pipeline]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of pipeline) c[s.key] = grouped.map[s.key]?.length || 0;
    return c;
  }, [pipeline, grouped]);

  /** Computed KPIs from the unfiltered lead set so they don't shift while searching. */
  const kpis = useMemo(() => {
    const now = Date.now();
    const week = 7 * 24 * 60 * 60 * 1000;
    const total = leads.length;
    const thisWeek = leads.filter((l) => now - new Date(l.createdAt).getTime() < week).length;
    const lastWeek = leads.filter((l) => {
      const t = now - new Date(l.createdAt).getTime();
      return t >= week && t < 2 * week;
    }).length;
    const won = leads.filter((l) => l.stage === 'won');
    const lost = leads.filter((l) => l.stage === 'lost').length;
    const closed = won.length + lost;
    const winRate = closed > 0 ? Math.round((won.length / closed) * 100) : null;
    const avgDaysToWon = (() => {
      const durations = won
        .map((l) => {
          const created = new Date(l.createdAt).getTime();
          const wonAt = l.wonAt ? new Date(l.wonAt).getTime() : null;
          if (!wonAt) return null;
          return (wonAt - created) / (1000 * 60 * 60 * 24);
        })
        .filter((v): v is number => v !== null && v >= 0);
      if (durations.length === 0) return null;
      const mean = durations.reduce((a, b) => a + b, 0) / durations.length;
      return Math.round(mean);
    })();

    return {
      total,
      thisWeek,
      thisWeekDelta: thisWeek - lastWeek,
      winRate,
      winRateNum: { won: won.length, closed },
      avgDaysToWon,
    };
  }, [leads]);

  const kpiItems: KpiItem[] = [
    {
      label: 'Total leads',
      value: kpis.total.toLocaleString(),
      icon: Users,
      footnote:
        kpis.total === 0 ? (
          <span className="text-muted-foreground">No leads captured yet</span>
        ) : (
          <span className="text-muted-foreground">All time</span>
        ),
    },
    {
      label: 'This week',
      value: kpis.thisWeek.toLocaleString(),
      icon: Sparkles,
      accent: kpis.thisWeek > 0,
      footnote:
        kpis.thisWeek === 0 && kpis.thisWeekDelta === 0 ? (
          <span className="text-muted-foreground">Quiet week so far</span>
        ) : kpis.thisWeekDelta > 0 ? (
          <span className="text-success inline-flex items-center gap-1">
            <TrendingUp className="h-3 w-3" /> +{kpis.thisWeekDelta} vs last week
          </span>
        ) : kpis.thisWeekDelta < 0 ? (
          <span className="text-destructive inline-flex items-center gap-1">
            <TrendingDown className="h-3 w-3" /> {kpis.thisWeekDelta} vs last week
          </span>
        ) : (
          <span className="text-muted-foreground">Same as last week</span>
        ),
    },
    {
      label: 'Win rate',
      value: kpis.winRate === null ? '—' : `${kpis.winRate}%`,
      icon: Trophy,
      footnote:
        kpis.winRateNum.closed === 0 ? (
          <span className="text-muted-foreground">No closed deals yet</span>
        ) : (
          <span className="text-muted-foreground">
            {kpis.winRateNum.won} won of {kpis.winRateNum.closed} closed
          </span>
        ),
    },
    {
      label: 'Avg time to win',
      value: kpis.avgDaysToWon === null ? '—' : `${kpis.avgDaysToWon}d`,
      icon: Clock,
      footnote:
        kpis.avgDaysToWon === null ? (
          <span className="text-muted-foreground">Need at least 1 win</span>
        ) : (
          <span className="text-muted-foreground">From capture to closed-won</span>
        ),
    },
  ];

  const moveLead = async (leadId: string, toStage: LeadStage, reason?: string) => {
    const previous = leads;
    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? { ...l, stage: toStage, lostReason: toStage === 'lost' ? reason : undefined }
          : l
      )
    );
    try {
      const res = await leadsApi.updateStage(leadId, toStage, reason);
      if (res.success) {
        setLeads((prev) => prev.map((l) => (l.id === leadId ? res.data : l)));
        if (selected?.id === leadId) setSelected(res.data);
        toast.success(`Moved to ${pipeline.find((s) => s.key === toStage)?.label || toStage}`);
      }
    } catch (err) {
      console.error('Failed to update lead stage', err);
      toast.error('Failed to update lead stage');
      setLeads(previous);
    }
  };

  const handleDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId) return;
    if (destination.droppableId === ORPHAN_DROPPABLE_ID) return;

    const toStage = destination.droppableId;
    if (toStage === 'lost') {
      setPendingLostMove({ leadId: draggableId, fromStage: source.droppableId });
      setLostReason('');
      setShowLostDialog(true);
      return;
    }
    moveLead(draggableId, toStage);
  };

  const confirmLost = async () => {
    if (!pendingLostMove) return;
    await moveLead(pendingLostMove.leadId, 'lost', lostReason.trim() || undefined);
    setShowLostDialog(false);
    setPendingLostMove(null);
    setLostReason('');
  };

  const handleAddNote = async () => {
    if (!selected || !noteText.trim()) return;
    setIsAddingNote(true);
    try {
      const res = await leadsApi.addNote(selected.id, noteText.trim());
      if (res.success) {
        setSelected(res.data);
        setLeads((prev) => prev.map((l) => (l.id === res.data.id ? res.data : l)));
        setNoteText('');
        toast.success('Note added');
      }
    } catch (err) {
      console.error('Failed to add note', err);
      toast.error('Failed to add note');
    } finally {
      setIsAddingNote(false);
    }
  };

  const handleDeleteLead = async () => {
    if (!selected) return;
    setIsDeleting(true);
    try {
      const res = await leadsApi.delete(selected.id);
      if (res.success) {
        setLeads((prev) => prev.filter((l) => l.id !== selected.id));
        setShowDeleteConfirm(false);
        setSelected(null);
        setNoteText('');
        toast.success('Lead deleted');
      }
    } catch (err) {
      console.error('Failed to delete lead', err);
      toast.error('Failed to delete lead');
    } finally {
      setIsDeleting(false);
    }
  };

  const columns = useMemo(() => {
    const cols: Array<{ kind: 'stage'; stage: PipelineStage } | { kind: 'orphan' }> = pipeline.map(
      (s) => ({ kind: 'stage' as const, stage: s })
    );
    if (grouped.orphans.length > 0) cols.push({ kind: 'orphan' as const });
    return cols;
  }, [pipeline, grouped.orphans.length]);

  return (
    <div className="-m-8 h-[calc(100%+4rem)] flex flex-col overflow-hidden bg-[radial-gradient(circle_at_1px_1px,_rgba(15,23,42,0.04)_1px,_transparent_0)] [background-size:24px_24px]">
      {/* ─── Pinned top: hero + KPIs ─── */}
      <div className="px-8 pt-8 pb-5 space-y-6 shrink-0">
        {/* Editorial header */}
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2 min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
              <KanbanSquare className="h-3 w-3 shrink-0 text-[hsl(var(--brand-cyan))]" />
              <span>Lead Pipeline</span>
              <span className="hidden h-px w-8 bg-border sm:block" />
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            </div>
            <h1 className="font-display text-3xl font-bold leading-[1.15] tracking-tight text-foreground md:text-4xl">
              Track every{' '}
              <span className="bg-gradient-to-r from-primary via-primary to-[hsl(var(--brand-cyan))] bg-clip-text text-transparent">
                demo request
              </span>{' '}
              to close.
            </h1>
            <p className="text-sm text-muted-foreground max-w-xl">
              Demo requests from the marketing site. Drag a card across columns to update its stage.
            </p>
          </div>
          <div className="flex items-center gap-2 lg:w-auto">
            <div className="relative flex-1 lg:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or institution"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-10 bg-white shadow-xs"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => fetchAll({ silent: true })}
              disabled={isRefreshing || isLoading}
              aria-label="Refresh"
              className="bg-white shadow-xs"
            >
              <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowSettings(true)}
              disabled={pipeline.length === 0}
              className="bg-white shadow-xs"
            >
              <Settings className="h-4 w-4 mr-1.5" />
              Manage stages
            </Button>
          </div>
        </header>

        {/* Unified KPI strip — same vocabulary as the dashboard */}
        <KpiStrip ariaLabel="Lead KPIs" loading={isLoading} items={kpiItems} />
      </div>

      {/* ─── Board: takes remaining height. Only the inner row scrolls horizontally. ─── */}
      <div className="flex-1 min-h-0 px-8 pb-8 overflow-hidden">
        {isLoading ? (
          <BoardSkeleton />
        ) : columns.length === 0 ? (
          <EmptyBoard onManage={() => setShowSettings(true)} />
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="h-full overflow-x-auto -mx-1 px-1 pb-1">
              <div className="flex gap-4 h-full">
                {columns.map((col) => {
                  if (col.kind === 'orphan') {
                    return (
                      <OrphanColumn
                        key="orphan"
                        leads={grouped.orphans}
                        onSelect={(l) => setSelected(l)}
                      />
                    );
                  }
                  const { stage } = col;
                  const items = grouped.map[stage.key] || [];
                  return (
                    <StageColumn
                      key={stage.key}
                      stage={stage}
                      leads={items}
                      onSelect={(l) => setSelected(l)}
                    />
                  );
                })}
              </div>
            </div>
          </DragDropContext>
        )}
      </div>

      {/* Lead detail dialog */}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
            setNoteText('');
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          {selected &&
            (() => {
              const stageInfo = pipeline.find((s) => s.key === selected.stage);
              const tone = stageInfo ? STAGE_COLOR_MAP[stageInfo.color] : null;
              return (
                <>
                  <DialogHeader>
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'h-12 w-12 rounded-full flex items-center justify-center font-display text-base font-semibold ring-2 ring-white',
                          tone?.avatarBg || 'bg-zinc-100',
                          tone?.avatarText || 'text-zinc-700'
                        )}
                      >
                        {initialsFor(selected.firstName, selected.lastName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <DialogTitle className="text-lg flex items-center gap-2 flex-wrap">
                          {selected.firstName} {selected.lastName || ''}
                          <Badge className={cn('font-medium', tone?.chip || ORPHAN_HEADER_CLASSES)}>
                            <span
                              className={cn(
                                'h-1.5 w-1.5 rounded-full mr-1.5',
                                tone?.dot || 'bg-zinc-500'
                              )}
                            />
                            {stageInfo?.label || `Unknown: ${selected.stage}`}
                          </Badge>
                        </DialogTitle>
                        <DialogDescription className="mt-0.5">
                          Captured {timeAgo(selected.createdAt)} ·{' '}
                          {new Date(selected.createdAt).toLocaleDateString()}
                        </DialogDescription>
                      </div>
                    </div>
                  </DialogHeader>

                  <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1 -mr-1">
                    {/* Contact card */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <ContactRow
                        icon={Building2}
                        label="Institution"
                        value={selected.institution}
                      />
                      <ContactRow
                        icon={Sparkles}
                        label="Type"
                        value={selected.institutionType || '—'}
                      />
                      <ContactRow
                        icon={Mail}
                        label="Email"
                        value={
                          <a
                            href={`mailto:${selected.email}`}
                            className="text-primary hover:underline"
                          >
                            {selected.email}
                          </a>
                        }
                      />
                      <ContactRow
                        icon={Phone}
                        label="Phone"
                        value={
                          selected.phone ? (
                            <a
                              href={`tel:${selected.phone}`}
                              className="text-primary hover:underline"
                            >
                              {selected.phone}
                            </a>
                          ) : (
                            '—'
                          )
                        }
                      />
                    </div>

                    {selected.message && (
                      <div className="bg-muted/60 border rounded-lg p-3 text-sm">
                        <div className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
                          Message
                        </div>
                        <div className="whitespace-pre-wrap leading-relaxed">
                          {selected.message}
                        </div>
                      </div>
                    )}

                    {selected.lostReason && (
                      <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm">
                        <div className="text-xs font-medium text-rose-700 mb-1.5 flex items-center gap-1 uppercase tracking-wide">
                          <AlertCircle className="h-3.5 w-3.5" />
                          Lost reason
                        </div>
                        <div className="text-rose-900 whitespace-pre-wrap">
                          {selected.lostReason}
                        </div>
                      </div>
                    )}

                    {/* Stage selector */}
                    <div>
                      <Label className="text-xs font-medium mb-2 flex items-center gap-1.5 uppercase tracking-wide text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" /> Stage
                      </Label>
                      <div className="flex flex-wrap gap-1.5">
                        {pipeline.map((s) => {
                          const active = selected.stage === s.key;
                          const c = STAGE_COLOR_MAP[s.color];
                          return (
                            <button
                              key={s.key}
                              type="button"
                              onClick={() => {
                                if (selected.stage === s.key) return;
                                if (s.key === 'lost') {
                                  setPendingLostMove({
                                    leadId: selected.id,
                                    fromStage: selected.stage,
                                  });
                                  setLostReason('');
                                  setShowLostDialog(true);
                                } else {
                                  moveLead(selected.id, s.key);
                                }
                              }}
                              className={cn(
                                'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all',
                                active
                                  ? cn(c.chip, 'border-transparent shadow-soft')
                                  : 'bg-white border-border hover:border-foreground/20 text-muted-foreground hover:text-foreground'
                              )}
                            >
                              <span className={cn('h-1.5 w-1.5 rounded-full', c.dot)} />
                              {s.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Notes thread */}
                    <div>
                      <Label className="text-xs font-medium mb-2 flex items-center gap-1.5 uppercase tracking-wide text-muted-foreground">
                        <MessageSquare className="h-3.5 w-3.5" /> Notes ({selected.notes.length})
                      </Label>
                      <div className="space-y-2 mb-3">
                        {selected.notes.length === 0 && (
                          <div className="text-xs text-muted-foreground italic border border-dashed rounded-lg p-3 text-center">
                            No notes yet — add the first one below
                          </div>
                        )}
                        {selected.notes.map((n) => (
                          <div key={n.id} className="bg-muted/40 border rounded-lg p-3 text-sm">
                            <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
                              <span className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-2xs font-semibold">
                                {(n.createdByName || 'A')[0]?.toUpperCase()}
                              </span>
                              {n.createdByName || 'Admin'} · {timeAgo(n.createdAt)}
                            </div>
                            <div className="whitespace-pre-wrap pl-6">{n.note}</div>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Textarea
                          placeholder="Add a note about this lead…"
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          rows={2}
                          className="flex-1"
                        />
                        <Button
                          onClick={handleAddNote}
                          disabled={isAddingNote || !noteText.trim()}
                          className="self-end"
                        >
                          {isAddingNote ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Danger zone */}
                    <div className="border-t pt-4 flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        Permanently remove this enquiry from the pipeline.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowDeleteConfirm(true)}
                        className="text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                        Delete lead
                      </Button>
                    </div>
                  </div>
                </>
              );
            })()}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={showDeleteConfirm}
        onOpenChange={(open) => {
          if (!open) setShowDeleteConfirm(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this lead?</DialogTitle>
            <DialogDescription>
              {selected
                ? `${[selected.firstName, selected.lastName].filter(Boolean).join(' ')} — ${selected.institution}`
                : ''}
              <br />
              This permanently removes the enquiry and its notes. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteLead} disabled={isDeleting}>
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1.5" />
              )}
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lost reason dialog */}
      <Dialog
        open={showLostDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowLostDialog(false);
            setPendingLostMove(null);
            setLostReason('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark lead as lost</DialogTitle>
            <DialogDescription>
              Optionally add a reason. This helps the team learn from lost leads.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason (optional) — e.g. budget, timing, chose competitor"
            value={lostReason}
            onChange={(e) => setLostReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowLostDialog(false);
                setPendingLostMove(null);
                setLostReason('');
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmLost}>
              Mark as Lost
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stage settings dialog */}
      <StageSettingsDialog
        open={showSettings}
        onOpenChange={setShowSettings}
        stages={pipeline}
        counts={counts}
        onPipelineChange={(next) => setPipeline(next)}
      />
    </div>
  );
}

/* ────────────────────────── Sub-components ────────────────────────── */

interface ContactRowProps {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
}

function ContactRow({ icon: Icon, label, value }: ContactRowProps) {
  return (
    <div className="flex items-center gap-2.5 bg-muted/30 border rounded-lg px-3 py-2">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-2xs uppercase tracking-wide text-muted-foreground font-medium">
          {label}
        </div>
        <div className="text-sm truncate">{value}</div>
      </div>
    </div>
  );
}

interface StageColumnProps {
  stage: PipelineStage;
  leads: MarketingLead[];
  onSelect: (lead: MarketingLead) => void;
}

function StageColumn({ stage, leads, onSelect }: StageColumnProps) {
  const c = STAGE_COLOR_MAP[stage.color] || STAGE_COLOR_MAP.slate;
  const empty = EMPTY_STATE_BY_KEY[stage.key] || GENERIC_EMPTY;
  const EmptyIcon = empty.icon;

  return (
    <div className="w-[300px] shrink-0 flex flex-col h-full">
      {/* Saturated top accent bar */}
      <div className={cn('h-1 rounded-t-xl shrink-0', c.accent)} />
      {/* Header */}
      <div className="bg-white border border-b-0 rounded-none px-3 py-2.5 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn('h-2 w-2 rounded-full shrink-0', c.dot)} />
          <span className="font-medium text-sm truncate">{stage.label}</span>
        </div>
        <span
          className={cn(
            'text-2xs font-semibold tabular-nums px-2 py-0.5 rounded-full shrink-0',
            c.chip
          )}
        >
          {leads.length}
        </span>
      </div>
      {/* Drop area */}
      <Droppable droppableId={stage.key}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              'flex-1 min-h-0 p-2 rounded-b-xl border border-t-0 transition-colors overflow-y-auto',
              snapshot.isDraggingOver ? c.hoverBg : 'bg-white'
            )}
          >
            {leads.length === 0 && (
              <div
                className={cn(
                  'flex flex-col items-center justify-center text-center py-10 px-3 rounded-lg border border-dashed',
                  snapshot.isDraggingOver ? 'border-transparent' : 'border-border/60',
                  c.softBg
                )}
              >
                <div
                  className={cn(
                    'h-10 w-10 rounded-full flex items-center justify-center mb-2',
                    c.avatarBg
                  )}
                >
                  <EmptyIcon className={cn('h-5 w-5', c.iconTint)} />
                </div>
                <p className="text-xs text-muted-foreground max-w-[180px] leading-relaxed">
                  {empty.copy}
                </p>
              </div>
            )}

            {leads.map((lead, index) => (
              <Draggable key={lead.id} draggableId={lead.id} index={index}>
                {(prov, snap) => (
                  <div
                    ref={prov.innerRef}
                    {...prov.draggableProps}
                    {...prov.dragHandleProps}
                    onClick={() => onSelect(lead)}
                    className={cn(
                      'relative bg-white rounded-lg border p-3 mb-2 cursor-pointer transition-all',
                      'hover:border-foreground/15 hover:shadow-soft',
                      snap.isDragging && 'shadow-soft-md ring-2 ring-primary/20 rotate-1'
                    )}
                  >
                    {/* Stage-colored left rail */}
                    <span
                      className={cn('absolute left-0 top-2 bottom-2 w-[3px] rounded-r-sm', c.rail)}
                    />
                    <LeadCardBody lead={lead} tone={c} />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}

interface LeadCardBodyProps {
  lead: MarketingLead;
  tone: (typeof STAGE_COLOR_MAP)[keyof typeof STAGE_COLOR_MAP];
}

function LeadCardBody({ lead, tone }: LeadCardBodyProps) {
  return (
    <div className="pl-2.5">
      <div className="flex items-start gap-2.5">
        <div
          className={cn(
            'h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-xs font-display font-semibold',
            tone.avatarBg,
            tone.avatarText
          )}
        >
          {initialsFor(lead.firstName, lead.lastName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm leading-tight truncate">
            {lead.firstName} {lead.lastName || ''}
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
            <Building2 className="h-3 w-3 shrink-0" />
            <span className="truncate">{lead.institution}</span>
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
            <Mail className="h-3 w-3 shrink-0" />
            <span className="truncate">{lead.email}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-border/60 gap-2">
        <div className="flex items-center gap-1 min-w-0">
          {lead.institutionType && (
            <Badge variant="outline" className="text-2xs px-1.5 py-0 truncate max-w-[120px]">
              {lead.institutionType}
            </Badge>
          )}
          {lead.notes.length > 0 && (
            <span className="text-2xs text-muted-foreground inline-flex items-center gap-0.5">
              <MessageSquare className="h-3 w-3" />
              {lead.notes.length}
            </span>
          )}
        </div>
        <span className="text-2xs text-muted-foreground tabular-nums shrink-0">
          {timeAgo(lead.createdAt)}
        </span>
      </div>
    </div>
  );
}

interface OrphanColumnProps {
  leads: MarketingLead[];
  onSelect: (lead: MarketingLead) => void;
}

function OrphanColumn({ leads, onSelect }: OrphanColumnProps) {
  return (
    <div className="w-[300px] shrink-0 flex flex-col h-full">
      <div className="h-1 rounded-t-xl bg-zinc-300 shrink-0" />
      <div
        className={cn(
          'bg-white border border-b-0 rounded-none px-3 py-2.5 flex items-center justify-between gap-2 shrink-0',
          ORPHAN_HEADER_CLASSES.includes('border-dashed') && 'border-dashed'
        )}
      >
        <span className="font-medium text-sm flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 text-zinc-500" />
          Unassigned
        </span>
        <span className="text-2xs font-semibold tabular-nums px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700">
          {leads.length}
        </span>
      </div>
      <Droppable droppableId={ORPHAN_DROPPABLE_ID} isDropDisabled>
        {(provided) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="flex-1 min-h-0 p-2 rounded-b-xl border border-dashed border-t-0 bg-zinc-50/40 overflow-y-auto"
          >
            <p className="text-2xs text-muted-foreground italic mb-2 leading-relaxed">
              These leads have stages not in the current pipeline. Open one and reassign from the
              detail view.
            </p>
            {leads.map((lead, index) => (
              <Draggable key={lead.id} draggableId={lead.id} index={index} isDragDisabled>
                {(prov) => (
                  <div
                    ref={prov.innerRef}
                    {...prov.draggableProps}
                    {...prov.dragHandleProps}
                    onClick={() => onSelect(lead)}
                    className="bg-white rounded-lg border border-dashed p-3 mb-2 cursor-pointer hover:border-primary/40 transition-all"
                  >
                    <div className="font-medium text-sm">
                      {lead.firstName} {lead.lastName || ''}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Stage: <code className="text-2xs">{lead.stage}</code>
                    </div>
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div className="flex gap-4 overflow-hidden -mx-1 px-1 h-full">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="w-[300px] shrink-0 flex flex-col h-full">
          <div className="h-1 rounded-t-xl bg-slate-200 shrink-0" />
          <div className="bg-white border border-b-0 px-3 py-2.5 flex items-center justify-between shrink-0">
            <div className="h-4 w-24 bg-muted/70 rounded animate-pulse" />
            <div className="h-5 w-8 bg-muted/70 rounded-full animate-pulse" />
          </div>
          <div className="flex-1 min-h-0 p-2 rounded-b-xl border border-t-0 bg-white space-y-2 overflow-hidden">
            {Array.from({ length: 2 }).map((_, j) => (
              <div
                key={j}
                className="bg-muted/40 rounded-lg h-24 animate-pulse"
                style={{ animationDelay: `${(i + j) * 80}ms` }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyBoard({ onManage }: { onManage: () => void }) {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="bg-white border rounded-xl p-12 text-center max-w-md w-full shadow-xs">
        <div className="h-12 w-12 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center mb-3">
          <Sparkles className="h-6 w-6" />
        </div>
        <h2 className="font-display text-lg font-semibold">No stages configured</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
          Add stages to start tracking leads through your sales pipeline.
        </p>
        <Button onClick={onManage} className="mt-4">
          <Settings className="h-4 w-4 mr-1.5" /> Set up pipeline
        </Button>
      </div>
    </div>
  );
}

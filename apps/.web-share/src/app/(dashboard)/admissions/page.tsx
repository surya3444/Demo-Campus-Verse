'use client';

import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  RefreshCw,
  LayoutList,
  Kanban,
  GanttChart,
  CalendarDays,
  Plus,
  Users,
  FileText,
  TrendingUp,
} from 'lucide-react';
import { admissionsApi } from '@/lib/api';
import { KanbanBoard, PIPELINE_STAGES } from './components/KanbanBoard';
import { PipelineCard } from './components/KanbanCard';
import { ListView } from './components/ListView';
import { GanttView } from './components/GanttView';
import { CalendarView } from './components/CalendarView';
import { AddLeadDialog } from './components/AddLeadDialog';
import { CardDetailSheet } from './components/CardDetailSheet';
import { ConvertLeadDialog } from './components/ConvertLeadDialog';
import { EnrollApplicationDialog } from './components/EnrollApplicationDialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface PipelineData {
  stages: {
    [key: string]: {
      cards: PipelineCard[];
      count: number;
    };
  };
  stats: {
    total: number;
    leads: number;
    applications: number;
    byStage: Record<string, number>;
  };
}

interface Source {
  _id: string;
  code: string;
  name: string;
  isActive: boolean;
}

// Default Tailwind color map for stages — used when rendering columns for
// stages fetched from settings. The hex color from the DB is used for
// badges/dots; these Tailwind classes are used for the column background.
const STAGE_TAILWIND_COLORS: Record<
  string,
  { color: string; bgColor: string; borderColor: string }
> = {
  new: { color: 'bg-slate-500', bgColor: 'bg-slate-100', borderColor: 'border-slate-200' },
  contacted: { color: 'bg-blue-500', bgColor: 'bg-blue-100', borderColor: 'border-blue-200' },
  interested: {
    color: 'bg-purple-500',
    bgColor: 'bg-purple-100',
    borderColor: 'border-purple-200',
  },
  followup: { color: 'bg-orange-500', bgColor: 'bg-orange-100', borderColor: 'border-orange-200' },
  visit_scheduled: {
    color: 'bg-indigo-500',
    bgColor: 'bg-indigo-100',
    borderColor: 'border-indigo-200',
  },
  visited: { color: 'bg-teal-500', bgColor: 'bg-teal-100', borderColor: 'border-teal-200' },
  applied: { color: 'bg-amber-500', bgColor: 'bg-amber-100', borderColor: 'border-amber-200' },
  docs_verified: { color: 'bg-cyan-500', bgColor: 'bg-cyan-100', borderColor: 'border-cyan-200' },
  fee_paid: {
    color: 'bg-emerald-500',
    bgColor: 'bg-emerald-100',
    borderColor: 'border-emerald-200',
  },
  enrolled: { color: 'bg-green-600', bgColor: 'bg-green-100', borderColor: 'border-green-200' },
  converted: { color: 'bg-green-500', bgColor: 'bg-green-100', borderColor: 'border-green-200' },
  lost: { color: 'bg-red-500', bgColor: 'bg-red-100', borderColor: 'border-red-200' },
};
const DEFAULT_STAGE_COLORS = {
  color: 'bg-gray-500',
  bgColor: 'bg-gray-100',
  borderColor: 'border-gray-200',
};

// Application stages that aren't part of enquiry settings but always show in the pipeline
const HARDCODED_APP_STAGES = [
  { key: 'docs_verified', label: 'Docs Verified' },
  { key: 'fee_paid', label: 'Fee Paid' },
];

export default function AdmissionsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PipelineData | null>(null);
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('all');
  const [sources, setSources] = useState<Source[]>([]);
  // Dynamic stage config built from admission settings — drives the kanban
  // column order so it stays in sync with the settings page.
  const [pipelineStages, setPipelineStages] = useState<
    Array<{ key: string; label: string; color: string; bgColor: string; borderColor: string }>
  >([]);

  // Dialog states
  const [addLeadOpen, setAddLeadOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<PipelineCard | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [cardToConvert, setCardToConvert] = useState<PipelineCard | null>(null);
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  const [cardToEnroll, setCardToEnroll] = useState<PipelineCard | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'gantt' | 'calendar'>('kanban');

  const fetchPipeline = useCallback(async () => {
    try {
      setLoading(true);
      const response = await admissionsApi.getPipeline({
        search: search || undefined,
        source: source === 'all' ? undefined : source,
      });

      if (response.success) {
        setData(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch pipeline:', error);
      toast.error('Failed to load admissions data');
    } finally {
      setLoading(false);
    }
  }, [search, source]);

  // Fetch admission settings to build the pipeline column order dynamically.
  // This runs once on mount so the kanban reflects the latest stage ordering
  // from the settings page without hardcoding.
  const fetchStageConfig = useCallback(async () => {
    try {
      const response = await admissionsApi.getSettings();
      if (response?.success && response.data?.enquiryStages) {
        const enquiryStages = (
          response.data.enquiryStages as Array<{
            code: string;
            name: string;
            order: number;
            isTerminal?: boolean;
          }>
        )
          .filter((s) => !s.isTerminal) // terminal stages don't show as pipeline columns
          .sort((a, b) => a.order - b.order);

        // Build column configs: enquiry stages in settings order, with
        // docs_verified and fee_paid injected between applied and enrolled
        // (they're application-status stages not in enquiry settings).
        const cols: typeof pipelineStages = [];
        for (const s of enquiryStages) {
          const tw = STAGE_TAILWIND_COLORS[s.code] || DEFAULT_STAGE_COLORS;
          cols.push({ key: s.code, label: s.name, ...tw });

          // After "applied", inject the intermediate application stages
          if (s.code === 'applied') {
            for (const app of HARDCODED_APP_STAGES) {
              const appTw = STAGE_TAILWIND_COLORS[app.key] || DEFAULT_STAGE_COLORS;
              cols.push({ key: app.key, label: app.label, ...appTw });
            }
          }
        }
        setPipelineStages(cols);
      }
    } catch (error) {
      console.error('Failed to fetch stage config:', error);
      // Fallback: use the existing hardcoded stages from KanbanBoard
    }
  }, []);

  useEffect(() => {
    fetchPipeline();
    fetchSources();
    fetchStageConfig();
  }, [fetchPipeline, fetchStageConfig]);

  const fetchSources = async () => {
    try {
      const response = await admissionsApi.getSources();
      if (response.success && response.data) {
        const activeSources = response.data.filter((s: Source) => s.isActive);
        setSources(activeSources);
      }
    } catch (error) {
      console.error('Failed to fetch sources:', error);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPipeline();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, fetchPipeline]);

  // Refetch when tab regains focus or becomes visible — keeps the kanban
  // in sync with leads created in another tab/page.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        fetchPipeline();
      }
    };
    window.addEventListener('focus', fetchPipeline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', fetchPipeline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchPipeline]);

  const handleCardView = (card: PipelineCard) => {
    setSelectedCard(card);
    setDetailSheetOpen(true);
  };

  const handleConvertLead = (card: PipelineCard) => {
    setCardToConvert(card);
    setConvertDialogOpen(true);
  };

  const handleEnrollApplication = (card: PipelineCard) => {
    setCardToEnroll(card);
    setEnrollDialogOpen(true);
  };

  const VIEW_OPTIONS = [
    { key: 'list' as const, label: 'List', icon: LayoutList },
    { key: 'kanban' as const, label: 'Kanban', icon: Kanban },
    { key: 'gantt' as const, label: 'Timeline', icon: GanttChart },
    { key: 'calendar' as const, label: 'Calendar', icon: CalendarDays },
  ];

  return (
    <div className="space-y-5">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admissions Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track and manage prospective students
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Toggle - Enhanced with clear active state */}
          <div className="inline-flex items-center rounded-lg border border-border/60 bg-muted/30 p-1 shadow-sm">
            {VIEW_OPTIONS.map((view) => {
              const isActive = viewMode === view.key;
              const Icon = view.icon;
              return (
                <button
                  key={view.key}
                  onClick={() => setViewMode(view.key)}
                  className={cn(
                    'relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200',
                    isActive
                      ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
                      : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                  )}
                >
                  <Icon className={cn('h-3.5 w-3.5', isActive && 'text-primary')} />
                  <span className="hidden sm:inline">{view.label}</span>
                </button>
              );
            })}
          </div>

          <Button onClick={() => setAddLeadOpen(true)} size="sm" className="shadow-sm">
            <Plus className="h-4 w-4 mr-1.5" />
            Add Lead
          </Button>
        </div>
      </div>

      {/* Stats Summary Bar */}
      {data && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200/50 dark:border-blue-800/50">
            <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              {data.stats.leads} Leads
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-800/50">
            <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              {data.stats.applications} Applications
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-50 dark:bg-violet-950/30 border border-violet-200/50 dark:border-violet-800/50">
            <TrendingUp className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            <span className="text-sm font-medium text-violet-700 dark:text-violet-300">
              {data.stats.total} Total
            </span>
          </div>

          {/* Stage Summary Pills */}
          <div className="hidden lg:flex items-center gap-1.5 ml-auto">
            {PIPELINE_STAGES.map((stage) => {
              const count = data?.stats.byStage?.[stage.key] || 0;
              return (
                <div
                  key={stage.key}
                  className={cn(
                    'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium',
                    stage.bgColor
                  )}
                  title={stage.label}
                >
                  <span className={cn('h-1.5 w-1.5 rounded-full', stage.color)} />
                  <span>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search leads & applications..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-9 text-sm bg-background"
          />
        </div>

        <Select value={source} onValueChange={setSource}>
          <SelectTrigger className="w-[140px] h-9 text-sm">
            <SelectValue placeholder="All Sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            {sources.map((s) => (
              <SelectItem key={s._id} value={s.code}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchPipeline}
          disabled={loading}
          className="h-9 px-3"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </Button>
      </div>

      {/* Pipeline Views */}
      {loading && !data ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {PIPELINE_STAGES.map((stage) => (
            <div key={stage.key} className="w-[280px] min-w-[280px]">
              <Skeleton className="h-10 w-full mb-2 rounded-lg" />
              <Skeleton className="h-[400px] w-full rounded-lg" />
            </div>
          ))}
        </div>
      ) : data ? (
        <>
          {viewMode === 'kanban' && (
            <KanbanBoard
              data={data}
              stages={pipelineStages.length > 0 ? pipelineStages : undefined}
              onRefresh={fetchPipeline}
              onCardView={handleCardView}
              onAddLead={() => setAddLeadOpen(true)}
              onConvertLead={handleConvertLead}
              onEnrollApplication={handleEnrollApplication}
            />
          )}
          {viewMode === 'list' && (
            <ListView
              data={data}
              onCardView={handleCardView}
              onAddLead={() => setAddLeadOpen(true)}
              onConvertLead={handleConvertLead}
            />
          )}
          {viewMode === 'gantt' && (
            <GanttView
              data={data}
              onCardView={handleCardView}
              onAddLead={() => setAddLeadOpen(true)}
            />
          )}
          {viewMode === 'calendar' && (
            <CalendarView
              data={data}
              onCardView={handleCardView}
              onAddLead={() => setAddLeadOpen(true)}
            />
          )}
        </>
      ) : (
        <div className="text-center py-12 text-muted-foreground">Failed to load pipeline data</div>
      )}

      {/* Add Lead Dialog */}
      <AddLeadDialog open={addLeadOpen} onOpenChange={setAddLeadOpen} onSuccess={fetchPipeline} />

      {/* Card Detail Sheet */}
      <CardDetailSheet
        card={selectedCard}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        onRefresh={fetchPipeline}
        onEnroll={handleEnrollApplication}
      />

      {/* Convert Lead Dialog */}
      <ConvertLeadDialog
        card={cardToConvert}
        open={convertDialogOpen}
        onOpenChange={setConvertDialogOpen}
        onSuccess={fetchPipeline}
      />

      {/* Enroll Application Dialog — opens when a card is dragged into the
          "enrolled" column, or when explicitly triggered from elsewhere. */}
      <EnrollApplicationDialog
        card={cardToEnroll}
        open={enrollDialogOpen}
        onOpenChange={setEnrollDialogOpen}
        onSuccess={fetchPipeline}
      />
    </div>
  );
}

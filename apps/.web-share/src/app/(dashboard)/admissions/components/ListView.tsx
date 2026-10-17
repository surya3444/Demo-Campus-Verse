'use client';

import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  Eye,
  Phone,
  Calendar,
  UserPlus,
  Clock,
  Sparkles,
  ExternalLink,
  User,
  FileText,
  Filter,
  X,
} from 'lucide-react';
import { PipelineCard } from './KanbanCard';
import { PIPELINE_STAGES } from './KanbanBoard';
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
  };
}

interface ListViewProps {
  data: PipelineData;
  onCardView: (card: PipelineCard) => void;
  onAddLead: () => void;
  onConvertLead: (card: PipelineCard) => void;
}

type SortField =
  | 'studentName'
  | 'stage'
  | 'type'
  | 'source'
  | 'daysInStage'
  | 'createdAt'
  | 'nextFollowupDate';
type SortDirection = 'asc' | 'desc';

const sourceConfig: Record<string, { bg: string; text: string; label: string }> = {
  website: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Website' },
  referral: { bg: 'bg-violet-50', text: 'text-violet-700', label: 'Referral' },
  walk_in: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Walk-in' },
  social_media: { bg: 'bg-pink-50', text: 'text-pink-700', label: 'Social' },
  advertisement: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Ad' },
  event: { bg: 'bg-cyan-50', text: 'text-cyan-700', label: 'Event' },
  other: { bg: 'bg-slate-50', text: 'text-slate-600', label: 'Other' },
};

const stageOrder: Record<string, number> = {
  new: 0,
  contacted: 1,
  interested: 2,
  applied: 3,
  docs_verified: 4,
  fee_paid: 5,
  enrolled: 6,
};

export function ListView({ data, onCardView, onAddLead, onConvertLead }: ListViewProps) {
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedStages, setSelectedStages] = useState<Set<string>>(new Set());

  const toggleStage = (key: string) => {
    setSelectedStages((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const clearStageFilter = () => setSelectedStages(new Set());

  const allCards = useMemo(() => {
    const cards: PipelineCard[] = [];
    Object.values(data.stages).forEach((stage) => {
      cards.push(...stage.cards);
    });
    return cards;
  }, [data]);

  // Filter by selected stages (empty = show all)
  const filteredCards = useMemo(() => {
    if (selectedStages.size === 0) return allCards;
    return allCards.filter((c) => selectedStages.has(c.stage));
  }, [allCards, selectedStages]);

  const sortedCards = useMemo(() => {
    return [...filteredCards].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'studentName':
          comparison = a.studentName.localeCompare(b.studentName);
          break;
        case 'stage':
          comparison = stageOrder[a.stage] - stageOrder[b.stage];
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
        case 'source':
          comparison = (a.source || '').localeCompare(b.source || '');
          break;
        case 'daysInStage':
          comparison = a.daysInStage - b.daysInStage;
          break;
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'nextFollowupDate': {
          const aDate = a.nextFollowupDate ? new Date(a.nextFollowupDate).getTime() : Infinity;
          const bDate = b.nextFollowupDate ? new Date(b.nextFollowupDate).getTime() : Infinity;
          comparison = aDate - bDate;
          break;
        }
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredCards, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortHeader = ({
    field,
    children,
    className,
  }: {
    field: SortField;
    children: React.ReactNode;
    className?: string;
  }) => (
    <button
      className={cn(
        'inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider',
        'text-muted-foreground hover:text-foreground transition-colors',
        className
      )}
      onClick={() => handleSort(field)}
    >
      {children}
      {sortField === field ? (
        sortDirection === 'asc' ? (
          <ArrowUp className="h-3 w-3 text-primary" />
        ) : (
          <ArrowDown className="h-3 w-3 text-primary" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );

  const getStageConfig = (stage: string) =>
    PIPELINE_STAGES.find((s) => s.key === stage) || PIPELINE_STAGES[0];

  const isFollowupOverdue = (date?: string) => date && new Date(date) < new Date();

  const isFollowupSoon = (date?: string) => {
    if (!date) return false;
    const followupDate = new Date(date);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return followupDate <= tomorrow && followupDate >= new Date();
  };

  const formatRelativeDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // ALL pipeline stages for the filter — must be declared before the early
  // return so the hook count is stable across renders.
  const allStageOptions = useMemo(() => {
    return PIPELINE_STAGES.map((stage) => {
      const stageData = data.stages[stage.key];
      const count = stageData?.count || stageData?.cards?.length || 0;
      return { key: stage.key, label: stage.label, color: stage.color, count };
    });
  }, [data]);

  if (sortedCards.length === 0 && selectedStages.size === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center rounded-xl border bg-gradient-to-b from-muted/30 to-background">
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-violet-500/20 rounded-full blur-2xl scale-150" />
          <div className="relative h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/10 to-violet-500/10 flex items-center justify-center border border-primary/10 shadow-lg">
            <Sparkles className="h-10 w-10 text-primary" />
          </div>
        </div>
        <h3 className="text-xl font-bold mb-2">Start Your Pipeline</h3>
        <p className="text-muted-foreground mb-8 max-w-sm text-sm leading-relaxed">
          Add your first lead to begin tracking prospective students through the admission journey.
        </p>
        <Button
          onClick={onAddLead}
          size="lg"
          className="shadow-md hover:shadow-lg transition-shadow"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Add Your First Lead
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      {/* Table Header Stats */}
      <div className="px-5 py-3.5 border-b bg-gradient-to-r from-muted/40 to-muted/20 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{sortedCards.length}</span>
          {selectedStages.size > 0 ? ` of ${allCards.length}` : ''} records
        </p>
        <div className="flex items-center gap-5 text-xs">
          <span className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
            <div className="h-2.5 w-2.5 rounded-full bg-blue-500 ring-2 ring-blue-500/20" />
            <span className="font-medium">{data.stats.leads} leads</span>
          </span>
          <span className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
            <span className="font-medium">{data.stats.applications} applications</span>
          </span>
        </div>
      </div>

      {/* Stage Filter — Popover with checkboxes + selected chips shown outside */}
      <div className="px-5 py-3 border-b bg-muted/10 flex items-center gap-2 flex-wrap">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              <Filter className="h-3.5 w-3.5" />
              Filter Stages
              {selectedStages.size > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px] ml-0.5">
                  {selectedStages.size}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-2">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground px-2 py-1">
                Select stages to filter
              </p>
              {allStageOptions.map((stage) => (
                <button
                  key={stage.key}
                  type="button"
                  onClick={() => toggleStage(stage.key)}
                  className="flex items-center gap-2.5 w-full px-2 py-1.5 rounded-md hover:bg-muted transition-colors text-left"
                >
                  <Checkbox
                    checked={selectedStages.has(stage.key)}
                    className="h-3.5 w-3.5"
                    tabIndex={-1}
                  />
                  <div className={cn('h-2.5 w-2.5 rounded-full shrink-0', stage.color)} />
                  <span className="text-sm flex-1">{stage.label}</span>
                  <span className="text-xs text-muted-foreground">{stage.count}</span>
                </button>
              ))}
              {selectedStages.size > 0 && (
                <button
                  type="button"
                  onClick={clearStageFilter}
                  className="flex items-center gap-1.5 w-full px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors border-t mt-1 pt-2"
                >
                  <X className="h-3 w-3" />
                  Clear all filters
                </button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Selected stage chips — shown outside the popover for quick removal */}
        {selectedStages.size > 0 && (
          <>
            {allStageOptions
              .filter((s) => selectedStages.has(s.key))
              .map((stage) => (
                <button
                  key={stage.key}
                  type="button"
                  onClick={() => toggleStage(stage.key)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs font-medium hover:bg-primary/20 transition-colors"
                >
                  <div className={cn('h-2 w-2 rounded-full', stage.color)} />
                  {stage.label}
                  <X className="h-3 w-3 opacity-60" />
                </button>
              ))}
            <button
              type="button"
              onClick={clearStageFilter}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear all
            </button>
          </>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[260px] bg-muted/30">
              <SortHeader field="studentName">Name</SortHeader>
            </TableHead>
            <TableHead className="bg-muted/30">
              <SortHeader field="stage">Stage</SortHeader>
            </TableHead>
            <TableHead className="bg-muted/30 hidden md:table-cell">
              <SortHeader field="type">Type</SortHeader>
            </TableHead>
            <TableHead className="bg-muted/30 hidden lg:table-cell">Contact</TableHead>
            <TableHead className="bg-muted/30 hidden xl:table-cell">
              <SortHeader field="source">Source</SortHeader>
            </TableHead>
            <TableHead className="bg-muted/30 hidden md:table-cell">
              <SortHeader field="daysInStage">Duration</SortHeader>
            </TableHead>
            <TableHead className="bg-muted/30 hidden lg:table-cell">
              <SortHeader field="nextFollowupDate">Follow-up</SortHeader>
            </TableHead>
            <TableHead className="bg-muted/30 hidden sm:table-cell">
              <SortHeader field="createdAt">Added</SortHeader>
            </TableHead>
            <TableHead className="bg-muted/30 w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedCards.map((card, index) => {
            const stageConfig = getStageConfig(card.stage);
            const followupOverdue = isFollowupOverdue(card.nextFollowupDate);
            const followupSoon = isFollowupSoon(card.nextFollowupDate);

            return (
              <TableRow
                key={card._id}
                className={cn(
                  'group cursor-pointer transition-all duration-150',
                  'hover:bg-primary/5',
                  index % 2 === 0 ? 'bg-background' : 'bg-muted/10'
                )}
                onClick={() => onCardView(card)}
              >
                <TableCell className="py-3.5">
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div
                      className={cn(
                        'h-10 w-10 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0',
                        card.type === 'lead'
                          ? 'bg-gradient-to-br from-blue-100 to-blue-50 text-blue-600 ring-1 ring-blue-200/50'
                          : 'bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-600 ring-1 ring-emerald-200/50'
                      )}
                    >
                      {card.studentName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate max-w-[180px] group-hover:text-primary transition-colors">
                        {card.studentName}
                      </p>
                      {card.interestedIn && (
                        <p className="text-xs text-muted-foreground truncate max-w-[180px] mt-0.5">
                          {card.interestedIn}
                        </p>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold',
                      stageConfig.bgColor,
                      'border',
                      stageConfig.borderColor
                    )}
                  >
                    <span className={cn('h-2 w-2 rounded-full', stageConfig.color)} />
                    {stageConfig.label}
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <Badge
                    variant="outline"
                    className={cn(
                      'font-semibold text-[10px] uppercase tracking-wider h-6',
                      card.type === 'lead'
                        ? 'border-blue-200 text-blue-600 bg-blue-50/50'
                        : 'border-emerald-200 text-emerald-600 bg-emerald-50/50'
                    )}
                  >
                    {card.type === 'lead' ? (
                      <User className="h-3 w-3 mr-1" />
                    ) : (
                      <FileText className="h-3 w-3 mr-1" />
                    )}
                    {card.type}
                  </Badge>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {card.parentPhone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      <span className="font-mono text-xs">{card.parentPhone}</span>
                    </div>
                  )}
                </TableCell>
                <TableCell className="hidden xl:table-cell">
                  {card.source && sourceConfig[card.source] && (
                    <span
                      className={cn(
                        'inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-medium border',
                        sourceConfig[card.source].bg,
                        sourceConfig[card.source].text
                      )}
                    >
                      {sourceConfig[card.source].label}
                    </span>
                  )}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <div
                    className={cn(
                      'inline-flex items-center gap-1.5 px-2 py-1 rounded-md',
                      card.daysInStage > 7
                        ? 'text-amber-700 bg-amber-50 font-semibold'
                        : 'text-muted-foreground'
                    )}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    <span className="text-xs tabular-nums">{card.daysInStage}d</span>
                  </div>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {card.nextFollowupDate && (
                    <div
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium border',
                        followupOverdue
                          ? 'bg-destructive/10 text-destructive border-destructive/20'
                          : followupSoon
                            ? 'bg-amber-50 text-amber-700 border-amber-200/50'
                            : 'bg-muted/50 text-muted-foreground border-transparent'
                      )}
                    >
                      <Calendar className={cn('h-3.5 w-3.5', followupOverdue && 'animate-pulse')} />
                      {new Date(card.nextFollowupDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs hidden sm:table-cell tabular-nums">
                  {formatRelativeDate(card.createdAt)}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => onCardView(card)}>
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      {card.parentPhone && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`tel:${card.parentPhone}`);
                          }}
                        >
                          <Phone className="h-4 w-4 mr-2" />
                          Call Parent
                        </DropdownMenuItem>
                      )}
                      {card.type === 'lead' && card.stage === 'interested' && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => onConvertLead(card)}>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Convert to Application
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

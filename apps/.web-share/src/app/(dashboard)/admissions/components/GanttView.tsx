'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  ChevronLeft,
  ChevronRight,
  UserPlus,
  GanttChart,
  Clock,
  Calendar,
  Phone,
  Eye,
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

interface GanttViewProps {
  data: PipelineData;
  onCardView: (card: PipelineCard) => void;
  onAddLead: () => void;
}

type ZoomLevel = 'day' | 'week' | 'month';

const stageColors: Record<string, string> = {
  new: 'bg-slate-500',
  contacted: 'bg-blue-500',
  interested: 'bg-violet-500',
  applied: 'bg-amber-500',
  docs_verified: 'bg-cyan-500',
  fee_paid: 'bg-emerald-500',
  enrolled: 'bg-green-600',
};

export function GanttView({ data, onCardView, onAddLead }: GanttViewProps) {
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('week');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d;
  });

  const allCards = useMemo(() => {
    const cards: PipelineCard[] = [];
    Object.values(data.stages).forEach((stage) => {
      cards.push(...stage.cards);
    });
    return cards.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [data]);

  // Adjust days shown and column width based on zoom level
  const config = useMemo(() => {
    switch (zoomLevel) {
      case 'day':
        return { days: 14, colWidth: 50 };
      case 'week':
        return { days: 21, colWidth: 36 };
      case 'month':
        return { days: 42, colWidth: 24 };
    }
  }, [zoomLevel]);

  const dateRange = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < config.days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      days.push(date);
    }
    return days;
  }, [startDate, config.days]);

  const navigateDays = (direction: 'prev' | 'next') => {
    const amount = zoomLevel === 'day' ? 7 : zoomLevel === 'week' ? 14 : 21;
    setStartDate((prev) => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() + (direction === 'next' ? amount : -amount));
      return newDate;
    });
  };

  const goToToday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    setStartDate(d);
  };

  const getCardBar = (card: PipelineCard) => {
    const cardStart = new Date(card.createdAt);
    const now = new Date();
    const rangeStart = dateRange[0];
    const rangeEnd = dateRange[dateRange.length - 1];

    const effectiveStart = cardStart < rangeStart ? rangeStart : cardStart;
    const effectiveEnd = now;

    const startOffset = Math.max(
      0,
      Math.floor((effectiveStart.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24))
    );
    const duration = Math.max(
      1,
      Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24))
    );

    if (cardStart > rangeEnd || effectiveEnd < rangeStart) {
      return null;
    }

    return {
      left: startOffset * config.colWidth,
      width: Math.max(config.colWidth * 2, duration * config.colWidth),
      stage: card.stage,
    };
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isWeekend = (date: Date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  const getStageConfig = (stage: string) =>
    PIPELINE_STAGES.find((s) => s.key === stage) || PIPELINE_STAGES[0];

  // Format date for header based on zoom level
  const formatDateHeader = (date: Date, index: number) => {
    const isFirstOfMonth = date.getDate() === 1;
    const isMonday = date.getDay() === 1;

    if (zoomLevel === 'day') {
      return {
        top: date.toLocaleDateString('en-US', { weekday: 'short' }),
        bottom: date.getDate().toString(),
        showMonth: index === 0 || isFirstOfMonth,
      };
    } else if (zoomLevel === 'week') {
      return {
        top: null,
        bottom: date.getDate().toString(),
        showMonth: index === 0 || isFirstOfMonth || (isMonday && index > 0),
      };
    } else {
      // Month view - only show some dates to avoid crowding
      const showDate =
        date.getDate() === 1 ||
        date.getDate() === 8 ||
        date.getDate() === 15 ||
        date.getDate() === 22;
      return {
        top: null,
        bottom: showDate ? date.getDate().toString() : '',
        showMonth: index === 0 || isFirstOfMonth,
      };
    }
  };

  if (allCards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center rounded-xl border bg-gradient-to-b from-muted/30 to-background">
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-cyan-500/20 rounded-full blur-2xl scale-150" />
          <div className="relative h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/10 to-cyan-500/10 flex items-center justify-center border border-primary/10 shadow-lg">
            <GanttChart className="h-10 w-10 text-primary" />
          </div>
        </div>
        <h3 className="text-xl font-bold mb-2">Timeline View</h3>
        <p className="text-muted-foreground text-sm mb-8 max-w-sm leading-relaxed">
          Add leads to visualize their journey through the admission pipeline over time.
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
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center rounded-lg border bg-card shadow-sm">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigateDays('prev')}
              className="h-9 px-3 rounded-r-none border-r"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={goToToday}
              className="h-9 px-4 rounded-none text-xs font-medium"
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigateDays('next')}
              className="h-9 px-3 rounded-l-none border-l"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="hidden sm:block px-3 py-1.5 rounded-lg bg-muted/50 border">
            <span className="text-sm font-medium">
              {dateRange[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              <span className="text-muted-foreground mx-2">—</span>
              {dateRange[dateRange.length - 1].toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="inline-flex items-center rounded-lg border border-border/60 bg-muted/30 p-1 shadow-sm">
          {(['day', 'week', 'month'] as const).map((level) => (
            <button
              key={level}
              onClick={() => setZoomLevel(level)}
              className={cn(
                'px-3.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 capitalize',
                zoomLevel === level
                  ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              )}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      {/* Gantt Chart */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <div style={{ minWidth: 220 + config.days * config.colWidth }}>
            {/* Header */}
            <div className="flex border-b bg-gradient-to-r from-muted/40 to-muted/20">
              <div className="w-[220px] min-w-[220px] border-r px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Lead / Application
              </div>
              <div className="flex">
                {dateRange.map((date, index) => {
                  const format = formatDateHeader(date, index);
                  return (
                    <div
                      key={date.toISOString()}
                      className={cn(
                        'flex-shrink-0 text-center border-r border-border/50 py-1',
                        isToday(date) && 'bg-primary/10',
                        isWeekend(date) && !isToday(date) && 'bg-muted/50'
                      )}
                      style={{ width: config.colWidth }}
                    >
                      {format.showMonth && (
                        <div className="text-[9px] text-muted-foreground font-medium">
                          {date.toLocaleDateString('en-US', { month: 'short' })}
                        </div>
                      )}
                      {format.top && (
                        <div className="text-[9px] text-muted-foreground">{format.top}</div>
                      )}
                      <div
                        className={cn(
                          'text-xs',
                          isToday(date) ? 'font-bold text-primary' : 'text-muted-foreground'
                        )}
                      >
                        {format.bottom}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Rows */}
            {allCards.map((card, index) => {
              const bar = getCardBar(card);
              const stageConfig = getStageConfig(card.stage);

              return (
                <div
                  key={card._id}
                  className={cn(
                    'flex border-b last:border-0 group transition-colors',
                    index % 2 === 1 ? 'bg-muted/10' : 'bg-background',
                    'hover:bg-primary/5'
                  )}
                >
                  {/* Name column */}
                  <div
                    className="w-[220px] min-w-[220px] border-r px-4 py-2.5 cursor-pointer transition-colors"
                    onClick={() => onCardView(card)}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={cn(
                          'h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0',
                          card.type === 'lead'
                            ? 'bg-gradient-to-br from-blue-100 to-blue-50 text-blue-600 ring-1 ring-blue-200/50'
                            : 'bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-600 ring-1 ring-emerald-200/50'
                        )}
                      >
                        {card.studentName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                          {card.studentName}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge
                            variant="outline"
                            className={cn(
                              'h-4 px-1.5 text-[9px] font-semibold uppercase',
                              card.type === 'lead'
                                ? 'border-blue-200 text-blue-600 bg-blue-50/50'
                                : 'border-emerald-200 text-emerald-600 bg-emerald-50/50'
                            )}
                          >
                            {card.type}
                          </Badge>
                          <span className={cn('h-2 w-2 rounded-full', stageConfig.color)} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="flex-1 relative h-[44px]">
                    {/* Grid */}
                    <div className="absolute inset-0 flex">
                      {dateRange.map((date) => (
                        <div
                          key={date.toISOString()}
                          className={cn(
                            'h-full border-r border-border/30 flex-shrink-0',
                            isToday(date) && 'bg-primary/5',
                            isWeekend(date) && !isToday(date) && 'bg-muted/30'
                          )}
                          style={{ width: config.colWidth }}
                        />
                      ))}
                    </div>

                    {/* Bar */}
                    {bar && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <div
                            className={cn(
                              'absolute top-2 h-7 rounded flex items-center justify-center cursor-pointer',
                              'hover:opacity-90 transition-opacity text-white text-[10px] font-medium',
                              stageColors[bar.stage]
                            )}
                            style={{
                              left: bar.left,
                              width: bar.width,
                              maxWidth: `calc(100% - ${bar.left}px - 4px)`,
                            }}
                          >
                            {bar.width > 60 && (
                              <span className="truncate px-2">{card.daysInStage}d</span>
                            )}
                          </div>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-3" align="start">
                          <div className="space-y-2">
                            <p className="font-medium text-sm">{card.studentName}</p>
                            <div
                              className={cn(
                                'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium',
                                stageConfig.bgColor
                              )}
                            >
                              <span className={cn('h-1.5 w-1.5 rounded-full', stageConfig.color)} />
                              {stageConfig.label}
                            </div>
                            <div className="space-y-1 text-xs text-muted-foreground pt-1">
                              <div className="flex items-center gap-2">
                                <Clock className="h-3 w-3" />
                                {card.daysInStage} days in stage
                              </div>
                              <div className="flex items-center gap-2">
                                <Calendar className="h-3 w-3" />
                                Created {new Date(card.createdAt).toLocaleDateString()}
                              </div>
                              {card.parentPhone && (
                                <div className="flex items-center gap-2">
                                  <Phone className="h-3 w-3" />
                                  {card.parentPhone}
                                </div>
                              )}
                            </div>
                            <Button
                              size="sm"
                              className="w-full h-7 text-xs mt-2"
                              onClick={() => onCardView(card)}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View Details
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-1">
        <span className="text-sm text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{allCards.length}</span> items
        </span>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500 ring-2 ring-blue-500/20" />
            <span className="font-medium text-blue-700 dark:text-blue-400">
              {data.stats.leads} leads
            </span>
          </span>
          <span className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
            <span className="font-medium text-emerald-700 dark:text-emerald-400">
              {data.stats.applications} applications
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

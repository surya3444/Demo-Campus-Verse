'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ChevronLeft,
  ChevronRight,
  Phone,
  UserPlus,
  CalendarDays,
  Clock,
  AlertCircle,
  Eye,
  Bell,
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

interface CalendarViewProps {
  data: PipelineData;
  onCardView: (card: PipelineCard) => void;
  onAddLead: () => void;
}

interface CalendarEvent {
  card: PipelineCard;
  type: 'followup' | 'created';
  date: Date;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function CalendarView({ data, onCardView, onAddLead }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showCreatedDates, setShowCreatedDates] = useState(false);

  const allCards = useMemo(() => {
    const cards: PipelineCard[] = [];
    Object.values(data.stages).forEach((stage) => {
      cards.push(...stage.cards);
    });
    return cards;
  }, [data]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();

    allCards.forEach((card) => {
      if (card.nextFollowupDate) {
        const date = new Date(card.nextFollowupDate);
        const key = date.toDateString();
        const existing = map.get(key) || [];
        existing.push({ card, type: 'followup', date });
        map.set(key, existing);
      }

      if (showCreatedDates) {
        const date = new Date(card.createdAt);
        const key = date.toDateString();
        const existing = map.get(key) || [];
        existing.push({ card, type: 'created', date });
        map.set(key, existing);
      }
    });

    return map;
  }, [allCards, showCreatedDates]);

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const startingDay = firstDay.getDay();
    const lastDay = new Date(year, month + 1, 0);
    const totalDays = lastDay.getDate();
    const prevMonthLastDay = new Date(year, month, 0).getDate();

    const days: { date: Date; currentMonth: boolean }[] = [];

    for (let i = startingDay - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        currentMonth: false,
      });
    }

    for (let i = 1; i <= totalDays; i++) {
      days.push({
        date: new Date(year, month, i),
        currentMonth: true,
      });
    }

    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        currentMonth: false,
      });
    }

    return days;
  }, [currentDate]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
      return newDate;
    });
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isOverdue = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const getStageConfig = (stage: string) =>
    PIPELINE_STAGES.find((s) => s.key === stage) || PIPELINE_STAGES[0];

  const upcomingFollowups = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    return allCards.filter((card) => {
      if (!card.nextFollowupDate) return false;
      const date = new Date(card.nextFollowupDate);
      return date >= today && date <= nextWeek;
    }).length;
  }, [allCards]);

  const overdueFollowups = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return allCards.filter((card) => {
      if (!card.nextFollowupDate) return false;
      return new Date(card.nextFollowupDate) < today;
    }).length;
  }, [allCards]);

  if (allCards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center rounded-xl border bg-gradient-to-b from-muted/30 to-background">
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-amber-500/20 rounded-full blur-2xl scale-150" />
          <div className="relative h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/10 to-amber-500/10 flex items-center justify-center border border-primary/10 shadow-lg">
            <CalendarDays className="h-10 w-10 text-primary" />
          </div>
        </div>
        <h3 className="text-xl font-bold mb-2">Calendar View</h3>
        <p className="text-muted-foreground text-sm mb-8 max-w-sm leading-relaxed">
          Add leads with follow-up dates to see them organized on your calendar.
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
              onClick={() => navigateMonth('prev')}
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
              onClick={() => navigateMonth('next')}
              className="h-9 px-3 rounded-l-none border-l"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <h2 className="text-xl font-bold tracking-tight">
            {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
        </div>

        <div className="flex items-center gap-3">
          {/* Stats */}
          <div className="flex items-center gap-2">
            {overdueFollowups > 0 && (
              <div className="inline-flex items-center gap-1.5 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-1.5 text-xs font-semibold text-destructive">
                <AlertCircle className="h-3.5 w-3.5" />
                {overdueFollowups} overdue
              </div>
            )}
            <div className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 border border-primary/20 px-3 py-1.5 text-xs font-semibold text-primary">
              <Bell className="h-3.5 w-3.5" />
              {upcomingFollowups} this week
            </div>
          </div>

          {/* Toggle created dates */}
          <button
            onClick={() => setShowCreatedDates(!showCreatedDates)}
            className={cn(
              'rounded-lg border px-3.5 py-1.5 text-xs font-medium transition-all duration-200',
              showCreatedDates
                ? 'bg-background text-foreground border-border shadow-sm ring-1 ring-border/50'
                : 'bg-muted/30 text-muted-foreground border-border/60 hover:text-foreground hover:bg-background/50'
            )}
          >
            Show Created
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        {/* Weekday Header */}
        <div className="grid grid-cols-7 border-b bg-gradient-to-r from-muted/40 to-muted/20">
          {WEEKDAYS.map((day, i) => (
            <div
              key={day}
              className={cn(
                'py-3 text-center text-xs font-bold uppercase tracking-wider',
                i === 0 || i === 6 ? 'text-muted-foreground/50' : 'text-muted-foreground'
              )}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7">
          {calendarDays.map(({ date, currentMonth }, index) => {
            const events = eventsByDate.get(date.toDateString()) || [];
            const followupEvents = events.filter((e) => e.type === 'followup');
            const createdEvents = events.filter((e) => e.type === 'created');
            const _hasOverdue = followupEvents.some((e) => isOverdue(e.date));
            const dayOfWeek = date.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

            return (
              <div
                key={index}
                className={cn(
                  'min-h-[110px] border-r border-b p-1.5 transition-colors',
                  !currentMonth && 'bg-muted/20',
                  isWeekend && currentMonth && 'bg-muted/10',
                  isToday(date) && 'bg-primary/5 ring-1 ring-inset ring-primary/20'
                )}
              >
                {/* Date Number */}
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={cn(
                      'flex items-center justify-center h-6 w-6 rounded-full text-xs font-medium',
                      isToday(date)
                        ? 'bg-primary text-primary-foreground font-semibold'
                        : currentMonth
                          ? 'text-foreground'
                          : 'text-muted-foreground/50'
                    )}
                  >
                    {date.getDate()}
                  </span>
                  {events.length > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      {events.length} event{events.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Events */}
                <div className="space-y-0.5">
                  {followupEvents.slice(0, 2).map((event, i) => {
                    const stageConfig = getStageConfig(event.card.stage);
                    const overdue = isOverdue(event.date);

                    return (
                      <Popover key={`${event.card._id}-${i}`}>
                        <PopoverTrigger asChild>
                          <button
                            className={cn(
                              'w-full text-left text-[10px] px-1.5 py-1 rounded-md truncate font-medium',
                              'transition-all hover:scale-[1.02]',
                              overdue
                                ? 'bg-destructive/15 text-destructive border border-destructive/20'
                                : cn(stageConfig.bgColor, 'border border-transparent')
                            )}
                          >
                            <span className="flex items-center gap-1">
                              {overdue && <Clock className="h-2.5 w-2.5 flex-shrink-0" />}
                              {event.card.studentName}
                            </span>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 p-0" align="start">
                          <div className="p-3 border-b bg-muted/30">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={cn(
                                  'h-10 w-10 rounded-lg flex items-center justify-center text-sm font-semibold flex-shrink-0',
                                  'bg-gradient-to-br from-primary/20 to-primary/10 text-primary'
                                )}
                              >
                                {event.card.studentName.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-sm truncate">
                                  {event.card.studentName}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <div
                                    className={cn(
                                      'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium',
                                      stageConfig.bgColor
                                    )}
                                  >
                                    <span
                                      className={cn('h-1.5 w-1.5 rounded-full', stageConfig.color)}
                                    />
                                    {stageConfig.label}
                                  </div>
                                  {overdue && (
                                    <Badge variant="destructive" className="text-[9px] h-4 px-1">
                                      Overdue
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="p-3 space-y-2">
                            {event.card.interestedIn && (
                              <p className="text-xs text-muted-foreground">
                                Interested in: {event.card.interestedIn}
                              </p>
                            )}
                            {event.card.parentPhone && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                <span className="font-mono">{event.card.parentPhone}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <CalendarDays className="h-3 w-3" />
                              <span>
                                Follow-up:{' '}
                                {date.toLocaleDateString('en-US', {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                            </div>
                          </div>
                          <div className="p-2 border-t bg-muted/20 flex gap-2">
                            <Button
                              size="sm"
                              className="flex-1 h-8 text-xs"
                              onClick={() => onCardView(event.card)}
                            >
                              <Eye className="h-3 w-3 mr-1.5" />
                              View Details
                            </Button>
                            {event.card.parentPhone && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs px-3"
                                onClick={() => window.open(`tel:${event.card.parentPhone}`)}
                              >
                                <Phone className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    );
                  })}

                  {createdEvents.slice(0, 1).map((event, i) => (
                    <Popover key={`created-${event.card._id}-${i}`}>
                      <PopoverTrigger asChild>
                        <button className="w-full text-left text-[10px] px-1.5 py-1 rounded-md truncate font-medium bg-info/10 text-info border border-dashed border-info/30 transition-all hover:scale-[1.02]">
                          <span className="flex items-center gap-1">
                            <span className="text-[8px]">+</span>
                            {event.card.studentName}
                          </span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-3" align="start">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-sm">{event.card.studentName}</p>
                            <Badge variant="outline" className="text-[10px]">
                              New Lead
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Created on{' '}
                            {date.toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </p>
                          <Button
                            size="sm"
                            className="w-full h-8 text-xs"
                            onClick={() => onCardView(event.card)}
                          >
                            <Eye className="h-3 w-3 mr-1.5" />
                            View Details
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  ))}

                  {/* More indicator */}
                  {events.length > 3 && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="w-full text-left text-[10px] px-1.5 py-0.5 text-muted-foreground hover:text-foreground transition-colors font-medium">
                          +{events.length - 3} more
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 p-0" align="start">
                        <div className="p-3 border-b bg-muted/30">
                          <p className="font-semibold text-sm">
                            {date.toLocaleDateString('en-US', {
                              weekday: 'long',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </p>
                          <p className="text-xs text-muted-foreground">{events.length} events</p>
                        </div>
                        <ScrollArea className="h-[250px]">
                          <div className="p-2 space-y-1">
                            {events.map((event, i) => {
                              const stageConfig = getStageConfig(event.card.stage);
                              const overdue = event.type === 'followup' && isOverdue(event.date);
                              return (
                                <button
                                  key={i}
                                  className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-muted transition-colors text-left"
                                  onClick={() => onCardView(event.card)}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div
                                      className={cn(
                                        'h-8 w-8 rounded-lg flex items-center justify-center text-xs font-semibold flex-shrink-0',
                                        'bg-gradient-to-br from-primary/10 to-primary/5 text-primary'
                                      )}
                                    >
                                      {event.card.studentName.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium truncate">
                                        {event.card.studentName}
                                      </p>
                                      <p className="text-[10px] text-muted-foreground">
                                        {event.type === 'followup' ? 'Follow-up' : 'Created'}
                                        {overdue && ' · Overdue'}
                                      </p>
                                    </div>
                                  </div>
                                  <div
                                    className={cn(
                                      'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium flex-shrink-0',
                                      stageConfig.bgColor
                                    )}
                                  >
                                    <span
                                      className={cn('h-1.5 w-1.5 rounded-full', stageConfig.color)}
                                    />
                                    {stageConfig.label}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-5 text-xs px-1">
        <div className="flex items-center gap-2">
          <div className="h-3.5 w-3.5 rounded-md bg-destructive/15 border border-destructive/20" />
          <span className="text-muted-foreground">Overdue</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3.5 w-3.5 rounded-md bg-slate-100 border border-slate-200" />
          <span className="text-muted-foreground">Scheduled</span>
        </div>
        {showCreatedDates && (
          <div className="flex items-center gap-2">
            <div className="h-3.5 w-3.5 rounded-md bg-info/10 border border-dashed border-info/30" />
            <span className="text-muted-foreground">New Lead</span>
          </div>
        )}
        <div className="flex-1" />
        <span className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{allCards.length}</span> total leads
        </span>
      </div>
    </div>
  );
}

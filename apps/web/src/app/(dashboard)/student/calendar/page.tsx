'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { communicationsApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, Clock } from 'lucide-react';

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

export default function StudentCalendarPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data: eventsData, isLoading } = useQuery({
    queryKey: ['student-calendar', month, year],
    queryFn: () => communicationsApi.getCalendarEvents({ month, year }),
  });

  const { data: upcomingData } = useQuery({
    queryKey: ['student-upcoming-events'],
    queryFn: () => communicationsApi.getUpcomingEvents(),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const events = (eventsData?.data || []) as Record<string, any>[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const upcomingEvents = (upcomingData?.data || []) as Record<string, any>[];

  const prevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else setMonth(month - 1);
  };

  const nextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else setMonth(month + 1);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
        <p className="text-muted-foreground">School events and important dates</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Monthly Events */}
        <div className="md:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="icon" onClick={prevMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <CardTitle className="text-base">
                  {MONTHS[month - 1]} {year}
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={nextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : events.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No events this month.
                </p>
              ) : (
                <div className="space-y-3">
                  {events
                    .sort(
                      (a, b) =>
                        new Date(a.startDate || a.date).getTime() -
                        new Date(b.startDate || b.date).getTime()
                    )
                    .map((event) => {
                      const eventDate = new Date(event.startDate || event.date);
                      return (
                        <div key={event._id} className="flex gap-3 p-3 rounded-lg border">
                          <div className="w-12 h-12 rounded-lg bg-primary/10 flex flex-col items-center justify-center shrink-0">
                            <span className="text-xs text-muted-foreground">
                              {eventDate.toLocaleDateString('en-IN', { month: 'short' })}
                            </span>
                            <span className="text-lg font-bold text-primary leading-none">
                              {eventDate.getDate()}
                            </span>
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-sm">{event.title}</p>
                            {event.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                {event.description}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-1.5">
                              {(event.startTime || event.time) && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {event.startTime || event.time}
                                </span>
                              )}
                              {event.location && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {event.location}
                                </span>
                              )}
                              {event.type && (
                                <Badge variant="outline" className="text-[10px]">
                                  {event.type}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Events */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4 text-blue-500" />
              Upcoming
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No upcoming events</p>
            ) : (
              <div className="space-y-3">
                {upcomingEvents.slice(0, 5).map((event) => {
                  const eventDate = new Date(event.startDate || event.date);
                  const isToday = eventDate.toDateString() === now.toDateString();

                  return (
                    <div key={event._id} className="border-b last:border-0 pb-2.5 last:pb-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{event.title}</p>
                        {isToday && (
                          <Badge variant="default" className="text-[10px]">
                            Today
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {eventDate.toLocaleDateString('en-IN', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                        })}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

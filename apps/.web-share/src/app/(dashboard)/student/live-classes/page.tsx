'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { liveClassApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Video, Calendar, Clock, User, Radio, BookOpen } from 'lucide-react';

type LiveClass = {
  _id: string;
  title: string;
  description?: string;
  status: 'scheduled' | 'live' | 'ended' | 'cancelled';
  scheduledStart: string;
  scheduledEnd: string;
  hostName?: string;
  className?: string;
  sectionName?: string;
  subjectName?: string;
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
  live: 'bg-red-100 text-red-700 hover:bg-red-100 animate-pulse',
  ended: 'bg-gray-100 text-gray-700 hover:bg-gray-100',
  cancelled: 'bg-orange-100 text-orange-700 hover:bg-orange-100',
};

export default function StudentLiveClassesPage() {
  const [tab, setTab] = useState<'upcoming' | 'live' | 'past'>('upcoming');

  const filterFor = (t: typeof tab) => {
    if (t === 'live') return { status: 'live' };
    if (t === 'upcoming') return { status: 'scheduled' };
    return { status: 'ended' };
  };

  const { data, isLoading } = useQuery({
    queryKey: ['student-live-classes', tab],
    queryFn: () => liveClassApi.list(filterFor(tab)),
    refetchInterval: tab === 'live' ? 5000 : false,
  });
  const classes: LiveClass[] = data?.data || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Live Classes</h1>
        <p className="text-muted-foreground">Join your online classes and catch up on past ones</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="upcoming" className="gap-2">
            <Calendar className="h-4 w-4" /> Upcoming
          </TabsTrigger>
          <TabsTrigger value="live" className="gap-2">
            <Radio className="h-4 w-4 text-red-500" /> Live now
          </TabsTrigger>
          <TabsTrigger value="past" className="gap-2">
            <Clock className="h-4 w-4" /> Past
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-6">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-44 rounded-xl" />
              ))}
            </div>
          ) : classes.length === 0 ? (
            <EmptyState
              icon={Video}
              title={
                tab === 'live'
                  ? 'No live classes right now'
                  : tab === 'upcoming'
                    ? 'No upcoming classes'
                    : 'No past classes'
              }
              description={
                tab === 'upcoming'
                  ? 'When your teacher schedules a live class, it will appear here.'
                  : tab === 'live'
                    ? 'Your class will show here the moment your teacher goes live.'
                    : 'Classes you have attended will appear here.'
              }
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {classes.map((c) => (
                <Card key={c._id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base font-semibold leading-tight">
                        {c.title}
                      </CardTitle>
                      <Badge className={STATUS_COLORS[c.status]}>
                        {c.status === 'live' ? 'live now' : c.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {c.description && (
                      <p className="text-muted-foreground line-clamp-2">{c.description}</p>
                    )}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {new Date(c.scheduledStart).toLocaleString(undefined, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>
                    {c.subjectName && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <BookOpen className="h-4 w-4" />
                        <span>{c.subjectName}</span>
                      </div>
                    )}
                    {c.hostName && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span>{c.hostName}</span>
                      </div>
                    )}

                    <div className="pt-2">
                      {c.status === 'live' ? (
                        <Button asChild size="sm" className="w-full">
                          <Link href={`/teaching/live-classes/${c._id}`}>Join now</Link>
                        </Button>
                      ) : c.status === 'scheduled' ? (
                        <Button asChild size="sm" variant="outline" className="w-full">
                          <Link href={`/teaching/live-classes/${c._id}`}>View details</Link>
                        </Button>
                      ) : c.status === 'ended' ? (
                        <Button asChild size="sm" variant="outline" className="w-full">
                          <Link href={`/teaching/live-classes/${c._id}`}>View summary</Link>
                        </Button>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { liveClassApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Plus, Video, Calendar, Clock, Users, Radio, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { ScheduleLiveClassModal } from '@/components/teaching/ScheduleLiveClassModal';
import { TeacherSelector } from '@/components/teaching/TeacherSelector';
import { usePermissions } from '@/hooks/usePermissions';
import { useTeacherViewStore } from '@/store/teacherViewStore';

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
  lockedForHost?: boolean;
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
  live: 'bg-red-100 text-red-700 hover:bg-red-100 animate-pulse',
  ended: 'bg-gray-100 text-gray-700 hover:bg-gray-100',
  cancelled: 'bg-orange-100 text-orange-700 hover:bg-orange-100',
};

export default function LiveClassesPage() {
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tab, setTab] = useState<'upcoming' | 'live' | 'past'>('upcoming');
  const qc = useQueryClient();
  const { canCreate, isGroupOwner, isOrgAdmin, isBranchAdmin } = usePermissions();
  const canSchedule = canCreate('teaching.liveClasses');
  const isAdminRole = isGroupOwner || isOrgAdmin || isBranchAdmin;
  const { selectedStaffId, setSelectedStaffId } = useTeacherViewStore();
  const isViewingAsAdmin = isAdminRole;

  // Default the admin view here to "all teachers" — the live-classes page is
  // unfiltered by design. Other pages (my-classes, timetable, etc.) auto-select
  // a specific teacher on mount; clear that on entry so admins land on the
  // full list and only narrow down when they want to.
  useEffect(() => {
    if (isViewingAsAdmin) setSelectedStaffId(null);
  }, []);

  const filterFor = (t: typeof tab) => {
    if (t === 'live') return { status: 'live' };
    if (t === 'upcoming') return { status: 'scheduled' };
    return { status: 'ended' };
  };

  const { data, isLoading } = useQuery({
    queryKey: ['live-classes', tab, isViewingAsAdmin ? selectedStaffId : undefined],
    queryFn: () =>
      liveClassApi.list({
        ...filterFor(tab),
        ...(isViewingAsAdmin && selectedStaffId ? { staffId: selectedStaffId } : {}),
      }),
    refetchInterval: tab === 'live' ? 5000 : false,
  });
  const classes: LiveClass[] = data?.data || [];

  const cancelMutation = useMutation({
    mutationFn: (id: string) => liveClassApi.cancel(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['live-classes'] });
      toast.success('Live class cancelled');
    },
    onError: () => toast.error('Failed to cancel'),
  });

  return (
    <div className="space-y-6">
      {isViewingAsAdmin && <TeacherSelector allowAll />}
      <PageHeader
        title="Live Classes"
        description="Schedule and run live online classes with chat, polls, and reactions"
      >
        {canSchedule && (
          <Button
            onClick={() => {
              setEditingId(null);
              setScheduleOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Schedule live class
          </Button>
        )}
      </PageHeader>

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
                tab === 'upcoming' && canSchedule
                  ? 'Schedule your first live online class to get started.'
                  : 'Live classes will appear here.'
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
                      <Badge className={STATUS_COLORS[c.status]}>{c.status}</Badge>
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
                    {(c.className || c.sectionName) && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>
                          {[c.className, c.sectionName].filter(Boolean).join(' · ')}
                          {c.subjectName ? ` · ${c.subjectName}` : ''}
                        </span>
                      </div>
                    )}
                    {c.hostName && (
                      <div className="text-xs text-muted-foreground">Host: {c.hostName}</div>
                    )}
                    {c.lockedForHost && (
                      <div className="flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-2 py-1 text-[11px] text-primary">
                        <ShieldCheck className="h-3 w-3" />
                        Scheduled by an administrator
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      {(c.status === 'scheduled' || c.status === 'live') && (
                        <Button asChild size="sm" className="flex-1">
                          <Link href={`/teaching/live-classes/${c._id}`}>
                            {c.status === 'live' ? 'Join now' : 'Open'}
                          </Link>
                        </Button>
                      )}
                      {c.status === 'ended' && (
                        <Button asChild size="sm" variant="outline" className="flex-1">
                          <Link href={`/teaching/live-classes/${c._id}`}>View summary</Link>
                        </Button>
                      )}
                      {c.status === 'scheduled' &&
                        canSchedule &&
                        (isAdminRole || !c.lockedForHost) && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingId(c._id);
                                setScheduleOpen(true);
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => cancelMutation.mutate(c._id)}
                              disabled={cancelMutation.isPending}
                            >
                              Cancel
                            </Button>
                          </>
                        )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ScheduleLiveClassModal
        open={scheduleOpen}
        liveClassId={editingId}
        onClose={() => {
          setScheduleOpen(false);
          setEditingId(null);
        }}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ['live-classes'] });
          qc.invalidateQueries({ queryKey: ['live-class-edit', editingId] });
          setScheduleOpen(false);
          setEditingId(null);
        }}
      />
    </div>
  );
}

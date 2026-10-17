'use client';

import { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { liveClassApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Video,
  Calendar,
  Users,
  PlayCircle,
  StopCircle,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { LiveClassRoom } from '@/components/teaching/LiveClassRoom';
import { usePermissions } from '@/hooks/usePermissions';

type LiveClass = {
  _id: string;
  title: string;
  description?: string;
  status: 'scheduled' | 'live' | 'ended' | 'cancelled';
  scheduledStart: string;
  scheduledEnd: string;
  actualStart?: string;
  actualEnd?: string;
  hostName?: string;
  hostStaffId: string;
  className?: string;
  sectionName?: string;
  subjectName?: string;
  settings?: { studentCanDraw?: boolean };
  lockedForHost?: boolean;
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700',
  live: 'bg-red-100 text-red-700 animate-pulse',
  ended: 'bg-gray-100 text-gray-700',
  cancelled: 'bg-orange-100 text-orange-700',
};

interface JoinResp {
  liveClassId: string;
  livekitUrl: string;
  livekitToken: string;
  socketUrl: string;
  role: 'host' | 'cohost' | 'student';
  identity: string;
  displayName: string;
}

export default function LiveClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const [joined, setJoined] = useState<JoinResp | null>(null);
  const { isGroupOwner, isOrgAdmin, isBranchAdmin } = usePermissions();
  const isAdminRole = isGroupOwner || isOrgAdmin || isBranchAdmin;

  const { data, isLoading } = useQuery({
    queryKey: ['live-class', id],
    queryFn: () => liveClassApi.getById(id),
    refetchInterval: joined ? false : 5000,
  });
  const liveClass: LiveClass | undefined = data?.data;

  const join = useMutation({
    mutationFn: () => liveClassApi.join(id),
    onSuccess: (resp) => {
      setJoined(resp.data as JoinResp);
      qc.invalidateQueries({ queryKey: ['live-class', id] });
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e?.response?.data?.error?.message ?? 'Failed to join'),
  });

  const start = useMutation({
    mutationFn: () => liveClassApi.start(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['live-class', id] });
      join.mutate();
    },
    onError: () => toast.error('Failed to start class'),
  });

  const end = useMutation({
    mutationFn: () => liveClassApi.end(id),
    onSuccess: () => {
      toast.success('Live class ended');
      setJoined(null);
      qc.invalidateQueries({ queryKey: ['live-class', id] });
    },
    onError: () => toast.error('Failed to end class'),
  });

  if (isLoading || !liveClass) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // In-room view
  if (joined) {
    return (
      <LiveClassRoom
        liveClass={liveClass}
        joinResponse={joined}
        onLeave={() => setJoined(null)}
        onEnd={() => end.mutate()}
      />
    );
  }

  // Pre-join lobby
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/teaching/live-classes">
            <ArrowLeft className="h-4 w-4 mr-1" />
            All live classes
          </Link>
        </Button>
      </div>

      <Card className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold">{liveClass.title}</h1>
              <Badge className={STATUS_COLORS[liveClass.status]}>{liveClass.status}</Badge>
            </div>
            {liveClass.description && (
              <p className="text-muted-foreground">{liveClass.description}</p>
            )}
          </div>
        </div>

        {liveClass.lockedForHost && !isAdminRole && (
          <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <div className="font-medium text-primary">Scheduled by an administrator</div>
              <div className="text-xs text-muted-foreground">
                You can run this class but cannot edit its details or cancel it. Contact an admin to
                make changes.
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-3 text-sm md:grid-cols-3 pt-2 border-t">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            {new Date(liveClass.scheduledStart).toLocaleString()}
          </div>
          {(liveClass.className || liveClass.sectionName) && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              {[liveClass.className, liveClass.sectionName, liveClass.subjectName]
                .filter(Boolean)
                .join(' · ')}
            </div>
          )}
          {liveClass.hostName && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Video className="h-4 w-4" />
              Host: {liveClass.hostName}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 pt-3 border-t">
          {liveClass.status === 'scheduled' && (
            <>
              <Button onClick={() => start.mutate()} disabled={start.isPending}>
                <PlayCircle className="h-4 w-4 mr-2" />
                {start.isPending ? 'Starting…' : 'Start class'}
              </Button>
              <Button variant="outline" onClick={() => join.mutate()} disabled={join.isPending}>
                Join (waiting room)
              </Button>
            </>
          )}
          {liveClass.status === 'live' && (
            <>
              <Button onClick={() => join.mutate()} disabled={join.isPending}>
                <Video className="h-4 w-4 mr-2" />
                {join.isPending ? 'Joining…' : 'Join live class'}
              </Button>
              <Button variant="destructive" onClick={() => end.mutate()} disabled={end.isPending}>
                <StopCircle className="h-4 w-4 mr-2" />
                End class
              </Button>
            </>
          )}
          {liveClass.status === 'ended' && (
            <div className="text-sm text-muted-foreground">
              Ended {liveClass.actualEnd ? new Date(liveClass.actualEnd).toLocaleString() : ''}
            </div>
          )}
          {liveClass.status === 'cancelled' && (
            <div className="text-sm text-muted-foreground">This class was cancelled.</div>
          )}
        </div>
      </Card>
    </div>
  );
}

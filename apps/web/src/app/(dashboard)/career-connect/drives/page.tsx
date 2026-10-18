'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarClock, GraduationCap, MapPin, Plus, Trash2, Users } from 'lucide-react';
import { careerConnectApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Cell,
  CompanyLogo,
  Empty,
  PageTitle,
  Pager,
  Panel,
  SearchBox,
  Segmented,
  Skeleton,
  StatusPill,
  Table,
  fmtDate,
  lpa,
  useDebounced,
} from '@/components/connect/kit';

interface Drive {
  _id: string;
  driveNumber: string;
  title: string;
  companyName: string;
  companyWebsite?: string | null;
  type: string;
  status: string;
  jobProfile: { role: string; ctc?: number; location?: string; jobType?: string };
  registrations?: unknown[];
  registrationDeadline: string;
  offerCounts?: { offered: number; accepted: number };
}

type Stage = '' | 'registration_open' | 'in_progress' | 'completed' | 'draft';
const TYPE: Record<string, string> = {
  on_campus: 'On campus',
  off_campus: 'Off campus',
  pool_campus: 'Pool campus',
};
const LIMIT = 20;

export default function DrivesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState<Stage>('');
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const q = useDebounced(search);

  const { data, isLoading } = useQuery({
    queryKey: ['drives', q, stage, page],
    queryFn: () =>
      careerConnectApi.getDrives({
        search: q || undefined,
        status: stage || undefined,
        page,
        limit: LIMIT,
      }),
    placeholderData: (prev) => prev,
  });
  const drives: Drive[] = data?.data ?? [];
  const total = (data?.meta as { total?: number } | undefined)?.total ?? 0;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => careerConnectApi.deleteDrive(id),
    onSuccess: () => {
      toast.success('Drive deleted');
      queryClient.invalidateQueries({ queryKey: ['drives'] });
      setDeleteId(null);
    },
    onError: (error: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(error.response?.data?.error?.message || 'Could not delete the drive');
      setDeleteId(null);
    },
  });

  return (
    <>
      <PageTitle
        title="Placement drives"
        description="Every campus drive this season — from registration through interview rounds to offers."
        actions={
          hasPermission('careerConnect.drives', 'create') ? (
            <Button size="sm" onClick={() => router.push('/career-connect/drives/new')}>
              <Plus className="mr-1.5 h-4 w-4" />
              New drive
            </Button>
          ) : null
        }
      />

      <Panel bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-border/70 px-5 py-3">
          <SearchBox
            value={search}
            onChange={(v) => (setSearch(v), setPage(1))}
            placeholder="Search drives or companies"
          />
          <div className="ml-auto">
            <Segmented<Stage>
              value={stage}
              onChange={(v) => (setStage(v), setPage(1))}
              options={[
                { value: '', label: 'All' },
                { value: 'registration_open', label: 'Open' },
                { value: 'in_progress', label: 'Interviewing' },
                { value: 'completed', label: 'Completed' },
                { value: 'draft', label: 'Drafts' },
              ]}
            />
          </div>
        </div>

        {isLoading ? (
          <Skeleton rows={8} />
        ) : drives.length === 0 ? (
          <Empty
            icon={GraduationCap}
            title="No drives here"
            text={
              stage
                ? 'Nothing at this stage right now.'
                : 'Create a drive to open registrations for a recruiter.'
            }
          />
        ) : (
          <>
            <Table head={['Drive', 'Package', 'Registration', 'Outcome', 'Stage', '']}>
              {drives.map((d) => {
                const regs = d.registrations?.length ?? 0;
                const accepted = d.offerCounts?.accepted ?? 0;
                return (
                  <tr
                    key={d._id}
                    onClick={() => router.push(`/career-connect/drives/${d._id}`)}
                    className="group cursor-pointer transition-colors hover:bg-muted/40"
                  >
                    <Cell>
                      <span className="flex items-center gap-3">
                        <CompanyLogo name={d.companyName} website={d.companyWebsite} size={38} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {d.companyName} · {d.jobProfile.role}
                          </span>
                          <span className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{TYPE[d.type] ?? d.type}</span>
                            {d.jobProfile.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {d.jobProfile.location}
                              </span>
                            )}
                            <span className="font-mono">{d.driveNumber}</span>
                          </span>
                        </span>
                      </span>
                    </Cell>
                    <Cell className="whitespace-nowrap font-medium tabular-nums">
                      {lpa(d.jobProfile.ctc ?? 0)}
                    </Cell>
                    <Cell>
                      <span className="block text-sm tabular-nums">
                        <Users className="mr-1 inline h-3.5 w-3.5 text-muted-foreground" />
                        {regs} registered
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CalendarClock className="h-3 w-3" />
                        Closes {fmtDate(d.registrationDeadline, { day: 'numeric', month: 'short' })}
                      </span>
                    </Cell>
                    <Cell>
                      {d.status === 'completed' || accepted ? (
                        <span className="text-sm">
                          <span className="font-semibold tabular-nums">{accepted}</span>
                          <span className="text-muted-foreground">
                            {' '}
                            placed of {d.offerCounts?.offered ?? 0} offers
                          </span>
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </Cell>
                    <Cell>
                      <StatusPill status={d.status} />
                    </Cell>
                    <Cell last>
                      {hasPermission('careerConnect.drives', 'delete') && (
                        <span
                          onClick={(e) => e.stopPropagation()}
                          className="opacity-0 transition group-hover:opacity-100"
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-rose-600"
                            onClick={() => setDeleteId(d._id)}
                            aria-label="Delete drive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </span>
                      )}
                    </Cell>
                  </tr>
                );
              })}
            </Table>
            <Pager page={page} total={total} limit={LIMIT} onPage={setPage} />
          </>
        )}
      </Panel>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this drive?</AlertDialogTitle>
            <AlertDialogDescription>
              Registrations, rounds and offers recorded for it will no longer be visible. This can’t
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Share2, UserPlus } from 'lucide-react';
import { careerConnectApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Avatar,
  Cell,
  CompanyLogo,
  Empty,
  KeyValue,
  PageTitle,
  Panel,
  PersonCell,
  SearchBox,
  Skeleton,
  StatusPill,
  Table,
  daysLeft,
  fmtDate,
  useDebounced,
  type Person,
} from '@/components/connect/kit';
import type { Referral } from '../types';

type ApiErr = Error & { response?: { data?: { error?: { message?: string } } } };

export default function ReferralDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission('careerConnect.alumni', 'edit');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const q = useDebounced(search);

  const { data, isLoading } = useQuery({
    queryKey: ['alumni-referral', id],
    queryFn: () => careerConnectApi.getReferral(id),
  });
  const { data: candidates } = useQuery({
    queryKey: ['student-profiles', 'refer', q],
    queryFn: () => careerConnectApi.getStudentProfiles({ search: q || undefined, limit: 8 }),
    enabled: open,
  });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['alumni-referral', id] });
    queryClient.invalidateQueries({ queryKey: ['alumni-referrals'] });
  };
  const onErr = (f: string) => (e: ApiErr) => toast.error(e.response?.data?.error?.message || f);
  const update = useMutation({
    mutationFn: (d: Record<string, unknown>) => careerConnectApi.updateReferral(id, d),
    onSuccess: () => (toast.success('Referral updated'), refresh()),
    onError: onErr('Could not update'),
  });
  const refer = useMutation({
    mutationFn: (studentId: string) => careerConnectApi.referStudent(id, { studentId }),
    onSuccess: () => (toast.success('Student referred'), refresh()),
    onError: onErr('Could not refer this student'),
  });
  const remove = useMutation({
    mutationFn: () => careerConnectApi.deleteReferral(id),
    onSuccess: () => {
      toast.success('Referral removed');
      queryClient.invalidateQueries({ queryKey: ['alumni-referrals'] });
      router.push('/career-connect/alumni/referrals');
    },
    onError: onErr('Could not remove'),
  });

  if (isLoading) return <Skeleton rows={10} />;
  const r = data?.data as Referral | undefined;
  if (!r) return <Empty icon={Share2} title="Referral not found" />;
  const refs = r.studentsReferred ?? [];
  const already = new Set(refs.map((s) => String(s.studentId)));
  const pool = ((candidates?.data ?? []) as Array<{ studentId: string; person?: Person | null; studentName?: string }>).filter(
    (c) => !already.has(String(c.studentId))
  );
  const left = daysLeft(r.applicationDeadline);

  return (
    <>
      <PageTitle
        crumbs={[
          { label: 'Referrals', href: '/career-connect/alumni/referrals' },
          { label: r.companyName },
        ]}
        title={
          <span className="flex items-center gap-3">
            <CompanyLogo name={r.companyName} size={40} />
            {r.roleTitle}
          </span>
        }
        description={[
          r.companyName,
          r.jobType === 'internship' ? 'Internship' : 'Full-time',
          r.applicationDeadline && (left < 0 ? 'Deadline passed' : `Closes ${fmtDate(r.applicationDeadline)}`),
        ]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <>
            <StatusPill status={r.status} />
            {canEdit && r.status !== 'closed' && (
              <>
                <Button size="sm" variant="outline" onClick={() => update.mutate({ status: 'closed' })}>
                  Close
                </Button>
                <Button size="sm" onClick={() => setOpen(true)}>
                  <UserPlus className="mr-1.5 h-4 w-4" />
                  Refer a student
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          {r.description && (
            <Panel title="About the opening">
              <p className="whitespace-pre-line text-[15px] leading-7 text-foreground/85">{r.description}</p>
            </Panel>
          )}
          <Panel
            title="Students referred"
            description={refs.length ? `${refs.length} so far` : undefined}
            bodyClassName="p-0"
          >
            {refs.length === 0 ? (
              <Empty icon={UserPlus} title="No one referred yet" />
            ) : (
              <Table head={['Student', 'CGPA', 'Referred', 'Status']}>
                {refs.map((s) => (
                  <tr key={String(s.studentId)} className="hover:bg-muted/40">
                    <Cell>
                      <PersonCell
                        person={s.person ?? { name: s.studentName ?? 'Student' }}
                        href={`/career-connect/student-profile/${s.studentId}`}
                      />
                    </Cell>
                    <Cell className="tabular-nums">{s.person?.cgpa?.toFixed(2) ?? '—'}</Cell>
                    <Cell className="text-sm text-muted-foreground">
                      {fmtDate(s.referredAt, { day: 'numeric', month: 'short' })}
                    </Cell>
                    <Cell last>
                      <StatusPill status={s.status} />
                    </Cell>
                  </tr>
                ))}
              </Table>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          {r.alumni && (
            <Link
              href={`/career-connect/alumni/directory/${r.alumni.id}`}
              className="block rounded-xl border bg-card p-5 text-center shadow-xs transition hover:shadow-md"
            >
              <Avatar person={r.alumni} size={64} className="mx-auto" />
              <p className="mt-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Referring alumnus
              </p>
              <p className="font-semibold">{r.alumni.name}</p>
              <p className="text-sm text-muted-foreground">
                {[r.alumni.role, r.alumni.company].filter(Boolean).join(' · ')}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {[r.alumni.program, r.alumni.graduationYear && `Class of ${r.alumni.graduationYear}`]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </Link>
          )}
          <Panel title="Details">
            <KeyValue
              cols={1}
              items={[
                ['Shared', fmtDate(r.createdAt)],
                ['Deadline', fmtDate(r.applicationDeadline)],
                ['Hired so far', String(refs.filter((s) => s.status === 'hired').length)],
              ]}
            />
          </Panel>
          {hasPermission('careerConnect.alumni', 'delete') && (
            <button
              className="text-sm text-muted-foreground hover:text-rose-600"
              onClick={() => confirm('Delete this referral opening?') && remove.mutate()}
            >
              Delete opening
            </button>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Refer a student</DialogTitle>
            <DialogDescription>
              {r.roleTitle} at {r.companyName}
            </DialogDescription>
          </DialogHeader>
          <SearchBox value={search} onChange={setSearch} placeholder="Search students by name" />
          <ul className="max-h-80 divide-y divide-border/60 overflow-y-auto">
            {pool.map((c) => (
              <li key={c.studentId} className="flex items-center justify-between gap-3 py-2.5">
                <PersonCell person={c.person ?? { name: c.studentName ?? 'Student' }} />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={refer.isPending}
                  onClick={() => refer.mutate(c.studentId)}
                >
                  Refer
                </Button>
              </li>
            ))}
            {pool.length === 0 && (
              <li className="py-6 text-center text-sm text-muted-foreground">No matching students</li>
            )}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}

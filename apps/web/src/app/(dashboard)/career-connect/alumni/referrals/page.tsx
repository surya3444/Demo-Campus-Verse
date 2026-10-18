'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarDays, Plus, Share2 } from 'lucide-react';
import { careerConnectApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Avatar,
  CompanyLogo,
  Empty,
  Faces,
  PageTitle,
  Pager,
  Pill,
  SearchBox,
  Segmented,
  Skeleton,
  Stat,
  StatusPill,
  daysLeft,
  useDebounced,
} from '@/components/connect/kit';
import type { Referral } from './types';

type Show = '' | 'open' | 'in_progress' | 'closed';
type ApiErr = Error & { response?: { data?: { error?: { message?: string } } } };
const LIMIT = 12;
const EMPTY = { companyName: '', roleTitle: '', jobType: 'job', description: '', applicationDeadline: '' };

export default function ReferralsPage() {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const [search, setSearch] = useState('');
  const [show, setShow] = useState<Show>('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const q = useDebounced(search);

  const { data, isLoading } = useQuery({
    queryKey: ['alumni-referrals', q, show, page],
    queryFn: () =>
      careerConnectApi.getReferrals({
        search: q || undefined,
        status: show || undefined,
        page,
        limit: LIMIT,
      }),
    placeholderData: (prev) => prev,
  });
  const { data: allData } = useQuery({
    queryKey: ['alumni-referrals', 'all'],
    queryFn: () => careerConnectApi.getReferrals({ limit: 100 }),
  });
  const create = useMutation({
    mutationFn: () =>
      careerConnectApi.createReferral({
        ...form,
        description: form.description || undefined,
        applicationDeadline: form.applicationDeadline || undefined,
      }),
    onSuccess: () => {
      toast.success('Referral opening shared');
      queryClient.invalidateQueries({ queryKey: ['alumni-referrals'] });
      setOpen(false);
      setForm(EMPTY);
    },
    onError: (e: ApiErr) =>
      toast.error(e.response?.data?.error?.message || 'Could not share the opening'),
  });

  const rows = (data?.data ?? []) as Referral[];
  const all = (allData?.data ?? []) as Referral[];
  const total = (data?.meta as { total?: number } | undefined)?.total ?? 0;
  const referred = all.flatMap((r) => r.studentsReferred ?? []);
  const hired = referred.filter((s) => s.status === 'hired').length;

  return (
    <>
      <PageTitle
        title="Referrals"
        description="Openings alumni can refer students into directly — the warmest path into a company."
        actions={
          hasPermission('careerConnect.alumni', 'create') ? (
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Share an opening
            </Button>
          ) : null
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Open referrals" value={all.filter((r) => r.status === 'open').length} />
        <Stat
          label="Companies"
          value={new Set(all.map((r) => r.companyName)).size}
          hint="Where alumni can refer"
        />
        <Stat label="Students referred" value={referred.length} />
        <Stat
          label="Hired through referrals"
          value={hired}
          hint={referred.length ? `${Math.round((hired / referred.length) * 100)}% of referrals` : ''}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchBox
          value={search}
          onChange={(v) => (setSearch(v), setPage(1))}
          placeholder="Search company or role"
        />
        <div className="ml-auto">
          <Segmented<Show>
            value={show}
            onChange={(v) => (setShow(v), setPage(1))}
            options={[
              { value: '', label: 'All' },
              { value: 'open', label: 'Open' },
              { value: 'in_progress', label: 'In progress' },
              { value: 'closed', label: 'Closed' },
            ]}
          />
        </div>
      </div>

      {isLoading ? (
        <Skeleton rows={8} />
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-border/70 bg-card">
          <Empty icon={Share2} title="No referral openings" text="Ask alumni to share one." />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((r) => {
              const left = daysLeft(r.applicationDeadline);
              const refs = r.studentsReferred ?? [];
              return (
                <Link
                  key={r._id}
                  href={`/career-connect/alumni/referrals/${r._id}`}
                  className="flex flex-col rounded-2xl border border-border/70 bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <CompanyLogo name={r.companyName} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-muted-foreground">{r.companyName}</p>
                      <p className="font-semibold leading-snug">{r.roleTitle}</p>
                    </div>
                    <StatusPill status={r.status} />
                  </div>
                  <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-muted/50 p-2.5">
                    <Avatar person={{ name: r.alumni?.name ?? '?', photo: r.alumni?.photo }} size={30} />
                    <p className="min-w-0 truncate text-xs text-muted-foreground">
                      Referred by{' '}
                      <span className="font-medium text-foreground">{r.alumni?.name ?? 'an alumnus'}</span>
                      {r.alumni?.graduationYear ? ` · ’${String(r.alumni.graduationYear).slice(2)}` : ''}
                    </p>
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-2">
                      {refs.length ? (
                        <>
                          <Faces people={refs.map((s) => s.person ?? { name: s.studentName ?? '?' })} max={4} size={22} />
                          {refs.length} referred
                        </>
                      ) : (
                        'No one referred yet'
                      )}
                    </span>
                    <span className="flex items-center gap-1.5">
                      {r.jobType === 'internship' && (
                        <Pill tone="violet" dot={false}>
                          Internship
                        </Pill>
                      )}
                      {r.applicationDeadline && r.status !== 'closed' && (
                        <>
                          <CalendarDays className="h-3.5 w-3.5" />
                          {left < 0 ? 'Past deadline' : `${left}d left`}
                        </>
                      )}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="mt-4 rounded-2xl border border-border/70 bg-card">
            <Pager page={page} total={total} limit={LIMIT} onPage={setPage} />
          </div>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Share a referral opening</DialogTitle>
            <DialogDescription>Students will see it and you can refer the best fits.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="c">Company</Label>
              <Input id="c" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r">Role</Label>
              <Input id="r" value={form.roleTitle} onChange={(e) => setForm({ ...form, roleTitle: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Segmented
                value={form.jobType}
                onChange={(v) => setForm({ ...form, jobType: v })}
                options={[
                  { value: 'job', label: 'Full-time' },
                  { value: 'internship', label: 'Internship' },
                ]}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dl">Deadline</Label>
              <Input
                id="dl"
                type="date"
                value={form.applicationDeadline}
                onChange={(e) => setForm({ ...form, applicationDeadline: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ds">What the team does / who fits</Label>
              <Textarea
                id="ds"
                rows={4}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!form.companyName || !form.roleTitle || create.isPending}
              onClick={() => create.mutate()}
            >
              Share opening
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

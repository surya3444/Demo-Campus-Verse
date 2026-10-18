'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Briefcase, CheckCircle2, MoreHorizontal, Send } from 'lucide-react';
import { careerConnectApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Cell,
  CompanyLogo,
  Empty,
  KeyValue,
  Meter,
  PageTitle,
  Panel,
  PersonCell,
  Pill,
  Segmented,
  Skeleton,
  Stat,
  StatusPill,
  Table,
  daysLeft,
  fmtDate,
  jobPay,
  type Person,
} from '@/components/connect/kit';

interface JobPosting {
  _id: string;
  title: string;
  companyName?: string;
  companyWebsite?: string | null;
  type: string;
  status: string;
  description: string;
  requirements?: string[];
  salary?: { min?: number; max?: number };
  stipend?: { amount?: number; duration?: string };
  location?: string;
  workMode?: string;
  eligibility?: { minCGPA?: number; allowedDepartments?: string[] };
  applicationDeadline: string;
  maxApplications?: number;
  applicationCount?: number;
  postingNumber?: string;
  createdAt: string;
}
interface Application {
  _id: string;
  studentId: string;
  studentName?: string;
  status: string;
  coverLetter?: string;
  appliedAt?: string;
  createdAt: string;
  person?: Person | null;
}

const STAGES = ['applied', 'shortlisted', 'interview', 'selected', 'rejected'] as const;
type Show = '' | (typeof STAGES)[number];
type ApiErr = Error & { response?: { data?: { error?: { message?: string } } } };

export default function JobPostingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('careerConnect.jobBoard', 'edit');
  const [applyOpen, setApplyOpen] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const [resumeUrl, setResumeUrl] = useState('');
  const [show, setShow] = useState<Show>('');

  const { data, isLoading } = useQuery({
    queryKey: ['job-posting', id],
    queryFn: () => careerConnectApi.getJobPosting(id),
  });
  const { data: appsData } = useQuery({
    queryKey: ['job-applications', id],
    queryFn: () => careerConnectApi.getJobApplications(id, { limit: 100 }),
    enabled: canManage,
  });

  const onErr = (fallback: string) => (e: ApiErr) =>
    toast.error(e.response?.data?.error?.message || fallback);
  const apply = useMutation({
    mutationFn: () =>
      careerConnectApi.applyForJob(id, {
        coverLetter: coverLetter || undefined,
        resumeUrl: resumeUrl || undefined,
      }),
    onSuccess: () => {
      toast.success('Application sent');
      queryClient.invalidateQueries({ queryKey: ['job-posting', id] });
      queryClient.invalidateQueries({ queryKey: ['my-applications'] });
      setApplyOpen(false);
      setCoverLetter('');
      setResumeUrl('');
    },
    onError: onErr('Could not send your application'),
  });
  const moveApp = useMutation({
    mutationFn: ({ appId, status }: { appId: string; status: string }) =>
      careerConnectApi.updateApplicationStatus(appId, { status }),
    onSuccess: () => {
      toast.success('Application updated');
      queryClient.invalidateQueries({ queryKey: ['job-applications', id] });
    },
    onError: onErr('Could not update the application'),
  });
  const setPostingStatus = useMutation({
    mutationFn: (status: string) => careerConnectApi.updateJobPostingStatus(id, status),
    onSuccess: () => {
      toast.success('Posting updated');
      queryClient.invalidateQueries({ queryKey: ['job-posting', id] });
      queryClient.invalidateQueries({ queryKey: ['job-postings'] });
    },
    onError: onErr('Could not update the posting'),
  });
  const remove = useMutation({
    mutationFn: () => careerConnectApi.deleteJobPosting(id),
    onSuccess: () => {
      toast.success('Posting deleted');
      queryClient.invalidateQueries({ queryKey: ['job-postings'] });
      router.push('/career-connect/job-board');
    },
    onError: onErr('Could not delete the posting'),
  });

  if (isLoading) return <Skeleton rows={10} />;
  const job = data?.data as JobPosting | undefined;
  if (!job) return <Empty icon={Briefcase} title="Posting not found" />;

  const apps = (appsData?.data ?? []) as Application[];
  const count = (s: string) => apps.filter((a) => a.status === s).length;
  const left = daysLeft(job.applicationDeadline);
  const canApply =
    !canManage &&
    hasPermission('careerConnect.jobBoard', 'apply') &&
    job.status === 'active' &&
    left >= 0;
  const shown = show ? apps.filter((a) => a.status === show) : apps;
  const money = jobPay(job);
  const total = job.applicationCount ?? apps.length;

  return (
    <>
      <PageTitle
        crumbs={[
          { label: 'Job board', href: '/career-connect/job-board' },
          { label: job.postingNumber ?? job.companyName ?? 'Opening' },
        ]}
        title={
          <span className="flex items-center gap-3">
            <CompanyLogo name={job.companyName ?? ''} website={job.companyWebsite} size={40} />
            {job.title}
          </span>
        }
        description={[
          job.companyName,
          job.location && `${job.location}${job.workMode ? ` · ${job.workMode}` : ''}`,
          money,
          left >= 0 ? `Applications close ${fmtDate(job.applicationDeadline)}` : 'Applications closed',
        ]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <>
            {job.status !== 'active' && <StatusPill status={job.status} />}
            {canApply && (
              <Button size="sm" onClick={() => setApplyOpen(true)}>
                <Send className="mr-1.5 h-4 w-4" />
                Apply
              </Button>
            )}
            {canManage && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8" aria-label="More">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {job.status !== 'active' && (
                    <DropdownMenuItem onClick={() => setPostingStatus.mutate('active')}>
                      Publish to students
                    </DropdownMenuItem>
                  )}
                  {job.status === 'active' && (
                    <DropdownMenuItem onClick={() => setPostingStatus.mutate('closed')}>
                      Close applications
                    </DropdownMenuItem>
                  )}
                  {hasPermission('careerConnect.jobBoard', 'delete') && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-rose-600"
                        onClick={() =>
                          confirm(`Delete “${job.title}”? Applications will be lost.`) &&
                          remove.mutate()
                        }
                      >
                        Delete posting
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        }
      />

      {canManage && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label="Applied"
            value={total}
            hint={job.maxApplications ? `of ${job.maxApplications} seats` : undefined}
          />
          <Stat label="Shortlisted" value={count('shortlisted') + count('interview')} />
          <Stat label="In interviews" value={count('interview')} />
          <Stat
            label="Selected"
            value={count('selected')}
            hint={total ? `${Math.round((count('selected') / total) * 100)}% of applicants` : ''}
          />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <Panel title="About the role">
            <p className="whitespace-pre-line text-[15px] leading-7 text-foreground/85">
              {job.description}
            </p>
            {job.requirements?.length ? (
              <>
                <p className="mb-2.5 mt-6 text-sm font-medium">What they’re looking for</p>
                <ul className="space-y-2">
                  {job.requirements.map((r) => (
                    <li key={r} className="flex items-start gap-2.5 text-sm text-foreground/85">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      {r}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </Panel>

          {canManage && (
            <Panel
              title="Applicants"
              description="Move students along as the company shortlists."
              bodyClassName="p-0"
            >
              <div className="border-b border-border/70 px-5 py-3">
                <Segmented<Show>
                  value={show}
                  onChange={setShow}
                  options={[
                    { value: '', label: 'All', count: apps.length },
                    { value: 'shortlisted', label: 'Shortlisted', count: count('shortlisted') },
                    { value: 'interview', label: 'Interview', count: count('interview') },
                    { value: 'selected', label: 'Selected', count: count('selected') },
                  ]}
                />
              </div>
              {shown.length === 0 ? (
                <Empty icon={Briefcase} title="No applicants here yet" />
              ) : (
                <Table head={['Student', 'CGPA', 'Applied', 'Stage']}>
                  {shown.map((a) => (
                    <tr key={a._id} className="transition-colors hover:bg-muted/40">
                      <Cell>
                        <PersonCell
                          person={a.person ?? { name: a.studentName ?? 'Student' }}
                          href={`/career-connect/student-profile/${a.studentId}`}
                        />
                      </Cell>
                      <Cell className="tabular-nums">{a.person?.cgpa?.toFixed(2) ?? '—'}</Cell>
                      <Cell className="whitespace-nowrap text-sm text-muted-foreground">
                        {fmtDate(a.appliedAt ?? a.createdAt, { day: 'numeric', month: 'short' })}
                      </Cell>
                      <Cell last>
                        <Select
                          value={a.status}
                          onValueChange={(status) => moveApp.mutate({ appId: a._id, status })}
                        >
                          <SelectTrigger className="h-8 w-[140px] capitalize">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STAGES.map((s) => (
                              <SelectItem key={s} value={s} className="capitalize">
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Cell>
                    </tr>
                  ))}
                </Table>
              )}
            </Panel>
          )}
        </div>

        <div className="space-y-6">
          <Panel title="At a glance">
            <KeyValue
              cols={1}
              items={[
                ['Type', job.type === 'internship' ? 'Internship' : 'Full-time'],
                ['Pay', money ?? 'Not disclosed'],
                [
                  'Location',
                  `${job.location ?? '—'}${job.workMode ? ` · ${job.workMode}` : ''}`,
                ],
                ['Eligibility', job.eligibility?.minCGPA ? `CGPA ${job.eligibility.minCGPA} and above` : 'All final-year students'],
                ['Posted', fmtDate(job.createdAt)],
              ]}
            />
          </Panel>
          <Panel title="Deadline">
            <p className="text-3xl font-semibold tabular-nums tracking-tight">
              {left < 0 ? 'Closed' : left === 0 ? 'Today' : `${left} days`}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {fmtDate(job.applicationDeadline, { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            {canManage && apps.length > 0 && (
              <div className="mt-5 space-y-3">
                {(['shortlisted', 'interview', 'selected'] as const).map((s) => (
                  <div key={s}>
                    <div className="flex justify-between text-xs">
                      <span className="capitalize text-muted-foreground">{s}</span>
                      <span className="tabular-nums">{count(s)}</span>
                    </div>
                    <Meter value={(count(s) / apps.length) * 100} className="mt-1" />
                  </div>
                ))}
              </div>
            )}
            {job.status === 'active' && left >= 0 && left <= 5 && (
              <Pill tone="amber" className="mt-4">
                Closing soon
              </Pill>
            )}
          </Panel>
        </div>
      </div>

      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Apply to {job.companyName}</DialogTitle>
            <DialogDescription>
              {job.title}. Your career profile is shared with the application.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cover">Why you’re a fit (optional)</Label>
              <Textarea
                id="cover"
                rows={5}
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                placeholder="A few lines on your strongest project or internship."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="resume">Résumé link (optional)</Label>
              <Input
                id="resume"
                value={resumeUrl}
                onChange={(e) => setResumeUrl(e.target.value)}
                placeholder="https://"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => apply.mutate()} disabled={apply.isPending}>
              {apply.isPending ? 'Sending…' : 'Send application'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

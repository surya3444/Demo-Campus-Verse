'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Briefcase, CalendarDays, MapPin, Plus, Users } from 'lucide-react';
import { careerConnectApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import {
  CompanyLogo,
  Empty,
  PageTitle,
  Pager,
  Pill,
  SearchBox,
  Segmented,
  Skeleton,
  StatusPill,
  daysLeft,
  jobPay as pay,
  useDebounced,
} from '@/components/connect/kit';

interface JobPosting {
  _id: string;
  title: string;
  companyName?: string;
  companyWebsite?: string | null;
  type: 'job' | 'internship';
  status: string;
  workMode?: string;
  location?: string;
  salary?: { min?: number; max?: number };
  stipend?: { amount?: number; duration?: string };
  eligibility?: { minCGPA?: number };
  applicationDeadline: string;
  applicationCount?: number;
}

type Kind = '' | 'job' | 'internship';
type Show = '' | 'active' | 'closed' | 'draft';
const LIMIT = 12;

export default function JobBoardPage() {
  const { hasPermission } = usePermissions();
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<Kind>('');
  const [show, setShow] = useState<Show>('active');
  const [page, setPage] = useState(1);
  const q = useDebounced(search);

  const { data, isLoading } = useQuery({
    queryKey: ['job-postings', q, kind, show, page],
    queryFn: () =>
      careerConnectApi.getJobPostings({
        search: q || undefined,
        type: kind || undefined,
        status: show || undefined,
        page,
        limit: LIMIT,
      }),
    placeholderData: (prev) => prev,
  });
  const jobs = (data?.data ?? []) as JobPosting[];
  const total = (data?.meta as { total?: number } | undefined)?.total ?? 0;

  return (
    <>
      <PageTitle
        title="Job board"
        description="Off-campus openings and internships shared with students — apply in one tap with a career profile."
        actions={
          hasPermission('careerConnect.jobBoard', 'create') ? (
            <Button size="sm" asChild>
              <Link href="/career-connect/job-board/new">
                <Plus className="mr-1.5 h-4 w-4" />
                Post an opening
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <SearchBox
          value={search}
          onChange={(v) => (setSearch(v), setPage(1))}
          placeholder="Search roles or companies"
        />
        <Segmented<Kind>
          value={kind}
          onChange={(v) => (setKind(v), setPage(1))}
          options={[
            { value: '', label: 'All' },
            { value: 'job', label: 'Full-time' },
            { value: 'internship', label: 'Internships' },
          ]}
        />
        <div className="ml-auto">
          <Segmented<Show>
            value={show}
            onChange={(v) => (setShow(v), setPage(1))}
            options={[
              { value: 'active', label: 'Open' },
              { value: 'closed', label: 'Closed' },
              { value: 'draft', label: 'Drafts' },
              { value: '', label: 'Everything' },
            ]}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-border/70 bg-card">
          <Skeleton rows={8} />
        </div>
      ) : jobs.length === 0 ? (
        <div className="rounded-2xl border border-border/70 bg-card">
          <Empty icon={Briefcase} title="No openings here" text="Try another filter or post one." />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {jobs.map((j) => {
              const left = daysLeft(j.applicationDeadline);
              const money = pay(j);
              return (
                <Link
                  key={j._id}
                  href={`/career-connect/job-board/${j._id}`}
                  className="group flex flex-col rounded-2xl border border-border/70 bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:-translate-y-0.5 hover:border-border hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <CompanyLogo name={j.companyName ?? ''} website={j.companyWebsite} size={44} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-muted-foreground">{j.companyName}</p>
                      <p className="mt-0.5 font-semibold leading-snug group-hover:text-[#1e4fd8]">
                        {j.title}
                      </p>
                    </div>
                    {j.status !== 'active' && <StatusPill status={j.status} />}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-muted-foreground">
                    {j.location && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        {j.location}
                        {j.workMode ? ` · ${j.workMode}` : ''}
                      </span>
                    )}
                    {j.eligibility?.minCGPA ? <span>CGPA {j.eligibility.minCGPA}+</span> : null}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Pill tone={j.type === 'internship' ? 'violet' : 'blue'} dot={false}>
                      {j.type === 'internship' ? 'Internship' : 'Full-time'}
                    </Pill>
                    {money && <span className="text-sm font-semibold tabular-nums">{money}</span>}
                  </div>

                  <div className="mt-auto flex items-center justify-between border-t border-border/60 pt-3.5 text-xs text-muted-foreground [margin-top:1.25rem]">
                    <span className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      {j.applicationCount ?? 0} applied
                    </span>
                    <span
                      className={
                        left <= 5 && left >= 0
                          ? 'flex items-center gap-1.5 font-medium text-amber-700'
                          : 'flex items-center gap-1.5'
                      }
                    >
                      <CalendarDays className="h-3.5 w-3.5" />
                      {left < 0 ? 'Closed' : left === 0 ? 'Closes today' : `${left} days left`}
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
    </>
  );
}

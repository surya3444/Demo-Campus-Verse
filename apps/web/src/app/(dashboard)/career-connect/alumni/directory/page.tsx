'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, Briefcase, GraduationCap, MapPin } from 'lucide-react';
import { careerConnectApi } from '@/lib/api';
import {
  Avatar,
  Empty,
  PageTitle,
  Pager,
  Panel,
  SearchBox,
  Segmented,
  Skeleton,
  useDebounced,
  type Person,
} from '@/components/connect/kit';

interface AlumniProfile {
  _id: string;
  studentName: string;
  graduationYear: number | null;
  company?: string;
  currentCompany?: string;
  currentRole?: string;
  designation?: string;
  location?: string;
  isVerified: boolean;
  mentorshipInfo?: { willingToMentor: boolean; expertise?: string[] };
  person?: Person | null;
}

type Show = 'all' | 'mentors' | 'verified';
const LIMIT = 24;

export default function AlumniDirectoryPage() {
  const [search, setSearch] = useState('');
  const [company, setCompany] = useState('');
  const [show, setShow] = useState<Show>('all');
  const [page, setPage] = useState(1);
  const q = useDebounced(search);
  const c = useDebounced(company);

  const { data, isLoading } = useQuery({
    queryKey: ['alumni-profiles', q, c, show, page],
    queryFn: () =>
      careerConnectApi.getAlumniProfiles({
        search: q || undefined,
        company: c || undefined,
        willingToMentor: show === 'mentors' ? 'true' : undefined,
        isVerified: show === 'verified' ? 'true' : undefined,
        page,
        limit: LIMIT,
      }),
    placeholderData: (prev) => prev,
  });
  const alumni = (data?.data ?? []) as AlumniProfile[];
  const total = (data?.meta as { total?: number } | undefined)?.total ?? 0;

  return (
    <>
      <PageTitle
        title="Alumni network"
        description="Graduates who stay connected — where they work today, and who’s open to mentoring current students."
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <SearchBox
          value={search}
          onChange={(v) => (setSearch(v), setPage(1))}
          placeholder="Search alumni"
        />
        <input
          value={company}
          onChange={(e) => (setCompany(e.target.value), setPage(1))}
          placeholder="Company"
          className="h-9 w-48 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
        />
        <div className="ml-auto">
          <Segmented<Show>
            value={show}
            onChange={(v) => (setShow(v), setPage(1))}
            options={[
              { value: 'all', label: 'Everyone' },
              { value: 'mentors', label: 'Mentors' },
              { value: 'verified', label: 'Verified' },
            ]}
          />
        </div>
      </div>

      {isLoading ? (
        <Panel>
          <Skeleton rows={6} />
        </Panel>
      ) : alumni.length === 0 ? (
        <Panel>
          <Empty icon={GraduationCap} title="No alumni found" text="Try another name or company." />
        </Panel>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {alumni.map((a) => {
              const company = a.currentCompany || a.company;
              const role = a.currentRole || a.designation;
              return (
                <Link
                  key={a._id}
                  href={`/career-connect/alumni/directory/${a._id}`}
                  className="group flex flex-col rounded-2xl border border-border/70 bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-border hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <Avatar person={{ name: a.studentName, photo: a.person?.photo }} size={52} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1 truncate font-semibold">
                        {a.studentName}
                        {a.isVerified && (
                          <BadgeCheck
                            className="h-4 w-4 shrink-0 text-blue-600"
                            aria-label="Verified"
                          />
                        )}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">{role || 'Alumnus'}</p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-1.5 text-sm">
                    {company && (
                      <p className="flex items-center gap-2 truncate">
                        <Briefcase className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        {company}
                      </p>
                    )}
                    {a.location && (
                      <p className="flex items-center gap-2 truncate text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        {a.location}
                      </p>
                    )}
                    <p className="flex items-center gap-2 truncate text-muted-foreground">
                      <GraduationCap className="h-3.5 w-3.5 shrink-0" />
                      {[a.person?.program, a.graduationYear && `Class of ${a.graduationYear}`]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </p>
                  </div>
                  {a.mentorshipInfo?.willingToMentor && (
                    <div className="mt-4 border-t border-border/70 pt-3">
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                        Open to mentoring
                      </span>
                      {a.mentorshipInfo.expertise?.length ? (
                        <p className="mt-1.5 truncate text-xs text-muted-foreground">
                          {a.mentorshipInfo.expertise.join(' · ')}
                        </p>
                      ) : null}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-border/70 bg-card">
            <Pager page={page} total={total} limit={LIMIT} onPage={setPage} />
          </div>
        </>
      )}
    </>
  );
}

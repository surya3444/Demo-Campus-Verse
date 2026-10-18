'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Users } from 'lucide-react';
import { careerConnectApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import {
  Cell,
  Empty,
  Meter,
  PageTitle,
  Pager,
  Panel,
  PersonCell,
  Pill,
  SearchBox,
  Segmented,
  Skeleton,
  SkillTag,
  Table,
  lpa,
  useDebounced,
  type Person,
} from '@/components/connect/kit';

interface Profile {
  _id: string;
  studentId: string;
  studentName: string;
  skills: Array<{ name: string; proficiency?: string }>;
  projects?: unknown[];
  certifications?: unknown[];
  experience?: Array<{ company: string; role: string }>;
  placementStatus: string;
  placement?: { company: string; role: string; ctc: number };
  profileCompleteness?: { percentage: number };
  person?: Person & { cgpa?: number | null };
}

type Status = '' | 'placed' | 'unplaced' | 'higher_studies' | 'opted_out';
const LIMIT = 20;

export default function StudentProfilesPage() {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const canView = hasPermission('careerConnect.studentProfiles', 'view');
  const [search, setSearch] = useState('');
  const [skill, setSkill] = useState('');
  const [status, setStatus] = useState<Status>('');
  const [page, setPage] = useState(1);
  const q = useDebounced(search);
  const s = useDebounced(skill);

  const { data, isLoading } = useQuery({
    queryKey: ['student-profiles', q, s, status, page],
    queryFn: () =>
      careerConnectApi.getStudentProfiles({
        search: q || undefined,
        skills: s || undefined,
        placementStatus: status || undefined,
        page,
        limit: LIMIT,
        sortBy: 'updatedAt',
      }),
    enabled: canView,
    placeholderData: (prev) => prev,
  });
  const rows = (data?.data ?? []) as Profile[];
  const total = (data?.meta as { total?: number } | undefined)?.total ?? 0;

  if (!canView)
    return (
      <Empty
        icon={Users}
        title="No access"
        text="You don’t have permission to view student career profiles."
      />
    );

  return (
    <>
      <PageTitle
        title="Student profiles"
        description="Every student preparing for placements — their skills, projects and where they’ve been placed."
      />
      <Panel bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-border/70 px-5 py-3">
          <SearchBox
            value={search}
            onChange={(v) => (setSearch(v), setPage(1))}
            placeholder="Search students"
          />
          <input
            value={skill}
            onChange={(e) => (setSkill(e.target.value), setPage(1))}
            placeholder="Filter by skill, e.g. Python"
            className="h-9 w-56 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
          <div className="ml-auto">
            <Segmented<Status>
              value={status}
              onChange={(v) => (setStatus(v), setPage(1))}
              options={[
                { value: '', label: 'All' },
                { value: 'placed', label: 'Placed' },
                { value: 'unplaced', label: 'Looking' },
                { value: 'higher_studies', label: 'Higher studies' },
              ]}
            />
          </div>
        </div>
        {isLoading ? (
          <Skeleton rows={10} />
        ) : rows.length === 0 ? (
          <Empty
            icon={Users}
            title="No students match"
            text="Try a different name, skill or status."
          />
        ) : (
          <>
            <Table head={['Student', 'Top skills', 'Readiness', 'Placement', '']}>
              {rows.map((p) => {
                const person: Person = p.person ?? { name: p.studentName };
                const pct = p.profileCompleteness?.percentage ?? 0;
                return (
                  <tr
                    key={p._id}
                    onClick={() => router.push(`/career-connect/student-profile/${p.studentId}`)}
                    className="cursor-pointer transition-colors hover:bg-muted/40"
                  >
                    <Cell>
                      <PersonCell
                        person={person}
                        sub={[person.program, person.cgpa ? `CGPA ${person.cgpa}` : null]
                          .filter(Boolean)
                          .join(' · ')}
                      />
                    </Cell>
                    <Cell>
                      <div className="flex max-w-[260px] flex-wrap gap-1">
                        {p.skills.slice(0, 3).map((k) => (
                          <SkillTag key={k.name}>{k.name}</SkillTag>
                        ))}
                        {p.skills.length > 3 && (
                          <span className="text-[11px] text-muted-foreground">
                            +{p.skills.length - 3}
                          </span>
                        )}
                        {!p.skills.length && (
                          <span className="text-xs text-muted-foreground">No skills added</span>
                        )}
                      </div>
                    </Cell>
                    <Cell>
                      <div className="flex w-32 items-center gap-2">
                        <Meter
                          value={pct}
                          color={pct >= 70 ? '#16a34a' : pct >= 40 ? '#1e4fd8' : '#f59e0b'}
                          className="flex-1"
                        />
                        <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
                          {pct}%
                        </span>
                      </div>
                    </Cell>
                    <Cell>
                      {p.placementStatus === 'placed' && p.placement ? (
                        <div>
                          <p className="text-sm font-medium">{p.placement.company}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.placement.role} · {lpa(p.placement.ctc)}
                          </p>
                        </div>
                      ) : p.placementStatus === 'placed' ? (
                        <Pill tone="green">Placed</Pill>
                      ) : p.placementStatus === 'higher_studies' ? (
                        <Pill tone="violet">Higher studies</Pill>
                      ) : p.placementStatus === 'opted_out' ? (
                        <Pill tone="gray">Opted out</Pill>
                      ) : (
                        <Pill tone="blue">Looking</Pill>
                      )}
                    </Cell>
                    <Cell last>
                      <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
                    </Cell>
                  </tr>
                );
              })}
            </Table>
            <Pager page={page} total={total} limit={LIMIT} onPage={setPage} />
          </>
        )}
      </Panel>
    </>
  );
}

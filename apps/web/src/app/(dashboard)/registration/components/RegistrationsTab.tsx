'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { registrationApi, academicApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ClipboardCheck, Download, Users, AlertCircle, BookOpenCheck } from 'lucide-react';
import { toast } from 'sonner';

interface Term {
  _id: string;
  name: string;
  registrationWindow?: { opensAt: string; closesAt: string };
}

interface Batch {
  _id: string;
  name: string;
  isCurrent: boolean;
  terms?: Term[];
}

interface OverviewScheme {
  schemeId: string;
  departmentCode: string;
  departmentName: string;
  semesterNumber: number;
  registeredCount: number;
  baskets: Array<{
    slotId: string;
    label: string;
    options: Array<{
      subjectId: string;
      subjectName?: string;
      seatCap?: number;
      seatsTaken: number;
    }>;
  }>;
}

interface RegistrationRow {
  _id: string;
  departmentCode: string;
  semesterNumber: number;
  totalCredits: number;
  submittedAt: string;
  entries: Array<{ subject: { code: string } | null }>;
  student: {
    _id: string;
    displayName: string;
    admissionNumber?: string;
    rollNumber?: string;
  } | null;
}

interface PendingRow {
  _id: string;
  displayName: string;
  admissionNumber?: string;
  rollNumber?: string;
  className: string;
  departmentCode: string;
  semesterNumber: number;
}

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map((r) => r.map(escape).join(',')).join('\n');
  // BOM so Excel opens the UTF-8 CSV correctly.
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function RegistrationsTab({ onGoToCurriculum }: { onGoToCurriculum: () => void }) {
  const [batch, setBatch] = useState<Batch | null>(null);
  const [termId, setTermId] = useState<string>('');
  const [overview, setOverview] = useState<OverviewScheme[]>([]);
  const [registrations, setRegistrations] = useState<RegistrationRow[]>([]);
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [pendingTruncated, setPendingTruncated] = useState(false);
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [loadingTerm, setLoadingTerm] = useState(false);

  // Resolve the current batch and default term once.
  useEffect(() => {
    (async () => {
      try {
        const res = await academicApi.getCurrentBatch();
        const current = res.data as Batch | null;
        setBatch(current);
        const terms = current?.terms ?? [];
        if (terms.length > 0) {
          // Prefer the term whose registration window is open.
          const now = Date.now();
          const open = terms.find(
            (t) =>
              t.registrationWindow &&
              now >= new Date(t.registrationWindow.opensAt).getTime() &&
              now <= new Date(t.registrationWindow.closesAt).getTime()
          );
          setTermId((open ?? terms[terms.length - 1])._id);
        }
      } catch {
        toast.error('Failed to load the current academic session');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadTermData = useCallback(async () => {
    if (!batch || !termId) return;
    setLoadingTerm(true);
    try {
      const [overviewRes, regsRes, pendingRes] = await Promise.all([
        registrationApi.getTermOverview(termId),
        registrationApi.getTermRegistrations(termId, { limit: 100 }),
        registrationApi.getTermPending(termId, { academicBatchId: batch._id, limit: 1000 }),
      ]);
      setOverview(overviewRes.data || []);
      setRegistrations(regsRes.data || []);
      setPending(pendingRes.data || []);
      setPendingTruncated(!!pendingRes.truncated);
    } catch {
      toast.error('Failed to load registration data');
    } finally {
      setLoadingTerm(false);
    }
  }, [batch, termId]);

  useEffect(() => {
    void loadTermData();
  }, [loadTermData]);

  const departments = useMemo(
    () => [...new Set(overview.map((s) => s.departmentCode))].sort(),
    [overview]
  );

  const filteredOverview =
    deptFilter === 'all' ? overview : overview.filter((s) => s.departmentCode === deptFilter);
  const filteredRegistrations =
    deptFilter === 'all'
      ? registrations
      : registrations.filter((r) => r.departmentCode === deptFilter);
  const filteredPending =
    deptFilter === 'all' ? pending : pending.filter((p) => p.departmentCode === deptFilter);

  const totals = useMemo(
    () => ({
      registered: filteredRegistrations.length,
      pending: filteredPending.length,
      schemes: filteredOverview.length,
    }),
    [filteredRegistrations, filteredPending, filteredOverview]
  );

  const exportRegistered = () =>
    downloadCsv(
      `registrations-${termId}.csv`,
      [
        'Student',
        'Admission No',
        'Roll No',
        'Department',
        'Semester',
        'Credits',
        'Courses',
        'Submitted',
      ],
      filteredRegistrations.map((r) => [
        r.student?.displayName ?? '',
        r.student?.admissionNumber ?? '',
        r.student?.rollNumber ?? '',
        r.departmentCode,
        r.semesterNumber,
        r.totalCredits,
        r.entries
          .map((e) => e.subject?.code)
          .filter(Boolean)
          .join(' '),
        new Date(r.submittedAt).toLocaleString(),
      ])
    );

  const exportPending = () =>
    downloadCsv(
      `pending-${termId}.csv`,
      ['Student', 'Admission No', 'Roll No', 'Class', 'Department', 'Semester'],
      filteredPending.map((p) => [
        p.displayName,
        p.admissionNumber ?? '',
        p.rollNumber ?? '',
        p.className,
        p.departmentCode,
        p.semesterNumber,
      ])
    );

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-72" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  const terms = batch?.terms ?? [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {batch
          ? `Who has registered for ${batch.name}, and how the electives are filling up.`
          : 'Course registration status'}
      </p>

      {terms.length === 0 ? (
        <EmptyState
          icon={AlertCircle}
          title="No terms configured"
          description="Add semester terms (with registration windows) to the current academic session first — Organization → Academic Structure."
        />
      ) : (
        <>
          {/* Term + department filters */}
          <div className="flex flex-wrap items-center gap-3">
            <Select value={termId} onValueChange={setTermId}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select term" />
              </SelectTrigger>
              <SelectContent>
                {terms.map((t) => (
                  <SelectItem key={t._id} value={t._id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Stat tiles */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="flex items-center gap-3 p-5">
                <ClipboardCheck className="h-8 w-8 text-emerald-600" />
                <div>
                  <p className="text-2xl font-bold">{totals.registered}</p>
                  <p className="text-xs text-muted-foreground">Registered</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-5">
                <Users className="h-8 w-8 text-amber-600" />
                <div>
                  <p className="text-2xl font-bold">{totals.pending}</p>
                  <p className="text-xs text-muted-foreground">
                    Pending{pendingTruncated ? ' (truncated list)' : ''}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-5">
                <BookOpenCheck className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{totals.schemes}</p>
                  <p className="text-xs text-muted-foreground">Published curricula</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="fill">
            <TabsList>
              <TabsTrigger value="fill">Elective fill</TabsTrigger>
              <TabsTrigger value="registered">Registered ({totals.registered})</TabsTrigger>
              <TabsTrigger value="pending">Pending ({totals.pending})</TabsTrigger>
            </TabsList>

            {/* ─── Elective fill ─────────────────────────────────────────── */}
            <TabsContent value="fill" className="space-y-4">
              {loadingTerm ? (
                <Skeleton className="h-64" />
              ) : filteredOverview.length === 0 ? (
                <EmptyState
                  icon={BookOpenCheck}
                  title="No curriculum published"
                  description="Publish a semester's curriculum so students can register."
                  action={{ label: 'Go to Curriculum', onClick: onGoToCurriculum }}
                />
              ) : (
                filteredOverview.map((scheme) => (
                  <Card key={scheme.schemeId}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                      <CardTitle className="text-base">
                        {scheme.departmentName} · Semester {scheme.semesterNumber}
                      </CardTitle>
                      <Badge variant="outline">{scheme.registeredCount} registered</Badge>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {scheme.baskets.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No elective baskets — all courses are core.
                        </p>
                      ) : (
                        scheme.baskets.map((basket) => (
                          <div key={basket.slotId}>
                            <p className="mb-2 text-sm font-medium">{basket.label}</p>
                            <div className="space-y-2">
                              {basket.options.map((option) => {
                                const pct =
                                  option.seatCap && option.seatCap > 0
                                    ? Math.min(
                                        100,
                                        Math.round((option.seatsTaken / option.seatCap) * 100)
                                      )
                                    : null;
                                return (
                                  <div key={option.subjectId} className="flex items-center gap-3">
                                    <span className="w-56 truncate text-sm">
                                      {option.subjectName ?? option.subjectId}
                                    </span>
                                    {pct !== null ? (
                                      <>
                                        <Progress value={pct} className="h-2 flex-1" />
                                        <span className="w-24 text-right text-xs text-muted-foreground">
                                          {option.seatsTaken}/{option.seatCap}
                                          {pct >= 100 && (
                                            <Badge className="ml-1.5" variant="destructive">
                                              Full
                                            </Badge>
                                          )}
                                        </span>
                                      </>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">
                                        {option.seatsTaken} taken · unlimited
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            {/* ─── Registered ────────────────────────────────────────────── */}
            <TabsContent value="registered">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base">Registered students</CardTitle>
                  <Button size="sm" variant="outline" onClick={exportRegistered}>
                    <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
                  </Button>
                </CardHeader>
                <CardContent>
                  {loadingTerm ? (
                    <Skeleton className="h-48" />
                  ) : filteredRegistrations.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      No registrations yet for this term.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                            <th className="p-2">Student</th>
                            <th className="p-2">Dept</th>
                            <th className="p-2">Sem</th>
                            <th className="p-2">Courses</th>
                            <th className="p-2 text-right">Credits</th>
                            <th className="p-2">Submitted</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRegistrations.map((r) => (
                            <tr key={r._id} className="border-b last:border-0">
                              <td className="p-2">
                                <p className="font-medium">{r.student?.displayName ?? '—'}</p>
                                <p className="text-xs text-muted-foreground">
                                  {r.student?.admissionNumber ?? r.student?.rollNumber ?? ''}
                                </p>
                              </td>
                              <td className="p-2">{r.departmentCode}</td>
                              <td className="p-2">{r.semesterNumber}</td>
                              <td className="max-w-64 p-2">
                                <span className="font-mono text-xs text-muted-foreground">
                                  {r.entries
                                    .map((e) => e.subject?.code)
                                    .filter(Boolean)
                                    .join(' · ')}
                                </span>
                              </td>
                              <td className="p-2 text-right font-medium">{r.totalCredits}</td>
                              <td className="p-2 text-xs text-muted-foreground">
                                {new Date(r.submittedAt).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ─── Pending ───────────────────────────────────────────────── */}
            <TabsContent value="pending">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base">Yet to register</CardTitle>
                  <Button size="sm" variant="outline" onClick={exportPending}>
                    <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
                  </Button>
                </CardHeader>
                <CardContent>
                  {loadingTerm ? (
                    <Skeleton className="h-48" />
                  ) : filteredPending.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Everyone with a published scheme has registered. 🎉
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                            <th className="p-2">Student</th>
                            <th className="p-2">Class</th>
                            <th className="p-2">Dept</th>
                            <th className="p-2">Sem</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredPending.map((p) => (
                            <tr key={p._id} className="border-b last:border-0">
                              <td className="p-2">
                                <p className="font-medium">{p.displayName}</p>
                                <p className="text-xs text-muted-foreground">
                                  {p.admissionNumber ?? p.rollNumber ?? ''}
                                </p>
                              </td>
                              <td className="p-2">{p.className}</td>
                              <td className="p-2">{p.departmentCode}</td>
                              <td className="p-2">{p.semesterNumber}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

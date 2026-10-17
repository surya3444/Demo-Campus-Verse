'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { organizationApi } from '@/lib/api';

type LoginState = 'no_account' | 'disabled' | 'expired' | 'first_login' | 'active';
interface Login {
  state: LoginState;
  lastLogin: string | null;
}
interface People {
  department: { name: string; code: string; type: string; headOfDepartment: string | null };
  academicYear: string | null;
  programs: Array<{
    _id: string;
    name: string;
    code: string;
    durationYears: number;
    totalSemesters?: number;
  }>;
  staff: Array<{
    _id: string;
    name: string;
    employeeId?: string;
    designation: string | null;
    email: string | null;
    phone: string | null;
    subjectsTaught: number;
    login: Login;
  }>;
  students: Array<{
    _id: string;
    name: string;
    admissionNumber?: string;
    className: string | null;
    sectionName: string | null;
    email: string | null;
    login: Login;
  }>;
}

const LOGIN: Record<LoginState, { label: string; className: string; hint: string }> = {
  active: {
    label: 'Can log in',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    hint: 'Has their own password',
  },
  first_login: {
    label: 'First login pending',
    className: 'border-sky-200 bg-sky-50 text-sky-700',
    hint: 'Can log in with the temporary password, then sets their own',
  },
  no_account: {
    label: 'No login',
    className: 'border-slate-200 bg-slate-50 text-slate-600',
    hint: 'No account created for this person',
  },
  disabled: {
    label: 'Disabled',
    className: 'border-rose-200 bg-rose-50 text-rose-700',
    hint: 'Account switched off — cannot log in',
  },
  expired: {
    label: 'Expired',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
    hint: 'Temporary account past its end date',
  },
};

function LoginBadge({ login }: { login: Login }) {
  const l = LOGIN[login.state];
  return (
    <div className="flex flex-col items-start gap-0.5">
      <Badge variant="outline" className={l.className} title={l.hint}>
        {l.label}
      </Badge>
      <span className="text-[11px] text-muted-foreground">
        {login.lastLogin
          ? `Last in ${new Date(login.lastLogin).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
          : login.state === 'no_account'
            ? ''
            : 'Never logged in'}
      </span>
    </div>
  );
}

const tally = (rows: Array<{ login: Login }>) =>
  rows.reduce<Partial<Record<LoginState, number>>>(
    (m, r) => ({ ...m, [r.login.state]: (m[r.login.state] ?? 0) + 1 }),
    {}
  );

function LoginSummary({ rows }: { rows: Array<{ login: Login }> }) {
  const t = tally(rows);
  return (
    <div className="flex flex-wrap gap-1.5">
      {(Object.keys(LOGIN) as LoginState[])
        .filter((k) => t[k])
        .map((k) => (
          <Badge key={k} variant="outline" className={LOGIN[k].className}>
            {t[k]} {LOGIN[k].label.toLowerCase()}
          </Badge>
        ))}
    </div>
  );
}

/** Side panel for one department: its programs, staff and students, and who can sign in. */
export function DepartmentDetail({
  departmentId,
  institutionName,
  onClose,
}: {
  departmentId: string | null;
  institutionName?: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<People | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!departmentId) return;
    setData(null);
    setError(null);
    setQuery('');
    organizationApi
      .getDepartmentPeople(departmentId)
      .then((r) => setData(r.data as People))
      .catch((err) =>
        setError(err?.response?.data?.error?.message ?? 'Could not load this department')
      );
  }, [departmentId]);

  const q = query.trim().toLowerCase();
  const staff = useMemo(
    () =>
      (data?.staff ?? []).filter((s) =>
        `${s.name} ${s.email ?? ''} ${s.employeeId ?? ''}`.toLowerCase().includes(q)
      ),
    [data, q]
  );
  const students = useMemo(
    () =>
      (data?.students ?? []).filter((s) =>
        `${s.name} ${s.email ?? ''} ${s.admissionNumber ?? ''} ${s.className ?? ''}`
          .toLowerCase()
          .includes(q)
      ),
    [data, q]
  );

  return (
    <Sheet open={!!departmentId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>
            {data ? `${data.department.name} (${data.department.code})` : 'Department'}
          </SheetTitle>
          <SheetDescription>
            {[institutionName, data?.academicYear && `Students in ${data.academicYear}`]
              .filter(Boolean)
              .join(' · ')}
          </SheetDescription>
        </SheetHeader>

        {error ? (
          <p className="mt-6 text-sm text-destructive">{error}</p>
        ) : !data ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="overview" className="mt-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="staff">Staff ({data.staff.length})</TabsTrigger>
              <TabsTrigger value="students">Students ({data.students.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 pt-2">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border p-3">
                  <dt className="text-xs text-muted-foreground">Head of department</dt>
                  <dd className="font-medium">
                    {data.department.headOfDepartment ?? 'Not assigned'}
                  </dd>
                </div>
                <div className="rounded-lg border p-3">
                  <dt className="text-xs text-muted-foreground">Kind</dt>
                  <dd className="font-medium capitalize">{data.department.type}</dd>
                </div>
                <div className="rounded-lg border p-3">
                  <dt className="text-xs text-muted-foreground">Staff</dt>
                  <dd className="font-medium">{data.staff.length}</dd>
                  <LoginSummary rows={data.staff} />
                </div>
                <div className="rounded-lg border p-3">
                  <dt className="text-xs text-muted-foreground">Students</dt>
                  <dd className="font-medium">{data.students.length}</dd>
                  <LoginSummary rows={data.students} />
                </div>
              </dl>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Programs
                </p>
                {data.programs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No programs in this department.</p>
                ) : (
                  <div className="divide-y rounded-lg border">
                    {data.programs.map((p) => (
                      <div key={p._id} className="flex justify-between px-3 py-2 text-sm">
                        <span>
                          {p.name}{' '}
                          <span className="font-mono text-xs text-muted-foreground">{p.code}</span>
                        </span>
                        <span className="text-muted-foreground">
                          {p.durationYears} yrs · {p.totalSemesters ?? '?'} semesters
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Subjects and teachers: see{' '}
                <Link href="/organization/subjects" className="text-primary hover:underline">
                  Subjects
                </Link>
                . Curriculum and sections: open this department in{' '}
                <Link href="/organization/explorer" className="text-primary hover:underline">
                  Explorer
                </Link>
                .
              </p>
            </TabsContent>

            {(['staff', 'students'] as const).map((tab) => (
              <TabsContent key={tab} value={tab} className="space-y-3 pt-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    placeholder={`Search ${tab} by name, email${tab === 'students' ? ', admission no. or year' : ' or employee id'}`}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">{tab === 'staff' ? 'Role' : 'Year · Section'}</th>
                        <th className="px-3 py-2">Email</th>
                        <th className="px-3 py-2">Login</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(tab === 'staff' ? staff : students).length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                            No one matches.
                          </td>
                        </tr>
                      )}
                      {tab === 'staff'
                        ? staff.map((s) => (
                            <tr key={s._id}>
                              <td className="px-3 py-2">
                                <Link
                                  href={`/hr/staff/${s._id}`}
                                  className="font-medium hover:underline"
                                >
                                  {s.name}
                                </Link>
                                <p className="font-mono text-xs text-muted-foreground">
                                  {s.employeeId}
                                </p>
                              </td>
                              <td className="px-3 py-2">
                                {s.designation ?? '—'}
                                <p className="text-xs text-muted-foreground">
                                  {s.subjectsTaught} subject-section
                                  {s.subjectsTaught === 1 ? '' : 's'}
                                </p>
                              </td>
                              <td className="px-3 py-2 text-xs">{s.email ?? '—'}</td>
                              <td className="px-3 py-2">
                                <LoginBadge login={s.login} />
                              </td>
                            </tr>
                          ))
                        : students.map((s) => (
                            <tr key={s._id}>
                              <td className="px-3 py-2">
                                <Link
                                  href={`/students/${s._id}`}
                                  className="font-medium hover:underline"
                                >
                                  {s.name}
                                </Link>
                                <p className="font-mono text-xs text-muted-foreground">
                                  {s.admissionNumber}
                                </p>
                              </td>
                              <td className="px-3 py-2">
                                {(s.className ?? '').split(' · ').slice(-2).join(' · ')}
                                {s.sectionName ? ` · ${s.sectionName}` : ''}
                              </td>
                              <td className="px-3 py-2 text-xs">{s.email ?? '—'}</td>
                              <td className="px-3 py-2">
                                <LoginBadge login={s.login} />
                              </td>
                            </tr>
                          ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}

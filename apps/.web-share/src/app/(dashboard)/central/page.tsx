'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Layers,
  Building2,
  Users,
  Wallet,
  GraduationCap,
  Briefcase,
  Target,
  ArrowRight,
} from 'lucide-react';
import { formatCompactNumber, formatCurrency } from '@campus-verse/shared/utils';
import { centralApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useBranchStore } from '@/store/branchStore';
import { PageHero } from '@/components/ui/page-hero';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * University console — the "All institutions" mode.
 *
 * Central administration (admissions oversight, fee collection, HR, payroll)
 * runs university-wide while academics stay with each constituent institution.
 * Everything here is a read-only rollup grouped by institution; operating on
 * a number means switching into that institution, which every row links to.
 */

interface InstitutionRef {
  _id: string;
  name: string;
  code: string;
}

interface OverviewRow {
  institution: InstitutionRef;
  branchCount: number;
  students: number;
  staff: number;
  teachingStaff: number;
  billed: number;
  collected: number;
  outstanding: number;
  openLeads: number;
  applications: number;
  enrolled: number;
}

interface FinanceRow {
  institution: InstitutionRef;
  billed: number;
  collected: number;
  sponsored: number;
  outstanding: number;
  fines: number;
  collectionRate: number;
  scholarships: { sanctioned: number; received: number; pending: number; count: number };
  admissionCategories: Record<string, number>;
}

interface AdmissionsRow {
  institution: InstitutionRef;
  leadStages: Record<string, number>;
  applicationStatuses: Record<string, number>;
  totalLeads: number;
  totalApplications: number;
  enrolled: number;
  conversionRate: number;
}

interface HrRow {
  institution: InstitutionRef;
  headcount: number;
  teachingStaff: number;
  nonTeachingStaff: number;
  byDesignation: Record<string, number>;
  promotions: Record<string, number>;
  monthlyPayroll: number;
  salaryAssignments: number;
}

interface AcademicsRow {
  institution: InstitutionRef;
  programs: number;
  obePrograms: number;
  offerings: number;
  finalizedOfferings: number;
  courseRegistrations: number;
  meanPoAttainment: number | null;
}

const TABS = [
  { key: 'overview', label: 'Overview', icon: Layers },
  { key: 'finance', label: 'Finance', icon: Wallet },
  { key: 'admissions', label: 'Admissions', icon: GraduationCap },
  { key: 'hr', label: 'HR & payroll', icon: Briefcase },
  { key: 'academics', label: 'Academics', icon: Target },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const CATEGORY_LABELS: Record<string, string> = {
  management: 'Management',
  convener: 'Convener / government',
  spot: 'Spot',
  nri: 'NRI',
  lateral_entry: 'Lateral entry',
  unspecified: 'Unspecified',
};

function titleCase(value: string): string {
  return value.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function CentralConsolePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setSelectedBranchId = useBranchStore((s) => s.setSelectedBranchId);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabKey>('overview');

  const { data: scopeData, isLoading: scopeLoading } = useQuery({
    queryKey: ['central-scope'],
    queryFn: () => centralApi.getScope(),
  });

  const available = scopeData?.data?.available === true;

  const overview = useQuery({
    queryKey: ['central-overview'],
    queryFn: () => centralApi.getOverview(),
    enabled: available && tab === 'overview',
  });
  const finance = useQuery({
    queryKey: ['central-finance'],
    queryFn: () => centralApi.getFinance(),
    enabled: available && tab === 'finance',
  });
  const admissions = useQuery({
    queryKey: ['central-admissions'],
    queryFn: () => centralApi.getAdmissions(),
    enabled: available && tab === 'admissions',
  });
  const hr = useQuery({
    queryKey: ['central-hr'],
    queryFn: () => centralApi.getHr(),
    enabled: available && tab === 'hr',
  });
  const academics = useQuery({
    queryKey: ['central-academics'],
    queryFn: () => centralApi.getAcademics(),
    enabled: available && tab === 'academics',
  });

  const accessibleBranchIds = useMemo(
    () => new Set((user?.branches ?? []).map((b) => b._id)),
    [user?.branches]
  );

  /** Drill-down. Rollup rows are keyed by campus, so the id IS the branch id. */
  const enterInstitution = (branchId: string, href: string) => {
    if (accessibleBranchIds.has(branchId)) {
      setSelectedBranchId(branchId);
      // Same contract as the TopBar switcher: branch-scoped queries must
      // refetch under the new X-Branch-Id before the target page renders.
      queryClient.invalidateQueries();
    }
    router.push(href);
  };

  if (scopeLoading) {
    return (
      <div className="space-y-6 pb-12">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!available) {
    return (
      <div className="space-y-6 pb-12">
        <PageHero
          icon={Layers}
          eyebrow="University"
          title="All institutions"
          description="Cross-institution rollups for central administration."
        />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Building2 className="mb-4 h-12 w-12 text-muted-foreground opacity-40" />
            <p className="text-lg font-medium">Nothing to roll up yet</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              This view compares constituent institutions — an engineering college, an MBA school, a
              school of design — under one university. Create them in Organization → Institutions
              and assign each campus to one.
            </p>
            <Button className="mt-5" onClick={() => router.push('/organization/institutions')}>
              Manage institutions
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totals = overview.data?.data?.totals;

  return (
    <div className="space-y-6 pb-12">
      <PageHero
        icon={Layers}
        eyebrow="University · All institutions"
        title="Central console"
        description="Admissions, fee collection, HR and payroll roll up across every constituent institution. Academics stay with each institution — the numbers below link straight into them."
      />

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 rounded-xl border bg-card p-1.5">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors',
              tab === key ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          {totals && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile
                label="Students"
                value={formatCompactNumber(totals.students)}
                hint={`${formatCompactNumber(totals.staff)} staff · ${formatCompactNumber(totals.teachingStaff)} teaching`}
                icon={Users}
              />
              <StatTile
                label="Billed"
                value={formatCurrency(totals.billed)}
                hint={`${formatCurrency(totals.collected)} collected`}
                icon={Wallet}
              />
              <StatTile
                label="Outstanding"
                value={formatCurrency(totals.outstanding)}
                hint="Across all institutions"
                icon={Wallet}
              />
              <StatTile
                label="Admissions"
                value={formatCompactNumber(totals.applications)}
                hint={`${formatCompactNumber(totals.openLeads)} open enquiries · ${formatCompactNumber(totals.enrolled)} enrolled`}
                icon={GraduationCap}
              />
            </div>
          )}

          <RollupTable
            loading={overview.isLoading}
            rows={(overview.data?.data?.institutions ?? []) as OverviewRow[]}
            columns={[
              {
                key: 'students',
                label: 'Students',
                render: (r) => formatCompactNumber(r.students),
              },
              { key: 'staff', label: 'Staff', render: (r) => formatCompactNumber(r.staff) },
              { key: 'billed', label: 'Billed', render: (r) => formatCurrency(r.billed) },
              {
                key: 'outstanding',
                label: 'Outstanding',
                render: (r) => formatCurrency(r.outstanding),
              },
              {
                key: 'pipeline',
                label: 'Pipeline',
                render: (r) => `${r.openLeads} enquiries · ${r.applications} applications`,
              },
            ]}
            onEnter={(row) => enterInstitution(row.institution._id, '/dashboard')}
          />
        </>
      )}

      {tab === 'finance' && (
        <RollupTable
          loading={finance.isLoading}
          rows={(finance.data?.data?.institutions ?? []) as FinanceRow[]}
          columns={[
            { key: 'billed', label: 'Billed', render: (r) => formatCurrency(r.billed) },
            {
              key: 'collected',
              label: 'Collected',
              render: (r) => `${formatCurrency(r.collected)} (${r.collectionRate}%)`,
            },
            {
              key: 'outstanding',
              label: 'Outstanding',
              render: (r) => formatCurrency(r.outstanding),
            },
            {
              key: 'scholarships',
              label: 'Sponsor receivable',
              render: (r) =>
                r.scholarships.count === 0
                  ? '—'
                  : `${formatCurrency(r.scholarships.pending)} of ${formatCurrency(r.scholarships.sanctioned)}`,
            },
            {
              key: 'categories',
              label: 'Admission routes',
              render: (r) => {
                const entries = Object.entries(r.admissionCategories).filter(([, n]) => n > 0);
                if (entries.length === 0) return '—';
                return entries
                  .map(([key, n]) => `${CATEGORY_LABELS[key] ?? titleCase(key)} ${n}`)
                  .join(' · ');
              },
            },
          ]}
          onEnter={(row) => enterInstitution(row.institution._id, '/finance/dues')}
        />
      )}

      {tab === 'admissions' && (
        <RollupTable
          loading={admissions.isLoading}
          rows={(admissions.data?.data?.institutions ?? []) as AdmissionsRow[]}
          columns={[
            { key: 'leads', label: 'Enquiries', render: (r) => formatCompactNumber(r.totalLeads) },
            {
              key: 'applications',
              label: 'Applications',
              render: (r) => formatCompactNumber(r.totalApplications),
            },
            { key: 'enrolled', label: 'Enrolled', render: (r) => formatCompactNumber(r.enrolled) },
            {
              key: 'conversion',
              label: 'Enquiry → enrolment',
              render: (r) => `${r.conversionRate}%`,
            },
            {
              key: 'stages',
              label: 'Open stages',
              render: (r) => {
                const open = Object.entries(r.leadStages)
                  .filter(([stage, n]) => n > 0 && stage !== 'converted' && stage !== 'lost')
                  .map(([stage, n]) => `${titleCase(stage)} ${n}`);
                return open.length ? open.join(' · ') : '—';
              },
            },
          ]}
          onEnter={(row) => enterInstitution(row.institution._id, '/admissions')}
        />
      )}

      {tab === 'hr' && (
        <RollupTable
          loading={hr.isLoading}
          rows={(hr.data?.data?.institutions ?? []) as HrRow[]}
          columns={[
            {
              key: 'headcount',
              label: 'Headcount',
              render: (r) => formatCompactNumber(r.headcount),
            },
            {
              key: 'split',
              label: 'Teaching / non-teaching',
              render: (r) => `${r.teachingStaff} / ${r.nonTeachingStaff}`,
            },
            {
              key: 'payroll',
              label: 'Monthly payroll',
              render: (r) => (r.salaryAssignments === 0 ? '—' : formatCurrency(r.monthlyPayroll)),
            },
            {
              key: 'promotions',
              label: 'Promotions',
              render: (r) => {
                const pending = r.promotions.pending ?? 0;
                const applied = r.promotions.applied ?? r.promotions.approved ?? 0;
                if (!pending && !applied) return '—';
                return `${pending} pending · ${applied} applied`;
              },
            },
            {
              key: 'designations',
              label: 'Top designations',
              render: (r) => {
                const top = Object.entries(r.byDesignation)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 3)
                  .map(([name, n]) => `${name} ${n}`);
                return top.length ? top.join(' · ') : '—';
              },
            },
          ]}
          onEnter={(row) => enterInstitution(row.institution._id, '/hr/staff')}
        />
      )}

      {tab === 'academics' && (
        <RollupTable
          loading={academics.isLoading}
          rows={(academics.data?.data?.institutions ?? []) as AcademicsRow[]}
          columns={[
            { key: 'programs', label: 'Programs', render: (r) => String(r.programs) },
            {
              key: 'offerings',
              label: 'Course offerings',
              render: (r) => `${r.offerings} (${r.finalizedOfferings} finalized)`,
            },
            {
              key: 'registrations',
              label: 'Registrations',
              render: (r) => formatCompactNumber(r.courseRegistrations),
            },
            {
              key: 'attainment',
              label: 'Mean PO attainment',
              render: (r) =>
                r.meanPoAttainment === null ? 'Not computed' : r.meanPoAttainment.toFixed(2),
            },
            { key: 'obe', label: 'OBE programs', render: (r) => String(r.obePrograms) },
          ]}
          onEnter={(row) => enterInstitution(row.institution._id, '/obe')}
        />
      )}
    </div>
  );
}

function StatTile({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof Users;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {label}
          </p>
          <p className="font-display text-2xl font-bold leading-tight tabular-nums">{value}</p>
          {hint && <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

interface RollupRow {
  institution: InstitutionRef;
  /** The campus's default institution: records not attributable to a department. */
  isCampusLevel?: boolean;
}

function RollupTable<T extends RollupRow>({
  rows,
  columns,
  loading,
  onEnter,
}: {
  rows: T[];
  columns: Array<{ key: string; label: string; render: (row: T) => string }>;
  loading: boolean;
  onEnter: (row: T) => void;
}) {
  if (loading) {
    return <Skeleton className="h-64 rounded-2xl" />;
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No data for these institutions yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Institution</th>
              {columns.map((c) => (
                <th key={c.key} className="px-4 py-3 text-left font-medium text-muted-foreground">
                  {c.label}
                </th>
              ))}
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.institution._id} className="border-b last:border-0 hover:bg-muted/20">
                <td className="px-4 py-3">
                  <p className="font-medium">{row.institution.name}</p>
                  <Badge variant="outline" className="mt-1 font-mono text-[10px]">
                    {row.institution.code}
                  </Badge>
                  {row.isCampusLevel && (
                    <Badge variant="secondary" className="ml-1 mt-1 text-[10px]">
                      Campus-level
                    </Badge>
                  )}
                </td>
                {columns.map((c) => (
                  <td key={c.key} className="px-4 py-3 tabular-nums">
                    {c.render(row)}
                  </td>
                ))}
                <td className="px-4 py-3 text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1"
                    onClick={() => onEnter(row)}
                    aria-label={`Open ${row.institution.name}`}
                  >
                    Open
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

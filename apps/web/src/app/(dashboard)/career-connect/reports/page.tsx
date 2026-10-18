'use client';

import { usePermissions } from '@/hooks/usePermissions';
import { PageTitle } from '@/components/connect/kit';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, Building2, GraduationCap, IndianRupee, TrendingUp, Heart, ClipboardList, Users, Handshake, ArrowRight } from 'lucide-react';
import Link from 'next/link';

const placementReports = [
  {
    title: 'Placement Summary',
    description: 'Overall placement statistics including drives, offers, and CTC analysis',
    href: '/career-connect/reports/placement-summary',
    icon: BarChart3,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  {
    title: 'Company-wise report',
    description: 'Breakdown of offers, acceptance rates, and CTC by company',
    href: '/career-connect/reports/company-wise',
    icon: Building2,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
  },
  {
    title: 'Department-wise report',
    description: 'Placement rates and average CTC across departments',
    href: '/career-connect/reports/department-wise',
    icon: GraduationCap,
    color: 'text-violet-600',
    bgColor: 'bg-violet-50',
  },
  {
    title: 'Salary Analysis',
    description: 'CTC distribution, percentiles, and year-over-year comparison',
    href: '/career-connect/reports/salary-analysis',
    icon: IndianRupee,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
  },
  {
    title: 'Placement Trends',
    description: 'Monthly placement activity and CTC trends over the last 12 months',
    href: '/career-connect/reports/placement-trends',
    icon: TrendingUp,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
  },
];

const counselingReports = [
  {
    title: 'Counseling Summary',
    description: 'Session statistics by status, type, and monthly trends',
    href: '/career-connect/reports/counseling-summary',
    icon: Heart,
    color: 'text-rose-600',
    bgColor: 'bg-rose-50',
  },
  {
    title: 'Assessment Analytics',
    description: 'Assessment counts, score statistics, and recommended career paths',
    href: '/career-connect/reports/assessment-analytics',
    icon: ClipboardList,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
];

const alumniReports = [
  {
    title: 'Alumni Demographics',
    description: 'Alumni distribution by company, role, location, and graduation year',
    href: '/career-connect/reports/alumni-demographics',
    icon: Users,
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
  },
  {
    title: 'Mentorship Impact',
    description: 'Mentorship program statistics, session counts, and guidance areas',
    href: '/career-connect/reports/mentorship-impact',
    icon: Handshake,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
  },
];

function ReportCard({
  report,
}: {
  report: {
    title: string;
    description: string;
    href: string;
    icon: React.ElementType;
    color: string;
    bgColor: string;
  };
}) {
  return (
    <Link href={report.href}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`rounded-lg ${report.bgColor} p-2.5`}>
                <report.icon className={`h-5 w-5 ${report.color}`} />
              </div>
              <CardTitle className="text-base">{report.title}</CardTitle>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{report.description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function ReportsDashboardPage() {
  const { hasPermission } = usePermissions();
  const canView = hasPermission('careerConnect.reports', 'view');

  if (!canView) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">Access Denied</h3>
          <p className="text-muted-foreground">You do not have permission to view reports.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageTitle
        crumbs={[{ label: "Career Connect", href: "/career-connect" }, { label: "Reports &amp; analytics" }]}
        title="Reports &amp; analytics"
        description="Placement statistics, counseling insights, and alumni analytics"
      />

      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-3">Placement Reports</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Placement drive performance, company analytics, and salary trends
          </p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {placementReports.map((report) => (
              <ReportCard key={report.href} report={report} />
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3">Counseling Reports</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Counseling session analytics and assessment insights
          </p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {counselingReports.map((report) => (
              <ReportCard key={report.href} report={report} />
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3">Alumni Reports</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Alumni network demographics and mentorship program impact
          </p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {alumniReports.map((report) => (
              <ReportCard key={report.href} report={report} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

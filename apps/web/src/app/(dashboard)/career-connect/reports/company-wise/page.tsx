'use client';

import { useQuery } from '@tanstack/react-query';
import { PageTitle } from '@/components/connect/kit';
import { careerConnectApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Building2 } from 'lucide-react';

interface CompanyReport {
  companyId: string;
  companyName: string;
  totalOffers: number;
  accepted: number;
  declined: number;
  avgCTC: number;
  highestCTC: number;
  roles: string[];
}

export default function CompanyWiseReportPage() {
  const { hasPermission } = usePermissions();
  const canView = hasPermission('careerConnect.reports', 'view');

  const { data, isLoading } = useQuery({
    queryKey: ['career-connect-report', 'company-wise'],
    queryFn: () => careerConnectApi.getCompanyWiseReport(),
    enabled: canView,
  });

  const companies: CompanyReport[] = data?.data ?? [];

  if (!canView) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Building2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">Access Denied</h3>
          <p className="text-muted-foreground">You do not have permission to view this report.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageTitle
        crumbs={[{ label: "Reports", href: "/career-connect/reports" }, { label: "Company-wise report" }]}
        title="Company-wise report"
        description="Offers and CTC breakdown by company"
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Companies ({companies.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : companies.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No data available</h3>
              <p className="text-muted-foreground">
                Company-wise data will appear here once offers are created.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company Name</TableHead>
                  <TableHead className="text-right">Total Offers</TableHead>
                  <TableHead className="text-right">Accepted</TableHead>
                  <TableHead className="text-right">Declined</TableHead>
                  <TableHead className="text-right">Avg CTC</TableHead>
                  <TableHead className="text-right">Highest CTC</TableHead>
                  <TableHead>Roles</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company, idx) => (
                  <TableRow key={company.companyId || idx}>
                    <TableCell className="font-medium">{company.companyName}</TableCell>
                    <TableCell className="text-right">{company.totalOffers}</TableCell>
                    <TableCell className="text-right">
                      <span className="text-green-600 font-medium">{company.accepted}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-red-600 font-medium">{company.declined}</span>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(company.avgCTC)}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(company.highestCTC)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 flex-wrap">
                        {company.roles.slice(0, 3).map((role) => (
                          <Badge key={role} variant="secondary" className="text-xs">
                            {role}
                          </Badge>
                        ))}
                        {company.roles.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{company.roles.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { careerConnectApi } from '@/lib/api';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, FileText, Building2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

const statusColors: Record<string, string> = {
  applied: 'bg-blue-100 text-blue-800',
  shortlisted: 'bg-yellow-100 text-yellow-800',
  interview: 'bg-orange-100 text-orange-800',
  selected: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  withdrawn: 'bg-gray-100 text-gray-800',
};

interface MyApplication {
  _id: string;
  jobPostingId:
    | {
        _id: string;
        title: string;
        companyName?: string;
        companyId?: { name: string } | string;
        type: string;
      }
    | string;
  status: string;
  createdAt: string;
}

function getJobInfo(app: MyApplication): {
  id: string;
  title: string;
  company: string;
  type: string;
} {
  if (typeof app.jobPostingId === 'object') {
    const job = app.jobPostingId;
    let company = job.companyName || '';
    if (!company && job.companyId && typeof job.companyId === 'object' && 'name' in job.companyId) {
      company = job.companyId.name;
    }
    return { id: job._id, title: job.title, company: company || 'Unknown Company', type: job.type };
  }
  return { id: app.jobPostingId, title: 'Unknown Job', company: 'Unknown Company', type: 'job' };
}

export default function MyApplicationsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['my-applications', { page }],
    queryFn: () => careerConnectApi.getMyApplications({ page, limit: 20 }),
  });

  const applications: MyApplication[] = data?.data || [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Applications</h1>
          <p className="text-muted-foreground">Track your job and internship applications</p>
        </div>
      </div>

      <Card>
        <CardHeader />
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : applications.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No applications yet</h3>
              <p className="text-muted-foreground">
                Browse the job board and apply to opportunities
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => router.push('/career-connect/job-board')}
              >
                Browse Jobs
              </Button>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job Title</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Applied</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applications.map((app) => {
                    const info = getJobInfo(app);
                    return (
                      <TableRow
                        key={app._id}
                        className="cursor-pointer"
                        onClick={() => router.push(`/career-connect/job-board/${info.id}`)}
                      >
                        <TableCell className="font-medium hover:underline">{info.title}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Building2 className="h-3 w-3 text-muted-foreground" />
                            {info.company}
                          </div>
                        </TableCell>
                        <TableCell className="capitalize">{info.type}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={statusColors[app.status] || ''}>
                            {app.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(app.createdAt).toLocaleDateString()}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {meta && meta.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {(page - 1) * 20 + 1}-{Math.min(page * 20, meta.total)} of {meta.total}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage(page - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!meta.hasMore}
                      onClick={() => setPage(page + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

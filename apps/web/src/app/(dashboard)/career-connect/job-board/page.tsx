'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { careerConnectApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Briefcase,
  Plus,
  Search,
  MapPin,
  Building2,
  Calendar,
  Users,
  IndianRupee,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  active: 'bg-green-100 text-green-800',
  closed: 'bg-yellow-100 text-yellow-800',
  expired: 'bg-red-100 text-red-800',
};

const typeColors: Record<string, string> = {
  job: 'bg-blue-100 text-blue-800',
  internship: 'bg-purple-100 text-purple-800',
};

const workModeColors: Record<string, string> = {
  onsite: 'bg-orange-100 text-orange-800',
  remote: 'bg-teal-100 text-teal-800',
  hybrid: 'bg-indigo-100 text-indigo-800',
};

interface JobPosting {
  _id: string;
  title: string;
  companyName?: string;
  companyId?: { name: string } | string;
  type: string;
  status: string;
  workMode?: string;
  location?: string;
  salary?: { min?: number; max?: number };
  stipend?: { amount?: number; duration?: string };
  applicationDeadline: string;
  applicationCount?: number;
  createdAt: string;
}

function getCompanyName(job: JobPosting): string {
  if (job.companyName) return job.companyName;
  if (job.companyId && typeof job.companyId === 'object' && 'name' in job.companyId) {
    return job.companyId.name;
  }
  return 'Unknown Company';
}

function formatSalary(salary?: { min?: number; max?: number }): string | null {
  if (!salary) return null;
  const { min, max } = salary;
  if (min && max) return `${(min / 100000).toFixed(1)}L - ${(max / 100000).toFixed(1)}L`;
  if (min) return `${(min / 100000).toFixed(1)}L+`;
  if (max) return `Up to ${(max / 100000).toFixed(1)}L`;
  return null;
}

function formatStipend(stipend?: { amount?: number; duration?: string }): string | null {
  if (!stipend?.amount) return null;
  const amt =
    stipend.amount >= 1000 ? `${(stipend.amount / 1000).toFixed(0)}K` : `${stipend.amount}`;
  return stipend.duration ? `${amt}/mo (${stipend.duration})` : `${amt}/mo`;
}

function getDaysRemaining(deadline: string): string {
  const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return 'Expired';
  if (days === 0) return 'Due today';
  if (days === 1) return '1 day left';
  return `${days} days left`;
}

export default function JobBoardPage() {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [workModeFilter, setWorkModeFilter] = useState<string>('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: [
      'job-postings',
      { search, status: statusFilter, type: typeFilter, workMode: workModeFilter, page },
    ],
    queryFn: () =>
      careerConnectApi.getJobPostings({
        search: search || undefined,
        status: statusFilter || undefined,
        type: typeFilter || undefined,
        workMode: workModeFilter || undefined,
        page,
        limit: 12,
      }),
  });

  const jobs: JobPosting[] = data?.data || [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Job Board</h1>
          <p className="text-muted-foreground">Browse job and internship opportunities</p>
        </div>
        {hasPermission('careerConnect.jobBoard', 'create') && (
          <Button onClick={() => router.push('/career-connect/job-board/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Post Job
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search jobs..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(val) => {
                setStatusFilter(val === 'all' ? '' : val);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={typeFilter}
              onValueChange={(val) => {
                setTypeFilter(val === 'all' ? '' : val);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="job">Job</SelectItem>
                <SelectItem value="internship">Internship</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={workModeFilter}
              onValueChange={(val) => {
                setWorkModeFilter(val === 'all' ? '' : val);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Work Mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modes</SelectItem>
                <SelectItem value="onsite">Onsite</SelectItem>
                <SelectItem value="remote">Remote</SelectItem>
                <SelectItem value="hybrid">Hybrid</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-48 w-full" />
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-12">
              <Briefcase className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No job postings found</h3>
              <p className="text-muted-foreground">
                {search || statusFilter || typeFilter || workModeFilter
                  ? 'Try adjusting your filters'
                  : 'No opportunities posted yet'}
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {jobs.map((job) => {
                  const salaryText =
                    job.type === 'internship'
                      ? formatStipend(job.stipend)
                      : formatSalary(job.salary);
                  const daysLeft = getDaysRemaining(job.applicationDeadline);

                  return (
                    <Card
                      key={job._id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => router.push(`/career-connect/job-board/${job._id}`)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-base line-clamp-1">{job.title}</CardTitle>
                          <Badge variant="secondary" className={statusColors[job.status] || ''}>
                            {job.status}
                          </Badge>
                        </div>
                        <CardDescription className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {getCompanyName(job)}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pb-3 space-y-2">
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant="secondary" className={typeColors[job.type] || ''}>
                            {job.type}
                          </Badge>
                          {job.workMode && (
                            <Badge
                              variant="secondary"
                              className={workModeColors[job.workMode] || ''}
                            >
                              {job.workMode}
                            </Badge>
                          )}
                        </div>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          {job.location && (
                            <div className="flex items-center gap-1.5">
                              <MapPin className="h-3 w-3" />
                              <span className="line-clamp-1">{job.location}</span>
                            </div>
                          )}
                          {salaryText && (
                            <div className="flex items-center gap-1.5">
                              <IndianRupee className="h-3 w-3" />
                              <span>{salaryText}</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                      <CardFooter className="pt-0 text-xs text-muted-foreground flex justify-between">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span className={daysLeft === 'Expired' ? 'text-destructive' : ''}>
                            {daysLeft}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          <span>{job.applicationCount || 0} applied</span>
                        </div>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>

              {meta && meta.totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <p className="text-sm text-muted-foreground">
                    Showing {(page - 1) * 12 + 1}-{Math.min(page * 12, meta.total)} of {meta.total}
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

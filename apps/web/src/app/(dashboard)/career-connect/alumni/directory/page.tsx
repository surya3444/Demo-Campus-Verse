'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { careerConnectApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { GraduationCap, Search, MoreHorizontal, Eye, CheckCircle2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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
  mentorshipInfo?: {
    willingToMentor: boolean;
    areas?: string[];
    expertise?: string[];
    availability?: string;
  };
}

export default function AlumniDirectoryPage() {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const [search, setSearch] = useState('');
  const [graduationYearFilter, setGraduationYearFilter] = useState<string>('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [verifiedFilter, setVerifiedFilter] = useState<string>('');
  const [mentorFilter, setMentorFilter] = useState<string>('');
  const [page, setPage] = useState(1);

  const canVerify = hasPermission('careerConnect.alumni', 'verify');

  const { data, isLoading } = useQuery({
    queryKey: [
      'alumni-profiles',
      {
        search,
        graduationYear: graduationYearFilter,
        company: companyFilter,
        isVerified: verifiedFilter,
        willingToMentor: mentorFilter,
        page,
      },
    ],
    queryFn: () =>
      careerConnectApi.getAlumniProfiles({
        search: search || undefined,
        graduationYear: graduationYearFilter ? Number(graduationYearFilter) : undefined,
        company: companyFilter || undefined,
        isVerified: verifiedFilter || undefined,
        willingToMentor: mentorFilter || undefined,
        page,
        limit: 20,
      }),
  });

  const profiles: AlumniProfile[] = data?.data || [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/career-connect')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Alumni Directory</h1>
            <p className="text-muted-foreground">Browse and connect with alumni</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
            <Input
              placeholder="Graduation Year"
              type="number"
              value={graduationYearFilter}
              onChange={(e) => {
                setGraduationYearFilter(e.target.value);
                setPage(1);
              }}
              className="w-[150px]"
            />
            <Input
              placeholder="Filter by company..."
              value={companyFilter}
              onChange={(e) => {
                setCompanyFilter(e.target.value);
                setPage(1);
              }}
              className="w-[180px]"
            />
            <Select
              value={verifiedFilter}
              onValueChange={(val) => {
                setVerifiedFilter(val === 'all' ? '' : val);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Verified" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="true">Verified</SelectItem>
                <SelectItem value="false">Unverified</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={mentorFilter}
              onValueChange={(val) => {
                setMentorFilter(val === 'all' ? '' : val);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Mentor Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="true">Willing to Mentor</SelectItem>
                <SelectItem value="false">Not Mentoring</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : profiles.length === 0 ? (
            <div className="text-center py-12">
              <GraduationCap className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No alumni found</h3>
              <p className="text-muted-foreground">
                {search || graduationYearFilter || companyFilter || verifiedFilter || mentorFilter
                  ? 'Try adjusting your filters'
                  : 'No alumni profiles have been created yet'}
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Graduation Year</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Verified</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((profile) => (
                    <TableRow key={profile._id}>
                      <TableCell>
                        <Link
                          href={`/career-connect/alumni/directory/${profile._id}`}
                          className="font-medium hover:underline"
                        >
                          {profile.studentName || 'Unnamed'}
                        </Link>
                        {profile.mentorshipInfo?.willingToMentor && (
                          <Badge
                            variant="outline"
                            className="ml-2 text-xs bg-purple-50 text-purple-700"
                          >
                            Mentor
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{profile.graduationYear || '-'}</TableCell>
                      <TableCell>{profile.currentCompany || profile.company || '-'}</TableCell>
                      <TableCell>{profile.currentRole || profile.designation || '-'}</TableCell>
                      <TableCell>{profile.location || '-'}</TableCell>
                      <TableCell>
                        {profile.isVerified ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Verified
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                router.push(`/career-connect/alumni/directory/${profile._id}`)
                              }
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View Profile
                            </DropdownMenuItem>
                            {canVerify && !profile.isVerified && (
                              <DropdownMenuItem
                                onClick={() =>
                                  router.push(`/career-connect/alumni/directory/${profile._id}`)
                                }
                              >
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Verify
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
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

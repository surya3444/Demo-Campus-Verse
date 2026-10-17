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
import { Progress } from '@/components/ui/progress';
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
import { Users, Search, Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';

const placementStatusColors: Record<string, string> = {
  unplaced: 'bg-yellow-100 text-yellow-800',
  placed: 'bg-green-100 text-green-800',
  opted_out: 'bg-gray-100 text-gray-800',
  higher_studies: 'bg-blue-100 text-blue-800',
};

const placementStatusLabels: Record<string, string> = {
  unplaced: 'Unplaced',
  placed: 'Placed',
  opted_out: 'Opted Out',
  higher_studies: 'Higher Studies',
};

function getCompletenessColor(value: number): string {
  if (value < 40) return 'bg-red-500';
  if (value <= 70) return 'bg-yellow-500';
  return 'bg-green-500';
}

interface StudentProfile {
  _id: string;
  studentId: string;
  studentName: string;
  skills: { _id: string; name: string; category?: string; proficiency?: string }[];
  placementStatus: string;
  completeness: number;
}

export default function StudentProfilesPage() {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [skillsFilter, setSkillsFilter] = useState('');
  const [page, setPage] = useState(1);

  const canView = hasPermission('careerConnect.studentProfiles', 'view');

  const { data, isLoading } = useQuery({
    queryKey: [
      'student-profiles',
      { search, placementStatus: statusFilter, skills: skillsFilter, page },
    ],
    queryFn: () =>
      careerConnectApi.getStudentProfiles({
        search: search || undefined,
        placementStatus: statusFilter || undefined,
        skills: skillsFilter || undefined,
        page,
        limit: 20,
      }),
    enabled: canView,
  });

  const profiles: StudentProfile[] = data?.data || [];
  const meta = data?.meta;

  if (!canView) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">Access Denied</h3>
          <p className="text-muted-foreground">
            You do not have permission to view student profiles.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Student Profiles</h1>
          <p className="text-muted-foreground">View and manage student career profiles</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by student name..."
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
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="unplaced">Unplaced</SelectItem>
                <SelectItem value="placed">Placed</SelectItem>
                <SelectItem value="opted_out">Opted Out</SelectItem>
                <SelectItem value="higher_studies">Higher Studies</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Filter by skills..."
              value={skillsFilter}
              onChange={(e) => {
                setSkillsFilter(e.target.value);
                setPage(1);
              }}
              className="w-[200px]"
            />
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
              <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No profiles found</h3>
              <p className="text-muted-foreground">
                {search || statusFilter || skillsFilter
                  ? 'Try adjusting your filters'
                  : 'No student career profiles have been created yet'}
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student Name</TableHead>
                    <TableHead>Skills</TableHead>
                    <TableHead>Placement Status</TableHead>
                    <TableHead>Completeness</TableHead>
                    <TableHead className="w-[60px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((profile) => (
                    <TableRow
                      key={profile._id}
                      className="cursor-pointer"
                      onClick={() =>
                        router.push(`/career-connect/student-profile/${profile.studentId}`)
                      }
                    >
                      <TableCell className="font-medium">{profile.studentName}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 flex-wrap">
                          {profile.skills.slice(0, 3).map((skill) => (
                            <Badge key={skill._id} variant="secondary" className="text-xs">
                              {skill.name}
                            </Badge>
                          ))}
                          {profile.skills.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{profile.skills.length - 3}
                            </Badge>
                          )}
                          {profile.skills.length === 0 && (
                            <span className="text-sm text-muted-foreground">No skills</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={placementStatusColors[profile.placementStatus] || ''}
                        >
                          {placementStatusLabels[profile.placementStatus] ||
                            profile.placementStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <div className="flex-1 relative">
                            <Progress value={profile.completeness} className="h-2" />
                            <div
                              className={`absolute inset-0 h-2 rounded-full ${getCompletenessColor(profile.completeness)}`}
                              style={{ width: `${profile.completeness}%` }}
                            />
                          </div>
                          <span className="text-sm text-muted-foreground w-10 text-right">
                            {profile.completeness}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/career-connect/student-profile/${profile.studentId}`);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
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

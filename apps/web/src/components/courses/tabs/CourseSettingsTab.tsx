'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { coursesApi, organizationApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Save, Globe, Lock, Building2 } from 'lucide-react';

interface CourseSettingsTabProps {
  courseId: string;
  course: Record<string, any>;
}

export function CourseSettingsTab({ courseId, course }: CourseSettingsTabProps) {
  const queryClient = useQueryClient();
  const [visibility, setVisibility] = useState<string>(course.visibility || 'organization');
  const [selectedBranches, setSelectedBranches] = useState<string[]>(course.visibleBranchIds || []);

  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => organizationApi.getBranches(),
  });

  const branches = branchesData?.data || [];

  const visibilityMut = useMutation({
    mutationFn: () =>
      coursesApi.updateCourseVisibility(courseId, {
        visibility,
        visibleBranchIds: visibility === 'branches' ? selectedBranches : [],
      }),
    onSuccess: () => {
      toast.success('Visibility settings saved');
      queryClient.invalidateQueries({ queryKey: ['course', courseId] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || 'Failed to update');
    },
  });

  const toggleBranch = (branchId: string) => {
    setSelectedBranches((prev) =>
      prev.includes(branchId) ? prev.filter((id) => id !== branchId) : [...prev, branchId]
    );
  };

  return (
    <div className="max-w-3xl space-y-6">
      {/* Visibility */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Visibility</CardTitle>
          <CardDescription>Control who can see and enroll in this course</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div
              className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${
                visibility === 'organization' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
              }`}
              onClick={() => setVisibility('organization')}
            >
              <Globe className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Organization-wide</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  All branches in your organization can see this course
                </p>
              </div>
            </div>

            <div
              className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${
                visibility === 'branches' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
              }`}
              onClick={() => setVisibility('branches')}
            >
              <Building2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">Specific branches</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Only selected branches can see this course
                </p>
                {visibility === 'branches' && branches.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {branches.map((branch: any) => (
                      <div key={branch._id} className="flex items-center gap-2">
                        <Checkbox
                          id={`branch-${branch._id}`}
                          checked={selectedBranches.includes(branch._id)}
                          onCheckedChange={() => toggleBranch(branch._id)}
                        />
                        <Label htmlFor={`branch-${branch._id}`} className="text-sm cursor-pointer">
                          {branch.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div
              className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${
                visibility === 'private' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
              }`}
              onClick={() => setVisibility('private')}
            >
              <Lock className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Private</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Only accessible via direct enrollment
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              size="sm"
              className="gap-2"
              onClick={() => visibilityMut.mutate()}
              disabled={visibilityMut.isPending}
            >
              <Save className="h-3.5 w-3.5" />
              {visibilityMut.isPending ? 'Saving...' : 'Save Visibility'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Enrollment Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Enrollment</CardTitle>
          <CardDescription>Configure how students can join this course</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-lg border p-4 bg-muted/20">
              <div>
                <p className="text-sm font-medium">Self-enrollment</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Students can enroll themselves from the course catalog. Configure enrollment rules
                  from the Enrollments page.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { PageTitle } from '@/components/connect/kit';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { healthApi } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Calendar, Users } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

const CHECKUP_TYPES = [
  { value: 'routine', label: 'Routine Health Checkup' },
  { value: 'vision', label: 'Vision Screening' },
  { value: 'dental', label: 'Dental Checkup' },
  { value: 'hearing', label: 'Hearing Test' },
  { value: 'comprehensive', label: 'Comprehensive Physical' },
];

const TARGET_GROUPS = [
  { value: 'all_students', label: 'All Students' },
  { value: 'all_staff', label: 'All Staff' },
  { value: 'specific_classes', label: 'Specific Classes' },
  { value: 'specific_departments', label: 'Specific Departments' },
];

export default function NewCampaignPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    checkupType: '',
    targetGroup: '',
    startDate: '',
    endDate: '',
    targetClasses: [] as string[],
    targetDepartments: [] as string[],
    examinations: {
      includeVision: true,
      includeHearing: true,
      includeDental: true,
      includeGeneral: true,
    },
    notes: '',
  });

  // Get classes for selection
  const { data: _classesData } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      // This would be replaced with actual API call
      return { data: [] };
    },
    enabled: formData.targetGroup === 'specific_classes',
  });

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof healthApi.createCampaign>[0]) =>
      healthApi.createCampaign(data),
    onSuccess: () => {
      toast.success('Health checkup campaign created successfully');
      router.push('/health/checkups?tab=campaigns');
    },
    onError: (error: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create campaign');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name) {
      toast.error('Please enter a campaign name');
      return;
    }

    if (!formData.checkupType) {
      toast.error('Please select a checkup type');
      return;
    }

    if (!formData.startDate || !formData.endDate) {
      toast.error('Please select start and end dates');
      return;
    }

    createMutation.mutate({
      name: formData.name,
      description: formData.description || undefined,
      checkupType: formData.checkupType,
      targetGroup: formData.targetGroup || 'all_students',
      startDate: formData.startDate,
      endDate: formData.endDate,
      targetClasses: formData.targetClasses.length > 0 ? formData.targetClasses : undefined,
      targetDepartments:
        formData.targetDepartments.length > 0 ? formData.targetDepartments : undefined,
      examinations: formData.examinations,
      notes: formData.notes || undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageTitle
        crumbs={[{ label: "Checkups?tab=campaigns", href: "/health/checkups?tab=campaigns" }, { label: "New health checkup campaign" }]}
        title="New health checkup campaign"
        description="Organize a mass health screening"
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Campaign Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-500" />
              Campaign Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Campaign Name *</Label>
                <Input
                  placeholder="e.g., Annual Health Checkup 2024"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Checkup Type *</Label>
                <Select
                  value={formData.checkupType}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, checkupType: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {CHECKUP_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Describe the campaign objectives and scope..."
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Start Date *</Label>
                <DatePicker
                  value={formData.startDate}
                  onChange={(iso) => setFormData((prev) => ({ ...prev, startDate: iso }))}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date *</Label>
                <DatePicker
                  value={formData.endDate}
                  onChange={(iso) => setFormData((prev) => ({ ...prev, endDate: iso }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Target Group */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-green-500" />
              Target Group
            </CardTitle>
            <CardDescription>Select who should be included in this campaign</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Target Group</Label>
              <Select
                value={formData.targetGroup}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, targetGroup: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select target group" />
                </SelectTrigger>
                <SelectContent>
                  {TARGET_GROUPS.map((group) => (
                    <SelectItem key={group.value} value={group.value}>
                      {group.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.targetGroup === 'specific_classes' && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Class selection will be available after creating the campaign. You can add
                  specific classes from the campaign details page.
                </p>
              </div>
            )}

            {formData.targetGroup === 'specific_departments' && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Department selection will be available after creating the campaign. You can add
                  specific departments from the campaign details page.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Examinations to Include */}
        <Card>
          <CardHeader>
            <CardTitle>Examinations to Include</CardTitle>
            <CardDescription>
              Select which examinations will be part of this campaign
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="vision"
                  checked={formData.examinations.includeVision}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      examinations: { ...prev.examinations, includeVision: !!checked },
                    }))
                  }
                />
                <Label htmlFor="vision" className="cursor-pointer">
                  Vision Screening
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="hearing"
                  checked={formData.examinations.includeHearing}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      examinations: { ...prev.examinations, includeHearing: !!checked },
                    }))
                  }
                />
                <Label htmlFor="hearing" className="cursor-pointer">
                  Hearing Test
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="dental"
                  checked={formData.examinations.includeDental}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      examinations: { ...prev.examinations, includeDental: !!checked },
                    }))
                  }
                />
                <Label htmlFor="dental" className="cursor-pointer">
                  Dental Checkup
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="general"
                  checked={formData.examinations.includeGeneral}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      examinations: { ...prev.examinations, includeGeneral: !!checked },
                    }))
                  }
                />
                <Label htmlFor="general" className="cursor-pointer">
                  General Physical
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Additional Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Additional Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Any additional instructions or notes for the campaign..."
              value={formData.notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" asChild>
            <Link href="/health/checkups?tab=campaigns">Cancel</Link>
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Campaign
          </Button>
        </div>
      </form>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { PageTitle } from '@/components/connect/kit';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { careerConnectApi, academicApi } from '@/lib/api';
import { StudentPicker } from '@/components/common/StudentPicker';
import { StudentMultiPicker } from '@/components/common/StudentMultiPicker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

// Local form schema — plain object (no superRefine), lenient on textarea fields
const formSchema = z.object({
  sessionType: z.enum(['individual', 'group', 'workshop']),
  audienceType: z.enum(['individual', 'group', 'section', 'class', 'workshop']),
  scheduledDate: z.coerce.date(),
  endDate: z.coerce.date().optional().or(z.literal('')),
  studentId: z.string().optional(),
  studentIds: z.array(z.string()).optional(),
  classId: z.string().optional(),
  className: z.string().optional(),
  sectionId: z.string().optional(),
  sectionName: z.string().optional(),
  topic: z.string().min(1, 'Topic is required'),
  notes: z.string().optional(),
  actionItems: z.any().optional(),
  recommendations: z.any().optional(),
});

type FormData = z.infer<typeof formSchema>;

type AudienceType = 'individual' | 'group' | 'section' | 'class' | 'workshop';

const audienceTypeLabels: Record<AudienceType, string> = {
  individual: 'Individual',
  group: 'Group (Handpicked)',
  section: 'Entire Section',
  class: 'Entire Class',
  workshop: 'Workshop (Open)',
};

export default function NewCounselingSessionPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      sessionType: 'individual',
      audienceType: 'individual',
      topic: '',
      notes: '',
    },
  });

  const audienceType = watch('audienceType') as AudienceType;
  const [selectedClassId, setSelectedClassId] = useState<string>('');

  // Fetch classes for section/class audience types
  const { data: classesData } = useQuery({
    queryKey: ['classes-for-session'],
    queryFn: () => academicApi.getClasses({ status: 'active' }),
    enabled: audienceType === 'section' || audienceType === 'class' || audienceType === 'group',
  });

  // Fetch sections for selected class
  const { data: sectionsData } = useQuery({
    queryKey: ['sections-for-session', selectedClassId],
    queryFn: () => academicApi.getSectionsByClass(selectedClassId),
    enabled: audienceType === 'section' && !!selectedClassId,
  });

  const classes = classesData?.data || [];
  const sections = sectionsData?.data || [];

  const handleAudienceTypeChange = (val: AudienceType) => {
    setValue('audienceType', val);

    // Derive sessionType from audienceType
    if (val === 'section' || val === 'class' || val === 'group') {
      setValue('sessionType', 'group');
    } else if (val === 'workshop') {
      setValue('sessionType', 'workshop');
    } else {
      setValue('sessionType', 'individual');
    }

    // Clear targeting fields
    setValue('studentId', undefined);
    setValue('studentIds', undefined);
    setValue('classId', undefined);
    setValue('className', undefined);
    setValue('sectionId', undefined);
    setValue('sectionName', undefined);
    setSelectedClassId('');
  };

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => {
      return careerConnectApi.createCounselingSession(data);
    },
    onSuccess: () => {
      toast.success('Counseling session created successfully');
      queryClient.invalidateQueries({ queryKey: ['counseling-sessions'] });
      router.push('/career-connect/counseling/sessions');
    },
    onError: () => {
      toast.error('Failed to create counseling session');
    },
  });

  const onSubmit = (data: FormData) => {
    // Conditional audience validation
    if (data.audienceType === 'individual' && !data.studentId) {
      toast.error('Please select a student for individual sessions');
      return;
    }
    if (data.audienceType === 'group' && (!data.studentIds || data.studentIds.length === 0)) {
      toast.error('Please select at least one student for group sessions');
      return;
    }
    if (data.audienceType === 'section' && !data.sectionId) {
      toast.error('Please select a class and section');
      return;
    }
    if (data.audienceType === 'class' && !data.classId) {
      toast.error('Please select a class');
      return;
    }

    // Build clean payload
    const payload: Record<string, unknown> = {
      sessionType: data.sessionType,
      audienceType: data.audienceType,
      scheduledDate: data.scheduledDate,
      topic: data.topic,
    };

    if (data.endDate) payload.endDate = data.endDate;
    if (data.notes) payload.notes = data.notes;
    if (data.studentId) payload.studentId = data.studentId;
    if (data.studentIds?.length) payload.studentIds = data.studentIds;
    if (data.classId) payload.classId = data.classId;
    if (data.className) payload.className = data.className;
    if (data.sectionId) payload.sectionId = data.sectionId;
    if (data.sectionName) payload.sectionName = data.sectionName;

    // Convert textarea lines to arrays
    if (data.actionItems && typeof data.actionItems === 'string') {
      const items = (data.actionItems as string)
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      if (items.length > 0) payload.actionItems = items;
    }
    if (data.recommendations && typeof data.recommendations === 'string') {
      const recs = (data.recommendations as string)
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      if (recs.length > 0) payload.recommendations = recs;
    }

    createMutation.mutate(payload);
  };

  return (
    <div className="space-y-6">
      <PageTitle
        crumbs={[{ label: "Sessions", href: "/career-connect/counseling/sessions" }, { label: "New counseling session" }]}
        title="New counseling session"
        description="Schedule a new career counseling session"
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Session Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Audience Type *</Label>
                <Select
                  value={audienceType}
                  onValueChange={(val) => handleAudienceTypeChange(val as AudienceType)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select audience" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(audienceTypeLabels) as [AudienceType, string][]).map(
                      ([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="scheduledDate">Scheduled Date & Time *</Label>
                <Input id="scheduledDate" type="datetime-local" {...register('scheduledDate')} />
                {errors.scheduledDate && (
                  <p className="text-sm text-destructive">{errors.scheduledDate.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">End Date & Time</Label>
                <Input id="endDate" type="datetime-local" {...register('endDate')} />
              </div>
            </div>

            {/* Audience Targeting */}
            {audienceType === 'individual' && (
              <div className="space-y-2">
                <Label>Student *</Label>
                <StudentPicker
                  value={watch('studentId')}
                  onChange={(id) => setValue('studentId', id)}
                />
              </div>
            )}

            {audienceType === 'group' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Filter by Class (optional)</Label>
                  <Select
                    value={selectedClassId}
                    onValueChange={(val) => {
                      setSelectedClassId(val === '__all__' ? '' : val);
                      setValue('studentIds', []);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All classes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All classes</SelectItem>
                      {classes.map((cls: { _id: string; displayName: string }) => (
                        <SelectItem key={cls._id} value={cls._id}>
                          {cls.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Students *</Label>
                  <StudentMultiPicker
                    value={watch('studentIds') || []}
                    onChange={(ids) => setValue('studentIds', ids)}
                    classId={selectedClassId || undefined}
                  />
                </div>
              </div>
            )}

            {audienceType === 'section' && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Class *</Label>
                  <Select
                    value={selectedClassId}
                    onValueChange={(val) => {
                      setSelectedClassId(val);
                      const cls = classes.find(
                        (c: { _id: string; displayName: string }) => c._id === val
                      );
                      const name = cls?.displayName || '';
                      setValue('classId', val);
                      setValue('className', name);
                      setValue('sectionId', undefined);
                      setValue('sectionName', undefined);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((cls: { _id: string; displayName: string }) => (
                        <SelectItem key={cls._id} value={cls._id}>
                          {cls.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Section *</Label>
                  <Select
                    value={watch('sectionId') || ''}
                    onValueChange={(val) => {
                      const sec = sections.find(
                        (s: { _id: string; name: string }) => s._id === val
                      );
                      setValue('sectionId', val);
                      setValue('sectionName', sec?.name || '');
                    }}
                    disabled={!selectedClassId}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={selectedClassId ? 'Select section' : 'Select class first'}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {sections.map((sec: { _id: string; name: string }) => (
                        <SelectItem key={sec._id} value={sec._id}>
                          {sec.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {audienceType === 'class' && (
              <div className="space-y-2">
                <Label>Class *</Label>
                <Select
                  value={watch('classId') || ''}
                  onValueChange={(val) => {
                    const cls = classes.find(
                      (c: { _id: string; displayName: string }) => c._id === val
                    );
                    setValue('classId', val);
                    setValue('className', cls?.displayName || '');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((cls: { _id: string; displayName: string }) => (
                      <SelectItem key={cls._id} value={cls._id}>
                        {cls.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="topic">Topic *</Label>
              <Input
                id="topic"
                {...register('topic')}
                placeholder="e.g. Career path exploration for Science stream"
              />
              {errors.topic && <p className="text-sm text-destructive">{errors.topic.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                {...register('notes')}
                placeholder="Session notes and observations..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="actionItems">Action Items (one per line)</Label>
              <Textarea
                id="actionItems"
                {...register('actionItems')}
                placeholder="Research engineering colleges in the region&#10;Complete aptitude assessment&#10;Attend career fair on March 15"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="recommendations">Recommendations (one per line)</Label>
              <Textarea
                id="recommendations"
                {...register('recommendations')}
                placeholder="Consider pursuing STEM subjects&#10;Take entrance exam coaching&#10;Explore scholarship opportunities"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create Session'}
          </Button>
        </div>
      </form>
    </div>
  );
}

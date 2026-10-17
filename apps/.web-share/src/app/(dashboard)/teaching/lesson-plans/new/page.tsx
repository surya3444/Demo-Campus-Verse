'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { teachingApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Clock,
  GraduationCap,
  Loader2,
  Plus,
  Save,
  Trash2,
  Target,
  FileText,
  Package,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface Step {
  title: string;
  description: string;
  duration: string;
}

export default function NewLessonPlanPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Pre-fill from query params (coming from calendar day view)
  const prefillSectionId = searchParams.get('sectionId') || '';
  const prefillSubjectId = searchParams.get('subjectId') || '';
  const prefillSlotId = searchParams.get('slotId') || '';
  const prefillDate = searchParams.get('date') || '';
  const editId = searchParams.get('editId') || '';
  const isEditMode = !!editId;

  const [title, setTitle] = useState('');
  const [sectionId, setSectionId] = useState(prefillSectionId);
  const [subjectId, setSubjectId] = useState(prefillSubjectId);
  const [slotId, setSlotId] = useState(prefillSlotId);
  const [date, setDate] = useState(prefillDate);
  const [duration, setDuration] = useState('');
  const [status, setStatus] = useState('draft');
  const [description, setDescription] = useState('');
  const [resources, setResources] = useState('');
  const [steps, setSteps] = useState<Step[]>([{ title: '', description: '', duration: '' }]);
  const [loaded, setLoaded] = useState(false);

  // Fetch existing plan for edit mode
  const { data: existingPlan } = useQuery({
    queryKey: ['lesson-plan', editId],
    queryFn: () => teachingApi.getLessonPlan(editId),
    enabled: isEditMode,
  });

  // Pre-fill from existing plan when data arrives
  useEffect(() => {
    if (isEditMode && existingPlan?.data && !loaded) {
      const p = existingPlan.data;
      setTitle(p.title || '');
      setSectionId(p.sectionId || '');
      setSubjectId(p.subjectId || '');
      setSlotId(p.slotId || '');
      setDate(p.date ? p.date.split('T')[0] : '');
      setDuration(p.duration ? String(p.duration) : '');
      setStatus(p.status || 'draft');
      setDescription(p.description || '');
      setResources((p.resources || []).join('\n'));
      if (p.objectives && p.objectives.length > 0) {
        setSteps(
          p.objectives.map((obj: string) => {
            // Parse "Title — Description (X min)" format back into structured step
            const durationMatch = obj.match(/\((\d+)\s*min\)$/);
            const dur = durationMatch ? durationMatch[1] : '';
            const withoutDuration = durationMatch ? obj.replace(/\s*\(\d+\s*min\)$/, '') : obj;
            const parts = withoutDuration.split(' — ');
            return {
              title: parts[0] || obj,
              description: parts[1] || '',
              duration: dur,
            };
          })
        );
      }
      setLoaded(true);
    }
  }, [isEditMode, existingPlan, loaded]);

  // Fetch teacher's classes for section/subject dropdowns
  const { data: classesData } = useQuery({
    queryKey: ['my-classes'],
    queryFn: () => teachingApi.getMyClasses(),
  });

  // Fetch timetable for slot picker
  const { data: timetableData } = useQuery({
    queryKey: ['my-timetable'],
    queryFn: () => teachingApi.getMyTimetable(),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const classes: any[] = classesData?.data || [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const timetableEntries: any[] = timetableData?.data || [];

  // Derive subjects for selected section
  const getSubjects = () => {
    const cls = classes.find((c: { sectionId: string }) => c.sectionId === sectionId);
    if (!cls) return [];
    // API returns parallel arrays: subjectIds[] and subjectNames[]
    if (cls.subjectIds && cls.subjectNames) {
      return cls.subjectIds.map((id: string, i: number) => ({
        subjectId: id,
        subjectName: cls.subjectNames[i] || id,
      }));
    }
    return cls?.subjects || [];
  };

  // Derive slots from timetable
  const timetableSlots = (() => {
    const slotMap = new Map<
      string,
      { _id: string; name: string; startTime: string; endTime: string }
    >();
    for (const e of timetableEntries) {
      if (e.slotType === 'period' && !slotMap.has(e.slotId)) {
        slotMap.set(e.slotId, {
          _id: e.slotId,
          name: e.slotName || '',
          startTime: e.startTime || '',
          endTime: e.endTime || '',
        });
      }
    }
    return [...slotMap.values()];
  })();

  // Get display info for pre-filled values
  const selectedSection = classes.find((c: { sectionId: string }) => c.sectionId === sectionId);
  const selectedSubject = getSubjects().find(
    (s: { subjectId: string }) => s.subjectId === subjectId
  );
  const selectedSlot = timetableSlots.find((s) => s._id === slotId);

  // Auto-fill duration from slot if available
  useEffect(() => {
    if (selectedSlot && !duration) {
      const start = selectedSlot.startTime.split(':').map(Number);
      const end = selectedSlot.endTime.split(':').map(Number);
      const mins = end[0] * 60 + end[1] - (start[0] * 60 + start[1]);
      if (mins > 0) setDuration(String(mins));
    }
  }, [selectedSlot, duration]);

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => teachingApi.createLessonPlan(data),
    onSuccess: () => {
      toast.success('Lesson plan created');
      router.push('/teaching/lesson-plans');
    },
    onError: () => toast.error('Failed to create lesson plan'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => teachingApi.updateLessonPlan(editId, data),
    onSuccess: () => {
      toast.success('Lesson plan updated');
      router.push('/teaching/lesson-plans');
    },
    onError: () => toast.error('Failed to update lesson plan'),
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleAddStep = () => {
    setSteps((prev) => [...prev, { title: '', description: '', duration: '' }]);
  };

  const handleUpdateStep = (index: number, updates: Partial<Step>) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...updates } : s)));
  };

  const handleRemoveStep = (index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!title || !sectionId || !subjectId || !date) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Build objectives from steps (title + description combined)
    const objectives = steps
      .filter((s) => s.title.trim())
      .map((s) => {
        let line = s.title.trim();
        if (s.description.trim()) line += ` — ${s.description.trim()}`;
        if (s.duration.trim()) line += ` (${s.duration} min)`;
        return line;
      });

    const payload: Record<string, unknown> = {
      title,
      sectionId,
      subjectId,
      date,
      objectives,
      description,
      resources: resources.split('\n').filter((r) => r.trim()),
      status,
    };

    if (slotId) payload.slotId = slotId;
    if (duration) payload.duration = parseInt(duration);

    if (isEditMode) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/teaching/lesson-plans">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <p className="text-sm text-muted-foreground">
              Lesson Plans → {isEditMode ? 'Edit Lesson Plan' : 'New Lesson Plan'}
            </p>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Lesson Title..."
              className="text-2xl font-bold border-0 shadow-none px-0 h-auto focus-visible:ring-0 placeholder:text-muted-foreground/40"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save
          </Button>
        </div>
      </div>

      {/* Meta Badges */}
      <div className="flex flex-wrap gap-2">
        {date && (
          <Badge variant="outline" className="gap-1.5 py-1 px-3">
            <Calendar className="h-3.5 w-3.5" />
            {new Date(date).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </Badge>
        )}
        {duration && (
          <Badge variant="default" className="gap-1.5 py-1 px-3 bg-green-600">
            <Clock className="h-3.5 w-3.5" />
            {duration} Minutes
          </Badge>
        )}
        {selectedSection && (
          <Badge variant="outline" className="gap-1.5 py-1 px-3">
            <GraduationCap className="h-3.5 w-3.5" />
            {selectedSection.className} — {selectedSection.sectionName}
            {selectedSubject ? ` · ${selectedSubject.subjectName}` : ''}
          </Badge>
        )}
        {selectedSlot && (
          <Badge variant="outline" className="gap-1.5 py-1 px-3">
            <Clock className="h-3.5 w-3.5" />
            {selectedSlot.name} ({selectedSlot.startTime} – {selectedSlot.endTime})
          </Badge>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content — 2/3 */}
        <div className="lg:col-span-2 space-y-6">
          {/* Lesson Objectives */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-4 w-4 text-blue-500" />
                Lesson Objectives
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="By the end of this lesson, students will be able to..."
                rows={3}
                className="resize-none"
              />
            </CardContent>
          </Card>

          {/* Step-by-Step Procedure */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4 text-indigo-500" />
                  Step-by-Step Procedure
                </CardTitle>
                <Button variant="outline" size="sm" className="gap-1" onClick={handleAddStep}>
                  <Plus className="h-3.5 w-3.5" /> Add Step
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {steps.map((step, idx) => (
                <div key={idx} className="flex gap-3">
                  {/* Step Number */}
                  <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center mt-1">
                    {idx + 1}
                  </div>

                  {/* Step Content */}
                  <div className="flex-1 space-y-2 border rounded-lg p-3 bg-muted/10">
                    <div className="flex items-center gap-2">
                      <Input
                        value={step.title}
                        onChange={(e) => handleUpdateStep(idx, { title: e.target.value })}
                        placeholder="Step title..."
                        className="font-medium border-0 shadow-none px-0 h-auto focus-visible:ring-0"
                      />
                      <div className="flex items-center gap-1 shrink-0">
                        <Input
                          value={step.duration}
                          onChange={(e) => handleUpdateStep(idx, { duration: e.target.value })}
                          placeholder="Min"
                          className="w-16 h-7 text-xs text-center"
                          type="number"
                          min={1}
                        />
                        <span className="text-[10px] text-muted-foreground">min</span>
                      </div>
                      {steps.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 shrink-0"
                          onClick={() => handleRemoveStep(idx)}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      )}
                    </div>
                    <Textarea
                      value={step.description}
                      onChange={(e) => handleUpdateStep(idx, { description: e.target.value })}
                      placeholder="Describe this step..."
                      rows={2}
                      className="resize-none text-sm"
                    />
                  </div>
                </div>
              ))}

              {/* Add Step Hint */}
              <button
                onClick={handleAddStep}
                className="flex items-center gap-3 w-full text-sm text-muted-foreground hover:text-primary transition-colors py-2"
              >
                <div className="w-8 h-8 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                  <Plus className="h-3.5 w-3.5" />
                </div>
                Click to add next step
              </button>
            </CardContent>
          </Card>

          {/* Materials & Resources */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-4 w-4 text-violet-500" />
                Materials & Resources
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={resources}
                onChange={(e) => setResources(e.target.value)}
                placeholder="Enter each resource on a new line (e.g., slides, handouts, videos)"
                rows={4}
                className="resize-none"
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar — 1/3 */}
        <div className="space-y-6">
          {/* Class & Subject Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="h-4 w-4 text-emerald-500" />
                Lesson Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium">Section *</Label>
                <Select
                  value={sectionId}
                  onValueChange={(val) => {
                    setSectionId(val);
                    setSubjectId('');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select section" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map(
                      (cls: { sectionId: string; className: string; sectionName: string }) => (
                        <SelectItem key={cls.sectionId} value={cls.sectionId}>
                          {cls.className} — {cls.sectionName}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium">Subject *</Label>
                <Select value={subjectId} onValueChange={setSubjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {getSubjects().map((sub: { subjectId: string; subjectName: string }) => (
                      <SelectItem key={sub.subjectId} value={sub.subjectId}>
                        {sub.subjectName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="text-xs font-medium">Period / Slot</Label>
                <Select
                  value={slotId || 'none'}
                  onValueChange={(val) => {
                    setSlotId(val === 'none' ? '' : val);
                    setDate('');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (custom date)</SelectItem>
                    {timetableSlots.map((slot) => (
                      <SelectItem key={slot._id} value={slot._id}>
                        {slot.name} ({slot.startTime} – {slot.endTime})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium">Date *</Label>
                {slotId ? (
                  <>
                    <Select value={date} onValueChange={setDate}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a date" />
                      </SelectTrigger>
                      <SelectContent>
                        {(() => {
                          // Find which days of the week this slot+subject+section has timetable entries
                          const slotEntries = timetableEntries.filter(
                            (e: { slotId: string; subjectId: string; sectionId: string }) =>
                              e.slotId === slotId &&
                              (!subjectId || e.subjectId === subjectId) &&
                              (!sectionId || e.sectionId === sectionId)
                          );
                          const daysOfWeek = [
                            ...new Set(slotEntries.map((e: { dayOfWeek: number }) => e.dayOfWeek)),
                          ];

                          if (daysOfWeek.length === 0) {
                            return (
                              <div className="py-3 text-center text-sm text-muted-foreground">
                                No scheduled days found for this period
                              </div>
                            );
                          }

                          // Generate next 8 weeks of dates for those days
                          const dates: { value: string; label: string }[] = [];
                          const today = new Date();
                          const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

                          for (let w = 0; w < 8; w++) {
                            for (const dow of daysOfWeek) {
                              const d = new Date(today);
                              const currentDow = d.getDay();
                              const diff = dow - currentDow + w * 7;
                              d.setDate(d.getDate() + diff);
                              if (d >= today || d.toDateString() === today.toDateString()) {
                                const val = d.toISOString().split('T')[0];
                                dates.push({
                                  value: val,
                                  label: `${dayNames[dow]}, ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`,
                                });
                              }
                            }
                          }

                          // Sort and deduplicate
                          const unique = [...new Map(dates.map((d) => [d.value, d])).values()].sort(
                            (a, b) => a.value.localeCompare(b.value)
                          );

                          return unique.map((d) => (
                            <SelectItem key={d.value} value={d.value}>
                              {d.label}
                            </SelectItem>
                          ));
                        })()}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground">
                      Showing dates when this period is scheduled
                    </p>
                  </>
                ) : (
                  <DatePicker value={date} onChange={(iso) => setDate(iso)} />
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium">Duration (minutes)</Label>
                <Input
                  type="number"
                  min={1}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="45"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

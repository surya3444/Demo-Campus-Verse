'use client';

import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { teachingApi } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  BookOpen,
  Calendar,
  Clock,
  User,
  Target,
  FileText,
  Package,
  Loader2,
  Play,
  CheckCircle2,
  Link2,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { TeachingStatusBadge } from '@/components/teaching/TeachingStatusBadge';
import { QuestionnaireBuilder } from './questionnaire-builder';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LessonPlan = Record<string, any>;

interface LessonDrawerProps {
  lesson: LessonPlan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  readOnly?: boolean;
}

export function LessonDrawer({ lesson, open, onOpenChange, readOnly }: LessonDrawerProps) {
  const queryClient = useQueryClient();

  const teachingStatusMutation = useMutation({
    mutationFn: (data: { teachingStatus: string; linkedAssignmentId?: string }) =>
      teachingApi.updateLessonPlanTeachingStatus(lesson?._id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-plans-calendar'] });
      toast.success('Teaching status updated');
    },
    onError: () => {
      toast.error('Failed to update status');
    },
  });

  const isUpdating = teachingStatusMutation.isPending;

  // For admin viewing, pass the lesson's teacherId as staffId
  const drawerStaffId = readOnly && lesson?.teacherId ? lesson.teacherId : undefined;

  // Fetch timetable to compute subject progress
  const { data: timetableData } = useQuery({
    queryKey: ['my-timetable', drawerStaffId],
    queryFn: () => teachingApi.getMyTimetable(drawerStaffId),
    enabled: open && !!lesson,
  });

  const { data: allPlansData } = useQuery({
    queryKey: [
      'lesson-plans-all-for-progress',
      lesson?.subjectId,
      lesson?.sectionId,
      drawerStaffId,
    ],
    queryFn: () =>
      teachingApi.getLessonPlans({
        subjectId: lesson?.subjectId,
        sectionId: lesson?.sectionId,
        staffId: drawerStaffId,
        limit: 500,
      }),
    enabled: open && !!lesson?.subjectId,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const timetableEntries: any[] = timetableData?.data || [];
  const totalPlansForSubject = allPlansData?.data?.length || 0;

  // Count how many weekly periods this subject has across the timetable
  const weeklyPeriods = useMemo(() => {
    if (!lesson) return 0;
    return timetableEntries.filter(
      (e: { subjectId: string; sectionId: string }) =>
        e.subjectId === lesson.subjectId && e.sectionId === lesson.sectionId
    ).length;
  }, [timetableEntries, lesson]);

  if (!lesson) return null;

  const statusColor =
    lesson.status === 'published'
      ? 'bg-green-100 text-green-700 border-green-200'
      : lesson.status === 'completed'
        ? 'bg-blue-100 text-blue-700 border-blue-200'
        : 'bg-gray-100 text-gray-600 border-gray-200';

  const renderStatusActions = () => {
    if (lesson.status !== 'published') return null;

    const btn = (
      label: string,
      status: string,
      icon: ReactNode,
      variant: 'default' | 'outline' = 'outline'
    ) => (
      <Button
        key={status}
        size="sm"
        variant={variant}
        className="gap-1.5 flex-1"
        onClick={() => teachingStatusMutation.mutate({ teachingStatus: status })}
        disabled={isUpdating}
      >
        {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
        {label}
      </Button>
    );

    switch (lesson.teachingStatus) {
      case 'not_started':
        return (
          <div className="flex gap-2">
            {btn('Start Teaching', 'ongoing', <Play className="h-3.5 w-3.5" />, 'default')}
          </div>
        );
      case 'ongoing':
        return (
          <div className="flex gap-2">
            {btn('Mark Delivered', 'delivered', <BookOpen className="h-3.5 w-3.5" />)}
            {btn('Complete', 'completed', <CheckCircle2 className="h-3.5 w-3.5" />)}
          </div>
        );
      case 'delivered':
        return (
          <div className="flex gap-2">
            {btn('Send Questionnaire', 'questionnaire_sent', <Link2 className="h-3.5 w-3.5" />)}
            {btn('Complete', 'completed', <CheckCircle2 className="h-3.5 w-3.5" />)}
          </div>
        );
      case 'questionnaire_sent':
        return (
          <div className="flex gap-2">
            {btn('All Submitted', 'all_submitted', <CheckCircle2 className="h-3.5 w-3.5" />)}
            {btn('Complete', 'completed', <CheckCircle2 className="h-3.5 w-3.5" />)}
          </div>
        );
      case 'all_submitted':
        return (
          <div className="flex gap-2">
            {btn('Complete', 'completed', <CheckCircle2 className="h-3.5 w-3.5" />, 'default')}
          </div>
        );
      case 'completed_with_assignment':
        return (
          <div className="flex gap-2">
            {btn('Mark Complete', 'completed', <CheckCircle2 className="h-3.5 w-3.5" />)}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="px-6 py-4 bg-primary/5 border-b">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-lg">{lesson.title}</SheetTitle>
              <SheetDescription className="flex items-center gap-2 mt-1">
                <span>{lesson.subjectName}</span>
                <span className="text-muted-foreground">·</span>
                <span>
                  {lesson.sectionName}
                  {lesson.className ? ` (${lesson.className})` : ''}
                </span>
              </SheetDescription>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Badge className={`text-[10px] border ${statusColor}`}>{lesson.status}</Badge>
            </div>
          </div>
        </SheetHeader>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="px-6 py-5 space-y-6">
            {/* Meta Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{lesson.date ? new Date(lesson.date).toLocaleDateString() : 'No date'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{lesson.teacherName || 'Unknown'}</span>
              </div>
              {lesson.duration && (
                <div className="flex items-center gap-2 text-sm">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                  <span>{lesson.duration} min</span>
                </div>
              )}
              {lesson.status === 'published' && (
                <div className="flex items-center gap-2 text-sm">
                  <TeachingStatusBadge status={lesson.teachingStatus} />
                </div>
              )}
            </div>

            {/* Slot Info */}
            {lesson.slotName && (
              <div className="flex items-center gap-2 text-sm bg-muted/50 rounded-lg px-3 py-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>
                  {lesson.slotName} · {lesson.slotStartTime} – {lesson.slotEndTime}
                </span>
              </div>
            )}

            {/* Subject Progress */}
            {weeklyPeriods > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    Lessons planned for {lesson.subjectName}
                  </span>
                  <span className="font-medium">
                    {totalPlansForSubject}/{weeklyPeriods * 4}{' '}
                    <span className="text-muted-foreground font-normal">this month</span>
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (totalPlansForSubject / (weeklyPeriods * 4)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Status Actions */}
            {!readOnly && lesson.status === 'published' && <div>{renderStatusActions()}</div>}

            <Separator />

            {/* Objectives / Step-by-Step Procedure */}
            {lesson.objectives && lesson.objectives.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                  <Target className="h-4 w-4 text-blue-500" />
                  Step-by-Step Procedure
                </h4>
                <div className="space-y-2.5">
                  {lesson.objectives.map((obj: string, i: number) => (
                    <div key={i} className="flex gap-3">
                      <div className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </div>
                      <p className="text-sm leading-relaxed flex-1">{obj}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            {lesson.description && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-emerald-500" />
                    Description
                  </h4>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {lesson.description}
                  </p>
                </div>
              </>
            )}

            {/* Methodology */}
            {lesson.methodology && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-semibold mb-2">Methodology</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {lesson.methodology}
                  </p>
                </div>
              </>
            )}

            {/* Assessment */}
            {lesson.assessment && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-semibold mb-2">Assessment</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {lesson.assessment}
                  </p>
                </div>
              </>
            )}

            {/* Resources */}
            {lesson.resources && lesson.resources.length > 0 && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                    <Package className="h-4 w-4 text-violet-500" />
                    Resources
                  </h4>
                  <div className="space-y-1.5">
                    {lesson.resources.map((res: string, i: number) => (
                      <div
                        key={i}
                        className="text-sm bg-muted/50 rounded-lg px-3 py-2 flex items-center gap-2"
                      >
                        <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="flex-1 truncate">{res}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Notes */}
            {lesson.notes && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-semibold mb-2">Notes</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {lesson.notes}
                  </p>
                </div>
              </>
            )}

            {/* Questionnaire */}
            <Separator />
            {!readOnly && (
              <QuestionnaireBuilder lessonPlanId={lesson._id} lessonTitle={lesson.title} />
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-6 py-3 border-t bg-background">
          <Button variant="outline" size="sm" className="w-full gap-2" asChild>
            <Link href={`/teaching/lesson-plans/${lesson._id}`}>
              <ExternalLink className="h-3.5 w-3.5" />
              View Full Details
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

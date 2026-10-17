'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CalendarDays,
  Check,
  X,
  Clock,
  Save,
  Users,
  UserCheck,
  UserX,
  CheckCircle,
  Loader2,
  Lock,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { academicApi, attendanceApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { useHierarchyLabels } from '@/hooks/useHierarchyLabels';

type AttendanceStatus = 'present' | 'absent' | 'late' | 'half-day' | 'leave' | null;

interface StudentRecord {
  studentId: string;
  admissionNumber?: string;
  displayName?: string;
  rollNumber?: number;
  status: AttendanceStatus;
  inTime?: string;
  outTime?: string;
  remarks?: string;
}

interface ClassOption {
  _id: string;
  name: string;
  displayName: string;
}

interface SectionOption {
  _id: string;
  name: string;
  /** Lab batches — subdivisions for per-batch practical registers. */
  batches?: Array<{ _id: string; name: string }>;
}

export default function MarkAttendancePage() {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const labels = useHierarchyLabels();
  const canMark = hasPermission('attendance.mark', 'create');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  // Per-subject (lecture) marking — empty means the whole-day register.
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  // Lab-batch register — empty means the whole section attends the lecture.
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [attendanceId, setAttendanceId] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isMarked, setIsMarked] = useState(false);

  // Fetch classes
  const { data: classesData, isLoading: classesLoading } = useQuery({
    queryKey: ['classes'],
    queryFn: () => academicApi.getClasses({ status: 'active' }),
  });

  // Fetch sections when class is selected
  const { data: sectionsData, isLoading: sectionsLoading } = useQuery({
    queryKey: ['sections', selectedClassId],
    queryFn: () => academicApi.getSectionsByClass(selectedClassId),
    enabled: !!selectedClassId,
  });

  // Attendance settings decide whether this branch marks daily or per lecture.
  const { data: attendanceSettings } = useQuery({
    queryKey: ['attendance-settings'],
    queryFn: () => attendanceApi.getSettings(),
  });
  const perSubjectMode =
    (attendanceSettings?.data?.generalSettings?.attendanceMode as string | undefined) ===
    'per-subject';

  // Subjects taught in the selected section (per-subject mode only).
  const { data: sectionSubjectsData } = useQuery({
    queryKey: ['section-subjects', selectedSectionId],
    queryFn: () => academicApi.getSectionSubjects(selectedSectionId),
    enabled: perSubjectMode && !!selectedSectionId,
  });
  const sectionSubjects = (sectionSubjectsData?.data ?? []) as Array<{
    subjectId: string;
    subject: { name: string; code: string } | null;
  }>;

  // Fetch attendance when all selections are made
  const {
    data: attendanceData,
    isLoading: attendanceLoading,
    refetch: refetchAttendance,
  } = useQuery({
    queryKey: [
      'attendance',
      selectedClassId,
      selectedSectionId,
      selectedDate,
      selectedSubjectId,
      selectedBatchId,
    ],
    queryFn: () =>
      attendanceApi.getAttendance({
        classId: selectedClassId,
        sectionId: selectedSectionId,
        date: selectedDate,
        ...(selectedSubjectId ? { subjectId: selectedSubjectId } : {}),
        ...(selectedSubjectId && selectedBatchId ? { batchId: selectedBatchId } : {}),
      }),
    enabled:
      !!selectedClassId &&
      !!selectedSectionId &&
      !!selectedDate &&
      // In per-subject mode a lecture must be chosen before a register exists.
      (!perSubjectMode || !!selectedSubjectId),
  });

  // Update local state when attendance data changes
  useEffect(() => {
    if (attendanceData?.data) {
      const data = attendanceData.data;
      setStudents(
        data.records.map((r: StudentRecord) => ({
          ...r,
          status: r.status || null,
        }))
      );
      setAttendanceId(data._id || null);
      setIsLocked(data.isLocked || false);
      setIsMarked(data.isMarked || false);
    }
  }, [attendanceData]);

  // Reset sections when class changes
  useEffect(() => {
    setSelectedSectionId('');
    setSelectedSubjectId('');
    setSelectedBatchId('');
    setStudents([]);
    setAttendanceId(null);
    setIsLocked(false);
    setIsMarked(false);
  }, [selectedClassId]);

  // Mark attendance mutation
  const markAttendanceMutation = useMutation({
    mutationFn: (data: {
      classId: string;
      sectionId: string;
      date: string;
      subjectId?: string;
      batchId?: string;
      records: Array<{
        studentId: string;
        status: 'present' | 'absent' | 'late' | 'half-day' | 'leave';
      }>;
    }) => attendanceApi.markAttendance(data),
    onSuccess: () => {
      toast.success('Attendance saved successfully!');
      queryClient.invalidateQueries({
        queryKey: ['attendance', selectedClassId, selectedSectionId, selectedDate],
      });
      refetchAttendance();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save attendance');
    },
  });

  // Lock attendance mutation
  const lockAttendanceMutation = useMutation({
    mutationFn: (id: string) => attendanceApi.lockAttendance(id),
    onSuccess: () => {
      toast.success('Attendance locked successfully!');
      setIsLocked(true);
      refetchAttendance();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to lock attendance');
    },
  });

  const classes: ClassOption[] = classesData?.data || [];
  const sections: SectionOption[] = sectionsData?.data || [];

  const presentCount = students.filter((s) => s.status === 'present').length;
  const absentCount = students.filter((s) => s.status === 'absent').length;
  const lateCount = students.filter((s) => s.status === 'late').length;
  const halfDayCount = students.filter((s) => s.status === 'half-day').length;
  const leaveCount = students.filter((s) => s.status === 'leave').length;
  const unmarkedCount = students.filter((s) => !s.status).length;

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    if (isLocked) {
      toast.error('Attendance is locked and cannot be modified');
      return;
    }
    setStudents((prev) => prev.map((s) => (s.studentId === studentId ? { ...s, status } : s)));
  };

  const handleSelectAll = (status: 'present' | 'absent') => {
    if (isLocked) {
      toast.error('Attendance is locked and cannot be modified');
      return;
    }
    setStudents((prev) => prev.map((s) => ({ ...s, status })));
    toast.success(`All students marked as ${status}`);
  };

  const handleSave = () => {
    if (unmarkedCount > 0) {
      toast.error(`Please mark attendance for all ${unmarkedCount} students`);
      return;
    }

    const records = students
      .filter((s) => s.status !== null)
      .map((s) => ({
        studentId: s.studentId,
        status: s.status as 'present' | 'absent' | 'late' | 'half-day' | 'leave',
      }));

    markAttendanceMutation.mutate({
      classId: selectedClassId,
      sectionId: selectedSectionId,
      date: selectedDate,
      ...(selectedSubjectId ? { subjectId: selectedSubjectId } : {}),
      ...(selectedSubjectId && selectedBatchId ? { batchId: selectedBatchId } : {}),
      records,
    });
  };

  const handleLock = () => {
    if (!attendanceId) {
      toast.error('Please save attendance first before locking');
      return;
    }
    lockAttendanceMutation.mutate(attendanceId);
  };

  const formattedDate = new Date(selectedDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const getInitials = (name?: string) =>
    name
      ? name
          .split(' ')
          .map((n) => n[0])
          .join('')
          .toUpperCase()
      : '?';

  const selectedClass = classes.find((c) => c._id === selectedClassId);
  const selectedSection = sections.find((s) => s._id === selectedSectionId);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/95 to-navy-800 p-8 text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-64 h-64 bg-accent rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-accent" />
              <span className="text-white/70 text-sm font-medium">{formattedDate}</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-semibold">Mark Daily Attendance</h1>
            <p className="text-white/70">
              One mark per student per day for the selected class & section
            </p>
          </div>
          <div className="flex gap-2">
            {isMarked && attendanceId && !isLocked && (
              <Button
                onClick={handleLock}
                variant="outline"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20 gap-2"
                disabled={lockAttendanceMutation.isPending}
              >
                {lockAttendanceMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Lock className="h-4 w-4" />
                )}
                Lock Attendance
              </Button>
            )}
            <Button
              onClick={handleSave}
              className="bg-accent hover:bg-accent/90 text-accent-foreground gap-2"
              disabled={
                !canMark ||
                unmarkedCount > 0 ||
                students.length === 0 ||
                isLocked ||
                markAttendanceMutation.isPending
              }
            >
              {markAttendanceMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Attendance
            </Button>
          </div>
        </div>
      </div>

      {/* Info banner: clarify daily-only behaviour and who can mark */}
      <div
        className={cn(
          'flex items-start gap-3 rounded-xl border p-4',
          canMark
            ? 'border-primary/20 bg-primary/5 text-primary'
            : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
        )}
      >
        <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
        <div className="text-sm space-y-0.5">
          {canMark ? (
            <>
              <p className="font-medium">Daily attendance — not period-wise</p>
              <p className="text-foreground/70">
                Each student gets a single status for the whole day (Present, Absent, Late,
                Half-day, Leave). Period-wise attendance is not enabled. You have permission to save
                changes.
              </p>
            </>
          ) : (
            <>
              <p className="font-medium">Read-only access</p>
              <p>
                You can view daily attendance for any class, but you don&apos;t have permission to
                save changes. Only users with the <code>attendance.mark</code> permission (typically
                class teachers and admins) can record or update attendance.
              </p>
            </>
          )}
        </div>
      </div>

      {/* Class Selection */}
      <Card className="border-0 shadow-elegant-md">
        <CardContent className="py-5">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Date</Label>
              <DatePicker
                value={selectedDate}
                onChange={(iso) => setSelectedDate(iso)}
                className="w-44 h-11"
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">{labels.container}</Label>
              <Select
                value={selectedClassId}
                onValueChange={setSelectedClassId}
                disabled={classesLoading}
              >
                <SelectTrigger className="w-44 h-11">
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls) => (
                    <SelectItem key={cls._id} value={cls._id}>
                      {cls.displayName || cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">{labels.leaf}</Label>
              <Select
                value={selectedSectionId}
                onValueChange={(v) => {
                  setSelectedSectionId(v);
                  setSelectedBatchId('');
                }}
                disabled={!selectedClassId || sectionsLoading}
              >
                <SelectTrigger className="w-44 h-11">
                  <SelectValue placeholder="Select section" />
                </SelectTrigger>
                <SelectContent>
                  {sections.map((section) => (
                    <SelectItem key={section._id} value={section._id}>
                      {section.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Lecture-wise marking: pick the subject whose class this is.
                Electives list only their registered students. */}
            {perSubjectMode && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Subject</Label>
                <Select
                  value={selectedSubjectId}
                  onValueChange={setSelectedSubjectId}
                  disabled={!selectedSectionId}
                >
                  <SelectTrigger className="h-11 w-52">
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {sectionSubjects.map((cs) => (
                      <SelectItem key={cs.subjectId} value={cs.subjectId}>
                        {cs.subject?.name ?? 'Subject'}
                        {cs.subject?.code ? ` (${cs.subject.code})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Lab-batch register: Batch 1's session and Batch 2's session on
                the same day are distinct registers with batch-only rosters. */}
            {perSubjectMode && (selectedSection?.batches?.length ?? 0) > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Lab Batch</Label>
                <Select
                  value={selectedBatchId || '__whole__'}
                  onValueChange={(v) => setSelectedBatchId(v === '__whole__' ? '' : v)}
                  disabled={!selectedSubjectId}
                >
                  <SelectTrigger className="h-11 w-44">
                    <SelectValue placeholder="Whole section" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__whole__">Whole section</SelectItem>
                    {(selectedSection?.batches ?? []).map((b) => (
                      <SelectItem key={b._id} value={b._id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex gap-2 ml-auto">
              <Button
                variant="outline"
                onClick={() => handleSelectAll('present')}
                className="gap-2"
                disabled={!canMark || students.length === 0 || isLocked}
              >
                <UserCheck className="h-4 w-4" />
                Mark All Present
              </Button>
              <Button
                variant="outline"
                onClick={() => handleSelectAll('absent')}
                className="gap-2"
                disabled={!canMark || students.length === 0 || isLocked}
              >
                <UserX className="h-4 w-4" />
                Mark All Absent
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Locked Warning */}
      {isLocked && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-warning/10 border border-warning/20">
          <Lock className="h-5 w-5 text-warning" />
          <div>
            <p className="font-medium text-warning">Attendance Locked</p>
            <p className="text-sm text-muted-foreground">
              This attendance has been locked and cannot be modified.
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      {students.length > 0 && (
        <div className="grid gap-4 md:grid-cols-5 stagger-animation">
          <Card className="border-0 shadow-elegant-md">
            <CardContent className="py-5">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
                  <Users className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-3xl font-bold">{students.length}</p>
                  <p className="text-sm text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-elegant-md bg-gradient-to-br from-success to-emerald-600 text-white">
            <CardContent className="py-5">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center">
                  <Check className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-3xl font-bold">{presentCount}</p>
                  <p className="text-sm text-white/70">Present</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-elegant-md bg-gradient-to-br from-destructive to-red-600 text-white">
            <CardContent className="py-5">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center">
                  <X className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-3xl font-bold">{absentCount}</p>
                  <p className="text-sm text-white/70">Absent</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-elegant-md bg-gradient-to-br from-warning to-amber-600 text-white">
            <CardContent className="py-5">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center">
                  <Clock className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-3xl font-bold">{lateCount}</p>
                  <p className="text-sm text-white/70">Late</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-elegant-md">
            <CardContent className="py-5">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-info/10 flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-info" />
                </div>
                <div>
                  <p className="text-3xl font-bold">{halfDayCount + leaveCount}</p>
                  <p className="text-sm text-muted-foreground">Half-Day/Leave</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Student List */}
      <Card className="border-0 shadow-elegant-md">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="text-xl">
              {selectedClass && selectedSection
                ? `${selectedClass.displayName || selectedClass.name} - ${selectedSection.name}${
                    selectedBatchId
                      ? ` · ${
                          selectedSection.batches?.find((b) => b._id === selectedBatchId)?.name ??
                          'Lab batch'
                        }`
                      : ''
                  }`
                : 'Select a class and section to mark attendance'}
            </CardTitle>
            {students.length > 0 && unmarkedCount > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                <span className="text-warning font-medium">{unmarkedCount} students</span> remaining
                to mark
              </p>
            )}
          </div>
          {unmarkedCount === 0 && students.length > 0 && (
            <Badge className="bg-success/10 text-success border-success/20 gap-1">
              <CheckCircle className="h-3.5 w-3.5" />
              All marked
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          {attendanceLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !selectedClassId || !selectedSectionId ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mb-4 opacity-50" />
              <p>Select a class and section to view students</p>
            </div>
          ) : students.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mb-4 opacity-50" />
              <p>No students found in this section</p>
            </div>
          ) : (
            <div className="space-y-3">
              {students.map((student, index) => (
                <div
                  key={student.studentId}
                  className={cn(
                    'flex items-center justify-between p-4 rounded-xl border transition-all duration-200 group',
                    student.status === 'present' && 'bg-success/5 border-success/20',
                    student.status === 'absent' && 'bg-destructive/5 border-destructive/20',
                    student.status === 'late' && 'bg-warning/5 border-warning/20',
                    student.status === 'half-day' && 'bg-info/5 border-info/20',
                    student.status === 'leave' && 'bg-muted border-muted',
                    !student.status && 'bg-muted/30 border-border/50 hover:border-primary/30',
                    isLocked && 'opacity-75'
                  )}
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <div className="flex items-center gap-4">
                    <Avatar className="h-11 w-11 ring-2 ring-primary/10">
                      <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20 text-primary text-sm font-medium">
                        {getInitials(student.displayName)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                        {student.displayName || 'Unknown'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {student.admissionNumber && `${student.admissionNumber} • `}
                        Roll No: {student.rollNumber || '-'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={student.status === 'present' ? 'default' : 'outline'}
                      className={cn(
                        'h-10 w-10 p-0',
                        student.status === 'present' &&
                          'bg-success hover:bg-success/90 border-success'
                      )}
                      onClick={() => handleStatusChange(student.studentId, 'present')}
                      disabled={isLocked}
                      title="Present"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant={student.status === 'absent' ? 'default' : 'outline'}
                      className={cn(
                        'h-10 w-10 p-0',
                        student.status === 'absent' &&
                          'bg-destructive hover:bg-destructive/90 border-destructive'
                      )}
                      onClick={() => handleStatusChange(student.studentId, 'absent')}
                      disabled={isLocked}
                      title="Absent"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant={student.status === 'late' ? 'default' : 'outline'}
                      className={cn(
                        'h-10 w-10 p-0',
                        student.status === 'late' &&
                          'bg-warning hover:bg-warning/90 border-warning text-white'
                      )}
                      onClick={() => handleStatusChange(student.studentId, 'late')}
                      disabled={isLocked}
                      title="Late"
                    >
                      <Clock className="h-4 w-4" />
                    </Button>
                    <Select
                      value={
                        student.status === 'half-day' || student.status === 'leave'
                          ? student.status
                          : ''
                      }
                      onValueChange={(value) =>
                        handleStatusChange(student.studentId, value as AttendanceStatus)
                      }
                      disabled={isLocked}
                    >
                      <SelectTrigger
                        className={cn(
                          'w-28 h-10',
                          (student.status === 'half-day' || student.status === 'leave') &&
                            'border-info bg-info/10'
                        )}
                      >
                        <SelectValue placeholder="More" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="half-day">Half Day</SelectItem>
                        <SelectItem value="leave">Leave</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

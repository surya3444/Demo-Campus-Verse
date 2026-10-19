'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
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
  Unlock,
  LogIn,
  LogOut,
  FileText,
  CalendarRange,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { staffAttendanceApi } from '@/lib/api';
import Link from 'next/link';

type StaffAttendanceStatus =
  | 'present'
  | 'absent'
  | 'late'
  | 'half_day'
  | 'on_leave'
  | 'holiday'
  | null;

interface StaffRecord {
  staffId: string;
  staffName?: string;
  employeeId?: string;
  status: StaffAttendanceStatus;
  checkIn?: string;
  checkOut?: string;
  workingHours?: number;
  remarks?: string;
}

export default function StaffAttendancePage() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [editingCheckTimes, setEditingCheckTimes] = useState<
    Record<string, { checkIn?: string; checkOut?: string }>
  >({});

  // Fetch attendance for selected date
  const {
    data: attendanceData,
    isLoading: attendanceLoading,
    refetch: refetchAttendance,
  } = useQuery({
    queryKey: ['staff-attendance', selectedDate],
    queryFn: () => staffAttendanceApi.getAttendance(selectedDate),
  });

  // Update local state when attendance data changes
  useEffect(() => {
    if (attendanceData?.data) {
      const data = attendanceData.data;
      setStaff(
        data.records.map((r: StaffRecord) => ({
          ...r,
          status: r.status || null,
        }))
      );
      setIsLocked(data.isLocked || false);
      setEditingCheckTimes({});
    }
  }, [attendanceData]);

  // Mark attendance mutation
  const markAttendanceMutation = useMutation({
    mutationFn: (data: {
      date: string;
      records: Array<{
        staffId: string;
        status: 'present' | 'absent' | 'late' | 'half_day' | 'on_leave' | 'holiday';
        checkIn?: string;
        checkOut?: string;
        remarks?: string;
      }>;
    }) => staffAttendanceApi.markAttendance(data),
    onSuccess: () => {
      toast.success('Attendance saved successfully!');
      queryClient.invalidateQueries({ queryKey: ['staff-attendance', selectedDate] });
      refetchAttendance();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save attendance');
    },
  });

  // Lock attendance mutation
  const lockAttendanceMutation = useMutation({
    mutationFn: (date: string) => staffAttendanceApi.lockAttendance(date),
    onSuccess: () => {
      toast.success('Attendance locked successfully!');
      setIsLocked(true);
      refetchAttendance();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to lock attendance');
    },
  });

  // Unlock attendance mutation
  const unlockAttendanceMutation = useMutation({
    mutationFn: (date: string) => staffAttendanceApi.unlockAttendance(date),
    onSuccess: () => {
      toast.success('Attendance unlocked successfully!');
      setIsLocked(false);
      refetchAttendance();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to unlock attendance');
    },
  });

  const presentCount = staff.filter((s) => s.status === 'present').length;
  const absentCount = staff.filter((s) => s.status === 'absent').length;
  const lateCount = staff.filter((s) => s.status === 'late').length;
  const halfDayCount = staff.filter((s) => s.status === 'half_day').length;
  const onLeaveCount = staff.filter((s) => s.status === 'on_leave').length;
  const unmarkedCount = staff.filter((s) => !s.status).length;

  const handleStatusChange = (staffId: string, status: StaffAttendanceStatus) => {
    if (isLocked) {
      toast.error('Attendance is locked and cannot be modified');
      return;
    }
    setStaff((prev) => prev.map((s) => (s.staffId === staffId ? { ...s, status } : s)));
  };

  const handleCheckTimeChange = (staffId: string, field: 'checkIn' | 'checkOut', value: string) => {
    setEditingCheckTimes((prev) => ({
      ...prev,
      [staffId]: { ...prev[staffId], [field]: value },
    }));
  };

  const handleSelectAll = (status: 'present' | 'absent') => {
    if (isLocked) {
      toast.error('Attendance is locked and cannot be modified');
      return;
    }
    setStaff((prev) => prev.map((s) => ({ ...s, status })));
    toast.success(`All staff marked as ${status}`);
  };

  const handleSave = () => {
    if (unmarkedCount > 0) {
      toast.error(`Please mark attendance for all ${unmarkedCount} staff members`);
      return;
    }

    const records = staff
      .filter((s) => s.status !== null)
      .map((s) => ({
        staffId: s.staffId,
        status: s.status as 'present' | 'absent' | 'late' | 'half_day' | 'on_leave' | 'holiday',
        // Normalise to HH:MM so the backend's `new Date(${date}T${time})`
        // never sees a full ISO string and produces Invalid Date.
        checkIn: editingCheckTimes[s.staffId]?.checkIn ?? toTimeInputValue(s.checkIn) ?? undefined,
        checkOut:
          editingCheckTimes[s.staffId]?.checkOut ?? toTimeInputValue(s.checkOut) ?? undefined,
      }));

    markAttendanceMutation.mutate({
      date: selectedDate,
      records,
    });
  };

  const handleLock = () => {
    lockAttendanceMutation.mutate(selectedDate);
  };

  const handleUnlock = () => {
    unlockAttendanceMutation.mutate(selectedDate);
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

  /**
   * The backend stores checkIn / checkOut as Date objects (it parses the
   * incoming "HH:MM" string into a Date during save). When we fetch it back,
   * it comes through as an ISO string like "2026-04-08T03:00:00.000Z".
   * <Input type="time" /> needs plain "HH:MM" to display anything, so we
   * normalise here. Empty values → "". Already-HH:MM strings pass through.
   */
  const toTimeInputValue = (value?: string): string => {
    if (!value) return '';
    // Already HH:MM? leave it.
    if (/^\d{2}:\d{2}$/.test(value)) return value;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  const getStatusColor = (status: StaffAttendanceStatus) => {
    switch (status) {
      case 'present':
        return 'bg-success/5 border-success/20';
      case 'absent':
        return 'bg-destructive/5 border-destructive/20';
      case 'late':
        return 'bg-warning/5 border-warning/20';
      case 'half_day':
        return 'bg-info/5 border-info/20';
      case 'on_leave':
        return 'bg-purple-50 border-purple-200';
      case 'holiday':
        return 'bg-muted border-muted';
      default:
        return 'bg-muted/30 border-border/50 hover:border-primary/30';
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="relative animate-fade-in">
        <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5 text-[hsl(var(--brand-cyan))]" />
              <span>HR · Attendance · {formattedDate}</span>
            </div>
            <h1 className="font-display text-3xl font-bold leading-tight tracking-tight md:text-4xl">Staff Attendance</h1>
            <p className="max-w-2xl text-muted-foreground">Record daily staff attendance and working hours</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/hr/attendance/reports">
              <Button
                variant="outline"
                className="gap-2"
              >
                <FileText className="h-4 w-4" />
                Reports
              </Button>
            </Link>
            <Link href="/hr/attendance/my">
              <Button
                variant="outline"
                className="gap-2"
              >
                <CalendarRange className="h-4 w-4" />
                My Attendance
              </Button>
            </Link>
            {unmarkedCount === 0 && staff.length > 0 && !isLocked && (
              <Button
                onClick={handleLock}
                variant="outline"
                className="gap-2"
                disabled={lockAttendanceMutation.isPending}
              >
                {lockAttendanceMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Lock className="h-4 w-4" />
                )}
                Lock
              </Button>
            )}
            {isLocked && (
              <Button
                onClick={handleUnlock}
                variant="outline"
                className="gap-2"
                disabled={unlockAttendanceMutation.isPending}
              >
                {unlockAttendanceMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Unlock className="h-4 w-4" />
                )}
                Unlock
              </Button>
            )}
            <Button
              onClick={handleSave}
              className="bg-accent hover:bg-accent/90 text-accent-foreground gap-2"
              disabled={staff.length === 0 || isLocked || markAttendanceMutation.isPending}
            >
              {markAttendanceMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save
            </Button>
          </div>
        </div>
      </div>

      {/* Date Selection & Quick Actions */}
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
            <div className="flex gap-2 ml-auto">
              <Button
                variant="outline"
                onClick={() => handleSelectAll('present')}
                className="gap-2"
                disabled={staff.length === 0 || isLocked}
              >
                <UserCheck className="h-4 w-4" />
                Mark All Present
              </Button>
              <Button
                variant="outline"
                onClick={() => handleSelectAll('absent')}
                className="gap-2"
                disabled={staff.length === 0 || isLocked}
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
              This attendance has been locked. Unlock it to make changes.
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      {staff.length > 0 && (
        <div className="grid gap-4 md:grid-cols-6 stagger-animation">
          <Card className="border-0 shadow-elegant-md">
            <CardContent className="py-5">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
                  <Users className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-3xl font-bold">{staff.length}</p>
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
          <Card className="border-0 shadow-elegant-md bg-gradient-to-br from-info to-blue-600 text-white">
            <CardContent className="py-5">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center">
                  <Clock className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-3xl font-bold">{halfDayCount}</p>
                  <p className="text-sm text-white/70">Half Day</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-elegant-md bg-gradient-to-br from-purple-500 to-purple-700 text-white">
            <CardContent className="py-5">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center">
                  <CalendarDays className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-3xl font-bold">{onLeaveCount}</p>
                  <p className="text-sm text-white/70">On Leave</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Staff List */}
      <Card className="border-0 shadow-elegant-md">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="text-xl">Staff Members</CardTitle>
            {staff.length > 0 && unmarkedCount > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                <span className="text-warning font-medium">{unmarkedCount} staff</span> remaining to
                mark
              </p>
            )}
          </div>
          {unmarkedCount === 0 && staff.length > 0 && (
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
          ) : staff.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mb-4 opacity-50" />
              <p>No staff members found for this branch</p>
            </div>
          ) : (
            <div className="space-y-3">
              {staff.map((member, index) => (
                <div
                  key={member.staffId}
                  className={cn(
                    'flex items-center justify-between p-4 rounded-xl border transition-all duration-200 group',
                    getStatusColor(member.status),
                    isLocked && 'opacity-75'
                  )}
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <div className="flex items-center gap-4">
                    <Avatar className="h-11 w-11 ring-2 ring-primary/10">
                      <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20 text-primary text-sm font-medium">
                        {getInitials(member.staffName)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                        {member.staffName || 'Unknown'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {member.employeeId && `EMP ID: ${member.employeeId}`}
                        {member.workingHours !== undefined &&
                          ` | ${member.workingHours.toFixed(1)} hrs`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Check-in/Check-out times */}
                    <div className="hidden lg:flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <LogIn className="h-4 w-4 text-muted-foreground" />
                        <Input
                          type="time"
                          className="w-28 h-9 text-sm"
                          value={
                            editingCheckTimes[member.staffId]?.checkIn ??
                            toTimeInputValue(member.checkIn)
                          }
                          onChange={(e) =>
                            handleCheckTimeChange(member.staffId, 'checkIn', e.target.value)
                          }
                          disabled={isLocked}
                          placeholder="Check In"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <LogOut className="h-4 w-4 text-muted-foreground" />
                        <Input
                          type="time"
                          className="w-28 h-9 text-sm"
                          value={
                            editingCheckTimes[member.staffId]?.checkOut ??
                            toTimeInputValue(member.checkOut)
                          }
                          onChange={(e) =>
                            handleCheckTimeChange(member.staffId, 'checkOut', e.target.value)
                          }
                          disabled={isLocked}
                          placeholder="Check Out"
                        />
                      </div>
                    </div>

                    {/* Status buttons */}
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={member.status === 'present' ? 'default' : 'outline'}
                        className={cn(
                          'h-10 w-10 p-0',
                          member.status === 'present' &&
                            'bg-success hover:bg-success/90 border-success'
                        )}
                        onClick={() => handleStatusChange(member.staffId, 'present')}
                        disabled={isLocked}
                        title="Present"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant={member.status === 'absent' ? 'default' : 'outline'}
                        className={cn(
                          'h-10 w-10 p-0',
                          member.status === 'absent' &&
                            'bg-destructive hover:bg-destructive/90 border-destructive'
                        )}
                        onClick={() => handleStatusChange(member.staffId, 'absent')}
                        disabled={isLocked}
                        title="Absent"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant={member.status === 'late' ? 'default' : 'outline'}
                        className={cn(
                          'h-10 w-10 p-0',
                          member.status === 'late' &&
                            'bg-warning hover:bg-warning/90 border-warning text-white'
                        )}
                        onClick={() => handleStatusChange(member.staffId, 'late')}
                        disabled={isLocked}
                        title="Late"
                      >
                        <Clock className="h-4 w-4" />
                      </Button>
                      <Select
                        value={
                          member.status === 'half_day' ||
                          member.status === 'on_leave' ||
                          member.status === 'holiday'
                            ? member.status
                            : ''
                        }
                        onValueChange={(value) =>
                          handleStatusChange(member.staffId, value as StaffAttendanceStatus)
                        }
                        disabled={isLocked}
                      >
                        <SelectTrigger
                          className={cn(
                            'w-28 h-10',
                            (member.status === 'half_day' ||
                              member.status === 'on_leave' ||
                              member.status === 'holiday') &&
                              'border-info bg-info/10'
                          )}
                        >
                          <SelectValue placeholder="More" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="half_day">Half Day</SelectItem>
                          <SelectItem value="on_leave">On Leave</SelectItem>
                          <SelectItem value="holiday">Holiday</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
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

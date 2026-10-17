'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Settings,
  Clock,
  ShieldCheck,
  Bell,
  Save,
  Loader2,
  AlertCircle,
  CalendarDays,
  Lock,
  MessageSquare,
  CalendarOff,
  Gauge,
} from 'lucide-react';
import { attendanceApi } from '@/lib/api';
import { toast } from 'sonner';

interface AttendanceSettings {
  workingDays: number[];
  startTime: string;
  endTime: string;
  lateThresholdMinutes: number;
  halfDayThresholdMinutes: number;
  autoLockAfterDays: number;
  requireRemarks: boolean;
  allowFutureAttendance: boolean;
  lowAttendanceThreshold: number;
}

const DEFAULT_SETTINGS: AttendanceSettings = {
  workingDays: [1, 2, 3, 4, 5],
  startTime: '08:00',
  endTime: '14:00',
  lateThresholdMinutes: 15,
  halfDayThresholdMinutes: 120,
  autoLockAfterDays: 7,
  requireRemarks: false,
  allowFutureAttendance: false,
  lowAttendanceThreshold: 75,
};

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
];

export default function AttendanceSettingsPage() {
  const [settings, setSettings] = useState<AttendanceSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await attendanceApi.getSettings();
      if (response.success && response.data) {
        setSettings({ ...DEFAULT_SETTINGS, ...response.data });
      }
    } catch (err) {
      console.error('Failed to fetch attendance settings:', err);
      setError('Failed to load attendance settings');
      toast.error('Failed to load attendance settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await attendanceApi.updateSettings({
        workingDays: settings.workingDays,
        startTime: settings.startTime,
        endTime: settings.endTime,
        lateThresholdMinutes: settings.lateThresholdMinutes,
        halfDayThresholdMinutes: settings.halfDayThresholdMinutes,
        autoLockAfterDays: settings.autoLockAfterDays,
        requireRemarks: settings.requireRemarks,
        allowFutureAttendance: settings.allowFutureAttendance,
        lowAttendanceThreshold: settings.lowAttendanceThreshold,
      });
      if (response.success) {
        toast.success('Settings saved successfully');
      } else {
        toast.error('Failed to save settings');
      }
    } catch (err) {
      console.error('Failed to save attendance settings:', err);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const toggleWorkingDay = (day: number) => {
    setSettings((prev) => ({
      ...prev,
      workingDays: prev.workingDays.includes(day)
        ? prev.workingDays.filter((d) => d !== day)
        : [...prev.workingDays, day].sort((a, b) => a - b),
    }));
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96 mt-2" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-10 w-full max-w-md" />
          <Card className="border-0 shadow-elegant-md">
            <CardHeader>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-72" />
            </CardHeader>
            <CardContent className="space-y-6">
              <Skeleton className="h-12 w-full" />
              <div className="grid md:grid-cols-2 gap-6">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
              <div className="grid md:grid-cols-3 gap-6">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <p className="text-lg font-medium">{error}</p>
          <Button onClick={fetchSettings} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
          <Settings className="h-7 w-7 text-primary" />
          Attendance Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure attendance timings, rules, and alert thresholds
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="general" className="gap-2">
            <Clock className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="rules" className="gap-2">
            <ShieldCheck className="h-4 w-4" />
            Rules
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-2">
            <Bell className="h-4 w-4" />
            Alerts
          </TabsTrigger>
        </TabsList>

        {/* General Settings Tab */}
        <TabsContent value="general">
          <Card className="border-0 shadow-elegant-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                General Settings
              </CardTitle>
              <CardDescription>
                Configure working days, school timings, and threshold values
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Working Days */}
              <div className="space-y-3">
                <div>
                  <Label className="text-base font-medium flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    Working Days
                  </Label>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Select the days when attendance is expected
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {DAYS_OF_WEEK.map((day) => {
                    const isChecked = settings.workingDays.includes(day.value);
                    return (
                      <label
                        key={day.value}
                        className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                          isChecked
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-border bg-muted/30 hover:bg-muted/50'
                        }`}
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleWorkingDay(day.value)}
                        />
                        <span className="text-sm font-medium">{day.label}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  {settings.workingDays.length} day{settings.workingDays.length !== 1 ? 's' : ''}{' '}
                  selected
                </p>
              </div>

              {/* School Timings */}
              <div className="space-y-3">
                <div>
                  <Label className="text-base font-medium">School Timings</Label>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Set the start and end time for the school day
                  </p>
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Start Time</Label>
                    <Input
                      type="time"
                      value={settings.startTime}
                      onChange={(e) =>
                        setSettings((prev) => ({ ...prev, startTime: e.target.value }))
                      }
                    />
                    <p className="text-xs text-muted-foreground">When the school day begins</p>
                  </div>
                  <div className="space-y-2">
                    <Label>End Time</Label>
                    <Input
                      type="time"
                      value={settings.endTime}
                      onChange={(e) =>
                        setSettings((prev) => ({ ...prev, endTime: e.target.value }))
                      }
                    />
                    <p className="text-xs text-muted-foreground">When the school day ends</p>
                  </div>
                </div>
              </div>

              {/* Thresholds */}
              <div className="space-y-3">
                <div>
                  <Label className="text-base font-medium">Thresholds</Label>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Configure late arrival and half-day threshold values
                  </p>
                </div>
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label>Late Threshold</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={120}
                        value={settings.lateThresholdMinutes}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            lateThresholdMinutes: parseInt(e.target.value) || 0,
                          }))
                        }
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">minutes</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Minutes after start time to mark as late
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Half-Day Threshold</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={480}
                        value={settings.halfDayThresholdMinutes}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            halfDayThresholdMinutes: parseInt(e.target.value) || 0,
                          }))
                        }
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">minutes</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Minutes late to be considered half-day
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5" />
                      Auto-Lock After
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        max={30}
                        value={settings.autoLockAfterDays}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            autoLockAfterDays: parseInt(e.target.value) || 1,
                          }))
                        }
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">days</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Lock attendance editing after these many days
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rules Tab */}
        <TabsContent value="rules">
          <Card className="border-0 shadow-elegant-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Attendance Rules
              </CardTitle>
              <CardDescription>
                Configure rules for attendance marking and validation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Require Remarks */}
              <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center mt-0.5">
                    <MessageSquare className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-medium">Require Remarks for Absent/Late</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Teachers must provide a reason when marking a student as absent or late
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.requireRemarks}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({ ...prev, requireRemarks: checked }))
                  }
                />
              </div>

              {/* Allow Future Attendance */}
              <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center mt-0.5">
                    <CalendarOff className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium">Allow Future Attendance</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Allow teachers to mark attendance for future dates
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.allowFutureAttendance}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({ ...prev, allowFutureAttendance: checked }))
                  }
                />
              </div>

              {/* Low Attendance Threshold */}
              <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center mt-0.5">
                    <Gauge className="h-5 w-5 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Low Attendance Threshold</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Students below this attendance percentage will be flagged
                    </p>
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center gap-4">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={settings.lowAttendanceThreshold}
                          onChange={(e) => {
                            const value = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                            setSettings((prev) => ({
                              ...prev,
                              lowAttendanceThreshold: value,
                            }));
                          }}
                          className="w-24"
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                      {/* Visual bar */}
                      <div className="w-full max-w-sm">
                        <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              settings.lowAttendanceThreshold >= 75
                                ? 'bg-amber-500'
                                : settings.lowAttendanceThreshold >= 50
                                  ? 'bg-orange-500'
                                  : 'bg-red-500'
                            }`}
                            style={{ width: `${settings.lowAttendanceThreshold}%` }}
                          />
                        </div>
                        <div className="flex justify-between mt-1">
                          <span className="text-xs text-muted-foreground">0%</span>
                          <span className="text-xs text-muted-foreground">100%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts">
          <Card className="border-0 shadow-elegant-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Alert Settings
              </CardTitle>
              <CardDescription>
                Configure alerts and notifications for attendance events
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Low Attendance Alert */}
              <div className="p-4 rounded-lg border bg-muted/30">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center mt-0.5">
                    <Gauge className="h-5 w-5 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">Low Attendance Alert</p>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          settings.lowAttendanceThreshold > 0
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                        }`}
                      >
                        {settings.lowAttendanceThreshold > 0 ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Students whose attendance falls below the configured threshold will be flagged
                      for attention
                    </p>
                    <div className="mt-3 p-3 rounded-md bg-background border">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Current Threshold</span>
                        <span className="text-sm font-semibold">
                          {settings.lowAttendanceThreshold}%
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Students with attendance below {settings.lowAttendanceThreshold}% will
                        appear in low attendance reports and may trigger notifications to parents
                        and class teachers.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Auto-Lock Reminder */}
              <div className="p-4 rounded-lg border bg-muted/30">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center mt-0.5">
                    <Lock className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">Auto-Lock Reminder</p>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        Active
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Attendance records are automatically locked after the configured number of
                      days
                    </p>
                    <div className="mt-3 p-3 rounded-md bg-background border">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Lock Period</span>
                        <span className="text-sm font-semibold">
                          {settings.autoLockAfterDays} day
                          {settings.autoLockAfterDays !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Teachers will receive a reminder before the attendance lock period expires.
                        Once locked, attendance can only be modified by administrators.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Info Note */}
              <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-950/30 dark:border-blue-900/50">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                      Alert thresholds are shared with General and Rules settings
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                      To change the low attendance threshold or auto-lock period, update the values
                      in the General Settings or Rules tab. Changes will be reflected here
                      automatically.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

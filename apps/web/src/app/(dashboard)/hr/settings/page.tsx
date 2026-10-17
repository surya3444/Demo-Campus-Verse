'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Calendar,
  Clock,
  Loader2,
  AlertCircle,
  Plus,
  Pencil,
  Trash2,
  Save,
  IdCard,
  CalendarDays,
  Zap,
} from 'lucide-react';
import { hrApi } from '@/lib/api';
import { toast } from 'sonner';
import { RazorpayXTab } from './components/RazorpayXTab';

interface LeaveType {
  code: string;
  name: string;
  isPaid: boolean;
  defaultBalance: number;
  carryForward: boolean;
  maxCarryForward: number;
  requiresApproval: boolean;
}

interface NumberSequenceSettings {
  prefix: string;
  suffix?: string;
  startingNumber: number;
  currentNumber?: number;
  digitPadding: number;
  separator: string;
  includeYear: boolean;
  yearFormat: 'YY' | 'YYYY';
  resetYearly: boolean;
}

interface LeaveSettings {
  maxConsecutiveDays: number;
  minAdvanceNotice: number;
  allowNegativeBalance: boolean;
  halfDayAllowed: boolean;
  weekendsBetweenCountAsLeave: boolean;
  autoApproveTypes?: string[];
}

interface AttendanceSettings {
  allowFlexibleTiming: boolean;
  graceMinutes: number;
  maxOvertimeHours: number;
  requireCheckout: boolean;
  autoCheckoutTime?: string;
  trackLocation: boolean;
}

interface Shift {
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  isDefault: boolean;
}

interface HRSettings {
  employeeId: NumberSequenceSettings;
  leaveSettings: LeaveSettings;
  attendanceSettings: AttendanceSettings;
  leaveTypes: LeaveType[];
  shifts: Shift[];
}

const DEFAULT_SETTINGS: HRSettings = {
  employeeId: {
    prefix: 'EMP',
    suffix: '',
    startingNumber: 1,
    currentNumber: 0,
    digitPadding: 4,
    separator: '-',
    includeYear: true,
    yearFormat: 'YY',
    resetYearly: false,
  },
  leaveSettings: {
    maxConsecutiveDays: 30,
    minAdvanceNotice: 1,
    allowNegativeBalance: false,
    halfDayAllowed: true,
    weekendsBetweenCountAsLeave: false,
  },
  attendanceSettings: {
    allowFlexibleTiming: false,
    graceMinutes: 15,
    maxOvertimeHours: 4,
    requireCheckout: true,
    autoCheckoutTime: '18:00',
    trackLocation: false,
  },
  leaveTypes: [],
  shifts: [],
};

export default function HRSettingsPage() {
  const [settings, setSettings] = useState<HRSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Leave Type Dialog
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [editingLeaveType, setEditingLeaveType] = useState<LeaveType | null>(null);
  const [leaveForm, setLeaveForm] = useState<Partial<LeaveType>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingCode, setDeletingCode] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await hrApi.getSettings();
      if (response.success) {
        // Merge with defaults to ensure all fields exist
        const data = response.data;
        setSettings({
          employeeId: { ...DEFAULT_SETTINGS.employeeId, ...data.employeeId },
          leaveSettings: { ...DEFAULT_SETTINGS.leaveSettings, ...data.leaveSettings },
          attendanceSettings: {
            ...DEFAULT_SETTINGS.attendanceSettings,
            ...data.attendanceSettings,
          },
          leaveTypes: data.leaveTypes || [],
          shifts: data.shifts || [],
        });
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
      setError('Failed to load HR settings');
      toast.error('Failed to load HR settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSaveSettings = async (
    section: string,
    data: NumberSequenceSettings | LeaveSettings | AttendanceSettings
  ) => {
    try {
      setSaving(true);
      await hrApi.updateSettings({ [section]: data });
      toast.success('Settings updated successfully');
      fetchSettings();
    } catch (err) {
      console.error('Failed to update settings:', err);
      toast.error('Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenLeaveDialog = (leaveType?: LeaveType) => {
    if (leaveType) {
      setEditingLeaveType(leaveType);
      setLeaveForm(leaveType);
    } else {
      setEditingLeaveType(null);
      setLeaveForm({
        code: '',
        name: '',
        isPaid: true,
        defaultBalance: 12,
        carryForward: false,
        maxCarryForward: 0,
        requiresApproval: true,
      });
    }
    setLeaveDialogOpen(true);
  };

  const handleSaveLeaveType = async () => {
    if (!leaveForm.code || !leaveForm.name) {
      toast.error('Code and Name are required');
      return;
    }

    try {
      setSaving(true);
      if (editingLeaveType) {
        await hrApi.updateLeaveType(editingLeaveType.code, leaveForm);
        toast.success('Leave type updated successfully');
      } else {
        await hrApi.addLeaveType(
          leaveForm as {
            code: string;
            name: string;
            defaultBalance: number;
            carryForward: boolean;
          }
        );
        toast.success('Leave type added successfully');
      }
      setLeaveDialogOpen(false);
      setEditingLeaveType(null);
      setLeaveForm({});
      fetchSettings();
    } catch (err) {
      console.error('Failed to save leave type:', err);
      toast.error('Failed to save leave type');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLeaveType = async () => {
    if (!deletingCode) return;

    try {
      setSaving(true);
      await hrApi.deleteLeaveType(deletingCode);
      toast.success('Leave type deleted successfully');
      setDeleteDialogOpen(false);
      setDeletingCode(null);
      fetchSettings();
    } catch (err) {
      console.error('Failed to delete leave type:', err);
      toast.error('Failed to delete leave type');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading HR settings...</p>
        </div>
      </div>
    );
  }

  if (error || !settings) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <p className="text-lg font-medium">{error || 'Failed to load settings'}</p>
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
        <h1 className="text-3xl font-semibold tracking-tight">HR Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure HR module settings including leave types, attendance rules, and more
        </p>
      </div>

      <Tabs defaultValue="leave-types" className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="leave-types" className="gap-2">
            <CalendarDays className="h-4 w-4" />
            Leave Types
          </TabsTrigger>
          <TabsTrigger value="employee-id" className="gap-2">
            <IdCard className="h-4 w-4" />
            Employee ID
          </TabsTrigger>
          <TabsTrigger value="leave-settings" className="gap-2">
            <Calendar className="h-4 w-4" />
            Leave Settings
          </TabsTrigger>
          <TabsTrigger value="attendance" className="gap-2">
            <Clock className="h-4 w-4" />
            Attendance
          </TabsTrigger>
          <TabsTrigger value="payouts" className="gap-2">
            <Zap className="h-4 w-4" />
            Payouts
          </TabsTrigger>
        </TabsList>

        {/* Leave Types Tab */}
        <TabsContent value="leave-types">
          <Card className="border-0 shadow-elegant-md">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  Leave Types
                </CardTitle>
                <CardDescription>Configure available leave types for staff</CardDescription>
              </div>
              <Button onClick={() => handleOpenLeaveDialog()} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Leave Type
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {settings.leaveTypes.length === 0 ? (
                  <div className="text-center py-12">
                    <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">No leave types configured</p>
                    <Button variant="link" onClick={() => handleOpenLeaveDialog()} className="mt-2">
                      Add your first leave type
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {settings.leaveTypes.map((leaveType) => (
                      <div
                        key={leaveType.code}
                        className="flex items-center justify-between p-4 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                              leaveType.isPaid
                                ? 'bg-success/10 text-success'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            <Calendar className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{leaveType.name}</p>
                              <Badge variant="outline" className="font-mono text-xs">
                                {leaveType.code}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                              <span>{leaveType.defaultBalance} days/year</span>
                              <span>|</span>
                              <span>{leaveType.isPaid ? 'Paid' : 'Unpaid'}</span>
                              {leaveType.carryForward && (
                                <>
                                  <span>|</span>
                                  <span>Carry forward: {leaveType.maxCarryForward} days</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenLeaveDialog(leaveType)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              setDeletingCode(leaveType.code);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Employee ID Tab */}
        <TabsContent value="employee-id">
          <Card className="border-0 shadow-elegant-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IdCard className="h-5 w-5 text-primary" />
                Employee ID Format
              </CardTitle>
              <CardDescription>Configure how employee IDs are generated</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Prefix</Label>
                  <Input
                    value={settings.employeeId.prefix}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        employeeId: { ...settings.employeeId, prefix: e.target.value },
                      })
                    }
                    placeholder="e.g., EMP"
                  />
                  <p className="text-xs text-muted-foreground">
                    Text that appears before the number
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Separator</Label>
                  <Select
                    value={settings.employeeId.separator || 'none'}
                    onValueChange={(v) =>
                      setSettings({
                        ...settings,
                        employeeId: { ...settings.employeeId, separator: v === 'none' ? '' : v },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="-">Dash (-)</SelectItem>
                      <SelectItem value="/">Slash (/)</SelectItem>
                      <SelectItem value=".">Dot (.)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Starting Number</Label>
                  <Input
                    type="number"
                    value={settings.employeeId.startingNumber}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        employeeId: {
                          ...settings.employeeId,
                          startingNumber: parseInt(e.target.value) || 1,
                        },
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Digit Padding</Label>
                  <Select
                    value={settings.employeeId.digitPadding.toString()}
                    onValueChange={(v) =>
                      setSettings({
                        ...settings,
                        employeeId: { ...settings.employeeId, digitPadding: parseInt(v) },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 digits (001)</SelectItem>
                      <SelectItem value="4">4 digits (0001)</SelectItem>
                      <SelectItem value="5">5 digits (00001)</SelectItem>
                      <SelectItem value="6">6 digits (000001)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Include Year</Label>
                      <p className="text-xs text-muted-foreground">Add year to employee ID</p>
                    </div>
                    <Switch
                      checked={settings.employeeId.includeYear}
                      onCheckedChange={(checked) =>
                        setSettings({
                          ...settings,
                          employeeId: { ...settings.employeeId, includeYear: checked },
                        })
                      }
                    />
                  </div>
                </div>

                {settings.employeeId.includeYear && (
                  <div className="space-y-2">
                    <Label>Year Format</Label>
                    <Select
                      value={settings.employeeId.yearFormat}
                      onValueChange={(v) =>
                        setSettings({
                          ...settings,
                          employeeId: {
                            ...settings.employeeId,
                            yearFormat: v as 'YY' | 'YYYY',
                          },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="YY">2 digits (24)</SelectItem>
                        <SelectItem value="YYYY">4 digits (2024)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Preview */}
              <div className="mt-6 p-4 rounded-lg bg-muted/50">
                <Label className="text-muted-foreground">Preview</Label>
                <p className="text-2xl font-mono mt-2">
                  {settings.employeeId.prefix}
                  {settings.employeeId.separator}
                  {settings.employeeId.includeYear &&
                    (settings.employeeId.yearFormat === 'YYYY'
                      ? new Date().getFullYear()
                      : new Date().getFullYear().toString().slice(-2))}
                  {settings.employeeId.includeYear && settings.employeeId.separator}
                  {(settings.employeeId.currentNumber || settings.employeeId.startingNumber)
                    .toString()
                    .padStart(settings.employeeId.digitPadding, '0')}
                </p>
              </div>

              <div className="flex justify-end mt-6">
                <Button
                  onClick={() => handleSaveSettings('employeeId', settings.employeeId)}
                  disabled={saving}
                >
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

        {/* Leave Settings Tab */}
        <TabsContent value="leave-settings">
          <Card className="border-0 shadow-elegant-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Leave Settings
              </CardTitle>
              <CardDescription>Configure leave application rules</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Max Consecutive Days</Label>
                  <Input
                    type="number"
                    value={settings.leaveSettings.maxConsecutiveDays}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        leaveSettings: {
                          ...settings.leaveSettings,
                          maxConsecutiveDays: parseInt(e.target.value) || 0,
                        },
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum consecutive days allowed in a single leave request
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Min Advance Notice (Days)</Label>
                  <Input
                    type="number"
                    value={settings.leaveSettings.minAdvanceNotice}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        leaveSettings: {
                          ...settings.leaveSettings,
                          minAdvanceNotice: parseInt(e.target.value) || 0,
                        },
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum days in advance for leave application
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Allow Negative Balance</Label>
                      <p className="text-xs text-muted-foreground">
                        Allow leave even if balance is insufficient
                      </p>
                    </div>
                    <Switch
                      checked={settings.leaveSettings.allowNegativeBalance}
                      onCheckedChange={(checked) =>
                        setSettings({
                          ...settings,
                          leaveSettings: {
                            ...settings.leaveSettings,
                            allowNegativeBalance: checked,
                          },
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Half Day Allowed</Label>
                      <p className="text-xs text-muted-foreground">Allow half-day leave requests</p>
                    </div>
                    <Switch
                      checked={settings.leaveSettings.halfDayAllowed}
                      onCheckedChange={(checked) =>
                        setSettings({
                          ...settings,
                          leaveSettings: { ...settings.leaveSettings, halfDayAllowed: checked },
                        })
                      }
                    />
                  </div>
                </div>

                <div className="md:col-span-2 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Count Weekends Between Leave Days</Label>
                      <p className="text-xs text-muted-foreground">
                        Include weekends when counting leave days
                      </p>
                    </div>
                    <Switch
                      checked={settings.leaveSettings.weekendsBetweenCountAsLeave}
                      onCheckedChange={(checked) =>
                        setSettings({
                          ...settings,
                          leaveSettings: {
                            ...settings.leaveSettings,
                            weekendsBetweenCountAsLeave: checked,
                          },
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end mt-6">
                <Button
                  onClick={() => handleSaveSettings('leaveSettings', settings.leaveSettings)}
                  disabled={saving}
                >
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

        {/* Attendance Tab */}
        <TabsContent value="attendance">
          <Card className="border-0 shadow-elegant-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Attendance Settings
              </CardTitle>
              <CardDescription>Configure attendance tracking rules</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Grace Minutes</Label>
                  <Input
                    type="number"
                    value={settings.attendanceSettings.graceMinutes}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        attendanceSettings: {
                          ...settings.attendanceSettings,
                          graceMinutes: parseInt(e.target.value) || 0,
                        },
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Minutes after shift start before marking late
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Max Overtime Hours</Label>
                  <Input
                    type="number"
                    value={settings.attendanceSettings.maxOvertimeHours}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        attendanceSettings: {
                          ...settings.attendanceSettings,
                          maxOvertimeHours: parseInt(e.target.value) || 0,
                        },
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">Maximum allowed overtime per day</p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Allow Flexible Timing</Label>
                      <p className="text-xs text-muted-foreground">
                        Allow staff to check in anytime
                      </p>
                    </div>
                    <Switch
                      checked={settings.attendanceSettings.allowFlexibleTiming}
                      onCheckedChange={(checked) =>
                        setSettings({
                          ...settings,
                          attendanceSettings: {
                            ...settings.attendanceSettings,
                            allowFlexibleTiming: checked,
                          },
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Require Checkout</Label>
                      <p className="text-xs text-muted-foreground">
                        Mandate checkout for attendance
                      </p>
                    </div>
                    <Switch
                      checked={settings.attendanceSettings.requireCheckout}
                      onCheckedChange={(checked) =>
                        setSettings({
                          ...settings,
                          attendanceSettings: {
                            ...settings.attendanceSettings,
                            requireCheckout: checked,
                          },
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Auto Checkout Time</Label>
                  <Input
                    type="time"
                    value={settings.attendanceSettings.autoCheckoutTime || '18:00'}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        attendanceSettings: {
                          ...settings.attendanceSettings,
                          autoCheckoutTime: e.target.value,
                        },
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Time to auto-checkout if not checked out
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Track Location</Label>
                      <p className="text-xs text-muted-foreground">
                        Record location during check-in/out
                      </p>
                    </div>
                    <Switch
                      checked={settings.attendanceSettings.trackLocation}
                      onCheckedChange={(checked) =>
                        setSettings({
                          ...settings,
                          attendanceSettings: {
                            ...settings.attendanceSettings,
                            trackLocation: checked,
                          },
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end mt-6">
                <Button
                  onClick={() =>
                    handleSaveSettings('attendanceSettings', settings.attendanceSettings)
                  }
                  disabled={saving}
                >
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

        {/* Payouts (RazorpayX) Tab */}
        <TabsContent value="payouts">
          <RazorpayXTab />
        </TabsContent>
      </Tabs>

      {/* Leave Type Dialog */}
      <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLeaveType ? 'Edit Leave Type' : 'Add Leave Type'}</DialogTitle>
            <DialogDescription>
              {editingLeaveType
                ? 'Update the leave type configuration'
                : 'Create a new leave type for staff'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Code *</Label>
                <Input
                  value={leaveForm.code || ''}
                  onChange={(e) =>
                    setLeaveForm({ ...leaveForm, code: e.target.value.toUpperCase() })
                  }
                  placeholder="e.g., CL"
                  disabled={!!editingLeaveType}
                  maxLength={10}
                />
              </div>
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={leaveForm.name || ''}
                  onChange={(e) => setLeaveForm({ ...leaveForm, name: e.target.value })}
                  placeholder="e.g., Casual Leave"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Default Balance (Days/Year)</Label>
                <Input
                  type="number"
                  value={leaveForm.defaultBalance || 0}
                  onChange={(e) =>
                    setLeaveForm({ ...leaveForm, defaultBalance: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Paid Leave</Label>
                <Select
                  value={leaveForm.isPaid ? 'yes' : 'no'}
                  onValueChange={(v) => setLeaveForm({ ...leaveForm, isPaid: v === 'yes' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No (LOP)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Carry Forward</Label>
                <p className="text-xs text-muted-foreground">Allow unused leave to carry forward</p>
              </div>
              <Switch
                checked={leaveForm.carryForward || false}
                onCheckedChange={(checked) => setLeaveForm({ ...leaveForm, carryForward: checked })}
              />
            </div>

            {leaveForm.carryForward && (
              <div className="space-y-2">
                <Label>Max Carry Forward (Days)</Label>
                <Input
                  type="number"
                  value={leaveForm.maxCarryForward || 0}
                  onChange={(e) =>
                    setLeaveForm({
                      ...leaveForm,
                      maxCarryForward: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                <Label>Requires Approval</Label>
                <p className="text-xs text-muted-foreground">Requires manager approval</p>
              </div>
              <Switch
                checked={leaveForm.requiresApproval ?? true}
                onCheckedChange={(checked) =>
                  setLeaveForm({ ...leaveForm, requiresApproval: checked })
                }
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setLeaveDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveLeaveType} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingLeaveType ? 'Update' : 'Add'} Leave Type
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Leave Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this leave type? This action cannot be undone.
              Existing leave records using this type will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLeaveType}
              className="bg-destructive hover:bg-destructive/90"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

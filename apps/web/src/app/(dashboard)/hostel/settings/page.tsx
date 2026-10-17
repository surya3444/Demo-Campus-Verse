'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hostelApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Clock, UtensilsCrossed, ScrollText, Bell, Save, Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';

interface HostelSettings {
  visitingHours?: {
    enabled?: boolean;
    weekday?: { start: string; end: string };
    weekend?: { start: string; end: string };
  };
  messTimings?: {
    breakfast?: { start: string; end: string };
    lunch?: { start: string; end: string };
    snacks?: { start: string; end: string };
    dinner?: { start: string; end: string };
  };
  hostelRules?: string[];
  notifications?: {
    allocationNotify?: boolean;
    vacationNotify?: boolean;
    transferNotify?: boolean;
    feeReminderNotify?: boolean;
    gatePassNotify?: boolean;
  };
}

export default function HostelSettingsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['hostel-settings'],
    queryFn: () => hostelApi.getSettings(),
  });

  const [settings, setSettings] = useState<HostelSettings | null>(null);
  const [newRule, setNewRule] = useState('');

  useEffect(() => {
    if (data?.data && !settings) {
      setSettings(data.data);
    }
  }, [data, settings]);

  const mutation = useMutation({
    mutationFn: (updateData: HostelSettings) =>
      hostelApi.updateSettings(updateData as unknown as Record<string, unknown>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hostel-settings'] });
      toast.success('Settings saved successfully');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const currentSettings: HostelSettings = settings || data?.data || {};

  const updateSetting = (path: string, value: unknown) => {
    setSettings((prev) => {
      const current = prev || data?.data || {};
      const keys = path.split('.');
      const result = JSON.parse(JSON.stringify(current));

      if (keys.length === 1) {
        result[keys[0]] = value;
      } else if (keys.length === 2) {
        if (!result[keys[0]]) result[keys[0]] = {};
        result[keys[0]][keys[1]] = value;
      } else if (keys.length === 3) {
        if (!result[keys[0]]) result[keys[0]] = {};
        if (!result[keys[0]][keys[1]]) result[keys[0]][keys[1]] = {};
        result[keys[0]][keys[1]][keys[2]] = value;
      }

      return result;
    });
  };

  const addRule = () => {
    if (newRule.trim()) {
      const currentRules = currentSettings.hostelRules || [];
      updateSetting('hostelRules', [...currentRules, newRule.trim()]);
      setNewRule('');
    }
  };

  const removeRule = (index: number) => {
    const currentRules = currentSettings.hostelRules || [];
    updateSetting(
      'hostelRules',
      currentRules.filter((_, i) => i !== index)
    );
  };

  const handleSave = () => {
    if (settings) {
      mutation.mutate(settings);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Hostel Settings</h1>
          <p className="text-muted-foreground">
            Configure hostel rules, timings, and notification preferences
          </p>
        </div>
        <Button onClick={handleSave} disabled={mutation.isPending}>
          {mutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Changes
        </Button>
      </div>

      {/* Visiting Hours */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            <CardTitle>Visiting Hours</CardTitle>
          </div>
          <CardDescription>Set allowed visiting hours for hostel residents</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Visiting Hours</Label>
              <p className="text-sm text-muted-foreground">Enforce visiting time restrictions</p>
            </div>
            <Switch
              checked={currentSettings.visitingHours?.enabled ?? false}
              onCheckedChange={(checked) => updateSetting('visitingHours.enabled', checked)}
            />
          </div>
          <Separator />
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <Label className="font-medium">Weekday Hours</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Start Time</Label>
                  <Input
                    type="time"
                    value={currentSettings.visitingHours?.weekday?.start || '10:00'}
                    onChange={(e) => updateSetting('visitingHours.weekday.start', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">End Time</Label>
                  <Input
                    type="time"
                    value={currentSettings.visitingHours?.weekday?.end || '17:00'}
                    onChange={(e) => updateSetting('visitingHours.weekday.end', e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <Label className="font-medium">Weekend Hours</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Start Time</Label>
                  <Input
                    type="time"
                    value={currentSettings.visitingHours?.weekend?.start || '09:00'}
                    onChange={(e) => updateSetting('visitingHours.weekend.start', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">End Time</Label>
                  <Input
                    type="time"
                    value={currentSettings.visitingHours?.weekend?.end || '18:00'}
                    onChange={(e) => updateSetting('visitingHours.weekend.end', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mess Timings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5" />
            <CardTitle>Mess Timings</CardTitle>
          </div>
          <CardDescription>Configure meal timings for the hostel mess</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(['breakfast', 'lunch', 'snacks', 'dinner'] as const).map((meal) => (
            <div key={meal}>
              <div className="grid grid-cols-3 gap-4 items-center">
                <Label className="capitalize font-medium">{meal}</Label>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Start</Label>
                  <Input
                    type="time"
                    value={
                      currentSettings.messTimings?.[meal]?.start ||
                      (meal === 'breakfast'
                        ? '07:30'
                        : meal === 'lunch'
                          ? '12:30'
                          : meal === 'snacks'
                            ? '16:30'
                            : '19:30')
                    }
                    onChange={(e) => updateSetting(`messTimings.${meal}.start`, e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">End</Label>
                  <Input
                    type="time"
                    value={
                      currentSettings.messTimings?.[meal]?.end ||
                      (meal === 'breakfast'
                        ? '09:00'
                        : meal === 'lunch'
                          ? '14:00'
                          : meal === 'snacks'
                            ? '17:30'
                            : '21:00')
                    }
                    onChange={(e) => updateSetting(`messTimings.${meal}.end`, e.target.value)}
                  />
                </div>
              </div>
              {meal !== 'dinner' && <Separator className="mt-4" />}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Hostel Rules */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ScrollText className="h-5 w-5" />
            <CardTitle>Hostel Rules</CardTitle>
          </div>
          <CardDescription>Manage the list of hostel rules and regulations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Add a new rule..."
              value={newRule}
              onChange={(e) => setNewRule(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addRule();
                }
              }}
            />
            <Button onClick={addRule} disabled={!newRule.trim()} size="sm">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {(currentSettings.hostelRules || []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No rules added yet. Add rules above.
            </p>
          ) : (
            <div className="space-y-2">
              {(currentSettings.hostelRules || []).map((rule: string, index: number) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-sm font-medium text-muted-foreground min-w-[24px]">
                      {index + 1}.
                    </span>
                    <span className="text-sm">{rule}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500"
                    onClick={() => removeRule(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <CardTitle>Notification Settings</CardTitle>
          </div>
          <CardDescription>Configure when notifications are sent for hostel events</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Allocation Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Notify students when a bed is allocated
              </p>
            </div>
            <Switch
              checked={currentSettings.notifications?.allocationNotify ?? true}
              onCheckedChange={(checked) =>
                updateSetting('notifications.allocationNotify', checked)
              }
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Vacation Notifications</Label>
              <p className="text-sm text-muted-foreground">Notify when a bed is vacated</p>
            </div>
            <Switch
              checked={currentSettings.notifications?.vacationNotify ?? true}
              onCheckedChange={(checked) => updateSetting('notifications.vacationNotify', checked)}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Transfer Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Notify students when they are transferred to another room
              </p>
            </div>
            <Switch
              checked={currentSettings.notifications?.transferNotify ?? true}
              onCheckedChange={(checked) => updateSetting('notifications.transferNotify', checked)}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Fee Reminders</Label>
              <p className="text-sm text-muted-foreground">Send hostel fee payment reminders</p>
            </div>
            <Switch
              checked={currentSettings.notifications?.feeReminderNotify ?? false}
              onCheckedChange={(checked) =>
                updateSetting('notifications.feeReminderNotify', checked)
              }
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Gate Pass Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Notify when gate pass requests are submitted
              </p>
            </div>
            <Switch
              checked={currentSettings.notifications?.gatePassNotify ?? false}
              onCheckedChange={(checked) => updateSetting('notifications.gatePassNotify', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button at Bottom */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={mutation.isPending} size="lg">
          {mutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save All Changes
        </Button>
      </div>
    </div>
  );
}

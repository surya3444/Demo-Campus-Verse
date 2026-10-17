'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { healthApi } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Settings, Building2, Calendar, Syringe, Bell, Lock, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface HealthSettings {
  enableHealthModule?: boolean;
  enableStudentHealth?: boolean;
  enableStaffHealth?: boolean;
  infirmary?: {
    enabled?: boolean;
    name?: string;
    location?: string;
    contactNumber?: string;
    emergencyNumber?: string;
  };
  checkups?: {
    enableAnnualCheckups?: boolean;
    defaultCheckupMonth?: number;
    reminderDaysBefore?: number;
    includeVisionByDefault?: boolean;
    includeHearingByDefault?: boolean;
    includeDentalByDefault?: boolean;
    includeGrowthByDefault?: boolean;
  };
  vaccinations?: {
    enableVaccinationTracking?: boolean;
    sendReminders?: boolean;
    reminderDaysBefore?: number;
  };
  alerts?: {
    enableHealthAlerts?: boolean;
    alertOverdueVaccinations?: boolean;
    alertOverdueCheckups?: boolean;
    alertMedicationReminders?: boolean;
  };
  privacy?: {
    restrictHealthDataAccess?: boolean;
    requireConsentForDataSharing?: boolean;
  };
}

export default function HealthSettingsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['health-settings'],
    queryFn: () => healthApi.getSettings(),
  });

  const [settings, setSettings] = useState<HealthSettings | null>(null);

  useEffect(() => {
    if (data?.data && !settings) {
      setSettings(data.data);
    }
  }, [data, settings]);

  const mutation = useMutation({
    mutationFn: (updateData: HealthSettings) =>
      healthApi.updateSettings(updateData as Parameters<typeof healthApi.updateSettings>[0]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health-settings'] });
      toast.success('Settings saved successfully');
    },
    onError: () => {
      toast.error('Failed to save settings');
    },
  });

  // Use current settings or loaded data
  const currentSettings: HealthSettings = settings || data?.data || {};

  const updateSetting = (path: string, value: unknown) => {
    setSettings((prev) => {
      const current = prev || data?.data || {};
      const keys = path.split('.');
      const result = { ...current };

      if (keys.length === 1) {
        (result as Record<string, unknown>)[keys[0]] = value;
      } else if (keys.length === 2) {
        const [parent, child] = keys;
        (result as Record<string, Record<string, unknown>>)[parent] = {
          ...((result as Record<string, Record<string, unknown>>)[parent] || {}),
          [child]: value,
        };
      }

      return result;
    });
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
          <h1 className="text-2xl font-bold tracking-tight">Health Settings</h1>
          <p className="text-muted-foreground">Configure health module settings for your branch</p>
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

      {/* General Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            <CardTitle>General Settings</CardTitle>
          </div>
          <CardDescription>Enable or disable health tracking features</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Health Module</Label>
              <p className="text-sm text-muted-foreground">
                Master switch to enable/disable the entire health module
              </p>
            </div>
            <Switch
              checked={currentSettings.enableHealthModule ?? true}
              onCheckedChange={(checked) => updateSetting('enableHealthModule', checked)}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Student Health Tracking</Label>
              <p className="text-sm text-muted-foreground">Track health records for students</p>
            </div>
            <Switch
              checked={currentSettings.enableStudentHealth ?? true}
              onCheckedChange={(checked) => updateSetting('enableStudentHealth', checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Staff Health Tracking</Label>
              <p className="text-sm text-muted-foreground">
                Track health records for staff members
              </p>
            </div>
            <Switch
              checked={currentSettings.enableStaffHealth ?? true}
              onCheckedChange={(checked) => updateSetting('enableStaffHealth', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Infirmary Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            <CardTitle>Infirmary Settings</CardTitle>
          </div>
          <CardDescription>Configure your school infirmary/medical room details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Infirmary</Label>
              <p className="text-sm text-muted-foreground">Enable medical room visit tracking</p>
            </div>
            <Switch
              checked={currentSettings.infirmary?.enabled ?? true}
              onCheckedChange={(checked) => updateSetting('infirmary.enabled', checked)}
            />
          </div>
          <Separator />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="infirmary-name">Infirmary Name</Label>
              <Input
                id="infirmary-name"
                value={currentSettings.infirmary?.name || ''}
                onChange={(e) => updateSetting('infirmary.name', e.target.value)}
                placeholder="School Infirmary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="infirmary-location">Location</Label>
              <Input
                id="infirmary-location"
                value={currentSettings.infirmary?.location || ''}
                onChange={(e) => updateSetting('infirmary.location', e.target.value)}
                placeholder="Ground Floor, Building A"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="infirmary-phone">Contact Number</Label>
              <Input
                id="infirmary-phone"
                value={currentSettings.infirmary?.contactNumber || ''}
                onChange={(e) => updateSetting('infirmary.contactNumber', e.target.value)}
                placeholder="+91 98765 43210"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="infirmary-emergency">Emergency Number</Label>
              <Input
                id="infirmary-emergency"
                value={currentSettings.infirmary?.emergencyNumber || ''}
                onChange={(e) => updateSetting('infirmary.emergencyNumber', e.target.value)}
                placeholder="+91 98765 43211"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Checkup Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            <CardTitle>Checkup Settings</CardTitle>
          </div>
          <CardDescription>Configure health checkup and screening options</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Annual Checkups</Label>
              <p className="text-sm text-muted-foreground">
                Schedule annual health screenings automatically
              </p>
            </div>
            <Switch
              checked={currentSettings.checkups?.enableAnnualCheckups ?? true}
              onCheckedChange={(checked) => updateSetting('checkups.enableAnnualCheckups', checked)}
            />
          </div>
          <Separator />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Default Checkup Month</Label>
              <Select
                value={String(currentSettings.checkups?.defaultCheckupMonth || 7)}
                onValueChange={(value) =>
                  updateSetting('checkups.defaultCheckupMonth', parseInt(value))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    'January',
                    'February',
                    'March',
                    'April',
                    'May',
                    'June',
                    'July',
                    'August',
                    'September',
                    'October',
                    'November',
                    'December',
                  ].map((month, idx) => (
                    <SelectItem key={month} value={String(idx + 1)}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reminder-days">Reminder Days Before</Label>
              <Input
                id="reminder-days"
                type="number"
                value={currentSettings.checkups?.reminderDaysBefore || 7}
                onChange={(e) =>
                  updateSetting('checkups.reminderDaysBefore', parseInt(e.target.value))
                }
              />
            </div>
          </div>
          <Separator />
          <div className="space-y-3">
            <Label>Default Examinations</Label>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex items-center gap-2">
                <Switch
                  checked={currentSettings.checkups?.includeVisionByDefault ?? true}
                  onCheckedChange={(checked) =>
                    updateSetting('checkups.includeVisionByDefault', checked)
                  }
                />
                <Label className="font-normal">Vision Test</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={currentSettings.checkups?.includeHearingByDefault ?? true}
                  onCheckedChange={(checked) =>
                    updateSetting('checkups.includeHearingByDefault', checked)
                  }
                />
                <Label className="font-normal">Hearing Test</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={currentSettings.checkups?.includeDentalByDefault ?? true}
                  onCheckedChange={(checked) =>
                    updateSetting('checkups.includeDentalByDefault', checked)
                  }
                />
                <Label className="font-normal">Dental Checkup</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={currentSettings.checkups?.includeGrowthByDefault ?? true}
                  onCheckedChange={(checked) =>
                    updateSetting('checkups.includeGrowthByDefault', checked)
                  }
                />
                <Label className="font-normal">Growth Measurement</Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vaccination Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Syringe className="h-5 w-5" />
            <CardTitle>Vaccination Settings</CardTitle>
          </div>
          <CardDescription>Configure vaccination tracking and reminders</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Vaccination Tracking</Label>
              <p className="text-sm text-muted-foreground">
                Track immunization records and schedules
              </p>
            </div>
            <Switch
              checked={currentSettings.vaccinations?.enableVaccinationTracking ?? true}
              onCheckedChange={(checked) =>
                updateSetting('vaccinations.enableVaccinationTracking', checked)
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Send Reminders</Label>
              <p className="text-sm text-muted-foreground">
                Send vaccination due reminders to parents
              </p>
            </div>
            <Switch
              checked={currentSettings.vaccinations?.sendReminders ?? true}
              onCheckedChange={(checked) => updateSetting('vaccinations.sendReminders', checked)}
            />
          </div>
          <Separator />
          <div className="space-y-2">
            <Label htmlFor="vac-reminder-days">Reminder Days Before Due Date</Label>
            <Input
              id="vac-reminder-days"
              type="number"
              className="max-w-[200px]"
              value={currentSettings.vaccinations?.reminderDaysBefore || 14}
              onChange={(e) =>
                updateSetting('vaccinations.reminderDaysBefore', parseInt(e.target.value))
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Alert Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <CardTitle>Alert Settings</CardTitle>
          </div>
          <CardDescription>Configure health alerts and notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Health Alerts</Label>
              <p className="text-sm text-muted-foreground">Show alerts for health-related issues</p>
            </div>
            <Switch
              checked={currentSettings.alerts?.enableHealthAlerts ?? true}
              onCheckedChange={(checked) => updateSetting('alerts.enableHealthAlerts', checked)}
            />
          </div>
          <Separator />
          <div className="space-y-3">
            <Label>Alert Types</Label>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Switch
                  checked={currentSettings.alerts?.alertOverdueVaccinations ?? true}
                  onCheckedChange={(checked) =>
                    updateSetting('alerts.alertOverdueVaccinations', checked)
                  }
                />
                <Label className="font-normal">Overdue Vaccinations</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={currentSettings.alerts?.alertOverdueCheckups ?? true}
                  onCheckedChange={(checked) =>
                    updateSetting('alerts.alertOverdueCheckups', checked)
                  }
                />
                <Label className="font-normal">Overdue Checkups</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={currentSettings.alerts?.alertMedicationReminders ?? false}
                  onCheckedChange={(checked) =>
                    updateSetting('alerts.alertMedicationReminders', checked)
                  }
                />
                <Label className="font-normal">Medication Reminders</Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Privacy Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            <CardTitle>Privacy Settings</CardTitle>
          </div>
          <CardDescription>Configure data access and privacy controls</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Restrict Health Data Access</Label>
              <p className="text-sm text-muted-foreground">
                Only authorized roles can view detailed health information
              </p>
            </div>
            <Switch
              checked={currentSettings.privacy?.restrictHealthDataAccess ?? true}
              onCheckedChange={(checked) =>
                updateSetting('privacy.restrictHealthDataAccess', checked)
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Require Consent for Data Sharing</Label>
              <p className="text-sm text-muted-foreground">
                Require parent/guardian consent before sharing health data
              </p>
            </div>
            <Switch
              checked={currentSettings.privacy?.requireConsentForDataSharing ?? true}
              onCheckedChange={(checked) =>
                updateSetting('privacy.requireConsentForDataSharing', checked)
              }
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

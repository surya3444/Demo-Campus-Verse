'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Settings, ArrowRight, ArrowLeft, Loader2, SkipForward } from 'lucide-react';
import { TIMEZONES, DATE_FORMATS, CURRENCIES, FISCAL_YEARS } from './constants';

interface SettingsData {
  timezone: string;
  dateFormat: string;
  currency: string;
  fiscalYearStart: string;
}

interface SettingsStepProps {
  settings: SettingsData;
  setSettings: (settings: SettingsData) => void;
  saving: boolean;
  onSave: () => void;
  onSkip: () => void;
  goBack: () => void;
}

export function SettingsStep({
  settings,
  setSettings,
  saving,
  onSave,
  onSkip,
  goBack,
}: SettingsStepProps) {
  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          General Settings
        </CardTitle>
        <CardDescription>
          Configure timezone, date format, and other preferences. You can change these later.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Timezone</Label>
            <Select
              value={settings.timezone}
              onValueChange={(value) => setSettings({ ...settings, timezone: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Date Format</Label>
            <Select
              value={settings.dateFormat}
              onValueChange={(value) => setSettings({ ...settings, dateFormat: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select date format" />
              </SelectTrigger>
              <SelectContent>
                {DATE_FORMATS.map((df) => (
                  <SelectItem key={df.value} value={df.value}>
                    {df.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Currency</Label>
            <Select
              value={settings.currency}
              onValueChange={(value) => setSettings({ ...settings, currency: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Fiscal Year</Label>
            <Select
              value={settings.fiscalYearStart}
              onValueChange={(value) => setSettings({ ...settings, fiscalYearStart: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select fiscal year" />
              </SelectTrigger>
              <SelectContent>
                {FISCAL_YEARS.map((fy) => (
                  <SelectItem key={fy.value} value={fy.value}>
                    {fy.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="outline" onClick={goBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onSkip} className="gap-2 text-muted-foreground">
              <SkipForward className="h-4 w-4" /> Skip
            </Button>
            <Button onClick={onSave} disabled={saving} className="gap-2">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              Save & Continue
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { CalendarDays, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { academicApi } from '@/lib/api';

interface AcademicSessionStepProps {
  fiscalYearStart: string;
  saving: boolean;
  setSaving: (saving: boolean) => void;
  onSave: (batchId: string, batchName: string) => void;
  goBack: () => void;
}

function computeSessionDefaults(fiscalYearStart: string) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const [startMonth, startDay] = fiscalYearStart.split('-').map(Number);

  // Determine the start year: if we haven't reached the fiscal start month yet, use previous year
  const fiscalStart = new Date(currentYear, startMonth - 1, startDay);
  const startYear = now < fiscalStart ? currentYear - 1 : currentYear;

  const startDate = new Date(startYear, startMonth - 1, startDay);

  // End date: day before start of next fiscal year
  const endDate = new Date(startYear + 1, startMonth - 1, startDay);
  endDate.setDate(endDate.getDate() - 1);

  // Session name
  let name: string;
  let code: string;
  if (startMonth === 1 && startDay === 1) {
    // Jan-Dec: just the year
    name = `${startYear}`;
    code = `${startYear}`;
  } else {
    // Cross-year: e.g. "2025-26"
    const shortEnd = String(startYear + 1).slice(-2);
    name = `${startYear}-${shortEnd}`;
    code = `${startYear}-${shortEnd}`;
  }

  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  return {
    name,
    code,
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
  };
}

export function AcademicSessionStep({
  fiscalYearStart,
  saving,
  setSaving,
  onSave,
  goBack,
}: AcademicSessionStepProps) {
  const defaults = computeSessionDefaults(fiscalYearStart);
  const [sessionData, setSessionData] = useState(defaults);

  useEffect(() => {
    setSessionData(computeSessionDefaults(fiscalYearStart));
  }, [fiscalYearStart]);

  const handleSave = async () => {
    if (!sessionData.name || !sessionData.code || !sessionData.startDate || !sessionData.endDate) {
      toast.error('Please fill in all fields');
      return;
    }

    if (sessionData.startDate >= sessionData.endDate) {
      toast.error('End date must be after start date');
      return;
    }

    setSaving(true);
    try {
      // Create the academic batch
      const createRes = await academicApi.createAcademicBatch({
        name: sessionData.name,
        code: sessionData.code,
        startDate: sessionData.startDate,
        endDate: sessionData.endDate,
      });

      if (!createRes.success) {
        toast.error('Failed to create academic session');
        return;
      }

      const batchId = createRes.data._id;

      // Set it as current batch
      await academicApi.setCurrentBatch(batchId);

      toast.success('Academic session created!');
      onSave(batchId, sessionData.name);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message || 'Failed to create academic session');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          Set Up Academic Session
        </CardTitle>
        <CardDescription>
          Create your current academic year/session. This is required for enrolling students,
          tracking attendance, and assigning fees.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="session-name">
              Session Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="session-name"
              placeholder="e.g., 2025-26"
              value={sessionData.name}
              onChange={(e) => setSessionData({ ...sessionData, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="session-code">
              Code <span className="text-destructive">*</span>
            </Label>
            <Input
              id="session-code"
              placeholder="e.g., 2025-26"
              value={sessionData.code}
              onChange={(e) => setSessionData({ ...sessionData, code: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Auto-generated from your fiscal year setting.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="session-start">
              Start Date <span className="text-destructive">*</span>
            </Label>
            <DatePicker
              id="session-start"
              value={sessionData.startDate}
              onChange={(iso) => setSessionData({ ...sessionData, startDate: iso })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="session-end">
              End Date <span className="text-destructive">*</span>
            </Label>
            <DatePicker
              id="session-end"
              value={sessionData.endDate}
              onChange={(iso) => setSessionData({ ...sessionData, endDate: iso })}
            />
          </div>
        </div>

        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-sm text-muted-foreground">
            This session will be set as the{' '}
            <span className="font-medium text-foreground">current active session</span>. All new
            enrollments and operations will default to this session.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="outline" onClick={goBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
            Create Session & Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

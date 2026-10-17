'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, Rocket, Loader2, PartyPopper } from 'lucide-react';

interface CompleteStepProps {
  branchName: string;
  academicBatchName: string | null;
  classCount: number;
  invitedCount: number;
  moduleCount: number;
  saving: boolean;
  onComplete: () => void;
}

export function CompleteStep({
  branchName,
  academicBatchName,
  classCount,
  invitedCount,
  moduleCount,
  saving,
  onComplete,
}: CompleteStepProps) {
  return (
    <Card className="max-w-2xl mx-auto">
      <CardContent className="pt-10 pb-10 text-center space-y-6">
        <div className="h-16 w-16 rounded-2xl bg-success/10 flex items-center justify-center mx-auto">
          <PartyPopper className="h-8 w-8 text-success" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold font-display">You&apos;re All Set!</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Your institution is ready to go. You can always adjust settings, add more branches, and
            configure modules from the Organization Settings page.
          </p>
        </div>

        <div className="max-w-md mx-auto text-left space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-success/5 border border-success/20">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span className="text-sm font-medium">Branch</span>
              </div>
              <p className="text-xs text-muted-foreground">{branchName || 'Your branch'}</p>
            </div>
            <div className="p-3 rounded-lg bg-success/5 border border-success/20">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span className="text-sm font-medium">Session</span>
              </div>
              <p className="text-xs text-muted-foreground">{academicBatchName || 'Skipped'}</p>
            </div>
            <div className="p-3 rounded-lg bg-success/5 border border-success/20">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span className="text-sm font-medium">Classes</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {classCount > 0 ? `${classCount} classes` : 'None yet'}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-success/5 border border-success/20">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span className="text-sm font-medium">Team Invited</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {invitedCount > 0
                  ? `${invitedCount} member${invitedCount > 1 ? 's' : ''}`
                  : 'Skipped'}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-success/5 border border-success/20">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span className="text-sm font-medium">Modules</span>
              </div>
              <p className="text-xs text-muted-foreground">{moduleCount} modules active</p>
            </div>
          </div>
        </div>

        <Button size="lg" onClick={onComplete} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
          Go to Dashboard
        </Button>
      </CardContent>
    </Card>
  );
}

'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Rocket,
  Building2,
  CalendarDays,
  GraduationCap,
  Users,
  Puzzle,
  ArrowRight,
} from 'lucide-react';

interface WelcomeStepProps {
  goNext: () => void;
}

export function WelcomeStep({ goNext }: WelcomeStepProps) {
  return (
    <Card className="max-w-2xl mx-auto">
      <CardContent className="pt-10 pb-10 text-center space-y-6">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <Rocket className="h-8 w-8 text-primary" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold font-display">Welcome to CampusVerse!</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Let&apos;s set up your institution in just a few steps. You&apos;ll create your first
            branch, set up your academic session & classes, choose modules, and configure settings.
          </p>
        </div>
        <div className="grid grid-cols-5 gap-3 max-w-lg mx-auto text-center">
          <div className="p-3 rounded-lg bg-muted/50">
            <Building2 className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-xs font-medium">Branch</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <CalendarDays className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-xs font-medium">Session</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <GraduationCap className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-xs font-medium">Classes</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <Users className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-xs font-medium">Team</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <Puzzle className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-xs font-medium">Modules</p>
          </div>
        </div>
        <Button size="lg" onClick={goNext} className="gap-2">
          Let&apos;s Get Started <ArrowRight className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

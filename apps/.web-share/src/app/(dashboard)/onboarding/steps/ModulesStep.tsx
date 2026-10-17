'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Puzzle, ArrowRight, ArrowLeft, Loader2, SkipForward } from 'lucide-react';
import { MODULES, CORE_MODULES } from '@campus-verse/shared/constants';

interface ModulesStepProps {
  selectedModules: string[];
  onToggleModule: (code: string) => void;
  subscriptionFeatures: string[];
  saving: boolean;
  onSave: () => void;
  onSkip: () => void;
  goBack: () => void;
}

export function ModulesStep({
  selectedModules,
  onToggleModule,
  subscriptionFeatures,
  saving,
  onSave,
  onSkip,
  goBack,
}: ModulesStepProps) {
  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Puzzle className="h-5 w-5 text-primary" />
          Choose Your Modules
        </CardTitle>
        <CardDescription>
          These modules are included in your plan. Uncheck any you don&apos;t need right now — you
          can re-enable them later from Settings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <div className="grid grid-cols-2 gap-3">
            {subscriptionFeatures
              .filter((code: string) => code in MODULES)
              .map((moduleCode: string) => {
                const modInfo = MODULES[moduleCode as keyof typeof MODULES];
                const isCoreModule = CORE_MODULES.includes(
                  moduleCode as (typeof CORE_MODULES)[number]
                );
                const isEnabled = selectedModules.includes(moduleCode);
                return (
                  <div
                    key={moduleCode}
                    onClick={() => !isCoreModule && onToggleModule(moduleCode)}
                    className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                      isCoreModule
                        ? 'bg-success/5 border border-success/20'
                        : isEnabled
                          ? 'bg-primary/5 border border-primary/20 cursor-pointer'
                          : 'bg-muted/50 border border-transparent hover:border-muted-foreground/20 cursor-pointer'
                    }`}
                  >
                    <Checkbox
                      checked={isCoreModule || isEnabled}
                      disabled={isCoreModule}
                      onCheckedChange={() => !isCoreModule && onToggleModule(moduleCode)}
                      className="mt-1"
                    />
                    <div>
                      <p className="font-medium text-sm">{modInfo.name}</p>
                      <p className="text-xs text-muted-foreground">{modInfo.description}</p>
                    </div>
                  </div>
                );
              })}
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

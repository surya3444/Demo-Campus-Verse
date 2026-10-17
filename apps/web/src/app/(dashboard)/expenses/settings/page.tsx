'use client';

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { expenseApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { getErrorMessage } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Settings, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface SettingsFormData {
  requireApproval: boolean;
  autoApproveBelow: number;
  defaultCurrency: string;
}

export default function ExpenseSettingsPage() {
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const canEdit = hasPermission('expense.settings', 'edit');

  const { register, handleSubmit, setValue, watch, reset } = useForm<SettingsFormData>({
    defaultValues: { requireApproval: true, autoApproveBelow: 0, defaultCurrency: 'INR' },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['expense-settings'],
    queryFn: () => expenseApi.getSettings(),
  });

  useEffect(() => {
    if (data?.data) {
      reset({
        requireApproval: data.data.requireApproval ?? true,
        autoApproveBelow: data.data.autoApproveBelow || 0,
        defaultCurrency: data.data.defaultCurrency || 'INR',
      });
    }
  }, [data, reset]);

  const saveMutation = useMutation({
    mutationFn: (formData: SettingsFormData) =>
      expenseApi.updateSettings({
        ...formData,
        autoApproveBelow: Number(formData.autoApproveBelow),
      }),
    onSuccess: () => {
      toast.success('Settings saved');
      queryClient.invalidateQueries({ queryKey: ['expense-settings'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (isLoading)
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Expense Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure expense module behavior</p>
      </div>

      <form onSubmit={handleSubmit((data) => saveMutation.mutate(data))}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" /> General Settings
            </CardTitle>
            <CardDescription>Configure approval workflows and currency</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div>
                <p className="font-medium text-sm">Require Approval</p>
                <p className="text-xs text-muted-foreground">
                  Expense requests need approval before payment
                </p>
              </div>
              <Switch
                checked={watch('requireApproval')}
                onCheckedChange={(v) => setValue('requireApproval', v)}
                disabled={!canEdit}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Auto-approve Below (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  {...register('autoApproveBelow')}
                  disabled={!canEdit}
                />
                <p className="text-xs text-muted-foreground">Set to 0 to disable auto-approval</p>
              </div>
              <div className="space-y-2">
                <Label>Default Currency</Label>
                <Input {...register('defaultCurrency')} disabled={!canEdit} />
              </div>
            </div>

            {canEdit && (
              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Settings
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </form>
    </div>
  );
}

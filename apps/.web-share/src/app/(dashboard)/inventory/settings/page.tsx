'use client';

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { inventoryApi } from '@/lib/api';
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
  autoGenerateAssetCode: boolean;
  assetCodePrefix: string;
  requireApprovalForProcurement: boolean;
  defaultUnit: string;
}

export default function InventorySettingsPage() {
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const canEdit = hasPermission('inventory.settings', 'edit');

  const { register, handleSubmit, setValue, watch, reset } = useForm<SettingsFormData>({
    defaultValues: {
      autoGenerateAssetCode: true,
      assetCodePrefix: 'AST',
      requireApprovalForProcurement: true,
      defaultUnit: 'piece',
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['inventory-settings'],
    queryFn: () => inventoryApi.getSettings(),
  });

  useEffect(() => {
    if (data?.data) {
      reset({
        autoGenerateAssetCode: data.data.autoGenerateAssetCode ?? true,
        assetCodePrefix: data.data.assetCodePrefix || 'AST',
        requireApprovalForProcurement: data.data.requireApprovalForProcurement ?? true,
        defaultUnit: data.data.defaultUnit || 'piece',
      });
    }
  }, [data, reset]);

  const saveMutation = useMutation({
    mutationFn: (formData: SettingsFormData) => inventoryApi.updateSettings({ ...formData }),
    onSuccess: () => {
      toast.success('Settings saved');
      queryClient.invalidateQueries({ queryKey: ['inventory-settings'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Inventory Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure inventory module behavior</p>
      </div>

      <form onSubmit={handleSubmit((data) => saveMutation.mutate(data))}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" /> General Settings
            </CardTitle>
            <CardDescription>
              Configure asset code generation and procurement workflows
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div>
                <p className="font-medium text-sm">Auto-generate Asset Codes</p>
                <p className="text-xs text-muted-foreground">
                  Automatically assign codes to new assets
                </p>
              </div>
              <Switch
                checked={watch('autoGenerateAssetCode')}
                onCheckedChange={(v) => setValue('autoGenerateAssetCode', v)}
                disabled={!canEdit}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Asset Code Prefix</Label>
                <Input {...register('assetCodePrefix')} disabled={!canEdit} />
              </div>
              <div className="space-y-2">
                <Label>Default Unit</Label>
                <Input {...register('defaultUnit')} disabled={!canEdit} />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div>
                <p className="font-medium text-sm">Require Approval for Procurement</p>
                <p className="text-xs text-muted-foreground">
                  Purchase orders need admin approval before proceeding
                </p>
              </div>
              <Switch
                checked={watch('requireApprovalForProcurement')}
                onCheckedChange={(v) => setValue('requireApprovalForProcurement', v)}
                disabled={!canEdit}
              />
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

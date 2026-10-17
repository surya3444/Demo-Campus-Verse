'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { visitorApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { useEffect } from 'react';

interface SettingsFormData {
  autoGeneratePassCode: boolean;
  passCodePrefix: string;
  passValidityHours: number;
  requirePhotoForCheckIn: boolean;
  requireIdForCheckIn: boolean;
  allowPreRegistration: boolean;
}

export default function VisitorSettingsPage() {
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const canEdit = hasPermission('visitor.settings', 'edit');

  const { data, isLoading } = useQuery({
    queryKey: ['visitor-settings'],
    queryFn: () => visitorApi.getSettings(),
  });

  const { register, handleSubmit, reset, setValue, watch } = useForm<SettingsFormData>();

  useEffect(() => {
    if (data?.data) {
      reset({
        autoGeneratePassCode: data.data.autoGeneratePassCode ?? true,
        passCodePrefix: data.data.passCodePrefix ?? 'VP',
        passValidityHours: data.data.passValidityHours ?? 8,
        requirePhotoForCheckIn: data.data.requirePhotoForCheckIn ?? false,
        requireIdForCheckIn: data.data.requireIdForCheckIn ?? false,
        allowPreRegistration: data.data.allowPreRegistration ?? true,
      });
    }
  }, [data, reset]);

  const updateMutation = useMutation({
    mutationFn: (formData: SettingsFormData) =>
      visitorApi.updateSettings({
        ...formData,
        passValidityHours: Number(formData.passValidityHours),
      }),
    onSuccess: () => {
      toast.success('Settings updated successfully');
      queryClient.invalidateQueries({ queryKey: ['visitor-settings'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Visitor Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure visitor management preferences for this branch
        </p>
      </div>

      <form onSubmit={handleSubmit((data) => updateMutation.mutate(data))} className="space-y-6">
        {/* Pass Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pass Configuration</CardTitle>
            <CardDescription>Configure how visitor passes are generated</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label>Auto-Generate Pass Code</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically generate a pass code when checking in a visitor
                </p>
              </div>
              <Switch
                checked={watch('autoGeneratePassCode')}
                onCheckedChange={(checked) => setValue('autoGeneratePassCode', checked)}
                disabled={!canEdit}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="passCodePrefix">Pass Code Prefix</Label>
                <Input
                  id="passCodePrefix"
                  {...register('passCodePrefix')}
                  placeholder="VP"
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="passValidityHours">Pass Validity (Hours)</Label>
                <Input
                  id="passValidityHours"
                  type="number"
                  min={1}
                  max={72}
                  {...register('passValidityHours')}
                  disabled={!canEdit}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Check-In Requirements */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Check-In Requirements</CardTitle>
            <CardDescription>Set what information is required during check-in</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label>Require Photo</Label>
                <p className="text-sm text-muted-foreground">
                  Visitors must have a photo for check-in
                </p>
              </div>
              <Switch
                checked={watch('requirePhotoForCheckIn')}
                onCheckedChange={(checked) => setValue('requirePhotoForCheckIn', checked)}
                disabled={!canEdit}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Require ID Proof</Label>
                <p className="text-sm text-muted-foreground">
                  Visitors must provide ID details for check-in
                </p>
              </div>
              <Switch
                checked={watch('requireIdForCheckIn')}
                onCheckedChange={(checked) => setValue('requireIdForCheckIn', checked)}
                disabled={!canEdit}
              />
            </div>
          </CardContent>
        </Card>

        {/* Pre-Registration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pre-Registration</CardTitle>
            <CardDescription>Configure pre-registration settings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <Label>Allow Pre-Registration</Label>
                <p className="text-sm text-muted-foreground">
                  Enable pre-registration of expected visitors
                </p>
              </div>
              <Switch
                checked={watch('allowPreRegistration')}
                onCheckedChange={(checked) => setValue('allowPreRegistration', checked)}
                disabled={!canEdit}
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        {canEdit && (
          <div className="flex justify-end">
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Settings className="h-4 w-4 mr-2" />
              Save Settings
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}

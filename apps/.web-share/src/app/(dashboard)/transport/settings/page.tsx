'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { transportApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { getErrorMessage } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Settings, MapPin, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function TransportSettingsPage() {
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const canEdit = hasPermission('transport.settings', 'edit');

  const { data: settingsRes, isLoading } = useQuery({
    queryKey: ['transport-settings'],
    queryFn: () => transportApi.getSettings(),
  });

  const [googleMapsApiKey, setGoogleMapsApiKey] = useState('');
  const [defaultCurrency, setDefaultCurrency] = useState('INR');
  const [defaultFrequency, setDefaultFrequency] = useState<'monthly' | 'quarterly' | 'yearly'>(
    'monthly'
  );
  const [notifyOnEnrollment, setNotifyOnEnrollment] = useState(false);

  useEffect(() => {
    const s = settingsRes?.data;
    if (s) {
      setGoogleMapsApiKey(s.googleMapsApiKey || '');
      setDefaultCurrency(s.defaultCurrency || 'INR');
      setDefaultFrequency(s.defaultFrequency || 'monthly');
      setNotifyOnEnrollment(!!s.notifyOnEnrollment);
    }
  }, [settingsRes?.data]);

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => transportApi.updateSettings(payload),
    onSuccess: () => {
      toast.success('Transport settings saved');
      queryClient.invalidateQueries({ queryKey: ['transport-settings'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Settings className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Transport Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure Google Maps and pricing defaults
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" /> Google Maps
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="apiKey">Google Maps API Key</Label>
            <Input
              id="apiKey"
              value={googleMapsApiKey}
              onChange={(e) => setGoogleMapsApiKey(e.target.value)}
              placeholder="AIza…"
              type="password"
              autoComplete="off"
              disabled={!canEdit}
            />
            <p className="text-xs text-muted-foreground">
              Required for map-based route building. Enable Places, Maps JavaScript API, and
              Directions API on the key. The key is stored per branch and only loaded for
              authenticated users of this branch.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pricing Defaults</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="currency">Default Currency</Label>
              <Input
                id="currency"
                value={defaultCurrency}
                onChange={(e) => setDefaultCurrency(e.target.value.toUpperCase())}
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="frequency">Default Billing Frequency</Label>
              <Select
                value={defaultFrequency}
                onValueChange={(v) => setDefaultFrequency(v as 'monthly' | 'quarterly' | 'yearly')}
                disabled={!canEdit}
              >
                <SelectTrigger id="frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={notifyOnEnrollment}
              onChange={(e) => setNotifyOnEnrollment(e.target.checked)}
              className="rounded border-input"
              disabled={!canEdit}
            />
            Send SMS to parent on enrollment
          </label>
        </CardContent>
      </Card>

      {canEdit && (
        <div className="flex justify-end">
          <Button
            onClick={() =>
              updateMutation.mutate({
                googleMapsApiKey,
                defaultCurrency,
                defaultFrequency,
                notifyOnEnrollment,
              })
            }
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Settings
          </Button>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Settings,
  Mail,
  Clock,
  AlertTriangle,
  Loader2,
  IndianRupee,
  Calendar,
  Award,
} from 'lucide-react';
import { toast } from 'sonner';
import { organizationApi } from '@/lib/api';

interface EmailConfig {
  enabled: boolean;
  notifyOnRequest: boolean;
  notifyOnApproval: boolean;
  notifyOnRejection: boolean;
  notifyOnUndo: boolean;
  recipientRoles: string[];
  emailTemplateId?: string;
}

interface ApprovalSettings {
  _id: string;
  concessionEmailSettings: EmailConfig;
  feeCancellationEmailSettings: EmailConfig;
  leaveEmailSettings: EmailConfig;
  certificateEmailSettings: EmailConfig;
  autoApproveThreshold: {
    concession: number;
    feeCancellation: number;
  };
  escalationSettings: {
    enabled: boolean;
    escalateAfterDays: number;
    escalationRoles: string[];
  };
}

const AVAILABLE_ROLES = [
  { value: 'BRANCH_ADMIN', label: 'Branch Admin' },
  { value: 'FINANCE_HEAD', label: 'Finance Head' },
  { value: 'HR_ADMIN', label: 'HR Admin' },
  { value: 'HR_HEAD', label: 'HR Head' },
  { value: 'ADMIN_STAFF', label: 'Admin Staff' },
  { value: 'PRINCIPAL', label: 'Principal' },
  { value: 'ACCOUNTANT', label: 'Accountant' },
];

const ENTITY_TYPES = [
  { type: 'concession', label: 'Concession', icon: IndianRupee, color: 'text-green-600' },
  { type: 'feeCancellation', label: 'Fee Cancellation', icon: IndianRupee, color: 'text-red-600' },
  { type: 'leave', label: 'Leave', icon: Calendar, color: 'text-blue-600' },
  { type: 'certificate', label: 'Certificate', icon: Award, color: 'text-purple-600' },
] as const;

export default function ApprovalSettingsPage() {
  const [settings, setSettings] = useState<ApprovalSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('email');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await organizationApi.getApprovalSettings();
      setSettings(response.data);
    } catch (error) {
      console.error('Failed to load settings:', error);
      toast.error('Failed to load approval settings');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSettingsChange = async (
    entityType: 'concession' | 'feeCancellation' | 'leave' | 'certificate',
    field: keyof EmailConfig,
    value: boolean | string[]
  ) => {
    if (!settings) return;

    try {
      setSaving(true);
      await organizationApi.updateApprovalEmailSettings(entityType, {
        [field]: value,
      });

      // Update local state
      const fieldKey = `${entityType}EmailSettings` as keyof ApprovalSettings;
      setSettings({
        ...settings,
        [fieldKey]: {
          ...(settings[fieldKey] as EmailConfig),
          [field]: value,
        },
      });

      toast.success('Settings updated');
    } catch (error) {
      console.error('Failed to update settings:', error);
      toast.error('Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const handleAutoApproveChange = async (
    field: 'concession' | 'feeCancellation',
    value: number
  ) => {
    if (!settings) return;

    try {
      setSaving(true);
      await organizationApi.updateAutoApproveThreshold({ [field]: value });

      setSettings({
        ...settings,
        autoApproveThreshold: {
          ...settings.autoApproveThreshold,
          [field]: value,
        },
      });

      toast.success('Auto-approve threshold updated');
    } catch (error) {
      console.error('Failed to update threshold:', error);
      toast.error('Failed to update threshold');
    } finally {
      setSaving(false);
    }
  };

  const handleEscalationChange = async (
    field: keyof ApprovalSettings['escalationSettings'],
    value: boolean | number | string[]
  ) => {
    if (!settings) return;

    try {
      setSaving(true);
      await organizationApi.updateEscalationSettings({ [field]: value });

      setSettings({
        ...settings,
        escalationSettings: {
          ...settings.escalationSettings,
          [field]: value,
        },
      });

      toast.success('Escalation settings updated');
    } catch (error) {
      console.error('Failed to update escalation settings:', error);
      toast.error('Failed to update escalation settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
        <p>Failed to load settings. Please try again.</p>
        <Button onClick={loadSettings} variant="outline" className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approval Settings"
        description="Configure email notifications, auto-approval thresholds, and escalation rules"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="email" className="gap-2">
            <Mail className="h-4 w-4" />
            Email Notifications
          </TabsTrigger>
          <TabsTrigger value="auto-approve" className="gap-2">
            <Settings className="h-4 w-4" />
            Auto-Approve
          </TabsTrigger>
          <TabsTrigger value="escalation" className="gap-2">
            <Clock className="h-4 w-4" />
            Escalation
          </TabsTrigger>
        </TabsList>

        {/* Email Notifications Tab */}
        <TabsContent value="email" className="space-y-6">
          {ENTITY_TYPES.map(({ type, label, icon: Icon, color }) => {
            const emailSettings = settings[
              `${type}EmailSettings` as keyof ApprovalSettings
            ] as EmailConfig;

            return (
              <Card key={type}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-muted ${color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{label} Notifications</CardTitle>
                      <CardDescription>
                        Configure email notifications for {label.toLowerCase()} approvals
                      </CardDescription>
                    </div>
                    <div className="ml-auto">
                      <Switch
                        checked={emailSettings.enabled}
                        onCheckedChange={(checked) =>
                          handleEmailSettingsChange(type, 'enabled', checked)
                        }
                        disabled={saving}
                      />
                    </div>
                  </div>
                </CardHeader>

                {emailSettings.enabled && (
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="flex items-center justify-between p-4 rounded-lg border">
                        <div>
                          <Label>Notify on Request</Label>
                          <p className="text-sm text-muted-foreground">
                            Send email when a new request is created
                          </p>
                        </div>
                        <Switch
                          checked={emailSettings.notifyOnRequest}
                          onCheckedChange={(checked) =>
                            handleEmailSettingsChange(type, 'notifyOnRequest', checked)
                          }
                          disabled={saving}
                        />
                      </div>

                      <div className="flex items-center justify-between p-4 rounded-lg border">
                        <div>
                          <Label>Notify on Approval</Label>
                          <p className="text-sm text-muted-foreground">
                            Send email when request is approved
                          </p>
                        </div>
                        <Switch
                          checked={emailSettings.notifyOnApproval}
                          onCheckedChange={(checked) =>
                            handleEmailSettingsChange(type, 'notifyOnApproval', checked)
                          }
                          disabled={saving}
                        />
                      </div>

                      <div className="flex items-center justify-between p-4 rounded-lg border">
                        <div>
                          <Label>Notify on Rejection</Label>
                          <p className="text-sm text-muted-foreground">
                            Send email when request is rejected
                          </p>
                        </div>
                        <Switch
                          checked={emailSettings.notifyOnRejection}
                          onCheckedChange={(checked) =>
                            handleEmailSettingsChange(type, 'notifyOnRejection', checked)
                          }
                          disabled={saving}
                        />
                      </div>

                      <div className="flex items-center justify-between p-4 rounded-lg border">
                        <div>
                          <Label>Notify on Undo</Label>
                          <p className="text-sm text-muted-foreground">
                            Send email when approval is undone
                          </p>
                        </div>
                        <Switch
                          checked={emailSettings.notifyOnUndo}
                          onCheckedChange={(checked) =>
                            handleEmailSettingsChange(type, 'notifyOnUndo', checked)
                          }
                          disabled={saving}
                        />
                      </div>
                    </div>

                    <div className="pt-4 border-t">
                      <Label className="mb-2 block">Recipient Roles</Label>
                      <div className="flex flex-wrap gap-2">
                        {emailSettings.recipientRoles.map((role) => (
                          <Badge key={role} variant="secondary" className="gap-1">
                            {AVAILABLE_ROLES.find((r) => r.value === role)?.label || role}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        Users with these roles will receive email notifications
                      </p>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </TabsContent>

        {/* Auto-Approve Tab */}
        <TabsContent value="auto-approve" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Auto-Approval Thresholds</CardTitle>
              <CardDescription>
                Automatically approve requests below the specified amount (set to 0 to disable)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Concession Auto-Approve Threshold</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">₹</span>
                    <Input
                      type="number"
                      min={0}
                      value={settings.autoApproveThreshold.concession}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 0;
                        setSettings({
                          ...settings,
                          autoApproveThreshold: {
                            ...settings.autoApproveThreshold,
                            concession: value,
                          },
                        });
                      }}
                      onBlur={(e) => {
                        const value = parseInt(e.target.value) || 0;
                        handleAutoApproveChange('concession', value);
                      }}
                      className="max-w-[200px]"
                      disabled={saving}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Concessions below this amount will be auto-approved
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Fee Cancellation Auto-Approve Threshold</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">₹</span>
                    <Input
                      type="number"
                      min={0}
                      value={settings.autoApproveThreshold.feeCancellation}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 0;
                        setSettings({
                          ...settings,
                          autoApproveThreshold: {
                            ...settings.autoApproveThreshold,
                            feeCancellation: value,
                          },
                        });
                      }}
                      onBlur={(e) => {
                        const value = parseInt(e.target.value) || 0;
                        handleAutoApproveChange('feeCancellation', value);
                      }}
                      className="max-w-[200px]"
                      disabled={saving}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Fee cancellations below this amount will be auto-approved
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Escalation Tab */}
        <TabsContent value="escalation" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Escalation Settings</CardTitle>
                  <CardDescription>
                    Configure automatic escalation for pending approval requests
                  </CardDescription>
                </div>
                <Switch
                  checked={settings.escalationSettings.enabled}
                  onCheckedChange={(checked) => handleEscalationChange('enabled', checked)}
                  disabled={saving}
                />
              </div>
            </CardHeader>

            {settings.escalationSettings.enabled && (
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Escalate After (Days)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={settings.escalationSettings.escalateAfterDays}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 3;
                      setSettings({
                        ...settings,
                        escalationSettings: {
                          ...settings.escalationSettings,
                          escalateAfterDays: value,
                        },
                      });
                    }}
                    onBlur={(e) => {
                      const value = parseInt(e.target.value) || 3;
                      handleEscalationChange('escalateAfterDays', value);
                    }}
                    className="max-w-[200px]"
                    disabled={saving}
                  />
                  <p className="text-sm text-muted-foreground">
                    Number of days after which pending requests will be escalated
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Escalation Roles</Label>
                  <div className="flex flex-wrap gap-2">
                    {settings.escalationSettings.escalationRoles.map((role) => (
                      <Badge key={role} variant="secondary">
                        {AVAILABLE_ROLES.find((r) => r.value === role)?.label || role}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Users with these roles will be notified when requests are escalated
                  </p>
                </div>
              </CardContent>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

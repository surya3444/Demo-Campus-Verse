'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2,
  AlertCircle,
  Plus,
  Pencil,
  Trash2,
  Save,
  MessageSquare,
  Mail,
  Calendar,
  Bell,
  Megaphone,
  Phone,
  Code,
} from 'lucide-react';
import { communicationsApi } from '@/lib/api';
import { toast } from 'sonner';

interface EventType {
  code: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  requiresApproval: boolean;
  defaultDuration: number;
  isActive: boolean;
}

interface SMSTemplate {
  _id?: string;
  code: string;
  name: string;
  content: string;
  category: 'fee' | 'attendance' | 'announcement' | 'admission' | 'hr' | 'general';
  variables: string[];
  dltTemplateId?: string;
  isActive: boolean;
}

interface EmailTemplate {
  _id?: string;
  code: string;
  name: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  category: 'fee' | 'attendance' | 'announcement' | 'admission' | 'hr' | 'general' | 'auth';
  variables: string[];
  isActive: boolean;
}

interface SMSSettings {
  provider: 'msg91' | 'twilio' | 'gupshup' | 'custom' | 'none';
  apiKey?: string;
  senderId?: string;
  dltEntityId?: string;
  isEnabled: boolean;
  testMode?: boolean;
  maxSmsPerDay: number;
  defaultCountryCode: string;
}

interface EmailSettings {
  provider: 'sendgrid' | 'ses' | 'smtp' | 'none';
  fromEmail?: string;
  fromName?: string;
  replyTo?: string;
  isEnabled: boolean;
  apiKey?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUsername?: string;
  smtpPassword?: string;
}

interface WhatsAppSettings {
  provider: 'twilio' | 'meta' | 'gupshup' | 'none';
  phoneNumber?: string;
  isEnabled: boolean;
}

interface AnnouncementSettings {
  requireApproval: boolean;
  defaultExpiryDays: number;
  maxAttachmentSize: number;
  allowedFileTypes: string[];
  autoArchiveAfterDays: number;
}

interface NotificationDefaults {
  channels: ('sms' | 'email' | 'push' | 'whatsapp')[];
  feeReminders: boolean;
  attendanceAlerts: boolean;
  announcementNotifications: boolean;
  eventReminders: boolean;
}

interface CommunicationSettings {
  eventTypes: EventType[];
  smsSettings: SMSSettings;
  emailSettings: EmailSettings;
  whatsappSettings: WhatsAppSettings;
  smsTemplates: SMSTemplate[];
  emailTemplates: EmailTemplate[];
  announcementSettings: AnnouncementSettings;
  notificationDefaults: NotificationDefaults;
}

const DEFAULT_SETTINGS: CommunicationSettings = {
  eventTypes: [],
  smsSettings: {
    provider: 'none',
    isEnabled: false,
    testMode: true,
    maxSmsPerDay: 1000,
    defaultCountryCode: '+91',
  },
  emailSettings: {
    provider: 'none',
    isEnabled: false,
  },
  whatsappSettings: {
    provider: 'none',
    isEnabled: false,
  },
  smsTemplates: [],
  emailTemplates: [],
  announcementSettings: {
    requireApproval: true,
    defaultExpiryDays: 30,
    maxAttachmentSize: 10,
    allowedFileTypes: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'],
    autoArchiveAfterDays: 90,
  },
  notificationDefaults: {
    channels: ['sms', 'email'],
    feeReminders: true,
    attendanceAlerts: true,
    announcementNotifications: true,
    eventReminders: true,
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  fee: 'Fee',
  attendance: 'Attendance',
  announcement: 'Announcement',
  admission: 'Admission',
  hr: 'HR',
  general: 'General',
  auth: 'Authentication',
};

const CATEGORY_COLORS: Record<string, string> = {
  fee: 'bg-green-100 text-green-800',
  attendance: 'bg-blue-100 text-blue-800',
  announcement: 'bg-purple-100 text-purple-800',
  admission: 'bg-orange-100 text-orange-800',
  hr: 'bg-pink-100 text-pink-800',
  general: 'bg-gray-100 text-gray-800',
  auth: 'bg-indigo-100 text-indigo-800',
};

export default function CommunicationSettingsPage() {
  // Deep links (e.g. the setup checklist) open a specific tab via ?tab=
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'sms';
  const [settings, setSettings] = useState<CommunicationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Event Type Dialog
  const [eventTypeDialogOpen, setEventTypeDialogOpen] = useState(false);
  const [editingEventType, setEditingEventType] = useState<EventType | null>(null);
  const [eventTypeForm, setEventTypeForm] = useState<Partial<EventType>>({});

  // SMS Template Dialog
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SMSTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState<Partial<SMSTemplate>>({});

  // Email Template Dialog
  const [emailTemplateDialogOpen, setEmailTemplateDialogOpen] = useState(false);
  const [editingEmailTemplate, setEditingEmailTemplate] = useState<EmailTemplate | null>(null);
  const [emailTemplateForm, setEmailTemplateForm] = useState<Partial<EmailTemplate>>({});

  // Delete Dialogs
  const [deleteEventTypeDialogOpen, setDeleteEventTypeDialogOpen] = useState(false);
  const [deletingEventTypeCode, setDeletingEventTypeCode] = useState<string | null>(null);
  const [deleteTemplateDialogOpen, setDeleteTemplateDialogOpen] = useState(false);
  const [deletingTemplateCode, setDeletingTemplateCode] = useState<string | null>(null);
  const [deleteEmailTemplateDialogOpen, setDeleteEmailTemplateDialogOpen] = useState(false);
  const [deletingEmailTemplateCode, setDeletingEmailTemplateCode] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await communicationsApi.getSettings();
      if (response.success) {
        const data = response.data;
        setSettings({
          eventTypes: data.eventTypes || [],
          smsSettings: { ...DEFAULT_SETTINGS.smsSettings, ...data.smsSettings },
          emailSettings: { ...DEFAULT_SETTINGS.emailSettings, ...data.emailSettings },
          whatsappSettings: { ...DEFAULT_SETTINGS.whatsappSettings, ...data.whatsappSettings },
          smsTemplates: data.smsTemplates || [],
          emailTemplates: data.emailTemplates || [],
          announcementSettings: {
            ...DEFAULT_SETTINGS.announcementSettings,
            ...data.announcementSettings,
          },
          notificationDefaults: {
            ...DEFAULT_SETTINGS.notificationDefaults,
            ...data.notificationDefaults,
          },
        });
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
      setError('Failed to load communication settings');
      toast.error('Failed to load communication settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSaveSettings = async (
    section: string,
    data:
      | SMSSettings
      | EmailSettings
      | WhatsAppSettings
      | AnnouncementSettings
      | NotificationDefaults
  ) => {
    try {
      setSaving(true);
      await communicationsApi.updateSettings({ [section]: data });
      toast.success('Settings updated successfully');
      fetchSettings();
    } catch (err) {
      console.error('Failed to update settings:', err);
      toast.error('Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  // Event Type handlers
  const handleOpenEventTypeDialog = (eventType?: EventType) => {
    if (eventType) {
      setEditingEventType(eventType);
      setEventTypeForm(eventType);
    } else {
      setEditingEventType(null);
      setEventTypeForm({
        code: '',
        name: '',
        description: '',
        color: '#3B82F6',
        requiresApproval: false,
        defaultDuration: 60,
        isActive: true,
      });
    }
    setEventTypeDialogOpen(true);
  };

  const handleSaveEventType = async () => {
    if (!eventTypeForm.code || !eventTypeForm.name) {
      toast.error('Code and Name are required');
      return;
    }

    try {
      setSaving(true);
      if (editingEventType) {
        await communicationsApi.updateEventType(editingEventType.code, eventTypeForm);
        toast.success('Event type updated successfully');
      } else {
        await communicationsApi.addEventType(eventTypeForm as EventType);
        toast.success('Event type added successfully');
      }
      setEventTypeDialogOpen(false);
      setEditingEventType(null);
      setEventTypeForm({});
      fetchSettings();
    } catch (err) {
      console.error('Failed to save event type:', err);
      toast.error('Failed to save event type');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEventType = async () => {
    if (!deletingEventTypeCode) return;

    try {
      setSaving(true);
      await communicationsApi.deleteEventType(deletingEventTypeCode);
      toast.success('Event type deleted successfully');
      setDeleteEventTypeDialogOpen(false);
      setDeletingEventTypeCode(null);
      fetchSettings();
    } catch (err) {
      console.error('Failed to delete event type:', err);
      toast.error('Failed to delete event type');
    } finally {
      setSaving(false);
    }
  };

  // SMS Template handlers
  const handleOpenTemplateDialog = (template?: SMSTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setTemplateForm(template);
    } else {
      setEditingTemplate(null);
      setTemplateForm({
        code: '',
        name: '',
        content: '',
        category: 'general',
        variables: [],
        dltTemplateId: '',
        isActive: true,
      });
    }
    setTemplateDialogOpen(true);
  };

  const handleSaveTemplate = async () => {
    if (!templateForm.code || !templateForm.name || !templateForm.content) {
      toast.error('Code, Name, and Content are required');
      return;
    }

    // Extract variables from content
    const variableMatches = templateForm.content?.match(/\{(\w+)\}/g) || [];
    const variables = variableMatches.map((v) => v.replace(/[{}]/g, ''));

    try {
      setSaving(true);
      const dataToSave = { ...templateForm, variables };
      if (editingTemplate) {
        await communicationsApi.updateSMSTemplate(editingTemplate.code, dataToSave);
        toast.success('SMS template updated successfully');
      } else {
        await communicationsApi.addSMSTemplate(dataToSave as SMSTemplate);
        toast.success('SMS template added successfully');
      }
      setTemplateDialogOpen(false);
      setEditingTemplate(null);
      setTemplateForm({});
      fetchSettings();
    } catch (err) {
      console.error('Failed to save SMS template:', err);
      toast.error('Failed to save SMS template');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!deletingTemplateCode) return;

    try {
      setSaving(true);
      await communicationsApi.deleteSMSTemplate(deletingTemplateCode);
      toast.success('SMS template deleted successfully');
      setDeleteTemplateDialogOpen(false);
      setDeletingTemplateCode(null);
      fetchSettings();
    } catch (err) {
      console.error('Failed to delete SMS template:', err);
      toast.error('Failed to delete SMS template');
    } finally {
      setSaving(false);
    }
  };

  // Email Template handlers
  const handleOpenEmailTemplateDialog = (template?: EmailTemplate) => {
    if (template) {
      setEditingEmailTemplate(template);
      setEmailTemplateForm(template);
    } else {
      setEditingEmailTemplate(null);
      setEmailTemplateForm({
        code: '',
        name: '',
        subject: '',
        htmlContent: '',
        textContent: '',
        category: 'general',
        variables: [],
        isActive: true,
      });
    }
    setEmailTemplateDialogOpen(true);
  };

  const handleSaveEmailTemplate = async () => {
    if (
      !emailTemplateForm.code ||
      !emailTemplateForm.name ||
      !emailTemplateForm.subject ||
      !emailTemplateForm.htmlContent
    ) {
      toast.error('Code, Name, Subject, and HTML Content are required');
      return;
    }

    // Extract variables from content
    const subjectVariables = emailTemplateForm.subject?.match(/\{(\w+)\}/g) || [];
    const htmlVariables = emailTemplateForm.htmlContent?.match(/\{(\w+)\}/g) || [];
    const allVariables = [...new Set([...subjectVariables, ...htmlVariables])];
    const variables = allVariables.map((v) => v.replace(/[{}]/g, ''));

    try {
      setSaving(true);
      const dataToSave = { ...emailTemplateForm, variables };
      if (editingEmailTemplate) {
        await communicationsApi.updateEmailTemplate(editingEmailTemplate.code, dataToSave);
        toast.success('Email template updated successfully');
      } else {
        await communicationsApi.addEmailTemplate(dataToSave as EmailTemplate);
        toast.success('Email template added successfully');
      }
      setEmailTemplateDialogOpen(false);
      setEditingEmailTemplate(null);
      setEmailTemplateForm({});
      fetchSettings();
    } catch (err) {
      console.error('Failed to save email template:', err);
      toast.error('Failed to save email template');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEmailTemplate = async () => {
    if (!deletingEmailTemplateCode) return;

    try {
      setSaving(true);
      await communicationsApi.deleteEmailTemplate(deletingEmailTemplateCode);
      toast.success('Email template deleted successfully');
      setDeleteEmailTemplateDialogOpen(false);
      setDeletingEmailTemplateCode(null);
      fetchSettings();
    } catch (err) {
      console.error('Failed to delete email template:', err);
      toast.error('Failed to delete email template');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading communication settings...</p>
        </div>
      </div>
    );
  }

  if (error || !settings) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <p className="text-lg font-medium">{error || 'Failed to load settings'}</p>
          <Button onClick={fetchSettings} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Communication Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure SMS, email, WhatsApp, and notification settings
        </p>
      </div>

      <Tabs defaultValue={initialTab} className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="sms" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            SMS
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            SMS Templates
          </TabsTrigger>
          <TabsTrigger value="email-templates" className="gap-2">
            <Code className="h-4 w-4" />
            Email Templates
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-2">
            <Mail className="h-4 w-4" />
            Email Settings
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-2">
            <Phone className="h-4 w-4" />
            WhatsApp
          </TabsTrigger>
          <TabsTrigger value="event-types" className="gap-2">
            <Calendar className="h-4 w-4" />
            Event Types
          </TabsTrigger>
          <TabsTrigger value="announcements" className="gap-2">
            <Megaphone className="h-4 w-4" />
            Announcements
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
        </TabsList>

        {/* SMS Settings Tab */}
        <TabsContent value="sms">
          <Card className="border-0 shadow-elegant-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                SMS Gateway Settings
              </CardTitle>
              <CardDescription>Configure SMS provider and gateway settings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>SMS Provider</Label>
                  <Select
                    value={settings.smsSettings.provider}
                    onValueChange={(v) =>
                      setSettings({
                        ...settings,
                        smsSettings: {
                          ...settings.smsSettings,
                          provider: v as SMSSettings['provider'],
                        },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (Disabled)</SelectItem>
                      <SelectItem value="msg91">MSG91</SelectItem>
                      <SelectItem value="twilio">Twilio</SelectItem>
                      <SelectItem value="gupshup">Gupshup</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Default Country Code</Label>
                  <Input
                    value={settings.smsSettings.defaultCountryCode}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        smsSettings: {
                          ...settings.smsSettings,
                          defaultCountryCode: e.target.value,
                        },
                      })
                    }
                    placeholder="+91"
                  />
                </div>

                {settings.smsSettings.provider !== 'none' && (
                  <>
                    <div className="space-y-2">
                      <Label>API Key</Label>
                      <Input
                        type="password"
                        value={settings.smsSettings.apiKey || ''}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            smsSettings: { ...settings.smsSettings, apiKey: e.target.value },
                          })
                        }
                        placeholder="Enter API key"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Sender ID</Label>
                      <Input
                        value={settings.smsSettings.senderId || ''}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            smsSettings: { ...settings.smsSettings, senderId: e.target.value },
                          })
                        }
                        placeholder="e.g., CAMPUS"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>DLT Entity ID (India)</Label>
                      <Input
                        value={settings.smsSettings.dltEntityId || ''}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            smsSettings: { ...settings.smsSettings, dltEntityId: e.target.value },
                          })
                        }
                        placeholder="DLT registration entity ID"
                      />
                      <p className="text-xs text-muted-foreground">
                        Required for SMS in India (TRAI DLT registration)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Max SMS Per Day</Label>
                      <Input
                        type="number"
                        value={settings.smsSettings.maxSmsPerDay}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            smsSettings: {
                              ...settings.smsSettings,
                              maxSmsPerDay: parseInt(e.target.value) || 1000,
                            },
                          })
                        }
                      />
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Enable SMS</Label>
                          <p className="text-xs text-muted-foreground">Allow sending SMS</p>
                        </div>
                        <Switch
                          checked={settings.smsSettings.isEnabled}
                          onCheckedChange={(checked) =>
                            setSettings({
                              ...settings,
                              smsSettings: { ...settings.smsSettings, isEnabled: checked },
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Test Mode</Label>
                          <p className="text-xs text-muted-foreground">Log SMS without sending</p>
                        </div>
                        <Switch
                          checked={settings.smsSettings.testMode || false}
                          onCheckedChange={(checked) =>
                            setSettings({
                              ...settings,
                              smsSettings: { ...settings.smsSettings, testMode: checked },
                            })
                          }
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="flex justify-end mt-6">
                <Button
                  onClick={() => handleSaveSettings('smsSettings', settings.smsSettings)}
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SMS Templates Tab */}
        <TabsContent value="templates">
          <Card className="border-0 shadow-elegant-md">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  SMS Templates
                </CardTitle>
                <CardDescription>Manage SMS message templates</CardDescription>
              </div>
              <Button onClick={() => handleOpenTemplateDialog()} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Template
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {settings.smsTemplates.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">No SMS templates configured</p>
                    <Button
                      variant="link"
                      onClick={() => handleOpenTemplateDialog()}
                      className="mt-2"
                    >
                      Add your first template
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {settings.smsTemplates.map((template) => (
                      <div
                        key={template.code}
                        className="flex items-start justify-between p-4 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <p className="font-medium">{template.name}</p>
                            <Badge variant="outline" className="font-mono text-xs">
                              {template.code}
                            </Badge>
                            <Badge className={`text-xs ${CATEGORY_COLORS[template.category]}`}>
                              {CATEGORY_LABELS[template.category]}
                            </Badge>
                            {!template.isActive && (
                              <Badge variant="secondary" className="text-xs">
                                Inactive
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {template.content}
                          </p>
                          {template.variables.length > 0 && (
                            <div className="flex gap-1 mt-2">
                              {template.variables.map((v) => (
                                <Badge key={v} variant="outline" className="text-xs font-mono">
                                  {`{${v}}`}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenTemplateDialog(template)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              setDeletingTemplateCode(template.code);
                              setDeleteTemplateDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Templates Tab */}
        <TabsContent value="email-templates">
          <Card className="border-0 shadow-elegant-md">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Code className="h-5 w-5 text-primary" />
                  Email Templates
                </CardTitle>
                <CardDescription>Manage HTML email templates</CardDescription>
              </div>
              <Button onClick={() => handleOpenEmailTemplateDialog()} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Template
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {settings.emailTemplates.length === 0 ? (
                  <div className="text-center py-12">
                    <Mail className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">No email templates configured</p>
                    <Button
                      variant="link"
                      onClick={() => handleOpenEmailTemplateDialog()}
                      className="mt-2"
                    >
                      Add your first email template
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {settings.emailTemplates.map((template) => (
                      <div
                        key={template.code}
                        className="flex items-start justify-between p-4 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <p className="font-medium">{template.name}</p>
                            <Badge variant="outline" className="font-mono text-xs">
                              {template.code}
                            </Badge>
                            <Badge className={`text-xs ${CATEGORY_COLORS[template.category]}`}>
                              {CATEGORY_LABELS[template.category]}
                            </Badge>
                            {!template.isActive && (
                              <Badge variant="secondary" className="text-xs">
                                Inactive
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">
                            Subject: {template.subject}
                          </p>
                          {template.variables.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {template.variables.map((v) => (
                                <Badge key={v} variant="outline" className="text-xs font-mono">
                                  {`{${v}}`}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEmailTemplateDialog(template)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              setDeletingEmailTemplateCode(template.code);
                              setDeleteEmailTemplateDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Settings Tab */}
        <TabsContent value="email">
          <Card className="border-0 shadow-elegant-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                Email Settings
              </CardTitle>
              <CardDescription>Configure email provider and sending settings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Email Provider</Label>
                  <Select
                    value={settings.emailSettings.provider}
                    onValueChange={(v) =>
                      setSettings({
                        ...settings,
                        emailSettings: {
                          ...settings.emailSettings,
                          provider: v as EmailSettings['provider'],
                        },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (Disabled)</SelectItem>
                      <SelectItem value="sendgrid">SendGrid</SelectItem>
                      <SelectItem value="ses">Amazon SES</SelectItem>
                      <SelectItem value="smtp">Custom SMTP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {settings.emailSettings.provider !== 'none' && (
                  <>
                    <div className="space-y-2">
                      <Label>From Email</Label>
                      <Input
                        type="email"
                        value={settings.emailSettings.fromEmail || ''}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            emailSettings: { ...settings.emailSettings, fromEmail: e.target.value },
                          })
                        }
                        placeholder="noreply@yourschool.com"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>From Name</Label>
                      <Input
                        value={settings.emailSettings.fromName || ''}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            emailSettings: { ...settings.emailSettings, fromName: e.target.value },
                          })
                        }
                        placeholder="Campus Verse"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Reply-To Email</Label>
                      <Input
                        type="email"
                        value={settings.emailSettings.replyTo || ''}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            emailSettings: { ...settings.emailSettings, replyTo: e.target.value },
                          })
                        }
                        placeholder="support@yourschool.com"
                      />
                    </div>

                    {/* API Key for SendGrid/SES */}
                    {(settings.emailSettings.provider === 'sendgrid' ||
                      settings.emailSettings.provider === 'ses') && (
                      <div className="space-y-2">
                        <Label>API Key</Label>
                        <Input
                          type="password"
                          value={settings.emailSettings.apiKey || ''}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              emailSettings: { ...settings.emailSettings, apiKey: e.target.value },
                            })
                          }
                          placeholder="Enter API key"
                        />
                      </div>
                    )}

                    {/* SMTP Settings */}
                    {settings.emailSettings.provider === 'smtp' && (
                      <>
                        <div className="space-y-2">
                          <Label>SMTP Host</Label>
                          <Input
                            value={settings.emailSettings.smtpHost || ''}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                emailSettings: {
                                  ...settings.emailSettings,
                                  smtpHost: e.target.value,
                                },
                              })
                            }
                            placeholder="smtp.gmail.com"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>SMTP Port</Label>
                          <Input
                            type="number"
                            value={settings.emailSettings.smtpPort || 587}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                emailSettings: {
                                  ...settings.emailSettings,
                                  smtpPort: parseInt(e.target.value) || 587,
                                },
                              })
                            }
                            placeholder="587"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>SMTP Username</Label>
                          <Input
                            value={settings.emailSettings.smtpUsername || ''}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                emailSettings: {
                                  ...settings.emailSettings,
                                  smtpUsername: e.target.value,
                                },
                              })
                            }
                            placeholder="your-email@gmail.com"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>SMTP Password</Label>
                          <Input
                            type="password"
                            value={settings.emailSettings.smtpPassword || ''}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                emailSettings: {
                                  ...settings.emailSettings,
                                  smtpPassword: e.target.value,
                                },
                              })
                            }
                            placeholder="App password or SMTP password"
                          />
                        </div>

                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <Label>Use TLS/SSL</Label>
                              <p className="text-xs text-muted-foreground">
                                Secure connection (recommended)
                              </p>
                            </div>
                            <Switch
                              checked={settings.emailSettings.smtpSecure ?? true}
                              onCheckedChange={(checked) =>
                                setSettings({
                                  ...settings,
                                  emailSettings: { ...settings.emailSettings, smtpSecure: checked },
                                })
                              }
                            />
                          </div>
                        </div>
                      </>
                    )}

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Enable Email</Label>
                          <p className="text-xs text-muted-foreground">Allow sending emails</p>
                        </div>
                        <Switch
                          checked={settings.emailSettings.isEnabled}
                          onCheckedChange={(checked) =>
                            setSettings({
                              ...settings,
                              emailSettings: { ...settings.emailSettings, isEnabled: checked },
                            })
                          }
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="flex justify-end mt-6">
                <Button
                  onClick={() => handleSaveSettings('emailSettings', settings.emailSettings)}
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* WhatsApp Settings Tab */}
        <TabsContent value="whatsapp">
          <Card className="border-0 shadow-elegant-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-primary" />
                WhatsApp Settings
              </CardTitle>
              <CardDescription>Configure WhatsApp Business API settings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>WhatsApp Provider</Label>
                  <Select
                    value={settings.whatsappSettings.provider}
                    onValueChange={(v) =>
                      setSettings({
                        ...settings,
                        whatsappSettings: {
                          ...settings.whatsappSettings,
                          provider: v as WhatsAppSettings['provider'],
                        },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (Disabled)</SelectItem>
                      <SelectItem value="meta">Meta (Official)</SelectItem>
                      <SelectItem value="twilio">Twilio</SelectItem>
                      <SelectItem value="gupshup">Gupshup</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {settings.whatsappSettings.provider !== 'none' && (
                  <>
                    <div className="space-y-2">
                      <Label>WhatsApp Business Number</Label>
                      <Input
                        value={settings.whatsappSettings.phoneNumber || ''}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            whatsappSettings: {
                              ...settings.whatsappSettings,
                              phoneNumber: e.target.value,
                            },
                          })
                        }
                        placeholder="+91 98765 43210"
                      />
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Enable WhatsApp</Label>
                          <p className="text-xs text-muted-foreground">
                            Allow sending WhatsApp messages
                          </p>
                        </div>
                        <Switch
                          checked={settings.whatsappSettings.isEnabled}
                          onCheckedChange={(checked) =>
                            setSettings({
                              ...settings,
                              whatsappSettings: {
                                ...settings.whatsappSettings,
                                isEnabled: checked,
                              },
                            })
                          }
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="flex justify-end mt-6">
                <Button
                  onClick={() => handleSaveSettings('whatsappSettings', settings.whatsappSettings)}
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Event Types Tab */}
        <TabsContent value="event-types">
          <Card className="border-0 shadow-elegant-md">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Event Types
                </CardTitle>
                <CardDescription>Configure event categories for the calendar</CardDescription>
              </div>
              <Button onClick={() => handleOpenEventTypeDialog()} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Event Type
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {settings.eventTypes.length === 0 ? (
                  <div className="text-center py-12">
                    <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">No event types configured</p>
                    <Button
                      variant="link"
                      onClick={() => handleOpenEventTypeDialog()}
                      className="mt-2"
                    >
                      Add your first event type
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {settings.eventTypes.map((eventType) => (
                      <div
                        key={eventType.code}
                        className="flex items-center justify-between p-4 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className="h-10 w-10 rounded-lg flex items-center justify-center"
                            style={{
                              backgroundColor: `${eventType.color}20`,
                              color: eventType.color,
                            }}
                          >
                            <Calendar className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{eventType.name}</p>
                              <Badge variant="outline" className="font-mono text-xs">
                                {eventType.code}
                              </Badge>
                              {!eventType.isActive && (
                                <Badge variant="secondary" className="text-xs">
                                  Inactive
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                              <span>{eventType.defaultDuration} min</span>
                              <span>|</span>
                              <span>
                                {eventType.requiresApproval
                                  ? 'Requires approval'
                                  : 'No approval needed'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded-full border-2"
                            style={{ backgroundColor: eventType.color }}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEventTypeDialog(eventType)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              setDeletingEventTypeCode(eventType.code);
                              setDeleteEventTypeDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Announcement Settings Tab */}
        <TabsContent value="announcements">
          <Card className="border-0 shadow-elegant-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-primary" />
                Announcement Settings
              </CardTitle>
              <CardDescription>Configure announcement behavior and rules</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Default Expiry (Days)</Label>
                  <Input
                    type="number"
                    value={settings.announcementSettings.defaultExpiryDays}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        announcementSettings: {
                          ...settings.announcementSettings,
                          defaultExpiryDays: parseInt(e.target.value) || 30,
                        },
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Number of days after which announcements expire
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Auto Archive After (Days)</Label>
                  <Input
                    type="number"
                    value={settings.announcementSettings.autoArchiveAfterDays}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        announcementSettings: {
                          ...settings.announcementSettings,
                          autoArchiveAfterDays: parseInt(e.target.value) || 90,
                        },
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Max Attachment Size (MB)</Label>
                  <Input
                    type="number"
                    value={settings.announcementSettings.maxAttachmentSize}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        announcementSettings: {
                          ...settings.announcementSettings,
                          maxAttachmentSize: parseInt(e.target.value) || 10,
                        },
                      })
                    }
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Require Approval</Label>
                      <p className="text-xs text-muted-foreground">
                        Announcements need approval before publishing
                      </p>
                    </div>
                    <Switch
                      checked={settings.announcementSettings.requireApproval}
                      onCheckedChange={(checked) =>
                        setSettings({
                          ...settings,
                          announcementSettings: {
                            ...settings.announcementSettings,
                            requireApproval: checked,
                          },
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end mt-6">
                <Button
                  onClick={() =>
                    handleSaveSettings('announcementSettings', settings.announcementSettings)
                  }
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notification Defaults Tab */}
        <TabsContent value="notifications">
          <Card className="border-0 shadow-elegant-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Notification Defaults
              </CardTitle>
              <CardDescription>Configure default notification preferences</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Fee Reminders</Label>
                      <p className="text-xs text-muted-foreground">Send fee due reminders</p>
                    </div>
                    <Switch
                      checked={settings.notificationDefaults.feeReminders}
                      onCheckedChange={(checked) =>
                        setSettings({
                          ...settings,
                          notificationDefaults: {
                            ...settings.notificationDefaults,
                            feeReminders: checked,
                          },
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Attendance Alerts</Label>
                      <p className="text-xs text-muted-foreground">Notify about absences</p>
                    </div>
                    <Switch
                      checked={settings.notificationDefaults.attendanceAlerts}
                      onCheckedChange={(checked) =>
                        setSettings({
                          ...settings,
                          notificationDefaults: {
                            ...settings.notificationDefaults,
                            attendanceAlerts: checked,
                          },
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Announcement Notifications</Label>
                      <p className="text-xs text-muted-foreground">
                        Notify about new announcements
                      </p>
                    </div>
                    <Switch
                      checked={settings.notificationDefaults.announcementNotifications}
                      onCheckedChange={(checked) =>
                        setSettings({
                          ...settings,
                          notificationDefaults: {
                            ...settings.notificationDefaults,
                            announcementNotifications: checked,
                          },
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Event Reminders</Label>
                      <p className="text-xs text-muted-foreground">Remind about upcoming events</p>
                    </div>
                    <Switch
                      checked={settings.notificationDefaults.eventReminders}
                      onCheckedChange={(checked) =>
                        setSettings({
                          ...settings,
                          notificationDefaults: {
                            ...settings.notificationDefaults,
                            eventReminders: checked,
                          },
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end mt-6">
                <Button
                  onClick={() =>
                    handleSaveSettings('notificationDefaults', settings.notificationDefaults)
                  }
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Event Type Dialog */}
      <Dialog open={eventTypeDialogOpen} onOpenChange={setEventTypeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEventType ? 'Edit Event Type' : 'Add Event Type'}</DialogTitle>
            <DialogDescription>
              {editingEventType
                ? 'Update the event type configuration'
                : 'Create a new event type for the calendar'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Code *</Label>
                <Input
                  value={eventTypeForm.code || ''}
                  onChange={(e) =>
                    setEventTypeForm({ ...eventTypeForm, code: e.target.value.toUpperCase() })
                  }
                  placeholder="e.g., EXAM"
                  disabled={!!editingEventType}
                  maxLength={20}
                />
              </div>
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={eventTypeForm.name || ''}
                  onChange={(e) => setEventTypeForm({ ...eventTypeForm, name: e.target.value })}
                  placeholder="e.g., Examination"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={eventTypeForm.description || ''}
                onChange={(e) =>
                  setEventTypeForm({ ...eventTypeForm, description: e.target.value })
                }
                placeholder="Brief description of the event type"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={eventTypeForm.color || '#3B82F6'}
                    onChange={(e) => setEventTypeForm({ ...eventTypeForm, color: e.target.value })}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={eventTypeForm.color || '#3B82F6'}
                    onChange={(e) => setEventTypeForm({ ...eventTypeForm, color: e.target.value })}
                    placeholder="#3B82F6"
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Default Duration (Minutes)</Label>
                <Input
                  type="number"
                  value={eventTypeForm.defaultDuration || 60}
                  onChange={(e) =>
                    setEventTypeForm({
                      ...eventTypeForm,
                      defaultDuration: parseInt(e.target.value) || 60,
                    })
                  }
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Requires Approval</Label>
                <p className="text-xs text-muted-foreground">
                  Events need approval before publishing
                </p>
              </div>
              <Switch
                checked={eventTypeForm.requiresApproval || false}
                onCheckedChange={(checked) =>
                  setEventTypeForm({ ...eventTypeForm, requiresApproval: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Active</Label>
                <p className="text-xs text-muted-foreground">Allow creating events of this type</p>
              </div>
              <Switch
                checked={eventTypeForm.isActive ?? true}
                onCheckedChange={(checked) =>
                  setEventTypeForm({ ...eventTypeForm, isActive: checked })
                }
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setEventTypeDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEventType} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingEventType ? 'Update' : 'Add'} Event Type
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* SMS Template Dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit SMS Template' : 'Add SMS Template'}</DialogTitle>
            <DialogDescription>
              {editingTemplate
                ? 'Update the SMS template configuration'
                : 'Create a new SMS template. Use {variableName} for dynamic content.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Code *</Label>
                <Input
                  value={templateForm.code || ''}
                  onChange={(e) =>
                    setTemplateForm({ ...templateForm, code: e.target.value.toUpperCase() })
                  }
                  placeholder="e.g., FEE_REMINDER"
                  disabled={!!editingTemplate}
                  maxLength={30}
                />
              </div>
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={templateForm.name || ''}
                  onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                  placeholder="e.g., Fee Reminder"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={templateForm.category || 'general'}
                  onValueChange={(v) =>
                    setTemplateForm({ ...templateForm, category: v as SMSTemplate['category'] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fee">Fee</SelectItem>
                    <SelectItem value="attendance">Attendance</SelectItem>
                    <SelectItem value="announcement">Announcement</SelectItem>
                    <SelectItem value="admission">Admission</SelectItem>
                    <SelectItem value="hr">HR</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>DLT Template ID</Label>
                <Input
                  value={templateForm.dltTemplateId || ''}
                  onChange={(e) =>
                    setTemplateForm({ ...templateForm, dltTemplateId: e.target.value })
                  }
                  placeholder="DLT registered template ID"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Message Content *</Label>
              <Textarea
                value={templateForm.content || ''}
                onChange={(e) => setTemplateForm({ ...templateForm, content: e.target.value })}
                placeholder="Dear Parent, Fee of Rs.{amount} for {studentName} is pending. Due date: {dueDate}. - {branchName}"
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Use {'{variableName}'} syntax for dynamic content. Variables will be auto-detected.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Active</Label>
                <p className="text-xs text-muted-foreground">Allow using this template</p>
              </div>
              <Switch
                checked={templateForm.isActive ?? true}
                onCheckedChange={(checked) =>
                  setTemplateForm({ ...templateForm, isActive: checked })
                }
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveTemplate} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingTemplate ? 'Update' : 'Add'} Template
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Event Type Confirmation Dialog */}
      <AlertDialog open={deleteEventTypeDialogOpen} onOpenChange={setDeleteEventTypeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this event type? This action cannot be undone.
              Existing events using this type will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEventType}
              className="bg-destructive hover:bg-destructive/90"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete SMS Template Confirmation Dialog */}
      <AlertDialog open={deleteTemplateDialogOpen} onOpenChange={setDeleteTemplateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete SMS Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this SMS template? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTemplate}
              className="bg-destructive hover:bg-destructive/90"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Email Template Dialog */}
      <Dialog open={emailTemplateDialogOpen} onOpenChange={setEmailTemplateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingEmailTemplate ? 'Edit Email Template' : 'Add Email Template'}
            </DialogTitle>
            <DialogDescription>
              {editingEmailTemplate
                ? 'Update the email template configuration'
                : 'Create a new HTML email template. Use {variableName} for dynamic content.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Code *</Label>
                <Input
                  value={emailTemplateForm.code || ''}
                  onChange={(e) =>
                    setEmailTemplateForm({
                      ...emailTemplateForm,
                      code: e.target.value.toUpperCase(),
                    })
                  }
                  placeholder="e.g., WELCOME_EMAIL"
                  disabled={!!editingEmailTemplate}
                  maxLength={30}
                />
              </div>
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={emailTemplateForm.name || ''}
                  onChange={(e) =>
                    setEmailTemplateForm({ ...emailTemplateForm, name: e.target.value })
                  }
                  placeholder="e.g., Welcome Email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={emailTemplateForm.category || 'general'}
                onValueChange={(v) =>
                  setEmailTemplateForm({
                    ...emailTemplateForm,
                    category: v as EmailTemplate['category'],
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auth">Authentication</SelectItem>
                  <SelectItem value="fee">Fee</SelectItem>
                  <SelectItem value="attendance">Attendance</SelectItem>
                  <SelectItem value="announcement">Announcement</SelectItem>
                  <SelectItem value="admission">Admission</SelectItem>
                  <SelectItem value="hr">HR</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Subject Line *</Label>
              <Input
                value={emailTemplateForm.subject || ''}
                onChange={(e) =>
                  setEmailTemplateForm({ ...emailTemplateForm, subject: e.target.value })
                }
                placeholder="e.g., Welcome to {organizationName}"
              />
              <p className="text-xs text-muted-foreground">
                Use {'{variableName}'} for dynamic content
              </p>
            </div>

            <div className="space-y-2">
              <Label>HTML Content *</Label>
              <Textarea
                value={emailTemplateForm.htmlContent || ''}
                onChange={(e) =>
                  setEmailTemplateForm({ ...emailTemplateForm, htmlContent: e.target.value })
                }
                placeholder="<!DOCTYPE html><html>..."
                rows={12}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Enter full HTML email template. Use {'{variableName}'} for dynamic content.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Plain Text Content (Optional)</Label>
              <Textarea
                value={emailTemplateForm.textContent || ''}
                onChange={(e) =>
                  setEmailTemplateForm({ ...emailTemplateForm, textContent: e.target.value })
                }
                placeholder="Plain text version for email clients that don't support HTML..."
                rows={4}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Active</Label>
                <p className="text-xs text-muted-foreground">Allow using this template</p>
              </div>
              <Switch
                checked={emailTemplateForm.isActive ?? true}
                onCheckedChange={(checked) =>
                  setEmailTemplateForm({ ...emailTemplateForm, isActive: checked })
                }
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setEmailTemplateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEmailTemplate} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingEmailTemplate ? 'Update' : 'Add'} Template
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Email Template Confirmation Dialog */}
      <AlertDialog
        open={deleteEmailTemplateDialogOpen}
        onOpenChange={setDeleteEmailTemplateDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Email Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this email template? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEmailTemplate}
              className="bg-destructive hover:bg-destructive/90"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

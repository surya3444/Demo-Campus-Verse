'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
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
import { admissionsApi } from '@/lib/api';
import { toast } from 'sonner';
import {
  Loader2,
  ArrowLeft,
  Plus,
  Save,
  Send,
  Trash2,
  GripVertical,
  Settings,
  Palette,
  FormInput,
  Type,
  AlignLeft,
  Mail,
  Phone,
  Hash,
  Calendar,
  ListCheck,
  CircleDot,
  CheckSquare,
  Upload,
  Minus,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  Archive,
  RotateCcw,
  Link as LinkIcon,
} from 'lucide-react';

interface FormField {
  id: string;
  type:
    | 'text'
    | 'textarea'
    | 'email'
    | 'phone'
    | 'number'
    | 'date'
    | 'select'
    | 'radio'
    | 'checkbox'
    | 'file'
    | 'section';
  name: string;
  label: string;
  placeholder?: string;
  helpText?: string;
  required: boolean;
  validation?: {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
    acceptedFileTypes?: string[];
    maxFileSize?: number;
  };
  options?: Array<{ value: string; label: string }>;
  defaultValue?: string | boolean;
  width?: 'full' | 'half' | 'third';
  order: number;
}

interface FormData {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  type: 'lead' | 'application' | 'enquiry' | 'feedback' | 'custom';
  status: 'draft' | 'published' | 'archived';
  fields: FormField[];
  settings: {
    collectPayment?: boolean;
    paymentAmount?: number;
    redirectUrl?: string;
    confirmationMessage?: string;
    notifyOnSubmission?: boolean;
    notifyEmails?: string[];
    autoCreateLead?: boolean;
    assignToClassId?: string;
    assignToAcademicBatchId?: string;
  };
  styling?: {
    headerImage?: string;
    logo?: string;
    primaryColor?: string;
    backgroundColor?: string;
  };
}

const FIELD_TYPES = [
  { value: 'text', label: 'Text', icon: Type, description: 'Single line text input' },
  { value: 'textarea', label: 'Text Area', icon: AlignLeft, description: 'Multi-line text input' },
  { value: 'email', label: 'Email', icon: Mail, description: 'Email address input' },
  { value: 'phone', label: 'Phone', icon: Phone, description: 'Phone number input' },
  { value: 'number', label: 'Number', icon: Hash, description: 'Numeric input' },
  { value: 'date', label: 'Date', icon: Calendar, description: 'Date picker' },
  { value: 'select', label: 'Dropdown', icon: ListCheck, description: 'Single selection dropdown' },
  { value: 'radio', label: 'Radio', icon: CircleDot, description: 'Radio button group' },
  { value: 'checkbox', label: 'Checkbox', icon: CheckSquare, description: 'Checkbox for yes/no' },
  { value: 'file', label: 'File Upload', icon: Upload, description: 'File attachment' },
  { value: 'section', label: 'Section', icon: Minus, description: 'Section divider with title' },
];

const WIDTH_OPTIONS = [
  { value: 'full', label: 'Full Width' },
  { value: 'half', label: 'Half Width' },
  { value: 'third', label: 'Third Width' },
];

export default function FormBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const formId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormData | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Field dialog
  const [fieldDialogOpen, setFieldDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<FormField | null>(null);
  const [fieldForm, setFieldForm] = useState<Partial<FormField>>({
    type: 'text',
    name: '',
    label: '',
    placeholder: '',
    helpText: '',
    required: false,
    width: 'full',
    options: [],
    validation: {},
  });

  // Publish dialog
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Discard dialog
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);

  useEffect(() => {
    fetchForm();
  }, [formId]);

  const fetchForm = async () => {
    setLoading(true);
    try {
      const response = await admissionsApi.getForm(formId);
      if (response.success) {
        setForm(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch form:', error);
      toast.error('Failed to load form');
      router.push('/admissions/forms');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form) return;

    setSaving(true);
    try {
      await admissionsApi.updateForm(form._id, {
        name: form.name,
        description: form.description,
        fields: form.fields,
        settings: form.settings,
        styling: form.styling,
      });

      toast.success('Form saved successfully');
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save form:', error);
      toast.error('Failed to save form');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!form) return;

    setPublishing(true);
    try {
      const newStatus = form.status === 'published' ? 'draft' : 'published';
      await admissionsApi.updateForm(form._id, { status: newStatus });

      setForm({ ...form, status: newStatus });
      toast.success(newStatus === 'published' ? 'Form published successfully' : 'Form unpublished');
      setPublishDialogOpen(false);
    } catch (error) {
      console.error('Failed to update form status:', error);
      toast.error('Failed to update form status');
    } finally {
      setPublishing(false);
    }
  };

  const updateForm = useCallback(
    (updates: Partial<FormData>) => {
      if (!form) return;
      setForm({ ...form, ...updates });
      setHasChanges(true);
    },
    [form]
  );

  const updateSettings = useCallback(
    (key: string, value: unknown) => {
      if (!form) return;
      setForm({
        ...form,
        settings: { ...form.settings, [key]: value },
      });
      setHasChanges(true);
    },
    [form]
  );

  const updateStyling = useCallback(
    (key: string, value: unknown) => {
      if (!form) return;
      setForm({
        ...form,
        styling: { ...form.styling, [key]: value },
      });
      setHasChanges(true);
    },
    [form]
  );

  // Field operations
  const openAddField = () => {
    setEditingField(null);
    setFieldForm({
      type: 'text',
      name: '',
      label: '',
      placeholder: '',
      helpText: '',
      required: false,
      width: 'full',
      options: [],
      validation: {},
    });
    setFieldDialogOpen(true);
  };

  const openEditField = (field: FormField) => {
    setEditingField(field);
    setFieldForm({ ...field });
    setFieldDialogOpen(true);
  };

  const handleSaveField = () => {
    if (!fieldForm.label?.trim()) {
      toast.error('Please enter a field label');
      return;
    }

    if (!form) return;

    const fieldName =
      fieldForm.name?.trim() ||
      fieldForm.label
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');

    let fields = [...form.fields];

    if (editingField) {
      // Update existing field
      fields = fields.map((f) =>
        f.id === editingField.id ? { ...f, ...fieldForm, name: fieldName } : f
      );
    } else {
      // Add new field
      const newField: FormField = {
        id: `field_${Date.now()}`,
        type: fieldForm.type || 'text',
        name: fieldName,
        label: fieldForm.label!,
        placeholder: fieldForm.placeholder,
        helpText: fieldForm.helpText,
        required: fieldForm.required || false,
        width: fieldForm.width || 'full',
        options: fieldForm.options,
        validation: fieldForm.validation,
        order: fields.length + 1,
      };
      fields.push(newField);
    }

    updateForm({ fields });
    setFieldDialogOpen(false);
    toast.success(editingField ? 'Field updated' : 'Field added');
  };

  const handleDeleteField = (fieldId: string) => {
    if (!form) return;
    const fields = form.fields.filter((f) => f.id !== fieldId);
    // Reorder remaining fields
    fields.forEach((f, i) => {
      f.order = i + 1;
    });
    updateForm({ fields });
    toast.success('Field removed');
  };

  const moveField = (fieldId: string, direction: 'up' | 'down') => {
    if (!form) return;

    const fields = [...form.fields];
    const index = fields.findIndex((f) => f.id === fieldId);

    if (direction === 'up' && index > 0) {
      [fields[index - 1], fields[index]] = [fields[index], fields[index - 1]];
    } else if (direction === 'down' && index < fields.length - 1) {
      [fields[index], fields[index + 1]] = [fields[index + 1], fields[index]];
    }

    // Update order
    fields.forEach((f, i) => {
      f.order = i + 1;
    });
    updateForm({ fields });
  };

  const addOption = () => {
    const options = fieldForm.options || [];
    setFieldForm({
      ...fieldForm,
      options: [...options, { value: `option_${options.length + 1}`, label: '' }],
    });
  };

  const updateOption = (index: number, key: 'value' | 'label', value: string) => {
    const options = [...(fieldForm.options || [])];
    options[index] = { ...options[index], [key]: value };
    setFieldForm({ ...fieldForm, options });
  };

  const removeOption = (index: number) => {
    const options = [...(fieldForm.options || [])];
    options.splice(index, 1);
    setFieldForm({ ...fieldForm, options });
  };

  const copyFormLink = () => {
    if (!form) return;
    const url = `${window.location.origin}/forms/${form.slug}`;
    navigator.clipboard.writeText(url);
    toast.success('Form link copied to clipboard');
  };

  const getFieldIcon = (type: string) => {
    const fieldType = FIELD_TYPES.find((t) => t.value === type);
    return fieldType?.icon || FormInput;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!form) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Form not found</p>
        <Button asChild className="mt-4">
          <Link href="/admissions/forms">Back to Forms</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admissions/forms">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{form.name}</h1>
              <Badge
                variant="secondary"
                className={
                  form.status === 'published'
                    ? 'bg-green-100 text-green-700'
                    : form.status === 'archived'
                      ? 'bg-gray-100 text-gray-700'
                      : 'bg-yellow-100 text-yellow-700'
                }
              >
                {form.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{form.description || 'No description'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Button variant="outline" onClick={() => setDiscardDialogOpen(true)}>
              <RotateCcw className="h-4 w-4 mr-1.5" />
              Discard
            </Button>
          )}
          <Button variant="outline" onClick={handleSave} disabled={saving || !hasChanges}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1.5" />
            )}
            Save
          </Button>
          {form.status === 'published' && (
            <Button variant="outline" onClick={copyFormLink}>
              <LinkIcon className="h-4 w-4 mr-1.5" />
              Copy Link
            </Button>
          )}
          <Button
            onClick={() => setPublishDialogOpen(true)}
            variant={form.status === 'published' ? 'outline' : 'default'}
          >
            {form.status === 'published' ? (
              <>
                <Archive className="h-4 w-4 mr-1.5" />
                Unpublish
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-1.5" />
                Publish
              </>
            )}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="fields" className="space-y-6">
        <TabsList>
          <TabsTrigger value="fields" className="flex items-center gap-1.5">
            <FormInput className="h-4 w-4" />
            Fields
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-1.5">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="styling" className="flex items-center gap-1.5">
            <Palette className="h-4 w-4" />
            Styling
          </TabsTrigger>
        </TabsList>

        {/* Fields Tab */}
        <TabsContent value="fields" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Form Preview */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">Form Fields</CardTitle>
                      <CardDescription>Drag fields to reorder. Click to edit.</CardDescription>
                    </div>
                    <Button onClick={openAddField}>
                      <Plus className="h-4 w-4 mr-1.5" />
                      Add Field
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {form.fields.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed rounded-lg">
                      <FormInput className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="font-medium text-lg">No fields yet</h3>
                      <p className="text-muted-foreground mb-4">
                        Add your first field to start building the form
                      </p>
                      <Button onClick={openAddField}>
                        <Plus className="h-4 w-4 mr-1.5" />
                        Add Field
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {form.fields
                        .sort((a, b) => a.order - b.order)
                        .map((field, index) => {
                          const FieldIcon = getFieldIcon(field.type);
                          return (
                            <div
                              key={field.id}
                              className="flex items-center gap-2 p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
                              onClick={() => openEditField(field)}
                            >
                              <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                              <div className="p-2 bg-primary/10 rounded">
                                <FieldIcon className="h-4 w-4 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium truncate">{field.label}</span>
                                  {field.required && (
                                    <span className="text-destructive text-sm">*</span>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {FIELD_TYPES.find((t) => t.value === field.type)?.label} -{' '}
                                  {field.name}
                                </p>
                              </div>
                              <Badge variant="outline" className="capitalize">
                                {field.width || 'full'}
                              </Badge>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    moveField(field.id, 'up');
                                  }}
                                  disabled={index === 0}
                                >
                                  <ChevronUp className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    moveField(field.id, 'down');
                                  }}
                                  disabled={index === form.fields.length - 1}
                                >
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteField(field.id);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Field Types Palette */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Field Types</CardTitle>
                  <CardDescription>Click to add a new field</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {FIELD_TYPES.map((type) => {
                      const Icon = type.icon;
                      return (
                        <Button
                          key={type.value}
                          variant="outline"
                          className="h-auto py-3 flex-col gap-1 text-left"
                          onClick={() => {
                            setEditingField(null);
                            setFieldForm({
                              type: type.value as FormField['type'],
                              name: '',
                              label: '',
                              placeholder: '',
                              helpText: '',
                              required: false,
                              width: 'full',
                              options:
                                type.value === 'select' || type.value === 'radio' ? [] : undefined,
                              validation: {},
                            });
                            setFieldDialogOpen(true);
                          }}
                        >
                          <Icon className="h-5 w-5 text-primary" />
                          <span className="text-xs">{type.label}</span>
                        </Button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Form Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Form Name</Label>
                  <Input value={form.name} onChange={(e) => updateForm({ name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={form.description || ''}
                    onChange={(e) => updateForm({ description: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Form URL Slug</Label>
                  <div className="flex items-center gap-2">
                    <Input value={form.slug} disabled className="bg-muted" />
                    {form.status === 'published' && (
                      <Button variant="outline" size="icon" asChild>
                        <a href={`/forms/${form.slug}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    URL: {window.location.origin}/forms/{form.slug}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Submission Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Confirmation Message</Label>
                  <Textarea
                    value={form.settings?.confirmationMessage || ''}
                    onChange={(e) => updateSettings('confirmationMessage', e.target.value)}
                    placeholder="Thank you for your submission!"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Redirect URL (Optional)</Label>
                  <Input
                    value={form.settings?.redirectUrl || ''}
                    onChange={(e) => updateSettings('redirectUrl', e.target.value)}
                    placeholder="https://example.com/thank-you"
                  />
                </div>
                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label>Auto-create Lead</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically create a lead from submission
                    </p>
                  </div>
                  <Switch
                    checked={form.settings?.autoCreateLead || false}
                    onCheckedChange={(checked) => updateSettings('autoCreateLead', checked)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Notifications</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">Get notified on new submissions</p>
                  </div>
                  <Switch
                    checked={form.settings?.notifyOnSubmission || false}
                    onCheckedChange={(checked) => updateSettings('notifyOnSubmission', checked)}
                  />
                </div>
                {form.settings?.notifyOnSubmission && (
                  <div className="space-y-2">
                    <Label>Notification Emails</Label>
                    <Input
                      value={form.settings?.notifyEmails?.join(', ') || ''}
                      onChange={(e) =>
                        updateSettings(
                          'notifyEmails',
                          e.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean)
                        )
                      }
                      placeholder="email1@example.com, email2@example.com"
                    />
                    <p className="text-xs text-muted-foreground">
                      Separate multiple emails with commas
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Payment (Coming Soon)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label>Collect Payment</Label>
                    <p className="text-sm text-muted-foreground">
                      Collect application fee on submission
                    </p>
                  </div>
                  <Switch
                    checked={form.settings?.collectPayment || false}
                    onCheckedChange={(checked) => updateSettings('collectPayment', checked)}
                    disabled
                  />
                </div>
                <p className="text-sm text-muted-foreground italic">
                  Payment collection will be available in a future update
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Styling Tab */}
        <TabsContent value="styling" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Form Appearance</CardTitle>
              <CardDescription>Customize how your form looks when shared publicly</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label>Primary Color</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="color"
                      value={form.styling?.primaryColor || '#3b82f6'}
                      onChange={(e) => updateStyling('primaryColor', e.target.value)}
                      className="w-12 h-10 p-1"
                    />
                    <Input
                      value={form.styling?.primaryColor || '#3b82f6'}
                      onChange={(e) => updateStyling('primaryColor', e.target.value)}
                      className="flex-1 font-mono"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Background Color</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="color"
                      value={form.styling?.backgroundColor || '#ffffff'}
                      onChange={(e) => updateStyling('backgroundColor', e.target.value)}
                      className="w-12 h-10 p-1"
                    />
                    <Input
                      value={form.styling?.backgroundColor || '#ffffff'}
                      onChange={(e) => updateStyling('backgroundColor', e.target.value)}
                      className="flex-1 font-mono"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Logo URL</Label>
                  <Input
                    value={form.styling?.logo || ''}
                    onChange={(e) => updateStyling('logo', e.target.value)}
                    placeholder="https://example.com/logo.png"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Header Image URL</Label>
                  <Input
                    value={form.styling?.headerImage || ''}
                    onChange={(e) => updateStyling('headerImage', e.target.value)}
                    placeholder="https://example.com/header.jpg"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Field Dialog */}
      <Dialog open={fieldDialogOpen} onOpenChange={setFieldDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingField ? 'Edit Field' : 'Add Field'}</DialogTitle>
            <DialogDescription>Configure the field properties</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Field Type</Label>
              <Select
                value={fieldForm.type}
                onValueChange={(v) => setFieldForm({ ...fieldForm, type: v as FormField['type'] })}
                disabled={!!editingField}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Label</Label>
                <Input
                  value={fieldForm.label}
                  onChange={(e) => setFieldForm({ ...fieldForm, label: e.target.value })}
                  placeholder="e.g., Full Name"
                />
              </div>
              <div className="space-y-2">
                <Label>Field Name (ID)</Label>
                <Input
                  value={fieldForm.name}
                  onChange={(e) => setFieldForm({ ...fieldForm, name: e.target.value })}
                  placeholder="Auto-generated from label"
                />
              </div>
            </div>

            {fieldForm.type !== 'section' && fieldForm.type !== 'checkbox' && (
              <div className="space-y-2">
                <Label>Placeholder</Label>
                <Input
                  value={fieldForm.placeholder}
                  onChange={(e) => setFieldForm({ ...fieldForm, placeholder: e.target.value })}
                  placeholder="Placeholder text..."
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Help Text</Label>
              <Input
                value={fieldForm.helpText}
                onChange={(e) => setFieldForm({ ...fieldForm, helpText: e.target.value })}
                placeholder="Additional instructions for the user"
              />
            </div>

            {/* Options for select/radio */}
            {(fieldForm.type === 'select' || fieldForm.type === 'radio') && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Options</Label>
                  <Button variant="outline" size="sm" onClick={addOption}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Option
                  </Button>
                </div>
                <div className="space-y-2">
                  {(fieldForm.options || []).map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        value={option.label}
                        onChange={(e) => updateOption(index, 'label', e.target.value)}
                        placeholder="Option label"
                        className="flex-1"
                      />
                      <Input
                        value={option.value}
                        onChange={(e) => updateOption(index, 'value', e.target.value)}
                        placeholder="Value"
                        className="w-32"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeOption(index)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Width</Label>
                <Select
                  value={fieldForm.width}
                  onValueChange={(v) =>
                    setFieldForm({ ...fieldForm, width: v as FormField['width'] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WIDTH_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between pt-8">
                <Label>Required</Label>
                <Switch
                  checked={fieldForm.required}
                  onCheckedChange={(checked) => setFieldForm({ ...fieldForm, required: checked })}
                />
              </div>
            </div>

            {/* Validation settings */}
            {(fieldForm.type === 'text' || fieldForm.type === 'textarea') && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Min Length</Label>
                  <Input
                    type="number"
                    value={fieldForm.validation?.minLength || ''}
                    onChange={(e) =>
                      setFieldForm({
                        ...fieldForm,
                        validation: {
                          ...fieldForm.validation,
                          minLength: e.target.value ? parseInt(e.target.value) : undefined,
                        },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Length</Label>
                  <Input
                    type="number"
                    value={fieldForm.validation?.maxLength || ''}
                    onChange={(e) =>
                      setFieldForm({
                        ...fieldForm,
                        validation: {
                          ...fieldForm.validation,
                          maxLength: e.target.value ? parseInt(e.target.value) : undefined,
                        },
                      })
                    }
                  />
                </div>
              </div>
            )}

            {fieldForm.type === 'number' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Min Value</Label>
                  <Input
                    type="number"
                    value={fieldForm.validation?.min || ''}
                    onChange={(e) =>
                      setFieldForm({
                        ...fieldForm,
                        validation: {
                          ...fieldForm.validation,
                          min: e.target.value ? parseInt(e.target.value) : undefined,
                        },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Value</Label>
                  <Input
                    type="number"
                    value={fieldForm.validation?.max || ''}
                    onChange={(e) =>
                      setFieldForm({
                        ...fieldForm,
                        validation: {
                          ...fieldForm.validation,
                          max: e.target.value ? parseInt(e.target.value) : undefined,
                        },
                      })
                    }
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFieldDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveField}>{editingField ? 'Update Field' : 'Add Field'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publish Dialog */}
      <AlertDialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {form.status === 'published' ? 'Unpublish Form?' : 'Publish Form?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {form.status === 'published'
                ? 'This will make the form inaccessible to the public. Existing submissions will be preserved.'
                : 'This will make the form publicly accessible. Anyone with the link can submit responses.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePublish} disabled={publishing}>
              {publishing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {form.status === 'published' ? 'Unpublish' : 'Publish'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Discard Changes Dialog */}
      <AlertDialog open={discardDialogOpen} onOpenChange={setDiscardDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard Changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to discard them?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                fetchForm();
                setHasChanges(false);
                setDiscardDialogOpen(false);
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

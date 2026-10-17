'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  Copy,
  Eye,
  Code,
  Users,
  GraduationCap,
  CreditCard,
} from 'lucide-react';
import { toast } from 'sonner';
import { certificatesApi } from '@/lib/api';

interface CertificateField {
  name: string;
  label: string;
  type: 'text' | 'date' | 'number' | 'select';
  required: boolean;
  options?: string[];
}

interface CertificateType {
  _id: string;
  name: string;
  code: string;
  category: 'student' | 'staff';
  template: string;
  fields: CertificateField[];
  requiresApproval: boolean;
  approvalLevels?: number;
  sequencePrefix: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

interface IdCardTemplate {
  _id: string;
  name: string;
  category: 'student' | 'staff';
  frontTemplate: string;
  backTemplate?: string;
  dimensions: {
    width: number;
    height: number;
    unit: 'mm' | 'cm' | 'in';
  };
  status: 'active' | 'inactive';
  createdAt: string;
}

// Available placeholders for templates
const STUDENT_PLACEHOLDERS = [
  { key: '{studentName}', description: 'Full name of the student' },
  { key: '{admissionNumber}', description: 'Student admission number' },
  { key: '{rollNumber}', description: 'Student roll number' },
  { key: '{class}', description: 'Class/Grade name' },
  { key: '{section}', description: 'Section name' },
  { key: '{academicYear}', description: 'Current academic year' },
  { key: '{dateOfBirth}', description: 'Date of birth' },
  { key: '{fatherName}', description: "Father's name" },
  { key: '{motherName}', description: "Mother's name" },
  { key: '{address}', description: 'Full address' },
  { key: '{phone}', description: 'Contact phone' },
  { key: '{email}', description: 'Email address' },
  { key: '{photo}', description: 'Student photo URL' },
  { key: '{issueDate}', description: 'Certificate issue date' },
  { key: '{certificateNumber}', description: 'Unique certificate number' },
  { key: '{organizationName}', description: 'Institution name' },
  { key: '{branchName}', description: 'Branch name' },
];

const STAFF_PLACEHOLDERS = [
  { key: '{employeeName}', description: 'Full name of the employee' },
  { key: '{employeeId}', description: 'Employee ID' },
  { key: '{designation}', description: 'Job designation' },
  { key: '{department}', description: 'Department name' },
  { key: '{joiningDate}', description: 'Date of joining' },
  { key: '{exitDate}', description: 'Date of exit (if applicable)' },
  { key: '{salary}', description: 'Current salary' },
  { key: '{yearsOfService}', description: 'Years of service' },
  { key: '{monthsOfService}', description: 'Additional months of service' },
  { key: '{purpose}', description: 'Purpose of certificate' },
  { key: '{validityDays}', description: 'Validity period in days' },
  { key: '{phone}', description: 'Contact phone' },
  { key: '{email}', description: 'Email address' },
  { key: '{photo}', description: 'Employee photo URL' },
  { key: '{issueDate}', description: 'Certificate issue date' },
  { key: '{certificateNumber}', description: 'Unique certificate number' },
  { key: '{organizationName}', description: 'Institution name' },
  { key: '{branchName}', description: 'Branch name' },
];

const DEFAULT_CERTIFICATE_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Times New Roman', serif; padding: 40px; }
    .certificate { border: 3px double #333; padding: 40px; text-align: center; }
    .header { font-size: 24px; font-weight: bold; margin-bottom: 20px; }
    .content { font-size: 16px; line-height: 1.8; margin: 30px 0; text-align: justify; }
    .footer { margin-top: 40px; display: flex; justify-content: space-between; }
    .signature { text-align: center; }
    .line { border-top: 1px solid #333; width: 150px; margin: 0 auto; }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="header">{organizationName}</div>
    <h2>CERTIFICATE</h2>
    <div class="content">
      This is to certify that <strong>{studentName}</strong> (Admission No: {admissionNumber})
      is a bonafide student of {class} - {section} during the academic year {academicYear}.
    </div>
    <div class="footer">
      <div class="signature">
        <div class="line"></div>
        <p>Date: {issueDate}</p>
      </div>
      <div class="signature">
        <div class="line"></div>
        <p>Principal</p>
      </div>
    </div>
    <p style="margin-top: 20px; font-size: 12px;">Certificate No: {certificateNumber}</p>
  </div>
</body>
</html>`;

const DEFAULT_ID_CARD_FRONT = `<div style="width: 100%; height: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 15px; color: white; font-family: Arial, sans-serif;">
  <div style="text-align: center; margin-bottom: 10px;">
    <h3 style="margin: 0; font-size: 14px;">{organizationName}</h3>
    <p style="margin: 2px 0; font-size: 10px;">{branchName}</p>
  </div>
  <div style="text-align: center; margin: 10px 0;">
    <img src="{photo}" style="width: 60px; height: 70px; border: 2px solid white; object-fit: cover;" />
  </div>
  <div style="text-align: center;">
    <h4 style="margin: 5px 0; font-size: 12px;">{studentName}</h4>
    <p style="margin: 2px 0; font-size: 10px;">Admission No: {admissionNumber}</p>
    <p style="margin: 2px 0; font-size: 10px;">{class} - {section}</p>
  </div>
</div>`;

const DEFAULT_ID_CARD_BACK = `<div style="width: 100%; height: 100%; background: white; padding: 15px; font-family: Arial, sans-serif; font-size: 9px;">
  <p><strong>Father:</strong> {fatherName}</p>
  <p><strong>DOB:</strong> {dateOfBirth}</p>
  <p><strong>Phone:</strong> {phone}</p>
  <p><strong>Address:</strong> {address}</p>
  <div style="margin-top: 10px; padding-top: 5px; border-top: 1px solid #ccc; text-align: center;">
    <p style="font-size: 8px;">Valid for: {academicYear}</p>
  </div>
</div>`;

export default function CertificateTemplatesPage() {
  const [certificateTypes, setCertificateTypes] = useState<CertificateType[]>([]);
  const [idCardTemplates, setIdCardTemplates] = useState<IdCardTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('certificates');

  // Certificate Type Dialog State
  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<CertificateType | null>(null);
  const [typeForm, setTypeForm] = useState({
    name: '',
    code: '',
    category: 'student' as 'student' | 'staff',
    template: DEFAULT_CERTIFICATE_TEMPLATE,
    requiresApproval: true,
    approvalLevels: 1,
    sequencePrefix: 'CERT',
    fields: [] as CertificateField[],
  });
  const [typeSaving, setTypeSaving] = useState(false);

  // ID Card Template Dialog State
  const [idCardDialogOpen, setIdCardDialogOpen] = useState(false);
  const [editingIdCard, setEditingIdCard] = useState<IdCardTemplate | null>(null);
  const [idCardForm, setIdCardForm] = useState({
    name: '',
    category: 'student' as 'student' | 'staff',
    frontTemplate: DEFAULT_ID_CARD_FRONT,
    backTemplate: DEFAULT_ID_CARD_BACK,
    width: 85.6,
    height: 53.98,
    unit: 'mm' as 'mm' | 'cm' | 'in',
  });
  const [idCardSaving, setIdCardSaving] = useState(false);

  // Preview State
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');

  // Field Dialog State
  const [fieldDialogOpen, setFieldDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<CertificateField | null>(null);
  const [fieldForm, setFieldForm] = useState({
    name: '',
    label: '',
    type: 'text' as CertificateField['type'],
    required: false,
    options: '',
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [typesRes, idCardsRes] = await Promise.all([
        certificatesApi.getTypes(),
        certificatesApi.getIdCardTemplates(),
      ]);
      setCertificateTypes(typesRes.data || []);
      setIdCardTemplates(idCardsRes.data || []);
    } catch (err) {
      console.error('Failed to fetch templates:', err);
      setError('Failed to load templates');
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Certificate Type Handlers
  const handleOpenTypeDialog = (type?: CertificateType) => {
    if (type) {
      setEditingType(type);
      setTypeForm({
        name: type.name,
        code: type.code,
        category: type.category,
        template: type.template,
        requiresApproval: type.requiresApproval,
        approvalLevels: type.approvalLevels || 1,
        sequencePrefix: type.sequencePrefix,
        fields: type.fields || [],
      });
    } else {
      setEditingType(null);
      setTypeForm({
        name: '',
        code: '',
        category: 'student',
        template: DEFAULT_CERTIFICATE_TEMPLATE,
        requiresApproval: true,
        approvalLevels: 1,
        sequencePrefix: 'CERT',
        fields: [],
      });
    }
    setTypeDialogOpen(true);
  };

  const handleSaveType = async () => {
    try {
      setTypeSaving(true);
      if (editingType) {
        await certificatesApi.updateType(editingType._id, {
          name: typeForm.name,
          template: typeForm.template,
          requiresApproval: typeForm.requiresApproval,
          approvalLevels: typeForm.approvalLevels,
          fields: typeForm.fields,
        });
        toast.success('Certificate type updated');
      } else {
        await certificatesApi.createType({
          name: typeForm.name,
          code: typeForm.code,
          category: typeForm.category,
          template: typeForm.template,
          requiresApproval: typeForm.requiresApproval,
          approvalLevels: typeForm.approvalLevels,
          sequencePrefix: typeForm.sequencePrefix,
          fields: typeForm.fields,
        });
        toast.success('Certificate type created');
      }
      setTypeDialogOpen(false);
      fetchData();
    } catch (err) {
      console.error('Failed to save certificate type:', err);
      toast.error('Failed to save certificate type');
    } finally {
      setTypeSaving(false);
    }
  };

  // ID Card Template Handlers
  const handleOpenIdCardDialog = (template?: IdCardTemplate) => {
    if (template) {
      setEditingIdCard(template);
      setIdCardForm({
        name: template.name,
        category: template.category,
        frontTemplate: template.frontTemplate,
        backTemplate: template.backTemplate || '',
        width: template.dimensions.width,
        height: template.dimensions.height,
        unit: template.dimensions.unit,
      });
    } else {
      setEditingIdCard(null);
      setIdCardForm({
        name: '',
        category: 'student',
        frontTemplate: DEFAULT_ID_CARD_FRONT,
        backTemplate: DEFAULT_ID_CARD_BACK,
        width: 85.6,
        height: 53.98,
        unit: 'mm',
      });
    }
    setIdCardDialogOpen(true);
  };

  const handleSaveIdCard = async () => {
    try {
      setIdCardSaving(true);
      const data = {
        name: idCardForm.name,
        category: idCardForm.category,
        frontTemplate: idCardForm.frontTemplate,
        backTemplate: idCardForm.backTemplate || undefined,
        dimensions: {
          width: idCardForm.width,
          height: idCardForm.height,
          unit: idCardForm.unit,
        },
      };
      if (editingIdCard) {
        // TODO: Add updateIdCardTemplate API if needed
        toast.info('Update functionality coming soon');
      } else {
        await certificatesApi.createIdCardTemplate(data);
        toast.success('ID card template created');
      }
      setIdCardDialogOpen(false);
      fetchData();
    } catch (err) {
      console.error('Failed to save ID card template:', err);
      toast.error('Failed to save ID card template');
    } finally {
      setIdCardSaving(false);
    }
  };

  // Field Handlers
  const handleOpenFieldDialog = (field?: CertificateField) => {
    if (field) {
      setEditingField(field);
      setFieldForm({
        name: field.name,
        label: field.label,
        type: field.type,
        required: field.required,
        options: field.options?.join(', ') || '',
      });
    } else {
      setEditingField(null);
      setFieldForm({
        name: '',
        label: '',
        type: 'text',
        required: false,
        options: '',
      });
    }
    setFieldDialogOpen(true);
  };

  const handleSaveField = () => {
    const newField: CertificateField = {
      name: fieldForm.name,
      label: fieldForm.label,
      type: fieldForm.type,
      required: fieldForm.required,
      options:
        fieldForm.type === 'select' && fieldForm.options
          ? fieldForm.options
              .split(',')
              .map((o) => o.trim())
              .filter(Boolean)
          : undefined,
    };

    if (editingField) {
      setTypeForm((prev) => ({
        ...prev,
        fields: prev.fields.map((f) => (f.name === editingField.name ? newField : f)),
      }));
    } else {
      setTypeForm((prev) => ({
        ...prev,
        fields: [...prev.fields, newField],
      }));
    }
    setFieldDialogOpen(false);
  };

  const handleDeleteField = (fieldName: string) => {
    setTypeForm((prev) => ({
      ...prev,
      fields: prev.fields.filter((f) => f.name !== fieldName),
    }));
  };

  // Preview Handler
  const handlePreview = (content: string, title: string) => {
    setPreviewContent(content);
    setPreviewTitle(title);
    setPreviewOpen(true);
  };

  // Copy Placeholder
  const copyPlaceholder = (placeholder: string) => {
    navigator.clipboard.writeText(placeholder);
    toast.success('Placeholder copied');
  };

  const placeholders = typeForm.category === 'student' ? STUDENT_PLACEHOLDERS : STAFF_PLACEHOLDERS;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading templates...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <p className="text-lg font-medium">{error}</p>
          <Button onClick={fetchData} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Certificate Templates"
        description="Manage certificate types and ID card templates"
        actions={[
          {
            label: 'Back to Certificates',
            icon: FileText,
            variant: 'outline',
            href: '/certificates',
          },
        ]}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="certificates" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Certificate Types
          </TabsTrigger>
          <TabsTrigger value="idcards" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            ID Card Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="certificates" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-muted-foreground">
              {certificateTypes.length} certificate type{certificateTypes.length !== 1 ? 's' : ''}{' '}
              configured
            </p>
            <Button onClick={() => handleOpenTypeDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Certificate Type
            </Button>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Approval</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {certificateTypes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No certificate types configured
                    </TableCell>
                  </TableRow>
                ) : (
                  certificateTypes.map((type) => (
                    <TableRow key={type._id}>
                      <TableCell className="font-medium">{type.name}</TableCell>
                      <TableCell>
                        <code className="px-2 py-1 bg-muted rounded text-sm">{type.code}</code>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {type.category === 'student' ? (
                            <GraduationCap className="h-3 w-3 mr-1" />
                          ) : (
                            <Users className="h-3 w-3 mr-1" />
                          )}
                          {type.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {type.requiresApproval ? (
                          <Badge variant="secondary">
                            {type.approvalLevels || 1} Level
                            {(type.approvalLevels || 1) > 1 ? 's' : ''}
                          </Badge>
                        ) : (
                          <Badge variant="outline">None</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={type.status === 'active' ? 'default' : 'secondary'}>
                          {type.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handlePreview(type.template, type.name)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenTypeDialog(type)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="idcards" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-muted-foreground">
              {idCardTemplates.length} ID card template{idCardTemplates.length !== 1 ? 's' : ''}{' '}
              configured
            </p>
            <Button onClick={() => handleOpenIdCardDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Add ID Card Template
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {idCardTemplates.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No ID card templates configured</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => handleOpenIdCardDialog()}
                  >
                    Create First Template
                  </Button>
                </CardContent>
              </Card>
            ) : (
              idCardTemplates.map((template) => (
                <Card key={template._id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <Badge variant={template.status === 'active' ? 'default' : 'secondary'}>
                        {template.status}
                      </Badge>
                    </div>
                    <CardDescription className="flex items-center gap-2">
                      {template.category === 'student' ? (
                        <GraduationCap className="h-4 w-4" />
                      ) : (
                        <Users className="h-4 w-4" />
                      )}
                      {template.category} ID Card
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="text-sm text-muted-foreground">
                        <p>
                          Dimensions: {template.dimensions.width} x {template.dimensions.height}{' '}
                          {template.dimensions.unit}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() =>
                            handlePreview(template.frontTemplate, `${template.name} - Front`)
                          }
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Preview
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenIdCardDialog(template)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Certificate Type Dialog */}
      <Dialog open={typeDialogOpen} onOpenChange={setTypeDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingType ? 'Edit Certificate Type' : 'Create Certificate Type'}
            </DialogTitle>
            <DialogDescription>
              Configure certificate type with HTML template and custom fields
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            {/* Basic Info */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={typeForm.name}
                  onChange={(e) => setTypeForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Bonafide Certificate"
                />
              </div>
              <div className="space-y-2">
                <Label>Code *</Label>
                <Input
                  value={typeForm.code}
                  onChange={(e) =>
                    setTypeForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))
                  }
                  placeholder="e.g., BONAFIDE"
                  disabled={!!editingType}
                />
              </div>
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select
                  value={typeForm.category}
                  onValueChange={(v) =>
                    setTypeForm((prev) => ({ ...prev, category: v as 'student' | 'staff' }))
                  }
                  disabled={!!editingType}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sequence Prefix *</Label>
                <Input
                  value={typeForm.sequencePrefix}
                  onChange={(e) =>
                    setTypeForm((prev) => ({
                      ...prev,
                      sequencePrefix: e.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="e.g., CERT"
                  disabled={!!editingType}
                />
              </div>
            </div>

            {/* Approval Settings */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <Label>Requires Approval</Label>
                <p className="text-sm text-muted-foreground">
                  Certificate needs approval before issuance
                </p>
              </div>
              <div className="flex items-center gap-4">
                <Switch
                  checked={typeForm.requiresApproval}
                  onCheckedChange={(v) => setTypeForm((prev) => ({ ...prev, requiresApproval: v }))}
                />
                {typeForm.requiresApproval && (
                  <Select
                    value={String(typeForm.approvalLevels)}
                    onValueChange={(v) =>
                      setTypeForm((prev) => ({ ...prev, approvalLevels: Number(v) }))
                    }
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 Level</SelectItem>
                      <SelectItem value="2">2 Levels</SelectItem>
                      <SelectItem value="3">3 Levels</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {/* Template Editor */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  HTML Template
                </Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePreview(typeForm.template, 'Template Preview')}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </Button>
              </div>
              <Textarea
                value={typeForm.template}
                onChange={(e) => setTypeForm((prev) => ({ ...prev, template: e.target.value }))}
                className="font-mono text-sm min-h-[300px]"
                placeholder="Enter HTML template..."
              />
            </div>

            {/* Available Placeholders */}
            <div className="space-y-2">
              <Label>Available Placeholders</Label>
              <div className="max-h-40 overflow-y-auto border rounded-lg p-3">
                <div className="grid gap-2 md:grid-cols-2">
                  {placeholders.map((p) => (
                    <div
                      key={p.key}
                      className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm cursor-pointer hover:bg-muted"
                      onClick={() => copyPlaceholder(p.key)}
                    >
                      <div>
                        <code className="text-primary">{p.key}</code>
                        <p className="text-xs text-muted-foreground">{p.description}</p>
                      </div>
                      <Copy className="h-3 w-3 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Custom Fields */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Custom Fields</Label>
                <Button variant="outline" size="sm" onClick={() => handleOpenFieldDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Field
                </Button>
              </div>
              {typeForm.fields.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg">
                  No custom fields added
                </p>
              ) : (
                <div className="border rounded-lg divide-y">
                  {typeForm.fields.map((field) => (
                    <div key={field.name} className="flex items-center justify-between p-3">
                      <div>
                        <p className="font-medium">{field.label}</p>
                        <p className="text-sm text-muted-foreground">
                          {field.type} {field.required && '(required)'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenFieldDialog(field)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteField(field.name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTypeDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveType}
              disabled={typeSaving || !typeForm.name || !typeForm.code}
            >
              {typeSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingType ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ID Card Template Dialog */}
      <Dialog open={idCardDialogOpen} onOpenChange={setIdCardDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingIdCard ? 'Edit ID Card Template' : 'Create ID Card Template'}
            </DialogTitle>
            <DialogDescription>Design ID card front and back with HTML templates</DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            {/* Basic Info */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Template Name *</Label>
                <Input
                  value={idCardForm.name}
                  onChange={(e) => setIdCardForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Student ID Card 2024"
                />
              </div>
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select
                  value={idCardForm.category}
                  onValueChange={(v) =>
                    setIdCardForm((prev) => ({ ...prev, category: v as 'student' | 'staff' }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Dimensions */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Width</Label>
                <Input
                  type="number"
                  value={idCardForm.width}
                  onChange={(e) =>
                    setIdCardForm((prev) => ({ ...prev, width: Number(e.target.value) }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Height</Label>
                <Input
                  type="number"
                  value={idCardForm.height}
                  onChange={(e) =>
                    setIdCardForm((prev) => ({ ...prev, height: Number(e.target.value) }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select
                  value={idCardForm.unit}
                  onValueChange={(v) =>
                    setIdCardForm((prev) => ({ ...prev, unit: v as 'mm' | 'cm' | 'in' }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mm">Millimeters</SelectItem>
                    <SelectItem value="cm">Centimeters</SelectItem>
                    <SelectItem value="in">Inches</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Front Template */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Front Template (HTML)</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePreview(idCardForm.frontTemplate, 'Front Preview')}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </Button>
              </div>
              <Textarea
                value={idCardForm.frontTemplate}
                onChange={(e) =>
                  setIdCardForm((prev) => ({ ...prev, frontTemplate: e.target.value }))
                }
                className="font-mono text-sm min-h-[200px]"
                placeholder="Enter front side HTML..."
              />
            </div>

            {/* Back Template */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Back Template (HTML) - Optional</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePreview(idCardForm.backTemplate, 'Back Preview')}
                  disabled={!idCardForm.backTemplate}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </Button>
              </div>
              <Textarea
                value={idCardForm.backTemplate}
                onChange={(e) =>
                  setIdCardForm((prev) => ({ ...prev, backTemplate: e.target.value }))
                }
                className="font-mono text-sm min-h-[200px]"
                placeholder="Enter back side HTML (optional)..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIdCardDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveIdCard} disabled={idCardSaving || !idCardForm.name}>
              {idCardSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingIdCard ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Field Dialog */}
      <Dialog open={fieldDialogOpen} onOpenChange={setFieldDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingField ? 'Edit Field' : 'Add Field'}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Field Name *</Label>
              <Input
                value={fieldForm.name}
                onChange={(e) =>
                  setFieldForm((prev) => ({
                    ...prev,
                    name: e.target.value.replace(/\s/g, '_').toLowerCase(),
                  }))
                }
                placeholder="e.g., purpose"
                disabled={!!editingField}
              />
            </div>
            <div className="space-y-2">
              <Label>Label *</Label>
              <Input
                value={fieldForm.label}
                onChange={(e) => setFieldForm((prev) => ({ ...prev, label: e.target.value }))}
                placeholder="e.g., Purpose of Certificate"
              />
            </div>
            <div className="space-y-2">
              <Label>Field Type</Label>
              <Select
                value={fieldForm.type}
                onValueChange={(v) =>
                  setFieldForm((prev) => ({ ...prev, type: v as CertificateField['type'] }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="select">Select (Dropdown)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {fieldForm.type === 'select' && (
              <div className="space-y-2">
                <Label>Options (comma-separated)</Label>
                <Input
                  value={fieldForm.options}
                  onChange={(e) => setFieldForm((prev) => ({ ...prev, options: e.target.value }))}
                  placeholder="e.g., Visa, Bank, Employment"
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <Switch
                checked={fieldForm.required}
                onCheckedChange={(v) => setFieldForm((prev) => ({ ...prev, required: v }))}
              />
              <Label>Required field</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFieldDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveField} disabled={!fieldForm.name || !fieldForm.label}>
              {editingField ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{previewTitle}</DialogTitle>
          </DialogHeader>
          <div className="border rounded-lg overflow-hidden bg-white">
            <iframe
              srcDoc={previewContent}
              className="w-full min-h-[400px]"
              title="Template Preview"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

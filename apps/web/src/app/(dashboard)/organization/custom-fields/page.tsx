'use client';

import { useState, useEffect } from 'react';
import { PageHero } from '@/components/ui/page-hero';
import { DataTable, Column, DataTableAction } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Trash2,
  Edit2,
  GripVertical,
  Type,
  Hash,
  Calendar,
  List,
  CheckSquare,
  File,
  AlignLeft,
  GraduationCap,
  Users,
  IndianRupee,
  ClipboardCheck,
  UserPlus,
  Loader2,
  ChevronDown,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import { organizationApi } from '@/lib/api';

type FieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'select'
  | 'multiselect'
  | 'checkbox'
  | 'file'
  | 'textarea';
type ModuleType = 'admission' | 'student' | 'staff' | 'fee' | 'attendance';

interface CustomField {
  _id: string;
  module: ModuleType;
  fieldName: string;
  fieldKey: string;
  fieldType: FieldType;
  options?: string[];
  required: boolean;
  showInList: boolean;
  showInFilters: boolean;
  status: 'active' | 'inactive';
  displayOrder: number;
}

const fieldTypeIcons: Record<FieldType, React.ReactNode> = {
  text: <Type className="h-4 w-4" />,
  number: <Hash className="h-4 w-4" />,
  date: <Calendar className="h-4 w-4" />,
  select: <List className="h-4 w-4" />,
  multiselect: <List className="h-4 w-4" />,
  checkbox: <CheckSquare className="h-4 w-4" />,
  file: <File className="h-4 w-4" />,
  textarea: <AlignLeft className="h-4 w-4" />,
};

const moduleIcons: Record<ModuleType, React.ReactNode> = {
  admission: <UserPlus className="h-4 w-4" />,
  student: <GraduationCap className="h-4 w-4" />,
  staff: <Users className="h-4 w-4" />,
  fee: <IndianRupee className="h-4 w-4" />,
  attendance: <ClipboardCheck className="h-4 w-4" />,
};

interface PrimaryField {
  fieldName: string;
  fieldKey: string;
  fieldType: FieldType;
  required: boolean;
  description?: string;
}

const PRIMARY_FIELDS: Record<ModuleType, PrimaryField[]> = {
  admission: [
    { fieldName: 'First Name', fieldKey: 'firstName', fieldType: 'text', required: true },
    { fieldName: 'Last Name', fieldKey: 'lastName', fieldType: 'text', required: true },
    { fieldName: 'Date of Birth', fieldKey: 'dateOfBirth', fieldType: 'date', required: true },
    { fieldName: 'Gender', fieldKey: 'gender', fieldType: 'select', required: true },
    { fieldName: 'Email', fieldKey: 'email', fieldType: 'text', required: false },
    { fieldName: 'Phone', fieldKey: 'phone', fieldType: 'text', required: true },
    { fieldName: 'Address', fieldKey: 'address', fieldType: 'textarea', required: false },
    {
      fieldName: 'Previous School',
      fieldKey: 'previousSchool',
      fieldType: 'text',
      required: false,
    },
    { fieldName: 'Class Applied', fieldKey: 'classApplied', fieldType: 'select', required: true },
    { fieldName: 'Father Name', fieldKey: 'fatherName', fieldType: 'text', required: false },
    { fieldName: 'Mother Name', fieldKey: 'motherName', fieldType: 'text', required: false },
  ],
  student: [
    {
      fieldName: 'Admission Number',
      fieldKey: 'admissionNumber',
      fieldType: 'text',
      required: true,
    },
    { fieldName: 'First Name', fieldKey: 'firstName', fieldType: 'text', required: true },
    { fieldName: 'Last Name', fieldKey: 'lastName', fieldType: 'text', required: true },
    { fieldName: 'Date of Birth', fieldKey: 'dateOfBirth', fieldType: 'date', required: true },
    { fieldName: 'Gender', fieldKey: 'gender', fieldType: 'select', required: true },
    { fieldName: 'Blood Group', fieldKey: 'bloodGroup', fieldType: 'select', required: false },
    { fieldName: 'Nationality', fieldKey: 'nationality', fieldType: 'text', required: false },
    { fieldName: 'Religion', fieldKey: 'religion', fieldType: 'text', required: false },
    { fieldName: 'Category', fieldKey: 'category', fieldType: 'select', required: false },
    { fieldName: 'Aadhar Number', fieldKey: 'aadharNumber', fieldType: 'text', required: false },
    { fieldName: 'Photo', fieldKey: 'photo', fieldType: 'file', required: false },
    { fieldName: 'Email', fieldKey: 'contact.email', fieldType: 'text', required: false },
    { fieldName: 'Phone', fieldKey: 'contact.phone', fieldType: 'text', required: false },
    {
      fieldName: 'Current Address',
      fieldKey: 'contact.address.current',
      fieldType: 'textarea',
      required: false,
    },
    {
      fieldName: 'Father Name',
      fieldKey: 'parents.father.name',
      fieldType: 'text',
      required: false,
    },
    {
      fieldName: 'Father Phone',
      fieldKey: 'parents.father.phone',
      fieldType: 'text',
      required: false,
    },
    {
      fieldName: 'Mother Name',
      fieldKey: 'parents.mother.name',
      fieldType: 'text',
      required: false,
    },
    {
      fieldName: 'Mother Phone',
      fieldKey: 'parents.mother.phone',
      fieldType: 'text',
      required: false,
    },
    { fieldName: 'Admission Date', fieldKey: 'admissionDate', fieldType: 'date', required: true },
  ],
  staff: [
    { fieldName: 'Employee ID', fieldKey: 'employeeId', fieldType: 'text', required: true },
    { fieldName: 'First Name', fieldKey: 'firstName', fieldType: 'text', required: true },
    { fieldName: 'Last Name', fieldKey: 'lastName', fieldType: 'text', required: true },
    { fieldName: 'Date of Birth', fieldKey: 'dateOfBirth', fieldType: 'date', required: true },
    { fieldName: 'Gender', fieldKey: 'gender', fieldType: 'select', required: true },
    { fieldName: 'Blood Group', fieldKey: 'bloodGroup', fieldType: 'select', required: false },
    { fieldName: 'Nationality', fieldKey: 'nationality', fieldType: 'text', required: false },
    { fieldName: 'Photo', fieldKey: 'photo', fieldType: 'file', required: false },
    { fieldName: 'Email', fieldKey: 'contact.email', fieldType: 'text', required: false },
    { fieldName: 'Phone', fieldKey: 'contact.phone', fieldType: 'text', required: true },
    {
      fieldName: 'Current Address',
      fieldKey: 'contact.address.current',
      fieldType: 'textarea',
      required: false,
    },
    {
      fieldName: 'Joining Date',
      fieldKey: 'employment.joiningDate',
      fieldType: 'date',
      required: true,
    },
    {
      fieldName: 'Employment Type',
      fieldKey: 'employment.employmentType',
      fieldType: 'select',
      required: true,
    },
    {
      fieldName: 'Department',
      fieldKey: 'employment.departmentId',
      fieldType: 'select',
      required: false,
    },
    {
      fieldName: 'Designation',
      fieldKey: 'employment.designationId',
      fieldType: 'select',
      required: false,
    },
    {
      fieldName: 'Bank Account Number',
      fieldKey: 'bankDetails.accountNumber',
      fieldType: 'text',
      required: false,
    },
    {
      fieldName: 'Bank Name',
      fieldKey: 'bankDetails.bankName',
      fieldType: 'text',
      required: false,
    },
    {
      fieldName: 'IFSC Code',
      fieldKey: 'bankDetails.ifscCode',
      fieldType: 'text',
      required: false,
    },
  ],
  fee: [
    { fieldName: 'Fee Name', fieldKey: 'name', fieldType: 'text', required: true },
    { fieldName: 'Amount', fieldKey: 'amount', fieldType: 'number', required: true },
    { fieldName: 'Due Date', fieldKey: 'dueDate', fieldType: 'date', required: true },
    { fieldName: 'Fee Type', fieldKey: 'feeType', fieldType: 'select', required: true },
    { fieldName: 'Frequency', fieldKey: 'frequency', fieldType: 'select', required: true },
    { fieldName: 'Description', fieldKey: 'description', fieldType: 'textarea', required: false },
    { fieldName: 'Is Optional', fieldKey: 'isOptional', fieldType: 'checkbox', required: false },
    { fieldName: 'Late Fee', fieldKey: 'lateFee', fieldType: 'number', required: false },
  ],
  attendance: [
    { fieldName: 'Date', fieldKey: 'date', fieldType: 'date', required: true },
    {
      fieldName: 'Status',
      fieldKey: 'status',
      fieldType: 'select',
      required: true,
      description: 'Present, Absent, Late, Half-day',
    },
    { fieldName: 'In Time', fieldKey: 'inTime', fieldType: 'text', required: false },
    { fieldName: 'Out Time', fieldKey: 'outTime', fieldType: 'text', required: false },
    { fieldName: 'Remarks', fieldKey: 'remarks', fieldType: 'textarea', required: false },
  ],
};

export default function CustomFieldsPage() {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeModule, setActiveModule] = useState<ModuleType>('student');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [saving, setSaving] = useState(false);
  const [primaryFieldsOpen, setPrimaryFieldsOpen] = useState(false);

  const [newField, setNewField] = useState({
    fieldName: '',
    fieldKey: '',
    fieldType: 'text' as FieldType,
    options: '',
    required: false,
    showInList: false,
    showInFilters: false,
  });

  const [editForm, setEditForm] = useState({
    fieldName: '',
    fieldType: 'text' as FieldType,
    options: '',
    required: false,
    showInList: false,
    showInFilters: false,
  });

  useEffect(() => {
    loadFields();
  }, []);

  useEffect(() => {
    if (editingField) {
      setEditForm({
        fieldName: editingField.fieldName,
        fieldType: editingField.fieldType,
        options: editingField.options?.join(', ') ?? '',
        required: editingField.required,
        showInList: editingField.showInList,
        showInFilters: editingField.showInFilters,
      });
    }
  }, [editingField]);

  const loadFields = async () => {
    try {
      setLoading(true);
      const response = await organizationApi.getCustomFields();
      // API returns { fields: [...], byModule: {...}, total: number }
      const fieldsData = response.data?.fields || [];
      setFields(fieldsData);
    } catch (error) {
      console.error('Failed to load custom fields:', error);
      toast.error('Failed to load custom fields');
      setFields([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredFields = Array.isArray(fields)
    ? fields.filter((f) => f.module === activeModule)
    : [];

  const handleCreateField = async () => {
    if (!newField.fieldName || !newField.fieldKey) {
      toast.error('Please fill required fields');
      return;
    }

    try {
      setSaving(true);
      const response = await organizationApi.createCustomField({
        module: activeModule,
        fieldName: newField.fieldName,
        fieldKey: newField.fieldKey,
        fieldType: newField.fieldType,
        options: newField.options ? newField.options.split(',').map((o) => o.trim()) : undefined,
        required: newField.required,
        showInList: newField.showInList,
        showInFilters: newField.showInFilters,
      });

      setFields([...fields, response.data]);
      setIsCreateOpen(false);
      setNewField({
        fieldName: '',
        fieldKey: '',
        fieldType: 'text',
        options: '',
        required: false,
        showInList: false,
        showInFilters: false,
      });
      toast.success('Field created successfully');
    } catch (error) {
      console.error('Failed to create field:', error);
      toast.error('Failed to create field');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (field: CustomField) => {
    try {
      await organizationApi.deleteCustomField(field._id);
      setFields(fields.filter((f) => f._id !== field._id));
      toast.success('Field deleted');
    } catch (error) {
      console.error('Failed to delete field:', error);
      toast.error('Failed to delete field');
    }
  };

  const handleUpdateField = async () => {
    if (!editingField) return;
    if (!editForm.fieldName.trim()) {
      toast.error('Field name is required');
      return;
    }
    if (
      (editForm.fieldType === 'select' || editForm.fieldType === 'multiselect') &&
      !editForm.options.trim()
    ) {
      toast.error('Options are required for select and multi-select fields');
      return;
    }

    try {
      setSaving(true);
      const response = await organizationApi.updateCustomField(editingField._id, {
        fieldName: editForm.fieldName,
        fieldType: editForm.fieldType,
        options: editForm.options
          ? editForm.options
              .split(',')
              .map((o) => o.trim())
              .filter(Boolean)
          : undefined,
        required: editForm.required,
        showInList: editForm.showInList,
        showInFilters: editForm.showInFilters,
      });

      const updated = response.data as CustomField;
      setFields(fields.map((f) => (f._id === editingField._id ? updated : f)));
      setEditingField(null);
      toast.success('Field updated successfully');
    } catch (error) {
      console.error('Failed to update field:', error);
      toast.error('Failed to update field');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (field: CustomField) => {
    const newStatus = field.status === 'active' ? 'inactive' : 'active';
    try {
      await organizationApi.updateCustomField(field._id, { status: newStatus });
      setFields(fields.map((f) => (f._id === field._id ? { ...f, status: newStatus } : f)));
      toast.success(`Field ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
    } catch (error) {
      console.error('Failed to update field status:', error);
      toast.error('Failed to update field status');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const columns: Column<CustomField>[] = [
    {
      key: 'displayOrder',
      header: '',
      cell: () => (
        <div className="cursor-move text-muted-foreground">
          <GripVertical className="h-4 w-4" />
        </div>
      ),
    },
    {
      key: 'fieldName',
      header: 'Field Name',
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted">{fieldTypeIcons[row.fieldType]}</div>
          <div>
            <p className="font-medium">{row.fieldName}</p>
            <code className="text-xs text-muted-foreground">{row.fieldKey}</code>
          </div>
        </div>
      ),
    },
    {
      key: 'fieldType',
      header: 'Type',
      cell: (row) => (
        <Badge variant="outline" className="capitalize">
          {row.fieldType}
        </Badge>
      ),
    },
    {
      key: 'required',
      header: 'Required',
      cell: (row) => (
        <Badge variant={row.required ? 'destructive' : 'secondary'}>
          {row.required ? 'Yes' : 'No'}
        </Badge>
      ),
    },
    {
      key: 'showInList',
      header: 'Show in List',
      cell: (row) => (
        <span className={row.showInList ? 'text-success' : 'text-muted-foreground'}>
          {row.showInList ? 'Yes' : 'No'}
        </span>
      ),
    },
    {
      key: 'showInFilters',
      header: 'Show in Filters',
      cell: (row) => (
        <span className={row.showInFilters ? 'text-success' : 'text-muted-foreground'}>
          {row.showInFilters ? 'Yes' : 'No'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => (
        <Badge variant={row.status === 'active' ? 'success' : 'secondary'}>{row.status}</Badge>
      ),
    },
  ];

  const actions: DataTableAction<CustomField>[] = [
    {
      label: 'Edit',
      icon: <Edit2 className="mr-2 h-4 w-4" />,
      onClick: (field) => setEditingField(field),
    },
    {
      label: 'Toggle Status',
      icon: <CheckSquare className="mr-2 h-4 w-4" />,
      onClick: handleToggleStatus,
    },
    {
      label: 'Delete',
      icon: <Trash2 className="mr-2 h-4 w-4" />,
      variant: 'destructive',
      onClick: handleDelete,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHero
        icon={Type}
        eyebrow="Organization"
        title="Custom Fields"
        description="Configure custom fields for various modules"
        actions={
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Field
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Custom Field</DialogTitle>
                <DialogDescription>
                  Add a new custom field to the {activeModule} module
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Field Name *</Label>
                    <Input
                      value={newField.fieldName}
                      onChange={(e) => setNewField({ ...newField, fieldName: e.target.value })}
                      placeholder="e.g., Blood Group"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Field Key *</Label>
                    <Input
                      value={newField.fieldKey}
                      onChange={(e) =>
                        setNewField({
                          ...newField,
                          fieldKey: e.target.value.toLowerCase().replace(/\s+/g, '_'),
                        })
                      }
                      placeholder="e.g., blood_group"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Field Type</Label>
                  <Select
                    value={newField.fieldType}
                    onValueChange={(v) => setNewField({ ...newField, fieldType: v as FieldType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="date">Date</SelectItem>
                      <SelectItem value="select">Select (Dropdown)</SelectItem>
                      <SelectItem value="multiselect">Multi-select</SelectItem>
                      <SelectItem value="checkbox">Checkbox</SelectItem>
                      <SelectItem value="file">File Upload</SelectItem>
                      <SelectItem value="textarea">Text Area</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(newField.fieldType === 'select' || newField.fieldType === 'multiselect') && (
                  <div className="space-y-2">
                    <Label>Options (comma-separated)</Label>
                    <Input
                      value={newField.options}
                      onChange={(e) => setNewField({ ...newField, options: e.target.value })}
                      placeholder="e.g., Option 1, Option 2, Option 3"
                    />
                  </div>
                )}
                {/* Visibility & behaviour toggles */}
                <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Field Behaviour
                  </p>
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-0.5">
                      <Label className="text-sm">Required Field</Label>
                      <p className="text-[11px] text-muted-foreground">
                        Users must fill this field when adding or editing a {activeModule} record.
                        Empty submissions will be blocked.
                      </p>
                    </div>
                    <Switch
                      checked={newField.required}
                      onCheckedChange={(v: boolean) => setNewField({ ...newField, required: v })}
                    />
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-0.5">
                      <Label className="text-sm">Show in List</Label>
                      <p className="text-[11px] text-muted-foreground">
                        Display this field as a column in the {activeModule} list/table view so
                        it&apos;s visible at a glance without opening a record.
                      </p>
                    </div>
                    <Switch
                      checked={newField.showInList}
                      onCheckedChange={(v: boolean) => setNewField({ ...newField, showInList: v })}
                    />
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-0.5">
                      <Label className="text-sm">Show in Filters</Label>
                      <p className="text-[11px] text-muted-foreground">
                        Add this field to the filter popover on the {activeModule} list page. Users
                        can narrow results by this field&apos;s value (e.g. filter students by blood
                        group or transport route).
                      </p>
                    </div>
                    <Switch
                      checked={newField.showInFilters}
                      onCheckedChange={(v: boolean) =>
                        setNewField({ ...newField, showInFilters: v })
                      }
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={handleCreateField} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Field
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Tabs value={activeModule} onValueChange={(v) => setActiveModule(v as ModuleType)}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="admission" className="gap-2">
            {moduleIcons.admission}
            Admission
          </TabsTrigger>
          <TabsTrigger value="student" className="gap-2">
            {moduleIcons.student}
            Student
          </TabsTrigger>
          <TabsTrigger value="staff" className="gap-2">
            {moduleIcons.staff}
            Staff
          </TabsTrigger>
          <TabsTrigger value="fee" className="gap-2">
            {moduleIcons.fee}
            Fee
          </TabsTrigger>
          <TabsTrigger value="attendance" className="gap-2">
            {moduleIcons.attendance}
            Attendance
          </TabsTrigger>
        </TabsList>

        {(['admission', 'student', 'staff', 'fee', 'attendance'] as ModuleType[]).map((module) => {
          const moduleInfo: Record<ModuleType, { where: string; examples: string }> = {
            admission: {
              where:
                'These fields appear in the Add Lead and Lead/Application forms. When "Show in List" is on, they show as columns in the leads table. When "Show in Filters" is on, they appear in the filter popover so you can narrow leads by that value.',
              examples:
                'E.g. "Referral Source Details", "Preferred Batch", "Previous School Name".',
            },
            student: {
              where:
                'These fields appear in the Add/Edit Student form and the student profile. When "Show in List" is on, they show as columns in the Students directory. When "Show in Filters" is on, they appear in the filter popover so you can filter the student list by that value.',
              examples: 'E.g. "Blood Group", "Transport Route", "House/Section", "Aadhar Number".',
            },
            staff: {
              where:
                'These fields appear in the Add/Edit Staff form and the staff profile. When "Show in List" is on, they show as columns in the Staff directory. When "Show in Filters" is on, they appear as staff list filters.',
              examples: 'E.g. "Specialization", "Qualification Year", "Bank Account Number".',
            },
            fee: {
              where:
                'These fields appear in fee-related forms (fee assignment, concession requests). They can capture additional metadata alongside fee transactions.',
              examples: 'E.g. "Scholarship ID", "Fee Waiver Reason", "Instalment Preference".',
            },
            attendance: {
              where:
                'These fields appear when marking or viewing attendance. They capture extra context per attendance record.',
              examples: 'E.g. "Arrival Mode", "Late Reason Category", "Parent Notified".',
            },
          };
          const info = moduleInfo[module];

          return (
            <TabsContent key={module} value={module} className="space-y-4">
              {/* Primary Fields - Collapsible */}
              <Collapsible open={primaryFieldsOpen} onOpenChange={setPrimaryFieldsOpen}>
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2 text-base">
                            <Lock className="h-4 w-4 text-muted-foreground" />
                            Primary Fields
                            <Badge variant="secondary" className="ml-2">
                              {PRIMARY_FIELDS[module].length}
                            </Badge>
                          </CardTitle>
                          <CardDescription>Built-in fields that cannot be modified</CardDescription>
                        </div>
                        <ChevronDown
                          className={`h-5 w-5 text-muted-foreground transition-transform ${
                            primaryFieldsOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-left px-4 py-2 font-medium">Field Name</th>
                              <th className="text-left px-4 py-2 font-medium">Key</th>
                              <th className="text-left px-4 py-2 font-medium">Type</th>
                              <th className="text-left px-4 py-2 font-medium">Required</th>
                            </tr>
                          </thead>
                          <tbody>
                            {PRIMARY_FIELDS[module].map((field, idx) => (
                              <tr
                                key={field.fieldKey}
                                className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}
                              >
                                <td className="px-4 py-2">
                                  <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded bg-muted">
                                      {fieldTypeIcons[field.fieldType]}
                                    </div>
                                    {field.fieldName}
                                  </div>
                                </td>
                                <td className="px-4 py-2">
                                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                    {field.fieldKey}
                                  </code>
                                </td>
                                <td className="px-4 py-2">
                                  <Badge variant="outline" className="capitalize">
                                    {field.fieldType}
                                  </Badge>
                                </td>
                                <td className="px-4 py-2">
                                  <Badge variant={field.required ? 'destructive' : 'secondary'}>
                                    {field.required ? 'Yes' : 'No'}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>

              {/* Module info card */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    {moduleIcons[module]}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Where do {module} custom fields show up?</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{info.where}</p>
                    <p className="text-xs text-muted-foreground/80 italic">{info.examples}</p>
                  </div>
                </div>
              </div>

              {/* Custom Fields */}
              <Card>
                <CardHeader>
                  <CardTitle className="capitalize flex items-center gap-2">
                    Custom Fields
                    {filteredFields.length > 0 && (
                      <Badge variant="secondary">{filteredFields.length}</Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Additional fields you&apos;ve added to the {module} module. Drag to reorder.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {filteredFields.length > 0 ? (
                    <DataTable data={filteredFields} columns={columns} actions={actions} />
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <p>No custom fields configured for this module.</p>
                      <Button
                        variant="outline"
                        className="mt-4 gap-2"
                        onClick={() => setIsCreateOpen(true)}
                      >
                        <Plus className="h-4 w-4" />
                        Add First Field
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>

      <Dialog open={!!editingField} onOpenChange={(open) => !open && setEditingField(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Custom Field</DialogTitle>
            <DialogDescription>
              Update the configuration for this custom field. The field key cannot be changed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Field Name *</Label>
                <Input
                  value={editForm.fieldName}
                  onChange={(e) => setEditForm({ ...editForm, fieldName: e.target.value })}
                  placeholder="e.g., Blood Group"
                />
              </div>
              <div className="space-y-2">
                <Label>Field Key</Label>
                <Input value={editingField?.fieldKey ?? ''} disabled />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Field Type</Label>
              <Select
                value={editForm.fieldType}
                onValueChange={(v) => setEditForm({ ...editForm, fieldType: v as FieldType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="select">Select (Dropdown)</SelectItem>
                  <SelectItem value="multiselect">Multi-select</SelectItem>
                  <SelectItem value="checkbox">Checkbox</SelectItem>
                  <SelectItem value="file">File Upload</SelectItem>
                  <SelectItem value="textarea">Text Area</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(editForm.fieldType === 'select' || editForm.fieldType === 'multiselect') && (
              <div className="space-y-2">
                <Label>Options (comma-separated)</Label>
                <Input
                  value={editForm.options}
                  onChange={(e) => setEditForm({ ...editForm, options: e.target.value })}
                  placeholder="e.g., Option 1, Option 2, Option 3"
                />
              </div>
            )}
            {/* Visibility & behaviour toggles */}
            <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Field Behaviour
              </p>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <Label className="text-sm">Required Field</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Users must fill this field when adding or editing a{' '}
                    {editingField?.module || 'module'} record. Empty submissions will be blocked.
                  </p>
                </div>
                <Switch
                  checked={editForm.required}
                  onCheckedChange={(v: boolean) => setEditForm({ ...editForm, required: v })}
                />
              </div>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <Label className="text-sm">Show in List</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Display this field as a column in the {editingField?.module || 'module'}{' '}
                    list/table view so it&apos;s visible at a glance without opening a record.
                  </p>
                </div>
                <Switch
                  checked={editForm.showInList}
                  onCheckedChange={(v: boolean) => setEditForm({ ...editForm, showInList: v })}
                />
              </div>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <Label className="text-sm">Show in Filters</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Add this field to the filter popover on the {editingField?.module || 'module'}{' '}
                    list page. Users can narrow results by this field&apos;s value (e.g. filter
                    students by blood group or transport route).
                  </p>
                </div>
                <Switch
                  checked={editForm.showInFilters}
                  onCheckedChange={(v: boolean) => setEditForm({ ...editForm, showInFilters: v })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingField(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleUpdateField} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

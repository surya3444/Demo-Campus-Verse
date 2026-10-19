'use client';
import { PageHero } from '@/components/ui/page-hero';

import { useState, useEffect, useCallback } from 'react';
import { AddButton } from '@/components/ui/page-header';
import { DataTable, Column, DataTableAction } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/stat-card';
import { Building, Briefcase, Users, Eye, Pencil, Trash2, UserCog, Loader2, AlertCircle, Building2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { hrApi } from '@/lib/api';
import { toast } from 'sonner';

interface Department {
  _id: string;
  name: string;
  code: string;
  type: 'academic' | 'administrative' | 'support';
  description?: string;
  headOfDepartment?: string;
  hodName?: string;
  status: 'active' | 'inactive';
}

interface Designation {
  _id: string;
  name: string;
  code: string;
  category: 'teaching' | 'non-teaching' | 'management';
  level: number;
  description?: string;
  status: 'active' | 'inactive';
}

// Form data types
interface DepartmentFormData {
  name: string;
  code: string;
  type: 'academic' | 'administrative' | 'support';
  description: string;
}

interface DesignationFormData {
  name: string;
  code: string;
  category: 'teaching' | 'non-teaching' | 'management';
  level: number;
  description: string;
}

const initialDepartmentForm: DepartmentFormData = {
  name: '',
  code: '',
  type: 'academic',
  description: '',
};

const initialDesignationForm: DesignationFormData = {
  name: '',
  code: '',
  category: 'teaching',
  level: 5,
  description: '',
};

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [selectedDesignation, setSelectedDesignation] = useState<Designation | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'department' | 'designation'>('department');
  const [dialogMode, setDialogMode] = useState<'view' | 'edit' | 'add'>('view');

  // Form state
  const [departmentForm, setDepartmentForm] = useState<DepartmentFormData>(initialDepartmentForm);
  const [designationForm, setDesignationForm] = useState<DesignationFormData>(initialDesignationForm);
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [deptRes, desgRes] = await Promise.all([
        hrApi.getDepartments(),
        hrApi.getDesignations(),
      ]);

      setDepartments(deptRes.data || []);
      setDesignations(desgRes.data || []);
    } catch (err) {
      console.error('Failed to fetch departments data:', err);
      setError('Failed to load departments and designations');
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset form when dialog opens
  useEffect(() => {
    if (dialogOpen) {
      setFormErrors({});
      if (dialogMode === 'add') {
        setDepartmentForm(initialDepartmentForm);
        setDesignationForm(initialDesignationForm);
      } else if (dialogMode === 'edit') {
        if (dialogType === 'department' && selectedDepartment) {
          setDepartmentForm({
            name: selectedDepartment.name,
            code: selectedDepartment.code,
            type: selectedDepartment.type,
            description: selectedDepartment.description || '',
          });
        } else if (dialogType === 'designation' && selectedDesignation) {
          setDesignationForm({
            name: selectedDesignation.name,
            code: selectedDesignation.code,
            category: selectedDesignation.category,
            level: selectedDesignation.level,
            description: selectedDesignation.description || '',
          });
        }
      }
    }
  }, [dialogOpen, dialogMode, dialogType, selectedDepartment, selectedDesignation]);

  // Validate department form
  const validateDepartmentForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!departmentForm.name.trim()) {
      errors.name = 'Department name is required';
    }
    if (!departmentForm.code.trim()) {
      errors.code = 'Code is required';
    } else if (departmentForm.code.length > 10) {
      errors.code = 'Code must be 10 characters or less';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Validate designation form
  const validateDesignationForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!designationForm.name.trim()) {
      errors.name = 'Designation name is required';
    }
    if (!designationForm.code.trim()) {
      errors.code = 'Code is required';
    } else if (designationForm.code.length > 10) {
      errors.code = 'Code must be 10 characters or less';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle department submit
  const handleDepartmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateDepartmentForm()) return;

    try {
      setSubmitting(true);
      const payload = {
        name: departmentForm.name.trim(),
        code: departmentForm.code.trim().toUpperCase(),
        type: departmentForm.type,
        description: departmentForm.description.trim() || undefined,
      };

      if (dialogMode === 'add') {
        await hrApi.createDepartment(payload);
        toast.success('Department created successfully');
      } else if (dialogMode === 'edit' && selectedDepartment) {
        await hrApi.updateDepartment(selectedDepartment._id, payload);
        toast.success('Department updated successfully');
      }

      setDialogOpen(false);
      fetchData();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save department';
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle designation submit
  const handleDesignationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateDesignationForm()) return;

    try {
      setSubmitting(true);
      const payload = {
        name: designationForm.name.trim(),
        code: designationForm.code.trim().toUpperCase(),
        category: designationForm.category,
        level: designationForm.level,
        description: designationForm.description.trim() || undefined,
      };

      if (dialogMode === 'add') {
        await hrApi.createDesignation(payload);
        toast.success('Designation created successfully');
      } else if (dialogMode === 'edit' && selectedDesignation) {
        await hrApi.updateDesignation(selectedDesignation._id, payload);
        toast.success('Designation updated successfully');
      }

      setDialogOpen(false);
      fetchData();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save designation';
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle delete department
  const handleDeleteDepartment = async (department: Department) => {
    if (!confirm(`Are you sure you want to delete "${department.name}"?`)) return;

    try {
      await hrApi.deleteDepartment(department._id);
      toast.success('Department deleted successfully');
      fetchData();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete department';
      toast.error(errorMessage);
    }
  };

  // Handle delete designation
  const handleDeleteDesignation = async (designation: Designation) => {
    if (!confirm(`Are you sure you want to delete "${designation.name}"?`)) return;

    try {
      await hrApi.deleteDesignation(designation._id);
      toast.success('Designation deleted successfully');
      fetchData();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete designation';
      toast.error(errorMessage);
    }
  };

  const totalDepartments = departments.length;
  const totalDesignations = designations.length;

  const departmentColumns: Column<Department>[] = [
    {
      key: 'name',
      header: 'Department',
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium">{row.name}</p>
            <p className="text-xs text-muted-foreground">{row.code}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      cell: (row) => (
        <Badge variant="outline" className="capitalize">
          {row.type}
        </Badge>
      ),
    },
    {
      key: 'hodName',
      header: 'Head',
      cell: (row) =>
        row.hodName ? (
          <span>{row.hodName}</span>
        ) : (
          <span className="text-muted-foreground">Not assigned</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => (
        <Badge
          variant="secondary"
          className={`capitalize ${
            row.status === 'active'
              ? 'bg-success/10 text-success border-success/20'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {row.status}
        </Badge>
      ),
    },
  ];

  const designationColumns: Column<Designation>[] = [
    {
      key: 'name',
      header: 'Designation',
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
            <Briefcase className="h-5 w-5 text-accent" />
          </div>
          <div>
            <p className="font-medium">{row.name}</p>
            <p className="text-xs text-muted-foreground">{row.code}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'level',
      header: 'Level',
      sortable: true,
      cell: (row) => <Badge variant="outline">Level {row.level}</Badge>,
    },
    {
      key: 'category',
      header: 'Category',
      cell: (row) => (
        <Badge
          variant="secondary"
          className={`capitalize ${
            row.category === 'teaching'
              ? 'bg-info/10 text-info border-info/20'
              : row.category === 'management'
                ? 'bg-primary/10 text-primary border-primary/20'
                : 'bg-muted text-muted-foreground'
          }`}
        >
          {row.category}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => (
        <Badge
          variant="secondary"
          className={`capitalize ${
            row.status === 'active'
              ? 'bg-success/10 text-success border-success/20'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {row.status}
        </Badge>
      ),
    },
  ];

  const departmentActions: DataTableAction<Department>[] = [
    {
      label: 'View Details',
      icon: <Eye className="mr-2 h-4 w-4" />,
      onClick: (row) => {
        setSelectedDepartment(row);
        setDialogType('department');
        setDialogMode('view');
        setDialogOpen(true);
      },
    },
    {
      label: 'Edit',
      icon: <Pencil className="mr-2 h-4 w-4" />,
      onClick: (row) => {
        setSelectedDepartment(row);
        setDialogType('department');
        setDialogMode('edit');
        setDialogOpen(true);
      },
    },
    {
      label: 'Delete',
      icon: <Trash2 className="mr-2 h-4 w-4" />,
      onClick: (row) => handleDeleteDepartment(row),
      variant: 'destructive',
    },
  ];

  const designationActions: DataTableAction<Designation>[] = [
    {
      label: 'View Details',
      icon: <Eye className="mr-2 h-4 w-4" />,
      onClick: (row) => {
        setSelectedDesignation(row);
        setDialogType('designation');
        setDialogMode('view');
        setDialogOpen(true);
      },
    },
    {
      label: 'Edit',
      icon: <Pencil className="mr-2 h-4 w-4" />,
      onClick: (row) => {
        setSelectedDesignation(row);
        setDialogType('designation');
        setDialogMode('edit');
        setDialogOpen(true);
      },
    },
    {
      label: 'Delete',
      icon: <Trash2 className="mr-2 h-4 w-4" />,
      onClick: (row) => handleDeleteDesignation(row),
      variant: 'destructive',
    },
  ];

  const handleAddDepartment = () => {
    setSelectedDepartment(null);
    setDialogType('department');
    setDialogMode('add');
    setDialogOpen(true);
  };

  const handleAddDesignation = () => {
    setSelectedDesignation(null);
    setDialogType('designation');
    setDialogMode('add');
    setDialogOpen(true);
  };

  if (loading && departments.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading departments...</p>
        </div>
      </div>
    );
  }

  if (error && departments.length === 0) {
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
      <PageHero icon={Building2} eyebrow="HR · Organisation" title="Departments & Designations" description="Manage organizational structure" />

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4 stagger-animation">
        <StatCard title="Total Departments" value={totalDepartments} icon={Building} />
        <StatCard
          title="Total Designations"
          value={totalDesignations}
          icon={Briefcase}
          variant="primary"
        />
        <StatCard
          title="Academic Depts"
          value={departments.filter((d) => d.type === 'academic').length}
          icon={Users}
          variant="success"
        />
        <StatCard
          title="Active Depts"
          value={departments.filter((d) => d.status === 'active').length}
          icon={Building}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="departments" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="departments" className="gap-2">
              <Building className="h-4 w-4" />
              Departments
            </TabsTrigger>
            <TabsTrigger value="designations" className="gap-2">
              <Briefcase className="h-4 w-4" />
              Designations
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="departments">
          <div className="flex justify-end mb-4">
            <AddButton onClick={handleAddDepartment} label="Add Department" />
          </div>
          <DataTable
            data={departments}
            columns={departmentColumns}
            actions={departmentActions}
            searchable
            searchPlaceholder="Search departments..."
          />
        </TabsContent>

        <TabsContent value="designations">
          <div className="flex justify-end mb-4">
            <AddButton onClick={handleAddDesignation} label="Add Designation" />
          </div>
          <DataTable
            data={designations}
            columns={designationColumns}
            actions={designationActions}
            searchable
            searchPlaceholder="Search designations..."
          />
        </TabsContent>
      </Tabs>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'view'
                ? `${dialogType === 'department' ? 'Department' : 'Designation'} Details`
                : dialogMode === 'edit'
                  ? `Edit ${dialogType === 'department' ? 'Department' : 'Designation'}`
                  : `Add New ${dialogType === 'department' ? 'Department' : 'Designation'}`}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === 'view' ? 'View details and information' : 'Fill in the details below'}
            </DialogDescription>
          </DialogHeader>

          {dialogType === 'department' ? (
            dialogMode === 'view' && selectedDepartment ? (
              <div className="space-y-6">
                <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
                  <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Building className="h-7 w-7 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">{selectedDepartment.name}</h3>
                    <p className="text-muted-foreground">{selectedDepartment.code}</p>
                  </div>
                  <Badge className="bg-success/10 text-success">{selectedDepartment.status}</Badge>
                </div>

                {selectedDepartment.description && (
                  <div className="p-4 rounded-lg border">
                    <p className="text-sm text-muted-foreground mb-1">Description</p>
                    <p>{selectedDepartment.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <UserCog className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Department Head</p>
                    </div>
                    <p className="font-medium mt-1">
                      {selectedDepartment.hodName || 'Not assigned'}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Type</p>
                    </div>
                    <p className="font-medium mt-1 capitalize">{selectedDepartment.type}</p>
                  </div>
                </div>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleDepartmentSubmit}>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dept-name">Department Name *</Label>
                    <Input
                      id="dept-name"
                      placeholder="e.g., Science"
                      value={departmentForm.name}
                      onChange={(e) => setDepartmentForm({ ...departmentForm, name: e.target.value })}
                      className={formErrors.name ? 'border-destructive' : ''}
                    />
                    {formErrors.name && (
                      <p className="text-xs text-destructive">{formErrors.name}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dept-code">Code *</Label>
                    <Input
                      id="dept-code"
                      placeholder="e.g., SCI"
                      value={departmentForm.code}
                      onChange={(e) => setDepartmentForm({ ...departmentForm, code: e.target.value.toUpperCase() })}
                      maxLength={10}
                      className={formErrors.code ? 'border-destructive' : ''}
                    />
                    {formErrors.code && (
                      <p className="text-xs text-destructive">{formErrors.code}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dept-type">Type *</Label>
                  <Select
                    value={departmentForm.type}
                    onValueChange={(value: 'academic' | 'administrative' | 'support') =>
                      setDepartmentForm({ ...departmentForm, type: value })
                    }
                  >
                    <SelectTrigger id="dept-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="academic">Academic</SelectItem>
                      <SelectItem value="administrative">Administrative</SelectItem>
                      <SelectItem value="support">Support</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dept-description">Description</Label>
                  <Textarea
                    id="dept-description"
                    placeholder="Brief description..."
                    value={departmentForm.description}
                    onChange={(e) => setDepartmentForm({ ...departmentForm, description: e.target.value })}
                    rows={2}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {dialogMode === 'add' ? 'Create Department' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            )
          ) : dialogMode === 'view' && selectedDesignation ? (
            <div className="space-y-6">
              <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
                <div className="h-14 w-14 rounded-xl bg-accent/10 flex items-center justify-center">
                  <Briefcase className="h-7 w-7 text-accent" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">{selectedDesignation.name}</h3>
                  <p className="text-muted-foreground">{selectedDesignation.code}</p>
                </div>
                <Badge className="bg-success/10 text-success">{selectedDesignation.status}</Badge>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border">
                  <p className="text-sm text-muted-foreground">Level</p>
                  <p className="text-2xl font-bold mt-1">{selectedDesignation.level}</p>
                </div>
                <div className="p-4 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Category</p>
                  </div>
                  <p className="font-medium mt-1 capitalize">{selectedDesignation.category}</p>
                </div>
              </div>

              {selectedDesignation.description && (
                <div className="p-4 rounded-lg border">
                  <p className="text-sm text-muted-foreground mb-1">Description</p>
                  <p>{selectedDesignation.description}</p>
                </div>
              )}
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleDesignationSubmit}>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="desg-name">Designation Name *</Label>
                  <Input
                    id="desg-name"
                    placeholder="e.g., Senior Teacher"
                    value={designationForm.name}
                    onChange={(e) => setDesignationForm({ ...designationForm, name: e.target.value })}
                    className={formErrors.name ? 'border-destructive' : ''}
                  />
                  {formErrors.name && (
                    <p className="text-xs text-destructive">{formErrors.name}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="desg-code">Code *</Label>
                  <Input
                    id="desg-code"
                    placeholder="e.g., STCH"
                    value={designationForm.code}
                    onChange={(e) => setDesignationForm({ ...designationForm, code: e.target.value.toUpperCase() })}
                    maxLength={10}
                    className={formErrors.code ? 'border-destructive' : ''}
                  />
                  {formErrors.code && (
                    <p className="text-xs text-destructive">{formErrors.code}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="desg-category">Category *</Label>
                  <Select
                    value={designationForm.category}
                    onValueChange={(value: 'teaching' | 'non-teaching' | 'management') =>
                      setDesignationForm({ ...designationForm, category: value })
                    }
                  >
                    <SelectTrigger id="desg-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="teaching">Teaching</SelectItem>
                      <SelectItem value="non-teaching">Non-Teaching</SelectItem>
                      <SelectItem value="management">Management</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="desg-level">Level *</Label>
                  <Select
                    value={designationForm.level.toString()}
                    onValueChange={(value) =>
                      setDesignationForm({ ...designationForm, level: parseInt(value) })
                    }
                  >
                    <SelectTrigger id="desg-level">
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((l) => (
                        <SelectItem key={l} value={l.toString()}>
                          Level {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="desg-description">Description</Label>
                <Textarea
                  id="desg-description"
                  placeholder="Brief description..."
                  value={designationForm.description}
                  onChange={(e) => setDesignationForm({ ...designationForm, description: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {dialogMode === 'add' ? 'Create Designation' : 'Save Changes'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

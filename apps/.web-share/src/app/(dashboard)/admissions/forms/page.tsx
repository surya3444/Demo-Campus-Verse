'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { admissionsApi } from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Loader2,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Copy,
  ExternalLink,
  ClipboardList,
  Search,
  Eye,
  FileText,
  FormInput,
  Link as LinkIcon,
} from 'lucide-react';

interface Form {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  type: 'lead' | 'application' | 'enquiry' | 'feedback' | 'custom';
  status: 'draft' | 'published' | 'archived';
  fields: Array<{
    id: string;
    type: string;
    name: string;
    label: string;
    required: boolean;
    order: number;
  }>;
  submissions: {
    total: number;
    pending: number;
  };
  settings: {
    collectPayment?: boolean;
    paymentAmount?: number;
    autoCreateLead?: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

const FORM_TYPES = [
  { value: 'lead', label: 'Lead Form', description: 'Collect leads for follow-up' },
  { value: 'application', label: 'Application Form', description: 'Admission applications' },
  { value: 'enquiry', label: 'Enquiry Form', description: 'General enquiries' },
  { value: 'feedback', label: 'Feedback Form', description: 'Collect feedback' },
  { value: 'custom', label: 'Custom Form', description: 'Custom purpose' },
];

const typeColors: Record<string, string> = {
  lead: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  application: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  enquiry: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  feedback: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  custom: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
};

const statusColors: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  published: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  archived: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
};

export default function FormsPage() {
  const [loading, setLoading] = useState(true);
  const [forms, setForms] = useState<Form[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  // Create form dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'lead' as Form['type'],
  });

  // Duplicate form dialog
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [duplicateFormId, setDuplicateFormId] = useState<string | null>(null);
  const [duplicateName, setDuplicateName] = useState('');

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteFormId, setDeleteFormId] = useState<string | null>(null);

  useEffect(() => {
    fetchForms();
  }, [pagination.page, typeFilter, statusFilter]);

  const fetchForms = async () => {
    setLoading(true);
    try {
      const response = await admissionsApi.getForms({
        page: pagination.page,
        limit: pagination.limit,
        type: typeFilter || undefined,
        status: statusFilter || undefined,
        search: search || undefined,
      });

      if (response.success) {
        setForms(response.data || []);
        setPagination((prev) => ({
          ...prev,
          total: response.pagination?.total || 0,
          totalPages: response.pagination?.totalPages || 0,
        }));
      }
    } catch (error) {
      console.error('Failed to fetch forms:', error);
      toast.error('Failed to load forms');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchForms();
  };

  const handleCreateForm = async () => {
    if (!formData.name.trim()) {
      toast.error('Please enter a form name');
      return;
    }

    setCreating(true);
    try {
      const response = await admissionsApi.createForm({
        name: formData.name,
        description: formData.description || undefined,
        type: formData.type,
      });

      if (response.success) {
        toast.success('Form created successfully');
        setCreateDialogOpen(false);
        setFormData({ name: '', description: '', type: 'lead' });
        fetchForms();

        // Redirect to form builder
        window.location.href = `/admissions/forms/${response.data._id}/builder`;
      }
    } catch (error) {
      console.error('Failed to create form:', error);
      toast.error('Failed to create form');
    } finally {
      setCreating(false);
    }
  };

  const handleDuplicate = async () => {
    if (!duplicateFormId || !duplicateName.trim()) {
      toast.error('Please enter a name for the duplicated form');
      return;
    }

    setDuplicating(true);
    try {
      const response = await admissionsApi.duplicateForm(duplicateFormId, duplicateName);

      if (response.success) {
        toast.success('Form duplicated successfully');
        setDuplicateDialogOpen(false);
        setDuplicateFormId(null);
        setDuplicateName('');
        fetchForms();
      }
    } catch (error) {
      console.error('Failed to duplicate form:', error);
      toast.error('Failed to duplicate form');
    } finally {
      setDuplicating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteFormId) return;

    setDeleting(true);
    try {
      const response = await admissionsApi.deleteForm(deleteFormId);

      if (response.success) {
        toast.success('Form deleted successfully');
        setDeleteDialogOpen(false);
        setDeleteFormId(null);
        fetchForms();
      }
    } catch (error) {
      console.error('Failed to delete form:', error);
      toast.error('Failed to delete form');
    } finally {
      setDeleting(false);
    }
  };

  const copyFormLink = (slug: string) => {
    const url = `${window.location.origin}/forms/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success('Form link copied to clipboard');
  };

  const openDuplicateDialog = (form: Form) => {
    setDuplicateFormId(form._id);
    setDuplicateName(`${form.name} (Copy)`);
    setDuplicateDialogOpen(true);
  };

  const openDeleteDialog = (formId: string) => {
    setDeleteFormId(formId);
    setDeleteDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            Dynamic Forms
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Create and manage admission forms, lead capture forms, and more
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Create Form
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Forms</p>
                <p className="text-2xl font-bold">{forms.length}</p>
              </div>
              <FormInput className="h-8 w-8 text-primary opacity-70" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Published</p>
                <p className="text-2xl font-bold text-green-600">
                  {forms.filter((f) => f.status === 'published').length}
                </p>
              </div>
              <ExternalLink className="h-8 w-8 text-green-600 opacity-70" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Submissions</p>
                <p className="text-2xl font-bold text-blue-600">
                  {forms.reduce((sum, f) => sum + (f.submissions?.total || 0), 0)}
                </p>
              </div>
              <FileText className="h-8 w-8 text-blue-600 opacity-70" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Review</p>
                <p className="text-2xl font-bold text-orange-600">
                  {forms.reduce((sum, f) => sum + (f.submissions?.pending || 0), 0)}
                </p>
              </div>
              <Eye className="h-8 w-8 text-orange-600 opacity-70" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search forms..."
                  className="pl-8"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
            </div>
            <Select
              value={typeFilter}
              onValueChange={(v) => {
                setTypeFilter(v === 'all' ? '' : v);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {FORM_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v === 'all' ? '' : v);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleSearch}>
              <Search className="h-4 w-4 mr-1.5" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Forms Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Forms</CardTitle>
          <CardDescription>
            Manage your forms, view submissions, and track responses
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : forms.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium text-lg">No forms yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first form to start collecting responses
              </p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" />
                Create Form
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Fields</TableHead>
                  <TableHead>Submissions</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {forms.map((form) => (
                  <TableRow key={form._id}>
                    <TableCell>
                      <div>
                        <Link
                          href={`/admissions/forms/${form._id}/builder`}
                          className="font-medium hover:text-primary transition-colors"
                        >
                          {form.name}
                        </Link>
                        {form.description && (
                          <p className="text-sm text-muted-foreground truncate max-w-[250px]">
                            {form.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={typeColors[form.type]}>
                        {form.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={statusColors[form.status]}>
                        {form.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{form.fields?.length || 0}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{form.submissions?.total || 0}</span>
                        {(form.submissions?.pending || 0) > 0 && (
                          <Badge variant="outline" className="text-orange-600">
                            {form.submissions.pending} pending
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(form.createdAt), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/admissions/forms/${form._id}/builder`}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit Form
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/admissions/forms/${form._id}/submissions`}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Submissions
                            </Link>
                          </DropdownMenuItem>
                          {form.status === 'published' && (
                            <>
                              <DropdownMenuItem onClick={() => copyFormLink(form.slug)}>
                                <LinkIcon className="h-4 w-4 mr-2" />
                                Copy Link
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <a
                                  href={`/forms/${form.slug}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <ExternalLink className="h-4 w-4 mr-2" />
                                  Open Form
                                </a>
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => openDuplicateDialog(form)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => openDeleteDialog(form._id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} forms
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page === 1}
                  onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page === pagination.totalPages}
                  onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Form Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Form</DialogTitle>
            <DialogDescription>
              Create a new form to collect information from applicants
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Form Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Admission Enquiry Form 2025"
              />
            </div>
            <div className="space-y-2">
              <Label>Description (Optional)</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the form"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Form Type</Label>
              <Select
                value={formData.type}
                onValueChange={(v) => setFormData({ ...formData, type: v as Form['type'] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORM_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div>
                        <p>{type.label}</p>
                        <p className="text-xs text-muted-foreground">{type.description}</p>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateForm} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Form
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate Form Dialog */}
      <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Duplicate Form</DialogTitle>
            <DialogDescription>Create a copy of this form with a new name</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>New Form Name</Label>
              <Input
                value={duplicateName}
                onChange={(e) => setDuplicateName(e.target.value)}
                placeholder="Enter name for the duplicated form"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleDuplicate} disabled={duplicating}>
              {duplicating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Duplicate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Form</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this form? This action cannot be undone and all
              submissions will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete Form
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

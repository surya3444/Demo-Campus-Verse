'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { admissionsApi } from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Loader2,
  ArrowLeft,
  Eye,
  FileText,
  Check,
  Archive,
  Clock,
  ExternalLink,
  Download,
  UserPlus,
} from 'lucide-react';

interface FormField {
  id: string;
  type: string;
  name: string;
  label: string;
  order?: number;
}

interface FormData {
  _id: string;
  name: string;
  slug: string;
  fields: FormField[];
}

interface Submission {
  _id: string;
  formId: string;
  data: Record<string, unknown>;
  files?: Array<{
    fieldId: string;
    fileName: string;
    fileUrl: string;
    fileSize: number;
  }>;
  status: 'pending' | 'reviewed' | 'processed' | 'archived';
  source?: {
    ip?: string;
    userAgent?: string;
    referrer?: string;
  };
  leadId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  reviewed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  processed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  archived: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
};

const statusIcons: Record<string, typeof Clock> = {
  pending: Clock,
  reviewed: Eye,
  processed: Check,
  archived: Archive,
};

export default function FormSubmissionsPage() {
  const params = useParams();
  const router = useRouter();
  const formId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormData | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // View submission sheet
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [viewSheetOpen, setViewSheetOpen] = useState(false);

  // Status update dialog
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusSubmissionId, setStatusSubmissionId] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState<string>('');
  const [statusNotes, setStatusNotes] = useState('');

  useEffect(() => {
    fetchForm();
  }, [formId]);

  useEffect(() => {
    if (form) {
      fetchSubmissions();
    }
  }, [form, pagination.page, statusFilter]);

  const fetchForm = async () => {
    try {
      const response = await admissionsApi.getForm(formId);
      if (response.success) {
        setForm(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch form:', error);
      toast.error('Failed to load form');
      router.push('/admissions/forms');
    }
  };

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const response = await admissionsApi.getFormSubmissions(formId, {
        page: pagination.page,
        limit: pagination.limit,
        status: statusFilter || undefined,
      });

      if (response.success) {
        setSubmissions(response.data || []);
        setPagination((prev) => ({
          ...prev,
          total: response.pagination?.total || 0,
          totalPages: response.pagination?.totalPages || 0,
        }));
      }
    } catch (error) {
      console.error('Failed to fetch submissions:', error);
      toast.error('Failed to load submissions');
    } finally {
      setLoading(false);
    }
  };

  const openViewSubmission = async (submissionId: string) => {
    try {
      const response = await admissionsApi.getFormSubmission(submissionId);
      if (response.success) {
        setSelectedSubmission(response.data);
        setViewSheetOpen(true);
      }
    } catch (error) {
      console.error('Failed to fetch submission:', error);
      toast.error('Failed to load submission details');
    }
  };

  const openStatusDialog = (submissionId: string, currentStatus: string) => {
    setStatusSubmissionId(submissionId);
    setNewStatus(currentStatus);
    setStatusNotes('');
    setStatusDialogOpen(true);
  };

  const handleUpdateStatus = async () => {
    if (!statusSubmissionId || !newStatus) return;

    setUpdatingStatus(true);
    try {
      await admissionsApi.updateFormSubmissionStatus(
        statusSubmissionId,
        newStatus as 'reviewed' | 'processed' | 'archived',
        statusNotes || undefined
      );

      toast.success('Status updated successfully');
      setStatusDialogOpen(false);
      fetchSubmissions();

      // Update sheet if viewing this submission
      if (selectedSubmission?._id === statusSubmissionId) {
        setSelectedSubmission({
          ...selectedSubmission,
          status: newStatus as Submission['status'],
          notes: statusNotes || selectedSubmission.notes,
        });
      }
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error('Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (Array.isArray(value)) return value.join(', ');
    return String(value);
  };

  const getPreviewValue = (submission: Submission): string => {
    // Get first non-empty text value as preview
    const firstField = form?.fields.find((f) => f.type === 'text' || f.type === 'email');
    if (firstField && submission.data[firstField.name]) {
      return String(submission.data[firstField.name]);
    }
    return 'Submission';
  };

  if (!form) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/admissions/forms/${formId}/builder`}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              {form.name} - Submissions
            </h1>
            <p className="text-sm text-muted-foreground">View and manage form submissions</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/admissions/forms/${formId}/builder`}>Edit Form</Link>
          </Button>
          <Button variant="outline" asChild>
            <a href={`/forms/${form.slug}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-1.5" />
              View Form
            </a>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{pagination.total}</p>
              </div>
              <FileText className="h-8 w-8 text-primary opacity-70" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {submissions.filter((s) => s.status === 'pending').length}
                </p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600 opacity-70" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Reviewed</p>
                <p className="text-2xl font-bold text-blue-600">
                  {submissions.filter((s) => s.status === 'reviewed').length}
                </p>
              </div>
              <Eye className="h-8 w-8 text-blue-600 opacity-70" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Processed</p>
                <p className="text-2xl font-bold text-green-600">
                  {submissions.filter((s) => s.status === 'processed').length}
                </p>
              </div>
              <Check className="h-8 w-8 text-green-600 opacity-70" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-4">
            <Select
              value={statusFilter || 'all'}
              onValueChange={(v) => {
                setStatusFilter(v === 'all' ? '' : v);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
                <SelectItem value="processed">Processed</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Submissions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Submissions</CardTitle>
          <CardDescription>
            {pagination.total} submission{pagination.total !== 1 ? 's' : ''} received
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium text-lg">No submissions yet</h3>
              <p className="text-muted-foreground mb-4">
                Share your form to start receiving submissions
              </p>
              <Button variant="outline" asChild>
                <a href={`/forms/${form.slug}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-1.5" />
                  Open Form
                </a>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Preview</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Lead</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((submission) => {
                  const StatusIcon = statusIcons[submission.status];
                  return (
                    <TableRow key={submission._id}>
                      <TableCell>
                        <div
                          className="font-medium cursor-pointer hover:text-primary transition-colors"
                          onClick={() => openViewSubmission(submission._id)}
                        >
                          {getPreviewValue(submission)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={`${statusColors[submission.status]} flex items-center gap-1 w-fit`}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {submission.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {submission.leadId ? (
                          <Link
                            href={`/admissions/leads?id=${submission.leadId}`}
                            className="flex items-center gap-1 text-primary hover:underline"
                          >
                            <UserPlus className="h-4 w-4" />
                            View Lead
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(submission.createdAt), 'MMM d, yyyy h:mm a')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openViewSubmission(submission._id)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openStatusDialog(submission._id, submission.status)}
                          >
                            Update Status
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total}
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

      {/* View Submission Sheet */}
      <Sheet open={viewSheetOpen} onOpenChange={setViewSheetOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Submission Details</SheetTitle>
            <SheetDescription>
              Submitted on{' '}
              {selectedSubmission &&
                format(new Date(selectedSubmission.createdAt), 'MMMM d, yyyy h:mm a')}
            </SheetDescription>
          </SheetHeader>
          {selectedSubmission && (
            <div className="mt-6 space-y-6">
              {/* Status */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <Badge
                    variant="secondary"
                    className={`${statusColors[selectedSubmission.status]} mt-1`}
                  >
                    {selectedSubmission.status}
                  </Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    openStatusDialog(selectedSubmission._id, selectedSubmission.status)
                  }
                >
                  Update Status
                </Button>
              </div>

              {/* Form Data */}
              <div className="space-y-4">
                <Label className="text-muted-foreground">Submitted Data</Label>
                <div className="space-y-3 border rounded-lg p-4">
                  {form?.fields
                    .filter((f) => f.type !== 'section')
                    .sort((a, b) => (a.order || 0) - (b.order || 0))
                    .map((field) => (
                      <div key={field.id} className="grid grid-cols-3 gap-2">
                        <span className="text-sm text-muted-foreground">{field.label}</span>
                        <span className="text-sm font-medium col-span-2">
                          {formatValue(selectedSubmission.data[field.name])}
                        </span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Files */}
              {selectedSubmission.files && selectedSubmission.files.length > 0 && (
                <div className="space-y-4">
                  <Label className="text-muted-foreground">Uploaded Files</Label>
                  <div className="space-y-2">
                    {selectedSubmission.files.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary" />
                          <span className="text-sm">{file.fileName}</span>
                        </div>
                        <Button variant="ghost" size="sm" asChild>
                          <a href={file.fileUrl} target="_blank" rel="noopener noreferrer">
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Lead Link */}
              {selectedSubmission.leadId && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Created Lead</Label>
                  <Button variant="outline" className="w-full" asChild>
                    <Link href={`/admissions/leads?id=${selectedSubmission.leadId}`}>
                      <UserPlus className="h-4 w-4 mr-2" />
                      View Lead
                    </Link>
                  </Button>
                </div>
              )}

              {/* Notes */}
              {selectedSubmission.notes && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Notes</Label>
                  <p className="text-sm border rounded-lg p-3">{selectedSubmission.notes}</p>
                </div>
              )}

              {/* Source Info */}
              {selectedSubmission.source && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Submission Source</Label>
                  <div className="text-xs text-muted-foreground space-y-1 border rounded-lg p-3">
                    {selectedSubmission.source.ip && <p>IP: {selectedSubmission.source.ip}</p>}
                    {selectedSubmission.source.referrer && (
                      <p>Referrer: {selectedSubmission.source.referrer}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Status Update Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Status</DialogTitle>
            <DialogDescription>Change the status of this submission</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="reviewed">Reviewed</SelectItem>
                  <SelectItem value="processed">Processed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
                placeholder="Add notes about this status change..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateStatus} disabled={updatingStatus}>
              {updatingStatus && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

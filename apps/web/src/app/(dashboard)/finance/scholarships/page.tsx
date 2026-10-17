'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { PageHero, StatTile, StatGrid } from '@/components/ui/page-hero';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { financeApi, studentApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { formatCurrency } from '@campus-verse/shared/utils';
import { toast } from 'sonner';
import { GraduationCap, Plus, Check, X, IndianRupee, Search } from 'lucide-react';

interface ScholarshipRow {
  _id: string;
  studentId: string;
  studentName: string;
  admissionNumber: string;
  scheme: string;
  sponsor: 'government' | 'private' | 'institution';
  sanctionedAmount: number;
  appliedAmount?: number;
  applicationRef?: string;
  status: string;
  receivedAmount: number;
  receivableAmount: number;
  rejectionReason?: string;
  createdAt: string;
}

interface StudentOption {
  _id: string;
  displayName: string;
  admissionNumber: string;
}

const STATUS_BADGES: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  applied: { label: 'Applied', variant: 'secondary' },
  approved: { label: 'Approved', variant: 'default' },
  rejected: { label: 'Rejected', variant: 'destructive' },
  partially_disbursed: { label: 'Partially Disbursed', variant: 'default' },
  disbursed: { label: 'Disbursed', variant: 'outline' },
  lapsed: { label: 'Lapsed', variant: 'destructive' },
};

const EMPTY_FORM = {
  studentId: '',
  scheme: 'govt_fee_reimbursement',
  sponsor: 'government' as 'government' | 'private' | 'institution',
  sanctionedAmount: '',
  applicationRef: '',
  remarks: '',
};

export default function ScholarshipsPage() {
  const { hasPermission } = usePermissions();
  const [rows, setRows] = useState<ScholarshipRow[]>([]);
  const [stats, setStats] = useState<{
    pendingApproval: number;
    sanctioned: number;
    received: number;
    receivable: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [studentQuery, setStudentQuery] = useState('');
  const [studentOptions, setStudentOptions] = useState<StudentOption[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(null);

  const [rejectTarget, setRejectTarget] = useState<ScholarshipRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [disburseTarget, setDisburseTarget] = useState<ScholarshipRow | null>(null);
  const [disburseForm, setDisburseForm] = useState({ amount: '', utrRef: '' });

  const canCreate = hasPermission('finance.scholarships', 'create');
  const canApprove = hasPermission('finance.scholarships', 'approve');
  const canReject = hasPermission('finance.scholarships', 'reject');
  const canEdit = hasPermission('finance.scholarships', 'edit');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [listRes, statsRes] = await Promise.all([
        financeApi.getScholarships({
          limit: 50,
          status: statusFilter === 'all' ? undefined : statusFilter,
        }),
        financeApi.getScholarshipStats(),
      ]);
      if (listRes.success) setRows(listRes.data);
      if (statsRes.success) setStats(statsRes.data);
    } catch {
      toast.error('Failed to load scholarships');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Debounced student search for the create dialog.
  useEffect(() => {
    if (!dialogOpen || studentQuery.trim().length < 2) {
      setStudentOptions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await studentApi.getStudents({ search: studentQuery.trim(), limit: 8 });
        if (res.success) {
          setStudentOptions(
            (
              res.data as Array<{
                _id: string;
                displayName?: string;
                firstName: string;
                lastName: string;
                admissionNumber?: string;
              }>
            ).map((s) => ({
              _id: s._id,
              displayName: s.displayName || `${s.firstName} ${s.lastName}`,
              admissionNumber: s.admissionNumber || '',
            }))
          );
        }
      } catch {
        // search is best-effort
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [studentQuery, dialogOpen]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(form.sanctionedAmount);
    if (!form.studentId || !form.scheme.trim() || !amount || amount <= 0) {
      toast.error('Student, scheme, and a positive sanctioned amount are required');
      return;
    }
    setSaving(true);
    try {
      const res = await financeApi.createScholarship({
        studentId: form.studentId,
        scheme: form.scheme.trim(),
        sponsor: form.sponsor,
        sanctionedAmount: amount,
        applicationRef: form.applicationRef.trim() || undefined,
        remarks: form.remarks.trim() || undefined,
      });
      if (res.success) {
        toast.success('Scholarship application recorded');
        setDialogOpen(false);
        setForm(EMPTY_FORM);
        setSelectedStudent(null);
        setStudentQuery('');
        fetchData();
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message || 'Failed to record scholarship');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (row: ScholarshipRow) => {
    try {
      const res = await financeApi.approveScholarship(row._id);
      if (res.success) {
        toast.success('Scholarship approved — sponsored portion marked on fees');
        fetchData();
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message || 'Failed to approve');
    }
  };

  const handleReject = async () => {
    if (!rejectTarget || rejectReason.trim().length < 3) {
      toast.error('A rejection reason is required');
      return;
    }
    try {
      const res = await financeApi.rejectScholarship(rejectTarget._id, rejectReason.trim());
      if (res.success) {
        toast.success('Scholarship rejected');
        setRejectTarget(null);
        setRejectReason('');
        fetchData();
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message || 'Failed to reject');
    }
  };

  const handleDisburse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disburseTarget) return;
    const amount = parseFloat(disburseForm.amount);
    if (!amount || amount <= 0) {
      toast.error('Enter a positive amount');
      return;
    }
    try {
      const res = await financeApi.recordScholarshipDisbursement(disburseTarget._id, {
        amount,
        utrRef: disburseForm.utrRef.trim() || undefined,
      });
      if (res.success) {
        toast.success('Disbursement recorded');
        setDisburseTarget(null);
        setDisburseForm({ amount: '', utrRef: '' });
        fetchData();
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message || 'Failed to record disbursement');
    }
  };

  return (
    <div className="space-y-6">
      <PageHero
        title="Scholarships"
        description="Government fee reimbursements and sponsored fees — receivables the institution tracks against sponsors"
        icon={GraduationCap}
        actions={
          canCreate ? (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Application
            </Button>
          ) : undefined
        }
      >
        {stats && (
          <StatGrid>
            <StatTile title="Pending Approval" value={String(stats.pendingApproval)} />
            <StatTile title="Sanctioned" value={formatCurrency(stats.sanctioned, 'INR')} />
            <StatTile title="Received" value={formatCurrency(stats.received, 'INR')} />
            <StatTile title="Receivable" value={formatCurrency(stats.receivable, 'INR')} />
          </StatGrid>
        )}
      </PageHero>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              A scholarship keeps the fee whole — the sponsor becomes the payer. Approving one
              unblocks registration for the sponsored portion; money received is posted through the
              fee counter as usual.
            </p>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {Object.entries(STATUS_BADGES).map(([code, meta]) => (
                  <SelectItem key={code} value={code}>
                    {meta.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <p className="py-10 text-center text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">No scholarships found.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Scheme</TableHead>
                    <TableHead>Sponsor</TableHead>
                    <TableHead className="text-right">Sanctioned</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead className="text-right">Receivable</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const badge = STATUS_BADGES[row.status] ?? {
                      label: row.status,
                      variant: 'outline' as const,
                    };
                    return (
                      <TableRow key={row._id}>
                        <TableCell>
                          <p className="font-medium">{row.studentName}</p>
                          <p className="text-xs text-muted-foreground">{row.admissionNumber}</p>
                        </TableCell>
                        <TableCell>
                          <p>{row.scheme}</p>
                          {row.applicationRef && (
                            <p className="text-xs text-muted-foreground">
                              Ref: {row.applicationRef}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="capitalize">{row.sponsor}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(row.sanctionedAmount, 'INR')}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(row.receivedAmount, 'INR')}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(row.receivableAmount, 'INR')}
                        </TableCell>
                        <TableCell>
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {row.status === 'applied' && canApprove && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-green-600"
                                title="Approve"
                                onClick={() => handleApprove(row)}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            )}
                            {row.status === 'applied' && canReject && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                title="Reject"
                                onClick={() => setRejectTarget(row)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                            {(row.status === 'approved' || row.status === 'partially_disbursed') &&
                              canEdit && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  title="Record disbursement"
                                  onClick={() => setDisburseTarget(row)}
                                >
                                  <IndianRupee className="h-4 w-4" />
                                </Button>
                              )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Scholarship Application</DialogTitle>
            <DialogDescription>
              Record a sanction (e.g. ePASS fee reimbursement). Approving it marks the sponsored
              portion on the student's fees.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Student *</Label>
              {selectedStudent ? (
                <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{selectedStudent.displayName}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedStudent.admissionNumber}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedStudent(null);
                      setForm({ ...form, studentId: '' });
                    }}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      value={studentQuery}
                      onChange={(e) => setStudentQuery(e.target.value)}
                      placeholder="Search by name or admission number…"
                    />
                  </div>
                  {studentOptions.length > 0 && (
                    <div className="rounded-lg border divide-y max-h-44 overflow-y-auto">
                      {studentOptions.map((s) => (
                        <button
                          key={s._id}
                          type="button"
                          className="w-full px-3 py-2 text-left hover:bg-muted/50"
                          onClick={() => {
                            setSelectedStudent(s);
                            setForm({ ...form, studentId: s._id });
                            setStudentOptions([]);
                          }}
                        >
                          <p className="text-sm font-medium">{s.displayName}</p>
                          <p className="text-xs text-muted-foreground">{s.admissionNumber}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Scheme *</Label>
                <Input
                  value={form.scheme}
                  onChange={(e) => setForm({ ...form, scheme: e.target.value })}
                  placeholder="govt_fee_reimbursement"
                />
              </div>
              <div className="space-y-2">
                <Label>Sponsor</Label>
                <Select
                  value={form.sponsor}
                  onValueChange={(value: 'government' | 'private' | 'institution') =>
                    setForm({ ...form, sponsor: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="government">Government</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                    <SelectItem value="institution">Institution</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Sanctioned Amount (₹) *</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.sanctionedAmount}
                  onChange={(e) => setForm({ ...form, sanctionedAmount: e.target.value })}
                  placeholder="35000"
                />
              </div>
              <div className="space-y-2">
                <Label>Application Ref</Label>
                <Input
                  value={form.applicationRef}
                  onChange={(e) => setForm({ ...form, applicationRef: e.target.value })}
                  placeholder="ePASS number"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea
                rows={2}
                value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Record Application'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reject scholarship?</DialogTitle>
            <DialogDescription>
              {rejectTarget?.studentName} — {rejectTarget?.scheme}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason *</Label>
            <Textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject}>
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disbursement dialog */}
      <Dialog open={!!disburseTarget} onOpenChange={(open) => !open && setDisburseTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Record Disbursement</DialogTitle>
            <DialogDescription>
              {disburseTarget?.studentName} — receivable{' '}
              {formatCurrency(disburseTarget?.receivableAmount ?? 0, 'INR')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleDisburse} className="space-y-4">
            <div className="space-y-2">
              <Label>Amount Received (₹) *</Label>
              <Input
                type="number"
                min="1"
                value={disburseForm.amount}
                onChange={(e) => setDisburseForm({ ...disburseForm, amount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>UTR / Reference</Label>
              <Input
                value={disburseForm.utrRef}
                onChange={(e) => setDisburseForm({ ...disburseForm, utrRef: e.target.value })}
                placeholder="Bank UTR number"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDisburseTarget(null)}>
                Cancel
              </Button>
              <Button type="submit">Record</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

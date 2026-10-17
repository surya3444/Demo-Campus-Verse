'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHero } from '@/components/ui/page-hero';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
import { hrApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { formatCurrency } from '@campus-verse/shared/utils';
import { toast } from 'sonner';
import { TrendingUp, Plus, Check, X, Trash2, Search } from 'lucide-react';

interface Designation {
  _id: string;
  name: string;
  level?: number;
}

interface PromotionPolicy {
  _id: string;
  branchId?: string;
  fromDesignationId: string;
  fromDesignationName: string;
  toDesignationId: string;
  toDesignationName: string;
  increment:
    | { type: 'percentage'; value: number; base: 'basic' | 'gross' }
    | { type: 'fixed'; value: number }
    | { type: 'structure'; structureId: string };
  requiresApproval: boolean;
  status: 'active' | 'inactive';
}

interface PromotionRow {
  _id: string;
  staffName: string;
  employeeId: string;
  fromDesignationName: string;
  toDesignationName: string;
  effectiveFrom: string;
  lateral: boolean;
  status: 'pending' | 'applied' | 'rejected';
  salaryChange?: { previousNet: number; newNet: number };
  rejectionReason?: string;
}

interface StaffOption {
  _id: string;
  displayName: string;
  employeeId?: string;
  designationName?: string;
}

function incrementLabel(increment: PromotionPolicy['increment']): string {
  if (increment.type === 'percentage') return `+${increment.value}% on ${increment.base}`;
  if (increment.type === 'fixed') return `+₹${increment.value} on basic`;
  return 'Move to salary structure';
}

const STATUS_BADGES: Record<
  PromotionRow['status'],
  { label: string; variant: 'default' | 'secondary' | 'destructive' }
> = {
  pending: { label: 'Pending Approval', variant: 'secondary' },
  applied: { label: 'Applied', variant: 'default' },
  rejected: { label: 'Rejected', variant: 'destructive' },
};

export default function PromotionsPage() {
  const { hasPermission } = usePermissions();
  const [promotions, setPromotions] = useState<PromotionRow[]>([]);
  const [policies, setPolicies] = useState<PromotionPolicy[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [loading, setLoading] = useState(true);

  // Promote dialog
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [staffQuery, setStaffQuery] = useState('');
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffOption | null>(null);
  const [promoteForm, setPromoteForm] = useState({
    toDesignationId: '',
    lateral: false,
    remarks: '',
  });
  const [saving, setSaving] = useState(false);

  // Policy dialog
  const [policyOpen, setPolicyOpen] = useState(false);
  const [policyForm, setPolicyForm] = useState({
    fromDesignationId: '',
    toDesignationId: '',
    incrementType: 'percentage' as 'percentage' | 'fixed',
    value: '',
    base: 'basic' as 'basic' | 'gross',
    requiresApproval: false,
  });

  const [rejectTarget, setRejectTarget] = useState<PromotionRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const canPromote = hasPermission('hr.promotions', 'create');
  const canDecide = hasPermission('hr.promotions', 'approve');
  const canManagePolicies = hasPermission('hr.settings', 'edit');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [promotionsRes, policiesRes, designationsRes] = await Promise.all([
        hrApi.getPromotions(),
        hrApi.getPromotionPolicies().catch(() => ({ success: false, data: [] })),
        hrApi.getDesignations().catch(() => ({ success: false, data: [] })),
      ]);
      if (promotionsRes.success) setPromotions(promotionsRes.data);
      if (policiesRes.success) setPolicies(policiesRes.data);
      if (designationsRes.success) setDesignations(designationsRes.data);
    } catch {
      toast.error('Failed to load promotions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Debounced staff search for the promote dialog.
  useEffect(() => {
    if (!promoteOpen || staffQuery.trim().length < 2) {
      setStaffOptions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await hrApi.getStaff({ search: staffQuery.trim(), limit: 8, status: 'active' });
        if (res.success) {
          setStaffOptions(
            (
              res.data as Array<{
                _id: string;
                displayName: string;
                employeeId?: string;
                designation?: { name?: string };
              }>
            ).map((s) => ({
              _id: s._id,
              displayName: s.displayName,
              employeeId: s.employeeId,
              designationName: s.designation?.name,
            }))
          );
        }
      } catch {
        // best-effort search
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [staffQuery, promoteOpen]);

  const handlePromote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff || !promoteForm.toDesignationId) {
      toast.error('Select a staff member and a target designation');
      return;
    }
    setSaving(true);
    try {
      const res = await hrApi.promoteStaff(selectedStaff._id, {
        toDesignationId: promoteForm.toDesignationId,
        lateral: promoteForm.lateral || undefined,
        remarks: promoteForm.remarks.trim() || undefined,
      });
      if (res.success) {
        toast.success(
          res.data.status === 'pending'
            ? 'Promotion submitted for approval'
            : 'Promotion applied — designation and salary updated'
        );
        setPromoteOpen(false);
        setSelectedStaff(null);
        setStaffQuery('');
        setPromoteForm({ toDesignationId: '', lateral: false, remarks: '' });
        fetchData();
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message || 'Failed to promote');
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(policyForm.value);
    if (!policyForm.fromDesignationId || !policyForm.toDesignationId || !value || value <= 0) {
      toast.error('Both designations and a positive increment value are required');
      return;
    }
    try {
      const res = await hrApi.createPromotionPolicy({
        fromDesignationId: policyForm.fromDesignationId,
        toDesignationId: policyForm.toDesignationId,
        increment:
          policyForm.incrementType === 'percentage'
            ? { type: 'percentage', value, base: policyForm.base }
            : { type: 'fixed', value },
        requiresApproval: policyForm.requiresApproval,
      });
      if (res.success) {
        toast.success('Promotion policy created');
        setPolicyOpen(false);
        setPolicyForm({
          fromDesignationId: '',
          toDesignationId: '',
          incrementType: 'percentage',
          value: '',
          base: 'basic',
          requiresApproval: false,
        });
        fetchData();
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message || 'Failed to create policy');
    }
  };

  const handleDeletePolicy = async (policy: PromotionPolicy) => {
    try {
      const res = await hrApi.deletePromotionPolicy(policy._id);
      if (res.success) {
        toast.success('Policy deleted');
        fetchData();
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message || 'Failed to delete policy');
    }
  };

  const handleApprove = async (row: PromotionRow) => {
    try {
      const res = await hrApi.approvePromotion(row._id);
      if (res.success) {
        toast.success('Promotion approved and applied');
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
      const res = await hrApi.rejectPromotion(rejectTarget._id, rejectReason.trim());
      if (res.success) {
        toast.success('Promotion rejected');
        setRejectTarget(null);
        setRejectReason('');
        fetchData();
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message || 'Failed to reject');
    }
  };

  return (
    <div className="space-y-6">
      <PageHero
        title="Promotions"
        description="Designation changes with history, validated against the designation ladder — salary updates follow your configurable policies"
        icon={TrendingUp}
        actions={
          canPromote ? (
            <Button onClick={() => setPromoteOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Promote Staff
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Promotion History & Approvals</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-muted-foreground">Loading…</p>
          ) : promotions.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No promotions recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff</TableHead>
                    <TableHead>Change</TableHead>
                    <TableHead>Effective</TableHead>
                    <TableHead>Salary Change</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {promotions.map((row) => {
                    const badge = STATUS_BADGES[row.status];
                    return (
                      <TableRow key={row._id}>
                        <TableCell>
                          <p className="font-medium">{row.staffName}</p>
                          <p className="text-xs text-muted-foreground">{row.employeeId}</p>
                        </TableCell>
                        <TableCell>
                          {row.fromDesignationName || '—'} → {row.toDesignationName}
                          {row.lateral && (
                            <Badge variant="outline" className="ml-2">
                              Lateral
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {new Date(row.effectiveFrom).toLocaleDateString('en-IN')}
                        </TableCell>
                        <TableCell>
                          {row.salaryChange
                            ? `${formatCurrency(row.salaryChange.previousNet, 'INR')} → ${formatCurrency(row.salaryChange.newNet, 'INR')}`
                            : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {row.status === 'pending' && canDecide && (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-green-600"
                                title="Approve & apply"
                                onClick={() => handleApprove(row)}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                title="Reject"
                                onClick={() => setRejectTarget(row)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
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

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Promotion Policies</CardTitle>
          {canManagePolicies && (
            <Button variant="outline" size="sm" onClick={() => setPolicyOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Policy
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {policies.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No policies yet. Without a policy, a promotion changes the designation but leaves the
              salary untouched. Add one to automate increments (e.g. Assistant → Associate
              Professor, +10% on basic).
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Increment</TableHead>
                    <TableHead>Approval</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policies.map((policy) => (
                    <TableRow key={policy._id}>
                      <TableCell>{policy.fromDesignationName}</TableCell>
                      <TableCell>{policy.toDesignationName}</TableCell>
                      <TableCell>{incrementLabel(policy.increment)}</TableCell>
                      <TableCell>{policy.requiresApproval ? 'Required' : 'Automatic'}</TableCell>
                      <TableCell className="capitalize">{policy.status}</TableCell>
                      <TableCell className="text-right">
                        {canManagePolicies && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleDeletePolicy(policy)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Promote dialog */}
      <Dialog open={promoteOpen} onOpenChange={setPromoteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Promote Staff</DialogTitle>
            <DialogDescription>
              The designation ladder is enforced (level 1 = highest); the matching policy decides
              the salary change and whether approval is needed.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePromote} className="space-y-4">
            <div className="space-y-2">
              <Label>Staff member *</Label>
              {selectedStaff ? (
                <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{selectedStaff.displayName}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedStaff.employeeId}
                      {selectedStaff.designationName ? ` · ${selectedStaff.designationName}` : ''}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedStaff(null)}
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
                      value={staffQuery}
                      onChange={(e) => setStaffQuery(e.target.value)}
                      placeholder="Search staff by name or employee ID…"
                    />
                  </div>
                  {staffOptions.length > 0 && (
                    <div className="rounded-lg border divide-y max-h-44 overflow-y-auto">
                      {staffOptions.map((s) => (
                        <button
                          key={s._id}
                          type="button"
                          className="w-full px-3 py-2 text-left hover:bg-muted/50"
                          onClick={() => {
                            setSelectedStaff(s);
                            setStaffOptions([]);
                          }}
                        >
                          <p className="text-sm font-medium">{s.displayName}</p>
                          <p className="text-xs text-muted-foreground">
                            {s.employeeId}
                            {s.designationName ? ` · ${s.designationName}` : ''}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="space-y-2">
              <Label>New designation *</Label>
              <Select
                value={promoteForm.toDesignationId}
                onValueChange={(value) =>
                  setPromoteForm({ ...promoteForm, toDesignationId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select designation" />
                </SelectTrigger>
                <SelectContent>
                  {designations.map((d) => (
                    <SelectItem key={d._id} value={d._id}>
                      {d.name}
                      {typeof d.level === 'number' ? ` (level ${d.level})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Lateral move</p>
                <p className="text-xs text-muted-foreground">
                  Allow a sideways change that isn't upward on the ladder.
                </p>
              </div>
              <Switch
                checked={promoteForm.lateral}
                onCheckedChange={(checked) => setPromoteForm({ ...promoteForm, lateral: checked })}
              />
            </div>

            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea
                rows={2}
                value={promoteForm.remarks}
                onChange={(e) => setPromoteForm({ ...promoteForm, remarks: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPromoteOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Promote'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Policy dialog */}
      <Dialog open={policyOpen} onOpenChange={setPolicyOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Promotion Policy</DialogTitle>
            <DialogDescription>
              What happens to salary when someone moves between these designations.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreatePolicy} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>From *</Label>
                <Select
                  value={policyForm.fromDesignationId}
                  onValueChange={(value) =>
                    setPolicyForm({ ...policyForm, fromDesignationId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Designation" />
                  </SelectTrigger>
                  <SelectContent>
                    {designations.map((d) => (
                      <SelectItem key={d._id} value={d._id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>To *</Label>
                <Select
                  value={policyForm.toDesignationId}
                  onValueChange={(value) =>
                    setPolicyForm({ ...policyForm, toDesignationId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Designation" />
                  </SelectTrigger>
                  <SelectContent>
                    {designations.map((d) => (
                      <SelectItem key={d._id} value={d._id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Increment *</Label>
                <Select
                  value={policyForm.incrementType}
                  onValueChange={(value: 'percentage' | 'fixed') =>
                    setPolicyForm({ ...policyForm, incrementType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="fixed">Fixed amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>
                  {policyForm.incrementType === 'percentage' ? 'Percent *' : 'Amount *'}
                </Label>
                <Input
                  type="number"
                  min="1"
                  value={policyForm.value}
                  onChange={(e) => setPolicyForm({ ...policyForm, value: e.target.value })}
                  placeholder={policyForm.incrementType === 'percentage' ? '10' : '5000'}
                />
              </div>
              {policyForm.incrementType === 'percentage' && (
                <div className="space-y-2">
                  <Label>On</Label>
                  <Select
                    value={policyForm.base}
                    onValueChange={(value: 'basic' | 'gross') =>
                      setPolicyForm({ ...policyForm, base: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic">Basic</SelectItem>
                      <SelectItem value="gross">Gross</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Requires approval</p>
                <p className="text-xs text-muted-foreground">
                  Promotions on this path wait for an approver before applying.
                </p>
              </div>
              <Switch
                checked={policyForm.requiresApproval}
                onCheckedChange={(checked) =>
                  setPolicyForm({ ...policyForm, requiresApproval: checked })
                }
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPolicyOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Policy</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reject promotion?</DialogTitle>
            <DialogDescription>
              {rejectTarget?.staffName} → {rejectTarget?.toDesignationName}
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
    </div>
  );
}

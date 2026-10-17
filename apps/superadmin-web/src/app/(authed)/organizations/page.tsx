'use client';

import { useEffect, useState, useCallback } from 'react';
import { organizationsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Search,
  Building2,
  Mail,
  Phone,
  Calendar,
  Check,
  UserPlus,
  GraduationCap,
  Wallet,
  Users,
  ClipboardCheck,
  MessageSquare,
  Award,
  Settings,
  Trash2,
  AlertTriangle,
  Target,
} from 'lucide-react';
import { MODULES, CORE_MODULES, OPTIONAL_MODULES, type ModuleCode } from '@campus-verse/shared';
import { Label } from '@/components/ui/label';

interface Organization {
  id: string;
  organizationName: string;
  institutionType: string;
  admin: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  emailVerified: boolean;
  status: string;
  requestedModules?: string[];
  approvedModules?: string[];
  rejectionReason?: string;
  createdAt: string;
  approvedAt?: string;
  rejectedAt?: string;
}

const moduleIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  core: Building2,
  admissions: UserPlus,
  students: GraduationCap,
  finance: Wallet,
  hr: Users,
  attendance: ClipboardCheck,
  communications: MessageSquare,
  certificates: Award,
  obe: Target,
};

type StatusFilter = 'all' | 'pending_approval' | 'approved' | 'rejected';

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending_approval');
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showEditModulesDialog, setShowEditModulesDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [approvalModules, setApprovalModules] = useState<string[]>([]);
  const [editModules, setEditModules] = useState<string[]>([]);

  const toggleApprovalModule = (moduleCode: string) => {
    if (CORE_MODULES.includes(moduleCode as ModuleCode)) return;

    if (approvalModules.includes(moduleCode)) {
      setApprovalModules(approvalModules.filter((m) => m !== moduleCode));
    } else {
      setApprovalModules([...approvalModules, moduleCode]);
    }
  };

  const toggleEditModule = (moduleCode: string) => {
    if (CORE_MODULES.includes(moduleCode as ModuleCode)) return;

    if (editModules.includes(moduleCode)) {
      setEditModules(editModules.filter((m) => m !== moduleCode));
    } else {
      setEditModules([...editModules, moduleCode]);
    }
  };

  const openApproveDialog = (org: Organization) => {
    setSelectedOrg(org);
    const initialModules = org.requestedModules || ['core', 'students', 'attendance', 'teaching'];
    setApprovalModules(initialModules);
    setShowApproveDialog(true);
  };

  const openEditModulesDialog = (org: Organization) => {
    setSelectedOrg(org);
    const currentModules = org.approvedModules || ['core'];
    setEditModules(currentModules);
    setShowEditModulesDialog(true);
  };

  const fetchOrganizations = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: { status?: string } = {};
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      const response = await organizationsApi.getAll(params);
      if (response.success) {
        setOrganizations(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
      toast.error('Failed to load organizations');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  const handleApprove = async () => {
    if (!selectedOrg) return;
    setIsProcessing(true);
    try {
      await organizationsApi.approve(selectedOrg.id, { approvedModules: approvalModules });
      toast.success(`${selectedOrg.organizationName} has been approved`);
      setShowApproveDialog(false);
      setSelectedOrg(null);
      setApprovalModules([]);
      fetchOrganizations();
    } catch (error) {
      console.error('Failed to approve:', error);
      toast.error('Failed to approve organization');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedOrg || !rejectReason.trim()) return;
    setIsProcessing(true);
    try {
      await organizationsApi.reject(selectedOrg.id, rejectReason);
      toast.success(`${selectedOrg.organizationName} has been rejected`);
      setShowRejectDialog(false);
      setSelectedOrg(null);
      setRejectReason('');
      fetchOrganizations();
    } catch (error) {
      console.error('Failed to reject:', error);
      toast.error('Failed to reject organization');
    } finally {
      setIsProcessing(false);
    }
  };

  const openDeleteDialog = (org: Organization) => {
    setSelectedOrg(org);
    setDeleteConfirmName('');
    setShowDeleteDialog(true);
  };

  const handleDelete = async () => {
    if (!selectedOrg || deleteConfirmName.trim() !== selectedOrg.organizationName.trim()) return;
    setIsProcessing(true);
    try {
      const res = await organizationsApi.delete(selectedOrg.id, deleteConfirmName.trim());
      const purged = res.data?.documentsDeleted || 0;
      toast.success(
        `${selectedOrg.organizationName} deleted${purged ? ` (${purged} records purged)` : ''}`
      );
      setShowDeleteDialog(false);
      setSelectedOrg(null);
      setDeleteConfirmName('');
      fetchOrganizations();
    } catch (error) {
      console.error('Failed to delete organization:', error);
      toast.error('Failed to delete organization');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateModules = async () => {
    if (!selectedOrg) return;
    setIsProcessing(true);
    try {
      await organizationsApi.updateModules(selectedOrg.id, editModules);
      toast.success(`Modules updated for ${selectedOrg.organizationName}`);
      setShowEditModulesDialog(false);
      setSelectedOrg(null);
      setEditModules([]);
      fetchOrganizations();
    } catch (error) {
      console.error('Failed to update modules:', error);
      toast.error('Failed to update modules');
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending_verification: 'bg-gray-100 text-gray-700',
      pending_approval: 'bg-amber-100 text-amber-700',
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
    };
    const labels: Record<string, string> = {
      pending_verification: 'Pending Verification',
      pending_approval: 'Pending Approval',
      approved: 'Approved',
      rejected: 'Rejected',
    };
    return <Badge className={styles[status] || 'bg-gray-100'}>{labels[status] || status}</Badge>;
  };

  const filteredOrgs = organizations.filter(
    (org) =>
      org.organizationName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.admin.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const statusTabs: { value: StatusFilter; label: string; count?: number }[] = [
    { value: 'pending_approval', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'all', label: 'All' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Organizations</h1>
        <p className="text-muted-foreground">Manage organization signups and approvals</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-2">
          {statusTabs.map((tab) => (
            <Button
              key={tab.value}
              variant={statusFilter === tab.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(tab.value)}
            >
              {tab.label}
            </Button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search organizations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredOrgs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No organizations found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredOrgs.map((org) => (
            <Card key={org.id}>
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-lg">{org.organizationName}</h3>
                      {getStatusBadge(org.status)}
                      <Badge variant="outline" className="capitalize">
                        {org.institutionType}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Mail className="h-4 w-4" />
                        {org.admin.email}
                      </span>
                      <span className="flex items-center gap-1">
                        <Phone className="h-4 w-4" />
                        {org.admin.phone}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {new Date(org.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {org.rejectionReason && (
                      <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
                        <strong>Rejection reason:</strong> {org.rejectionReason}
                      </p>
                    )}
                    {org.status === 'approved' && org.approvedModules && (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {org.approvedModules.map((moduleCode) => {
                          const modInfo = MODULES[moduleCode as ModuleCode];
                          return (
                            <Badge key={moduleCode} variant="secondary" className="text-xs">
                              {modInfo?.name || moduleCode}
                            </Badge>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {org.status === 'pending_approval' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-green-600 border-green-200 hover:bg-green-50"
                          onClick={() => openApproveDialog(org)}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => {
                            setSelectedOrg(org);
                            setShowRejectDialog(true);
                          }}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </>
                    )}

                    {org.status === 'approved' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditModulesDialog(org)}
                      >
                        <Settings className="h-4 w-4 mr-1" />
                        Edit Modules
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => openDeleteDialog(org)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Approve Organization</DialogTitle>
            <DialogDescription>
              Review and approve <strong>{selectedOrg?.organizationName}</strong>. Select the
              modules to enable for this organization.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm font-medium mb-3 block">Enabled Modules</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-lg border-2 border-primary bg-primary/5 text-primary cursor-not-allowed">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    <span className="text-sm font-medium">Core</span>
                    <Check className="h-3.5 w-3.5 ml-auto" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Always included</p>
                </div>

                {OPTIONAL_MODULES.map((moduleCode) => {
                  const modInfo = MODULES[moduleCode];
                  const Icon = moduleIcons[moduleCode] || Building2;
                  const isSelected = approvalModules.includes(moduleCode);
                  const wasRequested = selectedOrg?.requestedModules?.includes(moduleCode);
                  return (
                    <button
                      key={moduleCode}
                      type="button"
                      onClick={() => toggleApprovalModule(moduleCode)}
                      className={`p-3 rounded-lg border-2 transition-all text-left ${
                        isSelected
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon
                          className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}
                        />
                        <span className="text-sm font-medium">{modInfo.name}</span>
                        {wasRequested && !isSelected && (
                          <Badge variant="outline" className="ml-auto text-xs">
                            Requested
                          </Badge>
                        )}
                        {isSelected && <Check className="h-3.5 w-3.5 ml-auto text-primary" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        {modInfo.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedOrg?.requestedModules && selectedOrg.requestedModules.length > 0 && (
              <p className="text-sm text-muted-foreground">
                <strong>Requested:</strong> {selectedOrg.requestedModules.join(', ')}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleApprove} disabled={isProcessing}>
              {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Approve with {approvalModules.length} modules
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Organization</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting <strong>{selectedOrg?.organizationName}</strong>
              . This will be included in the rejection email.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Enter rejection reason..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isProcessing || rejectReason.trim().length < 10}
            >
              {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showDeleteDialog}
        onOpenChange={(open) => {
          setShowDeleteDialog(open);
          if (!open) setDeleteConfirmName('');
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Delete Organization
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 pt-1">
                <p>
                  You are about to permanently delete{' '}
                  <strong>{selectedOrg?.organizationName}</strong>.
                </p>
                {selectedOrg?.status === 'approved' ? (
                  <p className="text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 text-sm">
                    This organization is <strong>live</strong> — deleting it wipes its entire
                    tenant: users, branches, students, finance, attendance, HR and all other
                    records. This cannot be undone.
                  </p>
                ) : (
                  <p className="text-sm">
                    This removes the signup record permanently. This cannot be undone.
                  </p>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="delete-confirm" className="text-sm">
              Type <strong>{selectedOrg?.organizationName}</strong> to confirm
            </Label>
            <Input
              id="delete-confirm"
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder={selectedOrg?.organizationName}
              autoComplete="off"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={
                isProcessing ||
                deleteConfirmName.trim() !== (selectedOrg?.organizationName || '').trim()
              }
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditModulesDialog} onOpenChange={setShowEditModulesDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Modules</DialogTitle>
            <DialogDescription>
              Update enabled modules for <strong>{selectedOrg?.organizationName}</strong>. Changes
              will take effect immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm font-medium mb-3 block">Enabled Modules</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-lg border-2 border-primary bg-primary/5 text-primary cursor-not-allowed">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    <span className="text-sm font-medium">Core</span>
                    <Check className="h-3.5 w-3.5 ml-auto" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Always included</p>
                </div>

                {OPTIONAL_MODULES.map((moduleCode) => {
                  const modInfo = MODULES[moduleCode];
                  const Icon = moduleIcons[moduleCode] || Building2;
                  const isSelected = editModules.includes(moduleCode);
                  return (
                    <button
                      key={moduleCode}
                      type="button"
                      onClick={() => toggleEditModule(moduleCode)}
                      className={`p-3 rounded-lg border-2 transition-all text-left ${
                        isSelected
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon
                          className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}
                        />
                        <span className="text-sm font-medium">{modInfo.name}</span>
                        {isSelected && <Check className="h-3.5 w-3.5 ml-auto text-primary" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        {modInfo.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedOrg?.approvedModules && (
              <p className="text-sm text-muted-foreground">
                <strong>Currently enabled:</strong> {selectedOrg.approvedModules.join(', ')}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModulesDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateModules} disabled={isProcessing}>
              {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

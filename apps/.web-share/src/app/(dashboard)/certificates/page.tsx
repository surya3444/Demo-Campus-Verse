'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader, AddButton } from '@/components/ui/page-header';
import { DataTable, Column, DataTableAction } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/stat-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  Eye,
  Check,
  Download,
  Users,
  GraduationCap,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { certificatesApi, studentApi, hrApi } from '@/lib/api';

interface CertificateRequest {
  _id: string;
  certificateNumber: string;
  certificateTypeId: string;
  certificateTypeName?: string;
  certificateTypeCode?: string;
  category: 'student' | 'staff';
  requestorId: string;
  requestorType: 'student' | 'staff';
  purpose?: string;
  fieldValues: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected' | 'issued' | 'cancelled';
  rejectionReason?: string;
  issuedAt?: string;
  createdAt: string;
}

interface CertificateType {
  _id: string;
  name: string;
  code: string;
  category: 'student' | 'staff';
  requiresApproval: boolean;
}

interface Stats {
  summary: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    issued: number;
  };
  byCategory: Record<string, number>;
}

const statusColors: Record<string, string> = {
  pending: 'bg-warning/10 text-warning border-warning/20',
  approved: 'bg-info/10 text-info border-info/20',
  rejected: 'bg-destructive/10 text-destructive border-destructive/20',
  issued: 'bg-success/10 text-success border-success/20',
  cancelled: 'bg-muted text-muted-foreground',
};

export default function CertificatesPage() {
  const [requests, setRequests] = useState<CertificateRequest[]>([]);
  const [types, setTypes] = useState<CertificateType[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<CertificateRequest | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'view' | 'add'>('view');
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'student' | 'staff'>('student');

  // Form state for new request
  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [selectedRequestorId, setSelectedRequestorId] = useState('');
  const [purpose, setPurpose] = useState('');
  const [requestors, setRequestors] = useState<Array<{ _id: string; displayName: string }>>([]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [requestsRes, typesRes, statsRes] = await Promise.all([
        certificatesApi.getRequests({ limit: 100 }),
        certificatesApi.getTypes(),
        certificatesApi.getStats(),
      ]);
      setRequests(requestsRes.data || []);
      setTypes(typesRes.data || []);
      setStats(statsRes.data || null);
    } catch (err) {
      console.error('Failed to fetch certificates:', err);
      setError('Failed to load certificates');
      toast.error('Failed to load certificates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch requestors when dialog opens
  useEffect(() => {
    if (dialogMode === 'add' && dialogOpen) {
      const fetchRequestors = async () => {
        try {
          if (activeTab === 'student') {
            const res = await studentApi.getStudents({ limit: 100 });
            setRequestors(res.data || []);
          } else {
            const res = await hrApi.getStaff({ limit: 100 });
            setRequestors(res.data || []);
          }
        } catch (err) {
          console.error('Failed to fetch requestors:', err);
        }
      };
      fetchRequestors();
    }
  }, [dialogMode, dialogOpen, activeTab]);

  const handleApprove = async (request: CertificateRequest) => {
    try {
      setActionLoading(true);
      await certificatesApi.approveRequest(request._id, 'Approved');
      toast.success('Certificate request approved');
      setDialogOpen(false);
      fetchData();
    } catch (err) {
      console.error('Failed to approve:', err);
      toast.error('Failed to approve request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleIssue = async (request: CertificateRequest) => {
    try {
      setActionLoading(true);
      await certificatesApi.issueRequest(request._id);
      toast.success('Certificate issued successfully');
      setDialogOpen(false);
      fetchData();
    } catch (err) {
      console.error('Failed to issue:', err);
      toast.error('Failed to issue certificate');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateRequest = async () => {
    if (!selectedTypeId || !selectedRequestorId) {
      toast.error('Please select certificate type and requestor');
      return;
    }

    try {
      setActionLoading(true);
      await certificatesApi.createRequest({
        certificateTypeId: selectedTypeId,
        requestorId: selectedRequestorId,
        requestorType: activeTab,
        purpose: purpose || undefined,
      });
      toast.success('Certificate request created');
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (err) {
      console.error('Failed to create request:', err);
      toast.error('Failed to create request');
    } finally {
      setActionLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedTypeId('');
    setSelectedRequestorId('');
    setPurpose('');
  };

  const filteredTypes = types.filter((t) => t.category === activeTab);
  const filteredRequests = requests.filter((r) => r.category === activeTab);

  const columns: Column<CertificateRequest>[] = [
    {
      key: 'certificateNumber',
      header: 'Certificate No.',
      sortable: true,
      cell: (row) => (
        <div>
          <p className="font-medium">{row.certificateNumber}</p>
          <p className="text-xs text-muted-foreground">
            {row.certificateTypeName || row.certificateTypeCode}
          </p>
        </div>
      ),
    },
    {
      key: 'requestorId',
      header: 'Requestor',
      cell: (row) => (
        <div className="flex items-center gap-2">
          {row.requestorType === 'student' ? (
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Users className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="capitalize">{row.requestorType}</span>
        </div>
      ),
    },
    {
      key: 'purpose',
      header: 'Purpose',
      cell: (row) => (
        <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
          {row.purpose || '-'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Requested On',
      sortable: true,
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          {new Date(row.createdAt).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => (
        <Badge variant="secondary" className={`capitalize ${statusColors[row.status]}`}>
          {row.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
          {row.status === 'approved' && <CheckCircle className="h-3 w-3 mr-1" />}
          {row.status === 'issued' && <FileText className="h-3 w-3 mr-1" />}
          {row.status === 'rejected' && <XCircle className="h-3 w-3 mr-1" />}
          {row.status}
        </Badge>
      ),
    },
  ];

  const actions: DataTableAction<CertificateRequest>[] = [
    {
      label: 'View Details',
      icon: <Eye className="mr-2 h-4 w-4" />,
      onClick: (row) => {
        setSelectedRequest(row);
        setDialogMode('view');
        setDialogOpen(true);
      },
    },
    {
      label: 'Approve',
      icon: <Check className="mr-2 h-4 w-4" />,
      onClick: (row) => handleApprove(row),
      disabled: (row) => row.status !== 'pending' || actionLoading,
    },
    {
      label: 'Issue',
      icon: <Download className="mr-2 h-4 w-4" />,
      onClick: (row) => handleIssue(row),
      disabled: (row) => row.status !== 'approved' || actionLoading,
    },
  ];

  if (loading && requests.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading certificates...</p>
        </div>
      </div>
    );
  }

  if (error && requests.length === 0) {
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
        title="Certificates"
        description="Manage certificate requests and issuance"
        actions={[
          {
            label: 'Reports',
            icon: FileText,
            variant: 'outline',
            href: '/certificates/reports',
          },
        ]}
      >
        <AddButton
          onClick={() => {
            setDialogMode('add');
            setDialogOpen(true);
          }}
          label="New Request"
        />
      </PageHeader>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4 stagger-animation">
        <StatCard title="Total Requests" value={stats?.summary.total || 0} icon={FileText} />
        <StatCard
          title="Pending"
          value={stats?.summary.pending || 0}
          icon={Clock}
          variant="warning"
        />
        <StatCard
          title="Approved"
          value={stats?.summary.approved || 0}
          icon={CheckCircle}
          variant="primary"
        />
        <StatCard
          title="Issued"
          value={stats?.summary.issued || 0}
          icon={Download}
          variant="success"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'student' | 'staff')}>
        <TabsList>
          <TabsTrigger value="student" className="gap-2">
            <GraduationCap className="h-4 w-4" />
            Student Certificates
          </TabsTrigger>
          <TabsTrigger value="staff" className="gap-2">
            <Users className="h-4 w-4" />
            Staff Certificates
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <DataTable
            data={filteredRequests}
            columns={columns}
            actions={actions}
            searchable
            searchPlaceholder="Search by certificate number..."
          />
        </TabsContent>
      </Tabs>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'view' ? 'Certificate Request Details' : 'New Certificate Request'}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === 'view'
                ? `Request #${selectedRequest?.certificateNumber}`
                : `Create a new ${activeTab} certificate request`}
            </DialogDescription>
          </DialogHeader>

          {dialogMode === 'view' && selectedRequest ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg border">
                  <p className="text-sm text-muted-foreground">Certificate Type</p>
                  <p className="font-medium">
                    {selectedRequest.certificateTypeName || selectedRequest.certificateTypeCode}
                  </p>
                </div>
                <div className="p-3 rounded-lg border">
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge
                    variant="secondary"
                    className={`capitalize mt-1 ${statusColors[selectedRequest.status]}`}
                  >
                    {selectedRequest.status}
                  </Badge>
                </div>
                <div className="p-3 rounded-lg border col-span-2">
                  <p className="text-sm text-muted-foreground">Purpose</p>
                  <p>{selectedRequest.purpose || 'Not specified'}</p>
                </div>
              </div>

              {selectedRequest.rejectionReason && (
                <div className="p-3 rounded-lg border bg-destructive/5 border-destructive/20">
                  <p className="text-sm text-muted-foreground">Rejection Reason</p>
                  <p className="text-destructive">{selectedRequest.rejectionReason}</p>
                </div>
              )}

              {selectedRequest.status === 'pending' && (
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>
                    Close
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => handleApprove(selectedRequest)}
                    disabled={actionLoading}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                </div>
              )}

              {selectedRequest.status === 'approved' && (
                <Button
                  className="w-full"
                  onClick={() => handleIssue(selectedRequest)}
                  disabled={actionLoading}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Issue Certificate
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Certificate Type</Label>
                <Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredTypes.map((type) => (
                      <SelectItem key={type._id} value={type._id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{activeTab === 'student' ? 'Student' : 'Staff Member'}</Label>
                <Select value={selectedRequestorId} onValueChange={setSelectedRequestorId}>
                  <SelectTrigger>
                    <SelectValue placeholder={`Select ${activeTab}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {requestors.map((r) => (
                      <SelectItem key={r._id} value={r._id}>
                        {r.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Purpose (Optional)</Label>
                <Textarea
                  placeholder="Enter purpose for certificate..."
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setDialogOpen(false);
                    resetForm();
                  }}
                  disabled={actionLoading}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleCreateRequest}
                  disabled={actionLoading || !selectedTypeId || !selectedRequestorId}
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Request'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

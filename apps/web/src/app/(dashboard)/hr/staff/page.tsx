'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  Users,
  UserCheck,
  Briefcase,
  GraduationCap,
  Eye,
  Pencil,
  Trash2,
  Phone,
  Mail,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Download,
  Building2,
  Calendar,
  Loader2,
  AlertCircle,
  Upload,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { hrApi, organizationApi } from '@/lib/api';
import {
  CustomFieldsRenderer,
  validateCustomFields,
  CustomField,
} from '@/components/common/CustomFieldsRenderer';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/usePermissions';

interface Staff {
  _id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  displayName: string;
  photo?: string;
  contact: {
    email: string;
    phone: string;
  };
  employment: {
    joiningDate: string;
    departmentId?: string;
    designationId?: string;
    employmentType: string;
  };
  teaching?: {
    isTeaching: boolean;
  };
  status: 'active' | 'inactive' | 'on-leave' | 'resigned' | 'terminated';
  approvalStatus?: 'approved' | 'pending_approval' | 'rejected';
  requestedRoleCode?: string;
  rejectionReason?: string;
}

interface Department {
  _id: string;
  name: string;
}

interface Designation {
  _id: string;
  name: string;
}

interface StaffStats {
  total: number;
  byStatus: Record<string, number>;
  teaching: number;
  nonTeaching: number;
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  variant?: 'default' | 'success' | 'warning' | 'primary';
}

function StatCard({ title, value, icon: Icon, variant = 'default' }: StatCardProps) {
  const variants = {
    default: 'bg-card',
    success: 'bg-gradient-to-br from-success to-emerald-600 text-white',
    warning: 'bg-gradient-to-br from-amber-500 to-amber-600 text-white',
    primary: 'bg-gradient-to-br from-primary to-primary/90 text-primary-foreground',
  };
  const isColored = variant !== 'default';

  return (
    <Card
      className={`border-0 shadow-elegant-md hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1 ${variants[variant]}`}
    >
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p
              className={`text-sm font-medium ${isColored ? 'text-white/70' : 'text-muted-foreground'}`}
            >
              {title}
            </p>
            <p className={`text-3xl font-bold mt-1 ${isColored ? '' : 'text-foreground'}`}>
              {value}
            </p>
          </div>
          <div className={`p-3 rounded-xl ${isColored ? 'bg-white/10' : 'bg-muted'}`}>
            <Icon className={`h-5 w-5 ${isColored ? '' : 'text-muted-foreground'}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface NewStaffForm {
  firstName: string;
  lastName: string;
  gender: 'male' | 'female' | 'other';
  dateOfBirth: string;
  email: string;
  phone: string;
  joiningDate: string;
  employmentType: 'permanent' | 'contract' | 'probation' | 'intern';
  departmentId: string;
  designationId: string;
  isTeaching: boolean;
  roleCode: string;
  /** What this login may see: the whole campus or one institution / department / program. */
  scopeType: 'branch' | 'institution' | 'department' | 'program';
  scopeId: string;
  /** Optional initial password; otherwise a temporary one is emailed. */
  password: string;
}

const defaultFormState: NewStaffForm = {
  firstName: '',
  lastName: '',
  gender: 'male',
  dateOfBirth: '',
  email: '',
  phone: '',
  joiningDate: new Date().toISOString().split('T')[0],
  employmentType: 'permanent',
  departmentId: '',
  designationId: '',
  isTeaching: false,
  roleCode: '',
  scopeType: 'branch',
  scopeId: '',
  password: '',
};

// Validation helpers
const phoneRegex = /^[6-9]\d{9}$/; // Exactly 10 digits starting with 6-9
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validatePhone = (phone: string): string | null => {
  if (!phone) return 'Phone number is required';
  if (!phoneRegex.test(phone)) {
    return 'Enter valid 10-digit number starting with 6-9';
  }
  return null;
};

const validateEmail = (email: string): string | null => {
  if (!email) return 'Email is required';
  if (!emailRegex.test(email)) {
    return 'Invalid email address';
  }
  return null;
};

// Format phone for API (add +91 prefix)
const formatPhoneForApi = (phone: string): string => {
  if (!phone) return '';
  return `+91${phone}`;
};

// Only allow digits and limit to 10 characters
const handlePhoneInput = (value: string): string => {
  return value.replace(/\D/g, '').slice(0, 10);
};

export default function StaffPage() {
  const router = useRouter();
  const { isGroupOwner, isOrgAdmin } = usePermissions();
  const canApprove = isGroupOwner || isOrgAdmin; // roleLevel <= 2

  const [staff, setStaff] = useState<Staff[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [institutions, setInstitutions] = useState<Array<{ _id: string; name: string }>>([]);
  const [programs, setPrograms] = useState<Array<{ _id: string; name: string }>>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [stats, setStats] = useState<StaffStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Directory filters
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDepartmentId, setFilterDepartmentId] = useState<string>('all');
  const [filterTeaching, setFilterTeaching] = useState<string>('all');

  // Delete confirmation
  const [staffToDelete, setStaffToDelete] = useState<Staff | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Add Staff Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState<NewStaffForm>(defaultFormState);
  const [formErrors, setFormErrors] = useState<Record<string, string | null>>({});
  const [submitting, setSubmitting] = useState(false);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});
  const [customFieldDefs, setCustomFieldDefs] = useState<CustomField[]>([]);
  const [customFieldErrors, setCustomFieldErrors] = useState<Record<string, string>>({});

  // Roles for the role selector in the add form
  const [roles, setRoles] = useState<Array<{ _id: string; code: string; name: string }>>([]);
  // Pending approvals (visible to Group Owner / Org Admin only)
  const [pendingApprovals, setPendingApprovals] = useState<Staff[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [staffRes, deptRes, desgRes, statsRes] = await Promise.all([
        hrApi.getStaff({
          page,
          limit: 20,
          search: searchQuery || undefined,
          sortBy,
          sortOrder,
          status: filterStatus !== 'all' ? filterStatus : undefined,
          departmentId: filterDepartmentId !== 'all' ? filterDepartmentId : undefined,
          isTeaching: filterTeaching === 'all' ? undefined : filterTeaching === 'teaching',
        }),
        hrApi.getDepartments(),
        hrApi.getDesignations(),
        hrApi.getStaffStats(),
      ]);

      setStaff(staffRes.data || []);
      setDepartments(deptRes.data || []);
      // For the Access picker; failures just leave the lists empty.
      organizationApi
        .getInstitutions({ status: 'active' })
        .then((r) => setInstitutions(r.data || []))
        .catch(() => setInstitutions([]));
      organizationApi
        .getPrograms()
        .then((r) => setPrograms(r.data || []))
        .catch(() => setPrograms([]));
      setDesignations(desgRes.data || []);
      setStats(statsRes.data || null);
      setTotalPages(staffRes.meta?.totalPages || 1);
      setTotal(staffRes.meta?.total || 0);
    } catch (err) {
      console.error('Failed to fetch staff data:', err);
      setError('Failed to load staff data');
      toast.error('Failed to load staff data');
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery, sortBy, sortOrder, filterStatus, filterDepartmentId, filterTeaching]);

  // Fetch roles for the role selector + pending approvals for admins
  useEffect(() => {
    organizationApi
      .getRoles?.()
      .then(
        (res: { success?: boolean; data?: Array<{ _id: string; code: string; name: string }> }) => {
          if (res?.success && Array.isArray(res.data)) {
            setRoles(res.data);
          }
        }
      )
      .catch(() => {});

    if (canApprove) {
      hrApi
        .getStaffPendingApprovals()
        .then((res) => {
          if (res?.success && Array.isArray(res.data)) {
            setPendingApprovals(res.data as Staff[]);
          }
        })
        .catch(() => {});
    }
  }, [canApprove]);

  const handleApprove = async (id: string) => {
    setApprovingId(id);
    try {
      const res = await hrApi.approveStaff(id);
      if (res.success) {
        toast.success('Staff approved — welcome email sent');
        setPendingApprovals((prev) => prev.filter((s) => s._id !== id));
        fetchData();
      }
    } catch (err) {
      console.error('Failed to approve staff:', err);
      toast.error('Failed to approve staff');
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (id: string) => {
    const reason = window.prompt('Reason for rejection (optional):');
    setApprovingId(id);
    try {
      const res = await hrApi.rejectStaff(id, reason || undefined);
      if (res.success) {
        toast.success('Staff request rejected');
        setPendingApprovals((prev) => prev.filter((s) => s._id !== id));
        fetchData();
      }
    } catch (err) {
      console.error('Failed to reject staff:', err);
      toast.error('Failed to reject staff');
    } finally {
      setApprovingId(null);
    }
  };

  const handleDeleteStaff = async () => {
    if (!staffToDelete) return;
    setDeleting(true);
    try {
      const response = await hrApi.deleteStaff(staffToDelete._id);
      if (response.success) {
        toast.success('Staff member deleted');
        setStaffToDelete(null);
        fetchData();
      } else {
        throw new Error('Delete failed');
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message || 'Failed to delete staff');
    } finally {
      setDeleting(false);
    }
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const SortableHeader = ({ field, children }: { field: string; children: React.ReactNode }) => (
    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-4">
      <button
        className="flex items-center gap-1 hover:text-foreground transition-colors"
        onClick={() => handleSort(field)}
      >
        {children}
        {sortBy === field ? (
          sortOrder === 'asc' ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-50" />
        )}
      </button>
    </th>
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Create lookup maps for department and designation names
  const deptMap = new Map(departments.map((d) => [d._id, d.name]));
  const desgMap = new Map(designations.map((d) => [d._id, d.name]));

  const getDepartmentName = (id?: string) => (id ? deptMap.get(id) || 'N/A' : 'N/A');
  const getDesignationName = (id?: string) => (id ? desgMap.get(id) || 'N/A' : 'N/A');

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  const handleOpenAddDialog = () => {
    setFormData(defaultFormState);
    setFormErrors({});
    setCustomFieldValues({});
    setCustomFieldErrors({});
    setDialogOpen(true);
  };

  const handleFormChange = (field: keyof NewStaffForm, value: string | boolean) => {
    // Special handling for phone input - only allow digits
    if (field === 'phone' && typeof value === 'string') {
      value = handlePhoneInput(value);
    }

    setFormData((prev) => ({ ...prev, [field]: value }));

    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const validateField = (field: string, value: string): string | null => {
    switch (field) {
      case 'phone':
        return validatePhone(value);
      case 'email':
        return validateEmail(value);
      default:
        return null;
    }
  };

  const handleFieldBlur = (field: string, value: string) => {
    const error = validateField(field, value);
    setFormErrors((prev) => ({ ...prev, [field]: error }));
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string | null> = {};

    if (!formData.firstName.trim()) errors.firstName = 'First name is required';
    if (!formData.lastName.trim()) errors.lastName = 'Last name is required';
    errors.email = validateEmail(formData.email);
    errors.phone = validatePhone(formData.phone);
    if (!formData.joiningDate) errors.joiningDate = 'Joining date is required';

    setFormErrors(errors);
    return !Object.values(errors).some((error) => error !== null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }

    const cfErrors = validateCustomFields(customFieldDefs, customFieldValues);
    if (Object.keys(cfErrors).length > 0) {
      setCustomFieldErrors(cfErrors);
      toast.error('Please fill in all required custom fields');
      return;
    }
    setCustomFieldErrors({});

    try {
      setSubmitting(true);
      const customFieldsPayload =
        Object.keys(customFieldValues).length > 0 ? customFieldValues : undefined;

      await hrApi.createStaff({
        firstName: formData.firstName,
        lastName: formData.lastName,
        gender: formData.gender,
        dateOfBirth: formData.dateOfBirth || undefined,
        contact: {
          email: formData.email,
          phone: formatPhoneForApi(formData.phone),
        },
        employment: {
          joiningDate: formData.joiningDate,
          employmentType: formData.employmentType,
          departmentId: formData.departmentId || undefined,
          designationId: formData.designationId || undefined,
        },
        teaching: {
          isTeaching: formData.isTeaching,
        },
        customFields: customFieldsPayload,
        roleCode: formData.roleCode || undefined,
        ...(formData.scopeType !== 'branch' &&
          formData.scopeId && {
            accessScope: {
              type: formData.scopeType,
              [`${formData.scopeType}Ids`]: [formData.scopeId],
            },
          }),
        ...(formData.password && { password: formData.password }),
      });

      toast.success('Staff member added successfully');
      setDialogOpen(false);
      setFormData(defaultFormState);
      setFormErrors({});
      setCustomFieldValues({});
      setCustomFieldErrors({});
      fetchData();
    } catch (err) {
      console.error('Failed to create staff:', err);
      toast.error('Failed to add staff member');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  if (loading && staff.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading staff data...</p>
        </div>
      </div>
    );
  }

  if (error && staff.length === 0) {
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
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <Users className="h-3.5 w-3.5 text-[hsl(var(--brand-cyan))]" />
            HR · Staff
          </p>
          <h1 className="mt-1.5 font-display text-3xl font-bold leading-tight tracking-tight md:text-4xl">Staff</h1>
          <p className="text-muted-foreground mt-1">Manage teaching and non-teaching staff</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => router.push('/hr/staff/bulk-upload')}
          >
            <Upload className="h-4 w-4" />
            Bulk Upload
          </Button>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button className="gap-2 bg-primary hover:bg-primary/90" onClick={handleOpenAddDialog}>
            <Plus className="h-4 w-4" />
            Add Staff
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4 stagger-animation">
        <StatCard title="Total Staff" value={stats?.total || 0} icon={Users} />
        <StatCard
          title="Active Staff"
          value={stats?.byStatus?.active || 0}
          icon={UserCheck}
          variant="success"
        />
        <StatCard
          title="Teaching Staff"
          value={stats?.teaching || 0}
          icon={GraduationCap}
          variant="primary"
        />
        <StatCard
          title="On Leave"
          value={stats?.byStatus?.['on-leave'] || 0}
          icon={Briefcase}
          variant="warning"
        />
      </div>

      {/* Pending Approvals — visible to Group Owner / Org Admin */}
      {canApprove && pendingApprovals.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2 text-amber-800">
                <AlertCircle className="h-5 w-5" />
                Pending Staff Approvals
                <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200">
                  {pendingApprovals.length}
                </Badge>
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingApprovals.map((s) => (
                <div
                  key={s._id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-white"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-amber-100 text-amber-700 text-sm">
                        {s.firstName?.charAt(0)}
                        {s.lastName?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">
                        {s.displayName || `${s.firstName} ${s.lastName}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.contact?.email} · Role: {s.requestedRoleCode || 'TEACHER'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => handleReject(s._id)}
                      disabled={approvingId === s._id}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => handleApprove(s._id)}
                      disabled={approvingId === s._id}
                    >
                      {approvingId === s._id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                      ) : null}
                      Approve
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Staff Table */}
      <Card className="border-0 shadow-elegant-md">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="text-xl">Staff Directory</CardTitle>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search staff..."
                  className="pl-9 w-64 bg-muted/50 border-transparent focus:bg-white focus:border-border"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon" className="shrink-0 relative">
                    <Filter className="h-4 w-4" />
                    {(filterStatus !== 'all' ||
                      filterDepartmentId !== 'all' ||
                      filterTeaching !== 'all') && (
                      <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">Filters</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          setFilterStatus('all');
                          setFilterDepartmentId('all');
                          setFilterTeaching('all');
                          setPage(1);
                        }}
                      >
                        Reset
                      </Button>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Status</Label>
                      <Select
                        value={filterStatus}
                        onValueChange={(v) => {
                          setFilterStatus(v);
                          setPage(1);
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                          <SelectItem value="on-leave">On Leave</SelectItem>
                          <SelectItem value="resigned">Resigned</SelectItem>
                          <SelectItem value="terminated">Terminated</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Department</Label>
                      <Select
                        value={filterDepartmentId}
                        onValueChange={(v) => {
                          setFilterDepartmentId(v);
                          setPage(1);
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="All departments" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All departments</SelectItem>
                          {departments.map((d) => (
                            <SelectItem key={d._id} value={d._id}>
                              {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Type</Label>
                      <Select
                        value={filterTeaching}
                        onValueChange={(v) => {
                          setFilterTeaching(v);
                          setPage(1);
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="teaching">Teaching</SelectItem>
                          <SelectItem value="non-teaching">Non-Teaching</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50">
                  <SortableHeader field="displayName">Staff Member</SortableHeader>
                  <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-4">
                    Designation
                  </th>
                  <SortableHeader field="employment.type">Type</SortableHeader>
                  <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-4">
                    Contact
                  </th>
                  <SortableHeader field="status">Status</SortableHeader>
                  <th className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-4">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {staff.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Users className="h-12 w-12 text-muted-foreground/50" />
                        <p className="text-lg font-medium text-muted-foreground">
                          No staff members found
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Add your first staff member to get started
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  staff.map((member, index) => (
                    <tr
                      key={member._id}
                      className="hover:bg-muted/30 transition-colors group"
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <td className="px-4 py-4">
                        <div
                          className="flex items-center gap-4 cursor-pointer"
                          onClick={() => router.push(`/hr/staff/${member._id}`)}
                        >
                          <Avatar className="h-11 w-11 ring-2 ring-primary/10">
                            <AvatarImage src={member.photo} />
                            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20 text-primary text-sm font-medium">
                              {getInitials(member.displayName)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                                {member.displayName}
                              </p>
                              {member.approvalStatus === 'pending_approval' && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] bg-amber-50 text-amber-700 border-amber-200"
                                >
                                  Pending Approval
                                </Badge>
                              )}
                              {member.approvalStatus === 'rejected' && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] bg-red-50 text-red-700 border-red-200"
                                >
                                  Rejected
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground font-mono">
                              {member.employeeId}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div>
                          <p className="font-medium">
                            {getDesignationName(member.employment.designationId)}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {getDepartmentName(member.employment.departmentId)}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <Badge
                          variant="secondary"
                          className={`capitalize ${
                            member.teaching?.isTeaching
                              ? 'bg-info/10 text-info border-info/20'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {member.teaching?.isTeaching ? 'teaching' : 'non-teaching'}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        <div className="space-y-1">
                          <p className="text-sm flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                            {member.contact?.phone || 'N/A'}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Mail className="h-3 w-3" />
                            {member.contact?.email || 'N/A'}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <Badge
                          variant="secondary"
                          className={`capitalize ${
                            member.status === 'active'
                              ? 'bg-success/10 text-success border-success/20'
                              : member.status === 'on-leave'
                                ? 'bg-warning/10 text-warning border-warning/20'
                                : member.status === 'resigned' || member.status === 'terminated'
                                  ? 'bg-destructive/10 text-destructive border-destructive/20'
                                  : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {member.status.replace('-', ' ')}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onClick={() => router.push(`/hr/staff/${member._id}`)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => router.push(`/hr/staff/${member._id}?edit=true`)}
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => router.push(`/hr/attendance?staffId=${member._id}`)}
                            >
                              <Calendar className="h-4 w-4 mr-2" />
                              View Attendance
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setStaffToDelete(member)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-6 pt-6 border-t">
            <p className="text-sm text-muted-foreground">
              Showing <span className="font-medium text-foreground">{staff.length}</span> of{' '}
              <span className="font-medium text-foreground">{total}</span> staff members
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = i + 1;
                return (
                  <Button
                    key={pageNum}
                    variant="outline"
                    size="sm"
                    className={
                      page === pageNum
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                        : ''
                    }
                    onClick={() => setPage(pageNum)}
                    disabled={loading}
                  >
                    {pageNum}
                  </Button>
                );
              })}
              {totalPages > 5 && <span className="px-2 text-muted-foreground">...</span>}
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Staff Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Staff Member</DialogTitle>
            <DialogDescription>Fill in the details to add a new staff member</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Information */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground">Personal Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => handleFormChange('firstName', e.target.value)}
                    placeholder="Enter first name"
                    className={formErrors.firstName ? 'border-destructive' : ''}
                  />
                  {formErrors.firstName && (
                    <p className="text-xs text-destructive">{formErrors.firstName}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => handleFormChange('lastName', e.target.value)}
                    placeholder="Enter last name"
                    className={formErrors.lastName ? 'border-destructive' : ''}
                  />
                  {formErrors.lastName && (
                    <p className="text-xs text-destructive">{formErrors.lastName}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gender">Gender *</Label>
                  <Select
                    value={formData.gender}
                    onValueChange={(v) => handleFormChange('gender', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">Date of Birth</Label>
                  <DatePicker
                    id="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={(iso) => handleFormChange('dateOfBirth', iso)}
                    placeholder="Select date of birth"
                    disableFuture
                    defaultMonth={new Date(new Date().getFullYear() - 25, 0)}
                  />
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground">Contact Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleFormChange('email', e.target.value)}
                    onBlur={(e) => handleFieldBlur('email', e.target.value)}
                    placeholder="Enter email address"
                    className={formErrors.email ? 'border-destructive' : ''}
                  />
                  {formErrors.email && (
                    <p className="text-xs text-destructive">{formErrors.email}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">
                    Phone * <span className="text-muted-foreground text-xs">(10 digits)</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                      +91
                    </span>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => handleFormChange('phone', e.target.value)}
                      onBlur={(e) => handleFieldBlur('phone', e.target.value)}
                      placeholder="9876543210"
                      className={`pl-12 ${formErrors.phone ? 'border-destructive' : ''}`}
                      maxLength={10}
                    />
                  </div>
                  {formErrors.phone && (
                    <p className="text-xs text-destructive">{formErrors.phone}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Employment Information */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground">Employment Details</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="joiningDate">Joining Date *</Label>
                  <DatePicker
                    id="joiningDate"
                    value={formData.joiningDate}
                    onChange={(iso) => handleFormChange('joiningDate', iso)}
                    disableFuture
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employmentType">Employment Type *</Label>
                  <Select
                    value={formData.employmentType}
                    onValueChange={(v) => handleFormChange('employmentType', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="permanent">Permanent</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                      <SelectItem value="probation">Probation</SelectItem>
                      <SelectItem value="intern">Intern</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Select
                    value={formData.departmentId}
                    onValueChange={(v) => handleFormChange('departmentId', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.length === 0 ? (
                        <div className="py-2 px-3 text-sm text-muted-foreground">
                          No departments found. Add departments in HR → Departments first.
                        </div>
                      ) : (
                        departments.map((dept) => (
                          <SelectItem key={dept._id} value={dept._id}>
                            {dept.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {departments.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      <a href="/hr/departments" className="text-primary hover:underline">
                        Add departments
                      </a>{' '}
                      to assign staff
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="designation">Designation</Label>
                  <Select
                    value={formData.designationId}
                    onValueChange={(v) => handleFormChange('designationId', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select designation" />
                    </SelectTrigger>
                    <SelectContent>
                      {designations.length === 0 ? (
                        <div className="py-2 px-3 text-sm text-muted-foreground">
                          No designations found. Add designations in HR → Departments first.
                        </div>
                      ) : (
                        designations.map((desg) => (
                          <SelectItem key={desg._id} value={desg._id}>
                            {desg.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {designations.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      <a href="/hr/departments" className="text-primary hover:underline">
                        Add designations
                      </a>{' '}
                      to assign staff
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isTeaching"
                  checked={formData.isTeaching}
                  onChange={(e) => handleFormChange('isTeaching', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="isTeaching" className="text-sm font-normal">
                  This is a teaching staff member
                </Label>
              </div>

              {/* Role selector — defaults to TEACHER/RECEPTIONIST based on isTeaching */}
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={formData.roleCode || (formData.isTeaching ? 'TEACHER' : 'RECEPTIONIST')}
                  onValueChange={(v) => handleFormChange('roleCode', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role._id} value={role.code}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Determines what permissions this staff member will have in the system.
                  {!canApprove &&
                    ' Your request will need Group Owner approval before the account is activated.'}
                </p>
              </div>

              {/* Access: which part of the campus this login may see */}
              <div className="space-y-2">
                <Label>Access</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    value={formData.scopeType}
                    onValueChange={(v) => {
                      handleFormChange('scopeType', v);
                      handleFormChange('scopeId', v === 'department' ? formData.departmentId : '');
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="branch">Whole campus</SelectItem>
                      <SelectItem value="institution">One institution</SelectItem>
                      <SelectItem value="department">One department</SelectItem>
                      <SelectItem value="program">One program</SelectItem>
                    </SelectContent>
                  </Select>
                  {formData.scopeType !== 'branch' && (
                    <Select
                      value={formData.scopeId}
                      onValueChange={(v) => handleFormChange('scopeId', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={`Select ${formData.scopeType}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {(formData.scopeType === 'institution'
                          ? institutions
                          : formData.scopeType === 'department'
                            ? departments
                            : programs
                        ).map((o) => (
                          <SelectItem key={o._id} value={o._id}>
                            {o.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  An HOD usually gets their department, an institution admin their institution.
                  Teachers also see the classes they teach.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="staffPassword">Initial password (optional)</Label>
                <Input
                  id="staffPassword"
                  type="password"
                  autoComplete="new-password"
                  value={formData.password}
                  onChange={(e) => handleFormChange('password', e.target.value)}
                  placeholder="Leave empty to email a temporary password"
                />
              </div>
            </div>

            {/* Custom Fields */}
            <CustomFieldsRenderer
              module="staff"
              values={customFieldValues}
              onChange={setCustomFieldValues}
              onFieldsLoaded={setCustomFieldDefs}
              errors={customFieldErrors}
            />

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  'Add Staff'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!staffToDelete} onOpenChange={(open) => !open && setStaffToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete staff member?</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate <span className="font-medium">{staffToDelete?.displayName}</span>{' '}
              ({staffToDelete?.employeeId}). Their attendance and payroll history is preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteStaff();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHero, StatTile, StatGrid } from '@/components/ui/page-hero';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Shield,
  Mail,
  Phone,
  Eye,
  Pencil,
  Trash2,
  Key,
  Building2,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  TrendingUp,
  UserCheck,
  Users,
  Loader2,
  Copy,
  Check,
  Table,
  GitBranch,
  AlertCircle,
} from 'lucide-react';
import { RoleHierarchyTree } from './components/RoleHierarchyTree';
import { toast } from 'sonner';
import { organizationApi, hrApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { usePermissions } from '@/hooks/usePermissions';

interface UserData {
  _id: string;
  email: string;
  phone?: string;
  profile: {
    firstName: string;
    lastName: string;
    displayName: string;
    avatar?: string;
    gender?: string;
  };
  roleId: string;
  role?: {
    _id: string;
    name: string;
    code: string;
  } | null;
  accessScope: {
    type: 'global' | 'institution' | 'branch' | 'department' | 'program';
    institutionIds?: string[];
    branchIds: string[];
    departmentIds?: string[];
    programIds?: string[];
  };
  status: 'active' | 'inactive' | 'locked' | 'pending';
  validUntil?: string;
  lastLogin?: string;
  createdAt: string;
}

interface Role {
  _id: string;
  name: string;
  code: string;
  level: number;
  isSystemRole: boolean;
}

interface ProgramOption {
  _id: string;
  name: string;
  code: string;
  department?: { _id: string; name: string; code: string } | null;
}

interface Branch {
  _id: string;
  name: string;
  code: string;
}

interface Institution {
  _id: string;
  name: string;
  code: string;
  isDefault: boolean;
}

interface DepartmentOption {
  _id: string;
  name: string;
  code: string;
}

/**
 * Build a compact list of page entries for table pagination. Always anchors
 * the first/last/current pages and inserts an "ellipsis" marker for gaps.
 *
 *  buildPageList(1, 1)  → [1]
 *  buildPageList(1, 5)  → [1, 2, 3, 4, 5]
 *  buildPageList(5, 10) → [1, '…', 4, 5, 6, '…', 10]
 *  buildPageList(1, 10) → [1, 2, 3, '…', 10]
 */
/**
 * One-line description of what a user's grant covers. Institution-scoped
 * users carry no branchIds (their branches resolve through the institution),
 * so the old "N branches" text always read "0 branches" for them.
 */
function describeScope(scope: UserData['accessScope']): string {
  switch (scope.type) {
    case 'global':
      return 'All branches';
    case 'institution': {
      const n = scope.institutionIds?.length ?? 0;
      return `${n} institution${n === 1 ? '' : 's'}`;
    }
    case 'department': {
      const n = scope.departmentIds?.length ?? 0;
      return `${n} department${n === 1 ? '' : 's'}`;
    }
    case 'program': {
      const n = scope.programIds?.length ?? 0;
      return `${n} program${n === 1 ? '' : 's'}`;
    }
    default: {
      const n = scope.branchIds.length;
      return `${n} branch${n === 1 ? '' : 'es'}`;
    }
  }
}

function buildPageList(current: number, total: number): Array<number | 'ellipsis'> {
  if (total <= 1) return [1];
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: Array<number | 'ellipsis'> = [1];
  if (current > 3) out.push('ellipsis');
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) out.push(i);
  if (current < total - 2) out.push('ellipsis');
  out.push(total);
  return out;
}

export default function UsersPage() {
  const { user: currentUser } = useAuthStore();
  const { isGroupOwner, isOrgAdmin } = usePermissions();
  const canApproveStaff = isGroupOwner || isOrgAdmin;
  const [viewMode, setViewMode] = useState<'table' | 'hierarchy'>('table');
  const [users, setUsers] = useState<UserData[]>([]);
  const [roles, setRoles] = useState<Role[]>([]); // Assignable roles for form dropdowns
  const [allRoles, setAllRoles] = useState<Role[]>([]); // All roles for hierarchy tree
  const [branches, setBranches] = useState<Branch[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'view' | 'edit' | 'add'>('view');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserData | null>(null);
  const [saving, setSaving] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // Pending staff approvals (Group Owner only)
  const [pendingStaff, setPendingStaff] = useState<
    Array<{
      _id: string;
      firstName: string;
      lastName: string;
      displayName: string;
      contact?: { email?: string; phone?: string };
      requestedRoleCode?: string;
      approvalStatus?: string;
    }>
  >([]);
  const [approvingStaffId, setApprovingStaffId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    firstName: '',
    lastName: '',
    gender: '',
    roleId: '',
    accessScopeType: 'branch' as 'global' | 'institution' | 'branch' | 'department' | 'program',
    branchIds: [] as string[],
    institutionIds: [] as string[],
    departmentIds: [] as string[],
    programIds: [] as string[],
    validUntil: '',
    status: 'active' as 'active' | 'inactive',
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [
        usersRes,
        rolesRes,
        allRolesRes,
        branchesRes,
        institutionsRes,
        departmentsRes,
        programsRes,
      ] = await Promise.all([
        organizationApi.getUsers({
          page: pagination.page,
          limit: pagination.limit,
          search: searchQuery,
        }),
        organizationApi.getAssignableRoles(),
        organizationApi.getRoles({ limit: 100 }), // Get all roles for hierarchy tree
        organizationApi.getBranches(),
        // Scope pickers — non-fatal if unavailable (permissions/modules vary)
        organizationApi.getInstitutions().catch(() => ({ success: false, data: [] })),
        hrApi.getDepartments().catch(() => ({ success: false, data: [] })),
        organizationApi.getPrograms({ status: 'active' }).catch(() => ({ data: [] })),
      ]);

      if (usersRes.success) {
        setUsers(usersRes.data);
        if (usersRes.meta) {
          setPagination((prev) => ({
            ...prev,
            total: usersRes.meta.total,
            totalPages: usersRes.meta.totalPages,
          }));
        }
      }
      if (rolesRes.success) {
        setRoles(rolesRes.data);
      }
      if (allRolesRes.success) {
        setAllRoles(allRolesRes.data);
      }
      if (branchesRes.success) {
        setBranches(branchesRes.data);
      }
      if (institutionsRes.success) {
        // Hide the invisible default institution for single-institution tenants;
        // it only matters once a university has real constituent institutions.
        const list = institutionsRes.data as Institution[];
        setInstitutions(list.length > 1 ? list : []);
      }
      if (departmentsRes.success) {
        setDepartments(departmentsRes.data as DepartmentOption[]);
      }
      setPrograms((programsRes.data ?? []) as ProgramOption[]);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch pending staff approvals for Group Owner
  useEffect(() => {
    if (canApproveStaff) {
      hrApi
        .getStaffPendingApprovals()
        .then((res) => {
          if (res?.success && Array.isArray(res.data)) {
            setPendingStaff(res.data);
          }
        })
        .catch(() => {});
    }
  }, [canApproveStaff]);

  const handleApproveStaff = async (id: string) => {
    setApprovingStaffId(id);
    try {
      const res = await hrApi.approveStaff(id);
      if (res.success) {
        toast.success('Staff approved — user account created and welcome email sent');
        setPendingStaff((prev) => prev.filter((s) => s._id !== id));
        fetchData(); // refresh user list to show the new user
      }
    } catch (err) {
      console.error('Approve failed:', err);
      toast.error('Failed to approve staff');
    } finally {
      setApprovingStaffId(null);
    }
  };

  const handleRejectStaff = async (id: string) => {
    const reason = window.prompt('Reason for rejection (optional):');
    setApprovingStaffId(id);
    try {
      const res = await hrApi.rejectStaff(id, reason || undefined);
      if (res.success) {
        toast.success('Staff request rejected');
        setPendingStaff((prev) => prev.filter((s) => s._id !== id));
      }
    } catch (err) {
      console.error('Reject failed:', err);
      toast.error('Failed to reject');
    } finally {
      setApprovingStaffId(null);
    }
  };

  const activeCount = users.filter((u) => u.status === 'active').length;
  const adminCount = users.filter((u) =>
    ['GROUP_OWNER', 'ORG_MODERATOR', 'ORG_ADMIN', 'BRANCH_ADMIN'].includes(u.role?.code || '')
  ).length;

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  const handleAddNew = () => {
    setSelectedUser(null);
    setFormData({
      email: '',
      phone: '',
      firstName: '',
      lastName: '',
      gender: '',
      roleId: roles[0]?._id || '',
      accessScopeType: 'branch',
      branchIds: [],
      institutionIds: [],
      departmentIds: [],
      programIds: [],
      validUntil: '',
      status: 'active',
    });
    setGeneratedPassword(null);
    setDialogMode('add');
    setDialogOpen(true);
  };

  const handleEdit = (user: UserData) => {
    setSelectedUser(user);
    setFormData({
      email: user.email,
      phone: user.phone || '',
      firstName: user.profile.firstName,
      lastName: user.profile.lastName,
      gender: user.profile.gender || '',
      roleId: user.roleId,
      accessScopeType: user.accessScope.type,
      branchIds: user.accessScope.branchIds,
      institutionIds: user.accessScope.institutionIds || [],
      departmentIds: user.accessScope.departmentIds || [],
      programIds: user.accessScope.programIds || [],
      validUntil: user.validUntil ? user.validUntil.slice(0, 10) : '',
      status: user.status === 'active' ? 'active' : 'inactive',
    });
    setDialogMode('edit');
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.firstName || !formData.lastName || !formData.roleId) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (formData.phone && !/^[6-9]\d{9}$/.test(formData.phone)) {
      toast.error('Invalid phone number. Enter a 10-digit number starting with 6-9');
      return;
    }

    if (
      (formData.accessScopeType === 'branch' ||
        formData.accessScopeType === 'department' ||
        formData.accessScopeType === 'program') &&
      formData.branchIds.length === 0
    ) {
      toast.error('Please select at least one branch');
      return;
    }

    if (formData.accessScopeType === 'institution' && formData.institutionIds.length === 0) {
      toast.error('Please select at least one institution');
      return;
    }

    if (formData.accessScopeType === 'department' && formData.departmentIds.length === 0) {
      toast.error('Please select at least one department');
      return;
    }

    if (formData.accessScopeType === 'program' && formData.programIds.length === 0) {
      toast.error('Please select at least one program');
      return;
    }

    setSaving(true);
    try {
      if (dialogMode === 'add') {
        const response = await organizationApi.createUser({
          email: formData.email,
          phone: formData.phone || undefined,
          profile: {
            firstName: formData.firstName,
            lastName: formData.lastName,
            gender: formData.gender || undefined,
          },
          roleId: formData.roleId,
          accessScope: {
            type: formData.accessScopeType,
            branchIds:
              formData.accessScopeType === 'global' || formData.accessScopeType === 'institution'
                ? []
                : formData.branchIds,
            institutionIds:
              formData.accessScopeType === 'institution' ? formData.institutionIds : undefined,
            departmentIds:
              formData.accessScopeType === 'department' ? formData.departmentIds : undefined,
            programIds: formData.accessScopeType === 'program' ? formData.programIds : undefined,
          },
          validUntil: formData.validUntil || null,
        });
        if (response.success) {
          if (response.data.generatedPassword) {
            setGeneratedPassword(response.data.generatedPassword);
          } else {
            toast.success('User created successfully');
            setDialogOpen(false);
          }
          fetchData();
        }
      } else if (dialogMode === 'edit' && selectedUser) {
        const response = await organizationApi.updateUser(selectedUser._id, {
          email: formData.email,
          phone: formData.phone || undefined,
          profile: {
            firstName: formData.firstName,
            lastName: formData.lastName,
            gender: formData.gender || undefined,
          },
          roleId: formData.roleId,
          accessScope: {
            type: formData.accessScopeType,
            branchIds:
              formData.accessScopeType === 'global' || formData.accessScopeType === 'institution'
                ? []
                : formData.branchIds,
            institutionIds:
              formData.accessScopeType === 'institution' ? formData.institutionIds : undefined,
            departmentIds:
              formData.accessScopeType === 'department' ? formData.departmentIds : undefined,
            programIds: formData.accessScopeType === 'program' ? formData.programIds : undefined,
          },
          validUntil: formData.validUntil || null,
        });
        if (response.success) {
          toast.success('User updated successfully');
          fetchData();
          setDialogOpen(false);
        }
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (user: UserData, status: 'active' | 'inactive') => {
    try {
      const response = await organizationApi.updateUserStatus(user._id, status);
      if (response.success) {
        toast.success(`User ${status === 'active' ? 'activated' : 'deactivated'} successfully`);
        fetchData();
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message || 'Failed to update status');
    }
  };

  const handleResetPassword = async (user: UserData) => {
    try {
      const response = await organizationApi.resetUserPassword(user._id);
      if (response.success && response.data.newPassword) {
        setSelectedUser(user);
        setGeneratedPassword(response.data.newPassword);
        setDialogMode('view');
        setDialogOpen(true);
        toast.success('Password reset successfully');
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message || 'Failed to reset password');
    }
  };

  const handleDelete = async () => {
    if (!userToDelete) return;
    try {
      const response = await organizationApi.deleteUser(userToDelete._id);
      if (response.success) {
        toast.success('User deleted successfully');
        fetchData();
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message || 'Failed to delete user');
    } finally {
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2000);
    toast.success('Password copied to clipboard');
  };

  const toggleBranch = (branchId: string) => {
    setFormData((prev) => ({
      ...prev,
      branchIds: prev.branchIds.includes(branchId)
        ? prev.branchIds.filter((id) => id !== branchId)
        : [...prev.branchIds, branchId],
    }));
  };

  const toggleInstitution = (institutionId: string) => {
    setFormData((prev) => ({
      ...prev,
      institutionIds: prev.institutionIds.includes(institutionId)
        ? prev.institutionIds.filter((id) => id !== institutionId)
        : [...prev.institutionIds, institutionId],
    }));
  };

  const toggleProgram = (programId: string) => {
    setFormData((prev) => ({
      ...prev,
      programIds: prev.programIds.includes(programId)
        ? prev.programIds.filter((id) => id !== programId)
        : [...prev.programIds, programId],
    }));
  };

  const toggleDepartment = (departmentId: string) => {
    setFormData((prev) => ({
      ...prev,
      departmentIds: prev.departmentIds.includes(departmentId)
        ? prev.departmentIds.filter((id) => id !== departmentId)
        : [...prev.departmentIds, departmentId],
    }));
  };

  // Check if current user can manage a user
  const canManageUser = (user: UserData): boolean => {
    if (!currentUser || !user.role) return false;
    if (user._id === currentUser.id) return false; // Can't manage self
    // GROUP_OWNER can manage all except GROUP_OWNER
    if (currentUser.roleCode === 'GROUP_OWNER') {
      return user.role.code !== 'GROUP_OWNER';
    }
    // ORG_MODERATOR can't manage GROUP_OWNER or ORG_MODERATOR
    if (currentUser.roleCode === 'ORG_MODERATOR') {
      if (user.role.code === 'GROUP_OWNER' || user.role.code === 'ORG_MODERATOR') {
        return false;
      }
    }
    return true;
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <PageHero
          icon={Users}
          eyebrow="Organization"
          title="Users"
          description="Manage user accounts and access permissions"
        />
        <StatGrid>
          {[...Array(4)].map((_, i) => (
            <StatTile key={i} title="Loading" value="" icon={Users} loading />
          ))}
        </StatGrid>
        <Card>
          <CardContent className="p-6">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full mb-2" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <PageHero
        icon={Users}
        eyebrow="Organization"
        title="Users"
        description="Manage user accounts and access permissions"
        actions={
          <>
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'table' | 'hierarchy')}>
              <TabsList className="h-10">
                <TabsTrigger value="table" className="gap-2 px-4">
                  <Table className="h-4 w-4" />
                  Table
                </TabsTrigger>
                <TabsTrigger value="hierarchy" className="gap-2 px-4">
                  <GitBranch className="h-4 w-4" />
                  Hierarchy
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Button onClick={handleAddNew} className="gap-2 bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4" />
              Add User
            </Button>
          </>
        }
      />

      {/* Stats Grid */}
      <StatGrid>
        <StatTile title="Total Users" value={pagination.total} icon={Users} variant="primary" />
        <StatTile title="Active Users" value={activeCount} icon={UserCheck} variant="success" />
        <StatTile title="Administrators" value={adminCount} icon={Shield} variant="info" />
        <StatTile title="Roles Available" value={roles.length} icon={TrendingUp} />
      </StatGrid>

      {/* Pending Staff Approvals — Group Owner / Org Admin only */}
      {canApproveStaff && pendingStaff.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-amber-800">
              <AlertCircle className="h-5 w-5" />
              Pending Staff Approvals
              <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200">
                {pendingStaff.length}
              </Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Staff added by Branch Admins need your approval before they can access the system.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingStaff.map((s) => (
                <div
                  key={s._id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-white"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-sm font-semibold">
                      {s.firstName?.charAt(0)}
                      {s.lastName?.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {s.displayName || `${s.firstName} ${s.lastName}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.contact?.email}
                        {s.requestedRoleCode && ` · Role: ${s.requestedRoleCode}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive border-destructive/30 hover:bg-destructive/10 h-8"
                      onClick={() => handleRejectStaff(s._id)}
                      disabled={approvingStaffId === s._id}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 h-8"
                      onClick={() => handleApproveStaff(s._id)}
                      disabled={approvingStaffId === s._id}
                    >
                      {approvingStaffId === s._id ? (
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

      {/* Content based on view mode */}
      {viewMode === 'hierarchy' ? (
        <RoleHierarchyTree
          users={users}
          roles={allRoles}
          onUserClick={(user) => {
            setSelectedUser(user);
            setGeneratedPassword(null);
            setDialogMode('view');
            setDialogOpen(true);
          }}
        />
      ) : (
        <Card className="border-0 shadow-elegant-md">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="text-xl">User Directory</CardTitle>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    className="pl-9 w-64 bg-muted/50 border-transparent focus:bg-white focus:border-border"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button variant="outline" size="icon" className="shrink-0">
                  <Filter className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-4">
                      User
                    </th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-4">
                      Role
                    </th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-4">
                      Access Scope
                    </th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-4">
                      Status
                    </th>
                    <th className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-4">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {users.map((user, index) => (
                    <tr
                      key={user._id}
                      className="hover:bg-muted/30 transition-colors group"
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-11 w-11 ring-2 ring-primary/10">
                            <AvatarImage src={user.profile.avatar} />
                            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20 text-primary text-sm font-medium">
                              {getInitials(user.profile.displayName)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                              {user.profile.displayName}
                            </p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{user.role?.name || 'No Role'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{describeScope(user.accessScope)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <Badge
                          variant="secondary"
                          className={`capitalize ${
                            user.status === 'active'
                              ? 'bg-success/10 text-success border-success/20'
                              : user.status === 'pending'
                                ? 'bg-amber-100 text-amber-700 border-amber-200'
                                : user.status === 'locked'
                                  ? 'bg-destructive/10 text-destructive border-destructive/20'
                                  : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {user.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedUser(user);
                                setGeneratedPassword(null);
                                setDialogMode('view');
                                setDialogOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleEdit(user)}
                              disabled={!canManageUser(user)}
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleResetPassword(user)}
                              disabled={!canManageUser(user)}
                            >
                              <Key className="h-4 w-4 mr-2" />
                              Reset Password
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {user.status === 'active' ? (
                              <DropdownMenuItem
                                onClick={() => handleStatusChange(user, 'inactive')}
                                disabled={!canManageUser(user)}
                              >
                                Deactivate User
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => handleStatusChange(user, 'active')}
                                disabled={!canManageUser(user)}
                              >
                                Activate User
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => {
                                setUserToDelete(user);
                                setDeleteDialogOpen(true);
                              }}
                              disabled={!canManageUser(user)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-6 pt-6 border-t">
              <p className="text-sm text-muted-foreground">
                Showing <span className="font-medium text-foreground">{users.length}</span> of{' '}
                <span className="font-medium text-foreground">{pagination.total}</span> users
              </p>
              {pagination.totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page === 1}
                    onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                  >
                    Previous
                  </Button>
                  {buildPageList(pagination.page, pagination.totalPages).map((entry, i) =>
                    entry === 'ellipsis' ? (
                      <span
                        key={`e-${i}`}
                        className="px-2 text-sm text-muted-foreground select-none"
                      >
                        …
                      </span>
                    ) : (
                      <Button
                        key={entry}
                        variant={entry === pagination.page ? 'default' : 'outline'}
                        size="sm"
                        className={
                          entry === pagination.page
                            ? 'bg-primary text-primary-foreground hover:bg-primary/90 min-w-9'
                            : 'min-w-9'
                        }
                        onClick={() => setPagination((p) => ({ ...p, page: entry }))}
                      >
                        {entry}
                      </Button>
                    )
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* User Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setGeneratedPassword(null);
            setCopiedPassword(false);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {dialogMode === 'view'
                ? 'User Details'
                : dialogMode === 'edit'
                  ? 'Edit User'
                  : 'Add New User'}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === 'view'
                ? 'View user information and permissions'
                : 'Fill in the user details below'}
            </DialogDescription>
          </DialogHeader>

          {generatedPassword ? (
            <div className="space-y-6">
              <div className="p-4 bg-success/10 rounded-lg border border-success/20">
                <h4 className="font-medium text-success mb-2">
                  {dialogMode === 'add'
                    ? 'User Created Successfully!'
                    : 'Password Reset Successfully!'}
                </h4>
                <p className="text-sm text-muted-foreground mb-4">
                  {dialogMode === 'add'
                    ? 'A temporary password has been generated. Please share it securely with the user.'
                    : 'A new password has been generated. Please share it securely with the user.'}
                </p>
                <div className="flex items-center gap-2 p-3 bg-background rounded-lg border">
                  <code className="flex-1 font-mono text-sm">{generatedPassword}</code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(generatedPassword)}
                    className="shrink-0"
                  >
                    {copiedPassword ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <Button onClick={() => setDialogOpen(false)} className="w-full">
                Done
              </Button>
            </div>
          ) : dialogMode === 'view' && selectedUser ? (
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl">
                <Avatar className="h-16 w-16 ring-2 ring-primary/10">
                  <AvatarImage src={selectedUser.profile.avatar} />
                  <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20 text-primary text-xl font-medium">
                    {getInitials(selectedUser.profile.displayName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-xl font-semibold">{selectedUser.profile.displayName}</h3>
                  <p className="text-muted-foreground">{selectedUser.role?.name || 'No Role'}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{selectedUser.email}</span>
                </div>
                {selectedUser.phone && (
                  <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{selectedUser.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    Access to {describeScope(selectedUser.accessScope).toLowerCase()}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleEdit(selectedUser)}
                  disabled={!canManageUser(selectedUser)}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleResetPassword(selectedUser)}
                  disabled={!canManageUser(selectedUser)}
                >
                  <Key className="mr-2 h-4 w-4" />
                  Reset Password
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    placeholder="Enter first name"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    required
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    placeholder="Enter last name"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    required
                    className="h-11"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  placeholder="9876543210"
                  value={formData.phone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setFormData({ ...formData, phone: val });
                  }}
                  maxLength={10}
                  pattern="[6-9]\d{9}"
                  className="h-11"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="role">Role *</Label>
                  <Select
                    value={formData.roleId}
                    onValueChange={(value) => setFormData({ ...formData, roleId: value })}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles
                        .filter((role) => role.code !== 'TEACHER')
                        .map((role) => (
                          <SelectItem key={role._id} value={role._id}>
                            {role.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gender">Gender</Label>
                  <Select
                    value={formData.gender}
                    onValueChange={(value) => setFormData({ ...formData, gender: value })}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Access Scope *</Label>
                <Select
                  value={formData.accessScopeType}
                  onValueChange={(
                    value: 'global' | 'institution' | 'branch' | 'department' | 'program'
                  ) =>
                    setFormData({
                      ...formData,
                      accessScopeType: value,
                      branchIds: [],
                      institutionIds: [],
                      departmentIds: [],
                      programIds: [],
                    })
                  }
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select access scope" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">All Branches (Global)</SelectItem>
                    {institutions.length > 0 && (
                      <SelectItem value="institution">Specific Institutions</SelectItem>
                    )}
                    <SelectItem value="branch">Specific Branches</SelectItem>
                    {departments.length > 0 && (
                      <SelectItem value="department">Specific Departments</SelectItem>
                    )}
                    {programs.length > 0 && (
                      <SelectItem value="program">Specific Programs</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {formData.accessScopeType === 'institution' && (
                <div className="space-y-2">
                  <Label>Select Institutions *</Label>
                  <p className="text-xs text-muted-foreground">
                    Access covers every campus of the selected institutions — including campuses
                    added later.
                  </p>
                  <ScrollArea className="h-32 border rounded-lg p-3">
                    <div className="space-y-2">
                      {institutions.map((institution) => (
                        <div key={institution._id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`institution-${institution._id}`}
                            checked={formData.institutionIds.includes(institution._id)}
                            onCheckedChange={() => toggleInstitution(institution._id)}
                          />
                          <label
                            htmlFor={`institution-${institution._id}`}
                            className="text-sm cursor-pointer"
                          >
                            {institution.name}
                            {institution.isDefault && (
                              <span className="text-muted-foreground"> (main)</span>
                            )}
                          </label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {(formData.accessScopeType === 'branch' ||
                formData.accessScopeType === 'department' ||
                formData.accessScopeType === 'program') && (
                <div className="space-y-2">
                  <Label>Select Branches *</Label>
                  <ScrollArea className="h-32 border rounded-lg p-3">
                    <div className="space-y-2">
                      {branches.map((branch) => (
                        <div key={branch._id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`branch-${branch._id}`}
                            checked={formData.branchIds.includes(branch._id)}
                            onCheckedChange={() => toggleBranch(branch._id)}
                          />
                          <label
                            htmlFor={`branch-${branch._id}`}
                            className="text-sm cursor-pointer"
                          >
                            {branch.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {formData.accessScopeType === 'department' && (
                <div className="space-y-2">
                  <Label>Select Departments *</Label>
                  <p className="text-xs text-muted-foreground">
                    Academic views narrow to these departments once department scoping is enabled
                    for your organization.
                  </p>
                  <ScrollArea className="h-32 border rounded-lg p-3">
                    <div className="space-y-2">
                      {departments.map((department) => (
                        <div key={department._id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`department-${department._id}`}
                            checked={formData.departmentIds.includes(department._id)}
                            onCheckedChange={() => toggleDepartment(department._id)}
                          />
                          <label
                            htmlFor={`department-${department._id}`}
                            className="text-sm cursor-pointer"
                          >
                            {department.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {formData.accessScopeType === 'program' && (
                <div className="space-y-2">
                  <Label>Select Programs *</Label>
                  <p className="text-xs text-muted-foreground">
                    For program coordinators. Narrower than department scope — academic views show
                    only the classes, sections and students of these programs.
                  </p>
                  <ScrollArea className="h-32 border rounded-lg p-3">
                    <div className="space-y-2">
                      {programs.map((program) => (
                        <div key={program._id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`program-${program._id}`}
                            checked={formData.programIds.includes(program._id)}
                            onCheckedChange={() => toggleProgram(program._id)}
                          />
                          <label
                            htmlFor={`program-${program._id}`}
                            className="text-sm cursor-pointer"
                          >
                            {program.name}
                            {program.department && (
                              <span className="text-muted-foreground">
                                {' '}
                                · {program.department.code}
                              </span>
                            )}
                          </label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="validUntil">Access expires on</Label>
                <Input
                  id="validUntil"
                  type="date"
                  value={formData.validUntil}
                  onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                  className="h-11"
                />
                <p className="text-xs text-muted-foreground">
                  For guest/temporary accounts (external examiners, auditors). Leave empty for a
                  permanent account; login is blocked after this date.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {dialogMode === 'add' ? 'Create User' : 'Save Changes'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{userToDelete?.profile.displayName}&quot;? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

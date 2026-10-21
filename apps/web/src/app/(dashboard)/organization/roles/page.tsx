'use client';

import { useState, useEffect, useCallback } from 'react';
import { AddButton } from '@/components/ui/page-header';
import { PageHero, StatTile, StatGrid } from '@/components/ui/page-hero';
import { DataTable, Column, DataTableAction } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import {
  Shield,
  ShieldCheck,
  Users,
  Eye,
  Pencil,
  Trash2,
  Settings,
  Crown,
  UserCog,
  Building2,
  GitBranch,
  LayoutGrid,
  Layers,
  KeyRound,
} from 'lucide-react';
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
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { organizationApi } from '@/lib/api';
import { toast } from 'sonner';
import { PERMISSIONS } from '@campus-verse/shared/constants';
import { useAuthStore } from '@/store/authStore';
import { usePermissions } from '@/hooks/usePermissions';
import { RoleDrawer } from './components/RoleDrawer';
import { cn } from '@/lib/utils';

interface Role {
  _id: string;
  name: string;
  code: string;
  description?: string;
  isSystemRole: boolean;
  level: number;
  permissions: Record<string, string[]>;
  hasDefaults?: boolean;
  customised?: boolean;
  userCount?: number;
  createdAt: string;
  updatedAt: string;
}

// System role display configuration
const SYSTEM_ROLE_CONFIG: Record<
  string,
  { icon: React.ElementType; color: string; bgColor: string; description: string }
> = {
  GROUP_OWNER: {
    icon: Crown,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    description: 'Full control over the group and all organizations',
  },
  ORG_MODERATOR: {
    icon: UserCog,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    description: 'Same access as owner, cannot manage other moderators',
  },
  ORG_ADMIN: {
    icon: Building2,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    description: 'Admin access to a single organization',
  },
  BRANCH_ADMIN: {
    icon: GitBranch,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    description: 'Admin access to a single branch',
  },
};

// Level badge colors
const getLevelBadgeColor = (level: number): string => {
  const colors: Record<number, string> = {
    0: 'bg-purple-100 text-purple-700 border-purple-200',
    1: 'bg-blue-100 text-blue-700 border-blue-200',
    2: 'bg-green-100 text-green-700 border-green-200',
    3: 'bg-amber-100 text-amber-700 border-amber-200',
  };
  return colors[level] || 'bg-gray-100 text-gray-700 border-gray-200';
};

const allModules = Object.keys(PERMISSIONS);

export default function RolesPage() {
  const { user } = useAuthStore();
  const { canCreate, isGroupOwner, isOrgModerator, hasPermission } = usePermissions();
  const canViewRoles = hasPermission('organization.roles', 'view');
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'view' | 'edit' | 'add'>('view');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);

  const fetchRoles = useCallback(async () => {
    if (!canViewRoles) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const response = await organizationApi.getRoles({ limit: 100 });
      if (response.success) {
        // Sort by level
        const sortedRoles = response.data.sort((a: Role, b: Role) => a.level - b.level);
        setRoles(sortedRoles);
      }
    } catch (error) {
      console.error('Failed to fetch roles:', error);
      toast.error('Failed to load roles');
    } finally {
      setLoading(false);
    }
  }, [canViewRoles]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  if (!canViewRoles) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Shield className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h2 className="text-lg font-semibold">Access Denied</h2>
        <p className="text-sm text-muted-foreground mt-1">
          You don&apos;t have permission to view roles. Contact your administrator.
        </p>
      </div>
    );
  }

  const systemRolesCount = roles.filter((r) => r.isSystemRole).length;
  const customRolesCount = roles.filter((r) => !r.isSystemRole).length;

  // Check if current user can manage a role
  const canManageRole = (role: Role): boolean => {
    if (!user) return false;
    // GROUP_OWNER can manage all roles
    if (user.roleCode === 'GROUP_OWNER') {
      return true;
    }
    // ORG_MODERATOR can't manage GROUP_OWNER or ORG_MODERATOR
    if (user.roleCode === 'ORG_MODERATOR') {
      if (role.code === 'GROUP_OWNER' || role.code === 'ORG_MODERATOR') {
        return false;
      }
    }
    // Can only manage roles with level > user's level
    return user.roleLevel < role.level;
  };

  const columns: Column<Role>[] = [
    {
      key: 'name',
      header: 'Role',
      sortable: true,
      cell: (row) => {
        const config = SYSTEM_ROLE_CONFIG[row.code];
        const IconComponent = config?.icon || (row.isSystemRole ? ShieldCheck : Shield);

        return (
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'h-10 w-10 rounded-lg flex items-center justify-center',
                config?.bgColor || (row.isSystemRole ? 'bg-primary/10' : 'bg-accent/10')
              )}
            >
              <IconComponent
                className={cn(
                  'h-5 w-5',
                  config?.color || (row.isSystemRole ? 'text-primary' : 'text-accent')
                )}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium">{row.name}</p>
                {row.isSystemRole && (
                  <Badge variant="outline" className="text-xs">
                    System
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{row.code}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'description',
      header: 'Description',
      cell: (row) => {
        const config = SYSTEM_ROLE_CONFIG[row.code];
        return (
          <p className="text-sm text-muted-foreground line-clamp-1 max-w-[300px]">
            {row.description || config?.description || 'No description'}
          </p>
        );
      },
    },
    {
      key: 'level',
      header: 'Level',
      sortable: true,
      cell: (row) => (
        <Badge variant="outline" className={cn('font-mono', getLevelBadgeColor(row.level))}>
          Level {row.level}
        </Badge>
      ),
    },
    {
      key: 'userCount',
      header: 'Users',
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-1.5 text-sm">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{row.userCount ?? 0}</span>
          <span className="text-xs text-muted-foreground">
            {(row.userCount ?? 0) === 1 ? 'user' : 'users'}
          </span>
        </div>
      ),
    },
    {
      key: 'permissions',
      header: 'Permissions',
      cell: (row) => {
        const permCount = Object.values(row.permissions).reduce((acc, arr) => acc + arr.length, 0);
        const subModuleCount = Object.keys(row.permissions).length;
        const moduleCount = new Set(Object.keys(row.permissions).map((key) => key.split('.')[0]))
          .size;
        return (
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full text-xs font-medium">
              <LayoutGrid className="h-3 w-3" />
              <span>{moduleCount}</span>
            </div>
            <div className="flex items-center gap-1 bg-violet-50 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-full text-xs font-medium">
              <Layers className="h-3 w-3" />
              <span>{subModuleCount}</span>
            </div>
            <div className="flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-xs font-medium">
              <KeyRound className="h-3 w-3" />
              <span>{permCount}</span>
            </div>
          </div>
        );
      },
    },
  ];

  // S1-03: Only show edit/delete actions if user has permission to create roles
  // (which indicates they can manage roles)
  const canManageRoles = (isGroupOwner || isOrgModerator) && canCreate('organization.roles');

  const actions: DataTableAction<Role>[] = [
    {
      label: 'View Permissions',
      icon: <Eye className="mr-2 h-4 w-4" />,
      onClick: (row) => {
        setSelectedRole(row);
        setDrawerMode('view');
        setDrawerOpen(true);
      },
    },
    // Only show edit if user can manage roles
    ...(canManageRoles
      ? [
          {
            label: 'Edit',
            icon: <Pencil className="mr-2 h-4 w-4" />,
            onClick: (row: Role) => {
              setSelectedRole(row);
              setDrawerMode('edit');
              setDrawerOpen(true);
            },
            disabled: (row: Role) =>
              isGroupOwner ? false : row.isSystemRole || !canManageRole(row),
          },
        ]
      : []),
    // Only show delete if user can manage roles
    ...(canManageRoles
      ? [
          {
            label: 'Delete',
            icon: <Trash2 className="mr-2 h-4 w-4" />,
            onClick: (row: Role) => {
              setRoleToDelete(row);
              setDeleteDialogOpen(true);
            },
            variant: 'destructive' as const,
            disabled: (row: Role) => row.isSystemRole || !canManageRole(row),
          },
        ]
      : []),
  ];

  const handleAddNew = () => {
    setSelectedRole(null);
    setDrawerMode('add');
    setDrawerOpen(true);
  };

  const handleSubmit = async (data: {
    name: string;
    code: string;
    description?: string;
    level: number;
    permissions: Record<string, string[]>;
  }) => {
    if (drawerMode === 'add') {
      const response = await organizationApi.createRole(data);
      if (response.success) {
        toast.success('Role created successfully');
        fetchRoles();
      }
    } else if (drawerMode === 'edit' && selectedRole) {
      const response = await organizationApi.updateRole(selectedRole._id, data);
      if (response.success) {
        toast.success('Role updated successfully');
        fetchRoles();
      }
    }
  };

  const handleDelete = async () => {
    if (!roleToDelete) return;
    try {
      const response = await organizationApi.deleteRole(roleToDelete._id);
      if (response.success) {
        toast.success('Role deleted successfully');
        fetchRoles();
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message || 'Failed to delete role');
    } finally {
      setDeleteDialogOpen(false);
      setRoleToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHero
          icon={Shield}
          eyebrow="Organization"
          title="Roles & Permissions"
          description="Manage user roles and access permissions"
        />
        <StatGrid>
          {[...Array(4)].map((_, i) => (
            <StatTile key={i} title="Loading" value="" icon={Shield} loading />
          ))}
        </StatGrid>
        <Card>
          <CardContent className="p-6">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full mb-2" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHero
        icon={Shield}
        eyebrow="Organization"
        title="Roles & Permissions"
        description="Manage user roles and access permissions"
        actions={
          /* S1-03: Only GROUP_OWNER and ORG_MODERATOR can create roles */
          (isGroupOwner || isOrgModerator) && canCreate('organization.roles') ? (
            <AddButton onClick={handleAddNew} label="Add Role" />
          ) : null
        }
      />

      {/* Stats */}
      <StatGrid>
        <StatTile title="Total Roles" value={roles.length} icon={Shield} variant="primary" />
        <StatTile title="System Roles" value={systemRolesCount} icon={ShieldCheck} variant="info" />
        <StatTile title="Custom Roles" value={customRolesCount} icon={Settings} variant="success" />
        <StatTile title="Permission Modules" value={allModules.length} icon={Users} />
      </StatGrid>

      {/* System Roles Overview */}
      {/* <div className="grid gap-4 md:grid-cols-4">
        {Object.entries(SYSTEM_ROLE_CONFIG).map(([code, config]) => {
          const role = roles.find((r) => r.code === code);
          const IconComponent = config.icon;
          return (
            <Card
              key={code}
              className={cn(
                'cursor-pointer transition-all hover:shadow-md',
                role ? 'opacity-100' : 'opacity-50'
              )}
              onClick={() => {
                if (role) {
                  setSelectedRole(role);
                  setDrawerMode('view');
                  setDrawerOpen(true);
                }
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', config.bgColor)}>
                    <IconComponent className={cn('h-5 w-5', config.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {role?.name || code.replace(/_/g, ' ')}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {config.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div> */}

      {/* Table */}
      <DataTable
        data={roles}
        columns={columns}
        actions={actions}
        searchable
        searchPlaceholder="Search roles..."
      />

      {/* Role Drawer */}
      <RoleDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        mode={drawerMode}
        role={selectedRole}
        userRoleLevel={user?.roleLevel || 0}
        isGroupOwner={isGroupOwner}
        onSubmit={handleSubmit}
        onReset={async () => {
          if (!selectedRole) return;
          const response = await organizationApi.resetRole(selectedRole._id);
          if (response.success) {
            toast.success(`${selectedRole.name} is back on its default permissions`);
            fetchRoles();
          }
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the role &quot;{roleToDelete?.name}&quot;? This action
              cannot be undone. Users assigned to this role will need to be reassigned.
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

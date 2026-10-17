'use client';

import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Shield, ShieldCheck, Loader2, X, Info, LayoutGrid, Layers, KeyRound } from 'lucide-react';
import { PERMISSIONS } from '@campus-verse/shared/constants';
import { cn } from '@/lib/utils';

interface Role {
  _id: string;
  name: string;
  code: string;
  description?: string;
  isSystemRole: boolean;
  level: number;
  permissions: Record<string, string[]>;
}

interface RoleDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'add' | 'edit' | 'view';
  role?: Role | null;
  userRoleLevel: number;
  isGroupOwner?: boolean;
  onSubmit: (data: {
    name: string;
    code: string;
    description?: string;
    level: number;
    permissions: Record<string, string[]>;
  }) => Promise<void>;
}

// Group modules by category for better organization
const moduleCategories = [
  {
    name: 'Core',
    modules: ['users', 'roles', 'branches', 'dashboard'],
  },
  {
    name: 'Academic',
    modules: ['students', 'classes', 'sections', 'subjects', 'timetable', 'exams', 'grades'],
  },
  {
    name: 'Attendance & HR',
    modules: ['attendance', 'hr', 'leave'],
  },
  {
    name: 'Finance',
    modules: ['finance', 'fees', 'expenses', 'payroll'],
  },
  {
    name: 'Communication',
    modules: ['communication', 'notifications', 'announcements'],
  },
  {
    name: 'Admissions',
    modules: ['admission', 'enquiries', 'applications'],
  },
  {
    name: 'Others',
    modules: ['certificates', 'reports', 'settings', 'inventory', 'transport', 'library', 'hostel'],
  },
];

// Get all modules with their available actions
const allModules = Object.entries(PERMISSIONS).map(([key, actions]) => ({
  id: key,
  name: key
    .split('.')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' '))
    .join(' > '),
  actions: actions as readonly string[],
}));

// Get modules for a category
const getModulesForCategory = (categoryModules: string[]) => {
  return allModules.filter((m) =>
    categoryModules.some((cm) => m.id.toLowerCase().includes(cm.toLowerCase()))
  );
};

// Get uncategorized modules
const getUncategorizedModules = () => {
  const categorizedIds = moduleCategories.flatMap((c) => c.modules);
  return allModules.filter(
    (m) => !categorizedIds.some((cm) => m.id.toLowerCase().includes(cm.toLowerCase()))
  );
};

export function RoleDrawer({
  open,
  onOpenChange,
  mode,
  role,
  userRoleLevel,
  isGroupOwner = false,
  onSubmit,
}: RoleDrawerProps) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    level: userRoleLevel + 10,
    permissions: {} as Record<string, string[]>,
  });

  // Reset form when role changes or modal opens
  useEffect(() => {
    if (open) {
      if (role && (mode === 'edit' || mode === 'view')) {
        setFormData({
          name: role.name,
          code: role.code,
          description: role.description || '',
          level: role.level,
          permissions: { ...role.permissions },
        });
      } else {
        setFormData({
          name: '',
          code: '',
          description: '',
          level: userRoleLevel + 10,
          permissions: {},
        });
      }
    }
  }, [open, role, mode, userRoleLevel]);

  const hasPermission = (module: string, action: string) => {
    return formData.permissions[module]?.includes(action) || false;
  };

  const togglePermission = (module: string, action: string) => {
    if (mode === 'view') return;

    setFormData((prev) => {
      const newPermissions = { ...prev.permissions };
      if (!newPermissions[module]) {
        newPermissions[module] = [];
      }
      if (newPermissions[module].includes(action)) {
        newPermissions[module] = newPermissions[module].filter((a) => a !== action);
        if (newPermissions[module].length === 0) {
          delete newPermissions[module];
        }
      } else {
        newPermissions[module] = [...newPermissions[module], action];
      }
      return { ...prev, permissions: newPermissions };
    });
  };

  const toggleAllInModule = (moduleId: string, actions: readonly string[]) => {
    if (mode === 'view') return;

    setFormData((prev) => {
      const newPermissions = { ...prev.permissions };
      const currentPerms = newPermissions[moduleId] || [];
      const allSelected = actions.every((a) => currentPerms.includes(a));

      if (allSelected) {
        delete newPermissions[moduleId];
      } else {
        newPermissions[moduleId] = [...actions];
      }
      return { ...prev, permissions: newPermissions };
    });
  };

  const toggleAllInCategory = (categoryModules: string[]) => {
    if (mode === 'view') return;

    const modules = getModulesForCategory(categoryModules);
    const allCategorySelected = modules.every((m) =>
      m.actions.every((a) => formData.permissions[m.id]?.includes(a))
    );

    setFormData((prev) => {
      const newPermissions = { ...prev.permissions };
      if (allCategorySelected) {
        modules.forEach((m) => delete newPermissions[m.id]);
      } else {
        modules.forEach((m) => {
          newPermissions[m.id] = [...m.actions];
        });
      }
      return { ...prev, permissions: newPermissions };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'view') return;

    setSaving(true);
    try {
      await onSubmit({
        name: formData.name,
        code: formData.code.toUpperCase(),
        description: formData.description || undefined,
        level: formData.level,
        permissions: formData.permissions,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const totalPermissions = Object.values(formData.permissions).reduce(
    (acc, arr) => acc + arr.length,
    0
  );
  const subModulesWithPermissions = Object.keys(formData.permissions).length;
  const modulesWithPermissions = new Set(
    Object.keys(formData.permissions).map((key) => key.split('.')[0])
  ).size;

  const isViewMode = mode === 'view';
  const isSystemRole = role?.isSystemRole || false;
  // GROUP_OWNER can edit permissions of system roles (but not name/code/level)
  const isSystemRoleFieldsLocked = isSystemRole;
  const isPermissionsLocked = isSystemRole && !isGroupOwner;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="full" hideCloseButton className="p-0 flex flex-col">
        {/* Header */}
        <div className="border-b bg-muted/30 px-6 py-4">
          <div className="flex items-center justify-between">
            <SheetHeader className="space-y-1">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'h-10 w-10 rounded-lg flex items-center justify-center',
                    isSystemRole ? 'bg-primary/10' : 'bg-accent/10'
                  )}
                >
                  {isSystemRole ? (
                    <ShieldCheck className="h-5 w-5 text-primary" />
                  ) : (
                    <Shield className="h-5 w-5 text-accent" />
                  )}
                </div>
                <div>
                  <SheetTitle className="text-xl">
                    {mode === 'add'
                      ? 'Create New Role'
                      : mode === 'edit'
                        ? 'Edit Role'
                        : 'View Role'}
                  </SheetTitle>
                  <SheetDescription>
                    {mode === 'view'
                      ? 'View role details and permissions'
                      : 'Configure role details and assign permissions'}
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>
            <div className="flex items-center gap-3">
              {!isViewMode && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full text-xs font-medium">
                    <LayoutGrid className="h-3.5 w-3.5" />
                    <span>{modulesWithPermissions}</span>
                    <span className="text-blue-500 font-normal">
                      {modulesWithPermissions === 1 ? 'Module' : 'Modules'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-violet-50 text-violet-700 border border-violet-200 px-2.5 py-1 rounded-full text-xs font-medium">
                    <Layers className="h-3.5 w-3.5" />
                    <span>{subModulesWithPermissions}</span>
                    <span className="text-violet-500 font-normal">
                      {subModulesWithPermissions === 1 ? 'Sub-module' : 'Sub-modules'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full text-xs font-medium">
                    <KeyRound className="h-3.5 w-3.5" />
                    <span>{totalPermissions}</span>
                    <span className="text-emerald-500 font-normal">
                      {totalPermissions === 1 ? 'Permission' : 'Permissions'}
                    </span>
                  </div>
                </div>
              )}
              <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 flex overflow-hidden">
          {/* Left Column - Form */}
          <div className="w-[400px] border-r flex flex-col bg-background">
            <div className="p-6 flex-1 overflow-auto">
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    Role Details
                  </h3>

                  <div className="space-y-2">
                    <Label htmlFor="name">Role Name *</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Admission Officer"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      disabled={isViewMode || isSystemRoleFieldsLocked}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="code">Role Code *</Label>
                    <Input
                      id="code"
                      placeholder="e.g., ADMISSION_OFFICER"
                      value={formData.code}
                      onChange={(e) =>
                        setFormData({ ...formData, code: e.target.value.toUpperCase() })
                      }
                      disabled={isViewMode || isSystemRoleFieldsLocked}
                      required
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      Unique identifier, auto-converted to uppercase
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Brief description of the role responsibilities..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      disabled={isViewMode || isSystemRoleFieldsLocked}
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="level">Role Level *</Label>
                    <Input
                      id="level"
                      type="number"
                      min={userRoleLevel + 1}
                      value={formData.level}
                      onChange={(e) =>
                        setFormData({ ...formData, level: parseInt(e.target.value) || 100 })
                      }
                      disabled={isViewMode || isSystemRoleFieldsLocked}
                      required
                    />
                    <div className="flex items-start gap-2 p-3 rounded-md bg-muted/50 text-xs text-muted-foreground">
                      <Info className="h-4 w-4 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-foreground">About Role Levels</p>
                        <p className="mt-1">
                          Lower number = higher privilege. Your level is {userRoleLevel}, so you can
                          only create roles with level {'>'} {userRoleLevel}.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Role Summary */}
                {isViewMode && role && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                      Role Info
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Type</span>
                        <Badge variant={isSystemRole ? 'default' : 'secondary'}>
                          {isSystemRole ? 'System Role' : 'Custom Role'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Level</span>
                        <Badge variant="outline" className="font-mono">
                          {role.level}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Modules</span>
                        <span className="text-sm font-medium">{modulesWithPermissions}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Sub-modules</span>
                        <span className="text-sm font-medium">{subModulesWithPermissions}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Permissions</span>
                        <span className="text-sm font-medium">{totalPermissions}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Form Footer */}
            {!isViewMode && (
              <div className="p-6 border-t bg-muted/30">
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => onOpenChange(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1" disabled={saving || isPermissionsLocked}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {mode === 'add' ? 'Create Role' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Permissions Grid */}
          <div className="flex-1 flex flex-col bg-muted/20">
            <div className="px-6 py-4 border-b bg-background">
              <h3 className="font-semibold">Permissions</h3>
              <p className="text-sm text-muted-foreground">
                {isViewMode
                  ? 'View assigned permissions for this role'
                  : 'Select permissions to assign to this role'}
              </p>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-6 space-y-6">
                {moduleCategories.map((category) => {
                  const categoryModules = getModulesForCategory(category.modules);
                  if (categoryModules.length === 0) return null;

                  const allCategorySelected = categoryModules.every((m) =>
                    m.actions.every((a) => formData.permissions[m.id]?.includes(a))
                  );
                  const someCategorySelected =
                    !allCategorySelected &&
                    categoryModules.some((m) => (formData.permissions[m.id]?.length || 0) > 0);

                  return (
                    <Card key={category.name}>
                      <CardHeader className="py-3 px-4 bg-muted/50">
                        <div className="flex items-center gap-3">
                          {!isViewMode && (
                            <Checkbox
                              checked={allCategorySelected}
                              ref={(el) => {
                                if (el) {
                                  (
                                    el as HTMLButtonElement & { indeterminate: boolean }
                                  ).indeterminate = someCategorySelected;
                                }
                              }}
                              onCheckedChange={() => toggleAllInCategory(category.modules)}
                            />
                          )}
                          <CardTitle className="text-sm font-medium">{category.name}</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="divide-y">
                          {categoryModules.map((module) => {
                            const modulePerms = formData.permissions[module.id] || [];
                            const allSelected = module.actions.every((a) =>
                              modulePerms.includes(a)
                            );
                            const someSelected = modulePerms.length > 0 && !allSelected;

                            return (
                              <div
                                key={module.id}
                                className="flex items-center justify-between px-4 py-3 hover:bg-muted/30"
                              >
                                <div className="flex items-center gap-3">
                                  <Checkbox
                                    checked={allSelected}
                                    ref={(el) => {
                                      if (el) {
                                        (
                                          el as HTMLButtonElement & { indeterminate: boolean }
                                        ).indeterminate = someSelected;
                                      }
                                    }}
                                    onCheckedChange={() =>
                                      toggleAllInModule(module.id, module.actions)
                                    }
                                    disabled={isViewMode}
                                  />
                                  <span className="font-medium text-sm">{module.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {module.actions.map((action) => (
                                    <button
                                      key={action}
                                      type="button"
                                      onClick={() => togglePermission(module.id, action)}
                                      disabled={isViewMode}
                                      className={cn(
                                        'px-2.5 py-1 text-xs rounded-md border transition-colors capitalize',
                                        hasPermission(module.id, action)
                                          ? 'bg-primary text-primary-foreground border-primary'
                                          : 'bg-background text-muted-foreground border-border hover:border-primary/50',
                                        isViewMode && 'cursor-default'
                                      )}
                                    >
                                      {action}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                {/* Uncategorized modules */}
                {(() => {
                  const uncategorized = getUncategorizedModules();
                  if (uncategorized.length === 0) return null;

                  const allUncatSelected = uncategorized.every((m) =>
                    m.actions.every((a) => formData.permissions[m.id]?.includes(a))
                  );
                  const someUncatSelected =
                    !allUncatSelected &&
                    uncategorized.some((m) => (formData.permissions[m.id]?.length || 0) > 0);

                  return (
                    <Card>
                      <CardHeader className="py-3 px-4 bg-muted/50">
                        <div className="flex items-center gap-3">
                          {!isViewMode && (
                            <Checkbox
                              checked={allUncatSelected}
                              ref={(el) => {
                                if (el) {
                                  (
                                    el as HTMLButtonElement & { indeterminate: boolean }
                                  ).indeterminate = someUncatSelected;
                                }
                              }}
                              onCheckedChange={() => {
                                setFormData((prev) => {
                                  const newPermissions = { ...prev.permissions };
                                  if (allUncatSelected) {
                                    uncategorized.forEach((m) => delete newPermissions[m.id]);
                                  } else {
                                    uncategorized.forEach((m) => {
                                      newPermissions[m.id] = [...m.actions];
                                    });
                                  }
                                  return { ...prev, permissions: newPermissions };
                                });
                              }}
                            />
                          )}
                          <CardTitle className="text-sm font-medium">Other Modules</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="divide-y">
                          {uncategorized.map((module) => {
                            const modulePerms = formData.permissions[module.id] || [];
                            const allSelected = module.actions.every((a) =>
                              modulePerms.includes(a)
                            );
                            const someSelected = modulePerms.length > 0 && !allSelected;

                            return (
                              <div
                                key={module.id}
                                className="flex items-center justify-between px-4 py-3 hover:bg-muted/30"
                              >
                                <div className="flex items-center gap-3">
                                  <Checkbox
                                    checked={allSelected}
                                    ref={(el) => {
                                      if (el) {
                                        (
                                          el as HTMLButtonElement & { indeterminate: boolean }
                                        ).indeterminate = someSelected;
                                      }
                                    }}
                                    onCheckedChange={() =>
                                      toggleAllInModule(module.id, module.actions)
                                    }
                                    disabled={isViewMode}
                                  />
                                  <span className="font-medium text-sm">{module.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {module.actions.map((action) => (
                                    <button
                                      key={action}
                                      type="button"
                                      onClick={() => togglePermission(module.id, action)}
                                      disabled={isViewMode}
                                      className={cn(
                                        'px-2.5 py-1 text-xs rounded-md border transition-colors capitalize',
                                        hasPermission(module.id, action)
                                          ? 'bg-primary text-primary-foreground border-primary'
                                          : 'bg-background text-muted-foreground border-border hover:border-primary/50',
                                        isViewMode && 'cursor-default'
                                      )}
                                    >
                                      {action}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}
              </div>
            </ScrollArea>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

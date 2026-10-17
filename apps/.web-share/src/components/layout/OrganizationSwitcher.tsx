'use client';

import { useState } from 'react';
import {
  Building2,
  Check,
  ChevronDown,
  Plus,
  Loader2,
  School,
  GraduationCap,
  University,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useBranchStore } from '@/store/branchStore';
import { useSidebarTheme } from '@/contexts/SidebarThemeContext';
import { authApi } from '@/lib/api';
import { toast } from 'sonner';
import { AddOrganizationModal } from './AddOrganizationModal';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface OrganizationSwitcherProps {
  isCollapsed?: boolean;
}

export function OrganizationSwitcher({ isCollapsed = false }: OrganizationSwitcherProps) {
  const { user, setAuth } = useAuthStore();
  const initializeBranchSelection = useBranchStore((s) => s.initializeBranchSelection);
  const { theme, themeId } = useSidebarTheme();
  const isLightMode = themeId === 'arctic';

  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [addOrgOpen, setAddOrgOpen] = useState(false);

  const currentTenantId = user?.tenant?._id;
  const organizations = user?.organizations || [];

  const getInstitutionIcon = (type: string) => {
    switch (type) {
      case 'school':
        return School;
      case 'college':
        return GraduationCap;
      case 'university':
        return University;
      default:
        return Building2;
    }
  };

  const handleSwitch = async (tenantId: string) => {
    if (tenantId === currentTenantId) {
      setOpen(false);
      return;
    }

    setSwitching(tenantId);
    try {
      const response = await authApi.switchOrganization(tenantId);
      if (response.success) {
        // The switch endpoint returns the token FLAT (accessToken/expiresIn),
        // not nested under `tokens` like /auth/login does.
        setAuth(response.data.user, response.data.accessToken, response.data.expiresIn);

        // The selected branch belongs to the org we just left — carrying it
        // over sends another tenant's branch id on every request. Re-seed from
        // the new org's branches.
        initializeBranchSelection(
          response.data.user.branches ?? [],
          response.data.user.accessScope?.type
        );

        toast.success(`Switched to ${response.data.user.tenant.name}`);
        setOpen(false);
        // Full page load so every cached query refetches under the new org.
        // (A router.push immediately followed by reload races the navigation.)
        window.location.href = '/dashboard';
      }
    } catch (error) {
      console.error('Failed to switch organization:', error);
      toast.error('Failed to switch organization');
    } finally {
      setSwitching(null);
    }
  };

  if (isCollapsed) {
    // When collapsed, just show icon with tooltip
    return (
      <div
        className="px-3 py-3 shrink-0 flex justify-center"
        style={{ borderBottom: `1px solid ${theme.border}` }}
      >
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors overflow-hidden ring-1 ring-inset"
              style={{
                backgroundColor: user?.tenant?.branding?.logo ? '#ffffff' : theme.accentMuted,
                boxShadow: user?.tenant?.branding?.logo
                  ? `inset 0 0 0 1px ${theme.border}`
                  : 'none',
              }}
              title={user?.tenant?.name || 'Organization'}
            >
              {user?.tenant?.branding?.logo ? (
                <img
                  src={user.tenant.branding.logo}
                  alt={user.tenant.name || 'Organization'}
                  className="w-full h-full object-contain p-1.5"
                />
              ) : (
                <Building2 className="h-5 w-5" style={{ color: theme.accent }} />
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent side="right" align="start" className="w-72 p-0" sideOffset={8}>
            <OrgList
              organizations={organizations}
              currentTenantId={currentTenantId}
              switching={switching}
              onSwitch={handleSwitch}
              onAddNew={() => {
                setOpen(false);
                setAddOrgOpen(true);
              }}
              getInstitutionIcon={getInstitutionIcon}
            />
          </PopoverContent>
        </Popover>
        <AddOrganizationModal open={addOrgOpen} onOpenChange={setAddOrgOpen} />
      </div>
    );
  }

  return (
    <>
      <div className="px-4 py-3 shrink-0" style={{ borderBottom: `1px solid ${theme.border}` }}>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              className="w-full flex items-center gap-3 p-2.5 rounded-xl transition-colors text-left"
              style={{ backgroundColor: theme.bgSubtle }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 overflow-hidden ring-1 ring-inset"
                style={{
                  backgroundColor: user?.tenant?.branding?.logo ? '#ffffff' : theme.accentMuted,
                  boxShadow: user?.tenant?.branding?.logo
                    ? `inset 0 0 0 1px ${theme.border}`
                    : 'none',
                }}
              >
                {user?.tenant?.branding?.logo ? (
                  <img
                    src={user.tenant.branding.logo}
                    alt={user.tenant.name || 'Organization'}
                    className="w-full h-full object-contain p-1.5"
                  />
                ) : (
                  <Building2 className="h-4 w-4" style={{ color: theme.accent }} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: theme.text }}>
                  {user?.tenant?.name || 'Organization'}
                </p>
                <p className="text-xs truncate capitalize" style={{ color: theme.textMuted }}>
                  {user?.tenant?.institutionTypes?.[0] || 'Institution'}
                </p>
              </div>
              <ChevronDown
                className={cn('h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')}
                style={{ color: theme.textMuted }}
              />
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="bottom"
            align="start"
            className={cn(
              'w-[var(--radix-popover-trigger-width)] p-0',
              isLightMode ? 'bg-white border-slate-200' : ''
            )}
            sideOffset={4}
          >
            <OrgList
              organizations={organizations}
              currentTenantId={currentTenantId}
              switching={switching}
              onSwitch={handleSwitch}
              onAddNew={() => {
                setOpen(false);
                setAddOrgOpen(true);
              }}
              getInstitutionIcon={getInstitutionIcon}
            />
          </PopoverContent>
        </Popover>
      </div>
      <AddOrganizationModal open={addOrgOpen} onOpenChange={setAddOrgOpen} />
    </>
  );
}

interface OrgListProps {
  organizations: Array<{
    id: string;
    name: string;
    code: string;
    institutionType: string;
    roleCode: string;
    roleLevel: number;
    logo?: string;
  }>;
  currentTenantId?: string;
  switching: string | null;
  onSwitch: (tenantId: string) => void;
  onAddNew: () => void;
  getInstitutionIcon: (type: string) => React.ComponentType<{ className?: string }>;
}

function OrgList({
  organizations,
  currentTenantId,
  switching,
  onSwitch,
  onAddNew,
  getInstitutionIcon,
}: OrgListProps) {
  return (
    <div className="py-2">
      <div className="px-3 py-1.5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Your Organizations
        </p>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {organizations.length === 0 ? (
          <div className="px-3 py-4 text-center text-sm text-muted-foreground">
            No organizations found
          </div>
        ) : (
          organizations.map((org) => {
            const Icon = getInstitutionIcon(org.institutionType);
            const isCurrent = org.id === currentTenantId;
            const isLoading = switching === org.id;

            return (
              <button
                key={org.id}
                onClick={() => onSwitch(org.id)}
                disabled={isLoading || switching !== null}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors',
                  'hover:bg-muted/50 disabled:opacity-50',
                  isCurrent && 'bg-primary/5'
                )}
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 overflow-hidden',
                    org.logo
                      ? 'bg-white ring-1 ring-inset ring-border'
                      : isCurrent
                        ? 'bg-primary/10'
                        : 'bg-muted'
                  )}
                >
                  {org.logo ? (
                    <img
                      src={org.logo}
                      alt={org.name}
                      className="w-full h-full object-contain p-1"
                    />
                  ) : (
                    <Icon
                      className={cn(
                        'h-4 w-4',
                        isCurrent ? 'text-primary' : 'text-muted-foreground'
                      )}
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium truncate', isCurrent && 'text-primary')}>
                    {org.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate capitalize">
                    {org.institutionType} • {org.roleCode}
                  </p>
                </div>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                ) : isCurrent ? (
                  <Check className="h-4 w-4 text-primary shrink-0" />
                ) : null}
              </button>
            );
          })
        )}
      </div>
      <div className="border-t mt-1 pt-1">
        <button
          onClick={onAddNew}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-muted border-2 border-dashed border-muted-foreground/30">
            <Plus className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Add Organization</p>
            <p className="text-xs text-muted-foreground">Create a new school or college</p>
          </div>
        </button>
      </div>
    </div>
  );
}

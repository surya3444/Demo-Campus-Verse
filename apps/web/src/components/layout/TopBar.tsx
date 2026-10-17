'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { useBranchStore } from '@/store/branchStore';
import { useAuth } from '@/hooks/useAuth';
import { useBranchLabel } from '@/hooks/useBranchLabel';
import { authApi, organizationApi } from '@/lib/api';
import { toast } from 'sonner';
import {
  Bell,
  Menu,
  User,
  LogOut,
  ChevronDown,
  Building2,
  Check,
  Sparkles,
  Palette,
  Plus,
  Loader2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LocationSelector } from '@/components/ui/location-selector';
import { useSidebarTheme } from '@/contexts/SidebarThemeContext';
import { ThemeSwitcherModal } from './ThemeSwitcherModal';
import { GlobalSearch } from '@/components/search/GlobalSearch';

interface TopBarProps {
  onMobileMenuClick: () => void;
  sidebarCollapsed?: boolean;
}

export function TopBar({ onMobileMenuClick }: TopBarProps) {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { refreshProfile } = useAuth();
  // Universities operate campuses; schools/colleges have branches.
  const branchLabel = useBranchLabel();
  const queryClient = useQueryClient();
  const { selectedBranchId, availableBranches, setSelectedBranchId, clearBranch } =
    useBranchStore();

  const handleBranchChange = (branchId: string) => {
    setSelectedBranchId(branchId);
    // Invalidate all queries so branch-scoped data refetches with the new
    // X-Branch-Id header.
    queryClient.invalidateQueries();
    setBranchPopoverOpen(false);
  };

  const [profileOpen, setProfileOpen] = useState(false);
  const [branchPopoverOpen, setBranchPopoverOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [themeModalOpen, setThemeModalOpen] = useState(false);
  const [createBranchDialogOpen, setCreateBranchDialogOpen] = useState(false);
  const [savingBranch, setSavingBranch] = useState(false);
  // New branches default to the tenant's declared type, not 'school'.
  const tenantInstitutionType = (user?.tenant?.institutionTypes?.[0] || 'school') as
    | 'school'
    | 'college'
    | 'university';
  const [branchFormData, setBranchFormData] = useState({
    name: '',
    code: '',
    institutionType: tenantInstitutionType,
    city: '',
    state: '',
    country: 'India',
    pincode: '',
    phone: '',
    email: '',
  });

  const { theme } = useSidebarTheme();

  // The organization picked school / college / university at signup; with a
  // single type every campus inherits it, so the picker is only for mixed groups.
  const showTypePicker = (user?.tenant?.institutionTypes?.length ?? 0) !== 1;
  const profileRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const selectedBranch = availableBranches.find((b) => b._id === selectedBranchId);

  // This is strictly a campus switcher — institutions live on the Institutions
  // page and the cross-institution console ("All Institutions" in the sidebar).

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Continue with logout even if API fails
    }
    logout();
    clearBranch();
    toast.success('Logged out successfully');
    router.push('/login');
  };

  const resetBranchForm = () => {
    setBranchFormData({
      name: '',
      code: '',
      institutionType: tenantInstitutionType,
      city: '',
      state: '',
      country: 'India',
      pincode: '',
      phone: '',
      email: '',
    });
  };

  const handleOpenCreateBranch = () => {
    setBranchPopoverOpen(false);
    resetBranchForm();
    setCreateBranchDialogOpen(true);
  };

  const formatPhoneForApi = (phone: string): string | undefined => {
    if (!phone) return undefined;
    return `+91${phone}`;
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !branchFormData.name ||
      !branchFormData.code ||
      !branchFormData.city ||
      !branchFormData.state
    ) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSavingBranch(true);
    try {
      const phoneForApi = formatPhoneForApi(branchFormData.phone);
      const response = await organizationApi.createBranch({
        name: branchFormData.name,
        code: branchFormData.code.toUpperCase(),
        institutionType: branchFormData.institutionType,
        location: {
          city: branchFormData.city,
          state: branchFormData.state,
          country: branchFormData.country,
          pincode: branchFormData.pincode || undefined,
        },
        contact:
          branchFormData.phone || branchFormData.email
            ? {
                phone: phoneForApi,
                email: branchFormData.email || undefined,
              }
            : undefined,
      });
      if (response.success) {
        toast.success(`${branchLabel.singular} created successfully`);
        setCreateBranchDialogOpen(false);
        // The dropdown reads the PERSISTED branch store, which only login /
        // refreshProfile repopulate. The old full-page reload just rehydrated
        // the stale list from localStorage — the new branch never appeared.
        await refreshProfile();
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message || `Failed to create ${branchLabel.lower}`);
    } finally {
      setSavingBranch(false);
    }
  };

  return (
    <header className="sticky top-0 z-20 h-16 bg-white/80 backdrop-blur-xl border-b border-border/50">
      <div className="flex items-center justify-between h-full px-4 lg:px-6">
        {/* Left Section - Search */}
        <div className="flex items-center gap-3">
          {/* Mobile Menu Button */}
          <button
            onClick={onMobileMenuClick}
            className="lg:hidden p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Search: ⌘K palette over pages and every record the user can access */}
          <GlobalSearch />
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2">
          {/* Branch Selector Popover */}
          <Popover open={branchPopoverOpen} onOpenChange={setBranchPopoverOpen}>
            <PopoverTrigger asChild>
              <button className="hidden sm:flex items-center gap-2 h-9 px-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors max-w-[180px]">
                <Building2 className="h-4 w-4 text-primary shrink-0" />
                <span className="truncate text-sm font-medium text-foreground">
                  {selectedBranch?.name || `Select ${branchLabel.lower}`}
                </span>
                <ChevronDown
                  className={cn(
                    'h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform',
                    branchPopoverOpen && 'rotate-180'
                  )}
                />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-0">
              <div className="p-3 border-b border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Switch {branchLabel.singular}
                </p>
              </div>
              <div className="p-1.5 max-h-[300px] overflow-y-auto">
                {availableBranches.length === 0 ? (
                  <div className="py-6 text-center">
                    <Building2 className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No {branchLabel.lowerPlural} available
                    </p>
                  </div>
                ) : (
                  availableBranches.map((branch) => {
                    const isSelected = selectedBranchId === branch._id;
                    return (
                      <button
                        key={branch._id}
                        onClick={() => handleBranchChange(branch._id)}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
                          isSelected ? 'bg-primary/5' : 'hover:bg-muted/50'
                        )}
                      >
                        <div
                          className={cn(
                            'w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                            isSelected
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground'
                          )}
                        >
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className={cn(
                              'text-sm font-medium truncate',
                              isSelected && 'text-primary'
                            )}
                          >
                            {branch.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {branch.code} ·{' '}
                            {branch.institutionType.charAt(0).toUpperCase() +
                              branch.institutionType.slice(1)}
                          </p>
                        </div>
                        {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>
              {/* Create Branch Button - only for org-level roles */}
              {(user?.roleCode === 'GROUP_OWNER' || user?.roleCode === 'ORG_MODERATOR') && (
                <div className="p-1.5 border-t border-border">
                  <button
                    onClick={handleOpenCreateBranch}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors hover:bg-muted/50 text-primary"
                  >
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-primary/10">
                      <Plus className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium">Create {branchLabel.singular}</span>
                  </button>
                </div>
              )}
            </PopoverContent>
          </Popover>

          {/* Theme Switcher */}
          <button
            onClick={() => setThemeModalOpen(true)}
            className="relative p-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors group"
            title="Change sidebar theme"
          >
            <Palette className="h-5 w-5" />
            {/* Theme indicator dot */}
            <span
              className="absolute bottom-1.5 right-1.5 w-2 h-2 rounded-full ring-2 ring-white"
              style={{ backgroundColor: theme.accent }}
            />
          </button>

          {/* Notifications */}
          <div className="relative" ref={notificationsRef}>
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="relative p-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Bell className="h-5 w-5" />
              {/* Notification Badge */}
              <span
                className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: theme.accentHex }}
              />
            </button>

            {/* Notifications Dropdown */}
            <div
              className={cn(
                'absolute top-full right-0 mt-2 w-80 rounded-xl border border-border bg-white shadow-xl transition-all duration-200 origin-top-right',
                notificationsOpen
                  ? 'opacity-100 scale-100 translate-y-0'
                  : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
              )}
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="font-semibold text-foreground">Notifications</h3>
                <button className="text-xs text-accent hover:text-primary font-medium">
                  Mark all read
                </button>
              </div>
              <div className="p-2 max-h-[320px] overflow-y-auto">
                {/* Empty State */}
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                    <Sparkles className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground">All caught up!</p>
                  <p className="text-xs text-muted-foreground mt-1">No new notifications</p>
                </div>
              </div>
              <div className="p-2 border-t border-border">
                <Link
                  href="/notifications"
                  onClick={() => setNotificationsOpen(false)}
                  className="block w-full text-center text-sm text-accent hover:text-primary font-medium py-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  View all notifications
                </Link>
              </div>
            </div>
          </div>

          {/* User Profile */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 p-1.5 pr-3 rounded-xl hover:bg-muted transition-colors"
            >
              {user?.profile?.avatar ? (
                <img
                  src={user.profile.avatar}
                  alt={user.profile.displayName ?? 'User'}
                  className="w-8 h-8 rounded-lg object-cover"
                />
              ) : (
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-semibold text-sm"
                  style={{
                    background: `linear-gradient(135deg, ${theme.primaryHex}, ${theme.accentHex})`,
                  }}
                >
                  {user?.profile?.displayName?.charAt(0) || 'U'}
                </div>
              )}
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium text-foreground leading-tight truncate max-w-[120px]">
                  {user?.profile?.displayName || 'User'}
                </p>
                <p className="text-xs text-muted-foreground truncate max-w-[120px] capitalize">
                  {user?.roleCode?.replace(/_/g, ' ') || 'Role'}
                </p>
              </div>
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-muted-foreground transition-transform',
                  profileOpen && 'rotate-180'
                )}
              />
            </button>

            {/* Profile Dropdown */}
            <div
              className={cn(
                'absolute top-full right-0 mt-2 w-64 rounded-xl border border-border bg-white shadow-xl transition-all duration-200 origin-top-right',
                profileOpen
                  ? 'opacity-100 scale-100 translate-y-0'
                  : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
              )}
            >
              {/* User Info */}
              <div className="p-4 border-b border-border">
                <div className="flex items-center gap-3">
                  {user?.profile?.avatar ? (
                    <img
                      src={user.profile.avatar}
                      alt={user.profile.displayName ?? 'User'}
                      className="w-11 h-11 rounded-xl object-cover"
                    />
                  ) : (
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                      style={{
                        background: `linear-gradient(135deg, ${theme.primaryHex}, ${theme.accentHex})`,
                      }}
                    >
                      {user?.profile?.displayName?.charAt(0) || 'U'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">
                      {user?.profile?.displayName || 'User'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  </div>
                </div>
              </div>

              {/* Menu Items */}
              <div className="p-1.5">
                <Link
                  href="/profile"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-foreground hover:bg-muted transition-colors"
                >
                  <User className="h-4 w-4 text-muted-foreground" />
                  My Profile
                </Link>
                {/* Settings link removed — /settings route does not exist.
                    Re-enable once a top-level settings hub is built. */}
                {/* <Link
                  href="/settings"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-foreground hover:bg-muted transition-colors"
                >
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  Settings
                </Link> */}
              </div>

              {/* Logout */}
              <div className="p-1.5 border-t border-border">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Theme Switcher Modal */}
      <ThemeSwitcherModal isOpen={themeModalOpen} onClose={() => setThemeModalOpen(false)} />

      {/* Create Branch Dialog */}
      <Dialog open={createBranchDialogOpen} onOpenChange={setCreateBranchDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New {branchLabel.singular}</DialogTitle>
            <DialogDescription>
              Add a new {branchLabel.lower} to your organization
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateBranch} className="space-y-6">
            {/* Institution type */}
            {showTypePicker ? (
              <div className="space-y-3">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
                  Institution Type <span className="text-destructive">*</span>
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { value: 'school', label: 'School' },
                      { value: 'college', label: 'College' },
                      { value: 'university', label: 'University' },
                    ] as const
                  ).map((opt) => {
                    const isOn = branchFormData.institutionType === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          setBranchFormData({ ...branchFormData, institutionType: opt.value })
                        }
                        className={`relative rounded-xl border-2 p-3 text-center text-sm font-medium transition-all ${
                          isOn
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-input bg-background text-muted-foreground hover:border-primary/30'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                This will be a{' '}
                <span className="font-medium capitalize text-foreground">
                  {branchFormData.institutionType}
                </span>{' '}
                campus, like the rest of your organization.
              </p>
            )}

            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
                Basic Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="branch-name">
                    {branchLabel.singular} Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="branch-name"
                    placeholder="e.g., Delhi Public School - Vasant Kunj"
                    value={branchFormData.name}
                    onChange={(e) => setBranchFormData({ ...branchFormData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="branch-code">
                    {branchLabel.singular} Code <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="branch-code"
                    placeholder="e.g., DPS-VK"
                    value={branchFormData.code}
                    onChange={(e) =>
                      setBranchFormData({ ...branchFormData, code: e.target.value.toUpperCase() })
                    }
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    A unique identifier for this branch
                  </p>
                </div>
              </div>
            </div>

            {/* Location Details */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
                Location Details
              </h3>
              <LocationSelector
                value={{
                  country: branchFormData.country,
                  state: branchFormData.state,
                  city: branchFormData.city,
                }}
                onChange={(location) =>
                  setBranchFormData({
                    ...branchFormData,
                    country: location.country || 'India',
                    state: location.state || '',
                    city: location.city || '',
                  })
                }
                showCountry={true}
                required
              />
              <div className="space-y-2">
                <Label htmlFor="branch-pincode">Pincode / ZIP Code</Label>
                <Input
                  id="branch-pincode"
                  placeholder="e.g., 110070"
                  value={branchFormData.pincode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setBranchFormData({ ...branchFormData, pincode: value });
                  }}
                  className="w-1/3"
                />
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
                Contact Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="branch-phone">Phone Number</Label>
                  <div className="flex">
                    <span className="inline-flex items-center px-3 text-sm text-muted-foreground bg-muted border border-r-0 border-input rounded-l-md">
                      +91
                    </span>
                    <Input
                      id="branch-phone"
                      placeholder="9876543210"
                      value={branchFormData.phone}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setBranchFormData({ ...branchFormData, phone: value });
                      }}
                      className="rounded-l-none"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">10-digit mobile number</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="branch-email">Email Address</Label>
                  <Input
                    id="branch-email"
                    type="email"
                    placeholder="e.g., info@branch.edu.in"
                    value={branchFormData.email}
                    onChange={(e) =>
                      setBranchFormData({ ...branchFormData, email: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateBranchDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={savingBranch}>
                {savingBranch && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create {branchLabel.singular}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </header>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { AddButton, ExportButton } from '@/components/ui/page-header';
import { PageHero, StatTile, StatGrid } from '@/components/ui/page-hero';
import { DataTable, Column, DataTableAction } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Building2,
  MapPin,
  Users,
  GraduationCap,
  Eye,
  Pencil,
  Trash2,
  Phone,
  Mail,
  Loader2,
  Upload,
  ImageIcon,
  X,
  // Settings,
} from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { organizationApi, uploadApi } from '@/lib/api';
import { toast } from 'sonner';
import { LocationSelector } from '@/components/ui/location-selector';
import { LogoUploader } from '@/components/ui/logo-uploader';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import { useBranchLabel } from '@/hooks/useBranchLabel';
import { useAuthStore } from '@/store/authStore';

interface Branch {
  _id: string;
  name: string;
  code: string;
  institutionType?: 'school' | 'college' | 'university';
  location: {
    city: string;
    state: string;
    country?: string;
    pincode?: string;
  };
  contact?: {
    phone?: string;
    email?: string;
  };
  status: 'active' | 'inactive';
  studentCount?: number;
  staffCount?: number;
  createdAt: string;
}

interface BranchStats {
  students: { total: number; active: number };
  staff: { total: number; active: number };
  classes: number;
  branding?: { logo?: string; primaryColor?: string; secondaryColor?: string };
}

export default function BranchesPage() {
  const { canCreate, canEdit, canDelete } = usePermissions();
  const { refreshProfile } = useAuth();
  // Universities operate campuses; schools/colleges have branches.
  const branchLabel = useBranchLabel();
  // Default new/legacy branches to the tenant's declared type, not 'school'.
  const tenantInstitutionType = (useAuthStore((s) => s.user?.tenant?.institutionTypes?.[0]) ||
    'school') as 'school' | 'college' | 'university';
  const tenantTypes = useAuthStore((s) => s.user?.tenant?.institutionTypes);
  // The organization picked school / college / university at signup; with a
  // single type every campus inherits it, so the picker is only for mixed groups.
  const showTypePicker = (tenantTypes?.length ?? 0) !== 1;
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [branchStats, setBranchStats] = useState<BranchStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'view' | 'edit' | 'add'>('view');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [branchToDelete, setBranchToDelete] = useState<Branch | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    institutionType: tenantInstitutionType,
    city: '',
    state: '',
    country: 'India',
    pincode: '',
    phone: '',
    email: '',
    status: 'active' as 'active' | 'inactive',
  });

  // Branding state for the edit dialog
  const [brandingLogo, setBrandingLogo] = useState('');
  const [brandingPrimaryColor, setBrandingPrimaryColor] = useState('#3b82f6');
  const [brandingSecondaryColor, setBrandingSecondaryColor] = useState('#10b981');

  // Pending logo file for add mode (uploaded after branch creation)
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [pendingLogoPreview, setPendingLogoPreview] = useState<string | null>(null);

  // Branch logos map for the list view (branchId -> logoUrl)
  const [branchLogos, setBranchLogos] = useState<Record<string, string>>({});

  const fetchBranches = useCallback(async () => {
    try {
      setLoading(true);
      const response = await organizationApi.getBranches();
      if (response.success) {
        setBranches(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch branches:', error);
      toast.error(`Failed to load ${branchLabel.lowerPlural}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAllBranchLogos = useCallback(async (branchList: Branch[]) => {
    const logoMap: Record<string, string> = {};
    await Promise.allSettled(
      branchList.map(async (b) => {
        try {
          const res = await organizationApi.getBranchSettings(b._id);
          if (res?.data?.branding?.logo) {
            logoMap[b._id] = res.data.branding.logo;
          }
        } catch {
          // ignore
        }
      })
    );
    setBranchLogos(logoMap);
  }, []);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  useEffect(() => {
    if (branches.length > 0) {
      fetchAllBranchLogos(branches);
    }
  }, [branches, fetchAllBranchLogos]);

  const fetchBranchStats = async (branchId: string) => {
    try {
      setLoadingStats(true);
      const [statsRes, settingsRes] = await Promise.all([
        organizationApi.getBranchStats(branchId),
        organizationApi.getBranchSettings(branchId).catch(() => null),
      ]);
      const stats = statsRes.success ? statsRes.data : null;
      const branding = settingsRes?.data?.branding || undefined;
      setBranchStats(stats ? { ...stats, branding } : null);
    } catch (error) {
      console.error('Failed to fetch branch stats:', error);
      setBranchStats(null);
    } finally {
      setLoadingStats(false);
    }
  };

  const totalStudents = branches.reduce((acc, b) => acc + (b.studentCount || 0), 0);
  const totalStaff = branches.reduce((acc, b) => acc + (b.staffCount || 0), 0);
  const activeBranches = branches.filter((b) => b.status === 'active').length;

  const handleToggleStatus = async (row: Branch, checked: boolean) => {
    const nextStatus: 'active' | 'inactive' = checked ? 'active' : 'inactive';
    // Optimistic update
    setBranches((prev) => prev.map((b) => (b._id === row._id ? { ...b, status: nextStatus } : b)));
    try {
      const response = await organizationApi.updateBranch(row._id, { status: nextStatus });
      if (!response.success) {
        throw new Error('Update failed');
      }
      toast.success(
        `${branchLabel.singular} ${nextStatus === 'active' ? 'activated' : 'deactivated'}`
      );
    } catch (error) {
      console.error('Failed to update branch status:', error);
      // Rollback
      setBranches((prev) =>
        prev.map((b) => (b._id === row._id ? { ...b, status: row.status } : b))
      );
      toast.error(`Failed to update ${branchLabel.lower} status`);
    }
  };

  const handleExport = () => {
    if (!branches.length) {
      toast.error(`No ${branchLabel.lowerPlural} to export`);
      return;
    }

    const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const today = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    // School / org info header
    const tenant = useAuthStore.getState().user?.tenant;
    const schoolInfoRows: string[][] = [];
    if (tenant) {
      schoolInfoRows.push([tenant.name || '']);
      if (tenant.code) schoolInfoRows.push([`Code: ${tenant.code}`]);
      schoolInfoRows.push([`Exported on: ${today}`]);
      schoolInfoRows.push([]); // blank separator row
    }

    const headers = [
      'Code',
      'Name',
      'City',
      'State',
      'Phone',
      'Email',
      'Status',
      'Students',
      'Staff',
    ];
    const dataRows = branches.map((b) => [
      b.code,
      b.name,
      b.location.city,
      b.location.state,
      b.contact?.phone || '',
      b.contact?.email || '',
      b.status,
      b.studentCount ?? 0,
      b.staffCount ?? 0,
    ]);

    const allRows = [...schoolInfoRows, headers, ...dataRows];

    const csv = allRows.map((r) => r.map(escape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Branch List - ${today}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`${branchLabel.plural} exported`);
  };

  const columns: Column<Branch>[] = [
    {
      key: 'name',
      header: branchLabel.singular,
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden">
            {branchLogos[row._id] ? (
              <img
                src={branchLogos[row._id]}
                alt={row.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <Building2 className="h-5 w-5 text-primary" />
            )}
          </div>
          <div>
            <p className="font-medium">{row.name}</p>
            <p className="text-xs text-muted-foreground">{row.code}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      cell: (row) => (
        <div className="flex items-center gap-2 text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span>
            {row.location.city}, {row.location.state}
          </span>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      cell: (row) => (
        <div className="text-sm text-muted-foreground">
          {row.contact?.phone || row.contact?.email ? (
            <div className="space-y-1">
              {row.contact.phone && (
                <div className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  <span className="text-xs">{row.contact.phone}</span>
                </div>
              )}
              {row.contact.email && (
                <div className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  <span className="text-xs">{row.contact.email}</span>
                </div>
              )}
            </div>
          ) : (
            <span className="text-xs">No contact</span>
          )}
        </div>
      ),
    },
    {
      key: 'studentCount',
      header: 'Students',
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-1.5 text-sm">
          <GraduationCap className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{row.studentCount ?? 0}</span>
        </div>
      ),
    },
    {
      key: 'staffCount',
      header: 'Staff',
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-1.5 text-sm">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{row.staffCount ?? 0}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) =>
        canEdit('organization.branches') ? (
          <div className="flex items-center gap-2">
            <Switch
              checked={row.status === 'active'}
              onCheckedChange={(checked) => handleToggleStatus(row, checked)}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Toggle ${row.name} status`}
            />
            <span
              className={`text-xs font-medium ${row.status === 'active' ? 'text-success' : 'text-muted-foreground'}`}
            >
              {row.status === 'active' ? 'Active' : 'Inactive'}
            </span>
          </div>
        ) : (
          <Badge
            variant={row.status === 'active' ? 'default' : 'secondary'}
            className={
              row.status === 'active' ? 'bg-success/10 text-success border-success/20' : ''
            }
          >
            {row.status}
          </Badge>
        ),
    },
  ];

  // S1-02: Filter actions based on permissions - don't render buttons user can't use
  const actions: DataTableAction<Branch>[] = [
    {
      label: 'View Details',
      icon: <Eye className="mr-2 h-4 w-4" />,
      onClick: async (row) => {
        setSelectedBranch(row);
        setBranchStats(null);
        setDialogMode('view');
        setDialogOpen(true);
        await fetchBranchStats(row._id);
      },
    },
    // Only show edit if user has edit permission
    ...(canEdit('organization.branches')
      ? [
          {
            label: 'Edit',
            icon: <Pencil className="mr-2 h-4 w-4" />,
            onClick: async (row: Branch) => {
              setSelectedBranch(row);
              setFormData({
                name: row.name,
                code: row.code,
                institutionType: row.institutionType ?? tenantInstitutionType,
                city: row.location.city,
                state: row.location.state,
                country: row.location.country || 'India',
                pincode: row.location.pincode || '',
                phone: extractPhone(row.contact?.phone),
                email: row.contact?.email || '',
                status: row.status,
              });
              // Load existing branding from branch settings
              setBrandingLogo('');
              setBrandingPrimaryColor('#3b82f6');
              setBrandingSecondaryColor('#10b981');
              try {
                const settingsRes = await organizationApi.getBranchSettings(row._id);
                if (settingsRes?.data?.branding) {
                  setBrandingLogo(settingsRes.data.branding.logo || '');
                  setBrandingPrimaryColor(settingsRes.data.branding.primaryColor || '#3b82f6');
                  setBrandingSecondaryColor(settingsRes.data.branding.secondaryColor || '#10b981');
                }
              } catch {
                // Non-critical: branding just stays at defaults
              }
              setDialogMode('edit');
              setDialogOpen(true);
            },
          },
        ]
      : []),
    // Settings action commented out — branding is now in the Edit dialog.
    // {
    //   label: 'Settings',
    //   icon: <Settings className="mr-2 h-4 w-4" />,
    //   onClick: (row) => {
    //     router.push(`/organization/branches/${row._id}/settings`);
    //   },
    // },
    // S1-02 & S1-05: Only show delete if user has delete permission
    ...(canDelete('organization.branches')
      ? [
          {
            label: 'Delete',
            icon: <Trash2 className="mr-2 h-4 w-4" />,
            onClick: (row: Branch) => {
              setBranchToDelete(row);
              setDeleteDialogOpen(true);
            },
            variant: 'destructive' as const,
          },
        ]
      : []),
  ];

  const handleAddNew = () => {
    setSelectedBranch(null);
    setFormData({
      name: '',
      code: '',
      institutionType: tenantInstitutionType,
      city: '',
      state: '',
      country: 'India',
      pincode: '',
      phone: '',
      email: '',
      status: 'active',
    });
    setBrandingLogo('');
    setBrandingPrimaryColor('#3b82f6');
    setBrandingSecondaryColor('#10b981');
    setPendingLogoFile(null);
    setPendingLogoPreview(null);
    setDialogMode('add');
    setDialogOpen(true);
  };

  // Format phone for API (add +91 prefix)
  const formatPhoneForApi = (phone: string): string | undefined => {
    if (!phone) return undefined;
    return `+91${phone}`;
  };

  // Extract 10-digit phone from stored format (+919876543210 -> 9876543210)
  const extractPhone = (phone?: string): string => {
    if (!phone) return '';
    return phone.replace(/^\+91|^91|^0/, '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.code || !formData.city || !formData.state) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (formData.phone && formData.phone.length !== 10) {
      toast.error('Phone number must be exactly 10 digits');
      return;
    }

    setSaving(true);
    try {
      const phoneForApi = formatPhoneForApi(formData.phone);

      if (dialogMode === 'add') {
        const response = await organizationApi.createBranch({
          name: formData.name,
          code: formData.code.toUpperCase(),
          institutionType: formData.institutionType,
          location: {
            city: formData.city,
            state: formData.state,
            country: formData.country,
            pincode: formData.pincode || undefined,
          },
          contact:
            formData.phone || formData.email
              ? {
                  phone: phoneForApi,
                  email: formData.email || undefined,
                }
              : undefined,
        });
        if (response.success) {
          // Save branding for the newly created branch
          const newBranchId = response.data?._id;
          if (newBranchId) {
            let logoUrl = brandingLogo;

            // Upload pending logo file if selected during add mode
            if (pendingLogoFile) {
              try {
                const uploadRes = await uploadApi.uploadImage(
                  'organization',
                  newBranchId,
                  pendingLogoFile,
                  'photo'
                );
                if (uploadRes.success && uploadRes.data) {
                  logoUrl = uploadRes.data.url;
                }
              } catch {
                console.error('Failed to upload logo for new branch');
              }
            }

            if (
              logoUrl ||
              brandingPrimaryColor !== '#3b82f6' ||
              brandingSecondaryColor !== '#10b981'
            ) {
              try {
                await organizationApi.updateBranchSettings(newBranchId, {
                  branding: {
                    logo: logoUrl || undefined,
                    primaryColor: brandingPrimaryColor || undefined,
                    secondaryColor: brandingSecondaryColor || undefined,
                  },
                });
              } catch {
                console.error('Failed to save branding for new branch');
              }
            }
          }
          toast.success(`${branchLabel.singular} created successfully`);
          setPendingLogoFile(null);
          setPendingLogoPreview(null);
          fetchBranches();
          refreshProfile();
          setDialogOpen(false);
        }
      } else if (dialogMode === 'edit' && selectedBranch) {
        const [response] = await Promise.all([
          organizationApi.updateBranch(selectedBranch._id, {
            name: formData.name,
            code: formData.code.toUpperCase(),
            institutionType: formData.institutionType,
            location: {
              city: formData.city,
              state: formData.state,
              country: formData.country,
              pincode: formData.pincode || undefined,
            },
            contact: {
              phone: phoneForApi,
              email: formData.email || undefined,
            },
            status: formData.status,
          }),
          // Save branding in parallel with the branch update
          organizationApi
            .updateBranchSettings(selectedBranch._id, {
              branding: {
                logo: brandingLogo || undefined,
                primaryColor: brandingPrimaryColor || undefined,
                secondaryColor: brandingSecondaryColor || undefined,
              },
            })
            .catch(() => {
              // Non-critical
            }),
        ]);
        if (response.success) {
          toast.success(`${branchLabel.singular} updated successfully`);
          fetchBranches();
          refreshProfile();
          setDialogOpen(false);
        }
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message || `Failed to save ${branchLabel.lower}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!branchToDelete) return;
    try {
      const response = await organizationApi.deleteBranch(branchToDelete._id);
      if (response.success) {
        toast.success(`${branchLabel.singular} deleted successfully`);
        fetchBranches();
        // Sync the auth user's branches so the deleted branch disappears
        // from the global Branch Switcher dropdown without a re-login.
        refreshProfile();
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message || `Failed to delete ${branchLabel.lower}`);
    } finally {
      setDeleteDialogOpen(false);
      setBranchToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHero
          icon={Building2}
          eyebrow="Organization"
          title={branchLabel.plural}
          description={`Manage your organization's ${branchLabel.lowerPlural}`}
        />
        <StatGrid>
          {[...Array(4)].map((_, i) => (
            <StatTile key={i} title="Loading" value="" icon={Building2} loading />
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
        icon={Building2}
        eyebrow="Organization"
        title={branchLabel.plural}
        description={`Manage your organization's ${branchLabel.lowerPlural}`}
        actions={
          <>
            <ExportButton onClick={handleExport} />
            {/* S1-02: Only show Add button if user has create permission */}
            {canCreate('organization.branches') && (
              <AddButton onClick={handleAddNew} label={`Add ${branchLabel.singular}`} />
            )}
          </>
        }
      />

      {/* Stats */}
      <StatGrid>
        <StatTile
          title={`Total ${branchLabel.plural}`}
          value={branches.length}
          icon={Building2}
          variant="primary"
        />
        <StatTile
          title={`Active ${branchLabel.plural}`}
          value={activeBranches}
          icon={Building2}
          variant="success"
        />
        <StatTile
          title="Total Students"
          value={totalStudents}
          icon={GraduationCap}
          variant="info"
        />
        <StatTile title="Total Staff" value={totalStaff} icon={Users} />
      </StatGrid>

      {/* Table */}
      <DataTable
        data={branches}
        columns={columns}
        actions={actions}
        searchable
        searchPlaceholder="Search branches..."
      />

      {/* Branch Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'view'
                ? `${branchLabel.singular} Details`
                : dialogMode === 'edit'
                  ? `Edit ${branchLabel.singular}`
                  : `Add New ${branchLabel.singular}`}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === 'view'
                ? `View ${branchLabel.lower} information and statistics`
                : `Fill in the ${branchLabel.lower} details below`}
            </DialogDescription>
          </DialogHeader>

          {dialogMode === 'view' && selectedBranch ? (
            <div className="space-y-6">
              <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
                <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden">
                  {branchStats?.branding?.logo ? (
                    <img
                      src={branchStats.branding.logo}
                      alt={selectedBranch.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Building2 className="h-8 w-8 text-primary" />
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-semibold">{selectedBranch.name}</h3>
                  <p className="text-muted-foreground">{selectedBranch.code}</p>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      {selectedBranch.location.city}, {selectedBranch.location.state}
                    </span>
                    <Badge
                      className={
                        selectedBranch.status === 'active'
                          ? 'bg-success/10 text-success border-success/20'
                          : ''
                      }
                    >
                      {selectedBranch.status}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <GraduationCap className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        {loadingStats ? (
                          <Skeleton className="h-8 w-12" />
                        ) : (
                          <p className="text-2xl font-bold">{branchStats?.students?.active ?? 0}</p>
                        )}
                        <p className="text-sm text-muted-foreground">
                          Students
                          {branchStats &&
                            branchStats.students?.total !== branchStats.students?.active && (
                              <span className="text-xs ml-1">
                                / {branchStats.students.total} total
                              </span>
                            )}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                        <Users className="h-5 w-5 text-success" />
                      </div>
                      <div>
                        {loadingStats ? (
                          <Skeleton className="h-8 w-12" />
                        ) : (
                          <p className="text-2xl font-bold">{branchStats?.staff?.active ?? 0}</p>
                        )}
                        <p className="text-sm text-muted-foreground">
                          Staff
                          {branchStats &&
                            branchStats.staff?.total !== branchStats.staff?.active && (
                              <span className="text-xs ml-1">
                                / {branchStats.staff.total} total
                              </span>
                            )}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-accent" />
                      </div>
                      <div>
                        {loadingStats ? (
                          <Skeleton className="h-8 w-12" />
                        ) : (
                          <p className="text-2xl font-bold">{branchStats?.classes ?? 0}</p>
                        )}
                        <p className="text-sm text-muted-foreground">Classes</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {selectedBranch.contact &&
                (selectedBranch.contact.phone || selectedBranch.contact.email) && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Contact Information</h4>
                    <div className="flex flex-col gap-2 text-sm">
                      {selectedBranch.contact.phone && (
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="h-4 w-4" />
                          {selectedBranch.contact.phone}
                        </span>
                      )}
                      {selectedBranch.contact.email && (
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="h-4 w-4" />
                          {selectedBranch.contact.email}
                        </span>
                      )}
                    </div>
                  </div>
                )}

              {/* S1-02: Only show Edit button if user has edit permission */}
              {canEdit('organization.branches') && (
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFormData({
                        name: selectedBranch.name,
                        code: selectedBranch.code,
                        institutionType: selectedBranch.institutionType ?? tenantInstitutionType,
                        city: selectedBranch.location.city,
                        state: selectedBranch.location.state,
                        country: selectedBranch.location.country || 'India',
                        pincode: selectedBranch.location.pincode || '',
                        phone: extractPhone(selectedBranch.contact?.phone),
                        email: selectedBranch.contact?.email || '',
                        status: selectedBranch.status,
                      });
                      setDialogMode('edit');
                    }}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit Branch
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Institution type — premium tile selector */}
              {showTypePicker ? (
                <div className="space-y-3">
                  <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
                    Institution Type <span className="text-destructive">*</span>
                  </h3>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {(
                      [
                        { value: 'school', label: 'School', desc: 'Grades & sections' },
                        { value: 'college', label: 'College', desc: 'Streams & years' },
                        { value: 'university', label: 'University', desc: 'Departments & years' },
                      ] as const
                    ).map((opt) => {
                      const isOn = formData.institutionType === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setFormData({ ...formData, institutionType: opt.value })}
                          className={`relative overflow-hidden rounded-xl border-2 p-3 text-left transition-all ${
                            isOn
                              ? 'border-primary bg-primary/5 shadow-sm'
                              : 'border-input bg-background hover:border-primary/30'
                          }`}
                        >
                          {isOn && (
                            <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-primary" />
                          )}
                          <p className="font-medium text-sm">{opt.label}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{opt.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                  This will be a{' '}
                  <span className="font-medium capitalize text-foreground">
                    {formData.institutionType}
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
                    <Label htmlFor="name">
                      {branchLabel.singular} Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="name"
                      placeholder="e.g., Delhi Public School - Vasant Kunj"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="code">
                      {branchLabel.singular} Code <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="code"
                      placeholder="e.g., DPS-VK"
                      value={formData.code}
                      onChange={(e) =>
                        setFormData({ ...formData, code: e.target.value.toUpperCase() })
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
                    country: formData.country,
                    state: formData.state,
                    city: formData.city,
                  }}
                  onChange={(location) =>
                    setFormData({
                      ...formData,
                      country: location.country || 'India',
                      state: location.state || '',
                      city: location.city || '',
                    })
                  }
                  showCountry={true}
                  required
                />
                <div className="space-y-2">
                  <Label htmlFor="pincode">Pincode / ZIP Code</Label>
                  <Input
                    id="pincode"
                    placeholder="e.g., 110070"
                    value={formData.pincode}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setFormData({ ...formData, pincode: value });
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
                    <Label htmlFor="phone">Phone Number</Label>
                    <div className="flex">
                      <span className="inline-flex items-center px-3 text-sm text-muted-foreground bg-muted border border-r-0 border-input rounded-l-md">
                        +91
                      </span>
                      <Input
                        id="phone"
                        placeholder="9876543210"
                        value={formData.phone}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                          setFormData({ ...formData, phone: value });
                        }}
                        className="rounded-l-none"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">10-digit mobile number</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="e.g., info@branch.edu.in"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {dialogMode === 'edit' && (
                <div className="space-y-4">
                  <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
                    Status
                  </h3>
                  <Select
                    value={formData.status}
                    onValueChange={(value: 'active' | 'inactive') =>
                      setFormData({ ...formData, status: value })
                    }
                  >
                    <SelectTrigger className="w-1/2">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Branding */}
              <div className="space-y-4">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
                  Branding
                </h3>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>{branchLabel.singular} Logo</Label>
                    {dialogMode === 'edit' && selectedBranch ? (
                      <LogoUploader
                        entityType="branch"
                        entityId={selectedBranch._id}
                        currentLogoUrl={brandingLogo || null}
                        onUploadComplete={(url) => setBrandingLogo(url)}
                        onRemove={() => setBrandingLogo('')}
                      />
                    ) : (
                      <div className="space-y-3">
                        <div
                          onClick={() => document.getElementById('add-branch-logo')?.click()}
                          className="relative border-2 border-dashed rounded-lg cursor-pointer transition-all hover:border-primary/50 group bg-muted/30 h-32"
                        >
                          {pendingLogoPreview ? (
                            <div className="w-full h-full flex items-center justify-center p-4">
                              <img
                                src={pendingLogoPreview}
                                alt="Logo preview"
                                className="max-w-full max-h-full object-contain"
                              />
                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                                <Upload className="w-8 h-8 text-white" />
                              </div>
                            </div>
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
                              <ImageIcon className="w-10 h-10" />
                              <span className="text-sm">Click to upload logo</span>
                              <span className="text-xs">PNG, JPG, SVG up to 5MB</span>
                            </div>
                          )}
                        </div>
                        {pendingLogoPreview && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setPendingLogoFile(null);
                              setPendingLogoPreview(null);
                            }}
                            className="gap-2"
                          >
                            <X className="w-4 h-4" />
                            Remove Logo
                          </Button>
                        )}
                        <input
                          id="add-branch-logo"
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/svg+xml"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const allowedTypes = [
                              'image/jpeg',
                              'image/png',
                              'image/webp',
                              'image/svg+xml',
                            ];
                            if (!allowedTypes.includes(file.type)) {
                              toast.error(
                                'Invalid file type. Please upload JPEG, PNG, WebP, or SVG.'
                              );
                              return;
                            }
                            if (file.size > 5 * 1024 * 1024) {
                              toast.error('File too large. Maximum size is 5MB.');
                              return;
                            }
                            setPendingLogoFile(file);
                            const reader = new FileReader();
                            reader.onload = (ev) =>
                              setPendingLogoPreview(ev.target?.result as string);
                            reader.readAsDataURL(file);
                            e.target.value = '';
                          }}
                          className="hidden"
                        />
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Primary Color</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={brandingPrimaryColor}
                          onChange={(e) => setBrandingPrimaryColor(e.target.value)}
                          className="w-12 h-10 p-1 cursor-pointer"
                        />
                        <Input
                          value={brandingPrimaryColor}
                          onChange={(e) => setBrandingPrimaryColor(e.target.value)}
                          placeholder="#3b82f6"
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Secondary Color</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={brandingSecondaryColor}
                          onChange={(e) => setBrandingSecondaryColor(e.target.value)}
                          className="w-12 h-10 p-1 cursor-pointer"
                        />
                        <Input
                          value={brandingSecondaryColor}
                          onChange={(e) => setBrandingSecondaryColor(e.target.value)}
                          placeholder="#10b981"
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="space-y-2">
                    <Label>Preview</Label>
                    <div className="border rounded-lg p-4 bg-muted/30">
                      <div className="flex items-center gap-4">
                        {brandingLogo ? (
                          <img
                            src={brandingLogo}
                            alt="Branch Logo"
                            className="h-12 object-contain"
                          />
                        ) : (
                          <div
                            className="h-12 w-12 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: brandingPrimaryColor }}
                          >
                            <Building2 className="h-6 w-6 text-white" />
                          </div>
                        )}
                        <div>
                          <p className="font-semibold" style={{ color: brandingPrimaryColor }}>
                            {formData.name || `${branchLabel.singular} Name`}
                          </p>
                          <p className="text-sm" style={{ color: brandingSecondaryColor }}>
                            Sample text in secondary color
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {dialogMode === 'add' ? 'Create Branch' : 'Save Changes'}
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
            <AlertDialogTitle>Delete {branchLabel.singular}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{branchToDelete?.name}&quot;? This action cannot
              be undone. All associated data will be permanently removed.
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

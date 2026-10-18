'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createCompanySchema } from '@campus-verse/shared/schemas';
import { careerConnectApi } from '@/lib/api';
import {
  Cell,
  CompanyLogo,
  Empty,
  PageTitle,
  Pager,
  Panel,
  Pill,
  SearchBox,
  Segmented,
  Skeleton as ConnectSkeleton,
  StatusPill,
  Table as ConnectTable,
  lpa,
} from '@/components/connect/kit';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Building2, Plus, Trash2, Pencil } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { z } from 'zod';

type CompanyFormData = z.infer<typeof createCompanySchema>;

interface Company {
  _id: string;
  name: string;
  industry?: string;
  website?: string;
  locations?: string[];
  status: string;
  partnership?: { type?: string };
  stats?: { drives: number; offers: number; hired: number; topCtc: number; avgCtc: number };
}

const INDUSTRIES = [
  'IT Services',
  'Software Product',
  'Consulting',
  'BFSI',
  'Manufacturing',
  'Healthcare',
  'Pharmaceuticals',
  'Automobile',
  'Telecom',
  'E-Commerce',
  'EdTech',
  'FinTech',
  'FMCG',
  'Energy & Utilities',
  'Media & Entertainment',
  'Logistics & Supply Chain',
  'Real Estate & Construction',
  'Retail',
  'Aerospace & Defence',
  'Agriculture & AgriTech',
  'Other',
];

const SECTORS = [
  'Technology',
  'Finance',
  'Healthcare',
  'Education',
  'Government',
  'Private',
  'Public',
  'Non-Profit',
  'Research & Development',
  'Other',
];

export default function CompaniesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [locationInput, setLocationInput] = useState('');

  // ── List query ──
  const { data, isLoading } = useQuery({
    queryKey: ['companies', { search, status: statusFilter, page }],
    queryFn: () =>
      careerConnectApi.getCompanies({
        search: search || undefined,
        status: statusFilter || undefined,
        page,
        limit: 20,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => careerConnectApi.deleteCompany(id),
    onSuccess: () => {
      toast.success('Company deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setDeleteId(null);
    },
    onError: (error: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete company');
      setDeleteId(null);
    },
  });

  // ── Add‑company form ──
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<CompanyFormData>({
    resolver: zodResolver(createCompanySchema),
    defaultValues: {
      name: '',
      industry: '',
      sector: '',
      website: '',
      locations: [],
      description: '',
      partnership: { type: 'regular' },
      notes: '',
    },
  });

  const locations = watch('locations') || [];

  const createMutation = useMutation({
    mutationFn: (formData: CompanyFormData) =>
      careerConnectApi.createCompany(formData as unknown as Record<string, unknown>),
    onSuccess: () => {
      toast.success('Company created successfully');
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setDrawerOpen(false);
      reset();
      setLocationInput('');
    },
    onError: () => {
      toast.error('Failed to create company');
    },
  });

  const addLocation = () => {
    if (locationInput.trim()) {
      setValue('locations', [...locations, locationInput.trim()]);
      setLocationInput('');
    }
  };

  const removeLocation = (index: number) => {
    setValue(
      'locations',
      locations.filter((_, i) => i !== index)
    );
  };

  const onCreateSubmit = (formData: CompanyFormData) => {
    createMutation.mutate(formData);
  };

  const handleOpenDrawer = () => {
    reset();
    setLocationInput('');
    setDrawerOpen(true);
  };

  const companies = data?.data || [];
  const meta = data?.meta;

  const totalHired = companies.reduce((n: number, c: Company) => n + (c.stats?.hired ?? 0), 0);
  const premium = companies.filter(
    (c: Company) => c.partnership?.type && c.partnership.type !== 'regular'
  ).length;

  return (
    <div className="space-y-6">
      <PageTitle
        title="Companies"
        description={`${meta?.total ?? companies.length} recruiting partners${totalHired ? ` · ${totalHired} students hired this season` : ''}${premium ? ` · ${premium} premium partners` : ''}`}
        actions={
          hasPermission('careerConnect.companies', 'create') ? (
            <Button size="sm" onClick={handleOpenDrawer}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add company
            </Button>
          ) : null
        }
      />

      <Panel bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-border/70 px-5 py-3">
          <SearchBox
            value={search}
            onChange={(v) => (setSearch(v), setPage(1))}
            placeholder="Search companies"
          />
          <div className="ml-auto">
            <Segmented
              value={statusFilter}
              onChange={(v) => (setStatusFilter(v), setPage(1))}
              options={[
                { value: '', label: 'All' },
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
                { value: 'blacklisted', label: 'Blacklisted' },
              ]}
            />
          </div>
        </div>
        {isLoading ? (
          <ConnectSkeleton rows={8} />
        ) : companies.length === 0 ? (
          <Empty
            icon={Building2}
            title="No companies yet"
            text="Add the companies that recruit from your campus."
          />
        ) : (
          <>
            <ConnectTable
              head={['Company', 'Partnership', 'Drives', 'Hired', 'Highest package', 'Status', '']}
            >
              {companies.map((company: Company) => (
                <tr
                  key={company._id}
                  onClick={() => router.push(`/career-connect/companies/${company._id}`)}
                  className="group cursor-pointer transition-colors hover:bg-muted/40"
                >
                  <Cell>
                    <span className="flex items-center gap-3">
                      <CompanyLogo name={company.name} website={company.website} size={36} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{company.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[company.industry, company.locations?.[0]].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                    </span>
                  </Cell>
                  <Cell>
                    {company.partnership?.type && company.partnership.type !== 'regular' ? (
                      <Pill tone="violet">
                        {company.partnership.type === 'exclusive' ? 'Exclusive' : 'Premium'}
                      </Pill>
                    ) : (
                      <span className="text-sm text-muted-foreground">Regular</span>
                    )}
                  </Cell>
                  <Cell className="tabular-nums">{company.stats?.drives ?? 0}</Cell>
                  <Cell className="tabular-nums font-medium">{company.stats?.hired ?? 0}</Cell>
                  <Cell className="tabular-nums">
                    {company.stats?.topCtc ? lpa(company.stats.topCtc) : '—'}
                  </Cell>
                  <Cell>
                    <StatusPill status={company.status} />
                  </Cell>
                  <Cell last>
                    <span
                      className="flex justify-end gap-1 opacity-0 transition group-hover:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {hasPermission('careerConnect.companies', 'edit') && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() =>
                            router.push(`/career-connect/companies/${company._id}/edit`)
                          }
                          aria-label="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {hasPermission('careerConnect.companies', 'delete') && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-rose-600"
                          onClick={() => setDeleteId(company._id)}
                          aria-label="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </span>
                  </Cell>
                </tr>
              ))}
            </ConnectTable>
            <Pager page={page} total={meta?.total ?? 0} limit={20} onPage={setPage} />
          </>
        )}
      </Panel>

      {/* ── Add Company Drawer ── */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="sm:max-w-lg w-full overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Add Company</SheetTitle>
            <SheetDescription>Register a new placement partner company</SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSubmit(onCreateSubmit)} className="mt-6 space-y-5">
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="drawer-name">Company Name *</Label>
                <Input id="drawer-name" {...register('name')} placeholder="e.g. Infosys" />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Industry *</Label>
                <Select onValueChange={(val) => setValue('industry', val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRIES.map((ind) => (
                      <SelectItem key={ind} value={ind}>
                        {ind}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.industry && (
                  <p className="text-sm text-destructive">{errors.industry.message}</p>
                )}
              </div>
            </div>

            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label>Sector</Label>
                <Select onValueChange={(val) => setValue('sector', val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select sector" />
                  </SelectTrigger>
                  <SelectContent>
                    {SECTORS.map((sec) => (
                      <SelectItem key={sec} value={sec}>
                        {sec}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Company Size</Label>
                <Select onValueChange={(val) => setValue('size', val as CompanyFormData['size'])}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="startup">Startup</SelectItem>
                    <SelectItem value="small">Small</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="large">Large</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="drawer-website">Website</Label>
                <Input
                  id="drawer-website"
                  {...register('website')}
                  placeholder="https://example.com"
                />
                {errors.website && (
                  <p className="text-sm text-destructive">{errors.website.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Partnership Type</Label>
                <Select
                  defaultValue="regular"
                  onValueChange={(val) =>
                    setValue('partnership.type', val as 'regular' | 'premium' | 'exclusive')
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regular">Regular</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="exclusive">Exclusive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Locations</Label>
              <div className="flex gap-2">
                <Input
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  placeholder="Add a location"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addLocation();
                    }
                  }}
                />
                <Button type="button" variant="outline" size="icon" onClick={addLocation}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {locations.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {locations.map((loc, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-sm"
                    >
                      {loc}
                      <button
                        type="button"
                        onClick={() => removeLocation(i)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="drawer-description">Description</Label>
              <Textarea
                id="drawer-description"
                {...register('description')}
                placeholder="Brief description of the company"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="drawer-notes">Notes</Label>
              <Textarea
                id="drawer-notes"
                {...register('notes')}
                placeholder="Internal notes about this company"
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setDrawerOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Company'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* ── Delete Dialog ── */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Company</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this company? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

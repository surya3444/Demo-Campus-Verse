'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createCompanySchema } from '@campus-verse/shared/schemas';
import { careerConnectApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Building2, Plus, Search, MoreHorizontal, Eye, Edit, Trash2, MapPin } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { z } from 'zod';

type CompanyFormData = z.infer<typeof createCompanySchema>;

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

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  blacklisted: 'bg-red-100 text-red-800',
};

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Companies</h1>
          <p className="text-muted-foreground">Manage placement partner companies</p>
        </div>
        {hasPermission('careerConnect.companies', 'create') && (
          <Button onClick={handleOpenDrawer}>
            <Plus className="mr-2 h-4 w-4" />
            Add Company
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search companies..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(val) => {
                setStatusFilter(val === 'all' ? '' : val);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="blacklisted">Blacklisted</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : companies.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No companies found</h3>
              <p className="text-muted-foreground">
                {search || statusFilter
                  ? 'Try adjusting your filters'
                  : 'Add your first placement partner company'}
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Industry</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Locations</TableHead>
                    <TableHead>Partnership</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.map(
                    (company: {
                      _id: string;
                      name: string;
                      industry: string;
                      size?: string;
                      locations?: string[];
                      partnership?: { type: string };
                      status: string;
                      hrContacts?: { _id: string }[];
                    }) => (
                      <TableRow key={company._id}>
                        <TableCell>
                          <Link
                            href={`/career-connect/companies/${company._id}`}
                            className="font-medium hover:underline"
                          >
                            {company.name}
                          </Link>
                          {company.hrContacts && company.hrContacts.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {company.hrContacts.length} contact
                              {company.hrContacts.length > 1 ? 's' : ''}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>{company.industry}</TableCell>
                        <TableCell className="capitalize">{company.size || '-'}</TableCell>
                        <TableCell>
                          {company.locations && company.locations.length > 0 ? (
                            <div className="flex items-center gap-1 text-sm">
                              <MapPin className="h-3 w-3" />
                              {company.locations.slice(0, 2).join(', ')}
                              {company.locations.length > 2 && (
                                <span className="text-muted-foreground">
                                  +{company.locations.length - 2}
                                </span>
                              )}
                            </div>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell className="capitalize">
                          {company.partnership?.type || 'regular'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={statusColors[company.status] || ''}>
                            {company.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() =>
                                  router.push(`/career-connect/companies/${company._id}`)
                                }
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                View
                              </DropdownMenuItem>
                              {hasPermission('careerConnect.companies', 'edit') && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    router.push(`/career-connect/companies/${company._id}/edit`)
                                  }
                                >
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                              )}
                              {hasPermission('careerConnect.companies', 'delete') && (
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => setDeleteId(company._id)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  )}
                </TableBody>
              </Table>

              {meta && meta.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {(page - 1) * 20 + 1}-{Math.min(page * 20, meta.total)} of {meta.total}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage(page - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!meta.hasMore}
                      onClick={() => setPage(page + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

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

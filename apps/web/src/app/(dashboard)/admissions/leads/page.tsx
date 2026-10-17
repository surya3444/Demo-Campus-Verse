'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  UserPlus,
  Users,
  PhoneCall,
  CheckCircle,
  Eye,
  Pencil,
  Trash2,
  Phone,
  ArrowRight,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  TrendingUp,
  Mail,
  Calendar,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { admissionsApi } from '@/lib/api';
import { toast } from 'sonner';
import { AddLeadDialog } from '@/app/(dashboard)/admissions/components/AddLeadDialog';

interface Lead {
  _id: string;
  leadNumber: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  contact: { phone: string; email?: string };
  parents?: {
    father?: { name: string; phone?: string };
    mother?: { name: string; phone?: string };
  };
  interestedIn?: { classId?: string; className?: string; stream?: string };
  source: string;
  stage: string;
  followups?: Array<{ nextFollowupDate?: string }>;
  createdAt: string;
}

interface LeadStats {
  total: number;
  byStage: Record<string, number>;
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: number;
  variant?: 'default' | 'success' | 'warning' | 'primary';
  loading?: boolean;
}

function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  variant = 'default',
  loading,
}: StatCardProps) {
  const variants = {
    default: 'bg-card',
    success: 'bg-gradient-to-br from-success to-emerald-600 text-white',
    warning: 'bg-gradient-to-br from-amber-500 to-amber-600 text-white',
    primary: 'bg-gradient-to-br from-primary to-primary/90 text-primary-foreground',
  };
  const isColored = variant !== 'default';

  if (loading) {
    return (
      <Card className="border-0 shadow-elegant-md">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
            </div>
            <Skeleton className="h-11 w-11 rounded-xl" />
          </div>
        </CardContent>
      </Card>
    );
  }

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
            <div className="flex items-baseline gap-2 mt-1">
              <p className={`text-3xl font-bold ${isColored ? '' : 'text-foreground'}`}>{value}</p>
              {trend !== undefined && (
                <span
                  className={`text-sm font-medium flex items-center ${isColored ? 'text-white/70' : 'text-success'}`}
                >
                  <TrendingUp className="h-3 w-3 mr-0.5" />
                  {trend}%
                </span>
              )}
            </div>
          </div>
          <div className={`p-3 rounded-xl ${isColored ? 'bg-white/10' : 'bg-muted'}`}>
            <Icon className={`h-5 w-5 ${isColored ? '' : 'text-muted-foreground'}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<{ total: number; totalPages: number; hasMore: boolean } | null>(
    null
  );
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Add Lead dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const handleLeadCreated = () => {
    fetchLeads();
    fetchStats();
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

  const fetchLeads = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 20, sortBy, sortOrder };
      if (debouncedSearch) params.search = debouncedSearch;
      if (stageFilter) params.stage = stageFilter;
      const response = await admissionsApi.getLeads(
        params as Parameters<typeof admissionsApi.getLeads>[0]
      );
      if (response.success) {
        setLeads(response.data);
        if (response.meta) setMeta(response.meta);
      }
    } catch {
      toast.error('Failed to load leads');
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch, stageFilter, sortBy, sortOrder]);

  const fetchStats = useCallback(async () => {
    setIsLoadingStats(true);
    try {
      const response = await admissionsApi.getLeadStats();
      if (response.success) {
        setStats(response.data);
      }
    } catch {
      // Stats are non-critical
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Refetch when tab regains focus or becomes visible — keeps the leads
  // list in sync with leads created/edited from another tab or the kanban.
  useEffect(() => {
    const refresh = () => {
      fetchLeads();
      fetchStats();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        refresh();
      }
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchLeads, fetchStats]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleDeleteLead = async (id: string) => {
    try {
      const response = await admissionsApi.deleteLead(id);
      if (response.success) {
        toast.success('Lead deleted');
        fetchLeads();
        fetchStats();
      }
    } catch {
      toast.error('Failed to delete lead');
    }
  };

  const stageColors: Record<string, string> = {
    new: 'bg-info/10 text-info border-info/20',
    contacted: 'bg-warning/10 text-warning border-warning/20',
    interested: 'bg-primary/10 text-primary border-primary/20',
    followup: 'bg-purple-100 text-purple-700 border-purple-200',
    visit_scheduled: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    visited: 'bg-success/10 text-success border-success/20',
    lost: 'bg-destructive/10 text-destructive border-destructive/20',
  };

  const sourceColors: Record<string, string> = {
    website: 'bg-blue-100 text-blue-700',
    referral: 'bg-green-100 text-green-700',
    walk_in: 'bg-purple-100 text-purple-700',
    advertisement: 'bg-orange-100 text-orange-700',
    social_media: 'bg-pink-100 text-pink-700',
  };

  const getParentName = (lead: Lead): string => {
    if (lead.parents?.father?.name) return lead.parents.father.name;
    if (lead.parents?.mother?.name) return lead.parents.mother.name;
    return `${lead.firstName} ${lead.lastName}`;
  };

  const getNextFollowupDate = (lead: Lead): string | null => {
    if (!lead.followups?.length) return null;
    const pending = lead.followups.find((f) => f.nextFollowupDate);
    return pending?.nextFollowupDate || null;
  };

  const formatStage = (stage: string): string =>
    stage.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admission Leads</h1>
          <p className="text-muted-foreground mt-1">
            Track and manage prospective student inquiries
          </p>
        </div>
        <Button
          className="gap-2 bg-primary hover:bg-primary/90"
          onClick={() => setAddDialogOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Add Lead
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4 stagger-animation">
        <StatCard
          title="Total Leads"
          value={stats?.total ?? 0}
          icon={Users}
          loading={isLoadingStats}
        />
        <StatCard
          title="New Leads"
          value={stats?.byStage?.new ?? 0}
          icon={UserPlus}
          variant="primary"
          loading={isLoadingStats}
        />
        <StatCard
          title="Follow-up Pending"
          value={(stats?.byStage?.followup ?? 0) + (stats?.byStage?.contacted ?? 0)}
          icon={PhoneCall}
          variant="warning"
          loading={isLoadingStats}
        />
        <StatCard
          title="Visited"
          value={stats?.byStage?.visited ?? 0}
          icon={CheckCircle}
          variant="success"
          loading={isLoadingStats}
        />
      </div>

      {/* Leads Table */}
      <Card className="border-0 shadow-elegant-md">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="text-xl">Lead Pipeline</CardTitle>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search leads..."
                  className="pl-9 w-64 bg-muted/50 border-transparent focus:bg-white focus:border-border"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="shrink-0">
                    <Filter className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={() => {
                      setStageFilter('');
                      setPage(1);
                    }}
                  >
                    All Stages
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {['new', 'contacted', 'interested', 'followup', 'visit_scheduled', 'visited'].map(
                    (stage) => (
                      <DropdownMenuItem
                        key={stage}
                        onClick={() => {
                          setStageFilter(stage);
                          setPage(1);
                        }}
                      >
                        {formatStage(stage)}
                      </DropdownMenuItem>
                    )
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4">
                  <Skeleton className="h-10 w-32" />
                  <Skeleton className="h-10 w-24" />
                  <Skeleton className="h-10 w-20" />
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-10 flex-1" />
                </div>
              ))}
            </div>
          ) : leads.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No leads found</p>
              <p className="text-sm mt-1">
                {searchQuery || stageFilter
                  ? 'Try adjusting your filters'
                  : 'Add your first lead to get started'}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50">
                      <SortableHeader field="parentName">Parent/Guardian</SortableHeader>
                      <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-4">
                        Student
                      </th>
                      <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-4">
                        Interested In
                      </th>
                      <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-4">
                        Source
                      </th>
                      <SortableHeader field="stage">Stage</SortableHeader>
                      <SortableHeader field="createdAt">Created</SortableHeader>
                      <th className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-4">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {leads.map((lead, index) => {
                      const nextFollowup = getNextFollowupDate(lead);
                      return (
                        <tr
                          key={lead._id}
                          className="hover:bg-muted/30 transition-colors group"
                          style={{ animationDelay: `${index * 30}ms` }}
                        >
                          <td className="px-4 py-4">
                            <div>
                              <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                                {getParentName(lead)}
                              </p>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {lead.contact.phone}
                                </span>
                                {lead.contact.email && (
                                  <span className="flex items-center gap-1">
                                    <Mail className="h-3 w-3" />
                                    {lead.contact.email}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <p className="text-sm font-medium">
                              {lead.displayName || `${lead.firstName} ${lead.lastName}`}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {lead.leadNumber}
                            </p>
                          </td>
                          <td className="px-4 py-4">
                            <p className="text-sm">
                              {lead.interestedIn?.className || lead.interestedIn?.stream || '—'}
                            </p>
                          </td>
                          <td className="px-4 py-4">
                            <Badge
                              variant="secondary"
                              className={sourceColors[lead.source] || 'bg-muted'}
                            >
                              {lead.source.replace(/_/g, ' ')}
                            </Badge>
                          </td>
                          <td className="px-4 py-4">
                            <Badge
                              variant="secondary"
                              className={`capitalize ${stageColors[lead.stage] || ''}`}
                            >
                              {formatStage(lead.stage)}
                            </Badge>
                          </td>
                          <td className="px-4 py-4">
                            <div className="text-sm text-muted-foreground">
                              {new Date(lead.createdAt).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                              {nextFollowup && (
                                <p className="text-xs flex items-center gap-1 mt-1 text-warning">
                                  <Calendar className="h-3 w-3" />
                                  Follow-up:{' '}
                                  {new Date(nextFollowup).toLocaleDateString('en-IN', {
                                    day: 'numeric',
                                    month: 'short',
                                  })}
                                </p>
                              )}
                            </div>
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
                                <DropdownMenuItem>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <ArrowRight className="h-4 w-4 mr-2" />
                                  Convert to Application
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => handleDeleteLead(lead._id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-6 pt-6 border-t">
                <p className="text-sm text-muted-foreground">
                  Showing <span className="font-medium text-foreground">{leads.length}</span> of{' '}
                  <span className="font-medium text-foreground">{meta?.total ?? leads.length}</span>{' '}
                  leads
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {page}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!meta?.hasMore}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add Lead Dialog (shared) */}
      <AddLeadDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSuccess={handleLeadCreated}
      />
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, Column, DataTableAction } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/stat-card';
import {
  Calendar,
  Clock,
  AlertTriangle,
  Phone,
  Mail,
  User,
  MessageSquare,
  Loader2,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DatePicker } from '@/components/ui/date-picker';
import { toast } from 'sonner';
import { admissionsApi } from '@/lib/api';

interface Lead {
  _id: string;
  leadNumber: string;
  displayName: string;
  firstName: string;
  lastName: string;
  contact: {
    phone: string;
    email?: string;
  };
  source: string;
  stage: string;
  nextFollowupDate?: string;
  followups: Array<{
    _id?: string;
    date: string;
    type: string;
    notes: string;
    nextFollowupDate?: string;
    completedAt?: string;
    completedBy?: string;
    outcome?: string;
  }>;
}

interface FollowupStats {
  overdue: number;
  dueToday: number;
  dueThisWeek: number;
  total: number;
}

const stageColors: Record<string, string> = {
  new: 'bg-muted text-muted-foreground',
  contacted: 'bg-info/10 text-info border-info/20',
  interested: 'bg-accent/10 text-accent border-accent/20',
  followup: 'bg-warning/10 text-warning border-warning/20',
  visit_scheduled: 'bg-primary/10 text-primary border-primary/20',
  visited: 'bg-success/10 text-success border-success/20',
};

export default function FollowupsPage() {
  const [overdueLeads, setOverdueLeads] = useState<Lead[]>([]);
  const [todayLeads, setTodayLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<FollowupStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [followupType, setFollowupType] = useState<string>('call');
  const [followupNotes, setFollowupNotes] = useState('');
  const [nextFollowupDate, setNextFollowupDate] = useState('');
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [completeOutcome, setCompleteOutcome] = useState<string>('interested');
  const [completeNotes, setCompleteNotes] = useState('');
  const [completeNextDate, setCompleteNextDate] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [statsRes, overdueRes, todayRes] = await Promise.all([
        admissionsApi.getFollowupStats(),
        admissionsApi.getOverdueFollowups({ limit: 100 }),
        admissionsApi.getFollowupsDue({ limit: 100 }),
      ]);
      setStats(statsRes.data || null);
      setOverdueLeads(overdueRes.data || []);
      setTodayLeads(todayRes.data || []);
    } catch (err) {
      console.error('Failed to fetch followups:', err);
      setError('Failed to load followups');
      toast.error('Failed to load followups');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddFollowup = async () => {
    if (!selectedLead || !followupNotes.trim()) {
      toast.error('Please enter followup notes');
      return;
    }

    try {
      setActionLoading(true);
      await admissionsApi.addFollowup(selectedLead._id, {
        type: followupType,
        notes: followupNotes,
        nextFollowupDate: nextFollowupDate || undefined,
      });
      toast.success('Followup added successfully');
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (err) {
      console.error('Failed to add followup:', err);
      toast.error('Failed to add followup');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteFollowup = async () => {
    if (!selectedLead) return;

    // Find the latest pending followup (last entry without completedAt)
    const followups = selectedLead.followups || [];
    let pendingIndex = -1;
    for (let i = followups.length - 1; i >= 0; i--) {
      if (!followups[i].completedAt) {
        pendingIndex = i;
        break;
      }
    }

    if (pendingIndex === -1) {
      toast.error('No pending followup to complete');
      return;
    }

    try {
      setActionLoading(true);
      await admissionsApi.completeFollowup(selectedLead._id, pendingIndex, {
        outcome: completeOutcome as
          | 'interested'
          | 'not_interested'
          | 'no_response'
          | 'callback_requested'
          | 'converted',
        notes: completeNotes || undefined,
        nextFollowupDate: completeNextDate || undefined,
      });
      toast.success('Followup marked as completed');
      setCompleteDialogOpen(false);
      resetCompleteForm();
      fetchData();
    } catch (err) {
      console.error('Failed to complete followup:', err);
      toast.error('Failed to complete followup');
    } finally {
      setActionLoading(false);
    }
  };

  const resetCompleteForm = () => {
    setCompleteOutcome('interested');
    setCompleteNotes('');
    setCompleteNextDate('');
    setSelectedLead(null);
  };

  const resetForm = () => {
    setFollowupType('call');
    setFollowupNotes('');
    setNextFollowupDate('');
    setSelectedLead(null);
  };

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getDaysOverdue = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diffTime = now.getTime() - date.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  const columns: Column<Lead>[] = [
    {
      key: 'displayName',
      header: 'Lead',
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary/10 text-primary text-sm">
              {getInitials(row.displayName)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{row.displayName}</p>
            <p className="text-xs text-muted-foreground">{row.leadNumber}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      cell: (row) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-3 w-3 text-muted-foreground" />
            <span>{row.contact.phone}</span>
          </div>
          {row.contact.email && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-3 w-3" />
              <span className="truncate max-w-[150px]">{row.contact.email}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'stage',
      header: 'Stage',
      cell: (row) => (
        <Badge
          variant="secondary"
          className={`capitalize ${stageColors[row.stage] || stageColors.new}`}
        >
          {row.stage.replace('_', ' ')}
        </Badge>
      ),
    },
    {
      key: 'nextFollowupDate',
      header: 'Followup Date',
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">
            {row.nextFollowupDate ? formatDate(row.nextFollowupDate) : '-'}
          </span>
        </div>
      ),
    },
    {
      key: 'overdue',
      header: 'Status',
      cell: (row) => {
        if (!row.nextFollowupDate) return null;
        const daysOverdue = getDaysOverdue(row.nextFollowupDate);
        if (daysOverdue > 0) {
          return (
            <Badge variant="secondary" className="bg-destructive/10 text-destructive">
              {daysOverdue} day{daysOverdue !== 1 ? 's' : ''} overdue
            </Badge>
          );
        }
        return (
          <Badge variant="secondary" className="bg-warning/10 text-warning">
            Due today
          </Badge>
        );
      },
    },
    {
      key: 'lastFollowup',
      header: 'Last Followup',
      cell: (row) => {
        const last = row.followups?.[row.followups.length - 1];
        if (!last) return <span className="text-muted-foreground text-sm">No followups</span>;
        return (
          <div className="text-sm">
            <p className="capitalize">{last.type}</p>
            <p className="text-muted-foreground text-xs truncate max-w-[150px]">{last.notes}</p>
          </div>
        );
      },
    },
  ];

  const actions: DataTableAction<Lead>[] = [
    {
      label: 'Mark Done',
      icon: <CheckCircle className="mr-2 h-4 w-4" />,
      onClick: (row) => {
        setSelectedLead(row);
        setCompleteDialogOpen(true);
      },
    },
    {
      label: 'Add Followup',
      icon: <MessageSquare className="mr-2 h-4 w-4" />,
      onClick: (row) => {
        setSelectedLead(row);
        setDialogOpen(true);
      },
    },
    {
      label: 'Call',
      icon: <Phone className="mr-2 h-4 w-4" />,
      onClick: (row) => {
        window.open(`tel:${row.contact.phone}`, '_self');
      },
    },
  ];

  if (loading && overdueLeads.length === 0 && todayLeads.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading followups...</p>
        </div>
      </div>
    );
  }

  if (error && overdueLeads.length === 0 && todayLeads.length === 0) {
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
    <div className="space-y-6">
      <PageHeader title="Followups Dashboard" description="Track and manage lead followups" />

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4 stagger-animation">
        <StatCard
          title="Overdue"
          value={stats?.overdue || 0}
          icon={AlertTriangle}
          variant={stats?.overdue ? 'destructive' : undefined}
        />
        <StatCard title="Due Today" value={stats?.dueToday || 0} icon={Clock} variant="primary" />
        <StatCard title="This Week" value={stats?.dueThisWeek || 0} icon={Calendar} />
        <StatCard title="Total Scheduled" value={stats?.total || 0} icon={User} />
      </div>

      {/* Tabs for Overdue and Today */}
      <Tabs defaultValue="overdue">
        <TabsList>
          <TabsTrigger value="overdue" className="gap-2">
            Overdue
            {(stats?.overdue || 0) > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5">
                {stats?.overdue}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="today" className="gap-2">
            Due Today
            {(stats?.dueToday || 0) > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 bg-warning/20 text-warning">
                {stats?.dueToday}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overdue" className="mt-4">
          {overdueLeads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 border rounded-lg bg-muted/20">
              <CheckCircle className="h-12 w-12 text-success mb-4" />
              <p className="text-lg font-medium">No overdue followups!</p>
              <p className="text-muted-foreground">All followups are up to date.</p>
            </div>
          ) : (
            <DataTable
              data={overdueLeads}
              columns={columns}
              actions={actions}
              searchable
              searchPlaceholder="Search leads..."
            />
          )}
        </TabsContent>

        <TabsContent value="today" className="mt-4">
          {todayLeads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 border rounded-lg bg-muted/20">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No followups scheduled for today</p>
              <p className="text-muted-foreground">
                Check the overdue tab or schedule new followups.
              </p>
            </div>
          ) : (
            <DataTable
              data={todayLeads}
              columns={columns}
              actions={actions}
              searchable
              searchPlaceholder="Search leads..."
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Add Followup Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Followup</DialogTitle>
            <DialogDescription>Record a followup for {selectedLead?.displayName}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {selectedLead && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {getInitials(selectedLead.displayName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{selectedLead.displayName}</p>
                  <p className="text-sm text-muted-foreground">{selectedLead.contact.phone}</p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="type">Followup Type</Label>
              <Select value={followupType} onValueChange={setFollowupType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">Phone Call</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="visit">Visit</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes *</Label>
              <Textarea
                id="notes"
                placeholder="Enter followup notes..."
                value={followupNotes}
                onChange={(e) => setFollowupNotes(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nextDate">Next Followup Date</Label>
              <DatePicker
                id="nextDate"
                value={nextFollowupDate}
                onChange={(iso) => setNextFollowupDate(iso)}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setDialogOpen(false);
                  resetForm();
                }}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleAddFollowup}
                disabled={actionLoading || !followupNotes.trim()}
              >
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Followup'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Complete Followup Dialog */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mark Followup as Done</DialogTitle>
            <DialogDescription>
              Record the outcome for {selectedLead?.displayName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {selectedLead && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {getInitials(selectedLead.displayName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{selectedLead.displayName}</p>
                  <p className="text-sm text-muted-foreground">{selectedLead.contact.phone}</p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Outcome *</Label>
              <Select value={completeOutcome} onValueChange={setCompleteOutcome}>
                <SelectTrigger>
                  <SelectValue placeholder="Select outcome" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="interested">Interested</SelectItem>
                  <SelectItem value="not_interested">Not Interested</SelectItem>
                  <SelectItem value="no_response">No Response</SelectItem>
                  <SelectItem value="callback_requested">Callback Requested</SelectItem>
                  <SelectItem value="converted">Converted</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="completeNotes">Notes</Label>
              <Textarea
                id="completeNotes"
                placeholder="Optional outcome notes..."
                value={completeNotes}
                onChange={(e) => setCompleteNotes(e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="completeNextDate">Schedule Next Followup</Label>
              <DatePicker
                id="completeNextDate"
                value={completeNextDate}
                onChange={(iso) => setCompleteNextDate(iso)}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setCompleteDialogOpen(false);
                  resetCompleteForm();
                }}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleCompleteFollowup} disabled={actionLoading}>
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Mark as Done'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

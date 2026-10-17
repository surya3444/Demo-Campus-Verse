'use client';

import { useState, useEffect } from 'react';
import { PageHero, StatTile, StatGrid } from '@/components/ui/page-hero';
import { DataTable, Column, DataTableAction } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Clock,
  Plus,
  Play,
  Pause,
  Trash2,
  History,
  Calendar,
  Mail,
  Bell,
  Database,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { organizationApi } from '@/lib/api';

interface ScheduledJob {
  _id: string;
  name: string;
  code: string;
  type: string;
  schedule: {
    type: string;
    time?: string;
    cronExpression?: string;
  };
  isActive: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
}

interface JobExecution {
  _id: string;
  status: 'success' | 'failed' | 'running';
  startedAt: string;
  completedAt?: string;
  duration?: number;
}

const jobTypeIcons: Record<string, React.ReactNode> = {
  notification: <Bell className="h-4 w-4" />,
  reminder: <Mail className="h-4 w-4" />,
  report: <FileText className="h-4 w-4" />,
  sync: <Database className="h-4 w-4" />,
  cleanup: <Database className="h-4 w-4" />,
  custom: <Clock className="h-4 w-4" />,
};

const jobTypeLabels: Record<string, string> = {
  notification: 'Notification',
  reminder: 'Reminder',
  report: 'Report',
  sync: 'Data Sync',
  cleanup: 'Cleanup',
  custom: 'Custom',
};

export default function ScheduleJobsPage() {
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<ScheduledJob | null>(null);
  const [executions, setExecutions] = useState<JobExecution[]>([]);

  const [newJob, setNewJob] = useState({
    name: '',
    type: 'reminder' as string,
    scheduleType: 'daily' as string,
    time: '09:00',
    cronExpression: '',
  });

  // Auto-generate job code from name
  const generateJobCode = (name: string) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_');
  };

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    try {
      setLoading(true);
      const response = await organizationApi.getScheduledJobs();
      setJobs(response.data || []);
    } catch (error) {
      console.error('Failed to load scheduled jobs:', error);
      toast.error('Failed to load scheduled jobs');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateJob = async () => {
    if (!newJob.name) {
      toast.error('Please enter a job name');
      return;
    }

    const jobCode = generateJobCode(newJob.name);
    if (!jobCode) {
      toast.error('Invalid job name - cannot generate code');
      return;
    }

    try {
      setSaving(true);
      const response = await organizationApi.createScheduledJob({
        name: newJob.name,
        code: jobCode,
        type: newJob.type as 'report' | 'notification' | 'sync' | 'cleanup' | 'reminder' | 'custom',
        schedule: {
          type: newJob.scheduleType as 'once' | 'daily' | 'weekly' | 'monthly' | 'cron',
          time: newJob.time,
          cronExpression: newJob.scheduleType === 'cron' ? newJob.cronExpression : undefined,
        },
        config: {
          module: 'organization',
          action: 'scheduled_task',
        },
      });

      setJobs([...jobs, response.data]);
      setIsCreateOpen(false);
      setNewJob({
        name: '',
        type: 'reminder',
        scheduleType: 'daily',
        time: '09:00',
        cronExpression: '',
      });
      toast.success('Job created successfully');
    } catch (error) {
      console.error('Failed to create job:', error);
      toast.error('Failed to create job');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (job: ScheduledJob) => {
    try {
      await organizationApi.toggleScheduledJobStatus(job._id, !job.isActive);
      setJobs(jobs.map((j) => (j._id === job._id ? { ...j, isActive: !j.isActive } : j)));
      toast.success(`Job ${!job.isActive ? 'activated' : 'paused'}`);
    } catch (error) {
      console.error('Failed to toggle job status:', error);
      toast.error('Failed to update job status');
    }
  };

  const handleRunNow = async (job: ScheduledJob) => {
    try {
      await organizationApi.runScheduledJobNow(job._id);
      toast.success(`Job "${job.name}" started`);
    } catch (error) {
      console.error('Failed to run job:', error);
      toast.error('Failed to run job');
    }
  };

  const handleDelete = async (job: ScheduledJob) => {
    try {
      await organizationApi.deleteScheduledJob(job._id);
      setJobs(jobs.filter((j) => j._id !== job._id));
      toast.success('Job deleted');
    } catch (error) {
      console.error('Failed to delete job:', error);
      toast.error('Failed to delete job');
    }
  };

  const handleViewHistory = async (job: ScheduledJob) => {
    setSelectedJob(job);
    try {
      const response = await organizationApi.getScheduledJobExecutions(job._id, { limit: 10 });
      setExecutions(response.data || []);
    } catch (error) {
      console.error('Failed to load job history:', error);
      setExecutions([]);
    }
    setIsHistoryOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const columns: Column<ScheduledJob>[] = [
    {
      key: 'name',
      header: 'Job Name',
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            {jobTypeIcons[row.type] || <Clock className="h-4 w-4" />}
          </div>
          <div>
            <p className="font-medium">{row.name}</p>
            <p className="text-xs text-muted-foreground">{jobTypeLabels[row.type] || row.type}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'schedule',
      header: 'Schedule',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <code className="text-xs bg-muted px-2 py-1 rounded">
            {row.schedule.cronExpression || row.schedule.time || row.schedule.type}
          </code>
        </div>
      ),
    },
    {
      key: 'lastRunAt',
      header: 'Last Run',
      cell: (row) =>
        row.lastRunAt ? (
          <span className="text-sm">
            {new Date(row.lastRunAt).toLocaleString('en-IN', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        ) : (
          <span className="text-muted-foreground text-sm">Never</span>
        ),
    },
    {
      key: 'nextRunAt',
      header: 'Next Run',
      cell: (row) =>
        row.nextRunAt ? (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              {new Date(row.nextRunAt).toLocaleString('en-IN', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">-</span>
        ),
    },
    {
      key: 'isActive',
      header: 'Status',
      cell: (row) => (
        <Badge variant={row.isActive ? 'success' : 'warning'}>
          {row.isActive ? 'active' : 'paused'}
        </Badge>
      ),
    },
  ];

  const actions: DataTableAction<ScheduledJob>[] = [
    {
      label: 'Run Now',
      icon: <Play className="mr-2 h-4 w-4" />,
      onClick: handleRunNow,
    },
    {
      label: 'Pause/Resume',
      icon: <Pause className="mr-2 h-4 w-4" />,
      onClick: handleToggleStatus,
    },
    {
      label: 'View History',
      icon: <History className="mr-2 h-4 w-4" />,
      onClick: handleViewHistory,
    },
    {
      label: 'Delete',
      icon: <Trash2 className="mr-2 h-4 w-4" />,
      variant: 'destructive',
      onClick: handleDelete,
    },
  ];

  const executionColumns: Column<JobExecution>[] = [
    {
      key: 'startedAt',
      header: 'Started At',
      cell: (row) => (
        <span className="text-sm">{new Date(row.startedAt).toLocaleString('en-IN')}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => (
        <div className="flex items-center gap-2">
          {row.status === 'success' ? (
            <CheckCircle className="h-4 w-4 text-success" />
          ) : row.status === 'failed' ? (
            <XCircle className="h-4 w-4 text-destructive" />
          ) : (
            <AlertCircle className="h-4 w-4 text-warning animate-pulse" />
          )}
          <Badge
            variant={
              row.status === 'success'
                ? 'success'
                : row.status === 'failed'
                  ? 'destructive'
                  : 'warning'
            }
          >
            {row.status}
          </Badge>
        </div>
      ),
    },
    {
      key: 'duration',
      header: 'Duration',
      cell: (row) =>
        row.duration ? (
          <span className="text-sm">{row.duration}s</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHero
        icon={Clock}
        eyebrow="Organization"
        title="Scheduled Jobs"
        description="Manage automated background tasks"
        actions={
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Create Job
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Scheduled Job</DialogTitle>
                <DialogDescription>Configure a new automated job</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Job Name *</Label>
                  <Input
                    value={newJob.name}
                    onChange={(e) => setNewJob({ ...newJob, name: e.target.value })}
                    placeholder="e.g., Daily Attendance Summary"
                  />
                  {newJob.name && (
                    <p className="text-xs text-muted-foreground">
                      Code:{' '}
                      <code className="bg-muted px-1.5 py-0.5 rounded">
                        {generateJobCode(newJob.name)}
                      </code>
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Job Type</Label>
                    <Select
                      value={newJob.type}
                      onValueChange={(v) => setNewJob({ ...newJob, type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select job type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="reminder">Reminder</SelectItem>
                        <SelectItem value="notification">Notification</SelectItem>
                        <SelectItem value="report">Report</SelectItem>
                        <SelectItem value="sync">Data Sync</SelectItem>
                        <SelectItem value="cleanup">Cleanup</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Schedule Type</Label>
                    <Select
                      value={newJob.scheduleType}
                      onValueChange={(v) => setNewJob({ ...newJob, scheduleType: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select schedule" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="cron">Custom (Cron)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {newJob.scheduleType !== 'cron' && (
                  <div className="space-y-2">
                    <Label>Time</Label>
                    <Input
                      type="time"
                      value={newJob.time}
                      onChange={(e) => setNewJob({ ...newJob, time: e.target.value })}
                    />
                  </div>
                )}
                {newJob.scheduleType === 'cron' && (
                  <div className="space-y-2">
                    <Label>Cron Expression</Label>
                    <Input
                      value={newJob.cronExpression}
                      onChange={(e) => setNewJob({ ...newJob, cronExpression: e.target.value })}
                      placeholder="e.g., 0 18 * * * (6 PM daily)"
                    />
                    <p className="text-xs text-muted-foreground">
                      Format: minute hour day month weekday
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={handleCreateJob} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Job
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Stats */}
      <StatGrid>
        <StatTile title="Total Jobs" value={jobs.length} icon={Clock} variant="primary" />
        <StatTile
          title="Active"
          value={jobs.filter((j) => j.isActive).length}
          icon={Play}
          variant="success"
        />
        <StatTile
          title="Paused"
          value={jobs.filter((j) => !j.isActive).length}
          icon={Pause}
          variant="warning"
        />
        <StatTile
          title="Job Types"
          value={new Set(jobs.map((j) => j.type)).size}
          icon={Database}
          variant="info"
        />
      </StatGrid>

      <Card className="rounded-2xl border-border shadow-soft">
        <CardHeader>
          <CardTitle>Active Jobs</CardTitle>
          <CardDescription>All configured scheduled jobs</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable data={jobs} columns={columns} actions={actions} searchable />
        </CardContent>
      </Card>

      {/* Job History Dialog */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Execution History</DialogTitle>
            <DialogDescription>
              {selectedJob && `History for "${selectedJob.name}"`}
            </DialogDescription>
          </DialogHeader>
          <DataTable data={executions} columns={executionColumns} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

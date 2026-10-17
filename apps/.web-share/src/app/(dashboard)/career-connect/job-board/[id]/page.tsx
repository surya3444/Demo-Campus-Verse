'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { careerConnectApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  ArrowLeft,
  Briefcase,
  MapPin,
  Clock,
  Building2,
  Calendar,
  Users,
  IndianRupee,
  CheckCircle,
  FileText,
  Send,
  MoreVertical,
  Play,
  XCircle,
  Pencil,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  active: 'bg-green-100 text-green-800',
  closed: 'bg-yellow-100 text-yellow-800',
  expired: 'bg-red-100 text-red-800',
};

const applicationStatusColors: Record<string, string> = {
  applied: 'bg-blue-100 text-blue-800',
  shortlisted: 'bg-yellow-100 text-yellow-800',
  interview: 'bg-orange-100 text-orange-800',
  selected: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  withdrawn: 'bg-gray-100 text-gray-800',
};

interface JobPosting {
  _id: string;
  title: string;
  companyName?: string;
  companyId?: { name: string } | string;
  type: string;
  status: string;
  description: string;
  requirements?: string[];
  salary?: { min?: number; max?: number };
  stipend?: { amount?: number; duration?: string };
  location?: string;
  workMode?: string;
  eligibility?: { minCGPA?: number; allowedDepartments?: string[] };
  applicationDeadline: string;
  maxApplications?: number;
  applicationCount?: number;
  createdAt: string;
}

interface Application {
  _id: string;
  studentId: { _id: string; firstName?: string; lastName?: string; name?: string } | string;
  status: string;
  coverLetter?: string;
  resumeUrl?: string;
  statusRemarks?: string;
  createdAt: string;
}

function getCompanyName(job: JobPosting): string {
  if (job.companyName) return job.companyName;
  if (job.companyId && typeof job.companyId === 'object' && 'name' in job.companyId) {
    return job.companyId.name;
  }
  return 'Unknown Company';
}

function getStudentName(app: Application): string {
  if (typeof app.studentId === 'object') {
    if (app.studentId.name) return app.studentId.name;
    if (app.studentId.firstName) {
      return `${app.studentId.firstName} ${app.studentId.lastName || ''}`.trim();
    }
  }
  return 'Unknown Student';
}

function getDaysRemaining(deadline: string): { text: string; isExpired: boolean } {
  const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { text: 'Expired', isExpired: true };
  if (days === 0) return { text: 'Due today', isExpired: false };
  if (days === 1) return { text: '1 day remaining', isExpired: false };
  return { text: `${days} days remaining`, isExpired: false };
}

export default function JobPostingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const id = params.id as string;
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const [resumeUrl, setResumeUrl] = useState('');
  const [statusUpdateId, setStatusUpdateId] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [statusRemarks, setStatusRemarks] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['job-posting', id],
    queryFn: () => careerConnectApi.getJobPosting(id),
  });

  const canManageApplications = hasPermission('careerConnect.jobBoard', 'edit');

  const { data: applicationsData } = useQuery({
    queryKey: ['job-applications', id],
    queryFn: () => careerConnectApi.getJobApplications(id),
    enabled: canManageApplications,
  });

  const applyMutation = useMutation({
    mutationFn: (applyData: Record<string, unknown>) => careerConnectApi.applyForJob(id, applyData),
    onSuccess: () => {
      toast.success('Application submitted successfully');
      queryClient.invalidateQueries({ queryKey: ['job-posting', id] });
      queryClient.invalidateQueries({ queryKey: ['my-applications'] });
      setApplyDialogOpen(false);
      setCoverLetter('');
      setResumeUrl('');
    },
    onError: (error: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(error.response?.data?.error?.message || 'Failed to submit application');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ appId, data }: { appId: string; data: Record<string, unknown> }) =>
      careerConnectApi.updateApplicationStatus(appId, data),
    onSuccess: () => {
      toast.success('Application status updated');
      queryClient.invalidateQueries({ queryKey: ['job-applications', id] });
      setStatusUpdateId(null);
      setNewStatus('');
      setStatusRemarks('');
    },
    onError: (error: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update status');
    },
  });

  const updatePostingStatusMutation = useMutation({
    mutationFn: (status: string) => careerConnectApi.updateJobPostingStatus(id, status),
    onSuccess: () => {
      toast.success('Job posting status updated');
      queryClient.invalidateQueries({ queryKey: ['job-posting', id] });
      queryClient.invalidateQueries({ queryKey: ['job-postings'] });
    },
    onError: (error: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update status');
    },
  });

  const deletePostingMutation = useMutation({
    mutationFn: () => careerConnectApi.deleteJobPosting(id),
    onSuccess: () => {
      toast.success('Job posting deleted');
      queryClient.invalidateQueries({ queryKey: ['job-postings'] });
      router.push('/career-connect/job-board');
    },
    onError: (error: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete posting');
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const job: JobPosting | undefined = data?.data;

  if (!job) {
    return (
      <div className="text-center py-12">
        <Briefcase className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-medium">Job posting not found</h3>
      </div>
    );
  }

  const deadline = getDaysRemaining(job.applicationDeadline);
  const applications: Application[] = applicationsData?.data || [];
  const canApply =
    hasPermission('careerConnect.jobBoard', 'apply') &&
    job.status === 'active' &&
    !deadline.isExpired;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{job.title}</h1>
              <Badge variant="secondary" className={statusColors[job.status] || ''}>
                {job.status}
              </Badge>
            </div>
            <p className="text-muted-foreground flex items-center gap-1">
              <Building2 className="h-4 w-4" />
              {getCompanyName(job)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canApply && (
            <Dialog open={applyDialogOpen} onOpenChange={setApplyDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Send className="mr-2 h-4 w-4" />
                  Apply
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Apply for {job.title}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Cover Letter</Label>
                    <Textarea
                      value={coverLetter}
                      onChange={(e) => setCoverLetter(e.target.value)}
                      placeholder="Why are you a good fit for this role?"
                      rows={5}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Resume URL</Label>
                    <Input
                      value={resumeUrl}
                      onChange={(e) => setResumeUrl(e.target.value)}
                      placeholder="Link to your resume"
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={() =>
                      applyMutation.mutate({
                        coverLetter: coverLetter || undefined,
                        resumeUrl: resumeUrl || undefined,
                      })
                    }
                    disabled={applyMutation.isPending}
                  >
                    {applyMutation.isPending ? 'Submitting...' : 'Submit Application'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
          {hasPermission('careerConnect.jobBoard', 'edit') && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {job.status === 'draft' && (
                  <DropdownMenuItem
                    onClick={() => updatePostingStatusMutation.mutate('active')}
                    disabled={updatePostingStatusMutation.isPending}
                  >
                    <Play className="mr-2 h-4 w-4 text-green-600" />
                    Activate
                  </DropdownMenuItem>
                )}
                {job.status === 'active' && (
                  <DropdownMenuItem
                    onClick={() => updatePostingStatusMutation.mutate('closed')}
                    disabled={updatePostingStatusMutation.isPending}
                  >
                    <XCircle className="mr-2 h-4 w-4 text-yellow-600" />
                    Close
                  </DropdownMenuItem>
                )}
                {job.status === 'closed' && (
                  <DropdownMenuItem
                    onClick={() => updatePostingStatusMutation.mutate('active')}
                    disabled={updatePostingStatusMutation.isPending}
                  >
                    <Play className="mr-2 h-4 w-4 text-green-600" />
                    Reopen
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => router.push(`/career-connect/job-board/${id}/edit`)}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                {job.status === 'draft' && hasPermission('careerConnect.jobBoard', 'delete') && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this posting?')) {
                          deletePostingMutation.mutate();
                        }
                      }}
                      disabled={deletePostingMutation.isPending}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              <span className="capitalize">{job.type}</span>
            </div>
            {job.workMode && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="capitalize">{job.workMode}</span>
              </div>
            )}
            {job.location && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{job.location}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-2 text-sm">
            {job.type === 'job' && job.salary && (job.salary.min || job.salary.max) && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Salary</span>
                <span className="flex items-center gap-1">
                  <IndianRupee className="h-3 w-3" />
                  {job.salary.min && job.salary.max
                    ? `${(job.salary.min / 100000).toFixed(1)}L - ${(job.salary.max / 100000).toFixed(1)}L`
                    : job.salary.min
                      ? `${(job.salary.min / 100000).toFixed(1)}L+`
                      : `Up to ${(job.salary.max! / 100000).toFixed(1)}L`}
                </span>
              </div>
            )}
            {job.type === 'internship' && job.stipend?.amount && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Stipend</span>
                  <span className="flex items-center gap-1">
                    <IndianRupee className="h-3 w-3" />
                    {job.stipend.amount.toLocaleString()}/mo
                  </span>
                </div>
                {job.stipend.duration && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duration</span>
                    <span>{job.stipend.duration}</span>
                  </div>
                )}
              </>
            )}
            {job.maxApplications && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max Applications</span>
                <span>{job.maxApplications}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Applications</span>
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {job.applicationCount || 0}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Deadline</span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(job.applicationDeadline).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Time Left</span>
              <span className={deadline.isExpired ? 'text-destructive' : 'text-green-600'}>
                {deadline.text}
              </span>
            </div>
            {job.eligibility?.minCGPA && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Min CGPA</span>
                <span>{job.eligibility.minCGPA}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Posted</span>
              <span>{new Date(job.createdAt).toLocaleDateString()}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          {canManageApplications && (
            <TabsTrigger value="applications">Applications ({applications.length})</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="details" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{job.description}</p>
            </CardContent>
          </Card>

          {job.requirements && job.requirements.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Requirements</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {job.requirements.map((req, i) => (
                    <li key={i}>{req}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {job.eligibility?.allowedDepartments && job.eligibility.allowedDepartments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Eligible Departments</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {job.eligibility.allowedDepartments.map((dept, i) => (
                    <Badge key={i} variant="secondary">
                      {dept}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {canManageApplications && (
          <TabsContent value="applications" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Applications</CardTitle>
              </CardHeader>
              <CardContent>
                {applications.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="mx-auto h-10 w-10 text-muted-foreground/50" />
                    <p className="mt-2 text-muted-foreground">No applications yet</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Applied</TableHead>
                        <TableHead>Remarks</TableHead>
                        <TableHead className="w-[250px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {applications.map((app) => (
                        <TableRow key={app._id}>
                          <TableCell className="font-medium">{getStudentName(app)}</TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={applicationStatusColors[app.status] || ''}
                            >
                              {app.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{new Date(app.createdAt).toLocaleDateString()}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {app.statusRemarks || '-'}
                          </TableCell>
                          <TableCell>
                            {statusUpdateId === app._id ? (
                              <div className="flex items-center gap-2">
                                <Select value={newStatus} onValueChange={setNewStatus}>
                                  <SelectTrigger className="w-[120px]">
                                    <SelectValue placeholder="Status" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="shortlisted">Shortlisted</SelectItem>
                                    <SelectItem value="interview">Interview</SelectItem>
                                    <SelectItem value="selected">Selected</SelectItem>
                                    <SelectItem value="rejected">Rejected</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Input
                                  className="w-[120px]"
                                  placeholder="Remarks"
                                  value={statusRemarks}
                                  onChange={(e) => setStatusRemarks(e.target.value)}
                                />
                                <Button
                                  size="sm"
                                  disabled={!newStatus || updateStatusMutation.isPending}
                                  onClick={() =>
                                    updateStatusMutation.mutate({
                                      appId: app._id,
                                      data: {
                                        status: newStatus,
                                        statusRemarks: statusRemarks || undefined,
                                      },
                                    })
                                  }
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setStatusUpdateId(null);
                                    setNewStatus('');
                                    setStatusRemarks('');
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setStatusUpdateId(app._id)}
                              >
                                Update Status
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

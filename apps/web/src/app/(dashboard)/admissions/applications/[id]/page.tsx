'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  Phone,
  Mail,
  Calendar,
  User,
  CheckCircle,
  XCircle,
  ArrowRight,
  UserPlus,
  FileText,
  Loader2,
} from 'lucide-react';
import { admissionsApi, academicApi } from '@/lib/api';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  submitted: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  under_review: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  docs_verified: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  fee_paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  enrolled: 'bg-primary/10 text-primary',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  withdrawn: 'bg-muted text-muted-foreground',
};

interface ApplicationDetail {
  _id: string;
  applicationNumber: string;
  student: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: string;
  };
  contact: {
    phone: string;
    email?: string;
    address?: {
      city?: string;
      state?: string;
      pincode?: string;
    };
  };
  parents?: {
    father?: { name: string; phone?: string; occupation?: string };
    mother?: { name: string; phone?: string; occupation?: string };
  };
  class?: { displayName: string };
  classId: string;
  academicBatchId: string;
  sectionId?: string;
  status: string;
  source?: string;
  remarks?: string;
  createdAt: string;
  updatedAt?: string;
}

export default function ApplicationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [updating, setUpdating] = useState(false);
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  const [sections, setSections] = useState<{ _id: string; name: string }[]>([]);
  const [enrollForm, setEnrollForm] = useState({
    sectionId: '',
    admissionNumber: '',
    rollNumber: '',
  });

  const fetchApplication = useCallback(async () => {
    try {
      setLoading(true);
      const res = await admissionsApi.getApplication(id);
      setApplication(res.data);
    } catch {
      toast.error('Failed to load application');
      router.push('/admissions/applications');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchApplication();
  }, [fetchApplication]);

  const handleStatusUpdate = async (status: string, label: string) => {
    setUpdating(true);
    try {
      await admissionsApi.updateApplicationStatus(id, status);
      toast.success(`Application ${label.toLowerCase()} successfully`);
      fetchApplication();
    } catch {
      toast.error(`Failed to ${label.toLowerCase()}`);
    } finally {
      setUpdating(false);
    }
  };

  const openEnrollDialog = async () => {
    if (application?.classId) {
      try {
        const res = await academicApi.getSectionsByClass(application.classId);
        setSections(res.data || []);
      } catch {
        setSections([]);
      }
    }
    setEnrollDialogOpen(true);
  };

  const handleEnroll = async () => {
    if (!enrollForm.sectionId) {
      toast.error('Please select a section');
      return;
    }
    setUpdating(true);
    try {
      await admissionsApi.enrollStudent(id, {
        sectionId: enrollForm.sectionId,
        admissionNumber: enrollForm.admissionNumber || undefined,
        rollNumber: enrollForm.rollNumber || undefined,
      });
      toast.success('Student enrolled successfully!');
      setEnrollDialogOpen(false);
      fetchApplication();
    } catch {
      toast.error('Failed to enroll student');
    } finally {
      setUpdating(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[200px] w-full" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-[300px]" />
          <Skeleton className="h-[300px]" />
        </div>
      </div>
    );
  }

  if (!application) return null;

  const app = application;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/admissions/applications')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">
                {app.student.firstName} {app.student.lastName}
              </h1>
              <Badge variant="secondary" className={`capitalize ${statusColors[app.status] || ''}`}>
                {app.status.replace(/_/g, ' ')}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              <span className="font-mono">{app.applicationNumber}</span>
              {app.class && <> &middot; {app.class.displayName}</>}
            </p>
          </div>
        </div>

        {/* Status Actions */}
        <div className="flex items-center gap-2">
          {app.status === 'submitted' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleStatusUpdate('under_review', 'Review started')}
              disabled={updating}
            >
              {updating ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4 mr-1.5" />
              )}
              Start Review
            </Button>
          )}
          {['submitted', 'under_review', 'docs_verified'].includes(app.status) && (
            <Button
              size="sm"
              onClick={() => handleStatusUpdate('approved', 'Approved')}
              disabled={updating}
            >
              {updating ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-1.5" />
              )}
              Approve
            </Button>
          )}
          {['approved', 'fee_paid'].includes(app.status) && (
            <Button size="sm" onClick={openEnrollDialog} disabled={updating}>
              {updating ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4 mr-1.5" />
              )}
              Enroll Student
            </Button>
          )}
          {!['enrolled', 'rejected', 'withdrawn'].includes(app.status) && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleStatusUpdate('rejected', 'Rejected')}
              disabled={updating}
            >
              {updating ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4 mr-1.5" />
              )}
              Reject
            </Button>
          )}
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Student Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              Student Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Full Name</p>
                <p className="text-sm font-medium">
                  {app.student.firstName} {app.student.lastName}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Gender</p>
                <p className="text-sm font-medium capitalize">{app.student.gender}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Date of Birth</p>
                <p className="text-sm font-medium">{formatDate(app.student.dateOfBirth)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Class Applied</p>
                <p className="text-sm font-medium">{app.class?.displayName || '-'}</p>
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Applied On</p>
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDate(app.createdAt)}
                </p>
              </div>
              {app.source && (
                <div>
                  <p className="text-xs text-muted-foreground">Source</p>
                  <p className="text-sm font-medium capitalize">{app.source}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Contact Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{app.contact.phone}</span>
              </div>
              {app.contact.email && (
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{app.contact.email}</span>
                </div>
              )}
              {app.contact.address && (
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {[
                      app.contact.address.city,
                      app.contact.address.state,
                      app.contact.address.pincode,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </span>
                </div>
              )}
            </div>

            {app.parents && (
              <>
                <Separator />
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground font-medium">Parents / Guardian</p>
                  {app.parents.father && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Father</p>
                        <p className="text-sm font-medium">{app.parents.father.name}</p>
                        {app.parents.father.phone && (
                          <p className="text-xs text-muted-foreground">
                            {app.parents.father.phone}
                          </p>
                        )}
                      </div>
                      {app.parents.father.occupation && (
                        <div>
                          <p className="text-xs text-muted-foreground">Occupation</p>
                          <p className="text-sm">{app.parents.father.occupation}</p>
                        </div>
                      )}
                    </div>
                  )}
                  {app.parents.mother && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Mother</p>
                        <p className="text-sm font-medium">{app.parents.mother.name}</p>
                        {app.parents.mother.phone && (
                          <p className="text-xs text-muted-foreground">
                            {app.parents.mother.phone}
                          </p>
                        )}
                      </div>
                      {app.parents.mother.occupation && (
                        <div>
                          <p className="text-xs text-muted-foreground">Occupation</p>
                          <p className="text-sm">{app.parents.mother.occupation}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Remarks */}
      {app.remarks && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Remarks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{app.remarks}</p>
          </CardContent>
        </Card>
      )}

      {/* Enrollment Dialog */}
      <Dialog open={enrollDialogOpen} onOpenChange={setEnrollDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enroll Student</DialogTitle>
            <DialogDescription>
              Complete enrollment for {app.student.firstName} {app.student.lastName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Section *</Label>
              <Select
                value={enrollForm.sectionId}
                onValueChange={(v) => setEnrollForm({ ...enrollForm, sectionId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select section" />
                </SelectTrigger>
                <SelectContent>
                  {sections.map((s) => (
                    <SelectItem key={s._id} value={s._id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Admission Number (optional)</Label>
              <Input
                value={enrollForm.admissionNumber}
                onChange={(e) => setEnrollForm({ ...enrollForm, admissionNumber: e.target.value })}
                placeholder="Auto-generated if empty"
              />
            </div>
            <div className="space-y-2">
              <Label>Roll Number (optional)</Label>
              <Input
                value={enrollForm.rollNumber}
                onChange={(e) => setEnrollForm({ ...enrollForm, rollNumber: e.target.value })}
                placeholder="Optional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnrollDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEnroll} disabled={updating}>
              {updating && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Enroll
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

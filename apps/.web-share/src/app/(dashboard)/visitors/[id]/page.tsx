'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { visitorApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { getErrorMessage } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
  ArrowLeft,
  LogIn,
  LogOut,
  Ticket,
  ShieldX,
  Loader2,
  User,
  Phone,
  Mail,
  Building2,
  Calendar,
  Clock,
  Car,
  Briefcase,
  CreditCard,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useState } from 'react';

const STATUS_STYLES: Record<string, string> = {
  pre_registered: 'bg-info/10 text-info border-info/20',
  checked_in: 'bg-success/10 text-success border-success/20',
  checked_out: 'bg-muted text-muted-foreground border-muted',
  cancelled: 'bg-destructive/10 text-destructive border-destructive/20',
  no_show: 'bg-warning/10 text-warning border-warning/20',
};

const STATUS_LABELS: Record<string, string> = {
  pre_registered: 'Pre-Registered',
  checked_in: 'Checked In',
  checked_out: 'Checked Out',
  cancelled: 'Cancelled',
  no_show: 'No Show',
};

function formatDateTime(date: string | null) {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function VisitorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const id = params.id as string;
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['visitor', id],
    queryFn: () => visitorApi.getVisitor(id),
  });

  const checkInMutation = useMutation({
    mutationFn: () => visitorApi.checkInVisitor(id),
    onSuccess: () => {
      toast.success('Visitor checked in successfully');
      queryClient.invalidateQueries({ queryKey: ['visitor', id] });
      queryClient.invalidateQueries({ queryKey: ['visitors'] });
      queryClient.invalidateQueries({ queryKey: ['visitor-stats'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const checkOutMutation = useMutation({
    mutationFn: () => visitorApi.checkOutVisitor(id),
    onSuccess: () => {
      toast.success('Visitor checked out successfully');
      queryClient.invalidateQueries({ queryKey: ['visitor', id] });
      queryClient.invalidateQueries({ queryKey: ['visitors'] });
      queryClient.invalidateQueries({ queryKey: ['visitor-stats'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const generatePassMutation = useMutation({
    mutationFn: () => visitorApi.generatePass(id),
    onSuccess: () => {
      toast.success('Visitor pass generated');
      queryClient.invalidateQueries({ queryKey: ['visitor', id] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const revokePassMutation = useMutation({
    mutationFn: () => visitorApi.revokePass(id),
    onSuccess: () => {
      toast.success('Visitor pass revoked');
      queryClient.invalidateQueries({ queryKey: ['visitor', id] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => visitorApi.deleteVisitor(id),
    onSuccess: () => {
      toast.success('Visitor deleted');
      router.push('/visitors');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-96 lg:col-span-2" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  const visitor = data?.data;
  if (!visitor) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-lg">Visitor not found</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/visitors">Back to Visitors</Link>
        </Button>
      </div>
    );
  }

  const hasActivePass =
    visitor.passCode && visitor.passExpiresAt && new Date(visitor.passExpiresAt) > new Date();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/visitors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{visitor.name}</h1>
              <Badge variant="outline" className={STATUS_STYLES[visitor.status] || ''}>
                {STATUS_LABELS[visitor.status] || visitor.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              <span className="font-mono">{visitor.visitorCode}</span>
              {visitor.company && <> &middot; {visitor.company}</>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {visitor.status === 'pre_registered' && hasPermission('visitor.visitors', 'create') && (
            <Button
              onClick={() => checkInMutation.mutate()}
              disabled={checkInMutation.isPending}
              className="bg-success hover:bg-success/90 text-white"
            >
              {checkInMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <LogIn className="h-4 w-4 mr-2" />
              )}
              Check In
            </Button>
          )}
          {visitor.status === 'checked_in' && hasPermission('visitor.visitors', 'create') && (
            <Button
              onClick={() => checkOutMutation.mutate()}
              disabled={checkOutMutation.isPending}
              variant="outline"
              className="border-warning text-warning hover:bg-warning/10"
            >
              {checkOutMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4 mr-2" />
              )}
              Check Out
            </Button>
          )}
          {hasPermission('visitor.visitors', 'delete') && visitor.status !== 'checked_in' && (
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Visitor Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Visitor Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InfoRow icon={User} label="Name" value={visitor.name} />
                <InfoRow icon={Phone} label="Phone" value={visitor.phone} />
                <InfoRow icon={Mail} label="Email" value={visitor.email || '—'} />
                <InfoRow icon={Building2} label="Company" value={visitor.company || '—'} />
                <InfoRow
                  icon={CreditCard}
                  label="ID"
                  value={
                    visitor.idType
                      ? `${visitor.idType.replace(/_/g, ' ')} - ${visitor.idNumber || '—'}`
                      : '—'
                  }
                />
                <InfoRow
                  icon={User}
                  label="Group Size"
                  value={`${visitor.numberOfVisitors} visitor${visitor.numberOfVisitors > 1 ? 's' : ''}`}
                />
              </div>
            </CardContent>
          </Card>

          {/* Visit Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Visit Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InfoRow
                  icon={Briefcase}
                  label="Purpose"
                  value={(visitor.purpose || '').replace(/_/g, ' ')}
                />
                <InfoRow icon={User} label="Host" value={visitor.hostName} />
                <InfoRow
                  icon={Building2}
                  label="Department"
                  value={visitor.hostDepartment || '—'}
                />
                <InfoRow icon={Car} label="Vehicle" value={visitor.vehicleNumber || '—'} />
                {visitor.belongings && (
                  <InfoRow icon={Briefcase} label="Belongings" value={visitor.belongings} />
                )}
                {visitor.remarks && (
                  <InfoRow icon={Briefcase} label="Remarks" value={visitor.remarks} />
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <TimelineItem
                  icon={Calendar}
                  label="Registered"
                  time={formatDateTime(visitor.createdAt)}
                  active
                />
                {visitor.type === 'pre_registered' && visitor.expectedDate && (
                  <TimelineItem
                    icon={Clock}
                    label="Expected"
                    time={`${new Date(visitor.expectedDate).toLocaleDateString('en-IN')}${visitor.expectedTime ? ` at ${visitor.expectedTime}` : ''}`}
                    active={visitor.status === 'pre_registered'}
                  />
                )}
                <TimelineItem
                  icon={LogIn}
                  label="Checked In"
                  time={formatDateTime(visitor.checkInTime)}
                  active={!!visitor.checkInTime}
                />
                <TimelineItem
                  icon={LogOut}
                  label="Checked Out"
                  time={formatDateTime(visitor.checkOutTime)}
                  active={!!visitor.checkOutTime}
                />
              </div>
            </CardContent>
          </Card>

          {/* Pass */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Visitor Pass</CardTitle>
            </CardHeader>
            <CardContent>
              {hasActivePass ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 text-center">
                    <Ticket className="h-8 w-8 mx-auto mb-2 text-primary" />
                    <p className="text-2xl font-mono font-bold tracking-widest text-primary">
                      {visitor.passCode}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Valid until {formatDateTime(visitor.passExpiresAt)}
                    </p>
                  </div>
                  {hasPermission('visitor.passes', 'revoke') && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => revokePassMutation.mutate()}
                      disabled={revokePassMutation.isPending}
                    >
                      {revokePassMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <ShieldX className="h-4 w-4 mr-2" />
                      )}
                      Revoke Pass
                    </Button>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  <Ticket className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm text-muted-foreground mb-3">No active pass</p>
                  {visitor.status === 'checked_in' && hasPermission('visitor.passes', 'create') && (
                    <Button
                      size="sm"
                      onClick={() => generatePassMutation.mutate()}
                      disabled={generatePassMutation.isPending}
                    >
                      {generatePassMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Ticket className="h-4 w-4 mr-2" />
                      )}
                      Generate Pass
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Visitor</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this visitor record? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate()}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium capitalize">{value}</p>
      </div>
    </div>
  );
}

function TimelineItem({
  icon: Icon,
  label,
  time,
  active,
}: {
  icon: React.ElementType;
  label: string;
  time: string;
  active: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`p-1.5 rounded-full ${
          active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
        }`}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1">
        <p className={`text-sm ${active ? 'font-medium' : 'text-muted-foreground'}`}>{label}</p>
        <p className="text-xs text-muted-foreground">{time}</p>
      </div>
    </div>
  );
}

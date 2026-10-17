'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { transportApi, studentApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { getErrorMessage } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, UserPlus, Users, X, Search } from 'lucide-react';
import { toast } from 'sonner';

interface BusStop {
  _id: string;
  name: string;
  fare?: number;
}

interface BusLite {
  _id: string;
  pricing: { mode: 'flat' | 'per_stop'; flatPrice?: number; currency: string; frequency: string };
  stops: BusStop[];
  capacity: number;
  enrolledCount: number;
}

interface Enrollment {
  _id: string;
  studentName: string;
  admissionNumber?: string;
  className?: string;
  sectionName?: string;
  stopId: string;
  stopName?: string;
  priceSnapshot: number;
  currencySnapshot: string;
  frequencySnapshot: string;
  status: 'active' | 'withdrawn' | 'transferred';
  startDate: string;
  endDate?: string;
  withdrawnReason?: string;
}

function formatMoney(amount: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function EnrollmentsPanel({ busId, bus }: { busId: string; bus: BusLite }) {
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [withdrawId, setWithdrawId] = useState<string | null>(null);
  const [withdrawReason, setWithdrawReason] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'all'>('active');

  const { data, isLoading } = useQuery({
    queryKey: ['transport-enrollments', busId, statusFilter],
    queryFn: () =>
      transportApi.getEnrollments({
        busId,
        status: statusFilter === 'all' ? undefined : 'active',
        limit: 100,
      }),
  });

  const enrollments: Enrollment[] = data?.data || [];

  const withdrawMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      transportApi.withdrawEnrollment(id, { reason }),
    onSuccess: () => {
      toast.success('Student withdrawn from bus');
      queryClient.invalidateQueries({ queryKey: ['transport-enrollments', busId] });
      queryClient.invalidateQueries({ queryKey: ['transport-bus', busId] });
      queryClient.invalidateQueries({ queryKey: ['transport-stats'] });
      setWithdrawId(null);
      setWithdrawReason('');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" /> Enrollments ({bus.enrolledCount}/{bus.capacity})
        </CardTitle>
        <div className="flex items-center gap-2">
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as 'active' | 'all')}
          >
            <SelectTrigger className="w-32 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
          {hasPermission('transport.enrollments', 'create') && (
            <Button
              size="sm"
              onClick={() => setEnrollOpen(true)}
              disabled={bus.enrolledCount >= bus.capacity}
            >
              <UserPlus className="h-4 w-4 mr-2" /> Enroll Student
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-6 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : enrollments.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No students enrolled yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                    Student
                  </th>
                  <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                    Class
                  </th>
                  <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                    Stop
                  </th>
                  <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                    Fare
                  </th>
                  <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                    Status
                  </th>
                  <th className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {enrollments.map((e) => (
                  <tr key={e._id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-sm">{e.studentName}</p>
                      {e.admissionNumber && (
                        <p className="text-xs text-muted-foreground font-mono">
                          {e.admissionNumber}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {e.className}
                      {e.sectionName && ` / ${e.sectionName}`}
                    </td>
                    <td className="px-4 py-3 text-sm">{e.stopName}</td>
                    <td className="px-4 py-3 text-sm font-medium">
                      {formatMoney(e.priceSnapshot, e.currencySnapshot)}
                      <span className="text-xs text-muted-foreground font-normal">
                        {' '}
                        /{e.frequencySnapshot.slice(0, 3)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={
                          e.status === 'active'
                            ? 'bg-success/10 text-success border-success/20'
                            : 'bg-muted'
                        }
                      >
                        {e.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {e.status === 'active' &&
                        hasPermission('transport.enrollments', 'withdraw') && (
                          <Button size="sm" variant="ghost" onClick={() => setWithdrawId(e._id)}>
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <EnrollDialog open={enrollOpen} onOpenChange={setEnrollOpen} busId={busId} bus={bus} />

      <Dialog
        open={!!withdrawId}
        onOpenChange={(open) => {
          if (!open) {
            setWithdrawId(null);
            setWithdrawReason('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw student</DialogTitle>
            <DialogDescription>
              This will mark the enrollment as withdrawn and free up the seat.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reason">Reason *</Label>
            <Textarea
              id="reason"
              value={withdrawReason}
              onChange={(e) => setWithdrawReason(e.target.value)}
              placeholder="e.g. Changed route, moved, etc."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setWithdrawId(null);
                setWithdrawReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={!withdrawReason.trim() || withdrawMutation.isPending}
              onClick={() =>
                withdrawId && withdrawMutation.mutate({ id: withdrawId, reason: withdrawReason })
              }
            >
              {withdrawMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Withdraw
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function EnrollDialog({
  open,
  onOpenChange,
  busId,
  bus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busId: string;
  bus: BusLite;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [studentId, setStudentId] = useState('');
  const [stopId, setStopId] = useState('');
  const [pickupEnabled, setPickupEnabled] = useState(true);
  const [dropEnabled, setDropEnabled] = useState(true);

  const { data: studentsData } = useQuery({
    queryKey: ['transport-student-search', search],
    queryFn: () =>
      studentApi.getStudents({ search: search || undefined, limit: 20, status: 'active' }),
    enabled: open,
  });

  const students = studentsData?.data || [];

  const selectedStop = bus.stops.find((s) => s._id === stopId);
  const expectedPrice =
    bus.pricing.mode === 'flat' ? bus.pricing.flatPrice || 0 : selectedStop?.fare || 0;

  const createMutation = useMutation({
    mutationFn: () =>
      transportApi.createEnrollment({
        busId,
        studentId,
        stopId,
        pickupEnabled,
        dropEnabled,
      }),
    onSuccess: () => {
      toast.success('Student enrolled');
      queryClient.invalidateQueries({ queryKey: ['transport-enrollments', busId] });
      queryClient.invalidateQueries({ queryKey: ['transport-bus', busId] });
      queryClient.invalidateQueries({ queryKey: ['transport-stats'] });
      onOpenChange(false);
      setStudentId('');
      setStopId('');
      setSearch('');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Enroll student in transport</DialogTitle>
          <DialogDescription>
            Select a student and assign them to a stop on this route.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Student *</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or admission number"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="max-h-48 overflow-y-auto border rounded-md divide-y">
              {students.length === 0 ? (
                <p className="p-3 text-xs text-muted-foreground text-center">
                  Search and pick a student
                </p>
              ) : (
                students.map(
                  (s: {
                    _id: string;
                    displayName?: string;
                    firstName: string;
                    lastName: string;
                    admissionNumber?: string;
                    className?: string;
                  }) => {
                    const name = s.displayName || `${s.firstName} ${s.lastName}`;
                    const active = studentId === s._id;
                    return (
                      <button
                        type="button"
                        key={s._id}
                        onClick={() => setStudentId(s._id)}
                        className={`w-full text-left p-2 text-sm transition-colors ${
                          active ? 'bg-primary/10' : 'hover:bg-muted/50'
                        }`}
                      >
                        <p className="font-medium">{name}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.admissionNumber} {s.className && `• ${s.className}`}
                        </p>
                      </button>
                    );
                  }
                )
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Pickup / Drop Stop *</Label>
            <Select value={stopId} onValueChange={setStopId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a stop" />
              </SelectTrigger>
              <SelectContent>
                {bus.stops.map((s, idx) => (
                  <SelectItem key={s._id} value={s._id}>
                    {idx + 1}. {s.name}
                    {bus.pricing.mode === 'per_stop' && typeof s.fare === 'number'
                      ? ` — ${formatMoney(s.fare, bus.pricing.currency)}`
                      : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedStop && (
            <div className="rounded-md border p-3 bg-muted/30 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Fare</span>
                <span className="font-semibold">
                  {formatMoney(expectedPrice, bus.pricing.currency)} / {bus.pricing.frequency}
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={pickupEnabled}
                onChange={(e) => setPickupEnabled(e.target.checked)}
                className="rounded border-input"
              />
              Pickup
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={dropEnabled}
                onChange={(e) => setDropEnabled(e.target.checked)}
                className="rounded border-input"
              />
              Drop
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!studentId || !stopId || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Enroll
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

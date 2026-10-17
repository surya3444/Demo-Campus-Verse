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
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DatePicker } from '@/components/ui/date-picker';
import { StudentPicker } from '@/components/common/StudentPicker';
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
  Plus,
  CalendarDays,
  MapPin,
  Users,
  IndianRupee,
  Trophy,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  registration_open: 'bg-blue-100 text-blue-800',
  registration_closed: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-orange-100 text-orange-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  registration_open: 'Registration Open',
  registration_closed: 'Registration Closed',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const roundTypeLabels: Record<string, string> = {
  aptitude: 'Aptitude',
  technical: 'Technical',
  coding: 'Coding',
  gd: 'Group Discussion',
  hr: 'HR',
  final: 'Final',
};

const roundStatusColors: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
};

const offerStatusColors: Record<string, string> = {
  offered: 'bg-blue-100 text-blue-800',
  accepted: 'bg-green-100 text-green-800',
  declined: 'bg-red-100 text-red-800',
};

function formatCTC(ctc?: number): string {
  if (!ctc) return '-';
  if (ctc >= 10000000) return `${(ctc / 10000000).toFixed(2)} Cr`;
  if (ctc >= 100000) return `${(ctc / 100000).toFixed(2)} LPA`;
  if (ctc >= 1000) return `${(ctc / 1000).toFixed(0)}K`;
  return String(ctc);
}

interface Round {
  _id: string;
  roundNumber: number;
  type: string;
  name?: string;
  date?: string;
  venue?: string;
  status: string;
  qualifiedCount?: number;
}

interface Registration {
  _id: string;
  studentId: string;
  studentName: string;
  enrollmentNumber?: string;
  registeredAt: string;
  isEligible: boolean;
}

interface Offer {
  _id: string;
  studentId: string;
  studentName: string;
  role: string;
  ctc: number;
  location?: string;
  offerDate: string;
  status: string;
}

export default function DriveDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const id = params.id as string;
  const canEdit = hasPermission('careerConnect.drives', 'edit');

  const [roundDialogOpen, setRoundDialogOpen] = useState(false);
  const [offerDialogOpen, setOfferDialogOpen] = useState(false);
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false);
  const [roundForm, setRoundForm] = useState({
    roundNumber: 1,
    type: 'aptitude' as string,
    name: '',
    date: '',
    venue: '',
  });
  const [offerForm, setOfferForm] = useState({
    studentId: '',
    role: '',
    ctc: '',
    location: '',
    offerDate: new Date().toISOString().split('T')[0],
  });
  const [registerStudentId, setRegisterStudentId] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['drive', id],
    queryFn: () => careerConnectApi.getDrive(id),
  });

  const { data: registrationsData } = useQuery({
    queryKey: ['drive-registrations', id],
    queryFn: () => careerConnectApi.getDriveRegistrations(id),
    enabled: !!data?.data,
  });

  const { data: offersData } = useQuery({
    queryKey: ['drive-offers', id],
    queryFn: () => careerConnectApi.getDriveOffers(id),
    enabled: !!data?.data,
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => careerConnectApi.updateDriveStatus(id, status),
    onSuccess: () => {
      toast.success('Drive status updated');
      queryClient.invalidateQueries({ queryKey: ['drive', id] });
      queryClient.invalidateQueries({ queryKey: ['drives'] });
    },
    onError: (error: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update status');
    },
  });

  const addRoundMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => careerConnectApi.addDriveRound(id, data),
    onSuccess: () => {
      toast.success('Round added');
      queryClient.invalidateQueries({ queryKey: ['drive', id] });
      setRoundDialogOpen(false);
      setRoundForm({ roundNumber: 1, type: 'aptitude', name: '', date: '', venue: '' });
    },
    onError: (error: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(error.response?.data?.error?.message || 'Failed to add round');
    },
  });

  const registerMutation = useMutation({
    mutationFn: () => careerConnectApi.registerForDrive(id),
    onSuccess: () => {
      toast.success('Registered for drive');
      queryClient.invalidateQueries({ queryKey: ['drive', id] });
      queryClient.invalidateQueries({ queryKey: ['drive-registrations', id] });
      setRegisterDialogOpen(false);
      setRegisterStudentId('');
    },
    onError: (error: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(error.response?.data?.error?.message || 'Failed to register');
    },
  });

  const createOfferMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => careerConnectApi.createOffer(id, data),
    onSuccess: () => {
      toast.success('Offer created');
      queryClient.invalidateQueries({ queryKey: ['drive', id] });
      queryClient.invalidateQueries({ queryKey: ['drive-offers', id] });
      setOfferDialogOpen(false);
      setOfferForm({
        studentId: '',
        role: '',
        ctc: '',
        location: '',
        offerDate: new Date().toISOString().split('T')[0],
      });
    },
    onError: (error: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create offer');
    },
  });

  const respondOfferMutation = useMutation({
    mutationFn: ({ offerId, status }: { offerId: string; status: string }) =>
      careerConnectApi.respondToOffer(offerId, { status }),
    onSuccess: () => {
      toast.success('Offer response recorded');
      queryClient.invalidateQueries({ queryKey: ['drive-offers', id] });
    },
    onError: () => toast.error('Failed to respond to offer'),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const drive = data?.data;

  if (!drive) {
    return (
      <div className="text-center py-12">
        <Briefcase className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-medium">Drive not found</h3>
      </div>
    );
  }

  const rounds: Round[] = drive.rounds || [];
  const registrations: Registration[] = registrationsData?.data || [];
  const offers: Offer[] = offersData?.data || [];
  const stats = drive.stats || {};

  const statusActions: Record<string, { label: string; next: string }[]> = {
    draft: [{ label: 'Open Registration', next: 'registration_open' }],
    registration_open: [{ label: 'Close Registration', next: 'registration_closed' }],
    registration_closed: [{ label: 'Start Drive', next: 'in_progress' }],
    in_progress: [{ label: 'Complete', next: 'completed' }],
  };

  const availableActions = statusActions[drive.status] || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="font-mono">
                {drive.driveNumber}
              </Badge>
              <h1 className="text-2xl font-bold tracking-tight">{drive.title}</h1>
              <Badge variant="secondary" className={statusColors[drive.status] || ''}>
                {statusLabels[drive.status] || drive.status}
              </Badge>
            </div>
            <p className="text-muted-foreground">{drive.companyName}</p>
          </div>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            {availableActions.map((action) => (
              <Button
                key={action.next}
                variant="outline"
                size="sm"
                onClick={() => statusMutation.mutate(action.next)}
                disabled={statusMutation.isPending}
              >
                {action.label}
              </Button>
            ))}
            {drive.status !== 'cancelled' && drive.status !== 'completed' && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive"
                onClick={() => statusMutation.mutate('cancelled')}
                disabled={statusMutation.isPending}
              >
                Cancel Drive
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="rounds">Rounds ({rounds.length})</TabsTrigger>
          <TabsTrigger value="registrations">Registrations ({registrations.length})</TabsTrigger>
          <TabsTrigger value="offers">Offers ({offers.length})</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-4 space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Drive Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Type</span>
                  <Badge variant="outline" className="capitalize">
                    {drive.type?.replace(/_/g, ' ')}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Registration Deadline</span>
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {drive.registrationDeadline
                      ? new Date(drive.registrationDeadline).toLocaleDateString()
                      : '-'}
                  </span>
                </div>
                {drive.eligibility?.minCGPA && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Min CGPA</span>
                    <span>{drive.eligibility.minCGPA}</span>
                  </div>
                )}
                {drive.eligibility?.maxBacklogs !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Max Backlogs</span>
                    <span>{drive.eligibility.maxBacklogs}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Job Profile
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Role</span>
                  <span className="font-medium">{drive.jobProfile?.role || '-'}</span>
                </div>
                {drive.jobProfile?.ctc && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">CTC</span>
                    <span className="flex items-center gap-0.5 font-medium">
                      <IndianRupee className="h-3 w-3" />
                      {formatCTC(drive.jobProfile.ctc)}
                    </span>
                  </div>
                )}
                {drive.jobProfile?.location && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Location</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {drive.jobProfile.location}
                    </span>
                  </div>
                )}
                {drive.jobProfile?.jobType && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Type</span>
                    <span className="capitalize">{drive.jobProfile.jobType}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Statistics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Users className="h-3 w-3" /> Registered
                  </span>
                  <span className="font-medium">
                    {stats.totalRegistered ?? registrations.length}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <CheckCircle2 className="h-3 w-3" /> Eligible
                  </span>
                  <span className="font-medium">{stats.totalEligible ?? '-'}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Trophy className="h-3 w-3" /> Placed
                  </span>
                  <span className="font-medium">{stats.totalPlaced ?? '-'}</span>
                </div>
                {stats.highestCTC && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <TrendingUp className="h-3 w-3" /> Highest CTC
                    </span>
                    <span className="font-medium">{formatCTC(stats.highestCTC)}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {drive.jobProfile?.description && (
            <Card>
              <CardHeader>
                <CardTitle>Job Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{drive.jobProfile.description}</p>
              </CardContent>
            </Card>
          )}

          {drive.jobProfile?.ctcBreakdown && (
            <Card>
              <CardHeader>
                <CardTitle>CTC Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-5">
                  {drive.jobProfile.ctcBreakdown.baseSalary && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Base Salary</span>
                      <p className="font-medium">
                        {formatCTC(drive.jobProfile.ctcBreakdown.baseSalary)}
                      </p>
                    </div>
                  )}
                  {drive.jobProfile.ctcBreakdown.hra && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">HRA</span>
                      <p className="font-medium">{formatCTC(drive.jobProfile.ctcBreakdown.hra)}</p>
                    </div>
                  )}
                  {drive.jobProfile.ctcBreakdown.specialAllowance && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Special Allowance</span>
                      <p className="font-medium">
                        {formatCTC(drive.jobProfile.ctcBreakdown.specialAllowance)}
                      </p>
                    </div>
                  )}
                  {drive.jobProfile.ctcBreakdown.bonus && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Bonus</span>
                      <p className="font-medium">
                        {formatCTC(drive.jobProfile.ctcBreakdown.bonus)}
                      </p>
                    </div>
                  )}
                  {drive.jobProfile.ctcBreakdown.other && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Other</span>
                      <p className="font-medium">
                        {formatCTC(drive.jobProfile.ctcBreakdown.other)}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Rounds Tab */}
        <TabsContent value="rounds" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Selection Rounds</CardTitle>
              {canEdit && (
                <Dialog open={roundDialogOpen} onOpenChange={setRoundDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Round
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Selection Round</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid gap-4 grid-cols-2">
                        <div className="space-y-2">
                          <Label>Round Number *</Label>
                          <Input
                            type="number"
                            min={1}
                            value={roundForm.roundNumber}
                            onChange={(e) =>
                              setRoundForm({
                                ...roundForm,
                                roundNumber: parseInt(e.target.value) || 1,
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Type *</Label>
                          <Select
                            value={roundForm.type}
                            onValueChange={(val) => setRoundForm({ ...roundForm, type: val })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="aptitude">Aptitude</SelectItem>
                              <SelectItem value="technical">Technical</SelectItem>
                              <SelectItem value="coding">Coding</SelectItem>
                              <SelectItem value="gd">Group Discussion</SelectItem>
                              <SelectItem value="hr">HR</SelectItem>
                              <SelectItem value="final">Final</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Name</Label>
                        <Input
                          value={roundForm.name}
                          onChange={(e) => setRoundForm({ ...roundForm, name: e.target.value })}
                          placeholder="e.g. Online Aptitude Test"
                        />
                      </div>
                      <div className="grid gap-4 grid-cols-2">
                        <div className="space-y-2">
                          <Label>Date</Label>
                          <DatePicker
                            value={roundForm.date}
                            onChange={(iso) => setRoundForm({ ...roundForm, date: iso })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Venue</Label>
                          <Input
                            value={roundForm.venue}
                            onChange={(e) => setRoundForm({ ...roundForm, venue: e.target.value })}
                            placeholder="e.g. Auditorium Hall"
                          />
                        </div>
                      </div>
                      <Button
                        className="w-full"
                        onClick={() => {
                          const payload: Record<string, unknown> = {
                            roundNumber: roundForm.roundNumber,
                            type: roundForm.type,
                          };
                          if (roundForm.name) payload.name = roundForm.name;
                          if (roundForm.date) payload.date = roundForm.date;
                          if (roundForm.venue) payload.venue = roundForm.venue;
                          addRoundMutation.mutate(payload);
                        }}
                        disabled={addRoundMutation.isPending}
                      >
                        {addRoundMutation.isPending ? 'Adding...' : 'Add Round'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              {rounds.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="mx-auto h-10 w-10 text-muted-foreground/50" />
                  <p className="mt-2 text-muted-foreground">No rounds added yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Round</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Venue</TableHead>
                      <TableHead>Qualified</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rounds
                      .sort((a, b) => a.roundNumber - b.roundNumber)
                      .map((round) => (
                        <TableRow key={round._id}>
                          <TableCell className="font-medium">Round {round.roundNumber}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {roundTypeLabels[round.type] || round.type}
                            </Badge>
                          </TableCell>
                          <TableCell>{round.name || '-'}</TableCell>
                          <TableCell>
                            {round.date ? new Date(round.date).toLocaleDateString() : '-'}
                          </TableCell>
                          <TableCell>{round.venue || '-'}</TableCell>
                          <TableCell>{round.qualifiedCount ?? '-'}</TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={roundStatusColors[round.status] || ''}
                            >
                              {round.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Registrations Tab */}
        <TabsContent value="registrations" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Registered Students</CardTitle>
              {canEdit && (
                <Dialog open={registerDialogOpen} onOpenChange={setRegisterDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Register Student
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Register Student for Drive</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Student *</Label>
                        <StudentPicker
                          value={registerStudentId}
                          onChange={(id) => setRegisterStudentId(id || '')}
                        />
                      </div>
                      <Button
                        className="w-full"
                        onClick={() => registerMutation.mutate()}
                        disabled={!registerStudentId || registerMutation.isPending}
                      >
                        {registerMutation.isPending ? 'Registering...' : 'Register'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              {registrations.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="mx-auto h-10 w-10 text-muted-foreground/50" />
                  <p className="mt-2 text-muted-foreground">No registrations yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student Name</TableHead>
                      <TableHead>Enrollment No.</TableHead>
                      <TableHead>Registered At</TableHead>
                      <TableHead>Eligible</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {registrations.map((reg) => (
                      <TableRow key={reg._id}>
                        <TableCell className="font-medium">{reg.studentName}</TableCell>
                        <TableCell>{reg.enrollmentNumber || reg.studentId}</TableCell>
                        <TableCell>{new Date(reg.registeredAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          {reg.isEligible ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
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

        {/* Offers Tab */}
        <TabsContent value="offers" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Placement Offers</CardTitle>
              {canEdit && (
                <Dialog open={offerDialogOpen} onOpenChange={setOfferDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Offer
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Placement Offer</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Student *</Label>
                        <StudentPicker
                          value={offerForm.studentId}
                          onChange={(id) => setOfferForm({ ...offerForm, studentId: id || '' })}
                        />
                      </div>
                      <div className="grid gap-4 grid-cols-2">
                        <div className="space-y-2">
                          <Label>Role *</Label>
                          <Input
                            value={offerForm.role}
                            onChange={(e) => setOfferForm({ ...offerForm, role: e.target.value })}
                            placeholder="e.g. Software Engineer"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>CTC (INR) *</Label>
                          <Input
                            type="number"
                            value={offerForm.ctc}
                            onChange={(e) => setOfferForm({ ...offerForm, ctc: e.target.value })}
                            placeholder="e.g. 600000"
                          />
                        </div>
                      </div>
                      <div className="grid gap-4 grid-cols-2">
                        <div className="space-y-2">
                          <Label>Location</Label>
                          <Input
                            value={offerForm.location}
                            onChange={(e) =>
                              setOfferForm({ ...offerForm, location: e.target.value })
                            }
                            placeholder="e.g. Bangalore"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Offer Date *</Label>
                          <DatePicker
                            value={offerForm.offerDate}
                            onChange={(iso) => setOfferForm({ ...offerForm, offerDate: iso })}
                          />
                        </div>
                      </div>
                      <Button
                        className="w-full"
                        onClick={() => {
                          createOfferMutation.mutate({
                            studentId: offerForm.studentId,
                            driveId: id,
                            role: offerForm.role,
                            ctc: Number(offerForm.ctc),
                            location: offerForm.location || undefined,
                            offerDate: offerForm.offerDate,
                          });
                        }}
                        disabled={
                          !offerForm.studentId ||
                          !offerForm.role ||
                          !offerForm.ctc ||
                          !offerForm.offerDate ||
                          createOfferMutation.isPending
                        }
                      >
                        {createOfferMutation.isPending ? 'Creating...' : 'Create Offer'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              {offers.length === 0 ? (
                <div className="text-center py-8">
                  <Trophy className="mx-auto h-10 w-10 text-muted-foreground/50" />
                  <p className="mt-2 text-muted-foreground">No offers yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>CTC</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Offer Date</TableHead>
                      <TableHead>Status</TableHead>
                      {canEdit && <TableHead className="w-[120px]" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {offers.map((offer) => (
                      <TableRow key={offer._id}>
                        <TableCell className="font-medium">{offer.studentName}</TableCell>
                        <TableCell>{offer.role}</TableCell>
                        <TableCell>
                          <span className="flex items-center gap-0.5">
                            <IndianRupee className="h-3 w-3" />
                            {formatCTC(offer.ctc)}
                          </span>
                        </TableCell>
                        <TableCell>{offer.location || '-'}</TableCell>
                        <TableCell>{new Date(offer.offerDate).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={offerStatusColors[offer.status] || ''}
                          >
                            {offer.status}
                          </Badge>
                        </TableCell>
                        {canEdit && (
                          <TableCell>
                            {offer.status === 'offered' && (
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-green-600 h-7 px-2"
                                  onClick={() =>
                                    respondOfferMutation.mutate({
                                      offerId: offer._id,
                                      status: 'accepted',
                                    })
                                  }
                                >
                                  Accept
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600 h-7 px-2"
                                  onClick={() =>
                                    respondOfferMutation.mutate({
                                      offerId: offer._id,
                                      status: 'declined',
                                    })
                                  }
                                >
                                  Decline
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

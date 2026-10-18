'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { careerConnectApi } from '@/lib/api';
import {
  Cell,
  CompanyLogo,
  KeyValue,
  Meter,
  PageTitle,
  Panel,
  PersonCell,
  Stat,
  StatusPill,
  Table as ConnectTable,
  fmtDate,
  lpa,
  type Person,
} from '@/components/connect/kit';
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
import { Briefcase, Plus, Users, Trophy, TrendingUp, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';

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

interface Round {
  _id: string;
  roundNumber: number;
  type: string;
  name?: string;
  date?: string;
  venue?: string;
  status: string;
  qualifiedCount?: number;
  qualifiedStudentIds?: string[];
}

interface Registration {
  _id?: string;
  studentId: string;
  studentName: string;
  person?: Person | null;
  roundsCleared?: number;
  roundsTotal?: number;
  lastRound?: string | null;
  offer?: { status: string; ctc: number; role: string } | null;
  enrollmentNumber?: string;
  registeredAt: string;
  isEligible: boolean;
}

interface Offer {
  _id: string;
  studentId: string;
  studentName?: string;
  person?: Person | null;
  role: string;
  ctc: number;
  location?: string;
  offerDate: string;
  status: string;
}

export default function DriveDetailPage() {
  const params = useParams();
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
    mutationFn: () => careerConnectApi.registerForDrive(id, registerStudentId),
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

  const statusActions: Record<string, { label: string; next: string }[]> = {
    draft: [{ label: 'Open Registration', next: 'registration_open' }],
    registration_open: [{ label: 'Close Registration', next: 'registration_closed' }],
    registration_closed: [{ label: 'Start Drive', next: 'in_progress' }],
    in_progress: [{ label: 'Complete', next: 'completed' }],
  };

  const availableActions = statusActions[drive.status] || [];

  const STAGES = ['draft', 'registration_open', 'registration_closed', 'in_progress', 'completed'];
  const stageIdx = STAGES.indexOf(drive.status);
  const STAGE_LABEL = ['Draft', 'Registration', 'Shortlisting', 'Interviews', 'Completed'];
  const accepted = offers.filter((o) => o.status === 'accepted');
  const acceptedCtcs = accepted.map((o) => o.ctc).filter(Boolean);
  const sortedRounds = [...rounds].sort((a, b) => a.roundNumber - b.roundNumber);
  const funnel = [
    { label: 'Registered', count: registrations.length },
    ...sortedRounds.map((r) => ({
      label: r.name || r.type,
      count: r.qualifiedStudentIds?.length ?? 0,
      pending: r.status !== 'completed',
    })),
    { label: 'Offers', count: offers.length },
    { label: 'Accepted', count: accepted.length },
  ];
  const top = Math.max(1, funnel[0].count);

  return (
    <div className="space-y-6">
      <PageTitle
        crumbs={[
          { label: 'Placement drives', href: '/career-connect/drives' },
          { label: drive.driveNumber },
        ]}
        title={
          <span className="flex items-center gap-3">
            <CompanyLogo name={drive.companyName} website={drive.companyWebsite} size={44} />
            <span>
              {drive.companyName} · {drive.jobProfile?.role}
            </span>
          </span>
        }
        description={[
          lpa(drive.jobProfile?.ctc ?? 0),
          drive.jobProfile?.location,
          drive.type?.replace(/_/g, ' '),
          `Registration closes ${fmtDate(drive.registrationDeadline)}`,
        ]
          .filter(Boolean)
          .join(' · ')}
        actions={
          canEdit ? (
            <>
              {drive.status !== 'cancelled' && drive.status !== 'completed' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-rose-600"
                  onClick={() => statusMutation.mutate('cancelled')}
                  disabled={statusMutation.isPending}
                >
                  Cancel drive
                </Button>
              )}
              {availableActions.map((action) => (
                <Button
                  key={action.next}
                  size="sm"
                  onClick={() => statusMutation.mutate(action.next)}
                  disabled={statusMutation.isPending}
                >
                  {action.label}
                </Button>
              ))}
            </>
          ) : null
        }
      />

      {drive.status === 'cancelled' ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          This drive was cancelled.
        </div>
      ) : (
        <ol className="grid grid-cols-5 gap-2">
          {STAGE_LABEL.map((label, i) => (
            <li key={label}>
              <div className={`h-1.5 rounded-full ${i <= stageIdx ? 'bg-primary' : 'bg-muted'}`} />
              <p
                className={`mt-2 text-xs font-medium ${i === stageIdx ? 'text-foreground' : 'text-muted-foreground'}`}
              >
                {label}
              </p>
            </li>
          ))}
        </ol>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Registered" value={registrations.length} icon={Users} />
        <Stat
          label="Offers made"
          value={offers.length}
          icon={Trophy}
          hint={`${accepted.length} accepted`}
        />
        <Stat
          label="Highest offer"
          value={acceptedCtcs.length ? Math.max(...acceptedCtcs) : (drive.jobProfile?.ctc ?? 0)}
          format={lpa}
          icon={TrendingUp}
        />
        <Stat
          label="Conversion"
          value={
            registrations.length ? Math.round((accepted.length / registrations.length) * 100) : 0
          }
          format={(n) => `${Math.round(n)}%`}
          icon={CheckCircle2}
          hint="Registered → accepted"
        />
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="rounds">Rounds ({rounds.length})</TabsTrigger>
          <TabsTrigger value="registrations">Students ({registrations.length})</TabsTrigger>
          <TabsTrigger value="offers">Offers ({offers.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Panel
              title="Selection funnel"
              description="How many students made it through each step"
            >
              <ul className="space-y-3">
                {funnel.map((f) => (
                  <li
                    key={f.label}
                    className="grid grid-cols-[150px_minmax(0,1fr)_56px] items-center gap-3 text-sm"
                  >
                    <span className="truncate capitalize text-muted-foreground">{f.label}</span>
                    <Meter value={(f.count / top) * 100} color="hsl(var(--primary))" />
                    <span className="text-right font-medium tabular-nums">
                      {'pending' in f && f.pending ? '—' : f.count}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel title="Role">
              <KeyValue
                cols={1}
                items={[
                  ['Role', drive.jobProfile?.role ?? '—'],
                  ['Package', lpa(drive.jobProfile?.ctc ?? 0)],
                  ['Location', drive.jobProfile?.location ?? '—'],
                  [
                    'Employment',
                    drive.jobProfile?.jobType === 'internship' ? 'Internship' : 'Full-time',
                  ],
                  [
                    'Eligibility',
                    [
                      drive.eligibility?.minCGPA ? `CGPA ${drive.eligibility.minCGPA}+` : null,
                      drive.eligibility?.maxBacklogs !== undefined
                        ? `≤ ${drive.eligibility.maxBacklogs} backlogs`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Open to all final-year students',
                  ],
                ]}
              />
              {drive.jobProfile?.description && (
                <p className="mt-4 border-t border-border/70 pt-4 text-sm leading-relaxed text-muted-foreground">
                  {drive.jobProfile.description}
                </p>
              )}
            </Panel>
          </div>
        </TabsContent>

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
                <div className="-mx-6 -mb-6 border-t border-border/70">
                  <ConnectTable head={['Student', 'CGPA', 'Progress', 'Result']}>
                    {registrations.map((reg) => (
                      <tr key={reg.studentId} className="transition-colors hover:bg-muted/40">
                        <Cell>
                          <PersonCell
                            person={reg.person ?? { name: reg.studentName }}
                            href={`/career-connect/student-profile/${reg.studentId}`}
                          />
                        </Cell>
                        <Cell className="tabular-nums">{reg.person?.cgpa ?? '—'}</Cell>
                        <Cell>
                          <span className="text-sm">
                            {reg.roundsTotal
                              ? `${reg.roundsCleared ?? 0} of ${reg.roundsTotal} rounds`
                              : 'Registered'}
                          </span>
                          {reg.lastRound && (
                            <span className="block text-xs text-muted-foreground">
                              Cleared {reg.lastRound}
                            </span>
                          )}
                        </Cell>
                        <Cell last>
                          {reg.offer ? (
                            <StatusPill status={reg.offer.status} />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </Cell>
                      </tr>
                    ))}
                  </ConnectTable>
                </div>
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
                <div className="-mx-6 -mb-6 border-t border-border/70">
                  <ConnectTable
                    head={[
                      'Student',
                      'Role',
                      'Package',
                      'Offered',
                      'Status',
                      canEdit ? 'Response' : '',
                    ]}
                  >
                    {offers.map((offer) => (
                      <tr key={offer._id} className="transition-colors hover:bg-muted/40">
                        <Cell>
                          <PersonCell
                            person={offer.person ?? { name: offer.studentName ?? 'Student' }}
                            href={`/career-connect/student-profile/${offer.studentId}`}
                          />
                        </Cell>
                        <Cell>{offer.role}</Cell>
                        <Cell className="font-medium tabular-nums">{lpa(offer.ctc)}</Cell>
                        <Cell className="text-muted-foreground">{fmtDate(offer.offerDate)}</Cell>
                        <Cell>
                          <StatusPill status={offer.status} />
                        </Cell>
                        <Cell last>
                          {canEdit && offer.status === 'offered' ? (
                            <span className="flex justify-end gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7"
                                onClick={() =>
                                  respondOfferMutation.mutate({
                                    offerId: offer._id,
                                    status: 'accepted',
                                  })
                                }
                              >
                                Accepted
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-muted-foreground"
                                onClick={() =>
                                  respondOfferMutation.mutate({
                                    offerId: offer._id,
                                    status: 'declined',
                                  })
                                }
                              >
                                Declined
                              </Button>
                            </span>
                          ) : null}
                        </Cell>
                      </tr>
                    ))}
                  </ConnectTable>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateAlumniProfileSchema } from '@campus-verse/shared/schemas';
import { careerConnectApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Plus,
  Trash2,
  Briefcase,
  BookOpen,
  Users,
  Shield,
  GraduationCap,
  CheckCircle2,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';
import type { z } from 'zod';

type ProfileForm = z.infer<typeof updateAlumniProfileSchema>;

interface CareerHistoryEntry {
  company: string;
  role: string;
  startDate: string;
  endDate?: string;
  isCurrent: boolean;
}

interface HigherEducationEntry {
  institution: string;
  degree: string;
  field: string;
  startYear: number;
  endYear?: number;
}

interface AlumniProfile {
  _id: string;
  studentName: string;
  graduationYear: number | null;
  currentCompany?: string;
  currentRole?: string;
  location?: string;
  linkedInUrl?: string;
  linkedinUrl?: string;
  email?: string;
  phone?: string;
  bio?: string;
  isVerified: boolean;
  careerHistory?: CareerHistoryEntry[];
  higherEducation?: HigherEducationEntry[];
  mentorshipInfo?: {
    willingToMentor: boolean;
    expertise: string[];
    maxMentees?: number;
  };
  willingToReferStudents?: boolean;
  privacySettings?: {
    showEmail: boolean;
    showPhone: boolean;
    showCompany: boolean;
  };
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).toISOString().split('T')[0];
}

export default function MyAlumniProfilePage() {
  const queryClient = useQueryClient();
  const [addCareerOpen, setAddCareerOpen] = useState(false);
  const [addEduOpen, setAddEduOpen] = useState(false);
  const [expertiseInput, setExpertiseInput] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['my-alumni-profile'],
    queryFn: () => careerConnectApi.getMyAlumniProfile(),
  });

  const profile: AlumniProfile | null = data?.data || null;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProfileForm>({
    resolver: zodResolver(updateAlumniProfileSchema),
  });

  const updateMutation = useMutation({
    mutationFn: (formData: Record<string, unknown>) =>
      careerConnectApi.updateAlumniProfile(profile!._id, formData),
    onSuccess: () => {
      toast.success('Profile updated successfully');
      queryClient.invalidateQueries({ queryKey: ['my-alumni-profile'] });
    },
    onError: () => {
      toast.error('Failed to update profile');
    },
  });

  // Career History form state
  const [careerCompany, setCareerCompany] = useState('');
  const [careerRole, setCareerRole] = useState('');
  const [careerStart, setCareerStart] = useState('');
  const [careerEnd, setCareerEnd] = useState('');
  const [careerIsCurrent, setCareerIsCurrent] = useState(false);

  // Education form state
  const [eduInstitution, setEduInstitution] = useState('');
  const [eduDegree, setEduDegree] = useState('');
  const [eduField, setEduField] = useState('');
  const [eduStartYear, setEduStartYear] = useState('');
  const [eduEndYear, setEduEndYear] = useState('');

  const onSaveBasicInfo = (formData: ProfileForm) => {
    updateMutation.mutate(formData as unknown as Record<string, unknown>);
  };

  const handleAddCareerEntry = () => {
    if (!careerCompany || !careerRole || !careerStart) {
      toast.error('Company, role, and start date are required');
      return;
    }
    const existing = profile?.careerHistory || [];
    const newEntry = {
      company: careerCompany,
      role: careerRole,
      startDate: careerStart,
      endDate: careerEnd || undefined,
      isCurrent: careerIsCurrent,
    };
    updateMutation.mutate({
      careerHistory: [...existing, newEntry],
    });
    setCareerCompany('');
    setCareerRole('');
    setCareerStart('');
    setCareerEnd('');
    setCareerIsCurrent(false);
    setAddCareerOpen(false);
  };

  const handleRemoveCareerEntry = (index: number) => {
    const existing = profile?.careerHistory || [];
    updateMutation.mutate({
      careerHistory: existing.filter((_, i) => i !== index),
    });
  };

  const handleAddEduEntry = () => {
    if (!eduInstitution || !eduDegree || !eduField || !eduStartYear) {
      toast.error('Institution, degree, field, and start year are required');
      return;
    }
    const existing = profile?.higherEducation || [];
    const newEntry = {
      institution: eduInstitution,
      degree: eduDegree,
      field: eduField,
      startYear: Number(eduStartYear),
      endYear: eduEndYear ? Number(eduEndYear) : undefined,
    };
    updateMutation.mutate({
      higherEducation: [...existing, newEntry],
    });
    setEduInstitution('');
    setEduDegree('');
    setEduField('');
    setEduStartYear('');
    setEduEndYear('');
    setAddEduOpen(false);
  };

  const handleRemoveEduEntry = (index: number) => {
    const existing = profile?.higherEducation || [];
    updateMutation.mutate({
      higherEducation: existing.filter((_, i) => i !== index),
    });
  };

  const handleSaveMentorship = () => {
    const expertise = expertiseInput
      ? expertiseInput
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : profile?.mentorshipInfo?.expertise || [];

    updateMutation.mutate({
      mentorshipInfo: {
        willingToMentor:
          watch('mentorshipInfo.willingToMentor') ??
          profile?.mentorshipInfo?.willingToMentor ??
          false,
        expertise,
        maxMentees: watch('mentorshipInfo.maxMentees') ?? profile?.mentorshipInfo?.maxMentees,
      },
    });
  };

  const handleSavePrivacy = () => {
    updateMutation.mutate({
      privacySettings: {
        showEmail:
          watch('privacySettings.showEmail') ?? profile?.privacySettings?.showEmail ?? true,
        showPhone:
          watch('privacySettings.showPhone') ?? profile?.privacySettings?.showPhone ?? false,
        showCompany:
          watch('privacySettings.showCompany') ?? profile?.privacySettings?.showCompany ?? true,
      },
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <GraduationCap className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">Profile Not Available</h3>
          <p className="text-muted-foreground">
            Your alumni profile could not be loaded. Please try again later.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Alumni Profile</h1>
          <p className="text-muted-foreground">Manage your alumni information and settings</p>
        </div>
        <div className="flex items-center gap-2">
          {profile.isVerified ? (
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Verified
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
              Pending Verification
            </Badge>
          )}
        </div>
      </div>

      <Tabs defaultValue="basic">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="basic" className="gap-1">
            <GraduationCap className="h-4 w-4" />
            Basic Info
          </TabsTrigger>
          <TabsTrigger value="career" className="gap-1">
            <Briefcase className="h-4 w-4" />
            Career History
          </TabsTrigger>
          <TabsTrigger value="education" className="gap-1">
            <BookOpen className="h-4 w-4" />
            Higher Education
          </TabsTrigger>
          <TabsTrigger value="mentorship" className="gap-1">
            <Users className="h-4 w-4" />
            Mentorship
          </TabsTrigger>
          <TabsTrigger value="privacy" className="gap-1">
            <Shield className="h-4 w-4" />
            Privacy
          </TabsTrigger>
        </TabsList>

        {/* Basic Info Tab */}
        <TabsContent value="basic">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSaveBasicInfo)} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="currentCompany">Current Company</Label>
                    <Input
                      id="currentCompany"
                      {...register('currentCompany')}
                      defaultValue={profile.currentCompany || ''}
                      placeholder="e.g. Google"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currentRole">Current Role</Label>
                    <Input
                      id="currentRole"
                      {...register('currentRole')}
                      defaultValue={profile.currentRole || ''}
                      placeholder="e.g. Senior Software Engineer"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      {...register('location')}
                      defaultValue={profile.location || ''}
                      placeholder="e.g. Bangalore, India"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="linkedInUrl">LinkedIn URL</Label>
                    <Input
                      id="linkedInUrl"
                      {...register('linkedInUrl')}
                      defaultValue={profile.linkedInUrl || profile.linkedinUrl || ''}
                      placeholder="https://linkedin.com/in/..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      {...register('email')}
                      defaultValue={profile.email || ''}
                      placeholder="your@email.com"
                    />
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      {...register('phone')}
                      defaultValue={profile.phone || ''}
                      placeholder="+91 9876543210"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={
                      watch('willingToReferStudents') ?? profile.willingToReferStudents ?? false
                    }
                    onCheckedChange={(checked) => setValue('willingToReferStudents', checked)}
                  />
                  <Label>Willing to refer students for jobs</Label>
                </div>

                <div className="flex justify-end">
                  <Button type="submit" disabled={updateMutation.isPending}>
                    <Save className="mr-2 h-4 w-4" />
                    {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Career History Tab */}
        <TabsContent value="career">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Career History</CardTitle>
              <Button size="sm" onClick={() => setAddCareerOpen(true)}>
                <Plus className="mr-1 h-4 w-4" />
                Add Position
              </Button>
            </CardHeader>
            <CardContent>
              {!profile.careerHistory || profile.careerHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No career history added yet. Add your work experience.
                </p>
              ) : (
                <div className="space-y-4">
                  {profile.careerHistory.map((entry, index) => (
                    <div
                      key={index}
                      className="flex items-start justify-between border rounded-lg p-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{entry.role}</h4>
                          {entry.isCurrent && (
                            <Badge className="text-xs bg-green-100 text-green-800">Current</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{entry.company}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(entry.startDate) || '-'} -{' '}
                          {entry.isCurrent ? 'Present' : formatDate(entry.endDate) || '-'}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => handleRemoveCareerEntry(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Higher Education Tab */}
        <TabsContent value="education">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Higher Education</CardTitle>
              <Button size="sm" onClick={() => setAddEduOpen(true)}>
                <Plus className="mr-1 h-4 w-4" />
                Add Education
              </Button>
            </CardHeader>
            <CardContent>
              {!profile.higherEducation || profile.higherEducation.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No higher education records added yet.
                </p>
              ) : (
                <div className="space-y-4">
                  {profile.higherEducation.map((entry, index) => (
                    <div
                      key={index}
                      className="flex items-start justify-between border rounded-lg p-4"
                    >
                      <div className="space-y-1">
                        <h4 className="font-medium">
                          {entry.degree} in {entry.field}
                        </h4>
                        <p className="text-sm text-muted-foreground">{entry.institution}</p>
                        <p className="text-xs text-muted-foreground">
                          {entry.startYear} - {entry.endYear || 'Present'}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => handleRemoveEduEntry(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Mentorship Tab */}
        <TabsContent value="mentorship">
          <Card>
            <CardHeader>
              <CardTitle>Mentorship Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Willing to Mentor</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable this to appear as a mentor in the directory
                  </p>
                </div>
                <Switch
                  checked={
                    watch('mentorshipInfo.willingToMentor') ??
                    profile.mentorshipInfo?.willingToMentor ??
                    false
                  }
                  onCheckedChange={(checked) => setValue('mentorshipInfo.willingToMentor', checked)}
                />
              </div>

              <div className="space-y-2">
                <Label>Areas of Expertise (comma-separated)</Label>
                <Input
                  value={expertiseInput || profile.mentorshipInfo?.expertise?.join(', ') || ''}
                  onChange={(e) => setExpertiseInput(e.target.value)}
                  placeholder="e.g. Software Engineering, Data Science, Product Management"
                />
              </div>

              <div className="space-y-2">
                <Label>Max Mentees</Label>
                <Input
                  type="number"
                  {...register('mentorshipInfo.maxMentees', { valueAsNumber: true })}
                  defaultValue={profile.mentorshipInfo?.maxMentees || ''}
                  placeholder="e.g. 3"
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveMentorship} disabled={updateMutation.isPending}>
                  <Save className="mr-2 h-4 w-4" />
                  {updateMutation.isPending ? 'Saving...' : 'Save Mentorship Settings'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Privacy Tab */}
        <TabsContent value="privacy">
          <Card>
            <CardHeader>
              <CardTitle>Privacy Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Show Email</Label>
                  <p className="text-sm text-muted-foreground">
                    Make your email visible to other users
                  </p>
                </div>
                <Switch
                  checked={
                    watch('privacySettings.showEmail') ?? profile.privacySettings?.showEmail ?? true
                  }
                  onCheckedChange={(checked) => setValue('privacySettings.showEmail', checked)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Show Phone</Label>
                  <p className="text-sm text-muted-foreground">
                    Make your phone number visible to other users
                  </p>
                </div>
                <Switch
                  checked={
                    watch('privacySettings.showPhone') ??
                    profile.privacySettings?.showPhone ??
                    false
                  }
                  onCheckedChange={(checked) => setValue('privacySettings.showPhone', checked)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Show Company</Label>
                  <p className="text-sm text-muted-foreground">
                    Make your current company visible to other users
                  </p>
                </div>
                <Switch
                  checked={
                    watch('privacySettings.showCompany') ??
                    profile.privacySettings?.showCompany ??
                    true
                  }
                  onCheckedChange={(checked) => setValue('privacySettings.showCompany', checked)}
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSavePrivacy} disabled={updateMutation.isPending}>
                  <Save className="mr-2 h-4 w-4" />
                  {updateMutation.isPending ? 'Saving...' : 'Save Privacy Settings'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Career Entry Dialog */}
      <Dialog open={addCareerOpen} onOpenChange={setAddCareerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Career Entry</DialogTitle>
            <DialogDescription>Add a position to your career history.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label>Company *</Label>
                <Input
                  value={careerCompany}
                  onChange={(e) => setCareerCompany(e.target.value)}
                  placeholder="e.g. Google"
                />
              </div>
              <div className="space-y-2">
                <Label>Role *</Label>
                <Input
                  value={careerRole}
                  onChange={(e) => setCareerRole(e.target.value)}
                  placeholder="e.g. Software Engineer"
                />
              </div>
            </div>
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label>Start Date *</Label>
                <DatePicker value={careerStart} onChange={(iso) => setCareerStart(iso)} />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <DatePicker
                  value={careerEnd}
                  onChange={(iso) => setCareerEnd(iso)}
                  disabled={careerIsCurrent}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={careerIsCurrent}
                onCheckedChange={(checked) => {
                  setCareerIsCurrent(checked);
                  if (checked) setCareerEnd('');
                }}
              />
              <Label>Currently working here</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddCareerOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddCareerEntry} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Adding...' : 'Add Position'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Education Dialog */}
      <Dialog open={addEduOpen} onOpenChange={setAddEduOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Education</DialogTitle>
            <DialogDescription>Add a higher education record.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Institution *</Label>
              <Input
                value={eduInstitution}
                onChange={(e) => setEduInstitution(e.target.value)}
                placeholder="e.g. IIT Bombay"
              />
            </div>
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label>Degree *</Label>
                <Input
                  value={eduDegree}
                  onChange={(e) => setEduDegree(e.target.value)}
                  placeholder="e.g. M.Tech"
                />
              </div>
              <div className="space-y-2">
                <Label>Field *</Label>
                <Input
                  value={eduField}
                  onChange={(e) => setEduField(e.target.value)}
                  placeholder="e.g. Computer Science"
                />
              </div>
            </div>
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label>Start Year *</Label>
                <Input
                  type="number"
                  value={eduStartYear}
                  onChange={(e) => setEduStartYear(e.target.value)}
                  placeholder="e.g. 2020"
                />
              </div>
              <div className="space-y-2">
                <Label>End Year</Label>
                <Input
                  type="number"
                  value={eduEndYear}
                  onChange={(e) => setEduEndYear(e.target.value)}
                  placeholder="e.g. 2022"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddEduOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddEduEntry} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Adding...' : 'Add Education'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

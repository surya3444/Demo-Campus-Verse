'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  addSkillSchema,
  addCertificationSchema,
  addProjectSchema,
  addExperienceSchema,
  updatePreferencesSchema,
} from '@campus-verse/shared/schemas';
import { careerConnectApi } from '@/lib/api';
import {
  Avatar,
  KeyValue,
  Meter,
  PageTitle,
  Panel,
  Pill,
  SkillTag,
  lpa,
  type Person,
} from '@/components/connect/kit';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { DatePicker } from '@/components/ui/date-picker';
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
import { Plus, X, Trash2, Award, FolderGit2, Briefcase, ExternalLink, Users } from 'lucide-react';
import { toast } from 'sonner';
import type { z } from 'zod';

type SkillForm = z.infer<typeof addSkillSchema>;
type CertificationForm = z.infer<typeof addCertificationSchema>;
type ProjectForm = z.infer<typeof addProjectSchema>;
type ExperienceForm = z.infer<typeof addExperienceSchema>;
type PreferencesForm = z.infer<typeof updatePreferencesSchema>;

interface Skill {
  _id: string;
  name: string;
  category?: string;
  proficiency?: string;
}

interface Certification {
  _id: string;
  name: string;
  issuingOrg: string;
  issueDate?: string;
  expiryDate?: string;
  credentialUrl?: string;
}

interface Project {
  _id: string;
  title: string;
  description?: string;
  technologies: string[];
  url?: string;
  startDate?: string;
  endDate?: string;
}

interface Experience {
  _id: string;
  company: string;
  role: string;
  type: string;
  startDate: string;
  endDate?: string;
  description?: string;
  isCurrent: boolean;
}

interface StudentProfile {
  _id: string;
  studentId: string;
  studentName: string;
  skills: Skill[];
  certifications: Certification[];
  projects: Project[];
  experience: Experience[];
  placementPreferences: {
    isOptedIn: boolean;
    preferredRoles?: string[];
    preferredLocations?: string[];
    expectedCTC?: number;
    willingToRelocate?: boolean;
  };
  completeness?: number;
  profileCompleteness?: { percentage: number };
  placementStatus: string;
  placement?: {
    company: string;
    role: string;
    ctc: number;
    location?: string | null;
    acceptedAt?: string;
  };
  person?:
    | (Person & { rollNumber?: string | null; email?: string | null; phone?: string | null })
    | null;
}

const placementStatusLabels: Record<string, string> = {
  unplaced: 'Unplaced',
  placed: 'Placed',
  opted_out: 'Opted Out',
  higher_studies: 'Higher Studies',
};

const experienceTypeLabels: Record<string, string> = {
  internship: 'Internship',
  part_time: 'Part Time',
  full_time: 'Full Time',
  freelance: 'Freelance',
};

const proficiencyLabels: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  expert: 'Expert',
};

function formatDate(dateStr?: string): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    month: 'short',
    year: 'numeric',
  });
}

export default function StudentProfileDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const studentId = params.studentId as string;

  const canEdit = hasPermission('careerConnect.studentProfiles', 'edit');

  const [addSkillOpen, setAddSkillOpen] = useState(false);
  const [addCertOpen, setAddCertOpen] = useState(false);
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [addExpOpen, setAddExpOpen] = useState(false);
  const [prefOpen, setPrefOpen] = useState(false);
  const [techInput, setTechInput] = useState('');

  const queryKey = ['student-profile', studentId];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => careerConnectApi.getStudentProfile(studentId),
    enabled: !!studentId,
  });

  const profile: StudentProfile | null = data?.data || null;

  // === Skill Mutations ===
  const skillForm = useForm<SkillForm>({
    resolver: zodResolver(addSkillSchema),
    defaultValues: { name: '', category: '', proficiency: undefined },
  });

  const addSkillMutation = useMutation({
    mutationFn: (formData: SkillForm) =>
      careerConnectApi.addSkill(studentId, formData as unknown as Record<string, unknown>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Skill added successfully');
      skillForm.reset();
      setAddSkillOpen(false);
    },
    onError: () => toast.error('Failed to add skill'),
  });

  const removeSkillMutation = useMutation({
    mutationFn: (skillId: string) => careerConnectApi.removeSkill(studentId, skillId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Skill removed');
    },
    onError: () => toast.error('Failed to remove skill'),
  });

  // === Certification Mutations ===
  const certForm = useForm<CertificationForm>({
    resolver: zodResolver(addCertificationSchema),
    defaultValues: { name: '', issuingOrg: '', credentialUrl: '' },
  });

  const addCertMutation = useMutation({
    mutationFn: (formData: CertificationForm) =>
      careerConnectApi.addCertification(studentId, formData as unknown as Record<string, unknown>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Certification added successfully');
      certForm.reset();
      setAddCertOpen(false);
    },
    onError: () => toast.error('Failed to add certification'),
  });

  const removeCertMutation = useMutation({
    mutationFn: (certId: string) => careerConnectApi.removeCertification(studentId, certId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Certification removed');
    },
    onError: () => toast.error('Failed to remove certification'),
  });

  // === Project Mutations ===
  const projectForm = useForm<ProjectForm>({
    resolver: zodResolver(addProjectSchema),
    defaultValues: { title: '', description: '', technologies: [], url: '' },
  });

  const addProjectMutation = useMutation({
    mutationFn: (formData: ProjectForm) =>
      careerConnectApi.addProject(studentId, formData as unknown as Record<string, unknown>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Project added successfully');
      projectForm.reset();
      setTechInput('');
      setAddProjectOpen(false);
    },
    onError: () => toast.error('Failed to add project'),
  });

  const removeProjectMutation = useMutation({
    mutationFn: (projectId: string) => careerConnectApi.removeProject(studentId, projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Project removed');
    },
    onError: () => toast.error('Failed to remove project'),
  });

  // === Experience Mutations ===
  const expForm = useForm<ExperienceForm>({
    resolver: zodResolver(addExperienceSchema),
    defaultValues: {
      company: '',
      role: '',
      type: 'internship',
      description: '',
      isCurrent: false,
    },
  });

  const addExpMutation = useMutation({
    mutationFn: (formData: ExperienceForm) =>
      careerConnectApi.addExperience(studentId, formData as unknown as Record<string, unknown>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Experience added successfully');
      expForm.reset();
      setAddExpOpen(false);
    },
    onError: () => toast.error('Failed to add experience'),
  });

  const removeExpMutation = useMutation({
    mutationFn: (expId: string) => careerConnectApi.removeExperience(studentId, expId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Experience removed');
    },
    onError: () => toast.error('Failed to remove experience'),
  });

  // === Preferences ===
  const [prefRolesInput, setPrefRolesInput] = useState('');
  const [prefLocationsInput, setPrefLocationsInput] = useState('');
  const [prefSaving, setPrefSaving] = useState(false);

  const prefForm = useForm<PreferencesForm>({
    resolver: zodResolver(updatePreferencesSchema),
  });

  const updatePrefMutation = useMutation({
    mutationFn: (formData: PreferencesForm) =>
      careerConnectApi.updatePreferences(studentId, formData as unknown as Record<string, unknown>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Preferences updated');
      setPrefSaving(false);
      setPrefOpen(false);
    },
    onError: () => {
      toast.error('Failed to update preferences');
      setPrefSaving(false);
    },
  });

  // Helper for tech tags in project form
  const projectTechnologies = projectForm.watch('technologies') || [];
  const addTech = () => {
    if (techInput.trim()) {
      projectForm.setValue('technologies', [...projectTechnologies, techInput.trim()]);
      setTechInput('');
    }
  };
  const removeTech = (index: number) => {
    projectForm.setValue(
      'technologies',
      projectTechnologies.filter((_, i) => i !== index)
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">Profile Not Found</h3>
          <p className="text-muted-foreground">
            This student&apos;s career profile could not be found.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.push('/career-connect/student-profile')}
          >
            Back to Profiles
          </Button>
        </div>
      </div>
    );
  }

  const handleSavePreferences = (formData: PreferencesForm) => {
    setPrefSaving(true);
    const processedData: PreferencesForm = {
      ...formData,
      preferredRoles: prefRolesInput
        ? prefRolesInput
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : profile.placementPreferences?.preferredRoles,
      preferredLocations: prefLocationsInput
        ? prefLocationsInput
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : profile.placementPreferences?.preferredLocations,
    };
    updatePrefMutation.mutate(processedData);
  };

  const person = profile.person;
  const pct = profile.profileCompleteness?.percentage ?? profile.completeness ?? 0;
  const prefs = profile.placementPreferences ?? { isOptedIn: true };
  const placed = profile.placementStatus === 'placed';
  const statusLabel = placementStatusLabels[profile.placementStatus] ?? 'Looking';
  const remove = (label: string, fn: () => void) => () => {
    if (window.confirm(`Remove ${label}?`)) fn();
  };
  const SectionAdd = ({ onClick }: { onClick: () => void }) =>
    canEdit ? (
      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1 text-muted-foreground"
        onClick={onClick}
      >
        <Plus className="h-3.5 w-3.5" /> Add
      </Button>
    ) : null;

  return (
    <div className="space-y-6">
      <PageTitle
        crumbs={[
          { label: 'Student profiles', href: '/career-connect/student-profile' },
          { label: profile.studentName },
        ]}
        title={profile.studentName}
        description={
          [
            person?.program,
            person?.section && `Section ${person.section}`,
            person?.rollNumber && `Roll ${person.rollNumber}`,
          ]
            .filter(Boolean)
            .join(' · ') || 'Student career profile'
        }
      />

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Identity */}
        <aside className="space-y-6">
          <Panel>
            <div className="flex flex-col items-center text-center">
              <Avatar person={{ name: profile.studentName, photo: person?.photo }} size={96} />
              <p className="mt-3 text-lg font-semibold tracking-tight">{profile.studentName}</p>
              <p className="text-sm text-muted-foreground">{person?.program ?? 'Student'}</p>
              <div className="mt-3">
                <Pill
                  tone={
                    placed
                      ? 'green'
                      : profile.placementStatus === 'higher_studies'
                        ? 'violet'
                        : profile.placementStatus === 'opted_out'
                          ? 'gray'
                          : 'blue'
                  }
                >
                  {placed
                    ? 'Placed'
                    : statusLabel === 'Unplaced'
                      ? 'Looking for a role'
                      : statusLabel}
                </Pill>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 divide-x divide-border/70 rounded-xl border border-border/70 text-center">
              {[
                ['CGPA', person?.cgpa ? person.cgpa.toFixed(2) : '—'],
                ['Skills', String(profile.skills.length)],
                ['Projects', String(profile.projects.length)],
              ].map(([k, v]) => (
                <div key={k} className="py-2.5">
                  <p className="text-base font-semibold tabular-nums">{v}</p>
                  <p className="text-[11px] text-muted-foreground">{k}</p>
                </div>
              ))}
            </div>
            <div className="mt-5">
              <div className="flex items-baseline justify-between text-xs">
                <span className="font-medium text-muted-foreground">Profile readiness</span>
                <span className="tabular-nums">{pct}%</span>
              </div>
              <Meter
                value={pct}
                color={pct >= 70 ? '#16a34a' : pct >= 40 ? '#1e4fd8' : '#f59e0b'}
                className="mt-1.5"
              />
            </div>
            {(person?.email || person?.phone) && (
              <div className="mt-5 space-y-1.5 border-t border-border/70 pt-4 text-sm">
                {person?.email && <p className="truncate text-muted-foreground">{person.email}</p>}
                {person?.phone && <p className="text-muted-foreground">{person.phone}</p>}
              </div>
            )}
          </Panel>

          {placed && profile.placement && (
            <Panel title="Placement">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <Briefcase className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{profile.placement.company}</p>
                  <p className="truncate text-sm text-muted-foreground">{profile.placement.role}</p>
                </div>
              </div>
              <KeyValue
                items={[
                  ['Package', lpa(profile.placement.ctc)],
                  ['Location', profile.placement.location ?? '—'],
                  ['Accepted', formatDate(profile.placement.acceptedAt)],
                ]}
              />
            </Panel>
          )}

          <Panel
            title="Preferences"
            action={
              canEdit ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-muted-foreground"
                  onClick={() => setPrefOpen(true)}
                >
                  Edit
                </Button>
              ) : null
            }
          >
            <KeyValue
              cols={1}
              items={[
                ['Placements', prefs.isOptedIn === false ? 'Opted out' : 'Opted in'],
                ['Preferred roles', prefs.preferredRoles?.join(', ') || '—'],
                ['Preferred locations', prefs.preferredLocations?.join(', ') || '—'],
                ['Expected package', prefs.expectedCTC ? lpa(prefs.expectedCTC) : '—'],
                ['Willing to relocate', prefs.willingToRelocate ? 'Yes' : 'No'],
              ]}
            />
          </Panel>
        </aside>

        {/* Résumé */}
        <div className="space-y-6">
          <Panel title="Skills" action={<SectionAdd onClick={() => setAddSkillOpen(true)} />}>
            {profile.skills.length ? (
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((s) => (
                  <span
                    key={s._id}
                    className="group inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-background px-2.5 py-1.5 text-sm"
                  >
                    <span className="font-medium">{s.name}</span>
                    {s.proficiency && (
                      <span className="text-xs text-muted-foreground">
                        · {proficiencyLabels[s.proficiency] ?? s.proficiency}
                      </span>
                    )}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={remove(s.name, () => removeSkillMutation.mutate(s._id))}
                        className="hidden text-muted-foreground hover:text-rose-600 group-hover:inline"
                        aria-label={`Remove ${s.name}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No skills added yet.</p>
            )}
          </Panel>

          <Panel title="Projects" action={<SectionAdd onClick={() => setAddProjectOpen(true)} />}>
            {profile.projects.length ? (
              <ul className="space-y-5">
                {profile.projects.map((p) => (
                  <li key={p._id} className="group flex gap-4">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                      <FolderGit2 className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium">
                          {p.title}
                          {p.url && (
                            <a
                              href={p.url}
                              target="_blank"
                              rel="noreferrer"
                              className="ml-1.5 inline-flex text-muted-foreground hover:text-foreground"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </p>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatDate(p.startDate)} – {formatDate(p.endDate)}
                        </span>
                      </div>
                      {p.description && (
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                          {p.description}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {p.technologies.map((t) => (
                          <SkillTag key={t}>{t}</SkillTag>
                        ))}
                        {canEdit && (
                          <button
                            type="button"
                            onClick={remove(p.title, () => removeProjectMutation.mutate(p._id))}
                            className="ml-auto hidden text-xs text-muted-foreground hover:text-rose-600 group-hover:inline"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No projects added yet.</p>
            )}
          </Panel>

          <Panel title="Experience" action={<SectionAdd onClick={() => setAddExpOpen(true)} />}>
            {profile.experience.length ? (
              <ol className="relative space-y-5 border-l border-border/70 pl-5">
                {profile.experience.map((e) => (
                  <li key={e._id} className="group relative">
                    <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-blue-600" />
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{e.role}</p>
                        <p className="text-sm text-muted-foreground">
                          {e.company} · {experienceTypeLabels[e.type] ?? e.type}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatDate(e.startDate)} –{' '}
                        {e.isCurrent ? 'Present' : formatDate(e.endDate)}
                      </span>
                    </div>
                    {e.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{e.description}</p>
                    )}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={remove(e.role, () => removeExpMutation.mutate(e._id))}
                        className="mt-1 hidden text-xs text-muted-foreground hover:text-rose-600 group-hover:inline"
                      >
                        Remove
                      </button>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">
                No internships or work experience yet.
              </p>
            )}
          </Panel>

          <Panel
            title="Certifications"
            action={<SectionAdd onClick={() => setAddCertOpen(true)} />}
          >
            {profile.certifications.length ? (
              <ul className="divide-y divide-border/60">
                {profile.certifications.map((c) => (
                  <li
                    key={c._id}
                    className="group flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                      <Award className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.issuingOrg}
                        {c.issueDate ? ` · ${formatDate(c.issueDate)}` : ''}
                      </p>
                    </div>
                    {c.credentialUrl && (
                      <a
                        href={c.credentialUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={remove(c.name, () => removeCertMutation.mutate(c._id))}
                        className="hidden text-muted-foreground hover:text-rose-600 group-hover:inline"
                        aria-label={`Remove ${c.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No certifications yet.</p>
            )}
          </Panel>
        </div>
      </div>

      {/* === Preferences Dialog === */}
      {canEdit && (
        <Dialog open={prefOpen} onOpenChange={setPrefOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Placement preferences</DialogTitle>
              <DialogDescription>
                What {profile.studentName.split(' ')[0]} is looking for.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={prefForm.handleSubmit(handleSavePreferences)} className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Opt-in for Placements</Label>
                  <p className="text-sm text-muted-foreground">
                    Whether this student is considered for placement drives
                  </p>
                </div>
                <Switch
                  checked={
                    prefForm.watch('isOptedIn') ?? profile.placementPreferences?.isOptedIn ?? true
                  }
                  onCheckedChange={(checked) => prefForm.setValue('isOptedIn', checked)}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Preferred Roles (comma-separated)</Label>
                  <Input
                    value={
                      prefRolesInput ||
                      profile.placementPreferences?.preferredRoles?.join(', ') ||
                      ''
                    }
                    onChange={(e) => setPrefRolesInput(e.target.value)}
                    placeholder="e.g. Software Engineer, Data Analyst"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Preferred Locations (comma-separated)</Label>
                  <Input
                    value={
                      prefLocationsInput ||
                      profile.placementPreferences?.preferredLocations?.join(', ') ||
                      ''
                    }
                    onChange={(e) => setPrefLocationsInput(e.target.value)}
                    placeholder="e.g. Bangalore, Mumbai, Remote"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Expected CTC (in INR)</Label>
                  <Input
                    type="number"
                    {...prefForm.register('expectedCTC', { valueAsNumber: true })}
                    defaultValue={profile.placementPreferences?.expectedCTC || ''}
                    placeholder="e.g. 600000"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Willing to Relocate</Label>
                  <p className="text-sm text-muted-foreground">
                    Open to relocating for opportunities
                  </p>
                </div>
                <Switch
                  checked={
                    prefForm.watch('willingToRelocate') ??
                    profile.placementPreferences?.willingToRelocate ??
                    false
                  }
                  onCheckedChange={(checked) => prefForm.setValue('willingToRelocate', checked)}
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={prefSaving || updatePrefMutation.isPending}>
                  {updatePrefMutation.isPending ? 'Saving...' : 'Save Preferences'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* === Add Skill Dialog === */}
      {canEdit && (
        <Dialog open={addSkillOpen} onOpenChange={setAddSkillOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Skill</DialogTitle>
              <DialogDescription>Add a skill to this student&apos;s profile.</DialogDescription>
            </DialogHeader>
            <form
              onSubmit={skillForm.handleSubmit((data) => addSkillMutation.mutate(data))}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="skill-name">Skill Name *</Label>
                <Input
                  id="skill-name"
                  {...skillForm.register('name')}
                  placeholder="e.g. React.js"
                />
                {skillForm.formState.errors.name && (
                  <p className="text-sm text-destructive">
                    {skillForm.formState.errors.name.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="skill-category">Category</Label>
                <Input
                  id="skill-category"
                  {...skillForm.register('category')}
                  placeholder="e.g. Frontend, Backend, Data Science"
                />
              </div>
              <div className="space-y-2">
                <Label>Proficiency</Label>
                <Select
                  onValueChange={(val) =>
                    skillForm.setValue('proficiency', val as SkillForm['proficiency'])
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select proficiency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                    <SelectItem value="expert">Expert</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAddSkillOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={addSkillMutation.isPending}>
                  {addSkillMutation.isPending ? 'Adding...' : 'Add Skill'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* === Add Certification Dialog === */}
      {canEdit && (
        <Dialog open={addCertOpen} onOpenChange={setAddCertOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Certification</DialogTitle>
              <DialogDescription>
                Add a certification to this student&apos;s profile.
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={certForm.handleSubmit((data) => addCertMutation.mutate(data))}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="cert-name">Certification Name *</Label>
                <Input
                  id="cert-name"
                  {...certForm.register('name')}
                  placeholder="e.g. AWS Solutions Architect"
                />
                {certForm.formState.errors.name && (
                  <p className="text-sm text-destructive">
                    {certForm.formState.errors.name.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="cert-org">Issuing Organization *</Label>
                <Input
                  id="cert-org"
                  {...certForm.register('issuingOrg')}
                  placeholder="e.g. Amazon Web Services"
                />
                {certForm.formState.errors.issuingOrg && (
                  <p className="text-sm text-destructive">
                    {certForm.formState.errors.issuingOrg.message}
                  </p>
                )}
              </div>
              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="cert-issue-date">Issue Date</Label>
                  <Controller
                    name="issueDate"
                    control={certForm.control}
                    render={({ field }) => (
                      <DatePicker
                        id="cert-issue-date"
                        value={
                          field.value instanceof Date
                            ? field.value.toISOString().slice(0, 10)
                            : (field.value ?? '')
                        }
                        onChange={field.onChange}
                      />
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cert-expiry-date">Expiry Date</Label>
                  <Controller
                    name="expiryDate"
                    control={certForm.control}
                    render={({ field }) => (
                      <DatePicker
                        id="cert-expiry-date"
                        value={
                          field.value instanceof Date
                            ? field.value.toISOString().slice(0, 10)
                            : (field.value ?? '')
                        }
                        onChange={field.onChange}
                        disablePast
                      />
                    )}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cert-url">Credential URL</Label>
                <Input
                  id="cert-url"
                  {...certForm.register('credentialUrl')}
                  placeholder="https://..."
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAddCertOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={addCertMutation.isPending}>
                  {addCertMutation.isPending ? 'Adding...' : 'Add Certification'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* === Add Project Dialog === */}
      {canEdit && (
        <Dialog open={addProjectOpen} onOpenChange={setAddProjectOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Project</DialogTitle>
              <DialogDescription>Add a project to this student&apos;s profile.</DialogDescription>
            </DialogHeader>
            <form
              onSubmit={projectForm.handleSubmit((data) => addProjectMutation.mutate(data))}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="project-title">Project Title *</Label>
                <Input
                  id="project-title"
                  {...projectForm.register('title')}
                  placeholder="e.g. E-Commerce Platform"
                />
                {projectForm.formState.errors.title && (
                  <p className="text-sm text-destructive">
                    {projectForm.formState.errors.title.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-desc">Description</Label>
                <Textarea
                  id="project-desc"
                  {...projectForm.register('description')}
                  placeholder="Brief description of the project"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Technologies</Label>
                <div className="flex gap-2">
                  <Input
                    value={techInput}
                    onChange={(e) => setTechInput(e.target.value)}
                    placeholder="Add a technology"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTech();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" onClick={addTech}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {projectTechnologies.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {projectTechnologies.map((tech, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-sm"
                      >
                        {tech}
                        <button
                          type="button"
                          onClick={() => removeTech(i)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-url">Project URL</Label>
                <Input
                  id="project-url"
                  {...projectForm.register('url')}
                  placeholder="https://github.com/..."
                />
              </div>
              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="project-start">Start Date</Label>
                  <Controller
                    name="startDate"
                    control={projectForm.control}
                    render={({ field }) => (
                      <DatePicker
                        id="project-start"
                        value={
                          field.value instanceof Date
                            ? field.value.toISOString().slice(0, 10)
                            : (field.value ?? '')
                        }
                        onChange={field.onChange}
                      />
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="project-end">End Date</Label>
                  <Controller
                    name="endDate"
                    control={projectForm.control}
                    render={({ field }) => (
                      <DatePicker
                        id="project-end"
                        value={
                          field.value instanceof Date
                            ? field.value.toISOString().slice(0, 10)
                            : (field.value ?? '')
                        }
                        onChange={field.onChange}
                      />
                    )}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAddProjectOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={addProjectMutation.isPending}>
                  {addProjectMutation.isPending ? 'Adding...' : 'Add Project'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* === Add Experience Dialog === */}
      {canEdit && (
        <Dialog open={addExpOpen} onOpenChange={setAddExpOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Experience</DialogTitle>
              <DialogDescription>
                Add work experience to this student&apos;s profile.
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={expForm.handleSubmit((data) => addExpMutation.mutate(data))}
              className="space-y-4"
            >
              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="exp-company">Company *</Label>
                  <Input
                    id="exp-company"
                    {...expForm.register('company')}
                    placeholder="e.g. Google"
                  />
                  {expForm.formState.errors.company && (
                    <p className="text-sm text-destructive">
                      {expForm.formState.errors.company.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exp-role">Role *</Label>
                  <Input
                    id="exp-role"
                    {...expForm.register('role')}
                    placeholder="e.g. Software Intern"
                  />
                  {expForm.formState.errors.role && (
                    <p className="text-sm text-destructive">
                      {expForm.formState.errors.role.message}
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Type *</Label>
                <Select
                  defaultValue="internship"
                  onValueChange={(val) => expForm.setValue('type', val as ExperienceForm['type'])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internship">Internship</SelectItem>
                    <SelectItem value="part_time">Part Time</SelectItem>
                    <SelectItem value="full_time">Full Time</SelectItem>
                    <SelectItem value="freelance">Freelance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="exp-start">Start Date *</Label>
                  <Controller
                    name="startDate"
                    control={expForm.control}
                    render={({ field }) => (
                      <DatePicker
                        id="exp-start"
                        value={
                          field.value instanceof Date
                            ? field.value.toISOString().slice(0, 10)
                            : (field.value ?? '')
                        }
                        onChange={field.onChange}
                      />
                    )}
                  />
                  {expForm.formState.errors.startDate && (
                    <p className="text-sm text-destructive">
                      {expForm.formState.errors.startDate.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exp-end">End Date</Label>
                  <Controller
                    name="endDate"
                    control={expForm.control}
                    render={({ field }) => (
                      <DatePicker
                        id="exp-end"
                        value={
                          field.value instanceof Date
                            ? field.value.toISOString().slice(0, 10)
                            : (field.value ?? '')
                        }
                        onChange={field.onChange}
                      />
                    )}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="exp-desc">Description</Label>
                <Textarea
                  id="exp-desc"
                  {...expForm.register('description')}
                  placeholder="Describe responsibilities and achievements"
                  rows={3}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={expForm.watch('isCurrent') || false}
                  onCheckedChange={(checked) => expForm.setValue('isCurrent', checked)}
                />
                <Label>Currently working here</Label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAddExpOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={addExpMutation.isPending}>
                  {addExpMutation.isPending ? 'Adding...' : 'Add Experience'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

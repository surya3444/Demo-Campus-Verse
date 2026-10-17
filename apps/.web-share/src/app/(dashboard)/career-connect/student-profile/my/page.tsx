'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Plus,
  X,
  Trash2,
  Award,
  FolderGit2,
  Briefcase,
  Settings,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
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
  completeness: number;
  placementStatus: string;
}

function getCompletenessColor(value: number): string {
  if (value < 40) return 'bg-red-500';
  if (value <= 70) return 'bg-yellow-500';
  return 'bg-green-500';
}

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

export default function MyCareerProfilePage() {
  const queryClient = useQueryClient();

  const [addSkillOpen, setAddSkillOpen] = useState(false);
  const [addCertOpen, setAddCertOpen] = useState(false);
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [addExpOpen, setAddExpOpen] = useState(false);
  const [techInput, setTechInput] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['my-career-profile'],
    queryFn: () => careerConnectApi.getMyProfile(),
  });

  const profile: StudentProfile | null = data?.data || null;
  const studentId = profile?.studentId;

  // === Skill Mutations ===
  const skillForm = useForm<SkillForm>({
    resolver: zodResolver(addSkillSchema),
    defaultValues: { name: '', category: '', proficiency: undefined },
  });

  const addSkillMutation = useMutation({
    mutationFn: (formData: SkillForm) =>
      careerConnectApi.addSkill(studentId!, formData as unknown as Record<string, unknown>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-career-profile'] });
      toast.success('Skill added successfully');
      skillForm.reset();
      setAddSkillOpen(false);
    },
    onError: () => toast.error('Failed to add skill'),
  });

  const removeSkillMutation = useMutation({
    mutationFn: (skillId: string) => careerConnectApi.removeSkill(studentId!, skillId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-career-profile'] });
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
      careerConnectApi.addCertification(studentId!, formData as unknown as Record<string, unknown>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-career-profile'] });
      toast.success('Certification added successfully');
      certForm.reset();
      setAddCertOpen(false);
    },
    onError: () => toast.error('Failed to add certification'),
  });

  const removeCertMutation = useMutation({
    mutationFn: (certId: string) => careerConnectApi.removeCertification(studentId!, certId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-career-profile'] });
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
      careerConnectApi.addProject(studentId!, formData as unknown as Record<string, unknown>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-career-profile'] });
      toast.success('Project added successfully');
      projectForm.reset();
      setTechInput('');
      setAddProjectOpen(false);
    },
    onError: () => toast.error('Failed to add project'),
  });

  const removeProjectMutation = useMutation({
    mutationFn: (projectId: string) => careerConnectApi.removeProject(studentId!, projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-career-profile'] });
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
      careerConnectApi.addExperience(studentId!, formData as unknown as Record<string, unknown>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-career-profile'] });
      toast.success('Experience added successfully');
      expForm.reset();
      setAddExpOpen(false);
    },
    onError: () => toast.error('Failed to add experience'),
  });

  const removeExpMutation = useMutation({
    mutationFn: (expId: string) => careerConnectApi.removeExperience(studentId!, expId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-career-profile'] });
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
      careerConnectApi.updatePreferences(
        studentId!,
        formData as unknown as Record<string, unknown>
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-career-profile'] });
      toast.success('Preferences updated');
      setPrefSaving(false);
    },
    onError: () => {
      toast.error('Failed to update preferences');
      setPrefSaving(false);
    },
  });

  // Helper to add tech tags in project form
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
          <Sparkles className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">Profile Not Available</h3>
          <p className="text-muted-foreground">
            Your career profile could not be loaded. Please try again later.
          </p>
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Career Profile</h1>
        <p className="text-muted-foreground">
          Manage your skills, certifications, projects, and preferences
        </p>
      </div>

      {/* Profile Completeness */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Profile Completeness</span>
            <span className="text-sm font-semibold">{profile.completeness}%</span>
          </div>
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={`h-full rounded-full transition-all ${getCompletenessColor(profile.completeness)}`}
              style={{ width: `${profile.completeness}%` }}
            />
          </div>
          {profile.completeness < 70 && (
            <p className="text-xs text-muted-foreground mt-2">
              Complete your profile to improve your visibility to recruiters.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Tabbed Content */}
      <Tabs defaultValue="skills">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="skills" className="gap-1">
            <Sparkles className="h-4 w-4" />
            Skills
          </TabsTrigger>
          <TabsTrigger value="certifications" className="gap-1">
            <Award className="h-4 w-4" />
            Certifications
          </TabsTrigger>
          <TabsTrigger value="projects" className="gap-1">
            <FolderGit2 className="h-4 w-4" />
            Projects
          </TabsTrigger>
          <TabsTrigger value="experience" className="gap-1">
            <Briefcase className="h-4 w-4" />
            Experience
          </TabsTrigger>
          <TabsTrigger value="preferences" className="gap-1">
            <Settings className="h-4 w-4" />
            Preferences
          </TabsTrigger>
        </TabsList>

        {/* === Skills Tab === */}
        <TabsContent value="skills">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Skills</CardTitle>
              <Button size="sm" onClick={() => setAddSkillOpen(true)}>
                <Plus className="mr-1 h-4 w-4" />
                Add Skill
              </Button>
            </CardHeader>
            <CardContent>
              {profile.skills.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No skills added yet. Add your first skill to get started.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {profile.skills.map((skill) => (
                    <Badge
                      key={skill._id}
                      variant="secondary"
                      className="px-3 py-1.5 text-sm gap-2"
                    >
                      <span>{skill.name}</span>
                      {skill.proficiency && (
                        <span className="text-xs text-muted-foreground">
                          ({proficiencyLabels[skill.proficiency] || skill.proficiency})
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeSkillMutation.mutate(skill._id)}
                        className="ml-1 text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* === Certifications Tab === */}
        <TabsContent value="certifications">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Certifications</CardTitle>
              <Button size="sm" onClick={() => setAddCertOpen(true)}>
                <Plus className="mr-1 h-4 w-4" />
                Add Certification
              </Button>
            </CardHeader>
            <CardContent>
              {profile.certifications.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No certifications added yet. Showcase your certifications here.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Issuing Organization</TableHead>
                      <TableHead>Issue Date</TableHead>
                      <TableHead>Expiry Date</TableHead>
                      <TableHead>Credential</TableHead>
                      <TableHead className="w-[60px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profile.certifications.map((cert) => (
                      <TableRow key={cert._id}>
                        <TableCell className="font-medium">{cert.name}</TableCell>
                        <TableCell>{cert.issuingOrg}</TableCell>
                        <TableCell>{formatDate(cert.issueDate)}</TableCell>
                        <TableCell>{formatDate(cert.expiryDate)}</TableCell>
                        <TableCell>
                          {cert.credentialUrl ? (
                            <a
                              href={cert.credentialUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                            >
                              View <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeCertMutation.mutate(cert._id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* === Projects Tab === */}
        <TabsContent value="projects">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Projects</CardTitle>
              <Button size="sm" onClick={() => setAddProjectOpen(true)}>
                <Plus className="mr-1 h-4 w-4" />
                Add Project
              </Button>
            </CardHeader>
            <CardContent>
              {profile.projects.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No projects added yet. Add projects to showcase your work.
                </p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {profile.projects.map((project) => (
                    <Card key={project._id}>
                      <CardContent className="pt-4 space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium">{project.title}</h4>
                            {(project.startDate || project.endDate) && (
                              <p className="text-xs text-muted-foreground">
                                {formatDate(project.startDate)} -{' '}
                                {formatDate(project.endDate) || 'Present'}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {project.url && (
                              <a
                                href={project.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => removeProjectMutation.mutate(project._id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                        {project.description && (
                          <p className="text-sm text-muted-foreground">{project.description}</p>
                        )}
                        {project.technologies.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {project.technologies.map((tech, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {tech}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* === Experience Tab === */}
        <TabsContent value="experience">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Experience</CardTitle>
              <Button size="sm" onClick={() => setAddExpOpen(true)}>
                <Plus className="mr-1 h-4 w-4" />
                Add Experience
              </Button>
            </CardHeader>
            <CardContent>
              {profile.experience.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No experience added yet. Add your work experience to strengthen your profile.
                </p>
              ) : (
                <div className="space-y-4">
                  {profile.experience.map((exp) => (
                    <div
                      key={exp._id}
                      className="flex items-start justify-between border rounded-lg p-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{exp.role}</h4>
                          <Badge variant="outline" className="text-xs">
                            {experienceTypeLabels[exp.type] || exp.type}
                          </Badge>
                          {exp.isCurrent && (
                            <Badge className="text-xs bg-green-100 text-green-800">Current</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{exp.company}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(exp.startDate)} -{' '}
                          {exp.isCurrent ? 'Present' : formatDate(exp.endDate)}
                        </p>
                        {exp.description && (
                          <p className="text-sm text-muted-foreground mt-1">{exp.description}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => removeExpMutation.mutate(exp._id)}
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

        {/* === Preferences Tab === */}
        <TabsContent value="preferences">
          <Card>
            <CardHeader>
              <CardTitle>Placement Preferences</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={prefForm.handleSubmit(handleSavePreferences)} className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Opt-in for Placements</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable this to be considered for placement drives
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
                      Open to relocating for the right opportunity
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* === Add Skill Dialog === */}
      <Dialog open={addSkillOpen} onOpenChange={setAddSkillOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Skill</DialogTitle>
            <DialogDescription>Add a new skill to your career profile.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={skillForm.handleSubmit((data) => addSkillMutation.mutate(data))}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="skill-name">Skill Name *</Label>
              <Input id="skill-name" {...skillForm.register('name')} placeholder="e.g. React.js" />
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

      {/* === Add Certification Dialog === */}
      <Dialog open={addCertOpen} onOpenChange={setAddCertOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Certification</DialogTitle>
            <DialogDescription>Add a certification to your career profile.</DialogDescription>
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
                <p className="text-sm text-destructive">{certForm.formState.errors.name.message}</p>
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

      {/* === Add Project Dialog === */}
      <Dialog open={addProjectOpen} onOpenChange={setAddProjectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Project</DialogTitle>
            <DialogDescription>Add a project to showcase your work.</DialogDescription>
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

      {/* === Add Experience Dialog === */}
      <Dialog open={addExpOpen} onOpenChange={setAddExpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Experience</DialogTitle>
            <DialogDescription>Add work experience to your profile.</DialogDescription>
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
                placeholder="Describe your responsibilities and achievements"
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
    </div>
  );
}

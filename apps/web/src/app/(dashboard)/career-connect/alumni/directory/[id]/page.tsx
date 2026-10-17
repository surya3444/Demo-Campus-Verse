'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { careerConnectApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  GraduationCap,
  Building2,
  MapPin,
  Briefcase,
  CheckCircle2,
  Linkedin,
  Mail,
  Phone,
  BookOpen,
  Shield,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

interface CareerHistoryEntry {
  company: string;
  role: string;
  startDate: string;
  endDate?: string;
  isCurrent?: boolean;
}

interface HigherEducationEntry {
  institution: string;
  degree: string;
  field: string;
  startYear: number;
  endYear?: number;
}

interface AlumniProfileDetail {
  _id: string;
  studentName: string;
  graduationYear: number | null;
  company?: string;
  currentCompany?: string;
  currentRole?: string;
  designation?: string;
  industry?: string;
  location?: string;
  linkedinUrl?: string;
  linkedInUrl?: string;
  email?: string;
  phone?: string;
  bio?: string;
  achievements?: string[];
  skills?: string[];
  isVerified: boolean;
  verifiedAt?: string;
  mentorshipInfo?: {
    willingToMentor: boolean;
    areas?: string[];
    expertise?: string[];
    availability?: string;
    maxMentees?: number;
  };
  willingToReferStudents?: boolean;
  careerHistory?: CareerHistoryEntry[];
  higherEducation?: HigherEducationEntry[];
  privacySettings?: {
    showEmail?: boolean;
    showPhone?: boolean;
    showCompany?: boolean;
  };
  createdAt?: string;
  updatedAt?: string;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return 'Present';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    month: 'short',
    year: 'numeric',
  });
}

export default function AlumniProfileDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const id = params.id as string;

  const canEdit = hasPermission('careerConnect.alumni', 'edit');
  const canVerify = hasPermission('careerConnect.alumni', 'verify');

  const { data, isLoading } = useQuery({
    queryKey: ['alumni-profile', id],
    queryFn: () => careerConnectApi.getAlumniProfile(id),
  });

  const verifyMutation = useMutation({
    mutationFn: () => careerConnectApi.verifyAlumniProfile(id),
    onSuccess: () => {
      toast.success('Alumni profile verified successfully');
      queryClient.invalidateQueries({ queryKey: ['alumni-profile', id] });
      queryClient.invalidateQueries({ queryKey: ['alumni-profiles'] });
    },
    onError: () => {
      toast.error('Failed to verify alumni profile');
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

  const profile: AlumniProfileDetail | undefined = data?.data;

  if (!profile) {
    return (
      <div className="text-center py-12">
        <GraduationCap className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-medium">Profile not found</h3>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push('/career-connect/alumni/directory')}
        >
          Back to Directory
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">
                {profile.studentName || 'Unnamed Alumni'}
              </h1>
              {profile.isVerified ? (
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Verified
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                  Pending Verification
                </Badge>
              )}
              {profile.mentorshipInfo?.willingToMentor && (
                <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                  <Users className="mr-1 h-3 w-3" />
                  Mentor
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              {profile.graduationYear ? `Class of ${profile.graduationYear}` : 'Alumni Profile'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {canVerify && !profile.isVerified && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => verifyMutation.mutate()}
              disabled={verifyMutation.isPending}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {verifyMutation.isPending ? 'Verifying...' : 'Verify Profile'}
            </Button>
          )}
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/career-connect/alumni/directory/${profile._id}`)}
            >
              Edit
            </Button>
          )}
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Current Position
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              <span>{profile.currentRole || profile.designation || '-'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span>{profile.currentCompany || profile.company || '-'}</span>
            </div>
            {profile.industry && (
              <p className="text-xs text-muted-foreground">Industry: {profile.industry}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Location</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{profile.location || '-'}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(profile.linkedinUrl || profile.linkedInUrl) && (
              <div className="flex items-center gap-2 text-sm">
                <Linkedin className="h-4 w-4 text-muted-foreground" />
                <a
                  href={profile.linkedinUrl || profile.linkedInUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline truncate"
                >
                  LinkedIn Profile
                </a>
              </div>
            )}
            {profile.email && profile.privacySettings?.showEmail !== false && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{profile.email}</span>
              </div>
            )}
            {profile.phone && profile.privacySettings?.showPhone !== false && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{profile.phone}</span>
              </div>
            )}
            {!profile.linkedinUrl && !profile.linkedInUrl && !profile.email && !profile.phone && (
              <p className="text-sm text-muted-foreground">No contact info available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bio */}
      {profile.bio && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">About</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{profile.bio}</p>
          </CardContent>
        </Card>
      )}

      {/* Career History */}
      {profile.careerHistory && profile.careerHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Briefcase className="h-4 w-4" />
              Career History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {profile.careerHistory.map((entry, index) => (
                <div key={index} className="flex items-start gap-4 border rounded-lg p-4">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{entry.role}</h4>
                      {entry.isCurrent && (
                        <Badge className="text-xs bg-green-100 text-green-800">Current</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{entry.company}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(entry.startDate)} -{' '}
                      {entry.isCurrent ? 'Present' : formatDate(entry.endDate)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Higher Education */}
      {profile.higherEducation && profile.higherEducation.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4" />
              Higher Education
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {profile.higherEducation.map((entry, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-1">
                  <h4 className="font-medium">
                    {entry.degree} in {entry.field}
                  </h4>
                  <p className="text-sm text-muted-foreground">{entry.institution}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.startYear} - {entry.endYear || 'Present'}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Skills & Achievements */}
      <div className="grid gap-6 md:grid-cols-2">
        {profile.skills && profile.skills.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Skills</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((skill, index) => (
                  <Badge key={index} variant="secondary" className="text-sm">
                    {skill}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {profile.achievements && profile.achievements.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Achievements</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {profile.achievements.map((achievement, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                    <span>{achievement}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Mentorship Info */}
      {profile.mentorshipInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Mentorship Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">Willing to Mentor:</span>
              <Badge
                variant="secondary"
                className={
                  profile.mentorshipInfo.willingToMentor
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-600'
                }
              >
                {profile.mentorshipInfo.willingToMentor ? 'Yes' : 'No'}
              </Badge>
            </div>
            {profile.mentorshipInfo.expertise && profile.mentorshipInfo.expertise.length > 0 && (
              <div>
                <span className="text-sm font-medium">Areas of Expertise:</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {profile.mentorshipInfo.expertise.map((area, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {area}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {profile.mentorshipInfo.areas && profile.mentorshipInfo.areas.length > 0 && (
              <div>
                <span className="text-sm font-medium">Mentoring Areas:</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {profile.mentorshipInfo.areas.map((area, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {area}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {profile.mentorshipInfo.availability && (
              <p className="text-sm">
                <span className="font-medium">Availability:</span>{' '}
                {profile.mentorshipInfo.availability}
              </p>
            )}
            {profile.mentorshipInfo.maxMentees && (
              <p className="text-sm">
                <span className="font-medium">Max Mentees:</span>{' '}
                {profile.mentorshipInfo.maxMentees}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Privacy Settings */}
      {profile.privacySettings && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4" />
              Privacy Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 text-sm">
              <span>
                Email:{' '}
                <Badge variant="outline">
                  {profile.privacySettings.showEmail ? 'Visible' : 'Hidden'}
                </Badge>
              </span>
              <span>
                Phone:{' '}
                <Badge variant="outline">
                  {profile.privacySettings.showPhone ? 'Visible' : 'Hidden'}
                </Badge>
              </span>
              <span>
                Company:{' '}
                <Badge variant="outline">
                  {profile.privacySettings.showCompany ? 'Visible' : 'Hidden'}
                </Badge>
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      <div className="text-xs text-muted-foreground">
        {profile.createdAt && <>Created: {new Date(profile.createdAt).toLocaleString('en-IN')}</>}
        {profile.updatedAt && (
          <> | Updated: {new Date(profile.updatedAt).toLocaleString('en-IN')}</>
        )}
        {profile.verifiedAt && (
          <> | Verified: {new Date(profile.verifiedAt).toLocaleString('en-IN')}</>
        )}
      </div>
    </div>
  );
}

'use client';

import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  BadgeCheck,
  Briefcase,
  CheckCircle2,
  ExternalLink,
  GraduationCap,
  Mail,
  MapPin,
  Phone,
} from 'lucide-react';
import { careerConnectApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import {
  Avatar,
  Empty,
  KeyValue,
  PageTitle,
  Panel,
  Pill,
  Skeleton,
  SkillTag,
  type Person,
} from '@/components/connect/kit';

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
  privacySettings?: { showEmail?: boolean; showPhone?: boolean };
  person?: (Person & { email?: string | null; phone?: string | null }) | null;
}

const monthYear = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : 'Present';

export default function AlumniProfileDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canVerify = hasPermission('careerConnect.alumni', 'verify');

  const { data, isLoading } = useQuery({
    queryKey: ['alumni-profile', id],
    queryFn: () => careerConnectApi.getAlumniProfile(id),
  });
  const verifyMutation = useMutation({
    mutationFn: () => careerConnectApi.verifyAlumniProfile(id),
    onSuccess: () => {
      toast.success('Profile verified');
      queryClient.invalidateQueries({ queryKey: ['alumni-profile', id] });
      queryClient.invalidateQueries({ queryKey: ['alumni-profiles'] });
    },
    onError: () => toast.error('Could not verify the profile'),
  });

  const profile = data?.data as AlumniProfileDetail | undefined;
  if (isLoading) {
    return (
      <Panel>
        <Skeleton rows={6} />
      </Panel>
    );
  }
  if (!profile) return <Empty icon={GraduationCap} title="Alumni profile not found" />;

  const company = profile.currentCompany || profile.company;
  const role = profile.currentRole || profile.designation;
  const linkedin = profile.linkedinUrl || profile.linkedInUrl;
  const email =
    profile.privacySettings?.showEmail === false ? null : profile.email || profile.person?.email;
  const phone =
    profile.privacySettings?.showPhone === false ? null : profile.phone || profile.person?.phone;
  const history = profile.careerHistory?.length
    ? profile.careerHistory
    : company
      ? [
          {
            company,
            role: role ?? 'Team member',
            startDate: `${profile.graduationYear ?? new Date().getFullYear()}-07-01`,
            isCurrent: true,
          },
        ]
      : [];

  return (
    <div className="space-y-6">
      <PageTitle
        crumbs={[
          { label: 'Alumni network', href: '/career-connect/alumni/directory' },
          { label: profile.studentName },
        ]}
        title={profile.studentName}
        description={[role, company].filter(Boolean).join(' at ') || 'Alumnus'}
        actions={
          canVerify && !profile.isVerified ? (
            <Button
              size="sm"
              onClick={() => verifyMutation.mutate()}
              disabled={verifyMutation.isPending}
            >
              <CheckCircle2 className="mr-1.5 h-4 w-4" />
              {verifyMutation.isPending ? 'Verifying…' : 'Verify profile'}
            </Button>
          ) : null
        }
      />

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-6">
          <Panel>
            <div className="flex flex-col items-center text-center">
              <Avatar
                person={{ name: profile.studentName, photo: profile.person?.photo }}
                size={96}
              />
              <p className="mt-3 flex items-center gap-1 text-lg font-semibold tracking-tight">
                {profile.studentName}
                {profile.isVerified && (
                  <BadgeCheck className="h-5 w-5 text-primary" aria-label="Verified" />
                )}
              </p>
              <p className="text-sm text-muted-foreground">
                {[role, company].filter(Boolean).join(' · ') || 'Alumnus'}
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                {profile.mentorshipInfo?.willingToMentor && <Pill tone="green">Mentor</Pill>}
                {profile.willingToReferStudents && <Pill tone="blue">Gives referrals</Pill>}
              </div>
            </div>
            <div className="mt-5 space-y-2 border-t border-border/70 pt-4 text-sm">
              <p className="flex items-center gap-2 text-muted-foreground">
                <GraduationCap className="h-4 w-4" />
                {[
                  profile.person?.program,
                  profile.graduationYear && `Class of ${profile.graduationYear}`,
                ]
                  .filter(Boolean)
                  .join(' · ') || '—'}
              </p>
              {profile.location && (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  {profile.location}
                </p>
              )}
              {email && (
                <a
                  href={`mailto:${email}`}
                  className="flex items-center gap-2 truncate text-muted-foreground hover:text-foreground"
                >
                  <Mail className="h-4 w-4 shrink-0" />
                  {email}
                </a>
              )}
              {phone && (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  {phone}
                </p>
              )}
              {linkedin && (
                <a
                  href={linkedin}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-primary hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  LinkedIn
                </a>
              )}
            </div>
          </Panel>

          {profile.mentorshipInfo?.willingToMentor && (
            <Panel title="Mentoring">
              <KeyValue
                cols={1}
                items={[
                  [
                    'Can help with',
                    profile.mentorshipInfo.expertise?.join(', ') ||
                      profile.mentorshipInfo.areas?.join(', ') ||
                      'General career guidance',
                  ],
                  ['Availability', profile.mentorshipInfo.availability || 'Flexible'],
                  [
                    'Mentees',
                    profile.mentorshipInfo.maxMentees
                      ? `Up to ${profile.mentorshipInfo.maxMentees}`
                      : '—',
                  ],
                ]}
              />
            </Panel>
          )}
        </aside>

        <div className="space-y-6">
          {profile.bio && (
            <Panel title="About">
              <p className="text-sm leading-relaxed text-muted-foreground">{profile.bio}</p>
            </Panel>
          )}

          <Panel title="Career">
            {history.length ? (
              <ol className="relative space-y-5 border-l border-border/70 pl-5">
                {history.map((h, i) => (
                  <li key={i} className="relative">
                    <span
                      className={`absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-card ${h.isCurrent ? 'bg-primary' : 'bg-muted-foreground/40'}`}
                    />
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{h.role}</p>
                        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Briefcase className="h-3.5 w-3.5" />
                          {h.company}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {monthYear(h.startDate)} – {h.isCurrent ? 'Present' : monthYear(h.endDate)}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">No career history shared yet.</p>
            )}
          </Panel>

          {profile.higherEducation?.length ? (
            <Panel title="Further study">
              <ul className="space-y-3">
                {profile.higherEducation.map((e, i) => (
                  <li key={i}>
                    <p className="font-medium">
                      {e.degree}, {e.field}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {e.institution} · {e.startYear}–{e.endYear ?? 'Present'}
                    </p>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          {(profile.skills?.length || profile.achievements?.length) && (
            <div className="grid gap-6 md:grid-cols-2">
              {profile.skills?.length ? (
                <Panel title="Skills">
                  <div className="flex flex-wrap gap-1.5">
                    {profile.skills.map((s) => (
                      <SkillTag key={s}>{s}</SkillTag>
                    ))}
                  </div>
                </Panel>
              ) : null}
              {profile.achievements?.length ? (
                <Panel title="Achievements">
                  <ul className="list-disc space-y-1.5 pl-4 text-sm text-muted-foreground">
                    {profile.achievements.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </Panel>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

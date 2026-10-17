'use client';

import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Building2,
  GraduationCap,
  FileText,
  UserCheck,
  Heart,
  Handshake,
  BarChart3,
} from 'lucide-react';
import Link from 'next/link';

const sections = [
  {
    title: 'Companies',
    description: 'Manage placement partner companies and HR contacts',
    href: '/career-connect/companies',
    icon: Building2,
    permission: { module: 'careerConnect.companies', action: 'view' },
  },
  {
    title: 'Placement Drives',
    description: 'Organize campus drives, manage rounds and offers',
    href: '/career-connect/drives',
    icon: GraduationCap,
    permission: { module: 'careerConnect.drives', action: 'view' },
  },
  {
    title: 'Job Board',
    description: 'Post job opportunities and manage applications',
    href: '/career-connect/job-board',
    icon: FileText,
    permission: { module: 'careerConnect.jobBoard', action: 'view' },
  },
  {
    title: 'Student Profiles',
    description: 'Career profiles, skills, and placement preferences',
    href: '/career-connect/student-profile',
    icon: UserCheck,
    permission: { module: 'careerConnect.studentProfiles', action: 'view' },
  },
  {
    title: 'Counseling',
    description: 'Career counseling sessions, assessments, and resources',
    href: '/career-connect/counseling',
    icon: Heart,
    permission: { module: 'careerConnect.counseling', action: 'view' },
  },
  {
    title: 'Alumni Network',
    description: 'Alumni directory, mentorship, referrals, and events',
    href: '/career-connect/alumni/directory',
    icon: Handshake,
    permission: { module: 'careerConnect.alumni', action: 'view' },
  },
  {
    title: 'Reports',
    description: 'Placement statistics, trends, and analytics',
    href: '/career-connect/reports',
    icon: BarChart3,
    permission: { module: 'careerConnect.reports', action: 'view' },
  },
  // TODO: Settings page - backend not yet implemented
  // {
  //   title: 'Settings',
  //   description: 'Module configuration and preferences',
  //   href: '/career-connect/settings',
  //   icon: Settings,
  //   permission: { module: 'careerConnect.settings', action: 'view' },
  // },
];

export default function CareerConnectPage() {
  const { hasPermission } = usePermissions();

  const visibleSections = sections.filter((s) =>
    hasPermission(s.permission.module, s.permission.action)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Career Connect</h1>
        <p className="text-muted-foreground">
          Manage placements, career services, and alumni network
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visibleSections.map((section) => (
          <Link key={section.href} href={section.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <section.icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-base">{section.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{section.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

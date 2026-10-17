'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePermissions } from '@/hooks/usePermissions';
import { CurriculumTab } from './components/CurriculumTab';
import { RegistrationsTab } from './components/RegistrationsTab';

/**
 * Course Registration — one page, two tabs:
 *   Registrations (operational, the daily view) · Curriculum (setup, per semester)
 *
 * Semesters themselves live in Organization → Academic Structure: they divide
 * the academic year, and registration is only one of their consumers.
 */
export default function CourseRegistrationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasPermission } = usePermissions();

  const canViewCurriculum = hasPermission('registration.schemes', 'view');
  const canViewRegistrations = hasPermission('registration.registrations', 'view');

  // Tab is derived from the URL (not mirrored in state) so deep links work and
  // there's only one source of truth. Defaults to the operational view.
  const tab =
    searchParams.get('tab') === 'curriculum' || !canViewRegistrations
      ? 'curriculum'
      : 'registrations';

  const selectTab = (next: string) => {
    router.replace(next === 'curriculum' ? '/registration?tab=curriculum' : '/registration', {
      scroll: false,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Course Registration"
        description="Publish what each department studies per semester, then track who has registered."
      />

      <Tabs value={tab} onValueChange={selectTab}>
        <TabsList>
          {canViewRegistrations && <TabsTrigger value="registrations">Registrations</TabsTrigger>}
          {canViewCurriculum && <TabsTrigger value="curriculum">Curriculum</TabsTrigger>}
        </TabsList>

        {canViewRegistrations && (
          <TabsContent value="registrations" className="mt-4">
            <RegistrationsTab onGoToCurriculum={() => selectTab('curriculum')} />
          </TabsContent>
        )}

        {canViewCurriculum && (
          <TabsContent value="curriculum" className="mt-4">
            <CurriculumTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

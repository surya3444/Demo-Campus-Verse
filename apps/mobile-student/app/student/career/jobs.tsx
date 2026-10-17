import { useState } from 'react';
import { View, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Text, Pill, EmptyState, Segmented, color } from '@campus-verse/mobile-shared/design';
import { careerConnectApi, type Job } from '@/api/careerConnect';

/**
 * Job board — classified ads page.
 *
 * Each posting is rendered like a magazine classified: company in mono-kicker,
 * role as italic display, location/skills as a quiet caption, and a tagline
 * for the application deadline.
 */

type Segment = 'all' | 'fulltime' | 'internship';

function formatINR(n?: number) {
  if (!n) return '—';
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
}

function daysUntil(date: string): string {
  const d = Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (d < 0) return 'closed';
  if (d === 0) return 'closes today';
  if (d === 1) return '1 day left';
  return `${d} days left`;
}

export default function JobBoard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [segment, setSegment] = useState<Segment>('all');
  const [refreshing, setRefreshing] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ['cc-jobs', segment],
    queryFn: () =>
      careerConnectApi.getJobs({
        status: 'open',
        jobType: segment === 'all' ? undefined : segment,
        limit: 50,
      }),
  });

  const jobs = data?.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: color.paper }}>
      <StatusBar style="dark" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await refetch();
              setRefreshing(false);
            }}
            tintColor={color.ink}
          />
        }
        contentContainerStyle={{
          paddingTop: insets.top + 18,
          paddingBottom: 60,
          paddingHorizontal: 22,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Text variant="micro" tone="inkMute">
            ← Back to Career Connect
          </Text>
        </TouchableOpacity>
        <View style={{ height: 22 }} />
        <Text variant="eyebrow" tone="marigold">
          Classifieds · Vol III
        </Text>
        <View style={{ height: 10 }} />
        <Text variant="hero" tone="ink">
          The job
        </Text>
        <Text variant="hero" tone="ink" italic>
          board.
        </Text>
        <View style={{ height: 20 }} />

        <Segmented<Segment>
          segments={[
            { key: 'all', label: 'All', count: jobs.length },
            { key: 'fulltime', label: 'Full-time' },
            { key: 'internship', label: 'Internships' },
          ]}
          value={segment}
          onChange={setSegment}
        />

        <View style={{ height: 14 }} />

        {jobs.length === 0 ? (
          <EmptyState
            eyebrow="No advertisers this week"
            title="The board is quiet."
            description="When the placement cell posts a new role, it will appear here."
          />
        ) : (
          jobs.map((j, i) => <JobCard key={j._id} job={j} idx={i + 1} />)
        )}
      </ScrollView>
    </View>
  );
}

function JobCard({ job, idx }: { job: Job; idx: number }) {
  const router = useRouter();
  return (
    <TouchableOpacity
      activeOpacity={0.6}
      onPress={() => router.push(`/student/career/job?id=${job._id}` as never)}
    >
      <View
        style={{
          paddingVertical: 22,
          borderBottomWidth: 1,
          borderBottomColor: color.rule,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Text variant="kicker" tone="inkFaint" style={{ marginRight: 10 }}>
            {String(idx).padStart(2, '0')}
          </Text>
          <Text variant="eyebrow" tone="indigo">
            {job.companyName ?? 'Company'}
          </Text>
          {job.applicationDeadline && (
            <>
              <View style={{ flex: 1 }} />
              <Text variant="micro" tone="brick">
                {daysUntil(job.applicationDeadline)}
              </Text>
            </>
          )}
        </View>
        <View style={{ height: 6 }} />
        <Text variant="h1" tone="ink" italic>
          {job.title}
        </Text>
        <View style={{ height: 8 }} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {job.jobType && <Pill label={job.jobType.replace('_', ' ')} tone="marigold" size="xs" />}
          {job.location && <Pill label={job.location} tone="neutral" size="xs" />}
          {job.salaryRange?.min && (
            <Pill
              label={`${formatINR(job.salaryRange.min)} – ${formatINR(job.salaryRange.max)}`}
              tone="sage"
              size="xs"
            />
          )}
        </View>
        {job.skills && job.skills.length > 0 && (
          <Text variant="caption" tone="inkMute" style={{ marginTop: 10 }} numberOfLines={1}>
            Skills · {job.skills.slice(0, 5).join(' · ')}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

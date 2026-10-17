import { View, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Text, Rule, Pill, EmptyState, color } from '@campus-verse/mobile-shared/design';
import { careerConnectApi, type JobApplication } from '@/api/careerConnect';

const STATUS_TONE: Record<
  JobApplication['status'],
  'marigold' | 'indigo' | 'sage' | 'brick' | 'neutral'
> = {
  submitted: 'indigo',
  shortlisted: 'marigold',
  selected: 'sage',
  offered: 'sage',
  rejected: 'brick',
  withdrawn: 'neutral',
};

export default function MyApplications() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data: apps = [] } = useQuery({
    queryKey: ['cc-my-applications'],
    queryFn: () => careerConnectApi.myApplications(),
  });

  // Group by status for a "timeline" feel
  const grouped: Record<string, JobApplication[]> = {};
  for (const a of apps) {
    grouped[a.status] = grouped[a.status] || [];
    grouped[a.status].push(a);
  }

  const order: JobApplication['status'][] = [
    'shortlisted',
    'selected',
    'offered',
    'submitted',
    'rejected',
    'withdrawn',
  ];

  return (
    <View style={{ flex: 1, backgroundColor: color.paper }}>
      <StatusBar style="dark" />
      <ScrollView
        showsVerticalScrollIndicator={false}
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
          Trail · Folio III·B
        </Text>
        <View style={{ height: 10 }} />
        <Text variant="hero" tone="ink">
          Your
        </Text>
        <Text variant="hero" tone="ink" italic>
          applications.
        </Text>
        <View style={{ height: 20 }} />

        {/* Counts strip */}
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Text variant="numLarge" tone="ink">
            {String(apps.length).padStart(2, '0')}
          </Text>
          <Text variant="caption" tone="inkMute" style={{ marginLeft: 8, marginBottom: 8 }}>
            applications · {grouped.shortlisted?.length ?? 0} shortlisted ·{' '}
            {(grouped.selected?.length ?? 0) + (grouped.offered?.length ?? 0)} offers
          </Text>
        </View>
        <View style={{ height: 24 }} />
        <Rule tone="ink" />

        {apps.length === 0 ? (
          <EmptyState
            eyebrow="Fresh page"
            title="No applications yet."
            description="Apply to a role from the Job board to start tracking it here."
          />
        ) : (
          order.map((status) => {
            const list = grouped[status] ?? [];
            if (list.length === 0) return null;
            return (
              <View key={status} style={{ marginTop: 26 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                  <Text variant="eyebrow" tone="inkFaint">
                    {status.replace('_', ' ')}
                  </Text>
                  <Text variant="micro" tone="inkFaint" style={{ marginLeft: 8 }}>
                    · {list.length}
                  </Text>
                </View>
                <View style={{ height: 8 }} />
                <Rule />
                {list.map((a, i) => (
                  <View
                    key={a._id}
                    style={{
                      flexDirection: 'row',
                      paddingVertical: 16,
                      borderBottomWidth: 1,
                      borderBottomColor: color.rule,
                    }}
                  >
                    <Text variant="kicker" tone="inkFaint" style={{ width: 30 }}>
                      {String(i + 1).padStart(2, '0')}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text variant="h3" tone="ink" italic>
                        {a.job?.title ?? 'Job'}
                      </Text>
                      <Text variant="caption" tone="inkMute" style={{ marginTop: 2 }}>
                        {a.job?.companyName ?? 'Company'} · applied{' '}
                        {new Date(a.appliedAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </Text>
                    </View>
                    <Pill label={a.status} tone={STATUS_TONE[a.status]} size="xs" />
                  </View>
                ))}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

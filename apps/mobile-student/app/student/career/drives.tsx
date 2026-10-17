import { View, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Text, Rule, Pill, EmptyState, color } from '@campus-verse/mobile-shared/design';
import { careerConnectApi } from '@/api/careerConnect';

export default function Drives() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data } = useQuery({
    queryKey: ['cc-drives-all'],
    queryFn: () => careerConnectApi.getDrives(),
  });

  const drives = data?.data ?? [];
  const upcoming = drives.filter((d) => d.status === 'scheduled' || d.status === 'in_progress');
  const past = drives.filter((d) => d.status === 'completed');

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
          Diary · Vol III·C
        </Text>
        <View style={{ height: 10 }} />
        <Text variant="hero" tone="ink">
          Placement
        </Text>
        <Text variant="hero" tone="ink" italic>
          drives.
        </Text>
        <View style={{ height: 20 }} />

        <Text variant="eyebrow" tone="inkFaint">
          On the calendar · {upcoming.length}
        </Text>
        <View style={{ height: 8 }} />
        <Rule tone="ink" />

        {upcoming.length === 0 ? (
          <EmptyState
            eyebrow="Empty diary"
            title="No drives currently scheduled."
            description="The placement office will announce upcoming drives here."
          />
        ) : (
          upcoming.map((d, i) => (
            <View
              key={d._id}
              style={{
                paddingVertical: 22,
                borderBottomWidth: 1,
                borderBottomColor: color.rule,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <Text variant="kicker" tone="inkFaint" style={{ marginRight: 10 }}>
                  {String(i + 1).padStart(2, '0')}
                </Text>
                <Text variant="eyebrow" tone="indigo">
                  {d.companyName ?? 'Company'} · {d.driveType ?? 'on-campus'}
                </Text>
              </View>
              <View style={{ height: 6 }} />
              <Text variant="h1" tone="ink" italic>
                {d.title}
              </Text>
              <View style={{ height: 12 }} />
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text variant="numSmall" tone="ink">
                  {new Date(d.driveDate).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </Text>
                <View style={{ flex: 1 }} />
                {d.registrationOpen ? (
                  <Pill label="Register open" tone="marigold" size="xs" />
                ) : (
                  <Pill label={d.status} tone="neutral" size="xs" />
                )}
              </View>
              {d.rounds && d.rounds.length > 0 && (
                <Text variant="caption" tone="inkMute" style={{ marginTop: 10 }}>
                  {d.rounds.length} round{d.rounds.length === 1 ? '' : 's'} ·{' '}
                  {d.rounds.map((r) => r.name).join(' → ')}
                </Text>
              )}
            </View>
          ))
        )}

        {past.length > 0 && (
          <View style={{ marginTop: 36 }}>
            <Text variant="eyebrow" tone="inkFaint">
              Past · {past.length}
            </Text>
            <View style={{ height: 8 }} />
            <Rule />
            {past.slice(0, 6).map((d, i) => (
              <View
                key={d._id}
                style={{
                  flexDirection: 'row',
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: color.rule,
                }}
              >
                <Text variant="kicker" tone="inkGhost" style={{ width: 30 }}>
                  {String(i + 1).padStart(2, '0')}
                </Text>
                <Text variant="bodyStrong" tone="inkMute" style={{ flex: 1 }}>
                  {d.title}
                </Text>
                <Text variant="micro" tone="inkFaint">
                  {new Date(d.driveDate).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

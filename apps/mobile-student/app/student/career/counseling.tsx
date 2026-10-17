import { View, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Text, Rule, EmptyState, Card, color } from '@campus-verse/mobile-shared/design';
import { careerConnectApi } from '@/api/careerConnect';

export default function Counseling() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data: sessions = [] } = useQuery({
    queryKey: ['cc-counseling'],
    queryFn: () => careerConnectApi.getCounselingSessions(),
  });

  const upcoming = sessions.filter(
    (s) => s.status === 'scheduled' && new Date(s.scheduledAt) > new Date()
  );
  const past = sessions.filter((s) => s.status === 'completed');

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
          Office hours · Vol III·D
        </Text>
        <View style={{ height: 10 }} />
        <Text variant="hero" tone="ink">
          Talk it
        </Text>
        <Text variant="hero" tone="ink" italic>
          over.
        </Text>
        <View style={{ height: 18 }} />
        <Text variant="body" tone="inkMute" italic style={{ maxWidth: 320 }}>
          One-to-one sessions with the placement & guidance team. Bring a question, a draft, or just
          a knot to untie.
        </Text>
        <View style={{ height: 24 }} />
        <Rule tone="ink" />

        {/* Upcoming */}
        <View style={{ marginTop: 24, marginBottom: 8 }}>
          <Text variant="eyebrow" tone="inkFaint">
            Upcoming · {upcoming.length}
          </Text>
        </View>

        {upcoming.length === 0 ? (
          <EmptyState
            eyebrow="No appointments"
            title="Nothing booked."
            description="The counseling cell will publish bookable slots here. Watch this space."
          />
        ) : (
          upcoming.map((s, i) => (
            <Card key={s._id} variant="paper" rounded="md" padded={18} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text variant="eyebrow" tone="indigo">
                    Session {String(i + 1).padStart(2, '0')} · {s.mode.replace('_', ' ')}
                  </Text>
                  <View style={{ height: 6 }} />
                  <Text variant="h2" tone="ink" italic>
                    {s.topic}
                  </Text>
                  <Text variant="caption" tone="inkMute" style={{ marginTop: 6 }}>
                    With {s.counselorName ?? 'Counselor'} · {s.durationMinutes} min
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text variant="eyebrow" tone="inkFaint">
                    {new Date(s.scheduledAt)
                      .toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                      .toUpperCase()}
                  </Text>
                  <Text variant="numMid" tone="ink">
                    {new Date(s.scheduledAt).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false,
                    })}
                  </Text>
                </View>
              </View>
            </Card>
          ))
        )}

        {/* Past */}
        {past.length > 0 && (
          <View style={{ marginTop: 28 }}>
            <Text variant="eyebrow" tone="inkFaint">
              Past · {past.length}
            </Text>
            <View style={{ height: 8 }} />
            <Rule />
            {past.slice(0, 8).map((s, i) => (
              <View
                key={s._id}
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
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong" tone="inkMute">
                    {s.topic}
                  </Text>
                  <Text variant="micro" tone="inkFaint" style={{ marginTop: 2 }}>
                    {s.counselorName ?? 'Counselor'}
                  </Text>
                </View>
                <Text variant="micro" tone="inkFaint">
                  {new Date(s.scheduledAt).toLocaleDateString('en-IN', {
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

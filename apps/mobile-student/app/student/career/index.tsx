import { View, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Text, Rule, Card, color } from '@campus-verse/mobile-shared/design';
import { careerConnectApi } from '@/api/careerConnect';

/**
 * Career Connect — hub.
 *
 * The hub is set like a periodical cover: four chapters down the page, each
 * a routable destination. The hero block carries a kicker, an italic display
 * title, and a tagline. Below: counts pulled from live data.
 */

export default function CareerHub() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data: jobs } = useQuery({
    queryKey: ['cc-jobs-open'],
    queryFn: () => careerConnectApi.getJobs({ status: 'open', limit: 50 }),
  });
  const { data: myApps } = useQuery({
    queryKey: ['cc-my-applications'],
    queryFn: () => careerConnectApi.myApplications(),
  });
  const { data: drives } = useQuery({
    queryKey: ['cc-drives'],
    queryFn: () => careerConnectApi.getDrives({ status: 'scheduled' }),
  });
  const { data: sessions } = useQuery({
    queryKey: ['cc-sessions'],
    queryFn: () => careerConnectApi.getCounselingSessions(),
  });

  const upcomingSessions = (sessions ?? []).filter(
    (s) => s.status === 'scheduled' && new Date(s.scheduledAt) > new Date()
  );

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
            ← Back
          </Text>
        </TouchableOpacity>
        <View style={{ height: 24 }} />

        {/* Cover */}
        <Text variant="eyebrow" tone="marigold">
          Career Connect · Special supplement
        </Text>
        <View style={{ height: 12 }} />
        <Text variant="hero" tone="ink">
          Where
        </Text>
        <Text variant="hero" tone="ink" italic>
          next?
        </Text>
        <View style={{ height: 16 }} />
        <Text variant="body" tone="inkMute" italic style={{ maxWidth: 320 }}>
          Companies in conversation with the placement cell, counselors on call, and the work you
          are already weighing up.
        </Text>
        <View style={{ height: 24 }} />
        <Rule tone="ink" />

        {/* Chapter rows */}
        <Chapter
          num="01"
          title="Job board"
          byline={`${jobs?.data?.length ?? 0} live openings`}
          accent="marigold"
          onPress={() => router.push('/student/career/jobs' as never)}
        />
        <Chapter
          num="02"
          title="My applications"
          byline={`${myApps?.length ?? 0} in progress`}
          accent="indigo"
          onPress={() => router.push('/student/career/applications' as never)}
        />
        <Chapter
          num="03"
          title="Drives"
          byline={`${drives?.data?.length ?? 0} upcoming on campus`}
          accent="sage"
          onPress={() => router.push('/student/career/drives' as never)}
        />
        <Chapter
          num="04"
          title="Counseling"
          byline={`${upcomingSessions.length} session${
            upcomingSessions.length === 1 ? '' : 's'
          } scheduled`}
          accent="brick"
          onPress={() => router.push('/student/career/counseling' as never)}
        />

        <View style={{ height: 36 }} />
        <Card variant="ink" rounded="md" padded={22}>
          <Text variant="eyebrow" tone="onInkFaint">
            Tip from the desk
          </Text>
          <View style={{ height: 8 }} />
          <Text variant="h2" tone="onInk" italic>
            Apply early, often, narrow.
          </Text>
          <Text variant="caption" tone="onInkMute" style={{ marginTop: 8 }}>
            The strongest signal is a thoughtful note for one company, not a scattergun across
            fifty.
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
}

function Chapter({
  num,
  title,
  byline,
  accent,
  onPress,
}: {
  num: string;
  title: string;
  byline: string;
  accent: 'marigold' | 'indigo' | 'sage' | 'brick';
  onPress: () => void;
}) {
  return (
    <TouchableOpacity activeOpacity={0.6} onPress={onPress}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          paddingVertical: 22,
          borderBottomWidth: 1,
          borderBottomColor: color.rule,
        }}
      >
        <View style={{ width: 50 }}>
          <Text variant="numMid" tone="ink">
            {num}
          </Text>
          <View
            style={{
              width: 16,
              height: 2,
              backgroundColor:
                accent === 'marigold'
                  ? color.marigold
                  : accent === 'indigo'
                    ? color.indigo
                    : accent === 'sage'
                      ? color.sage
                      : color.brick,
              marginTop: 6,
            }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="h1" tone="ink" italic>
            {title}
          </Text>
          <Text variant="caption" tone="inkMute" style={{ marginTop: 4 }}>
            {byline}
          </Text>
        </View>
        <Text variant="h2" tone="inkGhost" style={{ marginTop: 6 }}>
          →
        </Text>
      </View>
    </TouchableOpacity>
  );
}

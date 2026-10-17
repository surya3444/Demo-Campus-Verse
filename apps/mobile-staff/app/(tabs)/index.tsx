import { useState, useCallback } from 'react';
import { View, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text, Rule, Card, Stat, SectionHead, color } from '@campus-verse/mobile-shared/design';
import { useAuthStore } from '@campus-verse/mobile-shared/store/authStore';
import { teachingApi } from '@/api/teaching';

/**
 * Staff "Today" — the desk.
 *
 * Opens like a teacher's day-page: greeting, the next class, three deck
 * cards for the most-used actions (Roll, Approvals, Visitors), then a list
 * of today's periods. The page is calm, dense, and built around verbs.
 */

export default function StaffToday() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const user = useAuthStore((s) => s.user);
  const profile = (user as unknown as Record<string, unknown>)?.profile as
    | Record<string, string>
    | undefined;
  const displayName = profile?.displayName || profile?.firstName || user?.displayName || 'Teacher';
  const [firstName] = displayName.split(' ');

  const now = new Date();
  const hr = now.getHours();
  const greeting = hr < 12 ? 'Good morning,' : hr < 17 ? 'Good afternoon,' : 'Good evening,';
  const dateStr = now
    .toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
    .toUpperCase();

  const { data: myClasses = [], refetch } = useQuery({
    queryKey: ['my-classes'],
    queryFn: () => teachingApi.getMyClasses(),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Heuristic — current period inferred from time of day. Real data comes from timetable.
  const period = Math.min(7, Math.max(1, Math.floor((hr - 8) * 1.2) + 1));

  return (
    <View style={{ flex: 1, backgroundColor: color.paper }}>
      <StatusBar style="dark" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.ink} />
        }
        contentContainerStyle={{
          paddingTop: insets.top + 18,
          paddingBottom: 140,
          paddingHorizontal: 22,
        }}
      >
        {/* Masthead */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 }}>
          <Text variant="eyebrow" tone="inkFaint">
            Campus Verse · Staff
          </Text>
          <Text variant="eyebrow" tone="inkFaint">
            Period {String(period).padStart(2, '0')}
          </Text>
        </View>

        <Text variant="eyebrow" tone="marigold">
          {dateStr}
        </Text>
        <View style={{ height: 12 }} />
        <Text variant="hero" tone="ink">
          {greeting}
        </Text>
        <Text variant="hero" tone="ink" italic>
          {firstName}.
        </Text>

        <View style={{ height: 22 }} />
        <Rule tone="ink" />

        {/* Three-up ledger */}
        <View style={{ flexDirection: 'row', marginTop: 22 }}>
          <Stat
            label="Classes today"
            value={String(myClasses.length).padStart(2, '0')}
            onPress={() => router.push('/(tabs)/timetable' as never)}
          />
          <View style={{ width: 1, backgroundColor: color.rule, marginHorizontal: 14 }} />
          <Stat
            label="To grade"
            value="07"
            accent="marigold"
            onPress={() => router.push('/(tabs)/grades' as never)}
          />
          <View style={{ width: 1, backgroundColor: color.rule, marginHorizontal: 14 }} />
          <Stat
            label="Pending"
            value="02"
            accent="brick"
            onPress={() => router.push('/approvals' as never)}
          />
        </View>
        <View style={{ height: 18 }} />
        <Rule />

        {/* The deck of actions */}
        <SectionHead index="01" title="On the desk" italic />
        <View style={{ gap: 12 }}>
          <ActionCard
            kicker="Next up · Period {period}"
            title="Mark the roll"
            byline="Open the section register for this period and submit by 11:25."
            accent="marigold"
            onPress={() => router.push('/attendance/mark' as never)}
          />
          <ActionCard
            kicker="Inbox · 5 pending"
            title="Approve & decline"
            byline="Leave, expense and concession requests waiting on your signature."
            accent="indigo"
            onPress={() => router.push('/approvals' as never)}
          />
          <ActionCard
            kicker="Gatehouse"
            title="Register a visitor"
            byline="Parent or vendor at the gate? Capture name, photo and issue a pass."
            accent="sage"
            onPress={() => router.push('/visitors' as never)}
          />
        </View>

        {/* Other shortcuts */}
        <SectionHead index="02" title="Elsewhere on campus" italic />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[
            { label: 'Check in / out', route: '/hr/checkin' },
            { label: 'Send notice', route: '/comms/composer' },
            { label: 'Fee counter', route: '/finance/counter' },
            { label: 'Submit a bill', route: '/expense/new' },
            { label: 'My expenses', route: '/expense' },
            { label: 'My payslips', route: '/hr/payslips' },
            { label: 'My leaves', route: '/hr/leaves' },
            { label: 'School calendar', route: '/school/calendar' },
          ].map((s) => (
            <TouchableOpacity
              key={s.label}
              activeOpacity={0.7}
              onPress={() => router.push(s.route as never)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 999,
                borderWidth: 1.5,
                borderColor: color.rule,
                backgroundColor: 'transparent',
              }}
            >
              <Text variant="micro" tone="ink">
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Today's schedule (lightweight) */}
        <SectionHead
          index="03"
          title="Your classes today"
          italic
          action="Full timetable"
          onAction={() => router.push('/(tabs)/timetable' as never)}
        />
        {myClasses.length === 0 ? (
          <Text variant="body" tone="inkMute" italic>
            No classes assigned today — catch up on grading, or take a moment.
          </Text>
        ) : (
          myClasses.slice(0, 6).map((cls, i) => (
            <View
              key={cls.sectionId || String(i)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: color.rule,
              }}
            >
              <Text variant="kicker" tone="inkFaint" style={{ width: 32 }}>
                {String(i + 1).padStart(2, '0')}
              </Text>
              <View style={{ flex: 1 }}>
                <Text variant="h3" tone="ink" italic>
                  {cls.subjectNames?.[0] || cls.sectionName || 'Class'}
                </Text>
                <Text variant="caption" tone="inkMute" style={{ marginTop: 2 }}>
                  {cls.className} · {cls.sectionName}
                </Text>
              </View>
              <Text variant="micro" tone="ink">
                →
              </Text>
            </View>
          ))
        )}

        {/* Colophon */}
        <View style={{ marginTop: 36, alignItems: 'center' }}>
          <Text variant="micro" tone="inkGhost">
            — End of today's page —
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function ActionCard({
  kicker,
  title,
  byline,
  accent,
  onPress,
}: {
  kicker: string;
  title: string;
  byline: string;
  accent: 'marigold' | 'indigo' | 'sage';
  onPress: () => void;
}) {
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
      <Card variant="paper" rounded="md" padded={18}>
        <View style={{ flexDirection: 'row' }}>
          <View
            style={{
              width: 4,
              borderRadius: 2,
              backgroundColor: color[accent],
              marginRight: 14,
            }}
          />
          <View style={{ flex: 1 }}>
            <Text variant="eyebrow" tone={accent}>
              {kicker.replace('{period}', '')}
            </Text>
            <View style={{ height: 6 }} />
            <Text variant="h1" tone="ink" italic>
              {title}
            </Text>
            <Text variant="caption" tone="inkMute" style={{ marginTop: 6 }}>
              {byline}
            </Text>
          </View>
          <Text variant="h2" tone="inkGhost" style={{ marginLeft: 8, marginTop: 8 }}>
            →
          </Text>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

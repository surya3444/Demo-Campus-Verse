import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { liveClassApi, LiveClass } from '@campus-verse/mobile-shared';

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Upcoming',
  live: 'Live',
  ended: 'Ended',
  cancelled: 'Cancelled',
};
const STATUS_STYLES: Record<string, { bg: string; fg: string }> = {
  scheduled: { bg: '#dbeafe', fg: '#1d4ed8' },
  live: { bg: '#fee2e2', fg: '#dc2626' },
  ended: { bg: '#e5e7eb', fg: '#374151' },
  cancelled: { bg: '#fed7aa', fg: '#c2410c' },
};

export default function LiveClassesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'upcoming' | 'live' | 'past'>('upcoming');

  const filterFor = (t: typeof tab) =>
    t === 'live'
      ? { status: 'live' }
      : t === 'upcoming'
        ? { status: 'scheduled' }
        : { status: 'ended' };

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['mobile-live-classes', tab],
    queryFn: () => liveClassApi.list({ ...filterFor(tab), mine: true }),
    refetchInterval: tab === 'live' ? 5000 : false,
  });
  const classes: LiveClass[] = data?.data || [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 8 }}>
          <Ionicons name="chevron-back" size={26} color="#111827" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Live Classes</Text>
        <TouchableOpacity
          onPress={() => router.push('/teaching/live-class-form' as never)}
          style={s.scheduleBtn}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={s.scheduleText}>Schedule</Text>
        </TouchableOpacity>
      </View>

      <View style={s.tabs}>
        {(['upcoming', 'live', 'past'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            style={[s.tab, tab === t && s.tabActive]}
          >
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>
              {t === 'upcoming' ? 'Upcoming' : t === 'live' ? 'Live now' : 'Past'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 90 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {isLoading ? (
          <ActivityIndicator color="#4f46e5" style={{ marginTop: 30 }} />
        ) : classes.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="videocam-outline" size={42} color="#cbd5e1" />
            <Text style={s.emptyText}>
              {tab === 'live'
                ? 'No live classes right now'
                : tab === 'upcoming'
                  ? 'No upcoming classes'
                  : 'No past classes'}
            </Text>
            {tab === 'upcoming' && (
              <TouchableOpacity
                onPress={() => router.push('/teaching/live-class-form' as never)}
                style={[s.scheduleBtn, { marginTop: 12 }]}
              >
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={s.scheduleText}>Schedule live class</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          classes.map((c) => <Card key={c._id} cls={c} />)
        )}
      </ScrollView>
    </View>
  );
}

function Card({ cls }: { cls: LiveClass }) {
  const router = useRouter();
  const tone = STATUS_STYLES[cls.status] ?? STATUS_STYLES.scheduled;
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() =>
        router.push(
          `/teaching/live-class-room?id=${cls._id}&title=${encodeURIComponent(cls.title)}` as never
        )
      }
      style={s.card}
    >
      <View style={s.cardHeader}>
        <Text style={s.cardTitle} numberOfLines={2}>
          {cls.title}
        </Text>
        <View style={[s.badge, { backgroundColor: tone.bg }]}>
          <Text style={[s.badgeText, { color: tone.fg }]}>{STATUS_LABELS[cls.status]}</Text>
        </View>
      </View>
      <View style={s.cardMeta}>
        <Ionicons name="calendar-outline" size={14} color="#6b7280" />
        <Text style={s.cardMetaText}>
          {new Date(cls.scheduledStart).toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
      {cls.subjectName || cls.sectionName ? (
        <View style={s.cardMeta}>
          <Ionicons name="school-outline" size={14} color="#6b7280" />
          <Text style={s.cardMetaText}>
            {[cls.className, cls.sectionName, cls.subjectName].filter(Boolean).join(' · ')}
          </Text>
        </View>
      ) : null}
      <View style={s.cardCta}>
        <Ionicons name={cls.status === 'live' ? 'videocam' : 'play'} size={14} color="#fff" />
        <Text style={s.cardCtaText}>
          {cls.status === 'live' ? 'Continue' : cls.status === 'scheduled' ? 'Start' : 'View'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '700', color: '#111827' },
  scheduleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#4f46e5',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
  },
  scheduleText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  tabs: { flexDirection: 'row', paddingHorizontal: 12, gap: 6, marginBottom: 4 },
  tab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: '#e5e7eb' },
  tabActive: { backgroundColor: '#4f46e5' },
  tabText: { color: '#6b7280', fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  empty: { alignItems: 'center', marginTop: 40, gap: 8 },
  emptyText: { color: '#94a3b8', fontSize: 13, marginBottom: 4 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 4 },
  cardTitle: { flex: 1, fontWeight: '700', color: '#111827', fontSize: 15 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  badgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  cardMetaText: { color: '#6b7280', fontSize: 12 },
  cardCta: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4f46e5',
    paddingVertical: 9,
    borderRadius: 10,
  },
  cardCtaText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});

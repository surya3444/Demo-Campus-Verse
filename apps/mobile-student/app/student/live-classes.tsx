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
  live: 'Live now',
  ended: 'Ended',
  cancelled: 'Cancelled',
};

const STATUS_STYLES: Record<string, { bg: string; fg: string }> = {
  scheduled: { bg: '#E1ECFE', fg: '#053A94' },
  live: { bg: '#fee2e2', fg: '#dc2626' },
  ended: { bg: '#DAE0E7', fg: '#2E4470' },
  cancelled: { bg: '#fed7aa', fg: '#c2410c' },
};

export default function LiveClassesListScreen() {
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
    queryKey: ['live-classes', tab],
    queryFn: () => liveClassApi.list(filterFor(tab)),
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
          <Ionicons name="chevron-back" size={26} color="#042A6C" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Live Classes</Text>
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
          <ActivityIndicator color="#0749BB" style={{ marginTop: 30 }} />
        ) : classes.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="videocam-outline" size={42} color="#D3DAE4" />
            <Text style={s.emptyText}>
              {tab === 'live' ? 'No live classes right now' : `No ${tab} classes`}
            </Text>
          </View>
        ) : (
          classes.map((c) => (
            <ClassCard
              key={c._id}
              cls={c}
              onPress={() =>
                router.push(
                  `/student/live-class-room?id=${c._id}&title=${encodeURIComponent(c.title)}` as never
                )
              }
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function ClassCard({ cls, onPress }: { cls: LiveClass; onPress: () => void }) {
  const tone = STATUS_STYLES[cls.status] ?? STATUS_STYLES.scheduled;
  return (
    <TouchableOpacity style={s.card} activeOpacity={0.85} onPress={onPress}>
      <View style={s.cardHeader}>
        <Text style={s.cardTitle} numberOfLines={2}>
          {cls.title}
        </Text>
        <View style={[s.badge, { backgroundColor: tone.bg }]}>
          <Text style={[s.badgeText, { color: tone.fg }]}>{STATUS_LABELS[cls.status]}</Text>
        </View>
      </View>
      {cls.description ? (
        <Text style={s.cardDesc} numberOfLines={2}>
          {cls.description}
        </Text>
      ) : null}
      <View style={s.cardMeta}>
        <Ionicons name="calendar-outline" size={14} color="#526C98" />
        <Text style={s.cardMetaText}>
          {new Date(cls.scheduledStart).toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
      {cls.hostName ? (
        <View style={s.cardMeta}>
          <Ionicons name="person-outline" size={14} color="#526C98" />
          <Text style={s.cardMetaText}>Host: {cls.hostName}</Text>
        </View>
      ) : null}
      {cls.subjectName || cls.sectionName ? (
        <View style={s.cardMeta}>
          <Ionicons name="school-outline" size={14} color="#526C98" />
          <Text style={s.cardMetaText}>
            {[cls.className, cls.sectionName, cls.subjectName].filter(Boolean).join(' · ')}
          </Text>
        </View>
      ) : null}
      {(cls.status === 'live' || cls.status === 'scheduled') && (
        <View style={s.joinHint}>
          <Ionicons name="play" size={14} color="#fff" />
          <Text style={s.joinText}>{cls.status === 'live' ? 'Join now' : 'Open'}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F9F8F5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#042A6C' },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 6,
    marginBottom: 4,
  },
  tab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: '#DAE0E7' },
  tabActive: { backgroundColor: '#0749BB' },
  tabText: { color: '#526C98', fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  empty: { alignItems: 'center', marginTop: 40, gap: 8 },
  emptyText: { color: '#8998B3', fontSize: 13 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EDF0F3',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 4 },
  cardTitle: { flex: 1, fontWeight: '700', color: '#042A6C', fontSize: 15 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  badgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  cardDesc: { color: '#526C98', fontSize: 13, marginBottom: 8 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  cardMetaText: { color: '#526C98', fontSize: 12 },
  joinHint: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0749BB',
    paddingVertical: 9,
    borderRadius: 10,
  },
  joinText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});

import { useState, useCallback } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { announcementsApi, Announcement } from '@campus-verse/mobile-shared';

const TYPE_CONFIG: Record<
  string,
  { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }
> = {
  general: { icon: 'megaphone', color: '#0749BB', bg: '#E1ECFE' },
  academic: { icon: 'school', color: '#8b5cf6', bg: '#f3e8ff' },
  event: { icon: 'calendar', color: '#10b981', bg: '#d1fae5' },
  exam: { icon: 'document-text', color: '#f59e0b', bg: '#fef3c7' },
  holiday: { icon: 'sunny', color: '#ef4444', bg: '#fef2f2' },
  urgent: { icon: 'alert-circle', color: '#dc2626', bg: '#fef2f2' },
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'academic', label: 'Academic' },
  { key: 'event', label: 'Events' },
  { key: 'exam', label: 'Exams' },
  { key: 'urgent', label: 'Urgent' },
];

function fmtDate(s: string): string {
  const date = new Date(s);
  const now = new Date();
  const days = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

export default function AnnouncementsScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ['announcements-staff', filter],
    queryFn: () =>
      announcementsApi.getAnnouncements({ type: filter !== 'all' ? filter : undefined, limit: 50 }),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const list = data?.announcements || [];

  return (
    <View style={{ flex: 1, backgroundColor: '#F9F8F5' }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.filterBar}
        contentContainerStyle={{ paddingHorizontal: 16 }}
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[s.filterChip, filter === f.key && s.filterChipActive]}
            onPress={() => setFilter(f.key)}
            activeOpacity={0.8}
          >
            <Text style={[s.filterText, filter === f.key && s.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {isLoading ? (
          <ActivityIndicator color="#053495" style={{ marginVertical: 40 }} />
        ) : list.length === 0 ? (
          <View style={s.emptyCard}>
            <Ionicons name="megaphone-outline" size={36} color="#D3DAE4" />
            <Text style={s.emptyText}>No announcements</Text>
          </View>
        ) : (
          list.map((a: Announcement) => {
            const cfg = TYPE_CONFIG[a.type] || TYPE_CONFIG.general;
            return (
              <TouchableOpacity
                key={a._id}
                style={s.card}
                onPress={() => router.push(`/school/announcement-detail?id=${a._id}` as never)}
                activeOpacity={0.85}
              >
                <View style={{ flexDirection: 'row' }}>
                  <View style={[s.iconBox, { backgroundColor: cfg.bg }]}>
                    <Ionicons name={cfg.icon} size={18} color={cfg.color} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={s.title} numberOfLines={1}>
                        {a.title}
                      </Text>
                      {a.priority === 'urgent' && (
                        <View style={s.urgentPill}>
                          <Text style={s.urgentText}>URGENT</Text>
                        </View>
                      )}
                    </View>
                    <Text style={s.content} numberOfLines={2}>
                      {a.content}
                    </Text>
                    <View style={{ flexDirection: 'row', marginTop: 8, alignItems: 'center' }}>
                      <Text style={s.meta}>{fmtDate(a.publishedAt || a.createdAt)}</Text>
                      <Text style={s.metaDot}> · </Text>
                      <Text style={s.meta}>{a.createdBy?.displayName || 'Admin'}</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  filterBar: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF0F3',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    marginRight: 8,
    backgroundColor: '#EDF0F3',
  },
  filterChipActive: { backgroundColor: '#053495' },
  filterText: { fontSize: 12, fontWeight: '600', color: '#526C98' },
  filterTextActive: { color: '#fff' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EDF0F3',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, fontSize: 15, fontWeight: '700', color: '#042A6C' },
  urgentPill: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    marginLeft: 6,
  },
  urgentText: { fontSize: 9, fontWeight: '800', color: '#dc2626' },
  content: { fontSize: 13, color: '#526C98', marginTop: 4, lineHeight: 18 },
  meta: { fontSize: 11, color: '#8998B3' },
  metaDot: { fontSize: 11, color: '#D3DAE4' },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EDF0F3',
  },
  emptyText: { fontSize: 13, color: '#8998B3', marginTop: 10 },
});

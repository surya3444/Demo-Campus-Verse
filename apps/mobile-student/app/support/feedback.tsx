import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { feedbackApi } from '@campus-verse/mobile-shared';
import type { FeedbackTicket, FeedbackStatus } from '@campus-verse/mobile-shared';

const STATUS_COLORS: Record<
  FeedbackStatus,
  { bg: string; fg: string; icon: keyof typeof Ionicons.glyphMap; label: string }
> = {
  open: { bg: '#E1ECFE', fg: '#042A6C', icon: 'mail-open-outline', label: 'Open' },
  in_progress: { bg: '#fef3c7', fg: '#92400e', icon: 'time-outline', label: 'In Progress' },
  escalated: { bg: '#fee2e2', fg: '#991b1b', icon: 'alert-circle-outline', label: 'Escalated' },
  resolved: { bg: '#dcfce7', fg: '#166534', icon: 'checkmark-circle', label: 'Resolved' },
  reopened: { bg: '#fef9c3', fg: '#854d0e', icon: 'refresh-outline', label: 'Reopened' },
  closed: { bg: '#EDF0F3', fg: '#3E5683', icon: 'lock-closed-outline', label: 'Closed' },
};

const FILTERS: Array<{ key: FeedbackStatus | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'closed', label: 'Closed' },
];

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function FeedbackListScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<FeedbackStatus | 'all'>('all');
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['feedback-tickets', filter],
    queryFn: () =>
      feedbackApi.getTickets({
        limit: 50,
        ...(filter !== 'all' ? { status: filter } : {}),
      }),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const tickets = data?.data || [];

  return (
    <View style={{ flex: 1, backgroundColor: '#F9F8F5' }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ maxHeight: 58 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            onPress={() => setFilter(f.key)}
            style={[s.chip, filter === f.key && s.chipActive]}
            activeOpacity={0.8}
          >
            <Text style={[s.chipText, filter === f.key && s.chipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
      >
        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color="#0749BB" />
        ) : tickets.length === 0 ? (
          <View style={s.emptyCard}>
            <Ionicons name="chatbubbles-outline" size={40} color="#D3DAE4" />
            <Text style={s.emptyTitle}>No tickets yet</Text>
            <Text style={s.emptyText}>Submit a concern or feedback and track its status here.</Text>
          </View>
        ) : (
          tickets.map((t: FeedbackTicket) => {
            const colors = STATUS_COLORS[t.status];
            return (
              <TouchableOpacity
                key={t._id}
                style={s.card}
                activeOpacity={0.85}
                onPress={() => router.push(`/support/feedback-detail?id=${t._id}` as never)}
              >
                <View style={s.cardHeader}>
                  <Text style={s.ticketNum}>#{t.ticketNumber}</Text>
                  <View style={[s.statusPill, { backgroundColor: colors.bg }]}>
                    <Ionicons name={colors.icon} size={11} color={colors.fg} />
                    <Text style={[s.statusText, { color: colors.fg }]}>{colors.label}</Text>
                  </View>
                </View>
                <Text style={s.subject} numberOfLines={2}>
                  {t.subject}
                </Text>
                <View style={s.cardMeta}>
                  <View style={s.metaItem}>
                    <Ionicons name="pricetag-outline" size={12} color="#526C98" />
                    <Text style={s.metaText}>{t.category}</Text>
                  </View>
                  <View style={s.metaItem}>
                    <Ionicons name="chatbubble-outline" size={12} color="#526C98" />
                    <Text style={s.metaText}>{t.responses.length}</Text>
                  </View>
                  <Text style={s.dateText}>{formatDate(t.createdAt)}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <TouchableOpacity
        style={s.fab}
        onPress={() => router.push('/support/feedback-new' as never)}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={26} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#DAE0E7',
    marginRight: 8,
  },
  chipActive: { backgroundColor: '#0749BB', borderColor: '#0749BB' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#3E5683' },
  chipTextActive: { color: '#fff' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EDF0F3',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ticketNum: { fontSize: 11, fontWeight: '700', color: '#8998B3', letterSpacing: 0.5 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusText: { fontSize: 10, fontWeight: '700', marginLeft: 4 },
  subject: { fontSize: 15, fontWeight: '700', color: '#042A6C', marginTop: 8, lineHeight: 20 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, color: '#526C98', textTransform: 'capitalize' },
  dateText: { fontSize: 11, color: '#8998B3', marginLeft: 'auto' },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EDF0F3',
    marginTop: 32,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#3E5683', marginTop: 12 },
  emptyText: {
    fontSize: 13,
    color: '#8998B3',
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0749BB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0749BB',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});

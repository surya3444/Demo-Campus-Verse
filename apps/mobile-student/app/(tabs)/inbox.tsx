import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { announcementsApi } from '@campus-verse/mobile-shared/api/announcements';

/* ─────────────────────────── Tokens ─────────────────────────── */

const C = {
  bg: '#F7F8FA',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F3F7',
  border: '#EEF1F5',
  navy: '#0F172A',
  textMuted: '#64748B',
  textFaint: '#94A3B8',
  brand: '#4338CA',
  brandSoft: '#EEF2FF',
  cyan: '#06B6D4',
  cyanSoft: '#CFFAFE',
  amber: '#F59E0B',
  amberSoft: '#FEF3C7',
  emerald: '#10B981',
  emeraldSoft: '#D1FAE5',
};

const SHADOW_SOFT = Platform.select({
  ios: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
  },
  android: { elevation: 2 },
});

type Segment = 'updates' | 'calendar' | 'messages';

/* ─────────────────────────── Pieces ─────────────────────────── */

function Pill({
  active,
  label,
  count,
  onPress,
}: {
  active: boolean;
  label: string;
  count?: number;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={s.pillBtn}>
      <View
        style={[
          s.pill,
          active && { backgroundColor: C.surface, ...SHADOW_SOFT, shadowOpacity: 0.07 },
        ]}
      >
        <Text style={[s.pillLabel, { color: active ? C.navy : C.textMuted }]}>{label}</Text>
        {typeof count === 'number' && count > 0 && (
          <View style={[s.pillCount, !active && { backgroundColor: C.surfaceAlt }]}>
            <Text style={[s.pillCountText, !active && { color: C.textMuted }]}>{count}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function MessageRow({
  iconBg,
  iconFg,
  iconName,
  title,
  body,
  date,
  unread,
  onPress,
  last,
}: {
  iconBg: string;
  iconFg: string;
  iconName: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  date: string;
  unread?: boolean;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[s.msgRow, last && { borderBottomWidth: 0 }]}
    >
      <View style={[s.msgIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={iconName} size={18} color={iconFg} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={s.msgRowHead}>
          <Text style={s.msgTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={s.msgDate}>{date}</Text>
        </View>
        <Text style={s.msgBody} numberOfLines={2}>
          {body || 'Open to read more.'}
        </Text>
      </View>
      {unread && <View style={s.unreadDot} />}
    </TouchableOpacity>
  );
}

function EmptyState({
  icon,
  title,
  body,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}) {
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}>
        <Ionicons name={icon} size={26} color={C.textFaint} />
      </View>
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptyBody}>{body}</Text>
    </View>
  );
}

/* ─────────────────────────── Screen ─────────────────────────── */

export default function Inbox() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [segment, setSegment] = useState<Segment>('updates');
  const [refreshing, setRefreshing] = useState(false);

  const { data: announcementsData, refetch } = useQuery({
    queryKey: ['inbox-announcements'],
    queryFn: () => announcementsApi.getAnnouncements({ limit: 20 }),
  });

  const now = new Date();
  const { data: events = [] } = useQuery({
    queryKey: ['inbox-events', now.getMonth(), now.getFullYear()],
    queryFn: () =>
      announcementsApi.getEvents({ month: now.getMonth() + 1, year: now.getFullYear() }),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const items = announcementsData?.announcements ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="dark" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.navy} />
        }
        contentContainerStyle={{
          paddingTop: insets.top + 18,
          paddingBottom: 140,
          paddingHorizontal: 20,
        }}
      >
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.title}>Inbox</Text>
            <Text style={s.subtitle}>
              {items.length > 0
                ? `${items.length} new update${items.length === 1 ? '' : 's'}`
                : 'All caught up'}
            </Text>
          </View>
          <TouchableOpacity activeOpacity={0.7} style={s.iconBtn}>
            <Ionicons name="search-outline" size={18} color={C.navy} />
          </TouchableOpacity>
        </View>

        {/* Segmented */}
        <View style={s.segWrap}>
          <Pill
            active={segment === 'updates'}
            label="Updates"
            count={items.length}
            onPress={() => setSegment('updates')}
          />
          <Pill
            active={segment === 'calendar'}
            label="Calendar"
            count={events.length}
            onPress={() => setSegment('calendar')}
          />
          <Pill
            active={segment === 'messages'}
            label="Messages"
            onPress={() => setSegment('messages')}
          />
        </View>

        {/* Content */}
        {segment === 'updates' && (
          <View style={{ marginTop: 18 }}>
            {items.length === 0 ? (
              <EmptyState
                icon="mail-open-outline"
                title="Nothing in the post."
                body="When the office sends out a notice, it'll land here."
              />
            ) : (
              <View style={s.card}>
                {items.map((a, i) => (
                  <MessageRow
                    key={a._id}
                    iconBg={C.brandSoft}
                    iconFg={C.brand}
                    iconName="megaphone-outline"
                    title={a.title}
                    body={a.content?.slice(0, 100) ?? ''}
                    date={new Date(a.publishedAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                    })}
                    unread={i < 2}
                    onPress={() => router.push('/(tabs)/announcements' as never)}
                    last={i === items.length - 1}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {segment === 'calendar' && (
          <View style={{ marginTop: 18 }}>
            {events.length === 0 ? (
              <EmptyState
                icon="calendar-outline"
                title="No events on the horizon."
                body="Public holidays, assemblies and school events show up here."
              />
            ) : (
              <View style={s.card}>
                {events
                  .slice(0, 30)
                  .map(
                    (
                      e: { _id: string; title: string; description?: string; startDate: string },
                      i: number,
                      arr: unknown[]
                    ) => (
                      <MessageRow
                        key={e._id}
                        iconBg={C.cyanSoft}
                        iconFg={C.cyan}
                        iconName="calendar-outline"
                        title={e.title}
                        body={e.description ?? ''}
                        date={new Date(e.startDate).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })}
                        onPress={() => router.push('/(tabs)/calendar' as never)}
                        last={i === arr.length - 1}
                      />
                    )
                  )}
              </View>
            )}
          </View>
        )}

        {segment === 'messages' && (
          <View style={{ marginTop: 18 }}>
            <EmptyState
              icon="chatbubbles-outline"
              title="Direct messages coming next term."
              body="Class-teacher conversations will live here once we polish the final touches."
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/* ─────────────────────────── Styles ─────────────────────────── */

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  title: {
    fontFamily: 'DMSans_700Bold',
    color: C.navy,
    fontSize: 30,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontFamily: 'DMSans_400Regular',
    color: C.textMuted,
    fontSize: 13.5,
    marginTop: 4,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },

  /* Segmented */
  segWrap: {
    flexDirection: 'row',
    backgroundColor: C.surfaceAlt,
    borderRadius: 14,
    padding: 4,
    marginTop: 6,
  },
  pillBtn: { flex: 1 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    paddingVertical: 9,
    gap: 6,
  },
  pillLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12.5,
  },
  pillCount: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: C.brandSoft,
  },
  pillCountText: {
    fontFamily: 'DMSans_700Bold',
    color: C.brand,
    fontSize: 10.5,
  },

  /* Card */
  card: {
    backgroundColor: C.surface,
    borderRadius: 18,
    paddingHorizontal: 14,
    ...SHADOW_SOFT,
  },

  /* Message rows */
  msgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.surfaceAlt,
  },
  msgIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  msgRowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  msgTitle: {
    fontFamily: 'DMSans_700Bold',
    color: C.navy,
    fontSize: 14,
    flex: 1,
    marginRight: 8,
    letterSpacing: -0.2,
  },
  msgDate: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: C.textFaint,
    fontSize: 11,
  },
  msgBody: {
    fontFamily: 'DMSans_400Regular',
    color: C.textMuted,
    fontSize: 12.5,
    lineHeight: 17,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.brand,
    marginLeft: 10,
  },

  /* Empty */
  empty: {
    backgroundColor: C.surface,
    borderRadius: 18,
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
    ...SHADOW_SOFT,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: C.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontFamily: 'DMSans_700Bold',
    color: C.navy,
    fontSize: 15,
    letterSpacing: -0.3,
  },
  emptyBody: {
    fontFamily: 'DMSans_400Regular',
    color: C.textMuted,
    fontSize: 12.5,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    paddingHorizontal: 12,
  },
});

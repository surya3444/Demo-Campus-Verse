import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore, useIsParent } from '@campus-verse/mobile-shared/store/authStore';
import { useCurrentStudentId, useStudentInfo } from '@campus-verse/mobile-shared/hooks/useAuth';
import { announcementsApi } from '@campus-verse/mobile-shared/api/announcements';
import { studentApi, type TodayScheduleEntry } from '@/api/student';
import { attendanceApi } from '@/api/attendance';
import { financeApi } from '@/api/finance';
import { transportApi } from '@/api/transport';

/* ─────────────────────────── Tokens ─────────────────────────── */

const C = {
  bg: '#F7F8FA',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F3F7',
  border: '#EEF1F5',
  navy: '#0F172A',
  text: '#0F172A',
  textMuted: '#64748B',
  textFaint: '#94A3B8',
  brand: '#4338CA',
  brandSoft: '#EEF2FF',
  cyan: '#06B6D4',
  cyanSoft: '#CFFAFE',
  emerald: '#10B981',
  emeraldSoft: '#D1FAE5',
  amber: '#F59E0B',
  amberSoft: '#FEF3C7',
  rose: '#EF4444',
  roseSoft: '#FEE2E2',
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

/* ─────────────────────────── Helpers ─────────────────────────── */

function formatCompactINR(n: number): string {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n}`;
}

function minutesUntil(time: string | undefined): number | null {
  if (!time) return null;
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const now = new Date();
  const target = new Date();
  target.setHours(h, m, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 60000);
}

function findUpNext(items: TodayScheduleEntry[]): TodayScheduleEntry | null {
  const filtered = items.filter(
    (e) => e.slotType !== 'break' && e.slotType !== 'lunch' && e.slotType !== 'assembly'
  );
  for (const e of filtered) {
    const mins = minutesUntil(e.startTime);
    if (mins != null && mins >= -10) return e;
  }
  return filtered[0] ?? null;
}

/* ─────────────────────────── Pieces ─────────────────────────── */

function TopBar({
  firstName,
  classLabel,
  onAvatarPress,
  onBellPress,
  hasUnread,
}: {
  firstName: string;
  classLabel: string;
  onAvatarPress: () => void;
  onBellPress: () => void;
  hasUnread: boolean;
}) {
  return (
    <View style={s.topbar}>
      <TouchableOpacity activeOpacity={0.8} onPress={onAvatarPress} style={s.avatar}>
        <Text style={s.avatarText}>{firstName?.[0]?.toUpperCase() || 'S'}</Text>
      </TouchableOpacity>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={s.topbarHello}>Welcome back</Text>
        <Text style={s.topbarMeta} numberOfLines={1}>
          {classLabel || 'CampusVerse Student'}
        </Text>
      </View>
      <TouchableOpacity activeOpacity={0.7} onPress={onBellPress} style={s.bellBtn}>
        <Ionicons name="notifications-outline" size={20} color={C.navy} />
        {hasUnread && <View style={s.bellDot} />}
      </TouchableOpacity>
    </View>
  );
}

function Hero({
  greeting,
  firstName,
  dateStr,
}: {
  greeting: string;
  firstName: string;
  dateStr: string;
}) {
  return (
    <View style={{ marginTop: 22 }}>
      <Text style={s.heroLine}>
        {greeting}
        {'\n'}
        <Text style={s.heroName}>{firstName}.</Text>
      </Text>
      <Text style={s.heroSub}>{dateStr}</Text>
    </View>
  );
}

function StatCard({
  label,
  value,
  unit,
  tone,
  icon,
  onPress,
}: {
  label: string;
  value: string;
  unit?: string;
  tone: 'cyan' | 'amber' | 'rose' | 'emerald';
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  const tones = {
    cyan: { fg: C.cyan, bg: C.cyanSoft },
    amber: { fg: C.amber, bg: C.amberSoft },
    rose: { fg: C.rose, bg: C.roseSoft },
    emerald: { fg: C.emerald, bg: C.emeraldSoft },
  } as const;
  const t = tones[tone];
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={s.statCard}>
      <View style={[s.statIcon, { backgroundColor: t.bg }]}>
        <Ionicons name={icon} size={15} color={t.fg} />
      </View>
      <Text style={s.statLabel}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 2 }}>
        <Text style={s.statValue}>{value}</Text>
        {unit && <Text style={s.statUnit}>{unit}</Text>}
      </View>
    </TouchableOpacity>
  );
}

function UpNextCard({ entry, onPress }: { entry: TodayScheduleEntry | null; onPress: () => void }) {
  if (!entry) {
    return (
      <View style={[s.upNext, { backgroundColor: C.surface }]}>
        <View style={[s.upNextIcon, { backgroundColor: C.emeraldSoft }]}>
          <Ionicons name="cafe-outline" size={20} color={C.emerald} />
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={s.upNextEyebrow}>NO CLASSES TODAY</Text>
          <Text style={s.upNextTitle}>A quiet day on the calendar</Text>
          <Text style={s.upNextMeta}>Use it to catch up on pending work.</Text>
        </View>
      </View>
    );
  }
  const mins = minutesUntil(entry.startTime);
  const relative =
    mins == null
      ? entry.startTime
      : mins < 0 && mins > -45
        ? 'In progress now'
        : mins >= 0 && mins < 60
          ? `Starts in ${mins} min`
          : mins >= 0
            ? `at ${entry.startTime}`
            : 'Earlier today';
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={s.upNext}>
      <View style={[s.upNextIcon, { backgroundColor: C.brandSoft }]}>
        <Ionicons name="time-outline" size={20} color={C.brand} />
      </View>
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text style={s.upNextEyebrow}>UP NEXT</Text>
        <Text style={s.upNextTitle} numberOfLines={1}>
          {entry.subjectName || entry.slotName}
        </Text>
        <Text style={s.upNextMeta} numberOfLines={1}>
          {relative}
          {entry.teacherName ? ` · ${entry.teacherName}` : ''}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={C.textFaint} />
    </TouchableOpacity>
  );
}

function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={s.sectionHead}>
      <Text style={s.sectionTitle}>{title}</Text>
      {action && (
        <TouchableOpacity onPress={onAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={s.sectionAction}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function ScheduleList({ items }: { items: TodayScheduleEntry[] }) {
  const filtered = items
    .filter((e) => e.slotType !== 'break' && e.slotType !== 'lunch' && e.slotType !== 'assembly')
    .slice(0, 4);
  if (filtered.length === 0) {
    return (
      <View style={s.empty}>
        <Text style={s.emptyTitle}>No classes scheduled today.</Text>
      </View>
    );
  }
  return (
    <View style={s.card}>
      {filtered.map((e, i) => {
        const mins = minutesUntil(e.startTime);
        const active = mins != null && mins <= 0 && mins > -45;
        return (
          <View
            key={`${e.slotOrder}-${i}`}
            style={[s.scheduleRow, i === filtered.length - 1 && { borderBottomWidth: 0 }]}
          >
            <View style={s.timeCol}>
              <Text style={s.timeStart}>{e.startTime}</Text>
              <Text style={s.timeEnd}>{e.endTime}</Text>
            </View>
            <View style={[s.timelineDot, { backgroundColor: active ? C.brand : C.border }]} />
            <View style={{ flex: 1, paddingLeft: 4 }}>
              <Text style={s.scheduleTitle} numberOfLines={1}>
                {e.subjectName || e.slotName}
              </Text>
              {e.teacherName && (
                <Text style={s.scheduleMeta} numberOfLines={1}>
                  {e.teacherName}
                </Text>
              )}
            </View>
            {active && (
              <View style={s.livePill}>
                <View style={s.liveDot} />
                <Text style={s.liveText}>Now</Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

function TransportCard({
  bus,
  onPress,
}: {
  bus: {
    busNumber?: string;
    busName?: string;
    stopName?: string;
    pickupTime?: string;
    dropTime?: string;
  };
  onPress: () => void;
}) {
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={s.transport}>
      <View style={s.transportOrb} />
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <View style={s.transportIcon}>
          <Ionicons name="bus" size={18} color="#fff" />
        </View>
        <Text style={s.transportEyebrow}>YOUR BUS TODAY</Text>
      </View>
      <Text style={s.transportTitle}>{bus.busNumber}</Text>
      <Text style={s.transportMeta}>
        {bus.stopName || 'Stop'}
        {bus.busName ? ` · ${bus.busName}` : ''}
      </Text>
      <View style={s.transportRow}>
        {bus.pickupTime && (
          <View>
            <Text style={s.transportRowLabel}>Pickup</Text>
            <Text style={s.transportRowValue}>{bus.pickupTime}</Text>
          </View>
        )}
        {bus.dropTime && (
          <View>
            <Text style={s.transportRowLabel}>Drop</Text>
            <Text style={s.transportRowValue}>{bus.dropTime}</Text>
          </View>
        )}
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <View style={s.transportCta}>
            <Text style={s.transportCtaText}>Track</Text>
            <Ionicons name="arrow-forward" size={13} color="#fff" />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function WorkRow({
  title,
  meta,
  badge,
  badgeTone,
  onPress,
  last,
}: {
  title: string;
  meta: string;
  badge: string;
  badgeTone: 'cyan' | 'amber' | 'rose' | 'brand';
  onPress: () => void;
  last?: boolean;
}) {
  const tones = {
    cyan: { fg: C.cyan, bg: C.cyanSoft },
    amber: { fg: C.amber, bg: C.amberSoft },
    rose: { fg: C.rose, bg: C.roseSoft },
    brand: { fg: C.brand, bg: C.brandSoft },
  } as const;
  const t = tones[badgeTone];
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[s.workRow, last && { borderBottomWidth: 0 }]}
    >
      <View style={[s.workBadge, { backgroundColor: t.bg }]}>
        <Text style={[s.workBadgeText, { color: t.fg }]}>{badge}</Text>
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={s.workTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={s.workMeta} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={C.textFaint} />
    </TouchableOpacity>
  );
}

function AnnouncementRow({
  title,
  body,
  date,
  onPress,
  last,
}: {
  title: string;
  body: string;
  date: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[s.annRow, last && { borderBottomWidth: 0 }]}
    >
      <View style={s.annDot} />
      <View style={{ flex: 1 }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 4,
          }}
        >
          <Text style={s.annTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={s.annDate}>{date}</Text>
        </View>
        {body ? (
          <Text style={s.annBody} numberOfLines={2}>
            {body}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

/* ─────────────────────────── Screen ─────────────────────────── */

export default function Today() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const user = useAuthStore((s) => s.user);
  const isParent = useIsParent();
  const studentId = useCurrentStudentId();
  const studentInfo = useStudentInfo();
  const selectedChild = useAuthStore((s) => s.selectedChild);

  const now = new Date();
  const profile = (user as unknown as Record<string, unknown>)?.profile as
    | Record<string, string>
    | undefined;
  const displayName = isParent
    ? selectedChild?.studentName || 'Student'
    : profile?.displayName || profile?.firstName || user?.displayName || 'Student';
  const [firstName] = displayName.split(' ');
  const hr = now.getHours();
  const greeting = hr < 12 ? 'Good morning,' : hr < 17 ? 'Good afternoon,' : 'Good evening,';
  const dateStr = now.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const { data: dashboard, refetch: r1 } = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: () => studentApi.getStudentDashboard(),
    enabled: !isParent,
  });
  const { data: pAtt, refetch: r2 } = useQuery({
    queryKey: ['parent-att', studentId],
    queryFn: () => attendanceApi.getStudentStats(studentId!),
    enabled: isParent && !!studentId,
  });
  const { data: pFees, refetch: r3 } = useQuery({
    queryKey: ['parent-fees', studentId],
    queryFn: () => financeApi.getStudentStatement(studentId!),
    enabled: isParent && !!studentId,
  });
  const { data: pAnn, refetch: r4 } = useQuery({
    queryKey: ['parent-ann'],
    queryFn: () => announcementsApi.getAnnouncements({ limit: 3 }),
    enabled: isParent,
  });
  const { data: myTransport, refetch: r5 } = useQuery({
    queryKey: ['my-transport-enrollment'],
    queryFn: () => transportApi.getMyEnrollment(),
    staleTime: 5 * 60 * 1000,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (isParent) await Promise.all([r2(), r3(), r4(), r5()]);
    else await Promise.all([r1(), r5()]);
    setRefreshing(false);
  }, [isParent, r1, r2, r3, r4, r5]);

  const attendancePct = isParent
    ? ((pAtt as { attendancePercentage?: number } | undefined)?.attendancePercentage ?? 0)
    : (dashboard?.attendance?.percentage ?? 0);
  const pendingCount = dashboard?.assignments?.pending ?? 0;
  const feeBalance = isParent
    ? ((pFees as { summary?: { totalPending?: number } } | undefined)?.summary?.totalPending ?? 0)
    : (dashboard?.fees?.balance ?? 0);
  const todaySchedule = dashboard?.todaySchedule ?? [];
  const upcomingWork = dashboard?.assignments?.upcoming ?? [];
  const announcements = isParent
    ? ((pAnn as
        | { _id: string; title: string; message?: string; createdAt: string }[]
        | undefined) ?? [])
    : (dashboard?.announcements ?? []);

  const classDisplay = (
    isParent ? selectedChild?.className : dashboard?.student?.className || studentInfo?.className
  )?.trim();
  const sectionDisplay = (
    isParent ? selectedChild?.sectionName : dashboard?.student?.sectionName
  )?.trim();
  const classLabel = [classDisplay, sectionDisplay].filter(Boolean).join(' · ');

  const upNext = useMemo(() => findUpNext(todaySchedule), [todaySchedule]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="dark" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.navy} />
        }
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: 140,
          paddingHorizontal: 20,
        }}
      >
        <TopBar
          firstName={firstName}
          classLabel={classLabel}
          onAvatarPress={() => router.push('/(tabs)/me' as never)}
          onBellPress={() => router.push('/(tabs)/inbox' as never)}
          hasUnread={announcements.length > 0}
        />
        <Hero greeting={greeting} firstName={firstName} dateStr={dateStr} />

        {/* Stats */}
        <View style={s.statRow}>
          <StatCard
            label="Attendance"
            value={String(attendancePct)}
            unit="%"
            tone={attendancePct < 75 ? 'rose' : 'emerald'}
            icon="checkmark-circle"
            onPress={() => router.push('/(tabs)/attendance' as never)}
          />
          <StatCard
            label="Pending"
            value={String(pendingCount).padStart(2, '0')}
            tone={pendingCount > 0 ? 'amber' : 'emerald'}
            icon="clipboard-outline"
            onPress={() => router.push('/(tabs)/assignments' as never)}
          />
          <StatCard
            label="Fees due"
            value={feeBalance > 0 ? formatCompactINR(feeBalance) : '₹0'}
            tone={feeBalance > 0 ? 'rose' : 'emerald'}
            icon="wallet-outline"
            onPress={() => router.push('/(tabs)/pay' as never)}
          />
        </View>

        {/* Up next */}
        <View style={{ marginTop: 18 }}>
          <UpNextCard entry={upNext} onPress={() => router.push('/(tabs)/timetable' as never)} />
        </View>

        {/* Transport */}
        {myTransport?.enrollment && (
          <View style={{ marginTop: 18 }}>
            <TransportCard
              bus={myTransport.enrollment}
              onPress={() => router.push('/student/transport-detail' as never)}
            />
          </View>
        )}

        {/* Schedule */}
        <SectionHeader
          title="Today's schedule"
          action="See all"
          onAction={() => router.push('/(tabs)/timetable' as never)}
        />
        <ScheduleList items={todaySchedule} />

        {/* Pending work */}
        {!isParent && upcomingWork.length > 0 && (
          <>
            <SectionHeader
              title="On your desk"
              action="View all"
              onAction={() => router.push('/(tabs)/academics' as never)}
            />
            <View style={s.card}>
              {upcomingWork.slice(0, 4).map((item, i, arr) => (
                <WorkRow
                  key={item._id}
                  title={item.title}
                  meta={`${item.totalMarks} marks${
                    item.dueDate
                      ? ` · Due ${new Date(item.dueDate).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })}`
                      : ''
                  }`}
                  badge={item.type === 'questionnaire' ? 'Quiz' : 'Task'}
                  badgeTone={item.type === 'questionnaire' ? 'brand' : 'amber'}
                  onPress={() =>
                    router.push(
                      `/student/assignment-detail?id=${item._id}&kind=${item.type}` as never
                    )
                  }
                  last={i === arr.slice(0, 4).length - 1}
                />
              ))}
            </View>
          </>
        )}

        {/* Announcements */}
        {announcements.length > 0 && (
          <>
            <SectionHeader
              title="From the office"
              action="All updates"
              onAction={() => router.push('/(tabs)/inbox' as never)}
            />
            <View style={s.card}>
              {announcements.slice(0, 3).map((a, i, arr) => (
                <AnnouncementRow
                  key={a._id}
                  title={a.title}
                  body={a.message || ''}
                  date={new Date(a.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                  })}
                  onPress={() => router.push('/(tabs)/announcements' as never)}
                  last={i === arr.slice(0, 3).length - 1}
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

/* ─────────────────────────── Styles ─────────────────────────── */

const s = StyleSheet.create({
  /* Top bar */
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: C.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontFamily: 'DMSans_700Bold',
    fontSize: 16,
  },
  topbarHello: { fontFamily: 'DMSans_400Regular', color: C.textMuted, fontSize: 12.5 },
  topbarMeta: {
    fontFamily: 'DMSans_500Medium',
    color: C.navy,
    fontSize: 13.5,
    marginTop: 1,
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  bellDot: {
    position: 'absolute',
    top: 9,
    right: 11,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.rose,
  },

  /* Hero */
  heroLine: {
    fontFamily: 'DMSans_700Bold',
    color: C.navy,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.8,
  },
  heroName: {
    fontFamily: 'DMSans_700Bold',
    color: C.brand,
  },
  heroSub: {
    fontFamily: 'DMSans_500Medium',
    color: C.textMuted,
    fontSize: 13.5,
    marginTop: 8,
  },

  /* Stats */
  statRow: {
    flexDirection: 'row',
    marginTop: 22,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 18,
    padding: 14,
    minHeight: 92,
    ...SHADOW_SOFT,
  },
  statIcon: {
    width: 26,
    height: 26,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statLabel: {
    fontFamily: 'DMSans_500Medium',
    color: C.textMuted,
    fontSize: 11.5,
  },
  statValue: {
    fontFamily: 'JetBrainsMono_700Bold',
    color: C.navy,
    fontSize: 22,
    letterSpacing: -0.6,
  },
  statUnit: {
    fontFamily: 'JetBrainsMono_500Medium',
    color: C.textFaint,
    fontSize: 13,
    marginLeft: 2,
  },

  /* Up next */
  upNext: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: 18,
    padding: 14,
    ...SHADOW_SOFT,
  },
  upNextIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upNextEyebrow: {
    fontFamily: 'JetBrainsMono_500Medium',
    color: C.textFaint,
    fontSize: 9.5,
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  upNextTitle: {
    fontFamily: 'DMSans_700Bold',
    color: C.navy,
    fontSize: 16,
    letterSpacing: -0.3,
  },
  upNextMeta: {
    fontFamily: 'DMSans_400Regular',
    color: C.textMuted,
    fontSize: 12.5,
    marginTop: 2,
  },

  /* Section header */
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 30,
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: 'DMSans_700Bold',
    color: C.navy,
    fontSize: 17,
    letterSpacing: -0.4,
  },
  sectionAction: {
    fontFamily: 'DMSans_500Medium',
    color: C.brand,
    fontSize: 12.5,
  },

  /* Generic card */
  card: {
    backgroundColor: C.surface,
    borderRadius: 18,
    paddingHorizontal: 14,
    ...SHADOW_SOFT,
  },

  /* Schedule */
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.surfaceAlt,
  },
  timeCol: { width: 50 },
  timeStart: {
    fontFamily: 'JetBrainsMono_500Medium',
    color: C.navy,
    fontSize: 13,
  },
  timeEnd: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: C.textFaint,
    fontSize: 10.5,
    marginTop: 1,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 14,
  },
  scheduleTitle: {
    fontFamily: 'DMSans_500Medium',
    color: C.navy,
    fontSize: 14.5,
  },
  scheduleMeta: {
    fontFamily: 'DMSans_400Regular',
    color: C.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.brandSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: C.brand,
    marginRight: 4,
  },
  liveText: {
    fontFamily: 'DMSans_500Medium',
    color: C.brand,
    fontSize: 10.5,
  },

  /* Empty */
  empty: {
    backgroundColor: C.surface,
    borderRadius: 18,
    paddingVertical: 28,
    paddingHorizontal: 18,
    alignItems: 'center',
    ...SHADOW_SOFT,
  },
  emptyTitle: {
    fontFamily: 'DMSans_500Medium',
    color: C.textMuted,
    fontSize: 13,
  },

  /* Transport */
  transport: {
    backgroundColor: C.navy,
    borderRadius: 22,
    padding: 18,
    overflow: 'hidden',
  },
  transportOrb: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(6,182,212,0.18)',
    top: -100,
    right: -80,
  },
  transportIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(6,182,212,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  transportEyebrow: {
    fontFamily: 'JetBrainsMono_500Medium',
    color: C.cyan,
    fontSize: 9.5,
    letterSpacing: 1.4,
  },
  transportTitle: {
    fontFamily: 'DMSans_700Bold',
    color: '#fff',
    fontSize: 26,
    letterSpacing: -0.6,
    marginTop: 4,
  },
  transportMeta: {
    fontFamily: 'DMSans_400Regular',
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    marginTop: 4,
  },
  transportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 22,
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  transportRowLabel: {
    fontFamily: 'DMSans_400Regular',
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10.5,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  transportRowValue: {
    fontFamily: 'JetBrainsMono_500Medium',
    color: '#fff',
    fontSize: 15,
    marginTop: 2,
  },
  transportCta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.cyan,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    gap: 4,
  },
  transportCtaText: {
    fontFamily: 'DMSans_700Bold',
    color: '#fff',
    fontSize: 12,
  },

  /* Work rows */
  workRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.surfaceAlt,
  },
  workBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    minWidth: 44,
    alignItems: 'center',
  },
  workBadgeText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 10,
    letterSpacing: 0.3,
  },
  workTitle: {
    fontFamily: 'DMSans_500Medium',
    color: C.navy,
    fontSize: 14.5,
  },
  workMeta: {
    fontFamily: 'DMSans_400Regular',
    color: C.textMuted,
    fontSize: 12,
    marginTop: 2,
  },

  /* Announcement rows */
  annRow: {
    flexDirection: 'row',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.surfaceAlt,
  },
  annDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: C.brand,
    marginTop: 7,
    marginRight: 12,
  },
  annTitle: {
    fontFamily: 'DMSans_700Bold',
    color: C.navy,
    fontSize: 13.5,
    flex: 1,
    marginRight: 8,
  },
  annDate: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: C.textFaint,
    fontSize: 11,
  },
  annBody: {
    fontFamily: 'DMSans_400Regular',
    color: C.textMuted,
    fontSize: 12.5,
    lineHeight: 18,
  },
});

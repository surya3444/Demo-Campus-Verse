import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Bell,
  BookOpenCheck,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Clock,
  FileText,
  Fingerprint,
  GraduationCap,
  IndianRupee,
  MapPin,
  Megaphone,
  PartyPopper,
  Receipt,
  Sparkles,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react-native';
import {
  Text,
  Surface,
  QuickTile,
  SectionTitle,
  LogoMark,
  TAB_BAR_CLEARANCE,
  brand,
  color,
  elevation,
  type Hue,
} from '@campus-verse/mobile-shared/design';
import { apiClient } from '@campus-verse/mobile-shared/api/client';
import { useAuthStore } from '@campus-verse/mobile-shared/store/authStore';
import { useCan } from '@campus-verse/mobile-shared/hooks/useAuth';
import type { TimetableEntry } from '@campus-verse/mobile-shared/api/types';
import { teachingApi } from '@/api/teaching';

const toMin = (t?: string) => {
  const [h, m] = (t ?? '').split(':').map(Number);
  return Number.isFinite(h) ? h * 60 + (m || 0) : NaN;
};

/**
 * Staff "Today": what's happening now, the next class with one-tap
 * attendance, live counts and the shortcuts this role can actually use.
 * Every number comes from the API — nothing is a placeholder.
 */
export default function StaffToday() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const can = useCan();
  const [refreshing, setRefreshing] = useState(false);
  const user = useAuthStore((s) => s.user);
  const profile = (user as unknown as { profile?: Record<string, string> })?.profile;
  const name = profile?.firstName || user?.firstName || user?.displayName?.split(' ')[0] || 'there';
  const initials = (profile?.firstName?.[0] ?? name[0] ?? '?') + (profile?.lastName?.[0] ?? '');

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dateLabel = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  const isTeacher = can('teaching.myClasses');
  const timetable = useQuery({ queryKey: ['my-timetable'], queryFn: () => teachingApi.getMyTimetable(), enabled: isTeacher });
  const grading = useQuery({
    queryKey: ['to-grade'],
    queryFn: async () => (await teachingApi.getAssignments({ status: 'grading', limit: 1 })).meta?.total ?? 0,
    enabled: isTeacher,
  });
  const approvals = useQuery({
    queryKey: ['leave-approvals-count'],
    queryFn: async () => {
      const r = await apiClient.get('/hr/leaves/pending-approvals', { params: { limit: 1 } });
      const meta = r.data?.meta as { total?: number } | undefined;
      return meta?.total ?? (Array.isArray(r.data?.data) ? r.data.data.length : 0);
    },
    enabled: can('hr.leaves', 'approve'),
    retry: false,
  });

  const today = useMemo(
    () =>
      ((timetable.data ?? []) as TimetableEntry[])
        .filter((e) => e.dayOfWeek === now.getDay())
        .sort((a, b) => toMin(a.startTime) - toMin(b.startTime)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [timetable.data]
  );
  const minutes = now.getHours() * 60 + now.getMinutes();
  const current = today.find((e) => toMin(e.startTime) <= minutes && minutes < toMin(e.endTime));
  const next = today.find((e) => toMin(e.startTime) > minutes);
  const focus = current ?? next;
  const progress = current ? (minutes - toMin(current.startTime)) / (toMin(current.endTime) - toMin(current.startTime)) : 0;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([timetable.refetch(), grading.refetch(), approvals.refetch()]);
    setRefreshing(false);
  }, [timetable, grading, approvals]);

  const tiles: Array<{ show: boolean; icon: typeof Bell; label: string; hint?: string; hue: Hue; route: string; badge?: number }> = [
    { show: can('attendance.mark', 'create'), icon: ClipboardCheck, label: 'Attendance', hint: 'Mark the roll', hue: 'navy', route: '/(tabs)/attendance' },
    { show: isTeacher, icon: CalendarDays, label: 'Timetable', hint: 'My week', hue: 'cyan', route: '/(tabs)/timetable' },
    { show: isTeacher, icon: ClipboardList, label: 'Assignments', hint: 'Set & grade', hue: 'violet', route: '/(tabs)/assignments' },
    { show: isTeacher, icon: GraduationCap, label: 'Gradebook', hint: 'Marks', hue: 'indigo', route: '/teaching/gradebook' },
    { show: isTeacher, icon: BookOpenCheck, label: 'Lesson plans', hue: 'teal', route: '/(tabs)/lessons' },
    { show: can('hr.leaves', 'approve'), icon: UserCheck, label: 'Approvals', hint: 'Leave requests', hue: 'amber', route: '/approvals', badge: approvals.data },
    { show: can('finance.feeCounter'), icon: IndianRupee, label: 'Fee counter', hint: 'Collect fees', hue: 'emerald', route: '/finance/counter' },
    { show: can('visitor.visitors'), icon: Users, label: 'Visitors', hint: 'Gate passes', hue: 'slate', route: '/visitors' },
    { show: can('communications.announcements', 'create'), icon: Megaphone, label: 'Notice', hint: 'Send to campus', hue: 'rose', route: '/comms/composer' },
    { show: true, icon: Fingerprint, label: 'Check in', hint: 'My attendance', hue: 'cyan', route: '/hr/checkin' },
    { show: true, icon: FileText, label: 'Leave', hint: 'Apply & track', hue: 'amber', route: '/hr/leaves' },
    { show: true, icon: Wallet, label: 'Payslips', hue: 'emerald', route: '/hr/payslips' },
    { show: true, icon: Receipt, label: 'Expenses', hint: 'Submit a bill', hue: 'violet', route: '/expense' },
    { show: true, icon: PartyPopper, label: 'Calendar', hint: 'Events', hue: 'rose', route: '/school/calendar' },
  ];
  const visibleTiles = tiles.filter((t) => t.show);

  return (
    <View style={{ flex: 1, backgroundColor: color.paper }}>
      <StatusBar style="light" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
        contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE + insets.bottom }}
      >
        {/* Navy hero: greeting + what's on now */}
        <LinearGradient colors={[brand.navy950, brand.navy800, brand.navy700]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingTop: insets.top + 14, paddingHorizontal: 20, paddingBottom: 86, overflow: 'hidden' }}>
          <View style={{ position: 'absolute', width: 300, height: 300, borderRadius: 999, right: -120, top: -110, backgroundColor: 'rgba(10,197,255,0.16)' }} />
          <View style={{ position: 'absolute', width: 380, height: 380, borderRadius: 999, right: -170, top: -150, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' }} />
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <LogoMark size={30} tone="white" />
            <View style={{ flex: 1 }} />
            <HeaderButton onPress={() => router.push('/assistant' as never)} label="AI Assistant">
              <Sparkles size={19} color="#fff" />
            </HeaderButton>
            <HeaderButton onPress={() => router.push('/school/announcements' as never)} label="Notifications">
              <Bell size={19} color="#fff" />
            </HeaderButton>
            <Pressable onPress={() => router.push('/(tabs)/profile' as never)} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: brand.cyan400, alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}>
              <Text variant="bodyStrong" style={{ color: brand.navy900, fontFamily: 'PlusJakartaSans_800ExtraBold' }}>
                {initials.toUpperCase()}
              </Text>
            </Pressable>
          </View>
          <Text variant="eyebrow" tone="onInkMute" style={{ marginTop: 24 }}>
            {dateLabel}
          </Text>
          <Text variant="hero" tone="onInk" style={{ marginTop: 8 }}>
            {greeting},{'\n'}
            <Text variant="hero" tone="onInk" italic>
              {name}.
            </Text>
          </Text>
        </LinearGradient>

        <View style={{ paddingHorizontal: 18, marginTop: -62 }}>
          {/* Now / next class */}
          {isTeacher ? (
            <Surface padded={18} style={elevation.lifted}>
              {focus ? (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: current ? brand.successWash : brand.cyan50 }}>
                      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: current ? brand.success : brand.cyan500, marginRight: 6 }} />
                      <Text variant="micro" style={{ color: current ? brand.success : brand.cyan700, fontFamily: 'DMSans_700Bold' }}>
                        {current ? 'IN CLASS NOW' : `NEXT · ${focus.startTime}`}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }} />
                    <Text variant="caption" tone="inkFaint">
                      {focus.slotName}
                    </Text>
                  </View>
                  <Text variant="h1" tone="ink" style={{ marginTop: 12 }}>
                    {focus.subjectName || 'Class'}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 14 }}>
                    <Meta icon={Users} text={`${focus.className} · ${focus.sectionName}`} />
                    <Meta icon={Clock} text={`${focus.startTime}–${focus.endTime}`} />
                    {focus.roomNumber ? <Meta icon={MapPin} text={`Room ${focus.roomNumber}`} /> : null}
                  </View>
                  {current ? (
                    <View style={{ height: 6, borderRadius: 3, backgroundColor: color.paperDeep, marginTop: 14, overflow: 'hidden' }}>
                      <LinearGradient colors={[brand.navy700, brand.cyan400]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${Math.round(progress * 100)}%`, height: 6 }} />
                    </View>
                  ) : null}
                  {can('attendance.mark', 'create') ? (
                    <Pressable onPress={() => router.push({ pathname: '/(tabs)/attendance', params: { sectionId: focus.sectionId } } as never)} style={{ marginTop: 16 }}>
                      <LinearGradient colors={[brand.navy800, brand.navy700]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 48, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                        <ClipboardCheck size={18} color="#fff" />
                        <Text variant="h3" tone="onInk" style={{ marginLeft: 8, fontSize: 15 }}>
                          Take attendance
                        </Text>
                      </LinearGradient>
                    </Pressable>
                  ) : null}
                </>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text variant="h2" tone="ink">
                      {today.length ? 'Classes done for today' : 'No classes today'}
                    </Text>
                    <Text variant="caption" tone="inkMute" style={{ marginTop: 4 }}>
                      {today.length ? `${today.length} periods taught. A good time to grade.` : 'Your timetable is clear.'}
                    </Text>
                  </View>
                  <CalendarDays size={30} color={brand.navy300} />
                </View>
              )}
            </Surface>
          ) : null}

          {/* Live counts */}
          {isTeacher ? (
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <Count label="Classes today" value={today.length} onPress={() => router.push('/(tabs)/timetable' as never)} />
              <Count label="To grade" value={grading.data ?? 0} onPress={() => router.push('/(tabs)/assignments' as never)} warn={(grading.data ?? 0) > 0} />
              {can('hr.leaves', 'approve') ? <Count label="Approvals" value={approvals.data ?? 0} onPress={() => router.push('/approvals' as never)} warn={(approvals.data ?? 0) > 0} /> : null}
            </View>
          ) : null}

          <SectionTitle title="Quick actions" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' }}>
            {visibleTiles.map((t) => (
              <QuickTile key={t.label} icon={t.icon} label={t.label} hint={t.hint} hue={t.hue} badge={t.badge} onPress={() => router.push(t.route as never)} />
            ))}
            {/* keep the last row left-aligned */}
            {Array.from({ length: (3 - (visibleTiles.length % 3)) % 3 }).map((_, i) => (
              <View key={`pad${i}`} style={{ width: '31%' }} />
            ))}
          </View>

          {isTeacher && today.length ? (
            <>
              <SectionTitle title="Today's classes" action="Full week" onAction={() => router.push('/(tabs)/timetable' as never)} />
              <Surface padded={6}>
                {today.map((e, i) => {
                  const live = e === current;
                  const done = toMin(e.endTime) <= minutes;
                  return (
                    <View key={e._id ?? i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 10, borderTopWidth: i ? 1 : 0, borderTopColor: color.rule, opacity: done ? 0.5 : 1 }}>
                      <View style={{ width: 54 }}>
                        <Text variant="numSmall" tone={live ? 'navy' : 'ink'}>
                          {e.startTime}
                        </Text>
                        <Text variant="micro" tone="inkFaint">
                          {e.endTime}
                        </Text>
                      </View>
                      <View style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: live ? brand.cyan400 : color.paperDeep, marginHorizontal: 10 }} />
                      <View style={{ flex: 1 }}>
                        <Text variant="h3" tone="ink" numberOfLines={1}>
                          {e.subjectName}
                        </Text>
                        <Text variant="caption" tone="inkMute" numberOfLines={1}>
                          {e.className} · {e.sectionName}
                          {e.roomNumber ? ` · Room ${e.roomNumber}` : ''}
                        </Text>
                      </View>
                      {live ? (
                        <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: brand.cyan50 }}>
                          <Text variant="micro" style={{ color: brand.cyan700, fontFamily: 'DMSans_700Bold' }}>
                            NOW
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </Surface>
            </>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function HeaderButton({ children, onPress, label }: { children: React.ReactNode; onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} hitSlop={6} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}>
      {children}
    </Pressable>
  );
}

function Meta({ icon: Glyph, text }: { icon: typeof Bell; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Glyph size={14} color={color.inkMute} />
      <Text variant="caption" tone="inkMute" style={{ marginLeft: 5 }}>
        {text}
      </Text>
    </View>
  );
}

function Count({ label, value, onPress, warn }: { label: string; value: number; onPress: () => void; warn?: boolean }) {
  return (
    <Surface onPress={onPress} padded={14} style={{ flex: 1 }}>
      <Text variant="numMid" style={{ color: warn ? brand.warning : brand.navy800 }}>
        {value}
      </Text>
      <Text variant="micro" tone="inkMute" style={{ marginTop: 2 }}>
        {label}
      </Text>
    </Surface>
  );
}

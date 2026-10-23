import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore, useIsParent } from '@campus-verse/mobile-shared/store/authStore';
import { useStudentInfo } from '@campus-verse/mobile-shared/hooks/useAuth';
import { studentApi } from '@/api/student';

/* ─────────────────────────── Tokens ─────────────────────────── */

const C = {
  bg: '#F9F8F5',
  surface: '#FFFFFF',
  surfaceAlt: '#EDF0F3',
  border: '#EDF0F3',
  navy: '#042A6C',
  textMuted: '#526C98',
  textFaint: '#8998B3',
  brand: '#042A6C',
  brandSoft: '#F0F5FE',
  cyan: '#00A8E0',
  cyanSoft: '#D6F5FF',
  emerald: '#10B981',
  emeraldSoft: '#D1FAE5',
  amber: '#F59E0B',
  amberSoft: '#FEF3C7',
  rose: '#EF4444',
  roseSoft: '#FEE2E2',
  violet: '#8B5CF6',
  violetSoft: '#EDE9FE',
  teal: '#14B8A6',
  tealSoft: '#CCFBF1',
};

const SHADOW_SOFT = Platform.select({
  ios: {
    shadowColor: '#042A6C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
  },
  android: { elevation: 2 },
});

type IoniconName = keyof typeof Ionicons.glyphMap;

interface Item {
  icon: IoniconName;
  iconFg: string;
  iconBg: string;
  title: string;
  byline?: string;
  onPress: () => void;
  destructive?: boolean;
}

/* ─────────────────────────── Pieces ─────────────────────────── */

function Row({ item, last }: { item: Item; last?: boolean }) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={item.onPress}
      style={[s.row, last && { borderBottomWidth: 0 }]}
    >
      <View style={[s.rowIcon, { backgroundColor: item.iconBg }]}>
        <Ionicons name={item.icon} size={17} color={item.iconFg} />
      </View>
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text style={[s.rowTitle, item.destructive && { color: C.rose }]}>{item.title}</Text>
        {item.byline && <Text style={s.rowByline}>{item.byline}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={16} color={C.textFaint} />
    </TouchableOpacity>
  );
}

function GroupCard({ items }: { items: Item[] }) {
  return (
    <View style={s.groupCard}>
      {items.map((it, i) => (
        <Row key={it.title} item={it} last={i === items.length - 1} />
      ))}
    </View>
  );
}

function GroupLabel({ children }: { children: string }) {
  return <Text style={s.groupLabel}>{children.toUpperCase()}</Text>;
}

/* ─────────────────────────── Screen ─────────────────────────── */

export default function Me() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const isParent = useIsParent();
  const selectedChild = useAuthStore((s) => s.selectedChild);
  const studentInfo = useStudentInfo();
  const children = useAuthStore((s) => s.children);

  // Reuses the cached query from Today — same key, no extra network.
  const { data: dashboard } = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: () => studentApi.getStudentDashboard(),
    enabled: !isParent,
  });

  const profile = (user as unknown as Record<string, unknown>)?.profile as
    | Record<string, string>
    | undefined;
  const displayName = isParent
    ? selectedChild?.studentName || 'Student'
    : profile?.displayName || profile?.firstName || user?.displayName || 'Student';
  const [firstName, ...rest] = displayName.split(' ');
  const restName = rest.join(' ');
  const admissionNo = isParent
    ? (selectedChild as unknown as Record<string, string> | undefined)?.admissionNumber || '—'
    : dashboard?.student?.admissionNumber ||
      (studentInfo as Record<string, string> | undefined)?.admissionNumber ||
      '—';
  const classDisplay =
    (isParent
      ? selectedChild?.className
      : dashboard?.student?.className || studentInfo?.className
    )?.trim() || '—';
  const sectionDisplay = (
    isParent
      ? selectedChild?.sectionName
      : dashboard?.student?.sectionName ||
        (studentInfo as Record<string, string> | undefined)?.sectionName
  )?.trim();

  const documents: Item[] = [
    {
      icon: 'qr-code-outline',
      iconFg: C.brand,
      iconBg: C.brandSoft,
      title: 'Digital ID card',
      byline: 'QR + Apple / Google Wallet pass',
      onPress: () => router.push('/student/id-card' as never),
    },
    {
      icon: 'ribbon-outline',
      iconFg: C.amber,
      iconBg: C.amberSoft,
      title: 'Certificates',
      byline: 'Bonafide, transfer, character',
      onPress: () => router.push('/(tabs)/certificates' as never),
    },
    {
      icon: 'ticket-outline',
      iconFg: C.violet,
      iconBg: C.violetSoft,
      title: 'Hall tickets',
      byline: 'Saved exam admit cards',
      onPress: () => router.push('/(tabs)/exams' as never),
    },
  ];

  const care: Item[] = [
    {
      icon: 'medkit-outline',
      iconFg: C.rose,
      iconBg: C.roseSoft,
      title: 'Health',
      byline: 'Records · vaccinations · visits',
      onPress: () => router.push('/(tabs)/health' as never),
    },
    {
      icon: 'bed-outline',
      iconFg: C.teal,
      iconBg: C.tealSoft,
      title: 'Hostel',
      byline: 'Room & warden',
      onPress: () => router.push('/(tabs)/hostel' as never),
    },
    {
      icon: 'people-outline',
      iconFg: C.cyan,
      iconBg: C.cyanSoft,
      title: 'Feed',
      byline: 'Class & school posts',
      onPress: () => router.push('/feed' as never),
    },
  ];

  const account: Item[] = [
    {
      icon: 'help-buoy-outline',
      iconFg: C.brand,
      iconBg: C.brandSoft,
      title: 'Support',
      byline: 'Open a ticket with the office',
      onPress: () => router.push('/support/feedback' as never),
    },
    ...(isParent && children.length > 1
      ? [
          {
            icon: 'swap-horizontal-outline' as IoniconName,
            iconFg: C.cyan,
            iconBg: C.cyanSoft,
            title: 'Switch child',
            byline: `${children.length} children on this account`,
            onPress: () => router.push('/child-selector' as never),
          },
        ]
      : []),
    {
      icon: 'log-out-outline',
      iconFg: C.rose,
      iconBg: C.roseSoft,
      title: 'Sign out',
      destructive: true,
      onPress: () => {
        Alert.alert('Sign out', 'You will need to log in again.', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign out',
            style: 'destructive',
            onPress: () => {
              logout();
            },
          },
        ]);
      },
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="dark" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 18,
          paddingBottom: 140,
          paddingHorizontal: 20,
        }}
      >
        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>Me</Text>
          {isParent && (
            <View style={s.parentPill}>
              <Ionicons name="people-circle-outline" size={13} color={C.brand} />
              <Text style={s.parentPillText}>Parent</Text>
            </View>
          )}
        </View>

        {/* Profile card */}
        <View style={s.profile}>
          <View style={s.profileTop}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{firstName?.[0]?.toUpperCase() || 'S'}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={s.name}>{firstName}</Text>
              {restName ? <Text style={s.lastName}>{restName}</Text> : null}
              <View style={s.classRow}>
                <View style={s.classChip}>
                  <Ionicons name="school-outline" size={12} color={C.brand} />
                  <Text style={s.classChipText}>
                    {classDisplay}
                    {sectionDisplay ? ` · ${sectionDisplay}` : ''}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={s.profileMetrics}>
            <View style={s.metricCol}>
              <Text style={s.metricLabel}>ADM. №</Text>
              <Text style={s.metricValue}>{admissionNo}</Text>
            </View>
            <View style={s.metricDivider} />
            <View style={s.metricCol}>
              <Text style={s.metricLabel}>ROLE</Text>
              <Text style={s.metricValue}>{isParent ? 'Parent' : 'Student'}</Text>
            </View>
            <View style={s.metricDivider} />
            <TouchableOpacity
              activeOpacity={0.8}
              style={s.metricCol}
              onPress={() => router.push('/student/id-card' as never)}
            >
              <Text style={s.metricLabel}>ID CARD</Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginTop: 4,
                }}
              >
                <Text style={[s.metricValue, { color: C.brand }]}>Open</Text>
                <Ionicons
                  name="arrow-forward"
                  size={12}
                  color={C.brand}
                  style={{ marginLeft: 4 }}
                />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Sections */}
        <GroupLabel>Documents</GroupLabel>
        <GroupCard items={documents} />

        <GroupLabel>Care & community</GroupLabel>
        <GroupCard items={care} />

        <GroupLabel>Account</GroupLabel>
        <GroupCard items={account} />

        {/* Footer */}
        <Text style={s.footer}>CampusVerse · v1.0.0</Text>
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
    marginBottom: 22,
  },
  title: {
    fontFamily: 'DMSans_700Bold',
    color: C.navy,
    fontSize: 30,
    letterSpacing: -0.8,
  },
  parentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.brandSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    gap: 4,
  },
  parentPillText: {
    fontFamily: 'DMSans_500Medium',
    color: C.brand,
    fontSize: 11.5,
  },

  /* Profile card */
  profile: {
    backgroundColor: C.surface,
    borderRadius: 22,
    padding: 20,
    ...SHADOW_SOFT,
  },
  profileTop: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: C.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontFamily: 'DMSans_700Bold',
    fontSize: 26,
  },
  name: {
    fontFamily: 'DMSans_700Bold',
    color: C.navy,
    fontSize: 22,
    letterSpacing: -0.5,
  },
  lastName: {
    fontFamily: 'DMSans_400Regular',
    color: C.textMuted,
    fontSize: 13.5,
    marginTop: -2,
  },
  classRow: { marginTop: 8 },
  classChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.brandSoft,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 4,
  },
  classChipText: {
    fontFamily: 'DMSans_500Medium',
    color: C.brand,
    fontSize: 11.5,
  },

  profileMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: C.surfaceAlt,
  },
  metricCol: { flex: 1 },
  metricLabel: {
    fontFamily: 'JetBrainsMono_500Medium',
    color: C.textFaint,
    fontSize: 9.5,
    letterSpacing: 1.4,
  },
  metricValue: {
    fontFamily: 'DMSans_700Bold',
    color: C.navy,
    fontSize: 13.5,
    marginTop: 4,
  },
  metricDivider: {
    width: 1,
    height: 28,
    backgroundColor: C.surfaceAlt,
    marginHorizontal: 12,
  },

  /* Groups */
  groupLabel: {
    fontFamily: 'JetBrainsMono_500Medium',
    color: C.textFaint,
    fontSize: 10,
    letterSpacing: 1.6,
    marginTop: 28,
    marginBottom: 10,
    marginLeft: 4,
  },
  groupCard: {
    backgroundColor: C.surface,
    borderRadius: 18,
    paddingHorizontal: 14,
    ...SHADOW_SOFT,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.surfaceAlt,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    fontFamily: 'DMSans_500Medium',
    color: C.navy,
    fontSize: 14.5,
  },
  rowByline: {
    fontFamily: 'DMSans_400Regular',
    color: C.textMuted,
    fontSize: 12,
    marginTop: 2,
  },

  footer: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: C.textFaint,
    fontSize: 10.5,
    textAlign: 'center',
    marginTop: 40,
  },
});

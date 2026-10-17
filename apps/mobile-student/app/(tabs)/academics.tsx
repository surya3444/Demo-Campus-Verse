import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useIsParent } from '@campus-verse/mobile-shared/store/authStore';
import { studentApi } from '@/api/student';

/* ─────────────────────────── Tokens ─────────────────────────── */

const C = {
  bg: '#F7F8FA',
  surface: '#FFFFFF',
  border: '#EEF1F5',
  navy: '#0F172A',
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
  violet: '#8B5CF6',
  violetSoft: '#EDE9FE',
  teal: '#14B8A6',
  tealSoft: '#CCFBF1',
  pink: '#EC4899',
  pinkSoft: '#FCE7F3',
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

/* ─────────────────────────── Types ─────────────────────────── */

type IoniconName = keyof typeof Ionicons.glyphMap;

interface Chapter {
  title: string;
  byline: string;
  route: string;
  metric?: string;
  icon: IoniconName;
  tone: keyof typeof TONES;
}

const TONES = {
  brand: { fg: C.brand, bg: C.brandSoft },
  cyan: { fg: C.cyan, bg: C.cyanSoft },
  emerald: { fg: C.emerald, bg: C.emeraldSoft },
  amber: { fg: C.amber, bg: C.amberSoft },
  rose: { fg: C.rose, bg: C.roseSoft },
  violet: { fg: C.violet, bg: C.violetSoft },
  teal: { fg: C.teal, bg: C.tealSoft },
  pink: { fg: C.pink, bg: C.pinkSoft },
} as const;

function FeatureCard({ chapter, onPress }: { chapter: Chapter; onPress: () => void }) {
  const t = TONES[chapter.tone];
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={s.featCard}>
      <View style={[s.featIcon, { backgroundColor: t.bg }]}>
        <Ionicons name={chapter.icon} size={20} color={t.fg} />
      </View>
      {chapter.metric && (
        <View style={s.featMetric}>
          <Text style={[s.featMetricText, { color: t.fg }]}>{chapter.metric}</Text>
        </View>
      )}
      <Text style={s.featTitle}>{chapter.title}</Text>
      <Text style={s.featByline} numberOfLines={2}>
        {chapter.byline}
      </Text>
    </TouchableOpacity>
  );
}

/* ─────────────────────────── Screen ─────────────────────────── */

export default function Academics() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isParent = useIsParent();

  const { data: dashboard } = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: () => studentApi.getStudentDashboard(),
    enabled: !isParent,
  });

  const attPct = dashboard?.attendance?.percentage ?? 0;
  const pending = dashboard?.assignments?.pending ?? 0;
  const todayCount = (dashboard?.todaySchedule ?? []).length;

  const chapters: Chapter[] = [
    {
      title: 'Schedule',
      byline: `${todayCount} ${todayCount === 1 ? 'class' : 'classes'} today`,
      route: '/(tabs)/timetable',
      icon: 'calendar-outline',
      tone: 'brand',
    },
    {
      title: 'Assignments',
      byline: pending > 0 ? `${pending} pending` : 'All caught up',
      route: '/(tabs)/assignments',
      metric: pending > 0 ? String(pending).padStart(2, '0') : undefined,
      icon: 'clipboard-outline',
      tone: 'amber',
    },
    {
      title: 'Exams',
      byline: 'Schedules · hall tickets',
      route: '/(tabs)/exams',
      icon: 'document-text-outline',
      tone: 'rose',
    },
    {
      title: 'Grades',
      byline: 'Marks · GPA over time',
      route: '/(tabs)/grades',
      icon: 'stats-chart-outline',
      tone: 'cyan',
    },
    {
      title: 'Courses',
      byline: 'Lessons & quizzes',
      route: '/student/courses',
      icon: 'library-outline',
      tone: 'violet',
    },
    {
      title: 'Quizzes',
      byline: 'Surveys & checks',
      route: '/student/questionnaires',
      icon: 'help-circle-outline',
      tone: 'pink',
    },
    {
      title: 'Attendance',
      byline: 'Subject-wise breakdown',
      route: '/(tabs)/attendance',
      metric: `${attPct}%`,
      icon: 'checkmark-circle-outline',
      tone: attPct < 75 ? 'rose' : 'emerald',
    },
    {
      title: 'Materials',
      byline: 'Notes & downloads',
      route: '/student/materials',
      icon: 'folder-open-outline',
      tone: 'teal',
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
          <View>
            <Text style={s.title}>Learn</Text>
            <Text style={s.subtitle}>Everything academic in one place.</Text>
          </View>
          <View style={s.headerBadge}>
            <Ionicons name="grid-outline" size={14} color={C.brand} />
            <Text style={s.headerBadgeText}>{chapters.length} areas</Text>
          </View>
        </View>

        {/* Featured row — quick to today's most-likely needs */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => router.push('/(tabs)/timetable' as never)}
          style={s.feature}
        >
          <View style={s.featureOrb} />
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <View style={s.featureIcon}>
              <Ionicons name="time-outline" size={18} color="#fff" />
            </View>
            <Text style={s.featureEyebrow}>TODAY · {todayCount} CLASSES</Text>
          </View>
          <Text style={s.featureTitle}>Open today's timetable</Text>
          <Text style={s.featureSub}>See your full day at a glance.</Text>
          <View style={s.featureCta}>
            <Text style={s.featureCtaText}>Open</Text>
            <Ionicons name="arrow-forward" size={14} color="#fff" style={{ marginLeft: 4 }} />
          </View>
        </TouchableOpacity>

        {/* Grid */}
        <View style={s.grid}>
          {chapters.map((c) => (
            <FeatureCard key={c.title} chapter={c} onPress={() => router.push(c.route as never)} />
          ))}
        </View>
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
  subtitle: {
    fontFamily: 'DMSans_400Regular',
    color: C.textMuted,
    fontSize: 13.5,
    marginTop: 4,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.brandSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 4,
  },
  headerBadgeText: {
    fontFamily: 'DMSans_500Medium',
    color: C.brand,
    fontSize: 11.5,
  },

  /* Feature card (full width hero) */
  feature: {
    backgroundColor: C.navy,
    borderRadius: 22,
    padding: 20,
    overflow: 'hidden',
    marginBottom: 22,
  },
  featureOrb: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(6,182,212,0.18)',
    top: -120,
    right: -90,
  },
  featureIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(6,182,212,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  featureEyebrow: {
    fontFamily: 'JetBrainsMono_500Medium',
    color: C.cyan,
    fontSize: 9.5,
    letterSpacing: 1.4,
  },
  featureTitle: {
    fontFamily: 'DMSans_700Bold',
    color: '#fff',
    fontSize: 20,
    letterSpacing: -0.4,
  },
  featureSub: {
    fontFamily: 'DMSans_400Regular',
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    marginTop: 4,
  },
  featureCta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: C.cyan,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    marginTop: 14,
  },
  featureCtaText: {
    fontFamily: 'DMSans_700Bold',
    color: '#fff',
    fontSize: 12.5,
  },

  /* Grid */
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  featCard: {
    width: '48.5%',
    backgroundColor: C.surface,
    borderRadius: 18,
    padding: 16,
    minHeight: 132,
    ...SHADOW_SOFT,
  },
  featIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featMetric: {
    position: 'absolute',
    top: 14,
    right: 14,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: C.bg,
  },
  featMetricText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 11.5,
    letterSpacing: -0.2,
  },
  featTitle: {
    fontFamily: 'DMSans_700Bold',
    color: C.navy,
    fontSize: 15,
    marginTop: 14,
    letterSpacing: -0.3,
  },
  featByline: {
    fontFamily: 'DMSans_400Regular',
    color: C.textMuted,
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
});

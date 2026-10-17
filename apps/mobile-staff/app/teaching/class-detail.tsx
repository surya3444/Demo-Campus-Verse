import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { teachingApi, StudentInSection, LessonPlan } from '@/api/teaching';

type TabKey = 'students' | 'lessons';

const TEACHING_STATUS: Record<string, { color: string; bg: string; label: string }> = {
  not_started: { color: '#94a3b8', bg: '#f1f5f9', label: 'Not Started' },
  ongoing: { color: '#2563eb', bg: '#dbeafe', label: 'In Progress' },
  delivered: { color: '#4f46e5', bg: '#eef2ff', label: 'Delivered' },
  completed_with_assignment: { color: '#d97706', bg: '#fef3c7', label: 'Done + HW' },
  completed: { color: '#16a34a', bg: '#dcfce7', label: 'Completed' },
};

const AVATAR_COLORS = [
  '#4f46e5',
  '#0891b2',
  '#059669',
  '#d97706',
  '#dc2626',
  '#7c3aed',
  '#db2777',
  '#0d9488',
];

function StudentRow({ student, index }: { student: StudentInSection; index: number }) {
  const color = AVATAR_COLORS[index % AVATAR_COLORS.length];
  const initials = `${student.firstName?.[0] || ''}${student.lastName?.[0] || ''}`;

  return (
    <View style={s.studentRow}>
      <View style={[s.avatar, { backgroundColor: `${color}15` }]}>
        <Text style={[s.avatarText, { color }]}>{initials}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.studentName}>
          {student.displayName || `${student.firstName} ${student.lastName}`}
        </Text>
        <Text style={s.studentAdm}>{student.admissionNumber}</Text>
      </View>
      <View
        style={[
          s.statusDot,
          { backgroundColor: student.status === 'active' ? '#16a34a' : '#ef4444' },
        ]}
      />
    </View>
  );
}

function LessonRow({ plan }: { plan: LessonPlan }) {
  const router = useRouter();
  const ts = TEACHING_STATUS[plan.teachingStatus] || TEACHING_STATUS.not_started;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => router.push(`/teaching/lesson-plan?id=${plan._id}`)}
    >
      <View style={s.lessonRow}>
        <View style={s.lessonLeft}>
          <View
            style={[
              s.lessonDot,
              { backgroundColor: plan.status === 'published' ? '#4f46e5' : '#cbd5e1' },
            ]}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.lessonTitle} numberOfLines={1}>
            {plan.title}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
            {plan.subjectName && <Text style={s.lessonMeta}>{plan.subjectName}</Text>}
            <Text style={[s.lessonMeta, { color: '#cbd5e1', marginHorizontal: 6 }]}>·</Text>
            <Text style={s.lessonMeta}>
              {new Date(plan.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </Text>
          </View>
        </View>
        <View style={[s.tsBadge, { backgroundColor: ts.bg }]}>
          <Text style={[s.tsText, { color: ts.color }]}>{ts.label}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ClassDetailScreen() {
  const { sectionId, className, sectionName } = useLocalSearchParams<{
    sectionId: string;
    className: string;
    sectionName: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('students');
  const [searchQuery, setSearchQuery] = useState('');

  const {
    data: studentsData,
    refetch: refetchStudents,
    isLoading: studentsLoading,
  } = useQuery({
    queryKey: ['section-students', sectionId, searchQuery],
    queryFn: () =>
      teachingApi.getSectionStudents(sectionId!, { search: searchQuery || undefined, limit: 100 }),
    enabled: !!sectionId,
  });

  const {
    data: lessonPlansData,
    refetch: refetchLessons,
    isLoading: lessonsLoading,
  } = useQuery({
    queryKey: ['section-lesson-plans', sectionId],
    queryFn: () => teachingApi.getSectionLessonPlans(sectionId!, { limit: 100 }),
    enabled: !!sectionId,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchStudents(), refetchLessons()]);
    setRefreshing(false);
  }, [refetchStudents, refetchLessons]);

  const students = studentsData?.data || [];
  const lessonPlans = lessonPlansData?.data || [];
  const studentCount = studentsData?.meta?.total || students.length;
  const planCount = lessonPlansData?.meta?.total || lessonPlans.length;
  const isLoading = activeTab === 'students' ? studentsLoading : lessonsLoading;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
        {/* Hero header */}
        <View style={s.hero}>
          {/* Decorative circle */}
          <View style={s.heroCircle} />

          <View style={{ paddingTop: insets.top + 8, paddingBottom: 24, paddingHorizontal: 20 }}>
            {/* Back button row */}
            <TouchableOpacity
              onPress={() => router.back()}
              activeOpacity={0.7}
              style={s.backBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-back" size={22} color="#ffffff" />
              <Text style={s.backText}>Back</Text>
            </TouchableOpacity>

            <Text style={s.heroTitle}>{className || 'Class'}</Text>
            <Text style={s.heroSubtitle}>Section {sectionName}</Text>
          </View>
        </View>

        {/* Card that overlaps the hero */}
        <View style={s.cardContainer}>
          {/* Tab switcher */}
          <View style={s.tabRow}>
            {(['students', 'lessons'] as TabKey[]).map((tab) => {
              const active = activeTab === tab;
              return (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  activeOpacity={0.7}
                  style={[s.tabBtn, active && s.tabBtnActive]}
                >
                  <Ionicons
                    name={
                      tab === 'students'
                        ? active
                          ? 'people'
                          : 'people-outline'
                        : active
                          ? 'document-text'
                          : 'document-text-outline'
                    }
                    size={15}
                    color={active ? '#4f46e5' : '#94a3b8'}
                  />
                  <Text style={[s.tabText, active && s.tabTextActive]}>
                    {tab === 'students'
                      ? `Students (${studentCount})`
                      : `Lesson Plans (${planCount})`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Search bar — students only */}
          {activeTab === 'students' && (
            <View style={s.searchWrap}>
              <Ionicons name="search" size={16} color="#94a3b8" />
              <TextInput
                style={s.searchInput}
                placeholder="Search by name or admission no..."
                placeholderTextColor="#cbd5e1"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchQuery('')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={16} color="#cbd5e1" />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Content list */}
          <ScrollView
            style={{ flex: 1 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4f46e5" />
            }
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 32 }}
          >
            {isLoading ? (
              <View style={{ alignItems: 'center', paddingVertical: 48 }}>
                <ActivityIndicator size="large" color="#4f46e5" />
              </View>
            ) : activeTab === 'students' ? (
              students.length === 0 ? (
                <EmptyState
                  icon="people-outline"
                  title="No students found"
                  subtitle={
                    searchQuery ? 'Try a different search term' : 'No students in this section'
                  }
                />
              ) : (
                students.map((student, index) => (
                  <StudentRow key={student._id} student={student} index={index} />
                ))
              )
            ) : lessonPlans.length === 0 ? (
              <EmptyState
                icon="document-text-outline"
                title="No lesson plans yet"
                subtitle="Create your first lesson plan for this class"
                actionLabel="Create Plan"
                onAction={() => router.push(`/teaching/lesson-plan-form?sectionId=${sectionId}`)}
              />
            ) : (
              lessonPlans.map((plan) => <LessonRow key={plan._id} plan={plan} />)
            )}
          </ScrollView>
        </View>

        {/* FAB */}
        {activeTab === 'lessons' && (
          <TouchableOpacity
            onPress={() => router.push(`/teaching/lesson-plan-form?sectionId=${sectionId}`)}
            activeOpacity={0.8}
            style={s.fab}
          >
            <Ionicons name="add" size={24} color="#fff" />
            <Text style={s.fabText}>New Plan</Text>
          </TouchableOpacity>
        )}
      </View>
    </>
  );
}

function EmptyState({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: '#eef2ff',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
        }}
      >
        <Ionicons name={icon} size={28} color="#4f46e5" />
      </View>
      <Text style={{ color: '#1e293b', fontWeight: '600', fontSize: 15 }}>{title}</Text>
      <Text style={{ color: '#94a3b8', fontSize: 13, marginTop: 4, textAlign: 'center' }}>
        {subtitle}
      </Text>
      {actionLabel && onAction && (
        <TouchableOpacity
          onPress={onAction}
          activeOpacity={0.7}
          style={{
            marginTop: 16,
            backgroundColor: '#4f46e5',
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 10,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  hero: {
    backgroundColor: '#4f46e5',
    overflow: 'hidden',
  },
  heroCircle: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.06)',
    top: -30,
    right: -40,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginLeft: -4,
  },
  backText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 2,
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    color: 'rgba(199,210,254,0.9)',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
  },
  // Card
  cardContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -16,
    paddingTop: 4,
  },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    marginHorizontal: 4,
    backgroundColor: '#f8fafc',
  },
  tabBtnActive: {
    backgroundColor: '#eef2ff',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#94a3b8',
    marginLeft: 6,
  },
  tabTextActive: {
    color: '#4f46e5',
    fontWeight: '700',
  },

  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#1e293b',
  },

  // Students
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '700',
  },
  studentName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  studentAdm: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Lessons
  lessonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  lessonLeft: {
    width: 24,
    alignItems: 'center',
    marginRight: 8,
  },
  lessonDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  lessonTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  lessonMeta: {
    fontSize: 12,
    color: '#94a3b8',
  },
  tsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 8,
  },
  tsText: {
    fontSize: 10,
    fontWeight: '700',
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4f46e5',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  fabText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
    marginLeft: 6,
  },
});

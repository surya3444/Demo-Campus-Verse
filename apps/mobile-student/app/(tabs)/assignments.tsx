import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useState, useCallback, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore, useIsParent } from '@campus-verse/mobile-shared/store/authStore';
import { useCurrentStudentId } from '@campus-verse/mobile-shared/hooks/useAuth';
import { studentApi } from '@/api/student';

const _FC = '#F9F8F5';
function BottomFade() {
  return (
    <View style={_fs.c} pointerEvents="none">
      {Array.from({ length: 40 }, (_, i) => (
        <View
          key={i}
          style={{ flex: 1, backgroundColor: _FC, opacity: Math.min((i / 39) ** 2 * 2.5, 1) }}
        />
      ))}
    </View>
  );
}
const _fs = StyleSheet.create({
  c: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, zIndex: 1 },
});

type FilterTab = 'all' | 'pending' | 'submitted' | 'graded';
const FILTERS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'graded', label: 'Graded' },
];

interface UnifiedItem {
  _id: string;
  title: string;
  kind: 'assignment' | 'questionnaire';
  subjectName?: string;
  dueDate?: string;
  totalMarks: number;
  status: 'pending' | 'submitted' | 'graded';
  marksObtained?: number;
  isOverdue: boolean;
}

const STATUS_STYLE: Record<string, { color: string; bg: string; label: string; icon: string }> = {
  pending: { color: '#f59e0b', bg: '#fef3c7', label: 'Pending', icon: 'time-outline' },
  submitted: {
    color: '#0749BB',
    bg: '#F0F5FE',
    label: 'Submitted',
    icon: 'checkmark-circle-outline',
  },
  graded: { color: '#10b981', bg: '#f0fdf4', label: 'Graded', icon: 'ribbon-outline' },
};

export default function StudentAssignmentsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterTab>('all');
  const router = useRouter();
  const isParent = useIsParent();
  const studentId = useCurrentStudentId();
  const selectedChild = useAuthStore((s) => s.selectedChild);

  // Get sectionId
  const { data: dashboard } = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: () => studentApi.getStudentDashboard(),
    enabled: !isParent,
  });

  const sectionId = isParent ? selectedChild?.sectionId : dashboard?.student?.sectionId;

  // Fetch assignments & questionnaires
  const {
    data: assignmentsData,
    refetch: r1,
    isLoading: l1,
  } = useQuery({
    queryKey: ['student-assignments', sectionId],
    queryFn: () =>
      studentApi.getAssignments({ sectionId: sectionId!, status: 'published', limit: 50 }),
    enabled: !!sectionId,
  });

  const {
    data: questionnairesData,
    refetch: r2,
    isLoading: l2,
  } = useQuery({
    queryKey: ['student-questionnaires', sectionId],
    queryFn: () =>
      studentApi.getQuestionnaires({ sectionId: sectionId!, status: 'published', limit: 50 }),
    enabled: !!sectionId,
  });

  // Submitted IDs from dashboard
  const submittedAssignmentIds = new Set(dashboard?.submittedIds?.assignments || []);
  const submittedQuestionnaireIds = new Set(dashboard?.submittedIds?.questionnaires || []);

  // Grades
  const { data: grades, refetch: r3 } = useQuery({
    queryKey: ['student-grades', studentId],
    queryFn: () => studentApi.getStudentGrades(studentId!),
    enabled: !!studentId,
  });

  const gradeMap = useMemo(() => {
    const m = new Map<string, number>();
    grades?.forEach((g) => m.set(g.assignmentId, g.marksObtained));
    return m;
  }, [grades]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([r1(), r2(), r3()]);
    setRefreshing(false);
  }, [r1, r2, r3]);

  // Build unified list
  const items: UnifiedItem[] = useMemo(() => {
    const now = new Date();
    const list: UnifiedItem[] = [];

    (assignmentsData?.data || []).forEach((a) => {
      const isSubmitted = submittedAssignmentIds.has(a._id);
      const marks = gradeMap.get(a._id);
      const isGraded = marks !== undefined;
      const isOverdue = a.dueDate ? new Date(a.dueDate) < now && !isSubmitted : false;

      list.push({
        _id: a._id,
        title: a.title,
        kind: 'assignment',
        subjectName: a.subjectName,
        dueDate: a.dueDate,
        totalMarks: a.totalMarks,
        status: isGraded ? 'graded' : isSubmitted ? 'submitted' : 'pending',
        marksObtained: marks,
        isOverdue,
      });
    });

    (questionnairesData?.data || []).forEach((q) => {
      const isSubmitted = submittedQuestionnaireIds.has(q._id);
      // Questionnaire grades could use assignmentId mapping — for now check submission
      list.push({
        _id: q._id,
        title: q.title,
        kind: 'questionnaire',
        subjectName: q.subjectName,
        dueDate: q.dueDate,
        totalMarks: q.totalMarks,
        status: isSubmitted ? 'submitted' : 'pending',
        isOverdue: q.dueDate ? new Date(q.dueDate) < now && !isSubmitted : false,
      });
    });

    // Sort: pending first, then by due date
    list.sort((a, b) => {
      const order = { pending: 0, submitted: 1, graded: 2 };
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return da - db;
    });

    return list;
  }, [
    assignmentsData,
    questionnairesData,
    submittedAssignmentIds,
    submittedQuestionnaireIds,
    gradeMap,
  ]);

  const filtered = filter === 'all' ? items : items.filter((i) => i.status === filter);
  const isLoading = l1 || l2;

  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: '#F9F8F5' }}>
      {/* Header + Filter */}
      <View style={{ backgroundColor: '#ffffff', paddingTop: insets.top }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14 }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: '#042A6C', letterSpacing: -0.3 }}>
            My Work
          </Text>
          <Text style={{ fontSize: 13, color: '#8998B3', marginTop: 2 }}>
            Assignments & Quizzes
          </Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, borderBottomWidth: 1, borderBottomColor: '#EDF0F3' }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12, gap: 8 }}
        >
          {FILTERS.map((f) => {
            const count =
              f.key === 'all' ? items.length : items.filter((i) => i.status === f.key).length;
            const active = filter === f.key;
            return (
              <TouchableOpacity key={f.key} onPress={() => setFilter(f.key)} activeOpacity={0.7}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 14,
                    paddingVertical: 7,
                    borderRadius: 20,
                    backgroundColor: active ? '#0749BB' : '#EDF0F3',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: active ? '#ffffff' : '#526C98',
                    }}
                  >
                    {f.label}
                  </Text>
                  <View
                    style={{
                      marginLeft: 6,
                      paddingHorizontal: 6,
                      paddingVertical: 1,
                      borderRadius: 10,
                      backgroundColor: active ? 'rgba(255,255,255,0.25)' : '#DAE0E7',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: '700',
                        color: active ? '#ffffff' : '#8998B3',
                      }}
                    >
                      {count}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0749BB" />
        }
        showsVerticalScrollIndicator={false}
      >
        {isLoading || !sectionId ? (
          <View className="items-center py-16">
            <ActivityIndicator size="large" color="#0749BB" />
          </View>
        ) : filtered.length === 0 ? (
          <View className="bg-white rounded-2xl p-10 items-center mt-4" style={{ elevation: 1 }}>
            <View className="w-16 h-16 bg-secondary-50 rounded-full items-center justify-center mb-3">
              <Ionicons name="checkmark-done-outline" size={28} color="#8998B3" />
            </View>
            <Text className="text-secondary-800 font-semibold">
              {filter === 'all' ? 'No assignments yet' : `No ${filter} assignments`}
            </Text>
          </View>
        ) : (
          filtered.map((item) => (
            <AssignmentCard
              key={`${item.kind}-${item._id}`}
              item={item}
              onPress={() =>
                router.push(`/student/assignment-detail?id=${item._id}&kind=${item.kind}` as never)
              }
            />
          ))
        )}
      </ScrollView>
      <BottomFade />
    </View>
  );
}

function AssignmentCard({ item, onPress }: { item: UnifiedItem; onPress: () => void }) {
  const ss = STATUS_STYLE[item.status];

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} className="mb-3">
      <View
        className="bg-white rounded-2xl overflow-hidden"
        style={{
          borderWidth: item.isOverdue ? 1.5 : 1,
          borderColor: item.isOverdue ? '#fca5a5' : '#EDF0F3',
          elevation: 1,
        }}
      >
        <View className="p-4">
          {/* Header: title + status */}
          <View className="flex-row items-start justify-between mb-2">
            <View className="flex-1 mr-3">
              <Text className="text-sm font-bold text-secondary-800" numberOfLines={2}>
                {item.title}
              </Text>
            </View>
            <View
              className="flex-row items-center px-2 py-1 rounded-full"
              style={{ backgroundColor: ss.bg }}
            >
              <Ionicons
                name={ss.icon as keyof typeof Ionicons.glyphMap}
                size={12}
                color={ss.color}
              />
              <Text className="text-[10px] font-bold ml-1" style={{ color: ss.color }}>
                {item.status === 'graded' && item.marksObtained !== undefined
                  ? `${item.marksObtained}/${item.totalMarks}`
                  : ss.label}
              </Text>
            </View>
          </View>

          {/* Meta row */}
          <View className="flex-row items-center flex-wrap">
            {/* Type badge */}
            <View className="flex-row items-center mr-3">
              <Ionicons
                name={
                  item.kind === 'questionnaire' ? 'help-circle-outline' : 'document-text-outline'
                }
                size={13}
                color="#8998B3"
              />
              <Text className="text-xs text-secondary-400 ml-1">
                {item.kind === 'questionnaire' ? 'Quiz' : 'Assignment'}
              </Text>
            </View>

            {item.subjectName ? (
              <View className="flex-row items-center mr-3">
                <Ionicons name="book-outline" size={13} color="#8998B3" />
                <Text className="text-xs text-secondary-500 ml-1 font-medium">{item.subjectName}</Text>
              </View>
            ) : null}

            <View className="flex-row items-center mr-3">
              <Ionicons name="trophy-outline" size={13} color="#8998B3" />
              <Text className="text-xs text-secondary-400 ml-1">{item.totalMarks} marks</Text>
            </View>
          </View>

          {/* Due date */}
          {item.dueDate ? (
            <View className="flex-row items-center mt-2">
              <Ionicons
                name="time-outline"
                size={13}
                color={item.isOverdue ? '#ef4444' : '#8998B3'}
              />
              <Text
                className="text-xs ml-1 font-medium"
                style={{ color: item.isOverdue ? '#ef4444' : '#8998B3' }}
              >
                {item.isOverdue ? 'Overdue · ' : 'Due '}
                {new Date(item.dueDate).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

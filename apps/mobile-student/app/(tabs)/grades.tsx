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
import { useCurrentStudentId } from '@campus-verse/mobile-shared/hooks/useAuth';
import { studentApi, type StudentGrade } from '@/api/student';

const _FC = '#f8fafc';
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

function scoreColor(pct: number): string {
  if (pct >= 80) return '#059669';
  if (pct >= 60) return '#3b82f6';
  if (pct >= 40) return '#d97706';
  return '#dc2626';
}

function scoreBg(pct: number): string {
  if (pct >= 80) return '#f0fdf4';
  if (pct >= 60) return '#eff6ff';
  if (pct >= 40) return '#fef3c7';
  return '#fef2f2';
}

function scoreLabel(pct: number): string {
  if (pct >= 80) return 'Excellent';
  if (pct >= 60) return 'Good';
  if (pct >= 40) return 'Average';
  return 'Needs Work';
}

export default function StudentGradesScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const studentId = useCurrentStudentId();

  const {
    data: grades,
    refetch,
    isLoading,
  } = useQuery({
    queryKey: ['student-grades', studentId],
    queryFn: () => studentApi.getStudentGrades(studentId!),
    enabled: !!studentId,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const stats = useMemo(() => {
    if (!grades || grades.length === 0) return null;
    const total = grades.length;
    const avg =
      grades.reduce((sum, g) => {
        const pct = g.totalMarks > 0 ? (g.marksObtained / g.totalMarks) * 100 : 0;
        return sum + pct;
      }, 0) / total;
    const best = Math.max(
      ...grades.map((g) => (g.totalMarks > 0 ? (g.marksObtained / g.totalMarks) * 100 : 0))
    );
    return { total, avg: Math.round(avg), best: Math.round(best) };
  }, [grades]);

  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <View
        style={{
          backgroundColor: '#ffffff',
          paddingTop: insets.top,
          paddingHorizontal: 20,
          paddingBottom: 14,
          borderBottomWidth: 1,
          borderBottomColor: '#f1f5f9',
        }}
      >
        <View style={{ paddingTop: 12 }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: '#0f172a', letterSpacing: -0.3 }}>
            My Grades
          </Text>
          <Text style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>
            Performance & Results
          </Text>
        </View>
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
        }
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View className="items-center py-16">
            <ActivityIndicator size="large" color="#3b82f6" />
          </View>
        ) : !grades || grades.length === 0 ? (
          <View
            className="bg-white rounded-2xl p-10 items-center mt-4 mx-4"
            style={{ elevation: 1 }}
          >
            <View className="w-16 h-16 bg-gray-50 rounded-full items-center justify-center mb-3">
              <Ionicons name="stats-chart-outline" size={28} color="#94a3b8" />
            </View>
            <Text className="text-gray-900 font-semibold">No grades yet</Text>
            <Text className="text-gray-400 text-sm mt-1">
              Grades will appear here once your work is reviewed
            </Text>
          </View>
        ) : (
          <>
            {/* Summary cards */}
            {stats && (
              <View className="flex-row px-4 pt-4 gap-2">
                <SummaryCard
                  icon="layers-outline"
                  label="Total Graded"
                  value={`${stats.total}`}
                  color="#3b82f6"
                  bg="#eff6ff"
                />
                <SummaryCard
                  icon="trending-up-outline"
                  label="Average"
                  value={`${stats.avg}%`}
                  color={scoreColor(stats.avg)}
                  bg={scoreBg(stats.avg)}
                />
                <SummaryCard
                  icon="trophy-outline"
                  label="Best"
                  value={`${stats.best}%`}
                  color="#059669"
                  bg="#f0fdf4"
                />
              </View>
            )}

            {/* Grade list */}
            <View className="px-4 pt-4">
              <Text className="text-base font-bold text-gray-900 mb-3">All Grades</Text>
              {grades.map((grade) => (
                <GradeCard
                  key={grade._id}
                  grade={grade}
                  onPress={() =>
                    router.push(
                      `/student/grade-detail?assignmentId=${grade.assignmentId}&kind=assignment` as never
                    )
                  }
                />
              ))}
            </View>
          </>
        )}
        <View className="h-24" />
      </ScrollView>
      <BottomFade />
    </View>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  color,
  bg,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  color: string;
  bg: string;
}) {
  return (
    <View
      className="flex-1 rounded-2xl p-3 items-center"
      style={{ backgroundColor: bg, borderWidth: 1, borderColor: `${color}20` }}
    >
      <View
        className="w-8 h-8 rounded-lg items-center justify-center mb-2"
        style={{ backgroundColor: `${color}15` }}
      >
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text className="text-lg font-bold" style={{ color }}>
        {value}
      </Text>
      <Text className="text-[10px] font-semibold text-gray-400 mt-0.5">{label}</Text>
    </View>
  );
}

function GradeCard({ grade, onPress }: { grade: StudentGrade; onPress: () => void }) {
  const pct = grade.totalMarks > 0 ? Math.round((grade.marksObtained / grade.totalMarks) * 100) : 0;
  const color = scoreColor(pct);
  const label = scoreLabel(pct);

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} className="mb-3">
      <View
        className="bg-white rounded-2xl overflow-hidden flex-row items-center"
        style={{ borderWidth: 1, borderColor: '#f1f5f9', elevation: 1 }}
      >
        {/* Score circle */}
        <View className="w-20 py-4 items-center justify-center">
          <View
            className="w-12 h-12 rounded-full items-center justify-center"
            style={{ backgroundColor: scoreBg(pct), borderWidth: 2, borderColor: `${color}30` }}
          >
            <Text className="text-sm font-bold" style={{ color }}>
              {pct}%
            </Text>
          </View>
        </View>

        {/* Content */}
        <View className="flex-1 py-3 pr-4">
          <Text className="text-sm font-bold text-gray-900" numberOfLines={1}>
            {grade.assignmentTitle || 'Assignment'}
          </Text>
          {grade.subjectName ? (
            <View className="flex-row items-center mt-1">
              <Ionicons name="book-outline" size={12} color="#94a3b8" />
              <Text className="text-xs text-gray-500 ml-1">{grade.subjectName}</Text>
            </View>
          ) : null}
          <View className="flex-row items-center mt-1">
            <Text className="text-xs text-gray-400">
              {grade.marksObtained}/{grade.totalMarks} marks
            </Text>
            <View
              className="ml-2 px-2 py-0.5 rounded-full"
              style={{ backgroundColor: scoreBg(pct) }}
            >
              <Text className="text-[10px] font-bold" style={{ color }}>
                {label}
              </Text>
            </View>
          </View>
          {grade.remarks ? (
            <Text className="text-xs text-gray-400 mt-1" numberOfLines={1}>
              "{grade.remarks}"
            </Text>
          ) : null}
        </View>

        <Ionicons name="chevron-forward" size={16} color="#d1d5db" style={{ marginRight: 12 }} />
      </View>
    </TouchableOpacity>
  );
}

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { examsApi, type Exam, type ExamSchedule } from '@/api/exams';

export default function ExamDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const examQuery = useQuery({
    queryKey: ['exam', id],
    queryFn: () => examsApi.getExam(id),
    enabled: !!id,
  });

  const schedulesQuery = useQuery({
    queryKey: ['exam-schedules', id],
    queryFn: () => examsApi.listSchedules({ examId: id }),
    enabled: !!id,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([examQuery.refetch(), schedulesQuery.refetch()]);
    setRefreshing(false);
  }, [examQuery, schedulesQuery]);

  const exam = examQuery.data as Exam | undefined;
  const schedules = (schedulesQuery.data as ExamSchedule[] | undefined) || [];

  if (examQuery.isLoading || !exam) {
    return (
      <View className="flex-1 items-center justify-center bg-secondary-50">
        <ActivityIndicator color="#053495" />
      </View>
    );
  }

  // Group schedules by paper for cleaner rendering.
  const byPaper = new Map<string, ExamSchedule[]>();
  for (const s of schedules) {
    if (!byPaper.has(s.paperId)) byPaper.set(s.paperId, []);
    byPaper.get(s.paperId)!.push(s);
  }

  return (
    <View className="flex-1 bg-secondary-50">
      <Stack.Screen options={{ title: exam.name }} />
      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View className="bg-white rounded-2xl p-4 mb-4">
          <Text className="text-xs font-semibold uppercase tracking-wider text-secondary-500">
            {exam.termName}
          </Text>
          <Text className="text-xl font-bold text-secondary-800 mt-1">{exam.name}</Text>
          <Text className="text-sm text-secondary-600 mt-1 capitalize">
            {exam.type.replace('_', ' ')} · Status:{' '}
            <Text className="font-semibold">{exam.status.replace('_', ' ')}</Text>
          </Text>
          {exam.startDate && (
            <Text className="text-xs text-secondary-500 mt-2">
              {new Date(exam.startDate).toLocaleDateString()}
              {exam.endDate ? ` → ${new Date(exam.endDate).toLocaleDateString()}` : ''}
            </Text>
          )}
        </View>

        <Text className="text-sm font-semibold text-secondary-700 mb-2 px-1">Papers</Text>
        {exam.papers.map((p) => {
          const paperSchedules = byPaper.get(p._id) || [];
          return (
            <View
              key={p._id}
              className="bg-white rounded-2xl p-4 mb-3"
              style={{
                elevation: 1,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.04,
                shadowRadius: 6,
              }}
            >
              <View className="flex-row items-center justify-between mb-2">
                <Text className="font-semibold text-base text-secondary-800">{p.subjectName}</Text>
                <Text className="text-xs text-secondary-500">
                  {p.totalMarks} marks · pass {p.passMarks}
                </Text>
              </View>
              {paperSchedules.length === 0 ? (
                <Text className="text-xs text-secondary-500 italic">Not scheduled yet</Text>
              ) : (
                paperSchedules.map((s) => (
                  <TouchableOpacity
                    key={s._id}
                    activeOpacity={0.7}
                    onPress={() => router.push(`/exams/marks/${s._id}?examId=${exam._id}` as never)}
                    className="flex-row items-center justify-between bg-secondary-50 rounded-xl px-3 py-3 mt-2"
                  >
                    <View className="flex-1">
                      <Text className="font-medium text-secondary-800 text-sm">
                        {s.className} · {s.sectionName}
                      </Text>
                      <Text className="text-xs text-secondary-500 mt-0.5">
                        {new Date(s.date).toLocaleDateString()} · {s.startTime} – {s.endTime}
                        {s.room ? ` · ${s.room}` : ''}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#8998B3" />
                  </TouchableOpacity>
                ))
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { examsApi, type Exam } from '@/api/exams';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  ongoing: 'Ongoing',
  completed: 'Completed',
  results_published: 'Published',
  cancelled: 'Cancelled',
};

const STATUS_COLOR: Record<string, string> = {
  draft: '#526C98',
  scheduled: '#053495',
  ongoing: '#d97706',
  completed: '#7c3aed',
  results_published: '#059669',
  cancelled: '#dc2626',
};

function ExamCard({ exam, onPress }: { exam: Exam; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} className="mb-3">
      <View
        className="bg-white rounded-2xl p-4"
        style={{
          elevation: 2,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
        }}
      >
        <View className="flex-row items-start justify-between">
          <View className="flex-1 mr-3">
            <Text className="font-semibold text-base text-secondary-800">{exam.name}</Text>
            <Text className="text-xs text-secondary-500 mt-0.5">
              {exam.termName} · {exam.papers.length} paper(s)
            </Text>
            {exam.startDate && (
              <Text className="text-xs text-secondary-500 mt-1">
                {new Date(exam.startDate).toLocaleDateString()}
                {exam.endDate ? ` → ${new Date(exam.endDate).toLocaleDateString()}` : ''}
              </Text>
            )}
          </View>
          <View
            className="px-2 py-1 rounded-full"
            style={{ backgroundColor: STATUS_COLOR[exam.status] + '20' }}
          >
            <Text
              className="text-[10px] font-semibold uppercase"
              style={{ color: STATUS_COLOR[exam.status] }}
            >
              {STATUS_LABEL[exam.status]}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ExamsTabScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['exams'],
    queryFn: examsApi.listExams,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const exams = (data as Exam[] | undefined) || [];

  return (
    <View className="flex-1 bg-secondary-50">
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {isLoading ? (
          <View className="items-center justify-center py-12">
            <ActivityIndicator color="#053495" />
          </View>
        ) : exams.length === 0 ? (
          <View className="items-center justify-center py-16">
            <Ionicons name="document-text-outline" size={48} color="#D3DAE4" />
            <Text className="text-base font-medium text-secondary-700 mt-3">No exams</Text>
            <Text className="text-sm text-secondary-500 mt-1 text-center max-w-xs">
              Once an admin schedules an exam, it will appear here.
            </Text>
          </View>
        ) : (
          exams.map((exam) => (
            <ExamCard
              key={exam._id}
              exam={exam}
              onPress={() => router.push(`/exams/${exam._id}` as never)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

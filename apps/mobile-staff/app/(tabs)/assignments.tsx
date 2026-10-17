import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { teachingApi, Assignment } from '@/api/teaching';

const _FC = '#f8fafc';
const _STEPS = 40;
function BottomFade() {
  return (
    <View style={_fs.c} pointerEvents="none">
      {Array.from({ length: _STEPS }, (_, i) => {
        const t = i / (_STEPS - 1);
        const o = Math.min(t * t * 2.5, 1);
        return <View key={i} style={{ flex: 1, backgroundColor: _FC, opacity: o }} />;
      })}
    </View>
  );
}
const _fs = StyleSheet.create({
  c: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, zIndex: 1 },
});

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'published', label: 'Published' },
  { key: 'grading', label: 'Grading' },
  { key: 'completed', label: 'Completed' },
];

const STATUS_STYLE: Record<
  string,
  { color: string; bg: string; label: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  draft: { color: '#64748b', bg: '#f1f5f9', label: 'Draft', icon: 'document-outline' },
  published: { color: '#2563eb', bg: '#dbeafe', label: 'Published', icon: 'paper-plane-outline' },
  grading: { color: '#d97706', bg: '#fef3c7', label: 'Grading', icon: 'create-outline' },
  completed: {
    color: '#16a34a',
    bg: '#dcfce7',
    label: 'Completed',
    icon: 'checkmark-done-outline',
  },
};

function AssignmentCard({ assignment }: { assignment: Assignment }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const style = STATUS_STYLE[assignment.status] || STATUS_STYLE.draft;
  const isOverdue = new Date(assignment.dueDate) < new Date() && assignment.status !== 'completed';

  const publishMutation = useMutation({
    mutationFn: () => teachingApi.publishAssignment(assignment._id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assignments'] }),
    onError: () => Alert.alert('Error', 'Failed to publish'),
  });

  const startGradingMutation = useMutation({
    mutationFn: () => teachingApi.startGrading(assignment._id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assignments'] }),
    onError: () => Alert.alert('Error', 'Failed to start grading'),
  });

  const completeMutation = useMutation({
    mutationFn: () => teachingApi.completeAssignment(assignment._id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assignments'] }),
    onError: () => Alert.alert('Error', 'Failed to complete'),
  });

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => router.push(`/teaching/assignment-detail?id=${assignment._id}`)}
      className="mb-2.5"
    >
      <View
        className="bg-white rounded-xl overflow-hidden border border-gray-100"
        style={{
          elevation: 1,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.03,
          shadowRadius: 4,
        }}
      >
        <View className="p-4">
          {/* Title + Status */}
          <View className="flex-row items-start mb-2">
            <Text className="text-[15px] font-semibold text-gray-900 flex-1 mr-2" numberOfLines={2}>
              {assignment.title}
            </Text>
            <View
              className="flex-row items-center px-2 py-0.5 rounded"
              style={{ backgroundColor: style.bg }}
            >
              <Ionicons name={style.icon} size={10} color={style.color} />
              <Text className="text-[10px] font-bold ml-1" style={{ color: style.color }}>
                {style.label}
              </Text>
            </View>
          </View>

          {/* Meta row */}
          <View className="flex-row items-center flex-wrap mb-2.5">
            {assignment.subjectName && (
              <View className="flex-row items-center mr-3">
                <View className="w-2 h-2 rounded-full bg-cyan-400 mr-1.5" />
                <Text className="text-xs text-gray-500 font-medium">{assignment.subjectName}</Text>
              </View>
            )}
            {assignment.className && (
              <View className="flex-row items-center mr-3">
                <Ionicons name="people-outline" size={11} color="#94a3b8" />
                <Text className="text-xs text-gray-400 ml-1">
                  {assignment.className}
                  {assignment.sectionName ? ` · ${assignment.sectionName}` : ''}
                </Text>
              </View>
            )}
            <View className="flex-row items-center">
              <Ionicons name="ribbon-outline" size={11} color="#94a3b8" />
              <Text className="text-xs text-gray-400 ml-1">{assignment.totalMarks} marks</Text>
            </View>
          </View>

          {/* Footer: due date + quick actions */}
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <Ionicons name="time-outline" size={12} color={isOverdue ? '#ef4444' : '#94a3b8'} />
              <Text
                className={`text-[11px] ml-1 font-medium ${isOverdue ? 'text-red-500' : 'text-gray-400'}`}
              >
                {isOverdue ? 'Overdue · ' : ''}
                {new Date(assignment.dueDate).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
            </View>

            {/* Quick action */}
            {assignment.status === 'draft' && (
              <TouchableOpacity
                onPress={() => publishMutation.mutate()}
                disabled={publishMutation.isPending}
                className="flex-row items-center bg-blue-50 px-2.5 py-1 rounded-lg"
              >
                {publishMutation.isPending ? (
                  <ActivityIndicator size={10} color="#2563eb" />
                ) : (
                  <>
                    <Ionicons name="paper-plane" size={11} color="#2563eb" />
                    <Text className="text-[11px] text-blue-600 font-semibold ml-1">Publish</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            {assignment.status === 'published' && (
              <TouchableOpacity
                onPress={() => startGradingMutation.mutate()}
                disabled={startGradingMutation.isPending}
                className="flex-row items-center bg-amber-50 px-2.5 py-1 rounded-lg"
              >
                {startGradingMutation.isPending ? (
                  <ActivityIndicator size={10} color="#d97706" />
                ) : (
                  <>
                    <Ionicons name="create" size={11} color="#d97706" />
                    <Text className="text-[11px] text-amber-600 font-semibold ml-1">Grade</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            {assignment.status === 'grading' && (
              <TouchableOpacity
                onPress={() => completeMutation.mutate()}
                disabled={completeMutation.isPending}
                className="flex-row items-center bg-green-50 px-2.5 py-1 rounded-lg"
              >
                {completeMutation.isPending ? (
                  <ActivityIndicator size={10} color="#16a34a" />
                ) : (
                  <>
                    <Ionicons name="checkmark-done" size={11} color="#16a34a" />
                    <Text className="text-[11px] text-green-600 font-semibold ml-1">Complete</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} className="mr-2">
      <View
        className={`px-3 py-1.5 rounded-lg ${active ? '' : 'border border-gray-200'}`}
        style={active ? { backgroundColor: '#4f46e5' } : { backgroundColor: '#fff' }}
      >
        <Text className={`text-xs font-semibold ${active ? 'text-white' : 'text-gray-500'}`}>
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function AssignmentsScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  const params: Record<string, string | number> = { limit: 50 };
  if (statusFilter !== 'all') params.status = statusFilter;

  const { data, refetch, isLoading } = useQuery({
    queryKey: ['assignments', params],
    queryFn: () => teachingApi.getAssignments(params),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const assignments = data?.data || [];

  return (
    <View className="flex-1 bg-gray-50">
      {/* Filters */}
      <View className="bg-white px-4 pt-3 pb-2 border-b border-gray-100">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {STATUS_FILTERS.map((f) => (
            <FilterChip
              key={f.key}
              label={f.label}
              active={statusFilter === f.key}
              onPress={() => setStatusFilter(f.key)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Count */}
      <View className="px-4 pt-3 pb-1">
        <Text className="text-xs text-gray-400 font-medium">
          {data?.meta?.total ?? assignments.length} assignment{assignments.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <ScrollView
        className="flex-1 px-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4f46e5" />
        }
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View className="items-center py-16">
            <ActivityIndicator size="large" color="#4f46e5" />
          </View>
        ) : assignments.length === 0 ? (
          <View className="bg-white rounded-2xl p-10 items-center mt-4" style={{ elevation: 1 }}>
            <View className="w-16 h-16 bg-indigo-50 rounded-full items-center justify-center mb-3">
              <Ionicons name="clipboard-outline" size={28} color="#4f46e5" />
            </View>
            <Text className="text-gray-900 font-semibold">No Assignments</Text>
            <Text className="text-gray-400 text-sm mt-1 text-center">
              {statusFilter !== 'all'
                ? 'No assignments match this filter'
                : 'Create your first assignment'}
            </Text>
          </View>
        ) : (
          assignments.map((a) => <AssignmentCard key={a._id} assignment={a} />)
        )}
        <View className="h-24" />
      </ScrollView>

      <BottomFade />

      {/* FAB */}
      <TouchableOpacity
        onPress={() => router.push('/teaching/assignment-form')}
        activeOpacity={0.8}
        style={{
          position: 'absolute',
          bottom: 100,
          right: 16,
          zIndex: 999,
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
        }}
      >
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14, marginLeft: 6 }}>
          Create Task
        </Text>
      </TouchableOpacity>
    </View>
  );
}

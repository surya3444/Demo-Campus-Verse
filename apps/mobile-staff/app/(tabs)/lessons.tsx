import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { teachingApi, LessonPlan } from '@/api/teaching';

const _FC = '#F9F8F5';
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
];

const TEACHING_FILTERS = [
  { key: 'all', label: 'All Status' },
  { key: 'not_started', label: 'Not Started' },
  { key: 'ongoing', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
];

const STATUS_BADGE: Record<string, { color: string; bg: string; label: string }> = {
  draft: { color: '#526C98', bg: '#EDF0F3', label: 'Draft' },
  published: { color: '#053495', bg: '#E1ECFE', label: 'Published' },
};

const TEACHING_BADGE: Record<string, { color: string; bg: string; label: string }> = {
  not_started: { color: '#8998B3', bg: '#EDF0F3', label: 'Not Started' },
  ongoing: { color: '#053495', bg: '#E1ECFE', label: 'In Progress' },
  delivered: { color: '#053495', bg: '#F0F5FE', label: 'Delivered' },
  completed_with_assignment: { color: '#d97706', bg: '#fef3c7', label: 'Done + HW' },
  completed: { color: '#16a34a', bg: '#dcfce7', label: 'Completed' },
};

function LessonCard({ plan }: { plan: LessonPlan }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const sBadge = STATUS_BADGE[plan.status] || STATUS_BADGE.draft;
  const tBadge = TEACHING_BADGE[plan.teachingStatus] || TEACHING_BADGE.not_started;

  const startMutation = useMutation({
    mutationFn: () =>
      teachingApi.updateLessonPlanTeachingStatus(plan._id, { teachingStatus: 'ongoing' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lesson-plans'] }),
  });

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => router.push(`/teaching/lesson-plan?id=${plan._id}`)}
      className="mb-2.5"
    >
      <View
        className="bg-white rounded-xl p-4 border border-secondary-100"
        style={{
          elevation: 1,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.03,
          shadowRadius: 4,
        }}
      >
        {/* Title + status */}
        <View className="flex-row items-start mb-2">
          <Text className="text-[15px] font-semibold text-secondary-800 flex-1 mr-2" numberOfLines={2}>
            {plan.title}
          </Text>
          <View className="px-2 py-0.5 rounded" style={{ backgroundColor: sBadge.bg }}>
            <Text className="text-[10px] font-bold" style={{ color: sBadge.color }}>
              {sBadge.label}
            </Text>
          </View>
        </View>

        {/* Meta */}
        <View className="flex-row items-center flex-wrap mb-2.5">
          {plan.subjectName && (
            <View className="flex-row items-center mr-3">
              <View className="w-2 h-2 rounded-full bg-primary-400 mr-1.5" />
              <Text className="text-xs text-secondary-500 font-medium">{plan.subjectName}</Text>
            </View>
          )}
          {plan.className && (
            <View className="flex-row items-center mr-3">
              <Ionicons name="people-outline" size={11} color="#8998B3" />
              <Text className="text-xs text-secondary-400 ml-1">
                {plan.className}
                {plan.sectionName ? ` · ${plan.sectionName}` : ''}
              </Text>
            </View>
          )}
          {plan.objectives && plan.objectives.length > 0 && (
            <View className="flex-row items-center">
              <Ionicons name="list-outline" size={11} color="#8998B3" />
              <Text className="text-xs text-secondary-400 ml-1">{plan.objectives.length} steps</Text>
            </View>
          )}
        </View>

        {/* Footer: date, duration, teaching status, quick action */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Text className="text-[11px] text-secondary-400">
              {new Date(plan.date).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </Text>
            {plan.duration && (
              <Text className="text-[11px] text-secondary-300 ml-2">· {plan.duration} min</Text>
            )}
          </View>
          <View className="flex-row items-center">
            <View className="px-2 py-0.5 rounded mr-1.5" style={{ backgroundColor: tBadge.bg }}>
              <Text className="text-[10px] font-bold" style={{ color: tBadge.color }}>
                {tBadge.label}
              </Text>
            </View>
            {plan.teachingStatus === 'not_started' && plan.status === 'published' && (
              <TouchableOpacity
                onPress={() => startMutation.mutate()}
                disabled={startMutation.isPending}
                className="bg-primary-50 px-2 py-1 rounded"
              >
                {startMutation.isPending ? (
                  <ActivityIndicator size={10} color="#053495" />
                ) : (
                  <Ionicons name="play" size={12} color="#053495" />
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
        className={`px-3 py-1.5 rounded-lg ${active ? '' : 'border border-secondary-200'}`}
        style={active ? { backgroundColor: '#053495' } : { backgroundColor: '#fff' }}
      >
        <Text className={`text-xs font-semibold ${active ? 'text-white' : 'text-secondary-500'}`}>
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function LessonPlansScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [teachingFilter, setTeachingFilter] = useState('all');

  const params: Record<string, string | number> = { limit: 50 };
  if (statusFilter !== 'all') params.status = statusFilter;
  if (teachingFilter !== 'all') params.teachingStatus = teachingFilter;

  const { data, refetch, isLoading } = useQuery({
    queryKey: ['lesson-plans', params],
    queryFn: () => teachingApi.getLessonPlans(params),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const plans = data?.data || [];

  return (
    <View className="flex-1 bg-secondary-50">
      {/* Filters */}
      <View className="bg-white px-4 pt-3 pb-2 border-b border-secondary-100">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
          {STATUS_FILTERS.map((f) => (
            <FilterChip
              key={f.key}
              label={f.label}
              active={statusFilter === f.key}
              onPress={() => setStatusFilter(f.key)}
            />
          ))}
          <View className="w-px bg-secondary-200 mx-1 my-1" />
          {TEACHING_FILTERS.map((f) => (
            <FilterChip
              key={f.key}
              label={f.label}
              active={teachingFilter === f.key}
              onPress={() => setTeachingFilter(f.key)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Count */}
      <View className="px-4 pt-3 pb-1">
        <Text className="text-xs text-secondary-400 font-medium">
          {data?.meta?.total ?? plans.length} lesson plan{plans.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <ScrollView
        className="flex-1 px-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#053495" />
        }
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View className="items-center py-16">
            <ActivityIndicator size="large" color="#053495" />
          </View>
        ) : plans.length === 0 ? (
          <View className="bg-white rounded-2xl p-10 items-center mt-4" style={{ elevation: 1 }}>
            <View className="w-16 h-16 bg-primary-50 rounded-full items-center justify-center mb-3">
              <Ionicons name="document-text-outline" size={28} color="#053495" />
            </View>
            <Text className="text-secondary-800 font-semibold">No Lesson Plans</Text>
            <Text className="text-secondary-400 text-sm mt-1 text-center">
              {statusFilter !== 'all' || teachingFilter !== 'all'
                ? 'No plans match your filters'
                : 'Create your first lesson plan'}
            </Text>
          </View>
        ) : (
          plans.map((plan) => <LessonCard key={plan._id} plan={plan} />)
        )}
        <View className="h-24" />
      </ScrollView>

      {/* Gradient fade above tab bar */}
      <BottomFade />

      {/* FAB */}
      <TouchableOpacity
        onPress={() => router.push('/teaching/lesson-plan-form')}
        activeOpacity={0.8}
        style={{
          position: 'absolute',
          bottom: 100,
          right: 16,
          zIndex: 999,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#053495',
          paddingHorizontal: 18,
          paddingVertical: 14,
          borderRadius: 16,
          shadowColor: '#053495',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.35,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14, marginLeft: 6 }}>
          Create Plan
        </Text>
      </TouchableOpacity>
    </View>
  );
}

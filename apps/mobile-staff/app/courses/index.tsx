import { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { coursesApi, Course, useAuthStore } from '@campus-verse/mobile-shared';

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  draft: { bg: '#fef3c7', fg: '#92400e' },
  published: { bg: '#dcfce7', fg: '#166534' },
  archived: { bg: '#f1f5f9', fg: '#64748b' },
};

export default function CoursesScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?._id);
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch, error } = useQuery({
    queryKey: ['my-courses', userId],
    queryFn: () => coursesApi.getCourses({ mine: true, limit: 50 }),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const courses = data?.data || [];

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {isLoading ? (
          <ActivityIndicator color="#4f46e5" style={{ marginVertical: 40 }} />
        ) : error ? (
          <View style={s.emptyCard}>
            <Ionicons name="cloud-offline-outline" size={32} color="#cbd5e1" />
            <Text style={s.emptyTitle}>Courses unavailable</Text>
            <Text style={s.emptyDesc}>
              The Online Courses module may not be enabled for your institution.
            </Text>
          </View>
        ) : courses.length === 0 ? (
          <View style={s.emptyCard}>
            <Ionicons name="library-outline" size={32} color="#cbd5e1" />
            <Text style={s.emptyTitle}>No courses yet</Text>
            <Text style={s.emptyDesc}>Create your first online course to get started.</Text>
          </View>
        ) : (
          courses.map((c: Course) => {
            const colors = STATUS_COLORS[c.status] || STATUS_COLORS.draft;
            return (
              <TouchableOpacity
                key={c._id}
                style={s.card}
                onPress={() => router.push(`/courses/course-detail?id=${c._id}` as never)}
                activeOpacity={0.85}
              >
                {c.thumbnail ? (
                  <Image source={{ uri: c.thumbnail }} style={s.thumb} />
                ) : (
                  <View style={[s.thumb, s.thumbFallback]}>
                    <Ionicons name="book" size={24} color="#4f46e5" />
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={s.title} numberOfLines={1}>
                      {c.title}
                    </Text>
                    <View style={[s.pill, { backgroundColor: colors.bg, marginLeft: 8 }]}>
                      <Text style={[s.pillText, { color: colors.fg }]}>
                        {c.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  {c.subjectName && <Text style={s.subject}>{c.subjectName}</Text>}
                  <View style={s.metaRow}>
                    <Meta icon="document-text-outline" text={`${c.lessonCount || 0} lessons`} />
                    <Meta icon="help-circle-outline" text={`${c.quizCount || 0} quizzes`} />
                    <Meta icon="people-outline" text={`${c.enrollmentCount || 0}`} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={s.fab}
        activeOpacity={0.85}
        onPress={() => router.push('/courses/course-form' as never)}
      >
        <Ionicons name="add" size={26} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

function Meta({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12 }}>
      <Ionicons name={icon} size={12} color="#94a3b8" />
      <Text style={s.metaText}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eef0f4',
  },
  thumb: { width: 70, height: 70, borderRadius: 10, backgroundColor: '#f1f5f9' },
  thumbFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#eef2ff' },
  title: { flex: 1, fontSize: 15, fontWeight: '700', color: '#1e293b' },
  subject: { fontSize: 12, color: '#64748b', marginTop: 3 },
  pill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  pillText: { fontSize: 9, fontWeight: '800' },
  metaRow: { flexDirection: 'row', marginTop: 8 },
  metaText: { fontSize: 11, color: '#94a3b8', marginLeft: 4, fontWeight: '600' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4f46e5',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eef0f4',
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#64748b', marginTop: 10 },
  emptyDesc: { fontSize: 12, color: '#94a3b8', marginTop: 4, textAlign: 'center' },
});

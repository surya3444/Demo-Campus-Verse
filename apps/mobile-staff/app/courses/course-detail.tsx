import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { coursesApi, CourseLesson, CourseQuiz } from '@campus-verse/mobile-shared';

type Tab = 'lessons' | 'quizzes' | 'students';

export default function CourseDetailScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('lessons');
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: course,
    refetch: rCourse,
    isLoading: lCourse,
  } = useQuery({
    queryKey: ['course', id],
    queryFn: () => coursesApi.getCourse(id as string),
    enabled: !!id,
  });

  const { data: lessons, refetch: rLessons } = useQuery({
    queryKey: ['course-lessons', id],
    queryFn: () => coursesApi.getLessons(id as string),
    enabled: !!id,
  });

  const { data: quizzes, refetch: rQuizzes } = useQuery({
    queryKey: ['course-quizzes', id],
    queryFn: () => coursesApi.getQuizzes(id as string),
    enabled: !!id,
  });

  const { data: enrollments, refetch: rEnrol } = useQuery({
    queryKey: ['course-enrollments', id],
    queryFn: () => coursesApi.getEnrollments(id as string),
    enabled: !!id,
  });

  const publishMutation = useMutation({
    mutationFn: (status: 'draft' | 'published') =>
      coursesApi.updateCourse(id as string, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['course', id] }),
    onError: (e: Error) => Alert.alert('Update failed', e.message),
  });

  const deleteLessonMutation = useMutation({
    mutationFn: (lessonId: string) => coursesApi.deleteLesson(id as string, lessonId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['course-lessons', id] }),
  });

  const deleteQuizMutation = useMutation({
    mutationFn: (quizId: string) => coursesApi.deleteQuiz(id as string, quizId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['course-quizzes', id] }),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([rCourse(), rLessons(), rQuizzes(), rEnrol()]);
    setRefreshing(false);
  };

  if (lCourse || !course) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: '#F9F8F5' }}>
        <ActivityIndicator color="#053495" />
      </View>
    );
  }

  const isPublished = course.status === 'published';

  return (
    <View style={{ flex: 1, backgroundColor: '#F9F8F5' }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Hero */}
        <View style={s.hero}>
          <Text style={s.title}>{course.title}</Text>
          {course.description && <Text style={s.description}>{course.description}</Text>}
          <View style={s.heroStats}>
            <HeroStat value={lessons?.length ?? 0} label="Lessons" />
            <HeroStat value={quizzes?.length ?? 0} label="Quizzes" />
            <HeroStat value={enrollments?.length ?? 0} label="Students" />
          </View>
          <TouchableOpacity
            style={[s.publishBtn, isPublished && { backgroundColor: '#DAE0E7' }]}
            onPress={() => publishMutation.mutate(isPublished ? 'draft' : 'published')}
            disabled={publishMutation.isPending}
            activeOpacity={0.85}
          >
            <Ionicons
              name={isPublished ? 'archive-outline' : 'rocket-outline'}
              size={14}
              color={isPublished ? '#526C98' : '#fff'}
            />
            <Text style={[s.publishText, isPublished && { color: '#526C98' }]}>
              {isPublished ? 'Unpublish' : 'Publish'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={s.tabRow}>
          {(['lessons', 'quizzes', 'students'] as Tab[]).map((t) => (
            <TouchableOpacity
              key={t}
              style={[s.tab, tab === t && s.tabActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[s.tabText, tab === t && s.tabTextActive]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab content */}
        <View style={{ padding: 12 }}>
          {tab === 'lessons' && (
            <View>
              {(lessons || []).length === 0 ? (
                <Empty text="No lessons yet. Add your first lesson." />
              ) : (
                lessons!.map((l: CourseLesson) => (
                  <View key={l._id} style={s.itemCard}>
                    <View style={[s.itemIcon, { backgroundColor: '#F0F5FE' }]}>
                      <Ionicons name="document-text" size={16} color="#053495" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={s.itemTitle}>{l.title}</Text>
                      <Text style={s.itemMeta}>
                        {l.contentType.toUpperCase()}
                        {l.durationMinutes ? ` · ${l.durationMinutes} min` : ''}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() =>
                        Alert.alert('Delete lesson?', '', [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: () => deleteLessonMutation.mutate(l._id),
                          },
                        ])
                      }
                      hitSlop={8}
                    >
                      <Ionicons name="trash-outline" size={16} color="#8998B3" />
                    </TouchableOpacity>
                  </View>
                ))
              )}
              <TouchableOpacity
                style={s.addBtn}
                onPress={() => router.push(`/courses/lesson-form?courseId=${id}` as never)}
                activeOpacity={0.85}
              >
                <Ionicons name="add" size={18} color="#053495" />
                <Text style={s.addText}>Add Lesson</Text>
              </TouchableOpacity>
            </View>
          )}

          {tab === 'quizzes' && (
            <View>
              {(quizzes || []).length === 0 ? (
                <Empty text="No quizzes yet. Create one to assess students." />
              ) : (
                quizzes!.map((q: CourseQuiz) => (
                  <View key={q._id} style={s.itemCard}>
                    <View style={[s.itemIcon, { backgroundColor: '#fef3c7' }]}>
                      <Ionicons name="help-circle" size={16} color="#d97706" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={s.itemTitle}>{q.title}</Text>
                      <Text style={s.itemMeta}>
                        {q.questions.length} questions · {q.totalMarks} marks
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() =>
                        Alert.alert('Delete quiz?', '', [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: () => deleteQuizMutation.mutate(q._id),
                          },
                        ])
                      }
                      hitSlop={8}
                    >
                      <Ionicons name="trash-outline" size={16} color="#8998B3" />
                    </TouchableOpacity>
                  </View>
                ))
              )}
              <TouchableOpacity
                style={s.addBtn}
                onPress={() => router.push(`/courses/quiz-form?courseId=${id}` as never)}
                activeOpacity={0.85}
              >
                <Ionicons name="add" size={18} color="#053495" />
                <Text style={s.addText}>Add Quiz</Text>
              </TouchableOpacity>
            </View>
          )}

          {tab === 'students' && (
            <View>
              {(enrollments || []).length === 0 ? (
                <Empty text="No enrollments yet." />
              ) : (
                enrollments!.map((e) => (
                  <View key={e._id} style={s.itemCard}>
                    <View style={[s.itemIcon, { backgroundColor: '#dcfce7' }]}>
                      <Ionicons name="person" size={16} color="#16a34a" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={s.itemTitle}>{e.student?.displayName || 'Student'}</Text>
                      <Text style={s.itemMeta}>
                        {e.status} · {e.progress}% progress
                      </Text>
                    </View>
                    <View style={s.progressRing}>
                      <Text style={s.progressText}>{e.progress}%</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function HeroStat({ value, label }: { value: number; label: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={s.statNum}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <View style={s.emptyBlock}>
      <Text style={s.emptyText}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  hero: { backgroundColor: '#042A6C', padding: 24, paddingTop: 28 },
  title: { fontSize: 22, fontWeight: '800', color: '#fff' },
  description: { fontSize: 13, color: '#C4D9FD', marginTop: 6, lineHeight: 19 },
  heroStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  statNum: { fontSize: 22, fontWeight: '800', color: '#fff' },
  statLabel: {
    fontSize: 10,
    color: '#84AFFB',
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  publishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    marginTop: 16,
  },
  publishText: { color: '#fff', fontSize: 12, fontWeight: '700', marginLeft: 6 },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#EDF0F3',
  },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#053495' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#8998B3' },
  tabTextActive: { color: '#053495' },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#EDF0F3',
  },
  itemIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: { fontSize: 14, fontWeight: '700', color: '#042A6C' },
  itemMeta: { fontSize: 11, color: '#8998B3', marginTop: 2 },
  progressRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0F5FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressText: { fontSize: 11, fontWeight: '800', color: '#042A6C' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F5FE',
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 6,
  },
  addText: { fontSize: 13, fontWeight: '700', color: '#053495', marginLeft: 6 },
  emptyBlock: {
    backgroundColor: '#fff',
    padding: 30,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EDF0F3',
    marginBottom: 8,
  },
  emptyText: { fontSize: 13, color: '#8998B3', textAlign: 'center' },
});

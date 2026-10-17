import { View, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Text, Segmented, EmptyState, color } from '@campus-verse/mobile-shared/design';
import { coursesApi } from '@campus-verse/mobile-shared/api/courses';
import { useState } from 'react';

/**
 * Course detail — issue cover.
 *
 * The course thumbnail (or a marigold paper-block fallback) covers the top
 * third. Below, a foreword (description) is followed by a segmented list of
 * lessons and quizzes.
 */

type Segment = 'lessons' | 'quizzes';

const TYPE_LABEL: Record<string, string> = {
  video: 'Video',
  pdf: 'PDF',
  text: 'Reading',
  link: 'Link',
};

export default function CourseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [segment, setSegment] = useState<Segment>('lessons');

  const { data: course } = useQuery({
    queryKey: ['course', id],
    queryFn: () => coursesApi.getCourse(id!),
    enabled: !!id,
  });
  const { data: lessons } = useQuery({
    queryKey: ['course-lessons', id],
    queryFn: () => coursesApi.getLessons(id!),
    enabled: !!id,
  });
  const { data: quizzes } = useQuery({
    queryKey: ['course-quizzes', id],
    queryFn: () => coursesApi.getQuizzes(id!),
    enabled: !!id,
  });

  if (!course) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: color.paper,
          paddingTop: insets.top + 40,
          paddingHorizontal: 22,
        }}
      >
        <StatusBar style="dark" />
        <Text variant="body" tone="inkMute" italic>
          Loading the course…
        </Text>
      </View>
    );
  }

  const list = segment === 'lessons' ? (lessons ?? []) : (quizzes ?? []);

  return (
    <View style={{ flex: 1, backgroundColor: color.paper }}>
      <StatusBar style="light" />

      {/* Hero strip — ink slab with marigold left rule */}
      <View
        style={{
          backgroundColor: color.ink,
          paddingTop: insets.top + 14,
          paddingHorizontal: 22,
          paddingBottom: 28,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Text variant="micro" tone="onInkMute">
            ← Back
          </Text>
        </TouchableOpacity>
        <View style={{ height: 18 }} />
        <Text variant="eyebrow" tone="marigold">
          {course.subjectName || 'Course'} · {(course.lessonCount ?? 0) + (course.quizCount ?? 0)}{' '}
          items
        </Text>
        <View style={{ height: 12 }} />
        <Text variant="display" tone="onInk" italic>
          {course.title}
        </Text>
        {course.instructorName && (
          <Text variant="caption" tone="onInkMute" style={{ marginTop: 10 }}>
            Edited by {course.instructorName}
          </Text>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 60, paddingTop: 28 }}
      >
        {course.description && (
          <View
            style={{
              borderLeftWidth: 2,
              borderLeftColor: color.marigold,
              paddingLeft: 14,
              marginBottom: 26,
            }}
          >
            <Text variant="eyebrow" tone="inkFaint">
              Foreword
            </Text>
            <View style={{ height: 6 }} />
            <Text variant="body" tone="inkSoft" italic>
              {course.description}
            </Text>
          </View>
        )}

        <Segmented<Segment>
          segments={[
            { key: 'lessons', label: 'Lessons', count: lessons?.length ?? 0 },
            { key: 'quizzes', label: 'Quizzes', count: quizzes?.length ?? 0 },
          ]}
          value={segment}
          onChange={setSegment}
        />

        <View style={{ height: 16 }} />

        {list.length === 0 ? (
          <EmptyState
            eyebrow="A blank page"
            title={`No ${segment} published yet.`}
            description="Check back after class — the teacher will release these soon."
          />
        ) : (
          list.map((item, i) => {
            const isLesson = segment === 'lessons';
            const lesson = isLesson ? (item as NonNullable<typeof lessons>[number]) : null;
            const quiz = !isLesson ? (item as NonNullable<typeof quizzes>[number]) : null;
            return (
              <TouchableOpacity
                key={item._id}
                activeOpacity={0.6}
                onPress={() => {
                  if (isLesson) {
                    router.push(
                      `/student/courses/lesson?courseId=${id}&lessonId=${item._id}` as never
                    );
                  } else {
                    router.push(`/student/courses/quiz?courseId=${id}&quizId=${item._id}` as never);
                  }
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    paddingVertical: 18,
                    borderBottomWidth: 1,
                    borderBottomColor: color.rule,
                  }}
                >
                  <Text variant="numMid" tone="inkFaint" style={{ width: 44, marginRight: 4 }}>
                    {String(i + 1).padStart(2, '0')}
                  </Text>
                  <View style={{ flex: 1 }}>
                    {isLesson && (
                      <Text variant="eyebrow" tone="indigo">
                        {TYPE_LABEL[lesson!.contentType] || lesson!.contentType}
                        {lesson!.durationMinutes ? ` · ${lesson!.durationMinutes} min` : ''}
                      </Text>
                    )}
                    {!isLesson && (
                      <Text variant="eyebrow" tone="marigold">
                        Quiz · {quiz!.totalMarks} marks
                      </Text>
                    )}
                    <View style={{ height: 4 }} />
                    <Text variant="h2" tone="ink" italic>
                      {item.title}
                    </Text>
                    {item.description && (
                      <Text
                        variant="caption"
                        tone="inkMute"
                        numberOfLines={2}
                        style={{ marginTop: 4 }}
                      >
                        {item.description}
                      </Text>
                    )}
                  </View>
                  <Text variant="h2" tone="inkGhost" style={{ marginLeft: 8, marginTop: 12 }}>
                    →
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

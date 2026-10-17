import { useState } from 'react';
import { View, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Text, Pill, EmptyState, Segmented, color } from '@campus-verse/mobile-shared/design';
import { coursesApi } from '@campus-verse/mobile-shared/api/courses';

/**
 * Course list — the syllabus.
 *
 * Reads as a magazine "issue list": each course rendered as a card-row with
 * a serif title, a soft byline, instructor as a kicker, and progress
 * encoded as a hairline rule that fills from left to right.
 */

type Segment = 'active' | 'all' | 'completed';

export default function Courses() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [segment, setSegment] = useState<Segment>('active');
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['my-courses'],
    queryFn: () => coursesApi.getCourses({ mine: true, limit: 50 }),
  });

  const all = data?.data ?? [];
  const active = all.filter((c) => c.status === 'published');
  const items = segment === 'active' ? active : segment === 'completed' ? [] : all;

  return (
    <View style={{ flex: 1, backgroundColor: color.paper }}>
      <StatusBar style="dark" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await refetch();
              setRefreshing(false);
            }}
            tintColor={color.ink}
          />
        }
        contentContainerStyle={{
          paddingTop: insets.top + 18,
          paddingBottom: 60,
          paddingHorizontal: 22,
        }}
      >
        {/* Header */}
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Text variant="micro" tone="inkMute">
            ← Back to academics
          </Text>
        </TouchableOpacity>
        <View style={{ height: 18 }} />
        <Text variant="eyebrow" tone="marigold">
          Volume II · Chapter V
        </Text>
        <View style={{ height: 8 }} />
        <Text variant="hero" tone="ink">
          The
        </Text>
        <Text variant="hero" tone="ink" italic>
          syllabus.
        </Text>
        <View style={{ height: 8 }} />
        <Text variant="caption" tone="inkMute">
          Courses you are enrolled in this term.
        </Text>
        <View style={{ height: 22 }} />

        <Segmented<Segment>
          segments={[
            { key: 'active', label: 'Active', count: active.length },
            { key: 'all', label: 'All', count: all.length },
            { key: 'completed', label: 'Done' },
          ]}
          value={segment}
          onChange={setSegment}
        />

        <View style={{ height: 8 }} />

        {/* List */}
        {isLoading ? (
          <Text variant="body" tone="inkMute" italic style={{ marginTop: 30 }}>
            Pulling your shelf…
          </Text>
        ) : items.length === 0 ? (
          <EmptyState
            eyebrow="An empty shelf"
            title="No courses enrolled."
            description="Once your school enrols you in a course, it will appear here."
          />
        ) : (
          items.map((course, i) => (
            <TouchableOpacity
              key={course._id}
              activeOpacity={0.7}
              onPress={() => router.push(`/student/courses/${course._id}` as never)}
            >
              <View
                style={{
                  paddingVertical: 22,
                  borderBottomWidth: 1,
                  borderBottomColor: color.rule,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                  <Text variant="kicker" tone="inkFaint" style={{ marginRight: 10 }}>
                    {String(i + 1).padStart(2, '0')}
                  </Text>
                  {course.subjectName && (
                    <Text variant="eyebrow" tone="indigo">
                      {course.subjectName}
                    </Text>
                  )}
                </View>
                <View style={{ height: 6 }} />
                <Text variant="h1" tone="ink" italic>
                  {course.title}
                </Text>
                {course.description && (
                  <Text variant="body" tone="inkMute" style={{ marginTop: 6 }} numberOfLines={2}>
                    {course.description}
                  </Text>
                )}
                <View style={{ height: 12 }} />
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text variant="micro" tone="inkFaint">
                    {course.instructorName ?? 'Instructor'} · {course.lessonCount ?? 0} lessons ·{' '}
                    {course.quizCount ?? 0} quizzes
                  </Text>
                  <View style={{ flex: 1 }} />
                  <Pill
                    label={course.status}
                    tone={course.status === 'published' ? 'sage' : 'neutral'}
                    size="xs"
                  />
                </View>
                {typeof course.completionRate === 'number' && (
                  <View style={{ marginTop: 14 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text variant="micro" tone="inkFaint">
                        Progress
                      </Text>
                      <Text variant="numSmall" tone="ink">
                        {course.completionRate}%
                      </Text>
                    </View>
                    <View style={{ height: 4 }} />
                    <View style={{ height: 2, backgroundColor: color.rule }}>
                      <View
                        style={{
                          width: `${course.completionRate}%`,
                          height: 2,
                          backgroundColor: color.marigold,
                        }}
                      />
                    </View>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

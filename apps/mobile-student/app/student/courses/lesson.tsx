import { View, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Text, Rule, Button, color } from '@campus-verse/mobile-shared/design';
import { coursesApi, type CourseLesson } from '@campus-verse/mobile-shared/api/courses';

/**
 * Lesson player — reading room.
 *
 * Renders content according to type. Video and link both open externally,
 * with a "preview" hint card. PDF is embedded in a WebView. Text uses our
 * Almanac body type.
 */

export default function Lesson() {
  const { courseId, lessonId } = useLocalSearchParams<{ courseId: string; lessonId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data: lessons } = useQuery({
    queryKey: ['course-lessons', courseId],
    queryFn: () => coursesApi.getLessons(courseId!),
    enabled: !!courseId,
  });
  const lesson: CourseLesson | undefined = lessons?.find((l) => l._id === lessonId);

  if (!lesson) {
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
          Loading lesson…
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.paper }}>
      <StatusBar style="dark" />
      <View
        style={{
          paddingTop: insets.top + 14,
          paddingHorizontal: 22,
          paddingBottom: 18,
          borderBottomWidth: 1,
          borderBottomColor: color.rule,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Text variant="micro" tone="inkMute">
            ← Back
          </Text>
        </TouchableOpacity>
        <View style={{ height: 14 }} />
        <Text variant="eyebrow" tone="marigold">
          Lesson · {lesson.contentType.toUpperCase()}
          {lesson.durationMinutes ? ` · ${lesson.durationMinutes} min` : ''}
        </Text>
        <View style={{ height: 8 }} />
        <Text variant="h1" tone="ink" italic>
          {lesson.title}
        </Text>
        {lesson.description && (
          <Text variant="caption" tone="inkMute" style={{ marginTop: 6 }}>
            {lesson.description}
          </Text>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 22, paddingBottom: 60 }}
      >
        {/* Body */}
        {lesson.contentType === 'text' && (
          <View>
            <View
              style={{
                borderLeftWidth: 2,
                borderLeftColor: color.ink,
                paddingLeft: 14,
                marginBottom: 18,
              }}
            >
              <Text variant="eyebrow" tone="inkFaint">
                Excerpt
              </Text>
              <View style={{ height: 6 }} />
              <Text variant="body" tone="inkSoft" italic>
                Read carefully — the section below forms the basis of the next quiz.
              </Text>
            </View>
            <Text variant="body" tone="ink" style={{ lineHeight: 24, fontSize: 15 }}>
              {lesson.contentBody || 'No content provided yet.'}
            </Text>
          </View>
        )}

        {lesson.contentType === 'video' && (
          <View>
            <View
              style={{
                backgroundColor: color.ink,
                borderRadius: 8,
                padding: 22,
                marginBottom: 16,
              }}
            >
              <Text variant="eyebrow" tone="marigold">
                Video lesson
              </Text>
              <View style={{ height: 10 }} />
              <Text variant="h2" tone="onInk" italic>
                Plays in your browser
              </Text>
              <Text variant="caption" tone="onInkMute" style={{ marginTop: 8 }}>
                Mobile player streams the video in your device's native viewer.
              </Text>
            </View>
            <Button
              label="Play video"
              variant="ink"
              size="lg"
              full
              onPress={() => lesson.contentUrl && Linking.openURL(lesson.contentUrl)}
            />
          </View>
        )}

        {lesson.contentType === 'pdf' && lesson.contentUrl && (
          <View>
            <View
              style={{
                borderWidth: 1,
                borderColor: color.rule,
                padding: 22,
                borderRadius: 8,
                backgroundColor: color.card,
                marginBottom: 16,
              }}
            >
              <Text variant="eyebrow" tone="inkFaint">
                Document · PDF
              </Text>
              <View style={{ height: 10 }} />
              <Text variant="h2" tone="ink" italic>
                Opens in your viewer
              </Text>
              <Text variant="caption" tone="inkMute" style={{ marginTop: 8 }}>
                Tap below to read the lesson PDF.
              </Text>
            </View>
            <Button
              label="Open PDF"
              variant="ink"
              size="lg"
              full
              onPress={() => Linking.openURL(lesson.contentUrl!)}
            />
          </View>
        )}

        {lesson.contentType === 'link' && (
          <View>
            <View
              style={{
                borderWidth: 1,
                borderColor: color.rule,
                padding: 18,
                borderRadius: 8,
                backgroundColor: color.card,
                marginBottom: 16,
              }}
            >
              <Text variant="eyebrow" tone="inkFaint">
                External reading
              </Text>
              <View style={{ height: 6 }} />
              <Text variant="caption" tone="inkMute" numberOfLines={2}>
                {lesson.contentUrl}
              </Text>
            </View>
            <Button
              label="Open link"
              variant="ink"
              size="lg"
              full
              onPress={() => lesson.contentUrl && Linking.openURL(lesson.contentUrl)}
            />
          </View>
        )}

        <View style={{ height: 36 }} />
        <Rule />
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingTop: 14,
          }}
        >
          <Text variant="micro" tone="inkFaint">
            Lesson {lesson.order}
          </Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text variant="micro" tone="ink">
              Mark complete →
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

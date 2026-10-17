import { View, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Text, Rule, Pill, EmptyState, color } from '@campus-verse/mobile-shared/design';
import { questionnairesApi } from '@/api/questionnaires';

export default function Questionnaires() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data = [] } = useQuery({
    queryKey: ['questionnaires'],
    queryFn: () => questionnairesApi.list({ status: 'published' }),
  });

  const open = data.filter((q) => !q.hasSubmitted);
  const done = data.filter((q) => q.hasSubmitted);

  return (
    <View style={{ flex: 1, backgroundColor: color.paper }}>
      <StatusBar style="dark" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 18,
          paddingBottom: 60,
          paddingHorizontal: 22,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Text variant="micro" tone="inkMute">
            ← Back to academics
          </Text>
        </TouchableOpacity>
        <View style={{ height: 22 }} />
        <Text variant="eyebrow" tone="marigold">
          Folio II·F · Inquiry
        </Text>
        <View style={{ height: 10 }} />
        <Text variant="hero" tone="ink">
          Quick
        </Text>
        <Text variant="hero" tone="ink" italic>
          questions.
        </Text>
        <View style={{ height: 18 }} />
        <Text variant="body" tone="inkMute" italic style={{ maxWidth: 320 }}>
          Brief checks, surveys and feedback prompts your teachers have set. Most take under five
          minutes.
        </Text>

        <View style={{ height: 24 }} />
        <Rule tone="ink" />

        {/* Open */}
        <View style={{ marginTop: 22 }}>
          <Text variant="eyebrow" tone="inkFaint">
            01 · Awaiting you
          </Text>
        </View>

        {open.length === 0 ? (
          <EmptyState
            eyebrow="Clear desk"
            title="Nothing to answer."
            description="Your teachers have not set any active questionnaires. Enjoy the quiet."
          />
        ) : (
          open.map((q, i) => (
            <TouchableOpacity
              key={q._id}
              activeOpacity={0.6}
              onPress={() => router.push(`/student/questionnaires/${q._id}` as never)}
            >
              <View
                style={{
                  paddingVertical: 20,
                  borderBottomWidth: 1,
                  borderBottomColor: color.rule,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                  <Text variant="kicker" tone="inkFaint" style={{ marginRight: 10 }}>
                    {String(i + 1).padStart(2, '0')}
                  </Text>
                  <Text variant="eyebrow" tone="indigo">
                    {q.subjectName ?? q.type ?? 'Inquiry'}
                  </Text>
                  <View style={{ flex: 1 }} />
                  {q.dueDate && (
                    <Text variant="micro" tone="brick">
                      Due{' '}
                      {new Date(q.dueDate).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </Text>
                  )}
                </View>
                <View style={{ height: 6 }} />
                <Text variant="h1" tone="ink" italic>
                  {q.title}
                </Text>
                <Text variant="caption" tone="inkMute" style={{ marginTop: 6 }}>
                  {q.questions.length} question{q.questions.length === 1 ? '' : 's'}
                  {q.durationMinutes ? ` · ${q.durationMinutes} min` : ''}
                  {q.totalMarks ? ` · ${q.totalMarks} marks` : ''}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}

        {/* Done */}
        {done.length > 0 && (
          <View style={{ marginTop: 32 }}>
            <Text variant="eyebrow" tone="inkFaint">
              02 · Already answered
            </Text>
            <View style={{ height: 8 }} />
            <Rule />
            {done.map((q, i) => (
              <View
                key={q._id}
                style={{
                  flexDirection: 'row',
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: color.rule,
                }}
              >
                <Text variant="kicker" tone="inkGhost" style={{ width: 30 }}>
                  {String(i + 1).padStart(2, '0')}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong" tone="inkMute" italic>
                    {q.title}
                  </Text>
                </View>
                <Pill label="Submitted" tone="sage" size="xs" />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

import { useState, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Text, Button, Pill, color } from '@campus-verse/mobile-shared/design';
import { questionnairesApi, type QuestionnaireAnswer } from '@/api/questionnaires';

/**
 * Take questionnaire — interview transcript.
 *
 * Each question is its own page-block: numbered, italic display question,
 * with the answer field rendered in the style most natural to its type.
 */

export default function TakeQuestionnaire() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [answers, setAnswers] = useState<Record<number, string | number | string[]>>({});

  const { data: q } = useQuery({
    queryKey: ['questionnaire', id],
    queryFn: () => questionnairesApi.get(id!),
    enabled: !!id,
  });

  const submit = useMutation({
    mutationFn: () => {
      const payload: QuestionnaireAnswer[] = Object.entries(answers).map(([idx, ans]) => ({
        questionIndex: Number(idx),
        answer: ans,
      }));
      return questionnairesApi.submit(id!, payload);
    },
    onSuccess: () => {
      Alert.alert('Thank you', 'Your responses have been recorded.', [
        { text: 'Done', onPress: () => router.back() },
      ]);
    },
    onError: (err: { message?: string }) =>
      Alert.alert('Could not submit', err?.message || 'Please try again.'),
  });

  const totalQ = q?.questions.length ?? 0;
  const answered = useMemo(() => Object.keys(answers).length, [answers]);
  const ready = totalQ > 0 && answered === totalQ;

  if (!q) {
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
          Loading the questionnaire…
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.paper }}>
      <StatusBar style="dark" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 14,
          paddingBottom: 140,
          paddingHorizontal: 22,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Text variant="micro" tone="inkMute">
            ← Back to questionnaires
          </Text>
        </TouchableOpacity>
        <View style={{ height: 18 }} />

        <Text variant="eyebrow" tone="marigold">
          {q.subjectName ?? q.type ?? 'Inquiry'} · {totalQ} questions
        </Text>
        <View style={{ height: 10 }} />
        <Text variant="display" tone="ink" italic>
          {q.title}
        </Text>
        {q.description && (
          <Text variant="body" tone="inkMute" style={{ marginTop: 10 }}>
            {q.description}
          </Text>
        )}

        <View style={{ height: 18 }} />
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text variant="eyebrow" tone="inkFaint">
            Progress · {answered}/{totalQ}
          </Text>
          <Pill
            label={ready ? 'Ready' : 'In progress'}
            tone={ready ? 'sage' : 'marigold'}
            size="xs"
          />
        </View>
        <View style={{ height: 6 }} />
        <View style={{ height: 2, backgroundColor: color.rule }}>
          <View
            style={{
              width: `${(answered / Math.max(totalQ, 1)) * 100}%`,
              height: 2,
              backgroundColor: color.marigold,
            }}
          />
        </View>

        {/* Questions */}
        {q.questions.map((question, idx) => (
          <View key={idx} style={{ marginTop: 36 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text variant="kicker" tone="inkFaint" style={{ marginRight: 10 }}>
                Q{String(idx + 1).padStart(2, '0')}
              </Text>
              {question.required && (
                <Text variant="micro" tone="brick">
                  required
                </Text>
              )}
              <View style={{ flex: 1 }} />
              {question.marks && (
                <Text variant="micro" tone="inkFaint">
                  {question.marks} marks
                </Text>
              )}
            </View>
            <View style={{ height: 8 }} />
            <Text variant="h2" tone="ink" italic>
              {question.question}
            </Text>
            <View style={{ height: 14 }} />

            {/* MCQ */}
            {question.type === 'mcq' && question.options && (
              <View>
                {question.options.map((opt, oIdx) => {
                  const sel = answers[idx] === opt;
                  return (
                    <TouchableOpacity
                      key={oIdx}
                      activeOpacity={0.7}
                      onPress={() => setAnswers((a) => ({ ...a, [idx]: opt }))}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 14,
                        borderBottomWidth: 1,
                        borderBottomColor: color.rule,
                      }}
                    >
                      <View
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 8,
                          borderWidth: 1.5,
                          borderColor: sel ? color.ink : color.ruleStrong,
                          backgroundColor: sel ? color.ink : 'transparent',
                          marginRight: 12,
                        }}
                      />
                      <Text variant="body" tone={sel ? 'ink' : 'inkMute'}>
                        {String.fromCharCode(65 + oIdx)}. {opt}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* True/False */}
            {question.type === 'true_false' && (
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {['True', 'False'].map((opt) => {
                  const sel = answers[idx] === opt;
                  return (
                    <TouchableOpacity
                      key={opt}
                      activeOpacity={0.7}
                      onPress={() => setAnswers((a) => ({ ...a, [idx]: opt }))}
                      style={{
                        paddingHorizontal: 22,
                        paddingVertical: 12,
                        borderWidth: 1.5,
                        borderColor: sel ? color.ink : color.rule,
                        backgroundColor: sel ? color.ink : 'transparent',
                        borderRadius: 999,
                      }}
                    >
                      <Text
                        variant="bodyStrong"
                        italic
                        style={{ color: sel ? color.onInk : color.ink }}
                      >
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Rating 1-5 */}
            {question.type === 'rating' && (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {[1, 2, 3, 4, 5].map((n) => {
                  const sel = answers[idx] === n;
                  return (
                    <TouchableOpacity
                      key={n}
                      activeOpacity={0.7}
                      onPress={() => setAnswers((a) => ({ ...a, [idx]: n }))}
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        borderWidth: 1.5,
                        borderColor: sel ? color.marigold : color.rule,
                        backgroundColor: sel ? color.marigold : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text
                        variant="numMid"
                        style={{
                          color: sel ? '#FFF7E8' : color.ink,
                          fontSize: 18,
                        }}
                      >
                        {n}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Short / Long answer */}
            {(question.type === 'short' || question.type === 'long') && (
              <View>
                <TextInput
                  value={String(answers[idx] ?? '')}
                  onChangeText={(t) => setAnswers((a) => ({ ...a, [idx]: t }))}
                  placeholder="Your answer…"
                  placeholderTextColor={color.inkFaint}
                  multiline={question.type === 'long'}
                  style={{
                    minHeight: question.type === 'long' ? 100 : 44,
                    borderWidth: 1,
                    borderColor: color.ruleStrong,
                    borderRadius: 8,
                    padding: 14,
                    fontFamily: 'DMSans_400Regular',
                    fontSize: 14.5,
                    color: color.ink,
                    backgroundColor: color.card,
                  }}
                  textAlignVertical={question.type === 'long' ? 'top' : 'center'}
                />
              </View>
            )}
          </View>
        ))}

        <View style={{ height: 36 }} />
        <Button
          label={submit.isPending ? 'Sending…' : 'Submit responses'}
          variant={ready ? 'marigold' : 'ink'}
          size="lg"
          full
          loading={submit.isPending}
          onPress={() => submit.mutate()}
          disabled={!ready}
        />
        <View style={{ height: 8 }} />
        <Text variant="micro" tone="inkFaint" align="center">
          You cannot edit once submitted.
        </Text>
      </ScrollView>
    </View>
  );
}

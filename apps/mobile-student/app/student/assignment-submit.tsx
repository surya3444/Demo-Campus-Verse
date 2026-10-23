import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useCurrentStudentId } from '@campus-verse/mobile-shared/hooks/useAuth';
import { studentApi, type QuestionItem, type QuestionAnswer } from '@/api/student';

export default function AssignmentSubmitScreen() {
  const { id, kind } = useLocalSearchParams<{ id: string; kind: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const studentId = useCurrentStudentId();
  const isQuiz = kind === 'questionnaire';

  const [answers, setAnswers] = useState<Record<string, string>>({});

  // Fetch detail to get questions
  const { data: detail, isLoading } = useQuery<{
    title: string;
    totalMarks: number;
    questions?: QuestionItem[];
  }>({
    queryKey: [isQuiz ? 'questionnaire-detail' : 'assignment-detail', id],
    queryFn: async () => {
      const res = isQuiz
        ? await studentApi.getQuestionnaire(id!)
        : await studentApi.getAssignment(id!);
      return res as unknown as { title: string; totalMarks: number; questions?: QuestionItem[] };
    },
    enabled: !!id,
  });

  const questions: QuestionItem[] = (detail as { questions?: QuestionItem[] })?.questions || [];

  const setAnswer = useCallback((questionId: string, answer: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  }, []);

  const answeredCount = questions.filter((q) => answers[q._id]?.trim()).length;

  const submitMutation = useMutation({
    mutationFn: (data: { answers: QuestionAnswer[] }) =>
      isQuiz
        ? studentApi.submitQuestionnaire(id!, { ...data, studentId: studentId || undefined })
        : studentApi.submitAssignment(id!, { ...data, studentId: studentId || undefined }),
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['student-dashboard'] });
      queryClient.invalidateQueries({
        queryKey: [isQuiz ? 'my-questionnaire-submission' : 'my-assignment-submission', id],
      });
      queryClient.invalidateQueries({ queryKey: ['student-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['student-questionnaires'] });
      Alert.alert('Submitted!', 'Your answers have been submitted successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (error: { response?: { data?: { error?: { message?: string } } } }) => {
      Alert.alert(
        'Error',
        error.response?.data?.error?.message || 'Failed to submit. Please try again.'
      );
    },
  });

  const handleSubmit = useCallback(() => {
    if (answeredCount < questions.length) {
      Alert.alert(
        'Incomplete',
        `You have answered ${answeredCount} of ${questions.length} questions. Submit anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Submit', onPress: doSubmit },
        ]
      );
    } else {
      Alert.alert(
        'Confirm Submission',
        'Are you sure you want to submit? You cannot change your answers after submission.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Submit', onPress: doSubmit },
        ]
      );
    }
  }, [answeredCount, questions.length]);

  const doSubmit = useCallback(() => {
    const formatted: QuestionAnswer[] = questions.map((q) => ({
      questionId: q._id,
      answer: answers[q._id]?.trim() || '',
    }));
    submitMutation.mutate({ answers: formatted });
  }, [questions, answers, submitMutation]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-secondary-50">
        <ActivityIndicator size="large" color="#0749BB" />
      </View>
    );
  }

  if (!detail || questions.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-secondary-50">
        <Ionicons name="alert-circle-outline" size={48} color="#D3DAE4" />
        <Text className="text-secondary-400 mt-3">No questions found</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-secondary-50"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Progress bar */}
      <View className="bg-white px-4 py-3 border-b border-secondary-100">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-sm font-semibold text-secondary-700">
            {answeredCount} of {questions.length} answered
          </Text>
          <Text className="text-xs text-secondary-400">{detail.totalMarks} marks total</Text>
        </View>
        <View className="h-2 bg-secondary-100 rounded-full overflow-hidden">
          <View
            className="h-full rounded-full"
            style={{
              width: `${(answeredCount / questions.length) * 100}%`,
              backgroundColor: answeredCount === questions.length ? '#10b981' : '#0749BB',
            }}
          />
        </View>
      </View>

      <ScrollView className="flex-1 px-4 pt-3" showsVerticalScrollIndicator={false}>
        {questions.map((q, i) => (
          <QuestionCard
            key={q._id}
            question={q}
            index={i}
            value={answers[q._id] || ''}
            onChange={(v) => setAnswer(q._id, v)}
          />
        ))}
        <View className="h-24" />
      </ScrollView>

      {/* Fixed submit button */}
      <View style={s.bottomBar}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleSubmit}
          disabled={submitMutation.isPending}
          style={[s.submitBtn, submitMutation.isPending && { opacity: 0.6 }]}
        >
          {submitMutation.isPending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="send" size={16} color="#fff" />
              <Text className="text-white font-bold ml-2 text-base">Submit Answers</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function QuestionCard({
  question,
  index,
  value,
  onChange,
}: {
  question: QuestionItem;
  index: number;
  value: string;
  onChange: (v: string) => void;
}) {
  const isAnswered = value.trim().length > 0;
  const typeBadge =
    question.questionType === 'mcq'
      ? 'MCQ'
      : question.questionType === 'true_false'
        ? 'True/False'
        : 'Short Answer';

  return (
    <View
      className="bg-white rounded-2xl mb-3 overflow-hidden"
      style={{
        borderWidth: 1.5,
        borderColor: isAnswered ? '#E1ECFE' : '#EDF0F3',
      }}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-3 pb-2">
        <View className="flex-row items-center">
          <View
            className="w-7 h-7 rounded-lg items-center justify-center mr-2"
            style={{ backgroundColor: isAnswered ? '#F0F5FE' : '#F9F8F5' }}
          >
            <Text
              className="text-xs font-bold"
              style={{ color: isAnswered ? '#0749BB' : '#8998B3' }}
            >
              {index + 1}
            </Text>
          </View>
          <View className="px-2 py-0.5 rounded bg-secondary-100">
            <Text className="text-[10px] font-bold text-secondary-400">{typeBadge}</Text>
          </View>
        </View>
        <Text className="text-xs text-secondary-400 font-semibold">{question.marks} marks</Text>
      </View>

      {/* Question text */}
      <View className="px-4 pb-3">
        <Text className="text-sm font-semibold text-secondary-800 leading-5">
          {question.questionText}
        </Text>
      </View>

      {/* Answer input */}
      <View className="px-4 pb-4">
        {question.questionType === 'mcq' && question.options ? (
          <View className="gap-2">
            {question.options.map((opt, oi) => {
              const selected = value === opt;
              return (
                <TouchableOpacity key={oi} activeOpacity={0.7} onPress={() => onChange(opt)}>
                  <View
                    className="flex-row items-center px-3 py-3 rounded-xl"
                    style={{
                      backgroundColor: selected ? '#F0F5FE' : '#F9F8F5',
                      borderWidth: 1.5,
                      borderColor: selected ? '#0749BB' : '#EDF0F3',
                    }}
                  >
                    <View
                      className="w-5 h-5 rounded-full items-center justify-center mr-3"
                      style={{
                        borderWidth: 2,
                        borderColor: selected ? '#0749BB' : '#D3DAE4',
                        backgroundColor: selected ? '#0749BB' : 'transparent',
                      }}
                    >
                      {selected && <Ionicons name="checkmark" size={12} color="#fff" />}
                    </View>
                    <Text
                      className="text-sm flex-1"
                      style={{
                        color: selected ? '#042A6C' : '#3E5683',
                        fontWeight: selected ? '600' : '400',
                      }}
                    >
                      {opt}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : question.questionType === 'true_false' ? (
          <View className="flex-row gap-3">
            {['True', 'False'].map((opt) => {
              const selected = value.toLowerCase() === opt.toLowerCase();
              return (
                <TouchableOpacity
                  key={opt}
                  activeOpacity={0.7}
                  onPress={() => onChange(opt.toLowerCase())}
                  className="flex-1"
                >
                  <View
                    className="py-3 rounded-xl items-center"
                    style={{
                      backgroundColor: selected
                        ? opt === 'True'
                          ? '#f0fdf4'
                          : '#fef2f2'
                        : '#F9F8F5',
                      borderWidth: 1.5,
                      borderColor: selected ? (opt === 'True' ? '#16a34a' : '#dc2626') : '#EDF0F3',
                    }}
                  >
                    <Ionicons
                      name={opt === 'True' ? 'checkmark-circle' : 'close-circle'}
                      size={20}
                      color={selected ? (opt === 'True' ? '#16a34a' : '#dc2626') : '#D3DAE4'}
                    />
                    <Text
                      className="text-sm font-semibold mt-1"
                      style={{
                        color: selected ? (opt === 'True' ? '#16a34a' : '#dc2626') : '#8998B3',
                      }}
                    >
                      {opt}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <TextInput
            className="bg-secondary-50 rounded-xl px-4 py-3 text-sm text-secondary-800"
            style={{ borderWidth: 1, borderColor: value ? '#E1ECFE' : '#DAE0E7', minHeight: 80 }}
            placeholder="Type your answer..."
            placeholderTextColor="#8998B3"
            value={value}
            onChangeText={onChange}
            multiline
            textAlignVertical="top"
          />
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  bottomBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#EDF0F3',
  },
  submitBtn: {
    backgroundColor: '#0749BB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: '#0749BB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
});

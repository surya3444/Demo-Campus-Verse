import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { studentApi } from '@/api/student';
import type { QuestionItem } from '@/api/student';

function scoreColor(pct: number): string {
  if (pct >= 80) return '#059669';
  if (pct >= 60) return '#3b82f6';
  if (pct >= 40) return '#d97706';
  return '#dc2626';
}

function scoreLabel(pct: number): string {
  if (pct >= 80) return 'Excellent';
  if (pct >= 60) return 'Good';
  if (pct >= 40) return 'Average';
  return 'Needs Improvement';
}

export default function GradeDetailScreen() {
  const { assignmentId, kind } = useLocalSearchParams<{ assignmentId: string; kind: string }>();
  const [refreshing, setRefreshing] = useState(false);
  const isQuiz = kind === 'questionnaire';

  // Fetch assignment detail (for questions)
  const {
    data: detail,
    refetch: r1,
    isLoading: detailLoading,
  } = useQuery<{
    title: string;
    subjectName?: string;
    totalMarks: number;
    questions?: QuestionItem[];
  }>({
    queryKey: [isQuiz ? 'questionnaire-detail' : 'assignment-detail', assignmentId],
    queryFn: async () => {
      const res = isQuiz
        ? await studentApi.getQuestionnaire(assignmentId!)
        : await studentApi.getAssignment(assignmentId!);
      return res as unknown as {
        title: string;
        subjectName?: string;
        totalMarks: number;
        questions?: QuestionItem[];
      };
    },
    enabled: !!assignmentId,
  });

  // Fetch submission
  const {
    data: submission,
    refetch: r2,
    isLoading: subLoading,
  } = useQuery({
    queryKey: [isQuiz ? 'my-questionnaire-submission' : 'my-assignment-submission', assignmentId],
    queryFn: () =>
      isQuiz
        ? studentApi.getMyQuestionnaireSubmission(assignmentId!)
        : studentApi.getMyAssignmentSubmission(assignmentId!),
    enabled: !!assignmentId,
    retry: false,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([r1(), r2()]);
    setRefreshing(false);
  }, [r1, r2]);

  const isLoading = detailLoading || subLoading;

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (!detail) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <Ionicons name="alert-circle-outline" size={48} color="#d1d5db" />
        <Text className="text-gray-400 mt-3">Assignment not found</Text>
      </View>
    );
  }

  const totalMarks = submission?.totalMarks || detail.totalMarks;
  const marksObtained = submission?.marksObtained ?? 0;
  const pct = totalMarks > 0 ? Math.round((marksObtained / totalMarks) * 100) : 0;
  const color = scoreColor(pct);
  const questions: QuestionItem[] = detail?.questions || [];
  const answerMap = new Map((submission?.answers || []).map((a) => [a.questionId, a.answer]));
  const resultMap = new Map((submission?.questionResults || []).map((r) => [r.questionId, r]));

  return (
    <View className="flex-1 bg-gray-50">
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Score hero */}
        <View style={s.hero}>
          <View style={[s.scoreCircle, { borderColor: `${color}40` }]}>
            <Text style={[s.scorePct, { color }]}>{pct}%</Text>
          </View>
          <Text className="text-white text-2xl font-bold mt-3">
            {marksObtained} / {totalMarks}
          </Text>
          <View
            className="px-4 py-1.5 rounded-full mt-2"
            style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}
          >
            <Text className="text-white text-sm font-semibold">{scoreLabel(pct)}</Text>
          </View>
          <Text className="text-blue-200 text-sm mt-2">{detail.title}</Text>
          {detail.subjectName ? (
            <Text className="text-blue-300 text-xs mt-1">{detail.subjectName}</Text>
          ) : null}
        </View>

        {/* Teacher remarks */}
        {submission?.reviewerRemarks ? (
          <View className="mx-4 mt-4">
            <View
              className="bg-blue-50 rounded-2xl p-4"
              style={{ borderWidth: 1, borderColor: '#dbeafe' }}
            >
              <View className="flex-row items-center mb-2">
                <Ionicons name="chatbubble-outline" size={14} color="#3b82f6" />
                <Text className="text-blue-600 text-xs font-bold ml-1.5">Teacher Remarks</Text>
              </View>
              <Text className="text-sm text-blue-800 leading-5">{submission.reviewerRemarks}</Text>
            </View>
          </View>
        ) : null}

        {/* Question-by-question breakdown */}
        {questions.length > 0 && (
          <View className="px-4 pt-4">
            <Text className="text-base font-bold text-gray-900 mb-3">Question Breakdown</Text>
            {questions.map((q, i) => {
              const studentAnswer = answerMap.get(q._id) || 'Not answered';
              const result = resultMap.get(q._id);
              const isCorrect = result?.isCorrect;
              const marksAwarded = result?.marksAwarded ?? 0;

              return (
                <View
                  key={q._id}
                  className="bg-white rounded-2xl mb-3 overflow-hidden"
                  style={{
                    borderWidth: 1,
                    borderColor:
                      isCorrect === true ? '#d1fae5' : isCorrect === false ? '#fecaca' : '#f1f5f9',
                  }}
                >
                  {/* Question header */}
                  <View className="flex-row items-center justify-between px-4 pt-3 pb-2">
                    <View className="flex-row items-center">
                      <View
                        className="w-7 h-7 rounded-lg items-center justify-center mr-2"
                        style={{
                          backgroundColor:
                            isCorrect === true
                              ? '#f0fdf4'
                              : isCorrect === false
                                ? '#fef2f2'
                                : '#f8fafc',
                        }}
                      >
                        <Text
                          className="text-xs font-bold"
                          style={{
                            color:
                              isCorrect === true
                                ? '#059669'
                                : isCorrect === false
                                  ? '#dc2626'
                                  : '#94a3b8',
                          }}
                        >
                          {i + 1}
                        </Text>
                      </View>
                      <View className="px-2 py-0.5 rounded bg-gray-100">
                        <Text className="text-[10px] font-bold text-gray-400">
                          {q.questionType === 'mcq'
                            ? 'MCQ'
                            : q.questionType === 'true_false'
                              ? 'T/F'
                              : 'Short'}
                        </Text>
                      </View>
                    </View>
                    <View className="flex-row items-center">
                      {isCorrect !== undefined && (
                        <Ionicons
                          name={isCorrect ? 'checkmark-circle' : 'close-circle'}
                          size={16}
                          color={isCorrect ? '#059669' : '#dc2626'}
                          style={{ marginRight: 4 }}
                        />
                      )}
                      <Text className="text-xs font-bold text-gray-400">
                        {marksAwarded}/{q.marks}
                      </Text>
                    </View>
                  </View>

                  {/* Question text */}
                  <View className="px-4 pb-2">
                    <Text className="text-sm font-semibold text-gray-900">{q.questionText}</Text>
                  </View>

                  {/* Answer comparison */}
                  <View className="px-4 pb-3 gap-2">
                    <View className="flex-row items-start">
                      <Text className="text-xs text-gray-400 w-20">Your answer:</Text>
                      <Text
                        className="flex-1 text-sm font-medium"
                        style={{ color: isCorrect === false ? '#dc2626' : '#374151' }}
                      >
                        {studentAnswer}
                      </Text>
                    </View>
                    {q.correctAnswer && isCorrect === false && (
                      <View className="flex-row items-start">
                        <Text className="text-xs text-gray-400 w-20">Correct:</Text>
                        <Text className="flex-1 text-sm font-medium text-green-700">
                          {q.correctAnswer}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View className="h-8" />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  hero: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 28,
    alignItems: 'center',
  },
  scoreCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 4,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scorePct: {
    fontSize: 28,
    fontWeight: '800',
  },
});

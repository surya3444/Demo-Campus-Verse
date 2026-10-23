import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { studentApi } from '@/api/student';

interface DetailShape {
  title: string;
  description?: string;
  subjectName?: string;
  teacherName?: string;
  totalMarks: number;
  dueDate?: string;
  hasQuestions?: boolean;
  questions?: { _id: string }[];
}

const TABS = ['Details', 'My Submission'] as const;

export default function AssignmentDetailScreen() {
  const { id, kind } = useLocalSearchParams<{ id: string; kind: string }>();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>('Details');
  const isQuiz = kind === 'questionnaire';

  // Fetch assignment or questionnaire detail
  const {
    data: detail,
    refetch: r1,
    isLoading: detailLoading,
  } = useQuery<DetailShape>({
    queryKey: [isQuiz ? 'questionnaire-detail' : 'assignment-detail', id],
    queryFn: async () => {
      const res = isQuiz
        ? await studentApi.getQuestionnaire(id!)
        : await studentApi.getAssignment(id!);
      return res as unknown as DetailShape;
    },
    enabled: !!id,
  });

  // Fetch submission
  const {
    data: submission,
    refetch: r2,
    isLoading: subLoading,
  } = useQuery({
    queryKey: [isQuiz ? 'my-questionnaire-submission' : 'my-assignment-submission', id],
    queryFn: () =>
      isQuiz
        ? studentApi.getMyQuestionnaireSubmission(id!)
        : studentApi.getMyAssignmentSubmission(id!),
    enabled: !!id,
    retry: false,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([r1(), r2()]);
    setRefreshing(false);
  }, [r1, r2]);

  if (detailLoading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#F9F8F5',
        }}
      >
        <ActivityIndicator size="large" color="#0749BB" />
      </View>
    );
  }

  if (!detail) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#F9F8F5',
        }}
      >
        <Ionicons name="alert-circle-outline" size={48} color="#D3DAE4" />
        <Text style={{ color: '#8998B3', marginTop: 12 }}>Assignment not found</Text>
      </View>
    );
  }

  const hasSubmission = !!submission;
  const isReviewed = submission?.isReviewed;
  const hasQuestions = isQuiz || detail?.hasQuestions;
  const questions = detail?.questions;

  const statusColor = isReviewed ? '#059669' : hasSubmission ? '#0749BB' : '#f59e0b';
  const statusLabel = isReviewed ? 'Graded' : hasSubmission ? 'Submitted' : 'Not Submitted';

  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: '#F9F8F5' }}>
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0749BB" />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={[s.hero, { paddingTop: insets.top + 8 }]}>
          {/* Back button */}
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.7}
            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}
          >
            <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.9)" />
            <Text
              style={{
                color: 'rgba(255,255,255,0.9)',
                fontSize: 15,
                fontWeight: '500',
                marginLeft: 2,
              }}
            >
              Back
            </Text>
          </TouchableOpacity>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700', lineHeight: 26 }}>
                {detail.title}
              </Text>
            </View>
            <View
              className="px-3 py-1.5 rounded-full"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
            >
              <Text className="text-white text-xs font-bold">{isQuiz ? 'Quiz' : 'Assignment'}</Text>
            </View>
          </View>

          {/* Meta pills */}
          <View className="flex-row flex-wrap gap-2 mb-3">
            {detail.subjectName ? <MetaPill icon="book-outline" text={detail.subjectName} /> : null}
            <MetaPill icon="trophy-outline" text={`${detail.totalMarks} marks`} />
            {detail.dueDate ? (
              <MetaPill
                icon="time-outline"
                text={`Due ${new Date(detail.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
              />
            ) : null}
          </View>

          {/* Status */}
          <View
            className="flex-row items-center px-3 py-2 rounded-xl"
            style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
          >
            <View className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: statusColor }} />
            <Text className="text-white text-xs font-semibold">{statusLabel}</Text>
            {isReviewed && submission?.marksObtained !== undefined && (
              <Text className="text-white text-xs font-bold ml-auto">
                Score: {submission.marksObtained}/{submission.totalMarks || detail.totalMarks}
              </Text>
            )}
          </View>
        </View>

        {/* Tabs */}
        <View className="flex-row bg-white border-b border-secondary-100 px-4">
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              className="mr-6 py-3"
              style={
                activeTab === tab ? { borderBottomWidth: 2, borderBottomColor: '#0749BB' } : {}
              }
            >
              <Text
                className="text-sm font-semibold"
                style={{ color: activeTab === tab ? '#0749BB' : '#8998B3' }}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'Details' ? (
          <View style={{ padding: 16 }}>
            {/* Overview card — always shown */}
            <View
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 16,
                padding: 16,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: '#EDF0F3',
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#042A6C', marginBottom: 10 }}>
                Overview
              </Text>
              <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, color: '#8998B3', marginBottom: 2 }}>Type</Text>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#2E4470' }}>
                    {isQuiz ? 'Quiz' : 'Assignment'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, color: '#8998B3', marginBottom: 2 }}>Subject</Text>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#2E4470' }}>
                    {detail.subjectName || 'General'}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, color: '#8998B3', marginBottom: 2 }}>
                    Total Marks
                  </Text>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#2E4470' }}>
                    {detail.totalMarks}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, color: '#8998B3', marginBottom: 2 }}>Due Date</Text>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#2E4470' }}>
                    {detail.dueDate
                      ? new Date(detail.dueDate).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : 'No deadline'}
                  </Text>
                </View>
              </View>
              {detail.teacherName ? (
                <View style={{ flexDirection: 'row', marginTop: 4 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, color: '#8998B3', marginBottom: 2 }}>
                      Assigned by
                    </Text>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#2E4470' }}>
                      {detail.teacherName}
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>

            {/* Description card */}
            {detail.description ? (
              <View
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: '#EDF0F3',
                }}
              >
                <Text
                  style={{ fontSize: 13, fontWeight: '700', color: '#042A6C', marginBottom: 8 }}
                >
                  Description
                </Text>
                <Text style={{ fontSize: 13, color: '#3E5683', lineHeight: 20 }}>
                  {detail.description}
                </Text>
              </View>
            ) : null}

            {/* Submit button */}
            {!hasSubmission && hasQuestions && questions && questions.length > 0 && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() =>
                  router.push(`/student/assignment-submit?id=${id}&kind=${kind}` as never)
                }
                style={s.submitBtn}
              >
                <Ionicons name="create-outline" size={18} color="#fff" />
                <Text style={{ color: '#ffffff', fontWeight: '700', marginLeft: 8 }}>
                  Submit Answers
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View className="p-4">
            {subLoading ? (
              <View className="items-center py-10">
                <ActivityIndicator size="large" color="#0749BB" />
              </View>
            ) : !hasSubmission ? (
              <View
                className="bg-white rounded-2xl p-8 items-center"
                style={{ borderWidth: 1, borderColor: '#EDF0F3' }}
              >
                <Ionicons name="document-outline" size={40} color="#D3DAE4" />
                <Text className="text-secondary-500 font-semibold mt-3">Not submitted yet</Text>
                {hasQuestions && questions && questions.length > 0 && (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() =>
                      router.push(`/student/assignment-submit?id=${id}&kind=${kind}` as never)
                    }
                    className="mt-4 px-6 py-3 rounded-xl"
                    style={{ backgroundColor: '#0749BB' }}
                  >
                    <Text className="text-white font-bold">Submit Now</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View>
                {/* Score banner */}
                {isReviewed && submission.marksObtained !== undefined && (
                  <View
                    className="rounded-2xl p-4 mb-4 items-center"
                    style={{
                      backgroundColor: scoreBg(
                        submission.marksObtained,
                        submission.totalMarks || detail.totalMarks
                      ),
                    }}
                  >
                    <Text
                      className="text-3xl font-bold"
                      style={{
                        color: scoreColorFn(
                          submission.marksObtained,
                          submission.totalMarks || detail.totalMarks
                        ),
                      }}
                    >
                      {submission.marksObtained}/{submission.totalMarks || detail.totalMarks}
                    </Text>
                    <Text className="text-sm font-semibold text-secondary-500 mt-1">
                      {Math.round(
                        (submission.marksObtained / (submission.totalMarks || detail.totalMarks)) *
                          100
                      )}
                      %
                    </Text>
                  </View>
                )}

                {/* Answers */}
                {submission.answers?.map((ans, i) => (
                  <View
                    key={ans.questionId || i}
                    className="bg-white rounded-2xl p-4 mb-3"
                    style={{ borderWidth: 1, borderColor: '#EDF0F3' }}
                  >
                    <Text className="text-xs text-secondary-400 font-semibold mb-1">
                      Question {i + 1}
                    </Text>
                    <Text className="text-sm text-secondary-700 font-medium">
                      Your answer: {ans.answer}
                    </Text>
                    {submission.questionResults?.[i] && (
                      <View className="flex-row items-center mt-2">
                        <Ionicons
                          name={
                            submission.questionResults[i].isCorrect
                              ? 'checkmark-circle'
                              : 'close-circle'
                          }
                          size={16}
                          color={submission.questionResults[i].isCorrect ? '#059669' : '#dc2626'}
                        />
                        <Text
                          className="text-xs font-semibold ml-1"
                          style={{
                            color: submission.questionResults[i].isCorrect ? '#059669' : '#dc2626',
                          }}
                        >
                          {submission.questionResults[i].isCorrect ? 'Correct' : 'Incorrect'}
                          {' · '}
                          {submission.questionResults[i].marksAwarded} marks
                        </Text>
                      </View>
                    )}
                  </View>
                ))}

                {submission.reviewerRemarks ? (
                  <View
                    className="bg-primary-50 rounded-2xl p-4 mt-2"
                    style={{ borderWidth: 1, borderColor: '#E1ECFE' }}
                  >
                    <Text className="text-xs text-primary-400 font-semibold mb-1">
                      Teacher Remarks
                    </Text>
                    <Text className="text-sm text-primary-800">{submission.reviewerRemarks}</Text>
                  </View>
                ) : null}

                <Text className="text-xs text-secondary-400 text-center mt-4">
                  Submitted on{' '}
                  {new Date(submission.submittedAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </Text>
              </View>
            )}
          </View>
        )}

        <View className="h-8" />
      </ScrollView>
    </View>
  );
}

function MetaPill({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View
      className="flex-row items-center px-2.5 py-1.5 rounded-lg"
      style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}
    >
      <Ionicons name={icon} size={12} color="rgba(255,255,255,0.7)" />
      <Text className="text-white text-[11px] font-medium ml-1.5">{text}</Text>
    </View>
  );
}

function scoreColorFn(obtained: number, total: number): string {
  const pct = total > 0 ? (obtained / total) * 100 : 0;
  if (pct >= 80) return '#059669';
  if (pct >= 60) return '#0749BB';
  if (pct >= 40) return '#d97706';
  return '#dc2626';
}

function scoreBg(obtained: number, total: number): string {
  const pct = total > 0 ? (obtained / total) * 100 : 0;
  if (pct >= 80) return '#f0fdf4';
  if (pct >= 60) return '#F0F5FE';
  if (pct >= 40) return '#fef3c7';
  return '#fef2f2';
}

const s = StyleSheet.create({
  hero: {
    backgroundColor: '#053495',
    paddingHorizontal: 20,
    paddingBottom: 20,
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

import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { teachingApi, TeachingClass, SectionReportItem } from '@/api/teaching';

function ReportCard({ item, onPress }: { item: SectionReportItem; onPress: () => void }) {
  const percentage = item.totalMarks > 0 ? (item.averageScore / item.totalMarks) * 100 : 0;
  const gradedPercentage =
    item.totalStudents > 0 ? (item.studentsGraded / item.totalStudents) * 100 : 0;

  const getScoreColor = () => {
    if (percentage >= 80) return '#16a34a';
    if (percentage >= 60) return '#053495';
    if (percentage >= 40) return '#d97706';
    return '#ef4444';
  };

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} className="mb-3">
      <View
        className="bg-white rounded-2xl p-4"
        style={{
          elevation: 2,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
        }}
      >
        <View className="flex-row items-start justify-between mb-3">
          <View className="flex-1 mr-3">
            <Text className="text-base font-semibold text-secondary-800" numberOfLines={2}>
              {item.assignmentTitle}
            </Text>
            <Text className="text-xs text-secondary-400 mt-1">
              Due:{' '}
              {new Date(item.dueDate).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-2xl font-bold" style={{ color: getScoreColor() }}>
              {percentage > 0 ? `${percentage.toFixed(0)}%` : '-'}
            </Text>
            <Text className="text-xs text-secondary-400">avg score</Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View className="mb-2">
          <View className="flex-row justify-between mb-1">
            <Text className="text-xs text-secondary-500">
              Graded: {item.studentsGraded}/{item.totalStudents}
            </Text>
            <Text className="text-xs text-secondary-400">{gradedPercentage.toFixed(0)}%</Text>
          </View>
          <View className="h-2 bg-secondary-100 rounded-full overflow-hidden">
            <View
              className="h-2 rounded-full"
              style={{
                width: `${Math.min(gradedPercentage, 100)}%`,
                backgroundColor: gradedPercentage >= 100 ? '#16a34a' : '#053495',
              }}
            />
          </View>
        </View>

        {/* Stats row */}
        <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-secondary-50">
          <View className="flex-row items-center">
            <Ionicons name="trophy-outline" size={14} color="#8998B3" />
            <Text className="text-xs text-secondary-500 ml-1">Total: {item.totalMarks}</Text>
          </View>
          <View className="flex-row items-center">
            <Ionicons name="stats-chart-outline" size={14} color="#8998B3" />
            <Text className="text-xs text-secondary-500 ml-1">
              Avg: {item.averageScore > 0 ? item.averageScore.toFixed(1) : '-'}/{item.totalMarks}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function GradebookScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [showSectionPicker, setShowSectionPicker] = useState(false);

  // Fetch classes
  const { data: classes } = useQuery({
    queryKey: ['my-classes'],
    queryFn: () => teachingApi.getMyClasses(),
  });

  // Fetch section report
  const {
    data: report,
    refetch,
    isLoading,
  } = useQuery({
    queryKey: ['section-report', selectedSectionId],
    queryFn: () => teachingApi.getSectionReport(selectedSectionId),
    enabled: !!selectedSectionId,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const selectedClass = classes?.find((c: TeachingClass) => c.sectionId === selectedSectionId);
  const reportItems = report || [];

  // Calculate summary stats
  const totalAssignments = reportItems.length;
  const fullyGraded = reportItems.filter((r) => r.studentsGraded >= r.totalStudents).length;
  const overallAvg =
    totalAssignments > 0
      ? reportItems.reduce(
          (sum, r) => sum + (r.totalMarks > 0 ? (r.averageScore / r.totalMarks) * 100 : 0),
          0
        ) / totalAssignments
      : 0;

  return (
    <>
      <Stack.Screen options={{ headerTitle: 'Gradebook' }} />
      <ScrollView
        className="flex-1 bg-secondary-50"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#053495" />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Section Picker */}
        <View className="px-5 pt-4">
          <Text className="text-sm font-semibold text-secondary-700 mb-1.5">Select Class</Text>
          <TouchableOpacity
            onPress={() => setShowSectionPicker(!showSectionPicker)}
            className="bg-white border border-secondary-200 rounded-xl px-4 py-3 flex-row items-center justify-between"
            style={{ elevation: 1 }}
          >
            <View className="flex-row items-center">
              <View className="w-8 h-8 bg-primary-50 rounded-lg items-center justify-center mr-3">
                <Ionicons name="school" size={16} color="#053495" />
              </View>
              <Text className={selectedSectionId ? 'text-secondary-800 font-medium' : 'text-secondary-400'}>
                {selectedClass
                  ? `${selectedClass.className} - ${selectedClass.sectionName}`
                  : 'Choose a class to view grades'}
              </Text>
            </View>
            <Ionicons
              name={showSectionPicker ? 'chevron-up' : 'chevron-down'}
              size={18}
              color="#8998B3"
            />
          </TouchableOpacity>

          {showSectionPicker && (
            <View
              className="bg-white border border-secondary-200 rounded-xl mt-1 overflow-hidden"
              style={{ elevation: 2 }}
            >
              {classes?.map((cls: TeachingClass) => (
                <TouchableOpacity
                  key={cls.sectionId}
                  onPress={() => {
                    setSelectedSectionId(cls.sectionId);
                    setShowSectionPicker(false);
                  }}
                  className={`px-4 py-3 border-b border-secondary-50 flex-row items-center ${
                    cls.sectionId === selectedSectionId ? 'bg-primary-50' : ''
                  }`}
                >
                  <View className="w-7 h-7 bg-primary-100 rounded-lg items-center justify-center mr-3">
                    <Ionicons name="people" size={14} color="#053495" />
                  </View>
                  <View className="flex-1">
                    <Text
                      className={
                        cls.sectionId === selectedSectionId
                          ? 'text-primary-600 font-medium'
                          : 'text-secondary-800'
                      }
                    >
                      {cls.className} - {cls.sectionName}
                    </Text>
                    <Text className="text-xs text-secondary-400">{cls.studentCount} students</Text>
                  </View>
                  {cls.sectionId === selectedSectionId && (
                    <Ionicons name="checkmark" size={18} color="#053495" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Content */}
        {!selectedSectionId ? (
          <View className="items-center mt-16 px-5">
            <View className="w-20 h-20 bg-primary-50 rounded-full items-center justify-center mb-4">
              <Ionicons name="stats-chart-outline" size={40} color="#053495" />
            </View>
            <Text className="text-secondary-800 font-semibold text-lg">Select a Class</Text>
            <Text className="text-secondary-400 text-sm mt-2 text-center">
              Choose a class above to view the gradebook and assignment performance
            </Text>
          </View>
        ) : isLoading ? (
          <View className="items-center py-16">
            <ActivityIndicator size="large" color="#053495" />
          </View>
        ) : (
          <>
            {/* Summary Stats */}
            {totalAssignments > 0 && (
              <View className="flex-row px-5 mt-4">
                <View className="flex-1 bg-primary-50 rounded-xl p-3 mr-2 items-center">
                  <Text className="text-primary-600 text-xl font-bold">{totalAssignments}</Text>
                  <Text className="text-primary-500 text-xs">Assignments</Text>
                </View>
                <View className="flex-1 bg-green-50 rounded-xl p-3 mr-2 items-center">
                  <Text className="text-green-600 text-xl font-bold">{fullyGraded}</Text>
                  <Text className="text-green-500 text-xs">Fully Graded</Text>
                </View>
                <View className="flex-1 bg-amber-50 rounded-xl p-3 items-center">
                  <Text className="text-amber-600 text-xl font-bold">
                    {overallAvg > 0 ? `${overallAvg.toFixed(0)}%` : '-'}
                  </Text>
                  <Text className="text-amber-500 text-xs">Avg Score</Text>
                </View>
              </View>
            )}

            {/* Report Cards */}
            <View className="px-5 mt-4 pb-8">
              {reportItems.length === 0 ? (
                <View className="bg-white rounded-2xl p-8 items-center" style={{ elevation: 2 }}>
                  <Ionicons name="clipboard-outline" size={40} color="#8998B3" />
                  <Text className="text-secondary-500 mt-2 font-medium">No Assignments Yet</Text>
                  <Text className="text-secondary-400 text-sm mt-1 text-center">
                    Assignments for this class will appear here
                  </Text>
                </View>
              ) : (
                reportItems.map((item) => (
                  <ReportCard
                    key={item.assignmentId}
                    item={item}
                    onPress={() =>
                      router.push(`/teaching/assignment-detail?id=${item.assignmentId}`)
                    }
                  />
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </>
  );
}

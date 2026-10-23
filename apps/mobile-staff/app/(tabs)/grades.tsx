import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { teachingApi, TeachingClass, SectionReportItem } from '@/api/teaching';

const _FC = '#F9F8F5';
const _STEPS = 40;
function BottomFade() {
  return (
    <View style={_fs.c} pointerEvents="none">
      {Array.from({ length: _STEPS }, (_, i) => {
        const t = i / (_STEPS - 1);
        const o = Math.min(t * t * 2.5, 1);
        return <View key={i} style={{ flex: 1, backgroundColor: _FC, opacity: o }} />;
      })}
    </View>
  );
}
const _fs = StyleSheet.create({
  c: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, zIndex: 1 },
});

function ReportCard({ item, onPress }: { item: SectionReportItem; onPress: () => void }) {
  const pct = item.totalMarks > 0 ? (item.averageScore / item.totalMarks) * 100 : 0;
  const gradedPct = item.totalStudents > 0 ? (item.studentsGraded / item.totalStudents) * 100 : 0;

  const scoreColor =
    pct >= 80
      ? '#16a34a'
      : pct >= 60
        ? '#053495'
        : pct >= 40
          ? '#d97706'
          : pct > 0
            ? '#ef4444'
            : '#8998B3';

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} className="mb-2.5">
      <View
        className="bg-white rounded-xl p-4 border border-secondary-100"
        style={{
          elevation: 1,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.03,
          shadowRadius: 4,
        }}
      >
        {/* Title row */}
        <View className="flex-row items-start mb-3">
          <View className="flex-1 mr-3">
            <Text className="text-[15px] font-semibold text-secondary-800" numberOfLines={2}>
              {item.assignmentTitle}
            </Text>
            <Text className="text-[11px] text-secondary-400 mt-0.5">
              Due{' '}
              {new Date(item.dueDate).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
              })}
              {' · '}
              {item.totalMarks} marks
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-xl font-bold" style={{ color: scoreColor }}>
              {pct > 0 ? `${pct.toFixed(0)}%` : '—'}
            </Text>
            <Text className="text-[10px] text-secondary-400">avg</Text>
          </View>
        </View>

        {/* Graded progress */}
        <View>
          <View className="flex-row justify-between mb-1">
            <Text className="text-[11px] text-secondary-500 font-medium">
              {item.studentsGraded}/{item.totalStudents} graded
            </Text>
            <Text className="text-[11px] text-secondary-400">{gradedPct.toFixed(0)}%</Text>
          </View>
          <View className="h-1.5 bg-secondary-100 rounded-full overflow-hidden">
            <View
              className="h-1.5 rounded-full"
              style={{
                width: `${Math.min(gradedPct, 100)}%`,
                backgroundColor: gradedPct >= 100 ? '#16a34a' : '#053495',
              }}
            />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function GradebookScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  const { data: classes } = useQuery({
    queryKey: ['my-classes'],
    queryFn: () => teachingApi.getMyClasses(),
  });

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
  const items = report || [];

  // Summary
  const total = items.length;
  const fullyGraded = items.filter((r) => r.studentsGraded >= r.totalStudents).length;
  const overallAvg =
    total > 0
      ? items.reduce(
          (s, r) => s + (r.totalMarks > 0 ? (r.averageScore / r.totalMarks) * 100 : 0),
          0
        ) / total
      : 0;

  return (
    <View style={{ flex: 1, backgroundColor: '#F9F8F5' }}>
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#053495" />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Section picker */}
        <View className="px-4 pt-3">
          <TouchableOpacity
            onPress={() => setPickerOpen(!pickerOpen)}
            className="bg-white border border-secondary-200 rounded-xl px-4 py-3 flex-row items-center justify-between"
            activeOpacity={0.7}
          >
            <View className="flex-row items-center flex-1">
              <View className="w-8 h-8 bg-primary-50 rounded-lg items-center justify-center mr-3">
                <Ionicons name="school" size={16} color="#053495" />
              </View>
              <Text
                className={`text-sm font-medium ${selectedSectionId ? 'text-secondary-800' : 'text-secondary-400'}`}
              >
                {selectedClass
                  ? `${selectedClass.className} · ${selectedClass.sectionName}`
                  : 'Select a class'}
              </Text>
            </View>
            <Ionicons name={pickerOpen ? 'chevron-up' : 'chevron-down'} size={16} color="#8998B3" />
          </TouchableOpacity>

          {pickerOpen && classes && classes.length > 0 && (
            <View
              className="bg-white border border-secondary-200 rounded-xl mt-1.5 overflow-hidden"
              style={{ elevation: 2 }}
            >
              {classes.map((cls: TeachingClass) => (
                <TouchableOpacity
                  key={cls.sectionId}
                  onPress={() => {
                    setSelectedSectionId(cls.sectionId);
                    setPickerOpen(false);
                  }}
                  className={`px-4 py-3 flex-row items-center border-b border-secondary-50 ${cls.sectionId === selectedSectionId ? 'bg-primary-50' : ''}`}
                >
                  <Text
                    className={`flex-1 text-sm ${cls.sectionId === selectedSectionId ? 'text-primary-600 font-semibold' : 'text-secondary-700'}`}
                  >
                    {cls.className} · {cls.sectionName}
                  </Text>
                  <Text className="text-xs text-secondary-400">{cls.studentCount} students</Text>
                  {cls.sectionId === selectedSectionId && (
                    <Ionicons name="checkmark" size={16} color="#053495" className="ml-2" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Content */}
        {!selectedSectionId ? (
          <View className="items-center mt-20 px-8">
            <View className="w-20 h-20 bg-primary-50 rounded-full items-center justify-center mb-4">
              <Ionicons name="stats-chart-outline" size={36} color="#053495" />
            </View>
            <Text className="text-secondary-800 font-bold text-lg text-center">Select a Class</Text>
            <Text className="text-secondary-400 text-sm mt-2 text-center leading-5">
              Choose a class above to view assignment grades and performance reports
            </Text>
          </View>
        ) : isLoading ? (
          <View className="items-center py-20">
            <ActivityIndicator size="large" color="#053495" />
          </View>
        ) : (
          <View className="px-4 mt-4">
            {/* Summary cards */}
            {total > 0 && (
              <View className="flex-row mb-4">
                <View className="flex-1 bg-primary-50 rounded-xl p-3 mr-2 items-center">
                  <Text className="text-primary-700 text-lg font-bold">{total}</Text>
                  <Text className="text-primary-500 text-[10px] font-semibold">TOTAL</Text>
                </View>
                <View className="flex-1 bg-green-50 rounded-xl p-3 mr-2 items-center">
                  <Text className="text-green-700 text-lg font-bold">{fullyGraded}</Text>
                  <Text className="text-green-500 text-[10px] font-semibold">GRADED</Text>
                </View>
                <View className="flex-1 bg-amber-50 rounded-xl p-3 items-center">
                  <Text className="text-amber-700 text-lg font-bold">
                    {overallAvg > 0 ? `${overallAvg.toFixed(0)}%` : '—'}
                  </Text>
                  <Text className="text-amber-500 text-[10px] font-semibold">AVG SCORE</Text>
                </View>
              </View>
            )}

            {/* Report list */}
            {items.length === 0 ? (
              <View className="bg-white rounded-2xl p-10 items-center" style={{ elevation: 1 }}>
                <Ionicons name="clipboard-outline" size={32} color="#8998B3" />
                <Text className="text-secondary-500 mt-2 font-medium">No Assignments</Text>
                <Text className="text-secondary-400 text-sm mt-1 text-center">
                  No assignments found for this class
                </Text>
              </View>
            ) : (
              items.map((item) => (
                <ReportCard
                  key={item.assignmentId}
                  item={item}
                  onPress={() => router.push(`/teaching/assignment-detail?id=${item.assignmentId}`)}
                />
              ))
            )}
            <View className="h-24" />
          </View>
        )}
      </ScrollView>
      <BottomFade />
    </View>
  );
}

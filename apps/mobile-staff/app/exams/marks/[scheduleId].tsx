import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, Stack } from 'expo-router';
import { examsApi, type ExamSchedule, type MarkRow } from '@/api/exams';

export default function MarksEntryScreen() {
  const { scheduleId, examId } = useLocalSearchParams<{
    scheduleId: string;
    examId: string;
  }>();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<MarkRow[]>([]);
  const [dirty, setDirty] = useState(false);

  // Look up the schedule (so we know paperId, sectionId, totalMarks).
  const schedulesQuery = useQuery({
    queryKey: ['exam-schedules', examId],
    queryFn: () => examsApi.listSchedules({ examId }),
    enabled: !!examId,
  });

  const schedule = ((schedulesQuery.data as ExamSchedule[] | undefined) || []).find(
    (s) => s._id === scheduleId
  );

  const marksQuery = useQuery({
    queryKey: ['marks', examId, schedule?.paperId, schedule?.sectionId],
    queryFn: () =>
      examsApi.listMarks({
        examId: examId!,
        paperId: schedule!.paperId,
        sectionId: schedule!.sectionId,
      }),
    enabled: !!schedule,
  });

  useEffect(() => {
    if (marksQuery.data) {
      setRows(marksQuery.data as MarkRow[]);
      setDirty(false);
    }
  }, [marksQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!schedule) throw new Error('No schedule');
      const marks = rows
        .filter((r) => r.absent || r.marksObtained != null)
        .map((r) => ({
          studentId: r.studentId,
          marksObtained: r.absent ? 0 : Number(r.marksObtained),
          absent: r.absent,
          remarks: r.remarks,
        }));
      return examsApi.bulkSaveMarks({
        examId: examId!,
        paperId: schedule.paperId,
        scheduleId,
        marks,
      });
    },
    onSuccess: () => {
      Alert.alert('Saved', 'Marks have been saved.');
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ['marks', examId] });
    },
    onError: (err: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      Alert.alert('Save failed', err.response?.data?.error?.message || 'Could not save marks.');
    },
  });

  if (!schedule) {
    return (
      <View className="flex-1 items-center justify-center bg-secondary-50">
        <ActivityIndicator color="#053495" />
      </View>
    );
  }

  const updateRow = (idx: number, patch: Partial<MarkRow>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
    setDirty(true);
  };

  return (
    <View className="flex-1 bg-secondary-50">
      <Stack.Screen
        options={{
          title: `${schedule.subjectName} · ${schedule.sectionName}`,
          headerRight: () => (
            <TouchableOpacity
              onPress={() => saveMutation.mutate()}
              disabled={!dirty || saveMutation.isPending}
              className="px-3 py-1.5 rounded-lg"
              style={{
                backgroundColor: dirty ? '#053495' : '#D3DAE4',
                opacity: saveMutation.isPending ? 0.6 : 1,
              }}
            >
              <Text className="text-white font-semibold text-sm">
                {saveMutation.isPending ? 'Saving…' : 'Save'}
              </Text>
            </TouchableOpacity>
          ),
        }}
      />
      <View className="bg-white px-4 py-3 border-b border-secondary-200">
        <Text className="text-xs text-secondary-500">
          {schedule.className} · {new Date(schedule.date).toLocaleDateString()}
        </Text>
        <Text className="text-sm font-medium text-secondary-700 mt-0.5">
          Total {schedule.totalMarks} marks · Pass {schedule.passMarks}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 12 }}>
        {marksQuery.isLoading ? (
          <View className="items-center justify-center py-16">
            <ActivityIndicator color="#053495" />
          </View>
        ) : rows.length === 0 ? (
          <View className="items-center justify-center py-16">
            <Ionicons name="people-outline" size={48} color="#D3DAE4" />
            <Text className="text-sm text-secondary-500 mt-3">No students enrolled.</Text>
          </View>
        ) : (
          rows.map((r, i) => (
            <View
              key={r.studentId}
              className="bg-white rounded-xl px-3 py-3 mb-2"
              style={{
                elevation: 1,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.04,
                shadowRadius: 4,
              }}
            >
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-1">
                  <Text className="font-medium text-secondary-800 text-sm">{r.studentName}</Text>
                  <Text className="text-xs text-secondary-500">
                    {r.rollNumber ? `Roll ${r.rollNumber}` : ''}
                    {r.rollNumber && r.admissionNumber ? ' · ' : ''}
                    {r.admissionNumber || ''}
                  </Text>
                </View>
                {r.grade && (
                  <View className="px-2 py-0.5 rounded bg-primary-100">
                    <Text className="text-xs font-semibold text-primary-700">{r.grade}</Text>
                  </View>
                )}
              </View>
              <View className="flex-row items-center gap-2">
                <TextInput
                  keyboardType="number-pad"
                  placeholder="Marks"
                  value={r.marksObtained != null ? String(r.marksObtained) : ''}
                  onChangeText={(v) =>
                    updateRow(i, {
                      marksObtained: v === '' ? null : Number(v),
                    })
                  }
                  editable={!r.absent}
                  className="flex-1 border border-secondary-200 rounded-lg px-3 py-2 text-base"
                  style={{ opacity: r.absent ? 0.4 : 1 }}
                />
                <TouchableOpacity
                  onPress={() =>
                    updateRow(i, {
                      absent: !r.absent,
                      marksObtained: !r.absent ? null : r.marksObtained,
                    })
                  }
                  className="px-3 py-2 rounded-lg border"
                  style={{
                    backgroundColor: r.absent ? '#fef2f2' : 'transparent',
                    borderColor: r.absent ? '#fca5a5' : '#D3DAE4',
                  }}
                >
                  <Text
                    className="text-xs font-semibold"
                    style={{ color: r.absent ? '#dc2626' : '#3E5683' }}
                  >
                    {r.absent ? 'Absent' : 'Mark absent'}
                  </Text>
                </TouchableOpacity>
              </View>
              {r.percentage != null && !r.absent && (
                <Text className="text-xs text-secondary-500 mt-1.5">
                  {r.percentage}% · {r.passed ? 'Passed' : 'Failed'}
                </Text>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

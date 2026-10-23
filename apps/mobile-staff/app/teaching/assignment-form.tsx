import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { teachingApi, TeachingClass, getSubjects } from '@/api/teaching';

export default function AssignmentFormScreen() {
  const { editId, sectionId: preSelectedSectionId } = useLocalSearchParams<{
    editId?: string;
    sectionId?: string;
  }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEditing = !!editId;

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState(preSelectedSectionId || '');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [totalMarks, setTotalMarks] = useState('100');
  const [showSectionPicker, setShowSectionPicker] = useState(false);
  const [showSubjectPicker, setShowSubjectPicker] = useState(false);

  // Fetch classes
  const { data: classes } = useQuery({
    queryKey: ['my-classes'],
    queryFn: () => teachingApi.getMyClasses(),
  });

  // Fetch existing assignment if editing
  const { data: existingAssignment } = useQuery({
    queryKey: ['assignment', editId],
    queryFn: () => teachingApi.getAssignment(editId!),
    enabled: isEditing,
  });

  // Pre-fill form when editing
  useEffect(() => {
    if (existingAssignment) {
      setTitle(existingAssignment.title);
      setDescription(existingAssignment.description || '');
      setSelectedSectionId(existingAssignment.sectionId);
      setSelectedSubjectId(existingAssignment.subjectId);
      setDueDate(new Date(existingAssignment.dueDate).toISOString().split('T')[0]);
      setTotalMarks(existingAssignment.totalMarks.toString());
    }
  }, [existingAssignment]);

  const selectedClass = classes?.find((c: TeachingClass) => c.sectionId === selectedSectionId);
  const subjects = selectedClass ? getSubjects(selectedClass) : [];

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof teachingApi.createAssignment>[0]) =>
      teachingApi.createAssignment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      router.back();
    },
    onError: () => Alert.alert('Error', 'Failed to create assignment'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => teachingApi.updateAssignment(editId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      queryClient.invalidateQueries({ queryKey: ['assignment', editId] });
      router.back();
    },
    onError: () => Alert.alert('Error', 'Failed to update assignment'),
  });

  const handleSubmit = () => {
    if (!title.trim()) return Alert.alert('Validation', 'Title is required');
    if (!selectedSectionId) return Alert.alert('Validation', 'Please select a class');
    if (!selectedSubjectId) return Alert.alert('Validation', 'Please select a subject');
    if (!dueDate) return Alert.alert('Validation', 'Due date is required');
    if (!totalMarks || isNaN(parseInt(totalMarks)))
      return Alert.alert('Validation', 'Total marks is required');

    const data = {
      title: title.trim(),
      description: description.trim() || undefined,
      sectionId: selectedSectionId,
      subjectId: selectedSubjectId,
      dueDate,
      totalMarks: parseInt(totalMarks),
    };

    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: isEditing ? 'Edit Assignment' : 'New Assignment',
          headerRight: () => (
            <TouchableOpacity onPress={handleSubmit} disabled={isSaving} className="mr-2">
              {isSaving ? (
                <ActivityIndicator color="#053495" />
              ) : (
                <Text className="text-primary-600 font-bold text-base">Save</Text>
              )}
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView
        className="flex-1 bg-secondary-50"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View className="px-5 pt-4 pb-8">
          {/* Title */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-secondary-700 mb-1.5">Title *</Text>
            <TextInput
              className="bg-white border border-secondary-200 rounded-xl px-4 py-3 text-base text-secondary-800"
              placeholder="Enter assignment title"
              placeholderTextColor="#8998B3"
              value={title}
              onChangeText={setTitle}
            />
          </View>

          {/* Section Picker */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-secondary-700 mb-1.5">Class *</Text>
            <TouchableOpacity
              onPress={() => setShowSectionPicker(!showSectionPicker)}
              className="bg-white border border-secondary-200 rounded-xl px-4 py-3 flex-row items-center justify-between"
            >
              <Text className={selectedSectionId ? 'text-secondary-800' : 'text-secondary-400'}>
                {selectedClass
                  ? `${selectedClass.className} - ${selectedClass.sectionName}`
                  : 'Select class'}
              </Text>
              <Ionicons
                name={showSectionPicker ? 'chevron-up' : 'chevron-down'}
                size={18}
                color="#8998B3"
              />
            </TouchableOpacity>
            {showSectionPicker && (
              <View className="bg-white border border-secondary-200 rounded-xl mt-1 overflow-hidden">
                {classes?.map((cls: TeachingClass) => (
                  <TouchableOpacity
                    key={cls.sectionId}
                    onPress={() => {
                      setSelectedSectionId(cls.sectionId);
                      setSelectedSubjectId('');
                      setShowSectionPicker(false);
                    }}
                    className={`px-4 py-3 border-b border-secondary-50 ${cls.sectionId === selectedSectionId ? 'bg-primary-50' : ''}`}
                  >
                    <Text
                      className={
                        cls.sectionId === selectedSectionId
                          ? 'text-primary-600 font-medium'
                          : 'text-secondary-800'
                      }
                    >
                      {cls.className} - {cls.sectionName}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Subject Picker */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-secondary-700 mb-1.5">Subject *</Text>
            <TouchableOpacity
              onPress={() => selectedSectionId && setShowSubjectPicker(!showSubjectPicker)}
              className={`bg-white border border-secondary-200 rounded-xl px-4 py-3 flex-row items-center justify-between ${!selectedSectionId ? 'opacity-50' : ''}`}
            >
              <Text className={selectedSubjectId ? 'text-secondary-800' : 'text-secondary-400'}>
                {subjects.find((s) => s.subjectId === selectedSubjectId)?.subjectName ||
                  'Select subject'}
              </Text>
              <Ionicons
                name={showSubjectPicker ? 'chevron-up' : 'chevron-down'}
                size={18}
                color="#8998B3"
              />
            </TouchableOpacity>
            {showSubjectPicker && subjects.length > 0 && (
              <View className="bg-white border border-secondary-200 rounded-xl mt-1 overflow-hidden">
                {subjects.map((sub) => (
                  <TouchableOpacity
                    key={sub.subjectId}
                    onPress={() => {
                      setSelectedSubjectId(sub.subjectId);
                      setShowSubjectPicker(false);
                    }}
                    className={`px-4 py-3 border-b border-secondary-50 ${sub.subjectId === selectedSubjectId ? 'bg-primary-50' : ''}`}
                  >
                    <Text
                      className={
                        sub.subjectId === selectedSubjectId
                          ? 'text-primary-600 font-medium'
                          : 'text-secondary-800'
                      }
                    >
                      {sub.subjectName}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Due Date & Total Marks Row */}
          <View className="flex-row mb-4">
            <View className="flex-1 mr-2">
              <Text className="text-sm font-semibold text-secondary-700 mb-1.5">Due Date *</Text>
              <TextInput
                className="bg-white border border-secondary-200 rounded-xl px-4 py-3 text-base text-secondary-800"
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#8998B3"
                value={dueDate}
                onChangeText={setDueDate}
              />
            </View>
            <View className="flex-1 ml-2">
              <Text className="text-sm font-semibold text-secondary-700 mb-1.5">Total Marks *</Text>
              <TextInput
                className="bg-white border border-secondary-200 rounded-xl px-4 py-3 text-base text-secondary-800"
                placeholder="e.g. 100"
                placeholderTextColor="#8998B3"
                value={totalMarks}
                onChangeText={setTotalMarks}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Description */}
          <View className="mb-6">
            <Text className="text-sm font-semibold text-secondary-700 mb-1.5">Description</Text>
            <TextInput
              className="bg-white border border-secondary-200 rounded-xl px-4 py-3 text-base text-secondary-800"
              placeholder="Assignment instructions or description"
              placeholderTextColor="#8998B3"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              style={{ minHeight: 120 }}
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity onPress={handleSubmit} disabled={isSaving} activeOpacity={0.8}>
            <View
              className="bg-primary-600 rounded-xl py-4 items-center"
              style={{
                elevation: 3,
                shadowColor: '#053495',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
              }}
            >
              {isSaving ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-white font-bold text-base">
                  {isEditing ? 'Update Assignment' : 'Create Assignment'}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </>
  );
}

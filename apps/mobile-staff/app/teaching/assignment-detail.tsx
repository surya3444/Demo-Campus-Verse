import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Modal,
  Pressable,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { teachingApi, Grade } from '@/api/teaching';

type TabKey = 'details' | 'grades';

const STATUS_CFG: Record<string, { color: string; label: string }> = {
  draft: { color: '#526C98', label: 'Draft' },
  published: { color: '#053495', label: 'Published' },
  grading: { color: '#d97706', label: 'Grading' },
  completed: { color: '#16a34a', label: 'Completed' },
};

// Hero colors per status
const HERO_COLORS: Record<string, string> = {
  draft: '#526C98',
  published: '#053495',
  grading: '#d97706',
  completed: '#059669',
};

function GradeRow({
  grade,
  totalMarks,
  onMarksChange,
  onRemarksChange,
  editable,
}: {
  grade: Grade & { marksInput?: string; remarksInput?: string };
  totalMarks: number;
  onMarksChange: (v: string) => void;
  onRemarksChange: (v: string) => void;
  editable: boolean;
}) {
  const pct = grade.marksObtained > 0 ? (grade.marksObtained / totalMarks) * 100 : 0;
  const gc = pct >= 80 ? '#16a34a' : pct >= 60 ? '#053495' : pct >= 40 ? '#d97706' : '#ef4444';

  return (
    <View style={st.gradeRow}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: editable ? 8 : 0 }}>
        <View style={st.gradeAvatar}>
          <Text style={st.gradeAvatarText}>
            {grade.studentName
              ?.split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 2)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#042A6C' }}>
            {grade.studentName}
          </Text>
          <Text style={{ fontSize: 11, color: '#8998B3', marginTop: 1 }}>
            {grade.admissionNumber}
          </Text>
        </View>
        {grade.marksObtained > 0 && (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: gc }}>
              {grade.marksObtained}/{totalMarks}
            </Text>
            <Text style={{ fontSize: 10, color: '#8998B3' }}>{pct.toFixed(0)}%</Text>
          </View>
        )}
      </View>
      {editable && (
        <View style={{ flexDirection: 'row' }}>
          <TextInput
            style={st.gradeInput}
            placeholder={`/ ${totalMarks}`}
            placeholderTextColor="#D3DAE4"
            value={grade.marksInput ?? grade.marksObtained?.toString() ?? ''}
            onChangeText={onMarksChange}
            keyboardType="numeric"
          />
          <TextInput
            style={[st.gradeInput, { flex: 2, marginLeft: 8 }]}
            placeholder="Remarks"
            placeholderTextColor="#D3DAE4"
            value={grade.remarksInput ?? grade.remarks ?? ''}
            onChangeText={onRemarksChange}
          />
        </View>
      )}
    </View>
  );
}

export default function AssignmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>('details');
  const [gradeEdits, setGradeEdits] = useState<Record<string, { marks: string; remarks: string }>>(
    {}
  );
  const [hasDirtyGrades, setHasDirtyGrades] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const { data: assignment, isLoading: assignmentLoading } = useQuery({
    queryKey: ['assignment', id],
    queryFn: () => teachingApi.getAssignment(id!),
    enabled: !!id,
  });

  const { data: gradesData, isLoading: gradesLoading } = useQuery({
    queryKey: ['assignment-grades', id],
    queryFn: () => teachingApi.getAssignmentGrades(id!),
    enabled: !!id && activeTab === 'grades',
  });

  const publishMutation = useMutation({
    mutationFn: () => teachingApi.publishAssignment(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignment', id] });
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
    },
  });
  const startGradingMutation = useMutation({
    mutationFn: () => teachingApi.startGrading(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignment', id] });
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
    },
  });
  const completeMutation = useMutation({
    mutationFn: () => teachingApi.completeAssignment(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignment', id] });
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
    },
  });
  const bulkGradeMutation = useMutation({
    mutationFn: (data: Parameters<typeof teachingApi.bulkGrade>[0]) => teachingApi.bulkGrade(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignment-grades', id] });
      setGradeEdits({});
      setHasDirtyGrades(false);
      Alert.alert('Success', 'Grades saved');
    },
    onError: () => Alert.alert('Error', 'Failed to save grades'),
  });
  const deleteMutation = useMutation({
    mutationFn: () => teachingApi.deleteAssignment(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      router.back();
    },
  });

  const handleDelete = () => {
    setMenuOpen(false);
    Alert.alert('Delete Assignment', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate() },
    ]);
  };
  const handleEdit = () => {
    setMenuOpen(false);
    router.push(`/teaching/assignment-form?editId=${id}`);
  };

  const handleSaveGrades = () => {
    const grades = Object.entries(gradeEdits)
      .filter(([, e]) => e.marks.trim() !== '')
      .map(([studentId, e]) => ({
        studentId,
        marksObtained: parseFloat(e.marks),
        remarks: e.remarks || undefined,
      }));
    if (grades.length === 0) return Alert.alert('No Changes', 'No grades to save');
    bulkGradeMutation.mutate({ assignmentId: id!, grades });
  };

  const updateGradeEdit = (studentId: string, field: 'marks' | 'remarks', value: string) => {
    setGradeEdits((prev) => ({
      ...prev,
      [studentId]: {
        marks: prev[studentId]?.marks ?? '',
        remarks: prev[studentId]?.remarks ?? '',
        [field]: value,
      },
    }));
    setHasDirtyGrades(true);
  };

  if (assignmentLoading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View
          style={{
            flex: 1,
            backgroundColor: '#F9F8F5',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ActivityIndicator size="large" color="#053495" />
        </View>
      </>
    );
  }
  if (!assignment) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View
          style={{
            flex: 1,
            backgroundColor: '#F9F8F5',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="clipboard-outline" size={48} color="#8998B3" />
          <Text style={{ color: '#8998B3', marginTop: 8 }}>Assignment not found</Text>
        </View>
      </>
    );
  }

  const sCfg = STATUS_CFG[assignment.status] || STATUS_CFG.draft;
  const heroColor = HERO_COLORS[assignment.status] || '#053495';
  const isOverdue = new Date(assignment.dueDate) < new Date() && assignment.status !== 'completed';
  const canGrade = assignment.status === 'grading' || assignment.status === 'completed';
  const grades = gradesData?.grades || [];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={{ flex: 1, backgroundColor: '#F9F8F5' }}>
          {/* Hero */}
          <View style={[st.hero, { backgroundColor: heroColor }]}>
            <View style={st.heroCircle} />
            <View style={{ paddingTop: insets.top + 8, paddingBottom: 28, paddingHorizontal: 20 }}>
              <View style={st.topBar}>
                <TouchableOpacity
                  onPress={() => router.back()}
                  activeOpacity={0.7}
                  style={st.backBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="chevron-back" size={22} color="#fff" />
                  <Text style={st.backText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setMenuOpen(true)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="ellipsis-horizontal" size={22} color="#fff" />
                </TouchableOpacity>
              </View>

              <Text style={st.heroTitle} numberOfLines={2}>
                {assignment.title}
              </Text>

              <View style={{ flexDirection: 'row', marginTop: 12, flexWrap: 'wrap' }}>
                <View style={[st.badge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
                    {sCfg.label}
                  </Text>
                </View>
                <View
                  style={[st.badge, { backgroundColor: 'rgba(255,255,255,0.2)', marginLeft: 8 }]}
                >
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
                    {assignment.totalMarks} marks
                  </Text>
                </View>
                <View
                  style={[
                    st.badge,
                    {
                      backgroundColor: isOverdue ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.2)',
                      marginLeft: 8,
                    },
                  ]}
                >
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
                    {isOverdue ? 'Overdue · ' : ''}
                    {new Date(assignment.dueDate).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Card */}
          <View style={st.card}>
            {/* Tabs */}
            <View style={st.tabRow}>
              {(['details', 'grades'] as TabKey[]).map((tab) => {
                const active = activeTab === tab;
                return (
                  <TouchableOpacity
                    key={tab}
                    onPress={() => setActiveTab(tab)}
                    activeOpacity={0.7}
                    style={[st.tabBtn, active && st.tabBtnActive]}
                  >
                    <Text style={[st.tabText, active && st.tabTextActive]}>
                      {tab === 'details' ? 'Details' : 'Grades'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 40 }}
            >
              {activeTab === 'details' ? (
                <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
                  {/* Meta */}
                  {assignment.subjectName && (
                    <MetaRow
                      icon="book"
                      color="#053495"
                      label="Subject"
                      value={assignment.subjectName}
                    />
                  )}
                  {assignment.className && (
                    <MetaRow
                      icon="people"
                      color="#008AB8"
                      label="Class"
                      value={`${assignment.className}${assignment.sectionName ? ` - ${assignment.sectionName}` : ''}`}
                    />
                  )}
                  <MetaRow
                    icon="calendar"
                    color="#d97706"
                    label="Due Date"
                    value={new Date(assignment.dueDate).toLocaleDateString('en-IN', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  />
                  <MetaRow
                    icon="ribbon"
                    color="#7c3aed"
                    label="Total Marks"
                    value={`${assignment.totalMarks}`}
                  />

                  {assignment.description && (
                    <View style={{ marginTop: 8 }}>
                      <View
                        style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}
                      >
                        <Ionicons name="reader" size={16} color="#053495" />
                        <Text
                          style={{
                            fontSize: 15,
                            fontWeight: '700',
                            color: '#042A6C',
                            marginLeft: 8,
                          }}
                        >
                          Description
                        </Text>
                      </View>
                      <Text style={{ fontSize: 14, color: '#3E5683', lineHeight: 20 }}>
                        {assignment.description}
                      </Text>
                    </View>
                  )}

                  {/* Actions */}
                  <View style={{ marginTop: 24 }}>
                    {assignment.status === 'draft' && (
                      <ActionButton
                        label="Publish Assignment"
                        icon="paper-plane"
                        color="#053495"
                        loading={publishMutation.isPending}
                        onPress={() => publishMutation.mutate()}
                      />
                    )}
                    {assignment.status === 'published' && (
                      <ActionButton
                        label="Start Grading"
                        icon="create"
                        color="#d97706"
                        loading={startGradingMutation.isPending}
                        onPress={() => startGradingMutation.mutate()}
                      />
                    )}
                    {assignment.status === 'grading' && (
                      <ActionButton
                        label="Complete Assignment"
                        icon="checkmark-done"
                        color="#16a34a"
                        loading={completeMutation.isPending}
                        onPress={() => completeMutation.mutate()}
                      />
                    )}
                  </View>
                </View>
              ) : (
                <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
                  {!canGrade ? (
                    <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                      <Ionicons name="lock-closed-outline" size={36} color="#8998B3" />
                      <Text style={{ color: '#8998B3', marginTop: 8, textAlign: 'center' }}>
                        Start grading to enter marks
                      </Text>
                    </View>
                  ) : gradesLoading ? (
                    <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                      <ActivityIndicator size="large" color="#053495" />
                    </View>
                  ) : grades.length === 0 ? (
                    <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                      <Ionicons name="people-outline" size={36} color="#8998B3" />
                      <Text style={{ color: '#8998B3', marginTop: 8 }}>No students to grade</Text>
                    </View>
                  ) : (
                    grades.map((g) => (
                      <GradeRow
                        key={g.studentId}
                        grade={{
                          ...g,
                          marksInput: gradeEdits[g.studentId]?.marks,
                          remarksInput: gradeEdits[g.studentId]?.remarks,
                        }}
                        totalMarks={assignment.totalMarks}
                        onMarksChange={(v) => updateGradeEdit(g.studentId, 'marks', v)}
                        onRemarksChange={(v) => updateGradeEdit(g.studentId, 'remarks', v)}
                        editable={assignment.status === 'grading'}
                      />
                    ))
                  )}
                </View>
              )}
            </ScrollView>

            {/* Save grades bar */}
            {activeTab === 'grades' && hasDirtyGrades && canGrade && (
              <View style={st.saveBar}>
                <TouchableOpacity
                  onPress={handleSaveGrades}
                  disabled={bulkGradeMutation.isPending}
                  activeOpacity={0.8}
                  style={st.saveBtn}
                >
                  {bulkGradeMutation.isPending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                      Save Grades
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Menu modal */}
          <Modal
            visible={menuOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setMenuOpen(false)}
          >
            <Pressable style={st.menuOverlay} onPress={() => setMenuOpen(false)}>
              <View style={[st.menuSheet, { paddingTop: insets.top + 50 }]}>
                <Pressable onPress={(e) => e.stopPropagation()}>
                  <View style={st.menuCard}>
                    {assignment.status === 'draft' && (
                      <>
                        <TouchableOpacity
                          onPress={handleEdit}
                          style={st.menuItem}
                          activeOpacity={0.6}
                        >
                          <Ionicons name="create-outline" size={20} color="#053495" />
                          <Text style={st.menuItemText}>Edit Assignment</Text>
                        </TouchableOpacity>
                        <View style={st.menuDivider} />
                      </>
                    )}
                    <TouchableOpacity
                      onPress={handleDelete}
                      style={st.menuItem}
                      activeOpacity={0.6}
                    >
                      <Ionicons name="trash-outline" size={20} color="#ef4444" />
                      <Text style={[st.menuItemText, { color: '#ef4444' }]}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </Pressable>
              </View>
            </Pressable>
          </Modal>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

function MetaRow({
  icon,
  color,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
  value: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          backgroundColor: `${color}12`,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}
      >
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <View>
        <Text style={{ fontSize: 11, color: '#8998B3', fontWeight: '500' }}>{label}</Text>
        <Text style={{ fontSize: 14, color: '#042A6C', fontWeight: '600', marginTop: 1 }}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function ActionButton({
  label,
  icon,
  color,
  loading,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  loading: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.7}
      style={{ marginBottom: 8 }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 14,
          borderRadius: 14,
          backgroundColor: `${color}12`,
          borderWidth: 1,
          borderColor: `${color}25`,
        }}
      >
        {loading ? (
          <ActivityIndicator color={color} />
        ) : (
          <>
            <Ionicons name={icon} size={18} color={color} />
            <Text style={{ color, fontWeight: '700', fontSize: 15, marginLeft: 8 }}>{label}</Text>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

const st = StyleSheet.create({
  hero: { overflow: 'hidden' },
  heroCircle: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.06)',
    top: -20,
    right: -30,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginLeft: -4 },
  backText: { color: 'rgba(255,255,255,0.9)', fontSize: 16, fontWeight: '500', marginLeft: 2 },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },

  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -16,
    paddingTop: 4,
  },
  tabRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    marginHorizontal: 4,
    backgroundColor: '#F9F8F5',
  },
  tabBtnActive: { backgroundColor: '#F0F5FE' },
  tabText: { fontSize: 13, fontWeight: '500', color: '#8998B3' },
  tabTextActive: { color: '#053495', fontWeight: '700' },

  gradeRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F9F8F5' },
  gradeAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F5FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  gradeAvatarText: { color: '#053495', fontSize: 12, fontWeight: '700' },
  gradeInput: {
    flex: 1,
    backgroundColor: '#F9F8F5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#042A6C',
    borderWidth: 1,
    borderColor: '#EDF0F3',
  },

  saveBar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#EDF0F3',
  },
  saveBtn: {
    backgroundColor: '#053495',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#053495',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },

  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  menuSheet: { position: 'absolute', top: 0, right: 16 },
  menuCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
    minWidth: 200,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  menuItemText: { fontSize: 15, fontWeight: '600', color: '#042A6C', marginLeft: 12 },
  menuDivider: { height: 1, backgroundColor: '#EDF0F3', marginHorizontal: 16 },
});

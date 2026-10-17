import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { teachingApi, TeachingClass, getSubjects } from '@/api/teaching';

interface Step {
  title: string;
  description: string;
  duration: string;
}

// ── Reusable components ──

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={s.label}>
        {label}
        {required ? ' *' : ''}
      </Text>
      {children}
    </View>
  );
}

function Dropdown({
  items,
  selectedValue,
  onSelect,
  placeholder,
  renderItem,
}: {
  items: { key: string; label: string }[];
  selectedValue: string;
  onSelect: (key: string) => void;
  placeholder: string;
  renderItem?: (item: { key: string; label: string }, selected: boolean) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const selected = items.find((i) => i.key === selectedValue);

  return (
    <View>
      <TouchableOpacity onPress={() => setOpen(!open)} activeOpacity={0.7} style={s.select}>
        <Text style={selected ? s.selectText : s.selectPlaceholder} numberOfLines={1}>
          {selected?.label || placeholder}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color="#94a3b8" />
      </TouchableOpacity>
      {open && items.length > 0 && (
        <View style={s.optionList}>
          {items.map((item) => {
            const active = item.key === selectedValue;
            return (
              <TouchableOpacity
                key={item.key}
                onPress={() => {
                  onSelect(item.key);
                  setOpen(false);
                }}
                activeOpacity={0.6}
                style={[s.option, active && s.optionActive]}
              >
                {renderItem ? (
                  renderItem(item, active)
                ) : (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text style={active ? s.optionTextActive : s.optionText}>{item.label}</Text>
                    {active && <Ionicons name="checkmark" size={16} color="#4f46e5" />}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ── Main form ──

export default function LessonPlanFormScreen() {
  const { editId, sectionId: preSelectedSectionId } = useLocalSearchParams<{
    editId?: string;
    sectionId?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const isEditing = !!editId;

  const [title, setTitle] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState(preSelectedSectionId || '');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [duration, setDuration] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [description, setDescription] = useState('');
  const [resources, setResources] = useState('');
  const [steps, setSteps] = useState<Step[]>([{ title: '', description: '', duration: '' }]);

  const { data: classes } = useQuery({
    queryKey: ['my-classes'],
    queryFn: () => teachingApi.getMyClasses(),
  });

  const { data: existingPlan } = useQuery({
    queryKey: ['lesson-plan', editId],
    queryFn: () => teachingApi.getLessonPlan(editId!),
    enabled: isEditing,
  });

  useEffect(() => {
    if (existingPlan) {
      setTitle(existingPlan.title);
      setSelectedSectionId(existingPlan.sectionId);
      setSelectedSubjectId(existingPlan.subjectId);
      setDate(new Date(existingPlan.date).toISOString().split('T')[0]);
      setDuration(existingPlan.duration?.toString() || '');
      setStatus(existingPlan.status);
      setDescription(existingPlan.description || '');
      setResources(existingPlan.resources?.join('\n') || '');
      if (existingPlan.objectives?.length) {
        setSteps(
          existingPlan.objectives.map((obj: string) => {
            const durMatch = obj.match(/\((\d+)\s*min\)$/);
            const dur = durMatch ? durMatch[1] : '';
            const noDur = durMatch ? obj.replace(/\s*\(\d+\s*min\)$/, '') : obj;
            const parts = noDur.split(' — ');
            return { title: parts[0] || obj, description: parts[1] || '', duration: dur };
          })
        );
      }
    }
  }, [existingPlan]);

  const selectedClass = classes?.find((c: TeachingClass) => c.sectionId === selectedSectionId);
  const subjects = selectedClass ? getSubjects(selectedClass) : [];

  const classItems = (classes || []).map((c: TeachingClass) => ({
    key: c.sectionId,
    label: `${c.className} — ${c.sectionName}`,
  }));
  const subjectItems = subjects.map((sub: { subjectId: string; subjectName: string }) => ({
    key: sub.subjectId,
    label: sub.subjectName,
  }));

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof teachingApi.createLessonPlan>[0]) =>
      teachingApi.createLessonPlan(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-plans'] });
      router.back();
    },
    onError: () => Alert.alert('Error', 'Failed to create lesson plan'),
  });
  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => teachingApi.updateLessonPlan(editId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-plans'] });
      queryClient.invalidateQueries({ queryKey: ['lesson-plan', editId] });
      router.back();
    },
    onError: () => Alert.alert('Error', 'Failed to update lesson plan'),
  });

  const addStep = () => setSteps((prev) => [...prev, { title: '', description: '', duration: '' }]);
  const updateStep = (i: number, u: Partial<Step>) =>
    setSteps((prev) => prev.map((step, idx) => (idx === i ? { ...step, ...u } : step)));
  const removeStep = (i: number) => setSteps((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = () => {
    if (!title.trim()) return Alert.alert('Required', 'Title is required');
    if (!selectedSectionId) return Alert.alert('Required', 'Please select a class');
    if (!selectedSubjectId) return Alert.alert('Required', 'Please select a subject');
    if (!date) return Alert.alert('Required', 'Date is required');

    const objectives = steps
      .filter((st) => st.title.trim())
      .map((st) => {
        let line = st.title.trim();
        if (st.description.trim()) line += ` — ${st.description.trim()}`;
        if (st.duration.trim()) line += ` (${st.duration} min)`;
        return line;
      });

    const data = {
      title: title.trim(),
      sectionId: selectedSectionId,
      subjectId: selectedSubjectId,
      date,
      objectives,
      description: description.trim(),
      resources: resources.split('\n').filter((r) => r.trim()),
      status,
      ...(duration ? { duration: parseInt(duration) } : {}),
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
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
        {/* Hero */}
        <View style={s.hero}>
          <View style={s.heroCircle} />
          <View style={{ paddingTop: insets.top + 8, paddingBottom: 24, paddingHorizontal: 20 }}>
            <View style={s.topBar}>
              <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={s.backBtn}>
                <Ionicons name="chevron-back" size={22} color="#fff" />
                <Text style={s.backText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSubmit} disabled={isSaving} activeOpacity={0.7}>
                {isSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <View style={s.saveChip}>
                    <Ionicons name="checkmark" size={16} color="#4f46e5" />
                    <Text
                      style={{ color: '#4f46e5', fontWeight: '700', fontSize: 14, marginLeft: 4 }}
                    >
                      Save
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
            <Text style={s.heroTitle}>{isEditing ? 'Edit Lesson Plan' : 'New Lesson Plan'}</Text>
          </View>
        </View>

        {/* Form */}
        <ScrollView
          style={s.card}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 50 }}
        >
          <View style={{ paddingHorizontal: 20 }}>
            {/* Title */}
            <Field label="Lesson Title" required>
              <TextInput
                style={s.input}
                placeholder="e.g. Introduction to Light — Reflection"
                placeholderTextColor="#c7c7cc"
                value={title}
                onChangeText={setTitle}
              />
            </Field>

            {/* Class */}
            <Field label="Class" required>
              <Dropdown
                items={classItems}
                selectedValue={selectedSectionId}
                onSelect={(key) => {
                  setSelectedSectionId(key);
                  setSelectedSubjectId('');
                }}
                placeholder="Choose a class"
              />
            </Field>

            {/* Subject */}
            <Field label="Subject" required>
              {!selectedSectionId ? (
                <View style={[s.select, { opacity: 0.5 }]}>
                  <Text style={s.selectPlaceholder}>Select a class first</Text>
                </View>
              ) : (
                <Dropdown
                  items={subjectItems}
                  selectedValue={selectedSubjectId}
                  onSelect={setSelectedSubjectId}
                  placeholder="Choose a subject"
                />
              )}
            </Field>

            {/* Date + Duration */}
            <View style={{ flexDirection: 'row', marginBottom: 20 }}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={s.label}>Date *</Text>
                <TextInput
                  style={s.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#c7c7cc"
                  value={date}
                  onChangeText={setDate}
                />
              </View>
              <View style={{ width: 100 }}>
                <Text style={s.label}>Duration</Text>
                <TextInput
                  style={s.input}
                  placeholder="45 min"
                  placeholderTextColor="#c7c7cc"
                  value={duration}
                  onChangeText={setDuration}
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Status */}
            <Field label="Status">
              <View style={s.statusRow}>
                {(['draft', 'published'] as const).map((val) => (
                  <TouchableOpacity
                    key={val}
                    onPress={() => setStatus(val)}
                    activeOpacity={0.7}
                    style={[s.statusPill, status === val && s.statusPillActive]}
                  >
                    <Ionicons
                      name={val === 'draft' ? 'document-outline' : 'checkmark-circle'}
                      size={14}
                      color={status === val ? '#4f46e5' : '#94a3b8'}
                    />
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: status === val ? '700' : '500',
                        color: status === val ? '#4f46e5' : '#64748b',
                        marginLeft: 6,
                      }}
                    >
                      {val === 'draft' ? 'Draft' : 'Published'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Field>

            {/* Divider */}
            <View style={{ height: 1, backgroundColor: '#e5e7eb', marginBottom: 20 }} />

            {/* Objectives */}
            <Field label="Lesson Objectives">
              <TextInput
                style={[s.input, { minHeight: 80 }]}
                placeholder="By the end of this lesson, students will be able to..."
                placeholderTextColor="#c7c7cc"
                value={description}
                onChangeText={setDescription}
                multiline
                textAlignVertical="top"
              />
            </Field>

            {/* Steps */}
            <View style={{ marginBottom: 20 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                }}
              >
                <Text style={[s.label, { marginBottom: 0 }]}>Step-by-Step Procedure</Text>
                <TouchableOpacity onPress={addStep} activeOpacity={0.7} style={s.addBtn}>
                  <Ionicons name="add-circle" size={16} color="#4f46e5" />
                  <Text
                    style={{ color: '#4f46e5', fontSize: 12, fontWeight: '600', marginLeft: 4 }}
                  >
                    Add Step
                  </Text>
                </TouchableOpacity>
              </View>

              {steps.map((step, idx) => (
                <View key={idx} style={s.stepCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={s.stepBadge}>
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>
                        {idx + 1}
                      </Text>
                    </View>
                    <TextInput
                      style={s.stepTitleInput}
                      placeholder="Step title"
                      placeholderTextColor="#c7c7cc"
                      value={step.title}
                      onChangeText={(v) => updateStep(idx, { title: v })}
                    />
                    <TextInput
                      style={s.stepDurInput}
                      placeholder="min"
                      placeholderTextColor="#c7c7cc"
                      value={step.duration}
                      onChangeText={(v) => updateStep(idx, { duration: v })}
                      keyboardType="numeric"
                    />
                    {steps.length > 1 && (
                      <TouchableOpacity
                        onPress={() => removeStep(idx)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={{ marginLeft: 8 }}
                      >
                        <Ionicons name="close-circle" size={20} color="#e5e7eb" />
                      </TouchableOpacity>
                    )}
                  </View>
                  <TextInput
                    style={[s.input, { minHeight: 44, marginTop: 8 }]}
                    placeholder="Describe this step..."
                    placeholderTextColor="#c7c7cc"
                    value={step.description}
                    onChangeText={(v) => updateStep(idx, { description: v })}
                    multiline
                    textAlignVertical="top"
                  />
                </View>
              ))}

              <TouchableOpacity onPress={addStep} activeOpacity={0.6} style={s.addHint}>
                <View style={s.addHintCircle}>
                  <Ionicons name="add" size={14} color="#94a3b8" />
                </View>
                <Text style={{ color: '#94a3b8', fontSize: 13 }}>Add another step</Text>
              </TouchableOpacity>
            </View>

            {/* Resources */}
            <Field label="Materials & Resources">
              <TextInput
                style={[s.input, { minHeight: 80 }]}
                placeholder="One per line — textbook, slides, videos, handouts..."
                placeholderTextColor="#c7c7cc"
                value={resources}
                onChangeText={setResources}
                multiline
                textAlignVertical="top"
              />
            </Field>

            {/* Submit */}
            <TouchableOpacity onPress={handleSubmit} disabled={isSaving} activeOpacity={0.8}>
              <View style={s.submitBtn}>
                {isSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name={isEditing ? 'save' : 'add-circle'} size={20} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16, marginLeft: 8 }}>
                      {isEditing ? 'Update Lesson Plan' : 'Create Lesson Plan'}
                    </Text>
                  </>
                )}
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  // Hero
  hero: { backgroundColor: '#4f46e5', overflow: 'hidden' },
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
    marginBottom: 12,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginLeft: -4 },
  backText: { color: 'rgba(255,255,255,0.9)', fontSize: 16, fontWeight: '500', marginLeft: 2 },
  saveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
  },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },

  // Card
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -16,
    paddingTop: 24,
  },

  // Fields
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1e293b',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },

  // Select dropdown
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  selectText: { fontSize: 15, color: '#1e293b', flex: 1 },
  selectPlaceholder: { fontSize: 15, color: '#c7c7cc', flex: 1 },

  optionList: {
    marginTop: 6,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  option: {
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  optionActive: { backgroundColor: '#eef2ff' },
  optionText: { fontSize: 15, color: '#1e293b' },
  optionTextActive: { fontSize: 15, color: '#4f46e5', fontWeight: '600' },

  // Status
  statusRow: { flexDirection: 'row', gap: 10 },
  statusPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  statusPillActive: {
    borderColor: '#4f46e5',
    backgroundColor: '#eef2ff',
  },

  // Steps
  stepCard: {
    marginBottom: 12,
    backgroundColor: '#fafafa',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  stepTitleInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
    paddingVertical: 0,
  },
  stepDurInput: {
    width: 50,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    textAlign: 'center',
    fontSize: 13,
    color: '#1e293b',
    marginLeft: 8,
  },

  addBtn: { flexDirection: 'row', alignItems: 'center' },
  addHint: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  addHintCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  // Submit
  submitBtn: {
    backgroundColor: '#4f46e5',
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
});

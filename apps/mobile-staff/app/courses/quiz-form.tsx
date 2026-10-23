import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { coursesApi, CourseQuiz } from '@campus-verse/mobile-shared';

interface Question {
  question: string;
  type: 'mcq' | 'true_false' | 'short';
  options?: string[];
  correctAnswer?: string;
  marks: number;
}

export default function QuizFormScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<Question[]>([
    { question: '', type: 'mcq', options: ['', '', '', ''], correctAnswer: '', marks: 1 },
  ]);

  const mutation = useMutation({
    mutationFn: () => {
      const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);
      return coursesApi.createQuiz(courseId as string, {
        title: title.trim(),
        description: description.trim() || undefined,
        totalMarks,
        questions: questions as CourseQuiz['questions'],
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['course-quizzes', courseId] });
      qc.invalidateQueries({ queryKey: ['course', courseId] });
      router.back();
    },
    onError: (e: Error) => Alert.alert('Failed', e.message),
  });

  const handleSubmit = () => {
    if (!title.trim()) return Alert.alert('Title is required');
    if (questions.length === 0) return Alert.alert('Add at least one question');
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question.trim()) return Alert.alert(`Question ${i + 1}: Enter question text`);
      if (q.type === 'mcq') {
        if (!q.options || q.options.filter((o) => o.trim()).length < 2) {
          return Alert.alert(`Question ${i + 1}: Add at least 2 options`);
        }
        if (!q.correctAnswer) return Alert.alert(`Question ${i + 1}: Pick a correct answer`);
      }
      if (q.type === 'true_false' && !q.correctAnswer) {
        return Alert.alert(`Question ${i + 1}: Pick true or false`);
      }
    }
    mutation.mutate();
  };

  const addQuestion = () => {
    setQuestions([
      ...questions,
      { question: '', type: 'mcq', options: ['', '', '', ''], correctAnswer: '', marks: 1 },
    ]);
  };

  const removeQuestion = (idx: number) => {
    setQuestions(questions.filter((_, i) => i !== idx));
  };

  const updateQuestion = (idx: number, patch: Partial<Question>) => {
    setQuestions(questions.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  };

  const updateOption = (qIdx: number, oIdx: number, value: string) => {
    setQuestions(
      questions.map((q, i) => {
        if (i !== qIdx) return q;
        const opts = [...(q.options || [])];
        opts[oIdx] = value;
        return { ...q, options: opts };
      })
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#F9F8F5' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={s.label}>Quiz Title</Text>
        <TextInput
          style={s.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Unit 1 Quiz"
          placeholderTextColor="#8998B3"
        />

        <Text style={s.label}>Description (optional)</Text>
        <TextInput
          style={s.textareaSmall}
          value={description}
          onChangeText={setDescription}
          placeholder="Instructions for students"
          placeholderTextColor="#8998B3"
          multiline
          textAlignVertical="top"
        />

        <Text style={[s.label, { marginTop: 20 }]}>Questions</Text>
        {questions.map((q, qIdx) => (
          <View key={qIdx} style={s.questionCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <Text style={s.qNum}>Q{qIdx + 1}</Text>
              <View style={{ flex: 1 }} />
              <View style={s.typeSwitch}>
                {(['mcq', 'true_false', 'short'] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[s.typeSwitchBtn, q.type === t && s.typeSwitchActive]}
                    onPress={() =>
                      updateQuestion(qIdx, {
                        type: t,
                        options: t === 'mcq' ? ['', '', '', ''] : undefined,
                        correctAnswer: '',
                      })
                    }
                  >
                    <Text
                      style={[
                        s.typeSwitchText,
                        q.type === t && { color: '#042A6C', fontWeight: '700' },
                      ]}
                    >
                      {t === 'mcq' ? 'MCQ' : t === 'true_false' ? 'T/F' : 'Text'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {questions.length > 1 && (
                <TouchableOpacity
                  onPress={() => removeQuestion(qIdx)}
                  hitSlop={8}
                  style={{ marginLeft: 8 }}
                >
                  <Ionicons name="trash-outline" size={16} color="#8998B3" />
                </TouchableOpacity>
              )}
            </View>

            <TextInput
              style={s.qInput}
              value={q.question}
              onChangeText={(v) => updateQuestion(qIdx, { question: v })}
              placeholder="Enter question"
              placeholderTextColor="#8998B3"
              multiline
            />

            {q.type === 'mcq' && (
              <View style={{ marginTop: 10 }}>
                {q.options?.map((opt, oIdx) => (
                  <View key={oIdx} style={s.optionRow}>
                    <TouchableOpacity
                      style={[
                        s.optionRadio,
                        q.correctAnswer === opt && opt.trim() && s.optionRadioActive,
                      ]}
                      onPress={() => opt.trim() && updateQuestion(qIdx, { correctAnswer: opt })}
                    >
                      {q.correctAnswer === opt && opt.trim() && <View style={s.optionRadioInner} />}
                    </TouchableOpacity>
                    <TextInput
                      style={s.optionInput}
                      value={opt}
                      onChangeText={(v) => updateOption(qIdx, oIdx, v)}
                      placeholder={`Option ${oIdx + 1}`}
                      placeholderTextColor="#8998B3"
                    />
                  </View>
                ))}
              </View>
            )}

            {q.type === 'true_false' && (
              <View style={{ flexDirection: 'row', marginTop: 10 }}>
                {['true', 'false'].map((v) => (
                  <TouchableOpacity
                    key={v}
                    style={[s.tfBtn, q.correctAnswer === v && s.tfBtnActive]}
                    onPress={() => updateQuestion(qIdx, { correctAnswer: v })}
                  >
                    <Text style={[s.tfText, q.correctAnswer === v && { color: '#fff' }]}>
                      {v.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
              <Text style={{ fontSize: 12, color: '#526C98', marginRight: 8 }}>Marks:</Text>
              <TextInput
                style={s.marksInput}
                value={String(q.marks)}
                onChangeText={(v) => updateQuestion(qIdx, { marks: parseInt(v) || 1 })}
                keyboardType="numeric"
              />
            </View>
          </View>
        ))}

        <TouchableOpacity style={s.addQBtn} onPress={addQuestion} activeOpacity={0.8}>
          <Ionicons name="add" size={18} color="#053495" />
          <Text style={s.addQText}>Add Question</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.submitBtn, (mutation.isPending || !title.trim()) && { opacity: 0.5 }]}
          onPress={handleSubmit}
          disabled={mutation.isPending || !title.trim()}
          activeOpacity={0.85}
        >
          {mutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.submitText}>Save Quiz</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#526C98',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 14,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: '#042A6C',
    borderWidth: 1,
    borderColor: '#DAE0E7',
  },
  textareaSmall: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: '#042A6C',
    borderWidth: 1,
    borderColor: '#DAE0E7',
    minHeight: 70,
  },
  questionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EDF0F3',
  },
  qNum: { fontSize: 13, fontWeight: '800', color: '#042A6C' },
  typeSwitch: { flexDirection: 'row', backgroundColor: '#EDF0F3', borderRadius: 8, padding: 2 },
  typeSwitchBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  typeSwitchActive: { backgroundColor: '#fff' },
  typeSwitchText: { fontSize: 10, fontWeight: '600', color: '#526C98' },
  qInput: {
    backgroundColor: '#F9F8F5',
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    color: '#042A6C',
    minHeight: 50,
  },
  optionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  optionRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#D3DAE4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  optionRadioActive: { borderColor: '#053495' },
  optionRadioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#053495' },
  optionInput: {
    flex: 1,
    backgroundColor: '#F9F8F5',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#042A6C',
  },
  tfBtn: {
    flex: 1,
    backgroundColor: '#EDF0F3',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginRight: 8,
  },
  tfBtnActive: { backgroundColor: '#053495' },
  tfText: { fontSize: 13, fontWeight: '700', color: '#526C98' },
  marksInput: {
    backgroundColor: '#F9F8F5',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 13,
    color: '#042A6C',
    width: 50,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#DAE0E7',
  },
  addQBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F5FE',
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  addQText: { fontSize: 13, fontWeight: '700', color: '#053495', marginLeft: 6 },
  submitBtn: {
    backgroundColor: '#053495',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

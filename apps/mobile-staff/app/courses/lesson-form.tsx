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
import { coursesApi } from '@campus-verse/mobile-shared';

type ContentType = 'video' | 'text' | 'pdf' | 'link';

const CONTENT_TYPES: { key: ContentType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'video', label: 'Video', icon: 'videocam-outline' },
  { key: 'text', label: 'Text', icon: 'document-text-outline' },
  { key: 'pdf', label: 'PDF', icon: 'document-outline' },
  { key: 'link', label: 'Link', icon: 'link-outline' },
];

export default function LessonFormScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [contentType, setContentType] = useState<ContentType>('text');
  const [contentUrl, setContentUrl] = useState('');
  const [contentBody, setContentBody] = useState('');
  const [duration, setDuration] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      coursesApi.createLesson(courseId as string, {
        title: title.trim(),
        description: description.trim() || undefined,
        contentType,
        contentUrl: contentUrl.trim() || undefined,
        contentBody: contentBody.trim() || undefined,
        durationMinutes: duration ? parseInt(duration) : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['course-lessons', courseId] });
      qc.invalidateQueries({ queryKey: ['course', courseId] });
      router.back();
    },
    onError: (e: Error) => Alert.alert('Failed', e.message),
  });

  const handleSubmit = () => {
    if (!title.trim()) return Alert.alert('Title is required');
    if (
      (contentType === 'video' || contentType === 'pdf' || contentType === 'link') &&
      !contentUrl.trim()
    ) {
      return Alert.alert('URL required', 'Please provide a URL for this content type.');
    }
    if (contentType === 'text' && !contentBody.trim()) {
      return Alert.alert('Content required', 'Please add text content for this lesson.');
    }
    mutation.mutate();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#F9F8F5' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={s.label}>Lesson Title</Text>
        <TextInput
          style={s.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Chapter 1: Introduction"
          placeholderTextColor="#8998B3"
          autoFocus
        />

        <Text style={s.label}>Content Type</Text>
        <View style={s.typeRow}>
          {CONTENT_TYPES.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[s.typeCard, contentType === t.key && s.typeCardActive]}
              onPress={() => setContentType(t.key)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={t.icon}
                size={22}
                color={contentType === t.key ? '#042A6C' : '#526C98'}
              />
              <Text
                style={[
                  s.typeLabel,
                  contentType === t.key && { color: '#042A6C', fontWeight: '700' },
                ]}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {contentType === 'text' ? (
          <>
            <Text style={s.label}>Content</Text>
            <TextInput
              style={s.textarea}
              value={contentBody}
              onChangeText={setContentBody}
              placeholder="Type or paste your lesson content..."
              placeholderTextColor="#8998B3"
              multiline
              textAlignVertical="top"
            />
          </>
        ) : (
          <>
            <Text style={s.label}>
              {contentType === 'link' ? 'URL' : `${contentType.toUpperCase()} URL`}
            </Text>
            <TextInput
              style={s.input}
              value={contentUrl}
              onChangeText={setContentUrl}
              placeholder="https://..."
              placeholderTextColor="#8998B3"
              autoCapitalize="none"
              keyboardType="url"
            />
          </>
        )}

        <Text style={s.label}>Description (optional)</Text>
        <TextInput
          style={s.textareaSmall}
          value={description}
          onChangeText={setDescription}
          placeholder="Short description"
          placeholderTextColor="#8998B3"
          multiline
          textAlignVertical="top"
        />

        <Text style={s.label}>Duration (minutes, optional)</Text>
        <TextInput
          style={s.input}
          value={duration}
          onChangeText={setDuration}
          placeholder="e.g. 15"
          placeholderTextColor="#8998B3"
          keyboardType="numeric"
        />

        <TouchableOpacity
          style={[s.submitBtn, (mutation.isPending || !title.trim()) && { opacity: 0.5 }]}
          onPress={handleSubmit}
          disabled={mutation.isPending || !title.trim()}
          activeOpacity={0.85}
        >
          {mutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.submitText}>Save Lesson</Text>
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
  textarea: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: '#042A6C',
    borderWidth: 1,
    borderColor: '#DAE0E7',
    minHeight: 150,
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
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  typeCard: {
    width: '23%',
    marginHorizontal: '1%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#DAE0E7',
  },
  typeCardActive: { borderColor: '#053495', backgroundColor: '#F0F5FE' },
  typeLabel: { fontSize: 11, fontWeight: '600', color: '#526C98', marginTop: 6 },
  submitBtn: {
    backgroundColor: '#053495',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

import { useState } from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { feedApi } from '@campus-verse/mobile-shared';

export default function NewPostScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const [content, setContent] = useState('');

  const mutation = useMutation({
    mutationFn: feedApi.createPost,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feed-posts'] });
      router.back();
    },
    onError: (e: Error) => Alert.alert('Post failed', e.message),
  });

  const handleSubmit = () => {
    if (!content.trim()) return Alert.alert('Write something first');
    if (content.length > 5000) return Alert.alert('Post is too long (max 5000 chars)');
    mutation.mutate({ content: content.trim(), audience: 'everyone', postType: 'post' });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#F9F8F5' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <TextInput
          style={s.textarea}
          value={content}
          onChangeText={setContent}
          placeholder="Share something with your campus..."
          placeholderTextColor="#8998B3"
          multiline
          numberOfLines={10}
          textAlignVertical="top"
          maxLength={5000}
          autoFocus
        />
        <Text style={s.counter}>{content.length}/5000</Text>

        <TouchableOpacity
          style={[s.submitBtn, (mutation.isPending || !content.trim()) && { opacity: 0.5 }]}
          onPress={handleSubmit}
          disabled={mutation.isPending || !content.trim()}
          activeOpacity={0.85}
        >
          {mutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.submitText}>Publish</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  textarea: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#DAE0E7',
    fontSize: 15,
    color: '#042A6C',
    minHeight: 200,
  },
  counter: { fontSize: 11, color: '#8998B3', textAlign: 'right', marginTop: 4 },
  submitBtn: {
    backgroundColor: '#053495',
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 20,
    alignItems: 'center',
  },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

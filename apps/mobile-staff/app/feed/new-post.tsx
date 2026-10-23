import { useState } from 'react';
import {
  View,
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
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { feedApi } from '@campus-verse/mobile-shared';

type Audience = 'everyone' | 'staff_only' | 'students_only';
type PostType = 'post' | 'notice';

const AUDIENCES: { key: Audience; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'everyone', label: 'Everyone', icon: 'globe-outline' },
  { key: 'staff_only', label: 'Staff only', icon: 'briefcase-outline' },
  { key: 'students_only', label: 'Students only', icon: 'school-outline' },
];

export default function NewPostScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const [content, setContent] = useState('');
  const [audience, setAudience] = useState<Audience>('everyone');
  const [postType, setPostType] = useState<PostType>('post');

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
    mutation.mutate({ content: content.trim(), audience, postType });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#F9F8F5' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Post type toggle */}
        <View style={s.typeRow}>
          {(['post', 'notice'] as PostType[]).map((t) => (
            <TouchableOpacity
              key={t}
              style={[s.typeChip, postType === t && s.typeChipActive]}
              onPress={() => setPostType(t)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={t === 'post' ? 'chatbubble-outline' : 'megaphone-outline'}
                size={14}
                color={postType === t ? '#fff' : '#526C98'}
              />
              <Text style={[s.typeChipText, postType === t && { color: '#fff' }]}>
                {t === 'post' ? 'Post' : 'Notice'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content */}
        <TextInput
          style={s.textarea}
          value={content}
          onChangeText={setContent}
          placeholder={
            postType === 'notice' ? 'Share an important notice...' : "What's on your mind?"
          }
          placeholderTextColor="#8998B3"
          multiline
          numberOfLines={8}
          textAlignVertical="top"
          maxLength={5000}
        />
        <Text style={s.counter}>{content.length}/5000</Text>

        {/* Audience */}
        <Text style={s.label}>Audience</Text>
        {AUDIENCES.map((a) => (
          <TouchableOpacity
            key={a.key}
            style={[s.audienceRow, audience === a.key && s.audienceRowActive]}
            onPress={() => setAudience(a.key)}
            activeOpacity={0.8}
          >
            <View style={[s.audienceIcon, audience === a.key && { backgroundColor: '#F0F5FE' }]}>
              <Ionicons
                name={a.icon}
                size={18}
                color={audience === a.key ? '#053495' : '#526C98'}
              />
            </View>
            <Text
              style={[
                s.audienceLabel,
                audience === a.key && { color: '#053495', fontWeight: '700' },
              ]}
            >
              {a.label}
            </Text>
            {audience === a.key && (
              <Ionicons
                name="checkmark-circle"
                size={20}
                color="#053495"
                style={{ marginLeft: 'auto' }}
              />
            )}
          </TouchableOpacity>
        ))}

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
  typeRow: { flexDirection: 'row', marginBottom: 14 },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    marginRight: 8,
    backgroundColor: '#EDF0F3',
  },
  typeChipActive: { backgroundColor: '#053495' },
  typeChipText: { fontSize: 12, fontWeight: '600', color: '#526C98', marginLeft: 6 },
  textarea: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#DAE0E7',
    fontSize: 15,
    color: '#042A6C',
    minHeight: 150,
  },
  counter: { fontSize: 11, color: '#8998B3', textAlign: 'right', marginTop: 4 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#526C98',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 10,
  },
  audienceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: '#DAE0E7',
  },
  audienceRowActive: { borderColor: '#053495', backgroundColor: '#F9F8F5' },
  audienceIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EDF0F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audienceLabel: { fontSize: 14, color: '#042A6C', marginLeft: 12 },
  submitBtn: {
    backgroundColor: '#053495',
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 20,
    alignItems: 'center',
  },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

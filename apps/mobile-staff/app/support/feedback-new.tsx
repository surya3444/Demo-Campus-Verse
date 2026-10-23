import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Switch,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { feedbackApi } from '@campus-verse/mobile-shared';
import type { FeedbackCategory, FeedbackPriority } from '@campus-verse/mobile-shared';

const CATEGORIES: Array<{
  key: FeedbackCategory;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { key: 'academic', label: 'Academic', icon: 'school-outline' },
  { key: 'infrastructure', label: 'Infrastructure', icon: 'business-outline' },
  { key: 'hostel', label: 'Hostel', icon: 'bed-outline' },
  { key: 'finance', label: 'Finance', icon: 'cash-outline' },
  { key: 'hr', label: 'HR', icon: 'people-outline' },
  { key: 'safety', label: 'Safety', icon: 'shield-outline' },
  { key: 'harassment', label: 'Harassment', icon: 'warning-outline' },
  { key: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline' },
];

const PRIORITIES: Array<{ key: FeedbackPriority; label: string; color: string }> = [
  { key: 'low', label: 'Low', color: '#10b981' },
  { key: 'medium', label: 'Medium', color: '#f59e0b' },
  { key: 'high', label: 'High', color: '#f97316' },
  { key: 'urgent', label: 'Urgent', color: '#ef4444' },
];

export default function FeedbackNewScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<FeedbackCategory | ''>('');
  const [priority, setPriority] = useState<FeedbackPriority>('medium');
  const [isAnonymous, setIsAnonymous] = useState(false);

  const mutation = useMutation({
    mutationFn: feedbackApi.createTicket,
    onSuccess: (ticket) => {
      qc.invalidateQueries({ queryKey: ['feedback-tickets'] });
      Alert.alert('Submitted', `Ticket #${ticket.ticketNumber} has been submitted.`, [
        { text: 'OK', onPress: () => router.replace('/support/feedback' as never) },
      ]);
    },
    onError: (e: Error) => Alert.alert('Submission failed', e.message),
  });

  const handleSubmit = () => {
    if (!subject.trim()) return Alert.alert('Subject is required');
    if (!description.trim()) return Alert.alert('Description is required');
    if (!category) return Alert.alert('Pick a category');

    mutation.mutate({
      subject: subject.trim(),
      description: description.trim(),
      category: category as FeedbackCategory,
      priority,
      isAnonymous,
    });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#F9F8F5' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        <Text style={s.label}>Subject</Text>
        <TextInput
          style={s.input}
          value={subject}
          onChangeText={setSubject}
          placeholder="Briefly describe your concern"
          placeholderTextColor="#8998B3"
          maxLength={200}
        />

        <Text style={s.label}>Category</Text>
        <View style={s.grid}>
          {CATEGORIES.map((c) => {
            const active = category === c.key;
            return (
              <TouchableOpacity
                key={c.key}
                style={[s.catCard, active && s.catCardActive]}
                onPress={() => setCategory(c.key)}
                activeOpacity={0.8}
              >
                <Ionicons name={c.icon} size={18} color={active ? '#053495' : '#526C98'} />
                <Text style={[s.catText, active && s.catTextActive]}>{c.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={s.label}>Priority</Text>
        <View style={s.pRow}>
          {PRIORITIES.map((p) => {
            const active = priority === p.key;
            return (
              <TouchableOpacity
                key={p.key}
                onPress={() => setPriority(p.key)}
                style={[s.pChip, active && { backgroundColor: p.color, borderColor: p.color }]}
                activeOpacity={0.8}
              >
                <Text style={[s.pText, active && { color: '#fff' }]}>{p.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={s.label}>Description</Text>
        <TextInput
          style={s.textarea}
          value={description}
          onChangeText={setDescription}
          placeholder="Provide details so we can help resolve this..."
          placeholderTextColor="#8998B3"
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          maxLength={5000}
        />
        <Text style={s.charCount}>{description.length}/5000</Text>

        <View style={s.anonRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.anonTitle}>Submit anonymously</Text>
            <Text style={s.anonDesc}>
              Your name will be hidden from reviewers other than the owner.
            </Text>
          </View>
          <Switch
            value={isAnonymous}
            onValueChange={setIsAnonymous}
            trackColor={{ false: '#DAE0E7', true: '#84AFFB' }}
            thumbColor={isAnonymous ? '#053495' : '#F9F8F5'}
          />
        </View>

        <TouchableOpacity
          style={[s.submitBtn, mutation.isPending && { opacity: 0.5 }]}
          onPress={handleSubmit}
          disabled={mutation.isPending}
          activeOpacity={0.85}
        >
          <Text style={s.submitText}>{mutation.isPending ? 'Submitting...' : 'Submit Ticket'}</Text>
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
    marginTop: 18,
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  catCard: {
    width: '48%',
    marginHorizontal: '1%',
    marginBottom: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: '#DAE0E7',
  },
  catCardActive: { borderColor: '#053495', backgroundColor: '#F0F5FE' },
  catText: { fontSize: 13, fontWeight: '600', color: '#3E5683' },
  catTextActive: { color: '#042A6C' },
  pRow: { flexDirection: 'row', gap: 8 },
  pChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#DAE0E7',
    alignItems: 'center',
  },
  pText: { fontSize: 13, fontWeight: '700', color: '#3E5683' },
  textarea: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#DAE0E7',
    fontSize: 14,
    color: '#042A6C',
    minHeight: 140,
  },
  charCount: { fontSize: 11, color: '#8998B3', textAlign: 'right', marginTop: 4 },
  anonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#DAE0E7',
  },
  anonTitle: { fontSize: 14, fontWeight: '700', color: '#042A6C' },
  anonDesc: { fontSize: 12, color: '#526C98', marginTop: 2, lineHeight: 16 },
  submitBtn: {
    backgroundColor: '#053495',
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 24,
    alignItems: 'center',
    shadowColor: '#053495',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

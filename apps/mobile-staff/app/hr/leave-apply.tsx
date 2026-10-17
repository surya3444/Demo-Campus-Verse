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
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { hrApi } from '@campus-verse/mobile-shared';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function today() {
  return new Date().toISOString().split('T')[0];
}

function daysBetween(fromIso: string, toIso: string) {
  if (!DATE_RE.test(fromIso) || !DATE_RE.test(toIso)) return 0;
  const f = new Date(fromIso + 'T00:00:00');
  const t = new Date(toIso + 'T00:00:00');
  const ms = t.getTime() - f.getTime();
  if (ms < 0) return 0;
  return Math.round(ms / (1000 * 60 * 60 * 24)) + 1;
}

export default function LeaveApplyScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const [leaveType, setLeaveType] = useState('');
  const [fromDate, setFromDate] = useState(today());
  const [toDate, setToDate] = useState(today());
  const [reason, setReason] = useState('');

  const { data: balance } = useQuery({
    queryKey: ['leave-balance'],
    queryFn: () => hrApi.getLeaveBalance(),
  });

  const mutation = useMutation({
    mutationFn: hrApi.applyLeave,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-leaves'] });
      qc.invalidateQueries({ queryKey: ['leave-balance'] });
      Alert.alert('Submitted', 'Your leave request has been submitted for approval.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (e: Error) => Alert.alert('Submission failed', e.message),
  });

  const handleSubmit = () => {
    if (!leaveType) return Alert.alert('Pick a leave type');
    if (!DATE_RE.test(fromDate)) return Alert.alert('Invalid from date', 'Use YYYY-MM-DD');
    if (!DATE_RE.test(toDate)) return Alert.alert('Invalid to date', 'Use YYYY-MM-DD');
    if (toDate < fromDate) return Alert.alert('End date must be after start date');
    if (!reason.trim()) return Alert.alert('Please add a reason');

    mutation.mutate({
      leaveType,
      fromDate,
      toDate,
      reason: reason.trim(),
    });
  };

  const days = daysBetween(fromDate, toDate);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#f8fafc' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={s.label}>Leave Type</Text>
        <View style={s.typeGrid}>
          {balance?.map((b) => (
            <TouchableOpacity
              key={b.leaveType}
              style={[s.typeCard, leaveType === b.leaveType && s.typeCardActive]}
              onPress={() => setLeaveType(b.leaveType)}
              activeOpacity={0.8}
            >
              <Text style={[s.typeName, leaveType === b.leaveType && s.typeNameActive]}>
                {b.leaveTypeName || b.leaveType}
              </Text>
              <Text style={[s.typeBal, leaveType === b.leaveType && s.typeBalActive]}>
                {b.remaining} left
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.label}>From Date</Text>
        <TextInput
          style={s.input}
          value={fromDate}
          onChangeText={setFromDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#94a3b8"
        />

        <Text style={s.label}>To Date</Text>
        <TextInput
          style={s.input}
          value={toDate}
          onChangeText={setToDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#94a3b8"
        />

        {days > 0 && (
          <View style={s.daysBanner}>
            <Text style={s.daysText}>
              Total days: <Text style={{ fontWeight: '800' }}>{days}</Text>
            </Text>
          </View>
        )}

        <Text style={s.label}>Reason</Text>
        <TextInput
          style={s.textarea}
          value={reason}
          onChangeText={setReason}
          placeholder="Brief reason for your leave..."
          placeholderTextColor="#94a3b8"
          multiline
          numberOfLines={5}
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[s.submitBtn, mutation.isPending && { opacity: 0.5 }]}
          onPress={handleSubmit}
          disabled={mutation.isPending}
          activeOpacity={0.85}
        >
          <Text style={s.submitText}>
            {mutation.isPending ? 'Submitting...' : 'Submit Request'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 18,
    marginBottom: 8,
  },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  typeCard: {
    width: '48%',
    marginHorizontal: '1%',
    marginBottom: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  typeCardActive: { borderColor: '#4f46e5', backgroundColor: '#eef2ff' },
  typeName: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
  typeNameActive: { color: '#4338ca' },
  typeBal: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  typeBalActive: { color: '#6366f1' },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: '#1e293b',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  daysBanner: {
    backgroundColor: '#eef2ff',
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
    alignItems: 'center',
  },
  daysText: { fontSize: 14, color: '#4338ca', fontWeight: '600' },
  textarea: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    fontSize: 14,
    color: '#1e293b',
    minHeight: 100,
  },
  submitBtn: {
    backgroundColor: '#4f46e5',
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 24,
    alignItems: 'center',
    shadowColor: '#4f46e5',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

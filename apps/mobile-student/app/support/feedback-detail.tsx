import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { feedbackApi, useAuthStore } from '@campus-verse/mobile-shared';
import type { FeedbackStatus, FeedbackResponse } from '@campus-verse/mobile-shared';

const STATUS_COLORS: Record<
  FeedbackStatus,
  { bg: string; fg: string; icon: keyof typeof Ionicons.glyphMap; label: string }
> = {
  open: { bg: '#dbeafe', fg: '#1e40af', icon: 'mail-open-outline', label: 'Open' },
  in_progress: { bg: '#fef3c7', fg: '#92400e', icon: 'time-outline', label: 'In Progress' },
  escalated: { bg: '#fee2e2', fg: '#991b1b', icon: 'alert-circle-outline', label: 'Escalated' },
  resolved: { bg: '#dcfce7', fg: '#166534', icon: 'checkmark-circle', label: 'Resolved' },
  reopened: { bg: '#fef9c3', fg: '#854d0e', icon: 'refresh-outline', label: 'Reopened' },
  closed: { bg: '#f1f5f9', fg: '#475569', icon: 'lock-closed-outline', label: 'Closed' },
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function FeedbackDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const currentUserId = useAuthStore((state) => state.user?._id);
  const [reply, setReply] = useState('');
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState('');

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['feedback-ticket', id],
    queryFn: () => feedbackApi.getTicket(id!),
    enabled: !!id,
  });

  const replyMutation = useMutation({
    mutationFn: (message: string) => feedbackApi.addResponse(id!, { message }),
    onSuccess: () => {
      setReply('');
      qc.invalidateQueries({ queryKey: ['feedback-ticket', id] });
      qc.invalidateQueries({ queryKey: ['feedback-tickets'] });
    },
    onError: (e: Error) => Alert.alert('Reply failed', e.message),
  });

  const reopenMutation = useMutation({
    mutationFn: () => feedbackApi.updateStatus(id!, { status: 'reopened' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feedback-ticket', id] });
      qc.invalidateQueries({ queryKey: ['feedback-tickets'] });
    },
    onError: (e: Error) => Alert.alert('Reopen failed', e.message),
  });

  const satisfactionMutation = useMutation({
    mutationFn: () =>
      feedbackApi.submitSatisfaction(id!, {
        rating,
        comment: ratingComment.trim() || undefined,
      }),
    onSuccess: () => {
      setRating(0);
      setRatingComment('');
      qc.invalidateQueries({ queryKey: ['feedback-ticket', id] });
      Alert.alert('Thank you', 'Your feedback has been recorded.');
    },
    onError: (e: Error) => Alert.alert('Submission failed', e.message),
  });

  if (isLoading || !ticket) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f8fafc', justifyContent: 'center' }}>
        <ActivityIndicator color="#3b82f6" />
      </View>
    );
  }

  const statusColors = STATUS_COLORS[ticket.status];
  const isSubmitter = currentUserId && ticket.submittedBy === currentUserId;
  const isClosed = ticket.status === 'closed';
  const canReply = !isClosed;
  const canReopen = isSubmitter && ticket.status === 'resolved';
  const canRate = isSubmitter && ticket.status === 'resolved' && !ticket.satisfaction;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#f8fafc' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={s.headerCard}>
          <View style={s.rowBetween}>
            <Text style={s.ticketNum}>#{ticket.ticketNumber}</Text>
            <View style={[s.statusPill, { backgroundColor: statusColors.bg }]}>
              <Ionicons name={statusColors.icon} size={12} color={statusColors.fg} />
              <Text style={[s.statusText, { color: statusColors.fg }]}>{statusColors.label}</Text>
            </View>
          </View>
          <Text style={s.subject}>{ticket.subject}</Text>

          <View style={s.metaRow}>
            <View style={s.metaPill}>
              <Ionicons name="pricetag-outline" size={12} color="#64748b" />
              <Text style={s.metaText}>{ticket.category}</Text>
            </View>
            <View style={s.metaPill}>
              <Ionicons name="flag-outline" size={12} color="#64748b" />
              <Text style={s.metaText}>{ticket.priority}</Text>
            </View>
            {ticket.isAnonymous && (
              <View style={s.metaPill}>
                <Ionicons name="eye-off-outline" size={12} color="#64748b" />
                <Text style={s.metaText}>Anonymous</Text>
              </View>
            )}
          </View>

          <Text style={s.description}>{ticket.description}</Text>

          <View style={s.footer}>
            <Text style={s.footerText}>
              Submitted by {ticket.submitterName} · {formatDateTime(ticket.createdAt)}
            </Text>
            {ticket.assignedToName && (
              <Text style={s.footerText}>Assigned to {ticket.assignedToName}</Text>
            )}
          </View>
        </View>

        {ticket.resolutionNote && (
          <View style={s.resolutionCard}>
            <View style={s.rowCenter}>
              <Ionicons name="checkmark-circle" size={16} color="#166534" />
              <Text style={s.resolutionTitle}>Resolution</Text>
            </View>
            <Text style={s.resolutionBody}>{ticket.resolutionNote}</Text>
          </View>
        )}

        {ticket.satisfaction && (
          <View style={s.satCard}>
            <Text style={s.satTitle}>Your rating</Text>
            <View style={s.starRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Ionicons
                  key={n}
                  name={n <= ticket.satisfaction!.rating ? 'star' : 'star-outline'}
                  size={22}
                  color="#f59e0b"
                />
              ))}
            </View>
            {ticket.satisfaction.comment && (
              <Text style={s.satComment}>{ticket.satisfaction.comment}</Text>
            )}
          </View>
        )}

        {canRate && (
          <View style={s.card}>
            <Text style={s.sectionTitle}>Rate resolution</Text>
            <View style={s.starRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity key={n} onPress={() => setRating(n)} activeOpacity={0.7}>
                  <Ionicons
                    name={n <= rating ? 'star' : 'star-outline'}
                    size={32}
                    color="#f59e0b"
                  />
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={s.textarea}
              value={ratingComment}
              onChangeText={setRatingComment}
              placeholder="Optional comment..."
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              maxLength={1000}
            />
            <TouchableOpacity
              style={[
                s.primaryBtn,
                (rating === 0 || satisfactionMutation.isPending) && { opacity: 0.5 },
              ]}
              disabled={rating === 0 || satisfactionMutation.isPending}
              onPress={() => satisfactionMutation.mutate()}
              activeOpacity={0.85}
            >
              <Text style={s.primaryBtnText}>
                {satisfactionMutation.isPending ? 'Submitting...' : 'Submit Rating'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={[s.sectionTitle, { marginTop: 24, paddingHorizontal: 4 }]}>
          Responses ({ticket.responses.length})
        </Text>
        {ticket.responses.length === 0 ? (
          <View style={s.emptyCard}>
            <Ionicons name="chatbubble-ellipses-outline" size={24} color="#cbd5e1" />
            <Text style={s.emptyText}>No responses yet</Text>
          </View>
        ) : (
          ticket.responses.map((r: FeedbackResponse) => (
            <View key={r._id} style={s.responseCard}>
              <View style={s.rowBetween}>
                <Text style={s.respName}>{r.respondedByName}</Text>
                <Text style={s.respTime}>{formatDateTime(r.createdAt)}</Text>
              </View>
              <Text style={s.respMessage}>{r.message}</Text>
            </View>
          ))
        )}

        {canReopen && (
          <TouchableOpacity
            style={s.reopenBtn}
            onPress={() => reopenMutation.mutate()}
            disabled={reopenMutation.isPending}
            activeOpacity={0.85}
          >
            <Ionicons name="refresh" size={16} color="#854d0e" />
            <Text style={s.reopenText}>
              {reopenMutation.isPending ? 'Reopening...' : 'Reopen ticket'}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {canReply && (
        <View style={s.replyBar}>
          <TextInput
            style={s.replyInput}
            value={reply}
            onChangeText={setReply}
            placeholder="Add a response..."
            placeholderTextColor="#94a3b8"
            multiline
            maxLength={5000}
          />
          <TouchableOpacity
            style={[s.sendBtn, (!reply.trim() || replyMutation.isPending) && { opacity: 0.5 }]}
            disabled={!reply.trim() || replyMutation.isPending}
            onPress={() => replyMutation.mutate(reply.trim())}
            activeOpacity={0.85}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#eef0f4',
  },
  ticketNum: { fontSize: 11, fontWeight: '700', color: '#94a3b8', letterSpacing: 0.5 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusText: { fontSize: 10, fontWeight: '700', marginLeft: 4 },
  subject: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginTop: 8, lineHeight: 24 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  metaText: { fontSize: 11, color: '#475569', fontWeight: '600', textTransform: 'capitalize' },
  description: {
    fontSize: 14,
    color: '#334155',
    marginTop: 12,
    lineHeight: 20,
  },
  footer: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  footerText: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  resolutionCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  resolutionTitle: { fontSize: 13, fontWeight: '700', color: '#166534' },
  resolutionBody: { fontSize: 13, color: '#14532d', marginTop: 6, lineHeight: 18 },
  satCard: {
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  satTitle: { fontSize: 13, fontWeight: '700', color: '#92400e' },
  starRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  satComment: { fontSize: 13, color: '#78350f', marginTop: 8, lineHeight: 18 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#eef0f4',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  textarea: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    fontSize: 13,
    color: '#1e293b',
    minHeight: 60,
    marginTop: 12,
  },
  primaryBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eef0f4',
  },
  emptyText: { fontSize: 12, color: '#94a3b8', marginTop: 6 },
  responseCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eef0f4',
  },
  respName: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
  respTime: { fontSize: 11, color: '#94a3b8' },
  respMessage: { fontSize: 13, color: '#334155', marginTop: 6, lineHeight: 18 },
  reopenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fef9c3',
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  reopenText: { fontSize: 13, fontWeight: '700', color: '#854d0e' },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 8,
  },
  replyInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1e293b',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    maxHeight: 120,
    minHeight: 40,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

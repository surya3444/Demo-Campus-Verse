import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { useLiveClassSocket } from '../../hooks/useLiveClassSocket';

type Socket = ReturnType<typeof useLiveClassSocket>;

export function LiveClassChatPanel({ socket }: { socket: Socket }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [socket.messages.length]);

  const send = async () => {
    const value = text.trim();
    if (!value) return;
    setSending(true);
    const r = await socket.sendChat(value);
    setSending(false);
    if (!r.ok) {
      Alert.alert(
        'Could not send',
        r.error === 'RATE_LIMITED' ? 'Slow down — too many messages.' : 'Failed to send'
      );
      return;
    }
    setText('');
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      <ScrollView ref={scrollRef} contentContainerStyle={s.scroll}>
        {socket.messages.length === 0 ? (
          <Text style={s.empty}>No messages yet — say hello!</Text>
        ) : (
          socket.messages.map((m) => {
            const isStaff = m.senderRole === 'host' || m.senderRole === 'cohost';
            return (
              <View key={m._id} style={s.msg}>
                <View style={s.msgHeader}>
                  <Text style={[s.msgAuthor, isStaff && { color: '#4f46e5' }]}>{m.senderName}</Text>
                  {isStaff && (
                    <View style={s.roleTag}>
                      <Text style={s.roleTagText}>{m.senderRole}</Text>
                    </View>
                  )}
                  <Text style={s.msgTime}>
                    {new Date(m.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
                <Text style={s.msgText}>{m.text}</Text>
              </View>
            );
          })
        )}
      </ScrollView>
      <View style={s.composer}>
        <TextInput
          style={s.input}
          placeholder={socket.joined ? 'Send a message…' : 'Connecting…'}
          placeholderTextColor="#9ca3af"
          editable={socket.joined}
          value={text}
          onChangeText={setText}
          multiline
          onSubmitEditing={send}
        />
        <TouchableOpacity
          style={[s.sendBtn, (!socket.joined || !text.trim() || sending) && { opacity: 0.4 }]}
          onPress={send}
          disabled={!socket.joined || !text.trim() || sending}
        >
          <Ionicons name="send" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  scroll: { padding: 12, paddingBottom: 16 },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 30, fontSize: 13 },
  msg: { marginBottom: 12 },
  msgHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  msgAuthor: { fontSize: 12, fontWeight: '700', color: '#111827' },
  roleTag: {
    backgroundColor: '#eef2ff',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  roleTagText: { fontSize: 9, fontWeight: '700', color: '#4f46e5', textTransform: 'uppercase' },
  msgTime: { fontSize: 10, color: '#9ca3af', marginLeft: 'auto' },
  msgText: { fontSize: 14, color: '#1f2937', lineHeight: 19 },
  composer: {
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#fff',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    minHeight: 38,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#f9fafb',
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

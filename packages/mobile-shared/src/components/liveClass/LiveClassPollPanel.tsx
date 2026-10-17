import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  TextInput,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { useLiveClassSocket } from '../../hooks/useLiveClassSocket';

type Socket = ReturnType<typeof useLiveClassSocket>;

export function LiveClassPollPanel({ socket, isHost }: { socket: Socket; isHost: boolean }) {
  if (socket.currentPoll) return <ActivePoll socket={socket} isHost={isHost} />;
  if (socket.lastResults) return <Results socket={socket} isHost={isHost} />;
  if (isHost) return <Launcher socket={socket} />;
  return (
    <View style={s.empty}>
      <Ionicons name="bar-chart-outline" size={36} color="#cbd5e1" />
      <Text style={s.emptyText}>Waiting for the host to launch a poll</Text>
    </View>
  );
}

function Launcher({ socket }: { socket: Socket }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<{ text: string; isCorrect: boolean }[]>([
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
  ]);
  const [duration, setDuration] = useState(30);
  const [busy, setBusy] = useState(false);

  const update = (i: number, patch: Partial<{ text: string; isCorrect: boolean }>) => {
    setOptions((o) => o.map((opt, idx) => (idx === i ? { ...opt, ...patch } : opt)));
  };

  const launch = async () => {
    const cleaned = options
      .map((o) => ({ text: o.text.trim(), isCorrect: o.isCorrect }))
      .filter((o) => o.text);
    if (!question.trim() || cleaned.length < 2) {
      Alert.alert('Invalid poll', 'Add a question and at least 2 options.');
      return;
    }
    setBusy(true);
    const r = await socket.launchPoll({
      question: question.trim(),
      options: cleaned,
      type: 'single',
      durationSec: duration,
    });
    setBusy(false);
    if (!r.ok) {
      Alert.alert('Failed', r.error || 'Could not launch poll');
      return;
    }
    setQuestion('');
    setOptions([
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Text style={s.label}>Question</Text>
      <TextInput
        style={s.input}
        value={question}
        onChangeText={setQuestion}
        placeholder="e.g. What's 2 + 2?"
        placeholderTextColor="#9ca3af"
      />
      <Text style={[s.label, { marginTop: 14 }]}>Options (toggle correct answers)</Text>
      {options.map((o, i) => (
        <View key={i} style={s.optRow}>
          <Switch
            value={o.isCorrect}
            onValueChange={(v) => update(i, { isCorrect: v })}
            trackColor={{ true: '#10b981', false: '#e5e7eb' }}
          />
          <TextInput
            style={[s.input, { flex: 1, marginLeft: 8 }]}
            value={o.text}
            onChangeText={(v) => update(i, { text: v })}
            placeholder={`Option ${i + 1}`}
            placeholderTextColor="#9ca3af"
          />
          {options.length > 2 && (
            <TouchableOpacity
              style={s.delBtn}
              onPress={() => setOptions((o) => o.filter((_, idx) => idx !== i))}
            >
              <Ionicons name="trash-outline" size={16} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>
      ))}
      {options.length < 8 && (
        <TouchableOpacity
          style={s.addBtn}
          onPress={() => setOptions((o) => [...o, { text: '', isCorrect: false }])}
        >
          <Ionicons name="add" size={18} color="#4f46e5" />
          <Text style={{ color: '#4f46e5', fontWeight: '600' }}>Add option</Text>
        </TouchableOpacity>
      )}

      <Text style={[s.label, { marginTop: 14 }]}>Duration (seconds)</Text>
      <TextInput
        style={s.input}
        value={String(duration)}
        onChangeText={(v) => setDuration(Math.max(5, Math.min(600, parseInt(v) || 30)))}
        keyboardType="numeric"
      />
      <TouchableOpacity
        style={[s.launchBtn, busy && { opacity: 0.6 }]}
        onPress={launch}
        disabled={busy}
      >
        <Text style={s.launchText}>{busy ? 'Launching…' : 'Launch poll'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function ActivePoll({ socket, isHost }: { socket: Socket; isHost: boolean }) {
  const poll = socket.currentPoll!;
  const [selected, setSelected] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const remaining = Math.max(0, Math.floor((new Date(poll.closesAt).getTime() - now) / 1000));

  const toggle = (idx: number) => {
    if (submitted || isHost) return;
    if (poll.type === 'single') setSelected([idx]);
    else setSelected((sel) => (sel.includes(idx) ? sel.filter((x) => x !== idx) : [...sel, idx]));
  };

  const submit = async () => {
    if (selected.length === 0) return;
    const r = await socket.respondPoll(poll.pollId, selected);
    if (!r.ok) {
      Alert.alert('Failed', r.error || 'Could not submit');
      return;
    }
    setSubmitted(true);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <View style={s.timerRow}>
        <Text style={s.liveTag}>LIVE POLL</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="timer-outline" size={14} color="#374151" />
          <Text style={{ fontVariant: ['tabular-nums'], fontWeight: '600' }}>{remaining}s</Text>
        </View>
      </View>
      <Text style={s.question}>{poll.question}</Text>
      {poll.options.map((o, i) => {
        const isPicked = selected.includes(i);
        return (
          <TouchableOpacity
            key={i}
            style={[
              s.optBox,
              isPicked && { borderColor: '#4f46e5', backgroundColor: '#eef2ff' },
              (submitted || remaining === 0 || isHost) && { opacity: 0.5 },
            ]}
            onPress={() => toggle(i)}
            disabled={submitted || remaining === 0 || isHost}
          >
            <Text style={s.optText}>{o.text}</Text>
          </TouchableOpacity>
        );
      })}
      {!isHost && !submitted && remaining > 0 && (
        <TouchableOpacity
          style={[s.launchBtn, selected.length === 0 && { opacity: 0.5 }]}
          onPress={submit}
          disabled={selected.length === 0}
        >
          <Text style={s.launchText}>Submit answer</Text>
        </TouchableOpacity>
      )}
      {isHost && (
        <TouchableOpacity
          style={[s.launchBtn, { backgroundColor: '#dc2626' }]}
          onPress={() => socket.closePoll(poll.pollId)}
        >
          <Text style={s.launchText}>Close poll now</Text>
        </TouchableOpacity>
      )}
      {submitted && (
        <Text style={{ textAlign: 'center', color: '#9ca3af', marginTop: 12, fontSize: 12 }}>
          Answer submitted. Results show when the poll closes.
        </Text>
      )}
    </ScrollView>
  );
}

function Results({ socket }: { socket: Socket; isHost: boolean }) {
  const r = socket.lastResults!;
  const max = Math.max(1, ...r.results.map((o) => o.count));
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Text style={s.resultsHead}>
        Results · {r.totalResponses} response{r.totalResponses === 1 ? '' : 's'}
      </Text>
      {r.results.map((o, i) => {
        const pct = (o.count / max) * 100;
        return (
          <View key={i} style={{ marginBottom: 14 }}>
            <View
              style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}
            >
              <Text style={[s.optText, o.isCorrect && { color: '#16a34a', fontWeight: '700' }]}>
                {o.text} {o.isCorrect ? '✓' : ''}
              </Text>
              <Text style={{ color: '#6b7280' }}>{o.count}</Text>
            </View>
            <View style={s.bar}>
              <View
                style={[
                  s.barFill,
                  { width: `${pct}%`, backgroundColor: o.isCorrect ? '#10b981' : '#4f46e5' },
                ]}
              />
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  emptyText: { color: '#6b7280', marginTop: 12, fontSize: 13, textAlign: 'center' },
  label: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#fff',
  },
  optRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  delBtn: { padding: 6 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 8,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    borderStyle: 'dashed',
  },
  launchBtn: {
    backgroundColor: '#4f46e5',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  launchText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  timerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  liveTag: { fontSize: 11, fontWeight: '800', color: '#4f46e5', letterSpacing: 1 },
  question: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 14 },
  optBox: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  optText: { fontSize: 14, color: '#1f2937' },
  resultsHead: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  bar: { height: 8, backgroundColor: '#f3f4f6', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
});

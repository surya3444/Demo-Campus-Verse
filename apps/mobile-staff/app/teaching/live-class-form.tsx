import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { liveClassApi } from '@campus-verse/mobile-shared';
import { teachingApi, TeachingClass, getSubjects } from '@/api/teaching';

function defaultStart(): Date {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 15);
  d.setSeconds(0, 0);
  return d;
}

function fmtIso(d: Date): string {
  // Convert to YYYY-MM-DD HH:mm for the input fallback.
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function parseLocal(input: string): Date | null {
  const m = input.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], 0, 0);
  return isNaN(d.getTime()) ? null : d;
}

export default function LiveClassFormScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [classId, setClassId] = useState('');
  const start0 = defaultStart();
  const end0 = new Date(start0);
  end0.setMinutes(end0.getMinutes() + 60);
  const [start, setStart] = useState(fmtIso(start0));
  const [end, setEnd] = useState(fmtIso(end0));
  const [recordingEnabled, setRecordingEnabled] = useState(false);
  const [autoMarkAttendance, setAutoMarkAttendance] = useState(false);
  const [studentCanDraw, setStudentCanDraw] = useState(false);
  const [chatEnabled, setChatEnabled] = useState(true);
  const [studentCanUnmute, setStudentCanUnmute] = useState(false);
  const [coHostStaffIds, setCoHostStaffIds] = useState<string[]>([]);

  const { data: classes = [] } = useQuery({
    queryKey: ['mobile-my-classes-for-live'],
    queryFn: () => teachingApi.getMyClasses(),
  });

  const { data: staffList } = useQuery({
    queryKey: ['mobile-teaching-staff-for-cohost'],
    queryFn: () => liveClassApi.listTeachingStaff(),
  });
  const teachingStaff: Array<{
    _id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  }> = staffList?.data ?? [];

  const selected = classes.find((c) => c.sectionId === sectionId);
  const subjects = selected ? getSubjects(selected) : [];

  const create = useMutation({
    mutationFn: () => {
      const startDate = parseLocal(start);
      const endDate = parseLocal(end);
      if (!startDate || !endDate || endDate <= startDate) {
        throw new Error('Invalid start/end time');
      }
      return liveClassApi.create({
        title: title.trim(),
        description: description.trim() || undefined,
        classId: classId || selected?.classId || undefined,
        sectionId,
        subjectId: subjectId || undefined,
        coHostStaffIds: coHostStaffIds.length > 0 ? coHostStaffIds : undefined,
        scheduledStart: startDate.toISOString(),
        scheduledEnd: endDate.toISOString(),
        recordingEnabled,
        autoMarkAttendance,
        settings: { chatEnabled, studentCanUnmute, studentCanDraw },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mobile-live-classes'] });
      Alert.alert('Scheduled', 'Live class scheduled', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (e: Error) => Alert.alert('Failed', e.message || 'Could not schedule'),
  });

  const canSubmit = title.trim().length > 0 && sectionId && start && end && !create.isPending;

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 8 }}>
          <Ionicons name="chevron-back" size={26} color="#111827" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Schedule live class</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
        <Field label="Title *">
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Algebra recap"
            placeholderTextColor="#9ca3af"
            style={s.input}
          />
        </Field>

        <Field label="Description">
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Agenda or notes"
            placeholderTextColor="#9ca3af"
            multiline
            style={[s.input, { minHeight: 70 }]}
          />
        </Field>

        <Field label="Section *">
          <View style={s.sectionList}>
            {classes.length === 0 ? (
              <Text style={{ color: '#9ca3af', fontSize: 12, padding: 8 }}>
                No sections available
              </Text>
            ) : (
              classes.map((c: TeachingClass) => (
                <TouchableOpacity
                  key={c.sectionId}
                  onPress={() => {
                    setSectionId(c.sectionId);
                    setClassId(c.classId);
                    setSubjectId('');
                  }}
                  style={[s.sectionPill, sectionId === c.sectionId && s.sectionPillActive]}
                >
                  <Text style={[s.sectionPillText, sectionId === c.sectionId && { color: '#fff' }]}>
                    {c.className} · {c.sectionName}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        </Field>

        {subjects.length > 0 && (
          <Field label="Subject (optional)">
            <View style={s.sectionList}>
              {subjects.map((sub) => (
                <TouchableOpacity
                  key={sub.subjectId}
                  onPress={() => setSubjectId(sub.subjectId === subjectId ? '' : sub.subjectId)}
                  style={[s.sectionPill, subjectId === sub.subjectId && s.sectionPillActive]}
                >
                  <Text
                    style={[s.sectionPillText, subjectId === sub.subjectId && { color: '#fff' }]}
                  >
                    {sub.subjectName}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Field>
        )}

        <Field label="Starts at *">
          <TextInput
            value={start}
            onChangeText={setStart}
            placeholder="YYYY-MM-DD HH:MM"
            placeholderTextColor="#9ca3af"
            style={s.input}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
          />
        </Field>

        <Field label="Ends at *">
          <TextInput
            value={end}
            onChangeText={setEnd}
            placeholder="YYYY-MM-DD HH:MM"
            placeholderTextColor="#9ca3af"
            style={s.input}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
          />
        </Field>

        <ToggleRow
          label="Record this class"
          desc="Enable in your LiveKit project first"
          value={recordingEnabled}
          onChange={setRecordingEnabled}
        />
        <ToggleRow
          label="Auto-mark attendance"
          desc="Mark students present if joined ≥ 60% of class duration"
          value={autoMarkAttendance}
          onChange={setAutoMarkAttendance}
        />
        <ToggleRow
          label="Chat enabled"
          desc="Students can post messages in the class chat"
          value={chatEnabled}
          onChange={setChatEnabled}
        />
        <ToggleRow
          label="Allow students to unmute"
          desc="Off by default — students can only listen"
          value={studentCanUnmute}
          onChange={setStudentCanUnmute}
        />
        <ToggleRow
          label="Let students draw on whiteboard"
          desc="Off by default — only host draws"
          value={studentCanDraw}
          onChange={setStudentCanDraw}
        />

        {teachingStaff.length > 0 && (
          <Field label="Co-hosts (optional)">
            <View style={s.sectionList}>
              {teachingStaff.map((staff) => {
                const selected = coHostStaffIds.includes(staff._id);
                const name =
                  `${staff.firstName ?? ''} ${staff.lastName ?? ''}`.trim() ||
                  staff.email ||
                  'Staff';
                return (
                  <TouchableOpacity
                    key={staff._id}
                    onPress={() =>
                      setCoHostStaffIds((prev) =>
                        selected ? prev.filter((x) => x !== staff._id) : [...prev, staff._id]
                      )
                    }
                    style={[s.sectionPill, selected && s.sectionPillActive]}
                  >
                    <Text style={[s.sectionPillText, selected && { color: '#fff' }]}>{name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Field>
        )}

        <TouchableOpacity
          style={[s.submitBtn, !canSubmit && { opacity: 0.5 }]}
          disabled={!canSubmit}
          onPress={() => create.mutate()}
        >
          <Text style={s.submitText}>{create.isPending ? 'Scheduling…' : 'Schedule'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.label}>{label}</Text>
      {children}
    </View>
  );
}

function ToggleRow({
  label,
  desc,
  value,
  onChange,
}: {
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={s.toggleRow}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={s.toggleLabel}>{label}</Text>
        <Text style={s.toggleDesc}>{desc}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: '#4f46e5', false: '#e5e7eb' }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  label: { fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 6 },
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
  sectionList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sectionPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sectionPillActive: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  sectionPillText: { fontSize: 12, color: '#374151', fontWeight: '600' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  toggleLabel: { fontSize: 13, fontWeight: '600', color: '#111827' },
  toggleDesc: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  submitBtn: {
    backgroundColor: '#4f46e5',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

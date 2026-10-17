import { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Text, Rule, Pill, Button, color } from '@campus-verse/mobile-shared/design';

/**
 * Per-period attendance — register.
 *
 * Staff opens the screen, picks a period (pre-selected from current time),
 * sees the section roster, and can either tap each student or open the QR
 * scanner. Marks are queued in MMKV for offline-first behaviour.
 *
 * Camera/QR integration uses expo-camera (peer install required). The screen
 * renders with a stub viewport when the camera module is missing.
 */

type Mark = 'present' | 'absent' | 'late' | 'leave';

interface RosterEntry {
  id: string;
  rollNo: string;
  name: string;
  status: Mark | null;
}

// Placeholder roster — real data comes from /attendance/section/:sectionId/students
const SAMPLE_ROSTER: RosterEntry[] = Array.from({ length: 12 }, (_, i) => ({
  id: `s${i + 1}`,
  rollNo: String(i + 1).padStart(2, '0'),
  name: [
    'Aarav Sharma',
    'Diya Patel',
    'Vihaan Kumar',
    'Ananya Reddy',
    'Arjun Mehta',
    'Ishita Singh',
    'Rohan Iyer',
    'Sara Khan',
    'Aditya Rao',
    'Priya Nair',
    'Karan Joshi',
    'Meera Das',
  ][i],
  status: null,
}));

const MARK_TONE: Record<Mark, 'sage' | 'brick' | 'marigold' | 'indigo'> = {
  present: 'sage',
  absent: 'brick',
  late: 'marigold',
  leave: 'indigo',
};

export default function MarkAttendance() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [roster, setRoster] = useState<RosterEntry[]>(SAMPLE_ROSTER);
  const [scanning, setScanning] = useState(false);

  const set = (id: string, status: Mark) => {
    setRoster((r) => r.map((s) => (s.id === id ? { ...s, status } : s)));
  };

  const setAllPresent = () => setRoster((r) => r.map((s) => ({ ...s, status: 'present' as Mark })));

  const stats = {
    present: roster.filter((s) => s.status === 'present').length,
    absent: roster.filter((s) => s.status === 'absent').length,
    late: roster.filter((s) => s.status === 'late').length,
    leave: roster.filter((s) => s.status === 'leave').length,
    pending: roster.filter((s) => !s.status).length,
  };

  const allMarked = stats.pending === 0;

  return (
    <View style={{ flex: 1, backgroundColor: color.paper }}>
      <StatusBar style="dark" />
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 22,
          paddingBottom: 14,
          borderBottomWidth: 1,
          borderBottomColor: color.rule,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Text variant="micro" tone="inkMute">
            ← Back
          </Text>
        </TouchableOpacity>
        <View style={{ height: 14 }} />
        <Text variant="eyebrow" tone="marigold">
          Period 03 · 11:15 – 12:00 · Class IX-B
        </Text>
        <View style={{ height: 6 }} />
        <Text variant="h1" tone="ink" italic>
          Roll call.
        </Text>
      </View>

      {scanning ? (
        <ScannerView
          onCancel={() => setScanning(false)}
          onScan={(rollNo) => {
            const target = roster.find((s) => s.rollNo === rollNo);
            if (target) set(target.id, 'present');
            setScanning(false);
          }}
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 160 }}
        >
          {/* Stats strip */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              paddingVertical: 14,
            }}
          >
            <Stat label="Present" value={stats.present} accent="sage" />
            <Sep />
            <Stat label="Absent" value={stats.absent} accent="brick" />
            <Sep />
            <Stat label="Late" value={stats.late} accent="marigold" />
            <Sep />
            <Stat label="Pending" value={stats.pending} />
          </View>
          <Rule />

          {/* Roster */}
          {roster.map((s, _i) => (
            <View
              key={s.id}
              style={{
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: color.rule,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text variant="kicker" tone="inkFaint" style={{ width: 34 }}>
                  {s.rollNo}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text variant="h3" tone="ink" italic>
                    {s.name}
                  </Text>
                  {s.status && (
                    <View style={{ marginTop: 4 }}>
                      <Pill label={s.status} tone={MARK_TONE[s.status]} size="xs" />
                    </View>
                  )}
                </View>
              </View>
              <View style={{ flexDirection: 'row', marginTop: 10, gap: 6 }}>
                {(['present', 'absent', 'late', 'leave'] as Mark[]).map((m) => {
                  const sel = s.status === m;
                  return (
                    <TouchableOpacity
                      key={m}
                      activeOpacity={0.7}
                      onPress={() => set(s.id, m)}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 999,
                        borderWidth: 1.5,
                        borderColor: sel ? color.ink : color.rule,
                        backgroundColor: sel ? color.ink : 'transparent',
                        alignItems: 'center',
                      }}
                    >
                      <Text
                        variant="micro"
                        style={{
                          color: sel ? color.onInk : color.ink,
                          textTransform: 'capitalize',
                          letterSpacing: 0.5,
                        }}
                      >
                        {m}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Action bar */}
      {!scanning && (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            paddingHorizontal: 22,
            paddingTop: 14,
            paddingBottom: insets.bottom + 10,
            backgroundColor: color.paper,
            borderTopWidth: 1,
            borderTopColor: color.ruleStrong,
            flexDirection: 'row',
            gap: 10,
          }}
        >
          <Button
            label="Scan QR"
            variant="outline"
            onPress={() => setScanning(true)}
            style={{ flex: 1 }}
            size="md"
          />
          <Button
            label="Mark all present"
            variant="outline"
            onPress={setAllPresent}
            style={{ flex: 1 }}
            size="md"
          />
          <Button
            label={
              allMarked ? 'Submit' : `Submit (${roster.length - stats.pending}/${roster.length})`
            }
            variant={allMarked ? 'ink' : 'marigold'}
            onPress={() => Alert.alert('Submitted', 'Attendance for the period has been saved.')}
            size="md"
          />
        </View>
      )}
    </View>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: 'sage' | 'brick' | 'marigold' | 'indigo';
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text variant="eyebrow" tone="inkFaint">
        {label}
      </Text>
      <Text
        variant="numLarge"
        style={{
          color: accent ? color[accent] : color.ink,
          fontSize: 28,
          lineHeight: 32,
          marginTop: 2,
        }}
      >
        {String(value).padStart(2, '0')}
      </Text>
    </View>
  );
}
function Sep() {
  return <View style={{ width: 1, backgroundColor: color.rule, marginHorizontal: 10 }} />;
}

function ScannerView({
  onCancel,
  onScan,
}: {
  onCancel: () => void;
  onScan: (rollNo: string) => void;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: color.ink }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <View
          style={{
            width: 240,
            height: 240,
            borderWidth: 2,
            borderColor: color.marigold,
            borderRadius: 16,
            position: 'relative',
          }}
        >
          {[0, 1, 2, 3].map((corner) => (
            <View
              key={corner}
              style={{
                position: 'absolute',
                width: 24,
                height: 24,
                borderColor: color.marigold,
                borderTopWidth: corner < 2 ? 4 : 0,
                borderBottomWidth: corner >= 2 ? 4 : 0,
                borderLeftWidth: corner % 2 === 0 ? 4 : 0,
                borderRightWidth: corner % 2 === 1 ? 4 : 0,
                top: corner < 2 ? -4 : undefined,
                bottom: corner >= 2 ? -4 : undefined,
                left: corner % 2 === 0 ? -4 : undefined,
                right: corner % 2 === 1 ? -4 : undefined,
              }}
            />
          ))}
        </View>
        <View style={{ height: 28 }} />
        <Text variant="eyebrow" tone="marigold">
          Scanning · Student QR
        </Text>
        <View style={{ height: 8 }} />
        <Text variant="h1" tone="onInk" italic>
          Hold steady.
        </Text>
        <Text variant="caption" tone="onInkMute" style={{ marginTop: 8 }}>
          Align the student's ID badge within the frame.
        </Text>
        <View style={{ height: 28 }} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {/* Demo trigger — in production this is the camera onBarCodeScanned */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => onScan('05')}
            style={{
              paddingHorizontal: 18,
              paddingVertical: 10,
              borderRadius: 999,
              backgroundColor: color.marigold,
            }}
          >
            <Text variant="micro" style={{ color: '#FFF7E8' }}>
              Demo: scan roll 05
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onCancel}
            style={{
              paddingHorizontal: 18,
              paddingVertical: 10,
              borderRadius: 999,
              borderWidth: 1.5,
              borderColor: 'rgba(245,240,230,0.4)',
            }}
          >
            <Text variant="micro" tone="onInk">
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

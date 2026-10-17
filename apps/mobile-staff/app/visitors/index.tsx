import { View, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Text, Rule, Pill, color } from '@campus-verse/mobile-shared/design';

/**
 * Visitors — the gatehouse log.
 *
 * Today's log is presented as a hand-written register: date in display
 * serif at the top, then numbered entries with timestamps in mono. Each
 * row carries a status pill and a "sign out" action where appropriate.
 */

interface Visitor {
  id: string;
  num: string;
  name: string;
  host: string;
  purpose: string;
  inTime: string;
  outTime: string | null;
  pass: string;
}

const SAMPLE: Visitor[] = [
  {
    id: 'v1',
    num: '001',
    name: 'R. Krishnan',
    host: 'Ms. Mehta · Office',
    purpose: 'Parent meeting',
    inTime: '09:14',
    outTime: '10:05',
    pass: 'V-2025-001',
  },
  {
    id: 'v2',
    num: '002',
    name: 'AC Servicing',
    host: 'Maintenance',
    purpose: 'AC service',
    inTime: '10:30',
    outTime: null,
    pass: 'V-2025-002',
  },
  {
    id: 'v3',
    num: '003',
    name: 'Anjali Sen',
    host: 'Principal',
    purpose: 'Admission enquiry',
    inTime: '11:02',
    outTime: null,
    pass: 'V-2025-003',
  },
];

export default function Visitors() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const inside = SAMPLE.filter((v) => !v.outTime).length;

  return (
    <View style={{ flex: 1, backgroundColor: color.paper }}>
      <StatusBar style="dark" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 18,
          paddingBottom: 140,
          paddingHorizontal: 22,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Text variant="micro" tone="inkMute">
            ← Home
          </Text>
        </TouchableOpacity>
        <View style={{ height: 18 }} />

        <Text variant="eyebrow" tone="marigold">
          Gatehouse · The register
        </Text>
        <View style={{ height: 10 }} />
        <Text variant="hero" tone="ink">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long' })},
        </Text>
        <Text variant="hero" tone="ink" italic>
          {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}.
        </Text>

        <View style={{ height: 18 }} />
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Text variant="numLarge" tone="ink">
            {String(SAMPLE.length).padStart(2, '0')}
          </Text>
          <Text variant="caption" tone="inkMute" style={{ marginLeft: 10, marginBottom: 8 }}>
            entries today ·{' '}
            <Text variant="caption" tone="marigold">
              {inside} currently inside
            </Text>
          </Text>
        </View>

        <View style={{ height: 18 }} />
        <Rule tone="ink" />

        {/* Entries */}
        {SAMPLE.map((v, _i) => (
          <View
            key={v.id}
            style={{
              paddingVertical: 20,
              borderBottomWidth: 1,
              borderBottomColor: color.rule,
            }}
          >
            <View style={{ flexDirection: 'row' }}>
              <Text variant="kicker" tone="inkFaint" style={{ width: 44 }}>
                №{v.num}
              </Text>
              <View style={{ flex: 1 }}>
                <Text variant="h2" tone="ink" italic>
                  {v.name}
                </Text>
                <Text variant="caption" tone="inkMute" style={{ marginTop: 4 }}>
                  Visiting {v.host} · {v.purpose}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Pill
                  label={v.outTime ? 'Signed out' : 'Inside'}
                  tone={v.outTime ? 'neutral' : 'marigold'}
                  size="xs"
                />
                <View style={{ height: 6 }} />
                <Text variant="numSmall" tone="ink">
                  {v.inTime} {v.outTime ? `→ ${v.outTime}` : '· in'}
                </Text>
              </View>
            </View>
            {!v.outTime && (
              <View style={{ marginTop: 14, flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text variant="micro" tone="inkFaint">
                    Pass · {v.pass}
                  </Text>
                </View>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: color.ink,
                  }}
                >
                  <Text variant="micro" tone="onInk">
                    Sign out →
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}

        <View style={{ height: 28 }} />
        <Text variant="micro" tone="inkFaint" align="center">
          End of the day's register.
        </Text>
      </ScrollView>

      {/* FAB */}
      <View
        style={{
          position: 'absolute',
          bottom: insets.bottom + 18,
          right: 22,
        }}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push('/visitors/new' as never)}
          style={{
            height: 56,
            paddingHorizontal: 22,
            borderRadius: 999,
            backgroundColor: color.marigold,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              fontFamily: 'Fraunces_700Bold_Italic',
              fontSize: 18,
              color: '#FFF7E8',
              marginRight: 8,
            }}
          >
            +
          </Text>
          <Text variant="bodyStrong" style={{ color: '#FFF7E8' }}>
            Register visitor
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

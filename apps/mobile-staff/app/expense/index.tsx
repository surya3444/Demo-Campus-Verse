import { View, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Text, Rule, Pill, color } from '@campus-verse/mobile-shared/design';

const SAMPLE = [
  {
    id: 'e1',
    date: '2026-05-12',
    amount: 4250,
    merchant: 'Ola',
    purpose: 'School trip transport',
    status: 'approved' as const,
  },
  {
    id: 'e2',
    date: '2026-05-10',
    amount: 720,
    merchant: 'Stationers',
    purpose: 'Lab sheets',
    status: 'paid' as const,
  },
  {
    id: 'e3',
    date: '2026-05-08',
    amount: 2180,
    merchant: 'Periodicals India',
    purpose: 'Library subscription',
    status: 'pending' as const,
  },
];

const TONE = { approved: 'sage', paid: 'indigo', pending: 'marigold', rejected: 'brick' } as const;

export default function MyExpenses() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const total = SAMPLE.reduce((s, e) => s + e.amount, 0);

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
          Reimbursements · This month
        </Text>
        <View style={{ height: 10 }} />
        <Text variant="hero" tone="ink">
          ₹{total.toLocaleString('en-IN')}
        </Text>
        <Text variant="hero" tone="ink" italic>
          claimed.
        </Text>
        <View style={{ height: 6 }} />
        <Text variant="caption" tone="inkMute">
          {SAMPLE.length} claims across {new Set(SAMPLE.map((s) => s.merchant)).size} merchants.
        </Text>

        <View style={{ height: 24 }} />
        <Rule tone="ink" />

        {SAMPLE.map((e, i) => (
          <View
            key={e.id}
            style={{
              paddingVertical: 18,
              borderBottomWidth: 1,
              borderBottomColor: color.rule,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text variant="kicker" tone="inkFaint" style={{ marginRight: 10 }}>
                {String(i + 1).padStart(2, '0')}
              </Text>
              <Text variant="eyebrow" tone="indigo">
                {e.merchant}
              </Text>
              <View style={{ flex: 1 }} />
              <Text variant="micro" tone="inkFaint">
                {new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </Text>
            </View>
            <View style={{ height: 6 }} />
            <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
              <Text variant="h1" tone="ink" italic>
                ₹{e.amount.toLocaleString('en-IN')}
              </Text>
              <View style={{ flex: 1 }} />
              <Pill label={e.status} tone={TONE[e.status]} size="xs" />
            </View>
            <Text variant="caption" tone="inkMute" style={{ marginTop: 6 }}>
              {e.purpose}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          bottom: insets.bottom + 18,
          right: 22,
        }}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push('/expense/new' as never)}
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
            New claim
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

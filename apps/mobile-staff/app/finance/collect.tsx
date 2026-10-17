import { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Text, Rule, Button, Card, color } from '@campus-verse/mobile-shared/design';

const METHODS = [
  { key: 'cash', label: 'Cash' },
  { key: 'upi', label: 'UPI' },
  { key: 'card', label: 'Card' },
  { key: 'cheque', label: 'Cheque' },
  { key: 'bank_transfer', label: 'Bank' },
] as const;

const INSTALMENTS = [
  {
    id: 'i1',
    name: 'Term I · Tuition',
    amount: 18000,
    status: 'pending' as const,
    due: '2026-05-30',
  },
  {
    id: 'i2',
    name: 'Term I · Transport',
    amount: 4500,
    status: 'pending' as const,
    due: '2026-05-30',
  },
  {
    id: 'i3',
    name: 'Books & uniform',
    amount: 2000,
    status: 'pending' as const,
    due: '2026-06-15',
  },
];

export default function Collect() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string[]>(INSTALMENTS.map((i) => i.id));
  const [method, setMethod] = useState<(typeof METHODS)[number]['key']>('upi');

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const total = INSTALMENTS.filter((i) => selected.includes(i.id)).reduce(
    (s, i) => s + i.amount,
    0
  );

  return (
    <View style={{ flex: 1, backgroundColor: color.paper }}>
      <StatusBar style="dark" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 18,
          paddingBottom: 200,
          paddingHorizontal: 22,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Text variant="micro" tone="inkMute">
            ← Counter
          </Text>
        </TouchableOpacity>
        <View style={{ height: 18 }} />

        {/* Student strip */}
        <Card variant="ink" rounded="md" padded={20}>
          <Text variant="eyebrow" tone="marigold">
            Paying for · CV-2024-0142
          </Text>
          <View style={{ height: 10 }} />
          <Text variant="display" tone="onInk" italic>
            Aarav Sharma
          </Text>
          <Text variant="caption" tone="onInkMute" style={{ marginTop: 4 }}>
            VIII-A · Parent: Mr. R. Sharma · +91-9810-002345
          </Text>
        </Card>

        {/* Instalments */}
        <View style={{ marginTop: 26 }}>
          <Text variant="eyebrow" tone="inkFaint">
            01 · Select what's being paid
          </Text>
          <View style={{ height: 10 }} />
          <Rule />
          {INSTALMENTS.map((inst, _i) => {
            const sel = selected.includes(inst.id);
            return (
              <TouchableOpacity
                key={inst.id}
                activeOpacity={0.7}
                onPress={() => toggle(inst.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 16,
                  borderBottomWidth: 1,
                  borderBottomColor: color.rule,
                }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 4,
                    borderWidth: 1.5,
                    borderColor: sel ? color.ink : color.ruleStrong,
                    backgroundColor: sel ? color.ink : 'transparent',
                    marginRight: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {sel && (
                    <Text
                      style={{
                        color: color.onInk,
                        fontFamily: 'JetBrainsMono_700Bold',
                        fontSize: 12,
                      }}
                    >
                      ✓
                    </Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="h3" tone="ink" italic={sel}>
                    {inst.name}
                  </Text>
                  <Text variant="caption" tone="inkMute" style={{ marginTop: 2 }}>
                    Due{' '}
                    {new Date(inst.due).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </Text>
                </View>
                <Text variant="numMid" tone={sel ? 'ink' : 'inkFaint'}>
                  ₹{inst.amount.toLocaleString('en-IN')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Method */}
        <View style={{ marginTop: 26 }}>
          <Text variant="eyebrow" tone="inkFaint">
            02 · Payment method
          </Text>
          <View style={{ height: 10 }} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {METHODS.map((m) => {
              const sel = method === m.key;
              return (
                <TouchableOpacity
                  key={m.key}
                  activeOpacity={0.7}
                  onPress={() => setMethod(m.key)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderRadius: 999,
                    backgroundColor: sel ? color.marigold : 'transparent',
                    borderWidth: 1.5,
                    borderColor: sel ? color.marigold : color.ruleStrong,
                  }}
                >
                  <Text
                    variant="bodyStrong"
                    italic={sel}
                    style={{ color: sel ? '#FFF7E8' : color.ink }}
                  >
                    {m.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Sticky receipt */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: 22,
          paddingTop: 14,
          paddingBottom: insets.bottom + 12,
          backgroundColor: color.ink,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Text variant="eyebrow" tone="onInkFaint">
              Receipt total
            </Text>
            <Text variant="hero" tone="onInk" italic style={{ fontSize: 38, lineHeight: 42 }}>
              ₹{total.toLocaleString('en-IN')}
            </Text>
          </View>
          <Button
            label="Collect & print"
            variant="marigold"
            size="lg"
            onPress={() => {
              Alert.alert('Receipt issued', `RCT-2026-0142 · ₹${total} via ${method}`);
              router.back();
            }}
            disabled={total === 0}
          />
        </View>
      </View>
    </View>
  );
}

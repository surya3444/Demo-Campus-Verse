import { useState } from 'react';
import { View, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Text, Button, color } from '@campus-verse/mobile-shared/design';

const CATEGORIES = ['Travel', 'Stationery', 'Hospitality', 'Books', 'Software', 'Other'];

export default function NewExpense() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string>('Travel');
  const [merchant, setMerchant] = useState('');
  const [purpose, setPurpose] = useState('');
  const [hasBill, setHasBill] = useState(false);

  const valid = amount && Number(amount) > 0 && merchant && purpose;

  return (
    <View style={{ flex: 1, backgroundColor: color.paper }}>
      <StatusBar style="dark" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 18,
          paddingBottom: 80,
          paddingHorizontal: 22,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Text variant="micro" tone="inkMute">
            ← Cancel
          </Text>
        </TouchableOpacity>
        <View style={{ height: 18 }} />
        <Text variant="eyebrow" tone="marigold">
          Reimbursement · Form RX-12
        </Text>
        <View style={{ height: 10 }} />
        <Text variant="hero" tone="ink">
          Claim
        </Text>
        <Text variant="hero" tone="ink" italic>
          a bill.
        </Text>
        <View style={{ height: 26 }} />

        {/* Amount — headline */}
        <Text variant="eyebrow" tone="inkFaint">
          Amount
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
          <Text variant="hero" tone="ink" italic>
            ₹
          </Text>
          <TextInput
            value={amount}
            onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ''))}
            placeholder="0"
            placeholderTextColor={color.inkGhost}
            keyboardType="decimal-pad"
            style={{
              fontFamily: 'JetBrainsMono_700Bold',
              fontSize: 56,
              color: color.ink,
              flex: 1,
              marginLeft: 6,
              paddingVertical: 0,
            }}
          />
        </View>
        <View style={{ height: 1, backgroundColor: color.ink, marginTop: 6 }} />

        {/* Category */}
        <View style={{ marginTop: 24 }}>
          <Text variant="eyebrow" tone="inkFaint">
            Category
          </Text>
          <View style={{ height: 10 }} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {CATEGORIES.map((c) => {
              const sel = category === c;
              return (
                <TouchableOpacity
                  key={c}
                  activeOpacity={0.7}
                  onPress={() => setCategory(c)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 999,
                    backgroundColor: sel ? color.ink : 'transparent',
                    borderWidth: 1.5,
                    borderColor: sel ? color.ink : color.ruleStrong,
                  }}
                >
                  <Text variant="micro" tone={sel ? 'onInk' : 'ink'}>
                    {c}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Merchant */}
        <View style={{ marginTop: 24 }}>
          <Text variant="eyebrow" tone="inkFaint">
            Paid to
          </Text>
          <TextInput
            value={merchant}
            onChangeText={setMerchant}
            placeholder="Ola, Reliance Stationers, …"
            placeholderTextColor={color.inkFaint}
            style={{
              fontFamily: merchant ? 'Fraunces_500Medium_Italic' : 'DMSans_400Regular',
              fontSize: 22,
              color: color.ink,
              paddingVertical: 10,
            }}
          />
          <View style={{ height: 1, backgroundColor: color.ruleStrong }} />
        </View>

        {/* Purpose */}
        <View style={{ marginTop: 22 }}>
          <Text variant="eyebrow" tone="inkFaint">
            Purpose
          </Text>
          <TextInput
            value={purpose}
            onChangeText={setPurpose}
            placeholder="Briefly — one or two sentences."
            placeholderTextColor={color.inkFaint}
            multiline
            style={{
              fontFamily: 'DMSans_400Regular',
              fontSize: 15,
              color: color.ink,
              paddingVertical: 14,
              minHeight: 96,
              textAlignVertical: 'top',
            }}
          />
          <View style={{ height: 1, backgroundColor: color.ruleStrong }} />
        </View>

        {/* Bill */}
        <View style={{ marginTop: 26 }}>
          <Text variant="eyebrow" tone="inkFaint">
            Bill or receipt
          </Text>
          <View style={{ height: 12 }} />
          <TouchableOpacity activeOpacity={0.7} onPress={() => setHasBill(!hasBill)}>
            <View
              style={{
                borderWidth: 1.5,
                borderStyle: 'dashed',
                borderColor: hasBill ? color.sage : color.ruleStrong,
                borderRadius: 10,
                padding: 22,
                backgroundColor: hasBill ? color.sageWash : 'transparent',
                alignItems: 'center',
              }}
            >
              <Text variant="eyebrow" tone={hasBill ? 'sage' : 'inkFaint'}>
                {hasBill ? 'Bill attached · IMG_002.jpg' : 'Tap to scan bill'}
              </Text>
              <View style={{ height: 8 }} />
              <Text variant="h2" tone="ink" italic>
                {hasBill ? 'Looks good.' : 'Hold the receipt flat.'}
              </Text>
              {!hasBill && (
                <Text variant="caption" tone="inkMute" style={{ marginTop: 6 }}>
                  Edges will snap automatically.
                </Text>
              )}
            </View>
          </TouchableOpacity>
        </View>

        <View style={{ height: 30 }} />
        <Button
          label="Submit for reimbursement"
          variant={valid && hasBill ? 'marigold' : 'ink'}
          size="lg"
          full
          disabled={!valid || !hasBill}
          onPress={() => {
            Alert.alert('Submitted', 'Your claim is queued for approval.');
            router.back();
          }}
        />
        <View style={{ height: 8 }} />
        <Text variant="micro" tone="inkFaint" align="center">
          Approver: Principal · Avg turnaround 2 working days.
        </Text>
      </ScrollView>
    </View>
  );
}

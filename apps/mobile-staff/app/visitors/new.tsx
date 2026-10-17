import { useState } from 'react';
import { View, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Text, Pill, Button, Card, color } from '@campus-verse/mobile-shared/design';

/**
 * Visitor — new registration.
 *
 * The form is laid out like a fountain-pen ledger: each field is a
 * full-width row with a kicker label, a hairline under-rule, and the input
 * set in italic body type when filled. Final card is a confirmation receipt.
 */

const PURPOSES = [
  'Parent meeting',
  'Admission',
  'Delivery',
  'Maintenance',
  'Interview',
  'Vendor',
  'Other',
];

export default function NewVisitor() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<'form' | 'photo' | 'done'>('form');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [host, setHost] = useState('');
  const [purpose, setPurpose] = useState<string>('Parent meeting');
  const [idType, setIdType] = useState<'Aadhaar' | 'DL' | 'Other'>('Aadhaar');

  const valid = name.length > 2 && phone.length >= 10 && host.length > 1;

  if (step === 'photo') {
    return (
      <View style={{ flex: 1, backgroundColor: color.ink }}>
        <StatusBar style="light" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22 }}>
          <View
            style={{
              width: 280,
              height: 380,
              borderRadius: 8,
              borderWidth: 2,
              borderColor: color.marigold,
              borderStyle: 'dashed',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text variant="eyebrow" tone="marigold">
              Camera preview
            </Text>
            <View style={{ height: 8 }} />
            <Text variant="h2" tone="onInk" italic>
              Snap their photo
            </Text>
            <Text
              variant="caption"
              tone="onInkMute"
              style={{ marginTop: 8, textAlign: 'center', maxWidth: 220 }}
            >
              Hold the device at eye-level and tap the shutter when ready.
            </Text>
          </View>
          <View style={{ height: 30 }} />
          <View style={{ flexDirection: 'row', gap: 14 }}>
            <Button label="Skip" variant="outline" onPress={() => setStep('done')} />
            <Button label="Capture & continue" variant="marigold" onPress={() => setStep('done')} />
          </View>
        </View>
      </View>
    );
  }

  if (step === 'done') {
    return (
      <View style={{ flex: 1, backgroundColor: color.paper }}>
        <StatusBar style="dark" />
        <View
          style={{
            flex: 1,
            paddingTop: insets.top + 50,
            paddingHorizontal: 22,
            alignItems: 'center',
          }}
        >
          <Text variant="eyebrow" tone="marigold">
            Issued · 11:42
          </Text>
          <View style={{ height: 10 }} />
          <Text variant="hero" tone="ink" italic align="center">
            Pass ready.
          </Text>
          <View style={{ height: 30 }} />

          <Card variant="ink" rounded="md" padded={26} style={{ width: '100%' }}>
            <Text variant="eyebrow" tone="marigold">
              Visitor pass · CV-2025-
              {Math.floor(Math.random() * 999)
                .toString()
                .padStart(3, '0')}
            </Text>
            <View style={{ height: 14 }} />
            <Text variant="display" tone="onInk" italic>
              {name}
            </Text>
            <Text variant="caption" tone="onInkMute" style={{ marginTop: 6 }}>
              Visiting {host} · {purpose}
            </Text>
            <View style={{ height: 18 }} />
            <View style={{ height: 1, backgroundColor: 'rgba(245,240,230,0.18)' }} />
            <View style={{ height: 14 }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View>
                <Text variant="eyebrow" tone="onInkFaint">
                  Issued
                </Text>
                <Text variant="numMid" tone="onInk">
                  {new Date().toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  })}
                </Text>
              </View>
              <View>
                <Text variant="eyebrow" tone="onInkFaint">
                  Valid until
                </Text>
                <Text variant="numMid" tone="onInk">
                  18:00
                </Text>
              </View>
              <View>
                <Text variant="eyebrow" tone="onInkFaint">
                  Gate
                </Text>
                <Text variant="numMid" tone="onInk">
                  01
                </Text>
              </View>
            </View>
          </Card>

          <View style={{ height: 22 }} />
          <Pill label="Host has been notified" tone="sage" size="md" />

          <View style={{ height: 30 }} />
          <Button
            label="Done · back to register"
            variant="ink"
            size="lg"
            full
            onPress={() => router.replace('/visitors' as never)}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.paper }}>
      <StatusBar style="dark" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 14,
          paddingBottom: 140,
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
          New entry · Form V-1
        </Text>
        <View style={{ height: 10 }} />
        <Text variant="hero" tone="ink">
          Sign
        </Text>
        <Text variant="hero" tone="ink" italic>
          them in.
        </Text>
        <View style={{ height: 26 }} />

        <Field label="Full name" value={name} onChange={setName} placeholder="Mr. R. Krishnan" />
        <Field
          label="Phone"
          value={phone}
          onChange={setPhone}
          placeholder="+91"
          keyboardType="phone-pad"
        />
        <Field
          label="Visiting"
          value={host}
          onChange={setHost}
          placeholder="Ms. Mehta · Class IX-B"
        />

        {/* Purpose */}
        <View style={{ marginTop: 22 }}>
          <Text variant="eyebrow" tone="inkFaint">
            Purpose
          </Text>
          <View style={{ height: 10 }} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {PURPOSES.map((p) => {
              const sel = purpose === p;
              return (
                <TouchableOpacity
                  key={p}
                  activeOpacity={0.7}
                  onPress={() => setPurpose(p)}
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
                    {p}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ID type */}
        <View style={{ marginTop: 26 }}>
          <Text variant="eyebrow" tone="inkFaint">
            ID shown
          </Text>
          <View style={{ height: 10 }} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {(['Aadhaar', 'DL', 'Other'] as const).map((t) => {
              const sel = idType === t;
              return (
                <TouchableOpacity
                  key={t}
                  activeOpacity={0.7}
                  onPress={() => setIdType(t)}
                  style={{
                    flex: 1,
                    paddingVertical: 14,
                    alignItems: 'center',
                    borderWidth: 1.5,
                    borderColor: sel ? color.ink : color.rule,
                    backgroundColor: sel ? color.ink : 'transparent',
                    borderRadius: 8,
                  }}
                >
                  <Text variant="h3" tone={sel ? 'onInk' : 'ink'} italic={sel}>
                    {t}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={{ height: 30 }} />
        <Button
          label="Continue → photo"
          variant={valid ? 'marigold' : 'ink'}
          size="lg"
          full
          disabled={!valid}
          onPress={() => setStep('photo')}
        />
      </ScrollView>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'phone-pad' | 'default';
}) {
  return (
    <View style={{ marginTop: 22 }}>
      <Text variant="eyebrow" tone="inkFaint">
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={color.inkFaint}
        keyboardType={keyboardType}
        style={{
          fontFamily: value ? 'Fraunces_500Medium_Italic' : 'DMSans_400Regular',
          fontSize: 22,
          color: color.ink,
          paddingVertical: 10,
        }}
      />
      <View style={{ height: 1, backgroundColor: color.ruleStrong }} />
    </View>
  );
}

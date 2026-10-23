import { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Text, Rule, Button, Card, color } from '@campus-verse/mobile-shared/design';

/**
 * HR · Check-in / out — punch card.
 *
 * A bold "stopwatch" treatment: hero kicker, big italic display time, a
 * single primary action whose label and tone change with phase. Beneath, a
 * geofence card shows whether the device is currently inside campus.
 */

type Phase = 'out' | 'in';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export default function Checkin() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [now, setNow] = useState(new Date());
  const [phase, setPhase] = useState<Phase>('out');
  const [inAt, setInAt] = useState<Date | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const elapsed = inAt ? Math.floor((now.getTime() - inAt.getTime()) / 1000) : 0;
  const hh = Math.floor(elapsed / 3600);
  const mm = Math.floor((elapsed % 3600) / 60);
  const ss = elapsed % 60;

  const onCampus = true; // Placeholder — wire to expo-location geofence

  return (
    <View style={{ flex: 1, backgroundColor: phase === 'in' ? color.ink : color.paper }}>
      <StatusBar style={phase === 'in' ? 'light' : 'dark'} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 18,
          paddingBottom: 80,
          paddingHorizontal: 22,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Text variant="micro" tone={phase === 'in' ? 'onInkMute' : 'inkMute'}>
            ← Back
          </Text>
        </TouchableOpacity>
        <View style={{ height: 22 }} />

        <Text variant="eyebrow" tone={phase === 'in' ? 'marigold' : 'marigold'}>
          {phase === 'in' ? 'Punched in' : 'Off the clock'}
        </Text>
        <View style={{ height: 10 }} />
        <Text
          variant="hero"
          tone={phase === 'in' ? 'onInk' : 'ink'}
          italic
          style={{ fontSize: 88, lineHeight: 92 }}
        >
          {pad(now.getHours())}
          <Text
            tone={phase === 'in' ? 'marigold' : 'marigold'}
            style={{ fontSize: 88, lineHeight: 92 }}
          >
            :
          </Text>
          {pad(now.getMinutes())}
        </Text>
        <View style={{ height: 4 }} />
        <Text variant="caption" tone={phase === 'in' ? 'onInkMute' : 'inkMute'}>
          {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        </Text>

        <View style={{ height: 26 }} />

        {/* Geofence card */}
        <Card
          variant={phase === 'in' ? 'ink' : 'paper'}
          rounded="md"
          padded={18}
          style={{ borderColor: phase === 'in' ? 'rgba(255,255,255,0.18)' : color.rule }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: onCampus ? color.sage : color.brick,
                marginRight: 10,
              }}
            />
            <View style={{ flex: 1 }}>
              <Text variant="eyebrow" tone={phase === 'in' ? 'onInkFaint' : 'inkFaint'}>
                Location
              </Text>
              <Text
                variant="bodyStrong"
                tone={phase === 'in' ? 'onInk' : 'ink'}
                italic
                style={{ marginTop: 2 }}
              >
                {onCampus ? 'Inside campus boundary' : 'Outside campus'}
              </Text>
            </View>
          </View>
        </Card>

        <View style={{ height: 26 }} />

        {/* Action */}
        <Button
          label={phase === 'out' ? 'Punch in' : 'Punch out'}
          variant={phase === 'out' ? 'marigold' : 'outline'}
          size="lg"
          full
          onPress={() => {
            if (phase === 'out') {
              setPhase('in');
              setInAt(new Date());
            } else {
              setPhase('out');
              setInAt(null);
            }
          }}
          style={phase === 'in' ? { borderColor: color.onInk } : undefined}
        />

        {phase === 'in' && (
          <View style={{ marginTop: 26 }}>
            <Text variant="eyebrow" tone="onInkFaint">
              Elapsed
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
              <Text variant="numLarge" tone="onInk">
                {pad(hh)}
              </Text>
              <Text variant="caption" tone="onInkMute" style={{ marginLeft: 4 }}>
                h
              </Text>
              <Text variant="numLarge" tone="onInk" style={{ marginLeft: 12 }}>
                {pad(mm)}
              </Text>
              <Text variant="caption" tone="onInkMute" style={{ marginLeft: 4 }}>
                m
              </Text>
              <Text variant="numMid" tone="onInkMute" style={{ marginLeft: 12 }}>
                {pad(ss)}s
              </Text>
            </View>
          </View>
        )}

        <View style={{ height: 36 }} />

        {/* History */}
        <Text variant="eyebrow" tone={phase === 'in' ? 'onInkFaint' : 'inkFaint'}>
          This week
        </Text>
        <View style={{ height: 10 }} />
        <Rule tone={phase === 'in' ? 'ruleStrong' : 'ruleStrong'} />
        {[
          { day: 'Mon', in: '08:54', out: '17:08', dur: '8h 14m' },
          { day: 'Tue', in: '09:02', out: '17:21', dur: '8h 19m' },
          { day: 'Wed', in: '08:48', out: '17:00', dur: '8h 12m' },
          { day: 'Thu', in: '—', out: '—', dur: 'Off · sick leave' },
        ].map((d, i) => (
          <View
            key={i}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: phase === 'in' ? 'rgba(255,255,255,0.12)' : color.rule,
            }}
          >
            <Text
              variant="kicker"
              tone={phase === 'in' ? 'onInkFaint' : 'inkFaint'}
              style={{ width: 40 }}
            >
              {d.day}
            </Text>
            <Text variant="numSmall" tone={phase === 'in' ? 'onInk' : 'ink'} style={{ width: 90 }}>
              {d.in} → {d.out}
            </Text>
            <View style={{ flex: 1 }} />
            <Text variant="bodyStrong" tone={phase === 'in' ? 'onInkMute' : 'inkMute'} italic>
              {d.dur}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

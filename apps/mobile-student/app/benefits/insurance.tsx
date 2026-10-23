import { useEffect } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { GraduationCap, ScrollText } from 'lucide-react-native';
import { Text, Surface, SectionTitle, ScreenHeader, brand, color } from '@campus-verse/mobile-shared/design';
import { UpcomingBenefits } from '@/components/benefits';

// The client's wording — keep verbatim (same as the web page).
const STATUS_LINE =
  'Student accidental insurance coverage is under discussion with an insurance partner and is subject to regulatory, contractual and partner approvals.';
const NOTES = [
  STATUS_LINE,
  'Insurance benefits will be activated only after formal launch and policy issuance.',
  'Details of coverage, eligibility, exclusions and claim process will be announced separately.',
];
const STAGES = ['Partner discussion', 'Regulatory, contractual & partner approvals', 'Policy issuance', 'Formal launch'];
const CURRENT = 0;
const SHIELD = 'M120 10 L220 46 V124 C220 190 176 236 120 252 C64 236 20 190 20 124 V46 Z';

/** The shield being built: one layer per approval stage, the current one glowing. */
function ForgingShield() {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 1400 })), -1);
  }, [pulse]);
  const glow = useAnimatedStyle(() => ({ opacity: 0.25 + pulse.value * 0.4, transform: [{ scale: 1 + pulse.value * 0.08 }] }));
  const scales = [0.42, 0.62, 0.81, 1];
  return (
    <View style={{ width: 200, height: 210, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ position: 'absolute', width: 120, height: 120, borderRadius: 999, backgroundColor: brand.cyan400 }, glow]} />
      <Svg width={200} height={210} viewBox="0 0 240 262" style={{ position: 'absolute' }}>
        {scales.map((s, i) => (
          <Path
            key={i}
            d={SHIELD}
            transform={`translate(120 130) scale(${s}) translate(-120 -130)`}
            fill={i === CURRENT ? brand.navy500 : 'none'}
            stroke={i === CURRENT ? '#fff' : 'rgba(255,255,255,0.35)'}
            strokeWidth={i === CURRENT ? 2.5 / s : 1.5 / s}
            strokeDasharray={i === CURRENT ? undefined : `${4 / s} ${7 / s}`}
          />
        ))}
      </Svg>
      <GraduationCap size={30} color="#fff" />
    </View>
  );
}

export default function CInsurance() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: color.paper }}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false}>
        <ScreenHeader eyebrow="Health Connect · cInsurance" title="cInsurance" subtitle="Student accident insurance for your campus, on its way." />

        <LinearGradient colors={[brand.navy950, brand.navy800, brand.navy700]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ marginTop: 18, borderRadius: 26, padding: 20, overflow: 'hidden' }}>
          <View style={{ position: 'absolute', right: -60, top: -60, width: 220, height: 220, borderRadius: 999, backgroundColor: 'rgba(10,197,255,0.16)' }} />
          <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(252,211,77,0.14)', borderWidth: 1, borderColor: 'rgba(252,211,77,0.35)' }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#FCD34D', marginRight: 7 }} />
            <Text variant="micro" style={{ color: '#FDE68A', fontFamily: 'DMSans_700Bold' }}>
              Awaiting Partner Approval
            </Text>
          </View>
          <View style={{ alignItems: 'center', marginVertical: 8 }}>
            <ForgingShield />
          </View>
          <Text variant="h1" tone="onInk">
            Protection for every student,{' '}
            <Text variant="h1" tone="onInk" italic>
              in the making.
            </Text>
          </Text>
          <Text variant="body" tone="onInkMute" style={{ marginTop: 10 }}>
            {STATUS_LINE}
          </Text>
        </LinearGradient>

        <SectionTitle title="The road to launch" />
        <Surface>
          {STAGES.map((s, i) => {
            const now = i === CURRENT;
            return (
              <View key={s} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
                <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: now ? brand.navy800 : color.paperDeep }}>
                  <Text variant="micro" style={{ color: now ? '#fff' : color.inkMute, fontFamily: 'PlusJakartaSans_800ExtraBold' }}>
                    {i + 1}
                  </Text>
                </View>
                <Text variant="bodyStrong" tone={now ? 'ink' : 'inkMute'} style={{ marginLeft: 12, flex: 1 }}>
                  {s}
                </Text>
                {now ? (
                  <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: brand.warningWash }}>
                    <Text variant="micro" style={{ color: brand.warning, fontFamily: 'DMSans_700Bold' }}>
                      In progress
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </Surface>

        <SectionTitle title="Where things stand" />
        <Surface>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <ScrollText size={16} color={brand.navy700} />
            <Text variant="eyebrow" tone="inkMute" style={{ marginLeft: 8 }}>
              Notice to students
            </Text>
          </View>
          {NOTES.map((n, i) => (
            <View key={n} style={{ flexDirection: 'row', marginTop: 10 }}>
              <Text variant="h3" tone="cyan" style={{ width: 28 }}>
                §{i + 1}
              </Text>
              <Text variant="body" tone="inkSoft" style={{ flex: 1 }}>
                {n}
              </Text>
            </View>
          ))}
        </Surface>

        <UpcomingBenefits current="insurance" />
      </ScrollView>
    </View>
  );
}

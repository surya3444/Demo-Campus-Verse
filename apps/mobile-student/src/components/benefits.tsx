import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { HeartPulse, Pill, ShieldCheck } from 'lucide-react-native';
import { Text, SectionTitle, elevation } from '@campus-verse/mobile-shared/design';

/** The client's statuses — keep verbatim (same as the web). */
const BENEFITS = [
  { key: 'insurance', title: 'Student Accident Insurance', status: 'Awaiting Partner Approval', icon: ShieldCheck, colors: ['#312e81', '#0ea5e9'], route: '/benefits/insurance' },
  { key: 'checkup', title: 'Health Check-up Program', status: 'Under Partner Onboarding', icon: HeartPulse, colors: ['#881337', '#fb923c'], route: '/(tabs)/health' },
  { key: 'pharma', title: 'Pharmacy Discounts', status: 'Coming Soon', icon: Pill, colors: ['#064e3b', '#2dd4bf'], route: '/benefits/pharma-c' },
] as const;

/** Upcoming Health Connect benefits as a wallet of cards. */
export function UpcomingBenefits({ current }: { current?: (typeof BENEFITS)[number]['key'] }) {
  const router = useRouter();
  return (
    <View>
      <SectionTitle title="Upcoming benefits" />
      <View style={{ gap: 10 }}>
        {BENEFITS.map((b) => (
          <Pressable key={b.key} onPress={() => b.key !== current && router.push(b.route as never)}>
            <LinearGradient colors={b.colors as unknown as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[{ borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', opacity: current && b.key !== current ? 0.92 : 1 }, elevation.soft]}>
              <View style={{ position: 'absolute', right: -30, top: -40, width: 120, height: 120, borderRadius: 999, borderWidth: 14, borderColor: 'rgba(255,255,255,0.12)' }} />
              <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                <b.icon size={20} color="#fff" />
              </View>
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text variant="h3" tone="onInk">
                  {b.title}
                </Text>
                <Text variant="micro" tone="onInkMute" style={{ marginTop: 2 }}>
                  {b.status}
                </Text>
              </View>
            </LinearGradient>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

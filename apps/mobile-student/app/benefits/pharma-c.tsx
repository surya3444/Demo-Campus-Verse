import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { QrCode, ScanLine, Store } from 'lucide-react-native';
import { Text, Surface, SectionTitle, ScreenHeader, IconChip, brand, color } from '@campus-verse/mobile-shared/design';
import { UpcomingBenefits } from '@/components/benefits';

const NOTES = [
  'Pharmacy discounts for students are coming soon.',
  'Partner pharmacies, discount rates and terms will be announced at launch.',
  'Nothing is redeemable until the programme formally launches.',
];
const HOW = [
  { icon: Store, title: 'Find a partner pharmacy', text: 'Partner pharmacies will be listed right here.' },
  { icon: QrCode, title: 'Show your Pharma-C card', text: 'Your card lives in the app, next to your student ID.' },
  { icon: ScanLine, title: 'Save at the counter', text: 'The discount is applied at billing.' },
];

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 8 }}>
      <Text variant="caption" style={{ fontFamily: 'CVMono_400Regular', color: '#44403c' }}>{k}</Text>
      <View style={{ flex: 1, borderBottomWidth: 1, borderStyle: 'dotted', borderColor: '#a8a29e', marginHorizontal: 6, marginBottom: 4 }} />
      <Text variant="caption" style={{ fontFamily: 'CVMono_700Bold', color: '#1c1917' }}>{v}</Text>
    </View>
  );
}

export default function PharmaC() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: color.paper }}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false}>
        <ScreenHeader eyebrow="Health Connect · Pharma-C" title="Pharma-C" subtitle="Student pharmacy discounts, coming soon." />

        <LinearGradient colors={['#022c22', '#064e3b', '#0d9488']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ marginTop: 18, borderRadius: 26, padding: 20, overflow: 'hidden' }}>
          <View style={{ position: 'absolute', right: -60, top: -60, width: 220, height: 220, borderRadius: 999, backgroundColor: 'rgba(52,211,153,0.2)' }} />
          <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(110,231,183,0.14)', borderWidth: 1, borderColor: 'rgba(110,231,183,0.35)' }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#6EE7B7', marginRight: 7 }} />
            <Text variant="micro" style={{ color: '#A7F3D0', fontFamily: 'DMSans_700Bold' }}>Coming Soon</Text>
          </View>
          <Text variant="h1" tone="onInk" style={{ marginTop: 14 }}>
            Less on the bill.{' '}
            <Text variant="h1" italic style={{ color: '#6EE7B7' }}>More for the semester.</Text>
          </Text>
          {/* the receipt */}
          <View style={{ marginTop: 18, backgroundColor: '#fbfaf6', borderRadius: 12, padding: 16 }}>
            <Text variant="caption" align="center" style={{ fontFamily: 'CVMono_700Bold', letterSpacing: 3, color: '#1c1917' }}>PHARMA-C</Text>
            <View style={{ borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: '#d6d3d1', marginVertical: 10 }} />
            <Text variant="caption" style={{ fontFamily: 'CVMono_700Bold', color: '#1c1917' }}>STUDENT DISCOUNT CARD</Text>
            <Row k="Partner pharmacies" v="TBA" />
            <Row k="Discount rates" v="TBA" />
            <Row k="Terms" v="TBA" />
            <View style={{ borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: '#d6d3d1', marginVertical: 10 }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text variant="caption" style={{ fontFamily: 'CVMono_700Bold', color: '#1c1917' }}>STATUS</Text>
              <View style={{ backgroundColor: '#059669', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                <Text variant="micro" style={{ fontFamily: 'CVMono_700Bold', color: '#fff' }}>COMING SOON</Text>
              </View>
            </View>
            <Text variant="micro" align="center" style={{ marginTop: 10, fontFamily: 'CVMono_400Regular', color: '#78716c', letterSpacing: 2 }}>PREVIEW · NOT REDEEMABLE</Text>
          </View>
        </LinearGradient>

        <SectionTitle title="How it will work" />
        <View style={{ gap: 10 }}>
          {HOW.map((h, i) => (
            <Surface key={h.title}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <IconChip icon={h.icon} hue="emerald" size={42} />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text variant="h3" tone="ink">{i + 1}. {h.title}</Text>
                  <Text variant="caption" tone="inkMute" style={{ marginTop: 2 }}>{h.text}</Text>
                </View>
              </View>
            </Surface>
          ))}
        </View>

        <SectionTitle title="Before you ask" />
        <Surface>
          {NOTES.map((n) => (
            <View key={n} style={{ flexDirection: 'row', marginTop: 6 }}>
              <Text variant="body" style={{ color: '#059669', width: 18 }}>—</Text>
              <Text variant="body" tone="inkSoft" style={{ flex: 1 }}>{n}</Text>
            </View>
          ))}
        </Surface>

        <UpcomingBenefits current="pharma" />
      </ScrollView>
    </View>
  );
}

import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Award,
  BriefcaseBusiness,
  Bus,
  CalendarHeart,
  ChevronRight,
  HeartPulse,
  IdCard,
  LifeBuoy,
  MessagesSquare,
  PartyPopper,
  Pill,
  Radar,
  ShieldCheck,
  Sparkles,
  BedDouble,
  Building2,
} from 'lucide-react-native';
import {
  Text,
  QuickTile,
  SectionTitle,
  LogoMark,
  TAB_BAR_CLEARANCE,
  brand,
  color,
  type Hue,
} from '@campus-verse/mobile-shared/design';
import { clubsApi } from '@/api/clubs';
import { ClubCrest } from '@/components/clubVisuals';

type Tile = { icon: typeof Award; label: string; hint?: string; hue: Hue; route: string; badge?: number };

/**
 * Campus — everything beyond the classroom, in one place: clubs, Career
 * Connect and the live job feed, Health Connect (with cInsurance and
 * Pharma-C), hostel, transport and the rest.
 */
export default function Campus() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const mine = useQuery({ queryKey: ['clubs', 'mine'], queryFn: () => clubsApi.list({ mine: true }) });
  const myClubs = mine.data ?? [];

  const groups: Array<{ title: string; tiles: Tile[] }> = [
    {
      title: 'Community',
      tiles: [
        { icon: PartyPopper, label: 'Clubs', hint: 'Find your people', hue: 'violet', route: '/clubs', badge: myClubs.length || undefined },
        { icon: MessagesSquare, label: 'Campus feed', hint: 'What’s new', hue: 'cyan', route: '/feed' },
        { icon: CalendarHeart, label: 'Events', hint: 'Calendar', hue: 'rose', route: '/(tabs)/calendar' },
      ],
    },
    {
      title: 'Career Connect',
      tiles: [
        { icon: BriefcaseBusiness, label: 'Career hub', hint: 'Jobs & drives', hue: 'navy', route: '/student/career' },
        { icon: Radar, label: 'Live openings', hint: 'Across India', hue: 'emerald', route: '/student/career/live' },
        { icon: Building2, label: 'Drives', hint: 'On campus', hue: 'indigo', route: '/student/career/drives' },
      ],
    },
    {
      title: 'Health Connect',
      tiles: [
        { icon: HeartPulse, label: 'My health', hint: 'Records & visits', hue: 'rose', route: '/(tabs)/health' },
        { icon: ShieldCheck, label: 'cInsurance', hint: 'Coming soon', hue: 'navy', route: '/benefits/insurance' },
        { icon: Pill, label: 'Pharma-C', hint: 'Coming soon', hue: 'teal', route: '/benefits/pharma-c' },
      ],
    },
    {
      title: 'Campus living',
      tiles: [
        { icon: BedDouble, label: 'Hostel', hint: 'Room & warden', hue: 'amber', route: '/(tabs)/hostel' },
        { icon: Bus, label: 'Transport', hint: 'My route', hue: 'cyan', route: '/student/transport-detail' },
        { icon: IdCard, label: 'ID card', hint: 'Digital pass', hue: 'indigo', route: '/student/id-card' },
        { icon: Award, label: 'Certificates', hint: 'Request', hue: 'emerald', route: '/(tabs)/certificates' },
        { icon: LifeBuoy, label: 'Get help', hint: 'Raise a ticket', hue: 'slate', route: '/support/feedback' },
        { icon: Sparkles, label: 'Assistant', hint: 'Ask anything', hue: 'violet', route: '/assistant' },
      ],
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: color.paper }}>
      <StatusBar style="light" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE + insets.bottom }}>
        <LinearGradient colors={[brand.navy950, brand.navy800, brand.navy700]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: 26, overflow: 'hidden' }}>
          <View style={{ position: 'absolute', width: 280, height: 280, borderRadius: 999, right: -110, top: -100, backgroundColor: 'rgba(10,197,255,0.16)' }} />
          <View style={{ position: 'absolute', width: 360, height: 360, borderRadius: 999, right: -150, top: -140, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' }} />
          <LogoMark size={30} tone="white" />
          <Text variant="eyebrow" tone="onInkMute" style={{ marginTop: 22 }}>
            Campus life
          </Text>
          <Text variant="display" tone="onInk" style={{ marginTop: 6 }}>
            Beyond the{' '}
            <Text variant="display" tone="onInk" italic>
              classroom.
            </Text>
          </Text>

          {/* My clubs strip */}
          <Pressable onPress={() => router.push('/clubs' as never)} style={{ marginTop: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' }}>
              {myClubs.length ? (
                <View style={{ flexDirection: 'row' }}>
                  {myClubs.slice(0, 4).map((c, i) => (
                    <View key={c._id} style={{ marginLeft: i ? -10 : 0 }}>
                      <ClubCrest theme={c.theme} icon={c.icon} category={c.category} size={34} />
                    </View>
                  ))}
                </View>
              ) : (
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
                  <PartyPopper size={20} color="#fff" />
                </View>
              )}
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text variant="h3" tone="onInk">
                  {myClubs.length ? `You’re in ${myClubs.length} club${myClubs.length > 1 ? 's' : ''}` : 'Join a club'}
                </Text>
                <Text variant="micro" tone="onInkMute">
                  {myClubs.length ? myClubs.map((c) => c.name).slice(0, 2).join(' · ') : 'Sports, tech, arts and more'}
                </Text>
              </View>
              <ChevronRight size={20} color="#fff" />
            </View>
          </Pressable>
        </LinearGradient>

        <View style={{ paddingHorizontal: 18 }}>
          {groups.map((g) => (
            <View key={g.title}>
              <SectionTitle title={g.title} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' }}>
                {g.tiles.map((t) => (
                  <QuickTile key={t.label} icon={t.icon} label={t.label} hint={t.hint} hue={t.hue} badge={t.badge} onPress={() => router.push(t.route as never)} />
                ))}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

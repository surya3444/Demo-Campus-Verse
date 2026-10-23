import { Tabs } from 'expo-router';
import { BookOpen, House, LayoutGrid, UserRound, Wallet } from 'lucide-react-native';
import { CampusTabBar, type TabSpec } from '@campus-verse/mobile-shared/design';

/**
 * Student tabs — the CampusVerse bar with the web's icons. "Campus" gathers
 * everything beyond class: clubs, Career Connect, Health Connect, hostel,
 * transport and the feed. Inbox opens from the bell on Today.
 */
const TABS: TabSpec[] = [
  { name: 'index', label: 'Today', icon: House },
  { name: 'academics', label: 'Learn', icon: BookOpen },
  { name: 'campus', label: 'Campus', icon: LayoutGrid },
  { name: 'pay', label: 'Pay', icon: Wallet },
  { name: 'me', label: 'Me', icon: UserRound },
];

export default function StudentTabLayout() {
  return (
    <Tabs tabBar={(p) => <CampusTabBar {...p} tabs={TABS} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="academics" />
      <Tabs.Screen name="campus" />
      <Tabs.Screen name="pay" />
      <Tabs.Screen name="me" />
      <Tabs.Screen name="timetable" options={{ href: null }} />
      <Tabs.Screen name="attendance" options={{ href: null }} />
      <Tabs.Screen name="assignments" options={{ href: null }} />
      <Tabs.Screen name="exams" options={{ href: null }} />
      <Tabs.Screen name="grades" options={{ href: null }} />
      <Tabs.Screen name="fees" options={{ href: null }} />
      <Tabs.Screen name="certificates" options={{ href: null }} />
      <Tabs.Screen name="health" options={{ href: null }} />
      <Tabs.Screen name="hostel" options={{ href: null }} />
      <Tabs.Screen name="announcements" options={{ href: null }} />
      <Tabs.Screen name="calendar" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="inbox" options={{ href: null }} />
    </Tabs>
  );
}

import { Tabs } from 'expo-router';
import { CalendarDays, ClipboardCheck, GraduationCap, House, UserRound } from 'lucide-react-native';
import { CampusTabBar, type TabSpec } from '@campus-verse/mobile-shared/design';

/** Staff tabs — the CampusVerse bar with the web's icons. */
const TABS: TabSpec[] = [
  { name: 'index', label: 'Today', icon: House },
  { name: 'timetable', label: 'Classes', icon: CalendarDays },
  { name: 'attendance', label: 'Attendance', icon: ClipboardCheck },
  { name: 'grades', label: 'Marks', icon: GraduationCap },
  { name: 'profile', label: 'Me', icon: UserRound },
];

export default function TeacherTabLayout() {
  return (
    <Tabs tabBar={(p) => <CampusTabBar {...p} tabs={TABS} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="timetable" />
      <Tabs.Screen name="attendance" />
      <Tabs.Screen name="grades" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="assignments" options={{ href: null }} />
      <Tabs.Screen name="exams" options={{ href: null }} />
      <Tabs.Screen name="lessons" options={{ href: null }} />
    </Tabs>
  );
}

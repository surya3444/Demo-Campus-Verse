import { Tabs } from 'expo-router';
import { View, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Text, color } from '@campus-verse/mobile-shared/design';

/**
 * Staff tab bar — same Almanac visual language as the student app, with a
 * slightly different chapter set: Today, Classes, Roll, Marks, Me.
 */

const TABS: { name: string; label: string; index: string }[] = [
  { name: 'index', label: 'Today', index: '01' },
  { name: 'timetable', label: 'Classes', index: '02' },
  { name: 'attendance', label: 'Roll', index: '03' },
  { name: 'grades', label: 'Marks', index: '04' },
  { name: 'profile', label: 'Me', index: '05' },
];

const VISIBLE = new Set(TABS.map((t) => t.name));

function AlmanacTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const visibleRoutes = state.routes.filter((r) => VISIBLE.has(r.name));
  const activeName = state.routes[state.index]?.name;

  return (
    <View
      style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}
      pointerEvents="box-none"
    >
      <View style={styles.bar}>
        <View style={styles.rule} />
        <View style={styles.row}>
          {visibleRoutes.map((route) => {
            const tab = TABS.find((t) => t.name === route.name)!;
            const focused = activeName === route.name;
            return (
              <TouchableOpacity
                key={route.key}
                onPress={() => {
                  const ev = navigation.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!focused && !ev.defaultPrevented) navigation.navigate(route.name);
                }}
                activeOpacity={0.7}
                style={styles.item}
              >
                <Text
                  variant="kicker"
                  tone={focused ? 'onInk' : 'onInkFaint'}
                  style={{ fontSize: 8.5, letterSpacing: 1.6 }}
                >
                  {tab.index}
                </Text>
                <View style={{ height: 2 }} />
                <Text
                  variant="h3"
                  tone={focused ? 'onInk' : 'onInkMute'}
                  italic={focused}
                  style={{ fontSize: 14.5 }}
                >
                  {tab.label}
                </Text>
                {focused && <View style={styles.underline} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export default function TeacherTabLayout() {
  return (
    <Tabs tabBar={(p) => <AlmanacTabBar {...p} />} screenOptions={{ headerShown: false }}>
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

const styles = StyleSheet.create({
  wrap: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  bar: {
    backgroundColor: color.ink,
    paddingTop: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.18,
        shadowRadius: 14,
      },
      android: { elevation: 18 },
    }),
  },
  rule: { height: 1, backgroundColor: 'rgba(245,240,230,0.16)', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  item: { flex: 1, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4 },
  underline: {
    position: 'absolute',
    bottom: 2,
    width: 22,
    height: 2,
    backgroundColor: color.marigold,
  },
});

import { Tabs } from 'expo-router';
import { View, TouchableOpacity, StyleSheet, Text, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

/* ─────────────────────────── Tokens ─────────────────────────── */

const C = {
  surface: '#FFFFFF',
  border: '#EEF1F5',
  textFaint: '#94A3B8',
  textMuted: '#475569',
  navy: '#0F172A',
  brand: '#4338CA',
};

type IoniconName = keyof typeof Ionicons.glyphMap;

const TABS: {
  name: string;
  label: string;
  icon: IoniconName;
  iconActive: IoniconName;
}[] = [
  { name: 'index', label: 'Today', icon: 'home-outline', iconActive: 'home' },
  { name: 'academics', label: 'Learn', icon: 'book-outline', iconActive: 'book' },
  { name: 'inbox', label: 'Inbox', icon: 'mail-outline', iconActive: 'mail' },
  { name: 'pay', label: 'Pay', icon: 'wallet-outline', iconActive: 'wallet' },
  { name: 'me', label: 'Me', icon: 'person-circle-outline', iconActive: 'person-circle' },
];

const VISIBLE = new Set(TABS.map((t) => t.name));

function CleanTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const visibleRoutes = state.routes.filter((r) => VISIBLE.has(r.name));
  const activeName = state.routes[state.index]?.name;

  return (
    <View
      style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8) }]}
      pointerEvents="box-none"
    >
      <View style={styles.bar}>
        {visibleRoutes.map((route) => {
          const tab = TABS.find((t) => t.name === route.name)!;
          const focused = activeName === route.name;
          const tint = focused ? C.brand : C.textFaint;
          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityLabel={tab.label}
              accessibilityState={focused ? { selected: true } : {}}
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
              <View style={styles.iconWrap}>
                <Ionicons name={focused ? tab.iconActive : tab.icon} size={22} color={tint} />
                {focused && <View style={styles.dot} />}
              </View>
              <Text style={[styles.label, { color: focused ? C.navy : C.textMuted }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs tabBar={(p) => <CleanTabBar {...p} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="academics" />
      <Tabs.Screen name="inbox" />
      <Tabs.Screen name="pay" />
      <Tabs.Screen name="me" />

      {/* Legacy tab screens kept as routable destinations (hidden from bar) */}
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
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.border,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
    }),
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingTop: 10,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  iconWrap: {
    width: 32,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    bottom: -2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.brand,
  },
  label: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 10.5,
    letterSpacing: 0.2,
    marginTop: 3,
  },
});

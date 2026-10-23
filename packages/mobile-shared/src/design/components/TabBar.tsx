import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import type { LucideIcon } from 'lucide-react-native';
import { Text } from './Text';
import { brand, color, elevation } from '../tokens';

export interface TabSpec {
  name: string;
  label: string;
  icon: LucideIcon;
}

function TabButton({
  tab,
  focused,
  onPress,
}: {
  tab: TabSpec;
  focused: boolean;
  onPress: () => void;
}) {
  const on = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    on.value = withSpring(focused ? 1 : 0, { damping: 16, stiffness: 200 });
  }, [focused, on]);
  const pill = useAnimatedStyle(() => ({
    opacity: on.value,
    transform: [{ scaleX: 0.6 + on.value * 0.4 }],
  }));
  const Glyph = tab.icon;
  return (
    <Pressable onPress={onPress} style={[styles.item, { flex: focused ? 1.55 : 1 }]} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={tab.label}>
      <Animated.View style={[styles.pill, pill]} />
      <View style={styles.inner}>
        <Glyph size={20} strokeWidth={focused ? 2.2 : 1.75} color={focused ? '#FFFFFF' : color.inkMute} />
        {focused && (
          <Text variant="micro" tone="onInk" style={{ marginLeft: 6, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12 }}>
            {tab.label}
          </Text>
        )}
      </View>
      {!focused && (
        <Text variant="micro" tone="inkFaint" style={{ marginTop: 3, fontSize: 10 }}>
          {tab.label}
        </Text>
      )}
    </Pressable>
  );
}

/**
 * CampusVerse tab bar: a floating white bar with the web's Lucide icons; the
 * active tab becomes a navy pill with its label. Shared by both apps.
 */
export function CampusTabBar({ state, navigation, tabs }: BottomTabBarProps & { tabs: TabSpec[] }) {
  const insets = useSafeAreaInsets();
  const visible = state.routes.filter((r) => tabs.some((t) => t.name === r.name));
  const active = state.routes[state.index]?.name;
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.bar}>
        {visible.map((route) => {
          const tab = tabs.find((t) => t.name === route.name)!;
          const focused = active === route.name;
          return (
            <TabButton
              key={route.key}
              tab={tab}
              focused={focused}
              onPress={() => {
                const ev = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !ev.defaultPrevented) {
                  Haptics.selectionAsync().catch(() => undefined);
                  navigation.navigate(route.name);
                }
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

/** Space a scrolling screen leaves at the bottom so content clears the bar. */
export const TAB_BAR_CLEARANCE = 112;

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: color.rule,
    ...elevation.lifted,
  },
  item: { flex: 1, height: 52, alignItems: 'center', justifyContent: 'center' },
  pill: {
    position: 'absolute',
    left: 2,
    right: 2,
    top: 7,
    bottom: 7,
    borderRadius: 19,
    backgroundColor: brand.navy800,
  },
  inner: { flexDirection: 'row', alignItems: 'center' },
});

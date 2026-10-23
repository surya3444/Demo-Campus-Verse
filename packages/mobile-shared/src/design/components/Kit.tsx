import { Pressable, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react-native';
import { Text } from './Text';
import { brand, color, elevation, radius } from '../tokens';

/** Gradient pairs for icon chips — CampusVerse hues, each module its own. */
export const HUE = {
  navy: [brand.navy700, brand.navy500],
  cyan: [brand.cyan600, brand.cyan400],
  emerald: ['#059669', '#34D399'],
  amber: ['#D97706', '#FBBF24'],
  rose: ['#E11D48', '#FB7185'],
  violet: ['#7C3AED', '#A78BFA'],
  teal: ['#0D9488', '#2DD4BF'],
  indigo: ['#4338CA', '#818CF8'],
  slate: ['#3E5683', '#8998B3'],
} as const;
export type Hue = keyof typeof HUE;

const tap = () => Haptics.selectionAsync().catch(() => undefined);

/** White card with the web's soft shadow. */
export function Surface({
  children,
  style,
  onPress,
  padded = 16,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  padded?: number;
}) {
  const body = (
    <View style={[{ backgroundColor: color.card, borderRadius: radius.lg, padding: padded, borderWidth: 1, borderColor: color.rule }, elevation.soft, style]}>
      {children}
    </View>
  );
  if (!onPress) return body;
  // The outer View owns layout (flex/width); Pressable only handles the press.
  const { flex, width, alignSelf } = (style ?? {}) as ViewStyle;
  return (
    <View style={{ flex, width, alignSelf }}>
      <Pressable onPress={() => (tap(), onPress())} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
        {body}
      </Pressable>
    </View>
  );
}

/** A Lucide icon on a gradient chip. */
export function IconChip({ icon: Glyph, hue = 'navy', size = 44 }: { icon: LucideIcon; hue?: Hue; size?: number }) {
  return (
    <LinearGradient
      colors={HUE[hue] as unknown as [string, string]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: size * 0.32, alignItems: 'center', justifyContent: 'center' }}
    >
      <Glyph size={size * 0.48} color="#FFFFFF" strokeWidth={2} />
    </LinearGradient>
  );
}

/** Shortcut tile: icon chip, label and an optional one-line hint or badge. */
export function QuickTile({
  icon,
  label,
  hint,
  hue,
  badge,
  onPress,
  width = '31%',
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  hue?: Hue;
  badge?: string | number;
  onPress: () => void;
  width?: ViewStyle['width'];
}) {
  return (
    <View style={{ width }}>
      <Pressable onPress={() => (tap(), onPress())} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
        <View style={[{ backgroundColor: color.card, borderRadius: radius.lg, paddingVertical: 14, paddingHorizontal: 8, alignItems: 'center', borderWidth: 1, borderColor: color.rule }, elevation.soft]}>
          <IconChip icon={icon} hue={hue} size={42} />
          <Text variant="micro" tone="ink" align="center" numberOfLines={1} style={{ marginTop: 9, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12 }}>
            {label}
          </Text>
          {hint ? (
            <Text variant="micro" tone="inkFaint" align="center" numberOfLines={1} style={{ marginTop: 2, fontSize: 10.5 }}>
              {hint}
            </Text>
          ) : null}
          {badge !== undefined && badge !== 0 && badge !== '' ? (
            <View style={{ position: 'absolute', top: 8, right: 8, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: brand.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }}>
              <Text variant="micro" tone="onInk" style={{ fontSize: 10.5, fontFamily: 'DMSans_700Bold' }}>
                {String(badge)}
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

export function SectionTitle({ title, action, onAction, style }: { title: string; action?: string; onAction?: () => void; style?: ViewStyle }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', marginTop: 26, marginBottom: 12 }, style]}>
      <Text variant="h2" tone="ink" style={{ flex: 1 }}>
        {title}
      </Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text variant="bodyStrong" tone="navy" style={{ fontSize: 13 }}>
            {action}
          </Text>
          <ChevronRight size={16} color={brand.navy700} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Screen header: round back button, eyebrow and title, optional right slot. */
export function ScreenHeader({
  eyebrow,
  title,
  subtitle,
  right,
  back = true,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  back?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={{ paddingTop: insets.top + 10, paddingBottom: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 40 }}>
        {back ? (
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/' as never))}
            hitSlop={10}
            accessibilityLabel="Back"
            style={[{ width: 40, height: 40, borderRadius: 20, backgroundColor: color.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: color.rule }, elevation.soft]}
          >
            <ChevronLeft size={20} color={brand.navy800} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }} />
        {right}
      </View>
      {eyebrow ? (
        <Text variant="eyebrow" tone="cyan" style={{ marginTop: 18 }}>
          {eyebrow}
        </Text>
      ) : null}
      <Text variant="display" tone="ink" style={{ marginTop: eyebrow ? 6 : 16 }}>
        {title}
      </Text>
      {subtitle ? (
        <Text variant="body" tone="inkMute" style={{ marginTop: 6 }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

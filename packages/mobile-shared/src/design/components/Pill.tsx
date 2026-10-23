import { View, type ViewStyle } from 'react-native';
import { Text } from './Text';
import { color, radius } from '../tokens';

interface PillProps {
  label: string;
  tone?: 'neutral' | 'marigold' | 'indigo' | 'sage' | 'brick' | 'ink';
  variant?: 'solid' | 'wash' | 'outline';
  size?: 'xs' | 'sm' | 'md';
  leading?: React.ReactNode;
  style?: ViewStyle;
}

const toneMap = {
  neutral: { fg: color.ink, solid: color.ink, wash: color.cardSink, outline: color.rule },
  marigold: {
    fg: color.marigoldDeep,
    solid: color.marigold,
    wash: color.marigoldWash,
    outline: color.marigold,
  },
  indigo: { fg: color.indigo, solid: color.indigo, wash: color.indigoWash, outline: color.indigo },
  sage: { fg: color.sage, solid: color.sage, wash: color.sageWash, outline: color.sage },
  brick: { fg: color.brick, solid: color.brick, wash: color.brickWash, outline: color.brick },
  ink: { fg: color.onInk, solid: color.ink, wash: color.cardSink, outline: color.ink },
} as const;

export function Pill({
  label,
  tone = 'neutral',
  variant = 'wash',
  size = 'sm',
  leading,
  style,
}: PillProps) {
  const m = toneMap[tone];
  const h = size === 'xs' ? 18 : size === 'sm' ? 22 : 26;
  const fontSize = size === 'xs' ? 9.5 : size === 'sm' ? 10.5 : 11.5;
  const bg = variant === 'solid' ? m.solid : variant === 'outline' ? 'transparent' : m.wash;
  const fg = variant === 'solid' ? (tone === 'neutral' ? color.onInk : '#FFFFFF') : m.fg;
  return (
    <View
      style={[
        {
          height: h,
          paddingHorizontal: size === 'xs' ? 6 : 9,
          borderRadius: radius.pill,
          backgroundColor: bg,
          borderWidth: variant === 'outline' ? 1 : 0,
          borderColor: m.outline,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
        },
        style,
      ]}
    >
      {leading}
      <Text
        style={{
          fontFamily: 'DMSans_700Bold',
          fontSize: fontSize + 0.5,
          letterSpacing: 0.2,
          color: fg,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
